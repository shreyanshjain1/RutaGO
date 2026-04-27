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
