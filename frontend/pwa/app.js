/* ═══════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════ */
const BASE_URL = "http://localhost:61749";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LOCAL_USER_ID = "local_user";
const GPS_INTERVAL_MS = 30_000;
const DEFAULT_CENTER = [43.238949, 76.889709];
const DEFAULT_DESTINATION = [43.246998, 76.923778];

const PAGES = [
  "home", "navigate", "report", "sos",
  "profile", "signin", "signup", "forgot-password",
];

/* ═══════════════════════════════════════
   STATE
   ═══════════════════════════════════════ */
const state = {
  currentPage: "home",
  currentLocation: null,
  currentAddress: "",
  gpsPoints: [],
  reportPins: loadStoredPins(),
  reportMarkers: [],
  routeLine: null,
  routeMarkers: [],
  userMarker: null,
  gpsTimer: null,
  navMap: null,
  reportMap: null,
  user: loadUser(),
  navUserMarker: null,
  reportUserMarker: null,
  reportIssueMarker: null,
};

/* ═══════════════════════════════════════
   BOOT
   ═══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  bindGlobalEvents();
  syncAuthUI();
  handleHashChange();
  window.addEventListener("hashchange", handleHashChange);
});

/* ═══════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════ */
function handleHashChange() {
  const raw = (location.hash || "#home").slice(1);
  const page = raw === "map" ? "navigate" : (PAGES.includes(raw) ? raw : "home");

  for (const p of PAGES) {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle("hidden", p !== page);
  }

  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  closeMenu();
  state.currentPage = page;

  if (page === "navigate") initNavMap();
  if (page === "report") initReportMap();
  if (page === "profile") hydrateProfile();

  window.scrollTo({ top: 0 });
}

/* ═══════════════════════════════════════
   GLOBAL EVENT BINDING
   ═══════════════════════════════════════ */
function bindGlobalEvents() {
  const $ = (id) => document.getElementById(id);

  $("hamburger").addEventListener("click", toggleMenu);

  $("navigationForm")?.addEventListener("submit", handleNavigateSubmit);
  $("useCurrentLocationButton")?.addEventListener("click", populateStartFromCurrentLocation);
  $("refreshLocationButton")?.addEventListener("click", () => refreshCurrentLocation({ centerMap: true, silent: false }));
  $("reportForm")?.addEventListener("submit", handleReportSubmit);
  $("sosButton")?.addEventListener("click", handleSosPress);
  $("logoutButton")?.addEventListener("click", handleLogout);
  $("signinForm")?.addEventListener("submit", handleSignIn);
  $("signupForm")?.addEventListener("submit", handleSignUp);
  $("forgotForm")?.addEventListener("submit", handleForgotPassword);
  $("profileForm")?.addEventListener("submit", handleProfileSave);
  $("deleteAccountButton")?.addEventListener("click", handleDeleteAccount);

  // address search for navigation
  setupAddressSearch({
    inputId: "startAddress",
    suggestionsId: "startSuggestions",
    infoId: "startAddressInfo",
    latId: "startLat",
    lonId: "startLon",
  });
  setupAddressSearch({
    inputId: "endAddress",
    suggestionsId: "endSuggestions",
    infoId: "endAddressInfo",
    latId: "endLat",
    lonId: "endLon",
  });

  $("reportImage")?.addEventListener("change", (e) => {
    const name = e.target.files?.[0]?.name || "";
    $("fileName").textContent = name;
    const area = $("fileUploadArea");
    if (name) area.style.borderColor = "var(--yellow)";
  });

  $("settingHighContrast")?.addEventListener("change", (e) => {
    document.body.classList.toggle("high-contrast", e.target.checked);
    saveSetting("highContrast", e.target.checked);
  });

  $("settingLargeText")?.addEventListener("change", (e) => {
    document.documentElement.style.fontSize = e.target.checked ? "118%" : "";
    saveSetting("largeText", e.target.checked);
  });

  $("settingVibration")?.addEventListener("change", (e) => saveSetting("vibration", e.target.checked));
  $("settingGps")?.addEventListener("change", (e) => {
    saveSetting("gps", e.target.checked);
    e.target.checked ? startGpsPolling() : stopGpsPolling();
  });

  loadSettings();
}

