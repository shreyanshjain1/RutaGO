# RutaGO — Mobile-First Campus Jeepney Route Assistant

<p align="center">
  <img src="phase1/backend/public/icons/rutago-icon.svg" alt="RutaGO logo" width="120" />
</p>

<p align="center">
  <strong>Find campus jeepney routes, nearby stops, GPS-based stop reminders, favorite routes, and route issue reports in one installable PWA.</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="Leaflet" src="https://img.shields.io/badge/Map-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
  <img alt="GTFS" src="https://img.shields.io/badge/Data-GTFS-orange?style=for-the-badge" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/Optional-PostgreSQL%20%2B%20PostGIS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
</p>

---

## GitHub About

**Description**

```txt
Mobile-first UP Diliman jeepney route assistant with Leaflet maps, GTFS route search, GPS stop reminders, PWA support, accounts, favorites, recent searches, and route issue reporting.
```

**Website / Demo**

```txt
Add your deployed demo URL here once hosted.
```

**Topics / Tags**

```txt
rutago
jeepney-route-planner
transportation-app
commuter-app
up-diliman
campus-navigation
gtfs
leaflet
openstreetmap
nodejs
expressjs
javascript
pwa
progressive-web-app
gps
geolocation
route-planner
public-transport
postgis
postgresql
capacitor
mobile-first
vanilla-js
```

---

## Suggested GitHub Pins

Pin these files/sections in the repository so reviewers immediately understand the product:

| Pin | Why it matters |
| --- | --- |
| `README.md` | Main product overview, setup, roadmap, and API documentation. |
| `phase1/backend/public/index.html` | Main mobile-first PWA shell and screen structure. |
| `phase1/backend/public/app.js` | Frontend route planning, GPS, favorites, reminders, and feedback logic. |
| `phase1/backend/src/server.js` | Express API for routes, stops, search, vehicles, auth, favorites, and feedback. |
| `phase1/backend/src/appStore.js` | Local account/favorites/recent searches/feedback store. |
| `phase1/db/schema.sql` | Database direction for future PostgreSQL/PostGIS-backed route data. |
| `phase1/UPGRADE_NOTES.md` | Upgrade history and product direction notes. |

---

## Product Summary

RutaGO is a campus commuter assistant designed around the UP Diliman jeepney experience. It helps commuters search for route options, find nearby stops, track their current location, and set a reminder before reaching their destination stop.

The app is currently built as a mobile-first web/PWA experience with an Express backend. The project also includes route data handling, GTFS support, optional PostgreSQL/PostGIS direction, and a Capacitor mobile wrapper for future Android/iOS packaging.

---

## Current Feature Set

### Mobile App Experience

- Splash screen inspired by the RutaGO mockup
- Login/sign-up entry screen
- Orange RutaGO top bar
- Hamburger navigation drawer
- Mobile-first full map layout
- Bottom-sheet route planning experience
- PWA manifest and service worker
- Install prompt support
- App icon support

### Map and Route Planning

- Leaflet + OpenStreetMap map UI
- GPS “Use My Location” button
- Tap map to set Start and End points
- Find Routes action
- Direct route suggestions
- Transfer route suggestions
- Route overlay drawing
- Nearest stop search
- Stop search by name or ID
- Synthetic vehicle feed hook for future live vehicle tracking

### Stop Reminder System

- Select a route/stop as a reminder target
- Start GPS watch mode
- Alert when near selected stop
- Browser notification support
- Vibration support where available
- End Route action

### Patch 1 Product Layer

- Real local account registration/login
- Password hashing using Node.js `crypto.scrypt`
- Signed bearer token sessions
- Authenticated dashboard endpoint
- Save favorite routes
- Recent route search history
- Feedback/report issue form
- User-specific feedback history
- Account chip and logout action

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Map | Leaflet.js, OpenStreetMap tiles |
| Backend | Node.js, Express.js |
| Transit Data | GTFS text files |
| Optional DB | PostgreSQL + PostGIS |
| Optional Routing Engine | OpenTripPlanner |
| Mobile Wrapper | Capacitor |
| PWA | Web manifest + service worker |
| Auth Prototype | Node.js crypto + local JSON store |

---

## Project Structure

```txt
RutaGO/
├── README.md
├── phase1/
│   ├── README.md
│   ├── UPGRADE_NOTES.md
│   ├── POSTGRESQL_SETUP.md
│   ├── STATUS_REPORT.md
│   ├── backend/
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   ├── app.js
│   │   │   ├── rutago.config.js
│   │   │   ├── manifest.webmanifest
│   │   │   ├── service-worker.js
│   │   │   └── icons/
│   │   └── src/
│   │       ├── server.js
│   │       ├── csvStore.js
│   │       ├── dbStore.js
│   │       └── appStore.js
│   ├── data/
│   │   └── prepared/
│   ├── db/
│   │   └── schema.sql
│   └── mobile/
│       └── android/
```

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/SUGz15/RutaGO.git
cd RutaGO
```

### 2. Install Backend Dependencies

```bash
cd phase1/backend
npm install
```

### 3. Create Environment File

```bash
cp .env.example .env
```

Update this value before sharing or deploying:

```env
SESSION_SECRET=change-me-to-a-long-random-secret
```

### 4. Run the App

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

---

## Local Test Account Flow

1. Open the app.
2. Click **Start Commuting**.
3. Enter name, email, and password.
4. Click **SIGN UP**.
5. Search a route.
6. Click **Save Favorite** on a route card.
7. Open the drawer and go to **Favorites**.
8. Submit a route issue in **Report Issue**.

The local user/favorites/feedback data is saved at:

```txt
phase1/backend/data/app-store.json
```

This file is ignored by git.

---

## Environment Variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | Backend port | `3000` |
| `GTFS_DIR` | Prepared GTFS data directory | `../../data/prepared` |
| `SESSION_SECRET` | Signs local auth tokens | `change-me` |
| `DATABASE_URL` | Optional PostgreSQL connection | `postgresql://postgres:password@localhost:5432/rutago` |
| `OTP_BASE_URL` | Optional OpenTripPlanner URL | `http://localhost:8080` |
| `USE_POSTGRES` | Enable PostgreSQL data source | `false` |
| `REQUIRE_POSTGRES` | Fail if Postgres unavailable | `false` |
| `AUTO_IMPORT_GTFS_TO_DB` | Auto-seed GTFS to Postgres | `false` |

