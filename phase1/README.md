# RutaGO Phase 1

Phase 1 contains the working RutaGO backend, mobile-first web/PWA frontend, GTFS data layer, optional PostgreSQL/PostGIS support, OTP integration notes, and Capacitor mobile wrapper.

## Run locally

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

## Patch 3 highlights

- Saved Places screen
- Home, School, Work, and custom saved location presets
- Saved places can be reused as Start or End
- Recommended itinerary card after route search
- Copy Trip Summary button
- Route stop timeline viewer
- `/api/routes/:routeId/stops` endpoint
- Service worker API cache upgrade
- Last successful route result fallback

## Admin access

Add your email to `phase1/backend/.env`:

```env
ADMIN_EMAILS=your-email@example.com
```

Then register/login using that email.

## Useful endpoints

```txt
GET /api/routes
GET /api/stops
GET /api/search?from=lat,lng&to=lat,lng
GET /api/routes/:routeId/stops
GET /api/stops/nearest?lat=lat&lon=lng
GET /api/vehicles
POST /api/auth/register
POST /api/auth/login
GET /api/me
POST /api/users/me/saved-places
POST /api/feedback
GET /api/admin/summary
```
