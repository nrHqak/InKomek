/* ═══════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════ */
const BASE_URL = "http://127.0.0.1:61749";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LOCAL_USER_ID = "local_user";
const GPS_INTERVAL_MS = 30_000;
const DEFAULT_CENTER = [43.238949, 76.889709];
const DEFAULT_DESTINATION = [43.246998, 76.923778];
const ACTIVE_NAV_HISTORY_KEY = "inkomek-auto-reports";

const PAGES = [
  "home",
  "navigate",
  "report",
  "sos",
  "profile",
  "signin",
  "signup",
  "forgot-password",
  "request-help",
  "user-requests",
  "volunteer-signin",
  "volunteer-signup",
  "volunteer-home",
  "business-register",
  "business-dashboard",
  "pricing",
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
  // Volunteer-only state (localStorage)
  volunteer: loadVolunteer(),
  volunteerLocation: null,
  volunteerMap: null,
  volunteerUserMarker: null,
  volunteerRouteLine: null,
  volunteerGpsTimer: null,
  volunteerRequestMarkers: [],
  volunteerActiveRequestId: null,
  volunteerHelpRequests: [],
  volunteerAvailability: loadVolunteerAvailability(), // "available" | "busy" (default available)
  volunteerEventsBound: false,
  // User volunteer-requests state (local-only)
  userRequestsMap: null,
  userRequestsUserMarker: null,
  userRequestsVolunteerMarker: null,
  userRequestsRouteLine: null,
  userRequestsGpsTimer: null,
  userRequestsPollTimer: null,

  // Businesses (local-only)
  businessRegMap: null,
  businessDashMap: null,
  businessRegPin: null,
  businessDashPin: null,
  businessMarkers: [],
  businessCardBusinessId: null,
  businessFilterOvzOnly: false,

  businessRegisterPhotoDataUrl: null,
  businessEditPhotoDataUrl: null,

  // Active autonomous navigation
  activeRouteCoords: [],
  activeRouteMeta: [],
  activeRouteUserType: null,
  activeRouteDisplayType: null,
  activeRouteDestination: null,
  activeNavRunning: false,
  activeNavLocationTimer: null,
  activeNavGuidanceTimer: null,
  activeNavAnomalyTimer: null,
  activeNavLastInstruction: "",
  activeNavLastSpokenAt: 0,
  activeNavProgressIndex: 0,
  activeNavWaypointMarkers: [],
  activeNavAuxMarkers: [],
  activeNavArrowMarkers: [],
  activeNavOffRouteSince: null,
  activeNavLastAnomalyCheckAt: 0,
  activeNavAnomalySince: null,
  activeNavLastAnomalyResponse: null,
};

/* ═══════════════════════════════════════
   BOOT
   ═══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  bindGlobalEvents();
  syncAuthUI();
  syncVolunteerAuthUI();
  handleHashChange();
  window.addEventListener("hashchange", handleHashChange);
});

/* ═══════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════ */
function handleHashChange() {
  const raw = (location.hash || "#home").slice(1);
  let page = raw === "map" ? "navigate" : (PAGES.includes(raw) ? raw : "home");

  // Authenticated users should not see the guest landing page.
  if (page === "home" && state.user) {
    location.hash = "#navigate";
    return;
  }

  // Volunteer guard: Лента волонтёра доступна только после входа
  if (page === "volunteer-home" && !state.volunteer) page = "volunteer-signin";

  for (const p of PAGES) {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle("hidden", p !== page);
  }

  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  closeMenu();
  state.currentPage = page;

  if (page !== "volunteer-home") stopVolunteerPolling();
  if (page !== "user-requests") stopUserRequestsPolling();
  if (page !== "navigate") stopActiveNavigationSession();
  if (page === "navigate") initNavMap();
  if (page === "report") initReportMap();
  if (page === "profile") hydrateProfile();
  if (page === "request-help") hydrateRequestHelp();
  if (page === "user-requests") initUserRequestsPage();
  if (page === "business-register") initBusinessRegisterPage();
  if (page === "business-dashboard") initBusinessDashboardPage();
  if (page === "volunteer-signin" || page === "volunteer-signup") syncVolunteerAuthUI();
  if (page === "volunteer-home") initVolunteerHome();

  window.scrollTo({ top: 0 });
}

/* ═══════════════════════════════════════
   GLOBAL EVENT BINDING
   ═══════════════════════════════════════ */
