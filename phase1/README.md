# RutaGO Phase 1 Setup

This folder contains a practical starter implementation for:
1. Data acquisition and GTFS preparation
2. OpenTripPlanner (OTP) setup
3. PostgreSQL + PostGIS schema
4. Node.js backend APIs

## Folder Structure

- `scripts/prepare_phase1_data.ps1` - validates GTFS and prepares phase1 outputs
- `data/prepared/` - prepared GTFS subset output (`routes`, `stops`, `trips`)
- `otp/` - OTP setup notes and commands
- `db/schema.sql` - PostgreSQL + PostGIS schema
- `backend/` - Node.js API server

## Step 1: Acquire and Prepare Data

If you already have `qc_subset/`, run:

```powershell
Set-Location c:\Users\sugz1\Downloads\manila
.\phase1\scripts\prepare_phase1_data.ps1 -SourceDir .\qc_subset -OutputDir .\phase1\data\prepared
```

The script validates:
- `routes.txt`
- `stops.txt`
- `shapes.txt`

And writes:
- `phase1/data/prepared/routes.txt`
- `phase1/data/prepared/stops.txt`
- `phase1/data/prepared/trips.txt`

## Step 2: Setup Routing Engine (OpenTripPlanner)

See `otp/README.md` for full instructions.

Typical commands after placing `otp.jar` in `phase1/otp/`:

```powershell
Set-Location c:\Users\sugz1\Downloads\manila\phase1\otp
java -jar .\otp.jar --build ..\data\prepared
java -jar .\otp.jar --serve ..\data\prepared
```

## Step 3: Setup Database (PostgreSQL + PostGIS)

Run schema:

```sql
\i phase1/db/schema.sql
```

Creates tables:
- `routes`
- `stops`
- `trips`
- `stop_times`
- `vehicles`
- `users`
- `reports`

## Step 4: Backend API Setup (Node.js)

Install and run:

```powershell
Set-Location c:\Users\sugz1\Downloads\manila\phase1\backend
npm install
npm run dev
```

APIs:
- `GET /routes`
- `GET /stops`
- `GET /plan?from=lat,lng&to=lat,lng`

Notes:
- `/plan` now prefers transit itineraries (`TRANSIT,WALK`) and falls back to walk when transit is unavailable in OTP.
- Override OTP behavior with `OTP_TRANSIT_PREFERRED`, `OTP_ALLOW_WALK_FALLBACK`, and `OTP_MAX_WALK_METERS` in `.env`.
- Set `USE_POSTGRES=true` and `DATABASE_URL=postgresql://...` to load transit search data from PostgreSQL instead of CSV memory.
- Set `AUTO_IMPORT_GTFS_TO_DB=true` to seed GTFS tables (`routes`, `stops`, `trips`, `stop_times`) from prepared CSVs on startup.

## Step 5: Package for Android and iOS (Capacitor)

```powershell
Set-Location c:\Users\sugz1\Downloads\manila\phase1\mobile
npm install
npm run add:android
npm run add:ios
npm run sync
```

Then open native IDEs:

```powershell
npm run open:android
npm run open:ios
```

Before packaging, set the backend URL in `phase1/backend/public/rutago.config.js`.
