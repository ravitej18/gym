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

const appRoot = document.querySelector("#app");

const nav = [
  ["dashboard", "Dashboard", "grid_view"],
  ["members", "Members", "group"],
  ["plans", "Plans", "layers"],
  ["payments", "Payments", "payments"],
  ["renewals", "Renewals", "autorenew"],
  ["reminders", "Reminders", "chat"],
  ["trainers", "Trainers", "badge"],
  ["attendance", "Attendance", "how_to_reg"],
  ["workouts", "Workouts", "fitness_center"],
  ["progress", "Progress", "trending_up"],
  ["reports", "Reports", "bar_chart"],
  ["settings", "Settings", "settings"]
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
  settings: settingsModule
};

const collectionNames = [
  "members",
  "trainers",
  "membership_plans",
  "payments",
  "attendance",
  "workout_templates",
  "workout_assignments",
  "progress_records",
  "reminders"
];

const state = {
  route: getRoute(),
  profile: null,
  services: null,
  settings: null,
  data: {},
  loading: true,
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
    state.profile = profile;
    if (profile) {
      await refreshData();
    } else {
      state.loading = false;
      render();
    }
  });
}

async function refreshData() {
  state.loading = true;
  state.error = "";
  render();

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
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
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

  const currentModule = modules[state.route] || dashboardModule;
  const currentNav = nav.find(([key]) => key === state.route) || nav[0];

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
        ${nav
          .map(
            ([key, label, icon]) => `
              <a href="#/${key}" class="${key === currentNav[0] ? "active" : ""}">
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
        <button class="icon-button mobile-nav" data-action="toggle-nav" title="Menu">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <div class="topbar-search">
          <span class="material-symbols-outlined">search</span>
          <input type="search" placeholder="Search members, payments..." aria-label="Search" />
        </div>
        <div class="topbar-actions">
          <a class="pill-button" href="#/attendance">
            <span class="material-symbols-outlined">login</span>Check-in
          </a>
          <div class="topbar-user">
            <span class="eyebrow">${state.profile.role}</span>
            <strong>${state.profile.name}</strong>
          </div>
          <button class="ghost-button" data-action="logout">Sign out</button>
        </div>
      </header>
      <section class="content-panel" id="view">${currentModule.render(makeContext())}</section>
    </main>
    <div class="toast ${state.toast ? "show" : ""}">${state.toast}</div>
  `;

  bindAppEvents();
  currentModule.bind?.(document.querySelector("#view"), makeContext());
}

function makeContext() {
  return {
    profile: state.profile,
    settings: state.settings,
    data: state.data,
    services: state.services,
    refresh: refreshData,
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
