const API_BASE = "";
const STORAGE_KEYS = {
  accountId: "shellrpg_player_account_id",
  deviceId: "shellrpg_browser_device_id",
  characterName: "shellrpg_character_name",
};
let currentLang = "de";
let liveEventSource = null;
let liveReconnectHandle = null;
let liveEventCursor = 0;
let liveAuxiliaryRefreshHandle = null;
let weatherMap = null;
let recoveryConflicts = null;
let recoveryHistory = null;
let weatherRegions = null;
let matrixHealth = null;
const matrixConflictUiState = {
  severity: "all",
  reasonCode: "all",
  onlyMerged: false,
  sortMode: "severity",
};
let npcs = null;
let npcMenu = null;
let socialCatalog = null;
let brewingCatalog = null;
let enchantingCatalog = null;
let artifactWeave = null;
let characterRoster = null;
let sessionReady = false;
let liveConnectionState = "offline";
let uiModules = null;
const CHARACTER_FACTIONS = ["Menschen", "Amazonen", "Waldelfen", "Dryaden", "Baumwesen", "Nekari", "Ssarathi", "Salzlungen", "Orks", "Dämonen"];
const CHARACTER_RACES = ["Mensch", "Nekari", "Ssarathi", "Salzlunge", "Waldelf", "Dryade", "Baumwesen"];
const CHARACTER_CLASSES = ["Ritter", "Totenbeschwörer", "Kleriker", "Waldläufer", "Magier", "Dieb", "Beastmaster"];
const ATTRIBUTE_FIELDS = [
  { key: "strength", id: "attr-strength" },
  { key: "dexterity", id: "attr-dexterity" },
  { key: "accuracy", id: "attr-accuracy" },
  { key: "intelligence", id: "attr-intelligence" },
  { key: "wisdom", id: "attr-wisdom" },
  { key: "speed", id: "attr-speed" },
];
const OBSERVER_SAFE_COMMAND_PATTERNS = [
  "showcommands",
  "show commands",
  "commands",
  "help",
  "look",
  "inspect",
  "map",
  "inventory",
  "equipment",
  "buffs",
  "quests",
  "quest log",
  "quests log",
  "journal",
  "lang",
  "lang de",
  "lang en",
  "market",
  "merchant",
  "merchant list",
  "brew menu",
  "enchant menu",
  "artifact",
  "artifact weave",
  "artifact weave cities",
  "artifact weave buildings",
  "artifact weave detailed",
  "artifact weave conditions",
  "rcon",
  "rcon status",
  "rcon ticks",
  "rcon savepoint",
  "rcon npcs",
  "rcon weather",
  "rcon recovery",
  "rcon artifact",
  "rcon npc opinion",
  "rcon npc schedule",
  "rcon rumor list",
  "rcon quest inspect",
  "npc",
  "npc menu",
  "city",
  "city status",
  "militia",
  "militia status",
  "garrison",
  "garrison status",
];
let latestSnapshot = null;

// Laedt die gekapselten WWW-UI-Module nur einmal nach, damit die Hauptdatei Steuerlogik bleibt und die Praesentation modularisiert wird.
async function loadUiModules() {
  if (uiModules) return uiModules;
  const [statusPanel, mapView, particleLayer] = await Promise.all([
    import("/src/features/status/statusPanel.js"),
    import("/src/features/map/mapView.js"),
    import("/src/features/atmosphere/particleLayer.js"),
  ]);
  uiModules = { statusPanel, mapView, particleLayer };
  return uiModules;
}

// Normalisiert serverseitige Asset-Pfade auf same-origin WWW-Pfade.
function normalizeAssetPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.?\//, "")}`;
}

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readIdentity() {
  return {
    playerAccountId: window.localStorage.getItem(STORAGE_KEYS.accountId) || "",
    deviceId: window.localStorage.getItem(STORAGE_KEYS.deviceId) || "",
    characterName: window.localStorage.getItem(STORAGE_KEYS.characterName) || "Neowulf",
  };
}

function writeIdentity(identity) {
  if (identity.playerAccountId) window.localStorage.setItem(STORAGE_KEYS.accountId, identity.playerAccountId);
  if (identity.deviceId) window.localStorage.setItem(STORAGE_KEYS.deviceId, identity.deviceId);
  if (identity.characterName) window.localStorage.setItem(STORAGE_KEYS.characterName, identity.characterName);
}

// Merkt sich den letzten serverseitigen Live-Cursor, damit SSE-Ereignisse und direkte API-Antworten sauber dedupliziert werden.
function rememberLiveCursor(snapshot) {
  const cursor = Number(snapshot?.status?.live_event_id || 0);
  if (cursor > liveEventCursor) liveEventCursor = cursor;
}

// Haelt den lokalen Verbindungszustand fuer die Statusanzeige zwischen Live-SSE und Fallback-Refresh fest.
function setLiveConnectionState(nextState) {
  liveConnectionState = nextState;
  if (typeof document !== "undefined") {
    syncTopbarMeta(latestSnapshot?.status || {});
  }
}

async function ensureSession() {
  if (sessionReady) return;
  const identity = readIdentity();
  if (!identity.deviceId) {
    identity.deviceId = randomId();
  }
  const payload = {
    character_name: identity.characterName || "Neowulf",
    player_account_id: identity.playerAccountId || "",
    device_id: identity.deviceId,
    device_label: `www:${window.navigator.userAgent.slice(0, 48)}`,
    auth_provider: "local-device",
    client_nonce: randomId().replace(/-/g, "").slice(0, 16),
    rejoin: true,
  };
  const login = await fetchJson("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  writeIdentity({
    playerAccountId: login.player_account_id || identity.playerAccountId,
    deviceId: identity.deviceId,
    characterName: login.character_name || identity.characterName,
  });
  sessionReady = true;
}

