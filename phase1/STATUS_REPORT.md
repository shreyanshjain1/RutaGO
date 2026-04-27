# Phase 2: MVP Development - Checklist

**Date**: April 27, 2026  
**Focus**: Commuter MVP for map search, nearest stops, transfer suggestions, and notifications

---

## ✅ Done

- [x] Mobile-friendly map interface
- [x] Origin to destination route search
- [x] Nearest stop finder within 300m
- [x] Direct jeep route suggestions
- [x] Transfer suggestions
- [x] Route overlay display on the map
- [x] Basic approaching-destination notification flow
- [x] Backend APIs for search, stops, routes, and OTP proxying

## 🟡 In Progress

- [x] Improve route ranking and deduplication
- [x] Make overlays easier to read on small screens
- [x] Rank transfer suggestions by total trip quality
- [x] Add clearer in-app notification fallback when browser alerts are blocked

## ⏳ Next Up

- [x] Move search data from CSV/memory into PostgreSQL + PostGIS (backend now supports PostgreSQL source + optional GTFS auto-seed)
- [x] Integrate transit-aware routing into OTP (transit-preferred `/plan` with walk fallback metadata)
- [x] Add live vehicle tracking hooks (synthetic feed endpoints wired for future real telemetry)
- [x] Package the MVP for Android/iOS delivery (Capacitor wrapper scaffolded with generated android/ios projects)

---

## Phase 1 Foundation (Complete)

### Downloads & File Preparations
- ✅ OTP JAR: `otp-2.4.0-shaded.jar` (saved as OTP 2.5.0) - 444 MB
- ✅ OSM Data: `philippines-latest.osm.pbf` - 566 MB (Geofabrik download)
- ✅ OSM Processing: Removed duplicate manila.osm.pbf to optimize heap usage

### Graph Building
```
OTP Build Statistics:
├── Build Time: 5m 33s
├── OSM Processing: ~3 min (Relations, Ways, Nodes parsing)
├── Street Graph: ~2.5 min (1,580,840 ways processed)
├── Graph Size: 2,502,999 vertices, 6,143,855 edges
└── Output: graph.obj (423.73 MB, serialized format)
```

### OTP Server Status
- 🟢 **Running**: Port 8081
- 🟢 **Health Check**: `/otp/routers/default` responds with buildTime
- ✅ **Graph Loaded**: Ready for routing queries
- 📝 **Note**: GTFS data not yet integrated into OSM graph (0 transit stops)

### OTP Address Storage
```
Location: c:\Users\sugz1\Downloads\manila\phase1\otp\
Files:    otp.jar (444 MB JAR)
Starting: Requires 8GB heap initially, 2GB to serve
Command:  java -Xmx2g -jar otp.jar --load ..\\data\\prepared
```

---

## Backend and Routing Foundation

### Server Status
- 🟢 **Running**: Port 3000
- 🟢 **Framework**: Express.js 4.21.2 + Node.js
- 🟢 **Dependencies**: 72 packages, 0 vulnerabilities
- ✅ **Startup**: `npm run dev` in phase1/backend/

### Endpoints Working
| Endpoint | Status | Purpose |
|----------|--------|---------|
| `GET /health` | ✅ | System health (routes: 1155, stops: 3648) |
| `GET /routes?q=query` | ✅ | Full-text search on GTFS routes |
| `GET /stops?q=query` | ✅ | Full-text search on GTFS stops |
| `GET /plan?from=lat,lng&to=lat,lng` | ✅ | OTP routing proxy (street-based) |

### Sample Response (Routing)
```json
{
  "plan": {
    "itineraries": [
      {
        "duration": 7843,
        "walkDistance": 9789.43,
        "legs": [
          {
            "from": { "lat": 14.6535, "lon": 121.049 },
            "to": { "lat": 14.5995, "lon": 120.984 },
            "mode": "WALK"
          }
        ]
      }
    ]
  }
}
```

### Configuration
```env
GTFS_DIR=../../data/prepared
OTP_BASE_URL=http://localhost:8081
PORT=3000
```

---

## Pending: PostgreSQL + PostGIS

### Current Status
- ❌ PostgreSQL not installed (yet)
- 📋 Schema ready: `phase1/db/schema.sql` (created, not applied)
- 📖 Setup Guide: `phase1/POSTGRESQL_SETUP.md` (created)

### What's Needed
1. Download & install PostgreSQL 16 (Windows or alternative)
2. Post-install: Enable PostGIS extension
3. Create `rutago` database with encoding UTF-8
4. Apply schema: `psql -U postgres -d rutago -f phase1/db/schema.sql`

### Database Schema Overview
```sql
Routes Table:      route_id, short_name, long_name, route_type, ...
Stops Table:       stop_id, name, lat/lon, geography POINT
Vehicles Table:    vehicle_id, location, heading, speed
Users Table:       user_id, email, preferences
Reports Table:     report_id, stop_location, issue_type, status
```

