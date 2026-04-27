const map = L.map("map").setView([14.65, 121.03], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const originInput = document.getElementById("originInput");
const destinationInput = document.getElementById("destinationInput");
const searchBtn = document.getElementById("searchBtn");
const nearestBtn = document.getElementById("nearestBtn");
const locateBtn = document.getElementById("locateBtn");
const setOriginBtn = document.getElementById("setOriginBtn");
const setDestinationBtn = document.getElementById("setDestinationBtn");
const directResults = document.getElementById("directResults");
const transferResults = document.getElementById("transferResults");
const nearestResults = document.getElementById("nearestResults");
const summary = document.getElementById("summary");

let originMarker = null;
let destinationMarker = null;
let nearestLayer = L.layerGroup().addTo(map);
let routeLayer = L.layerGroup().addTo(map);
let mapClickMode = null;
let destinationWatchId = null;
let destinationTarget = null;

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
}

function showEmpty(container, text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  container.appendChild(div);
}

async function loadOverlay(routeId, color) {
  const resp = await fetch(`/mvp/routes/${encodeURIComponent(routeId)}/overlay`);
  if (!resp.ok) return;
  const body = await resp.json();
  if (!body.points || !body.points.length) return;

  const poly = L.polyline(
    body.points.map((p) => [p.lat, p.lon]),
    { color, weight: 5, opacity: 0.8 }
  );
  poly.addTo(routeLayer);
}

function startApproachAlert(stop) {
  if (!stop || stop.stop_lat == null || stop.stop_lon == null) return;
  destinationTarget = stop;

  if (Notification && Notification.permission === "default") {
    Notification.requestPermission();
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

        if (Notification && Notification.permission === "granted") {
          new Notification(message, {
            body: destinationTarget.stop_name,
          });
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

  const from = parseLatLng(originInput.value);
  const to = parseLatLng(destinationInput.value);
  if (!from || !to) {
    summary.textContent = "Please provide valid origin and destination coordinates.";
    return;
  }

  summary.textContent = "Searching jeep routes and transfer options...";

  const resp = await fetch(
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

  summary.textContent = `Found ${directs.length} direct and ${transfers.length} transfer options.`;

  if (!directs.length) {
    showEmpty(directResults, "No direct jeep route found for this pair.");
  }

  for (const option of directs) {
    const el = card(`
      <div class="route">${option.route_name}</div>
      <div class="meta">Board: ${option.board_stop.stop_name}</div>
      <div class="meta">Alight: ${option.alight_stop.stop_name}</div>
      <div class="meta">Walking: ${fmtMeters(option.walking_m)} | Jeep: ${fmtMeters(option.jeep_m)}</div>
      <div class="meta">Est. Travel: ${option.estimated_minutes} min | Transfers: 0</div>
    `);
    el.addEventListener("click", () => startApproachAlert(option.alight_stop));
    directResults.appendChild(el);
    loadOverlay(option.route_id, "#075985");
  }

  if (!transfers.length) {
    showEmpty(transferResults, "No transfer suggestion found for this pair.");
  }

  for (const option of transfers) {
    const el = card(`
      <div class="route">${option.first_route_name} → ${option.second_route_name}</div>
      <div class="meta">Board: ${option.board_stop.stop_name}</div>
      <div class="meta">Transfer: ${option.transfer_stop.stop_name}</div>
      <div class="meta">Alight: ${option.alight_stop.stop_name}</div>
      <div class="meta">Walking: ${fmtMeters(option.walking_m)} | Jeep: ${fmtMeters(option.jeep_m)}</div>
      <div class="meta">Est. Travel: ${option.estimated_minutes} min | Transfers: 1</div>
    `);
    el.addEventListener("click", () => startApproachAlert(option.alight_stop));
    transferResults.appendChild(el);
    loadOverlay(option.first_route_id, "#075985");
    loadOverlay(option.second_route_id, "#b45309");
  }

  if (routeLayer.getLayers().length) {
    map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
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

  const resp = await fetch(
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
