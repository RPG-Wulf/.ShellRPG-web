# WWW / Wiki / CDN Consolidation Implementation Plan

**Goal:** Make ShellRPG-www the primary public gateway, connect the redacted Wiki as a separate linked subdomain, and restrict ShellRPG-cdn to WWW-owned images only without destructive cleanup before deployment validation.

**Architecture:** `www.shellrpg.tld` remains the only application gateway and proxies only `/api/*` to the private ShellRPG-server. `wiki.shellrpg.tld` remains a separate redacted documentation endpoint. The active CDN payload remains in the existing `assets/www/public/media` namespace so image data does not need to move during the first migration phase.

## Constraints

- WWW is the central public endpoint.
- Wiki is linked to WWW but remains a separate responsibility.
- CDN is WWW-owned and image-only.
- Wiki and ShellRPG-client must not use the CDN as their own host.
- HTTPS is mandatory for public endpoints.
- Backend ports remain private.
- No public CDN write API.
- Back up DNS/proxy/TLS/data before any production cutover.
- Legacy data is removed only after successful validation.

## Repository phase — completed on the migration branches

### WWW

- [x] Added RED/GREEN tests for forwarded HTTPS and `Secure; HttpOnly; SameSite=Lax` session cookies.
- [x] Preserved `X-Forwarded-Proto` from the loopback reverse-proxy boundary instead of hardcoding HTTP.
- [x] Removed private backend address and low-level backend error details from public health/error responses.
- [x] Added `wiki_base_url` integration configuration.
- [x] Added public `/site-config.json` containing only Wiki and CDN public base URLs.
- [x] Restricted `/asset/*` to PNG/JPEG/GIF/WebP/SVG/ICO below `public/media`.
- [x] Added 308 redirects from legacy `/public/media/...` image URLs to the canonical configured CDN image base.
- [x] Added visible WWW -> Wiki navigation.
- [x] Added migration, backup, TLS/proxy, cache, test and rollback runbook.

**Deliberate staging decision:** `src/app.js` is not yet rewritten to emit direct CDN URLs. During the compatibility phase existing browser media paths receive a 308 to CDN, preserving old URLs while preventing WWW from serving image bytes. A direct browser-path cutover is deferred until the real CDN origin has passed DNS/HTTPS/cache validation; otherwise the branch would hard-switch clients to an unverified origin.

### CDN

- [x] Added a testable `sync_workspace_assets(root, workspace)` contract.
- [x] Syncs only images from `ShellRPG-www/public/media`.
- [x] Rejects non-image files and symlinked image inputs.
- [x] No longer produces WWW manifests or ShellRPG-client media.
- [x] Active manifest declares only `assets/www/public/media` as the WWW image root.
- [x] Public write, Wiki use and client use are explicitly forbidden.
- [x] Historical `assets/client` and `manifests/www` remain frozen for rollback and are not deleted in this phase.

### Wiki

- [x] Chose subdomain integration (`wiki.shellrpg.tld`) because the repository is redacted Markdown rather than part of the WWW Python runtime.
- [x] Added Wiki -> WWW navigation.
- [x] Declared `cdn_usage = "forbidden"`.
- [x] Kept shared browser sessions disabled for the current public/redacted Wiki.
- [x] Documented future SSO, TLS/proxy, redirect and no-CDN boundaries.

## Verification completed in the repository phase

- [x] TDD RED confirmed for missing forwarded-proto handling and non-image `/asset` acceptance.
- [x] TDD RED confirmed for multi-source CDN sync.
- [x] TDD RED confirmed that symlinked images would have been copied before the fix.
- [x] Fresh local reconstructed WWW run: 16/16 behavior tests passed before final public-error tightening; the focused public integration suite then passed 4/4 after the tightening.
- [x] WWW HTTP smoke test passed for `/health`, `/site-config.json`, image 308 redirect, non-image 404 and frontend root.
- [x] Fresh CDN run: 2/2 sync tests passed and the sync script compiled.
- [x] Branch diffs inspected before opening draft PRs.
- [x] No production DNS/TLS/reverse-proxy resource was modified by repository work.
- [x] Draft PRs opened; none merged.

## Production/staging gates — intentionally still open

- [ ] Export actual production DNS zone and record current A/AAAA/CNAME/TXT/CAA values.
- [ ] Back up reverse-proxy configuration, TLS/ACME metadata, WWW config, Wiki deploy, CDN tree and authoritative server persistence.
- [ ] Verify the actual production WWW domain and certificate.
- [ ] Provision/verify the actual Wiki subdomain and static Wiki origin.
- [ ] Verify the canonical CDN image origin over DNS and HTTPS with real image requests.
- [ ] Verify CDN GET/HEAD-only behavior and absence of public writes.
- [ ] Verify Cache-Control/browser cache behavior with mutable existing filenames.
- [ ] Verify WWW session cookie is `Secure` behind the actual TLS proxy.
- [ ] Verify `/api/events` is not buffered by the production reverse proxy.
- [ ] Verify old media/Wiki URLs redirect without loops and preserve important paths.
- [ ] Verify no CORS, cookie or mixed-content errors in browser devtools.
- [ ] Verify Wiki makes no requests to the WWW CDN for Wiki-owned resources.
- [ ] After all checks pass, optionally switch browser image generation from compatibility redirects to direct CDN URLs.
- [ ] Only then remove `assets/client`, `manifests/www`, obsolete hosts and redundant DNS/proxy rules in separate cleanup changes.
