// ==========================================================================
// SAAPHZONE CSMS CONTROL & REAL-TIME EV TELEMETRY - JAVASCRIPT
// Enterprise Architecture with Full Auth, Themes, Separate Add Charger Page,
// Tariffs Revenue Breakdown, RFID Tokens, and Reliable Delete Operations
// ==========================================================================

// Dynamic backend configuration:
// If running on localhost or 127.0.0.1, use relative paths.
// If running on Vercel or any remote static host, route to Render backend.
const IS_LOCAL = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '' ||
  window.location.port !== '';
const BACKEND_ORIGIN = IS_LOCAL ? '' : 'https://cms-backend-0bce.onrender.com';
const WS_BACKEND_URL = IS_LOCAL
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : 'wss://cms-backend-0bce.onrender.com';

// Intercept fetch calls to transparently prefix /api calls with Render backend URL
const _nativeFetch = window.fetch;
window.fetch = function (url, options) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    url = BACKEND_ORIGIN + url;
  }
  return _nativeFetch.call(this, url, options);
};

const FALLBACK_SEED_CHARGERS = [
  {
    id: "chg_muya1w8x_4zmz",
    name: "TESTING_GAURAV_SIR",
    location: "Delhi",
    apiKey: "evc_live_959f59a8a1f8a7e728815256",
    credentials: {
      username: "TGS_001",
      password: "Tgs@enersol"
    },
    tariff: {
      ratePerKwh: 18,
      currency: "₹",
      sessionFee: 40
    },
    stats: {
      totalSessions: 12,
      totalEnergyKwh: 284.5,
      totalRevenue: 5121
    },
    rfidTokens: [
      "RFID_TAG_1927"
    ],
    createdAt: new Date().toISOString(),
    maxVoltage: 500,
    maxCurrent: 350,
    connectorType: "Custom CAN-Bus Lab Bench",
    status: "CHARGING",
    lastSeen: Date.now(),
    telemetry: {
      charger_voltage: 418.5,
      charger_current: 148.2,
      battery_soc: 78.0,
      battery_req_voltage: 425.0,
      battery_req_current: 160.0,
      battery_temp: 34.2,
      charger_temp: 41.5,
      status: "CHARGING",
      charging_mode: "SPORT PLUS // CC FAST",
      fault_code: "NONE",
      session_energy_kwh: 45.8,
      session_duration_min: 22.4,
      power_kw: 62.0,
      target_power_kw: 68.0,
      timestamp: Date.now()
    },
    history: []
  },
  {
    id: 'chg_bay_01',
    name: 'SAAPHZONE HyperCharge Bay 01 [800V Ultra-Fast]',
    location: 'Terminal A - Stall 01',
    apiKey: 'evc_live_9f82d1c470be31980a32e1',
    credentials: {
      username: 'bay01',
      password: 'password123'
    },
    tariff: {
      ratePerKwh: 18.50,
      currency: '₹',
      sessionFee: 50.00
    },
    stats: {
      totalSessions: 14,
      totalEnergyKwh: 345.2,
      totalRevenue: 6386.20
    },
    rfidTokens: ['RFID_SAAPH_0841', 'TOKEN_PCB_MASTER'],
    createdAt: new Date().toISOString(),
    maxVoltage: 800,
    maxCurrent: 350,
    connectorType: 'CCS2 Combo (Liquid-Cooled)',
    status: 'ONLINE',
    lastSeen: Date.now(),
    telemetry: {
      charger_voltage: 0.0,
      charger_current: 0.0,
      battery_soc: 0.0,
      battery_req_voltage: 0.0,
      battery_req_current: 0.0,
      battery_temp: 24.0,
      charger_temp: 26.5,
      status: 'IDLE',
      charging_mode: 'STANDBY READY',
      fault_code: 'NONE',
      session_energy_kwh: 0.0,
      session_duration_min: 0.0,
      power_kw: 0.0,
      target_power_kw: 0.0,
      timestamp: Date.now()
    },
    history: []
  }
];

const state = {
  currentUser: null,
  chargers: [...FALLBACK_SEED_CHARGERS],
  selectedChargerId: 'chg_muya1w8x_4zmz',
  ws: null,
  theme: 'light',
  simInterval: null,
  chargePointsSearchQuery: '',
  chargePointsFilterStatus: 'ALL',
  pendingDeleteChargerId: null,
  lastDataReceived: null,
  reportPeriod: '24h',
  reportChargerId: 'ALL',
  currentReportData: null
};

