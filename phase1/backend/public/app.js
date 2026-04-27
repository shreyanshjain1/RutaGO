const CONFIG = window.RUTAGO_CONFIG || {};
const DEFAULT_CENTER = CONFIG.defaultCenter || [14.654, 121.064];
const DEFAULT_ZOOM = CONFIG.defaultZoom || 15;
const REMINDER_DISTANCE_METERS = Number(CONFIG.reminderDistanceMeters || 150);
const NEAREST_STOP_RADIUS_METERS = Number(CONFIG.nearestStopRadiusMeters || 300);
const configuredApiBase = CONFIG.apiBaseUrl || "";
const storedApiBase = window.localStorage.getItem("rutago_api_base") || "";
const API_BASE_URL = (configuredApiBase || storedApiBase).replace(/\/+$/, "");

function $(id) {
  return document.getElementById(id);
}

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

async function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}

const elements = {
  splashScreen: $("splashScreen"),
  loginScreen: $("loginScreen"),
  appScreen: $("appScreen"),
  startAppBtn: $("startAppBtn"),
  loginForm: $("loginForm"),
  signupBtn: $("signupBtn"),
  nameInput: $("nameInput"),
  menuBtn: $("menuBtn"),
  closeDrawerBtn: $("closeDrawerBtn"),
  drawer: $("drawer"),
  drawerOverlay: $("drawerOverlay"),
  locateBtn: $("locateBtn"),
  centerUpBtn: $("centerUpBtn"),
  mapModeChip: $("mapModeChip"),
  originInput: $("originInput"),
  destinationInput: $("destinationInput"),
  setOriginBtn: $("setOriginBtn"),
  setDestinationBtn: $("setDestinationBtn"),
  nearestBtn: $("nearestBtn"),
  refreshStopsBtn: $("refreshStopsBtn"),
  searchBtn: $("searchBtn"),
  stopSearchInput: $("stopSearchInput"),
  searchStopBtn: $("searchStopBtn"),
  directResults: $("directResults"),
  transferResults: $("transferResults"),
  nearestResults: $("nearestResults"),
  stopSearchResults: $("stopSearchResults"),
  vehicleResults: $("vehicleResults"),
  vehicleSummary: $("vehicleSummary"),
  vehiclesBtn: $("vehiclesBtn"),
  summary: $("summary"),
  notificationBanner: $("notificationBanner"),
  selectedReminderCard: $("selectedReminderCard"),
  addReminderBtn: $("addReminderBtn"),
  endRouteBtn: $("endRouteBtn"),
  reminderStatus: $("reminderStatus"),
  healthCard: $("healthCard"),
  reloadHealthBtn: $("reloadHealthBtn"),
  networkStatus: $("networkStatus"),
  installToast: $("installToast"),
  installBtn: $("installBtn"),
  dismissInstallBtn: $("dismissInstallBtn"),
};

let map;
let originMarker = null;
let destinationMarker = null;
let userMarker = null;
let nearestLayer = null;
let routeLayer = null;
let vehicleLayer = null;
let mapClickMode = null;
let destinationWatchId = null;
let selectedReminderStop = null;
let activeRouteId = null;
let deferredInstallPrompt = null;
let allStopsCache = [];

const routeColors = ["#f9d423", "#3b9a38", "#e64362", "#2e6bdc", "#ff8f1f", "#7b61ff"];

function switchScreen(screenName) {
  [elements.splashScreen, elements.loginScreen, elements.appScreen].forEach((screen) => {
    screen.classList.remove("is-active");
  });
  if (screenName === "login") elements.loginScreen.classList.add("is-active");
  if (screenName === "app") {
    elements.appScreen.classList.add("is-active");
    setTimeout(() => map && map.invalidateSize(), 150);
  }
  if (screenName === "splash") elements.splashScreen.classList.add("is-active");
}

function showPanel(panelId) {
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("is-active"));
  document.querySelectorAll(".drawer-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.panel === panelId);
  });
  const panel = $(panelId);
  if (panel) panel.classList.add("is-active");
  closeDrawer();
}

