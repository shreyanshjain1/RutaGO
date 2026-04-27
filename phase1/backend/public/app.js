const map = L.map("map").setView([14.65, 121.03], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const originInput = document.getElementById("originInput");
const destinationInput = document.getElementById("destinationInput");
const searchBtn = document.getElementById("searchBtn");
const nearestBtn = document.getElementById("nearestBtn");
const vehiclesBtn = document.getElementById("vehiclesBtn");
const locateBtn = document.getElementById("locateBtn");
const setOriginBtn = document.getElementById("setOriginBtn");
const setDestinationBtn = document.getElementById("setDestinationBtn");
const directResults = document.getElementById("directResults");
const transferResults = document.getElementById("transferResults");
const nearestResults = document.getElementById("nearestResults");
const vehicleResults = document.getElementById("vehicleResults");
const vehicleSummary = document.getElementById("vehicleSummary");
const summary = document.getElementById("summary");
const notificationBanner = document.getElementById("notificationBanner");

const configuredApiBase = (window.RUTAGO_CONFIG && window.RUTAGO_CONFIG.apiBaseUrl) || "";
const storedApiBase = window.localStorage.getItem("rutago_api_base") || "";
const API_BASE_URL = (configuredApiBase || storedApiBase).replace(/\/+$/, "");

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

async function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}

let originMarker = null;
let destinationMarker = null;
let nearestLayer = L.layerGroup().addTo(map);
let routeLayer = L.layerGroup().addTo(map);
let vehicleLayer = L.layerGroup().addTo(map);
let mapClickMode = null;
let destinationWatchId = null;
let destinationTarget = null;
let activeRouteId = null;

const routeColors = ["#075985", "#0f766e", "#7c3aed", "#b45309", "#be123c"];

function clearNotificationBanner() {
  if (!notificationBanner) return;
  notificationBanner.hidden = true;
  notificationBanner.className = "notice-banner";
  notificationBanner.textContent = "";
}

function showNotificationBanner(title, body, tone = "warning") {
  if (!notificationBanner) return;

  notificationBanner.hidden = false;
  notificationBanner.className = `notice-banner ${tone}`;
  notificationBanner.innerHTML = "";

  const titleEl = document.createElement("div");
  titleEl.className = "notice-title";
  titleEl.textContent = title;

  const bodyEl = document.createElement("div");
  bodyEl.className = "notice-body";
  bodyEl.textContent = body;

  notificationBanner.append(titleEl, bodyEl);
}

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function fmtMeters(m) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
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

function setMarker(kind, lat, lng) {
  const marker = L.marker([lat, lng]);
  marker.bindPopup(kind === "origin" ? "Origin" : "Destination");
  marker.addTo(map).openPopup();

  if (kind === "origin") {
    if (originMarker) map.removeLayer(originMarker);
    originMarker = marker;
    originInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  } else {
    if (destinationMarker) map.removeLayer(destinationMarker);
    destinationMarker = marker;
    destinationInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }
}

function card(html) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = html;
  return div;
}

function clearResults() {
  directResults.innerHTML = "";
  transferResults.innerHTML = "";
  nearestResults.innerHTML = "";
  vehicleResults.innerHTML = "";
}

function showEmpty(container, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  container.appendChild(div);
}

function setVehicleSummary(text) {
  if (vehicleSummary) {
    vehicleSummary.textContent = text;
  }
}

function vehicleBadgeTone(lastSeenAt) {
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs < 120000) return "active";
  if (ageMs < 300000) return "stale";
  return "";
}

function vehicleCardHtml(vehicle) {
  const badgeTone = vehicleBadgeTone(vehicle.last_seen_at);
  return `
    <div class="route">${vehicle.route_name}</div>
    <div class="meta">Vehicle: ${vehicle.vehicle_code}</div>
    <div class="meta">Position: ${vehicle.lat.toFixed(6)}, ${vehicle.lon.toFixed(6)}</div>
    <div class="meta">Heading: ${vehicle.heading}° | Speed: ${vehicle.speed_kph.toFixed(1)} kph</div>
    <div class="meta">Next stop: ${vehicle.next_stop}</div>
    <div class="vehicle-badge ${badgeTone}">Last seen ${new Date(vehicle.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
  `;
}

function addVehicleMarker(vehicle, color) {
  const marker = L.circleMarker([vehicle.lat, vehicle.lon], {
    radius: 8,
    color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.9,
  }).bindPopup(
    `${vehicle.route_name}<br>${vehicle.vehicle_code}<br>${vehicle.next_stop}<br>${vehicle.speed_kph.toFixed(1)} kph`
  );
  marker.addTo(vehicleLayer);
}

