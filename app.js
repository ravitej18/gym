import { createServices } from "./lib/firebase-init.js";
import { renderAuth } from "./modules/auth.js";
import { dashboardModule } from "./modules/dashboard.js";
import { membersModule } from "./modules/members.js";
import { membershipsModule } from "./modules/memberships.js";
import { paymentsModule } from "./modules/payments.js";
import { renewalsModule } from "./modules/renewals.js";
import { remindersModule } from "./modules/reminders.js";
import { trainersModule } from "./modules/trainers.js";
import { attendanceModule } from "./modules/attendance.js";
import { workoutsModule } from "./modules/workouts.js";
import { progressModule } from "./modules/progress.js";
import { reportsModule } from "./modules/reports.js";
import { settingsModule } from "./modules/settings.js";
import { myMembershipModule } from "./modules/my-membership.js";
import { myPaymentsModule } from "./modules/my-payments.js";
import { trainerCheckinModule } from "./modules/trainer-checkin.js";

const appRoot = document.querySelector("#app");

// Apply saved theme before any render to prevent flash
(function initTheme() {
  const saved = localStorage.getItem("gf-theme");
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
})();

// 4th element = roles allowed to see this nav item / route. Defaults to owner+member.
const ALL_ROLES = ["owner", "member"];
const nav = [
  ["dashboard", "Dashboard", "grid_view", ["owner", "member", "trainer"]],
  ["members", "Members", "group", ["owner"]],
  ["plans", "Plans", "layers", ["owner"]],
  ["payments", "Payments", "payments", ["owner"]],
  ["renewals", "Renewals", "autorenew", ["owner"]],
  ["reminders", "Reminders", "chat", ["owner"]],
  ["trainers", "Trainers", "badge", ["owner"]],
  ["attendance", "Attendance", "how_to_reg", ALL_ROLES],
  ["workouts", "Workouts", "fitness_center", ["owner"]],
  ["progress", "Progress", "trending_up", ALL_ROLES],
  ["reports", "Reports", "bar_chart", ["owner"]],
  ["my-membership", "My Membership", "card_membership", ["member"]],
  ["my-payments", "My Payments", "receipt_long", ["member"]],
  ["trainer-checkin", "Check In", "how_to_reg", ["trainer"]],
  ["my-checkins", "My Check-ins", "history", ["trainer"]],
  ["settings", "Settings", "settings", ["owner"]]
];

const modules = {
  dashboard: dashboardModule,
  members: membersModule,
  plans: membershipsModule,
  payments: paymentsModule,
  renewals: renewalsModule,
  reminders: remindersModule,
  trainers: trainersModule,
  attendance: attendanceModule,
  workouts: workoutsModule,
  progress: progressModule,
  reports: reportsModule,
  "my-membership": myMembershipModule,
  "my-payments": myPaymentsModule,
  "trainer-checkin": trainerCheckinModule,
  "my-checkins": trainerCheckinModule,
  settings: settingsModule
};

function roleAllows(route, role) {
  const entry = nav.find(([key]) => key === route);
  const roles = entry?.[3] || ALL_ROLES;
  return roles.includes(role);
}

const collectionNames = [
  "members",
  "trainers",
  "membership_plans",
  "payments",
  "attendance",
  "workout_templates",
  "workout_assignments",
  "progress_records",
  "reminders",
  "trainer_attendance"
];

const state = {
  route: getRoute(),
  profile: null,
  services: null,
  settings: null,
  data: {},
  loading: true,
  authReady: false,
  error: "",
  toast: ""
};

boot();

async function boot() {
  state.services = await createServices(window.GYM_CONFIG || {});
  registerServiceWorker();

  window.addEventListener("hashchange", () => {
    state.route = getRoute();
    render();
  });

  state.services.auth.onAuthChange(async (profile) => {
    state.authReady = true;
    state.profile = profile;
    if (profile) {
      await refreshData();
    } else {
      state.loading = false;
      render();
    }
  });

  // Local mode resolves auth synchronously; render the splash immediately
  // for Firebase mode while the persisted session is being restored.
  render();
}

