export function renderJournalPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Journal</h2>
    <p class="small">Quest-, Ereignis- und Reisehistorie im Web-Client.</p>
  `;
}
