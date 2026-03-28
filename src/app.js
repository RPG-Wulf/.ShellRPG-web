const API_BASE = "";
const STORAGE_KEYS = {
  accountId: "shellrpg_player_account_id",
  deviceId: "shellrpg_browser_device_id",
  characterName: "shellrpg_character_name",
};
let currentLang = "de";
let pollingHandle = null;
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

function renderGatewayError(message) {
  const statusPanel = document.getElementById("status-panel");
  statusPanel.innerHTML = "";
  statusPanel.append(el("h2", "", "Gateway-Verbindung"));
  statusPanel.append(el("p", "status-message", message));
  setRosterFeedback(message, "feedback-error");
}

function cardSprite(src, label) {
  const wrap = el("div", "sprite-card");
  const img = document.createElement("img");
  img.src = src;
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
    switchButton.disabled = !!entry.active;
    switchButton.addEventListener("click", () => switchCharacter(entry.character_id));
    controls.append(switchButton);
    card.append(controls);
    list.append(card);
  });
}

function renderStatus(panel, status, message) {
  panel.innerHTML = "";
  const top = el("div", "status-top");
  top.append(el("h2", "", `${status.character_name} · ${status.class_name}/${status.race_name}`));
  top.append(el("p", "status-message", message || status.overlay_message));
  panel.append(top);

  const stats = el("div", "status-grid");
  [
    ["Ort", `${status.location_label} [${status.coords_label}]`],
    ["HP", `${status.hp_current}/${status.hp_max}`],
    ["MP", `${status.mana_current}/${status.mana_max}`],
    ["Tick", `${status.tick_value}`],
    ["Silber/Gold", `${status.silver}s / ${status.gold}g`],
    ["Hunger", status.hunger],
    ["Aktion", status.active_action],
    ["Wetter", status.weather_label || "—"],
    ["Zeit", status.time_label || "—"],
    ["Mond", status.moon_label || "—"],
    ["Venus", status.venus_label || "—"],
    ["Auto-Battle", `${status.auto_battle_enabled ? "an" : "aus"} (${status.auto_battle_mode})`],
  ].forEach(([k,v]) => {
    const box = el("div", "stat-box");
    box.append(el("span", "stat-k", k));
    box.append(el("span", "stat-v", v));
    stats.append(box);
  });
  panel.append(stats);

  if (status.faction_tension) panel.append(el("p", "tension", status.faction_tension));
  if (status.server_id) panel.append(el("p", "small", `Server: ${status.server_id} · Kalender: ${status.calendar_source || 'local'}`));
  if (status.player_account_id) panel.append(el("p", "small", `Account: ${status.player_account_id}`));
  if (status.combat_choices?.length) panel.append(el("p", "choices", `Reaktionsfenster: ${status.combat_choices.join(", ")}`));
}

function renderScene(panel, status) {
  panel.innerHTML = "";
  const hero = el("div", "scene-frame");
  hero.style.backgroundImage = `linear-gradient(135deg, rgba(8,8,14,.55), rgba(8,8,14,.1)), url('${status.media_file}')`;
  hero.append(el("div", "scene-caption", status.overlay_message));
  panel.append(hero);
}

function renderMap(panel, mapTiles) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Weltkarte"));
  const grid = el("div", "map-grid");
  mapTiles.forEach((tile) => {
    const node = el("button", `map-tile state-${tile.visibility_state}`);
    node.type = "button";
    if (tile.visibility_state !== "unknown") {
      node.style.backgroundImage = `linear-gradient(135deg, rgba(10,10,14,.15), rgba(10,10,14,.55)), url('${tile.sprite}')`;
      node.append(el("span", "map-label", tile.label));
      node.append(el("span", "map-meta", `${tile.biome} · ${tile.terrain}`));
      if (tile.building) node.append(el("span", "map-building", tile.building));
      node.addEventListener("click", () => {
        document.getElementById("command-input").value = `walk ${tile.coords_label}`;
      });
    } else {
      node.append(el("span", "map-label", "Unkartiert"));
    }
    if (tile.is_current) node.classList.add("is-current");
    grid.append(node);
  });
  panel.append(grid);
  if (weatherMap?.fronts?.length) {
    const fronts = el('div', 'stack');
    fronts.append(el('h3', '', 'Wetterfronten'));
    weatherMap.fronts.forEach((front) => fronts.append(el('p', 'small', `${front.label} · ${front.name} · Zentrum ${front.x},${front.y} · Radius ${front.radius}`)));
    panel.append(fronts);
  }
}


function renderCharacter(panel, status, equipment, buffs) {
  panel.innerHTML = "";
  panel.append(el("h2", "", "Charakter"));
  const list = el("div", "stack");
  list.append(el("p", "", `Level ${status.level}`));
  list.append(el("p", "", `Dialogmodus: ${status.dialogue_mode ? status.dialogue_target : "nein"}`));
  if (equipment?.length) {
    const wrap = el("div", "sprite-row");
    equipment.forEach((entry) => wrap.append(cardSprite(entry.sprite, `${entry.slot}: ${entry.item_name}`)));
    list.append(wrap);
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

function renderCommands(panel, commands, commandDetails = []) {
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
    card.addEventListener("click", () => {
      document.getElementById("command-input").value = entry.usage;
    });
    card.append(el("strong", "", entry.usage));
    if (entry.summary) card.append(el("span", "small", entry.summary));
    list.append(card);
  });
  panel.append(list);
}