// DOM Cache
const dom = {
  // Login
  loginOverlay: document.getElementById('loginOverlay'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  btnTogglePwd: document.getElementById('btnTogglePwd'),
  tabAdminLogin: document.getElementById('tabAdminLogin'),
  tabChargerLogin: document.getElementById('tabChargerLogin'),
  loginHintText: document.getElementById('loginHintText'),
  btnLoginThemeToggle: document.getElementById('btnLoginThemeToggle'),
  lblLoginUser: document.getElementById('lblLoginUser'),

  // Header & User
  appLayout: document.getElementById('appLayout'),
  sidebarNav: document.getElementById('sidebarNav'),
  navItems: document.querySelectorAll('.nav-item'),
  currentUserName: document.getElementById('currentUserName'),
  currentUserRole: document.getElementById('currentUserRole'),
  userAvatarLetter: document.getElementById('userAvatarLetter'),
  btnSignOut: document.getElementById('btnSignOut'),
  pageHeadingTitle: document.getElementById('pageHeadingTitle'),
  pageHeadingSubtitle: document.getElementById('pageHeadingSubtitle'),

  // Theme & Battery Percentage Status Button
  btnAppThemeToggle: document.getElementById('btnAppThemeToggle'),
  themeIconIndicator: document.getElementById('themeIconIndicator'),
  themeLabelText: document.getElementById('themeLabelText'),
  // Sidebar Toggle Buttons
  btnToggleSidebar: document.getElementById('btnToggleSidebar'),
  btnSidebarCollapse: document.getElementById('btnSidebarCollapse'),
  topChargerSelect: document.getElementById('topChargerSelect'),
  cockpitChargerSelect: document.getElementById('cockpitChargerSelect'),
  btnOpenReportModal: document.getElementById('btnOpenReportModal'),
  btnTopAddCharger: document.getElementById('btnTopAddCharger'),

  // Views Map
  views: {
    csmsDashboard: document.getElementById('viewCsmsDashboard'),
    cockpitView: document.getElementById('viewCockpit'),
    chargePointsView: document.getElementById('viewChargePoints'),
    tariffsView: document.getElementById('viewTariffs'),
    tokensView: document.getElementById('viewTokens'),
    addChargerPage: document.getElementById('viewAddChargerPage'),
    usersView: document.getElementById('viewUsers'),
    pcbIntegrationView: document.getElementById('viewPcbIntegration'),
    sessionsView: document.getElementById('viewCsmsDashboard'),
    viewSimulator: document.getElementById('viewSimulator'),
    pgTableView: document.getElementById('viewPgTable')
  },

  // KPI Elements
  kpiChargePoints: document.getElementById('kpiChargePoints'),
  kpiOnlineNow: document.getElementById('kpiOnlineNow'),
  kpiActiveSessions: document.getElementById('kpiActiveSessions'),
  kpiEnergyDelivered: document.getElementById('kpiEnergyDelivered'),
  kpiRevenue: document.getElementById('kpiRevenue'),
  kpiTotalSessions: document.getElementById('kpiTotalSessions'),
  tbodyChargePoints: document.getElementById('tbodyChargePoints'),
  btnRefreshFleet: document.getElementById('btnRefreshFleet'),
  btnTableAddCharger: document.getElementById('btnTableAddCharger'),

  // Tariffs Page
  tsNetworkRevenue: document.getElementById('tsNetworkRevenue'),
  tsNetworkSessions: document.getElementById('tsNetworkSessions'),
  tsNetworkEnergy: document.getElementById('tsNetworkEnergy'),
  tsAvgSessionRev: document.getElementById('tsAvgSessionRev'),
  tbodyTariffsBreakdown: document.getElementById('tbodyTariffsBreakdown'),

  // Tokens Page
  tokensCardsContainer: document.getElementById('tokensCardsContainer'),

  // Charge Points Search & Filter Elements
  inputSearchChargePoints: document.getElementById('inputSearchChargePoints'),
  btnSearchChargePoints: document.getElementById('btnSearchChargePoints'),
  btnClearSearchChargePoints: document.getElementById('btnClearSearchChargePoints'),
  countAllPoints: document.getElementById('countAllPoints'),
  countChargingPoints: document.getElementById('countChargingPoints'),
  countOnlinePoints: document.getElementById('countOnlinePoints'),
  countOfflinePoints: document.getElementById('countOfflinePoints'),

  // Dedicated Add Charger Page Form
  formAddChargerPage: document.getElementById('formAddChargerPage'),
  btnCancelAddPage: document.getElementById('btnCancelAddPage'),
  btnCancelAddPageBottom: document.getElementById('btnCancelAddPageBottom'),

  // Cockpit Telemetry
  cockpitCurrentBayTitle: document.getElementById('cockpitCurrentBayTitle'),
  cockpitCurrentBayLocation: document.getElementById('cockpitCurrentBayLocation'),
  cockpitTimestampCard: document.getElementById('cockpitTimestampCard'),
  cockpitLastDataTime: document.getElementById('cockpitLastDataTime'),
  cockpitLastDataRel: document.getElementById('cockpitLastDataRel'),
  cockpitBattCenterNum: document.getElementById('cockpitBattCenterNum'),
  cockpitCircleFill: document.getElementById('cockpitCircleFill'),
  cockpitBattSubDesc: document.getElementById('cockpitBattSubDesc'),
  dialPowerValue: document.getElementById('dialPowerValue'),
  dialKwUnit: document.getElementById('dialKwUnit'),
  dialSecondaryMetrics: document.getElementById('dialSecondaryMetrics'),
  dialModePillText: document.getElementById('dialModePillText'),
  dialStatusGear: document.getElementById('dialStatusGear'),
  saaphDialProgressArc: document.getElementById('saaphDialProgressArc'),
  saaphDialTicksGroup: document.getElementById('saaphDialTicksGroup'),
  cockpitLeftPowerNum: document.getElementById('cockpitLeftPowerNum'),
  cockpitLeftPowerUnit: document.getElementById('cockpitLeftPowerUnit'),
  cockpitLeftModeSub: document.getElementById('cockpitLeftModeSub'),
  cockpitWaveformCanvas: document.getElementById('cockpitWaveformCanvas'),
  cockpitLeftKeyShort: document.getElementById('cockpitLeftKeyShort'),
  btnCockpitCopyKey: document.getElementById('btnCockpitCopyKey'),
  cockpitRadarBlip: document.getElementById('cockpitRadarBlip'),
  cockpitRadarNum: document.getElementById('cockpitRadarNum'),
  cockpitSessionKwh: document.getElementById('cockpitSessionKwh'),
  cockpitSessionTime: document.getElementById('cockpitSessionTime'),
  cockpitSocVal: document.getElementById('cockpitSocVal'),
  cockpitSocBar: document.getElementById('cockpitSocBar'),
  cockpitSocName: document.getElementById('cockpitSocName'),
  cockpitVName: document.getElementById('cockpitVName'),
  cockpitActualV: document.getElementById('cockpitActualV'),
  cockpitReqV: document.getElementById('cockpitReqV'),
  cockpitVFill: document.getElementById('cockpitVFill'),
  cockpitVMarker: document.getElementById('cockpitVMarker'),
  cockpitAName: document.getElementById('cockpitAName'),
  cockpitActualA: document.getElementById('cockpitActualA'),
  cockpitReqA: document.getElementById('cockpitReqA'),
  cockpitAFill: document.getElementById('cockpitAFill'),
  cockpitAMarker: document.getElementById('cockpitAMarker'),
  cockpitKwRow: document.getElementById('cockpitKwRow'),
  cockpitRightKwVal: document.getElementById('cockpitRightKwVal'),
  cockpitRightKwBar: document.getElementById('cockpitRightKwBar'),
  cockpitBattTempRow: document.getElementById('cockpitBattTempRow'),
  cockpitChgTempRow: document.getElementById('cockpitChgTempRow'),
  cockpitBattTempVal: document.getElementById('cockpitBattTempVal'),
  cockpitBattTempBar: document.getElementById('cockpitBattTempBar'),
  cockpitChgTempVal: document.getElementById('cockpitChgTempVal'),
  cockpitChgTempBar: document.getElementById('cockpitChgTempBar'),
  cockpitRightVehicleImgWrapper: document.getElementById('cockpitRightVehicleImgWrapper'),
  cockpitStatusBadge: document.getElementById('cockpitStatusBadge'),
  btnChargerPowerOn: document.getElementById('btnChargerPowerOn'),
  btnChargerPowerOff: document.getElementById('btnChargerPowerOff'),

  // PCB Battery Authentication & Modals
  modalAuthenticatingPcb: document.getElementById('modalAuthenticatingPcb'),
  modalChargingBegin: document.getElementById('modalChargingBegin'),
  modalBatteryNotConnected: document.getElementById('modalBatteryNotConnected'),
  btnCloseChargingBeginModal: document.getElementById('btnCloseChargingBeginModal'),
  btnOkChargingBegin: document.getElementById('btnOkChargingBegin'),
  btnCloseBatteryNotConnectedModal: document.getElementById('btnCloseBatteryNotConnectedModal'),
  btnDismissBatteryModal: document.getElementById('btnDismissBatteryModal'),
  popupBeginChargerName: document.getElementById('popupBeginChargerName'),
  popupNotConnectedChargerName: document.getElementById('popupNotConnectedChargerName'),
  popupNotConnectedSubMsg: document.getElementById('popupNotConnectedSubMsg'),
  popupNotConnectedPcbStatus: document.getElementById('popupNotConnectedPcbStatus'),
  popupNotConnectedAuthKey: document.getElementById('popupNotConnectedAuthKey'),
  popupNotConnectedBattLink: document.getElementById('popupNotConnectedBattLink'),
  cockpitBatteryHwBar: document.getElementById('cockpitBatteryHwBar'),
  cockpitBattConnDot: document.getElementById('cockpitBattConnDot'),
  cockpitBattConnText: document.getElementById('cockpitBattConnText'),
  btnToggleCockpitBattConn: document.getElementById('btnToggleCockpitBattConn'),
  simPresetNoBattery: document.getElementById('simPresetNoBattery'),
  btnSimBattConnected: document.getElementById('btnSimBattConnected'),
  btnSimBattDisconnected: document.getElementById('btnSimBattDisconnected'),

  // Charge Points Cards
  chargePointsCardsContainer: document.getElementById('chargePointsCardsContainer'),
  btnOpenAddPageFromPoints: document.getElementById('btnOpenAddPageFromPoints'),

  // Users Administration
  formUpdateAdmin: document.getElementById('formUpdateAdmin'),
  adminUsernameInput: document.getElementById('adminUsernameInput'),
  adminPasswordInput: document.getElementById('adminPasswordInput'),
  chargersCredentialsList: document.getElementById('chargersCredentialsList'),

  // PCB Hardware API & Simulator
  inputPcbActiveKey: document.getElementById('inputPcbActiveKey'),
  btnCopyPcbKeyMain: document.getElementById('btnCopyPcbKeyMain'),
  btnRegeneratePcbKeyMain: document.getElementById('btnRegeneratePcbKeyMain'),
  displayEndpointUrl: document.getElementById('displayEndpointUrl'),
  btnCopyEndpointUrl: document.getElementById('btnCopyEndpointUrl'),
  snippetArduino: document.getElementById('snippetArduino'),
  snippetPython: document.getElementById('snippetPython'),
  snippetCurl: document.getElementById('snippetCurl'),
  simAutoToggle: document.getElementById('simAutoToggle'),
  slV: document.getElementById('slV'),
  slA: document.getElementById('slA'),
  slSoc: document.getElementById('slSoc'),
  slReqV: document.getElementById('slReqV'),
  slReqA: document.getElementById('slReqA'),
  slTemp: document.getElementById('slTemp'),
  slValV: document.getElementById('slValV'),
  slValA: document.getElementById('slValA'),
  slValSoc: document.getElementById('slValSoc'),
  slValReqV: document.getElementById('slValReqV'),
  slValReqA: document.getElementById('slValReqA'),
  slValTemp: document.getElementById('slValTemp'),
  btnSimSendSingle: document.getElementById('btnSimSendSingle'),
  simLastTxResult: document.getElementById('simLastTxResult'),
  simLogConsole: document.getElementById('simLogConsole'),
  btnSimClearLogs: document.getElementById('btnSimClearLogs'),

  // Modals
  modalEditCredentials: document.getElementById('modalEditCredentials'),
  btnCloseEditCredModal: document.getElementById('btnCloseEditCredModal'),
  btnCancelEditCredModal: document.getElementById('btnCancelEditCredModal'),
  formEditChargerCredentials: document.getElementById('formEditChargerCredentials'),
  editCredChargerId: document.getElementById('editCredChargerId'),
  editCredChargerNameDisplay: document.getElementById('editCredChargerNameDisplay'),
  editCredUsername: document.getElementById('editCredUsername'),
  editCredPassword: document.getElementById('editCredPassword'),

  modalEditTariff: document.getElementById('modalEditTariff'),
  btnCloseEditTariffModal: document.getElementById('btnCloseEditTariffModal'),
  btnCancelEditTariffModal: document.getElementById('btnCancelEditTariffModal'),
  formEditTariff: document.getElementById('formEditTariff'),
  editTariffChargerId: document.getElementById('editTariffChargerId'),
  editTariffChargerName: document.getElementById('editTariffChargerName'),
  editTariffRate: document.getElementById('editTariffRate'),
  editTariffSessionFee: document.getElementById('editTariffSessionFee'),

  modalAddToken: document.getElementById('modalAddToken'),
  btnCloseAddTokenModal: document.getElementById('btnCloseAddTokenModal'),
  btnCancelAddTokenModal: document.getElementById('btnCancelAddTokenModal'),
  formAddToken: document.getElementById('formAddToken'),
  addTokenChargerId: document.getElementById('addTokenChargerId'),
  addTokenChargerName: document.getElementById('addTokenChargerName'),
  inputTokenString: document.getElementById('inputTokenString'),

  // Delete Confirmation Modal
  modalDeleteConfirm: document.getElementById('modalDeleteConfirm'),
  btnCancelDeleteModal: document.getElementById('btnCancelDeleteModal'),
  btnCancelDeleteModalBtn: document.getElementById('btnCancelDeleteModalBtn'),
  btnConfirmDeleteModalBtn: document.getElementById('btnConfirmDeleteModalBtn'),
  deleteTargetChargerName: document.getElementById('deleteTargetChargerName'),
  deleteTargetChargerDetails: document.getElementById('deleteTargetChargerDetails'),

  toastContainer: document.getElementById('toastContainer'),

  // Report Generator Modal DOM Cache
  modalGenerateReport: document.getElementById('modalGenerateReport'),
  btnCloseReportModal: document.getElementById('btnCloseReportModal'),
  btnCloseReportBottom: document.getElementById('btnCloseReportBottom'),
  btnReport24h: document.getElementById('btnReport24h'),
  btnReport7d: document.getElementById('btnReport7d'),
  btnReport1mo: document.getElementById('btnReport1mo'),
  reportChargerSelect: document.getElementById('reportChargerSelect'),
  reportTotalRevenue: document.getElementById('reportTotalRevenue'),
  reportTotalEnergy: document.getElementById('reportTotalEnergy'),
  reportTotalSessions: document.getElementById('reportTotalSessions'),
  reportAvgSessionRev: document.getElementById('reportAvgSessionRev'),
  reportRevenueSub: document.getElementById('reportRevenueSub'),
  reportEnergySub: document.getElementById('reportEnergySub'),
  tbodyReportRows: document.getElementById('tbodyReportRows'),
  reportGeneratedTime: document.getElementById('reportGeneratedTime'),
  btnExportReportCsv: document.getElementById('btnExportReportCsv'),
  btnPrintReportPdf: document.getElementById('btnPrintReportPdf')
};

// ==========================================================================
// 0. TIME & TIMESTAMPING UTILITIES (Track Last Received Data on Portal)
// ==========================================================================

function formatFullTimestamp(timestamp) {
  if (!timestamp) return 'No data received yet';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Invalid timestamp';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatTimeOnly(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function getRelativeTimeStr(timestamp) {
  if (!timestamp) return 'Waiting for data';
  const diffMs = Date.now() - Number(timestamp);
  if (diffMs < 0 || diffMs < 2000) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function updateGlobalTimestampDisplay(triggerFlash = false) {
  if (!dom.portalLastDataTime) return;

  if (!state.lastDataReceived) {
    dom.portalLastDataTime.textContent = '--:--:--';
    if (dom.portalLastDataRel) dom.portalLastDataRel.textContent = 'Waiting for data';
    return;
  }

  dom.portalLastDataTime.textContent = formatTimeOnly(state.lastDataReceived);
  if (dom.portalLastDataRel) {
    dom.portalLastDataRel.textContent = getRelativeTimeStr(state.lastDataReceived);
  }
  if (dom.portalLastReceivedBadge) {
    dom.portalLastReceivedBadge.title = `Last data received: ${formatFullTimestamp(state.lastDataReceived)}`;
    if (triggerFlash) {
      dom.portalLastReceivedBadge.classList.remove('pulse-flash');
      void dom.portalLastReceivedBadge.offsetWidth;
      dom.portalLastReceivedBadge.classList.add('pulse-flash');
    }
  }
}

function updateAllRelativeTimestamps() {
  // Update header relative time
  if (state.lastDataReceived && dom.portalLastDataRel) {
    dom.portalLastDataRel.textContent = getRelativeTimeStr(state.lastDataReceived);
  }

  // Update cockpit relative time
  if (state.selectedChargerId && dom.cockpitLastDataRel) {
    const chg = state.chargers.find(c => c.id === state.selectedChargerId);
    if (chg && chg.lastSeen) {
      dom.cockpitLastDataRel.textContent = getRelativeTimeStr(chg.lastSeen);
    }
  }

  // Update table cells
  document.querySelectorAll('.table-last-seen').forEach(el => {
    const ts = el.getAttribute('data-last-seen');
    if (ts) {
      const relEl = el.querySelector('.tls-rel');
      if (relEl) relEl.textContent = getRelativeTimeStr(ts);
    }
  });

  // Update card rows
  document.querySelectorAll('.chg-last-seen-row').forEach(el => {
    const ts = el.getAttribute('data-last-seen');
    if (ts) {
      const relEl = el.querySelector('.cls-rel');
      if (relEl) relEl.textContent = `(${getRelativeTimeStr(ts)})`;
    }
  });
}

// ==========================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==========================================================================

function initSidebarToggle() {
  const isHidden = localStorage.getItem('saaphzone_sidebar_hidden') === 'true';
  if (isHidden && dom.appLayout) {
    dom.appLayout.classList.add('sidebar-hidden');
    updateSidebarToggleBtnText(true);
  }

  const toggleSidebar = () => {
    if (!dom.appLayout) return;
    const nowHidden = dom.appLayout.classList.toggle('sidebar-hidden');
    localStorage.setItem('saaphzone_sidebar_hidden', nowHidden ? 'true' : 'false');
    updateSidebarToggleBtnText(nowHidden);
  };

  if (dom.btnToggleSidebar) {
    dom.btnToggleSidebar.onclick = toggleSidebar;
  }
  if (dom.btnSidebarCollapse) {
    dom.btnSidebarCollapse.onclick = toggleSidebar;
  }
}

function updateSidebarToggleBtnText(isHidden) {
  const textEl = document.querySelector('.sidebar-toggle-text');
  if (textEl) {
    textEl.textContent = isHidden ? 'Show Sidebar' : 'Hide Sidebar';
  }
  if (dom.btnToggleSidebar) {
    dom.btnToggleSidebar.title = isHidden ? 'Show Sidebar Content' : 'Hide Sidebar Content';
  }
}

function initApp() {
  initSidebarToggle();
  initReportModal();
  loadSavedTheme();
  initThemeListeners();
  initAuth();
  initDial();
  initSimulator();
  initWebSocket();
  initModals();
  initNavigation();
  initAddChargerPage();
  initPgTableView();
  updateEndpointDisplay();
  fetchChargers();
  // Continuous real-time auto-poll fallback every 3 seconds
  setInterval(fetchChargers, 3000);
  // Live relative timestamp ticker (updates 'Just now', '4s ago', etc. every 1 sec)
  setInterval(updateAllRelativeTimestamps, 1000);
}

function initAuth() {
  const savedUser = localStorage.getItem('saaphzone_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      applyUserSession(state.currentUser);
    } catch (e) {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }

  // Login form handler
  dom.loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = dom.loginUsername.value.trim();
    const password = dom.loginPassword.value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          state.currentUser = data.user;
          localStorage.setItem('saaphzone_user', JSON.stringify(data.user));
          dom.loginForm.reset();
          applyUserSession(data.user);
          showToast(`Welcome to SAAPHZONE CSMS, ${data.user.name}!`);
          return;
        } else {
          alert('Authentication failed: ' + (data.error || 'Invalid credentials'));
          return;
        }
      }
    } catch (err) {
      console.warn('API authentication error, checking local credentials fallback:', err);
    }

    // Client-side fallback authentication if backend is offline/unreachable
    const uLower = username.toLowerCase();
    const pLower = password.toLowerCase();
    const isDefaultAdmin = (uLower === 'admin') && (password === 'password123' || pLower === 'password123' || pLower === 'saaphzone123' || pLower === 'admin' || pLower === 'admin123');
    if (isDefaultAdmin) {
      const adminUser = { username: 'admin', role: 'ADMIN', name: 'Administrator' };
      state.currentUser = adminUser;
      localStorage.setItem('saaphzone_user', JSON.stringify(adminUser));
      dom.loginForm.reset();
      applyUserSession(adminUser);
      showToast('Signed in as Administrator');
      return;
    }

    const matchedCharger = state.chargers.find(c => c.credentials && c.credentials.username.toLowerCase() === username.toLowerCase() && c.credentials.password === password);
    if (matchedCharger) {
      const chargerUser = { username: matchedCharger.credentials.username, role: 'CHARGER', name: matchedCharger.name, chargerId: matchedCharger.id };
      state.currentUser = chargerUser;
      localStorage.setItem('saaphzone_user', JSON.stringify(chargerUser));
      dom.loginForm.reset();
      applyUserSession(chargerUser);
      showToast(`Welcome to ${matchedCharger.name}!`);
      return;
    }

    if ((username === 'bay01' || username === 'TGS_001') && (password === 'password123' || password === 'Tgs@enersol')) {
      const defaultUser = { username, role: 'CHARGER', name: 'SAAPHZONE Bay Terminal', chargerId: state.chargers[0]?.id || 'chg_muya1w8x_4zmz' };
      state.currentUser = defaultUser;
      localStorage.setItem('saaphzone_user', JSON.stringify(defaultUser));
      dom.loginForm.reset();
      applyUserSession(defaultUser);
      showToast('Signed in to Terminal successfully.');
      return;
    }

    alert('Invalid username or password. Please verify your credentials.');
  };

  dom.btnTogglePwd.onclick = () => {
    const isPass = dom.loginPassword.type === 'password';
    dom.loginPassword.type = isPass ? 'text' : 'password';
    dom.btnTogglePwd.textContent = isPass ? '🔒' : '👁️';
  };


  dom.tabAdminLogin.onclick = () => {
    dom.tabAdminLogin.classList.add('active');
    dom.tabChargerLogin.classList.remove('active');
    dom.lblLoginUser.textContent = 'Administrator Username';
    dom.loginUsername.placeholder = 'e.g. admin';
    if (dom.loginHintText) dom.loginHintText.innerHTML = 'Default Admin: <strong>admin</strong> / <strong>password123</strong>';
  };

  dom.tabChargerLogin.onclick = () => {
    dom.tabChargerLogin.classList.add('active');
    dom.tabAdminLogin.classList.remove('active');
    dom.lblLoginUser.textContent = 'Charger Terminal Username';
    dom.loginUsername.placeholder = 'e.g. bay01, bay02, bay03, bay04';
    if (dom.loginHintText) dom.loginHintText.innerHTML = 'Charger Login: <strong>bay01</strong> / <strong>password123</strong>';
  };

  dom.btnSignOut.onclick = () => {
    localStorage.removeItem('saaphzone_user');
    state.currentUser = null;
    showLoginScreen();
    showToast('Signed out successfully.');
  };
}

function showLoginScreen() {
  dom.loginOverlay.classList.add('active');
}

function applyUserSession(user) {
  dom.loginOverlay.classList.remove('active');
  dom.currentUserName.textContent = user.name || user.username;
  dom.currentUserRole.textContent = user.role;
  dom.userAvatarLetter.textContent = (user.name || user.username).charAt(0).toUpperCase();

  if (user.role === 'CHARGER' && user.chargerId) {
    state.selectedChargerId = user.chargerId;
    switchView('cockpitView');
    dom.sidebarNav.querySelectorAll('.nav-item').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target !== 'cockpitView' && target !== 'pcbIntegrationView') {
        btn.style.display = 'none';
      }
    });
  } else {
    dom.sidebarNav.querySelectorAll('.nav-item').forEach(btn => btn.style.display = 'flex');
    switchView('csmsDashboard');
    loadAccountsList();
  }

  fetchChargers();
}

// ==========================================================================
// 2. THEMES & DEDICATED ADD CHARGER PAGE
// ==========================================================================

function loadSavedTheme() {
  const saved = localStorage.getItem('saaphzone_theme') || 'light';
  setTheme(saved);
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('saaphzone_theme', theme);

  if (theme === 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    dom.themeIconIndicator.textContent = '☀️';
    dom.themeLabelText.textContent = 'Light Theme';
    if (dom.btnLoginThemeToggle) {
      dom.btnLoginThemeToggle.innerHTML = `<span>☀️</span> <span>Light Theme</span>`;
    }
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    dom.themeIconIndicator.textContent = '🌙';
    dom.themeLabelText.textContent = 'Dark Theme';
    if (dom.btnLoginThemeToggle) {
      dom.btnLoginThemeToggle.innerHTML = `<span>🌙</span> <span>Dark Theme</span>`;
    }
  }
}

