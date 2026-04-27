# RutaGO

RutaGO is a mobile-first UP Diliman jeepney route assistant. It helps commuters set their start and destination, find direct or transfer jeepney options, view route overlays on a map, check nearby stops, and add a GPS-based stop reminder before they reach their destination.

This version upgrades the existing GTFS/Leaflet/Express MVP into a stronger product prototype with a mockup-inspired mobile interface, PWA install support, GPS location handling, route cards, stop search, reminder alerts, and cleaner developer documentation.

---

## Product Vision

RutaGO is designed for students, staff, and visitors who ride jeepneys around UP Diliman and nearby areas. Instead of manually guessing which jeep to take, the app gives a simple commuter flow:

1. Open RutaGO.
2. Use GPS or tap the map to set your start point.
3. Tap the map or search stops to set your destination.
4. Find jeepney routes.
5. Choose a route card.
6. Add a stop reminder.
7. Get alerted when you are near your destination stop.

---

## Major Features Added in This Upgrade

### Mobile UI matching the mockup direction

- Splash screen with RutaGO cartoon branding
- Login screen with the same playful mobile-app style
- Orange RutaGO top bar
- Hamburger drawer navigation
- Full mobile map layout
- Bottom-sheet route planner interface
- Thick black borders, yellow cards, rounded buttons, comic-style branding

### Map and GPS experience

- Leaflet map layout optimized for phone screens
- GPS “Use My Location” button
- Tap map to set Start
- Tap map to set End
- Default UP Diliman map center
- Center UPD shortcut button
- Custom start/end map markers

### Route discovery

- Find Routes button
- Direct route cards
- Transfer suggestion cards
- Walking distance, jeep distance, estimated travel time, and stops count
- Route overlay drawing on the map
- Active route vehicle feed hook using the existing backend simulation

### Stop tools

- Nearby stop finder
- Stop list screen
- Search by stop name or stop ID
- Tap a stop to select it as a reminder target
- Map popup when selecting a stop

### Stop reminder system

- Add Stop Reminder screen
- GPS watch mode
- Reminder distance threshold from config
- Browser notification support
- In-app reminder fallback if browser notifications are blocked
- Vibration support on compatible devices
- End Route button

### PWA support

- `manifest.webmanifest`
- Service worker shell cache
- Install prompt UI
- App icon SVG
- Standalone mobile display support
- Offline shell fallback

### Backend/project cleanup

- Cleaner `.gitignore`
- `node_modules` removed from mobile source package
- Android location and notification permissions added
- `/api/...` aliases added while keeping existing `/mvp/...` endpoints compatible
- Comprehensive documentation added
- Upgrade notes added

---

## Tech Stack

### Frontend

- HTML
- CSS
- Vanilla JavaScript
- Leaflet.js
- OpenStreetMap tiles
- PWA manifest and service worker

### Backend

- Node.js
- Express.js
- GTFS text files
- CSV parsing
- Optional PostgreSQL/PostGIS support
- Optional OpenTripPlanner support

### Mobile wrapper

- Capacitor
- Android scaffold included
- iOS scaffold included

---

## Folder Structure

```txt
RutaGO/
├── README.md
├── MIT license
├── agency.txt
├── routes.txt
├── stops.txt
├── trips.txt
├── stop_times.txt
├── shapes.txt
├── calendar.txt
├── frequencies.txt
├── feed_info.txt
├── qc_subset/
└── phase1/
    ├── README.md
    ├── STATUS_REPORT.md
    ├── POSTGRESQL_SETUP.md
    ├── UPGRADE_NOTES.md
    ├── .gitignore
    ├── backend/
    │   ├── package.json
    │   ├── .env.example
    │   ├── public/
    │   │   ├── index.html
    │   │   ├── style.css
    │   │   ├── app.js
    │   │   ├── rutago.config.js
    │   │   ├── manifest.webmanifest
    │   │   ├── service-worker.js
    │   │   └── icons/
    │   │       └── rutago-icon.svg
    │   └── src/
    │       ├── server.js
    │       ├── csvStore.js
    │       └── dbStore.js
    ├── data/
    │   └── prepared/
    ├── db/
    │   └── schema.sql
    └── mobile/
        ├── README.md
        ├── capacitor.config.json
        ├── android/
        └── ios/
```

---

## Quick Start

### Requirements

Install these first:

- Node.js 18+
- npm
- Git

Optional for mobile builds:

- Android Studio
- Java JDK
- Xcode for iOS builds on macOS

---

## Run the Web App Locally

From the project root:

```bash
cd phase1/backend
npm install
npm run dev
```

Then open:

```txt
http://localhost:3000
```

The Express backend serves both the API and the frontend.

---

## Main Backend Endpoints

### Health check

```txt
GET /health
```

Returns data source, route count, stop count, trip count, and stop time count.

### Routes

```txt
GET /routes
GET /api/routes
```

Optional search:

```txt
GET /routes?q=ikot
```

### Stops

```txt
GET /stops
GET /api/stops
```

Optional search:

```txt
GET /stops?q=miranda
```

### Nearest stops

```txt
GET /mvp/stops/nearest?lat=14.6535&lon=121.049&radius=300
GET /api/stops/nearest?lat=14.6535&lon=121.049&radius=300
```

