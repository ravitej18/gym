# GymFlow — Project Context

## Vision
Zero-cost, self-hosted gym management for independent fitness centers. Gym owners fork the repo, configure Firebase, and get a fully-featured management system with no subscriptions, no vendor lock-in, and complete data ownership. Deployed as SaaS — multiple gym clients each own their own instance.

## Problem Being Solved
Independent gym owners in emerging markets (primarily India) pay ₹3,000–₹15,000/month for gym management software, or rely on WhatsApp + spreadsheets. GymFlow gives them everything a paid SaaS offers — member management, billing, attendance, trainers, analytics — at zero marginal cost per gym.

## Target Users

### Primary: Gym Owner / Admin (`role: owner`)
- Manages members, plans, payments, renewals, trainers, workouts
- Runs reports, exports Excel sheets, sends WhatsApp reminders
- Configures gym settings, shares gym code with members

### Secondary: Gym Member (`role: member`)
- Views own membership status, plan, expiry countdown
- Checks in (attendance)
- Views own payment history
- Self-registers via gym code

### Tertiary: Trainer (`role: trainer`)
- Checks in to mark their own attendance
- Views their recent check-in history
- (Future) Assigned workout plans to deliver to members

## Tech Stack
- **Frontend:** Vanilla JS ES modules — zero build step, zero npm deps at runtime
- **Backend:** Firebase Auth (Email/Password) + Cloud Firestore
- **Fallback:** localStorage demo mode when Firebase is not configured
- **Hosting:** GitHub Pages (free, static)
- **PWA:** Service worker + Firestore IndexedDB persistence; installable offline-capable app
- **CSS:** Plain CSS with custom properties (design token system), no preprocessor
- **Icons:** Material Symbols Outlined (Google CDN)
- **Fonts:** Inter (body) + Montserrat (headings) via Google Fonts
- **Reports:** SheetJS (xlsx export, CDN import)
- **Auth architecture:** per-gym Firestore isolation via `gymId` field + Firestore security rules

## Data Model (Firestore Collections)
| Collection | Purpose |
|---|---|
| `members` | Member roster, plan assignment, dates, status |
| `membership_plans` | Plans with name, duration, price |
| `payments` | Payment records linked to member + plan |
| `attendance` | Member check-in records |
| `trainer_attendance` | Trainer self check-in records |
| `trainers` | Trainer roster linked by uid |
| `workout_templates` | Reusable workout plan templates |
| `workout_assignments` | Plan-to-member assignments |
| `progress_records` | Member body metrics over time (weight, BMI, body fat, waist, chest) |
| `reminders` | Logged WhatsApp reminder events |
| `users` | Auth user profiles (name, role, gymId, uid) |
| `settings` (doc) | Gym profile: name, owner, currency, gym code |

## Role System
- `owner` — full access to all modules
- `member` — restricted to: Dashboard (own view), Attendance, Progress, My Membership, My Payments
- `trainer` — restricted to: Dashboard (own view), Attendance, Progress, Check In, My Check-ins

## Key Design Decisions
1. **No build step** — `index.html` loads `app.js` as `type="module"`; every module is a plain ES module. Works directly from any HTTP server.
2. **Dual mode** — Firebase mode (live Firestore) and local demo mode (localStorage) coexist in the same codebase via the `createServices()` abstraction in `lib/firebase-init.js`.
3. **Optimistic local state** — `applyChange()` / `applyRemoval()` update in-memory state after a save without a round-trip Firestore read. Saves one read per operation.
4. **Long-polling Firestore** — `experimentalForceLongPolling: true` prevents connectivity issues on networks that block WebChannel streams (VPN, ad-blockers, corporate proxies).
5. **Hash routing** — `location.hash` for all navigation (`#/dashboard`, `#/members`, etc.). No server-side routing needed.
6. **CSS design tokens** — 10 swappable color themes via `data-color-theme` on `<html>`, driven entirely by `gym.config.js`. Dark/light mode via `data-theme`.

## Current Milestone
**v0.9 Beta** — Core product shipped and stable. UI overhaul in progress (branch: `ui/dark-mode-animations-polish`).

## Repository
Branch: `ui/dark-mode-animations-polish` (active UI work)
Base: `main`
