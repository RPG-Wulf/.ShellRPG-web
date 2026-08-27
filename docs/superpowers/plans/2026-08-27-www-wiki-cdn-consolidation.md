# WWW / Wiki / CDN Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ShellRPG-www the primary public gateway, connect the redacted Wiki as a linked subdomain, and restrict ShellRPG-cdn to WWW-owned images only without breaking existing data or URLs during migration.

**Architecture:** `www.shellrpg.tld` remains the only application gateway and proxies only the private `/api/*` contract to ShellRPG-server. `wiki.shellrpg.tld` remains a separate redacted documentation endpoint linked from WWW and does not consume the CDN. The CDN keeps the existing `assets/www/public/media` namespace as the canonical image root so image data does not need to move; legacy non-WWW CDN trees are frozen and removed only after deployment validation.

**Tech Stack:** Python 3.11+ HTTP gateway, browser ES modules, TOML configuration, static Markdown Wiki, GitHub-backed CDN assets.

**Spec:** User-provided consolidation instruction in this conversation, 2026-08-27.

## Global Constraints

- WWW is the central and primary endpoint.
- Wiki is connected to WWW but remains a separate responsibility.
- CDN is exclusively a host for images/static image resources owned by WWW.
- Wiki must not independently host content on or consume the CDN.
- Preserve existing functionality and data integrity.
- HTTPS is required for all public endpoints.
- Keep backend ports private; do not expose ShellRPG-server publicly.
- CDN has no public write interface; uploads/synchronization originate only from the WWW-controlled pipeline.
- Back up and document production DNS, reverse-proxy, TLS and data configuration before irreversible changes.
- Do not remove legacy/redundant production configuration until the new path has passed functional validation.

---

### Task 1: Harden WWW public-boundary behavior

**Files:**
- Modify: `src/shellrpg_www/gateway.py`
- Modify: `src/shellrpg_www/config.py`
- Modify: `config/shellrpg-www.toml`
- Test: `tests/test_gateway_security.py`

**Interfaces:**
- Consumes: reverse-proxy `X-Forwarded-Proto` header on the localhost-only WWW listener.
- Produces: `forwarded_proto_from_headers()`, HTTPS-aware session cookies, and public integration configuration containing the Wiki URL and canonical CDN image base.

- [ ] **Step 1:** Add failing tests proving that forwarded HTTPS is preserved, invalid schemes fall back safely, and HTTPS sessions receive `Secure; HttpOnly; SameSite=Lax` cookies.
- [ ] **Step 2:** Run the focused tests and verify RED.
- [ ] **Step 3:** Implement the smallest trusted-proxy helper and secure-cookie behavior; keep the localhost direct-development default as HTTP.
- [ ] **Step 4:** Run focused and existing gateway tests and verify GREEN.

### Task 2: Make CDN the canonical WWW image delivery path

**Files:**
- Modify: `src/shellrpg_www/assets.py`
- Modify: `src/shellrpg_www/gateway.py`
- Modify: `src/app.js`
- Modify: `public/index.html`
- Test: `tests/test_asset_proxy.py`

**Interfaces:**
- Consumes: WWW `public/media/...` image paths and the configured CDN image base.
- Produces: image-only `/asset/*` fallback, canonical direct CDN browser URLs, and redirects from legacy direct WWW media URLs.

- [ ] **Step 1:** Add failing tests that reject CSS/JS/JSON through the asset proxy while accepting PNG/JPEG/GIF/WebP/SVG/ICO paths.
- [ ] **Step 2:** Run the focused tests and verify RED.
- [ ] **Step 3:** Restrict allowed suffixes to images only and add a canonical media redirect that preserves existing paths while moving image bytes off WWW.
- [ ] **Step 4:** Add public `/site-config.json` output with `wiki_base_url` and `cdn_image_base_url`; make the browser normalize WWW media paths directly to that CDN base, with `/asset/` as development fallback.
- [ ] **Step 5:** Add a visible WWW -> Wiki navigation link populated from site configuration.
- [ ] **Step 6:** Run Python tests and a small browser-path JavaScript test where Node is available.