### Route search

```txt
GET /mvp/search?from=14.653500,121.049000&to=14.599500,120.984000
GET /api/search?from=14.653500,121.049000&to=14.599500,120.984000
```

### Route overlay

```txt
GET /mvp/routes/:routeId/overlay
GET /api/routes/:routeId/overlay
```

### Vehicle feed hook

```txt
GET /mvp/vehicles
GET /mvp/vehicles?route_id=ROUTE_ID&limit=3
GET /api/vehicles
```

### OTP plan endpoint

```txt
GET /plan?from=14.653500,121.049000&to=14.599500,120.984000
GET /api/plan?from=14.653500,121.049000&to=14.599500,120.984000
```

---

## Frontend App Flow

### Splash screen

The first screen introduces the RutaGO brand and gives a “Start Commuting” button.

### Login screen

The login screen is currently a lightweight demo gate. It does not perform real authentication yet. It is included to match the original mobile mockup and can later be connected to real accounts.

### Main map screen

The main app includes:

- Top orange header
- Hamburger drawer
- Full-screen map
- Bottom route planner sheet
- Use My Location button
- Set Origin and Set Destination controls

### Route cards

After pressing Find Routes, direct and transfer results are shown as yellow mobile cards. Tapping a card selects the alight stop as a reminder target.

### Stop list

Nearby stops and searched stops are displayed as cards. Tapping a stop selects it as a reminder target.

### Reminder screen

After selecting a stop, the reminder screen allows the user to start GPS tracking and receive a notification when near the selected stop.

---

## PWA Installation

RutaGO now includes PWA files.

When opened from a supported browser such as Chrome:

1. Open `http://localhost:3000` or the deployed app URL.
2. Wait for the install prompt.
3. Click Install.
4. RutaGO can now open like a mobile app.

Files involved:

```txt
phase1/backend/public/manifest.webmanifest
phase1/backend/public/service-worker.js
phase1/backend/public/icons/rutago-icon.svg
```

---

## Configuration

Frontend configuration is stored in:

```txt
phase1/backend/public/rutago.config.js
```

Current config:

```js
window.RUTAGO_CONFIG = {
  apiBaseUrl: "",
  defaultCenter: [14.654, 121.064],
  defaultZoom: 15,
  reminderDistanceMeters: 150,
  nearestStopRadiusMeters: 300
};
```

Use `apiBaseUrl` when the frontend is bundled into a mobile app and the API is hosted somewhere else.

Example:

```js
window.RUTAGO_CONFIG = {
  apiBaseUrl: "https://your-rutago-api.example.com",
  defaultCenter: [14.654, 121.064],
  defaultZoom: 15,
  reminderDistanceMeters: 150,
  nearestStopRadiusMeters: 300
};
```

---

## Android / Capacitor Notes

The mobile scaffold is inside:

```txt
phase1/mobile
```

Android permissions were added for:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

These are needed for GPS and reminders.

Basic Capacitor flow:

```bash
cd phase1/mobile
npm install
npx cap sync android
npx cap open android
```

Make sure the mobile wrapper points to the correct hosted backend/frontend URL before building a real APK.

---

## GitHub Setup After Applying This Update

Do not commit `node_modules`.

Recommended commands:

```bash
git status
git add .
git commit -m "feat: upgrade RutaGO mobile PWA route experience"
git push origin main
```

If working from a fork:

```bash
git checkout -b feat/mobile-pwa-route-experience
git add .
git commit -m "feat: upgrade RutaGO mobile PWA route experience"
git push -u origin feat/mobile-pwa-route-experience
```

Then create a pull request into the original RutaGO repository.

---

## Recommended Next Features

### 1. Real authentication

The login screen is currently frontend-only. Add real account support later:

- Student login
- Guest mode
- Saved favorite stops
- Saved common routes
- Recent searches

### 2. Admin dashboard

Create an admin page for route maintainers:

- Add/edit routes
- Add/edit stops
- Update operating hours
- Upload route images
- Manage route colors
- Review user feedback

### 3. Real-time jeep tracking

The current vehicle feed is a synthetic hook. Later, connect it to a real location feed:

- Driver app
- GPS pings
- Vehicle IDs
- Live ETA
- Active/inactive route status

### 4. Better route intelligence

Improve route suggestions using:

- Better route geometry
- Direction awareness
- Time-of-day service hours
- Route frequency
- Walking safety
- Transfer penalty tuning

### 5. Offline route database

Cache important stops and routes locally so the app still works with weak data signal.

### 6. User feedback loop

Add feedback after each route:

- Was this route correct?
- Was the stop location accurate?
- Was the jeep available?
- Report missing stop

---

## Suggested GitHub Topics

```txt
rutago
jeepney-route-finder
up-diliman
commuter-app
leafletjs
openstreetmap
gtfs
expressjs
nodejs
pwa
capacitor
transportation
route-planner
geolocation
public-transport
```

---

## Suggested Repo Description

```txt
Mobile-first UP Diliman jeepney route assistant with Leaflet maps, GTFS route search, nearby stops, GPS-based stop reminders, PWA install support, and Capacitor mobile scaffolding.
```

---

## License

This project uses the license included in the repository.
