export function renderMapPanel(mountNode, mapTiles = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Karte</h2>
    <p class="small">Per-Character-Fog-of-War, POIs und bekannte Rohstoffvorkommen.</p>
    <ul class="map-list">
      ${mapTiles.map((tile) => `
        <li class="map-item ${tile.is_current ? "current" : ""}">
          <strong>${tile.label}</strong> <span class="small">[${tile.coords_label}]</span><br />
          <span class="small">${tile.visibility_state}${tile.is_current ? " · aktuell" : ""}</span>
          ${tile.poi_known?.length ? `<div class="small">POI: ${tile.poi_known.join(", ")}</div>` : ""}
          ${tile.known_resources?.length ? `<div class="small">Ressourcen: ${tile.known_resources.join(", ")}</div>` : ""}
        </li>
      `).join("")}
    </ul>
  `;
}