async function fetchJson(path, options = undefined) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${API_BASE}${path}${separator}lang=${currentLang}`, {
    credentials: "same-origin",
    ...(options || {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `${response.status} ${response.statusText}`);
  }
  return payload;
}

// Holt additive Diagnosepfade weich nach und faellt bei aelteren Servern oder temporaeren Luecken auf einen lesbaren Platzhalter zurueck.
async function fetchOptionalJson(path, options = undefined) {
  const separator = path.includes("?") ? "&" : "?";
  try {
    const response = await fetch(`${API_BASE}${path}${separator}lang=${currentLang}`, {
      credentials: "same-origin",
      ...(options || {}),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        available: false,
        status_code: response.status,
        message: payload?.message || `${response.status} ${response.statusText}`,
        path,
      };
    }
    if (payload && typeof payload === "object") return payload;
    return {
      ok: false,
      available: false,
      status_code: response.status,
      message: "Keine JSON-Antwort erhalten.",
      path,
    };
  } catch (error) {
    return {
      ok: false,
      available: false,
      status_code: 0,
      message: error?.message || "Gateway-Verbindung fehlgeschlagen.",
      path,
    };
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeCommandText(value) {
  return String(value || "").toLowerCase().replaceAll("_", " ").trim().replace(/\s+/g, " ");
}

function prettySlotLabel(value) {
  return String(value || "").replaceAll("_", " ").trim();
}

function findCommandDetail(commandDetails, query) {
  const normalized = normalizeCommandText(query);
  if (!normalized || !Array.isArray(commandDetails)) return null;
  let best = null;
  commandDetails.forEach((entry) => {
    const aliases = Array.isArray(entry.aliases) && entry.aliases.length ? entry.aliases : [entry.usage];
    aliases.forEach((alias) => {
      const normalizedAlias = normalizeCommandText(alias);
      if (!normalizedAlias) return;
      if (normalized === normalizedAlias || normalized.startsWith(`${normalizedAlias} `)) {
        const score = normalizedAlias.length;
        if (!best || score > best.score) best = { score, entry };
      }
    });
  });
  return best?.entry || null;
}

// Prueft, ob die aktuelle Sitzung laut letztem Snapshot schreibend auf denselben Charakterzustand zugreifen darf.
function controlWriteAllowed(status) {
  if (!status?.control_mode) return true;
  return !!status.control_write_allowed;
}

// Prueft lokal, ob ein Spielkommando fuer Beobachter rein lesend und damit weiterhin erlaubt bleibt.
function isObserverSafeCommand(command, commandDetails = []) {
  const normalized = normalizeCommandText(command);
  if (!normalized) return true;
  if (normalized === "help" || normalized.startsWith("help ")) return true;
  const detail = findCommandDetail(commandDetails, command);
  if (detail?.observer_safe) return true;
  return OBSERVER_SAFE_COMMAND_PATTERNS.some((pattern) => normalized === pattern || normalized.startsWith(`${pattern} `));
}

// Blockiert lokale Schreibpfade fuer Beobachter schon im WWW, bevor ein Request an den Server geht.
function guardObserverWrite(status, actionLabel, command = "") {
  if (controlWriteAllowed(status)) return false;
  if (command && isObserverSafeCommand(command, latestSnapshot?.command_details || [])) return false;
  const reason = `Diese Web-Sitzung ist Beobachter. '${actionLabel}' bleibt read-only, bis du die Steuerung explizit uebernimmst.`;
  setRosterFeedback(reason, "feedback-warn");
  return true;
}

function renderGatewayError(message) {
  const statusPanel = document.getElementById("status-panel");
  statusPanel.innerHTML = "";
  statusPanel.append(el("h2", "", "Gateway-Verbindung"));
  statusPanel.append(el("p", "status-message", message));
  setRosterFeedback(message, "feedback-error");
  syncTopbarMeta(latestSnapshot?.status || {});
}

// Spiegelt die serverseitige Weltlage in die persistent sichtbare Topbar, damit Ort, Rolle und Live-Zustand immer praesent bleiben.
function syncTopbarMeta(status) {
  const live = document.getElementById("meta-live");
  const role = document.getElementById("meta-role");
  const location = document.getElementById("meta-location");
  const weather = document.getElementById("meta-weather");
  const account = document.getElementById("meta-account");
  if (live) {
    const label = liveConnectionState === "live"
      ? "Live: Server Events"
      : (liveConnectionState === "connecting" ? "Live: verbinde ..." : "Live: Fallback");
    live.textContent = label;
  }
  if (role) role.textContent = `Rolle: ${controlRoleLabel(status)}`;
  if (location) location.textContent = `Ort: ${status?.location_label || "unbekannt"} [${status?.coords_label || "—"}]`;
  if (weather) weather.textContent = `Wetter: ${status?.weather_label || "—"} · ${status?.time_label || "—"}`;
  if (account) account.textContent = `Account: ${status?.player_account_id || "—"}`;
}

function cardSprite(src, label) {
  const wrap = el("div", "sprite-card");
  const img = document.createElement("img");
  img.src = normalizeAssetPath(src);
  img.alt = label;
  wrap.appendChild(img);
  wrap.appendChild(el("div", "sprite-label", label));
  return wrap;
}

function setRosterFeedback(message, tone = "") {
  const feedback = document.getElementById("roster-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = tone ? `small ${tone}` : "small";
}

function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select || select.options.length) return;
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    select.append(node);
  });
}

function remainingAttributePoints() {
  return 12 - ATTRIBUTE_FIELDS.reduce((sum, field) => {
    const value = Number(document.getElementById(field.id)?.value || 10);
    return sum + Math.max(0, Math.trunc(value) - 10);
  }, 0);
}

function syncAttributeBudget() {
  const remaining = remainingAttributePoints();
  const budget = document.getElementById("attribute-budget");
  if (!budget) return remaining;
  budget.textContent = `Verbleibende Bonuspunkte: ${remaining}`;
  budget.className = remaining < 0 ? "small feedback-error" : "small";
  return remaining;
}

function initializeCharacterForm() {
  populateSelect("char-faction", CHARACTER_FACTIONS);
  populateSelect("char-race", CHARACTER_RACES);
  populateSelect("char-class", CHARACTER_CLASSES);
  ATTRIBUTE_FIELDS.forEach((field) => {
    const input = document.getElementById(field.id);
    if (input && !input.dataset.boundBudget) {
      input.addEventListener("input", syncAttributeBudget);
      input.dataset.boundBudget = "true";
    }
  });
  syncAttributeBudget();
}

function characterPayloadFromForm() {
  const attributes = {};
  ATTRIBUTE_FIELDS.forEach((field) => {
    const value = Number(document.getElementById(field.id)?.value || 10);
    attributes[field.key] = Math.max(1, Math.min(40, Math.trunc(value) || 10));
  });
  return {
    character_name: document.getElementById("char-name")?.value?.trim() || "Neowulf",
    faction: document.getElementById("char-faction")?.value || CHARACTER_FACTIONS[0],
    race_name: document.getElementById("char-race")?.value || CHARACTER_RACES[0],
    class_name: document.getElementById("char-class")?.value || CHARACTER_CLASSES[0],
    attributes,
    language: currentLang,
  };
}

function renderCharacterRoster(roster, status) {
  const account = document.getElementById("roster-account");
  const list = document.getElementById("roster-list");
  if (!account || !list) return;
  const accountId = roster?.player_account_id || status?.player_account_id || "unbekannt";
  account.textContent = `Account: ${accountId} · Aktiver Charakter: ${status?.character_name || "—"}`;
  list.innerHTML = "";
  const entries = roster?.entries || [];
  if (!entries.length) {
    list.append(el("p", "small", "Noch keine Charaktere im Account vorhanden."));
    return;
  }
  entries.forEach((entry, index) => {
    const card = el("div", `roster-card${entry.active ? " is-active" : ""}`);
    card.append(el("strong", "", `${index + 1}. ${entry.character_name}${entry.active ? " · AKTIV" : ""}`));
    card.append(el("p", "small", `${entry.class_name}/${entry.race_name} · ${entry.faction} · Level ${entry.level}`));
    card.append(el("p", "small", `Position: ${entry.coords_label} · ID: ${entry.character_id}`));
    const controls = el("div", "controls-row");
    const switchButton = el("button", "small-button", entry.active ? "Aktiv" : "Aktivieren");
    switchButton.type = "button";
    switchButton.disabled = !!entry.active || !controlWriteAllowed(status);
    switchButton.addEventListener("click", () => switchCharacter(entry.character_id));
    controls.append(switchButton);
    card.append(controls);
    list.append(card);
  });
}

// Uebersetzt die serverseitige Rollenkennung in eine lesbare WWW-Beschriftung.
function controlRoleLabel(status) {
  const role = status?.control_role || "";
  if (role === "active-controller") return "Aktive Steuerung";
  if (role === "observer") return "Beobachter";
  return role || "Unbekannt";
}

// Uebersetzt den technischen Steuerungszustand in eine ruhig lesbare Oberflaechenform.
function controlStateLabel(status) {
  const state = status?.control_state || "free";
  if (state === "held-by-you") return "von dir gehalten";
  if (state === "held-by-other") return "von anderer Sitzung gehalten";
  if (state === "free") return "frei";
  return state;
}

// Rendert die Statuskarte inklusive expliziter Controller-/Observer-Steuerung fuer denselben Charakterzustand.
function renderStatus(panel, status, message) {
  if (!uiModules?.statusPanel?.renderStatusPanel) return;
  uiModules.statusPanel.renderStatusPanel(panel, status, message, {
    liveConnectionState,
    onTakeControl: () => takeControl(),
    onReleaseControl: () => releaseControl(),
  });
}

function renderScene(panel, status) {
  panel.innerHTML = "";
  const hero = el("div", "scene-frame");
  hero.style.backgroundImage = `linear-gradient(135deg, rgba(8, 8, 14, 0.18), rgba(8, 8, 14, 0.78)), url('${normalizeAssetPath(status.media_file)}')`;
  hero.append(
    el(
      "div",
      "scene-caption",
      `${status.overlay_message || "Die Szene verharrt."} · ${status.location_label} · ${status.weather_label || "—"} · ${status.time_label || "—"}`,
    ),
  );
  panel.append(hero);
}

function renderMap(panel, mapTiles) {
  if (!uiModules?.mapView?.renderMapPanel) return;
  uiModules.mapView.renderMapPanel(panel, {
    status: latestSnapshot?.status,
    mapTiles,
    weatherMap,
    combat: latestSnapshot?.combat || [],
    onTileCommand: (command) => {
      const input = document.getElementById("command-input");
      if (!input) return;
      input.value = command;
      updateCommandComposerState();
    },
  });
}


function renderCharacter(panel, status, equipment, buffs) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Charakter"));
  const list = el("div", "stack");
  list.append(el("p", "", `Level ${status.level}`));
  list.append(el("p", "", `Dialogmodus: ${status.dialogue_mode ? status.dialogue_target : "nein"}`));
  if (equipment?.length) {
    const wrap = el("div", "sprite-row");
    equipment
      .filter((entry) => entry?.occupied !== false && entry?.sprite)
      .forEach((entry) => wrap.append(cardSprite(entry.sprite, `${prettySlotLabel(entry.slot)}: ${entry.item_name}`)));
    if (wrap.childNodes.length) list.append(wrap);
    const slots = el("ul", "chip-list");
    equipment.forEach((entry) => {
      const text = entry?.occupied === false
        ? `${prettySlotLabel(entry.slot)}: leer`
        : `${prettySlotLabel(entry.slot)}: ${entry.item_name}`;
      slots.append(el("li", "chip", text));
    });
    list.append(slots);
  }
  if (buffs?.length) {
    const buffsNode = el("ul", "chip-list");
    buffs.forEach((buff) => buffsNode.append(el("li", "chip", `${buff.buff_name} +${buff.value}`)));
    list.append(buffsNode);
  }
  panel.append(list);
}

function renderInventory(panel, inventory) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Inventar"));
  const grid = el("div", "inventory-grid");
  inventory.forEach((entry) => {
    const card = cardSprite(entry.sprite, `${entry.item_name} x${entry.quantity}`);
    const meta = el("div", "sprite-meta", `${entry.category} · ${entry.quality}`);
    card.append(meta);
    if (entry.affixes?.length) card.append(el("div", "sprite-affix", entry.affixes.join(" · ")));
    grid.append(card);
  });
  panel.append(grid);
  if (weatherMap?.fronts?.length) {
    const fronts = el('div', 'stack');
    fronts.append(el('h3', '', 'Wetterfronten'));
    weatherMap.fronts.forEach((front) => fronts.append(el('p', 'small', `${front.label} · ${front.name} · Zentrum ${front.x},${front.y} · Vektor ${front.velocity.x},${front.velocity.y} · Radius ${front.radius}`)));
    panel.append(fronts);
  }
  if (weatherRegions?.regions?.length) {
    const reg = el('div', 'stack');
    reg.append(el('h3', '', 'Regionale Fronten'));
    weatherRegions.regions.forEach((entry) => reg.append(el('p', 'small', `${entry.label} · ${entry.outlook} · Stärke ${entry.severity}${entry.fronts?.length ? ' · ' + entry.fronts.join(', ') : ''}`)));
    panel.append(reg);
  }
}

function renderMarket(panel, market) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Händler"));
  const list = el("div", "inventory-grid");
  market.forEach((entry) => {
    const card = cardSprite(entry.sprite, entry.item_name);
    card.append(el("div", "sprite-meta", `${entry.price_display} · ${entry.trend}`));
    if (entry.price_reason) card.append(el("div", "sprite-affix", entry.price_reason));
    const buy = el("button", "small-button", "Kaufen");
    buy.type = "button";
    buy.addEventListener("click", () => {
      document.getElementById("command-input").value = `buy ${entry.item_name}`;
    });
    card.append(buy);
    list.append(card);
  });
  panel.append(list);
}

function formatCountdown(value, options = {}) {
  const total = Math.max(0, Number.parseInt(value || 0, 10));
  if (options.combat && total <= 60) return `00:${String(total).padStart(2, "0")}`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderCombat(panel, combat, status) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Kampf"));
  if (!combat?.length) {
    panel.append(el("p", "", "Kein aktiver Kampf."));
    return;
  }
  const row = el("div", "inventory-grid");
  combat.forEach((enemy) => {
    const card = cardSprite(enemy.sprite, enemy.enemy_name);
    card.append(el("div", "sprite-meta", `${enemy.hp_current}/${enemy.hp_max} HP · ${enemy.faction}`));
    row.append(card);
  });
  panel.append(row);
  const choices = Array.isArray(status?.combat_choices) && status.combat_choices.length
    ? status.combat_choices.filter((cmd) => cmd !== "auto battle on")
    : [];
  if (choices.length) {
    const actions = el("div", "controls-row");
    choices.forEach((cmd) => {
      const b = el("button", "small-button", cmd);
      b.type = "button";
      b.addEventListener("click", () => sendCommand(cmd));
      actions.append(b);
    });
    panel.append(actions);
  }
  const reaction = Number(status?.reaction_seconds_left || 0);
  const label = status?.auto_battle_enabled ? "Auto-Battle" : "Combat";
  panel.append(el("p", "small", `${label}: ${formatCountdown(reaction, { combat: true })}`));
}

function renderCity(panel, city) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Stadt & Garnison"));
  if (!city) {
    panel.append(el("p", "", "Noch keine gegründete Stadt."));
    panel.append(el("button", "small-button", "Stadt hier gründen")).addEventListener("click", () => {
      document.getElementById("command-input").value = "city found Morgenwacht";
    });
    return;
  }
  panel.append(el("p", "", `${city.city_name} · Gouverneur: ${city.governor_name}`));
  panel.append(el("p", "", `Steuern: ${city.taxes_silver}s · Bevölkerung: ${city.population} · Forschung: ${city.research_points}`));
  if (city.region_line) panel.append(el("p", "small", city.region_line));
  if (city.weather_pressure_line) panel.append(el("p", "small", city.weather_pressure_line));
  if (city.urban_suspicion_line) panel.append(el("p", "small", city.urban_suspicion_line));
  if (city.urban_diagnosis_line) panel.append(el("p", "small", city.urban_diagnosis_line));
  if (city.civilization_stage_line) panel.append(el("p", "small", `Entwicklungsstufe: ${city.civilization_stage_line}`));
  if (city.city_carrier_line) panel.append(el("p", "small", city.city_carrier_line));
  if (city.city_field_policy_line) panel.append(el("p", "small", `Stadtfeldgrenzen: ${city.city_field_policy_line}`));
  if (city.regional_scarcity_line) panel.append(el("p", "small", city.regional_scarcity_line));
  if (city.regional_yield_line) panel.append(el("p", "small", city.regional_yield_line));
  if (city.splitter_pressure_line) panel.append(el("p", "small", city.splitter_pressure_line));
  if (city.trade_demand_line) panel.append(el("p", "small", city.trade_demand_line));
  if (city.city_storage_line) panel.append(el("p", "small", city.city_storage_line));
  if (city.caravan_flow_line) panel.append(el("p", "small", city.caravan_flow_line));
  if (city.build_profile_line) panel.append(el("p", "small", city.build_profile_line));
  if (city.special_resource_line) panel.append(el("p", "small", city.special_resource_line));
  if (city.material_basis_line) panel.append(el("p", "small", city.material_basis_line));
  if (city.armory_basis_line) panel.append(el("p", "small", city.armory_basis_line));
  if (city.protectorate_line) panel.append(el("p", "small", `Schutz-/Besatzungslage: ${city.protectorate_line}`));
  const constructionLines = city.construction_lines?.length
    ? city.construction_lines
    : (city.construction_capacity_line ? [city.construction_capacity_line] : []);
  const blocks = [
    ["Baustellen", constructionLines],
    ["Bauwerke", city.building_lines],
    ["Miliz", city.militia_lines],
    ["Generäle", city.general_lines],
    ["Produktion", city.production_lines],
    ["Belagerung", city.siege_lines],
  ];
  blocks.forEach(([title, lines]) => {
    const box = el("div", "stack");
    box.append(el("h3", "", title));
    if (!lines?.length) box.append(el("p", "small", "—"));
    else lines.forEach((line) => box.append(el("p", "small", line)));
    panel.append(box);
  });
}



async function loadNpcMenu(name) {
  npcMenu = await fetchJson(`/api/npcs/menu?name=${encodeURIComponent(name)}`);
  renderNPCs(document.getElementById("npc-panel"), npcs, npcMenu);
}

function renderNPCs(panel, npcs, npcMenu) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Stadtbewohner"));
  if (!npcs?.entries?.length) {
    panel.append(el("p", "", "Keine Bewohnerdaten verfügbar."));
    return;
  }
  const stack = el("div", "stack");
  npcs.entries.forEach((entry) => {
    const row = el("div", "stack npc-card");
    row.append(el("strong", "", `${entry.name} · L${entry.level} · ${entry.faction}`));
    row.append(el("p", "small", `${entry.race} · ${entry.role} · ${entry.microfaction_label || entry.microfaction || '—'} · Gold ${entry.gold}`));
    row.append(el("p", "small", `${entry.age_years || '—'}y · ${entry.height_cm || '—'}cm · ${entry.weight_kg || '—'}kg`));
    if (entry.schedule?.day) row.append(el("p", "small", `Tag: ${entry.schedule.day}`));
    if (entry.rumor?.de || entry.rumor?.en) row.append(el("p", "small", currentLang === 'de' ? entry.rumor.de : entry.rumor.en));
    const controls = el("div", "controls-row");
    const open = el("button", "small-button", "Menü");
    open.type = "button";
    open.addEventListener("click", () => loadNpcMenu(entry.name));
    const talk = el("button", "small-button", "Sprechen");
    talk.type = "button";
    talk.addEventListener("click", () => sendCommand(`npc interact ${entry.name} talk`));
    const rumor = el("button", "small-button", "Gerücht");
    rumor.type = "button";
    rumor.addEventListener("click", () => sendCommand(`npc interact ${entry.name} rumor`));
    controls.append(open, talk, rumor);
    row.append(controls);
    stack.append(row);
  });
  panel.append(stack);
  if (npcMenu?.ok) {
    const box = el("div", "stack");
    box.append(el("h3", "", `Interaktionsmenü · ${npcMenu.npc.name}`));
    box.append(el("p", "small", `${npcMenu.npc.role} · ${npcMenu.npc.city}`));
    if (npcMenu.schedule) box.append(el("p", "small", `Tag: ${npcMenu.schedule.day} · Nacht: ${npcMenu.schedule.night}`));
    if (npcMenu.rumor) box.append(el("p", "small", currentLang === 'de' ? npcMenu.rumor.de : npcMenu.rumor.en));
    const controls = el("div", "controls-row");
    (npcMenu.actions || []).forEach((action) => {
      const btn = el("button", "small-button", action);
      btn.type = "button";
      btn.addEventListener("click", () => sendCommand(`npc interact ${npcMenu.npc.name} ${action}`));
      controls.append(btn);
    });
    box.append(controls);
    if (npcMenu.civilization_stage_line) box.append(el("p", "small", npcMenu.civilization_stage_line));
    if (npcMenu.dialogue_line) box.append(el("p", "small", `Dialoggrenze: ${npcMenu.dialogue_line}`));
    if (npcMenu.opinion !== undefined) box.append(el("p", "small", `Meinung: ${npcMenu.opinion}`));
    if (npcMenu.faction_theory) box.append(el("p", "small", `Kataklysmus-Deutung: ${npcMenu.faction_theory}`));
    if (npcMenu.services_detailed?.length) {
      const services = el("div", "stack");
      services.append(el("h4", "", "Dienste"));
      npcMenu.services_detailed.forEach((entry) => {
        const row = el("div", "controls-row");
        row.append(el("span", "small", `${entry.service} · ${entry.price_silver}s`));
        const btn = el("button", "small-button", "Dienst nutzen");
        btn.type = "button";
        btn.addEventListener("click", () => sendCommand(`npc service ${npcMenu.npc.name} ${entry.service}`));
        row.append(btn);
        services.append(row);
      });
      box.append(services);
    }
    if (npcMenu.wares_detailed?.length) {
      const wares = el("div", "stack");
      wares.append(el("h4", "", "Waren"));
      npcMenu.wares_detailed.forEach((entry) => {
        const row = el("div", "controls-row");
        const marketAdjustment = Number(entry.market_adjustment_pct || 0);
        const marketSuffix = marketAdjustment
          ? ` · ${marketAdjustment > 0 ? "+" : ""}${marketAdjustment}% ${currentLang === "de" ? "Markt" : "market"}`
          : "";
        row.append(el("span", "small", `${entry.label} · ${entry.price_silver}s${marketSuffix}`));
        const btn = el("button", "small-button", "Kaufen");
        btn.type = "button";
        btn.addEventListener("click", () => sendCommand(`npc buy ${npcMenu.npc.name} ${entry.item_id}`));
        row.append(btn);
        wares.append(row);
      });
      box.append(wares);
    }
    if (npcMenu.quest_offer) {
      const q = el("div", "stack");
      q.append(el("h4", "", `Quest · ${npcMenu.quest_offer.title}`));
      q.append(el("p", "small", npcMenu.quest_offer.cause));
      q.append(el("p", "small", `Fortschritt: ${npcMenu.quest_offer.progress_percent}%`));
      npcMenu.quest_offer.steps.forEach((step, index) => q.append(el("p", "small", `${index+1}. ${step}`)));
      const btn = el("button", "small-button", "Quest anfragen");
      btn.type = "button";
      btn.addEventListener("click", () => sendCommand(`npc quest ${npcMenu.npc.name}`));
      q.append(btn);
      box.append(q);
    }
    if (npcMenu.faction_resources?.length) box.append(el("p", "small", `Fraktionsressourcen: ${npcMenu.faction_resources.join(', ')}`));
    if (npcMenu.city_carrier_line) box.append(el("p", "small", npcMenu.city_carrier_line));
    if (npcMenu.economy_profile_line) box.append(el("p", "small", npcMenu.economy_profile_line));
    if (npcMenu.regional_scarcity_line) box.append(el("p", "small", npcMenu.regional_scarcity_line));
    if (npcMenu.regional_yield_line) box.append(el("p", "small", npcMenu.regional_yield_line));
    if (npcMenu.splitter_pressure_line) box.append(el("p", "small", npcMenu.splitter_pressure_line));
    if (npcMenu.trade_demand_line) box.append(el("p", "small", npcMenu.trade_demand_line));
    if (npcMenu.city_storage_line) box.append(el("p", "small", npcMenu.city_storage_line));
    if (npcMenu.caravan_flow_line) box.append(el("p", "small", npcMenu.caravan_flow_line));
    if (npcMenu.build_profile_line) box.append(el("p", "small", npcMenu.build_profile_line));
    if (npcMenu.special_resource_line) box.append(el("p", "small", npcMenu.special_resource_line));
    if (npcMenu.trade_cycle_line) box.append(el("p", "small", npcMenu.trade_cycle_line));
    if (npcMenu.market_pressure_line) box.append(el("p", "small", npcMenu.market_pressure_line));
    if (npcMenu.trade_focus_line) box.append(el("p", "small", npcMenu.trade_focus_line));
    if (npcMenu.service_focus_line) box.append(el("p", "small", npcMenu.service_focus_line));
    if (npcMenu.material_basis_preview?.length) box.append(el("p", "small", `Materialbasis: ${npcMenu.material_basis_preview.join(', ')}`));
    if (npcMenu.armory_basis_preview?.length) box.append(el("p", "small", `Rüstkammer: ${npcMenu.armory_basis_preview.join(', ')}`));
    if (npcMenu.craft_focus_line) box.append(el("p", "small", npcMenu.craft_focus_line));
    if (npcMenu.economy_craftables_preview?.length) box.append(el("p", "small", `Rollen-Craftables: ${npcMenu.economy_craftables_preview.join(', ')}`));
    if (npcMenu.faction_craftables_preview?.length) box.append(el("p", "small", `Craftables: ${npcMenu.faction_craftables_preview.join(', ')}`));
    panel.append(box);
  }
}

function renderBrewing(panel, catalog) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Braukunst"));
  if (!catalog?.recipes?.length) { panel.append(el("p", "", "Keine Braudaten.")); return; }
  const stack = el("div", "stack");
  catalog.recipes.forEach((r) => {
    const card = el("div", "stack npc-card");
    card.append(el("strong", "", `${r.result_label}`));
    card.append(el("p", "small", r.materials.map((m) => `${m.label} ${m.have}/${m.need}`).join(' · ')));
    const btn = el("button", "small-button", r.craftable ? "Brauen" : "Fehlt");
    btn.type = "button";
    btn.disabled = !r.craftable;
    btn.addEventListener("click", () => sendCommand(`brew --recipe ${r.label}`));
    card.append(btn);
    stack.append(card);
  });
  panel.append(stack);
}

function renderEnchanting(panel, catalog) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Verzauberung"));
  if (!catalog?.suggestions?.length) { panel.append(el("p", "", "Keine Verzauberungsdaten.")); return; }
  const stack = el("div", "stack");
  catalog.suggestions.forEach((s) => {
    const card = el("div", "stack npc-card");
    card.append(el("strong", "", s.label));
    card.append(el("p", "small", `${s.slot} · Fokus ${s.focus} · Katalysator ${s.catalyst}`));
    const btn = el("button", "small-button", "Verzaubern");
    btn.type = "button";
    btn.addEventListener("click", () => sendCommand(`enchant --slot ${s.slot} --focus ${s.focus} --catalyst ${s.catalyst}`));
    card.append(btn);
    stack.append(card);
  });
  panel.append(stack);
}

function renderArtifactWeave(panel, weave) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Artefaktgewebe"));
  if (!weave?.lines?.length) { panel.append(el("p", "", "Keine Gewebedaten.")); return; }
  panel.append(el("p", "small", `Bekannte Städte: ${(weave.known_cities || []).join(', ') || '—'}`));
  panel.append(el("p", "small", `Spieler-Gebäude: ${(weave.player_buildings || []).join(', ') || '—'}`));
  const stack = el("div", "stack");
  weave.lines.forEach((line) => {
    const card = el("div", "stack npc-card");
    card.append(el("strong", "", `${line.label} ${line.active ? '· AKTIV' : ''}`));
    card.append(el("p", "small", `Städte: ${line.city_hits.length}/${line.required_cities.length} · Gebäude: ${line.building_hits.length}/${line.required_buildings.length} · Artefakte: ${line.item_hits.length}/${line.required_items.length}`));
    card.append(el("p", "small", `Effekte: ${Object.entries(line.effects).map(([k,v]) => `${k}+${v}`).join(' · ')}`));
    if (line.conditions?.length) card.append(el("p", "small", `Bedingungen: ${line.conditions.map((c) => `${c.type}:${Array.isArray(c.required) ? c.required.join('/') : c.required} → ${c.current}${c.ok ? ' ✓' : ' ✕'}`).join(' · ')}`));
    stack.append(card);
  });
  panel.append(stack);
}

function catalogLabel(entry) {
  const label = entry?.label || {};
  if (typeof label === "object") return label.de || label.en || entry?.entry_id || "";
  return String(label || entry?.entry_id || "");
}

function renderCatalogGroup(title, entries, limit = 8) {
  const card = el("div", "stack npc-card");
  card.append(el("strong", "", title));
  const list = Array.isArray(entries) ? entries : [];
  const labels = list.slice(0, limit).map(catalogLabel).filter(Boolean);
  const hidden = Math.max(0, list.length - limit);
  card.append(el("p", "small", labels.length ? `${labels.join(" · ")}${hidden ? ` · +${hidden}` : ""}` : "—"));
  return card;
}

function renderSocialCatalog(panel, catalog) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Glossar"));
  if (!catalog || catalog.available === false) {
    panel.append(el("p", "small feedback-warn", catalog?.message || "Social-Catalog momentan nicht verfuegbar."));
    return;
  }
  const combat = catalog.rev88_combat_glossary || {};
  const attributes = catalog.rev88_attribute_glossary || {};
  const stack = el("div", "stack");
  stack.append(renderCatalogGroup("Rollenfamilien", combat.role_families));
  stack.append(renderCatalogGroup("Magieschulen", combat.magic_schools));
  stack.append(renderCatalogGroup("Stealth/Support", [...(combat.stealth_archetypes || []), ...(combat.support_archetypes || [])]));
  stack.append(renderCatalogGroup("Zweiter Attributring", attributes.second_ring));
  stack.append(renderCatalogGroup("Runtime-Bruecken", attributes.runtime_bridge_terms));
  panel.append(stack);
}

function renderJournal(panel, journal) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Journal"));
  const wrap = el("div", "stack");
  journal.slice(-12).forEach((entry) => wrap.append(el("p", "small", entry)));
  panel.append(wrap);
}

function renderCommands(panel, commands, commandDetails = [], status = null) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Befehle"));
  panel.append(el("p", "small", "Hover zeigt die Langhilfe, Klick uebernimmt das Kommandobeispiel in die Eingabe."));
  const list = el("div", "command-help-grid");
  const details = Array.isArray(commandDetails) && commandDetails.length
    ? commandDetails
    : (commands || []).map((usage) => ({ usage, summary: "", details: "", category: "Befehle", aliases: [usage] }));
  let currentCategory = "";
  details.forEach((entry) => {
    if (entry.category !== currentCategory) {
      currentCategory = entry.category;
      list.append(el("h3", "command-category", currentCategory));
    }
    const card = el("button", "command-help-card");
    card.type = "button";
    card.title = [entry.usage, entry.summary, entry.details].filter(Boolean).join("\n\n");
    card.disabled = !controlWriteAllowed(status) && !entry.observer_safe;
    card.addEventListener("click", () => {
      document.getElementById("command-input").value = entry.usage;
    });
    card.append(el("strong", "", entry.usage));
    if (entry.summary) card.append(el("span", "small", entry.summary));
    list.append(card);
  });
  panel.append(list);
}

function applyCommandTooltips(commandDetails = [], status = null) {
  document.querySelectorAll(".quick-action").forEach((button) => {
    const detail = findCommandDetail(commandDetails, button.dataset.command || "");
    if (!detail) return;
    button.title = [detail.usage, detail.summary, detail.details].filter(Boolean).join("\n\n");
    button.disabled = !controlWriteAllowed(status) && !isObserverSafeCommand(button.dataset.command || "", commandDetails);
  });
}


async function importRecoverySource(source) {
  await fetchJson('/api/recover/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
  await loadState(`Recovery-Import ausgeführt: ${source}`);
}

function renderRecovery(panel, conflicts, history) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Recovery-Konflikte"));
  if (!conflicts) {
    panel.append(el("p", "", "Keine Recovery-Daten."));
    return;
  }
  const chosen = conflicts.chosen || {};
  panel.append(el("p", "", `Bevorzugt: ${chosen.source || 'local'} · Tick ${chosen.latest_tick || 0}`));
  const stack = el("div", "stack");
  (conflicts.conflicts || []).forEach((entry) => {
    const row = el('div', 'controls-row');
    row.append(el("span", "small", `${entry.source} · Tick ${entry.latest_tick} · Δ ${entry.tick_diff ?? '—'}${entry.preferred ? ' · bevorzugt' : ''}`));
    if (entry.source && entry.source !== 'local' && entry.latest_tick >= 0) {
      const btn = el('button', 'small-button', 'Import');
      btn.type = 'button';
      btn.addEventListener('click', () => importRecoverySource(entry.source));
      row.append(btn);
    }
    stack.append(row);
  });
  panel.append(stack);
  if (history?.entries?.length) {
    const hist = el('div', 'stack');
    hist.append(el('h3', '', 'Importhistorie'));
    history.entries.slice(-8).forEach((entry) => hist.append(el('p', 'small', `${entry.mode} · ${entry.source} · Tick ${entry.tick || 0} · importiert=${entry.imported ?? true}`)));
    panel.append(hist);
  }
}

function matrixConflictGroupForField(field) {
  if (["discovered_tiles", "known_resource_tiles", "points_of_interest"].includes(field)) return "knowledge";
  if (["journal", "progress_flags"].includes(field)) return "progress";
  if (field === "inventory") return "inventory";
  return "other";
}

function matrixConflictGroupLabel(group) {
  if (group === "knowledge") return "Wissensstand";
  if (group === "progress") return "Fortschritt";
  if (group === "inventory") return "Inventar";
  return "Sonstiges";
}

function matrixConflictFieldLabel(field) {
  const labels = {
    discovered_tiles: "entdeckte Tiles",
    known_resource_tiles: "Ressourcenwissen",
    points_of_interest: "POIs",
    journal: "Journal",
    progress_flags: "Fortschrittsflags",
    inventory: "fehlende Inventar-Items",
  };
  return labels[field] || prettySlotLabel(field);
}

function normalizeMatrixFieldComparisonSnapshot(rawSnapshot) {
  const snapshot = rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : {};
  const preview = Array.isArray(snapshot.preview)
    ? snapshot.preview.map((value) => String(value || ""))
    : [];
  const resourceCounts = {};
  const rawResourceCounts = snapshot.resource_counts && typeof snapshot.resource_counts === "object"
    ? snapshot.resource_counts
    : {};
  Object.entries(rawResourceCounts).forEach(([key, rawValue]) => {
    const normalizedKey = String(key || "").trim();
    const value = Number(rawValue);
    if (!normalizedKey || !Number.isFinite(value)) return;
    resourceCounts[normalizedKey] = value;
  });
  const count = Number(snapshot.count);
  return {
    kind: String(snapshot.kind || "").trim(),
    count: Number.isFinite(count) ? count : preview.length,
    preview,
    truncated: Boolean(snapshot.truncated),
    resource_counts: resourceCounts,
  };
}

function normalizeMatrixCountMap(rawMap) {
  const normalized = {};
  const source = rawMap && typeof rawMap === "object" ? rawMap : {};
  Object.entries(source).forEach(([key, rawValue]) => {
    const normalizedKey = String(key || "").trim();
    const value = Number(rawValue);
    if (!normalizedKey || !Number.isFinite(value) || value <= 0) return;
    normalized[normalizedKey] = value;
  });
  return normalized;
}

function normalizeMatrixFieldComparisons(entry) {
  const rawComparisons = Array.isArray(entry?.field_comparisons) ? entry.field_comparisons : [];
  return rawComparisons
    .map((rawEntry) => {
      const comparison = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
      const field = String(comparison.field || "").trim();
      if (!field) return null;
      const rawDeltaSummary = comparison.delta_summary && typeof comparison.delta_summary === "object"
        ? comparison.delta_summary
        : {};
      const addedPreview = Array.isArray(rawDeltaSummary.added_preview)
        ? rawDeltaSummary.added_preview.map((value) => String(value || ""))
        : [];
      const changedPreview = Array.isArray(rawDeltaSummary.changed_preview)
        ? rawDeltaSummary.changed_preview.map((value) => String(value || ""))
        : [];
      const priorityPreview = Array.isArray(rawDeltaSummary.priority_preview)
        ? rawDeltaSummary.priority_preview
            .map((rawPriority) => {
              const entry = rawPriority && typeof rawPriority === "object" ? rawPriority : {};
              const label = String(entry.label || "").trim();
              const reason = String(entry.reason || "").trim();
              const reasonCode = String(entry.reason_code || "").trim();
              const weight = Number(entry.weight);
              if (!label) return null;
              return {
                delta_kind: String(entry.delta_kind || "").trim() === "upgrade" ? "upgrade" : "plus",
                label,
                reason,
                reason_code: reasonCode,
                severity: String(entry.severity || "").trim(),
                tier: Number(entry.tier ?? 0),
                weight: Number.isFinite(weight) ? weight : 0,
              };
            })
            .filter(Boolean)
        : [];
      return {
        field,
        group: String(comparison.group || "").trim() || matrixConflictGroupForField(field),
        winner_side: String(comparison.winner_side || "").trim() || "preferred",
        merge_mode: String(comparison.merge_mode || "").trim() || "winner",
        preferred: normalizeMatrixFieldComparisonSnapshot(comparison.preferred),
        fallback: normalizeMatrixFieldComparisonSnapshot(comparison.fallback),
        merged: normalizeMatrixFieldComparisonSnapshot(comparison.merged),
        delta_summary: {
          winner_side: String(rawDeltaSummary.winner_side || comparison.winner_side || "").trim() || "preferred",
          kind: String(rawDeltaSummary.kind || "").trim() || "unknown",
          delta_count: Number(rawDeltaSummary.delta_count ?? (addedPreview.length + changedPreview.length)),
          added_count: Number(rawDeltaSummary.added_count ?? addedPreview.length),
          added_preview: addedPreview,
          changed_count: Number(rawDeltaSummary.changed_count ?? changedPreview.length),
          changed_preview: changedPreview,
          priority_preview: priorityPreview,
          priority_overflow_count: Number(rawDeltaSummary.priority_overflow_count ?? 0),
          hidden_priority_reason_code_counts: normalizeMatrixCountMap(rawDeltaSummary.hidden_priority_reason_code_counts),
          hidden_priority_severity_counts: normalizeMatrixCountMap(rawDeltaSummary.hidden_priority_severity_counts),
          severity_counts: normalizeMatrixCountMap(rawDeltaSummary.severity_counts),
          reason_code_counts: normalizeMatrixCountMap(rawDeltaSummary.reason_code_counts),
          max_severity: String(rawDeltaSummary.max_severity || "").trim() || "",
          max_tier: Number(rawDeltaSummary.max_tier ?? 0),
          priority_count: Number(rawDeltaSummary.priority_count ?? priorityPreview.length),
          truncated: Boolean(rawDeltaSummary.truncated),
        },
        merged_differs_from_preferred: Boolean(comparison.merged_differs_from_preferred),
        merged_differs_from_fallback: Boolean(comparison.merged_differs_from_fallback),
        field_conflict_id: String(comparison.field_conflict_id || "").trim(),
        max_severity: String(comparison.max_severity || rawDeltaSummary.max_severity || "").trim() || "",
        max_tier: Number(comparison.max_tier ?? rawDeltaSummary.max_tier ?? 0),
        severity_counts: normalizeMatrixCountMap(comparison.severity_counts),
        reason_code_counts: normalizeMatrixCountMap(comparison.reason_code_counts),
      };
    })
    .filter(Boolean);
}

function normalizeMatrixCharacterConflicts(matrix, mergeConflicts) {
  const explicit = Array.isArray(matrix.character_conflicts) ? matrix.character_conflicts : [];
  const fallback = explicit.length
    ? explicit
    : (Array.isArray(mergeConflicts) ? mergeConflicts.filter((entry) => entry.scope === "character") : []);

  return fallback.map((rawEntry) => {
    const entry = rawEntry || {};
    const fieldComparisons = normalizeMatrixFieldComparisons(entry);
    const seenFields = new Set();
    const mergedPlayerFields = (Array.isArray(entry.merged_player_fields) ? entry.merged_player_fields : [])
      .map((field) => String(field || "").trim())
      .filter((field) => field && !seenFields.has(field) && seenFields.add(field));

    const grouped = {};
    mergedPlayerFields.forEach((field) => {
      const group = matrixConflictGroupForField(field);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(field);
    });
    const groupOrder = ["knowledge", "progress", "inventory", "other"];
    const mergedFieldGroups = (Array.isArray(entry.merged_field_groups) && entry.merged_field_groups.length
      ? entry.merged_field_groups
      : groupOrder
          .filter((group) => grouped[group]?.length)
          .map((group) => ({
            group,
            field_count: grouped[group].length,
            fields: grouped[group],
          })))
      .map((groupEntry) => {
        const fields = Array.isArray(groupEntry.fields)
          ? groupEntry.fields.map((field) => String(field || "").trim()).filter(Boolean)
          : [];
        return {
          group: String(groupEntry.group || "").trim() || "other",
          field_count: groupEntry.field_count ?? fields.length,
          fields,
        };
      });

    const history = entry.history && typeof entry.history === "object" ? entry.history : {};

    return {
      conflict_id: String(entry.conflict_id || "").trim(),
      player_account_id: entry.player_account_id || "",
      character_id: entry.character_id || "",
      character_name: entry.character_name || "",
      winner: entry.winner || "",
      preferred_tick: entry.preferred_tick ?? 0,
      fallback_tick: entry.fallback_tick ?? 0,
      preferred_updated_at_ts: Number(entry.preferred_updated_at_ts ?? 0),
      fallback_updated_at_ts: Number(entry.fallback_updated_at_ts ?? 0),
      latest_tick: Number(entry.latest_tick ?? Math.max(Number(entry.preferred_tick ?? 0), Number(entry.fallback_tick ?? 0))),
      latest_updated_at_ts: Number(
        entry.latest_updated_at_ts
          ?? Math.max(Number(entry.preferred_updated_at_ts ?? 0), Number(entry.fallback_updated_at_ts ?? 0)),
      ),
      same_tick: Boolean(entry.same_tick),
      reason: String(entry.reason || "").trim(),
      merged_player_fields: mergedPlayerFields,
      merged_player_field_count: entry.merged_player_field_count ?? mergedPlayerFields.length,
      merged_field_groups: mergedFieldGroups,
      field_comparison_count: Number(entry.field_comparison_count ?? fieldComparisons.length),
      field_comparisons: fieldComparisons,
      severity_counts: normalizeMatrixCountMap(entry.severity_counts),
      reason_code_counts: normalizeMatrixCountMap(entry.reason_code_counts),
      hidden_priority_reason_code_counts: normalizeMatrixCountMap(entry.hidden_priority_reason_code_counts),
      max_severity: String(entry.max_severity || "").trim() || "",
      max_tier: Number(entry.max_tier ?? 0),
      history: {
        first_seen_ts: Number(history.first_seen_ts ?? 0),
        last_seen_ts: Number(history.last_seen_ts ?? 0),
        closed_at_ts: Number(history.closed_at_ts ?? 0),
        seen_count: Number(history.seen_count ?? 0),
        still_open: Boolean(history.still_open),
        last_max_severity: String(history.last_max_severity || "").trim() || "",
        last_latest_tick: Number(history.last_latest_tick ?? 0),
      },
    };
  });
}

function normalizeMatrixHotspots(matrix) {
  const hotspots = matrix?.hotspots && typeof matrix.hotspots === "object" ? matrix.hotspots : {};
  const topCharacters = Array.isArray(hotspots.top_characters)
    ? hotspots.top_characters.map((entry) => ({
        conflict_id: String(entry?.conflict_id || "").trim(),
        character_name: String(entry?.character_name || "").trim(),
        character_id: String(entry?.character_id || "").trim(),
        max_severity: String(entry?.max_severity || "").trim(),
        max_tier: Number(entry?.max_tier ?? 0),
        merged_player_field_count: Number(entry?.merged_player_field_count ?? 0),
        latest_tick: Number(entry?.latest_tick ?? 0),
      })).filter((entry) => entry.character_name || entry.character_id)
    : [];
  const reasonCodes = Array.isArray(hotspots.reason_codes)
    ? hotspots.reason_codes.map((entry) => ({
        reason_code: String(entry?.reason_code || "").trim(),
        count: Number(entry?.count ?? 0),
      })).filter((entry) => entry.reason_code && entry.count > 0)
    : [];
  const peers = Array.isArray(hotspots.peers)
    ? hotspots.peers.map((entry) => ({
        server_id: String(entry?.server_id || "").trim(),
        relation: String(entry?.relation || "").trim() || "equal",
        fresh: Boolean(entry?.fresh),
        tick_diff: Number(entry?.tick_diff ?? 0),
        reason: String(entry?.reason || "").trim(),
      })).filter((entry) => entry.server_id)
    : [];
  return {
    top_characters: topCharacters,
    reason_codes: reasonCodes,
    peers,
  };
}

function matrixConflictSourceLabels(matrix) {
  const labels = matrix?.last_conflict_log?.source_labels;
  if (labels && typeof labels === "object") return labels;
  return { preferred: "preferred", fallback: "fallback" };
}

function matrixConflictWinnerLabel(entry, matrix) {
  const sourceLabels = matrixConflictSourceLabels(matrix);
  const raw = String(entry?.winner || "").trim();
  return sourceLabels[raw] || raw || "unbekannt";
}

function matrixConflictGroupSummary(entry) {
  if (!Array.isArray(entry?.merged_field_groups) || !entry.merged_field_groups.length) {
    return "keine feldweisen Ergaenzungen";
  }
  return entry.merged_field_groups
    .map((group) => `${matrixConflictGroupLabel(group.group)} ${group.field_count ?? group.fields?.length ?? 0}`)
    .join(" · ");
}

function matrixConflictCompareHint(entry, matrix) {
  const winner = matrixConflictWinnerLabel(entry, matrix);
  if (!entry.merged_player_field_count) {
    return `Vergleich: ${winner} hat den Slot ohne zusaetzliche Feld-Merges gewonnen.`;
  }
  return `Vergleich: ${winner} fuehrt den Slot; ${matrixConflictGroupSummary(entry)} wurden dabei konservativ erhalten.`;
}

function matrixConflictImportHint(entry, matrix) {
  const winner = matrixConflictWinnerLabel(entry, matrix);
  const preferredRemote = Boolean(matrix?.health?.preferred_remote);
  if (winner === "remote" || (preferredRemote && String(entry?.winner || "") === "preferred")) {
    return "Import-Hinweis: Remote war hier fuehrend. Ein manueller Zusatzimport ist meist nur noch fuer tieferen Vergleich noetig, nicht fuer die bereits gemergten Felder.";
  }
  if (winner === "local") {
    return "Import-Hinweis: Lokal blieb fuehrend. Ein weiterer Import lohnt sich vor allem, wenn du einen aelteren Remote-Stand bewusst gegenpruefen willst.";
  }
  return "Import-Hinweis: Der Matrix-Merge hat den Konflikt bereits verarbeitet; nutze den Drilldown vor allem zum Nachvollziehen der uebernommenen Feldgruppen.";
}

function matrixConflictSideLabel(side, matrix) {
  const sourceLabels = matrixConflictSourceLabels(matrix);
  const raw = String(sourceLabels?.[side] || side || "").trim();
  if (side === "preferred") return `Bevorzugter Stand (${raw || "preferred"})`;
  if (side === "fallback") return `Gegenseite (${raw || "fallback"})`;
  return raw || side || "unbekannt";
}

function matrixConflictMergeModeLabel(mode) {
  if (mode === "union") return "Vereinigung";
  if (mode === "winner-plus-missing") return "Gewinner plus fehlende Werte";
  if (mode === "dedupe-tail") return "dedupliziertes Ende";
  if (mode === "max-per-key") return "Maximum pro Schluessel";
  if (mode === "winner") return "Winner-only";
  return mode || "unbekannt";
}

function matrixConflictSnapshotCountLabel(snapshot) {
  const count = Number(snapshot?.count ?? 0);
  if (snapshot?.kind === "coords") return `${count} Tile${count === 1 ? "" : "s"}`;
  if (snapshot?.kind === "resource-coords") return `${count} Ressourcenposition${count === 1 ? "" : "en"}`;
  if (snapshot?.kind === "strings") return `${count} Eintrag${count === 1 ? "" : "e"}`;
  if (snapshot?.kind === "mapping") return `${count} Schluessel`;
  return `${count} Wert${count === 1 ? "" : "e"}`;
}

function matrixConflictSnapshotResourceSummary(snapshot) {
  const resourceCounts = snapshot?.resource_counts && typeof snapshot.resource_counts === "object"
    ? snapshot.resource_counts
    : {};
  const entries = Object.entries(resourceCounts);
  if (!entries.length) return "";
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} ${value}`)
    .join(" · ");
}

