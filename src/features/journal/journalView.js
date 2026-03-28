export function renderJournalPanel(mountNode, journal = [], quests = [], buffs = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Journal, Quests & Buffs</h2>
    <h3 class="small-head">Quests</h3>
    <ul class="list">
      ${quests.map((entry) => `<li>${entry.title} <span class="small">[${entry.status}] ${entry.progress_text}</span><br />${entry.description}</li>`).join("")}
    </ul>
    <h3 class="small-head">Buffs</h3>
    <ul class="list">
      ${(buffs.length ? buffs : [{ buff_name: "keine", value: 0, remaining_ticks: 0, source: "—" }]).map((entry) => `<li>${entry.buff_name}${entry.buff_name === "keine" ? "" : ` +${entry.value} (${entry.remaining_ticks} Ticks) via ${entry.source}`}</li>`).join("")}
    </ul>
    <h3 class="small-head">Journal</h3>
    <ul class="list">
      ${journal.map((entry) => `<li>${entry}</li>`).join("")}
    </ul>
  `;
}
