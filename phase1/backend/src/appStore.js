const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.resolve(__dirname, "../data");
const storeFile = path.join(dataDir, "app-store.json");
const sessionSecret = process.env.SESSION_SECRET || "rutago-local-dev-secret-change-me";
const adminEmails = String(process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  return adminEmails.includes(normalizeEmail(email));
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(
      storeFile,
      JSON.stringify({ users: [], favorites: [], recentSearches: [], feedback: [], savedPlaces: [] }, null, 2)
    );
  }
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile, "utf8"));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      savedPlaces: Array.isArray(parsed.savedPlaces) ? parsed.savedPlaces : [],
    };
  } catch (_err) {
    return { users: [], favorites: [], recentSearches: [], feedback: [], savedPlaces: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: isAdminEmail(user.email) ? "admin" : (user.role || "commuter"),
    created_at: user.created_at,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function signToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ userId, issuedAt: Date.now(), nonce: crypto.randomBytes(8).toString("hex") })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !String(token).includes(".")) return null;
  const [payload, signature] = String(token).split(".");
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decoded.userId || null;
}

function getUserFromRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const userId = verifyToken(token);
  if (!userId) return null;
  const store = readStore();
  const user = store.users.find((item) => item.id === userId);
  return user || null;
}

function requireUser(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const visibleUser = publicUser(user);
  if (visibleUser.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  req.user = user;
  return next();
}

function registerUser({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");
  if (cleanName.length < 2) throw new Error("Name must be at least 2 characters.");
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Valid email is required.");
  if (cleanPassword.length < 6) throw new Error("Password must be at least 6 characters.");

  const store = readStore();
  if (store.users.some((user) => user.email === cleanEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const user = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    password_hash: createPasswordHash(cleanPassword),
    role: isAdminEmail(cleanEmail) ? "admin" : "commuter",
    created_at: new Date().toISOString(),
  };
  store.users.push(user);
  writeStore(store);
  return { user: publicUser(user), token: signToken(user.id) };
}

function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const store = readStore();
  const user = store.users.find((item) => item.email === cleanEmail);
  if (!user || !verifyPassword(password || "", user.password_hash)) {
    throw new Error("Invalid email or password.");
  }
  return { user: publicUser(user), token: signToken(user.id) };
}

function getDashboard(userId) {
  const store = readStore();
  return {
    favorites: store.favorites.filter((item) => item.user_id === userId),
    recentSearches: store.recentSearches.filter((item) => item.user_id === userId).slice(0, 10),
    feedback: store.feedback.filter((item) => item.user_id === userId).slice(0, 10),
    savedPlaces: store.savedPlaces.filter((item) => item.user_id === userId).slice(0, 20),
  };
}

function addFavorite(userId, payload) {
  const store = readStore();
  const routeId = String(payload.route_id || "").trim();
  const title = String(payload.title || payload.route_name || routeId || "Saved Route").trim();
  if (!routeId && !payload.alight_stop_name) throw new Error("Favorite route details are required.");

  const favorite = {
    id: crypto.randomUUID(),
    user_id: userId,
    route_id: routeId,
    title,
    route_name: String(payload.route_name || title),
    board_stop_name: String(payload.board_stop_name || ""),
    alight_stop_name: String(payload.alight_stop_name || ""),
    estimated_minutes: payload.estimated_minutes || null,
    transfers: payload.transfers || 0,
    created_at: new Date().toISOString(),
  };
  store.favorites = store.favorites.filter(
    (item) => !(item.user_id === userId && item.route_id === favorite.route_id && item.alight_stop_name === favorite.alight_stop_name)
  );
  store.favorites.unshift(favorite);
  writeStore(store);
  return favorite;
}

function deleteFavorite(userId, favoriteId) {
  const store = readStore();
  const before = store.favorites.length;
  store.favorites = store.favorites.filter((item) => !(item.user_id === userId && item.id === favoriteId));
  writeStore(store);
  return before !== store.favorites.length;
}

function addRecentSearch(userId, payload) {
  const store = readStore();
  const recent = {
    id: crypto.randomUUID(),
    user_id: userId,
    origin: String(payload.origin || ""),
    destination: String(payload.destination || ""),
    direct_count: Number(payload.direct_count || 0),
    transfer_count: Number(payload.transfer_count || 0),
    created_at: new Date().toISOString(),
  };
  store.recentSearches.unshift(recent);
  store.recentSearches = store.recentSearches.filter((item, index, arr) => {
    if (item.user_id !== userId) return true;
    return arr.findIndex((x) => x.user_id === userId && x.origin === item.origin && x.destination === item.destination) === index;
  }).slice(0, 100);
  writeStore(store);
  return recent;
}

function addFeedback(userId, payload) {
  const message = String(payload.message || "").trim();
  if (message.length < 5) throw new Error("Feedback message must be at least 5 characters.");
  const store = readStore();
  const item = {
    id: crypto.randomUUID(),
    user_id: userId,
    type: String(payload.type || "general"),
    route_id: String(payload.route_id || ""),
    stop_id: String(payload.stop_id || ""),
    message,
    status: "open",
    created_at: new Date().toISOString(),
  };
  store.feedback.unshift(item);
  writeStore(store);
  return item;
}

function listAllFeedback() {
  const store = readStore();
  return store.feedback
    .map((item) => {
      const user = store.users.find((candidate) => candidate.id === item.user_id);
      return {
        ...item,
        user_name: user ? user.name : "Unknown user",
        user_email: user ? user.email : "",
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function updateFeedbackStatus(feedbackId, status) {
  const allowed = new Set(["open", "reviewing", "resolved", "dismissed"]);
  const cleanStatus = String(status || "").trim().toLowerCase();
  if (!allowed.has(cleanStatus)) throw new Error("Invalid feedback status.");

  const store = readStore();
  const item = store.feedback.find((feedback) => feedback.id === feedbackId);
  if (!item) throw new Error("Feedback report not found.");
  item.status = cleanStatus;
  item.updated_at = new Date().toISOString();
  writeStore(store);
  return item;
}


function addSavedPlace(userId, payload) {
  const label = String(payload.label || "").trim();
  const lat = Number(payload.lat);
  const lon = Number(payload.lon);
  const type = String(payload.type || "custom").trim().toLowerCase();
  if (label.length < 2) throw new Error("Place label must be at least 2 characters.");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Valid latitude and longitude are required.");

  const store = readStore();
  const place = {
    id: crypto.randomUUID(),
    user_id: userId,
    label,
    type: ["home", "school", "work", "custom"].includes(type) ? type : "custom",
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    created_at: new Date().toISOString(),
  };

  store.savedPlaces = store.savedPlaces.filter(
    (item) => !(item.user_id === userId && item.label.toLowerCase() === label.toLowerCase())
  );
  store.savedPlaces.unshift(place);
  writeStore(store);
  return place;
}

function deleteSavedPlace(userId, placeId) {
  const store = readStore();
  const before = store.savedPlaces.length;
  store.savedPlaces = store.savedPlaces.filter((item) => !(item.user_id === userId && item.id === placeId));
  writeStore(store);
  return before !== store.savedPlaces.length;
}

function getStoreStats() {
  const store = readStore();
  return {
    users: store.users.length,
    favorites: store.favorites.length,
    recent_searches: store.recentSearches.length,
    feedback_total: store.feedback.length,
    feedback_open: store.feedback.filter((item) => item.status === "open").length,
    feedback_resolved: store.feedback.filter((item) => item.status === "resolved").length,
    saved_places: store.savedPlaces.length,
  };
}

module.exports = {
  publicUser,
  getUserFromRequest,
  requireUser,
  requireAdmin,
  registerUser,
  loginUser,
  getDashboard,
  addFavorite,
  deleteFavorite,
  addRecentSearch,
  addSavedPlace,
  deleteSavedPlace,
  addFeedback,
  listAllFeedback,
  updateFeedbackStatus,
  getStoreStats,
};
