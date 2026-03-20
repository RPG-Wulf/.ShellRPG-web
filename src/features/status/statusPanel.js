export function renderStatusPanel(mountNode, status, message = "", ok = true) {
  if (!mountNode || !status) return;
  mountNode.innerHTML = `
    <h2>Status</h2>
    <p class="${ok ? "message" : "warning"}">${message}</p>
    <p><strong>${status.character_name}</strong> · ${status.class_name}</p>
    <p class="small">Ort: ${status.location_label}</p>
    <div class="pill">HP ${status.hp_current}/${status.hp_max}</div>
    <div class="pill">Hunger: ${status.hunger}</div>
    <div class="pill">Gold: ${status.gold}</div>
    <div class="pill">Aktion: ${status.active_action}</div>
    <div class="pill">Tick: ${status.tick_value}</div>
  `;
}
