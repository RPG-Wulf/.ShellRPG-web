export function renderInventoryPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Inventar</h2>
    <p class="small">Slot-, Last- und Verbrauchsgüteransicht als Public Client Panel.</p>
  `;
}