/* ═══════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════ */
function toggleMenu() {
  const btn = document.getElementById("hamburger");
  const links = document.getElementById("navLinks");
  btn.classList.toggle("open");
  links.classList.toggle("open");
}

function closeMenu() {
  document.getElementById("hamburger")?.classList.remove("open");
  document.getElementById("navLinks")?.classList.remove("open");
}

/* ═══════════════════════════════════════
   AUTH (local-only, no backend)
   ═══════════════════════════════════════ */
function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;
  const statusEl = document.getElementById("signinStatus");

  if (!email || password.length < 6) {
    showStatus(statusEl, "Заполните все поля (пароль мин. 6 символов).", "error");
    return;
  }

  const stored = JSON.parse(localStorage.getItem("inkomek-users") || "{}");
  const user = stored[email];

  if (!user || user.password !== password) {
    showStatus(statusEl, "Неверный email или пароль.", "error");
    return;
  }

  state.user = { name: user.name, email, phone: user.phone || "", disability: user.disability || "", emergencyContact: user.emergencyContact || "" };
  persistUser();
  syncAuthUI();
  showStatus(statusEl, "Вы вошли!", "success");
  setTimeout(() => (location.hash = "#home"), 600);
}

function handleSignUp(e) {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const disability = document.getElementById("signupDisability").value;
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupPasswordConfirm").value;
  const statusEl = document.getElementById("signupStatus");

  if (!name || !email || password.length < 6) {
    showStatus(statusEl, "Заполните обязательные поля.", "error");
    return;
  }

  if (password !== confirm) {
    showStatus(statusEl, "Пароли не совпадают.", "error");
    return;
  }

  const stored = JSON.parse(localStorage.getItem("inkomek-users") || "{}");
  if (stored[email]) {
    showStatus(statusEl, "Этот email уже зарегистрирован.", "error");
    return;
  }

  stored[email] = { name, password, phone, disability };
  localStorage.setItem("inkomek-users", JSON.stringify(stored));

  state.user = { name, email, phone, disability, emergencyContact: "" };
  persistUser();
  syncAuthUI();
  showStatus(statusEl, "Аккаунт создан!", "success");
  setTimeout(() => (location.hash = "#home"), 600);
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  const statusEl = document.getElementById("forgotStatus");

  if (!email) {
    showStatus(statusEl, "Введите email.", "error");
    return;
  }

  showStatus(statusEl, "Ссылка для сброса отправлена (демо-режим).", "success");
}

function handleLogout() {
  state.user = null;
  localStorage.removeItem("inkomek-user");
  syncAuthUI();
  location.hash = "#home";
}

function handleDeleteAccount() {
  if (!state.user) return;
  if (!confirm("Вы уверены? Это действие нельзя отменить.")) return;

  const stored = JSON.parse(localStorage.getItem("inkomek-users") || "{}");
  delete stored[state.user.email];
  localStorage.setItem("inkomek-users", JSON.stringify(stored));
  handleLogout();
}

function syncAuthUI() {
  const authBlock = document.getElementById("navAuth");
  const userBlock = document.getElementById("navUser");
  const avatarEl = document.getElementById("navAvatarInitial");

  if (state.user) {
    authBlock?.classList.add("hidden");
    userBlock?.classList.remove("hidden");
    if (avatarEl) avatarEl.textContent = (state.user.name || "U").charAt(0).toUpperCase();
  } else {
    authBlock?.classList.remove("hidden");
    userBlock?.classList.add("hidden");
  }
}

function persistUser() { localStorage.setItem("inkomek-user", JSON.stringify(state.user)); }
function loadUser() { try { return JSON.parse(localStorage.getItem("inkomek-user")); } catch { return null; } }

/* ═══════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════ */
function hydrateProfile() {
  if (!state.user) return;
  const u = state.user;
  document.getElementById("profileName").value = u.name || "";
  document.getElementById("profileEmail").value = u.email || "";
  document.getElementById("profilePhone").value = u.phone || "";
  document.getElementById("profileDisability").value = u.disability || "wheelchair";
  document.getElementById("profileEmergencyContact").value = u.emergencyContact || "";
  document.getElementById("profileDisplayName").textContent = u.name || "Пользователь";
  document.getElementById("profileDisplayEmail").textContent = u.email || "";
  document.getElementById("profileAvatar").textContent = (u.name || "U").charAt(0).toUpperCase();
}