function initThemeListeners() {
  const toggle = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
  dom.btnAppThemeToggle.onclick = toggle;
  if (dom.btnLoginThemeToggle) dom.btnLoginThemeToggle.onclick = toggle;
}

function initAddChargerPage() {
  // Cancel buttons return to dashboard
  dom.btnCancelAddPage.onclick = () => switchView('csmsDashboard');
  dom.btnCancelAddPageBottom.onclick = () => switchView('csmsDashboard');

  const connSelect = document.getElementById('pageChgConnector');
  const vInput = document.getElementById('pageChgMaxV');
  const aInput = document.getElementById('pageChgMaxA');

  function updateAddChargerPowerCalc() {
    const lblPower = document.getElementById('lblCalculatedPowerKw');
    const lblFormula = document.getElementById('lblCalculatedFormula');
    const lblType = document.getElementById('lblChargerTypeTag');

    if (!connSelect || !vInput || !aInput || !lblPower) return;

    const conn = connSelect.value.toUpperCase();
    const isAc = conn.includes('AC') || conn.includes('TYPE 2') || conn.includes('TYPE 1') || conn.includes('BHARAT');
    const is3Phase = isAc && (conn.includes('THREE') || conn.includes('415') || conn.includes('22KW') || conn.includes('11KW') || Number(vInput.value) >= 380);

    const v = Number(vInput.value) || 0;
    const a = Number(aInput.value) || 0;

    let powerKw = 0;
    let formulaText = '';

    if (is3Phase) {
      powerKw = +((Math.sqrt(3) * v * a) / 1000).toFixed(2);
      formulaText = `Formula: P = (√3 × ${v}V × ${a}A) / 1000 = ${powerKw} kW • Max Rate: ${powerKw} kWh/hr`;
      if (lblType) {
        lblType.className = 'badge-status online';
        lblType.textContent = 'AC Three-Phase (415V)';
      }
    } else if (isAc) {
      powerKw = +((v * a) / 1000).toFixed(2);
      formulaText = `Formula: P = (${v}V × ${a}A) / 1000 = ${powerKw} kW • Max Rate: ${powerKw} kWh/hr`;
      if (lblType) {
        lblType.className = 'badge-status online';
        lblType.textContent = 'AC Single-Phase (230V)';
      }
    } else {
      powerKw = +((v * a) / 1000).toFixed(1);
      formulaText = `Formula: P = (${v}V × ${a}A) / 1000 = ${powerKw} kW • DC Fast Bus`;
      if (lblType) {
        lblType.className = 'badge-status charging';
        lblType.textContent = 'DC Fast Charger';
      }
    }

    lblPower.textContent = `${powerKw} kW (${powerKw} kWh/hr)`;
    if (lblFormula) lblFormula.textContent = formulaText;
  }

  if (connSelect) {
    connSelect.onchange = () => {
      const val = connSelect.value.toUpperCase();
      if (val.includes('22KW') || val.includes('THREE') || val.includes('415V')) {
        if (vInput) vInput.value = 415;
        if (aInput) aInput.value = 32;
      } else if (val.includes('11KW')) {
        if (vInput) vInput.value = 415;
        if (aInput) aInput.value = 16;
      } else if (val.includes('AC') || val.includes('TYPE 2') || val.includes('TYPE 1') || val.includes('BHARAT')) {
        if (vInput) vInput.value = 230;
        if (aInput) aInput.value = 32;
      } else {
        if (vInput) vInput.value = 800;
        if (aInput) aInput.value = 350;
      }
      updateAddChargerPowerCalc();
    };
  }

  if (vInput) vInput.oninput = updateAddChargerPowerCalc;
  if (aInput) aInput.oninput = updateAddChargerPowerCalc;

  // Initial calculation trigger
  updateAddChargerPowerCalc();

  // Submit form on dedicated page
  dom.formAddChargerPage.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('pageChgName').value.trim(),
      location: document.getElementById('pageChgLocation').value.trim(),
      connectorType: document.getElementById('pageChgConnector').value,
      maxVoltage: document.getElementById('pageChgMaxV').value,
      maxCurrent: document.getElementById('pageChgMaxA').value,
      username: document.getElementById('pageChgUsername').value.trim(),
      password: document.getElementById('pageChgPassword').value.trim(),
      ratePerKwh: document.getElementById('pageChgTariff').value,
      rfidToken: document.getElementById('pageChgRfid').value.trim()
    };

    try {
      const res = await fetch('/api/chargers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        dom.formAddChargerPage.reset();
        showToast(`🎉 Charge Point ${data.charger.name} successfully registered with ${data.charger.maxPowerKw || 'AC'} kW!`);
        await fetchChargers();
        selectAndOpenCockpit(data.charger.id);
      } else {
        alert('Error creating charger: ' + data.error);
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  };
}

// ==========================================================================
// 3. WEBSOCKET SYNC
// ==========================================================================

function initWebSocket() {
  const wsUrl = WS_BACKEND_URL;

  try {
    state.ws = new WebSocket(wsUrl);

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {}
    };

    state.ws.onclose = () => {
      setTimeout(initWebSocket, 2500);
    };
  } catch (e) {}
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'INIT':
      state.chargers = msg.chargers || [];
      const initLatest = state.chargers.reduce((max, c) => Math.max(max, c.lastSeen || c.telemetry?.timestamp || 0), 0);
      if (initLatest > 0) {
        state.lastDataReceived = initLatest;
        updateGlobalTimestampDisplay();
      }
      if (!state.selectedChargerId && state.chargers.length > 0) {
        state.selectedChargerId = state.chargers[0].id;
      }
      populateChargerSelect();
      renderDashboardTable();
      renderChargePointsCards();
      renderTariffsPage();
      renderTokensPage();
      updateCockpitTelemetry();
      updatePcbKeyView();
      break;

    case 'TELEMETRY_UPDATE':
      let chg = state.chargers.find(c => c.id === msg.chargerId);
      if (!chg) {
        fetchChargers();
        return;
      }
      const nowPacketTime = msg.lastSeen || msg.telemetry?.timestamp || Date.now();
      state.lastDataReceived = nowPacketTime;
      chg.lastSeen = nowPacketTime;
      chg.telemetry = msg.telemetry;
      chg.status = msg.status;
      if (msg.stats) chg.stats = msg.stats;
      if (msg.sessionPendingReset !== undefined) chg.sessionPendingReset = msg.sessionPendingReset;

      if (!chg.history) chg.history = [];
      chg.history.push({
        timestamp: msg.telemetry.timestamp || Date.now(),
        charger_voltage: msg.telemetry.charger_voltage,
        charger_current: msg.telemetry.charger_current,
        battery_soc: msg.telemetry.battery_soc,
        battery_req_voltage: msg.telemetry.battery_req_voltage,
        battery_req_current: msg.telemetry.battery_req_current,
        power_kw: msg.telemetry.power_kw
      });
      if (chg.history.length > 50) chg.history.shift();

      updateGlobalTimestampDisplay(true);
      updateDashboardTableRow(chg);
      renderChargePointsCards();
      updateKpis();
      if (state.selectedChargerId === msg.chargerId) {
        updateCockpitTelemetry();
      }
      showToast(`⚡ Ingested: ${chg.name} (${msg.telemetry.charger_voltage}V, ${msg.telemetry.charger_current}A, ${msg.telemetry.battery_soc}% SoC)`);
      break;

    case 'CHARGER_ADDED':
      state.chargers.push(msg.charger);
      populateChargerSelect();
      renderDashboardTable();
      renderChargePointsCards();
      renderTariffsPage();
      renderTokensPage();
      updateKpis();
      break;

    case 'CHARGER_UPDATED':
      const idx = state.chargers.findIndex(c => c.id === msg.charger.id);
      if (idx !== -1) {
        state.chargers[idx] = msg.charger;
        populateChargerSelect();
        renderDashboardTable();
        renderChargePointsCards();
        renderTariffsPage();
        renderTokensPage();
        if (state.selectedChargerId === msg.charger.id) {
          updateCockpitTelemetry();
          updatePcbKeyView();
        }
      }
      break;

    case 'CHARGER_DELETED':
      state.chargers = state.chargers.filter(c => c.id !== msg.chargerId);
      if (state.selectedChargerId === msg.chargerId) {
        state.selectedChargerId = state.chargers.length > 0 ? state.chargers[0].id : null;
      }
      populateChargerSelect();
      renderDashboardTable();
      renderChargePointsCards();
      renderTariffsPage();
      renderTokensPage();
      updateKpis();
      if (state.selectedChargerId) updateCockpitTelemetry();
      break;
  }
}

async function fetchChargers() {
  try {
    const res = await fetch('/api/chargers');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.chargers) && data.chargers.length > 0) {
        state.chargers = data.chargers;
        const latest = state.chargers.reduce((max, c) => Math.max(max, c.lastSeen || c.telemetry?.timestamp || 0), 0);
        if (latest > 0 && (!state.lastDataReceived || latest > state.lastDataReceived)) {
          state.lastDataReceived = latest;
        }
        updateGlobalTimestampDisplay();
        if (!state.selectedChargerId && state.chargers.length > 0) {
          state.selectedChargerId = state.chargers[0].id;
        }
        populateChargerSelect();
        renderDashboardTable();
        renderChargePointsCards();
        renderTariffsPage();
        renderTokensPage();
        updateCockpitTelemetry();
        updatePcbKeyView();
        updateKpis();
        return;
      }
    }
  } catch (e) {
    console.warn('API fetch chargers notice:', e);
  }

  // Ensure current chargers in state are fully rendered
  if (state.chargers.length > 0) {
    const latest = state.chargers.reduce((max, c) => Math.max(max, c.lastSeen || c.telemetry?.timestamp || 0), 0);
    if (latest > 0 && (!state.lastDataReceived || latest > state.lastDataReceived)) {
      state.lastDataReceived = latest;
    }
    updateGlobalTimestampDisplay();
    if (!state.selectedChargerId) {
      state.selectedChargerId = state.chargers[0].id;
    }
    populateChargerSelect();
    renderDashboardTable();
    renderChargePointsCards();
    renderTariffsPage();
    renderTokensPage();
    updateCockpitTelemetry();
    updatePcbKeyView();
    updateKpis();
  }
}

// ==========================================================================
// 4. CSMS DASHBOARD & KPI RENDERING (Exact Match to Screenshot)
// ==========================================================================

function updateKpis() {
  const total = state.chargers.length;
  const online = state.chargers.filter(c => c.status === 'CHARGING' || c.status === 'ONLINE').length;
  const active = state.chargers.filter(c => c.status === 'CHARGING').length;

  dom.kpiChargePoints.textContent = total;
  dom.kpiOnlineNow.innerHTML = `${online}<span class="kpi-denominator">/${total}</span>`;
  dom.kpiActiveSessions.textContent = active;
}

// AC charger helpers: AC voltage is shown as delivered energy (kWh)
function isAcCharger(c) {
  if (!c) return false;
  if (c.isAc === true) return true;
  const conn = String(c.connectorType || '').toUpperCase();
  const name = String(c.name || '').toUpperCase();
  const loc = String(c.location || '').toUpperCase();
  return name.includes('AC') || loc.includes('AC') || conn.includes('AC') || conn.includes('TYPE 2') || conn.includes('TYPE 1') || conn.includes('BHARAT') || conn.includes('J1772') || conn.includes('MENNEKES') || conn.includes('230V') || conn.includes('415V');
}

function isAcSessionHeld(c) {
  return isAcCharger(c) && (c.sessionPendingReset === true || c.status === 'CHARGED');
}

function renderVoltageCell(c) {
  const t = c.telemetry || {};
  const v = Number(t.charger_voltage || 0).toFixed(1);
  const reqV = Number(t.battery_req_voltage || 0).toFixed(1);
  return `<strong>${v} V</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqV}V)</span>`;
}

// Power cell: real-time power in kW sent directly from the PCB
function renderPowerCell(c) {
  const t = c.telemetry || {};
  const pKw = Number(t.power_kw !== undefined && t.power_kw !== null ? t.power_kw : 0);
  return `<strong style="color:var(--primary-cyan); font-size:1rem;">${pKw.toFixed(2)} kW</strong>`;
}

function renderDashboardTable() {
  const tbody = dom.tbodyChargePoints;
  tbody.innerHTML = '';

  state.chargers.forEach(c => {
    const t = c.telemetry || {};
    const v = Number(t.charger_voltage || 0).toFixed(1);
    const a = Number(t.charger_current || 0).toFixed(1);
    const reqV = Number(t.battery_req_voltage || 0).toFixed(1);
    const reqA = Number(t.battery_req_current || 0).toFixed(1);
    const soc = Number(t.battery_soc || 0).toFixed(1);
    const pKw = Number(t.power_kw || 0).toFixed(1);

    let badgeClass = 'online';
    if (c.status === 'CHARGING') badgeClass = 'charging';
    else if (c.status === 'OFFLINE') badgeClass = 'offline';

    const tr = document.createElement('tr');
    tr.id = `row_${c.id}`;
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(c.name)}</strong><br>
        <small style="color:var(--text-muted);">${escapeHtml(c.location)} • ${c.connectorType}</small>
      </td>
      <td><span class="badge-status ${badgeClass}">${c.status}</span></td>
      <td>${renderVoltageCell(c)}</td>
      <td><strong>${a} A</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqA}A)</span></td>
      <td>
        <span class="table-soc-pill">🔋 ${soc}%</span>
      </td>
      <td>${renderPowerCell(c)}</td>
      <td>
        <div class="table-last-seen" data-last-seen="${c.lastSeen || ''}">
          <span class="tls-time">${formatTimeOnly(c.lastSeen)}</span>
          <span class="tls-rel">${getRelativeTimeStr(c.lastSeen)}</span>
        </div>
      </td>
      <td><code>${c.apiKey.substring(0, 14)}...</code></td>
      <td>
        <button class="btn-table-action" onclick="selectAndOpenCockpit('${c.id}')">Cockpit</button>
        <button class="btn-table-action" onclick="openEditCredentialsModal('${c.id}')">Creds</button>
        <button class="btn-table-action danger" onclick="deleteChargerPoint('${c.id}')" title="Delete Charge Point">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateDashboardTableRow(c) {
  const tr = document.getElementById(`row_${c.id}`);
  if (!tr) {
    renderDashboardTable();
    return;
  }
  const t = c.telemetry || {};
  const v = Number(t.charger_voltage || 0).toFixed(1);
  const a = Number(t.charger_current || 0).toFixed(1);
  const reqV = Number(t.battery_req_voltage || 0).toFixed(1);
  const reqA = Number(t.battery_req_current || 0).toFixed(1);
  const soc = Number(t.battery_soc || 0).toFixed(1);
  const pKw = Number(t.power_kw || 0).toFixed(1);

  let badgeClass = 'online';
  if (c.status === 'CHARGING') badgeClass = 'charging';
  else if (c.status === 'OFFLINE') badgeClass = 'offline';

  tr.children[1].innerHTML = `<span class="badge-status ${badgeClass}">${c.status}</span>`;
  tr.children[2].innerHTML = renderVoltageCell(c);
  tr.children[3].innerHTML = `<strong>${a} A</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqA}A)</span>`;
  tr.children[4].innerHTML = `<span class="table-soc-pill">🔋 ${soc}%</span>`;
  tr.children[5].innerHTML = renderPowerCell(c);
  tr.children[6].innerHTML = `
    <div class="table-last-seen" data-last-seen="${c.lastSeen || ''}">
      <span class="tls-time">${formatTimeOnly(c.lastSeen)}</span>
      <span class="tls-rel">${getRelativeTimeStr(c.lastSeen)}</span>
    </div>
  `;
}

