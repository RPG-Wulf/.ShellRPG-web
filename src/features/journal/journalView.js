export function renderJournalPanel(mountNode, journal = []) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Journal</h2>
    <ul class="list">
      ${journal.map((entry) => `<li>${entry}</li>`).join("")}
    </ul>
  `;
}