function handleProfileSave(e) {
  e.preventDefault();
  if (!state.user) { location.hash = "#signin"; return; }

  state.user.name = document.getElementById("profileName").value.trim();
  state.user.phone = document.getElementById("profilePhone").value.trim();
  state.user.disability = document.getElementById("profileDisability").value;
  state.user.emergencyContact = document.getElementById("profileEmergencyContact").value.trim();
  persistUser();
  syncAuthUI();
  hydrateProfile();
  showStatus(document.getElementById("profileStatus"), "Профиль сохранён.", "success");
}

/* ═══════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════ */
function saveSetting(key, value) { localStorage.setItem(`inkomek-setting-${key}`, JSON.stringify(value)); }

function loadSettings() {
  const hc = loadSetting("highContrast", false);
  const lt = loadSetting("largeText", false);
  const vib = loadSetting("vibration", true);
  const gps = loadSetting("gps", true);

  const $ = (id) => document.getElementById(id);
  if ($("settingHighContrast")) $("settingHighContrast").checked = hc;
  if ($("settingLargeText")) $("settingLargeText").checked = lt;
  if ($("settingVibration")) $("settingVibration").checked = vib;
  if ($("settingGps")) $("settingGps").checked = gps;

  if (hc) document.body.classList.add("high-contrast");
  if (lt) document.documentElement.style.fontSize = "118%";
  if (gps) startGpsPolling();
}

function loadSetting(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(`inkomek-setting-${key}`)); return v ?? fallback; }
  catch { return fallback; }
}

/* ═══════════════════════════════════════
   LEAFLET MAPS
   ═══════════════════════════════════════ */
function initNavMap() {
  if (state.navMap) { state.navMap.invalidateSize(); return; }

  const el = document.getElementById("navMap");
  if (!el || el.offsetHeight === 0) return;

  state.navMap = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(state.navMap);

  hydrateNavForm();
  renderReportPins(state.navMap);
  refreshCurrentLocation({ centerMap: false, silent: true });
}

function initReportMap() {
  if (state.reportMap) { state.reportMap.invalidateSize(); return; }

  const el = document.getElementById("reportMap");
  if (!el || el.offsetHeight === 0) return;

  state.reportMap = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(state.reportMap);

  refreshCurrentLocation({ centerMap: false, silent: true });
}

function hydrateNavForm() {
  const type = localStorage.getItem("inkomek-user-type") || (state.user?.disability || "wheelchair");
  const $ = (id) => document.getElementById(id);
  if ($("userType")) $("userType").value = type;
  if ($("endAddress") && !$("endAddress").value) $("endAddress").value = "Абая 1, Алматы";
  if ($("endLat") && !$("endLat").value) $("endLat").value = String(DEFAULT_DESTINATION[0]);
  if ($("endLon") && !$("endLon").value) $("endLon").value = String(DEFAULT_DESTINATION[1]);
}

/* ═══════════════════════════════════════
   NOMINATIM ADDRESS SEARCH
   ═══════════════════════════════════════ */
function setupAddressSearch(config) {
  const input = document.getElementById(config.inputId);
  const list = document.getElementById(config.suggestionsId);
  const info = document.getElementById(config.infoId);
  const latEl = document.getElementById(config.latId);
  const lonEl = document.getElementById(config.lonId);
  if (!input || !list || !latEl || !lonEl) return;

  let debounceId;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    latEl.value = "";
    lonEl.value = "";
    if (!q) {
      list.classList.add("hidden");
      list.innerHTML = "";
      if (info) info.textContent = "";
      return;
    }
    clearTimeout(debounceId);
    debounceId = setTimeout(async () => {
      const suggestions = await searchAddressSuggestions(q);
      renderSuggestions(list, suggestions, (choice) => {
        input.value = choice.display_name;
        latEl.value = String(choice.lat);
        lonEl.value = String(choice.lon);
        if (info) info.textContent = choice.display_name;
        list.classList.add("hidden");
        list.innerHTML = "";
        if (state.navMap) state.navMap.setView([choice.lat, choice.lon], 15);
      });
    }, 350);
  });

  input.addEventListener("blur", () => {
    setTimeout(async () => {
      if (!latEl.value || !lonEl.value) {
        const match = await geocodeAddress(input.value.trim());
        if (match) {
          input.value = match.display_name;
          latEl.value = String(match.lat);
          lonEl.value = String(match.lon);
          if (info) info.textContent = match.display_name;
        }
      }
      list.classList.add("hidden");
      list.innerHTML = "";
    }, 200);
  });
}