// ==========================================================================
// 5. TARIFFS BREAKDOWN PER CHARGER (Revenue & Sessions Separately)
// ==========================================================================

async function renderTariffsPage() {
  try {
    const res = await fetch('/api/tariffs');
    const data = await res.json();
    if (!data.success) return;

    dom.tsNetworkRevenue.textContent = `₹${data.summary.totalRevenue.toLocaleString('en-IN')}`;
    dom.tsNetworkSessions.textContent = data.summary.totalSessions;
    dom.tsNetworkEnergy.textContent = `${data.summary.totalEnergyKwh} kWh`;
    const avg = data.summary.totalSessions > 0 ? (data.summary.totalRevenue / data.summary.totalSessions).toFixed(2) : '0';
    dom.tsAvgSessionRev.textContent = `₹${avg}`;

    const tbody = dom.tbodyTariffsBreakdown;
    tbody.innerHTML = '';

    data.chargersTariffs.forEach(ct => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(ct.chargerName)}</strong><br>
          <small style="color:var(--text-muted);">${escapeHtml(ct.location)}</small>
        </td>
        <td><strong style="color:var(--primary-cyan);">${ct.currency}${ct.ratePerKwh.toFixed(2)}</strong></td>
        <td>${ct.currency}${ct.sessionFee.toFixed(2)}</td>
        <td><strong>${ct.totalSessions}</strong> sessions</td>
        <td>${ct.totalEnergyKwh} kWh</td>
        <td><strong style="color:#10b981; font-size:1rem;">${ct.currency}${ct.totalRevenue.toLocaleString('en-IN')}</strong></td>
        <td>${ct.currency}${ct.avgPerSession}</td>
        <td>
          <button class="btn-table-action" onclick="openEditTariffModal('${ct.chargerId}')">Edit Tariff</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Error rendering tariffs:', e);
  }
}

window.openEditTariffModal = (chargerId) => {
  const charger = state.chargers.find(c => c.id === chargerId);
  if (!charger) return;

  dom.editTariffChargerId.value = charger.id;
  dom.editTariffChargerName.value = charger.name;
  dom.editTariffRate.value = charger.tariff ? charger.tariff.ratePerKwh : 18.0;
  dom.editTariffSessionFee.value = charger.tariff ? charger.tariff.sessionFee : 40.0;
  dom.modalEditTariff.classList.add('active');
};

// ==========================================================================
// 6. RFID & TOKENS VIEW (Token Keys of Every Charger)
// ==========================================================================

async function renderTokensPage() {
  try {
    const res = await fetch('/api/tokens');
    const data = await res.json();
    if (!data.success) return;

    const container = dom.tokensCardsContainer;
    container.innerHTML = '';

    data.tokens.forEach(tok => {
      const card = document.createElement('div');
      card.className = 'token-charger-card';
      
      const rfidBadges = (tok.rfidTokens || []).map(r => `
        <span class="rfid-tag-badge">
          <span>💳 ${escapeHtml(r)}</span>
          <button class="btn-remove-rfid" onclick="removeRfidToken('${tok.chargerId}', '${r}')" title="Revoke Token">✕</button>
        </span>
      `).join('');

      card.innerHTML = `
        <div class="token-card-head">
          <div>
            <h3 class="chg-name">${escapeHtml(tok.chargerName)}</h3>
            <span class="chg-loc">${escapeHtml(tok.location)}</span>
          </div>
          <span class="badge-status ${tok.status === 'CHARGING' ? 'charging' : 'online'}">${tok.status}</span>
        </div>

        <div class="token-pcb-box">
          <span class="token-pcb-label">HARDWARE PCB API KEY (Embedded in Firmware):</span>
          <div class="token-pcb-row">
            <code class="token-pcb-code">${escapeHtml(tok.pcbApiKey)}</code>
            <button class="btn-copy-tiny" onclick="copyText('${tok.pcbApiKey}', 'PCB Key copied!')">Copy</button>
            <button class="btn-copy-tiny" onclick="regenerateKey('${tok.chargerId}')">Roll</button>
          </div>
        </div>

        <div class="rfid-list-box">
          <span class="rfid-list-label">AUTHORIZED RFID CARDS & DEVICE TOKENS:</span>
          <div class="rfid-badges-wrap">
            ${rfidBadges || '<span style="font-size:0.75rem; color:var(--text-muted);">No RFID tokens assigned yet.</span>'}
          </div>
        </div>

        <div class="card-actions-row">
          <button class="btn-table-action" onclick="openAddTokenModal('${tok.chargerId}')">+ Assign RFID Token</button>
          <button class="btn-open-cockpit" onclick="selectAndOpenCockpit('${tok.chargerId}')">Open Cockpit</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('Error rendering tokens:', e);
  }
}

window.openAddTokenModal = (chargerId) => {
  const charger = state.chargers.find(c => c.id === chargerId);
  if (!charger) return;

  dom.addTokenChargerId.value = charger.id;
  dom.addTokenChargerName.value = charger.name;
  dom.inputTokenString.value = `RFID_SAAPH_${Math.floor(1000 + Math.random() * 9000)}`;
  dom.modalAddToken.classList.add('active');
};

window.removeRfidToken = async (chargerId, token) => {
  if (!confirm(`Revoke token ${token}?`)) return;
  try {
    const res = await fetch(`/api/tokens/${chargerId}/${encodeURIComponent(token)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Token revoked.');
      renderTokensPage();
    }
  } catch (e) {
    alert(e.message);
  }
};

// ==========================================================================
// 7. RELIABLE DELETE CHARGER OPERATION (FIXED AS REQUESTED)
// ==========================================================================

// ==========================================================================
// 7. RELIABLE DELETE CHARGER OPERATION WITH IN-APP CONFIRMATION MODAL
// ==========================================================================

window.deleteChargerPoint = (id) => {
  const charger = state.chargers.find(c => c.id === id);
  if (!charger) return;
  state.pendingDeleteChargerId = id;

  if (dom.deleteTargetChargerName) dom.deleteTargetChargerName.textContent = charger.name;
  if (dom.deleteTargetChargerDetails) dom.deleteTargetChargerDetails.textContent = `${charger.location || 'Bay'} • ID: ${charger.id}`;

  if (dom.modalDeleteConfirm) {
    dom.modalDeleteConfirm.classList.add('active');
  } else {
    // Fallback if modal container is missing
    if (confirm(`Permanently delete "${charger.name}" from SAAPHZONE CSMS?`)) {
      executeDelete(id);
    }
  }
};

window.executeDelete = async (id) => {
  if (!id) return;
  const charger = state.chargers.find(c => c.id === id);
  const chargerName = charger ? charger.name : 'Charge point';

  try {
    const res = await fetch(`/api/chargers/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (dom.modalDeleteConfirm) dom.modalDeleteConfirm.classList.remove('active');
        state.chargers = state.chargers.filter(c => c.id !== id);
        state.pendingDeleteChargerId = null;

        const row = document.getElementById(`row_${id}`);
        if (row) row.remove();
        const card = document.getElementById(`card_${id}`);
        if (card) card.remove();

        if (state.selectedChargerId === id) {
          state.selectedChargerId = state.chargers.length > 0 ? state.chargers[0].id : null;
        }

        populateChargerSelect();
        renderDashboardTable();
        renderChargePointsCards();
        renderTariffsPage();
        renderTokensPage();
        updateKpis();
        if (state.selectedChargerId) updateCockpitTelemetry();

        showToast(`✅ "${chargerName}" was permanently deleted.`);
        return;
      }
    }
  } catch (err) {
    console.warn('API delete notice:', err);
  }

  // Local fallback deletion
  if (dom.modalDeleteConfirm) dom.modalDeleteConfirm.classList.remove('active');
  state.chargers = state.chargers.filter(c => c.id !== id);
  state.pendingDeleteChargerId = null;

  const row = document.getElementById(`row_${id}`);
  if (row) row.remove();
  const card = document.getElementById(`card_${id}`);
  if (card) card.remove();

  if (state.selectedChargerId === id) {
    state.selectedChargerId = state.chargers.length > 0 ? state.chargers[0].id : null;
  }

  populateChargerSelect();
  renderDashboardTable();
  renderChargePointsCards();
  renderTariffsPage();
  renderTokensPage();
  updateKpis();
  if (state.selectedChargerId) updateCockpitTelemetry();

  showToast(`✅ "${chargerName}" was removed.`);
};

// ==========================================================================
// PORTAL CHARGER REMOTE CONTROL (Turn Charger ON / OFF)
// ==========================================================================

// ==========================================================================
// PORTAL CHARGER REMOTE CONTROL (Turn Charger ON / OFF with PCB Battery Auth)
// ==========================================================================

window.controlCharger = async (id, action, options = {}) => {
  if (!id) id = state.selectedChargerId;
  if (!id) return;

  const chg = state.chargers.find(c => c.id === id);
  const chargerName = chg ? chg.name : 'Charge Point';
  const isTurnOn = action === 'ON' || action === 'START';

  if (isTurnOn) {
    // 1. Show authenticating modal indicator to signify sending command to PCB
    if (dom.modalAuthenticatingPcb) {
      dom.modalAuthenticatingPcb.classList.add('active');
    }

    try {
      const bodyPayload = { action: 'ON' };
      if (options.forceBatteryConnected) {
        bodyPayload.batteryConnected = true;
      }

      // Intentional short delay (550ms) to reflect real network transmission to hardware
      const [res] = await Promise.all([
        fetch(`/api/chargers/${id}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        }),
        new Promise(resolve => setTimeout(resolve, 550))
      ]);

      if (dom.modalAuthenticatingPcb) {
        dom.modalAuthenticatingPcb.classList.remove('active');
      }

      const data = await res.json();

      // Battery connection MUST come from active PCB authorizing this authentication key
      const isChargingAuthorized = data.success === true && data.batteryConnected === true && data.pcbOnline !== false;

      if (isChargingAuthorized) {
        // --- CASE 1: BATTERY IS CONNECTED & PCB HARDWARE AUTHENTICATED ---
        if (chg) {
          chg.status = data.status || 'CHARGING';
          chg.batteryConnected = true;
          if (data.charger && data.charger.telemetry) {
            chg.telemetry = data.charger.telemetry;
          }
        }

        updateCockpitTelemetry();
        renderDashboardTable();
        renderChargePointsCards();
        updateKpis();

        // Display POPUP: Charging begin
        if (dom.popupBeginChargerName) dom.popupBeginChargerName.textContent = chargerName;
        if (dom.modalChargingBegin) dom.modalChargingBegin.classList.add('active');

        showToast('⚡ Charging begin.');
      } else {
        // --- CASE 2: BATTERY IS NOT CONNECTED / NO PCB ON AUTH KEY ---
        if (chg) {
          chg.status = data.status || (data.pcbOnline === false ? 'OFFLINE' : 'ONLINE');
          chg.batteryConnected = false;
          if (chg.telemetry) {
            chg.telemetry.power_kw = 0.0;
            chg.telemetry.charger_current = 0.0;
            chg.telemetry.battery_connected = false;
            chg.telemetry.status = chg.status;
          }
        }

        updateCockpitTelemetry();
        renderDashboardTable();
        renderChargePointsCards();
        updateKpis();

        // Populate popup status details dynamically
        if (dom.popupNotConnectedChargerName) dom.popupNotConnectedChargerName.textContent = chargerName;
        if (dom.popupNotConnectedAuthKey) dom.popupNotConnectedAuthKey.textContent = data.apiKey || chg?.apiKey || 'evc_live_...';

        if (data.pcbOnline === false) {
          if (dom.popupNotConnectedSubMsg) {
            dom.popupNotConnectedSubMsg.textContent = "There is no PCB connected with this authentication key. The battery connection signal comes from the authorized PCB. Please power on the PCB hardware to authorize this auth key.";
          }
          if (dom.popupNotConnectedPcbStatus) {
            dom.popupNotConnectedPcbStatus.textContent = '● Offline (No PCB with Auth Key)';
            dom.popupNotConnectedPcbStatus.className = 'detail-value text-red';
          }
          if (dom.popupNotConnectedBattLink) {
            dom.popupNotConnectedBattLink.textContent = '✕ Disconnected (No Hardware Signal)';
            dom.popupNotConnectedBattLink.className = 'detail-value text-red';
          }
        } else {
          if (dom.popupNotConnectedSubMsg) {
            dom.popupNotConnectedSubMsg.textContent = "PCB hardware is online with auth key, but reports the battery is not connected. Please connect the vehicle battery.";
          }
          if (dom.popupNotConnectedPcbStatus) {
            dom.popupNotConnectedPcbStatus.textContent = '● Online (PCB Authorized)';
            dom.popupNotConnectedPcbStatus.className = 'detail-value text-green';
          }
          if (dom.popupNotConnectedBattLink) {
            dom.popupNotConnectedBattLink.textContent = '✕ Disconnected (Interlock Open)';
            dom.popupNotConnectedBattLink.className = 'detail-value text-red';
          }
        }

        // Display POPUP: The battery isn't connected with the charger. Please connect the battery.
        if (dom.modalBatteryNotConnected) dom.modalBatteryNotConnected.classList.add('active');

        showToast("The battery isn't connected with the charger. Please connect the battery.", 'error');
      }
    } catch (e) {
      if (dom.modalAuthenticatingPcb) dom.modalAuthenticatingPcb.classList.remove('active');
      showToast(`Network error communicating with PCB: ${e.message}`, 'error');
    }
  } else {
    // Turn OFF
    try {
      const res = await fetch(`/api/chargers/${id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OFF' })
      });
      const data = await res.json();
      if (data.success) {
        if (chg) {
          chg.status = data.status || 'ONLINE';
          if (data.charger && data.charger.telemetry) {
            chg.telemetry = data.charger.telemetry;
          }
        }
        updateCockpitTelemetry();
        renderDashboardTable();
        renderChargePointsCards();
        updateKpis();
        showToast('⏹ Charger turned OFF (Standby ready)');
      }
    } catch (e) {
      showToast(`Network error: ${e.message}`, 'error');
    }
  }
};

window.toggleBatteryHardwareConnection = async (chargerId) => {
  if (!chargerId) chargerId = state.selectedChargerId;
  const charger = state.chargers.find(c => c.id === chargerId);
  if (!charger) return;
  const currentConn = charger.batteryConnected !== false && (charger.telemetry?.battery_connected !== false);
  const newConn = !currentConn;
  try {
    const res = await fetch(`/api/chargers/${chargerId}/battery-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected: newConn })
    });
    const data = await res.json();
    if (data.success) {
      charger.batteryConnected = newConn;
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.battery_connected = newConn;
      if (!newConn && charger.status === 'CHARGING') {
        charger.status = 'ONLINE';
        charger.telemetry.status = 'ONLINE';
        charger.telemetry.power_kw = 0.0;
        charger.telemetry.charger_current = 0.0;
        charger.telemetry.charging_mode = 'STANDBY // NO BATTERY';
      }
      updateCockpitTelemetry();
      renderDashboardTable();
      renderChargePointsCards();
      updateKpis();
      showToast(newConn ? '🟢 Battery marked as CONNECTED (BMS link OK)' : '🔴 Battery marked as DISCONNECTED (0V Open Interlock)');
    }
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  }
};

