import { renderStatusPanel } from "./features/status/statusPanel.js";
import { renderMapPanel } from "./features/map/mapView.js";
import { renderInventoryPanel } from "./features/inventory/inventoryView.js";
import { renderMarketPanel } from "./features/market/marketView.js";
import { renderJournalPanel } from "./features/journal/journalView.js";
import { renderReviewPanel } from "./features/admin-review/reviewView.js";

renderStatusPanel(document.getElementById("status-panel"));
renderMapPanel(document.getElementById("map-panel"));
renderInventoryPanel(document.getElementById("inventory-panel"));
renderMarketPanel(document.getElementById("market-panel"));
renderJournalPanel(document.getElementById("journal-panel"));
renderReviewPanel(document.getElementById("review-panel"));
