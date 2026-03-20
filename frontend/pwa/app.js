/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   CONSTANTS
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
const BASE_URL = `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8000`;
const AUTH_BASE_URL = `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8002`;
const AUTH_TOKEN_KEY = "inkomek-auth-token";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const LOCAL_USER_ID = "local_user";
const GPS_INTERVAL_MS = 30_000;
const DEFAULT_CENTER = [43.238949, 76.889709];
const DEFAULT_DESTINATION = [43.246998, 76.923778];

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
];

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   STATE
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
};

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   BOOT
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  bindGlobalEvents();
  syncAuthUI();
  syncVolunteerAuthUI();
  restoreAuthSession();
  handleHashChange();
  window.addEventListener("hashchange", handleHashChange);
});

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   ROUTER
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
function handleHashChange() {
  const raw = (location.hash || "#home").slice(1);
  let page = raw === "map" ? "navigate" : (PAGES.includes(raw) ? raw : "home");

  // Volunteer guard: Р›РµРЅС‚Р° РІРѕР»РѕРЅС‚С‘СЂР° РґРѕСЃС‚СѓРїРЅР° С‚олько после входа
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   GLOBAL EVENT BINDING
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

  loadSettings();
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   NAVBAR
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   AUTH (backend JWT)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;
  const statusEl = document.getElementById("signinStatus");

  if (!email || password.length < 6) {
    showStatus(statusEl, "Заполните все поля (пароль минимум 6 символов).", "error");
    return;
  }

  try {
    const loginResp = await fetchJson("/login", {
      method: "POST",
      baseUrl: AUTH_BASE_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const token = loginResp?.access_token;
    if (!token) throw new Error("Login did not return token");
    persistAuthToken(token);
    await hydrateUserProfileFromBackend();
    syncAuthUI();
    showStatus(statusEl, "Вы вошли!", "success");
    setTimeout(() => (location.hash = "#home"), 300);
  } catch (err) {
    showStatus(statusEl, extractError(err, "Ошибка входа."), "error");
  }
}

async function handleSignUp(e) {
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

  try {
    const registerResp = await fetchJson("/register", {
      method: "POST",
      baseUrl: AUTH_BASE_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        type_of_disability: normalizeDisabilityType(disability),
      }),
    });
    const token = registerResp?.access_token;
    if (!token) throw new Error("Register did not return token");
    persistAuthToken(token);
    await hydrateUserProfileFromBackend({ nameFallback: name, phoneFallback: phone, disabilityFallback: disability });
    syncAuthUI();
    showStatus(statusEl, "Аккаунт создан!", "success");
    setTimeout(() => (location.hash = "#home"), 300);
  } catch (err) {
    showStatus(statusEl, extractError(err, "Ошибка регистрации."), "error");
  }
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  const statusEl = document.getElementById("forgotStatus");

  if (!email) {
    showStatus(statusEl, "Введите email.", "error");
    return;
  }

  showStatus(statusEl, "Сброс пароля делается через backend auth-поток.", "neutral");
}

function handleLogout() {
  state.user = null;
  clearAuthToken();
  localStorage.removeItem("inkomek-user");
  syncAuthUI();
  location.hash = "#home";
}

function handleDeleteAccount() {
  if (!state.user) return;
  if (!confirm("Вы уверены? Вы выйдете из аккаунта в текущем браузере.")) return;
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
function persistAuthToken(token) { localStorage.setItem(AUTH_TOKEN_KEY, token); }
function loadAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ""; }
function clearAuthToken() { localStorage.removeItem(AUTH_TOKEN_KEY); }

function normalizeDisabilityType(type) {
  if (type === "wheelchair" || type === "blind" || type === "elderly") return type;
  return "elderly";
}

async function restoreAuthSession() {
  const token = loadAuthToken();
  if (!token) return;
  try {
    await hydrateUserProfileFromBackend();
    syncAuthUI();
  } catch (_) {
    clearAuthToken();
    state.user = null;
    persistUser();
    syncAuthUI();
  }
}

