const LOCAL_KEY = "gymflow.local.v1";

const COLLECTIONS = [
  "members",
  "trainers",
  "membership_plans",
  "payments",
  "attendance",
  "trainer_attendance",
  "workout_templates",
  "workout_assignments",
  "progress_records",
  "reminders",
  "users"
];

export async function createServices(config = window.GYM_CONFIG || {}) {
  if (isFirebaseConfigured(config.firebase)) {
    try {
      return await createFirebaseServices(config.firebase);
    } catch (error) {
      console.warn("Firebase unavailable. Falling back to local storage.", error);
    }
  }

  return createLocalServices(config);
}

function isFirebaseConfigured(firebaseConfig = {}) {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      !firebaseConfig.apiKey.includes("YOUR_") &&
      !firebaseConfig.projectId.includes("YOUR_")
  );
}

async function createFirebaseServices(firebaseConfig) {
  const [{ initializeApp }, authApi, firestoreApi] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
  ]);

  const app = initializeApp(firebaseConfig);
  const auth = authApi.getAuth(app);

  // initializeFirestore (not getFirestore) so we can force long-polling.
  // Many networks/proxies/browser extensions/firewalls block Firestore's
  // streaming WebChannel, which surfaces as endless `channel?VER=8` retries
  // and "Failed to get document because the client is offline". Forcing
  // long-polling uses plain XHR requests that those setups allow through.
  const db = firestoreApi.initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });

  let profile = null;
  let listeners = [];
  let authResolved = false; // becomes true once Firebase reports its first auth state

  authApi.onAuthStateChanged(auth, async (user) => {
    try {
      profile = user ? await loadFirebaseProfile(db, firestoreApi, user.uid) : null;
    } catch (error) {
      // Auth succeeded but Firestore is unreachable. Don't throw uncaught — keep a
      // minimal profile from the auth user so the app can show its error screen.
      console.error("Could not load profile from Firestore.", error);
      // Don't assume "owner" — a member must never briefly see owner UI on a
      // transient Firestore read failure. Preserve any role we already had.
      profile = user
        ? { id: user.uid, uid: user.uid, name: user.displayName || user.email, email: user.email, role: profile?.role || "member" }
        : null;
    }
    authResolved = true;
    listeners.forEach((listener) => listener(profile));
  });

  async function requireProfile() {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in.");
    if (!profile) profile = await loadFirebaseProfile(db, firestoreApi, user.uid);
    return profile;
  }

  return {
    mode: "firebase",
    auth: {
      onAuthChange(callback) {
        listeners.push(callback);
        // Only replay the current state if Firebase has already resolved it.
        // Before that, stay silent so the app shows its boot splash (not the
        // login screen) while the persisted session is being restored.
        if (authResolved) callback(profile);
        return () => {
          listeners = listeners.filter((listener) => listener !== callback);
        };
      },
      async registerOwner({ gymName, name, email, password }) {
        const credential = await authApi.createUserWithEmailAndPassword(auth, email, password);
        const gymId = credential.user.uid;
        const now = timestamp();
        const gymCode = await reserveGymCode(db, firestoreApi, gymName, gymId);
        const userProfile = {
          id: credential.user.uid,
          uid: credential.user.uid,
          gymId,
          gymName,
          gymCode,
          name,
          email,
          role: "owner",
          createdAt: now,
          updatedAt: now
        };

        await authApi.updateProfile(credential.user, { displayName: name });
        await firestoreApi.setDoc(firestoreApi.doc(db, "users", credential.user.uid), userProfile);
        await firestoreApi.setDoc(firestoreApi.doc(db, "gym_settings", gymId), {
          id: gymId,
          gymId,
          gymName,
          gymCode,
          ownerName: name,
          contactEmail: email,
          currency: "INR",
          createdAt: now,
          updatedAt: now
        });
        await seedDefaultPlansFirebase(db, firestoreApi, gymId);
        profile = userProfile;
        listeners.forEach((listener) => listener(profile));
        return profile;
      },
      async registerMember({ gymName: _ignored, name, email, password, gymCode }) {
        // Resolve the code FIRST so a bad code never creates an orphan auth user.
        const code = String(gymCode || "").trim().toUpperCase();
        if (!code) throw new Error("Enter your gym code.");
        const codeSnap = await firestoreApi.getDoc(firestoreApi.doc(db, "gym_codes", code));
        if (!codeSnap.exists()) {
          throw new Error("That gym code is not valid. Check with your gym.");
        }
        const { gymId, gymName } = codeSnap.data();

        const credential = await authApi.createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;
        const now = timestamp();
        const userProfile = {
          id: uid,
          uid,
          gymId, // the joined gym, NOT the member's own uid
          gymName,
          name,
          email,
          role: "member",
          gymCodeUsed: code, // read by the users-create rule to validate the join
          createdAt: now,
          updatedAt: now
        };

        await authApi.updateProfile(credential.user, { displayName: name });
        // User doc MUST exist before the roster doc (the members-create rule reads it).
        await firestoreApi.setDoc(firestoreApi.doc(db, "users", uid), userProfile);
        const memberId = createId("member");
        await firestoreApi.setDoc(firestoreApi.doc(db, "members", memberId), {
          id: memberId,
          gymId,
          uid,
          fullName: name,
          email,
          status: "Pending",
          joinDate: now.slice(0, 10),
          createdAt: now,
          updatedAt: now
        });
        profile = userProfile;
        listeners.forEach((listener) => listener(profile));
        return profile;
      },
      async registerTrainer({ name, email, password, gymCode }) {
        // Mirrors registerMember: resolve the code FIRST so a bad code never
        // creates an orphan auth user.
        const code = String(gymCode || "").trim().toUpperCase();
        if (!code) throw new Error("Enter your gym code.");
        const codeSnap = await firestoreApi.getDoc(firestoreApi.doc(db, "gym_codes", code));
        if (!codeSnap.exists()) {
          throw new Error("That gym code is not valid. Check with your gym.");
        }
        const { gymId, gymName } = codeSnap.data();

        const credential = await authApi.createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;
        const now = timestamp();
        const userProfile = {
          id: uid,
          uid,
          gymId, // the joined gym, NOT the trainer's own uid
          gymName,
          name,
          email,
          role: "trainer",
          gymCodeUsed: code, // read by the users-create rule to validate the join
          createdAt: now,
          updatedAt: now
        };

        await authApi.updateProfile(credential.user, { displayName: name });
        // User doc MUST exist before the roster doc (the trainers-create rule reads it).
        await firestoreApi.setDoc(firestoreApi.doc(db, "users", uid), userProfile);
        const trainerId = createId("trainer");
        await firestoreApi.setDoc(firestoreApi.doc(db, "trainers", trainerId), {
          id: trainerId,
          gymId,
          uid,
          name, // trainers key off `name`, not `fullName`
          email,
          status: "Pending",
          createdAt: now,
          updatedAt: now
        });
        profile = userProfile;
        listeners.forEach((listener) => listener(profile));
        return profile;
      },
      async login(email, password) {
        await authApi.signInWithEmailAndPassword(auth, email, password);
      },
      async logout() {
        await authApi.signOut(auth);
      },
      async resetPassword(email) {
        await authApi.sendPasswordResetEmail(auth, email);
      },
      async useDemo() {
        throw new Error("Demo mode is only available before Firebase is configured.");
      },
      getProfile() {
        return profile;
      }
    },
    data: {
      async list(collectionName) {
        const userProfile = await requireProfile();
        if (!userProfile?.gymId) return [];
        const queryRef = firestoreApi.query(
          firestoreApi.collection(db, collectionName),
          firestoreApi.where("gymId", "==", userProfile.gymId)
        );
        const snapshot = await firestoreApi.getDocs(queryRef);
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byUpdatedAt);
      },
      async save(collectionName, docData) {
        const userProfile = await requireProfile();
        const now = timestamp();
        const id = docData.id || createId(collectionName);
        const next = {
          ...docData,
          id,
          gymId: userProfile.gymId,
          updatedAt: now,
          createdAt: docData.createdAt || now
        };
        await firestoreApi.setDoc(firestoreApi.doc(db, collectionName, id), next, { merge: true });
        return next;
      },
      async remove(collectionName, id) {
        await requireProfile();
        await firestoreApi.deleteDoc(firestoreApi.doc(db, collectionName, id));
      },
      async getSettings() {
        const userProfile = await requireProfile();
        // Per-gym settings doc (id == gymId).
        const snapshot = await firestoreApi.getDoc(firestoreApi.doc(db, "gym_settings", userProfile.gymId));
        if (snapshot.exists()) {
          return { id: snapshot.id, ...snapshot.data() };
        }
        // Best-effort legacy fallback: the old shared "profile" doc (only valid if
        // it actually belongs to this gym). First Save migrates to the new id.
        try {
          const legacy = await firestoreApi.getDoc(firestoreApi.doc(db, "gym_settings", "profile"));
          if (legacy.exists() && legacy.data().gymId === userProfile.gymId) {
            return { id: userProfile.gymId, ...legacy.data() };
          }
        } catch (error) {
          /* legacy doc may be unreadable under new rules — ignore */
        }
        return {
          id: userProfile.gymId,
          gymId: userProfile.gymId,
          gymName: userProfile.gymName,
          gymCode: userProfile.gymCode || ""
        };
      },
      async saveSettings(settings) {
        const userProfile = await requireProfile();
        const next = {
          ...settings,
          id: userProfile.gymId,
          gymId: userProfile.gymId,
          updatedAt: timestamp()
        };
        await firestoreApi.setDoc(firestoreApi.doc(db, "gym_settings", userProfile.gymId), next, { merge: true });
        return next;
      },
      async exportData() {
        const settings = await this.getSettings();
        const payload = { settings, collections: {} };
        for (const collectionName of COLLECTIONS) {
          payload.collections[collectionName] = await this.list(collectionName);
        }
        return payload;
      },
      async importData() {
        throw new Error("Import is available in local demo mode. Use Firebase console exports for production.");
      }
    }
  };
}

