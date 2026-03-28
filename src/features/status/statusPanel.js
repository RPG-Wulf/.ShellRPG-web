function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Normalisiert serverseitige Media-Pfade so, dass das WWW sie sauber same-origin ausliefern kann.
function assetPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.?\//, "")}`;
}

// Uebersetzt die serverseitige Rollenkennung in eine lesbare Oberflaechenfassung fuer das HUD.
function roleLabel(status) {
  if (status?.control_role === "active-controller") return "Aktive Steuerung";
  if (status?.control_role === "observer") return "Beobachter";
  return "Synchronisiert";
}

// Uebersetzt den technischen Steuerungszustand in eine ruhig lesbare Form fuer die Statuskarte.
function controlStateLabel(status) {
  if (status?.control_state === "held-by-you") return "von dieser Sitzung gehalten";
  if (status?.control_state === "held-by-other") return "von anderer Sitzung gehalten";
  if (status?.control_state === "free") return "frei";
  return status?.control_state || "unbekannt";
}

// Rendert die zentrale Statuskarte mit klarer Dark-Fantasy-Hierarchie fuer Charakter, Weltlage und Rollenmodell.
export function renderStatusPanel(
  mountNode,
  status,
  message = "",
  options = {},
) {
  if (!mountNode || !status) return;

  const {
    liveConnectionState = "offline",
    onTakeControl = null,
    onReleaseControl = null,
  } = options;

  mountNode.innerHTML = "";

  const shell = el("div", "status-oracle");
  const crest = el("div", "status-oracle__crest");
  const portrait = el("div", "status-oracle__portrait");
  const media = assetPath(status.media_file);
  if (media) portrait.style.backgroundImage = `url("${media}")`;
  crest.append(portrait);

  const headline = el("div", "status-oracle__headline");
  headline.append(el("p", "status-oracle__eyebrow", "ShellRPG-www · Dark Delivery"));
  headline.append(el("h2", "status-oracle__name", status.character_name || "Unbenannter Wanderer"));
  headline.append(el("p", "status-oracle__classline", `${status.class_name}/${status.race_name} · Stufe ${status.level}`));

  const pills = el("div", "status-oracle__pills");
  [
    `Ort: ${status.location_label}`,
    `Koordinaten: ${status.coords_label}`,
    `Wetter: ${status.weather_label || "—"}`,
    `Zeit: ${status.time_label || "—"}`,
    `Rolle: ${roleLabel(status)}`,
  ].forEach((line) => pills.append(el("span", "oracle-pill", line)));
  headline.append(pills);

  crest.append(headline);
  shell.append(crest);

  shell.append(
    el(
      "p",
      "status-oracle__message",
      message || status.overlay_message || "Der Nebel steht still, aber der Zustand lebt weiter.",
    ),
  );

  const metrics = el("div", "status-ledger");
  [
    ["HP", `${status.hp_current}/${status.hp_max}`],
    ["MP", `${status.mana_current}/${status.mana_max}`],
    ["Gold", `${status.gold}`],
    ["Silber", `${status.silver}`],
    ["Aktion", status.active_action || "idle"],
    ["Hunger", status.hunger || "—"],
    ["Mond", status.moon_label || "—"],
    ["Venus", status.venus_label || "—"],
    ["Tick", `${status.tick_value}`],
    ["Live", liveConnectionState === "live" ? "Server Events" : (liveConnectionState === "connecting" ? "verbinde ..." : "Fallback")],
    ["Auto-Battle", `${status.auto_battle_enabled ? "an" : "aus"} · ${status.auto_battle_mode || "balanced"}`],
    ["Account", status.player_account_id || "—"],
  ].forEach(([label, value]) => {
    const card = el("div", "status-ledger__card");
    card.append(el("span", "status-ledger__label", label));
    card.append(el("strong", "status-ledger__value", value));
    metrics.append(card);
  });
  shell.append(metrics);

  if (status.weather_effects?.length) {
    const effects = el("div", "oracle-effect-list");
    status.weather_effects.forEach((entry) => effects.append(el("span", "oracle-effect-chip", entry)));
    shell.append(effects);
  }

  if (status.control_mode) {
    const control = el("div", "control-card");
    control.append(el("strong", "control-card__title", `${roleLabel(status)} · ${controlStateLabel(status)}`));
    control.append(
      el(
        "p",
        "control-card__meta",
        `Modell: ${status.control_mode} · Halter: ${status.control_holder_label || "niemand"} · Lease: ${status.control_lease_seconds_left || 0}s`,
      ),
    );
    if (status.control_action) {
      control.append(el("p", "control-card__meta", `Aktive Aktion: ${status.control_action}`));
    }
    const actions = el("div", "control-card__actions");
    if (status.control_takeover_available) {
      const button = el("button", "control-card__button", "Steuerung übernehmen");
      button.type = "button";
      button.addEventListener("click", () => {
        if (typeof onTakeControl === "function") onTakeControl();
      });
      actions.append(button);
    }
    if (status.control_can_release) {
      const button = el("button", "control-card__button", "Steuerung freigeben");
      button.type = "button";
      button.addEventListener("click", () => {
        if (typeof onReleaseControl === "function") onReleaseControl();
      });
      actions.append(button);
    }
    if (actions.childElementCount) control.append(actions);
    shell.append(control);
  }

  if (status.faction_tension) {
    shell.append(el("p", "status-oracle__tension", status.faction_tension));
  }

  mountNode.append(shell);
}