function openDrawer() {
  elements.drawer.classList.add("is-active");
  elements.drawerOverlay.classList.add("is-active");
  elements.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  elements.drawer.classList.remove("is-active");
  elements.drawerOverlay.classList.remove("is-active");
  elements.drawer.setAttribute("aria-hidden", "true");
}

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0].trim());
  const lng = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function formatLatLng(lat, lng) {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

function fmtMeters(m) {
  const meters = Number(m || 0);
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
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

function setSummary(message) {
  elements.summary.textContent = message;
}

function setMapMode(message) {
  elements.mapModeChip.textContent = message;
}

function setNetworkStatus(text, type = "") {
  elements.networkStatus.textContent = text;
  elements.networkStatus.dataset.type = type;
}

function showNotificationBanner(title, body, tone = "warning") {
  elements.notificationBanner.hidden = false;
  elements.notificationBanner.className = `reminder-card ${tone}`;
  elements.notificationBanner.innerHTML = `<strong>${title}</strong><br>${body}`;
}

function clearNotificationBanner() {
  elements.notificationBanner.hidden = true;
  elements.notificationBanner.className = "reminder-card";
  elements.notificationBanner.textContent = "";
}

function routeColor(index) {
  return routeColors[index % routeColors.length];
}

function markerIcon(label, color) {
  return L.divIcon({
    className: "rutago-marker-wrap",
    html: `<div style="width:34px;height:34px;border:3px solid #111;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};display:grid;place-items:center;box-shadow:3px 4px 0 rgba(0,0,0,.22)"><span style="transform:rotate(45deg);font-weight:900;font-size:12px;color:#111">${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

function setMarker(kind, lat, lng, pan = true) {
  const icon = kind === "origin" ? markerIcon("S", "#75dc70") : markerIcon("E", "#ff665c");
  const marker = L.marker([lat, lng], { icon });
  marker.bindPopup(kind === "origin" ? "Start / Origin" : "End / Destination");
  marker.addTo(map).openPopup();

  if (kind === "origin") {
    if (originMarker) map.removeLayer(originMarker);
    originMarker = marker;
    elements.originInput.value = formatLatLng(lat, lng);
  } else {
    if (destinationMarker) map.removeLayer(destinationMarker);
    destinationMarker = marker;
    elements.destinationInput.value = formatLatLng(lat, lng);
  }

  if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 15));
}

function createRouteCard({ title, board, alight, meta, tags, color, stop, routeId }) {
  const card = document.createElement("article");
  card.className = "route-card";
  card.style.setProperty("--route-color", color);
  card.innerHTML = `
    <div class="route-card-title">${title}</div>
    <div class="route-card-line"><span>Start<br>${board}</span><span>→</span><span>End<br>${alight}</span></div>
    <div class="route-card-meta">${meta}</div>
    <div class="route-tag-row">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
  `;
  card.addEventListener("click", () => {
    selectedReminderStop = stop;
    activeRouteId = routeId || activeRouteId;
    renderSelectedReminder();
    showPanel("reminderPanel");
  });
  return card;
}

function createStopCard(stop, extra = "") {
  const card = document.createElement("article");
  card.className = "stop-card";
  card.style.setProperty("--route-color", "#ffcf42");
  card.innerHTML = `
    <div class="stop-card-title">${stop.stop_name || "Unnamed Stop"}</div>
    <div class="stop-card-meta">${stop.stop_id || "No stop ID"}${extra ? ` · ${extra}` : ""}</div>
  `;
  card.addEventListener("click", () => {
    selectedReminderStop = stop;
    renderSelectedReminder();
    if (stop.stop_lat != null && stop.stop_lon != null) {
      map.setView([stop.stop_lat, stop.stop_lon], 17);
      L.popup().setLatLng([stop.stop_lat, stop.stop_lon]).setContent(stop.stop_name).openOn(map);
    }
    showPanel("reminderPanel");
  });
  return card;
}

function showEmpty(container, text) {
  container.innerHTML = `<div class="message-card small">${text}</div>`;
}

function clearRouteResults() {
  elements.directResults.innerHTML = "";
  elements.transferResults.innerHTML = "";
  elements.vehicleResults.innerHTML = "";
}

function renderSelectedReminder() {
  if (!selectedReminderStop) {
    elements.selectedReminderCard.textContent = "Select a route card or stop, then tap Add Stop Reminder.";
    elements.reminderStatus.textContent = "No reminder";
    return;
  }

  elements.selectedReminderCard.innerHTML = `
    <strong>Selected stop:</strong> ${selectedReminderStop.stop_name}<br>
    <span>RutaGO will alert you when you are within ${REMINDER_DISTANCE_METERS}m of this stop.</span>
  `;
  elements.reminderStatus.textContent = "Ready";
}

async function loadOverlay(routeId, color) {
  if (!routeId) return;
  const resp = await apiFetch(`/mvp/routes/${encodeURIComponent(routeId)}/overlay`);
  if (!resp.ok) return;
  const body = await resp.json();
  if (!body.points || !body.points.length) return;

  const poly = L.polyline(
    body.points.map((p) => [p.lat, p.lon]),
    { color, weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round", dashArray: "8 6" }
  );
  poly.addTo(routeLayer);
}

async function searchRoutes() {
  clearRouteResults();
  routeLayer.clearLayers();
  vehicleLayer.clearLayers();
  clearNotificationBanner();

  const from = parseLatLng(elements.originInput.value);
  const to = parseLatLng(elements.destinationInput.value);
  if (!from || !to) {
    setSummary("Please set valid Start and End coordinates first.");
    return;
  }

  setSummary("Searching jeepney routes and transfer suggestions...");
  showPanel("plannerPanel");

  const resp = await apiFetch(
    `/mvp/search?from=${encodeURIComponent(elements.originInput.value)}&to=${encodeURIComponent(elements.destinationInput.value)}`
  );

  if (!resp.ok) {
    setSummary("Search failed. Check if the backend is running, then try again.");
    showPanel("routesPanel");
    return;
  }

  const body = await resp.json();
  const directs = body.direct_options || [];
  const transfers = body.transfer_options || [];
  activeRouteId = directs[0]?.route_id || transfers[0]?.first_route_id || transfers[0]?.second_route_id || null;

  setSummary(`Found ${directs.length} direct route(s) and ${transfers.length} transfer option(s). Tap a card to add a stop reminder.`);

  if (!directs.length) {
    showEmpty(elements.directResults, "No direct jeepney route found for this pair.");
  } else {
    elements.directResults.innerHTML = "";
    directs.slice(0, 5).forEach((option, index) => {
      const color = routeColor(index);
      elements.directResults.appendChild(createRouteCard({
        title: option.route_name,
        board: option.board_stop.stop_name,
        alight: option.alight_stop.stop_name,
        meta: `${fmtMeters(option.walking_m)} walk · ${fmtMeters(option.jeep_m)} ride · about ${option.estimated_minutes} min`,
        tags: ["Direct", "0 transfer", `${option.route_gap_stops ?? "?"} stops`],
        color,
        stop: option.alight_stop,
        routeId: option.route_id,
      }));
      loadOverlay(option.route_id, color);
    });
  }

  if (!transfers.length) {
    showEmpty(elements.transferResults, "No transfer suggestion found for this pair.");
  } else {
    elements.transferResults.innerHTML = "";
    transfers.slice(0, 5).forEach((option, index) => {
      const color = routeColor(index + 2);
      elements.transferResults.appendChild(createRouteCard({
        title: `${option.first_route_name} → ${option.second_route_name}`,
        board: option.board_stop.stop_name,
        alight: option.alight_stop.stop_name,
        meta: `Transfer at ${option.transfer_stop.stop_name} · about ${option.estimated_minutes} min`,
        tags: ["Transfer", "1 transfer", `${fmtMeters(option.walking_m)} walk`],
        color,
        stop: option.alight_stop,
        routeId: option.first_route_id,
      }));
      loadOverlay(option.first_route_id, color);
      loadOverlay(option.second_route_id, routeColor(index + 3));
    });
  }

  if (routeLayer.getLayers().length) {
    setTimeout(() => map.fitBounds(routeLayer.getBounds(), { padding: [26, 260] }), 250);
  }

  showPanel("routesPanel");
  if (activeRouteId) await loadVehicleFeed(activeRouteId);
}

function vehicleBadgeTone(lastSeenAt) {
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs < 120000) return "Active";
  if (ageMs < 300000) return "Recent";
  return "Stale";
}

async function loadVehicleFeed(routeId = null) {
  vehicleLayer.clearLayers();
  elements.vehicleResults.innerHTML = "";

  const query = routeId ? `?route_id=${encodeURIComponent(routeId)}&limit=3` : "?limit=8";
  const resp = await apiFetch(`/mvp/vehicles${query}`);
  if (!resp.ok) {
    elements.vehicleSummary.textContent = "Vehicle feed is unavailable right now.";
    showEmpty(elements.vehicleResults, "No vehicle snapshots available.");
    return;
  }

  const body = await resp.json();
  const vehicles = body.data || [];
  if (!vehicles.length) {
    elements.vehicleSummary.textContent = "No active vehicle snapshots were returned.";
    showEmpty(elements.vehicleResults, "No vehicle snapshots available.");
    return;
  }

  elements.vehicleSummary.textContent = routeId
    ? `Showing ${vehicles.length} synthetic vehicle snapshot(s) for the selected route.`
    : `Showing ${vehicles.length} synthetic vehicle snapshot(s).`;

  vehicles.forEach((vehicle, index) => {
    const color = routeColor(index);
    const card = createRouteCard({
      title: vehicle.route_name,
      board: vehicle.vehicle_code,
      alight: vehicle.next_stop,
      meta: `${vehicle.speed_kph.toFixed(1)} kph · heading ${vehicle.heading}° · ${vehicleBadgeTone(vehicle.last_seen_at)}`,
      tags: ["Live hook", new Date(vehicle.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
      color,
      stop: {
        stop_id: vehicle.next_stop,
        stop_name: vehicle.next_stop,
        stop_lat: vehicle.lat,
        stop_lon: vehicle.lon,
      },
      routeId: vehicle.route_id,
    });
    elements.vehicleResults.appendChild(card);

    L.circleMarker([vehicle.lat, vehicle.lon], {
      radius: 8,
      color,
      weight: 3,
      fillColor: color,
      fillOpacity: 0.92,
    }).bindPopup(`${vehicle.route_name}<br>${vehicle.vehicle_code}<br>${vehicle.next_stop}`).addTo(vehicleLayer);
  });
}

async function loadNearestStops() {
  nearestLayer.clearLayers();
  elements.nearestResults.innerHTML = "";
  const from = parseLatLng(elements.originInput.value);
  if (!from) {
    setSummary("Set your Start location first to find nearest stops.");
    showPanel("plannerPanel");
    return;
  }

  const resp = await apiFetch(`/mvp/stops/nearest?lat=${from.lat}&lon=${from.lng}&radius=${NEAREST_STOP_RADIUS_METERS}`);
  if (!resp.ok) {
    setSummary("Nearest stop lookup failed.");
    showPanel("stopsPanel");
    return;
  }

  const body = await resp.json();
  const items = body.data || [];
  setSummary(`Found ${items.length} stop(s) within ${NEAREST_STOP_RADIUS_METERS}m.`);

  if (!items.length) {
    showEmpty(elements.nearestResults, `No stop found within ${NEAREST_STOP_RADIUS_METERS}m.`);
    showPanel("stopsPanel");
    return;
  }

  items.forEach((stop) => {
    elements.nearestResults.appendChild(createStopCard(stop, `${fmtMeters(stop.distance_m)} away`));
    L.circleMarker([stop.stop_lat, stop.stop_lon], {
      radius: 6,
      color: "#111",
      weight: 2,
      fillColor: "#ffcf42",
      fillOpacity: 0.95,
    }).bindPopup(`${stop.stop_name}<br>${fmtMeters(stop.distance_m)}`).addTo(nearestLayer);
  });

  if (nearestLayer.getLayers().length) {
    map.fitBounds(nearestLayer.getBounds(), { padding: [30, 260] });
  }
  showPanel("stopsPanel");
}

async function loadStopsCache() {
  if (allStopsCache.length) return allStopsCache;
  const resp = await apiFetch("/stops");
  if (!resp.ok) return [];
  const body = await resp.json();
  allStopsCache = body.data || [];
  return allStopsCache;
}

async function searchStops() {
  const query = elements.stopSearchInput.value.trim().toLowerCase();
  elements.stopSearchResults.innerHTML = "";
  if (!query) {
    showEmpty(elements.stopSearchResults, "Type a stop or place name first.");
    showPanel("stopsPanel");
    return;
  }

  const stops = await loadStopsCache();
  const matches = stops
    .filter((stop) => [stop.stop_name, stop.stop_id].join(" ").toLowerCase().includes(query))
    .slice(0, 12);

  if (!matches.length) {
    showEmpty(elements.stopSearchResults, "No matching stops found.");
  } else {
    matches.forEach((stop) => elements.stopSearchResults.appendChild(createStopCard(stop, "Search result")));
  }

  showPanel("stopsPanel");
}

function locateUser() {
  if (!navigator.geolocation) {
    setSummary("Geolocation is not available in this browser.");
    return;
  }

  setSummary("Requesting GPS location...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setMarker("origin", lat, lng);
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#111",
        weight: 3,
        fillColor: "#4da3ff",
        fillOpacity: 0.9,
      }).bindPopup("You are here").addTo(map);
      map.setView([lat, lng], 16);
      setSummary("Current location loaded into Start.");
    },
    () => setSummary("Could not access your location. You can still tap the map to set Start."),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

function requestNotificationPermission() {
  if (typeof Notification === "undefined") return Promise.resolve("unsupported");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  if (Notification.permission === "denied") return Promise.resolve("denied");
  return Notification.requestPermission();
}

async function startApproachAlert() {
  if (!selectedReminderStop || selectedReminderStop.stop_lat == null || selectedReminderStop.stop_lon == null) {
    elements.selectedReminderCard.textContent = "Please select a valid route card or stop first.";
    return;
  }

  const permission = await requestNotificationPermission();
  elements.reminderStatus.textContent = "Watching GPS";
  showNotificationBanner(
    "Reminder added",
    `RutaGO will alert you near ${selectedReminderStop.stop_name}. Keep this app open while riding.`,
    "info"
  );

  if (!navigator.geolocation) {
    showNotificationBanner("GPS unavailable", "Your browser does not support location tracking.", "warning");
    return;
  }

  if (destinationWatchId) navigator.geolocation.clearWatch(destinationWatchId);

  destinationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const d = haversineMeters(
        position.coords.latitude,
        position.coords.longitude,
        selectedReminderStop.stop_lat,
        selectedReminderStop.stop_lon
      );
      elements.reminderStatus.textContent = `${fmtMeters(d)} away`;
      elements.selectedReminderCard.innerHTML = `<strong>${selectedReminderStop.stop_name}</strong><br>${fmtMeters(d)} away from your reminder stop.`;

      if (d <= REMINDER_DISTANCE_METERS) {
        const title = "Reminder!";
        const body = "You are now near your added stop. You may ask the driver and go down.";
        if (typeof Notification !== "undefined" && permission === "granted") {
          new Notification(title, { body, icon: "./icons/rutago-icon.svg" });
        }
        showNotificationBanner(title, body, "success");
        elements.reminderStatus.textContent = "Arriving";
        if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
        navigator.geolocation.clearWatch(destinationWatchId);
        destinationWatchId = null;
      }
    },
    () => showNotificationBanner("GPS issue", "RutaGO could not update your location. Please check location permissions.", "warning"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function endRoute() {
  if (destinationWatchId) navigator.geolocation.clearWatch(destinationWatchId);
  destinationWatchId = null;
  selectedReminderStop = null;
  clearNotificationBanner();
  renderSelectedReminder();
  elements.reminderStatus.textContent = "Ended";
  setSummary("Route ended. You can search for a new route anytime.");
  showPanel("plannerPanel");
}

async function loadHealth() {
  try {
    const resp = await apiFetch("/health");
    if (!resp.ok) throw new Error("Health endpoint unavailable");
    const body = await resp.json();
    setNetworkStatus("Online", "online");
    elements.healthCard.innerHTML = `
      <strong>Backend online</strong><br>
      Data source: ${body.data_source}<br>
      Routes: ${body.routes} · Stops: ${body.stops}<br>
      Trips: ${body.trips} · Stop times: ${body.stop_times}
    `;
  } catch (error) {
    setNetworkStatus("Offline", "offline");
    elements.healthCard.innerHTML = `<strong>Backend offline</strong><br>Run the Express backend and reload the app.`;
  }
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  nearestLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  vehicleLayer = L.layerGroup().addTo(map);

  setMarker("origin", 14.6535, 121.049, false);
  setMarker("destination", 14.5995, 120.984, false);

  map.on("click", (e) => {
    if (!mapClickMode) return;
    setMarker(mapClickMode, e.latlng.lat, e.latlng.lng, false);
    setMapMode(`${mapClickMode === "origin" ? "Start" : "End"} selected. You can find routes now.`);
    mapClickMode = null;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (window.localStorage.getItem("rutago_install_dismissed") !== "1") {
      elements.installToast.hidden = false;
    }
  });

  elements.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installToast.hidden = true;
  });

  elements.dismissInstallBtn.addEventListener("click", () => {
    window.localStorage.setItem("rutago_install_dismissed", "1");
    elements.installToast.hidden = true;
  });
}

function bindEvents() {
  elements.startAppBtn.addEventListener("click", () => switchScreen("login"));
  elements.signupBtn.addEventListener("click", () => {
    elements.nameInput.value = elements.nameInput.value || "RutaGO User";
    switchScreen("app");
  });
  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    switchScreen("app");
    setTimeout(() => map.invalidateSize(), 200);
  });

  elements.menuBtn.addEventListener("click", openDrawer);
  elements.closeDrawerBtn.addEventListener("click", closeDrawer);
  elements.drawerOverlay.addEventListener("click", closeDrawer);
  document.querySelectorAll(".drawer-link").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.panel));
  });

  elements.locateBtn.addEventListener("click", locateUser);
  elements.centerUpBtn.addEventListener("click", () => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM));
  elements.setOriginBtn.addEventListener("click", () => {
    mapClickMode = "origin";
    setMapMode("Tap the map to set Start");
  });
  elements.setDestinationBtn.addEventListener("click", () => {
    mapClickMode = "destination";
    setMapMode("Tap the map to set End");
  });
  elements.searchBtn.addEventListener("click", searchRoutes);
  elements.nearestBtn.addEventListener("click", loadNearestStops);
  elements.refreshStopsBtn.addEventListener("click", loadNearestStops);
  elements.searchStopBtn.addEventListener("click", searchStops);
  elements.stopSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchStops();
  });
  elements.vehiclesBtn.addEventListener("click", () => loadVehicleFeed(activeRouteId));
  elements.addReminderBtn.addEventListener("click", startApproachAlert);
  elements.endRouteBtn.addEventListener("click", endRoute);
  elements.reloadHealthBtn.addEventListener("click", loadHealth);
}

initMap();
bindEvents();
registerServiceWorker();
setupInstallPrompt();
loadHealth();
renderSelectedReminder();
setSummary("Welcome to RutaGO. Set your route and tap Find Routes.");
setMapMode("Tap Origin or Destination below");