async function loadFirebaseProfile(db, api, uid) {
  const snapshot = await api.getDoc(api.doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function seedDefaultPlansFirebase(db, api, gymId) {
  const plans = defaultPlans(gymId);
  await Promise.all(plans.map((plan) => api.setDoc(api.doc(db, "membership_plans", plan.id), plan)));
}

function createLocalServices(config) {
  let state = loadState(config);
  let listeners = [];

  function saveState() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }

  function currentProfile() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function emitAuth() {
    const profile = currentProfile();
    listeners.forEach((listener) => listener(sanitizeUser(profile)));
  }

  function ensureCollection(collectionName) {
    state.collections[collectionName] ||= [];
    return state.collections[collectionName];
  }

  return {
    mode: "local",
    auth: {
      onAuthChange(callback) {
        listeners.push(callback);
        callback(sanitizeUser(currentProfile()));
        return () => {
          listeners = listeners.filter((listener) => listener !== callback);
        };
      },
      async registerOwner({ gymName, name, email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        if (state.users.some((user) => user.email === normalizedEmail)) {
          throw new Error("An account with this email already exists.");
        }

        const now = timestamp();
        const gymId = createId("gym");
        const uid = createId("uid");
        const gymCode = reserveLocalGymCode(state, gymName, gymId);
        const user = {
          id: createId("user"),
          uid,
          gymId,
          gymName,
          gymCode,
          name,
          email: normalizedEmail,
          role: "owner",
          password,
          createdAt: now,
          updatedAt: now
        };

        state.users.push(user);
        state.sessionUserId = user.id;
        state.settings = {
          id: gymId,
          gymId,
          gymName,
          gymCode,
          ownerName: name,
          contactEmail: normalizedEmail,
          phone: "",
          address: "",
          currency: "INR",
          createdAt: now,
          updatedAt: now
        };
        state.collections.membership_plans = defaultPlans(gymId);
        saveState();
        emitAuth();
        return sanitizeUser(user);
      },
      async registerMember({ name, email, password, gymCode }) {
        const normalizedEmail = email.trim().toLowerCase();
        if (state.users.some((user) => user.email === normalizedEmail)) {
          throw new Error("An account with this email already exists.");
        }
        const code = String(gymCode || "").trim().toUpperCase();
        const target = state.gymCodes?.[code];
        if (!target) throw new Error("That gym code is not valid. Check with your gym.");

        const now = timestamp();
        const uid = createId("uid");
        const user = {
          id: createId("user"),
          uid,
          gymId: target.gymId,
          gymName: target.gymName,
          name,
          email: normalizedEmail,
          role: "member",
          gymCodeUsed: code,
          password,
          createdAt: now,
          updatedAt: now
        };
        state.users.push(user);
        state.sessionUserId = user.id;

        const members = (state.collections.members ||= []);
        members.push({
          id: createId("member"),
          gymId: target.gymId,
          uid,
          fullName: name,
          email: normalizedEmail,
          status: "Pending",
          joinDate: now.slice(0, 10),
          createdAt: now,
          updatedAt: now
        });
        saveState();
        emitAuth();
        return sanitizeUser(user);
      },
      async registerTrainer({ name, email, password, gymCode }) {
        const normalizedEmail = email.trim().toLowerCase();
        if (state.users.some((user) => user.email === normalizedEmail)) {
          throw new Error("An account with this email already exists.");
        }
        const code = String(gymCode || "").trim().toUpperCase();
        const target = state.gymCodes?.[code];
        if (!target) throw new Error("That gym code is not valid. Check with your gym.");

        const now = timestamp();
        const uid = createId("uid");
        const user = {
          id: createId("user"),
          uid,
          gymId: target.gymId,
          gymName: target.gymName,
          name,
          email: normalizedEmail,
          role: "trainer",
          gymCodeUsed: code,
          password,
          createdAt: now,
          updatedAt: now
        };
        state.users.push(user);
        state.sessionUserId = user.id;

        const trainers = (state.collections.trainers ||= []);
        trainers.push({
          id: createId("trainer"),
          gymId: target.gymId,
          uid,
          name,
          email: normalizedEmail,
          status: "Pending",
          createdAt: now,
          updatedAt: now
        });
        saveState();
        emitAuth();
        return sanitizeUser(user);
      },
      async login(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = state.users.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
        if (!user) throw new Error("Invalid email or password.");
        state.sessionUserId = user.id;
        saveState();
        emitAuth();
        return sanitizeUser(user);
      },
      async logout() {
        state.sessionUserId = null;
        saveState();
        emitAuth();
      },
      async resetPassword(email) {
        const exists = state.users.some((user) => user.email === email.trim().toLowerCase());
        if (!exists) throw new Error("No local account was found for that email.");
        return true;
      },
      async useDemo() {
        if (!state.users.some((user) => user.email === "owner@gymflow.local")) {
          state = createSeedState(config);
        }
        const demo = state.users.find((user) => user.email === "owner@gymflow.local");
        state.sessionUserId = demo.id;
        saveState();
        emitAuth();
        return sanitizeUser(demo);
      },
      getProfile() {
        const profile = currentProfile();
        return profile ? sanitizeUser(profile) : null;
      }
    },
    data: {
      async list(collectionName) {
        return [...ensureCollection(collectionName)].sort(byUpdatedAt);
      },
      async save(collectionName, docData) {
        const profile = currentProfile();
        if (!profile) throw new Error("You must be signed in.");

        const collection = ensureCollection(collectionName);
        const now = timestamp();
        const id = docData.id || createId(collectionName);
        const existingIndex = collection.findIndex((item) => item.id === id);
        const next = {
          ...docData,
          id,
          gymId: profile.gymId,
          updatedAt: now,
          createdAt: docData.createdAt || now
        };

        if (existingIndex >= 0) {
          collection[existingIndex] = { ...collection[existingIndex], ...next };
        } else {
          collection.push(next);
        }
        saveState();
        return next;
      },
      async remove(collectionName, id) {
        const collection = ensureCollection(collectionName);
        state.collections[collectionName] = collection.filter((item) => item.id !== id);
        saveState();
      },
      async getSettings() {
        return state.settings;
      },
      async saveSettings(settings) {
        state.settings = { ...state.settings, ...settings, updatedAt: timestamp() };
        saveState();
        return state.settings;
      },
      async exportData() {
        return {
          exportedAt: timestamp(),
          settings: state.settings,
          users: state.users.map(sanitizeUser),
          collections: state.collections
        };
      },
      async importData(payload) {
        if (!payload || !payload.collections || !payload.settings) {
          throw new Error("The selected file is not a GymFlow export.");
        }
        state.settings = payload.settings;
        state.collections = payload.collections;
        saveState();
      }
    }
  };
}

function loadState(config) {
  const saved = localStorage.getItem(LOCAL_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      parsed.collections ||= {};
      parsed.gymCodes ||= {};
      COLLECTIONS.forEach((collection) => {
        parsed.collections[collection] ||= [];
      });
      return parsed;
    } catch (error) {
      console.warn("Unable to read local GymFlow state.", error);
    }
  }

  return createEmptyState(config);
}

function createEmptyState(config) {
  const gymId = "local-gym";
  const collections = {};
  COLLECTIONS.forEach((collection) => {
    collections[collection] = [];
  });

  return {
    version: 1,
    sessionUserId: null,
    gymCodes: {},
    settings: {
      id: gymId,
      gymId,
      gymName: config.appName || "GymFlow",
      ownerName: "",
      contactEmail: "",
      currency: "INR",
      phone: "",
      address: ""
    },
    users: [],
    collections
  };
}

// Local-mode gym code reservation (mirrors reserveGymCode for firebase).
function reserveLocalGymCode(state, gymName, gymId) {
  state.gymCodes ||= {};
  let code = makeGymCode(gymName);
  let guard = 0;
  while (state.gymCodes[code] && guard < 20) {
    code = makeGymCode(gymName);
    guard += 1;
  }
  state.gymCodes[code] = { code, gymId, gymName };
  return code;
}

function createSeedState(config) {
  const now = timestamp();
  const gymId = "demo-gym";
  const gymCode = "DEMO-1000";
  const owner = {
    id: "demo-owner",
    uid: "demo-owner",
    gymId,
    gymName: "GymFlow Demo Club",
    gymCode,
    name: "Demo Owner",
    email: "owner@gymflow.local",
    password: "demo1234",
    role: "owner",
    createdAt: now,
    updatedAt: now
  };

  const collections = {};
  COLLECTIONS.forEach((collection) => {
    collections[collection] = [];
  });

  collections.membership_plans = defaultPlans(gymId);
  collections.trainers = [
    doc("trainer", gymId, { name: "Rahul Mehta", mobile: "+91 90000 10001", email: "rahul@example.com", specialization: "Strength", experience: "5 years" }),
    doc("trainer", gymId, { name: "Anika Rao", mobile: "+91 90000 10002", email: "anika@example.com", specialization: "Weight loss", experience: "4 years" })
  ];
  collections.members = [
    doc("member", gymId, {
      fullName: "Ravi Kumar",
      mobile: "+91 98765 43210",
      email: "ravi@example.com",
      gender: "Male",
      joinDate: today(-35),
      planId: collections.membership_plans[0].id,
      startDate: today(-25),
      endDate: today(5),
      assignedTrainer: collections.trainers[0].id,
      status: "Active"
    }),
    doc("member", gymId, {
      fullName: "Neha Singh",
      mobile: "+91 98765 43211",
      email: "neha@example.com",
      gender: "Female",
      joinDate: today(-80),
      planId: collections.membership_plans[1].id,
      startDate: today(-75),
      endDate: today(15),
      assignedTrainer: collections.trainers[1].id,
      status: "Active"
    }),
    doc("member", gymId, {
      fullName: "Arjun Das",
      mobile: "+91 98765 43212",
      email: "arjun@example.com",
      gender: "Male",
      joinDate: today(-140),
      planId: collections.membership_plans[0].id,
      startDate: today(-65),
      endDate: today(-3),
      assignedTrainer: collections.trainers[0].id,
      status: "Expired"
    })
  ];
  collections.payments = [
    doc("payment", gymId, {
      memberId: collections.members[0].id,
      amount: 1500,
      date: today(-25),
      method: "UPI",
      planId: collections.membership_plans[0].id,
      collectedBy: "Demo Owner",
      status: "Paid"
    }),
    doc("payment", gymId, {
      memberId: collections.members[1].id,
      amount: 3999,
      date: today(-75),
      method: "Card",
      planId: collections.membership_plans[1].id,
      collectedBy: "Demo Owner",
      status: "Paid"
    })
  ];
  collections.attendance = [
    doc("attendance", gymId, { memberId: collections.members[0].id, date: today(0), time: "07:45", trainerId: collections.trainers[0].id }),
    doc("attendance", gymId, { memberId: collections.members[1].id, date: today(-1), time: "18:10", trainerId: collections.trainers[1].id })
  ];
  collections.reminders = [];

  return {
    version: 1,
    sessionUserId: owner.id,
    gymCodes: { [gymCode]: { code: gymCode, gymId, gymName: "GymFlow Demo Club" } },
    settings: {
      id: gymId,
      gymId,
      gymName: "GymFlow Demo Club",
      gymCode,
      ownerName: owner.name,
      contactEmail: owner.email,
      currency: "INR",
      phone: "+91 90000 00000",
      address: "Main Road, Hyderabad",
      createdAt: now,
      updatedAt: now
    },
    users: [owner],
    collections
  };
}

function defaultPlans(gymId) {
  return [
    doc("plan", gymId, {
      planName: "Monthly",
      durationDays: 30,
      price: 1500,
      description: "Standard one month gym access.",
      benefits: "Gym floor, locker access"
    }),
    doc("plan", gymId, {
      planName: "Quarterly",
      durationDays: 90,
      price: 3999,
      description: "Three months with renewal savings.",
      benefits: "Gym floor, locker access, fitness review"
    }),
    doc("plan", gymId, {
      planName: "Personal Training",
      durationDays: 30,
      price: 7000,
      description: "Monthly plan with dedicated trainer support.",
      benefits: "Gym floor, trainer sessions, progress tracking"
    })
  ];
}

function doc(prefix, gymId, data) {
  const now = timestamp();
  return {
    id: createId(prefix),
    gymId,
    createdAt: now,
    updatedAt: now,
    ...data
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function byUpdatedAt(a, b) {
  return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
}

function createId(prefix) {
  const random = crypto?.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

// Short, shareable, phone-friendly gym code: PREFIX-NNNN (e.g. GRIP-4821).
function makeGymCode(gymName) {
  const prefix = String(gymName || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GYM";
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${suffix}`;
}

// Reserve a unique gym code by writing the public gym_codes/{CODE} lookup doc.
// Read-then-create loop; the 9000-suffix space makes collisions rare for the
// expected number of gyms. Returns the reserved code.
async function reserveGymCode(db, api, gymName, gymId) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeGymCode(gymName);
    const ref = api.doc(db, "gym_codes", code);
    const existing = await api.getDoc(ref);
    if (existing.exists()) continue;
    await api.setDoc(ref, { code, gymId, gymName, createdAt: timestamp() });
    return code;
  }
  // Extremely unlikely fallback: append part of the gymId for uniqueness.
  const code = `${makeGymCode(gymName)}${gymId.slice(0, 2).toUpperCase()}`;
  await api.setDoc(api.doc(db, "gym_codes", code), { code, gymId, gymName, createdAt: timestamp() });
  return code;
}

function timestamp() {
  return new Date().toISOString();
}

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}
