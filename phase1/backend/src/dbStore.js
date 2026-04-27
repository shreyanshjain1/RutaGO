const { Pool } = require("pg");
const {
  loadRoutes,
  loadStops,
  loadTrips,
  loadStopTimes,
} = require("./csvStore");

let pool = null;

function isPostgresEnabled() {
  return String(process.env.USE_POSTGRES || "false").toLowerCase() === "true";
}

function isAutoImportEnabled() {
  return String(process.env.AUTO_IMPORT_GTFS_TO_DB || "false").toLowerCase() === "true";
}

function isPostgresRequired() {
  return String(process.env.POSTGRES_REQUIRED || "false").toLowerCase() === "true";
}

function getPool() {
  if (!isPostgresEnabled()) return null;
  if (pool) return pool;

  const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "",
        database: process.env.PGDATABASE || "rutago",
      };

  pool = new Pool(config);
  return pool;
}

async function ensureTransitTables(clientOrPool) {
  const db = clientOrPool || getPool();
  if (!db) return;

  await db.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await db.query("ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_desc TEXT");
  await db.query("ALTER TABLE routes ADD COLUMN IF NOT EXISTS agency_id TEXT");

  await db.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      trip_id TEXT UNIQUE NOT NULL,
      route_id TEXT REFERENCES routes(route_id),
      service_id TEXT,
      shape_id TEXT,
      trip_headsign TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS stop_times (
      id SERIAL PRIMARY KEY,
      trip_id TEXT REFERENCES trips(trip_id),
      stop_id TEXT REFERENCES stops(stop_id),
      stop_sequence INTEGER,
      arrival_time TEXT,
      departure_time TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (trip_id, stop_id, stop_sequence)
    )
  `);

  await db.query("CREATE INDEX IF NOT EXISTS idx_trips_route_id ON trips(route_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id ON stop_times(trip_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_stop_times_stop_id ON stop_times(stop_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_stop_times_stop_seq ON stop_times(stop_sequence)");
}

async function loadTransitDataFromDb() {
  const db = getPool();
  if (!db) {
    return null;
  }

  await ensureTransitTables(db);

  const [routesRes, stopsRes, tripsRes, stopTimesRes] = await Promise.all([
    db.query(`
      SELECT route_id, route_short_name, route_long_name, route_desc, route_type, agency_id
      FROM routes
      ORDER BY route_id
    `),
    db.query(`
      SELECT stop_id, stop_name, stop_lat, stop_lon
      FROM stops
      ORDER BY stop_id
    `),
    db.query(`
      SELECT trip_id, route_id, shape_id, service_id, trip_headsign
      FROM trips
      ORDER BY trip_id
    `),
    db.query(`
      SELECT trip_id, stop_id, stop_sequence, arrival_time, departure_time
      FROM stop_times
      ORDER BY trip_id, stop_sequence
    `),
  ]);

  return {
    routes: routesRes.rows,
    stops: stopsRes.rows.map((row) => ({
      ...row,
      stop_lat: Number(row.stop_lat),
      stop_lon: Number(row.stop_lon),
    })),
    trips: tripsRes.rows,
    stopTimes: stopTimesRes.rows.map((row) => ({
      ...row,
      stop_sequence: Number(row.stop_sequence),
    })),
  };
}

async function seedTransitDataFromGtfs(gtfsDir) {
  const db = getPool();
  if (!db) return;

  const routes = loadRoutes(gtfsDir);
  const stops = loadStops(gtfsDir);
  const trips = loadTrips(gtfsDir);
  const stopTimes = loadStopTimes(gtfsDir);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await ensureTransitTables(client);

    for (const route of routes) {
      await client.query(
        `
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_desc, route_type, agency_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (route_id)
        DO UPDATE SET
          route_short_name = EXCLUDED.route_short_name,
          route_long_name = EXCLUDED.route_long_name,
          route_desc = EXCLUDED.route_desc,
          route_type = EXCLUDED.route_type,
          agency_id = EXCLUDED.agency_id
      `,
        [
          route.route_id,
          route.route_short_name,
          route.route_long_name,
          route.route_desc,
          route.route_type,
          route.agency_id,
        ]
      );
    }

    for (const stop of stops) {
      await client.query(
        `
        INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (stop_id)
        DO UPDATE SET
          stop_name = EXCLUDED.stop_name,
          stop_lat = EXCLUDED.stop_lat,
          stop_lon = EXCLUDED.stop_lon
      `,
        [stop.stop_id, stop.stop_name, stop.stop_lat, stop.stop_lon]
      );
    }

    for (const trip of trips) {
      await client.query(
        `
        INSERT INTO trips (trip_id, route_id, service_id, shape_id, trip_headsign)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (trip_id)
        DO UPDATE SET
          route_id = EXCLUDED.route_id,
          service_id = EXCLUDED.service_id,
          shape_id = EXCLUDED.shape_id,
          trip_headsign = EXCLUDED.trip_headsign
      `,
        [trip.trip_id, trip.route_id, trip.service_id, trip.shape_id, trip.trip_headsign]
      );
    }

    for (const stopTime of stopTimes) {
      await client.query(
        `
        INSERT INTO stop_times (trip_id, stop_id, stop_sequence, arrival_time, departure_time)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (trip_id, stop_id, stop_sequence)
        DO UPDATE SET
          arrival_time = EXCLUDED.arrival_time,
          departure_time = EXCLUDED.departure_time
      `,
        [
          stopTime.trip_id,
          stopTime.stop_id,
          stopTime.stop_sequence,
          stopTime.arrival_time,
          stopTime.departure_time,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  isPostgresEnabled,
  isPostgresRequired,
  isAutoImportEnabled,
  ensureTransitTables,
  loadTransitDataFromDb,
  seedTransitDataFromGtfs,
};