async function searchAddressSuggestions(rawQuery) {
  const query = biasToKazakhstan(rawQuery);
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item) => ({
      lat: Number(item.lat),
      lon: Number(item.lon),
      display_name: item.display_name,
    }));
  } catch {
    return [];
  }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.display_name || "";
  } catch {
    return "";
  }
}

async function geocodeAddress(rawQuery) {
  const results = await searchAddressSuggestions(rawQuery);
  return results[0] || null;
}

function renderSuggestions(container, items, onPick) {
  if (!items.length) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  container.innerHTML = items
    .map(
      (item, idx) =>
        `<button type="button" class="address-suggestion-item" role="option" aria-selected="${idx === 0 ? "true" : "false"}"><strong>${esc(
          (item.display_name.split(",")[0] || "").trim()
        )}</strong><span>${esc(item.display_name)}</span></button>`
    )
    .join("");
  container.classList.remove("hidden");
  Array.from(container.querySelectorAll(".address-suggestion-item")).forEach((btn, index) => {
    btn.addEventListener("click", () => onPick(items[index]));
  });
}

function biasToKazakhstan(query) {
  const lower = query.toLowerCase();
  const hasCity =
    lower.includes("almaty") ||
    lower.includes("алматы") ||
    lower.includes("astana") ||
    lower.includes("астана") ||
    lower.includes("alatau") ||
    lower.includes("алатау");
  return hasCity ? query : `${query}, Almaty, Kazakhstan`;
}

/* ═══════════════════════════════════════
   NAVIGATION (POST /navigate)
   ═══════════════════════════════════════ */
async function handleNavigateSubmit(e) {
  e.preventDefault();
  const $ = (id) => document.getElementById(id);

  const userType = $("userType").value;
  const statusEl = $("navigationStatus");
  const btn = $("navigateButton");

  let start = [Number($("startLat").value), Number($("startLon").value)];
  let end = [Number($("endLat").value), Number($("endLon").value)];

  if (!isValidCoords(start) || !isValidCoords(end)) {
    try {
      const startAddress = $("startAddress")?.value.trim();
      const endAddress = $("endAddress")?.value.trim();
      if (startAddress && !isValidCoords(start)) {
        const res = await geocodeAddress(startAddress);
        if (res) {
          $("startLat").value = String(res.lat);
          $("startLon").value = String(res.lon);
        }
      }
      if (endAddress && !isValidCoords(end)) {
        const res = await geocodeAddress(endAddress);
        if (res) {
          $("endLat").value = String(res.lat);
          $("endLon").value = String(res.lon);
        }
      }
      start = [Number($("startLat").value), Number($("startLon").value)];
      end = [Number($("endLat").value), Number($("endLon").value)];
    } catch (_) {}
  }

  if (!isValidCoords(start) || !isValidCoords(end)) {
    showStatus(statusEl, "Не удалось определить координаты по адресу. Уточните адрес.", "error");
    return;
  }

  localStorage.setItem("inkomek-user-type", userType);
  setLoading(btn, true, "Загрузка...");
  showStatus(statusEl, "Запрашиваем доступный маршрут...", "loading");

  try {
    const response = await fetchJson("/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_type: userType, start_coords: start, end_coords: end }),
    });

    drawRoute(response.route_coords || []);
    renderRouteSummary(response.summary || null);
    showStatus(statusEl, "Маршрут построен.", "success");
  } catch (error) {
    clearRoute();
    renderRouteSummary(null);
    showStatus(statusEl, extractError(error, "Не удалось построить маршрут."), "error");
  } finally {
    setLoading(btn, false, "Построить маршрут");
  }
}

function drawRoute(routeCoords) {
  clearRoute();
  const mapInstance = state.navMap;
  if (!mapInstance || !Array.isArray(routeCoords) || routeCoords.length === 0) return;

  const latLngs = routeCoords.map((p) => [Number(p[0]), Number(p[1])]);
  state.routeLine = L.polyline(latLngs, { color: "#216e39", weight: 6, opacity: 0.9 }).addTo(mapInstance);
  state.routeMarkers.push(
    L.marker(latLngs[0]).addTo(mapInstance).bindPopup("Старт"),
    L.marker(latLngs[latLngs.length - 1]).addTo(mapInstance).bindPopup("Финиш"),
  );
  mapInstance.fitBounds(state.routeLine.getBounds(), { padding: [24, 24] });
}

