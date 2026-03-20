export function renderReviewPanel(mountNode, commands = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Befehle</h2>
    <p class="small">Public-safe Spiegelung der sichtbaren Spielerbefehle.</p>
    <div>
      ${commands.map((command) => `<span class="pill">${command}</span>`).join("")}
    </div>
  `;
}
