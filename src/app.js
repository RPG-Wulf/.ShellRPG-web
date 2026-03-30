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
let npcs = null;
let npcMenu = null;
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
  const actions = el("div", "controls-row");
  ["attack", "guard", "dodge", "cast soul trap"].forEach((cmd) => {
    const b = el("button", "small-button", cmd);
    b.type = "button";
    b.addEventListener("click", () => sendCommand(cmd));
    actions.append(b);
  });
  panel.append(actions);
  panel.append(el("p", "small", `Reaktionsfenster: ${status.reaction_seconds_left || 0}s`));
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
  const blocks = [
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
        row.append(el("span", "small", `${entry.label} · ${entry.price_silver}s`));
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

function renderSnapshot(snapshot, weatherMap = null, recoveryConflicts = null, recoveryHistory = null, weatherRegions = null) {
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
  renderRecovery(document.getElementById('recovery-panel'), recoveryConflicts, recoveryHistory);
  renderNPCs(document.getElementById('npc-panel'), npcs, npcMenu);
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
  const [freshWeatherMap, freshRecovery, freshHistory, freshRegions, freshNpcs, freshBrewing, freshEnchanting, freshWeave, freshRoster] = await Promise.all([
    fetchJson('/api/weather/map?radius=6'),
    fetchJson('/api/recovery/conflicts'),
    fetchJson('/api/recovery/history'),
    fetchJson('/api/weather/regions'),
    fetchJson('/api/npcs'),
    fetchJson('/api/brewing/catalog'),
    fetchJson('/api/enchanting/catalog'),
    fetchJson('/api/artifact/weave'),
    fetchJson('/api/characters')
  ]);
  weatherMap = freshWeatherMap;
  recoveryConflicts = freshRecovery;
  recoveryHistory = freshHistory;
  weatherRegions = freshRegions;
  npcs = freshNpcs;
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
  renderSnapshot(snapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions);
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
      if (latestSnapshot) renderSnapshot(latestSnapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions);
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

  await loadState("Phase v0.7.6 geladen: map-first Dark-Fantasy-Interface aktiv.");
  await startLiveUpdates();
  updateCommandComposerState();
}

if (typeof document !== "undefined") {
  void bootstrap();
}
