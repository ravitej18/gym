# GymFlow

Zero-cost gym management for independent fitness centers. Fork, configure, deploy — no subscriptions, no servers, no vendor lock-in.

GymFlow is a progressive web app (vanilla JS, ES modules) backed by Firebase Auth + Firestore and hostable free on GitHub Pages. Every gym gets its own deployment, data, and authentication — no shared infrastructure, no monthly fees.

---

## Features

### Member Lifecycle
- **Members** — full profile (name, mobile, email, DOB, gender, address, emergency contact, assigned trainer)
- **Membership Plans** — create unlimited plans with custom duration and pricing
- **Status tracking** — Active, Expiring Soon (≤15 days), Expired, Suspended, Pending — auto-computed from end date
- **Member search & filter** — by name, mobile, email, status, plan, trainer

### Payments
- **Record payments** — member, plan, amount, method (Cash / UPI / Card / Bank Transfer), status (Paid / Pending / Partial / Refunded), notes
- **Printable receipts** — per-payment print / save-as-PDF via browser
- **Filter** by member, status, and date range

### Renewals
- **30-day renewal queue** — automatically surfaces expiring and expired members
- **One-form renewal** — select member + plan, auto-computes next end date, records payment simultaneously

### Attendance
- **Owner check-in** — mark any member present with a custom date
- **Member self check-in** — members can check themselves in from their dashboard
- **Attendance history** — filter by member and date range

### WhatsApp Reminders
- **Renewal reminder dashboard** — all members expiring within 30 days in one view
- **Pre-filled WhatsApp deep link** — personalised message with member name, expiry date, and gym name
- **Mark as sent** — logs reminder timestamp to Firestore per member

### Trainers
- **Trainer roster** — name, specialization, mobile, email, status
- **Trainer self check-in** — trainers log their own daily attendance
- **My Check-ins** — trainers view their own attendance history
- **Trainer assignment** — assign a trainer to any member

### Workouts
- **Workout template library** — create reusable named plans with goal, exercises, and notes
- **Card grid view** — browse all templates at a glance

### Progress Tracking
- **Progress records** — owner logs weight, BMI, body fat %, chest, waist per member per date
- **Trend charts** — SVG line chart per member with metric selector (weight / BMI / body fat / waist)
- **Member self-view** — members see their own progress history and chart

### Dashboard
| Role | What they see |
|---|---|
| Owner | 8 KPIs, renewal watch (next 6 expiries), 6-month revenue bar chart |
| Member | Membership card (status, expiry, days left, check-in count) |
| Trainer | Trainer metrics, today's check-in panel |

### Reports & Export
- Summary metrics: total revenue, active members, attendance records, inactive count
- Inactive member list (no check-in in last 14 days)
- Recent payments panel
- **Excel export** — Members, Payments, Attendance, Renewals as separate `.xlsx` sheets (SheetJS, no server)
- Export all four sheets with a single click

### Settings
- Gym profile: name, owner name, contact, currency (INR / USD / EUR / GBP), address
- Gym code — share with members for self-registration
- **Backup** — JSON export of all Firestore data
- **Restore** — JSON import (overwrites local copy)

---

## User Roles

| Role | Access |
|---|---|
| **Owner** | Everything — all modules, member management, reports, settings |
| **Member** | Dashboard, Attendance (self check-in), Progress (own records), My Membership, My Payments |
| **Trainer** | Dashboard, Attendance (self check-in), Progress (view), Trainer Check-In, My Check-ins |

Role is stored in Firestore and enforced in both `firestore.rules` (server-side) and JS route guards (client-side).

---

## UI & Design

- **Dark / light mode** — toggle in the top bar, persisted to `localStorage`, flash-free on page load
- **10 color themes** — set once in `gym.config.js`, applied site-wide via CSS custom properties
- **Responsive layout** — desktop sidebar, tablet icon-only 68px sidebar, mobile slide-in drawer with scrim
- **Motion system** — consistent easing and duration tokens, route fade-slide transition, button spring interactions
- **Reduced-motion safe** — all animations respect `prefers-reduced-motion`

### Available Color Themes

Set `colorTheme` in `gym.config.js`:

