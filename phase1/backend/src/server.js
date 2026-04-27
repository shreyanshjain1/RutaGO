const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const {
  loadRoutes,
  loadStops,
  loadTrips,
  loadStopTimes,
} = require("./csvStore");
const {
  isPostgresEnabled,
  isPostgresRequired,
  isAutoImportEnabled,
  loadTransitDataFromDb,
  seedTransitDataFromGtfs,
} = require("./dbStore");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const OTP_BASE_URL = process.env.OTP_BASE_URL || "http://localhost:8080";
const GTFS_DIR = process.env.GTFS_DIR || "../../data/prepared";
const OTP_TRANSIT_PREFERRED = String(process.env.OTP_TRANSIT_PREFERRED || "true").toLowerCase() === "true";
const OTP_ALLOW_WALK_FALLBACK = String(process.env.OTP_ALLOW_WALK_FALLBACK || "true").toLowerCase() === "true";
const OTP_MAX_WALK_METERS = Number(process.env.OTP_MAX_WALK_METERS || 1500);
const gtfsDir = path.resolve(__dirname, GTFS_DIR);
const publicDir = path.resolve(__dirname, "../public");

let routes = [];
let stops = [];
let trips = [];
let stopTimes = [];

let routeById = new Map();
let stopById = new Map();
let tripById = new Map();
let routeToRepresentativeStops = new Map();
let stopToRoutes = new Map();
let dataSource = "csv";

function loadFromCsv() {
  routes = loadRoutes(gtfsDir);
  stops = loadStops(gtfsDir);
  trips = loadTrips(gtfsDir);
  stopTimes = loadStopTimes(gtfsDir);
  dataSource = "csv";
}

async function refreshData() {
  if (isPostgresEnabled()) {
    try {
      if (isAutoImportEnabled()) {
        await seedTransitDataFromGtfs(gtfsDir);
      }

      const dbData = await loadTransitDataFromDb();
      if (dbData) {
        routes = dbData.routes;
        stops = dbData.stops;
        trips = dbData.trips;
        stopTimes = dbData.stopTimes;
        dataSource = "postgres";
      }
    } catch (err) {
      if (isPostgresRequired()) {
        throw err;
      }
      console.warn(`Postgres unavailable. Falling back to CSV data: ${err.message}`);
      loadFromCsv();
    }
  } else {
    loadFromCsv();
  }

  buildTransitIndexes();
}

function buildTransitIndexes() {
  routeById = new Map(routes.map((r) => [r.route_id, r]));
  stopById = new Map(stops.map((s) => [s.stop_id, s]));
  tripById = new Map(trips.map((t) => [t.trip_id, t]));
  routeToRepresentativeStops = new Map();
  stopToRoutes = new Map();

  const tripToStops = new Map();
  for (const row of stopTimes) {
    if (!tripToStops.has(row.trip_id)) tripToStops.set(row.trip_id, []);
    tripToStops.get(row.trip_id).push(row);
  }

  const routeToBestSequence = new Map();
  for (const [tripId, rows] of tripToStops.entries()) {
    const trip = tripById.get(tripId);
    if (!trip || !trip.route_id) continue;

    rows.sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
    const stopSeq = rows
      .map((r) => r.stop_id)
      .filter((id) => id && stopById.has(id));

    if (!stopSeq.length) continue;

    const current = routeToBestSequence.get(trip.route_id);
    if (!current || stopSeq.length > current.length) {
      routeToBestSequence.set(trip.route_id, stopSeq);
    }
  }

  routeToRepresentativeStops = routeToBestSequence;

  for (const [routeId, stopSeq] of routeToRepresentativeStops.entries()) {
    for (const stopId of stopSeq) {
      if (!stopToRoutes.has(stopId)) stopToRoutes.set(stopId, new Set());
      stopToRoutes.get(stopId).add(routeId);
    }
  }
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function nearestStops(lat, lon, radiusMeters = 300, maxResults = 12) {
  const scored = [];
  for (const stop of stops) {
    if (stop.stop_lat == null || stop.stop_lon == null) continue;
    const d = haversineMeters(lat, lon, stop.stop_lat, stop.stop_lon);
    if (d <= radiusMeters) {
      scored.push({
        ...stop,
        distance_m: Math.round(d),
      });
    }
  }

  scored.sort((a, b) => a.distance_m - b.distance_m);
  return scored.slice(0, maxResults);
}

function stopIndexInRoute(routeId, stopId) {
  const seq = routeToRepresentativeStops.get(routeId);
  if (!seq) return -1;
  return seq.indexOf(stopId);
}

function estimateTravelMinutes({ jeepDistanceM, walkingDistanceM, transfers }) {
  const jeepMinutes = (jeepDistanceM / 1000 / 18) * 60;
  const walkingMinutes = (walkingDistanceM / 1000 / 4.5) * 60;
  const waitAndTransfer = 6 + transfers * 8;
  return Math.max(6, Math.round(jeepMinutes + walkingMinutes + waitAndTransfer));
}

function routeGap(routeId, startStopId, endStopId) {
  const seq = routeToRepresentativeStops.get(routeId);
  if (!seq) return null;

  const startIndex = seq.indexOf(startStopId);
  const endIndex = seq.indexOf(endStopId);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) return null;

  return endIndex - startIndex;
}

