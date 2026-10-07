// ==========================================================================
// SAAPHZONE CSMS CONTROL & REAL-TIME EV TELEMETRY - JAVASCRIPT
// Enterprise Architecture with Full Auth, Themes, Separate Add Charger Page,
// Tariffs Revenue Breakdown, RFID Tokens, and Reliable Delete Operations
// ==========================================================================

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
  pendingDeleteChargerId: null
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
  btnBatteryPercentageBadge: document.getElementById('btnBatteryPercentageBadge'),
  battButtonPercent: document.getElementById('battButtonPercent'),
  topChargerSelect: document.getElementById('topChargerSelect'),
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
    viewSimulator: document.getElementById('viewSimulator')
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
  cockpitBattCenterNum: document.getElementById('cockpitBattCenterNum'),
  cockpitCircleFill: document.getElementById('cockpitCircleFill'),
  cockpitBattSubDesc: document.getElementById('cockpitBattSubDesc'),
  dialPowerValue: document.getElementById('dialPowerValue'),
  dialSecondaryMetrics: document.getElementById('dialSecondaryMetrics'),
  dialModePillText: document.getElementById('dialModePillText'),
  dialStatusGear: document.getElementById('dialStatusGear'),
  saaphDialProgressArc: document.getElementById('saaphDialProgressArc'),
  saaphDialTicksGroup: document.getElementById('saaphDialTicksGroup'),
  cockpitLeftPowerNum: document.getElementById('cockpitLeftPowerNum'),
  cockpitLeftModeSub: document.getElementById('cockpitLeftModeSub'),
  cockpitWaveformCanvas: document.getElementById('cockpitWaveformCanvas'),
  cockpitLeftKeyShort: document.getElementById('cockpitLeftKeyShort'),
  btnCockpitCopyKey: document.getElementById('btnCockpitCopyKey'),
  cockpitRadarBlip: document.getElementById('cockpitRadarBlip'),
  cockpitRadarNum: document.getElementById('cockpitRadarNum'),
  cockpitSessionKwh: document.getElementById('cockpitSessionKwh'),
  cockpitSessionTime: document.getElementById('cockpitSessionTime'),
  cockpitRangeVal: document.getElementById('cockpitRangeVal'),
  cockpitRangeBar: document.getElementById('cockpitRangeBar'),
  cockpitSocVal: document.getElementById('cockpitSocVal'),
  cockpitSocBar: document.getElementById('cockpitSocBar'),
  cockpitActualV: document.getElementById('cockpitActualV'),
  cockpitReqV: document.getElementById('cockpitReqV'),
  cockpitVFill: document.getElementById('cockpitVFill'),
  cockpitVMarker: document.getElementById('cockpitVMarker'),
  cockpitActualA: document.getElementById('cockpitActualA'),
  cockpitReqA: document.getElementById('cockpitReqA'),
  cockpitAFill: document.getElementById('cockpitAFill'),
  cockpitAMarker: document.getElementById('cockpitAMarker'),
  cockpitBattTempVal: document.getElementById('cockpitBattTempVal'),
  cockpitBattTempBar: document.getElementById('cockpitBattTempBar'),
  cockpitChgTempVal: document.getElementById('cockpitChgTempVal'),
  cockpitChgTempBar: document.getElementById('cockpitChgTempBar'),
  cockpitStatusBadge: document.getElementById('cockpitStatusBadge'),
  btnChargerPowerOn: document.getElementById('btnChargerPowerOn'),
  btnChargerPowerOff: document.getElementById('btnChargerPowerOff'),

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

  toastContainer: document.getElementById('toastContainer')
};

// ==========================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==========================================================================

