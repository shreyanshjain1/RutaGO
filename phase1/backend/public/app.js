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

function getAuthToken() {
  return window.localStorage.getItem("rutago_auth_token") || "";
}

function getCurrentUser() {
  try {
    return JSON.parse(window.localStorage.getItem("rutago_user") || "null");
  } catch (_error) {
    return null;
  }
}

function setAuthSession(token, user) {
  window.localStorage.setItem("rutago_auth_token", token);
  window.localStorage.setItem("rutago_user", JSON.stringify(user));
}

function clearAuthSession() {
  window.localStorage.removeItem("rutago_auth_token");
  window.localStorage.removeItem("rutago_user");
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return fetch(apiUrl(path), { ...options, headers });
}

const elements = {
  splashScreen: $("splashScreen"),
  loginScreen: $("loginScreen"),
  appScreen: $("appScreen"),
  startAppBtn: $("startAppBtn"),
  loginForm: $("loginForm"),
  signupBtn: $("signupBtn"),
  nameInput: $("nameInput"),
  emailInput: $("emailInput"),
  passwordInput: $("passwordInput"),
  authMessage: $("authMessage"),
  userChip: $("userChip"),
  logoutBtn: $("logoutBtn"),
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
  favoritesList: $("favoritesList"),
  recentSearchesList: $("recentSearchesList"),
  feedbackForm: $("feedbackForm"),
  feedbackType: $("feedbackType"),
  feedbackRoute: $("feedbackRoute"),
  feedbackStop: $("feedbackStop"),
  feedbackMessage: $("feedbackMessage"),
  feedbackList: $("feedbackList"),
  dashboardMessage: $("dashboardMessage"),
  savedPlacesList: $("savedPlacesList"),
  savePlaceForm: $("savePlaceForm"),
  placeLabel: $("placeLabel"),
  placeType: $("placeType"),
  placeLat: $("placeLat"),
  placeLon: $("placeLon"),
  useOriginForPlaceBtn: $("useOriginForPlaceBtn"),
  useDestinationForPlaceBtn: $("useDestinationForPlaceBtn"),
  selectedItineraryCard: $("selectedItineraryCard"),
  routeTimelineList: $("routeTimelineList"),
  adminGate: $("adminGate"),
  adminSummary: $("adminSummary"),
  adminFeedbackList: $("adminFeedbackList"),
  adminRoutesList: $("adminRoutesList"),
  reloadAdminBtn: $("reloadAdminBtn"),
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
let lastSelectedRoute = null;
let deferredInstallPrompt = null;
let allStopsCache = [];
let dashboardCache = { favorites: [], recentSearches: [], feedback: [], savedPlaces: [] };
let lastSearchBody = null;

const routeColors = ["#f9d423", "#3b9a38", "#e64362", "#2e6bdc", "#ff8f1f", "#7b61ff"];

function switchScreen(screenName) {
  [elements.splashScreen, elements.loginScreen, elements.appScreen].forEach((screen) => screen.classList.remove("is-active"));
  if (screenName === "login") elements.loginScreen.classList.add("is-active");
  if (screenName === "app") {
    elements.appScreen.classList.add("is-active");
    setTimeout(() => {
      ensureMap();
      invalidateMapSafe();
    }, 150);
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
  if (["favoritesPanel", "feedbackPanel", "savedPlacesPanel"].includes(panelId)) refreshDashboard();
  if (panelId === "adminPanel") loadAdminCenter();
  setTimeout(invalidateMapSafe, 80);
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
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
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

function renderUserState() {
  const user = getCurrentUser();
  if (elements.userChip) elements.userChip.textContent = user ? `👤 ${user.name}` : "Guest";
}

function authMessage(message, tone = "") {
  if (!elements.authMessage) return;
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
}

async function handleAuth(mode) {
  const name = elements.nameInput.value.trim() || "RutaGO User";
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  if (!email || !password) {
    authMessage("Please enter email and password.", "error");
    return;
  }

  authMessage(mode === "register" ? "Creating account..." : "Logging in...");
  const resp = await apiFetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    authMessage(body.error || "Authentication failed.", "error");
    return;
  }
  setAuthSession(body.token, body.user);
  renderUserState();
  await refreshDashboard();
  switchScreen("app");
  setTimeout(() => map.invalidateSize(), 200);
}

function requireAuthUi() {
  if (!getAuthToken()) {
    setSummary("Please login first to save favorites, recent searches, and feedback.");
    return false;
  }
  return true;
}

async function refreshDashboard() {
  if (!getAuthToken()) {
    renderDashboardLists();
    return;
  }
  const resp = await apiFetch("/api/me");
  if (!resp.ok) {
    clearAuthSession();
    renderUserState();
    renderDashboardLists();
    return;
  }
  const body = await resp.json();
  if (body.user) setAuthSession(getAuthToken(), body.user);
  dashboardCache = {
    favorites: body.favorites || [],
    recentSearches: body.recentSearches || [],
    feedback: body.feedback || [],
    savedPlaces: body.savedPlaces || [],
  };
  renderUserState();
  renderDashboardLists();
}

function renderDashboardLists() {
  const user = getCurrentUser();
  if (elements.dashboardMessage) {
    elements.dashboardMessage.textContent = user
      ? `Signed in as ${user.name}. Your saved routes and reports sync to this local backend.`
      : "Login to save favorite routes, view recent searches, and send route issue reports.";
  }

  if (elements.favoritesList) {
    if (!dashboardCache.favorites.length) {
      elements.favoritesList.innerHTML = `<div class="message-card small">No saved favorites yet. Search a route and tap Save Favorite.</div>`;
    } else {
      elements.favoritesList.innerHTML = "";
      dashboardCache.favorites.forEach((item) => {
        const card = document.createElement("article");
        card.className = "stop-card favorite-card";
        card.innerHTML = `
          <div class="stop-card-title">⭐ ${item.title}</div>
          <div class="stop-card-meta">${item.board_stop_name || "Start"} → ${item.alight_stop_name || "End"} · ${item.estimated_minutes || "?"} min</div>
          <button class="mini-btn remove-favorite" data-id="${item.id}">Remove</button>
        `;
        elements.favoritesList.appendChild(card);
      });
      document.querySelectorAll(".remove-favorite").forEach((button) => {
        button.addEventListener("click", async () => {
          await apiFetch(`/api/users/me/favorites/${button.dataset.id}`, { method: "DELETE" });
          await refreshDashboard();
        });
      });
    }
  }

  if (elements.recentSearchesList) {
    if (!dashboardCache.recentSearches.length) {
      elements.recentSearchesList.innerHTML = `<div class="message-card small">No recent searches yet.</div>`;
    } else {
      elements.recentSearchesList.innerHTML = "";
      dashboardCache.recentSearches.forEach((item) => {
        const card = document.createElement("article");
        card.className = "stop-card";
        card.innerHTML = `
          <div class="stop-card-title">🧭 ${item.direct_count} direct · ${item.transfer_count} transfer</div>
          <div class="stop-card-meta">${item.origin} → ${item.destination}</div>
        `;
        card.addEventListener("click", () => {
          elements.originInput.value = item.origin;
          elements.destinationInput.value = item.destination;
          const origin = parseLatLng(item.origin);
          const destination = parseLatLng(item.destination);
          if (origin) setMarker("origin", origin.lat, origin.lng, false);
          if (destination) setMarker("destination", destination.lat, destination.lng, false);
          showPanel("plannerPanel");
          invalidateMapSafe();
        });
        elements.recentSearchesList.appendChild(card);
      });
    }
  }

  if (elements.savedPlacesList) {
    if (!dashboardCache.savedPlaces.length) {
      elements.savedPlacesList.innerHTML = `<div class="message-card small">No saved places yet. Save your dorm, home, school, or favorite pickup point.</div>`;
    } else {
      elements.savedPlacesList.innerHTML = "";
      dashboardCache.savedPlaces.forEach((place) => {
        const card = document.createElement("article");
        card.className = "stop-card saved-place-card";
        card.innerHTML = `
          <div class="stop-card-title">📍 ${place.label}</div>
          <div class="stop-card-meta">${place.type || "custom"} · ${place.lat},${place.lon}</div>
          <div class="card-actions compact-actions">
            <button class="mini-btn use-place-origin" data-lat="${place.lat}" data-lon="${place.lon}">Use Start</button>
            <button class="mini-btn use-place-destination" data-lat="${place.lat}" data-lon="${place.lon}">Use End</button>
            <button class="mini-btn remove-place" data-id="${place.id}">Remove</button>
          </div>
        `;
        elements.savedPlacesList.appendChild(card);
      });
      document.querySelectorAll(".use-place-origin").forEach((button) => {
        button.addEventListener("click", () => {
          const lat = Number(button.dataset.lat);
          const lon = Number(button.dataset.lon);
          elements.originInput.value = formatLatLng(lat, lon);
          setMarker("origin", lat, lon, true);
          showPanel("plannerPanel");
        });
      });
      document.querySelectorAll(".use-place-destination").forEach((button) => {
        button.addEventListener("click", () => {
          const lat = Number(button.dataset.lat);
          const lon = Number(button.dataset.lon);
          elements.destinationInput.value = formatLatLng(lat, lon);
          setMarker("destination", lat, lon, true);
          showPanel("plannerPanel");
        });
      });
      document.querySelectorAll(".remove-place").forEach((button) => {
        button.addEventListener("click", async () => {
          await apiFetch(`/api/users/me/saved-places/${button.dataset.id}`, { method: "DELETE" });
          await refreshDashboard();
        });
      });
    }
  }

  if (elements.feedbackList) {
    if (!dashboardCache.feedback.length) {
      elements.feedbackList.innerHTML = `<div class="message-card small">No feedback reports submitted yet.</div>`;
    } else {
      elements.feedbackList.innerHTML = "";
      dashboardCache.feedback.forEach((item) => {
        const card = document.createElement("article");
        card.className = "stop-card";
        card.innerHTML = `
          <div class="stop-card-title">${item.type} · ${item.status}</div>
          <div class="stop-card-meta">${item.message}</div>
        `;
        elements.feedbackList.appendChild(card);
      });
    }
  }
}

async function saveFavorite(routeData) {
  if (!requireAuthUi()) return;
  const resp = await apiFetch("/api/users/me/favorites", {
    method: "POST",
    body: JSON.stringify(routeData),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    setSummary(body.error || "Could not save favorite.");
    return;
  }
  setSummary("Route saved to Favorites.");
  await refreshDashboard();
}

async function savePlaceFromForm(event) {
  event.preventDefault();
  if (!requireAuthUi()) return;
  const lat = Number(elements.placeLat.value);
  const lon = Number(elements.placeLon.value);
  const resp = await apiFetch("/api/users/me/saved-places", {
    method: "POST",
    body: JSON.stringify({
      label: elements.placeLabel.value,
      type: elements.placeType.value,
      lat,
      lon,
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    setSummary(body.error || "Could not save place.");
    return;
  }
  elements.savePlaceForm.reset();
  setSummary("Place saved. You can reuse it from Saved Places.");
  await refreshDashboard();
  showPanel("savedPlacesPanel");
}

function fillPlaceCoordinates(source) {
  const value = source === "origin" ? elements.originInput.value : elements.destinationInput.value;
  const point = parseLatLng(value);
  if (!point) {
    setSummary(`Set a valid ${source} first.`);
    return;
  }
  elements.placeLat.value = point.lat.toFixed(6);
  elements.placeLon.value = point.lng.toFixed(6);
}

function buildItineraryHtml(option) {
  if (!option) return "Search a route to generate a step-by-step trip plan.";
  const isTransfer = option.type === "transfer";
  const title = isTransfer ? `${option.first_route_name} → ${option.second_route_name}` : option.route_name;
  const steps = isTransfer
    ? [
        `Walk to ${option.board_stop.stop_name}.`,
        `Ride ${option.first_route_name}.`,
        `Transfer at ${option.transfer_stop.stop_name}.`,
        `Ride ${option.second_route_name}.`,
        `Get off at ${option.alight_stop.stop_name}.`,
      ]
    : [
        `Walk to ${option.board_stop.stop_name}.`,
        `Ride ${option.route_name}.`,
        `Get off at ${option.alight_stop.stop_name}.`,
      ];
  return `
    <strong>🏆 Recommended: ${title}</strong>
    <div class="stop-card-meta">${option.estimated_minutes} min · ${fmtMeters(option.walking_m)} walk · ${fmtMeters(option.jeep_m)} ride · ${option.transfers} transfer(s)</div>
    <ol class="itinerary-list">${steps.map((step) => `<li>${step}</li>`).join("")}</ol>
    <div class="card-actions compact-actions">
      <button class="mini-btn" id="shareTripBtn" type="button">Copy Trip Summary</button>
      <button class="mini-btn" id="showTimelineBtn" type="button" data-route="${option.route_id || option.first_route_id}">Show Stops</button>
    </div>
  `;
}

function renderRecommendedItinerary(directs, transfers) {
  if (!elements.selectedItineraryCard) return;
  const combined = [...directs, ...transfers].sort((a, b) => (a.score || 9999) - (b.score || 9999));
  const best = combined[0];
  elements.selectedItineraryCard.innerHTML = buildItineraryHtml(best);
  const shareButton = $("shareTripBtn");
  if (shareButton && best) {
    shareButton.addEventListener("click", async () => {
      const title = best.type === "transfer" ? `${best.first_route_name} to ${best.second_route_name}` : best.route_name;
      const summary = `RutaGO trip: ${title}. Board at ${best.board_stop.stop_name}, get off at ${best.alight_stop.stop_name}. Estimated ${best.estimated_minutes} minutes.`;
      await navigator.clipboard?.writeText(summary).catch(() => null);
      setSummary("Trip summary copied.");
    });
  }
  const timelineButton = $("showTimelineBtn");
  if (timelineButton && best) {
    timelineButton.addEventListener("click", () => loadRouteTimeline(timelineButton.dataset.route));
  }
}

async function loadRouteTimeline(routeId) {
  if (!elements.routeTimelineList || !routeId) return;
  elements.routeTimelineList.innerHTML = `<div class="message-card small">Loading route stop timeline...</div>`;
  const resp = await apiFetch(`/api/routes/${encodeURIComponent(routeId)}/stops`);
  if (!resp.ok) {
    elements.routeTimelineList.innerHTML = `<div class="message-card small">Could not load route stops.</div>`;
    return;
  }
  const body = await resp.json();
  const stops = body.data || [];
  if (!stops.length) {
    elements.routeTimelineList.innerHTML = `<div class="message-card small">No ordered stops available for this route.</div>`;
    return;
  }
  elements.routeTimelineList.innerHTML = stops.slice(0, 18).map((stop) => `
    <article class="stop-card timeline-card">
      <div class="stop-card-title"><span class="timeline-number">${stop.sequence}</span> ${stop.stop_name}</div>
      <div class="stop-card-meta">${stop.stop_id}</div>
    </article>
  `).join("");
}

function createRouteCard({ title, board, alight, meta, tags, color, stop, routeId, favoritePayload }) {
  const card = document.createElement("article");
  card.className = "route-card";
  card.style.setProperty("--route-color", color);
  card.innerHTML = `
    <div class="route-card-title">${title}</div>
    <div class="route-card-line"><span>Start<br>${board}</span><span>→</span><span>End<br>${alight}</span></div>
    <div class="route-card-meta">${meta}</div>
    <div class="route-tag-row">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
    <div class="card-actions">
      <button class="mini-btn select-reminder-btn" type="button">Reminder</button>
      <button class="mini-btn save-favorite-btn" type="button">Save Favorite</button>
      <button class="mini-btn timeline-btn" type="button">Stops</button>
    </div>
  `;
  card.querySelector(".select-reminder-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    selectedReminderStop = stop;
    activeRouteId = routeId || activeRouteId;
    lastSelectedRoute = favoritePayload || null;
    renderSelectedReminder();
    showPanel("reminderPanel");
  });
  card.querySelector(".save-favorite-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    await saveFavorite(favoritePayload || { route_id: routeId, title, board_stop_name: board, alight_stop_name: alight });
  });
  card.querySelector(".timeline-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    await loadRouteTimeline(routeId);
    showPanel("routesPanel");
  });
  card.addEventListener("click", () => {
    selectedReminderStop = stop;
    activeRouteId = routeId || activeRouteId;
    lastSelectedRoute = favoritePayload || null;
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
  if (elements.selectedItineraryCard) elements.selectedItineraryCard.innerHTML = "Search a route to generate a step-by-step trip plan.";
  if (elements.routeTimelineList) elements.routeTimelineList.innerHTML = "";
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
  const resp = await apiFetch(`/api/routes/${encodeURIComponent(routeId)}/overlay`);
  if (!resp.ok) return;
  const body = await resp.json();
  if (!body.points || !body.points.length) return;
  const poly = L.polyline(
    body.points.map((p) => [p.lat, p.lon]),
    { color, weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round", dashArray: "8 6" }
  );
  poly.addTo(routeLayer);
}

async function recordRecentSearch(origin, destination, directs, transfers) {
  if (!getAuthToken()) return;
  await apiFetch("/api/users/me/recent-searches", {
    method: "POST",
    body: JSON.stringify({ origin, destination, direct_count: directs.length, transfer_count: transfers.length }),
  }).catch(() => {});
  await refreshDashboard();
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

  let body = null;
  try {
    const resp = await apiFetch(`/api/search?from=${encodeURIComponent(elements.originInput.value)}&to=${encodeURIComponent(elements.destinationInput.value)}`);
    if (!resp.ok) throw new Error("Search failed");
    body = await resp.json();
    lastSearchBody = body;
    window.localStorage.setItem("rutago_last_search", JSON.stringify(body));
  } catch (_error) {
    body = lastSearchBody || JSON.parse(window.localStorage.getItem("rutago_last_search") || "null");
    if (!body) {
      setSummary("Search failed. Check if the backend is running, then try again.");
      showPanel("routesPanel");
      return;
    }
    setSummary("Showing your last cached route result because the backend is unavailable.");
  }

  const directs = body.direct_options || [];
  const transfers = body.transfer_options || [];
  renderRecommendedItinerary(directs, transfers);
  activeRouteId = directs[0]?.route_id || transfers[0]?.first_route_id || transfers[0]?.second_route_id || null;
  await recordRecentSearch(elements.originInput.value, elements.destinationInput.value, directs, transfers);

  setSummary(`Found ${directs.length} direct route(s) and ${transfers.length} transfer option(s). Tap a card to add a stop reminder.`);

  if (!directs.length) {
    showEmpty(elements.directResults, "No direct jeepney route found for this pair.");
  } else {
    elements.directResults.innerHTML = "";
    directs.slice(0, 5).forEach((option, index) => {
      const color = routeColor(index);
      const favoritePayload = {
        route_id: option.route_id,
        title: option.route_name,
        route_name: option.route_name,
        board_stop_name: option.board_stop.stop_name,
        alight_stop_name: option.alight_stop.stop_name,
        estimated_minutes: option.estimated_minutes,
        transfers: 0,
      };
      elements.directResults.appendChild(createRouteCard({
        title: option.route_name,
        board: option.board_stop.stop_name,
        alight: option.alight_stop.stop_name,
        meta: `${fmtMeters(option.walking_m)} walk · ${fmtMeters(option.jeep_m)} ride · about ${option.estimated_minutes} min`,
        tags: ["Direct", "0 transfer", `${option.route_gap_stops ?? "?"} stops`],
        color,
        stop: option.alight_stop,
        routeId: option.route_id,
        favoritePayload,
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
      const favoritePayload = {
        route_id: option.first_route_id,
        title: `${option.first_route_name} → ${option.second_route_name}`,
        route_name: `${option.first_route_name} → ${option.second_route_name}`,
        board_stop_name: option.board_stop.stop_name,
        alight_stop_name: option.alight_stop.stop_name,
        estimated_minutes: option.estimated_minutes,
        transfers: 1,
      };
      elements.transferResults.appendChild(createRouteCard({
        title: `${option.first_route_name} → ${option.second_route_name}`,
        board: option.board_stop.stop_name,
        alight: option.alight_stop.stop_name,
        meta: `Transfer at ${option.transfer_stop.stop_name} · about ${option.estimated_minutes} min`,
        tags: ["Transfer", "1 transfer", `${fmtMeters(option.walking_m)} walk`],
        color,
        stop: option.alight_stop,
        routeId: option.first_route_id,
        favoritePayload,
      }));
      loadOverlay(option.first_route_id, color);
      loadOverlay(option.second_route_id, routeColor(index + 3));
    });
  }

  if (routeLayer.getLayers().length) {
    setTimeout(() => map.fitBounds(routeLayer.getBounds(), { padding: [26, 260] }), 250);
  }

  showPanel("routesPanel");
  if (activeRouteId) {
    await loadVehicleFeed(activeRouteId);
    await loadRouteTimeline(activeRouteId);
  }
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
  const resp = await apiFetch(`/api/vehicles${query}`);
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

  elements.vehicleSummary.textContent = routeId ? `Showing ${vehicles.length} synthetic vehicle snapshot(s) for the selected route.` : `Showing ${vehicles.length} synthetic vehicle snapshot(s).`;

  vehicles.forEach((vehicle, index) => {
    const color = routeColor(index);
    const card = createRouteCard({
      title: vehicle.route_name,
      board: vehicle.vehicle_code,
      alight: vehicle.next_stop,
      meta: `${vehicle.speed_kph.toFixed(1)} kph · heading ${vehicle.heading}° · ${vehicleBadgeTone(vehicle.last_seen_at)}`,
      tags: ["Live hook", new Date(vehicle.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
      color,
      stop: { stop_id: vehicle.next_stop, stop_name: vehicle.next_stop, stop_lat: vehicle.lat, stop_lon: vehicle.lon },
      routeId: vehicle.route_id,
      favoritePayload: { route_id: vehicle.route_id, title: vehicle.route_name, route_name: vehicle.route_name, alight_stop_name: vehicle.next_stop },
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

  const resp = await apiFetch(`/api/stops/nearest?lat=${from.lat}&lon=${from.lng}&radius=${NEAREST_STOP_RADIUS_METERS}`);
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

  if (nearestLayer.getLayers().length) map.fitBounds(nearestLayer.getBounds(), { padding: [30, 260] });
  showPanel("stopsPanel");
}

async function loadStopsCache() {
  if (allStopsCache.length) return allStopsCache;
  const resp = await apiFetch("/api/stops");
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
  const matches = stops.filter((stop) => [stop.stop_name, stop.stop_id].join(" ").toLowerCase().includes(query)).slice(0, 12);
  if (!matches.length) showEmpty(elements.stopSearchResults, "No matching stops found.");
  else matches.forEach((stop) => elements.stopSearchResults.appendChild(createStopCard(stop, "Search result")));
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
      userMarker = L.circleMarker([lat, lng], { radius: 9, color: "#111", weight: 3, fillColor: "#4da3ff", fillOpacity: 0.9 }).bindPopup("You are here").addTo(map);
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
  showNotificationBanner("Reminder added", `RutaGO will alert you near ${selectedReminderStop.stop_name}. Keep this app open while riding.`, "info");

  if (!navigator.geolocation) {
    showNotificationBanner("GPS unavailable", "Your browser does not support location tracking.", "warning");
    return;
  }

  if (destinationWatchId) navigator.geolocation.clearWatch(destinationWatchId);
  destinationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const d = haversineMeters(position.coords.latitude, position.coords.longitude, selectedReminderStop.stop_lat, selectedReminderStop.stop_lon);
      elements.reminderStatus.textContent = `${fmtMeters(d)} away`;
      elements.selectedReminderCard.innerHTML = `<strong>${selectedReminderStop.stop_name}</strong><br>${fmtMeters(d)} away from your reminder stop.`;
      if (d <= REMINDER_DISTANCE_METERS) {
        const title = "Reminder!";
        const body = "You are now near your added stop. You may ask the driver and go down.";
        if (typeof Notification !== "undefined" && permission === "granted") new Notification(title, { body, icon: "./icons/rutago-icon.svg" });
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
  lastSelectedRoute = null;
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
    elements.healthCard.innerHTML = `<strong>Backend online</strong><br>Data source: ${body.data_source}<br>Routes: ${body.routes} · Stops: ${body.stops}<br>Trips: ${body.trips} · Stop times: ${body.stop_times}`;
  } catch (_error) {
    setNetworkStatus("Offline", "offline");
    elements.healthCard.innerHTML = `<strong>Backend offline</strong><br>Run the Express backend and reload the app.`;
  }
}

async function submitFeedback(event) {
  event.preventDefault();
  if (!requireAuthUi()) return;
  const resp = await apiFetch("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      type: elements.feedbackType.value,
      route_id: elements.feedbackRoute.value.trim(),
      stop_id: elements.feedbackStop.value.trim(),
      message: elements.feedbackMessage.value.trim(),
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    setSummary(body.error || "Could not submit feedback.");
    return;
  }
  elements.feedbackMessage.value = "";
  setSummary("Feedback submitted. Thank you for improving RutaGO.");
  await refreshDashboard();
}

function invalidateMapSafe() {
  if (!map) return;
  requestAnimationFrame(() => {
    map.invalidateSize({ pan: false });
  });
}

function ensureMap() {
  if (map) {
    invalidateMapSafe();
    return map;
  }
  return initMap();
}

function showMapLoading(message) {
  const shell = document.querySelector(".map-shell");
  if (!shell) return;
  let card = document.getElementById("mapLoadingCard");
  if (!card) {
    card = document.createElement("div");
    card.id = "mapLoadingCard";
    card.className = "map-loading-card";
    shell.appendChild(card);
  }
  card.textContent = message;
  card.hidden = false;
}

function hideMapLoading() {
  const card = document.getElementById("mapLoadingCard");
  if (card) card.hidden = true;
}


async function loadAdminCenter() {
  if (!elements.adminGate || !elements.adminSummary || !elements.adminFeedbackList || !elements.adminRoutesList) return;

  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    elements.adminGate.innerHTML = "Admin access requires a signed-in admin account. Add your email to <code>ADMIN_EMAILS</code> in <code>.env</code>, restart the backend, then create/login with that email.";
    elements.adminSummary.innerHTML = "";
    showEmpty(elements.adminFeedbackList, "No admin data loaded.");
    showEmpty(elements.adminRoutesList, "No route snapshot loaded.");
    return;
  }

  elements.adminGate.textContent = `Signed in as admin: ${user.email}`;
  elements.adminSummary.innerHTML = "";
  elements.adminFeedbackList.innerHTML = "";
  elements.adminRoutesList.innerHTML = "";

  const [summaryResp, feedbackResp, routesResp] = await Promise.all([
    apiFetch("/api/admin/summary"),
    apiFetch("/api/admin/feedback"),
    apiFetch("/api/admin/routes-summary"),
  ]);

  if (!summaryResp.ok || !feedbackResp.ok || !routesResp.ok) {
    elements.adminGate.textContent = "Admin data could not be loaded. Check your account role and backend logs.";
    return;
  }

  const summary = await summaryResp.json();
  const feedback = await feedbackResp.json();
  const routeSnapshot = await routesResp.json();
  const stats = [
    [summary.app.users, "Users"],
    [summary.app.feedback_open, "Open reports"],
    [summary.transit.routes, "GTFS routes"],
    [summary.transit.stops, "GTFS stops"],
  ];
  elements.adminSummary.innerHTML = stats.map(([value, label]) => `<div class="admin-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

  if (!feedback.data.length) {
    showEmpty(elements.adminFeedbackList, "No feedback reports yet.");
  } else {
    feedback.data.slice(0, 12).forEach((item) => {
      const card = document.createElement("article");
      card.className = "stop-card";
      card.innerHTML = `
        <div class="stop-card-title">${item.type || "general"} · ${item.status}</div>
        <div class="stop-card-meta">${item.message}</div>
        <div class="stop-card-meta">${item.user_name} ${item.route_id ? `· Route ${item.route_id}` : ""} ${item.stop_id ? `· Stop ${item.stop_id}` : ""}</div>
        <div class="admin-actions">
          <button class="mini-btn admin-status" data-id="${item.id}" data-status="reviewing">Reviewing</button>
          <button class="mini-btn admin-status" data-id="${item.id}" data-status="resolved">Resolved</button>
          <button class="mini-btn admin-status" data-id="${item.id}" data-status="dismissed">Dismiss</button>
        </div>
      `;
      elements.adminFeedbackList.appendChild(card);
    });
  }

  routeSnapshot.data.slice(0, 12).forEach((route) => {
    const card = document.createElement("article");
    card.className = "route-card";
    card.style.setProperty("--route-color", "#ffbd4a");
    card.innerHTML = `
      <div class="route-card-title">${route.route_short_name || route.route_id}</div>
      <div class="route-card-meta">${route.route_long_name || "No route name"}</div>
      <div class="route-card-line"><span>${route.first_stop || "Start"}</span><span>→</span><span>${route.last_stop || "End"}</span></div>
      <div class="route-tag-row"><span class="status-pill">${route.stop_count} stops</span></div>
    `;
    elements.adminRoutesList.appendChild(card);
  });

  document.querySelectorAll(".admin-status").forEach((button) => {
    button.addEventListener("click", async () => {
      await apiFetch(`/api/admin/feedback/${button.dataset.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.status }),
      });
      await loadAdminCenter();
    });
  });
}

function initMap() {
  const mapElement = $("map");
  if (!mapElement) return null;

  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    inertia: true,
    maxBoundsViscosity: 0.6,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 11,
    attribution: "© OpenStreetMap contributors",
    crossOrigin: true,
    updateWhenIdle: true,
    keepBuffer: 4,
  }).addTo(map);

  showMapLoading("Loading map tiles…");
  tileLayer.on("load", hideMapLoading);
  tileLayer.on("tileerror", () => showMapLoading("Map tiles are having trouble loading. Check internet connection, then reload."));

  nearestLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  vehicleLayer = L.layerGroup().addTo(map);

  const defaultOrigin = CONFIG.defaultOrigin || [14.6535, 121.049];
  const defaultDestination = CONFIG.defaultDestination || [14.6547, 121.0648];
  setMarker("origin", defaultOrigin[0], defaultOrigin[1], false);
  setMarker("destination", defaultDestination[0], defaultDestination[1], false);
  map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });

  map.on("click", (e) => {
    if (!mapClickMode) return;
    setMarker(mapClickMode, e.latlng.lat, e.latlng.lng, false);
    setMapMode(`${mapClickMode === "origin" ? "Start" : "End"} selected. You can find routes now.`);
    mapClickMode = null;
    invalidateMapSafe();
  });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => invalidateMapSafe());
    observer.observe(mapElement);
    const app = $("appScreen");
    if (app) observer.observe(app);
  }

  window.addEventListener("resize", invalidateMapSafe);
  window.addEventListener("orientationchange", () => setTimeout(invalidateMapSafe, 250));

  setTimeout(invalidateMapSafe, 100);
  setTimeout(invalidateMapSafe, 500);
  return map;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (window.localStorage.getItem("rutago_install_dismissed") !== "1") elements.installToast.hidden = false;
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
  elements.signupBtn.addEventListener("click", () => handleAuth("register"));
  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuth("login");
  });
  elements.logoutBtn.addEventListener("click", () => {
    clearAuthSession();
    dashboardCache = { favorites: [], recentSearches: [], feedback: [], savedPlaces: [] };
    renderUserState();
    renderDashboardLists();
    switchScreen("login");
  });

  elements.menuBtn.addEventListener("click", openDrawer);
  elements.closeDrawerBtn.addEventListener("click", closeDrawer);
  elements.drawerOverlay.addEventListener("click", closeDrawer);
  document.querySelectorAll(".drawer-link").forEach((button) => button.addEventListener("click", () => showPanel(button.dataset.panel)));

  elements.locateBtn.addEventListener("click", locateUser);
  elements.centerUpBtn.addEventListener("click", () => {
    ensureMap();
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    invalidateMapSafe();
  });
  elements.setOriginBtn.addEventListener("click", () => {
    ensureMap();
    mapClickMode = "origin";
    setMapMode("Tap the map to set Start");
  });
  elements.setDestinationBtn.addEventListener("click", () => {
    ensureMap();
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
  elements.feedbackForm.addEventListener("submit", submitFeedback);
  if (elements.savePlaceForm) elements.savePlaceForm.addEventListener("submit", savePlaceFromForm);
  if (elements.useOriginForPlaceBtn) elements.useOriginForPlaceBtn.addEventListener("click", () => fillPlaceCoordinates("origin"));
  if (elements.useDestinationForPlaceBtn) elements.useDestinationForPlaceBtn.addEventListener("click", () => fillPlaceCoordinates("destination"));
  if (elements.reloadAdminBtn) elements.reloadAdminBtn.addEventListener("click", loadAdminCenter);
}


bindEvents();
registerServiceWorker();
setupInstallPrompt();
loadHealth();
renderUserState();
refreshDashboard();
renderSelectedReminder();
setSummary("Welcome to RutaGO. Set your route and tap Find Routes.");
setMapMode("Tap Origin or Destination below");