### Task 3: Restrict the CDN producer to WWW images

**Files in `RPG-Wulf/.ShellRPG-cdn`:**
- Modify: `scripts/sync_workspace_assets.py`
- Modify: `manifests/asset-layout.json`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `assets/README.md`
- Create: `tests/test_sync_workspace_assets.py`

**Interfaces:**
- Consumes: only `ShellRPG-www/public/media`.
- Produces: only `assets/www/public/media`; no client assets, Wiki assets, manifests or arbitrary files.

- [ ] **Step 1:** Add a failing temporary-workspace test proving that WWW media is copied while WWW manifests and ShellRPG-client media are not.
- [ ] **Step 2:** Run the test and verify RED.
- [ ] **Step 3:** Refactor the sync function for testability and remove all non-WWW-image producer inputs.
- [ ] **Step 4:** Update the active layout manifest and documentation to declare WWW-only, image-only, read-only public delivery.
- [ ] **Step 5:** Run the focused tests and verify GREEN.
- [ ] **Step 6:** Leave existing `assets/client` and `manifests/www` data untouched in this phase; record them as frozen legacy data for deletion only after deployment validation.

### Task 4: Bind the Wiki logically to WWW without coupling runtimes

**Files in `RPG-Wulf/.ShellRPG-wiki`:**
- Modify: `shellrpg.manifest.toml`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `index.md`
- Create: `meta/infrastructure-integration.md`

**Interfaces:**
- Consumes: canonical `https://www.shellrpg.tld` and deployment-provided `https://wiki.shellrpg.tld`.
- Produces: explicit subdomain integration contract and a prohibition on Wiki CDN usage.

- [ ] **Step 1:** Document `wiki.shellrpg.tld` as the preferred integration mode because the repository is static/redacted Markdown rather than part of the WWW Python runtime.
- [ ] **Step 2:** Document host-only authentication/session behavior: no shared browser session is required while the Wiki remains public/redacted; future SSO belongs at the WWW/identity layer, never at the CDN.
- [ ] **Step 3:** Add Wiki -> WWW navigation and explicit `cdn_usage = "forbidden"` metadata.

### Task 5: Provide deployment migration and rollback runbook

**Files:**
- Create: `docs/infrastructure-consolidation.md`

**Interfaces:**
- Consumes: actual production DNS/proxy/TLS state gathered by the operator before rollout.
- Produces: ordered backup, staging, validation, redirect, cutover and rollback checklist.

- [ ] **Step 1:** Record the known repository inventory: WWW `127.0.0.1:8080`, private backend `127.0.0.1:8765`, current CDN roots and lack of versioned proxy/TLS configuration.
- [ ] **Step 2:** Add generic reverse-proxy requirements for `www`, `wiki` and `cdn` without claiming a specific production proxy is already installed.
- [ ] **Step 3:** Add backup commands/checkpoints for DNS zone exports, proxy configs, certificate metadata, application config and relevant data stores before cutover.
- [ ] **Step 4:** Add the required functional matrix: WWW, CDN images/cache, Wiki links, HTTPS, redirects, no redirect loops, no CORS/cookie/mixed-content errors, Wiki no-CDN usage.
- [ ] **Step 5:** Mark legacy CDN tree removal and old proxy/DNS cleanup as post-validation-only actions.

### Task 6: Final verification

- [ ] **Step 1:** Run all available WWW tests.
- [ ] **Step 2:** Run all available CDN tests.
- [ ] **Step 3:** Inspect branch diffs for accidental backend exposure, broad CORS, insecure cookies, public write paths or Wiki CDN references.
- [ ] **Step 4:** Confirm no production DNS/TLS/proxy resource was mutated by repository-only work.
- [ ] **Step 5:** Open reviewable pull requests; do not merge until staging/proxy/DNS validation is complete.