function initApp() {
  loadSavedTheme();
  initThemeListeners();
  initAuth();
  initDial();
  initSimulator();
  initWebSocket();
  initModals();
  initNavigation();
  initAddChargerPage();
  updateEndpointDisplay();
  fetchChargers();
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
    if (username === 'admin' && password === 'password123') {
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
        showToast(`🎉 Charge Point ${data.charger.name} successfully registered!`);
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

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
      const chg = state.chargers.find(c => c.id === msg.chargerId);
      if (chg) {
        chg.telemetry = msg.telemetry;
        chg.status = msg.status;
        chg.lastSeen = msg.lastSeen;
        if (msg.stats) chg.stats = msg.stats;

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

        updateDashboardTableRow(chg);
        if (state.selectedChargerId === msg.chargerId) {
          updateCockpitTelemetry();
        }
      }
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
      <td><strong>${v} V</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqV}V)</span></td>
      <td><strong>${a} A</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqA}A)</span></td>
      <td>
        <span class="table-soc-pill">🔋 ${soc}%</span>
      </td>
      <td><strong style="color:var(--primary-cyan); font-size:1rem;">${pKw} kW</strong></td>
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
  if (!tr) return;
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
  tr.children[2].innerHTML = `<strong>${v} V</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqV}V)</span>`;
  tr.children[3].innerHTML = `<strong>${a} A</strong> <span style="color:var(--primary-cyan); font-size:0.75rem;">(Req: ${reqA}A)</span>`;
  tr.children[4].innerHTML = `<span class="table-soc-pill">🔋 ${soc}%</span>`;
  tr.children[5].innerHTML = `<strong style="color:var(--primary-cyan); font-size:1rem;">${pKw} kW</strong>`;
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