function tripQualityScore({
  estimatedMinutes,
  walkingMeters,
  transfers,
  routeGapStops,
  legGapA,
  legGapB,
}) {
  const walkingPenalty = walkingMeters / 320;
  const transferPenalty = transfers * 14;
  const routeGapPenalty = routeGapStops == null ? 0 : Math.min(routeGapStops / 2, 18);
  const legImbalancePenalty =
    legGapA == null || legGapB == null ? 0 : Math.min(Math.abs(legGapA - legGapB) * 0.75, 8);
  return estimatedMinutes + walkingPenalty + transferPenalty + routeGapPenalty + legImbalancePenalty;
}

function buildOverlayPoints(routeId) {
  const seq = routeToRepresentativeStops.get(routeId) || [];
  const points = [];
  for (const stopId of seq) {
    const stop = stopById.get(stopId);
    if (!stop || stop.stop_lat == null || stop.stop_lon == null) continue;
    points.push({
      stop_id: stop.stop_id,
      stop_name: stop.stop_name,
      lat: stop.stop_lat,
      lon: stop.stop_lon,
    });
  }
  return points;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function bearingDegrees(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLon = toRad(bLon - aLon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildVehicleSnapshot(routeId, vehicleIndex = 0, timeMs = Date.now()) {
  const seq = routeToRepresentativeStops.get(routeId) || [];
  if (seq.length < 2) return null;

  const route = routeById.get(routeId);
  if (!route) return null;

  const routeSeed = hashString(routeId);
  const segmentCount = seq.length - 1;
  const phase = ((timeMs / 60000) + routeSeed / 997 + vehicleIndex * 0.27) % segmentCount;
  const segmentIndex = Math.floor(phase);
  const segmentProgress = phase - segmentIndex;

  const currentStop = stopById.get(seq[segmentIndex]);
  const nextStop = stopById.get(seq[segmentIndex + 1]);
  if (!currentStop || !nextStop) return null;

  const lat = currentStop.stop_lat + (nextStop.stop_lat - currentStop.stop_lat) * segmentProgress;
  const lon = currentStop.stop_lon + (nextStop.stop_lon - currentStop.stop_lon) * segmentProgress;

  return {
    vehicle_code: `veh-${routeId}-${vehicleIndex + 1}`,
    route_id: routeId,
    route_name: route.route_long_name || route.route_short_name || routeId,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    heading: Math.round(
      bearingDegrees(currentStop.stop_lat, currentStop.stop_lon, nextStop.stop_lat, nextStop.stop_lon)
    ),
    speed_kph: Number((14 + (routeSeed % 7) + vehicleIndex * 1.5).toFixed(1)),
    last_seen_at: new Date(timeMs - vehicleIndex * 15000).toISOString(),
    progress: Number(segmentProgress.toFixed(2)),
    current_stop: currentStop.stop_name,
    next_stop: nextStop.stop_name,
    source: "synthetic-live-hook",
  };
}

function buildVehicleFeed(routeId = null, limit = 8) {
  const timeMs = Date.now();

  if (routeId) {
    return [
      buildVehicleSnapshot(routeId, 0, timeMs),
      buildVehicleSnapshot(routeId, 1, timeMs),
      buildVehicleSnapshot(routeId, 2, timeMs),
    ].filter(Boolean);
  }

  const activeRouteIds = Array.from(routeToRepresentativeStops.keys())
    .filter((rid) => (routeToRepresentativeStops.get(rid) || []).length >= 2)
    .slice(0, limit);

  return activeRouteIds
    .map((rid, index) => buildVehicleSnapshot(rid, index, timeMs))
    .filter(Boolean);
}

app.use(express.static(publicDir));

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    data_source: dataSource,
    routes: routes.length,
    stops: stops.length,
    trips: trips.length,
    stop_times: stopTimes.length,
  });
});