// Fetch settings + all collections into state. Sets state.error on failure.
// Does NOT render — callers decide whether to do a full render() or renderView().
async function reloadData() {
  try {
    const [settings, ...collections] = await Promise.all([
      state.services.data.getSettings(),
      ...collectionNames.map((name) => state.services.data.list(name))
    ]);

    state.settings = settings;
    state.data = Object.fromEntries(collectionNames.map((name, index) => [name, collections[index]]));
    state.error = "";
  } catch (error) {
    console.error("Failed to load workspace data.", error);
    state.error = /offline|unavailable|network/i.test(error?.message || "")
      ? "Can't reach the database. Check your connection (an ad-blocker, VPN, or proxy can block Firestore), then retry."
      : error?.message || "Could not load your workspace.";
  }
}

// Full refresh: reload data and rebuild the whole shell. Used on initial load
// and when shell-level data changes (e.g. gym name in the sidebar).
async function refreshData() {
  state.loading = true;
  state.error = "";
  render();
  await reloadData();
  state.loading = false;
  render();
}

// Scoped refresh: reload data but re-render only the current module's #view,
// avoiding a full shell rebuild (no flicker / scroll jump). Used after form saves.
async function refreshView() {
  await reloadData();
  if (state.error) {
    render(); // surface the error screen via the full renderer
    return;
  }
  renderView();
}

// Apply a just-saved doc to local state WITHOUT re-reading from the backend.
// save() returns the complete persisted doc, so we upsert it in place and
// re-render only the current view — 0 extra reads per save.
function applyChange(collectionName, savedDoc) {
  if (!savedDoc) return;
  const list = state.data[collectionName] || [];
  const index = list.findIndex((item) => item.id === savedDoc.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...savedDoc };
  } else {
    list.unshift(savedDoc); // newest first, matches list() sort by updatedAt desc
  }
  state.data[collectionName] = list;
  renderView();
}

// Remove a doc from local state (after a successful delete) and re-render.
function applyRemoval(collectionName, id) {
  state.data[collectionName] = (state.data[collectionName] || []).filter((item) => item.id !== id);
  renderView();
}

