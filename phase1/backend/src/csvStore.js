const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadRoutes(gtfsDir) {
  const routesPath = path.join(gtfsDir, "routes.txt");
  const rows = readCsv(routesPath);
  return rows.map((r) => ({
    route_id: r.route_id,
    route_short_name: r.route_short_name || "",
    route_long_name: r.route_long_name || "",
    route_desc: r.route_desc || "",
    route_type: toNumber(r.route_type),
    agency_id: r.fagency_id || "",
  }));
}

function loadStops(gtfsDir) {
  const stopsPath = path.join(gtfsDir, "stops.txt");
  const rows = readCsv(stopsPath);
  return rows.map((s) => ({
    stop_id: s.stop_id,
    stop_name: s.stop_name || "",
    stop_lat: toNumber(s.stop_lat),
    stop_lon: toNumber(s.stop_lon),
  }));
}

function loadTrips(gtfsDir) {
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const rows = readCsv(tripsPath);
  return rows.map((t) => ({
    trip_id: t.trip_id,
    route_id: t.route_id,
    shape_id: t.shape_id || "",
    service_id: t.service_id || "",
    trip_headsign: t.trip_headsign || "",
  }));
}

function loadStopTimes(gtfsDir) {
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");
  const rows = readCsv(stopTimesPath);
  return rows.map((st) => ({
    trip_id: st.trip_id,
    stop_id: st.stop_id,
    stop_sequence: toNumber(st.stop_sequence),
    arrival_time: st.arrival_time || "",
    departure_time: st.departure_time || "",
  }));
}

module.exports = {
  loadRoutes,
  loadStops,
  loadTrips,
  loadStopTimes,
};
