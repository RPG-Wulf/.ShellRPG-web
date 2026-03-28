const GRID_RADIUS = 6;
const GRID_SIZE = GRID_RADIUS * 2 + 1;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Wandelt unterschiedliche serverseitige Koordinatenformate robust in Zahlen um.
function parseCoords(coordsLabel) {
  const match = String(coordsLabel || "").match(/(-?\d+)\s*,\s*(-?\d+)/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

// Normalisiert Asset-Pfade fuer Topdown- und Birdseye-Darstellungen im WWW.
function assetPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.?\//, "")}`;
}

// Ermittelt aus Sprache, Zeit und Action eine weiche Lesart fuer die Dominanz des Center-Focus.
function centerMood(status) {
  const time = String(status?.time_label || "").toLowerCase();
  if (time.includes("night") || time.includes("nacht")) return "night";
  if (time.includes("dusk") || time.includes("abend")) return "dusk";
  if (time.includes("dawn") || time.includes("morgen")) return "dawn";
  return "day";
}

// Baut aus sichtbaren Tiles und Wetterdaten ein 13x13-ready Modell, ohne dem Server zusaetzliche Weltkenntnis zu unterstellen.
export function buildMapShellModel(status, mapTiles = [], weatherMap = null, combat = []) {
  const tileIndex = new Map();
  mapTiles.forEach((tile) => {
    const coords = parseCoords(tile.coords_label);
    if (coords) tileIndex.set(`${coords.x},${coords.y}`, { ...tile, coords });
  });

  const weatherIndex = new Map();
  let currentWeatherCell = null;
  const weatherRows = Array.isArray(weatherMap?.rows) ? weatherMap.rows : [];
  weatherRows.flat().forEach((cell) => {
    weatherIndex.set(`${cell.x},${cell.y}`, cell);
    if (cell.current) currentWeatherCell = cell;
  });

  const statusCoords = parseCoords(status?.coords_label);
  const center = statusCoords || (currentWeatherCell ? { x: currentWeatherCell.x, y: currentWeatherCell.y } : { x: 0, y: 0 });
  const focusHasEncounter = Array.isArray(combat) && combat.length > 0;
  const mood = centerMood(status);

  const cells = [];
  for (let y = center.y - GRID_RADIUS; y <= center.y + GRID_RADIUS; y += 1) {
    for (let x = center.x - GRID_RADIUS; x <= center.x + GRID_RADIUS; x += 1) {
      const tile = tileIndex.get(`${x},${y}`);
      const weather = weatherIndex.get(`${x},${y}`);
      const current = x === center.x && y === center.y;
      const hidden = !tile;
      const weatherLabel = weather?.weather_label || (current ? status?.weather_label || "" : "");
      const danger = Boolean(weather?.hazard) || (current && focusHasEncounter);
      const discovered = Boolean(tile) && tile.visibility_state !== "unknown";
      cells.push({
        x,
        y,
        coordsLabel: `${x},${y}`,
        label: tile?.label || weather?.label || "Unkartiert",
        biome: tile?.biome || weather?.biome || "",
        terrain: tile?.terrain || weather?.terrain || "",
        visibilityState: tile?.visibility_state || (hidden ? "unknown" : "visible"),
        sprite: assetPath(tile?.sprite),
        building: tile?.building || "",
        poiKnown: tile?.poi_known || [],
        knownResources: tile?.known_resources || [],
        weatherLabel,
        weatherAffected: Boolean(weatherLabel) && !/^(klar|clear|overcast|bewölkt)$/i.test(weatherLabel),
        danger,
        current,
        hidden,
        discovered,
        mood,
      });
    }
  }

  return {
    size: GRID_SIZE,
    center,
    cells,
    focus: {
      mood,
      image: assetPath(status?.media_file),
      title: status?.location_label || "Unkartiertes Zentrum",
      subtitle: status?.overlay_message || "Die Lage verdichtet sich im Zentrum dieses Felds.",
      encounterSummary: focusHasEncounter
        ? `${combat.length} aktive Begegnung${combat.length === 1 ? "" : "en"}`
        : `Aktion: ${status?.active_action || "idle"}`,
      weatherLabel: status?.weather_label || "—",
      timeLabel: status?.time_label || "—",
      coordsLabel: status?.coords_label || `${center.x},${center.y}`,
    },
  };
}

// Rendert die 13x13 Tactical Map mit dominantem Center-Fokus und textlichem Wetter-Overlay pro Feld.
export function renderMapPanel(
  mountNode,
  {
    status,
    mapTiles = [],
    weatherMap = null,
    combat = [],
    onTileCommand = null,
  } = {},
) {
  if (!mountNode || !status) return;

  const model = buildMapShellModel(status, mapTiles, weatherMap, combat);
  mountNode.innerHTML = "";

  const shell = el("div", "map-shell");
  const intro = el("div", "map-shell__intro");
  intro.append(el("p", "map-shell__eyebrow", "Tactical Cartography · 13x13"));
  intro.append(el("h2", "map-shell__title", "Grenzblick"));
  intro.append(
    el(
      "p",
      "map-shell__copy",
      "Das Zentrum zeigt die aktuelle Birdseye-Lage, waehrend die umliegenden Felder Orientierung, Terrain und Wetterdruck liefern.",
    ),
  );
  shell.append(intro);

  const stage = el("div", `map-stage map-stage--${model.focus.mood}`);
  const grid = el("div", "map-stage__grid");
  grid.style.setProperty("--map-grid-size", String(model.size));

  model.cells.forEach((cell) => {
    const tile = el(
      "button",
      [
        "map-tile",
        `is-${cell.visibilityState}`,
        cell.current ? "is-player" : "",
        cell.hidden ? "is-hidden" : "",
        cell.danger ? "is-danger" : "",
        cell.weatherAffected ? "is-weather-affected" : "",
        cell.discovered ? "is-discovered" : "",
        cell.mood === "night" ? "is-night" : "is-day",
      ]
        .filter(Boolean)
        .join(" "),
    );
    tile.type = "button";
    tile.dataset.coords = cell.coordsLabel;
    tile.title = [
      cell.label,
      cell.coordsLabel,
      cell.biome && cell.terrain ? `${cell.biome} · ${cell.terrain}` : "",
      cell.weatherLabel ? `Wetter: ${cell.weatherLabel}` : "",
      cell.building ? `Bauwerk: ${cell.building}` : "",
      cell.poiKnown.length ? `POI: ${cell.poiKnown.join(", ")}` : "",
      cell.knownResources.length ? `Ressourcen: ${cell.knownResources.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (cell.sprite && !cell.current) {
      tile.style.backgroundImage = `linear-gradient(180deg, rgba(5, 6, 9, 0.16), rgba(6, 7, 10, 0.82)), url("${cell.sprite}")`;
    }

    const weather = el("span", "map-tile__weather", cell.weatherLabel || "still");
    const label = el("span", "map-tile__label", cell.current ? "Du" : cell.label);
    const meta = el("span", "map-tile__meta", cell.hidden ? "fog" : `${cell.biome || "terrain"} · ${cell.terrain || "—"}`);
    tile.append(weather, label, meta);

    if (cell.building) tile.append(el("span", "map-tile__building", cell.building));
    if (cell.current) tile.append(el("span", "map-tile__marker", "✦"));

    tile.addEventListener("click", () => {
      if (typeof onTileCommand === "function" && !cell.current) {
        onTileCommand(`walk ${cell.coordsLabel}`, cell);
      }
    });

    grid.append(tile);
  });

  stage.append(grid);

  const focus = el("div", "map-focus");
  if (model.focus.image) {
    focus.style.backgroundImage = `linear-gradient(180deg, rgba(6, 8, 10, 0.08), rgba(7, 8, 10, 0.86)), url("${model.focus.image}")`;
  }
  focus.append(el("p", "map-focus__eyebrow", `${model.focus.weatherLabel} · ${model.focus.timeLabel}`));
  focus.append(el("h3", "map-focus__title", model.focus.title));
  focus.append(el("p", "map-focus__subtitle", model.focus.subtitle));
  focus.append(el("p", "map-focus__encounter", model.focus.encounterSummary));
  focus.append(el("p", "map-focus__coords", model.focus.coordsLabel));
  stage.append(focus);

  const legend = el("div", "map-legend");
  ["Du", "Encounter", "Gefahr", "Wetterdruck", "Fog-of-War"].forEach((entry) => {
    legend.append(el("span", "map-legend__pill", entry));
  });

  shell.append(stage, legend);
  mountNode.append(shell);
}