window.controlCharger = async (id, action) => {
  if (!id) id = state.selectedChargerId;
  if (!id) return;

  try {
    const res = await fetch(`/api/chargers/${id}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      const chg = state.chargers.find(c => c.id === id);
      if (chg) {
        chg.status = data.status;
        chg.telemetry = data.charger.telemetry;
      }
      updateCockpitTelemetry();
      renderDashboardTable();
      renderChargePointsCards();
      updateKpis();
      showToast(`⚡ Charger ${action === 'ON' ? 'turned ON (Charging active)' : 'turned OFF (Stopped)'}`);
    } else {
      showToast(`Control Error: ${data.error}`, 'error');
    }
  } catch (e) {
    showToast(`Network error: ${e.message}`, 'error');
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
  const charger = state.chargers.find(c => c.id === state.selectedChargerId);
  if (!charger) return;

  const t = charger.telemetry || {};
  const v = Number(t.charger_voltage || 0);
  const a = Number(t.charger_current || 0);
  const reqV = Number(t.battery_req_voltage || 0);
  const reqA = Number(t.battery_req_current || 0);
  const soc = Number(t.battery_soc || 0);
  const pKw = Number(t.power_kw || 0);
  const bTemp = Number(t.battery_temp || 25);
  const chgTemp = Number(t.charger_temp || 25);

  // DEDICATED PROMINENT BATTERY LEVEL BUTTON (User Requirement)
  dom.battButtonPercent.textContent = `${soc.toFixed(1)}%`;
  dom.cockpitBattCenterNum.textContent = `${Math.round(soc)}%`;
  dom.cockpitCircleFill.setAttribute('stroke-dasharray', `${soc.toFixed(0)}, 100`);
  dom.cockpitBattSubDesc.textContent = `${soc.toFixed(1)}% Already Charged`;

  // Banner & Readout
  dom.cockpitCurrentBayTitle.textContent = charger.name;
  dom.cockpitCurrentBayLocation.textContent = `${charger.location} • ${charger.connectorType}`;
  dom.dialPowerValue.textContent = pKw.toFixed(1);
  dom.dialSecondaryMetrics.textContent = `${v.toFixed(1)} V • ${a.toFixed(1)} A`;
  dom.dialModePillText.textContent = t.charging_mode || 'SPORT PLUS';
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

  // Arc Gauge Animation (Scale 0 to 400 kW matching ticks)
  const maxKw = 400;
  const ratio = Math.min(1, Math.max(0, pKw / maxKw));
  const targetOffset = 754 - (ratio * 754);
  if (dom.saaphDialProgressArc) {
    dom.saaphDialProgressArc.style.strokeDashoffset = targetOffset;
  }

  // Left Panel
  dom.cockpitLeftPowerNum.textContent = pKw.toFixed(1);
  dom.cockpitLeftModeSub.textContent = `${t.charging_mode || 'SPORT PLUS'} // ${charger.maxVoltage}V DC BUS`;
  dom.cockpitLeftKeyShort.textContent = `${charger.apiKey.substring(0, 16)}...`;
  dom.cockpitSessionKwh.textContent = Number(t.session_energy_kwh || 0).toFixed(1);
  dom.cockpitSessionTime.textContent = `${Number(t.session_duration_min || 0).toFixed(1)} min active`;

  const radarRatio = pKw / 100;
  dom.cockpitRadarNum.textContent = `${radarRatio.toFixed(1)} P`;
  dom.cockpitRadarBlip.style.left = `${45 + Math.sin(Date.now() / 800) * (radarRatio * 15)}%`;
  dom.cockpitRadarBlip.style.top = `${45 + Math.cos(Date.now() / 800) * (radarRatio * 15)}%`;

  // Right Panel: Dual Comparison Bars (Actual vs Battery Demands)
  const estRange = Math.round((soc / 100) * 540);
  dom.cockpitRangeVal.textContent = soc > 0 ? `${estRange} km` : '0 km (Standby)';
  dom.cockpitRangeBar.style.width = `${Math.max(2, soc)}%`;

  dom.cockpitSocVal.textContent = `${soc.toFixed(1)} %`;
  dom.cockpitSocBar.style.width = `${Math.max(2, soc)}%`;

  // Voltage Comparison
  const maxV = charger.maxVoltage || 800;
  dom.cockpitActualV.textContent = `${v.toFixed(1)} V`;
  dom.cockpitReqV.textContent = reqV > 0 ? `Req: ${reqV.toFixed(1)} V` : 'Req: 0.0 V';
  dom.cockpitVFill.style.width = `${Math.max(2, Math.min(100, (v / maxV) * 100))}%`;
  dom.cockpitVMarker.style.left = `${Math.max(2, Math.min(100, (reqV / maxV) * 100))}%`;

  // Current Comparison
  const maxA = charger.maxCurrent || 350;
  dom.cockpitActualA.textContent = `${a.toFixed(1)} A`;
  dom.cockpitReqA.textContent = reqA > 0 ? `Req: ${reqA.toFixed(1)} A` : 'Req: 0.0 A';
  dom.cockpitAFill.style.width = `${Math.max(2, Math.min(100, (a / maxA) * 100))}%`;
  dom.cockpitAMarker.style.left = `${Math.max(2, Math.min(100, (reqA / maxA) * 100))}%`;

  // Temperatures
  dom.cockpitBattTempVal.textContent = `${bTemp.toFixed(1)} °C`;
  dom.cockpitBattTempBar.style.width = `${Math.max(4, Math.min(100, (bTemp / 75) * 100))}%`;

  dom.cockpitChgTempVal.textContent = `${chgTemp.toFixed(1)} °C`;
  dom.cockpitChgTempBar.style.width = `${Math.max(4, Math.min(100, (chgTemp / 80) * 100))}%`;

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
        <div class="q-cell"><span class="q-lbl">POWER</span><span class="q-val cyan">${pKw} kW</span></div>
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
}

window.selectAndOpenCockpit = (id) => {
  state.selectedChargerId = id;
  dom.topChargerSelect.value = id;
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
  const endpoint = `${window.location.origin}/api/telemetry`;

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
  dom.displayEndpointUrl.textContent = `${window.location.origin}/api/telemetry`;
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

  document.getElementById('simPresetFast').onclick = () => setSimVals(420.0, 155.0, 78.0, 428.0, 165.0, 34.0);
  document.getElementById('simPreset400V').onclick = () => setSimVals(385.0, 95.0, 48.0, 400.0, 110.0, 30.5);
  document.getElementById('simPresetTaper').onclick = () => setSimVals(438.0, 32.0, 88.0, 440.0, 35.0, 36.0);
  document.getElementById('simPresetFault').onclick = () => setSimVals(0.0, 0.0, 50.0, 0.0, 0.0, 62.0);

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
    status: Number(dom.slA.value) > 0.5 ? 'CHARGING' : 'ONLINE'
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

  dom.topChargerSelect.onchange = (e) => {
    state.selectedChargerId = e.target.value;
    updateCockpitTelemetry();
    updatePcbKeyView();
  };

  // Prominent battery button click navigates to live cockpit
  dom.btnBatteryPercentageBadge.onclick = () => switchView('cockpitView');

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
  sel.innerHTML = '';
  state.chargers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} [${c.status}]`;
    if (c.id === state.selectedChargerId) opt.selected = true;
    sel.appendChild(opt);
  });
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

document.addEventListener('DOMContentLoaded', initApp);
