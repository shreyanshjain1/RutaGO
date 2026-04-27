# RutaGO Phase 1

Phase 1 contains the current working RutaGO mobile-first PWA and Express backend.

## Run Locally

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

## Included in This Phase

- Leaflet map interface
- GTFS route/stops APIs
- Nearby stops
- Direct and transfer route suggestions
- Route overlays
- Synthetic vehicle feed hook
- PWA manifest and service worker
- GPS stop reminders
- Account registration/login
- Saved favorite routes
- Recent searches
- Feedback/report issue form

## Main Files

```txt
backend/src/server.js       Express API
backend/src/appStore.js     Local auth/favorites/feedback store
backend/public/index.html   App screens
backend/public/app.js       Frontend logic
backend/public/style.css    Mobile RutaGO UI
```

## Patch 1 Notes

Patch 1 adds user-facing product memory:

- account registration/login
- favorites
- recent searches
- feedback reports

The local app data file is generated at:

```txt
backend/data/app-store.json
```

It is ignored by git and should not be committed.

---

## Patch 2 Notes

This phase now includes a mobile map stability fix and a lightweight Admin Center.

### Map Fix

The Leaflet map is now initialized only after the app screen is visible. This prevents broken or partially-loaded map tiles after the splash/login screen.

### Admin Center

To enable admin access:

```env
ADMIN_EMAILS=your-email@example.com
```

Restart the backend, then register/login with that email.

Admin tools include:

- App/transit summary
- Route data snapshot
- Feedback reports list
- Report status updates
