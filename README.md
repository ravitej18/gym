# GymFlow

Zero-cost gym management for independent fitness centers. Fork, configure, deploy — no subscriptions, no servers, no vendor lock-in.

GymFlow is a progressive web app (vanilla JS, ES modules) backed by Firebase Auth + Firestore and hosted free on GitHub Pages. Every gym owns its own deployment, data, and authentication.

## Features

- **Members, Plans, Payments, Attendance, Renewals** — full membership lifecycle with auto-expiry calculation
- **WhatsApp reminders** — one-click prefilled renewal/expiry messages via `wa.me` deep links
- **Dashboard** — live metrics and a 6-month revenue trend chart
- **Reports + Excel export** — Members, Payments, Attendance, and Renewals as `.xlsx` (SheetJS)
- **Printable receipts** — per-payment print/save-as-PDF
- **Backup & restore** — JSON export/import (local mode)
- **Trainers, Workouts, Progress** — coordination and member tracking
- **PWA** — installable, offline-capable (service worker + Firestore IndexedDB persistence)

## Run locally

No build step. Serve the folder over HTTP (service workers and ES modules don't work from `file://`):

```bash
node scripts/dev-server.js
# then open the printed localhost URL
```

Without Firebase configured, the app runs in **local demo mode** (data in `localStorage`). Sign in with the demo account or use the "Try the demo" button.

## Deploy your own gym

1. **Fork** this repository.
2. Create a **Firebase project**; enable **Email/Password Auth** and **Cloud Firestore**.
3. Copy `gym.config.js.template` to `gym.config.js` and fill in your Firebase web config.
4. Deploy the Firestore security rules from `firestore.rules`.
5. Enable **GitHub Pages** for the repo (serve from the root of your default branch).
6. Open the site, **create your owner account**, and start managing members.

> `gym.config.js` holds your public Firebase web keys. Multi-tenant safety comes from `firestore.rules` (per-gym `gymId` isolation + role checks), not from hiding these keys.

## Project structure

```
index.html  app.js  sw.js  manifest.json  firestore.rules  gym.config.js
lib/firebase-init.js          # Firebase + local-demo service layer
modules/                      # one module per screen (dashboard, members, ...)
styles/main.css
scripts/                      # dev server, smoke test, demo seeders
```

## Smoke test

```bash
node scripts/smoke-test.mjs   # verifies every module renders HTML
```