async function hydrateUserProfileFromBackend(fallback = {}) {
  const profile = await fetchJson("/me", { method: "GET", baseUrl: AUTH_BASE_URL });
  const existingUser = loadUser() || {};
  state.user = {
    ...existingUser,
    name: profile?.name || fallback.nameFallback || existingUser.name || "",
    email: profile?.email || existingUser.email || "",
    phone: existingUser.phone || fallback.phoneFallback || "",
    disability: profile?.type_of_disability || fallback.disabilityFallback || existingUser.disability || "wheelchair",
    emergencyContact: existingUser.emergencyContact || "",
  };
  persistUser();
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   VOLUNTEER (local-only)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
    medical_equipment: "РњРµРґРёС†инское оборудование",
    rehabilitation_center: "Р РµР°Р±РёР»РёС‚Р°С†РёРѕРЅРЅС‹Р№ С†РµРЅС‚р",
    specialized_clinic: "РЎРїРµС†иализированная клиника",
    accessible_transport: "Р”РѕСЃС‚СѓРїРЅС‹Р№ С‚СЂР°РЅСЃРїРѕСЂС‚",
    inclusive_sport_fitness: "РРЅРєР»СЋР·РёРІРЅС‹Р№ СЃРїРѕСЂС‚ Рё С„РёС‚нес",
    education_ovz: "РћР±СѓС‡ение и образование для людей с ОВЗ",
    psychological_support: "РџСЃРёС…РѕР»РѕРіРёС‡еская поддержка",
    accessible_housing: "Р”РѕСЃС‚упное жильё",
    other: "Другое",
  };
  return map[categoryKey] || categoryKey || "Другое";
}

