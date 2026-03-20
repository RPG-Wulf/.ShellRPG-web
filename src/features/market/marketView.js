export function renderMarketPanel(mountNode, market = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Markt</h2>
    <ul class="list">
      ${market.map((entry) => `<li>${entry.item_name}: ${entry.price} Gold <span class="small">(${entry.trend})</span></li>`).join("")}
    </ul>
  `;
}