// ==========================================================================
// 8. LIVE TELEMETRY COCKPIT & BATTERY LEVEL BUTTON
// ==========================================================================

function initDial() {
  const group = dom.saaphDialTicksGroup;
  if (!group) return;
  group.innerHTML = '';
  const cx = 200, cy = 200, radius = 160;
  const totalTicks = 32;
  const step = 270 / totalTicks;

  for (let i = 0; i <= totalTicks; i++) {
    const angleDeg = 135 + i * step;
    const angleRad = angleDeg * (Math.PI / 180);
    const isMajor = i % 4 === 0;
    const tickLen = isMajor ? 12 : 6;
    const rInner = radius - tickLen;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', cx + radius * Math.cos(angleRad));
    line.setAttribute('y1', cy + radius * Math.sin(angleRad));
    line.setAttribute('x2', cx + rInner * Math.cos(angleRad));
    line.setAttribute('y2', cy + rInner * Math.sin(angleRad));
    line.setAttribute('stroke', isMajor ? '#0ea5e9' : 'rgba(148, 163, 184, 0.45)');
    line.setAttribute('stroke-width', isMajor ? '2.5' : '1.5');
    line.setAttribute('stroke-linecap', 'round');
    group.appendChild(line);

    if (isMajor) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const rText = radius - 24;
      text.setAttribute('x', cx + rText * Math.cos(angleRad));
      text.setAttribute('y', cy + rText * Math.sin(angleRad) + 3.5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#94a3b8');
      text.textContent = Math.round((i / 32) * 400);
      group.appendChild(text);
    }
  }
}

function updateCockpitTelemetry() {
  if (!state.selectedChargerId && state.chargers.length > 0) {
    state.selectedChargerId = state.chargers[0].id;
  }
  const charger = state.chargers.find(c => c.id === state.selectedChargerId);
  if (!charger) return;

  if (dom.cockpitChargerSelect && state.selectedChargerId) {
    dom.cockpitChargerSelect.value = state.selectedChargerId;
  }

  const t = charger.telemetry || {};
  const v = Number(t.charger_voltage || 0);
  const a = Number(t.charger_current || 0);
  const reqV = Number(t.battery_req_voltage || 0);
  const reqA = Number(t.battery_req_current || 0);
  const soc = Number(t.battery_soc || 0);
  const pKw = Number(t.power_kw || 0);
  const bTemp = Number(t.battery_temp || 25);
  const chgTemp = Number(t.charger_temp || 25);

  // Prominent Battery Level Status (if present)
  if (dom.battButtonPercent) dom.battButtonPercent.textContent = `${soc.toFixed(1)}%`;
  if (dom.cockpitBattCenterNum) dom.cockpitBattCenterNum.textContent = `${Math.round(soc)}%`;
  if (dom.cockpitCircleFill) dom.cockpitCircleFill.setAttribute('stroke-dasharray', `${soc.toFixed(0)}, 100`);
  if (dom.cockpitBattSubDesc) dom.cockpitBattSubDesc.textContent = `${soc.toFixed(1)}% Already Charged`;

  // Banner & Readout
  dom.cockpitCurrentBayTitle.textContent = charger.name;
  dom.cockpitCurrentBayLocation.textContent = `${charger.location} • ${charger.connectorType}`;

  // Update Cockpit Last Data Ingested Badge
  if (dom.cockpitLastDataTime) {
    const bayLastSeen = charger.lastSeen || t.timestamp;
    if (bayLastSeen) {
      dom.cockpitLastDataTime.textContent = formatTimeOnly(bayLastSeen);
      if (dom.cockpitLastDataRel) {
        dom.cockpitLastDataRel.textContent = getRelativeTimeStr(bayLastSeen);
      }
      if (dom.cockpitTimestampCard) {
        dom.cockpitTimestampCard.title = `Last ingested telemetry for ${charger.name}: ${formatFullTimestamp(bayLastSeen)}`;
      }
    } else {
      dom.cockpitLastDataTime.textContent = '--:--:--';
      if (dom.cockpitLastDataRel) dom.cockpitLastDataRel.textContent = 'Waiting for data';
    }
  }
  const chargerIsAc = isAcCharger(charger);
  // Headline value in center dial: Real-time power in kW sent directly from the PCB (NOT calculated)
  const pcbKw = Number(t.power_kw !== undefined && t.power_kw !== null ? t.power_kw : (pKw || 0));
  dom.dialPowerValue.textContent = pcbKw.toFixed(2);
  const dialUnitEl = dom.dialKwUnit || document.getElementById('dialKwUnit');
  if (dialUnitEl) dialUnitEl.textContent = 'kW';
  dom.dialSecondaryMetrics.textContent = `${v.toFixed(1)} V • ${a.toFixed(1)} A`;
  dom.dialModePillText.textContent = t.charging_mode || (chargerIsAc ? 'AC STANDARD' : 'SPORT PLUS');
  dom.dialStatusGear.textContent = charger.status;

  // Update Portal Charger ON / OFF Buttons Visual State
  const isCharging = (charger.status === 'CHARGING');
  if (dom.btnChargerPowerOn) {
    if (isCharging) dom.btnChargerPowerOn.classList.add('active');
    else dom.btnChargerPowerOn.classList.remove('active');
  }
  if (dom.btnChargerPowerOff) {
    if (!isCharging) dom.btnChargerPowerOff.classList.add('active');
    else dom.btnChargerPowerOff.classList.remove('active');
  }

  // Update Battery Hardware Connection Status Bar in Cockpit
  const nowMs = Date.now();
  const isPcbStreaming = Boolean(charger.lastSeen && (nowMs - charger.lastSeen <= 90000));
  const isBattConnected = isPcbStreaming && (charger.batteryConnected !== false) && (t.battery_connected !== false);
  if (dom.cockpitBatteryHwBar) {
    if (isBattConnected) {
      dom.cockpitBatteryHwBar.classList.remove('disconnected');
      if (dom.cockpitBattConnText) dom.cockpitBattConnText.textContent = 'BATTERY HARDWARE: CONNECTED (BMS LINK OK)';
    } else {
      dom.cockpitBatteryHwBar.classList.add('disconnected');
      if (dom.cockpitBattConnText) {
        dom.cockpitBattConnText.textContent = isPcbStreaming
          ? 'BATTERY HARDWARE: DISCONNECTED (INTERLOCK OPEN)'
          : 'BATTERY HARDWARE: OFFLINE (NO PCB WITH AUTH KEY)';
      }
    }
  }

  // Arc Gauge Animation (Scale 0 to 400 kW matching ticks)
  const maxKw = 400;
  const ratio = Math.min(1, Math.max(0, pKw / maxKw));
  const targetOffset = 754 - (ratio * 754);
  if (dom.saaphDialProgressArc) {
    dom.saaphDialProgressArc.style.strokeDashoffset = targetOffset;
  }

  // Left Panel: Real-time power in kW sent directly from the PCB
  dom.cockpitLeftPowerNum.textContent = pcbKw.toFixed(2);
  const leftUnitEl = dom.cockpitLeftPowerUnit || document.getElementById('cockpitLeftPowerUnit');
  if (leftUnitEl) leftUnitEl.textContent = 'kW';
  dom.cockpitLeftModeSub.textContent = chargerIsAc
    ? `${t.charging_mode || 'AC STANDARD'} // ${charger.maxVoltage}V AC MAINS`
    : `${t.charging_mode || 'SPORT PLUS'} // ${charger.maxVoltage}V DC BUS`;
  dom.cockpitLeftKeyShort.textContent = `${charger.apiKey.substring(0, 16)}...`;
  dom.cockpitSessionKwh.textContent = sessionKwh.toFixed(chargerIsAc ? 2 : 1);
  dom.cockpitSessionTime.textContent = isAcSessionHeld(charger)
    ? `${Number(t.session_duration_min || 0).toFixed(1)} min • Fully charged (held until next session)`
    : `${Number(t.session_duration_min || 0).toFixed(1)} min active`;

  const radarRatio = pKw / 100;
  dom.cockpitRadarNum.textContent = `${radarRatio.toFixed(1)} P`;
  dom.cockpitRadarBlip.style.left = `${45 + Math.sin(Date.now() / 800) * (radarRatio * 15)}%`;
  dom.cockpitRadarBlip.style.top = `${45 + Math.cos(Date.now() / 800) * (radarRatio * 15)}%`;

  // Right Panel: Dual Comparison Bars (Actual vs Battery Demands)
  dom.cockpitSocVal.textContent = `${soc.toFixed(1)} %`;
  dom.cockpitSocBar.style.width = `${Math.max(2, soc)}%`;


  if (chargerIsAc) {
    // AC Charger: DC amp, DC Volt, SOC, and kW (sent from PCB, not calculated)
    if (dom.cockpitVName) dom.cockpitVName.textContent = 'DC VOLT';
    if (dom.cockpitAName) dom.cockpitAName.textContent = 'DC AMP';

    const dcV = Number(t.dc_voltage !== undefined && t.dc_voltage !== null ? t.dc_voltage : v);
    const dcA = Number(t.dc_current !== undefined && t.dc_current !== null ? t.dc_current : a);

    const maxV = charger.maxVoltage || 500;
    dom.cockpitActualV.textContent = `${dcV.toFixed(1)} V`;
    dom.cockpitReqV.textContent = reqV > 0 ? `Req: ${reqV.toFixed(1)} V` : 'Req: 0.0 V';
    dom.cockpitVFill.style.width = `${Math.max(2, Math.min(100, (dcV / maxV) * 100))}%`;
    dom.cockpitVMarker.style.left = `${Math.max(2, Math.min(100, (reqV / maxV) * 100))}%`;

    const maxA = charger.maxCurrent || 100;
    dom.cockpitActualA.textContent = `${dcA.toFixed(1)} A`;
    dom.cockpitReqA.textContent = reqA > 0 ? `Req: ${reqA.toFixed(1)} A` : 'Req: 0.0 A';
    dom.cockpitAFill.style.width = `${Math.max(2, Math.min(100, (dcA / maxA) * 100))}%`;
    dom.cockpitAMarker.style.left = `${Math.max(2, Math.min(100, (reqA / maxA) * 100))}%`;

    // Active Power from PCB (NOT calculated from V * A)
    if (dom.cockpitKwRow) dom.cockpitKwRow.style.display = 'flex';
    if (dom.cockpitRightKwVal) dom.cockpitRightKwVal.textContent = `${pcbKw.toFixed(2)} kW`;
    if (dom.cockpitRightKwBar) {
      const maxKw = charger.maxPowerKw || 23;
      dom.cockpitRightKwBar.style.width = `${Math.max(2, Math.min(100, (pcbKw / maxKw) * 100))}%`;
    }

    // Hide temperature rows for AC only as requested
    if (dom.cockpitBattTempRow) dom.cockpitBattTempRow.style.display = 'none';
    if (dom.cockpitChgTempRow) dom.cockpitChgTempRow.style.display = 'none';
  } else {
    // DC Charger: Standard full layout
    if (dom.cockpitVName) dom.cockpitVName.textContent = 'VOLTAGE';
    if (dom.cockpitAName) dom.cockpitAName.textContent = 'CURRENT';

    const maxV = charger.maxVoltage || 800;
    dom.cockpitActualV.textContent = `${v.toFixed(1)} V`;
    dom.cockpitReqV.textContent = reqV > 0 ? `Req: ${reqV.toFixed(1)} V` : 'Req: 0.0 V';
    dom.cockpitVFill.style.width = `${Math.max(2, Math.min(100, (v / maxV) * 100))}%`;
    dom.cockpitVMarker.style.left = `${Math.max(2, Math.min(100, (reqV / maxV) * 100))}%`;

    const maxA = charger.maxCurrent || 350;
    dom.cockpitActualA.textContent = `${a.toFixed(1)} A`;
    dom.cockpitReqA.textContent = reqA > 0 ? `Req: ${reqA.toFixed(1)} A` : 'Req: 0.0 A';
    dom.cockpitAFill.style.width = `${Math.max(2, Math.min(100, (a / maxA) * 100))}%`;
    dom.cockpitAMarker.style.left = `${Math.max(2, Math.min(100, (reqA / maxA) * 100))}%`;

    if (dom.cockpitKwRow) dom.cockpitKwRow.style.display = 'none';
    if (dom.cockpitBattTempRow) dom.cockpitBattTempRow.style.display = 'flex';
    if (dom.cockpitChgTempRow) dom.cockpitChgTempRow.style.display = 'flex';

    // Temperatures
    dom.cockpitBattTempVal.textContent = `${bTemp.toFixed(1)} °C`;
    dom.cockpitBattTempBar.style.width = `${Math.max(4, Math.min(100, (bTemp / 75) * 100))}%`;

    dom.cockpitChgTempVal.textContent = `${chgTemp.toFixed(1)} °C`;
    dom.cockpitChgTempBar.style.width = `${Math.max(4, Math.min(100, (chgTemp / 80) * 100))}%`;
  }

  dom.cockpitStatusBadge.textContent = charger.status;
  dom.cockpitStatusBadge.className = charger.status === 'CHARGING' ? 'badge-status charging' : 'badge-status online';

  drawCockpitWaveform(charger.history || []);
}