function businessTagsLabel(tagKey) {
  const map = {
    wheelchair: "Рнвалидная коляска",
    blind: "РЎР»РµРїС‹Рµ / СЃР»Р°Р±РѕРІРёРґСЏС‰ие",
    deaf: "Р“Р»СѓС…РёРµ / СЃР»Р°Р±РѕСЃР»С‹С€Р°С‰ие",
    elderly: "РџРѕР¶РёР»С‹е",
    cognitive: "РРЅС‚РµР»Р»РµРєС‚СѓР°Р»СЊРЅС‹Рµ РЅР°СЂСѓС€РµРЅРёСЏ / РєРѕРіРЅРёС‚РёРІРЅС‹е",
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
      note: "РќСѓР¶РЅР° РїРѕРјРѕС‰ь с передвижением и сопровождением.",
      postedAt: now - 12 * 60_000,
      requester: { name: "Айгерим", phone: "+7 777 123 45 67" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_2`,
      type: "blind",
      location: [43.2415, 76.9482],
      note: "РџРѕРјРѕС‡СЊ СЃ РѕСЂРёРµРЅС‚РёСЂРѕРІР°РЅРёРµРј Рё РїРµСЂРµС…РѕРґРѕРј С‡ерез дорогу.",
      postedAt: now - 33 * 60_000,
      requester: { name: "РњР°СЂР°С‚", phone: "+7 701 234 56 78" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_3`,
      type: "elderly",
      location: [43.2312, 76.905],
      note: "РџРѕРјРѕС‡СЊ РґРѕР№С‚Рё РґРѕ Р°РїС‚еки и сумок.",
      postedAt: now - 5 * 60_000,
      requester: { name: "Сауле", phone: "+7 705 333 44 55" },
      status: "open",
      acceptedByPhone: null,
    },
    {
      id: `mock_${now}_4`,
      type: "deaf",
      location: [43.246, 76.8885],
      note: "РЎРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ Рё РїРѕРјРѕС‰СЊ СЃ РєРѕРјРјСѓРЅРёРєР°С†ией.",
      postedAt: now - 48 * 60_000,
      requester: { name: "Р•рлан", phone: "+7 771 987 65 43" },
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   REQUEST HELP (USER -> localStorage)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
  showStatus(statusEl, "Запрос отправлен. Волонтеры увидят его в своей ленте.", "success");

  // subtle delay for screen readers
  setTimeout(() => (location.hash = "#user-requests"), 900);
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   USER REQUESTS PAGE (volunteer services)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
  if (status === "accepted") return "Принято волонтером";
  if (status === "closed") return "Завершено";
  return "В ожидании волонтера";
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
    const contactName = volunteer?.fullName || "Волонтер";
    const contactPhone = volunteer?.phone || active.acceptedByPhone || "Телефон не указан";
    const volunteerDistrict = volunteer?.districtArea ? `, ${volunteer.districtArea}` : "";

    const note = active.note ? `<div style="margin-top:10px;">${esc(active.note)}</div>` : "";

    activeWrap.innerHTML = `
      <div class="request-card">
        <div class="request-meta">
          <div><strong>Статус:</strong> <span>${esc(statusLabelForUser(active.status))}</span></div>
          <div><strong>Волонтер:</strong> <span>${esc(contactName)} (${esc(contactPhone)})</span></div>
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
          Маршрут построен на карте, если доступны координаты волонтера.
        </div>
      </div>
    `;
    return;
  }

  if (active.status === "closed") {
    activeWrap.innerHTML = `
      <div class="status status-neutral">Ваш запрос завершен.</div>
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
        Как только волонтер примет запрос, здесь появятся контакты и маршрут.
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
    state.userRequestsVolunteerMarker.bindPopup("Волонтер");

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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   VOLUNTEER (local-only)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
    showStatus(statusEl, "Р—Р°РїРѕР»РЅРёС‚Рµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹е поля.", "error");
    return;
  }

  if (!availWeekdays && !availWeekends && !availAlways) {
    showStatus(statusEl, "Р’С‹Р±РµСЂРёС‚Рµ, РєРѕРіРґР° РІС‹ СЃРІРѕР±РѕРґРЅС‹.", "error");
    return;
  }

  if (!disabilities.length) {
    showStatus(statusEl, "РћС‚РјРµС‚СЊС‚Рµ, СЃ РєРµРј РІС‹ РјРѕР¶РµС‚Рµ РїРѕРјРѕРіР°С‚ь.", "error");
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
    showStatus(statusEl, "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰е раз.", "error");
    return;
  }

  state.volunteer = profile;
  persistVolunteerSession();
  persistVolunteerAvailability("available");

  showStatus(statusEl, "РџСЂРѕС„РёР»СЊ РІРѕР»РѕРЅС‚ёра сохранён.", "success");
  setTimeout(() => (location.hash = "#volunteer-home"), 700);
}

function handleVolunteerSignIn(e) {
  e.preventDefault();
  const phone = document.getElementById("volunteerSigninPhone")?.value.trim();
  const statusEl = document.getElementById("volunteerSigninStatus");

  if (!phone) {
    showStatus(statusEl, "Р’РІРµРґРёС‚Рµ С‚РµР»РµС„он.", "error");
    return;
  }

  const profiles = getVolunteerProfiles();
  const profile = profiles[phone];

  if (!profile) {
    showStatus(statusEl, "РџСЂРѕС„РёР»СЊ СЃ С‚Р°РєРёРј С‚РµР»РµС„РѕРЅРѕРј РЅРµ РЅР°Р№РґРµРЅ. Р—Р°СЂРµРіРёСЃС‚СЂРёСЂСѓР№С‚есь.", "error");
    setTimeout(() => (location.hash = "#volunteer-signup"), 600);
    return;
  }

  state.volunteer = profile;
  persistVolunteerSession();
  persistVolunteerAvailability(loadVolunteerAvailability());
  syncVolunteerAuthUI();
  showStatus(statusEl, "Р’С‹ РІРѕС€Р»Рё РєР°Рє РІРѕР»РѕРЅС‚ёр.", "success");
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
            <div><strong>РќСѓР¶РЅР° РїРѕРјРѕС‰ь:</strong> <span>${esc(helpTypeLabel(r.type))}</span></div>
            <div><strong>Р Р°СЃСЃС‚ояние:</strong> <span>${esc(distText)}</span></div>
            <div><strong>Время:</strong> <span>${esc(fmtRelativeMinutes(r.postedAt))}</span></div>
          </div>
          <button type="button"
            class="primary-button volunteer-accept-btn"
            data-volunteer-action="accept"
            data-request-id="${esc(r.id)}"
            ${state.volunteerAvailability === "busy" ? "disabled" : ""}>
            РџСЂРёРЅСЏС‚ь запрос
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
    wheelchair: "Рнвалидная коляска",
    blind: "РЎР»РµРїС‹Рµ / СЃР»Р°Р±РѕРІРёРґСЏС‰ие",
    elderly: "РџРѕР¶РёР»С‹е",
    deaf: "Р“Р»СѓС…РёРµ / СЃР»Р°Р±РѕСЃР»С‹С€Р°С‰ие",
  };
  return map[type] || "РџРѕРјРѕС‰ь";
}

function renderVolunteerActiveRequest(active) {
  const wrap = document.getElementById("volunteerActiveRequest");
  if (!wrap) return;

  const contact = active?.requester || {};
  const name = contact.name || "РџРѕР»СЊР·РѕРІР°С‚ель";
  const phone = contact.phone || "РўРµР»РµС„он не указан";

  const note = active?.note ? `<div style="margin-top:10px;">${esc(active.note)}</div>` : "";
  const posted = `<div class="status status-neutral" style="margin-top:10px;">Р Р°Р·РјРµС‰ено: ${esc(fmtRelativeMinutes(active.postedAt))}</div>`;

  wrap.innerHTML = `
    <div class="request-card">
      <div class="request-meta">
        <div><strong>Запрос:</strong> <span>${esc(helpTypeLabel(active.type))}</span></div>
        <div><strong>РљРѕРЅС‚Р°РєС‚С‹:</strong> <span>${esc(name)} — ${esc(phone)}</span></div>
      </div>
      ${posted}
      ${note}
      <div style="display:flex; gap:12px; margin-top:14px; flex-wrap:wrap;">
        <button type="button" id="volunteerFinishActiveRequest" class="primary-button" style="flex:1; min-width:220px;">
          Р—Р°РІРµСЂС€РёС‚СЊ РјР°СЂС€СЂСѓС‚
        </button>
        <button type="button" id="volunteerCancelActiveRequest" class="secondary-button" style="flex:1; min-width:220px;">
          РћС‚РјРµРЅРёС‚СЊ (СЃС‚Р°С‚СЊ РґРѕСЃС‚СѓРїРЅС‹м)
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
    state.volunteerUserMarker.bindPopup("Р’С‹ (РІРѕР»РѕРЅС‚ёр)");
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

    marker.bindPopup(`${helpTypeLabel(r.type)}<br>${esc(r.requester?.name || "РџРѕР»СЊР·РѕРІР°С‚ель")}`);
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
    if (statusEl && !silent) statusEl.textContent = "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚ь GPS.";
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
    showStatus(statusEl, "РЎРЅР°С‡Р°Р»Р° Р·Р°РІРµСЂС€РёС‚Рµ С‚РµРєСѓС‰РёР№ РјР°СЂС€СЂСѓС‚.", "error");
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
    if (statusEl) showStatus(statusEl, cancel ? "Р’С‹ СЃС‚Р°Р»Рё РґРѕСЃС‚СѓРїРЅС‹." : "РњР°СЂС€СЂСѓС‚ Р·Р°РІРµСЂС€ён.", "success");
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   DOCUMENT VERIFICATION (Gemini via backend)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
const VERIFY_DOCUMENT_PATH = "/api/verify-document";

function deriveVerificationUi(user) {
  const v = user?.documentVerification;
  if (v && typeof v.is_valid_document === "boolean") {
    const isValid = v.is_valid_document;
    const confidence = Number(v.confidence || 0);
    if (!isValid) {
      return { statusKey: "not-verified", text: "Не верифицировано", className: "not-verified" };
    }
    if (confidence > 0.7) {
      return { statusKey: "verified", text: "Верифицирован", className: "verified" };
    }
    if (confidence >= 0.4 && confidence <= 0.7) {
      return { statusKey: "under", text: "На проверке", className: "under" };
    }
    return { statusKey: "under", text: "На проверке", className: "under" };
  }

  // Legacy/mock fallback
  const legacyStatus = user?.verificationStatus;
  if (legacyStatus === "verified") return { statusKey: "verified", text: "Верифицирован", className: "verified" };
  if (legacyStatus === "under_verification" || legacyStatus === "under") {
    return { statusKey: "under", text: "На проверке", className: "under" };
  }
  return { statusKey: "not-verified", text: "Не верифицировано", className: "not-verified" };
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
  const loadingUi = { statusKey: "under", text: "На проверке", className: "under" };
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
    showStatus(
      profileStatusEl,
      ui.statusKey === "verified"
        ? "Документ верифицирован."
        : ui.statusKey === "not-verified"
          ? "Документ не верифицирован."
          : "Документ отправлен на проверку.",
      tone === "loading" ? "neutral" : tone
    );
  } catch (err) {
    state.user.documentVerification = null;
    state.user.verificationStatus = "not-verified";
    persistUser();
    syncAuthUI();
    hydrateProfile();

    const msg = err instanceof Error ? err.message : "РћС€РёР±РєР° РїСЂРѕРІРµСЂРєРё РґРѕРєСѓРјРµРЅС‚а.";
    const ui = deriveVerificationUi(state.user);
    if (profileBadgeEl) applyVerificationBadgeToEl(profileBadgeEl, state.user);
    if (navBadgeEl) applyVerificationBadgeToEl(navBadgeEl, state.user);
    showStatus(profileStatusEl, msg, "error");
  }
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   PROFILE
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
function hydrateProfile() {
  if (!state.user) return;
  const u = state.user;
  document.getElementById("profileName").value = u.name || "";
  document.getElementById("profileEmail").value = u.email || "";
  document.getElementById("profilePhone").value = u.phone || "";
  document.getElementById("profileDisability").value = u.disability || "wheelchair";
  document.getElementById("profileEmergencyContact").value = u.emergencyContact || "";
  document.getElementById("profileDisplayName").textContent = u.name || "РџРѕР»СЊР·РѕРІР°С‚ель";
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
  state.user.emergencyContact = document.getElementById("profileEmergencyContact").value.trim();

  persistUser();
  syncAuthUI();
  hydrateProfile();
  showStatus(document.getElementById("profileStatus"), "РџСЂРѕС„иль сохранён.", "success");
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   SETTINGS
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   LEAFLET MAPS
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   NOMINATIM ADDRESS SEARCH
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   NAVIGATION (POST /navigate)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
    <div><strong>Ребер</strong> ${summary.edge_count ?? "-"}</div>
  </div>`;
  el.classList.remove("hidden");
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   REPORT (POST /classify)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
async function handleReportSubmit(e) {
  e.preventDefault();
  const file = document.getElementById("reportImage").files?.[0];
  const statusEl = document.getElementById("reportStatus");
  const btn = document.getElementById("reportButton");

  if (!file) { showStatus(statusEl, "РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ С„РѕС‚о.", "error"); return; }

  setLoading(btn, true, "Анализ...");
  showStatus(statusEl, "Р—Р°РіСЂСѓР·РєР° Рё РєР»Р°СЃСЃРёС„РёРєР°С†ия...", "loading");

  try {
  const formData = new FormData();
  formData.append("image", file);
  if (isValidCoords(location)) {
    formData.append("lat", String(location[0]));
    formData.append("lng", String(location[1]));
  }

    const response = await fetchJson("/classify", { method: "POST", body: formData });
    const location = state.currentLocation || DEFAULT_CENTER;

    addProblemPin({ location, category: response.category || "unknown", confidence: Number(response.confidence || 0), notes: document.getElementById("reportNotes").value.trim() });
    renderReportResult(response);
    showStatus(statusEl, "РџСЂРѕР±Р»РµРјР° РєР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°РЅР° Рё РѕС‚РјРµС‡РµРЅР° РЅР° РєР°СЂС‚е.", "success");
  } catch (error) {
    document.getElementById("reportResult")?.classList.add("hidden");
    showStatus(statusEl, extractError(error, "РќРµ СѓРґР°Р»РѕСЃСЊ РєР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°С‚ь."), "error");
  } finally {
    setLoading(btn, false, "РљР»Р°СЃСЃРёС„РёС†РёСЂРѕРІР°С‚ь");
  }
}

function renderReportResult(response) {
  const el = document.getElementById("reportResult");
  if (!el) return;
  el.innerHTML = `<div class="metric-list">
    <div><strong>РљР°С‚егория</strong> ${esc(response.category || "unknown")}</div>
    <div><strong>РЈРІРµСЂРµРЅРЅРѕСЃС‚ь</strong> ${fmtConf(response.confidence)}</div>
    <div><strong>Описание</strong> ${esc(response.description || "—")}</div>
  </div>`;
  el.classList.remove("hidden");
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   SOS (POST /alert)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   GPS + ANOMALY (POST /gps/check)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   MAP MARKERS & PINS
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
function updateUserMarkers(point, address = "") {
  const popupText = address || "Р’Р°С€Рµ РјРµСЃС‚оположение";

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
    ? `РџСЂРѕР±Р»РµРјР° Р±СѓРґРµС‚ РѕС‚РјРµС‡ена здесь: ${address}`
    : "РџСЂРѕР±Р»РµРјР° Р±СѓРґРµС‚ РѕС‚РјРµС‡ена здесь";

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
    }).addTo(mapInstance).bindPopup(`<strong>${esc(pin.category)}</strong><br>РЈРІРµСЂРµРЅРЅРѕСЃС‚ь: ${fmtConf(pin.confidence)}${pin.notes ? `<br>${esc(pin.notes)}` : ""}`);
    state.reportMarkers.push(m);
  }
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   BUSINESSES (local-only) on nav map
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
    if (statusEl) showStatus(statusEl, "РЎС‚Р°СЂС‚ Рё С„РёРЅРёС€ Р·Р°РїРѕР»РЅРµРЅС‹ РґР»СЏ РјР°СЂС€СЂСѓС‚а.", "success");
  }

  location.hash = "#navigate";
  // Hide card after navigation action
  hideBusinessCard();
}

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
  const website = biz.website ? `<a href="${esc(biz.website)}" target="_blank" rel="noopener" class="primary-link">РЎР°Р№С‚</a>` : "";
  const photo = biz.photoDataUrl ? `<img src="${biz.photoDataUrl}" alt="Р¤РѕС‚о бизнеса" style="width:120px;height:90px;object-fit:cover;border-radius:14px;border:2px solid rgba(59,31,10,0.08); margin-bottom:10px;">` : "";

  panel.innerHTML = `
    <div class="business-card">
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <div style="flex:1;">
          ${photo}
          <div style="display:flex; gap:10px; align-items:center;">
            <span style="width:34px;height:34px;border-radius:999px;background:#3B1F0A;border:3px solid #F5A800;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:#F5A800; font-size:16px; line-height:1;">в…</span>
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
        <div style="font-weight:900;">РљРѕРЅС‚Р°РєС‚С‹</div>
        <div style="margin-top:6px; display:grid; gap:6px;">
          <div><strong>РўРµР»РµС„он:</strong> ${esc(biz.phone || "")}</div>
          <div>${website || ""}</div>
          <div><strong>Адрес:</strong> ${esc(biz.addressText || "")}</div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <div style="font-weight:900;">Р”Р»СЏ РєРѕРіРѕ РїРѕРґС…РѕРґРёС‚</div>
        <div style="margin-top:6px;">${esc(tags)}</div>
      </div>

      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        <button type="button" class="primary-button" data-build-route-business="${esc(biz.id)}" style="flex:1; min-width:220px;">РџРѕСЃС‚СЂРѕРёС‚СЊ РјР°СЂС€СЂСѓС‚</button>
        <button type="button" class="secondary-button" data-close-business-card="1" style="min-width:160px;">Р—Р°РєСЂС‹С‚ь</button>
      </div>

      <div class="status status-neutral" style="margin-top:12px;">РџСЂРѕСЃРјРѕС‚СЂС‹: ${Number(biz.views || 0)}</div>
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
  if (routeBtn) routeBtn.setAttribute("aria-label", "РџРѕСЃС‚СЂРѕРёС‚СЊ РјР°СЂС€СЂСѓС‚ до адреса бизнеса");
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   BUSINESS PAGES (local-only)
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
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
      if (infoEl) showStatus(infoEl, "Р’РІРµРґРёС‚е адрес для поиска.", "error");
      return false;
    }
    const match = await geocodeAddress(q);
    if (!match || !isValidCoords([match.lat, match.lon])) {
      if (infoEl) showStatus(infoEl, "РџРѕ СЌС‚РѕРјСѓ Р°РґСЂРµСЃСѓ РЅРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РєРѕРѕСЂРґРёРЅР°С‚С‹.", "error");
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
    if (infoEl) showStatus(infoEl, "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РіРµРѕРєРѕРґРёСЂРѕРІР°РЅРёРµ. РџСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚.", "error");
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
      statusEl.textContent = matchAddr ? `Адрес: ${matchAddr}` : "GPS РїРѕР»СѓС‡ен.";
      statusEl.className = "status status-neutral";
    }
    await placeRegPin(lat, lon);
  } catch {
    if (statusEl) {
      statusEl.textContent = "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚ь GPS.";
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
    showStatus(statusEl, "Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹е поля.", "error");
    return;
  }
  if (String(shortDescription).length > 200) {
    showStatus(statusEl, "РћРїРёСЃР°РЅРёРµ РЅРµ РґРѕР»Р¶РЅРѕ РїСЂРµРІС‹С€Р°С‚ь 200 символов.", "error");
    return;
  }
  if (!isValidCoords([lat, lon])) {
    showStatus(statusEl, "РЎРЅР°С‡Р°Р»Р° РЅР°Р№РґРёС‚Рµ Р°РґСЂРµСЃ РЅР° РєР°СЂС‚Рµ (РєРѕРѕСЂРґРёРЅР°С‚С‹).", "error");
    return;
  }
  if (!disabilities.length) {
    showStatus(statusEl, "РћС‚РјРµС‚СЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С‚РёРї РґРѕСЃС‚СѓРїРЅРѕСЃС‚и для ОВЗ.", "error");
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
  showStatus(statusEl, "Р‘РёР·РЅРµСЃ СЃРѕС…СЂР°РЅС‘РЅ. Р”Р°РЅРЅС‹Рµ РѕС‚РїСЂР°РІР»РµРЅС‹ на проверку.", "success");
  // Refresh businesses on nav page (if user navigates back)
  state.businessFilterOvzOnly = false;

  setTimeout(() => (location.hash = "#business-dashboard"), 700);
}

function hydrateBusinessEditFromSession() {
  const bizId = getBusinessSessionId();
  const biz = bizId ? getBusinessById(bizId) : null;
  const statusEl = document.getElementById("businessEditStatus");
  if (!biz) {
    if (statusEl) showStatus(statusEl, "РџСЂРѕС„РёР»СЊ Р±РёР·РЅРµСЃР° РЅРµ РЅР°Р№РґРµРЅ. Р—Р°СЂРµРіРёСЃС‚СЂРёСЂСѓР№С‚есь.", "error");
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
  if (viewsEl) viewsEl.textContent = `РџСЂРѕСЃРјРѕС‚СЂС‹: ${Number(biz.views || 0)}`;

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
  state.businessDashPin.bindPopup("Р’Р°С€ бизнес");
}

async function geocodeAndPlaceDashPin(addressQuery) {
  const infoEl = document.getElementById("businessEditAddressInfo");
  const addressInput = document.getElementById("businessEditAddress");
  try {
    const q = String(addressQuery || "").trim();
    const match = await geocodeAddress(q);
    if (!match || !isValidCoords([match.lat, match.lon])) {
      showStatus(infoEl, "РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РєРѕРѕСЂРґРёРЅР°С‚С‹ по адресу.", "error");
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
    showStatus(infoEl, "РћС€РёР±РєР° РіРµРѕРєРѕРґРёСЂРѕРІР°РЅРёСЏ. РџСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚.", "error");
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
    showStatus(infoEl, addr ? `Адрес: ${addr}` : "GPS РїРѕР»СѓС‡ен.", "success");
    await placeDashPin(lat, lon);
  } catch {
    showStatus(infoEl, "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚ь GPS.", "error");
  }
}

async function handleBusinessEditSubmit(e) {
  e.preventDefault();
  const statusEl = document.getElementById("businessEditStatus");
  const bizId = getBusinessSessionId();
  const existing = bizId ? getBusinessById(bizId) : null;

  if (!existing) {
    showStatus(statusEl, "Р‘РёР·РЅРµСЃ РЅРµ РЅР°Р№РґРµРЅ. Р—Р°СЂРµРіРёСЃС‚СЂРёСЂСѓР№С‚есь заново.", "error");
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
    showStatus(statusEl, "Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹е поля.", "error");
    return;
  }
  if (String(shortDescription).length > 200) {
    showStatus(statusEl, "РћРїРёСЃР°РЅРёРµ РЅРµ РґРѕР»Р¶РЅРѕ РїСЂРµРІС‹С€Р°С‚ь 200 символов.", "error");
    return;
  }
  if (!isValidCoords([lat, lon])) {
    showStatus(statusEl, "РЎРЅР°С‡Р°Р»Р° РЅР°Р№РґРёС‚Рµ Р°РґСЂРµСЃ РЅР° РєР°СЂС‚Рµ (РєРѕРѕСЂРґРёРЅР°С‚С‹).", "error");
    return;
  }
  if (!disabilities.length) {
    showStatus(statusEl, "РћС‚РјРµС‚СЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С‚РёРї РґРѕСЃС‚СѓРїРЅРѕСЃС‚и для ОВЗ.", "error");
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
  if (viewsEl) viewsEl.textContent = `РџСЂРѕСЃРјРѕС‚СЂС‹: ${Number(updated.views || 0)}`;
  showStatus(statusEl, "РР·РјРµРЅРµРЅРёСЏ СЃРѕС…СЂР°РЅРµРЅС‹.", "success");
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
    if (s) showStatus(s, "GPS пока недоступен.", "error");
    return;
  }
  if ($("startLat")) $("startLat").value = String(state.currentLocation[0]);
  if ($("startLon")) $("startLon").value = String(state.currentLocation[1]);
  if ($("startAddress")) $("startAddress").value = state.currentAddress || "";
  const info = $("startAddressInfo");
  if (info) info.textContent = state.currentAddress || "Текущая позиция (GPS)";
  const s = $("navigationStatus");
  if (s) showStatus(s, "Адрес старта обновлен по GPS.", "success");
}

function appendGpsPoint(point) {
  state.gpsPoints.push({ lat: point[0], lon: point[1], ts: Math.floor(Date.now() / 1000) });
  if (state.gpsPoints.length > 6) state.gpsPoints = state.gpsPoints.slice(-6);
}

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   UTILITIES
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
async function fetchJson(path, options = {}) {
  const { baseUrl = BASE_URL, headers = {}, withAuth = true, ...rest } = options;
  const token = loadAuthToken();
  const mergedHeaders = { ...headers };
  if (withAuth && token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  let r;
  try {
    r = await fetch(`${baseUrl}${path}`, { ...rest, headers: mergedHeaders });
  } catch (error) {
    throw new Error("Не удалось подключиться к backend. Проверьте, что API запущен и CORS разрешен.");
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