### Optional Integration
Once PostgreSQL is ready, backend can be updated to:
- Load GTFS CSV into database on startup
- Serve routes/stops from database instead of memory
- Enable geographic queries (e.g., "stops within 500m")
- Track vehicle locations in real-time
- Store user reports with spatial indexing

---

## 📁 Directory Structure

```
c:\Users\sugz1\Downloads\manila\
├── phase1/
│   ├── data/
│   │   └── prepared/              # GTFS + OSM source files
│   │       ├── routes.txt
│   │       ├── stops.txt
│   │       ├── stop_times.txt
│   │       ├── shapes.txt
│   │       ├── philippines-latest.osm.pbf (566 MB)
│   │       └── graph.obj (424 MB - compiled by OTP)
│   ├── otp/
│   │   └── otp.jar (444 MB)       # OpenTripPlanner executable
│   ├── db/
│   │   └── schema.sql             # PostgreSQL schema
│   ├── backend/
│   │   ├── src/
│   │   │   ├── server.js          # Express API server
│   │   │   └── csvStore.js        # GTFS CSV loader
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── .env                   # Runtime config (OTP_BASE_URL updated)
│   ├── README.md                  # Phase 1 runbook
│   ├── otp/README.md              # OTP setup instructions
│   ├── POSTGRESQL_SETUP.md        # PostgreSQL installation guide
│   └── .gitignore
├── qc_subset/                     # Cleaned Quezon City GTFS
├── extract_qc_subset.ps1          # Data extraction script
└── [other GTFS files]
```

---

## 🚀 Current System Flow

```
User Request
    ↓
Backend API (Port 3000)
    ├─→ [CSV Data] → Responds with routes/stops search
    └─→ [OTP Server Port 8081] → Responds with route plan
         ├─→ Parse: latitude, longitude
         ├─→ Query OSM graph (street network)
         └─→ Return itinerary + walking directions
```

---

## 🧪 Testing Commands

**Check OTP Health**
```powershell
Invoke-RestMethod 'http://localhost:8081/otp/routers/default'
```

**Test Full Routing**
```powershell
Invoke-RestMethod 'http://localhost:3000/plan?from=14.6535,121.049&to=14.5995,120.984'
```

**Check Backend Status**
```powershell
Invoke-RestMethod 'http://localhost:3000/health'
```

---

## 📊 Performance Metrics

| Component | Metric | Value |
|-----------|--------|-------|
| OTP Build Time | Total | 5m 33s |
| OTP Graph | Vertices | 2.5M |
| OTP Graph | Edges | 6.1M |
| OTP Graph Size | Disk | 424 MB |
| Backend | Routes | 1,155 |
| Backend | Stops | 3,648 |
| Backend | Trips | 1,269 |
| Routing Test | Duration | ~2 hours (9.8 km walk) |

---

## ⚠️ Current Limitations

1. **Transit Data in OTP Graph Still Pending**
  - Backend now requests transit-aware plans from OTP (`TRANSIT,WALK`).
  - If OTP has no transit itineraries, backend falls back to walk and flags `transit_unavailable`.
  - Full transit results still depend on rebuilding OTP graph with GTFS transit data.

2. **PostgreSQL Runtime Still Pending**
  - Backend supports PostgreSQL as a primary source for `routes/stops/trips/stop_times`.
  - Current runtime remains CSV until PostgreSQL is installed/configured in `.env`.
  - User/session persistence is still pending.

3. **No Real-Time Data**
  - Synthetic vehicle hook feed is available; real telemetry feed is not integrated yet.
   - No schedule updates
   - No trip alerts

---

## Phase 2 Checklist Details

### Map-Based Interface
- [x] Interactive map
- [x] Route overlays
- [x] Better legend and route status labels
- [x] More readable mobile layout on small phones

### Route Search
- [x] Origin → destination input flow
- [x] Jeep route suggestions
- [x] Transfer suggestions
- [x] Better ranking by time, walking, and transfer count

### Nearest Stop Finder
- [x] Spatial query within 300m
- [ ] Show radius control in UI
- [ ] Add sort/filter by accessibility or distance

### Basic Notifications
- [x] Approaching destination stop alert flow
- [x] Fallback in-app alert banner
- [ ] Adjustable alert distance threshold

---

## 📝 References

- [OTP README](./otp/README.md) - OTP installation & server commands
- [PostgreSQL Setup](./POSTGRESQL_SETUP.md) - Database installation guide
- [Backend API](./backend/) - Express.js implementation
- [Database Schema](./db/schema.sql) - Complete schema definition
- [Main Runbook](./README.md) - Phase 1 overview

---

**Status**: Phase 2 MVP is underway
**Blocking Item**: PostgreSQL installation and OTP GTFS graph rebuild for full transit routing
**Ready for**: Android/iOS packaging, adjustable alert threshold, and real telemetry integration
