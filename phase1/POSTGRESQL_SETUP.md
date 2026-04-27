# PostgreSQL + PostGIS Setup Guide

## Current Status
✅ **OTP Routing Engine**: Running on port 8081
✅ **Backend API**: Running on port 3000, serving GTFS from CSV
⏳ **PostgreSQL**: Pending installation

The **backend currently works with in-memory CSV data**. Setting up PostgreSQL adds data persistence and enables advanced geographic queries.

---

## Installation Instructions

### Option 1: Windows Installer (Recommended)

1. **Download PostgreSQL 16 with PostGIS**
   - Visit: https://www.postgresql.org/download/windows/
   - Choose PostgreSQL 16.x installer
   - During installation, select "PostGIS" in the stack builder

2. **Installation Steps**
   ```
   - Run the .exe installer
   - Set password for 'postgres' user (remember this!)
   - Port: 5432 (default)
   - Locale: English/US
   - Launch Stack Builder ✓ (to install PostGIS extension)
   ```

3. **Verify Installation**
   ```powershell
   psql --version
   psql -U postgres -c "SELECT version();"
   ```

### Option 2: Quick Setup (via pgAdmin)

After PostgreSQL installation:

1. Open pgAdmin (included in installer)
2. Login with postgres password
3. Create database (see below)

---

## Create RutaGO Database

Once PostgreSQL is installed, run these commands:

```powershell
# Create database
psql -U postgres -c "CREATE DATABASE rutago WITH ENCODING 'UTF-8';"

# Verify database was created
psql -U postgres -c "\l" | grep rutago

# Load PostGIS extension
psql -U postgres -d rutago -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify PostGIS
psql -U postgres -d rutago -c "SELECT postgis_version();"
```

---

## Apply Schema & Load GTFS Data

```powershell
# Apply schema
psql -U postgres -d rutago -f phase1/db/schema.sql

# Verify tables were created
psql -U postgres -d rutago -c "\dt public.*"

# Optional: Load GTFS data into database
# (Update backend to import CSV data into DB on startup)
```

---

## Update Backend Configuration

Once PostgreSQL is ready, set backend environment variables in `phase1/backend/.env`:

```env
USE_POSTGRES=true
POSTGRES_REQUIRED=true
AUTO_IMPORT_GTFS_TO_DB=true
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/rutago
```

When enabled:
- The backend loads `routes`, `stops`, `trips`, and `stop_times` from PostgreSQL.
- Optional auto-seed imports GTFS CSV files from `phase1/data/prepared` at startup.
- Route search and nearest-stop logic use DB-backed data already loaded in memory.

---

## Database Schema Overview

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `routes` | Transit routes | GTFS data, indexed by route_id |
| `stops` | Transit stops | Geography point, spatial index |
| `vehicles` | Active vehicles | Real-time location tracking |
| `users` | App users | Authentication, preferences |
| `reports` | User-submitted issues | Location-based, indexed |

---

## Troubleshooting

**psql command not found**
- PostgreSQL not in PATH yet. Try: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`

**Cannot connect to database**
- Ensure PostgreSQL service is running: `Get-Service postgresql-x64-16`
- Or start manually: `net start postgresql-x64-16`

**PostGIS not available**
- Re-run Stack Builder (included in PostgreSQL installation)
- Select PostgreSQL 16 instance and add PostGIS extension

---

## Next Steps

1. ✅ OTP routing engine working
2. ✅ Backend API serving GTFS
3. ⏳ PostgreSQL database setup (this guide)
4. 📋 Integrate database with backend (Phase 1.1)
5. 🔜 Real-time vehicle tracking (Phase 2)
6. 🔜 User reports & feedback system (Phase 3)

---

See [phase1/db/schema.sql](../db/schema.sql) for complete database schema.