app.get("/mvp/stops/nearest", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Number(req.query.radius || 300);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      error: "Invalid query. Use /mvp/stops/nearest?lat=..&lon=..&radius=300",
    });
  }

  const data = nearestStops(lat, lon, radius, 15);
  return res.json({
    count: data.length,
    radius_m: radius,
    data,
    sql_example: "SELECT stop FROM stops WHERE ST_DWithin(geom, input_point, 300)",
  });
});

app.get("/mvp/routes/:routeId/overlay", (req, res) => {
  const routeId = req.params.routeId;
  const route = routeById.get(routeId);
  if (!route) {
    return res.status(404).json({ error: "route_id not found" });
  }

  const points = buildOverlayPoints(routeId);
  return res.json({
    route,
    points,
  });
});

app.get("/mvp/vehicles", (req, res) => {
  const routeId = (req.query.route_id || "").toString().trim();
  const limit = Math.max(1, Math.min(Number(req.query.limit || 8) || 8, 20));

  if (routeId && !routeById.has(routeId)) {
    return res.status(404).json({ error: "route_id not found" });
  }

  const data = buildVehicleFeed(routeId || null, limit);
  return res.json({
    route_id: routeId || null,
    count: data.length,
    generated_at: new Date().toISOString(),
    source: "synthetic-live-hook",
    data,
  });
});

app.get("/mvp/routes/:routeId/vehicles", (req, res) => {
  const routeId = req.params.routeId;
  if (!routeById.has(routeId)) {
    return res.status(404).json({ error: "route_id not found" });
  }

  const data = buildVehicleFeed(routeId, 3);
  return res.json({
    route_id: routeId,
    count: data.length,
    generated_at: new Date().toISOString(),
    source: "synthetic-live-hook",
    data,
  });
});