function applyCommandTooltips(commandDetails = []) {
  document.querySelectorAll(".quick-action").forEach((button) => {
    const detail = findCommandDetail(commandDetails, button.dataset.command || "");
    if (!detail) return;
    button.title = [detail.usage, detail.summary, detail.details].filter(Boolean).join("\n\n");
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

function renderSnapshot(snapshot, weatherMap = null, recoveryConflicts = null, recoveryHistory = null, weatherRegions = null) {
  renderStatus(document.getElementById("status-panel"), snapshot.status, snapshot.message);
  renderScene(document.getElementById("scene-panel"), snapshot.status);
  renderMap(document.getElementById("map-panel"), snapshot.map_tiles);
  renderCharacter(document.getElementById("character-panel"), snapshot.status, snapshot.equipment, snapshot.buffs);
  renderInventory(document.getElementById("inventory-panel"), snapshot.inventory);
  renderMarket(document.getElementById("market-panel"), snapshot.market);
  renderCombat(document.getElementById("combat-panel"), snapshot.combat, snapshot.status);
  renderCity(document.getElementById("city-panel"), snapshot.city);
  renderJournal(document.getElementById("journal-panel"), snapshot.journal);
  renderCommands(document.getElementById("command-panel"), snapshot.commands, snapshot.command_details || []);
  renderAssets(document.getElementById("asset-panel"), snapshot.status, snapshot.inventory, snapshot.combat, snapshot.city, snapshot.map_tiles);
  renderWeatherMap(document.getElementById('weather-panel'), weatherMap, weatherRegions);
  renderRecovery(document.getElementById('recovery-panel'), recoveryConflicts, recoveryHistory);
  renderNPCs(document.getElementById('npc-panel'), npcs, npcMenu);
  renderBrewing(document.getElementById('brew-panel'), brewingCatalog);
  renderEnchanting(document.getElementById('enchant-panel'), enchantingCatalog);
  renderArtifactWeave(document.getElementById('weave-panel'), artifactWeave);
  renderCharacterRoster(characterRoster, snapshot.status);
  applyCommandTooltips(snapshot.command_details || []);
}

async function switchCharacter(characterId) {
  try {
    await ensureSession();
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

async function loadState(messageOverride = null) {
  try {
    await ensureSession();
    const [snapshot, freshWeatherMap, freshRecovery, freshHistory, freshRegions, freshNpcs, freshBrewing, freshEnchanting, freshWeave, freshRoster] = await Promise.all([
      fetchJson('/api/state'),
      fetchJson('/api/weather/map?radius=3'),
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
    writeIdentity({
      playerAccountId: snapshot.status.player_account_id,
      deviceId: readIdentity().deviceId,
      characterName: snapshot.status.character_name,
    });
    if (messageOverride) snapshot.message = messageOverride;
    renderSnapshot(snapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions);
    if (messageOverride) setRosterFeedback(messageOverride, 'feedback-success');
  } catch (error) {
    sessionReady = false;
    renderGatewayError(`ShellRPG-server aktuell nicht erreichbar: ${error.message}`);
  }
}

async function sendCommand(command) {
  try {
    await ensureSession();
    const payload = JSON.stringify({ command });
    const [snapshot, freshWeatherMap, freshRecovery, freshHistory, freshRegions, freshNpcs, freshBrewing, freshEnchanting, freshWeave, freshRoster] = await Promise.all([
      fetchJson('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }),
      fetchJson('/api/weather/map?radius=3'),
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
    if (freshNpcs?.entries?.length) {
      try { npcMenu = await fetchJson(`/api/npcs/menu?name=${encodeURIComponent(freshNpcs.entries[0].name)}`); } catch (_) {}
    }
    writeIdentity({
      playerAccountId: snapshot.status.player_account_id,
      deviceId: readIdentity().deviceId,
      characterName: snapshot.status.character_name,
    });
    renderSnapshot(snapshot, weatherMap, recoveryConflicts, recoveryHistory, weatherRegions);
  } catch (error) {
    sessionReady = false;
    renderGatewayError(`Kommando konnte nicht an den privaten Server zugestellt werden: ${error.message}`);
  }
}

function startPolling() {
  if (pollingHandle) window.clearInterval(pollingHandle);
  pollingHandle = window.setInterval(() => loadState(), 1000);
}

initializeCharacterForm();

const commandInput = document.getElementById("command-input");
const characterForm = document.getElementById("character-create-form");
const rosterRefresh = document.getElementById("roster-refresh");
document.getElementById("run-command").addEventListener("click", () => sendCommand(commandInput.value));
document.getElementById("refresh-all").addEventListener("click", () => loadState("Ansichten aktualisiert."));
if (characterForm) characterForm.addEventListener("submit", createCharacterFromForm);
if (rosterRefresh) rosterRefresh.addEventListener("click", () => loadState("Charakterliste aktualisiert."));
const recoverButton = document.getElementById("recover-live");
if (recoverButton) recoverButton.addEventListener("click", async () => {
  await fetchJson('/api/recover/live', {method:'POST', headers:{'Content-Type': 'application/json'}, body:'{}'});
  await loadState('Live-Recover ausgeführt.');
});
document.getElementById("lang-de").addEventListener("click", async () => { currentLang = "de"; await sendCommand("lang de"); });
document.getElementById("lang-en").addEventListener("click", async () => { currentLang = "en"; await sendCommand("lang en"); });
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendCommand(commandInput.value);
  }
});
document.querySelectorAll(".quick-action").forEach((button) => {
  button.addEventListener("click", () => sendCommand(button.dataset.command));
});

loadState("Phase v0.7.6 geladen: konsolidierter öffentlicher Slice mit Händler-, Quest- und Artefaktansichten aktiv.");
startPolling();

const saveButton = document.getElementById('save-request');
if (saveButton) saveButton.addEventListener('click', async () => {
  await fetchJson('/api/save/request', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
  await loadState('Safe-Save beim Server angefragt.');
});
