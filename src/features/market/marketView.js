export function renderMarketPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Markt</h2>
    <p class="small">Basis für Stadtmarkt, Preisindikatoren und Handelsvergleiche.</p>
  `;
}
