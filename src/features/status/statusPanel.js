export function renderStatusPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Status</h2>
    <p class="small">Zeigt Statusbar, Aktion, Tick und Grundzustände des Charakters.</p>
  `;
}