app.get("/mvp/search", (req, res) => {
  const from = parseLatLng(req.query.from);
  const to = parseLatLng(req.query.to);

  if (!from || !to) {
    return res.status(400).json({
      error: "Invalid query format. Use /mvp/search?from=lat,lng&to=lat,lng",
    });
  }

  const originStops = nearestStops(from.lat, from.lng, 450, 10);
  const destinationStops = nearestStops(to.lat, to.lng, 450, 10);

  const direct = [];
  for (const fromStop of originStops) {
    const routeSet = stopToRoutes.get(fromStop.stop_id);
    if (!routeSet) continue;

    for (const routeId of routeSet) {
      const iFrom = stopIndexInRoute(routeId, fromStop.stop_id);
      if (iFrom < 0) continue;

      for (const toStop of destinationStops) {
        const iTo = stopIndexInRoute(routeId, toStop.stop_id);
        if (iTo <= iFrom) continue;

        const route = routeById.get(routeId);
        const gapStops = routeGap(routeId, fromStop.stop_id, toStop.stop_id);
        const rideDistance = haversineMeters(
          fromStop.stop_lat,
          fromStop.stop_lon,
          toStop.stop_lat,
          toStop.stop_lon
        );
        const walkingDistance =
          haversineMeters(from.lat, from.lng, fromStop.stop_lat, fromStop.stop_lon) +
          haversineMeters(to.lat, to.lng, toStop.stop_lat, toStop.stop_lon);

        direct.push({
          type: "direct",
          route_id: routeId,
          route_name: route.route_long_name || route.route_short_name || routeId,
          board_stop: fromStop,
          alight_stop: toStop,
          transfers: 0,
          walking_m: Math.round(walkingDistance),
          jeep_m: Math.round(rideDistance),
          estimated_minutes: estimateTravelMinutes({
            jeepDistanceM: rideDistance,
            walkingDistanceM: walkingDistance,
            transfers: 0,
          }),
          score: tripQualityScore({
            estimatedMinutes: estimateTravelMinutes({
              jeepDistanceM: rideDistance,
              walkingDistanceM: walkingDistance,
              transfers: 0,
            }),
            walkingMeters: walkingDistance,
            transfers: 0,
            routeGapStops: gapStops,
          }),
          route_gap_stops: gapStops,
        });
      }
    }
  }

  const directDedup = [];
  const seenDirect = new Set();
  for (const option of direct) {
    const key = `${option.route_id}:${option.board_stop.stop_id}:${option.alight_stop.stop_id}`;
    if (seenDirect.has(key)) continue;
    seenDirect.add(key);
    directDedup.push(option);
  }
  directDedup.sort((a, b) => a.score - b.score || a.estimated_minutes - b.estimated_minutes);

  const transfers = [];
  const originRouteIds = new Set();
  for (const st of originStops) {
    const rs = stopToRoutes.get(st.stop_id);
    if (!rs) continue;
    for (const rid of rs) originRouteIds.add(rid);
  }

  const destinationRouteIds = new Set();
  for (const st of destinationStops) {
    const rs = stopToRoutes.get(st.stop_id);
    if (!rs) continue;
    for (const rid of rs) destinationRouteIds.add(rid);
  }

  for (const routeA of originRouteIds) {
    const seqA = routeToRepresentativeStops.get(routeA);
    if (!seqA) continue;

    for (const routeB of destinationRouteIds) {
      if (routeA === routeB) continue;
      const seqB = routeToRepresentativeStops.get(routeB);
      if (!seqB) continue;

      const seqBSet = new Set(seqB);
      let transferStopId = null;
      for (const s of seqA) {
        if (seqBSet.has(s)) {
          transferStopId = s;
          break;
        }
      }
      if (!transferStopId) continue;

      const originCandidate = originStops.find(
        (s) => stopIndexInRoute(routeA, s.stop_id) >= 0 && stopIndexInRoute(routeA, s.stop_id) < stopIndexInRoute(routeA, transferStopId)
      );
      const destinationCandidate = destinationStops.find(
        (s) => stopIndexInRoute(routeB, transferStopId) >= 0 && stopIndexInRoute(routeB, transferStopId) < stopIndexInRoute(routeB, s.stop_id)
      );

      if (!originCandidate || !destinationCandidate) continue;

      const transferStop = stopById.get(transferStopId);
      if (!transferStop) continue;

      const rideA = haversineMeters(
        originCandidate.stop_lat,
        originCandidate.stop_lon,
        transferStop.stop_lat,
        transferStop.stop_lon
      );
      const rideB = haversineMeters(
        transferStop.stop_lat,
        transferStop.stop_lon,
        destinationCandidate.stop_lat,
        destinationCandidate.stop_lon
      );
      const walkingDistance =
        haversineMeters(
          from.lat,
          from.lng,
          originCandidate.stop_lat,
          originCandidate.stop_lon
        ) +
        haversineMeters(
          to.lat,
          to.lng,
          destinationCandidate.stop_lat,
          destinationCandidate.stop_lon
        );

      const routeAObj = routeById.get(routeA);
      const routeBObj = routeById.get(routeB);
      const transferGap = routeGap(routeA, originCandidate.stop_id, transferStopId);
      const transferGapTwo = routeGap(routeB, transferStopId, destinationCandidate.stop_id);
      const totalRouteGap =
        transferGap == null || transferGapTwo == null ? null : transferGap + transferGapTwo;

      transfers.push({
        type: "transfer",
        first_route_id: routeA,
        first_route_name:
          routeAObj.route_long_name || routeAObj.route_short_name || routeA,
        second_route_id: routeB,
        second_route_name:
          routeBObj.route_long_name || routeBObj.route_short_name || routeB,
        board_stop: originCandidate,
        transfer_stop: transferStop,
        alight_stop: destinationCandidate,
        transfers: 1,
        walking_m: Math.round(walkingDistance),
        jeep_m: Math.round(rideA + rideB),
        estimated_minutes: estimateTravelMinutes({
          jeepDistanceM: rideA + rideB,
          walkingDistanceM: walkingDistance,
          transfers: 1,
        }),
        score: tripQualityScore({
          estimatedMinutes: estimateTravelMinutes({
            jeepDistanceM: rideA + rideB,
            walkingDistanceM: walkingDistance,
            transfers: 1,
          }),
          walkingMeters: walkingDistance,
          transfers: 1,
          routeGapStops: totalRouteGap,
          legGapA: transferGap,
          legGapB: transferGapTwo,
        }),
        route_gap_stops: totalRouteGap,
      });
    }
  }

  const transferDedup = [];
  const seenTransfer = new Set();
  for (const option of transfers) {
    const key = `${option.first_route_id}:${option.second_route_id}:${option.transfer_stop.stop_id}`;
    if (seenTransfer.has(key)) continue;
    seenTransfer.add(key);
    transferDedup.push(option);
  }
  transferDedup.sort((a, b) => a.score - b.score || a.estimated_minutes - b.estimated_minutes);

  return res.json({
    origin: from,
    destination: to,
    nearest_origin_stops: originStops,
    nearest_destination_stops: destinationStops,
    direct_options: directDedup.slice(0, 6),
    transfer_options: transferDedup.slice(0, 6),
  });
});

app.get("/routes", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase().trim();
  const filtered = q
    ? routes.filter((r) =>
        [r.route_id, r.route_short_name, r.route_long_name, r.route_desc]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : routes;

  res.json({ count: filtered.length, data: filtered });
});