function matrixConflictFieldComparisonHint(comparison, matrix) {
  const deltaSummary = comparison?.delta_summary || {};
  if (Number(deltaSummary.delta_count || 0) > 0) {
    return `Delta-Markierung: ${matrixConflictDeltaSummaryCompactText(comparison, deltaSummary, matrix)} wurden im Merge gegen den Gewinnerstand zusaetzlich erhalten.`;
  }
  if (comparison.merged_differs_from_preferred && comparison.merged_differs_from_fallback) {
    return "Das Ergebnis weicht von beiden Einzelstaenden ab und konserviert Inhalte aus beiden Seiten.";
  }
  if (comparison.merged_differs_from_preferred) {
    return "Das Ergebnis ergaenzt den fuehrenden Stand um fehlende Gegenwerte.";
  }
  if (comparison.merged_differs_from_fallback) {
    return "Das Ergebnis folgt weitgehend dem fuehrenden Stand; die Gegenseite brachte hier nichts Zusaetzliches ein.";
  }
  return "Das Ergebnis entspricht in diesem Feld bereits dem fuehrenden Stand.";
}

function matrixConflictDeltaSummaryCompactText(comparison, deltaSummary, matrix) {
  const winnerLabel = matrixConflictSideLabel(deltaSummary.winner_side || comparison.winner_side || "preferred", matrix);
  const parts = [];
  const addedCount = Number(deltaSummary.added_count || 0);
  const changedCount = Number(deltaSummary.changed_count || 0);
  if (addedCount > 0) parts.push(`neu ${addedCount}`);
  if (changedCount > 0) parts.push(`aktualisiert ${changedCount}`);
  if (!parts.length) parts.push(`Delta ${Number(deltaSummary.delta_count || 0)}`);
  return `${parts.join(" · ")} gegen ${winnerLabel}`;
}

