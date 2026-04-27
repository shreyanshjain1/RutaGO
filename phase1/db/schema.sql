CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    route_id TEXT UNIQUE NOT NULL,
    route_short_name TEXT,
    route_long_name TEXT,
    route_desc TEXT,
    route_type INTEGER,
    agency_id TEXT,
    route_color TEXT,
    route_text_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stops (
    id SERIAL PRIMARY KEY,
    stop_id TEXT UNIQUE NOT NULL,
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    geom GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)::geography
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_code TEXT UNIQUE,
    route_id TEXT REFERENCES routes(route_id),
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed_kph DOUBLE PRECISION,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    trip_id TEXT UNIQUE NOT NULL,
    route_id TEXT REFERENCES routes(route_id),
    service_id TEXT,
    shape_id TEXT,
    trip_headsign TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stop_times (
    id SERIAL PRIMARY KEY,
    trip_id TEXT REFERENCES trips(trip_id),
    stop_id TEXT REFERENCES stops(stop_id),
    stop_sequence INTEGER,
    arrival_time TEXT,
    departure_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (trip_id, stop_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    route_id TEXT REFERENCES routes(route_id),
    stop_id TEXT REFERENCES stops(stop_id),
    report_type TEXT NOT NULL,
    details TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stops_geom ON stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_vehicles_route ON vehicles(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX IF NOT EXISTS idx_reports_route ON reports(route_id);
CREATE INDEX IF NOT EXISTS idx_reports_stop ON reports(stop_id);
