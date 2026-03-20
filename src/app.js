import { renderStatusPanel } from "./features/status/statusPanel.js";
import { renderMapPanel } from "./features/map/mapView.js";
import { renderInventoryPanel } from "./features/inventory/inventoryView.js";
import { renderMarketPanel } from "./features/market/marketView.js";
import { renderJournalPanel } from "./features/journal/journalView.js";
import { renderReviewPanel } from "./features/admin-review/reviewView.js";

const API_BASE = "http://127.0.0.1:8765";

async function fetchJson(path, options = undefined) {
  const response = await fetch(`${API_BASE}${path}`, options);
  return await response.json();
}

async function loadAll(message = "Phase B Slice geladen.") {
  const [statusRes, mapRes, inventoryRes, marketRes, journalRes, helpRes] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/map"),
    fetchJson("/api/inventory"),
    fetchJson("/api/market"),
    fetchJson("/api/journal"),
    fetchJson("/api/help"),
  ]);
  renderStatusPanel(document.getElementById("status-panel"), statusRes.status, message);
  renderMapPanel(document.getElementById("map-panel"), mapRes.map_tiles);
  renderInventoryPanel(document.getElementById("inventory-panel"), inventoryRes.inventory);
  renderMarketPanel(document.getElementById("market-panel"), marketRes.market);
  renderJournalPanel(document.getElementById("journal-panel"), journalRes.journal);
  renderReviewPanel(document.getElementById("review-panel"), helpRes.commands);
}

async function sendCommand(command) {
  const payload = JSON.stringify({ command });
  const snapshot = await fetchJson("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  renderStatusPanel(document.getElementById("status-panel"), snapshot.status, snapshot.message, snapshot.ok);
  renderMapPanel(document.getElementById("map-panel"), snapshot.map_tiles);
  renderInventoryPanel(document.getElementById("inventory-panel"), snapshot.inventory);
  renderMarketPanel(document.getElementById("market-panel"), snapshot.market);
  renderJournalPanel(document.getElementById("journal-panel"), snapshot.journal);
  renderReviewPanel(document.getElementById("review-panel"), snapshot.commands);
}

const commandInput = document.getElementById("command-input");
document.getElementById("run-command").addEventListener("click", () => sendCommand(commandInput.value));
document.getElementById("refresh-all").addEventListener("click", () => loadAll("Ansichten aktualisiert."));
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendCommand(commandInput.value);
  }
});

loadAll();