function matrixConflictPrioritySymbol(deltaKind) {
  return deltaKind === "upgrade" ? "↑" : "+";
}

function matrixConflictPriorityLabel(deltaKind) {
  return deltaKind === "upgrade" ? "Upgrade" : "Plus";
}

function matrixConflictPriorityCategoryLabel(reasonCode) {
  const code = String(reasonCode || "").trim();
  const labels = {
    map_discovery: "Karte",
    journal: "Journal",
    inventory: "Inventar",
    inventory_valuable: "Wertvoll",
    inventory_upgrade: "Aufstockung",
    resource: "Ressource",
    resource_common: "Grund",
    resource_core: "Kern",
    resource_rare: "Selten",
    resource_premium: "Premium",
    poi: "POI",
    poi_civic: "Zivil",
    poi_strategic: "Strategie",
    poi_special: "Sonder-POI",
    poi_signature: "Signatur",
    progress: "Fortschritt",
    progress_routine: "Routine",
    progress_activity: "Aktivitaet",
    progress_social: "Sozial",
    progress_knowledge: "Wissen",
    progress_critical: "Kritisch",
    progress_quest: "Quest",
    progress_upgrade: "Upgrade",
  };
  return labels[code] || "";
}

function matrixConflictPriorityCategoryTone(reasonCode) {
  const code = String(reasonCode || "").trim();
  if (code.startsWith("progress_")) return "is-progress";
  if (code.startsWith("resource_")) return "is-resource";
  if (code.startsWith("poi_")) return "is-poi";
  if (code.startsWith("inventory")) return "is-inventory";
  if (code === "map_discovery") return "is-map";
  if (code === "journal") return "is-journal";
  return "";
}