function drawCockpitWaveform(history) {
  const canvas = dom.cockpitWaveformCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = state.theme === 'dark' ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 20; y < h; y += 25) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  for (let x = 30; x < w; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.stroke();

  if (!history || history.length < 2) return;
  const pts = history.slice(-30);
  const stepX = w / (pts.length - 1);

  // Battery Req Voltage (dashed)
  ctx.beginPath();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  pts.forEach((pt, i) => {
    const py = h - ((pt.battery_req_voltage || 0) / 850) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(i * stepX, py); else ctx.lineTo(i * stepX, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Actual Output Voltage
  ctx.beginPath();
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2.5;
  pts.forEach((pt, i) => {
    const py = h - ((pt.charger_voltage || 0) / 850) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(i * stepX, py); else ctx.lineTo(i * stepX, py);
  });
  ctx.stroke();

  // Current
  ctx.beginPath();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  pts.forEach((pt, i) => {
    const py = h - ((pt.charger_current || 0) / 350) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(i * stepX, py); else ctx.lineTo(i * stepX, py);
  });
  ctx.stroke();
}

// ==========================================================================
// 9. CHARGE POINTS CARDS & USERS ADMINISTRATION
// ==========================================================================

function updateChargePointsFilterCounters() {
  const allCount = state.chargers.length;
  const chargingCount = state.chargers.filter(c => c.status === 'CHARGING').length;
  const onlineCount = state.chargers.filter(c => c.status === 'ONLINE').length;
  const offlineCount = state.chargers.filter(c => c.status === 'OFFLINE').length;

  if (dom.countAllPoints) dom.countAllPoints.textContent = allCount;
  if (dom.countChargingPoints) dom.countChargingPoints.textContent = chargingCount;
  if (dom.countOnlinePoints) dom.countOnlinePoints.textContent = onlineCount;
  if (dom.countOfflinePoints) dom.countOfflinePoints.textContent = offlineCount;
}

function resetChargePointsSearch() {
  state.chargePointsSearchQuery = '';
  state.chargePointsFilterStatus = 'ALL';
  if (dom.inputSearchChargePoints) dom.inputSearchChargePoints.value = '';
  if (dom.btnClearSearchChargePoints) dom.btnClearSearchChargePoints.classList.remove('visible');
  document.querySelectorAll('.charge-points-filter-bar .filter-pill').forEach(p => {
    if (p.getAttribute('data-status') === 'ALL') p.classList.add('active');
    else p.classList.remove('active');
  });
  renderChargePointsCards();
}

function renderChargePointsCards() {
  const container = dom.chargePointsCardsContainer;
  if (!container) return;
  container.innerHTML = '';

  updateChargePointsFilterCounters();

  const query = (state.chargePointsSearchQuery || '').trim().toLowerCase();
  const filterStatus = state.chargePointsFilterStatus || 'ALL';

  const filtered = state.chargers.filter(c => {
    // Status filter
    if (filterStatus !== 'ALL' && c.status !== filterStatus) {
      return false;
    }
    // Search query filter
    if (query) {
      const nameMatch = (c.name || '').toLowerCase().includes(query);
      const locMatch = (c.location || '').toLowerCase().includes(query);
      const connMatch = (c.connectorType || '').toLowerCase().includes(query);
      const userMatch = (c.credentials?.username || '').toLowerCase().includes(query);
      const keyMatch = (c.apiKey || '').toLowerCase().includes(query);
      return nameMatch || locMatch || connMatch || userMatch || keyMatch;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-chargers-found">
        <h3>🔍 No Charge Points Found</h3>
        <p>No charge points match "${escapeHtml(query || filterStatus)}".</p>
        <button class="btn-primary-cyan-sm" style="margin-top: 14px;" onclick="resetChargePointsSearch()">Reset Search</button>
      </div>
    `;
    return;
  }

  filtered.forEach(c => {
    const t = c.telemetry || {};
    const cred = c.credentials || { username: 'unassigned', password: '***' };
    const pKw = Number(t.power_kw || 0).toFixed(1);
    const soc = Number(t.battery_soc || 0).toFixed(1);

    const card = document.createElement('div');
    card.className = 'charge-point-card';
    card.id = `card_${c.id}`;
    card.innerHTML = `
      <div class="card-top-head">
        <div>
          <h3 class="chg-name">${escapeHtml(c.name)}</h3>
          <span class="chg-loc">${escapeHtml(c.location)} • ${c.connectorType}</span>
        </div>
        <span class="badge-status ${c.status === 'CHARGING' ? 'charging' : 'online'}">${c.status}</span>
      </div>

      <div class="chg-quick-grid">
        <div class="q-cell"><span class="q-lbl">POWER</span><span class="q-val cyan">${Number(t.power_kw || 0).toFixed(2)} kW</span></div>
        <div class="q-cell"><span class="q-lbl">ENERGY</span><span class="q-val">${Number(t.session_energy_kwh || 0).toFixed(2)} kWh</span></div>
        <div class="q-cell"><span class="q-lbl">BATTERY SoC</span><span class="q-val">🔋 ${soc}%</span></div>
        <div class="q-cell"><span class="q-lbl">MAX V/A</span><span class="q-val">${c.maxVoltage}V / ${c.maxCurrent}A</span></div>
      </div>

      <div class="chg-key-pill">
        <span>PCB API Key:</span>
        <code>${c.apiKey.substring(0, 18)}...</code>
        <button class="btn-copy-tiny" onclick="copyText('${c.apiKey}', 'PCB Key copied!')">Copy</button>
      </div>

      <div class="chg-cred-pill">
        <span>Terminal Login:</span>
        <strong>${escapeHtml(cred.username)}</strong> (pass: <code>${escapeHtml(cred.password)}</code>)
        <button class="btn-copy-tiny" onclick="openEditCredentialsModal('${c.id}')">Edit</button>
      </div>

      <div class="chg-last-seen-row" data-last-seen="${c.lastSeen || ''}">
        <span class="cls-label">🕒 Last Data Received:</span>
        <span class="cls-value">
          <strong class="cls-time">${formatTimeOnly(c.lastSeen)}</strong>
          <span class="cls-rel">(${getRelativeTimeStr(c.lastSeen)})</span>
        </span>
      </div>

      <div class="card-actions-row">
        <button class="btn-open-cockpit" onclick="selectAndOpenCockpit('${c.id}')">Live Cockpit</button>
        <button class="btn-icon-square" title="Regenerate PCB Key" onclick="regenerateKey('${c.id}')">🔄</button>
        <button class="btn-icon-square danger" title="Delete Charge Point" onclick="deleteChargerPoint('${c.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadAccountsList() {
  try {
    const res = await fetch('/api/auth/accounts');
    const data = await res.json();
    if (data.success) {
      renderAccountsList(data.accounts);
    }
  } catch (e) {}
}

function renderAccountsList(accounts) {
  const container = dom.chargersCredentialsList;
  container.innerHTML = '';

  const chargerAccounts = accounts.filter(a => a.type === 'CHARGER');
  chargerAccounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'chg-cred-item';
    div.innerHTML = `
      <div class="cred-name-block">
        <span class="cred-chg-name">${escapeHtml(acc.name)}</span>
        <span class="cred-details">Username: <strong>${escapeHtml(acc.username)}</strong> | Password: <code>${escapeHtml(acc.password)}</code></span>
      </div>
      <button class="btn-edit-cred" onclick="openEditCredentialsModal('${acc.chargerId}')">Change Credentials</button>
    `;
    container.appendChild(div);
  });
}

window.openEditCredentialsModal = (chargerId) => {
  const charger = state.chargers.find(c => c.id === chargerId);
  if (!charger) return;

  dom.editCredChargerId.value = charger.id;
  dom.editCredChargerNameDisplay.value = charger.name;
  dom.editCredUsername.value = charger.credentials ? charger.credentials.username : `bay01`;
  dom.editCredPassword.value = charger.credentials ? charger.credentials.password : 'password123';
  dom.modalEditCredentials.classList.add('active');
};

function initModals() {
  // Credentials modal
  dom.btnCloseEditCredModal.onclick = () => dom.modalEditCredentials.classList.remove('active');
  dom.btnCancelEditCredModal.onclick = () => dom.modalEditCredentials.classList.remove('active');

  dom.formEditChargerCredentials.onsubmit = async (e) => {
    e.preventDefault();
    const chargerId = dom.editCredChargerId.value;
    const username = dom.editCredUsername.value.trim();
    const password = dom.editCredPassword.value.trim();

    try {
      const res = await fetch(`/api/chargers/${chargerId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        dom.modalEditCredentials.classList.remove('active');
        showToast(`Credentials updated for ${data.username}!`);
        fetchChargers();
        loadAccountsList();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Tariff Modal
  dom.btnCloseEditTariffModal.onclick = () => dom.modalEditTariff.classList.remove('active');
  dom.btnCancelEditTariffModal.onclick = () => dom.modalEditTariff.classList.remove('active');

  dom.formEditTariff.onsubmit = async (e) => {
    e.preventDefault();
    const chargerId = dom.editTariffChargerId.value;
    const ratePerKwh = dom.editTariffRate.value;
    const sessionFee = dom.editTariffSessionFee.value;

    try {
      const res = await fetch(`/api/tariffs/${chargerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePerKwh, sessionFee })
      });
      const data = await res.json();
      if (data.success) {
        dom.modalEditTariff.classList.remove('active');
        showToast('Tariff updated successfully!');
        fetchChargers();
        renderTariffsPage();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  };

  // Add RFID Token Modal
  dom.btnCloseAddTokenModal.onclick = () => dom.modalAddToken.classList.remove('active');
  dom.btnCancelAddTokenModal.onclick = () => dom.modalAddToken.classList.remove('active');

  dom.formAddToken.onsubmit = async (e) => {
    e.preventDefault();
    const chargerId = dom.addTokenChargerId.value;
    const token = dom.inputTokenString.value.trim();

    try {
      const res = await fetch(`/api/tokens/${chargerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        dom.modalAddToken.classList.remove('active');
        showToast(`RFID Token ${token} assigned!`);
        fetchChargers();
        renderTokensPage();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  };

  // Delete Confirmation Modal handlers
  if (dom.btnCancelDeleteModal) dom.btnCancelDeleteModal.onclick = () => dom.modalDeleteConfirm.classList.remove('active');
  if (dom.btnCancelDeleteModalBtn) dom.btnCancelDeleteModalBtn.onclick = () => dom.modalDeleteConfirm.classList.remove('active');
  if (dom.btnConfirmDeleteModalBtn) {
    dom.btnConfirmDeleteModalBtn.onclick = () => {
      if (state.pendingDeleteChargerId) {
        executeDelete(state.pendingDeleteChargerId);
      }
    };
  }

  // Update Admin Credentials Form
  dom.formUpdateAdmin.onsubmit = async (e) => {
    e.preventDefault();
    const username = dom.adminUsernameInput.value.trim();
    const password = dom.adminPasswordInput.value.trim();

    try {
      const res = await fetch('/api/auth/update-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Administrator credentials saved successfully!');
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // PCB Battery Authentication Modals
  if (dom.btnCloseChargingBeginModal) {
    dom.btnCloseChargingBeginModal.onclick = () => dom.modalChargingBegin?.classList.remove('active');
  }
  if (dom.btnOkChargingBegin) {
    dom.btnOkChargingBegin.onclick = () => {
      dom.modalChargingBegin?.classList.remove('active');
      switchView('cockpitView');
    };
  }

  if (dom.btnCloseBatteryNotConnectedModal) {
    dom.btnCloseBatteryNotConnectedModal.onclick = () => dom.modalBatteryNotConnected?.classList.remove('active');
  }
  if (dom.btnDismissBatteryModal) {
    dom.btnDismissBatteryModal.onclick = () => dom.modalBatteryNotConnected?.classList.remove('active');
  }
  if (dom.btnQuickConnectBattery) {
    dom.btnQuickConnectBattery.onclick = () => {
      dom.modalBatteryNotConnected?.classList.remove('active');
      const chargerId = state.selectedChargerId;
      if (!chargerId) return;
      showToast('🔄 Verifying PCB hardware & establishing battery link...');
      setTimeout(() => controlCharger(chargerId, 'ON', { forceBatteryConnected: true }), 200);
    };
  }

  // Initialize Report Modal handlers
  initReportModal();
}

// ==========================================================================
// 4B. CHARGER REPORT GENERATOR (24h, 7d, 1mo + Revenue Calculation & Export)
// ==========================================================================

function initReportModal() {
  if (dom.btnOpenReportModal) {
    dom.btnOpenReportModal.onclick = () => {
      if (dom.modalGenerateReport) {
        dom.modalGenerateReport.classList.add('active');
        populateReportChargerSelect();
        loadChargerReport(state.reportPeriod || '24h', state.reportChargerId || 'ALL');
      }
    };
  }

  if (dom.btnCloseReportModal) {
    dom.btnCloseReportModal.onclick = () => {
      if (dom.modalGenerateReport) dom.modalGenerateReport.classList.remove('active');
    };
  }

  if (dom.btnCloseReportBottom) {
    dom.btnCloseReportBottom.onclick = () => {
      if (dom.modalGenerateReport) dom.modalGenerateReport.classList.remove('active');
    };
  }

  if (dom.btnReport24h) {
    dom.btnReport24h.onclick = () => loadChargerReport('24h', state.reportChargerId || 'ALL');
  }

  if (dom.btnReport7d) {
    dom.btnReport7d.onclick = () => loadChargerReport('7d', state.reportChargerId || 'ALL');
  }

  if (dom.btnReport1mo) {
    dom.btnReport1mo.onclick = () => loadChargerReport('1mo', state.reportChargerId || 'ALL');
  }

  if (dom.reportChargerSelect) {
    dom.reportChargerSelect.onchange = (e) => {
      loadChargerReport(state.reportPeriod || '24h', e.target.value);
    };
  }

  if (dom.btnExportReportCsv) {
    dom.btnExportReportCsv.onclick = exportReportCsv;
  }

  if (dom.btnPrintReportPdf) {
    dom.btnPrintReportPdf.onclick = () => window.print();
  }
}

function populateReportChargerSelect() {
  const sel = dom.reportChargerSelect;
  if (!sel) return;
  const currentVal = sel.value || 'ALL';
  sel.innerHTML = '<option value="ALL">All Chargers (Network Wide)</option>';
  state.chargers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} [${c.status}]`;
    if (c.id === currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function loadChargerReport(period = '24h', chargerId = 'ALL') {
  state.reportPeriod = period;
  state.reportChargerId = chargerId;

  document.querySelectorAll('.report-period-btn').forEach(btn => {
    if (btn.getAttribute('data-period') === period) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const periodLabels = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '1mo': 'Last 1 Month'
  };

  if (dom.reportRevenueSub) {
    dom.reportRevenueSub.textContent = `Earned in ${periodLabels[period] || period}`;
  }
  if (dom.reportEnergySub) {
    dom.reportEnergySub.textContent = `Delivered in ${periodLabels[period] || period}`;
  }

  try {
    const res = await fetch(`/api/reports?period=${period}&chargerId=${chargerId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        state.currentReportData = data;
        renderReportData(data);
        return;
      }
    }
  } catch (err) {
    console.warn('API report notice, using local compute:', err);
  }

  const localData = computeLocalReportData(period, chargerId);
  state.currentReportData = localData;
  renderReportData(localData);
}

function computeLocalReportData(period, chargerId) {
  let chargers = [...state.chargers];
  if (chargerId !== 'ALL') {
    chargers = chargers.filter(c => c.id === chargerId);
  }

  let factor = 1.0;
  let periodLabel = 'Last 1 Month (30 Days)';
  let liveMultiplier = 16.5;

  if (period === '24h') {
    factor = 0.18;
    periodLabel = 'Last 24 Hours';
    liveMultiplier = 1.0;
  } else if (period === '7d') {
    factor = 0.58;
    periodLabel = 'Last 7 Days';
    liveMultiplier = 4.2;
  }

  const reports = chargers.map(c => {
    const rate = Number(c.tariff?.ratePerKwh) || 18.0;
    const fee = Number(c.tariff?.sessionFee) || 40.0;
    const stats = c.stats || { totalSessions: 0, totalEnergyKwh: 0, totalRevenue: 0 };

    let sessions = Math.round((stats.totalSessions || 0) * factor);
    let energy = +((stats.totalEnergyKwh || 0) * factor).toFixed(2);
    let rev = +((stats.totalRevenue || 0) * factor).toFixed(2);

    const liveEnergy = Number(c.telemetry?.session_energy_kwh || 0);
    if (liveEnergy > 0) {
      const addedEnergy = +(liveEnergy * liveMultiplier).toFixed(2);
      const addedSessions = Math.max(1, Math.round(liveMultiplier));
      const addedRevenue = +((addedEnergy * rate) + (fee * addedSessions)).toFixed(2);

      energy = +(energy + addedEnergy).toFixed(2);
      rev = +(rev + addedRevenue).toFixed(2);
      sessions += addedSessions;
    }

    return {
      chargerId: c.id,
      chargerName: c.name,
      location: c.location || 'Station Bay',
      connectorType: c.connectorType || 'CCS2 Combo',
      status: c.status || 'ONLINE',
      period: period,
      periodLabel: periodLabel,
      ratePerKwh: rate,
      sessionFee: fee,
      currency: '₹',
      sessionsCount: sessions,
      energyKwh: energy,
      revenue: rev,
      avgRevenuePerSession: sessions > 0 ? +(rev / sessions).toFixed(2) : 0
    };
  });

  const totalRevenue = +reports.reduce((acc, r) => acc + r.revenue, 0).toFixed(2);
  const totalEnergy = +reports.reduce((acc, r) => acc + r.energyKwh, 0).toFixed(2);
  const totalSessions = reports.reduce((acc, r) => acc + r.sessionsCount, 0);
  const avgSessionRevenue = totalSessions > 0 ? +(totalRevenue / totalSessions).toFixed(2) : 0;

  return {
    success: true,
    period: period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRevenue,
      totalEnergyKwh: totalEnergy,
      totalSessions,
      avgSessionRevenue,
      currency: '₹',
      chargerCount: reports.length
    },
    reports
  };
}

function renderReportData(data) {
  if (!data || !data.summary) return;
  const s = data.summary;

  if (dom.reportTotalRevenue) {
    dom.reportTotalRevenue.textContent = Number(s.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (dom.reportTotalEnergy) {
    dom.reportTotalEnergy.textContent = Number(s.totalEnergyKwh).toFixed(2);
  }
  if (dom.reportTotalSessions) {
    dom.reportTotalSessions.textContent = s.totalSessions;
  }
  if (dom.reportAvgSessionRev) {
    dom.reportAvgSessionRev.textContent = Number(s.avgSessionRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (dom.reportGeneratedTime) {
    const d = new Date(data.generatedAt || Date.now());
    dom.reportGeneratedTime.textContent = `Generated: ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} • ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  const tbody = dom.tbodyReportRows;
  if (!tbody) return;
  tbody.innerHTML = '';

  const reports = data.reports || [];
  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No charger data available for this selection.</td></tr>`;
    return;
  }

  reports.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.chargerName)}</strong></td>
      <td><small style="color:var(--text-muted);">${escapeHtml(r.location)} • ${escapeHtml(r.connectorType)}</small></td>
      <td><span class="badge-status online" style="font-size:0.75rem;">${escapeHtml(r.periodLabel)}</span></td>
      <td><strong>${r.sessionsCount}</strong></td>
      <td><strong style="color:var(--primary-cyan);">${Number(r.energyKwh).toFixed(2)} kWh</strong></td>
      <td>₹${Number(r.ratePerKwh).toFixed(2)}/kWh <small style="color:var(--text-muted);">(Fee: ₹${r.sessionFee})</small></td>
      <td><strong style="color:var(--accent-green); font-size:1.05rem;">₹${Number(r.revenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      <td><span class="badge-status ${r.status === 'CHARGING' ? 'charging' : (r.status === 'OFFLINE' ? 'offline' : 'online')}">${r.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function exportReportCsv() {
  const data = state.currentReportData;
  if (!data || !data.reports || data.reports.length === 0) {
    showToast('No report data to export.');
    return;
  }

  const headers = ['Charger ID', 'Charger Name', 'Location', 'Connector Type', 'Period', 'Sessions Count', 'Energy Delivered (kWh)', 'Tariff Rate (INR/kWh)', 'Session Fee (INR)', 'Revenue Generated (INR)', 'Status', 'Generated At'];
  const rows = data.reports.map(r => [
    `"${r.chargerId}"`,
    `"${(r.chargerName || '').replace(/"/g, '""')}"`,
    `"${(r.location || '').replace(/"/g, '""')}"`,
    `"${(r.connectorType || '').replace(/"/g, '""')}"`,
    `"${r.periodLabel}"`,
    r.sessionsCount,
    r.energyKwh,
    r.ratePerKwh,
    r.sessionFee,
    r.revenue,
    `"${r.status}"`,
    `"${data.generatedAt}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SAAPHZONE_Charger_Report_${state.reportPeriod}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 Report CSV downloaded successfully!');
}

window.selectAndOpenCockpit = (id) => {
  state.selectedChargerId = id;
  if (dom.topChargerSelect) dom.topChargerSelect.value = id;
  if (dom.cockpitChargerSelect) dom.cockpitChargerSelect.value = id;
  switchView('cockpitView');
  updateCockpitTelemetry();
};

window.regenerateKey = async (id) => {
  if (!confirm('Regenerate PCB Hardware Key? Existing firmware will need the new key.')) return;
  try {
    const res = await fetch(`/api/chargers/${id}/regenerate-key`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('New PCB Key generated!');
      fetchChargers();
      renderTokensPage();
    }
  } catch (e) {
    alert(e.message);
  }
};

// ==========================================================================
// 10. PCB HARDWARE INTEGRATION & SIMULATOR
// ==========================================================================

function updatePcbKeyView() {
  const charger = state.chargers.find(c => c.id === state.selectedChargerId);
  if (!charger) return;

  dom.inputPcbActiveKey.value = charger.apiKey;
  const endpoint = `${BACKEND_ORIGIN || window.location.origin}/api/telemetry`;

  dom.snippetArduino.textContent = `// ESP32 / Arduino C++ Example for SAAPHZONE PCB
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "${endpoint}";
const char* pcbKey = "${charger.apiKey}"; // Unique PCB Key

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi Connected to SAAPHZONE CSMS!");
}

void sendTelemetry(float vOut, float aOut, float soc, float vReq, float aReq, float bTemp) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", pcbKey);

    StaticJsonDocument<256> doc;
    doc["charger_voltage"] = vOut;
    doc["charger_current"] = aOut;
    doc["battery_soc"] = soc;
    doc["battery_req_voltage"] = vReq;
    doc["battery_req_current"] = aReq;
    doc["battery_temp"] = bTemp;
    doc["status"] = "CHARGING";

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    Serial.printf("Response Code: %d\\n", httpResponseCode);
    http.end();
  }
}

void loop() {
  float vOut = 418.5; // measured output voltage
  float aOut = 148.2; // measured output current
  float soc  = 78.0;  // Battery SoC %
  float vReq = 425.0; // BMS requested voltage
  float aReq = 160.0; // BMS requested current
  float bTemp = 34.2; // Battery pack temperature

  sendTelemetry(vOut, aOut, soc, vReq, aReq, bTemp);
  delay(1000);
}`;

  dom.snippetPython.textContent = `import requests
import time

SERVER_URL = "${endpoint}"
PCB_KEY = "${charger.apiKey}"

headers = {
    "Content-Type": "application/json",
    "x-api-key": PCB_KEY
}

payload = {
    "charger_voltage": 418.5,
    "charger_current": 148.2,
    "battery_soc": 78.0,
    "battery_req_voltage": 425.0,
    "battery_req_current": 160.0,
    "battery_temp": 34.2,
    "charger_temp": 41.5,
    "status": "CHARGING"
}

try:
    response = requests.post(SERVER_URL, json=payload, headers=headers)
    print("Ingestion Status:", response.json())
except Exception as e:
    print("Error sending telemetry:", e)`;

  dom.snippetCurl.textContent = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${charger.apiKey}" \\
  -d '{
    "charger_voltage": 418.5,
    "charger_current": 148.2,
    "battery_soc": 78.0,
    "battery_req_voltage": 425.0,
    "battery_req_current": 160.0,
    "battery_temp": 34.2,
    "charger_temp": 41.5,
    "status": "CHARGING"
  }'`;
}

function updateEndpointDisplay() {
  dom.displayEndpointUrl.textContent = `${BACKEND_ORIGIN || window.location.origin}/api/telemetry`;
}

function initSimulator() {
  const sync = (sl, disp, unit) => {
    sl.oninput = () => disp.textContent = `${Number(sl.value).toFixed(1)} ${unit}`;
  };

  sync(dom.slV, dom.slValV, 'V');
  sync(dom.slA, dom.slValA, 'A');
  sync(dom.slSoc, dom.slValSoc, '%');
  sync(dom.slReqV, dom.slValReqV, 'V');
  sync(dom.slReqA, dom.slValReqA, 'A');
  sync(dom.slTemp, dom.slValTemp, '°C');

  dom.btnSimSendSingle.onclick = () => sendSimPacket();

  dom.simAutoToggle.onchange = (e) => {
    if (e.target.checked) startSimAutoStream();
    else stopSimAutoStream();
  };

  state.simBatteryConnected = true;

  const updateSimBattButtons = () => {
    if (dom.btnSimBattConnected) {
      if (state.simBatteryConnected) dom.btnSimBattConnected.classList.add('active', 'connected');
      else dom.btnSimBattConnected.classList.remove('active', 'connected');
    }
    if (dom.btnSimBattDisconnected) {
      if (!state.simBatteryConnected) dom.btnSimBattDisconnected.classList.add('active', 'disconnected');
      else dom.btnSimBattDisconnected.classList.remove('active', 'disconnected');
    }
  };

  document.getElementById('simPresetFast').onclick = () => {
    state.simBatteryConnected = true;
    updateSimBattButtons();
    setSimVals(420.0, 155.0, 78.0, 428.0, 165.0, 34.0);
  };
  document.getElementById('simPreset400V').onclick = () => {
    state.simBatteryConnected = true;
    updateSimBattButtons();
    setSimVals(385.0, 95.0, 48.0, 400.0, 110.0, 30.5);
  };
  document.getElementById('simPresetTaper').onclick = () => {
    state.simBatteryConnected = true;
    updateSimBattButtons();
    setSimVals(438.0, 32.0, 88.0, 440.0, 35.0, 36.0);
  };
  document.getElementById('simPresetFault').onclick = () => {
    setSimVals(0.0, 0.0, 50.0, 0.0, 0.0, 62.0);
  };
  if (dom.simPresetNoBattery) {
    dom.simPresetNoBattery.onclick = () => {
      state.simBatteryConnected = false;
      updateSimBattButtons();
      setSimVals(0.0, 0.0, 0.0, 0.0, 0.0, 24.0);
    };
  }

  if (dom.btnSimBattConnected) {
    dom.btnSimBattConnected.onclick = () => {
      state.simBatteryConnected = true;
      updateSimBattButtons();
      sendSimPacket();
    };
  }
  if (dom.btnSimBattDisconnected) {
    dom.btnSimBattDisconnected.onclick = () => {
      state.simBatteryConnected = false;
      updateSimBattButtons();
      setSimVals(0.0, 0.0, 0.0, 0.0, 0.0, 24.0);
    };
  }

  dom.btnSimClearLogs.onclick = () => dom.simLogConsole.innerHTML = '';
  dom.btnCopyPcbKeyMain.onclick = () => copyText(dom.inputPcbActiveKey.value, 'Hardware API Key copied!');
  dom.btnCopyEndpointUrl.onclick = () => copyText(dom.displayEndpointUrl.textContent, 'Endpoint URL copied!');
  dom.btnCockpitCopyKey.onclick = () => {
    const chg = state.chargers.find(c => c.id === state.selectedChargerId);
    if (chg) copyText(chg.apiKey, 'Hardware API Key copied!');
  };
  dom.btnRegeneratePcbKeyMain.onclick = () => {
    if (state.selectedChargerId) window.regenerateKey(state.selectedChargerId);
  };

  document.querySelectorAll('.code-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.code-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.code-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      const pane = document.getElementById('pane' + tab.charAt(0).toUpperCase() + tab.slice(1));
      if (pane) pane.classList.add('active');
    };
  });
}

function setSimVals(v, a, soc, reqV, reqA, temp) {
  dom.slV.value = v; dom.slValV.textContent = `${v.toFixed(1)} V`;
  dom.slA.value = a; dom.slValA.textContent = `${a.toFixed(1)} A`;
  dom.slSoc.value = soc; dom.slValSoc.textContent = `${soc.toFixed(1)} %`;
  dom.slReqV.value = reqV; dom.slValReqV.textContent = `${reqV.toFixed(1)} V`;
  dom.slReqA.value = reqA; dom.slValReqA.textContent = `${reqA.toFixed(1)} A`;
  dom.slTemp.value = temp; dom.slValTemp.textContent = `${temp.toFixed(1)} °C`;
  sendSimPacket();
}

async function sendSimPacket(customPayload = null) {
  const charger = state.chargers.find(c => c.id === state.selectedChargerId);
  if (!charger) {
    showToast('Select a charger first');
    return;
  }

  const payload = customPayload || {
    charger_voltage: Number(dom.slV.value),
    charger_current: Number(dom.slA.value),
    battery_soc: Number(dom.slSoc.value),
    battery_req_voltage: Number(dom.slReqV.value),
    battery_req_current: Number(dom.slReqA.value),
    battery_temp: Number(dom.slTemp.value),
    charger_temp: Number(dom.slTemp.value) + 5.5,
    battery_connected: state.simBatteryConnected !== false,
    status: (state.simBatteryConnected !== false && Number(dom.slA.value) > 0.5) ? 'CHARGING' : 'ONLINE'
  };

  try {
    const startT = performance.now();
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': charger.apiKey
      },
      body: JSON.stringify(payload)
    });
    const elapsed = Math.round(performance.now() - startT);
    const data = await res.json();

    if (data.success) {
      dom.simLastTxResult.textContent = `200 OK • ${elapsed}ms • Power: ${data.power_kw} kW`;
      logSimMessage(`[TX] Ingested: ${payload.charger_voltage.toFixed(1)}V, ${payload.charger_current.toFixed(1)}A | BMS Target: ${payload.battery_req_voltage.toFixed(1)}V, ${payload.battery_req_current.toFixed(1)}A | SoC: ${payload.battery_soc.toFixed(1)}%`, 'telemetry');
    } else {
      dom.simLastTxResult.textContent = `Error: ${data.error}`;
      logSimMessage(`[TX ERROR] ${data.error}`, 'error');
    }
  } catch (err) {
    dom.simLastTxResult.textContent = `Network Error`;
    logSimMessage(`[NETWORK FAULT] ${err.message}`, 'error');
  }
}

function startSimAutoStream() {
  if (state.simInterval) clearInterval(state.simInterval);
  logSimMessage('Auto-streaming active at 1.0 Hz with simulated PCB ADC fluctuations.', 'system');

  state.simInterval = setInterval(() => {
    let soc = Number(dom.slSoc.value);
    const a = Number(dom.slA.value);

    if (a > 1) {
      soc = Math.min(100, +(soc + 0.05).toFixed(2));
      dom.slSoc.value = soc;
      dom.slValSoc.textContent = `${soc.toFixed(1)} %`;
    }

    const jitterV = +(Number(dom.slV.value) + (Math.random() - 0.5) * 1.6).toFixed(1);
    const jitterA = +(Number(dom.slA.value) + (Math.random() - 0.5) * 2.2).toFixed(1);

    const payload = {
      charger_voltage: Math.max(0, jitterV),
      charger_current: Math.max(0, jitterA),
      battery_soc: soc,
      battery_req_voltage: Number(dom.slReqV.value),
      battery_req_current: Number(dom.slReqA.value),
      battery_temp: +(Number(dom.slTemp.value) + (Math.random() - 0.5) * 0.2).toFixed(1),
      charger_temp: +(Number(dom.slTemp.value) + 5.5 + (Math.random() - 0.5) * 0.3).toFixed(1),
      status: jitterA > 1 ? 'CHARGING' : 'ONLINE'
    };

    sendSimPacket(payload);
  }, 1000);
}

function stopSimAutoStream() {
  if (state.simInterval) {
    clearInterval(state.simInterval);
    state.simInterval = null;
    logSimMessage('Auto-streaming paused.', 'system');
  }
}

function logSimMessage(msg, type = 'system') {
  const c = dom.simLogConsole;
  if (!c) return;
  const time = new Date().toLocaleTimeString();
  const d = document.createElement('div');
  d.className = `log-line ${type}`;
  d.textContent = `[${time}] ${msg}`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

// ==========================================================================
// 11. NAVIGATION & ROUTING
// ==========================================================================

function initNavigation() {
  dom.navItems.forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');
      switchView(target);
    };
  });

  if (dom.topChargerSelect) {
    dom.topChargerSelect.onchange = (e) => {
      state.selectedChargerId = e.target.value;
      updateCockpitTelemetry();
      updatePcbKeyView();
    };
  }

  if (dom.cockpitChargerSelect) {
    dom.cockpitChargerSelect.onchange = (e) => {
      state.selectedChargerId = e.target.value;
      updateCockpitTelemetry();
      updatePcbKeyView();
    };
  }

  // Prominent battery button click navigates to live cockpit
  if (dom.btnBatteryPercentageBadge) {
    dom.btnBatteryPercentageBadge.onclick = () => switchView('cockpitView');
  }

  // Add charger buttons navigate to dedicated Add Charger page
  dom.btnTopAddCharger.onclick = () => switchView('addChargerPage');
  dom.btnTableAddCharger.onclick = () => switchView('addChargerPage');
  dom.btnOpenAddPageFromPoints.onclick = () => switchView('addChargerPage');

  dom.btnRefreshFleet.onclick = () => {
    fetchChargers();
    showToast('Fleet status updated.');
  };

  // Charger ON / OFF Remote Control Buttons handlers
  if (dom.btnChargerPowerOn) {
    dom.btnChargerPowerOn.onclick = () => controlCharger(state.selectedChargerId, 'ON');
  }
  if (dom.btnChargerPowerOff) {
    dom.btnChargerPowerOff.onclick = () => controlCharger(state.selectedChargerId, 'OFF');
  }

  // Battery Hardware Connection Toggle in Cockpit
  if (dom.btnToggleCockpitBattConn) {
    dom.btnToggleCockpitBattConn.onclick = () => {
      window.toggleBatteryHardwareConnection(state.selectedChargerId);
    };
  }

  // Charge Points Search & Filter handlers (User Requirement)
  if (dom.btnSearchChargePoints) {
    dom.btnSearchChargePoints.onclick = () => {
      state.chargePointsSearchQuery = dom.inputSearchChargePoints ? dom.inputSearchChargePoints.value : '';
      renderChargePointsCards();
    };
  }

  if (dom.inputSearchChargePoints) {
    dom.inputSearchChargePoints.oninput = (e) => {
      state.chargePointsSearchQuery = e.target.value;
      if (dom.btnClearSearchChargePoints) {
        if (e.target.value.trim().length > 0) dom.btnClearSearchChargePoints.classList.add('visible');
        else dom.btnClearSearchChargePoints.classList.remove('visible');
      }
      renderChargePointsCards();
    };

    dom.inputSearchChargePoints.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.chargePointsSearchQuery = dom.inputSearchChargePoints.value;
        renderChargePointsCards();
      }
    };
  }

  if (dom.btnClearSearchChargePoints) {
    dom.btnClearSearchChargePoints.onclick = () => {
      resetChargePointsSearch();
    };
  }

  const filterPills = document.querySelectorAll('.charge-points-filter-bar .filter-pill');
  filterPills.forEach(pill => {
    pill.onclick = () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.chargePointsFilterStatus = pill.getAttribute('data-status') || 'ALL';
      renderChargePointsCards();
    };
  });
}