---

## API Overview

### Health

```txt
GET /health
```

### Routes and Stops

```txt
GET /routes
GET /stops
GET /mvp/stops/nearest?lat=14.6535&lon=121.049&radius=300
GET /mvp/search?from=14.6535,121.049&to=14.5995,120.984
GET /mvp/routes/:routeId/overlay
GET /mvp/vehicles
```

### Cleaner API Aliases

```txt
GET /api/routes
GET /api/stops
GET /api/stops/nearest
GET /api/search
GET /api/routes/:routeId/overlay
GET /api/vehicles
GET /api/plan
```

### Auth and User Product APIs

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/me
GET  /api/users/me/favorites
POST /api/users/me/favorites
DELETE /api/users/me/favorites/:favoriteId
GET  /api/users/me/recent-searches
POST /api/users/me/recent-searches
GET  /api/users/me/feedback
POST /api/feedback
```

---

## Example Auth Request

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"RutaGO Tester","email":"tester@example.com","password":"password123"}'
```

---

## What Makes This Stronger Now

RutaGO is no longer just a static UI or a simple route demo. It now has the base pieces of a real commuter product:

- App-like UI
- Installable PWA behavior
- GPS location usage
- Route search logic
- Stop reminder interaction
- Account-based saved data
- Favorites and recents
- Feedback loop for route data quality
- Backend API structure
- Roadmap-ready mobile wrapper

---

## Current Limitations

- Auth is local-development only and uses a JSON file store.
- Password reset and email verification are not included yet.
- Stop reminders require the app/browser to remain active.
- Live jeepney tracking is currently a synthetic feed hook.
- Offline mode caches the shell, but not all route data yet.
- Production database-backed user tables are still future work.

---

## Recommended Next Patches

### Patch 2 — Database Product Tables

- Move users, favorites, feedback, and recent searches into PostgreSQL
- Add migrations for product tables
- Add route/stops admin-ready schema
- Add seed data workflow

### Patch 3 — Admin Dashboard

- Admin login role
- Add/edit/delete stops
- Add/edit/delete routes
- Reorder route stops
- Review feedback reports
- Mark reports resolved

### Patch 4 — Smarter Route Ranking

- Best boarding stop
- Best alighting stop
- Walking distance ranking
- Transfer penalty
- ETA confidence label
- “Recommended” route badge

### Patch 5 — Offline Route Mode

- Cache route list
- Cache stop list
- Cache favorite routes
- Offline fallback screen
- Saved route viewing without connection

### Patch 6 — Mobile Build Polish

- Capacitor geolocation plugin
- Capacitor local notifications
- Android build docs
- Mobile permission UX
- App icon/splash assets

---

## Suggested Commit Message

```bash
git add .
git commit -m "feat: add accounts favorites recents and feedback system"
git push
```

---

## Suggested PR Title

```txt
feat: add accounts, favorites, recent searches, and feedback reporting
```

---

## License

This project currently includes the original repository license. Keep the same license unless the maintainers decide otherwise.

---

## Patch 2 Update — Map Stability + Admin Center

This patch fixes the broken Leaflet map behavior shown when the map loads while the app is still hidden behind the splash/login screens.

### Added / Fixed

- Deferred Leaflet map initialization until the main app screen is visible
- Added safe `invalidateSize()` handling after screen changes, drawer actions, resize, and orientation changes
- Added tile loading/error feedback card
- Fixed default destination coordinates so the demo starts around UP Diliman instead of Manila Bay
- Added stronger Leaflet CSS rules to prevent broken tile sizing
- Moved client calls from old `/mvp/...` routes to cleaner `/api/...` aliases
- Added Admin Center screen
- Added admin summary stats
- Added feedback report review workflow
- Added route data snapshot for maintainers
- Added admin API endpoints
- Added `ADMIN_EMAILS` environment setting

### Admin Setup

Add your admin email to `phase1/backend/.env`:

```env
ADMIN_EMAILS=your-email@example.com
```

Then restart the backend and sign up or login using that email. The app will show your role as `admin` and the Admin Center will load route/report management tools.

### Patch 2 Commit Message

```bash
git add .
git commit -m "feat: add admin center and stabilize mobile map"
git push
```

### Patch 2 PR Title

```txt
feat: add admin center and stabilize mobile map
```

### Patch 2 Short Description

Fixes the broken Leaflet map rendering issue by initializing the map only after the mobile app screen is visible and adding resize/orientation safeguards. Also introduces the first Admin Center for maintainers to review feedback reports, view route data snapshots, and monitor basic app/transit stats.