function matrixConflictSeverityRank(severity) {
  const mapping = { critical: 4, high: 3, medium: 2, low: 1 };
  return mapping[String(severity || "").trim()] || 0;
}

function matrixConflictSeverityLabel(severity) {
  const labels = {
    critical: "Kritisch",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
  };
  return labels[String(severity || "").trim()] || "Unbekannt";
}

function matrixConflictSeverityTone(severity) {
  const normalized = String(severity || "").trim();
  return normalized ? `is-${normalized}` : "";
}

function matrixConflictReasonCodeLabel(reasonCode) {
  const categoryLabel = matrixConflictPriorityCategoryLabel(reasonCode);
  if (categoryLabel) return categoryLabel;
  return prettySlotLabel(reasonCode) || "Sonstiges";
}

function renderMatrixSeverityBadge(severity, count = 0) {
  const normalized = String(severity || "").trim();
  if (!normalized) return null;
  const badge = el(
    "span",
    `matrix-conflict-card__badge matrix-conflict-card__severity ${matrixConflictSeverityTone(normalized)}`.trim(),
    count > 0 ? `${matrixConflictSeverityLabel(normalized)} ${count}` : matrixConflictSeverityLabel(normalized),
  );
  return badge;
}

function renderMatrixCountSummaryRow(title, counts, labelFn, toneFn = null) {
  const normalized = normalizeMatrixCountMap(counts);
  if (!Object.keys(normalized).length) return null;
  const block = el("div", "stack");
  block.append(el("p", "small-head", title));
  const row = el("div", "matrix-conflict-card__badge-row");
  Object.entries(normalized)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || String(left[0]).localeCompare(String(right[0])))
    .forEach(([key, value]) => {
      const tone = typeof toneFn === "function" ? toneFn(key) : "";
      row.append(
        el(
          "span",
          tone ? `matrix-conflict-card__badge ${tone}` : "matrix-conflict-card__badge",
          `${labelFn(key)} ${value}`,
        ),
      );
    });
  block.append(row);
  return block;
}

function formatMatrixTimestamp(rawTs) {
  const ts = Number(rawTs);
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  try {
    return new Date(ts * 1000).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch (_) {
    return `ts ${Math.round(ts)}`;
  }
}

function matrixConflictHistorySummary(entry) {
  const history = entry?.history || {};
  if (!Number(history.seen_count || 0)) return "Neu im aktuellen Matrix-Zyklus.";
  const state = history.still_open ? "offen" : "geschlossen";
  return `Historie: ${state} · gesehen ${Number(history.seen_count || 0)}x · zuerst ${formatMatrixTimestamp(history.first_seen_ts)} · zuletzt ${formatMatrixTimestamp(history.last_seen_ts)}`;
}

function matrixConflictMatchesFilters(entry) {
  if (matrixConflictUiState.severity !== "all") {
    const severityKey = String(matrixConflictUiState.severity || "").trim();
    const severityCounts = normalizeMatrixCountMap(entry?.severity_counts);
    if (!Number(severityCounts[severityKey] || 0) && String(entry?.max_severity || "").trim() !== severityKey) {
      return false;
    }
  }
  if (matrixConflictUiState.reasonCode !== "all") {
    const reasonCode = String(matrixConflictUiState.reasonCode || "").trim();
    const reasonCounts = normalizeMatrixCountMap(entry?.reason_code_counts);
    if (!Number(reasonCounts[reasonCode] || 0)) {
      return false;
    }
  }
  if (matrixConflictUiState.onlyMerged && Number(entry?.merged_player_field_count || 0) <= 0) {
    return false;
  }
  return true;
}

function sortMatrixCharacterConflicts(entries) {
  const copy = [...entries];
  const sortMode = String(matrixConflictUiState.sortMode || "").trim() || "severity";
  copy.sort((left, right) => {
    if (sortMode === "recent") {
      return (
        Number(right.latest_updated_at_ts || 0) - Number(left.latest_updated_at_ts || 0)
        || Number(right.latest_tick || 0) - Number(left.latest_tick || 0)
        || Number(right.max_tier || 0) - Number(left.max_tier || 0)
        || String(left.character_name || left.character_id || "").localeCompare(String(right.character_name || right.character_id || ""))
      );
    }
    if (sortMode === "merged") {
      return (
        Number(right.merged_player_field_count || 0) - Number(left.merged_player_field_count || 0)
        || Number(right.field_comparison_count || 0) - Number(left.field_comparison_count || 0)
        || Number(right.max_tier || 0) - Number(left.max_tier || 0)
        || Number(right.latest_tick || 0) - Number(left.latest_tick || 0)
        || String(left.character_name || left.character_id || "").localeCompare(String(right.character_name || right.character_id || ""))
      );
    }
    return (
      Number(right.max_tier || 0) - Number(left.max_tier || 0)
      || Number(right.merged_player_field_count || 0) - Number(left.merged_player_field_count || 0)
      || Number(right.latest_tick || 0) - Number(left.latest_tick || 0)
      || String(left.character_name || left.character_id || "").localeCompare(String(right.character_name || right.character_id || ""))
    );
  });
  return copy;
}

function filteredMatrixCharacterConflicts(entries) {
  return sortMatrixCharacterConflicts(entries.filter((entry) => matrixConflictMatchesFilters(entry)));
}

function renderMatrixConflictPriorityPill(entry) {
  const deltaKind = String(entry?.delta_kind || "").trim() === "upgrade" ? "upgrade" : "plus";
  const reason = String(entry?.reason || "").trim();
  const reasonCode = String(entry?.reason_code || "").trim();
  const pill = el(
    "span",
    `matrix-conflict-card__priority-pill is-${deltaKind}`,
    `${matrixConflictPrioritySymbol(deltaKind)} ${entry?.label || ""}`,
  );
  pill.title = `${matrixConflictPriorityLabel(deltaKind)} · Gewicht ${Number(entry?.weight || 0)}${reasonCode ? ` · Schluessel ${reasonCode}` : ""}${reason ? ` · Grund ${reason}` : ""}`;
  return pill;
}

function renderMatrixConflictPriorityEntry(entry) {
  const card = el("div", "matrix-conflict-card__priority-entry");
  card.append(renderMatrixConflictPriorityPill(entry));
  const reason = String(entry?.reason || "").trim();
  const reasonCode = String(entry?.reason_code || "").trim();
  const severity = String(entry?.severity || "").trim();
  const categoryLabel = matrixConflictPriorityCategoryLabel(reasonCode);
  if (categoryLabel || reason || severity) {
    const meta = el("div", "matrix-conflict-card__priority-meta");
    const severityBadge = renderMatrixSeverityBadge(severity);
    if (severityBadge) meta.append(severityBadge);
    if (categoryLabel) {
      const tone = matrixConflictPriorityCategoryTone(reasonCode);
      meta.append(
        el(
          "span",
          tone ? `matrix-conflict-card__priority-category ${tone}` : "matrix-conflict-card__priority-category",
          categoryLabel,
        ),
      );
    }
    if (reason) {
      meta.append(el("span", "small matrix-conflict-card__priority-reason", `Grund: ${reason}`));
    }
    card.append(meta);
  }
  return card;
}

function renderMatrixPriorityOverflowSummary(deltaSummary) {
  const block = el("div", "stack");
  block.append(el("p", "small-head", "Verdeckte Rollups"));
  const overflow = Number(deltaSummary?.priority_overflow_count || 0);
  block.append(el("p", "small", `Weitere priorisierte Eintraege ${overflow}`));
  const severityRow = renderMatrixCountSummaryRow(
    "Schweregrade",
    deltaSummary?.hidden_priority_severity_counts,
    matrixConflictSeverityLabel,
    matrixConflictSeverityTone,
  );
  if (severityRow) block.append(severityRow);
  const reasonRow = renderMatrixCountSummaryRow(
    "Gruppen",
    deltaSummary?.hidden_priority_reason_code_counts,
    matrixConflictReasonCodeLabel,
    matrixConflictPriorityCategoryTone,
  );
  if (reasonRow) block.append(reasonRow);
  return block;
}

function renderMatrixConflictDeltaList(title, values) {
  const block = el("div", "matrix-conflict-card__delta-block");
  block.append(el("p", "small-head", title));
  const list = document.createElement("ul");
  list.className = "matrix-conflict-card__snapshot-list";
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  block.append(list);
  return block;
}

function renderMatrixConflictSnapshot(label, snapshot, tone = "") {
  const card = el("div", tone ? `matrix-conflict-card__snapshot ${tone}` : "matrix-conflict-card__snapshot");
  card.append(el("p", "small-head", label));
  card.append(el("p", "small", matrixConflictSnapshotCountLabel(snapshot)));
  const resourceSummary = matrixConflictSnapshotResourceSummary(snapshot);
  if (resourceSummary) {
    card.append(el("p", "small", `Ressourcen: ${resourceSummary}`));
  }
  const preview = Array.isArray(snapshot?.preview) ? snapshot.preview : [];
  if (preview.length) {
    const list = document.createElement("ul");
    list.className = "matrix-conflict-card__snapshot-list";
    preview.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      list.append(item);
    });
    card.append(list);
  } else {
    card.append(el("p", "small", "kein aussagekraeftiger Preview-Eintrag"));
  }
  if (snapshot?.truncated) {
    card.append(el("p", "small", "Preview gekuerzt"));
  }
  return card;
}

