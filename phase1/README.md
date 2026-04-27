# RutaGO Phase 1 / Phase 2 MVP

This folder contains the working RutaGO MVP: an Express backend, GTFS data support, Leaflet mobile frontend, optional PostgreSQL/PostGIS support, optional OpenTripPlanner support, and Capacitor mobile scaffolding.

The latest upgrade adds a mobile-first PWA interface inspired by the RutaGO mockup, GPS-based route planning controls, stop reminders, route cards, stop search, and installable-app support.

---

## Quick Run

```bash
cd phase1/backend
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

---

## What is Included

```txt
backend/         Express API and web frontend
backend/public/  Mobile UI, Leaflet app, PWA files
backend/src/     Server, CSV store, DB store
data/prepared/   Prepared GTFS files
db/              PostgreSQL schema
mobile/          Capacitor Android/iOS wrapper
```

---

## Main User Features

- Splash screen
- Login-style entry screen
- Mobile app layout
- Full-screen map
- Use My Location
- Tap map to set Start and End
- Find jeepney routes
- Direct route cards
- Transfer suggestion cards
- Nearby stop finder
- Stop search
- Add Stop Reminder
- In-app and browser notification reminder
- PWA install support

---

## Main API Endpoints

```txt
GET /health
GET /routes
GET /stops
GET /mvp/search?from=lat,lng&to=lat,lng
GET /mvp/stops/nearest?lat=lat&lon=lng&radius=300
GET /mvp/routes/:routeId/overlay
GET /mvp/vehicles
GET /plan?from=lat,lng&to=lat,lng
```

Cleaner aliases are also available:

```txt
GET /api/routes
GET /api/stops
GET /api/search
GET /api/stops/nearest
GET /api/routes/:routeId/overlay
GET /api/vehicles
GET /api/plan
```

---

## Frontend Config

Edit:

```txt
backend/public/rutago.config.js
```

```js
window.RUTAGO_CONFIG = {
  apiBaseUrl: "",
  defaultCenter: [14.654, 121.064],
  defaultZoom: 15,
  reminderDistanceMeters: 150,
  nearestStopRadiusMeters: 300
};
```

---

## Mobile / Capacitor

```bash
cd phase1/mobile
npm install
npx cap sync android
npx cap open android
```

Android permissions for GPS and notifications are already added to:

```txt
mobile/android/app/src/main/AndroidManifest.xml
```

---

## Do Not Commit

The `.gitignore` excludes:

```txt
node_modules/
backend/node_modules/
mobile/node_modules/
backend/.env
mobile/android/app/build/
```

---

## Recommended Commit

```bash
git add .
git commit -m "feat: upgrade RutaGO mobile PWA route experience"
git push
```