async function loadVehicleFeed(routeId = null) {
  vehicleLayer.clearLayers();
  vehicleResults.innerHTML = "";

  const query = routeId ? `?route_id=${encodeURIComponent(routeId)}&limit=3` : "?limit=8";
  const resp = await apiFetch(`/mvp/vehicles${query}`);
  if (!resp.ok) {
    setVehicleSummary("Vehicle feed is unavailable right now.");
    showEmpty(vehicleResults, "No vehicle snapshots available.");
    return;
  }

  const body = await resp.json();
  const vehicles = body.data || [];
  if (!vehicles.length) {
    setVehicleSummary("No active vehicle snapshots were returned for the selected route.");
    showEmpty(vehicleResults, "No vehicle snapshots available.");
    return;
  }

  setVehicleSummary(
    routeId
      ? `Tracking ${vehicles.length} synthetic vehicle snapshot(s) for the top route.`
      : `Tracking ${vehicles.length} synthetic vehicle snapshot(s) from the live hook.`
  );

  for (const [index, vehicle] of vehicles.entries()) {
    const color = routeColor(index);
    const el = card(vehicleCardHtml(vehicle));
    el.classList.add("vehicle-card");
    vehicleResults.appendChild(el);
    addVehicleMarker(vehicle, color);
  }

  if (vehicleLayer.getLayers().length) {
    map.fitBounds(vehicleLayer.getBounds(), { padding: [25, 25] });
  }
}

async function loadOverlay(routeId, color) {
  const resp = await apiFetch(`/mvp/routes/${encodeURIComponent(routeId)}/overlay`);
  if (!resp.ok) return;
  const body = await resp.json();
  if (!body.points || !body.points.length) return;

  const poly = L.polyline(
    body.points.map((p) => [p.lat, p.lon]),
    { color, weight: 6, opacity: 0.88, lineCap: "round", lineJoin: "round" }
  );
  poly.addTo(routeLayer);
}

function routeColor(index) {
  return routeColors[index % routeColors.length];
}