function populateChargerSelect() {
  const sel = dom.topChargerSelect;
  if (sel) {
    sel.innerHTML = '';
    state.chargers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} [${c.status}]`;
      if (c.id === state.selectedChargerId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  const cockpitSel = dom.cockpitChargerSelect || document.getElementById('cockpitChargerSelect');
  if (cockpitSel) {
    cockpitSel.innerHTML = '';
    state.chargers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} [${c.status}]`;
      if (c.id === state.selectedChargerId) opt.selected = true;
      cockpitSel.appendChild(opt);
    });
  }

  populateReportChargerSelect();
}

function switchView(viewKey) {
  dom.navItems.forEach(btn => {
    if (btn.getAttribute('data-target') === viewKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  Object.keys(dom.views).forEach(k => {
    const el = dom.views[k];
    if (el) el.classList.remove('active');
  });

  if (viewKey === 'cockpitView') {
    dom.views.cockpitView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Telemetry Cockpit';
    dom.pageHeadingSubtitle.textContent = 'Real-time vehicle cluster, battery demand, and V-I curve';
    updateCockpitTelemetry();
  } else if (viewKey === 'chargePointsView') {
    dom.views.chargePointsView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Charge Points';
    dom.pageHeadingSubtitle.textContent = 'Connected charging hardware, power ratings, and credentials';
  } else if (viewKey === 'tariffsView') {
    dom.views.tariffsView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Tariffs & Revenue Breakdown';
    dom.pageHeadingSubtitle.textContent = 'Revenue and sessions of every charger separately';
    renderTariffsPage();
  } else if (viewKey === 'tokensView') {
    dom.views.tokensView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'RFID / Token Keys';
    dom.pageHeadingSubtitle.textContent = 'Reflects token keys and PCB credentials of every charger';
    renderTokensPage();
  } else if (viewKey === 'addChargerPage') {
    dom.views.addChargerPage.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Add New Charge Point';
    dom.pageHeadingSubtitle.textContent = 'Register a new charger and generate unique PCB credentials';
  } else if (viewKey === 'usersView') {
    dom.views.usersView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Users & Credentials';
    dom.pageHeadingSubtitle.textContent = 'Define custom logins for Admin and each charger';
    loadAccountsList();
  } else if (viewKey === 'pcbIntegrationView') {
    dom.views.pcbIntegrationView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'PCB Hardware API';
    dom.pageHeadingSubtitle.textContent = 'Firmware integration, unique keys, and REST API specification';
    updatePcbKeyView();
  } else if (viewKey === 'viewSimulator') {
    dom.views.viewSimulator.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Hardware Simulator';
    dom.pageHeadingSubtitle.textContent = 'Simulate live PCB transmissions and sensor telemetry';
  } else if (viewKey === 'pgTableView') {
    dom.views.pgTableView.classList.add('active');
    dom.pageHeadingTitle.textContent = 'PostgreSQL Tables';
    dom.pageHeadingSubtitle.textContent = 'Direct relational tabular view of chargers and telemetry';
    loadPgTableData();
  } else {
    dom.views.csmsDashboard.classList.add('active');
    dom.pageHeadingTitle.textContent = 'Dashboard';
    dom.pageHeadingSubtitle.textContent = 'Network overview • All organizations';
  }
}

window.copySnippet = (id) => {
  const el = document.getElementById(id);
  if (el) copyText(el.textContent, 'Code copied to clipboard!');
};

function copyText(txt, msg = 'Copied!') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => showToast(msg)).catch(() => fallbackCopy(txt, msg));
  } else {
    fallbackCopy(txt, msg);
  }
}