function renderMatrixFieldComparisonCard(comparison, matrix) {
  const card = el("div", "matrix-conflict-card__group matrix-conflict-card__comparison");
  const deltaSummary = comparison?.delta_summary || {};
  const head = el("div", "matrix-conflict-card__comparison-head");
  head.append(el("strong", "", matrixConflictFieldLabel(comparison.field)));
  head.append(
    el(
      "p",
      "small",
      `${matrixConflictGroupLabel(comparison.group)} · Merge-Modus ${matrixConflictMergeModeLabel(comparison.merge_mode)}`,
    ),
  );
  const badges = el("div", "matrix-conflict-card__badge-row");
  const severityBadge = renderMatrixSeverityBadge(comparison.max_severity, 0);
  if (severityBadge) {
    badges.append(severityBadge);
  }
  if (comparison.merged_differs_from_preferred) {
    badges.append(el("span", "matrix-conflict-card__badge", "abweichend zum Fuehrer"));
  }
  if (comparison.merged_differs_from_fallback) {
    badges.append(el("span", "matrix-conflict-card__badge", "abweichend zur Gegenseite"));
  }
  if (Number(deltaSummary.delta_count || 0) > 0) {
    badges.append(el("span", "matrix-conflict-card__badge is-delta", `Delta ${Number(deltaSummary.delta_count || 0)}`));
  }
  if (Number(deltaSummary.added_count || 0) > 0) {
    badges.append(el("span", "matrix-conflict-card__badge is-plus", `Plus ${Number(deltaSummary.added_count || 0)}`));
  }
  if (Number(deltaSummary.changed_count || 0) > 0) {
    badges.append(el("span", "matrix-conflict-card__badge is-upgrade", `Upgrade ${Number(deltaSummary.changed_count || 0)}`));
  }
  if (badges.childElementCount) {
    head.append(badges);
  }
  card.append(head);
  if (comparison.field_conflict_id) {
    card.append(el("p", "small", `Feld-Konflikt-ID: ${comparison.field_conflict_id}`));
  }

  const snapshotGrid = el("div", "matrix-conflict-card__snapshot-grid");
  snapshotGrid.append(renderMatrixConflictSnapshot(matrixConflictSideLabel("preferred", matrix), comparison.preferred));
  snapshotGrid.append(renderMatrixConflictSnapshot(matrixConflictSideLabel("fallback", matrix), comparison.fallback));
  snapshotGrid.append(renderMatrixConflictSnapshot("Gemergter Stand", comparison.merged, "is-merged"));
  card.append(snapshotGrid);
  if (Number(deltaSummary.delta_count || 0) > 0) {
    const deltaBlock = el("div", "matrix-conflict-card__delta stack");
    deltaBlock.append(
      el(
        "p",
        "small",
        `Kurz-Diff gegen ${matrixConflictSideLabel(deltaSummary.winner_side || comparison.winner_side || "preferred", matrix)}`,
      ),
    );
    if (Array.isArray(deltaSummary.priority_preview) && deltaSummary.priority_preview.length) {
      const priority = el("div", "stack");
      priority.append(el("p", "small-head", "Priorisiert"));
      const priorityRow = el("div", "matrix-conflict-card__priority-row");
      deltaSummary.priority_preview.forEach((entry) => {
        priorityRow.append(renderMatrixConflictPriorityEntry(entry));
      });
      priority.append(priorityRow);
      if (Number(deltaSummary.priority_overflow_count || 0) > 0) {
        priority.append(renderMatrixPriorityOverflowSummary(deltaSummary));
      }
      deltaBlock.append(priority);
    }
    if (Array.isArray(deltaSummary.added_preview) && deltaSummary.added_preview.length) {
      deltaBlock.append(renderMatrixConflictDeltaList("Neu erhalten", deltaSummary.added_preview));
    }
    if (Array.isArray(deltaSummary.changed_preview) && deltaSummary.changed_preview.length) {
      deltaBlock.append(renderMatrixConflictDeltaList("Angehoben / aktualisiert", deltaSummary.changed_preview));
    }
    if (deltaSummary.truncated) {
      deltaBlock.append(el("p", "small", "Kurz-Diff gekuerzt"));
    }
    const severitySummary = renderMatrixCountSummaryRow(
      "Delta-Schwere",
      deltaSummary.severity_counts,
      matrixConflictSeverityLabel,
      matrixConflictSeverityTone,
    );
    if (severitySummary) deltaBlock.append(severitySummary);
    const reasonSummary = renderMatrixCountSummaryRow(
      "Delta-Gruppen",
      deltaSummary.reason_code_counts,
      matrixConflictReasonCodeLabel,
      matrixConflictPriorityCategoryTone,
    );
    if (reasonSummary) deltaBlock.append(reasonSummary);
    card.append(deltaBlock);
  }
  card.append(el("p", "small", matrixConflictFieldComparisonHint(comparison, matrix)));
  return card;
}

function renderMatrixCharacterConflictCard(entry, matrix, index = 0) {
  const details = document.createElement("details");
  details.className = "matrix-conflict-card";
  if (index === 0) details.open = true;

  const summary = document.createElement("summary");
  summary.className = "matrix-conflict-card__summary";
  summary.append(el("strong", "", `${entry.character_name || entry.character_id || "Charakter"}`));
  summary.append(
    el(
      "span",
      "small",
      `Gewinner ${matrixConflictWinnerLabel(entry, matrix)} · Tick ${entry.preferred_tick ?? "—"}/${entry.fallback_tick ?? "—"} · Letztstand ${entry.latest_tick ?? 0}`,
    ),
  );
  summary.append(el("span", "small", `${entry.player_account_id || "account"}`));
  if (entry.max_severity) {
    const severityBadge = renderMatrixSeverityBadge(entry.max_severity);
    if (severityBadge) summary.append(severityBadge);
  }
  details.append(summary);

  const body = el("div", "matrix-conflict-card__body stack");
  body.append(el("p", "small", matrixConflictCompareHint(entry, matrix)));
  body.append(el("p", "small", matrixConflictImportHint(entry, matrix)));
  body.append(el("p", "small", matrixConflictHistorySummary(entry)));
  if (entry.conflict_id) {
    body.append(el("p", "small", `Konflikt-ID: ${entry.conflict_id}`));
  }
  body.append(
    el(
      "p",
      "small",
      `Letzte Aenderung ${formatMatrixTimestamp(entry.latest_updated_at_ts)} · Feldvergleiche ${Number(entry.field_comparison_count || 0)} · Feld-Merges ${Number(entry.merged_player_field_count || 0)}`,
    ),
  );
  const severitySummary = renderMatrixCountSummaryRow(
    "Schweregrad",
    entry.severity_counts,
    matrixConflictSeverityLabel,
    matrixConflictSeverityTone,
  );
  if (severitySummary) body.append(severitySummary);
  const reasonSummary = renderMatrixCountSummaryRow(
    "Priorisierte Gruppen",
    entry.reason_code_counts,
    matrixConflictReasonCodeLabel,
    matrixConflictPriorityCategoryTone,
  );
  if (reasonSummary) body.append(reasonSummary);
  const hiddenReasonSummary = renderMatrixCountSummaryRow(
    "Weitere verdeckte Gruppen",
    entry.hidden_priority_reason_code_counts,
    matrixConflictReasonCodeLabel,
    matrixConflictPriorityCategoryTone,
  );
  if (hiddenReasonSummary) body.append(hiddenReasonSummary);

  if (Array.isArray(entry.field_comparisons) && entry.field_comparisons.length) {
    const comparisons = el("div", "stack");
    comparisons.append(el("h4", "small-head", "Feldvergleich"));
    const comparisonGrid = el("div", "matrix-conflict-card__comparison-grid");
    entry.field_comparisons.forEach((comparison) => {
      comparisonGrid.append(renderMatrixFieldComparisonCard(comparison, matrix));
    });
    comparisons.append(comparisonGrid);
    body.append(comparisons);
  }

  if (Array.isArray(entry.merged_field_groups) && entry.merged_field_groups.length) {
    const groups = el("div", "stack");
    groups.append(el("h4", "small-head", "Merge-Gruppen"));
    entry.merged_field_groups.forEach((group) => {
      const card = el("div", "matrix-conflict-card__group");
      card.append(
        el(
          "p",
          "small",
          `${matrixConflictGroupLabel(group.group)} · ${group.field_count ?? group.fields?.length ?? 0} Feld${(group.field_count ?? group.fields?.length ?? 0) === 1 ? "" : "er"}`,
        ),
      );
      const list = document.createElement("ul");
      list.className = "matrix-conflict-card__field-list";
      (Array.isArray(group.fields) ? group.fields : []).forEach((field) => {
        const item = document.createElement("li");
        item.textContent = matrixConflictFieldLabel(field);
        list.append(item);
      });
      card.append(list);
      groups.append(card);
    });
    body.append(groups);
  } else if (!entry.field_comparisons?.length) {
    body.append(el("p", "small", "Dieser Konflikt war eine reine Winner-Entscheidung ohne zusaetzliche Feldlisten."));
  }

  details.append(body);
  return details;
}

function renderMatrixHealthControls(matrix, characterConflicts) {
  const controls = el("div", "matrix-health__controls");
  controls.append(el("h3", "", "Filter & Sortierung"));

  const filterRow = el("div", "matrix-health__filters");
  const severityWrap = el("label", "matrix-health__control");
  severityWrap.append(el("span", "small-head", "Schwere"));
  const severitySelect = document.createElement("select");
  severitySelect.className = "matrix-health__select";
  [
    ["all", "Alle"],
    ["critical", "Kritisch"],
    ["high", "Hoch"],
    ["medium", "Mittel"],
    ["low", "Niedrig"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (matrixConflictUiState.severity === value) option.selected = true;
    severitySelect.append(option);
  });
  severitySelect.addEventListener("change", (event) => {
    matrixConflictUiState.severity = String(event.target.value || "all");
    renderMatrixHealth(document.getElementById("matrix-panel"), matrix);
  });
  severityWrap.append(severitySelect);
  filterRow.append(severityWrap);

  const reasonWrap = el("label", "matrix-health__control");
  reasonWrap.append(el("span", "small-head", "Gruppe"));
  const reasonSelect = document.createElement("select");
  reasonSelect.className = "matrix-health__select";
  const reasonCounts = normalizeMatrixCountMap(matrix?.conflict_summary?.priority_reason_code_counts);
  const reasonCodes = new Set(Object.keys(reasonCounts));
  characterConflicts.forEach((entry) => {
    Object.keys(normalizeMatrixCountMap(entry.reason_code_counts)).forEach((reasonCode) => reasonCodes.add(reasonCode));
  });
  const reasonOptions = [
    ["all", "Alle"],
    ...Array.from(reasonCodes)
      .sort((left, right) => Number(reasonCounts[right] || 0) - Number(reasonCounts[left] || 0) || left.localeCompare(right))
      .map((reasonCode) => [reasonCode, matrixConflictReasonCodeLabel(reasonCode)]),
  ];
  reasonOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (matrixConflictUiState.reasonCode === value) option.selected = true;
    reasonSelect.append(option);
  });
  reasonSelect.addEventListener("change", (event) => {
    matrixConflictUiState.reasonCode = String(event.target.value || "all");
    renderMatrixHealth(document.getElementById("matrix-panel"), matrix);
  });
  reasonWrap.append(reasonSelect);
  filterRow.append(reasonWrap);

  const sortWrap = el("label", "matrix-health__control");
  sortWrap.append(el("span", "small-head", "Sortierung"));
  const sortSelect = document.createElement("select");
  sortSelect.className = "matrix-health__select";
  [
    ["severity", "Kritisch zuerst"],
    ["recent", "Neueste zuerst"],
    ["merged", "Meiste Merges zuerst"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (matrixConflictUiState.sortMode === value) option.selected = true;
    sortSelect.append(option);
  });
  sortSelect.addEventListener("change", (event) => {
    matrixConflictUiState.sortMode = String(event.target.value || "severity");
    renderMatrixHealth(document.getElementById("matrix-panel"), matrix);
  });
  sortWrap.append(sortSelect);
  filterRow.append(sortWrap);

  const toggleWrap = el("label", "matrix-health__toggle");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = Boolean(matrixConflictUiState.onlyMerged);
  toggle.addEventListener("change", (event) => {
    matrixConflictUiState.onlyMerged = Boolean(event.target.checked);
    renderMatrixHealth(document.getElementById("matrix-panel"), matrix);
  });
  toggleWrap.append(toggle);
  toggleWrap.append(el("span", "small", "nur Konflikte mit Feld-Merges"));
  filterRow.append(toggleWrap);

  controls.append(filterRow);
  return controls;
}