function startApproachAlert(stop) {
  if (!stop || stop.stop_lat == null || stop.stop_lon == null) return;
  destinationTarget = stop;

  const supportsNotifications = typeof Notification !== "undefined";

  if (supportsNotifications && Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "denied") {
        showNotificationBanner(
          "In-app alert enabled",
          `Browser notifications are blocked, so RutaGO will keep the alert inside the page for ${stop.stop_name}.`,
          "info"
        );
      }
    });
  }

  if (!navigator.geolocation) return;
  if (destinationWatchId) navigator.geolocation.clearWatch(destinationWatchId);

  destinationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!destinationTarget) return;
      const d = haversineMeters(
        position.coords.latitude,
        position.coords.longitude,
        destinationTarget.stop_lat,
        destinationTarget.stop_lon
      );

      if (d <= 300) {
        const message = "Approaching destination stop";
        summary.textContent = `${message}: ${destinationTarget.stop_name}`;

        if (supportsNotifications && Notification.permission === "granted") {
          new Notification(message, {
            body: destinationTarget.stop_name,
          });
          clearNotificationBanner();
        } else {
          showNotificationBanner(
            "Approaching destination",
            `${destinationTarget.stop_name} is within 300m. Keep this page open for the in-app alert fallback.`,
            "warning"
          );
        }

        navigator.geolocation.clearWatch(destinationWatchId);
        destinationWatchId = null;
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

searchBtn.addEventListener("click", async () => {
  clearResults();
  routeLayer.clearLayers();
  vehicleLayer.clearLayers();
  clearNotificationBanner();

  const from = parseLatLng(originInput.value);
  const to = parseLatLng(destinationInput.value);
  if (!from || !to) {
    summary.textContent = "Please provide valid origin and destination coordinates.";
    return;
  }

  summary.textContent = "Searching jeep routes and transfer options...";

  const resp = await apiFetch(
    `/mvp/search?from=${encodeURIComponent(originInput.value)}&to=${encodeURIComponent(
      destinationInput.value
    )}`
  );

  if (!resp.ok) {
    summary.textContent = "Search failed. Please try again.";
    return;
  }

  const body = await resp.json();
  const directs = body.direct_options || [];
  const transfers = body.transfer_options || [];
  activeRouteId = directs[0]?.route_id || transfers[0]?.first_route_id || transfers[0]?.second_route_id || null;

  summary.textContent = `Found ${directs.length} direct and ${transfers.length} transfer options.`;

  if (!directs.length) {
    showEmpty(directResults, "No direct jeep route found for this pair.");
  }

  for (const [index, option] of directs.entries()) {
    if (index >= 4) break;
    const color = routeColor(index);
    const el = card(`
      <div class="route">${option.route_name}</div>
      <div class="meta">Board: ${option.board_stop.stop_name}</div>
      <div class="meta">Alight: ${option.alight_stop.stop_name}</div>
      <div class="meta">Walking: ${fmtMeters(option.walking_m)} | Jeep: ${fmtMeters(option.jeep_m)}</div>
      <div class="meta">Est. Travel: ${option.estimated_minutes} min | Transfers: 0</div>
      <div class="meta">Rank score: ${Number(option.score || 0).toFixed(1)} | Route span: ${option.route_gap_stops ?? "n/a"} stops</div>
      <div class="pill direct">Direct route</div>
    `);
    el.addEventListener("click", () => startApproachAlert(option.alight_stop));
    directResults.appendChild(el);
    loadOverlay(option.route_id, color);
  }

  if (!transfers.length) {
    showEmpty(transferResults, "No transfer suggestion found for this pair.");
  }

  for (const [index, option] of transfers.entries()) {
    if (index >= 4) break;
    const el = card(`
      <div class="route">${option.first_route_name} → ${option.second_route_name}</div>
      <div class="meta">Board: ${option.board_stop.stop_name}</div>
      <div class="meta">Transfer: ${option.transfer_stop.stop_name}</div>
      <div class="meta">Alight: ${option.alight_stop.stop_name}</div>
      <div class="meta">Walking: ${fmtMeters(option.walking_m)} | Jeep: ${fmtMeters(option.jeep_m)}</div>
      <div class="meta">Est. Travel: ${option.estimated_minutes} min | Transfers: 1</div>
      <div class="meta">Rank score: ${Number(option.score || 0).toFixed(1)} | Route span: ${option.route_gap_stops ?? "n/a"} stops</div>
      <div class="pill transfer">Transfer option</div>
    `);
    el.addEventListener("click", () => startApproachAlert(option.alight_stop));
    transferResults.appendChild(el);
    loadOverlay(option.first_route_id, routeColor(index));
    loadOverlay(option.second_route_id, routeColor(index + 1));
  }

  if (routeLayer.getLayers().length) {
    map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
  }

  if (activeRouteId) {
    await loadVehicleFeed(activeRouteId);
  } else {
    setVehicleSummary("Search a route first, then refresh vehicle snapshots for the leading route.");
  }
});

nearestBtn.addEventListener("click", async () => {
  nearestLayer.clearLayers();
  nearestResults.innerHTML = "";

  const from = parseLatLng(originInput.value);
  if (!from) {
    summary.textContent = "Set origin first to run nearest stop finder.";
    return;
  }

  const resp = await apiFetch(
    `/mvp/stops/nearest?lat=${from.lat}&lon=${from.lng}&radius=300`
  );
  if (!resp.ok) {
    summary.textContent = "Nearest stop lookup failed.";
    return;
  }

  const body = await resp.json();
  const items = body.data || [];
  summary.textContent = `Nearest stop query returned ${items.length} stop(s) within 300m.`;

  if (!items.length) {
    showEmpty(nearestResults, "No stop found within 300m.");
    return;
  }

  for (const stop of items) {
    const el = card(`
      <div class="route">${stop.stop_name}</div>
      <div class="meta">${stop.stop_id}</div>
      <div class="meta">Distance: ${fmtMeters(stop.distance_m)}</div>
    `);
    nearestResults.appendChild(el);

    const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
      radius: 6,
      color: "#0891b2",
      fillOpacity: 0.9,
    }).bindPopup(`${stop.stop_name}<br>${fmtMeters(stop.distance_m)}`);
    marker.addTo(nearestLayer);
  }

  if (nearestLayer.getLayers().length) {
    map.fitBounds(nearestLayer.getBounds(), { padding: [25, 25] });
  }
});

vehiclesBtn.addEventListener("click", async () => {
  const routeId = activeRouteId || null;
  await loadVehicleFeed(routeId);
});

locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    summary.textContent = "Geolocation is not available in this browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setMarker("origin", lat, lng);
      map.setView([lat, lng], 14);
      summary.textContent = "Current location loaded into Origin.";
    },
    () => {
      summary.textContent = "Could not access your location.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

setOriginBtn.addEventListener("click", () => {
  mapClickMode = "origin";
  summary.textContent = "Tap the map to set Origin.";
});

setDestinationBtn.addEventListener("click", () => {
  mapClickMode = "destination";
  summary.textContent = "Tap the map to set Destination.";
});

map.on("click", (e) => {
  if (!mapClickMode) return;
  setMarker(mapClickMode, e.latlng.lat, e.latlng.lng);
  mapClickMode = null;
});

originInput.value = "14.653500,121.049000";
destinationInput.value = "14.599500,120.984000";
setMarker("origin", 14.6535, 121.049);
setMarker("destination", 14.5995, 120.984);
setVehicleSummary("Search a route first, then refresh vehicle snapshots for the leading route.");