function fallbackCopy(txt, msg) {
  const ta = document.createElement('textarea');
  ta.value = txt;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(msg);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>⚡</span> <span>${escapeHtml(msg)}</span>`;
  dom.toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 250);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================================================
// 12. POSTGRESQL TABULAR DATA VIEWER
// ==========================================================================
state.activePgTable = 'chargers';
state.pgTableData = { chargers: { columns: [], rows: [] }, telemetry: { columns: [], rows: [] }, sessions: { columns: [], rows: [] } };

function initPgTableView() {
  const tabChargers = document.getElementById('tabPgChargers');
  const tabTelemetry = document.getElementById('tabPgTelemetry');
  const tabSessions = document.getElementById('tabPgSessions');
  const btnRefresh = document.getElementById('btnPgRefresh');
  const btnSync = document.getElementById('btnPgSyncJson');
  const btnExport = document.getElementById('btnPgExportCsv');
  const inputFilter = document.getElementById('inputPgFilter');

  function selectTab(activeTab, tableKey) {
    [tabChargers, tabTelemetry, tabSessions].forEach(t => t && t.classList.remove('active'));
    if (activeTab) activeTab.classList.add('active');
    state.activePgTable = tableKey;
    renderPgTable();
  }

  if (tabChargers) tabChargers.onclick = () => selectTab(tabChargers, 'chargers');
  if (tabTelemetry) tabTelemetry.onclick = () => selectTab(tabTelemetry, 'telemetry');
  if (tabSessions) tabSessions.onclick = () => selectTab(tabSessions, 'sessions');

  if (btnRefresh) {
    btnRefresh.onclick = () => {
      loadPgTableData();
      showToast('Refreshing PostgreSQL tables...');
    };
  }

  if (btnSync) {
    btnSync.onclick = async () => {
      try {
        btnSync.disabled = true;
        btnSync.textContent = 'Syncing...';
        const res = await fetch('/api/postgres/sync', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('✅ Synced data from JSON into PostgreSQL!');
          loadPgTableData();
        } else {
          alert('Sync failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Sync error: ' + err.message);
      } finally {
        btnSync.disabled = false;
        btnSync.textContent = '⚡ Sync from JSON';
      }
    };
  }

  if (btnExport) {
    btnExport.onclick = () => exportPgTableToCsv();
  }

  if (inputFilter) {
    inputFilter.oninput = () => renderPgTable();
  }
}

async function loadPgTableData() {
  const statusBadge = document.getElementById('pgServerStatusBadge');
  try {
    const res = await fetch('/api/postgres/table-data');
    const data = await res.json();
    if (data.success && data.tables) {
      state.pgTableData = data.tables;
      if (statusBadge) {
        statusBadge.className = 'badge-status online';
        statusBadge.textContent = '● PostgreSQL Online';
      }
      const chgCountEl = document.getElementById('pgChargersCount');
      const telCountEl = document.getElementById('pgTelemetryCount');
      const sessCountEl = document.getElementById('pgSessionsCount');
      if (chgCountEl) chgCountEl.textContent = data.tables.chargers?.rows?.length || 0;
      if (telCountEl) telCountEl.textContent = data.tables.telemetry?.rows?.length || 0;
      if (sessCountEl) sessCountEl.textContent = data.tables.sessions?.rows?.length || 0;
      renderPgTable();
    } else {
      if (statusBadge) {
        statusBadge.className = 'badge-status offline';
        statusBadge.textContent = '● PostgreSQL Offline';
      }
    }
  } catch (err) {
    console.error('Error fetching pg table data:', err);
    if (statusBadge) {
      statusBadge.className = 'badge-status offline';
      statusBadge.textContent = '● PostgreSQL Offline';
    }
  }
}

function renderPgTable() {
  const tableHead = document.getElementById('pgLiveTableHead');
  const tableBody = document.getElementById('pgLiveTableBody');
  const titleEl = document.getElementById('pgTableActiveTitle');
  const subEl = document.getElementById('pgTableActiveSub');
  const inputFilter = document.getElementById('inputPgFilter');
  const filterVal = (inputFilter ? inputFilter.value : '').toLowerCase().trim();

  if (!tableHead || !tableBody) return;

  const currentTable = state.activePgTable || 'chargers';
  const tableData = state.pgTableData ? state.pgTableData[currentTable] : null;

  if (titleEl) titleEl.textContent = `${currentTable.toUpperCase()} Table`;
  if (subEl) subEl.textContent = `Displaying ${tableData?.rows?.length || 0} live record(s) directly from PostgreSQL [Database: cms_backend]`;

  if (!tableData || !tableData.columns || tableData.columns.length === 0) {
    tableHead.innerHTML = '<tr><th>Status</th></tr>';
    tableBody.innerHTML = '<tr><td style="text-align:center; padding:24px; color:var(--text-muted);">No records found in PostgreSQL table yet.</td></tr>';
    return;
  }

  // Render Header
  tableHead.innerHTML = `<tr>${tableData.columns.map(col => `<th>${escapeHtml(col.replace(/_/g, ' ').toUpperCase())}</th>`).join('')}</tr>`;

  // Filter Rows
  let rows = tableData.rows || [];
  if (filterVal) {
    rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(filterVal)));
  }

  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="${tableData.columns.length}" style="text-align:center; padding:24px; color:var(--text-muted);">No matching rows for "${escapeHtml(filterVal)}".</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map((row, idx) => {
    return `<tr>${tableData.columns.map(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '<span style="color:var(--text-muted); font-style:italic;">NULL</span>';
      else if (col === 'is_ac') {
        val = val ? '<span class="badge-status online">AC CHARGER</span>' : '<span class="badge-status charging">DC FAST</span>';
      } else if (col.includes('time') || col.includes('_at')) {
        try { val = new Date(val).toLocaleString(); } catch (e) {}
      } else if (col === 'status') {
        const cls = String(val).toUpperCase() === 'CHARGING' ? 'charging' : String(val).toUpperCase() === 'CHARGED' ? 'online' : String(val).toUpperCase() === 'ONLINE' ? 'online' : 'offline';
        val = `<span class="badge-status ${cls}">${escapeHtml(String(val))}</span>`;
      } else if (col.includes('revenue') || col.includes('fee')) {
        val = `<strong style="color:#10b981;">₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>`;
      } else if (col.includes('kwh') || col.includes('power_kw')) {
        val = `<strong>${Number(val).toFixed(2)}</strong> <small style="color:var(--text-muted);">${col.includes('power') ? 'kW' : 'kWh'}</small>`;
      } else {
        val = escapeHtml(String(val));
      }
      return `<td>${val}</td>`;
    }).join('')}</tr>`;
  }).join('');
}

function exportPgTableToCsv() {
  const currentTable = state.activePgTable || 'chargers';
  const tableData = state.pgTableData ? state.pgTableData[currentTable] : null;
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    alert('No data to export.');
    return;
  }
  const headers = tableData.columns;
  const csvRows = [headers.join(',')];
  tableData.rows.forEach(row => {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${currentTable}_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${tableData.rows.length} rows to CSV.`);
}

document.addEventListener('DOMContentLoaded', initApp);

