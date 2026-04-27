# RutaGO Patch 3 Upgrade Notes

## Patch name

**Patch 3 — Smart Planner, Saved Places, Route Timeline, and Offline Cache**

## What this patch adds

- Saved Places feature for Home, School, Work, and custom locations
- Reusable saved places as Start or End points
- Account-backed saved places API
- Route stop timeline endpoint
- Route stop timeline UI inside Route Cards
- Recommended itinerary card after every route search
- Copy Trip Summary action
- Better cached route fallback when the backend is unavailable
- Service worker API cache upgrade
- Offline-friendly route result fallback using the last successful search
- Extra product polish for route planning UX

## New backend endpoints

```txt
GET    /api/routes/:routeId/stops
GET    /api/users/me/saved-places
POST   /api/users/me/saved-places
DELETE /api/users/me/saved-places/:placeId
```

## Why this matters

Patch 1 added accounts, favorites, recents, and reports. Patch 2 stabilized the map and added Admin Center. Patch 3 improves the daily commuter experience by letting users save common places, inspect route stop timelines, copy trip summaries, and still recover their last search result when the backend or network is unstable.

## Suggested next patch

**Patch 4 — Route Data Manager / Admin CRUD**

Recommended next features:

- Admin add/edit/delete route records
- Admin add/edit/delete stop records
- Reorder stops in a route
- Import/export route data JSON
- Route availability toggle
- Route issue resolution notes