function bindGlobalEvents() {
  const $ = (id) => document.getElementById(id);

  $("hamburger").addEventListener("click", toggleMenu);

  // Home role entry
  $("roleUserButton")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.setItem("inkomek-role", JSON.stringify("user"));
    // Switch back to user mode: keep only user session
    state.volunteer = null;
    localStorage.removeItem(VOLUNTEER_SESSION_KEY);
    syncVolunteerAuthUI();
    // Lead to the user login/registration flow
    location.hash = state.user ? "#profile" : "#signin";
  });
  $("roleVolunteerButton")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.setItem("inkomek-role", JSON.stringify("volunteer"));
    location.hash = state.volunteer ? "#volunteer-home" : "#volunteer-signin";
  });

  // Home: business entry
  $("businessEntryButton")?.addEventListener("click", () => {
    const bizId = getBusinessSessionId();
    const biz = bizId ? getBusinessById(bizId) : null;
    location.hash = biz ? "#business-dashboard" : "#business-register";
  });

  $("navigationForm")?.addEventListener("submit", handleNavigateSubmit);
  $("useCurrentLocationButton")?.addEventListener("click", populateStartFromCurrentLocation);
  $("refreshLocationButton")?.addEventListener("click", () => refreshCurrentLocation({ centerMap: true, silent: false }));
  $("dismissAnomalyBannerButton")?.addEventListener("click", () => {
    document.getElementById("anomalyBanner")?.classList.add("hidden");
  });
  $("reportForm")?.addEventListener("submit", handleReportSubmit);
  $("sosButton")?.addEventListener("click", handleSosPress);
  $("logoutButton")?.addEventListener("click", handleLogout);
  $("signinForm")?.addEventListener("submit", handleSignIn);
  $("signupForm")?.addEventListener("submit", handleSignUp);
  $("forgotForm")?.addEventListener("submit", handleForgotPassword);
  $("profileForm")?.addEventListener("submit", handleProfileSave);
  $("deleteAccountButton")?.addEventListener("click", handleDeleteAccount);

  // User: request help
  $("requestHelpForm")?.addEventListener("submit", handleRequestHelpSubmit);
  $("refreshRequestGpsButton")?.addEventListener("click", hydrateRequestHelp);

  // User: track volunteer requests
  $("refreshUserRequestsGpsButton")?.addEventListener("click", () => refreshUserRequestsGps({ centerMap: true, silent: false }));

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

  // Profile document upload UI
  $("profileDocument")?.addEventListener("change", (e) => {
    const name = e.target.files?.[0]?.name || "";
    const file = e.target.files?.[0];
    const fileNameEl = $("profileDocumentFileName");
    if (fileNameEl) fileNameEl.textContent = name;

    if (!file) return;
    verifyUserDisabilityDocument(file).catch(() => {});
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

  // Volunteer forms / actions
  $("volunteerLogoutButton")?.addEventListener("click", handleVolunteerLogout);
  $("volunteerAvailableBtn")?.addEventListener("click", () => setVolunteerAvailability("available"));
  $("volunteerBusyBtn")?.addEventListener("click", () => setVolunteerAvailability("busy"));
  $("volunteerSignupForm")?.addEventListener("submit", handleVolunteerSignUp);
  $("volunteerSigninForm")?.addEventListener("submit", handleVolunteerSignIn);

  // Businesses: filter and actions on navigation map
  $("businessFilterToggleButton")?.addEventListener("click", () => {
    state.businessFilterOvzOnly = !state.businessFilterOvzOnly;
    const btn = document.getElementById("businessFilterToggleButton");
    if (btn) btn.textContent = state.businessFilterOvzOnly ? "Показать все бизнесы" : "Показать бизнесы для ОВЗ";
    hideBusinessCard();
    if (state.navMap) renderBusinessPins(state.navMap);
  });
  $("userType")?.addEventListener("change", () => {
    if (!state.navMap) return;
    if (state.businessFilterOvzOnly) renderBusinessPins(state.navMap);
  });

  // Businesses: registration
  $("businessShortDescription")?.addEventListener("input", () => initBusinessRegisterShortCounter());
  $("businessGeocodeButton")?.addEventListener("click", () => {
    const address = document.getElementById("businessAddress")?.value;
    geocodeAndPlaceRegPin(address);
  });
  $("businessUseMyLocationButton")?.addEventListener("click", () => useMyLocationForRegBusiness());
  $("businessRegisterForm")?.addEventListener("submit", handleBusinessRegisterSubmit);
  $("businessPhoto")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    const nameEl = document.getElementById("businessPhotoName");
    if (nameEl) nameEl.textContent = file?.name || "";
    if (!file) {
      state.businessRegisterPhotoDataUrl = null;
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(new Error("file read error"));
        fr.readAsDataURL(file);
      });
      state.businessRegisterPhotoDataUrl = dataUrl;
    } catch {
      state.businessRegisterPhotoDataUrl = null;
    }
  });

  // Businesses: dashboard edit
  $("businessEditShortDescription")?.addEventListener("input", () => initBusinessEditShortCounter());
  $("businessEditGeocodeButton")?.addEventListener("click", () => {
    const address = document.getElementById("businessEditAddress")?.value;
    geocodeAndPlaceDashPin(address);
  });
  $("businessEditUseMyLocationButton")?.addEventListener("click", () => useMyLocationForDashBusiness());
  $("businessEditForm")?.addEventListener("submit", handleBusinessEditSubmit);

  // Pricing buttons (local-only)
  document.addEventListener("click", (e) => {
    const planBtn = e.target.closest?.("[data-business-plan-cta]");
    if (planBtn) {
      const plan = planBtn.getAttribute("data-business-plan-cta") || "starter";
      localStorage.setItem("inkomek-selected-business-plan", JSON.stringify(plan));
      location.hash = "#business-register";
      return;
    }

    const routeBtn = e.target.closest?.("[data-business-route-to-inkomek]");
    if (routeBtn) {
      prefillNavigateToInkomek();
    }
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

  const existingUser = loadUser();
  state.user = {
    name: user.name,
    email,
    phone: user.phone || "",
    disability: user.disability || user.disability_type || "",
    disability_type: user.disability_type || user.disability || "",
    emergencyContact: user.emergencyContact || "",
  };
  // Preserve document verification state if it exists for this user.
  if (existingUser && existingUser.email === email) {
    state.user = { ...state.user, ...existingUser };
  }
  persistUser();
  syncAuthUI();
  showStatus(statusEl, "Вы вошли!", "success");
  setTimeout(() => (location.hash = "#navigate"), 600);
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

  stored[email] = { name, password, phone, disability, disability_type: disability };
  localStorage.setItem("inkomek-users", JSON.stringify(stored));

  state.user = { name, email, phone, disability, disability_type: disability, emergencyContact: "" };
  persistUser();
  syncAuthUI();
  showStatus(statusEl, "Аккаунт создан!", "success");
  setTimeout(() => (location.hash = "#navigate"), 600);
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
  const navUserNameEl = document.getElementById("navUserName");
  const navBadgeEl = document.getElementById("navVerificationBadge");

  if (state.user) {
    authBlock?.classList.add("hidden");
    userBlock?.classList.remove("hidden");
    if (avatarEl) avatarEl.textContent = (state.user.name || "U").charAt(0).toUpperCase();
    if (navUserNameEl) navUserNameEl.textContent = state.user.name || "Пользователь";
    if (navBadgeEl) applyVerificationBadgeToEl(navBadgeEl, state.user);
  } else {
    authBlock?.classList.remove("hidden");
    userBlock?.classList.add("hidden");
  }
}

function persistUser() { localStorage.setItem("inkomek-user", JSON.stringify(state.user)); }
function loadUser() { try { return JSON.parse(localStorage.getItem("inkomek-user")); } catch { return null; } }

/* ═══════════════════════════════════════
   VOLUNTEER (local-only)
   ═══════════════════════════════════════ */
const VOLUNTEER_PROFILES_KEY = "inkomek-volunteers";
const VOLUNTEER_SESSION_KEY = "inkomek-volunteer-session";
const VOLUNTEER_STATUS_KEY = "inkomek-volunteer-status";
const HELP_REQUESTS_KEY = "inkomek-help-requests";
const HELP_REQUEST_SESSION_KEY = "inkomek-volunteer-active-request";
const LOCAL_BROWSER_ID_KEY = "inkomek-local-browser-id";

const BUSINESSES_KEY = "inkomek-businesses";
const BUSINESS_SESSION_KEY = "inkomek-business-session";

function getLocalBrowserId() {
  let id = localStorage.getItem(LOCAL_BROWSER_ID_KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(LOCAL_BROWSER_ID_KEY, id);
  }
  return id;
}

function persistVolunteerSession() {
  localStorage.setItem(VOLUNTEER_SESSION_KEY, JSON.stringify(state.volunteer));
  // Also store busy/available for UX persistence
  localStorage.setItem(VOLUNTEER_STATUS_KEY, JSON.stringify(state.volunteerAvailability));
}

function loadVolunteer() {
  try {
    return JSON.parse(localStorage.getItem(VOLUNTEER_SESSION_KEY));
  } catch {
    return null;
  }
}

function loadVolunteerAvailability() {
  try {
    const v = JSON.parse(localStorage.getItem(VOLUNTEER_STATUS_KEY));
    return v === "busy" || v === "available" ? v : "available";
  } catch {
    return "available";
  }
}

function persistVolunteerAvailability(next) {
  state.volunteerAvailability = next;
  localStorage.setItem(VOLUNTEER_STATUS_KEY, JSON.stringify(next));
}

function getVolunteerProfiles() {
  try {
    return JSON.parse(localStorage.getItem(VOLUNTEER_PROFILES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveVolunteerProfile(profile) {
  const phone = String(profile.phone || "").trim();
  if (!phone) return false;
  const stored = getVolunteerProfiles();
  stored[phone] = profile;
  localStorage.setItem(VOLUNTEER_PROFILES_KEY, JSON.stringify(stored));
  return true;
}

function getHelpRequests() {
  try {
    const raw = JSON.parse(localStorage.getItem(HELP_REQUESTS_KEY) || "null");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persistHelpRequests(list) {
  localStorage.setItem(HELP_REQUESTS_KEY, JSON.stringify(list));
}

function loadBusinesses() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persistBusinesses(list) {
  localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list));
}

function getBusinessSessionId() {
  return localStorage.getItem(BUSINESS_SESSION_KEY);
}

function setBusinessSessionId(id) {
  if (id) localStorage.setItem(BUSINESS_SESSION_KEY, id);
  else localStorage.removeItem(BUSINESS_SESSION_KEY);
}

function getBusinessById(businessId) {
  const list = loadBusinesses();
  return list.find((b) => b.id === businessId) || null;
}

function upsertBusiness(business) {
  const list = loadBusinesses();
  const idx = list.findIndex((b) => b.id === business.id);
  if (idx >= 0) list[idx] = business;
  else list.push(business);
  persistBusinesses(list);
  return business;
}

function categoryLabel(categoryKey) {
  const map = {
    medical_equipment: "Медицинское оборудование",
    rehabilitation_center: "Реабилитационный центр",
    specialized_clinic: "Специализированная клиника",
    accessible_transport: "Доступный транспорт",
    inclusive_sport_fitness: "Инклюзивный спорт и фитнес",
    education_ovz: "Обучение и образование для людей с ОВЗ",
    psychological_support: "Психологическая поддержка",
    accessible_housing: "Доступное жильё",
    other: "Другое",
  };
  return map[categoryKey] || categoryKey || "Другое";
}

function businessTagsLabel(tagKey) {
  const map = {
    wheelchair: "Инвалидная коляска",
    blind: "Слепые / слабовидящие",
    deaf: "Глухие / слабослышащие",
    elderly: "Пожилые",
    cognitive: "Интеллектуальные нарушения / когнитивные",
  };
  return map[tagKey] || tagKey;
}

function userTypeToOvzTags(userType) {
  const t = String(userType || "");
  if (t === "wheelchair") return ["wheelchair"];
  if (t === "blind") return ["blind"];
  if (t === "deaf") return ["deaf"];
  if (t === "elderly") return ["elderly"];
  if (t === "other") return ["cognitive"];
  return [];
}

function ensureMockHelpRequests() {
  const list = getHelpRequests();
  if (list.length) return list;

  const now = Date.now();
  const mock = [
    {
      id: `mock_${now}_1`,
      type: "wheelchair",
      location: [43.255, 76.93],
      note: "Нужна помощь с передвижением и сопровождением.",
      postedAt: now - 12 * 60_000,
      requester: { name: "Айгерим", phone: "+7 777 123 45 67" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_2`,
      type: "blind",
      location: [43.2415, 76.9482],
      note: "Помочь с ориентированием и переходом через дорогу.",
      postedAt: now - 33 * 60_000,
      requester: { name: "Марат", phone: "+7 701 234 56 78" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_3`,
      type: "elderly",
      location: [43.2312, 76.905],
      note: "Помочь дойти до аптеки и сумок.",
      postedAt: now - 5 * 60_000,
      requester: { name: "Сауле", phone: "+7 705 333 44 55" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_4`,
      type: "deaf",
      location: [43.246, 76.8885],
      note: "Сопровождение и помощь с коммуникацией.",
      postedAt: now - 48 * 60_000,
      requester: { name: "Ерлан", phone: "+7 771 987 65 43" },
      status: "open",
      acceptedByPhone: null,
    },
  ];

  persistHelpRequests(mock);
  return mock;
}

function getActiveRequestForVolunteer(volunteerPhone) {
  const list = getHelpRequests();
  if (!volunteerPhone) return null;
  const active = list.find((r) => r.status === "accepted" && r.acceptedByPhone === volunteerPhone);
  return active || null;
}

function fmtRelativeMinutes(ts) {
  const diffMs = Date.now() - Number(ts || 0);
  const diffMin = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMin <= 1) return "1 минуту назад";
  if (diffMin < 60) return `${diffMin} минут назад`;
  const diffH = Math.round(diffMin / 60);
  return diffH <= 1 ? "1 час назад" : `${diffH} часов назад`;
}

function haversineKm(a, b) {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const sLat1 = (lat1 * Math.PI) / 180;
  const sLat2 = (lat2 * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ═══════════════════════════════════════
   REQUEST HELP (USER -> localStorage)
   ═══════════════════════════════════════ */
async function hydrateRequestHelp() {
  const statusEl = document.getElementById("requestHelpLocationText");
  const wrapStatusEl = document.getElementById("requestHelpStatus");
  try {
    if (statusEl) statusEl.classList.remove("hidden");
    if (wrapStatusEl) wrapStatusEl.classList.add("hidden");

    if (state.currentLocation) {
      // already known; still keep UI fresh
    }

    const pos = await getCurrentPosition();
    const coords = [pos.coords.latitude, pos.coords.longitude];
    state.currentLocation = coords;

    const addr = await reverseGeocode(coords[0], coords[1]);
    state.currentAddress = addr;
    if (statusEl) statusEl.textContent = addr ? `Ваш адрес: ${addr}` : "Местоположение получено.";
  } catch {
    if (statusEl) statusEl.textContent = "Не удалось определить местоположение.";
    if (wrapStatusEl) showStatus(wrapStatusEl, "Включите геолокацию в браузере и попробуйте снова.", "error");
  }
}

function handleRequestHelpSubmit(e) {
  e.preventDefault();
  const typeEl = document.getElementById("requestHelpType");
  const noteEl = document.getElementById("requestHelpNote");
  const form = document.getElementById("requestHelpForm");
  const statusEl = document.getElementById("requestHelpStatus");

  if (!state.currentLocation || !isValidCoords(state.currentLocation)) {
    showStatus(statusEl, "Сначала определите местоположение.", "error");
    return;
  }

  if (!typeEl) return;

  const request = {
    id: `req_${Date.now()}`,
    type: typeEl.value,
    location: state.currentLocation,
    note: (noteEl?.value || "").trim(),
    postedAt: Date.now(),
    requester: {
      name: state.user?.name || "Пользователь",
      phone: state.user?.phone || "",
      localId: getLocalBrowserId(),
    },
    status: "open",
    acceptedByPhone: null,
    acceptedLocation: null,
  };

  const list = ensureMockHelpRequests();
  list.push(request);
  persistHelpRequests(list);

  if (form) form.reset();
  showStatus(statusEl, "Запрос отправлен. Волонтёры увидят его в своей ленте.", "success");

  // subtle delay for screen readers
  setTimeout(() => (location.hash = "#user-requests"), 900);
}

/* ═══════════════════════════════════════
   USER REQUESTS PAGE (volunteer services)
   ═══════════════════════════════════════ */
function stopUserRequestsPolling() {
  if (state.userRequestsGpsTimer) {
    clearInterval(state.userRequestsGpsTimer);
    state.userRequestsGpsTimer = null;
  }
  if (state.userRequestsPollTimer) {
    clearInterval(state.userRequestsPollTimer);
    state.userRequestsPollTimer = null;
  }
}

function getMyHelpRequests() {
  const bid = getLocalBrowserId();
  return getHelpRequests()
    .filter((r) => r?.requester?.localId === bid)
    .sort((a, b) => Number(b.postedAt) - Number(a.postedAt));
}

function getMyActiveRequest() {
  const mine = getMyHelpRequests();
  if (!mine.length) return null;

  const accepted = mine.find((r) => r.status === "accepted");
  return accepted || mine[0] || null;
}

function statusLabelForUser(status) {
  if (status === "accepted") return "Принято волонтёром";
  if (status === "closed") return "Завершено";
  return "В ожидании волонтёра";
}

function initUserRequestsPage() {
  const el = document.getElementById("userRequestsMap");
  if (!el || el.offsetHeight === 0) return;

  if (state.userRequestsMap) {
    state.userRequestsMap.invalidateSize();
  } else {
    state.userRequestsMap = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(state.userRequestsMap);
  }

  ensureMockHelpRequests();
  renderUserRequestsPage();

  stopUserRequestsPolling();
  refreshUserRequestsGps({ centerMap: false, silent: true });
  state.userRequestsGpsTimer = setInterval(() => refreshUserRequestsGps({ centerMap: false, silent: true }), 15_000);
  state.userRequestsPollTimer = setInterval(() => renderUserRequestsPage(), 6_000);
}

async function refreshUserRequestsGps({ centerMap = false, silent = true } = {}) {
  if (!state.userRequestsMap) return;
  try {
    const pos = await getCurrentPosition();
    const coords = [pos.coords.latitude, pos.coords.longitude];
    state.currentLocation = coords;

    if (centerMap) state.userRequestsMap.setView(coords, 13);

    const statusEl = document.getElementById("userRequestsGpsStatus");
    if (statusEl && !silent) {
      statusEl.textContent = "GPS обновлён.";
    }

    renderUserRequestsMap(getMyActiveRequest());
  } catch {
    const statusEl = document.getElementById("userRequestsGpsStatus");
    if (statusEl && !silent) statusEl.textContent = "Не удалось получить GPS.";
  }
}

function clearUserRequestsRouteAndMarkers() {
  if (state.userRequestsRouteLine) {
    state.userRequestsRouteLine.remove();
    state.userRequestsRouteLine = null;
  }
  if (state.userRequestsUserMarker) {
    state.userRequestsUserMarker.remove();
    state.userRequestsUserMarker = null;
  }
  if (state.userRequestsVolunteerMarker) {
    state.userRequestsVolunteerMarker.remove();
    state.userRequestsVolunteerMarker = null;
  }
}

function renderUserRequestsPage() {
  const listEl = document.getElementById("userRequestsList");
  const emptyEl = document.getElementById("userRequestsEmptyState");
  const activeWrap = document.getElementById("userRequestsActiveWrap");
  if (!listEl || !emptyEl || !activeWrap) return;

  const mine = getMyHelpRequests();
  if (!mine.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    activeWrap.innerHTML = `
      <div class="status status-neutral">
        У вас пока нет запросов.
        <a href="#request-help" class="primary-button" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center; margin-top:12px; min-height:56px;">
          Запросить помощь
        </a>
      </div>
    `;
    clearUserRequestsRouteAndMarkers();
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.innerHTML = mine.slice(0, 5).map((r) => {
    const dist = state.currentLocation ? haversineKm(state.currentLocation, r.location) : null;
    const distText = dist == null ? "—" : dist < 1 ? `${Math.round(dist * 1000)} м` : `${dist.toFixed(1)} км`;
    return `
      <div class="request-card" data-user-request-id="${esc(r.id)}" aria-label="Запрос">
        <div class="request-meta">
          <div><strong>Помощь:</strong> <span>${esc(helpTypeLabel(r.type))}</span></div>
          <div><strong>Статус:</strong> <span>${esc(statusLabelForUser(r.status))}</span></div>
          <div><strong>Расстояние:</strong> <span>${esc(distText)}</span></div>
          <div><strong>Время:</strong> <span>${esc(fmtRelativeMinutes(r.postedAt))}</span></div>
        </div>
      </div>
    `;
  }).join("");

  const active = getMyActiveRequest();
  renderUserRequestsActive(active);
  renderUserRequestsMap(active);
}

function renderUserRequestsActive(active) {
  const activeWrap = document.getElementById("userRequestsActiveWrap");
  if (!activeWrap) return;

  if (!active) {
    activeWrap.innerHTML = "";
    return;
  }

  if (active.status === "accepted") {
    const volProfiles = getVolunteerProfiles();
    const volunteer = active.acceptedByPhone ? volProfiles[active.acceptedByPhone] : null;
    const contactName = volunteer?.fullName || "Волонтёр";
    const contactPhone = volunteer?.phone || active.acceptedByPhone || "Телефон не указан";
    const volunteerDistrict = volunteer?.districtArea ? `, ${volunteer.districtArea}` : "";

    const note = active.note ? `<div style="margin-top:10px;">${esc(active.note)}</div>` : "";

    activeWrap.innerHTML = `
      <div class="request-card">
        <div class="request-meta">
          <div><strong>Статус:</strong> <span>${esc(statusLabelForUser(active.status))}</span></div>
          <div><strong>Волонтёр:</strong> <span>${esc(contactName)} (${esc(contactPhone)})</span></div>
          <div><strong>Территория:</strong> <span>${esc(volunteer?.city || "—")}${esc(volunteerDistrict)}</span></div>
          <div><strong>Время:</strong> <span>${esc(fmtRelativeMinutes(active.postedAt))}</span></div>
        </div>

        <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
          <a class="primary-button" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center; flex:1; min-width:220px;"
             href="tel:${esc(String(contactPhone).replaceAll(" ", ""))}">
            Связаться по телефону
          </a>
        </div>
        ${note}
        <div id="userRequestsActiveHint" class="status status-neutral" style="margin-top:12px;" role="status" aria-live="polite">
          Маршрут построен на карте, если доступны координаты волонтёра.
        </div>
      </div>
    `;
    return;
  }

  if (active.status === "closed") {
    activeWrap.innerHTML = `
      <div class="status status-neutral">Ваш запрос завершён.</div>
    `;
    return;
  }

  // open
  const note = active.note ? `<div style="margin-top:10px;">Заметка: ${esc(active.note)}</div>` : "";
  activeWrap.innerHTML = `
    <div class="request-card">
      <div class="request-meta">
        <div><strong>Статус:</strong> <span>${esc(statusLabelForUser(active.status))}</span></div>
        <div><strong>Помощь:</strong> <span>${esc(helpTypeLabel(active.type))}</span></div>
        <div><strong>Время:</strong> <span>${esc(fmtRelativeMinutes(active.postedAt))}</span></div>
      </div>
      ${note}
      <div class="status status-neutral" style="margin-top:12px;" role="status" aria-live="polite">
        Как только волонтёр примет запрос, здесь появятся контакты и маршрут.
      </div>
    </div>
  `;
}

function renderUserRequestsMap(active) {
  if (!state.userRequestsMap) return;
  clearUserRequestsRouteAndMarkers();

  const userCoords = state.currentLocation;
  if (!userCoords || !isValidCoords(userCoords)) return;

  state.userRequestsUserMarker = L.circleMarker(userCoords, {
    radius: 10,
    // Match legend: user is blue
    color: "#3B1F0A",
    fillColor: "#1263bf",
    fillOpacity: 0.95,
    weight: 3,
  }).addTo(state.userRequestsMap);
  state.userRequestsUserMarker.bindPopup("Вы");

  if (active?.status === "accepted" && active.acceptedLocation && isValidCoords(active.acceptedLocation)) {
    const volCoords = active.acceptedLocation;
    state.userRequestsVolunteerMarker = L.circleMarker(volCoords, {
      radius: 10,
      // Match legend: volunteer is red
      color: "#3B1F0A",
      fillColor: "#b71c1c",
      fillOpacity: 0.95,
      weight: 2,
    }).addTo(state.userRequestsMap);
    state.userRequestsVolunteerMarker.bindPopup("Волонтёр");

    state.userRequestsRouteLine = L.polyline([userCoords, volCoords], {
      color: "var(--yellow-dark)",
      weight: 6,
      opacity: 0.95,
      dashArray: "8 8",
    }).addTo(state.userRequestsMap);

    // Center between both points for better visibility
    const midLat = (userCoords[0] + volCoords[0]) / 2;
    const midLon = (userCoords[1] + volCoords[1]) / 2;
    state.userRequestsMap.setView([midLat, midLon], 13, { animate: true });
  } else {
    // No accepted route yet; center on user
    state.userRequestsMap.setView(userCoords, 13, { animate: true });
  }
}

/* ═══════════════════════════════════════
   VOLUNTEER (local-only)
   ═══════════════════════════════════════ */
function syncVolunteerAuthUI() {
  const navVolunteer = document.querySelector(".nav-volunteer-link");
  if (state.volunteer && navVolunteer) navVolunteer.classList.remove("hidden");
  if (!state.volunteer && navVolunteer) navVolunteer.classList.add("hidden");

  // Volunteer home may show profile hint; keep simple for now
}

function setVolunteerAvailability(next) {
  if (!state.volunteer) return;

  // If volunteer switches to available, we consider the active request finished.
  if (next === "available") {
    const active = getActiveRequestForVolunteer(state.volunteer.phone);
    if (active) finishVolunteerActiveRequest(active.id, { silent: true });
  }

  persistVolunteerAvailability(next);
  renderVolunteerHome();
}

function handleVolunteerSignUp(e) {
  e.preventDefault();
  const form = document.getElementById("volunteerSignupForm");
  const statusEl = document.getElementById("volunteerSignupStatus");

  const fullName = document.getElementById("volunteerFullName")?.value.trim();
  const phone = document.getElementById("volunteerPhone")?.value.trim();
  const city = document.getElementById("volunteerCity")?.value;
  const districtArea = document.getElementById("volunteerDistrict")?.value.trim();

  const availWeekdays = document.getElementById("availWeekdays")?.checked;
  const availWeekends = document.getElementById("availWeekends")?.checked;
  const availAlways = document.getElementById("availAlways")?.checked;

  const disabilities = [
    document.getElementById("helpWheelchair")?.checked ? "wheelchair" : null,
    document.getElementById("helpBlind")?.checked ? "blind" : null,
    document.getElementById("helpElderly")?.checked ? "elderly" : null,
    document.getElementById("helpDeaf")?.checked ? "deaf" : null,
  ].filter(Boolean);

  if (!fullName || !phone || !city || !districtArea) {
    showStatus(statusEl, "Заполните обязательные поля.", "error");
    return;
  }

  if (!availWeekdays && !availWeekends && !availAlways) {
    showStatus(statusEl, "Выберите, когда вы свободны.", "error");
    return;
  }

  if (!disabilities.length) {
    showStatus(statusEl, "Отметьте, с кем вы можете помогать.", "error");
    return;
  }

  const profile = {
    id: `vol_${phone}`,
    fullName,
    phone,
    city,
    districtArea,
    availability: { weekdays: !!availWeekdays, weekends: !!availWeekends, always: !!availAlways },
    disabilities,
    createdAt: Date.now(),
  };

  const ok = saveVolunteerProfile(profile);
  if (!ok) {
    showStatus(statusEl, "Не удалось сохранить профиль. Попробуйте еще раз.", "error");
    return;
  }

  state.volunteer = profile;
  persistVolunteerSession();
  persistVolunteerAvailability("available");

  showStatus(statusEl, "Профиль волонтёра сохранён.", "success");
  setTimeout(() => (location.hash = "#volunteer-home"), 700);
}

function handleVolunteerSignIn(e) {
  e.preventDefault();
  const phone = document.getElementById("volunteerSigninPhone")?.value.trim();
  const statusEl = document.getElementById("volunteerSigninStatus");

  if (!phone) {
    showStatus(statusEl, "Введите телефон.", "error");
    return;
  }

  const profiles = getVolunteerProfiles();
  const profile = profiles[phone];

  if (!profile) {
    showStatus(statusEl, "Профиль с таким телефоном не найден. Зарегистрируйтесь.", "error");
    setTimeout(() => (location.hash = "#volunteer-signup"), 600);
    return;
  }

  state.volunteer = profile;
  persistVolunteerSession();
  persistVolunteerAvailability(loadVolunteerAvailability());
  syncVolunteerAuthUI();
  showStatus(statusEl, "Вы вошли как волонтёр.", "success");
  setTimeout(() => (location.hash = "#volunteer-home"), 650);
}

function handleVolunteerLogout() {
  state.volunteer = null;
  localStorage.removeItem(VOLUNTEER_SESSION_KEY);
  syncVolunteerAuthUI();
  location.hash = "#home";
}

function getVolunteerMatchedOpenRequests() {
  const all = ensureMockHelpRequests();
  const open = all.filter((r) => r.status === "open");
  if (!state.volunteer) return open;

  const disabilities = state.volunteer.disabilities || [];
  if (!disabilities.length) return open;

  return open.filter((r) => disabilities.includes(r.type));
}

function renderVolunteerAvailabilityControls() {
  const availableBtn = document.getElementById("volunteerAvailableBtn");
  const busyBtn = document.getElementById("volunteerBusyBtn");
  if (!availableBtn || !busyBtn) return;

  const isBusy = state.volunteerAvailability === "busy";
  availableBtn.classList.toggle("active", !isBusy);
  busyBtn.classList.toggle("active", isBusy);
}

function renderVolunteerHome() {
  const activeWrap = document.getElementById("volunteerActiveRequest");
  const list = document.getElementById("volunteerRequestsList");
  const empty = document.getElementById("volunteerEmptyState");

  renderVolunteerAvailabilityControls();

  if (!state.volunteer) {
    if (activeWrap) activeWrap.classList.add("hidden");
    if (list) list.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }

  const active = getActiveRequestForVolunteer(state.volunteer.phone);
  state.volunteerActiveRequestId = active?.id || null;

  if (active && state.volunteerAvailability !== "busy") {
    persistVolunteerAvailability("busy");
    renderVolunteerAvailabilityControls();
  }
  if (!active) clearVolunteerRoute();

  if (active) {
    if (empty) empty.classList.add("hidden");
    if (list) list.innerHTML = "";
    if (activeWrap) {
      activeWrap.classList.remove("hidden");
      renderVolunteerActiveRequest(active);
    }
    drawVolunteerRoute(active.location);
    renderVolunteerMarkers([active]); // show route + active marker
    return;
  }

  if (activeWrap) activeWrap.classList.add("hidden");

  const requests = getVolunteerMatchedOpenRequests();
  const containerList = list;
  if (!containerList) return;
  containerList.innerHTML = "";

  if (!requests.length) {
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  const distanceFromMe = (loc) => (state.volunteerLocation ? haversineKm(state.volunteerLocation, loc) : null);

  const nodes = requests
    .sort((a, b) => Number(b.postedAt) - Number(a.postedAt))
    .map((r) => {
      const dist = distanceFromMe(r.location);
      const distText = dist == null ? "—" : dist < 1 ? `${Math.round(dist * 1000)} м` : `${dist.toFixed(1)} км`;
      return `
        <div class="request-card" data-request-id="${esc(r.id)}">
          <div class="request-meta">
            <div><strong>Нужна помощь:</strong> <span>${esc(helpTypeLabel(r.type))}</span></div>
            <div><strong>Расстояние:</strong> <span>${esc(distText)}</span></div>
            <div><strong>Время:</strong> <span>${esc(fmtRelativeMinutes(r.postedAt))}</span></div>
          </div>
          <button type="button"
            class="primary-button volunteer-accept-btn"
            data-volunteer-action="accept"
            data-request-id="${esc(r.id)}"
            ${state.volunteerAvailability === "busy" ? "disabled" : ""}>
            Принять запрос
          </button>
        </div>
      `;
    })
    .join("");
  containerList.innerHTML = nodes;

  renderVolunteerMarkers(requests);
}

function helpTypeLabel(type) {
  const map = {
    wheelchair: "Инвалидная коляска",
    blind: "Слепые / слабовидящие",
    elderly: "Пожилые",
    deaf: "Глухие / слабослышащие",
  };
  return map[type] || "Помощь";
}

function renderVolunteerActiveRequest(active) {
  const wrap = document.getElementById("volunteerActiveRequest");
  if (!wrap) return;

  const contact = active?.requester || {};
  const name = contact.name || "Пользователь";
  const phone = contact.phone || "Телефон не указан";

  const note = active?.note ? `<div style="margin-top:10px;">${esc(active.note)}</div>` : "";
  const posted = `<div class="status status-neutral" style="margin-top:10px;">Размещено: ${esc(fmtRelativeMinutes(active.postedAt))}</div>`;

  wrap.innerHTML = `
    <div class="request-card">
      <div class="request-meta">
        <div><strong>Запрос:</strong> <span>${esc(helpTypeLabel(active.type))}</span></div>
        <div><strong>Контакты:</strong> <span>${esc(name)} — ${esc(phone)}</span></div>
      </div>
      ${posted}
      ${note}
      <div style="display:flex; gap:12px; margin-top:14px; flex-wrap:wrap;">
        <button type="button" id="volunteerFinishActiveRequest" class="primary-button" style="flex:1; min-width:220px;">
          Завершить маршрут
        </button>
        <button type="button" id="volunteerCancelActiveRequest" class="secondary-button" style="flex:1; min-width:220px;">
          Отменить (стать доступным)
        </button>
      </div>
      <div id="volunteerActiveRequestStatus" class="status hidden" style="margin-top:12px;" role="status" aria-live="polite"></div>
    </div>
  `;
}

function clearVolunteerRoute() {
  if (state.volunteerRouteLine) {
    state.volunteerRouteLine.remove();
    state.volunteerRouteLine = null;
  }
}

function drawVolunteerRoute(destCoords) {
  clearVolunteerRoute();
  if (!state.volunteerLocation || !destCoords) return;
  if (!state.volunteerMap) return;

  state.volunteerRouteLine = L.polyline([state.volunteerLocation, destCoords], {
    color: "var(--yellow-dark)",
    weight: 6,
    opacity: 0.95,
    dashArray: "10 8",
  }).addTo(state.volunteerMap);
}

function renderVolunteerMarkers(requests) {
  if (!state.volunteerMap) return;

  // Clear previous markers
  for (const m of state.volunteerRequestMarkers || []) m.marker.remove();
  state.volunteerRequestMarkers = [];

  if (state.volunteerUserMarker) state.volunteerUserMarker.remove();
  state.volunteerUserMarker = null;

  // User marker
  if (state.volunteerLocation && state.volunteerMap) {
    state.volunteerUserMarker = L.circleMarker(state.volunteerLocation, {
      radius: 9,
      color: "#3B1F0A",
      fillColor: "var(--yellow)",
      fillOpacity: 0.95,
      weight: 3,
    }).addTo(state.volunteerMap);
    state.volunteerUserMarker.bindPopup("Вы (волонтёр)");
  }

  // Request markers
  for (const r of requests || []) {
    const isActive = r.status === "accepted";
    const marker = L.circleMarker(r.location, {
      radius: isActive ? 10 : 8,
      color: isActive ? "#B71C1C" : "#3B1F0A",
      fillColor: isActive ? "#FBE7E7" : "var(--yellow)",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(state.volunteerMap);

    marker.bindPopup(`${helpTypeLabel(r.type)}<br>${esc(r.requester?.name || "Пользователь")}`);
    state.volunteerRequestMarkers.push({ id: r.id, marker });
  }
}

async function refreshVolunteerLocation({ centerMap = false, silent = true } = {}) {
  if (!state.volunteerMap) return;

  try {
    const pos = await getCurrentPosition();
    const coords = [pos.coords.latitude, pos.coords.longitude];
    state.volunteerLocation = coords;

    if (centerMap) state.volunteerMap.setView(coords, 13);

    const statusEl = document.getElementById("volunteerGpsStatus");
    if (statusEl && !silent) {
      const addr = await reverseGeocode(coords[0], coords[1]);
      statusEl.textContent = addr ? `GPS: ${addr}` : "GPS обновлён.";
    }

    renderVolunteerHome();
  } catch {
    const statusEl = document.getElementById("volunteerGpsStatus");
    if (statusEl && !silent) statusEl.textContent = "Не удалось получить GPS.";
  }
}

function bindVolunteerHomeEventsOnce() {
  if (state.volunteerEventsBound) return;
  state.volunteerEventsBound = true;

  const list = document.getElementById("volunteerRequestsList");
  const activeWrap = document.getElementById("volunteerActiveRequest");

  // Accept request from list (event delegation)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-volunteer-action='accept']");
    if (!btn) return;
    if (!state.volunteer) return;

    const requestId = btn.getAttribute("data-request-id");
    if (!requestId) return;

    acceptVolunteerRequest(requestId);
  });

  // Finish/cancel active request
  document.addEventListener("click", (e) => {
    const finishBtn = e.target.closest?.("#volunteerFinishActiveRequest");
    const cancelBtn = e.target.closest?.("#volunteerCancelActiveRequest");
    if (!finishBtn && !cancelBtn) return;
    const active = getActiveRequestForVolunteer(state.volunteer?.phone);
    if (!active) return;

    if (finishBtn) finishVolunteerActiveRequest(active.id, { silent: false });
    if (cancelBtn) finishVolunteerActiveRequest(active.id, { silent: true, cancel: true });
  });
}

function acceptVolunteerRequest(requestId) {
  if (!state.volunteer) return;
  const statusEl = document.getElementById("volunteerActiveRequestStatus");

  if (state.volunteerAvailability === "busy") {
    showStatus(statusEl, "Сначала завершите текущий маршрут.", "error");
    return;
  }

  const list = ensureMockHelpRequests();
  const idx = list.findIndex((r) => r.id === requestId);
  if (idx < 0) return;

  const active = getActiveRequestForVolunteer(state.volunteer.phone);
  if (active) return;

  const req = list[idx];
  if (!req || req.status !== "open") return;

  list[idx] = {
    ...req,
    status: "accepted",
    acceptedByPhone: state.volunteer.phone,
    acceptedLocation: state.volunteerLocation || null,
  };

  persistHelpRequests(list);
  persistVolunteerAvailability("busy");
  state.volunteerAvailability = "busy";
  state.volunteerActiveRequestId = req.id;

  renderVolunteerHome();
  drawVolunteerRoute(req.location);
  renderVolunteerMarkers([list[idx]]);
}

function finishVolunteerActiveRequest(requestId, { silent = false, cancel = false } = {}) {
  if (!state.volunteer) return;

  const list = ensureMockHelpRequests();
  const idx = list.findIndex((r) => r.id === requestId);
  if (idx < 0) return;

  // Close the request regardless of finish/cancel - local demo
  list[idx] = { ...list[idx], status: "closed", acceptedByPhone: null };

  // After finishing, set back to available.
  // Keep "status: closed" so it disappears from feed.
  persistHelpRequests(list);
  persistVolunteerAvailability("available");
  state.volunteerAvailability = "available";
  state.volunteerActiveRequestId = null;

  if (!silent) {
    const statusEl = document.getElementById("volunteerActiveRequestStatus");
    if (statusEl) showStatus(statusEl, cancel ? "Вы стали доступны." : "Маршрут завершён.", "success");
  }

  // Re-render feed without active request
  state.volunteerLocation = state.volunteerLocation || null;
  renderVolunteerHome();
  clearVolunteerRoute();
  renderVolunteerMarkers(getVolunteerMatchedOpenRequests());
}

function initVolunteerHome() {
  if (!state.volunteer) return;
  const el = document.getElementById("volunteerMap");
  if (!el || el.offsetHeight === 0) return;

  bindVolunteerHomeEventsOnce();

  // Map init
  if (state.volunteerMap) {
    state.volunteerMap.invalidateSize();
  } else {
    state.volunteerMap = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(state.volunteerMap);
  }

  // ensure data seeded
  ensureMockHelpRequests();

  // render first state
  state.volunteerAvailability = loadVolunteerAvailability();
  renderVolunteerHome();

  // First GPS refresh + periodic updates (local-only)
  if (state.volunteerGpsTimer) clearInterval(state.volunteerGpsTimer);
  refreshVolunteerLocation({ centerMap: false, silent: true });
  state.volunteerGpsTimer = setInterval(() => {
    refreshVolunteerLocation({ centerMap: false, silent: true });
  }, 15_000);
}

function stopVolunteerPolling() {
  if (state.volunteerGpsTimer) {
    clearInterval(state.volunteerGpsTimer);
    state.volunteerGpsTimer = null;
  }
}

/* ═══════════════════════════════════════
   DOCUMENT VERIFICATION (Gemini via backend)
   ═══════════════════════════════════════ */
const VERIFY_DOCUMENT_PATH = "/api/verify-document";

function deriveVerificationUi(user) {
  const v = user?.documentVerification;
  if (v && typeof v.is_valid_document === "boolean") {
    const isValid = v.is_valid_document;
    const confidence = Number(v.confidence || 0);
    if (!isValid) {
      return { statusKey: "not-verified", text: "❌ Не верифицировано", className: "not-verified" };
    }
    if (confidence > 0.7) {
      return { statusKey: "verified", text: "✅ Верифицирован", className: "verified" };
    }
    if (confidence >= 0.4 && confidence <= 0.7) {
      return { statusKey: "under", text: "🟡 На проверке", className: "under" };
    }
    return { statusKey: "under", text: "🟡 На проверке", className: "under" };
  }

  // Legacy/mock fallback
  const legacyStatus = user?.verificationStatus;
  if (legacyStatus === "verified") return { statusKey: "verified", text: "✅ Верифицирован", className: "verified" };
  if (legacyStatus === "under_verification" || legacyStatus === "under") {
    return { statusKey: "under", text: "🟡 На проверке", className: "under" };
  }
  return { statusKey: "not-verified", text: "❌ Не верифицировано", className: "not-verified" };
}

function applyVerificationBadgeToEl(el, user) {
  if (!el) return;
  const ui = deriveVerificationUi(user);
  el.classList.remove("verified", "under", "not-verified");
  el.classList.add(ui.className);
  el.textContent = ui.text;
}

async function verifyUserDisabilityDocument(file) {
  if (!state.user) {
    location.hash = "#signin";
    return;
  }

  const profileStatusEl = document.getElementById("profileStatus");
  const profileBadgeEl = document.getElementById("profileVerificationBadge");
  const navBadgeEl = document.getElementById("navVerificationBadge");

  // Show loading state immediately
  const loadingUi = { statusKey: "under", text: "🟡 На проверке", className: "under" };
  if (profileBadgeEl) {
    profileBadgeEl.classList.remove("verified", "under", "not-verified");
    profileBadgeEl.classList.add(loadingUi.className);
    profileBadgeEl.textContent = loadingUi.text;
  }
  if (navBadgeEl) {
    navBadgeEl.classList.remove("verified", "under", "not-verified");
    navBadgeEl.classList.add(loadingUi.className);
    navBadgeEl.textContent = loadingUi.text;
  }
  showStatus(profileStatusEl, "Проверяем документ...", "loading");

  const formData = new FormData();
  // Field name must match backend parameter name `image`.
  formData.append("image", file);

  try {
    const res = await fetch(`${BASE_URL}${VERIFY_DOCUMENT_PATH}`, {
      method: "POST",
      body: formData,
    });

    const payloadText = await res.text();
    let payload = null;
    try {
      payload = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const detail = payload?.reason || payload?.detail || payload?.message || payloadText || `HTTP ${res.status}`;
      throw new Error(detail);
    }

    if (!payload || typeof payload.is_valid_document !== "boolean") {
      throw new Error("Некорректный ответ сервера.");
    }

    state.user.documentVerification = payload;
    state.user.verificationStatus = deriveVerificationUi(state.user).statusKey;
    state.user.verificationConfidence = Number(payload.confidence || 0);
    state.user.verificationReason = payload.reason || "";

    persistUser();
    syncAuthUI();
    hydrateProfile();

    const ui = deriveVerificationUi(state.user);
    const tone = ui.statusKey === "verified" ? "success" : ui.statusKey === "not-verified" ? "error" : "loading";
    const payload2 = state.user.documentVerification || {};
    const docType = payload2.document_type || payload2.documentType || "unknown";
    const conf = Number(payload2.confidence || state.user.verificationConfidence || 0);
    const reason = payload2.reason || state.user.verificationReason || "";
    const confText = `${conf.toFixed(2)}`;

    const msgVerified = `✅ Верифицирован. Тип: ${esc(docType)}. Уверенность: ${esc(confText)}. ${esc(reason)}`;
    const msgNotVerified = `❌ Не верифицировано. Тип: ${esc(docType)}. Уверенность: ${esc(confText)}. ${esc(reason)}`;
    const msgUnder = `🟡 На проверке. Тип: ${esc(docType)}. Уверенность: ${esc(confText)}. ${esc(reason)}`;
    showStatus(
      profileStatusEl,
      ui.statusKey === "verified" ? msgVerified : ui.statusKey === "not-verified" ? msgNotVerified : msgUnder,
      tone === "loading" ? "neutral" : tone
    );
  } catch (err) {
    state.user.documentVerification = null;
    state.user.verificationStatus = "not-verified";
    persistUser();
    syncAuthUI();
    hydrateProfile();

    let msg = err instanceof Error ? err.message : "Ошибка проверки документа.";
    if (msg && msg.toLowerCase().includes("failed to fetch")) {
      msg = `Не удалось связаться с сервером. Проверьте доступность ${BASE_URL}${VERIFY_DOCUMENT_PATH} и CORS.`;
    }
    const ui = deriveVerificationUi(state.user);
    if (profileBadgeEl) applyVerificationBadgeToEl(profileBadgeEl, state.user);
    if (navBadgeEl) applyVerificationBadgeToEl(navBadgeEl, state.user);
    showStatus(profileStatusEl, msg, "error");
  }
}

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

  const badge = document.getElementById("profileVerificationBadge");
  applyVerificationBadgeToEl(badge, u);
}

function handleProfileSave(e) {
  e.preventDefault();
  if (!state.user) { location.hash = "#signin"; return; }

  state.user.name = document.getElementById("profileName").value.trim();
  state.user.phone = document.getElementById("profilePhone").value.trim();
  state.user.disability = document.getElementById("profileDisability").value;
  state.user.disability_type = state.user.disability;
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
  hideBusinessCard();
  renderReportPins(state.navMap);
  renderBusinessPins(state.navMap);
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
   AUTONOMOUS NAVIGATION HELPERS
   ═══════════════════════════════════════ */
function getStoredUserProfile() {
  try {
    return state.user || JSON.parse(localStorage.getItem("inkomek-user") || "null") || JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return state.user || null;
  }
}

function getProfileDisabilityType() {
  const profile = getStoredUserProfile() || {};
  return profile.disability_type || profile.disability || "";
}

function mapProfileDisabilityToRouteUserType(disabilityType) {
  const raw = String(disabilityType || "").trim().toLowerCase();
  if (raw === "wheelchair") return "wheelchair";
  if (raw === "blind" || raw === "vision" || raw === "visual") return "blind";
  if (raw === "elderly") return "elderly";
  if (raw === "deaf") return "elderly";
  return null;
}

function getDisplayDisabilityType(disabilityType) {
  const raw = String(disabilityType || "").trim().toLowerCase();
  if (["wheelchair", "blind", "elderly", "deaf"].includes(raw)) return raw;
  return "";
}

function getNavLoopIntervalMs(displayType) {
  return displayType === "blind" ? 3000 : 5000;
}

function shouldUseVoice(displayType) {
  return displayType === "wheelchair" || displayType === "elderly" || displayType === "blind";
}

function shouldUseHaptics(displayType) {
  return displayType === "deaf" || displayType === "blind";
}

function speakGuidance(text, { force = false } = {}) {
  if (!("speechSynthesis" in window) || !text) return;
  const now = Date.now();
  if (!force && state.activeNavLastInstruction === text && now - state.activeNavLastSpokenAt < 8000) return;

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ru-RU";
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
    state.activeNavLastSpokenAt = now;
    state.activeNavLastInstruction = text;
  } catch {
    // ignore speech synthesis failures
  }
}

function radians(v) { return (v * Math.PI) / 180; }
function degrees(v) { return (v * 180) / Math.PI; }
function distanceMeters(a, b) { return haversineKm(a, b) * 1000; }
function normalizeAngle(v) {
  let out = v;
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

function bearingDegrees(a, b) {
  const [lat1, lon1] = a.map(radians);
  const [lat2, lon2] = b.map(radians);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function cardinalDirection(bearing) {
  const dirs = ["север", "северо-восток", "восток", "юго-восток", "юг", "юго-запад", "запад", "северо-запад"];
  return dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

function turnDirectionFromDelta(delta) {
  if (Math.abs(delta) < 25) return "прямо";
  return delta > 0 ? "направо" : "налево";
}

function interpolatePoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function distancePointToSegmentMeters(p, a, b) {
  // local equirectangular approximation is good enough for city routing
  const latScale = 111320;
  const lonScale = Math.cos(radians((a[0] + b[0] + p[0]) / 3)) * 111320;
  const ax = a[1] * lonScale, ay = a[0] * latScale;
  const bx = b[1] * lonScale, by = b[0] * latScale;
  const px = p[1] * lonScale, py = p[0] * latScale;
  const abx = bx - ax, aby = by - ay;
  const ab2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + abx * t, qy = ay + aby * t;
  return Math.hypot(px - qx, py - qy);
}

function nearestRouteIndex(point, routeCoords) {
  if (!Array.isArray(routeCoords) || !routeCoords.length) return 0;
  let bestIdx = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < routeCoords.length; i += 1) {
    const d = distanceMeters(point, routeCoords[i]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function distanceToRouteMeters(point, routeCoords) {
  if (!Array.isArray(routeCoords) || routeCoords.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < routeCoords.length - 1; i += 1) {
    best = Math.min(best, distancePointToSegmentMeters(point, routeCoords[i], routeCoords[i + 1]));
  }
  return best;
}

function sampleRouteEvery(routeCoords, stepMeters = 30) {
  if (!Array.isArray(routeCoords) || routeCoords.length < 2) return [];
  const samples = [];
  let acc = 0;
  let nextTarget = stepMeters;
  for (let i = 1; i < routeCoords.length; i += 1) {
    const prev = routeCoords[i - 1];
    const curr = routeCoords[i];
    const seg = distanceMeters(prev, curr);
    while (acc + seg >= nextTarget) {
      const t = (nextTarget - acc) / seg;
      samples.push({ location: interpolatePoint(prev, curr, t), distanceFromStart: nextTarget, number: samples.length + 1, index: i });
      nextTarget += stepMeters;
    }
    acc += seg;
  }
  return samples;
}

function getNearbyRouteWarnings(routeCoords) {
  const warnings = [];
  for (const pin of state.reportPins || []) {
    if (!pin?.location) continue;
    const routeDistance = distanceToRouteMeters(pin.location, routeCoords);
    if (routeDistance <= 25) {
      warnings.push({
        type: pin.category || "warning",
        location: pin.location,
        distanceToRoute: routeDistance,
      });
    }
  }
  return warnings;
}

function getTurnWaypoints(routeCoords) {
  const turns = [];
  if (!Array.isArray(routeCoords) || routeCoords.length < 3) return turns;
  for (let i = 1; i < routeCoords.length - 1; i += 1) {
    const b1 = bearingDegrees(routeCoords[i - 1], routeCoords[i]);
    const b2 = bearingDegrees(routeCoords[i], routeCoords[i + 1]);
    const delta = normalizeAngle(b2 - b1);
    if (Math.abs(delta) >= 28) {
      turns.push({
        index: i,
        location: routeCoords[i],
        delta,
        direction: turnDirectionFromDelta(delta),
        bearing: b2,
      });
    }
  }
  return turns;
}

function getRouteBounds(routeCoords) {
  const lats = routeCoords.map((p) => p[0]);
  const lons = routeCoords.map((p) => p[1]);
  return {
    south: Math.min(...lats) - 0.002,
    north: Math.max(...lats) + 0.002,
    west: Math.min(...lons) - 0.002,
    east: Math.max(...lons) + 0.002,
  };
}

async function fetchRouteContextFromOsm(routeCoords) {
  try {
    const { south, west, north, east } = getRouteBounds(routeCoords);
    const query = `[out:json][timeout:15];(node["amenity"="bench"](${south},${west},${north},${east});node["highway"="steps"](${south},${west},${north},${east});way["highway"="steps"](${south},${west},${north},${east}););out center;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
    });
    if (!res.ok) return { benches: [], stairs: [] };
    const payload = await res.json();
    const benches = [];
    const stairs = [];
    for (const el of payload.elements || []) {
      const point = Number.isFinite(el.lat) && Number.isFinite(el.lon)
        ? [Number(el.lat), Number(el.lon)]
        : Number.isFinite(el.center?.lat) && Number.isFinite(el.center?.lon)
          ? [Number(el.center.lat), Number(el.center.lon)]
          : null;
      if (!point) continue;
      if (distanceToRouteMeters(point, routeCoords) > 35) continue;
      if (el.tags?.amenity === "bench") benches.push(point);
      if (el.tags?.highway === "steps") stairs.push(point);
    }
    return { benches, stairs };
  } catch {
    return { benches: [], stairs: [] };
  }
}

function createArrowDivIcon(direction) {
  const arrow = direction === "направо" ? "→" : direction === "налево" ? "←" : "↑";
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:999px;background:#7e57c2;color:white;display:flex;align-items:center;justify-content:center;font-weight:1000;border:2px solid white;box-shadow:0 10px 24px rgba(126,87,194,0.25)">${arrow}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createNumberDivIcon(number) {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:999px;background:#fb8c00;color:white;display:flex;align-items:center;justify-content:center;font-weight:1000;border:2px solid white;box-shadow:0 10px 24px rgba(251,140,0,0.25)">${number}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function clearActiveRouteDecorations() {
  for (const marker of state.activeNavWaypointMarkers || []) marker.remove?.();
  for (const marker of state.activeNavAuxMarkers || []) marker.remove?.();
  for (const marker of state.activeNavArrowMarkers || []) marker.remove?.();
  state.activeNavWaypointMarkers = [];
  state.activeNavAuxMarkers = [];
  state.activeNavArrowMarkers = [];
}

function renderAdaptiveRouteDecorations(displayType, routeCoords, routeMeta, osmContext) {
  clearActiveRouteDecorations();
  const mapInstance = state.navMap;
  if (!mapInstance) return;

  if (displayType === "blind") {
    for (const wp of routeMeta.numberedWaypoints || []) {
      const m = L.marker(wp.location, { icon: createNumberDivIcon(wp.number) }).addTo(mapInstance).bindPopup(`Точка ${wp.number}`);
      state.activeNavWaypointMarkers.push(m);
    }
  }

  if (displayType === "deaf") {
    for (const turn of routeMeta.turns || []) {
      const m = L.marker(turn.location, { icon: createArrowDivIcon(turn.direction) }).addTo(mapInstance).bindPopup(`Поворот ${turn.direction}`);
      state.activeNavArrowMarkers.push(m);
    }
  }

  if (displayType === "elderly") {
    for (const bench of osmContext.benches || []) {
      const m = L.circleMarker(bench, { radius: 7, color: "#2e7d32", fillColor: "#66bb6a", fillOpacity: 0.95, weight: 2 }).addTo(mapInstance).bindPopup("Точка отдыха / скамейка");
      state.activeNavAuxMarkers.push(m);
    }
    for (const steps of osmContext.stairs || []) {
      const m = L.circleMarker(steps, { radius: 8, color: "#a84300", fillColor: "#ffb74d", fillOpacity: 0.95, weight: 2 }).addTo(mapInstance).bindPopup("Лестница рядом с маршрутом");
      state.activeNavAuxMarkers.push(m);
    }
  }

  if (displayType === "wheelchair") {
    for (const warning of routeMeta.warnings || []) {
      const m = L.circleMarker(warning.location, { radius: 8, color: "#0d47a1", fillColor: "#42a5f5", fillOpacity: 0.98, weight: 2 }).addTo(mapInstance).bindPopup(`Предупреждение: ${warning.type}`);
      state.activeNavAuxMarkers.push(m);
    }
    for (const steps of osmContext.stairs || []) {
      const m = L.circleMarker(steps, { radius: 8, color: "#8f1414", fillColor: "#ef5350", fillOpacity: 0.98, weight: 2 }).addTo(mapInstance).bindPopup("Перепад / ступени рядом");
      state.activeNavAuxMarkers.push(m);
    }
  }
}

function setGuidanceUi(instructionText, nextDistanceText, modeText, visualTurnText = "", showVisualTurn = false) {
  const panel = document.getElementById("navGuidancePanel");
  const instructionEl = document.getElementById("navInstructionText");
  const nextEl = document.getElementById("navNextDistanceText");
  const modeEl = document.getElementById("navAssistModeText");
  const visualEl = document.getElementById("navVisualTurnCard");
  if (panel) panel.classList.remove("hidden");
  if (instructionEl) instructionEl.textContent = instructionText;
  if (nextEl) nextEl.textContent = nextDistanceText;
  if (modeEl) modeEl.textContent = modeText;
  if (visualEl) {
    visualEl.textContent = visualTurnText;
    visualEl.classList.toggle("hidden", !showVisualTurn);
  }
}

function setDeafVisualInstruction(text) {
  setGuidanceUi(text, document.getElementById("navNextDistanceText")?.textContent || "До следующей точки: —", "Режим: визуальный + вибро", text, true);
}

function getModeText(displayType) {
  if (displayType === "blind") return "Режим: голос + вибро";
  if (displayType === "deaf") return "Режим: визуальный + вибро";
  if (displayType === "elderly") return "Режим: голосовой";
  if (displayType === "wheelchair") return "Режим: голосовой";
  return "Режим: —";
}

function loadAutoReportsHistory() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_NAV_HISTORY_KEY) || "[]"); } catch { return []; }
}

function persistAutoReportsHistory(list) {
  localStorage.setItem(ACTIVE_NAV_HISTORY_KEY, JSON.stringify(list));
}

function addAutoReportToHistory(report) {
  const list = loadAutoReportsHistory();
  list.unshift(report);
  persistAutoReportsHistory(list.slice(0, 100));
}

async function postNavigateWithFallback(payload) {
  try {
    return await fetchJson("/api/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return fetchJson("/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

async function postGpsCheckWithFallback(payload) {
  try {
    return await fetchJson("/api/gps/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return fetchJson("/gps/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

async function postAlertWithFallback(payload) {
  try {
    return await fetchJson("/api/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return fetchJson("/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

async function refreshActiveNavigationLocation({ centerMap = false } = {}) {
  const point = await refreshCurrentLocation({ centerMap, silent: true });
  if (!point) return null;
  const gpsStatusEl = document.getElementById("gpsStatus");
  if (gpsStatusEl) {
    const prefix = state.currentAddress ? `Адрес: ${state.currentAddress}. ` : "";
    showStatus(gpsStatusEl, `${prefix}Автономная навигация активна.`, "success");
  }
  return point;
}

function renderArrivalState(displayType) {
  const text = "Вы прибыли";
  setGuidanceUi(text, "До следующей точки: 0 м", getModeText(displayType), displayType === "deaf" ? "Прибыли" : "", displayType === "deaf");
  if (shouldUseVoice(displayType)) speakGuidance(text, { force: true });
  if (shouldUseHaptics(displayType)) vibrate([500, 200, 500, 200, 500]);
}

function getActiveDangerAhead(currentPoint) {
  return (state.activeRouteMeta?.warnings || []).find((warning) => distanceMeters(currentPoint, warning.location) <= 30) || null;
}

function generateGuidanceInstruction(currentPoint) {
  const routeCoords = state.activeRouteCoords || [];
  const displayType = state.activeRouteDisplayType;
  if (!routeCoords.length || !currentPoint) return null;

  const destination = routeCoords[routeCoords.length - 1];
  const distanceToDestination = distanceMeters(currentPoint, destination);
  if (distanceToDestination <= 18) {
    return {
      text: "Вы прибыли",
      arrived: true,
      nextDistanceText: "До следующей точки: 0 м",
      visualTurnText: "Прибыли",
      dangerAhead: false,
    };
  }

  const nearestIdx = nearestRouteIndex(currentPoint, routeCoords);
  state.activeNavProgressIndex = Math.max(state.activeNavProgressIndex || 0, nearestIdx);
  const routeDistance = distanceToRouteMeters(currentPoint, routeCoords);
  const offRouteThreshold = displayType === "blind" ? 18 : displayType === "wheelchair" ? 22 : 28;
  const isOffRoute = routeDistance > offRouteThreshold;
  if (isOffRoute) {
    return {
      text: "Вы отклонились от маршрута",
      offRoute: true,
      nextDistanceText: `Отклонение: ${Math.round(routeDistance)} м`,
      visualTurnText: "Отклонение от маршрута",
      dangerAhead: false,
    };
  }

  const turns = state.activeRouteMeta.turns || [];
  const nextTurn = turns.find((t) => t.index > state.activeNavProgressIndex);
  const distanceToTurn = nextTurn ? distanceMeters(currentPoint, nextTurn.location) : distanceToDestination;
  const nextSegmentTarget = nextTurn?.location || destination;
  const bearing = bearingDegrees(currentPoint, nextSegmentTarget);
  const directionText = nextTurn?.direction || "прямо";
  const dangerAhead = !!getActiveDangerAhead(currentPoint);

  if (displayType === "wheelchair") {
    const warning = (state.activeRouteMeta.warnings || []).find((w) => distanceMeters(currentPoint, w.location) <= 45);
    const extra = warning ? ` Впереди предупреждение: ${warning.type}, проверьте покрытие и возможный уклон.` : "";
    const text = nextTurn && distanceToTurn <= 55
      ? `Через ${Math.max(5, Math.round(distanceToTurn))} метров поверните ${directionText}.${extra}`
      : `Двигайтесь прямо ${Math.max(5, Math.round(distanceToTurn))} метров.${extra}`;
    return { text, nextDistanceText: `До следующей точки: ${Math.round(distanceToTurn)} м`, visualTurnText: "", dangerAhead };
  }

  if (displayType === "elderly") {
    const benchesAhead = (state.activeRouteMeta.benches || []).find((p) => distanceMeters(currentPoint, p) <= 80);
    const minutes = Math.max(1, Math.round(distanceToTurn / 60));
    const benchText = benchesAhead ? ` До скамейки около ${Math.round(distanceMeters(currentPoint, benchesAhead))} м.` : "";
    const text = nextTurn && distanceToTurn <= 55
      ? `Через ${Math.round(distanceToTurn)} метров поверните ${directionText}. Время до точки: ${minutes} мин.${benchText}`
      : `Идите ещё ${Math.round(distanceToTurn)} метров. Время до точки: ${minutes} мин.${benchText}`;
    return { text, nextDistanceText: `До следующей точки: ${Math.round(distanceToTurn)} м`, visualTurnText: "", dangerAhead };
  }

  if (displayType === "blind") {
    const steps = Math.max(5, Math.round(distanceToTurn / 0.75));
    const cardinal = cardinalDirection(bearing);
    const text = nextTurn && distanceToTurn <= 45
      ? `Через ${Math.round(distanceToTurn)} метров поверните ${directionText}, ориентир на ${cardinal}. Это около ${steps} шагов.`
      : `Идите на ${cardinal}, около ${steps} шагов до следующей точки.`;
    return { text, nextDistanceText: `До следующей точки: ${Math.round(distanceToTurn)} м`, visualTurnText: "", dangerAhead };
  }

  if (displayType === "deaf") {
    const text = nextTurn && distanceToTurn <= 55
      ? `Через ${Math.round(distanceToTurn)} м: ${directionText}`
      : `Прямо ${Math.round(distanceToTurn)} м`;
    return { text, nextDistanceText: `До следующей точки: ${Math.round(distanceToTurn)} м`, visualTurnText: text, dangerAhead };
  }

  return { text: "Следуйте по маршруту", nextDistanceText: `До следующей точки: ${Math.round(distanceToTurn)} м`, visualTurnText: "", dangerAhead };
}

function applyHapticGuidance(instruction) {
  const displayType = state.activeRouteDisplayType;
  if (!shouldUseHaptics(displayType) || !instruction) return;
  if (instruction.arrived) { vibrate([500, 200, 500, 200, 500]); return; }
  if (instruction.offRoute) { vibrate([1000]); return; }
  if (instruction.dangerAhead) { vibrate([200, 100, 200, 100, 200, 100, 200]); return; }
  const lower = String(instruction.text || "").toLowerCase();
  if (lower.includes("направо")) { vibrate([100, 50, 100, 50, 100]); return; }
  if (lower.includes("налево")) { vibrate([300, 50, 300]); return; }
  const now = Date.now();
  if (!state.activeNavLastStraightPulseAt || now - state.activeNavLastStraightPulseAt >= 10000) {
    vibrate([200]);
    state.activeNavLastStraightPulseAt = now;
  }
}

function runGuidanceCycle() {
  if (!state.activeNavRunning || !state.currentLocation) return;
  const displayType = state.activeRouteDisplayType;
  const instruction = generateGuidanceInstruction(state.currentLocation);
  if (!instruction) return;

  if (instruction.arrived) {
    renderArrivalState(displayType);
    stopActiveNavigationSession({ keepRoute: true });
    return;
  }

  setGuidanceUi(instruction.text, instruction.nextDistanceText, getModeText(displayType), instruction.visualTurnText, displayType === "deaf");
  if (displayType === "deaf") setDeafVisualInstruction(instruction.visualTurnText || instruction.text);
  if (shouldUseVoice(displayType)) speakGuidance(instruction.text);
  if (shouldUseHaptics(displayType)) applyHapticGuidance(instruction);
}

async function triggerAutoAnomalyReport(response) {
  const displayType = state.activeRouteDisplayType || getDisplayDisabilityType(getProfileDisabilityType());
  const disabilityType = getProfileDisabilityType();
  const location = state.currentLocation || response?.location || DEFAULT_CENTER;
  vibrate([500, 200, 500]);
  if (displayType !== "deaf" && displayType !== "blind") {
    speakGuidance("Обнаружена проблема, отправляю запрос помощи", { force: true });
  }

  try {
    await postAlertWithFallback({
      user_id: LOCAL_USER_ID,
      location,
      type: "auto_anomaly",
      disability_type: disabilityType,
    });
  } catch {
    // Keep local flow even if alert backend is unavailable.
  }

  addProblemPin({
    location,
    category: "auto_anomaly",
    confidence: 1,
    notes: `Авто-репорт ИИ: ${response?.anomaly_type || "anomaly"}`,
  });

  const banner = document.getElementById("anomalyBanner");
  const bannerText = document.getElementById("anomalyBannerText");
  if (bannerText) bannerText.textContent = "ИИ отправил запрос помощи";
  banner?.classList.remove("hidden");

  addAutoReportToHistory({
    createdAt: Date.now(),
    location,
    anomaly_type: response?.anomaly_type || "unknown",
    disability_type: disabilityType,
    type: "auto_anomaly",
  });
}

async function runActiveAnomalyCheckCycle() {
  if (!state.activeNavRunning || state.gpsPoints.length < 6) return;
  try {
    const response = await postGpsCheckWithFallback({
      user_id: LOCAL_USER_ID,
      points: state.gpsPoints.slice(-6),
    });
    state.activeNavLastAnomalyResponse = response;
    const now = Date.now();
    if (response.is_anomaly) {
      if (!state.activeNavAnomalySince) {
        state.activeNavAnomalySince = now;
        return;
      }
      if (now - state.activeNavAnomalySince >= 15000) {
        await triggerAutoAnomalyReport(response);
        state.activeNavAnomalySince = now + 30000;
      }
    } else {
      state.activeNavAnomalySince = null;
      document.getElementById("anomalyBanner")?.classList.add("hidden");
    }
  } catch {
    // Non-fatal during active navigation
  }
}

function stopActiveNavigationSession({ keepRoute = false } = {}) {
  if (state.activeNavLocationTimer) { clearInterval(state.activeNavLocationTimer); state.activeNavLocationTimer = null; }
  if (state.activeNavGuidanceTimer) { clearInterval(state.activeNavGuidanceTimer); state.activeNavGuidanceTimer = null; }
  if (state.activeNavAnomalyTimer) { clearInterval(state.activeNavAnomalyTimer); state.activeNavAnomalyTimer = null; }
  state.activeNavRunning = false;
  state.activeNavLastInstruction = "";
  state.activeNavLastSpokenAt = 0;
  state.activeNavProgressIndex = 0;
  state.activeNavOffRouteSince = null;
  state.activeNavAnomalySince = null;
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
  document.getElementById("anomalyBanner")?.classList.add("hidden");
  if (!keepRoute) {
    const panel = document.getElementById("navGuidancePanel");
    panel?.classList.add("hidden");
    clearActiveRouteDecorations();
  }
}

async function startActiveNavigationSession(routeCoords, { displayType, destinationAddress = "" } = {}) {
  stopActiveNavigationSession({ keepRoute: true });
  state.activeNavRunning = true;
  state.activeRouteCoords = routeCoords;
  state.activeRouteDisplayType = displayType;
  state.activeRouteDestination = destinationAddress || "";
  state.activeRouteMeta = {
    turns: getTurnWaypoints(routeCoords),
    warnings: getNearbyRouteWarnings(routeCoords),
    numberedWaypoints: displayType === "blind" ? sampleRouteEvery(routeCoords, 30) : [],
    benches: [],
    stairs: [],
  };

  const osmContext = await fetchRouteContextFromOsm(routeCoords);
  state.activeRouteMeta.benches = osmContext.benches;
  state.activeRouteMeta.stairs = osmContext.stairs;
  renderAdaptiveRouteDecorations(displayType, routeCoords, state.activeRouteMeta, osmContext);

  const intervalMs = getNavLoopIntervalMs(displayType);
  await refreshActiveNavigationLocation({ centerMap: false });
  runGuidanceCycle();
  runActiveAnomalyCheckCycle();
  state.activeNavLocationTimer = window.setInterval(() => {
    refreshActiveNavigationLocation({ centerMap: false });
  }, intervalMs);
  state.activeNavGuidanceTimer = window.setInterval(runGuidanceCycle, intervalMs);
  state.activeNavAnomalyTimer = window.setInterval(runActiveAnomalyCheckCycle, 10000);
}

/* ═══════════════════════════════════════
   NAVIGATION (POST /navigate)
   ═══════════════════════════════════════ */
async function handleNavigateSubmit(e) {
  e.preventDefault();
  const $ = (id) => document.getElementById(id);
  const statusEl = $("navigationStatus");
  const btn = $("navigateButton");
  const profileDisability = getProfileDisabilityType();
  const routeUserType = mapProfileDisabilityToRouteUserType(profileDisability);
  const displayType = getDisplayDisabilityType(profileDisability);

  if (!routeUserType || !displayType) {
    showStatus(statusEl, "Сначала заполните тип инвалидности в профиле перед построением маршрута.", "error");
    location.hash = "#profile";
    return;
  }

  if ($("userType")) $("userType").value = routeUserType;

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

  localStorage.setItem("inkomek-user-type", routeUserType);
  setLoading(btn, true, "Загрузка...");
  showStatus(statusEl, "Запрашиваем доступный маршрут...", "loading");

  try {
    const response = await postNavigateWithFallback({
      user_type: routeUserType,
      start_coords: start,
      end_coords: end,
    });

    await drawRoute(response.route_coords || [], { displayType });
    renderRouteSummary(response.summary || null);
    await startActiveNavigationSession(response.route_coords || [], {
      displayType,
      destinationAddress: $("endAddress")?.value.trim() || "",
    });
    showStatus(statusEl, "Маршрут построен. Автономное сопровождение активно.", "success");
  } catch (error) {
    stopActiveNavigationSession();
    clearRoute();
    renderRouteSummary(null);
    showStatus(statusEl, extractError(error, "Не удалось построить маршрут."), "error");
  } finally {
    setLoading(btn, false, "Построить маршрут");
  }
}

async function drawRoute(routeCoords, { displayType } = {}) {
  clearRoute();
  const mapInstance = state.navMap;
  if (!mapInstance || !Array.isArray(routeCoords) || routeCoords.length === 0) return;

  const latLngs = routeCoords.map((p) => [Number(p[0]), Number(p[1])]);
  let lineStyle = { color: "#216e39", weight: 6, opacity: 0.9 };
  if (displayType === "wheelchair") lineStyle = { color: "#1565c0", weight: 8, opacity: 0.95 };
  if (displayType === "blind") lineStyle = { color: "#fb8c00", weight: 7, opacity: 0.95, dashArray: "10 6" };
  if (displayType === "elderly") lineStyle = { color: "#2e7d32", weight: 7, opacity: 0.95 };
  if (displayType === "deaf") lineStyle = { color: "#7e57c2", weight: 7, opacity: 0.95 };
  state.routeLine = L.polyline(latLngs, lineStyle).addTo(mapInstance);
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
  clearActiveRouteDecorations();
  state.activeRouteCoords = [];
  state.activeRouteMeta = {};
  state.activeRouteUserType = null;
  state.activeRouteDisplayType = null;
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
  // Keep summary available, but active guidance UI is primary during navigation.
  el.classList.add("hidden");
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
  if (state.activeNavRunning) return;
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

/* ═══════════════════════════════════════
   BUSINESSES (local-only) on nav map
   ═══════════════════════════════════════ */
function getCurrentNavUserType() {
  const el = document.getElementById("userType");
  if (el && el.value) return el.value;
  // If user is logged in, prefer profile disability for business filtering.
  if (state.user?.disability) return state.user.disability;
  return localStorage.getItem("inkomek-user-type") || "wheelchair";
}

function businessMatchesOvzFilter(business) {
  if (!state.businessFilterOvzOnly) return true;
  const ovzTags = userTypeToOvzTags(getCurrentNavUserType());
  if (!ovzTags.length) return true;
  const served = business?.disabilities || [];
  if (!served.length) return false;
  return ovzTags.some((t) => served.includes(t));
}

function clearBusinessMarkers() {
  if (!state.navMap) return;
  for (const item of state.businessMarkers) {
    try {
      state.navMap.removeLayer(item.marker);
    } catch {
      // ignore
    }
  }
  state.businessMarkers = [];
}

function createBusinessStarIcon() {
  const svg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#F5A800" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
  </svg>`;
  const html = `<div style="width:30px;height:30px;border-radius:999px;background:#3B1F0A;border:3px solid #F5A800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px rgba(0,0,0,0.18);">
    ${svg}
  </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -12],
  });
}

function renderBusinessPins(mapInstance) {
  if (!mapInstance) return;
  state.navMap = mapInstance;

  clearBusinessMarkers();

  const list = loadBusinesses();
  const icon = createBusinessStarIcon();

  for (const b of list) {
    if (!b?.location || !isValidCoords(b.location)) continue;
    if (!businessMatchesOvzFilter(b)) continue;

    const marker = L.marker(b.location, { icon }).addTo(mapInstance);
    marker.on("click", () => openBusinessCard(b.id));
    state.businessMarkers.push({ id: b.id, marker });
  }
}

function incrementBusinessViews(businessId) {
  const list = loadBusinesses();
  const idx = list.findIndex((b) => b.id === businessId);
  if (idx < 0) return 0;
  list[idx].views = Number(list[idx].views || 0) + 1;
  persistBusinesses(list);
  return list[idx].views;
}

function prefillNavigateForBusiness(business) {
  const endAddress = document.getElementById("endAddress");
  const endLat = document.getElementById("endLat");
  const endLon = document.getElementById("endLon");
  const statusEl = document.getElementById("navigationStatus");
  if (endAddress) endAddress.value = business.addressText || "";
  if (endLat) endLat.value = String(business.location[0]);
  if (endLon) endLon.value = String(business.location[1]);

  // If start is empty, try to fill from current GPS
  const startLat = document.getElementById("startLat");
  const startLon = document.getElementById("startLon");
  if (startLat && startLon && (!startLat.value || !startLon.value) && state.currentLocation) {
    if (document.getElementById("startAddress")) document.getElementById("startAddress").value = state.currentAddress || "";
    startLat.value = String(state.currentLocation[0]);
    startLon.value = String(state.currentLocation[1]);
    if (statusEl) showStatus(statusEl, "Старт и финиш заполнены для маршрута.", "success");
  }

  location.hash = "#navigate";
  // Hide card after navigation action
  hideBusinessCard();
}

function prefillNavigateToInkomek() {
  const endAddress = document.getElementById("endAddress");
  const endLat = document.getElementById("endLat");
  const endLon = document.getElementById("endLon");
  const statusEl = document.getElementById("navigationStatus");

  if (endAddress) endAddress.value = "InKomek, Алматы";
  if (endLat) endLat.value = String(DEFAULT_DESTINATION[0]);
  if (endLon) endLon.value = String(DEFAULT_DESTINATION[1]);

  if (statusEl) showStatus(statusEl, "Адрес InKomek подставлен. Постройте маршрут.", "success");
  location.hash = "#navigate";
}

// Backward compatible alias for event handler in pricing page
function hideBusinessCard() {
  const panel = document.getElementById("businessCardPanel");
  if (panel) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
  }
  state.businessCardBusinessId = null;
}

function openBusinessCard(businessId) {
  const biz = getBusinessById(businessId);
  if (!biz) return;

  const views = incrementBusinessViews(businessId);
  biz.views = views;
  state.businessCardBusinessId = businessId;

  const panel = document.getElementById("businessCardPanel");
  if (!panel) return;

  const tags = (biz.disabilities || []).map((t) => businessTagsLabel(t)).join(", ");
  const website = biz.website ? `<a href="${esc(biz.website)}" target="_blank" rel="noopener" class="primary-link">Сайт</a>` : "";
  const photo = biz.photoDataUrl ? `<img src="${biz.photoDataUrl}" alt="Фото бизнеса" style="width:120px;height:90px;object-fit:cover;border-radius:14px;border:2px solid rgba(59,31,10,0.08); margin-bottom:10px;">` : "";

  panel.innerHTML = `
    <div class="business-card">
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <div style="flex:1;">
          ${photo}
          <div style="display:flex; gap:10px; align-items:center;">
            <span style="width:34px;height:34px;border-radius:999px;background:#3B1F0A;border:3px solid #F5A800;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:#F5A800; font-size:16px; line-height:1;">★</span>
            </span>
            <div>
              <div style="font-weight:1000; font-size:1.1rem;">${esc(biz.name)}</div>
              <div style="font-weight:800; color: var(--brown-soft);">${esc(categoryLabel(biz.category))}</div>
            </div>
          </div>
          <div style="margin-top:10px; font-weight:800;">Описание</div>
          <div style="margin-top:6px; color: var(--brown);">${esc(biz.shortDescription || "")}</div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <div style="font-weight:900;">Контакты</div>
        <div style="margin-top:6px; display:grid; gap:6px;">
          <div><strong>Телефон:</strong> ${esc(biz.phone || "")}</div>
          <div>${website || ""}</div>
          <div><strong>Адрес:</strong> ${esc(biz.addressText || "")}</div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <div style="font-weight:900;">Для кого подходит</div>
        <div style="margin-top:6px;">${esc(tags)}</div>
      </div>

      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        <button type="button" class="primary-button" data-build-route-business="${esc(biz.id)}" style="flex:1; min-width:220px;">Построить маршрут</button>
        <button type="button" class="secondary-button" data-close-business-card="1" style="min-width:160px;">Закрыть</button>
      </div>

      <div class="status status-neutral" style="margin-top:12px;">Просмотры: ${Number(biz.views || 0)}</div>
    </div>
  `;

  panel.classList.remove("hidden");

  // Button handlers (scoped)
  panel.querySelector("[data-build-route-business]")?.addEventListener("click", () => {
    prefillNavigateForBusiness(biz);
  });
  panel.querySelector("[data-close-business-card]")?.addEventListener("click", () => {
    hideBusinessCard();
  });

  // Attach a bit more accessible info
  const routeBtn = panel.querySelector("[data-build-route-business]");
  if (routeBtn) routeBtn.setAttribute("aria-label", "Построить маршрут до адреса бизнеса");
}

/* ═══════════════════════════════════════
   BUSINESS PAGES (local-only)
   ═══════════════════════════════════════ */
function bindBusinessRegisterPhotoPreview() {
  const area = document.getElementById("businessPhotoArea");
  const input = document.getElementById("businessPhoto");
  if (!area || !input) return;

  // Keep consistent with existing file-upload UX: clicking the area opens the file dialog.
  area.addEventListener("click", () => input.click());
}

async function placeRegPin(lat, lon) {
  const mapEl = document.getElementById("businessRegMap");
  if (!mapEl) return;
  if (!state.businessRegMap) {
    state.businessRegMap = L.map(mapEl, { zoomControl: true }).setView([lat, lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(state.businessRegMap);
  } else {
    state.businessRegMap.setView([lat, lon], 14, { animate: true });
  }

  if (state.businessRegPin) state.businessRegPin.remove();
  state.businessRegPin = L.marker([lat, lon], { icon: createBusinessStarIcon() }).addTo(state.businessRegMap);
  state.businessRegPin.bindPopup("Адрес бизнеса");
}

async function geocodeAndPlaceRegPin(addressQuery) {
  const q = String(addressQuery || "").trim();
  const infoEl = document.getElementById("businessAddressInfo");
  try {
    if (!q) {
      if (infoEl) showStatus(infoEl, "Введите адрес для поиска.", "error");
      return false;
    }
    const match = await geocodeAddress(q);
    if (!match || !isValidCoords([match.lat, match.lon])) {
      if (infoEl) showStatus(infoEl, "По этому адресу не удалось найти координаты.", "error");
      return false;
    }

    const lat = Number(match.lat);
    const lon = Number(match.lon);
    const addressInput = document.getElementById("businessAddress");
    const latEl = document.getElementById("businessLat");
    const lonEl = document.getElementById("businessLon");
    if (addressInput) addressInput.value = match.display_name || q;
    if (latEl) latEl.value = String(lat);
    if (lonEl) lonEl.value = String(lon);

    if (infoEl) showStatus(infoEl, match.display_name ? `Найден адрес: ${match.display_name}` : "Адрес найден.", "success");
    await placeRegPin(lat, lon);
    return true;
  } catch {
    if (infoEl) showStatus(infoEl, "Не удалось выполнить геокодирование. Проверьте интернет.", "error");
    return false;
  }
}

async function useMyLocationForRegBusiness() {
  const statusEl = document.getElementById("businessRegGpsStatus");
  try {
    if (statusEl) statusEl.classList.remove("hidden");
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const matchAddr = await reverseGeocode(lat, lon);

    const addressInput = document.getElementById("businessAddress");
    const latEl = document.getElementById("businessLat");
    const lonEl = document.getElementById("businessLon");
    if (addressInput) addressInput.value = matchAddr || addressInput.value || "Адрес по GPS";
    if (latEl) latEl.value = String(lat);
    if (lonEl) lonEl.value = String(lon);

    if (statusEl) {
      statusEl.textContent = matchAddr ? `Адрес: ${matchAddr}` : "GPS получен.";
      statusEl.className = "status status-neutral";
    }
    await placeRegPin(lat, lon);
  } catch {
    if (statusEl) {
      statusEl.textContent = "Не удалось получить GPS.";
      statusEl.className = "status status-neutral";
    }
  }
}

function readBusinessTagsFromForm({ wheelchairId, blindId, deafId, elderlyId, cognitiveId }) {
  const tags = [];
  if (document.getElementById(wheelchairId)?.checked) tags.push("wheelchair");
  if (document.getElementById(blindId)?.checked) tags.push("blind");
  if (document.getElementById(deafId)?.checked) tags.push("deaf");
  if (document.getElementById(elderlyId)?.checked) tags.push("elderly");
  if (document.getElementById(cognitiveId)?.checked) tags.push("cognitive");
  return tags;
}

function categoryValueFromSelect(selectEl) {
  return selectEl?.value || "other";
}

function initBusinessRegisterShortCounter() {
  const textarea = document.getElementById("businessShortDescription");
  const counter = document.getElementById("businessShortCount");
  if (!textarea || !counter) return;
  counter.textContent = `${(textarea.value || "").length} / 200`;
}

function initBusinessEditShortCounter() {
  const textarea = document.getElementById("businessEditShortDescription");
  const counter = document.getElementById("businessEditShortCount");
  if (!textarea || !counter) return;
  counter.textContent = `${(textarea.value || "").length} / 200`;
}

function initBusinessRegisterPage() {
  // Event binding is already in bindGlobalEvents; init only sets defaults and maps.
  initBusinessRegisterShortCounter();
  bindBusinessRegisterPhotoPreview();

  if (state.businessRegMap) {
    state.businessRegMap.invalidateSize();
  }
}

async function handleBusinessRegisterSubmit(e) {
  e.preventDefault();
  const statusEl = document.getElementById("businessRegisterStatus");

  const name = document.getElementById("businessName")?.value?.trim();
  const category = document.getElementById("businessCategory")?.value;
  const shortDescription = document.getElementById("businessShortDescription")?.value?.trim();
  const phone = document.getElementById("businessPhone")?.value?.trim();
  const website = document.getElementById("businessWebsite")?.value?.trim();
  const addressText = document.getElementById("businessAddress")?.value?.trim();
  const lat = Number(document.getElementById("businessLat")?.value);
  const lon = Number(document.getElementById("businessLon")?.value);

  const disabilities = readBusinessTagsFromForm({
    wheelchairId: "tagWheelchair",
    blindId: "tagBlind",
    deafId: "tagDeaf",
    elderlyId: "tagElderly",
    cognitiveId: "tagCognitive",
  });

  if (!name || !category || !shortDescription || !phone || !addressText) {
    showStatus(statusEl, "Заполните все обязательные поля.", "error");
    return;
  }
  if (String(shortDescription).length > 200) {
    showStatus(statusEl, "Описание не должно превышать 200 символов.", "error");
    return;
  }
  if (!isValidCoords([lat, lon])) {
    showStatus(statusEl, "Сначала найдите адрес на карте (координаты).", "error");
    return;
  }
  if (!disabilities.length) {
    showStatus(statusEl, "Отметьте хотя бы один тип доступности для ОВЗ.", "error");
    return;
  }

  const id = `biz_${Date.now()}`;
  const business = {
    id,
    name,
    category,
    shortDescription,
    phone,
    website: website || "",
    addressText,
    location: [lat, lon],
    disabilities,
    photoDataUrl: state.businessRegisterPhotoDataUrl || null,
    views: 0,
    verificationStatus: "На проверке",
    createdAt: Date.now(),
  };

  upsertBusiness(business);
  setBusinessSessionId(id);
  showStatus(statusEl, "Бизнес сохранён. Данные отправлены на проверку.", "success");
  // Refresh businesses on nav page (if user navigates back)
  state.businessFilterOvzOnly = false;

  setTimeout(() => (location.hash = "#business-dashboard"), 700);
}

function hydrateBusinessEditFromSession() {
  const bizId = getBusinessSessionId();
  const biz = bizId ? getBusinessById(bizId) : null;
  const statusEl = document.getElementById("businessEditStatus");
  if (!biz) {
    if (statusEl) showStatus(statusEl, "Профиль бизнеса не найден. Зарегистрируйтесь.", "error");
    location.hash = "#business-register";
    return null;
  }

  document.getElementById("businessEditName").value = biz.name || "";
  document.getElementById("businessEditCategory").value = biz.category || "other";
  document.getElementById("businessEditShortDescription").value = biz.shortDescription || "";
  document.getElementById("businessEditPhone").value = biz.phone || "";
  document.getElementById("businessEditAddress").value = biz.addressText || "";
  document.getElementById("businessEditLat").value = String(biz.location?.[0] ?? "");
  document.getElementById("businessEditLon").value = String(biz.location?.[1] ?? "");
  document.getElementById("businessEditWebsite").value = biz.website || "";

  const disabilities = biz.disabilities || [];
  const ids = {
    wheelchair: "tagEditWheelchair",
    blind: "tagEditBlind",
    deaf: "tagEditDeaf",
    elderly: "tagEditElderly",
    cognitive: "tagEditCognitive",
  };
  for (const k of Object.keys(ids)) {
    const el = document.getElementById(ids[k]);
    if (el) el.checked = disabilities.includes(k);
  }

  const viewsEl = document.getElementById("businessViewsText");
  if (viewsEl) viewsEl.textContent = `Просмотры: ${Number(biz.views || 0)}`;

  initBusinessEditShortCounter();
  return biz;
}

async function placeDashPin(lat, lon) {
  const mapEl = document.getElementById("businessDashMap");
  if (!mapEl) return;
  if (!state.businessDashMap) {
    state.businessDashMap = L.map(mapEl, { zoomControl: true }).setView([lat, lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(state.businessDashMap);
  } else {
    state.businessDashMap.setView([lat, lon], 14, { animate: true });
  }

  if (state.businessDashPin) state.businessDashPin.remove();
  state.businessDashPin = L.marker([lat, lon], { icon: createBusinessStarIcon() }).addTo(state.businessDashMap);
  state.businessDashPin.bindPopup("Ваш бизнес");
}

async function geocodeAndPlaceDashPin(addressQuery) {
  const infoEl = document.getElementById("businessEditAddressInfo");
  const addressInput = document.getElementById("businessEditAddress");
  try {
    const q = String(addressQuery || "").trim();
    const match = await geocodeAddress(q);
    if (!match || !isValidCoords([match.lat, match.lon])) {
      showStatus(infoEl, "Не удалось найти координаты по адресу.", "error");
      return false;
    }
    const lat = Number(match.lat);
    const lon = Number(match.lon);
    document.getElementById("businessEditLat").value = String(lat);
    document.getElementById("businessEditLon").value = String(lon);
    if (addressInput) addressInput.value = match.display_name || q;
    showStatus(infoEl, match.display_name ? `Найден адрес: ${match.display_name}` : "Адрес найден.", "success");
    await placeDashPin(lat, lon);
    return true;
  } catch {
    showStatus(infoEl, "Ошибка геокодирования. Проверьте интернет.", "error");
    return false;
  }
}

async function useMyLocationForDashBusiness() {
  const infoEl = document.getElementById("businessEditAddressInfo");
  try {
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const addr = await reverseGeocode(lat, lon);
    document.getElementById("businessEditLat").value = String(lat);
    document.getElementById("businessEditLon").value = String(lon);
    document.getElementById("businessEditAddress").value = addr || document.getElementById("businessEditAddress").value || "Адрес по GPS";
    showStatus(infoEl, addr ? `Адрес: ${addr}` : "GPS получен.", "success");
    await placeDashPin(lat, lon);
  } catch {
    showStatus(infoEl, "Не удалось получить GPS.", "error");
  }
}

async function handleBusinessEditSubmit(e) {
  e.preventDefault();
  const statusEl = document.getElementById("businessEditStatus");
  const bizId = getBusinessSessionId();
  const existing = bizId ? getBusinessById(bizId) : null;

  if (!existing) {
    showStatus(statusEl, "Бизнес не найден. Зарегистрируйтесь заново.", "error");
    location.hash = "#business-register";
    return;
  }

  const name = document.getElementById("businessEditName")?.value?.trim();
  const category = document.getElementById("businessEditCategory")?.value;
  const shortDescription = document.getElementById("businessEditShortDescription")?.value?.trim();
  const phone = document.getElementById("businessEditPhone")?.value?.trim();
  const website = document.getElementById("businessEditWebsite")?.value?.trim();
  const addressText = document.getElementById("businessEditAddress")?.value?.trim();
  const lat = Number(document.getElementById("businessEditLat")?.value);
  const lon = Number(document.getElementById("businessEditLon")?.value);

  const disabilities = readBusinessTagsFromForm({
    wheelchairId: "tagEditWheelchair",
    blindId: "tagEditBlind",
    deafId: "tagEditDeaf",
    elderlyId: "tagEditElderly",
    cognitiveId: "tagEditCognitive",
  });

  if (!name || !category || !shortDescription || !phone || !addressText) {
    showStatus(statusEl, "Заполните все обязательные поля.", "error");
    return;
  }
  if (String(shortDescription).length > 200) {
    showStatus(statusEl, "Описание не должно превышать 200 символов.", "error");
    return;
  }
  if (!isValidCoords([lat, lon])) {
    showStatus(statusEl, "Сначала найдите адрес на карте (координаты).", "error");
    return;
  }
  if (!disabilities.length) {
    showStatus(statusEl, "Отметьте хотя бы один тип доступности для ОВЗ.", "error");
    return;
  }

  const updated = {
    ...existing,
    name,
    category,
    shortDescription,
    phone,
    website: website || "",
    addressText,
    location: [lat, lon],
    disabilities,
    // Keep existing photo
  };

  upsertBusiness(updated);
  const viewsEl = document.getElementById("businessViewsText");
  if (viewsEl) viewsEl.textContent = `Просмотры: ${Number(updated.views || 0)}`;
  showStatus(statusEl, "Изменения сохранены.", "success");
  // refresh nav map markers if open
  if (state.navMap) renderBusinessPins(state.navMap);
}

function initBusinessDashboardPage() {
  const biz = hydrateBusinessEditFromSession();
  if (!biz) return;

  const lat = Number(document.getElementById("businessEditLat")?.value);
  const lon = Number(document.getElementById("businessEditLon")?.value);
  if (isValidCoords([lat, lon])) placeDashPin(lat, lon);
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
