export function renderMapPanel(mountNode, mapTiles = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Karte</h2>
    <p class="small">Per-Character-Fog-of-War als redigierte Public-Ansicht.</p>
    <ul class="map-list">
      ${mapTiles.map((tile) => `
        <li class="map-item ${tile.is_current ? "current" : ""}">
          <strong>${tile.label}</strong><br />
          <span class="small">${tile.visibility_state}${tile.is_current ? " · aktuell" : ""}</span>
        </li>
      `).join("")}
    </ul>
  `;
}
