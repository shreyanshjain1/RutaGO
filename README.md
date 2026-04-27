# RutaGO — UP Diliman Jeepney Guide

RutaGO is a mobile-first commuter assistant for UP Diliman jeepney routes. It helps students and commuters find route options, check nearby stops, save favorite routes and places, add stop reminders, and report route issues.

## Suggested GitHub description

Mobile-first UP Diliman jeepney route finder with Leaflet maps, GPS stop reminders, saved places, favorites, feedback reports, admin tools, GTFS data, and PWA support.

## Suggested GitHub topics

```txt
rutago
transportation
commuter-app
jeepney
up-diliman
leaflet
pwa
expressjs
nodejs
gtfs
route-planner
gps
openstreetmap
capacitor
postgresql
postgis
```

## Suggested pinned repositories

If this is for a portfolio profile, pin RutaGO beside projects that show different skill sets:

```txt
RutaGO — mobile-first route planning and commuter UX
VitaVault — full-stack personal health record platform
Vertex-POS — POS, inventory, and business operations system
DiagEcommerceRep — PHP/MySQL diagnostics e-commerce platform
CrickInPhSEO — SEO-focused content and technical SEO project
OfficeHub — internal ticketing/request management system
```

## Current product features

### Mobile app experience

- Splash screen inspired by the original mockup
- Login/sign-up entry screen
- Orange RutaGO top bar
- Hamburger menu drawer
- Mobile-first bottom sheet layout
- Leaflet/OpenStreetMap map view
- PWA install prompt
- Offline shell caching

### Route planning

- Tap map to set origin and destination
- Use GPS location as current position
- Search nearby stops
- Find direct route options
- Find transfer suggestions
- Recommended itinerary card
- Copy trip summary action
- Route stop timeline viewer
- Route overlay drawing on the map
- Synthetic vehicle feed hook for future live tracking

### User account features

- Local signup/login
- Password hashing
- Signed bearer token session
- User dashboard
- Favorite routes
- Recent searches
- Saved places for Home, School, Work, and custom points
- Feedback/report issue submissions

### Stop reminder features

- Select destination stop
- Add stop reminder
- GPS distance checking
- Reminder card when near stop
- Browser notification fallback
- Vibration support where available
- End route action

### Admin features

- Admin Center access via `ADMIN_EMAILS`
- App/transit summary stats
- Feedback report review list
- Feedback status updates
- Route data snapshot

## Project structure

```txt
RutaGO/
├─ README.md
├─ phase1/
│  ├─ README.md
│  ├─ UPGRADE_NOTES.md
│  ├─ backend/
│  │  ├─ public/
│  │  │  ├─ index.html
│  │  │  ├─ style.css
│  │  │  ├─ app.js
│  │  │  ├─ manifest.webmanifest
│  │  │  └─ service-worker.js
│  │  └─ src/
│  │     ├─ server.js
│  │     ├─ csvStore.js
│  │     ├─ dbStore.js
│  │     └─ appStore.js
│  ├─ data/prepared/
│  ├─ db/schema.sql
│  ├─ mobile/
│  └─ otp/
```

## Quick start

```bash
cd phase1/backend
npm install
cp .env.example .env
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Environment variables

Create `phase1/backend/.env`:

```env
PORT=3000
SESSION_SECRET=change-this-local-secret
ADMIN_EMAILS=your-email@example.com
GTFS_DIR=../../data/prepared
OTP_BASE_URL=http://localhost:8080
OTP_TRANSIT_PREFERRED=true
OTP_ALLOW_WALK_FALLBACK=true
OTP_MAX_WALK_METERS=1500
```

## Main API endpoints

### Public transit APIs

```txt
GET /health
GET /api/routes
GET /api/stops
GET /api/stops/nearest?lat=14.654&lon=121.064&radius=300
GET /api/search?from=14.6535,121.049&to=14.659,121.073
GET /api/routes/:routeId/overlay
GET /api/routes/:routeId/stops
GET /api/vehicles
GET /api/routes/:routeId/vehicles
GET /api/plan
```

### Auth and account APIs

```txt
POST   /api/auth/register
POST   /api/auth/login
GET    /api/me
GET    /api/users/me/favorites
POST   /api/users/me/favorites
DELETE /api/users/me/favorites/:favoriteId
GET    /api/users/me/recent-searches
POST   /api/users/me/recent-searches
GET    /api/users/me/saved-places
POST   /api/users/me/saved-places
DELETE /api/users/me/saved-places/:placeId
GET    /api/users/me/feedback
POST   /api/feedback
```

### Admin APIs

```txt
GET   /api/admin/summary
GET   /api/admin/feedback
PATCH /api/admin/feedback/:feedbackId/status
GET   /api/admin/routes-summary
```

## Recommended roadmap

### Patch 4 — Admin Route Data Manager

- Add/edit/delete routes
- Add/edit/delete stops
- Reorder stops per route
- Route availability toggle
- Import/export route data JSON

### Patch 5 — Smarter Route Ranking

- Rank by walking distance, transfers, stop gap, and estimated time
- Add “least walking” and “fastest” filters
- Add “fewest transfers” filter
- Add confidence labels

### Patch 6 — Mobile Packaging Polish

- Capacitor GPS permission request screen
- Native notification bridge
- Android build guide
- App icon and splash assets

### Patch 7 — Tests and CI

- API tests
- Route planner tests
- Auth tests
- GitHub Actions workflow
- Lint/type checks where applicable

## PR title for Patch 3

```txt
feat: add saved places itinerary timeline and offline cache
```

## Commit message for Patch 3

```bash
git add .
git commit -m "feat: add saved places itinerary timeline and offline cache"
git push
```