| Value | Description |
|---|---|
| `neon-lime` | Electric yellow-green (default) |
| `electric-blue` | Bright cobalt blue |
| `cyber-purple` | Deep violet |
| `sunset-orange` | Warm amber-orange |
| `hot-pink` | Vivid magenta |
| `arctic-teal` | Cool teal-cyan |
| `rose-gold` | Warm blush pink |
| `emerald` | Rich forest green |
| `crimson` | Deep red |
| `solar-gold` | Warm golden yellow |

---

## Getting Started

### Run locally

No build step. Serve the folder over HTTP (required for service workers and ES modules):

```bash
node scripts/dev-server.js
# opens on the printed localhost URL
```

Without Firebase configured, the app runs in **local demo mode** (data in `localStorage`). Use the demo account or the "Try the demo" button.

### Seed demo data

```bash
# requires a configured gym.config.js and a running Firebase project
node scripts/seed-demo.js      # creates demo gym, owner, plans, sample members
node scripts/seed-members.js   # adds extra bulk member data
```

---

## Deploy Your Own Gym

1. **Fork** this repository.
2. Create a **Firebase project**; enable **Email/Password Auth** and **Cloud Firestore**.
3. Copy `gym.config.js.template` → `gym.config.js` and fill in your Firebase web config.
4. (Optional) Set your preferred `colorTheme` in `gym.config.js`.
5. Deploy Firestore security rules: `firebase deploy --only firestore:rules`
6. Enable **GitHub Pages** (Settings → Pages → serve from root of `main`).
7. Open the URL, **create your owner account**, and start managing members.

> `gym.config.js` contains your Firebase public web keys. Security comes from `firestore.rules` (per-gym `gymId` isolation + role enforcement), not from hiding these keys — this is the standard Firebase client-side pattern.

### gym.config.js options

```js
window.GYM_CONFIG = {
  // Firebase web app config (required for production)
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",

  // UI theme (optional — defaults to "neon-lime")
  colorTheme: "neon-lime",
};
```

---

## Project Structure

```
index.html              # app shell, theme init script
app.js                  # routing, auth lifecycle, render engine
sw.js                   # service worker (caching, offline)
manifest.json           # PWA manifest
firestore.rules         # Firestore security rules
gym.config.js           # your Firebase config + theme (gitignored)
gym.config.js.template  # safe public template

lib/
  firebase-init.js      # Firebase ↔ localStorage abstraction layer

modules/                # one module per screen
  auth.js               # sign in / sign up / demo
  dashboard.js          # role-aware dashboard
  members.js            # member list, add, edit
  memberships.js        # plan CRUD
  payments.js           # payment recording + receipts
  renewals.js           # renewal queue + form
  attendance.js         # check-in log
  reminders.js          # WhatsApp reminder dashboard
  trainers.js           # trainer roster + check-in
  trainer-checkin.js    # trainer's own check-in + history
  workouts.js           # workout template library
  progress.js           # progress records + trend charts
  reports.js            # summary metrics + Excel export
  settings.js           # gym profile + backup/restore
  my-membership.js      # member self-view: membership card
  my-payments.js        # member self-view: payment receipts
  utils.js              # shared helpers (DOM, data, export)

styles/
  main.css              # design tokens, themes, all component styles

scripts/
  dev-server.js         # zero-dependency local HTTP server
  seed-demo.js          # demo environment seeder
  seed-members.js       # bulk member seeder
  smoke-test.mjs        # renders every module; verifies no crash
```

### Firestore Collections

| Collection | Description |
|---|---|
| `members` | Member profiles, status, plan assignment |
| `membership_plans` | Plan definitions (duration, price) |
| `payments` | Payment records linked to members |
| `attendance` | Member daily check-ins |
| `trainers` | Trainer profiles |
| `trainer_attendance` | Trainer daily check-ins |
| `workout_templates` | Reusable workout plans |
| `workout_assignments` | Trainer → member plan assignments |
| `progress_records` | Member body measurement records |
| `reminders` | Reminder send log |
| `settings` | Per-gym configuration |

---

## Testing

```bash
node scripts/smoke-test.mjs   # verifies every module renders valid HTML
```

---

## Contributing

PRs welcome. The codebase is intentionally dependency-light — no bundlers, no frameworks. Keep it that way. When adding a new screen, follow the existing module pattern: a file in `modules/` that exports `render(context)` returning an HTML string, and optionally `bind(root, context)` for event wiring.