function clearRoute() {
  const mapInstance = state.navMap;
  if (state.routeLine && mapInstance) mapInstance.removeLayer(state.routeLine);
  state.routeLine = null;
  for (const m of state.routeMarkers) { if (mapInstance) mapInstance.removeLayer(m); }
  state.routeMarkers = [];
}

function renderRouteSummary(summary) {
  const el = document.getElementById("routeSummary");
  if (!el) return;
  if (!summary) { el.classList.add("hidden"); el.innerHTML = ""; return; }

  el.innerHTML = `<div class="metric-list">
    <div><strong>Расстояние</strong> ${Number(summary.total_length_m || 0).toFixed(1)} м</div>
    <div><strong>Стоимость доступности</strong> ${Number(summary.total_accessibility_cost || 0).toFixed(1)}</div>
    <div><strong>Узлов</strong> ${summary.node_count ?? "-"}</div>
    <div><strong>Рёбер</strong> ${summary.edge_count ?? "-"}</div>
  </div>`;
  el.classList.remove("hidden");
}

/* ═══════════════════════════════════════
   REPORT (POST /classify)
   ═══════════════════════════════════════ */
async function handleReportSubmit(e) {
  e.preventDefault();
  const file = document.getElementById("reportImage").files?.[0];
  const statusEl = document.getElementById("reportStatus");
  const btn = document.getElementById("reportButton");

  if (!file) { showStatus(statusEl, "Сначала выберите фото.", "error"); return; }

  setLoading(btn, true, "Анализ...");
  showStatus(statusEl, "Загрузка и классификация...", "loading");

  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetchJson("/classify", { method: "POST", body: formData });
    const location = state.currentLocation || DEFAULT_CENTER;

    addProblemPin({ location, category: response.category || "unknown", confidence: Number(response.confidence || 0), notes: document.getElementById("reportNotes").value.trim() });
    renderReportResult(response);
    showStatus(statusEl, "Проблема классифицирована и отмечена на карте.", "success");
  } catch (error) {
    document.getElementById("reportResult")?.classList.add("hidden");
    showStatus(statusEl, extractError(error, "Не удалось классифицировать."), "error");
  } finally {
    setLoading(btn, false, "Классифицировать");
  }
}

function renderReportResult(response) {
  const el = document.getElementById("reportResult");
  if (!el) return;
  el.innerHTML = `<div class="metric-list">
    <div><strong>Категория</strong> ${esc(response.category || "unknown")}</div>
    <div><strong>Уверенность</strong> ${fmtConf(response.confidence)}</div>
    <div><strong>Описание</strong> ${esc(response.description || "—")}</div>
  </div>`;
  el.classList.remove("hidden");
}

/* ═══════════════════════════════════════
   SOS (POST /alert)
   ═══════════════════════════════════════ */
async function handleSosPress() {
  vibrate([500, 200, 500, 200, 500]);
  const btn = document.getElementById("sosButton");
  const statusEl = document.getElementById("sosStatus");

  setLoading(btn, true, "Отправка...");
  showStatus(statusEl, "Отправка SOS...", "loading");

  try {
    await refreshCurrentLocation({ centerMap: false, silent: true });
    const loc = state.currentLocation || DEFAULT_CENTER;

    await fetchJson("/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: LOCAL_USER_ID, location: loc, type: "sos" }),
    });

    showStatus(statusEl, "SOS-сигнал отправлен. Помощь в пути.", "success");
  } catch (error) {
    showStatus(statusEl, extractError(error, "Не удалось отправить SOS."), "error");
  } finally {
    setLoading(btn, false, "SOS");
  }
}

/* ═══════════════════════════════════════
   GPS + ANOMALY (POST /gps/check)
   ═══════════════════════════════════════ */
