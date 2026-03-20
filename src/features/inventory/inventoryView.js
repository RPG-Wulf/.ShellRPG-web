export function renderInventoryPanel(mountNode, inventory = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Inventar</h2>
    <ul class="list">
      ${inventory.map((item) => `<li>${item.item_name} x${item.quantity}</li>`).join("")}
    </ul>
  `;
}
