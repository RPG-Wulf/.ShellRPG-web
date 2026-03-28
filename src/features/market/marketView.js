export function renderMarketPanel(mountNode, market = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Markt</h2>
    <ul class="list">
      ${market.map((entry) => `<li>${entry.item_name}: ${entry.price_display} <span class="small">[${entry.category}] (${entry.trend})</span></li>`).join("")}
    </ul>
  `;
}
