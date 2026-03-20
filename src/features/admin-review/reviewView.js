export function renderReviewPanel(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <h2>Review</h2>
    <p class="small">Redigiertes Public Panel für harmlose Admin-/Rätselreviews.</p>
  `;
}