function renderMatrixHotspots(matrix, hotspots) {
  const hasContent = hotspots.top_characters.length || hotspots.reason_codes.length || hotspots.peers.length;
  if (!hasContent) return null;
  const section = el("div", "stack");
  section.append(el("h3", "", "Hotspots"));
  const grid = el("div", "matrix-health__hotspot-grid");

  if (hotspots.top_characters.length) {
    const card = el("div", "matrix-health__hotspot-card stack");
    card.append(el("h4", "small-head", "Kritischste Charaktere"));
    hotspots.top_characters.forEach((entry) => {
      const row = el("div", "matrix-health__hotspot-row");
      row.append(el("strong", "", entry.character_name || entry.character_id || "Charakter"));
      const meta = el("div", "matrix-conflict-card__badge-row");
      const severityBadge = renderMatrixSeverityBadge(entry.max_severity);
      if (severityBadge) meta.append(severityBadge);
      meta.append(el("span", "matrix-conflict-card__badge", `Feld-Merges ${Number(entry.merged_player_field_count || 0)}`));
      meta.append(el("span", "matrix-conflict-card__badge", `Tick ${Number(entry.latest_tick || 0)}`));
      row.append(meta);
      card.append(row);
    });
    grid.append(card);
  }

  if (hotspots.reason_codes.length) {
    const card = el("div", "matrix-health__hotspot-card stack");
    card.append(el("h4", "small-head", "Haeufigste Gruppen"));
    const row = el("div", "matrix-conflict-card__badge-row");
    hotspots.reason_codes.forEach((entry) => {
      const tone = matrixConflictPriorityCategoryTone(entry.reason_code);
      row.append(
        el(
          "span",
          tone ? `matrix-conflict-card__badge ${tone}` : "matrix-conflict-card__badge",
          `${matrixConflictReasonCodeLabel(entry.reason_code)} ${Number(entry.count || 0)}`,
        ),
      );
    });
    card.append(row);
    grid.append(card);
  }

  if (hotspots.peers.length) {
    const card = el("div", "matrix-health__hotspot-card stack");
    card.append(el("h4", "small-head", "Auffaellige Peers"));
    hotspots.peers.forEach((entry) => {
      card.append(
        el(
          "p",
          "small",
          `${entry.server_id} · ${entry.fresh ? "frisch" : "stale"} · ${entry.relation || entry.reason || "peer"} · Δ ${Number(entry.tick_diff || 0)}`,
        ),
      );
    });
    grid.append(card);
  }

  section.append(grid);
  return section;
}

function renderMatrixHealth(panel, matrix) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Servermatrix"));
  if (!matrix) {
    panel.append(el("p", "small", "Noch keine Matrix-Diagnostik geladen."));
    return;
  }
  if (matrix.available === false) {
    panel.append(el("p", "small feedback-warn", `Matrix-Diagnostik momentan nicht verfuegbar: ${matrix.message || "Endpunkt fehlt oder Backend ist nicht erreichbar."}`));
    panel.append(el("p", "small", "WWW laeuft weiter ueber denselben Gateway-/Recovery-Pfad, zeigt aber keine Peer-Matrix-Details an."));
    return;
  }

  const health = matrix.health || {};
  const local = matrix.local || {};
  const chosen = matrix.chosen || {};
  const conflictSummary = matrix.conflict_summary || {};
  const hotspots = normalizeMatrixHotspots(matrix);
  const conflicts = Array.isArray(matrix.conflicts) ? matrix.conflicts : [];
  const mergeConflicts = Array.isArray(matrix.last_merge_conflicts) ? matrix.last_merge_conflicts : [];
  const characterConflicts = normalizeMatrixCharacterConflicts(matrix, mergeConflicts);
  const visibleCharacterConflicts = filteredMatrixCharacterConflicts(characterConflicts);
  const healthTone = health.status === "healthy"
    ? "feedback-success"
    : (health.status === "disabled" || health.status === "degraded" || health.status === "isolated" || health.status === "syncing-needed"
      ? "feedback-warn"
      : "");

  panel.append(el("p", healthTone ? `small ${healthTone}` : "small", `Status: ${health.status || "unbekannt"} · Grund: ${health.reason || "—"}`));

  const metrics = el("div", "stack");
  metrics.append(el("p", "small", `Lokal: ${local.server_id || "—"} · Tick ${local.latest_tick ?? 0} · Grund ${local.reason || "—"}`));
  metrics.append(el("p", "small", `Bevorzugt: ${chosen.source || "local"} · ${chosen.server_id || "—"} · Tick ${chosen.latest_tick ?? 0}`));
  metrics.append(el("p", "small", `Peers: frisch ${health.fresh_peer_count ?? 0} · stale ${health.stale_peer_count ?? 0} · Merge-Konflikte ${health.merge_conflict_count ?? 0} · Char-Konflikte ${health.character_conflict_count ?? conflictSummary.character_conflict_count ?? characterConflicts.length}`));
  metrics.append(el("p", "small", `Feld-Merges: Charaktere ${health.characters_with_field_merges ?? conflictSummary.characters_with_field_merges ?? 0} · Felder ${health.field_merge_count ?? conflictSummary.field_merge_count ?? 0}`));
  const maxConflictSeverity = String(health.max_conflict_severity || conflictSummary.max_conflict_severity || "").trim();
  metrics.append(el("p", "small", `Kritisch: Charaktere ${health.critical_character_conflict_count ?? conflictSummary.critical_character_conflict_count ?? 0} · Maximum ${maxConflictSeverity ? matrixConflictSeverityLabel(maxConflictSeverity) : "—"}`));
  metrics.append(el("p", "small", `Letzter Sync: ${health.last_sync_result || "idle"} · Quelle ${health.last_sync_source || "—"} · Tick ${health.last_sync_tick ?? 0}`));
  if (conflictSummary.field_group_counts && Object.keys(conflictSummary.field_group_counts).length) {
    const groupText = Object.entries(conflictSummary.field_group_counts)
      .map(([group, count]) => `${matrixConflictGroupLabel(group)} ${count}`)
      .join(" · ");
    metrics.append(el("p", "small", `Merge-Gruppen: ${groupText}`));
  }
  const severitySummary = renderMatrixCountSummaryRow(
    "Charakter-Schwere",
    health.character_severity_counts || conflictSummary.character_severity_counts,
    matrixConflictSeverityLabel,
    matrixConflictSeverityTone,
  );
  if (severitySummary) metrics.append(severitySummary);
  const prioritySeveritySummary = renderMatrixCountSummaryRow(
    "Priorisierte Delta-Schwere",
    health.priority_severity_counts || conflictSummary.priority_severity_counts,
    matrixConflictSeverityLabel,
    matrixConflictSeverityTone,
  );
  if (prioritySeveritySummary) metrics.append(prioritySeveritySummary);
  panel.append(metrics);

  const hotspotSection = renderMatrixHotspots(matrix, hotspots);
  if (hotspotSection) panel.append(hotspotSection);

  if (characterConflicts.length) {
    panel.append(renderMatrixHealthControls(matrix, characterConflicts));
    panel.append(
      el(
        "p",
        "small",
        `Gefiltert sichtbar ${visibleCharacterConflicts.length} von ${characterConflicts.length} Charakter-Konflikten.`,
      ),
    );
  }

  if (conflicts.length) {
    const list = el("div", "stack");
    list.append(el("h3", "", "Peer-Lage"));
    conflicts.slice(0, 8).forEach((entry) => {
      const marker = [
        entry.preferred ? "bevorzugt" : "",
        entry.fresh ? "frisch" : "stale",
        entry.reason || "",
      ].filter(Boolean).join(" · ");
      list.append(
        el(
          "p",
          "small",
          `${entry.server_id || entry.source || "peer"} · ${entry.relation || "equal"} · Tick ${entry.latest_tick ?? 0} · Δ ${entry.tick_diff ?? "—"}${marker ? ` · ${marker}` : ""}`,
        ),
      );
    });
    panel.append(list);
  }

  if (characterConflicts.length) {
    const characterList = el("div", "stack");
    characterList.append(el("h3", "", "Betroffene Charaktere"));
    visibleCharacterConflicts.slice(0, 12).forEach((entry) => {
      characterList.append(renderMatrixCharacterConflictCard(entry, matrix, characterList.childElementCount - 1));
    });
    if (!visibleCharacterConflicts.length) {
      characterList.append(el("p", "small", "Die aktuellen Filter blenden gerade alle Character-Konflikte aus."));
    }
    panel.append(characterList);
  }

  const nonCharacterMergeConflicts = mergeConflicts.filter((entry) => entry.scope !== "character");
  if (nonCharacterMergeConflicts.length) {
    const mergeList = el("div", "stack");
    mergeList.append(el("h3", "", "Weitere Merge-Konflikte"));
    nonCharacterMergeConflicts.slice(0, 6).forEach((entry) => {
      if (entry.scope === "active-character") {
        mergeList.append(
          el(
            "p",
            "small",
            `${entry.player_account_id || "account"} · aktiver Charakter divergiert · Gewinner ${entry.winner || "—"} · ${entry.preferred_character_id || "—"} vs ${entry.fallback_character_id || "—"}`,
          ),
        );
        return;
      }
      mergeList.append(el("p", "small", JSON.stringify(entry)));
    });
    panel.append(mergeList);
  } else if (!characterConflicts.length) {
    panel.append(el("p", "small", "Keine letzten Matrix-Merge-Konflikte bekannt."));
  }
}

function renderWeatherMap(panel, weatherMap, regions) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Wetterkarte"));
  if (!weatherMap?.rows?.length) {
    panel.append(el("p", "", "Keine Wetterdaten."));
    return;
  }
  const grid = el("div", "weather-grid");
  weatherMap.rows.flat().forEach((cell) => {
    const node = el("div", `weather-cell ${cell.hazard ? 'hazard' : ''} ${cell.front_here ? 'front-here' : ''}`);
    node.append(el("strong", "", cell.current ? `★ ${cell.label}` : cell.label));
    node.append(el("span", "small", `${cell.weather_label} · ${cell.biome}`));
    if (cell.fronts_here?.length) node.append(el("span", "small", `Front: ${cell.fronts_here.join(', ')}`));
    node.append(el("span", "small", `${cell.x},${cell.y}`));
    grid.append(node);
  });
  panel.append(grid);
  if (weatherMap?.fronts?.length) {
    const fronts = el('div', 'stack');
    fronts.append(el('h3', '', 'Wetterfronten'));
    weatherMap.fronts.forEach((front) => fronts.append(el('p', 'small', `${front.label} · ${front.name} · Zentrum ${front.x},${front.y} · Vektor ${front.velocity.x},${front.velocity.y} · Radius ${front.radius}`)));
    panel.append(fronts);
  }
  if (weatherRegions?.regions?.length) {
    const reg = el('div', 'stack');
    reg.append(el('h3', '', 'Regionale Fronten'));
    weatherRegions.regions.forEach((entry) => reg.append(el('p', 'small', `${entry.label} · ${entry.outlook} · Stärke ${entry.severity}${entry.fronts?.length ? ' · ' + entry.fronts.join(', ') : ''}`)));
    panel.append(reg);
  }
}

function renderAssets(panel, status, inventory, combat, city, mapTiles) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Asset-Browser"));
  const grid = el("div", "inventory-grid");
  grid.append(cardSprite(status.media_file, "Aktuelle Szene"));
  inventory.slice(0, 8).forEach((entry) => grid.append(cardSprite(entry.sprite, entry.item_name)));
  combat.forEach((enemy) => grid.append(cardSprite(enemy.sprite, enemy.enemy_name)));
  mapTiles.filter((tile) => tile.building).slice(0, 6).forEach((tile) => grid.append(cardSprite(tile.sprite, `${tile.label} · ${tile.building}`)));
  panel.append(grid);
}

// Sperrt lokale Schreib-Widgets im WWW, sobald die Sitzung nur noch Beobachter ist.
function applyControlLocks(status, commandDetails = []) {
  const canWrite = controlWriteAllowed(status);
  const createButton = document.getElementById("character-create");
  const rosterRefresh = document.getElementById("roster-refresh");
  const recoverButton = document.getElementById("recover-live");
  const saveButton = document.getElementById("save-request");
  if (createButton) createButton.disabled = !canWrite;
  if (recoverButton) recoverButton.disabled = !canWrite;
  if (saveButton) saveButton.disabled = !canWrite;
  if (rosterRefresh) rosterRefresh.disabled = false;
  document.querySelectorAll("#character-create-form input, #character-create-form select").forEach((node) => {
    node.disabled = !canWrite;
  });
  applyCommandTooltips(commandDetails, status);
  updateCommandComposerState();
}

// Schaltet den WWW-Senden-Button dynamisch ab, wenn ein Beobachter gerade ein Schreibkommando tippt.
function updateCommandComposerState() {
  const input = document.getElementById("command-input");
  const runButton = document.getElementById("run-command");
  if (!input || !runButton) return;
  const blocked = !controlWriteAllowed(latestSnapshot?.status) && !isObserverSafeCommand(input.value || "", latestSnapshot?.command_details || []);
  runButton.disabled = blocked;
  runButton.title = blocked ? "Beobachter duerfen diesen Befehl erst nach explizitem Takeover senden." : "";
}

