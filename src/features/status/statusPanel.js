export function renderStatusPanel(mountNode, status, message = "", ok = true) {
  if (!mountNode || !status) return;
  const choices = (status.combat_choices || []).map((choice) => `<span class="pill danger">${choice}</span>`).join("");
  mountNode.innerHTML = `
    <h2>Status</h2>
    <p class="${ok ? "message" : "warning"}">${message}</p>
    <p><strong>${status.character_name}</strong> · ${status.class_name}/${status.race_name} · Lvl ${status.level}</p>
    <p class="small">Ort: ${status.location_label} [${status.coords_label}]</p>
    <div class="pill">HP ${status.hp_current}/${status.hp_max}</div>
    <div class="pill">MP ${status.mana_current}/${status.mana_max}</div>
    <div class="pill">Gold: ${status.gold}</div>
    <div class="pill">Silber: ${status.silver}</div>
    <div class="pill">Aktion: ${status.active_action}</div>
    <div class="pill">Tick: ${status.tick_value}</div>
    ${status.reaction_seconds_left ? `<div class="pill danger">Reaktion: ${status.reaction_seconds_left}s</div>` : ""}
    <p class="overlay"><strong>Overlay:</strong> ${status.overlay_message}</p>
    <p class="small">Spannung: ${status.faction_tension || "—"}</p>
    <div class="media-frame">
      <img class="media" src="./media/gifs/${status.media_file}" alt="${status.media_file}" />
      <p class="small">GIF: ${status.media_file}</p>
    </div>
    ${choices ? `<div class="choice-row">${choices}</div>` : ""}
  `;
}
