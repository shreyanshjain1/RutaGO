# RutaGO Upgrade Notes

This update turns RutaGO from a technical MVP into a stronger mobile-first product prototype.

## Added

- Mockup-inspired splash screen
- Mockup-inspired login screen
- Orange RutaGO top bar
- Hamburger drawer navigation
- Full mobile map layout
- Bottom-sheet planner UI
- GPS “Use My Location” flow
- Tap map to set Start and End
- Route cards styled like the provided screenshot
- Stop list screen
- Stop search screen
- Add Stop Reminder screen
- Reminder popup/card when near stop
- Browser notification support
- Vibration support when approaching a stop
- PWA manifest
- Service worker shell cache
- App icon SVG
- Install prompt UI
- API aliases under `/api/...`
- Android GPS and notification permissions
- Cleaner `.gitignore`
- Comprehensive README

## Preserved

- Existing Express backend
- Existing GTFS CSV loading
- Existing PostgreSQL/PostGIS optional setup
- Existing `/mvp/...` route search endpoints
- Existing Leaflet map dependency
- Existing Capacitor mobile scaffold
- Existing OTP planning support

## Main Files Updated

```txt
README.md
phase1/README.md
phase1/UPGRADE_NOTES.md
phase1/.gitignore
phase1/backend/public/index.html
phase1/backend/public/style.css
phase1/backend/public/app.js
phase1/backend/public/rutago.config.js
phase1/backend/public/manifest.webmanifest
phase1/backend/public/service-worker.js
phase1/backend/public/icons/rutago-icon.svg
phase1/backend/src/server.js
phase1/mobile/android/app/src/main/AndroidManifest.xml
```

## Important Note

The login screen is still frontend-only. It exists to match the mockup and improve demo flow. Real authentication should be added in a future backend update.

## Recommended Commit Message

```bash
git commit -m "feat: upgrade RutaGO mobile PWA route experience"
```

## Patch 1 — Accounts, Favorites, Recent Searches, and Feedback

This patch adds the first real product layer on top of the mobile-first route planner.

### Added

- Local account registration and login
- Password hashing using Node.js crypto/scrypt
- Signed bearer-token sessions
- Authenticated `/api/me` dashboard endpoint
- Saved favorite routes
- Recent route search history
- Feedback/report issue form
- User-specific submitted feedback list
- Frontend account chip and logout action
- Favorites and Recent Searches drawer panel
- Report Issue drawer panel
- Advanced README with GitHub About, pins, topics, setup, roadmap, and API docs

### Important Notes

- This is a local development auth layer using a JSON file store at `phase1/backend/data/app-store.json`.
- The JSON store is intentionally ignored by git.
- For production, migrate these user tables into PostgreSQL and replace local bearer tokens with secure HTTP-only cookies or a stronger session strategy.