function renderSnapshot(
  snapshot,
  weatherMap = null,
  recoveryConflicts = null,
  recoveryHistory = null,
  weatherRegions = null,
  matrixHealthState = null,
) {
  latestSnapshot = snapshot;
  rememberLiveCursor(snapshot);
  syncTopbarMeta(snapshot.status);
  renderStatus(document.getElementById("status-panel"), snapshot.status, snapshot.message);
  renderScene(document.getElementById("scene-panel"), snapshot.status);
  renderMap(document.getElementById("map-panel"), snapshot.map_tiles);
  renderCharacter(document.getElementById("character-panel"), snapshot.status, snapshot.equipment, snapshot.buffs);
  renderInventory(document.getElementById("inventory-panel"), snapshot.inventory);
  renderMarket(document.getElementById("market-panel"), snapshot.market);
  renderCombat(document.getElementById("combat-panel"), snapshot.combat, snapshot.status);
  renderCity(document.getElementById("city-panel"), snapshot.city);
  renderJournal(document.getElementById("journal-panel"), snapshot.journal);
  renderCommands(document.getElementById("command-panel"), snapshot.commands, snapshot.command_details || [], snapshot.status);
  renderAssets(document.getElementById("asset-panel"), snapshot.status, snapshot.inventory, snapshot.combat, snapshot.city, snapshot.map_tiles);
  renderWeatherMap(document.getElementById('weather-panel'), weatherMap, weatherRegions);
  renderMatrixHealth(document.getElementById('matrix-panel'), matrixHealthState);
  renderRecovery(document.getElementById('recovery-panel'), recoveryConflicts, recoveryHistory);
  renderNPCs(document.getElementById('npc-panel'), npcs, npcMenu);
  renderSocialCatalog(document.getElementById('catalog-panel'), socialCatalog);
  renderBrewing(document.getElementById('brew-panel'), brewingCatalog);
  renderEnchanting(document.getElementById('enchant-panel'), enchantingCatalog);
  renderArtifactWeave(document.getElementById('weave-panel'), artifactWeave);
  renderCharacterRoster(characterRoster, snapshot.status);
  applyControlLocks(snapshot.status, snapshot.command_details || []);
  if (uiModules?.particleLayer?.syncParticleLayer) {
    void uiModules.particleLayer.syncParticleLayer("particle-layer", snapshot.status, weatherMap);
  }
}

// Haelt die lokalen Session-Identitaetsdaten synchron zum zuletzt gerenderten serverseitigen Snapshot.
function persistSnapshotIdentity(snapshot) {
  writeIdentity({
    playerAccountId: snapshot?.status?.player_account_id || readIdentity().playerAccountId,
    deviceId: readIdentity().deviceId,
    characterName: snapshot?.status?.character_name || readIdentity().characterName,
  });
}

// Laedt die querliegenden WWW-Panels nur bei Bedarf nach, waehrend der Kernzustand bereits per Live-Snapshot kommt.
async function refreshAuxiliaryState() {
  const [
    freshWeatherMap,
    freshRecovery,
    freshHistory,
    freshRegions,
    freshMatrixHealth,
    freshNpcs,
    freshSocialCatalog,
    freshBrewing,
    freshEnchanting,
    freshWeave,
    freshRoster,
  ] = await Promise.all([
    fetchJson('/api/weather/map?radius=6'),
    fetchJson('/api/recovery/conflicts'),
    fetchJson('/api/recovery/history'),
    fetchJson('/api/weather/regions'),
    fetchOptionalJson('/api/matrix/health'),
    fetchJson('/api/npcs'),
    fetchOptionalJson('/api/social/catalog'),
    fetchJson('/api/brewing/catalog'),
    fetchJson('/api/enchanting/catalog'),
    fetchJson('/api/artifact/weave'),
    fetchJson('/api/characters')
  ]);
  weatherMap = freshWeatherMap;
  recoveryConflicts = freshRecovery;
  recoveryHistory = freshHistory;
  weatherRegions = freshRegions;
  matrixHealth = freshMatrixHealth;
  npcs = freshNpcs;
  socialCatalog = freshSocialCatalog;
  brewingCatalog = freshBrewing;
  enchantingCatalog = freshEnchanting;
  artifactWeave = freshWeave;
  characterRoster = freshRoster;
  if (!npcMenu && freshNpcs?.entries?.length) {
    try { npcMenu = await fetchJson(`/api/npcs/menu?name=${encodeURIComponent(freshNpcs.entries[0].name)}`); } catch (_) {}
  }
}

// Rendert einen vollen Snapshot inklusive Identitaetssync und optionalem UI-Feedback in einer Stelle.
function applySnapshot(snapshot, messageOverride = null, feedbackTone = "") {
  persistSnapshotIdentity(snapshot);
  if (messageOverride) snapshot.message = messageOverride;
  renderSnapshot(snapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions, matrixHealth);
  if (messageOverride && feedbackTone) setRosterFeedback(messageOverride, feedbackTone);
}

// Plant einen entkoppelten Nachzug der Zusatzpanels ein, damit Live-Snapshots sofort sichtbar werden und Restdaten ruhig folgen.
function scheduleAuxiliaryRefresh() {
  if (liveAuxiliaryRefreshHandle) window.clearTimeout(liveAuxiliaryRefreshHandle);
  liveAuxiliaryRefreshHandle = window.setTimeout(async () => {
    liveAuxiliaryRefreshHandle = null;
    try {
      await ensureSession();
      await refreshAuxiliaryState();
      if (latestSnapshot) renderSnapshot(latestSnapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions, matrixHealth);
    } catch (error) {
      setLiveConnectionState("fallback");
      renderGatewayError(`Zusatzansichten konnten nicht aktualisiert werden: ${error.message}`);
    }
  }, 120);
}

async function switchCharacter(characterId) {
  try {
    await ensureSession();
    if (guardObserverWrite(latestSnapshot?.status, "Charakterwechsel")) return;
    const result = await fetchJson('/api/character/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: characterId }),
    });
    await loadState(result.message || 'Aktiver Charakter gewechselt.');
  } catch (error) {
    setRosterFeedback(`Charakterwechsel fehlgeschlagen: ${error.message}`, 'feedback-error');
  }
}

async function createCharacterFromForm(event) {
  event.preventDefault();
  const remaining = syncAttributeBudget();
  const payload = characterPayloadFromForm();
  if (guardObserverWrite(latestSnapshot?.status, "Charaktererstellung")) return;
  if (!payload.character_name) {
    setRosterFeedback('Bitte zuerst einen Charakternamen eingeben.', 'feedback-error');
    return;
  }
  if (remaining < 0) {
    setRosterFeedback('Zu viele Attributpunkte vergeben. Maximal 12 Bonuspunkte sind erlaubt.', 'feedback-error');
    return;
  }
  try {
    await ensureSession();
    const result = await fetchJson('/api/character/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      setRosterFeedback(result.message || 'Charakter konnte nicht erstellt werden.', 'feedback-error');
      return;
    }
    await loadState(result.message || `Charakter ${result.character_name || payload.character_name} erstellt.`);
  } catch (error) {
    setRosterFeedback(`Charaktererstellung fehlgeschlagen: ${error.message}`, 'feedback-error');
  }
}

// Uebernimmt die aktive Steuerung explizit fuer die aktuelle Web-Sitzung.
async function takeControl() {
  try {
    await ensureSession();
    const result = await fetchJson('/api/control/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'www-manual-takeover' }),
    });
    await loadState(result.message || 'Steuerung uebernommen.');
  } catch (error) {
    setRosterFeedback(`Steuerungsuebernahme fehlgeschlagen: ${error.message}`, 'feedback-error');
  }
}

// Gibt die aktive Steuerung wieder frei, damit eine andere Sitzung kontrolliert uebernehmen kann.
async function releaseControl() {
  try {
    await ensureSession();
    const result = await fetchJson('/api/control/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await loadState(result.message || 'Steuerung freigegeben.');
  } catch (error) {
    setRosterFeedback(`Steuerungsfreigabe fehlgeschlagen: ${error.message}`, 'feedback-error');
  }
}

async function loadState(messageOverride = null) {
  try {
    await ensureSession();
    const snapshot = await fetchJson('/api/state');
    await refreshAuxiliaryState();
    applySnapshot(snapshot, messageOverride, messageOverride ? 'feedback-success' : '');
  } catch (error) {
    sessionReady = false;
    setLiveConnectionState("offline");
    renderGatewayError(`ShellRPG-server aktuell nicht erreichbar: ${error.message}`);
  }
}

// Sendet ein Kommando ueber den WWW-Gateway und spiegelt Konflikte des Rollenmodells sichtbar in die UI zurueck.
async function sendCommand(command) {
  try {
    await ensureSession();
    if (guardObserverWrite(latestSnapshot?.status, command, command)) return;
    const payload = JSON.stringify({ command });
    const snapshot = await fetchJson('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    applySnapshot(snapshot);
    scheduleAuxiliaryRefresh();
    if (snapshot.control_conflict) {
      setRosterFeedback(snapshot.message || 'Steuerungskonflikt erkannt.', 'feedback-warn');
    } else {
      setRosterFeedback(snapshot.message || 'Kommando an den autoritativen Server zugestellt.', 'feedback-success');
    }
  } catch (error) {
    sessionReady = false;
    setLiveConnectionState("offline");
    renderGatewayError(`Kommando konnte nicht an den privaten Server zugestellt werden: ${error.message}`);
  }
}

// Beendet eine bestehende EventSource sauber, damit Sprachwechsel oder Reconnects keine Doppelstreams erzeugen.
function stopLiveUpdates() {
  if (liveReconnectHandle) {
    window.clearTimeout(liveReconnectHandle);
    liveReconnectHandle = null;
  }
  if (liveEventSource) {
    liveEventSource.close();
    liveEventSource = null;
  }
}

// Plant einen ruhigen Reconnect ein und laesst bis dahin den manuellen Fallback-Refresh aktiv.
function scheduleLiveReconnect() {
  if (liveReconnectHandle) return;
  setLiveConnectionState("fallback");
  liveReconnectHandle = window.setTimeout(async () => {
    liveReconnectHandle = null;
    try {
      await loadState();
    } catch (_) {}
    await startLiveUpdates();
  }, 2000);
}

// Verarbeitet serverseitige Live-Snapshots dedupliziert und zieht Zusatzpanels asynchron nach.
function consumeLiveEvent(eventPayload) {
  const eventId = Number(eventPayload?.event_id || 0);
  if (eventId <= liveEventCursor) return;
  if (!eventPayload?.snapshot) return;
  setLiveConnectionState("live");
  applySnapshot(eventPayload.snapshot);
  scheduleAuxiliaryRefresh();
}

// Baut die gleiche Charaktersicht ueber einen same-origin SSE-Kanal auf und faellt bei Fehlern kontrolliert zurueck.
async function startLiveUpdates() {
  try {
    if (!window.EventSource) {
      setLiveConnectionState("fallback");
      return;
    }
    await ensureSession();
    if (liveEventSource) return;
    setLiveConnectionState("connecting");
    const source = new EventSource(`/api/events?lang=${encodeURIComponent(currentLang)}&after=${liveEventCursor}`);
    liveEventSource = source;
    source.addEventListener("snapshot", (event) => {
      try {
        consumeLiveEvent(JSON.parse(event.data));
      } catch (_) {}
    });
    source.onmessage = (event) => {
      try {
        consumeLiveEvent(JSON.parse(event.data));
      } catch (_) {}
    };
    source.onerror = () => {
      if (liveEventSource !== source) return;
      source.close();
      liveEventSource = null;
      scheduleLiveReconnect();
    };
  } catch (_) {
    scheduleLiveReconnect();
  }
}

// Initialisiert die WWW-Oberflaeche erst nach Modul-Load, damit Layout, Partikel und Live-Daten geordnet starten.
async function bootstrap() {
  await loadUiModules();
  if (uiModules?.particleLayer?.initializeParticleLayer) {
    await uiModules.particleLayer.initializeParticleLayer("particle-layer");
  }

  initializeCharacterForm();

  const commandInput = document.getElementById("command-input");
  const characterForm = document.getElementById("character-create-form");
  const rosterRefresh = document.getElementById("roster-refresh");
  const runButton = document.getElementById("run-command");
  const refreshButton = document.getElementById("refresh-all");
  const langDe = document.getElementById("lang-de");
  const langEn = document.getElementById("lang-en");
  const recoverButton = document.getElementById("recover-live");
  const saveButton = document.getElementById("save-request");

  if (runButton && commandInput) runButton.addEventListener("click", () => sendCommand(commandInput.value));
  if (refreshButton) refreshButton.addEventListener("click", () => loadState("Ansichten aktualisiert."));
  if (characterForm) characterForm.addEventListener("submit", createCharacterFromForm);
  if (rosterRefresh) rosterRefresh.addEventListener("click", () => loadState("Charakterliste aktualisiert."));
  if (recoverButton) recoverButton.addEventListener("click", async () => {
    if (guardObserverWrite(latestSnapshot?.status, "Live-Recover")) return;
    await fetchJson('/api/recover/live', {method:'POST', headers:{'Content-Type': 'application/json'}, body:'{}'});
    await loadState('Live-Recover ausgeführt.');
  });
  if (langDe) langDe.addEventListener("click", async () => {
    currentLang = "de";
    stopLiveUpdates();
    await sendCommand("lang de");
    await startLiveUpdates();
  });
  if (langEn) langEn.addEventListener("click", async () => {
    currentLang = "en";
    stopLiveUpdates();
    await sendCommand("lang en");
    await startLiveUpdates();
  });
  if (commandInput) {
    commandInput.addEventListener("input", () => updateCommandComposerState());
    commandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendCommand(commandInput.value);
      }
    });
  }
  document.querySelectorAll(".quick-action").forEach((button) => {
    button.addEventListener("click", () => sendCommand(button.dataset.command));
  });
  if (saveButton) saveButton.addEventListener('click', async () => {
    if (guardObserverWrite(latestSnapshot?.status, "Safe Save")) return;
    await fetchJson('/api/save/request', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    await loadState('Safe-Save beim Server angefragt.');
  });

  await loadState("Phase v0.8.0 geladen: map-first Dark-Fantasy-Interface aktiv.");
  await startLiveUpdates();
  updateCommandComposerState();
}

if (typeof document !== "undefined") {
  void bootstrap();
}