app.get("/stops", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase().trim();
  const filtered = q
    ? stops.filter((s) =>
        [s.stop_id, s.stop_name].join(" ").toLowerCase().includes(q)
      )
    : stops;

  res.json({ count: filtered.length, data: filtered });
});

function buildOtpPlanUrl(from, to, modes) {
  const params = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    mode: modes,
    numItineraries: "5",
    maxWalkDistance: String(OTP_MAX_WALK_METERS),
  });
  return `${OTP_BASE_URL}/otp/routers/default/plan?${params.toString()}`;
}

async function fetchPlan(url) {
  const response = await fetch(url);
  const body = await response.json();
  return { status: response.status, body };
}

async function getTransitAwarePlan(from, to) {
  const transitUrl = buildOtpPlanUrl(from, to, "TRANSIT,WALK");
  const transitResponse = await fetchPlan(transitUrl);

  const transitItineraries = transitResponse.body?.plan?.itineraries || [];
  if (transitResponse.status < 400 && transitItineraries.length > 0) {
    return {
      status: transitResponse.status,
      body: {
        ...transitResponse.body,
        routing_mode: "transit",
      },
    };
  }

  if (!OTP_ALLOW_WALK_FALLBACK) {
    return {
      status: transitResponse.status,
      body: {
        ...transitResponse.body,
        routing_mode: "transit",
        transit_unavailable: true,
      },
    };
  }

  const walkUrl = buildOtpPlanUrl(from, to, "WALK");
  const walkResponse = await fetchPlan(walkUrl);
  return {
    status: walkResponse.status,
    body: {
      ...walkResponse.body,
      routing_mode: "walk_fallback",
      transit_unavailable: true,
      transit_attempt_url: transitUrl,
      fallback_url: walkUrl,
    },
  };
}

app.get("/plan", async (req, res) => {
  const from = parseLatLng(req.query.from);
  const to = parseLatLng(req.query.to);

  if (!from || !to) {
    return res.status(400).json({
      error: "Invalid query format. Use /plan?from=lat,lng&to=lat,lng",
    });
  }

  try {
    if (OTP_TRANSIT_PREFERRED) {
      const plan = await getTransitAwarePlan(from, to);
      return res.status(plan.status).json(plan.body);
    }

    const url = buildOtpPlanUrl(from, to, "WALK");
    const plan = await fetchPlan(url);
    return res.status(plan.status).json({ ...plan.body, routing_mode: "walk" });
  } catch (err) {
    return res.status(502).json({
      error: "Could not reach OTP server",
      otp_url: `${OTP_BASE_URL}/otp/routers/default/plan`,
      details: err.message,
    });
  }
});


// Clean API aliases for the mobile/PWA client. The original /mvp routes remain
// supported so existing demos do not break, while /api gives the project
// a production-ready route namespace.
app.get("/api/stops/nearest", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/mvp/stops/nearest${qs ? `?${qs}` : ""}`);
});

app.get("/api/routes/:routeId/overlay", (req, res) => {
  res.redirect(307, `/mvp/routes/${encodeURIComponent(req.params.routeId)}/overlay`);
});

app.get("/api/vehicles", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/mvp/vehicles${qs ? `?${qs}` : ""}`);
});

app.get("/api/routes/:routeId/vehicles", (req, res) => {
  res.redirect(307, `/mvp/routes/${encodeURIComponent(req.params.routeId)}/vehicles`);
});

app.get("/api/search", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/mvp/search${qs ? `?${qs}` : ""}`);
});

app.get("/api/routes", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/routes${qs ? `?${qs}` : ""}`);
});

app.get("/api/stops", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/stops${qs ? `?${qs}` : ""}`);
});

app.get("/api/plan", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(307, `/plan${qs ? `?${qs}` : ""}`);
});

app.get("/mvp/demo-notification", (req, res) => {
  res.json({
    message: "Approaching destination stop",
    description: "Call this from the client when user is within threshold distance.",
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/health") || req.path.startsWith("/routes") || req.path.startsWith("/stops") || req.path.startsWith("/plan") || req.path.startsWith("/mvp/") || req.path.startsWith("/api/")) {
    return next();
  }
  return res.sendFile(path.join(publicDir, "index.html"));
});

async function startServer() {
  try {
    await refreshData();
  } catch (err) {
    console.error("Failed to load transit data:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`RutaGO Phase 2 API running at http://localhost:${PORT}`);
    console.log(`GTFS data directory: ${gtfsDir}`);
    console.log(`Transit data source: ${dataSource}`);
    console.log(`MVP mobile web app: http://localhost:${PORT}`);
  });
}

startServer();