function render() {
  // Until the auth provider reports its first result, show the splash rather
  // than the login form — this avoids a flash of the login screen on refresh
  // while a persisted session is being restored.
  if (!state.authReady) {
    appRoot.innerHTML = `
      <div class="boot-screen">
        <div class="boot-mark">GF</div>
        <p>Loading GymFlow...</p>
      </div>
    `;
    return;
  }

  if (!state.profile) {
    renderAuth(appRoot, {
      services: state.services,
      mode: state.services?.mode,
      onToast: showToast
    });
    return;
  }

  if (state.loading) {
    appRoot.innerHTML = `
      <div class="boot-screen">
        <div class="boot-mark">GF</div>
        <p>Syncing workspace...</p>
      </div>
    `;
    return;
  }

  if (state.error) {
    appRoot.innerHTML = `
      <div class="boot-screen">
        <div class="boot-mark">GF</div>
        <p class="boot-error">${state.error}</p>
        <div class="button-row">
          <button class="primary-button" data-action="retry">Retry</button>
          <button class="ghost-button" data-action="logout">Sign out</button>
        </div>
      </div>
    `;
    appRoot.querySelector("[data-action='retry']")?.addEventListener("click", () => refreshData());
    appRoot.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
      await state.services.auth.logout();
    });
    return;
  }

  // Route guard: bounce a role off a route it isn't allowed to see.
  const role = state.profile.role || "owner";
  if (!roleAllows(state.route, role)) {
    state.route = "dashboard";
    if (location.hash !== "#/dashboard") location.hash = "#/dashboard";
  }

  const currentModule = modules[state.route] || dashboardModule;
  const currentNav = nav.find(([key]) => key === state.route) || nav[0];
  const visibleNav = nav.filter(([, , , roles]) => (roles || ALL_ROLES).includes(role));

  appRoot.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">GF</div>
        <div>
          <strong>${state.settings?.gymName || "GymFlow"}</strong>
          <span>${state.services.mode === "firebase" ? "Live Workspace" : "Demo Workspace"}</span>
        </div>
      </div>
      <nav class="nav-list">
        ${visibleNav
          .map(
            ([key, label, icon]) => `
              <a href="#/${key}" class="${key === currentNav[0] ? "active" : ""}" data-label="${label}">
                <span class="nav-icon">${iconSymbol(icon)}</span>
                <span>${label}</span>
              </a>
            `
          )
          .join("")}
      </nav>
      <div class="sidebar-footer">
        <div class="profile-chip">
          <span class="avatar">${initials(state.profile.name)}</span>
          <div>
            <strong>${state.profile.name}</strong>
            <span>${state.profile.role}</span>
          </div>
        </div>
      </div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <button class="icon-button mobile-nav" data-action="toggle-nav" aria-label="Open menu" title="Menu">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <div class="topbar-search">
          <span class="material-symbols-outlined">search</span>
          <input type="search" placeholder="Search members, payments…" aria-label="Search" />
        </div>
        <div class="topbar-actions">
          <a class="pill-button" href="#/${state.profile.role === "trainer" ? "trainer-checkin" : "attendance"}">
            <span class="material-symbols-outlined">login</span><span>Check-in</span>
          </a>
          <div class="topbar-user">
            <span class="eyebrow">${state.profile.role}</span>
            <strong>${state.profile.name}</strong>
          </div>
          <button class="theme-toggle" data-action="toggle-theme" aria-label="Toggle theme" title="Toggle dark/light mode">
            <span class="material-symbols-outlined theme-icon-light">dark_mode</span>
            <span class="material-symbols-outlined theme-icon-dark">light_mode</span>
          </button>
          <button class="ghost-button" data-action="logout">Sign out</button>
        </div>
      </header>
      <section class="content-panel" id="view">${currentModule.render(makeContext())}</section>
    </main>
    <div class="toast ${state.toast ? "show" : ""}">${state.toast}</div>
    <div class="nav-scrim" data-action="close-nav"></div>
  `;

  bindAppEvents();
  currentModule.bind?.(document.querySelector("#view"), makeContext());
}

// Re-render only the current module's #view (and re-bind it), leaving the
// sidebar/topbar untouched. No-op if the shell isn't mounted yet.
function renderView() {
  const view = document.querySelector("#view");
  if (!view) {
    render();
    return;
  }
  const currentModule = modules[state.route] || dashboardModule;
  view.innerHTML = currentModule.render(makeContext());
  currentModule.bind?.(view, makeContext());
}

function makeContext() {
  // The signed-in member's / trainer's own roster id (doc linked by uid), if any.
  const myMember = (state.data.members || []).find((m) => m.uid === state.profile?.uid) || null;
  const myTrainer = (state.data.trainers || []).find((t) => t.uid === state.profile?.uid) || null;
  return {
    profile: state.profile,
    settings: state.settings,
    data: state.data,
    services: state.services,
    refresh: refreshData,
    refreshView,
    applyChange,
    applyRemoval,
    myMember,
    myMemberId: myMember?.id || null,
    myTrainer,
    myTrainerId: myTrainer?.id || null,
    navigate(route) {
      location.hash = `#/${route}`;
    },
    toast: showToast
  };
}

function bindAppEvents() {
  document.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await state.services.auth.logout();
    showToast("Signed out.");
  });

  document.querySelector("[data-action='toggle-nav']")?.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });

  document.querySelector("[data-action='close-nav']")?.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
  });

  // Close mobile nav when a nav link is clicked
  document.querySelectorAll(".nav-list a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
    });
  });

  document.querySelector("[data-action='toggle-theme']")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gf-theme", next);
  });

  const topSearch = document.querySelector(".topbar-search input");
  topSearch?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const term = topSearch.value.trim();
    if (state.route !== "members") location.hash = "#/members";
    requestAnimationFrame(() => {
      const field = document.querySelector("[data-filter='search']");
      if (field) {
        field.value = term;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
      }
    });
  });
}

function showToast(message) {
  state.toast = message;
  const toast = document.querySelector(".toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
  }
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    document.querySelector(".toast")?.classList.remove("show");
  }, 2800);
}

function getRoute() {
  return location.hash.replace("#/", "") || "dashboard";
}

function iconSymbol(icon) {
  return `<span class="material-symbols-outlined">${icon}</span>`;
}

function initials(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "GF";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  if (isLocalhost) {
    // During local development the service worker only gets in the way by serving
    // stale code. Tear down any existing worker + caches so edits always load.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if (window.caches?.keys) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
