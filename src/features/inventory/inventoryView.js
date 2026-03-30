export function renderInventoryPanel(mountNode, inventory = [], equipment = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Inventar & Ausrüstung</h2>
    <h3 class="small-head">Ausrüstung</h3>
    <ul class="list">
      ${equipment.map((item) => `<li>${String(item.slot || "").replaceAll("_", " ")}: ${item.occupied === false ? "leer" : item.item_name} <span class="small">${item.occupied === false ? "[slot]" : `[${item.quality}] ${item.affixes?.join(" · ") || ""}`}</span></li>`).join("")}
    </ul>
    <h3 class="small-head">Inventar</h3>
    <ul class="list">
      ${inventory.map((item) => `<li>${item.item_name} x${item.quantity} <span class="small">[${item.category}/${item.quality}] ${item.affixes?.join(" · ") || ""}</span></li>`).join("")}
    </ul>
  `;
}