async function refreshCurrentLocation({ centerMap = false, silent = false } = {}) {
  if (!("geolocation" in navigator)) {
    if (!silent) showStatus(document.getElementById("gpsStatus"), "Геолокация не поддерживается.", "error");
    return null;
  }

  if (!silent) showStatus(document.getElementById("gpsStatus"), "Определяем местоположение...", "loading");

  try {
    const pos = await getCurrentPosition();
    const point = [pos.coords.latitude, pos.coords.longitude];
    state.currentLocation = point;
    appendGpsPoint(point);
    const reverseAddress = await reverseGeocode(point[0], point[1]);
    state.currentAddress = reverseAddress;
    updateUserMarkers(point, reverseAddress);

    const $ = (id) => document.getElementById(id);
    if (!$("startLat")?.value) populateStartFromCurrentLocation();
    if (centerMap && state.navMap) state.navMap.setView(point, 15);
    if (state.reportMap) {
      state.reportMap.setView(point, 15);
      updateReportIssuePreview(point, reverseAddress);
    }
    if (!silent) {
      const message = reverseAddress
        ? `Ваш адрес: ${reverseAddress}`
        : `GPS: ${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;
      showStatus($("gpsStatus"), message, "success");
      showStatus($("reportLocationStatus"), `Проблема будет отмечена здесь: ${reverseAddress || `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`}`, "success");
    }
    return point;
  } catch {
    if (!silent) showStatus(document.getElementById("gpsStatus"), "Не удалось получить GPS.", "error");
    if (!silent) showStatus(document.getElementById("reportLocationStatus"), "Не удалось определить местоположение для репорта.", "error");
    return null;
  }
}

function startGpsPolling() {
  stopGpsPolling();
  runGpsCheckCycle();
  state.gpsTimer = window.setInterval(runGpsCheckCycle, GPS_INTERVAL_MS);
}

function stopGpsPolling() {
  if (state.gpsTimer) { window.clearInterval(state.gpsTimer); state.gpsTimer = null; }
}

async function runGpsCheckCycle() {
  const point = await refreshCurrentLocation({ centerMap: false, silent: true });
  if (!point) return;

  const gpsStatusEl = document.getElementById("gpsStatus");
  if (state.gpsPoints.length < 6) {
    if (gpsStatusEl) {
      const prefix = state.currentAddress ? `Адрес: ${state.currentAddress}. ` : "";
      showStatus(gpsStatusEl, `${prefix}Сбор GPS-точек (${state.gpsPoints.length}/6)...`, "neutral");
    }
    return;
  }

  try {
    const response = await fetchJson("/gps/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: LOCAL_USER_ID, points: state.gpsPoints }),
    });

    const anomalyEl = document.getElementById("anomalyBanner");
    if (response.is_anomaly) {
      vibrate([500, 200, 500]);
      if (anomalyEl) { anomalyEl.textContent = `GPS-аномалия${response.anomaly_type ? `: ${response.anomaly_type}` : ""}`; anomalyEl.classList.remove("hidden"); }
    } else {
      if (anomalyEl) anomalyEl.classList.add("hidden");
      if (gpsStatusEl) {
        const prefix = state.currentAddress ? `Адрес: ${state.currentAddress}. ` : "";
        showStatus(gpsStatusEl, `${prefix}GPS мониторинг. Оценка: ${fmtScore(response.score)}.`, "success");
      }
    }
  } catch {
    if (gpsStatusEl) showStatus(gpsStatusEl, "Ошибка проверки GPS.", "error");
  }
}

/* ═══════════════════════════════════════
   MAP MARKERS & PINS
   ═══════════════════════════════════════ */
function updateUserMarkers(point, address = "") {
  const popupText = address || "Ваше местоположение";

  if (state.navMap) {
    if (state.navUserMarker) {
      state.navUserMarker.setLatLng(point);
      state.navUserMarker.bindPopup(popupText);
    } else {
      state.navUserMarker = L.circleMarker(point, {
        radius: 10, color: "#0d47a1", fillColor: "#1263bf", fillOpacity: 1, weight: 3,
      }).addTo(state.navMap).bindPopup(popupText);
    }
  }

  if (state.reportMap) {
    if (state.reportUserMarker) {
      state.reportUserMarker.setLatLng(point);
      state.reportUserMarker.bindPopup(popupText);
    } else {
      state.reportUserMarker = L.circleMarker(point, {
        radius: 10, color: "#0d47a1", fillColor: "#1263bf", fillOpacity: 1, weight: 3,
      }).addTo(state.reportMap).bindPopup(popupText);
    }
  }
}

function updateReportIssuePreview(point, address = "") {
  if (!state.reportMap) return;
  const popupText = address
    ? `Проблема будет отмечена здесь: ${address}`
    : "Проблема будет отмечена здесь";

  if (state.reportIssueMarker) {
    state.reportIssueMarker.setLatLng(point);
    state.reportIssueMarker.bindPopup(popupText);
    return;
  }

  state.reportIssueMarker = L.circleMarker(point, {
    radius: 9,
    color: "#8f1414",
    fillColor: "#b71c1c",
    fillOpacity: 0.9,
    weight: 2,
  }).addTo(state.reportMap).bindPopup(popupText);
}

function addProblemPin(pin) {
  state.reportPins.push({
    location: [Number(pin.location[0]), Number(pin.location[1])],
    category: pin.category, confidence: pin.confidence,
    notes: pin.notes || "", createdAt: Date.now(),
  });
  persistPins();
  if (state.navMap) renderReportPins(state.navMap);
  if (state.reportMap) updateReportIssuePreview(pin.location, state.currentAddress);
}

function renderReportPins(mapInstance) {
  if (!mapInstance) return;
  for (const m of state.reportMarkers) mapInstance.removeLayer(m);
  state.reportMarkers = [];

  for (const pin of state.reportPins) {
    const m = L.circleMarker(pin.location, {
      radius: 9, color: "#8f1414", fillColor: "#b71c1c", fillOpacity: 0.9, weight: 2,
    }).addTo(mapInstance).bindPopup(`<strong>${esc(pin.category)}</strong><br>Уверенность: ${fmtConf(pin.confidence)}${pin.notes ? `<br>${esc(pin.notes)}` : ""}`);
    state.reportMarkers.push(m);
  }
}

function populateStartFromCurrentLocation() {
  const $ = (id) => document.getElementById(id);
  if (!state.currentLocation) {
    const s = $("navigationStatus");
    if (s) showStatus(s, "GPS пока не доступен.", "error");
    return;
  }
  if ($("startLat")) $("startLat").value = String(state.currentLocation[0]);
  if ($("startLon")) $("startLon").value = String(state.currentLocation[1]);
  if ($("startAddress")) $("startAddress").value = state.currentAddress || "";
  const info = $("startAddressInfo");
  if (info) info.textContent = state.currentAddress || "Текущая позиция (GPS)";
  const s = $("navigationStatus");
  if (s) showStatus(s, "Адрес старта обновлён по GPS.", "success");
}

function appendGpsPoint(point) {
  state.gpsPoints.push({ lat: point[0], lon: point[1], ts: Math.floor(Date.now() / 1000) });
  if (state.gpsPoints.length > 6) state.gpsPoints = state.gpsPoints.slice(-6);
}

/* ═══════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════ */
async function fetchJson(path, options = {}) {
  let r;
  try {
    r = await fetch(`${BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error("Не удалось подключиться к backend. Проверьте, что API запущен и CORS разрешён.");
  }
  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) {
    const detail = typeof payload === "string" ? payload : payload?.detail || payload?.message || JSON.stringify(payload);
    throw new Error(detail || `Request failed (${r.status})`);
  }
  return payload;
}

function showStatus(el, msg, tone = "neutral") {
  if (!el) return;
  el.textContent = msg;
  el.className = `status status-${tone}`;
  el.classList.remove("hidden");
}

function setLoading(btn, loading, label) { if (!btn) return; btn.disabled = loading; btn.textContent = label; }

function getCurrentPosition() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 })
  );
}

function vibrate(pattern) { if (loadSetting("vibration", true) && typeof navigator.vibrate === "function") navigator.vibrate(pattern); }

function isValidCoords(c) { return Array.isArray(c) && c.length === 2 && c.every(Number.isFinite); }
function fmtConf(v) { return `${(Number(v || 0) * 100).toFixed(1)}%`; }
function fmtScore(v) { const n = Number(v); return Number.isFinite(n) ? n.toFixed(3) : "-"; }
function extractError(err, fallback) { return err instanceof Error && err.message ? err.message : fallback; }
function loadStoredPins() { try { return JSON.parse(localStorage.getItem("inkomek-report-pins") || "[]"); } catch { return []; } }
function persistPins() { localStorage.setItem("inkomek-report-pins", JSON.stringify(state.reportPins)); }

function esc(v) {
  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}
