export function renderMapPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Karte</h2>
    <p class="small">Foundations-Skelett für Weltkarte, FOW-Layer und Routenlogik.</p>
  `;
}
