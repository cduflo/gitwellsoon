# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2026-08-28

Permission-surface overhaul. See `docs/V3.1-DESIGN.md` for the decision record
and `docs/V-CHECKLIST.md` for the pre-submission verification status.

Added
- Minimal service worker (`worker.js`): on install/update and browser startup it
  rebuilds the dynamic content-script registrations from `chrome.permissions`.
  Two events, no state — no messaging, no tab tracking, no storage, no alarms.
- `granted-marker.js`, injected ahead of `content.js` on granted origins only.
  It is how the content script tells "running under an explicit grant" from
  "running via a broad manifest match plus the hostname heuristic" without a
  round-trip to the worker.
- One-click popup: the current tab is either already active, offers a single
  Enable/Pin button, or offers Disable. Granted hosts are listed with a Remove
  action, because chrome://extensions "Site access" is the only alternative and
  it is undiscoverable.
- In-page pin nudge: one small dismissible banner on heuristic-matched
  enterprise hosts, pointing at the popup. Renders only on a diff view, only
  when there is no explicit grant, never on a built-in GitHub host, and never
  again on a domain once dismissed. Dismissal is remembered in the page's own
  `localStorage` under `gws-pin-nudge`.

Changed
- Permissions: `scripting` and `activeTab` are now required; the optional
  `storage` and `tabs` permissions are gone. Both additions are warning-free and
  the removals are silent, so 3.1 is a zero-warning-delta update.
- Granted origins are the sole source of truth. The `extraHosts` storage key is
  no longer read or written by anything.
- Content-script match patterns are unchanged, deliberately: narrowing them
  would silently break every enterprise user who works today via the hostname
  heuristic and has no grant to migrate.
- `content.js` is wrapped in an IIFE with a once-guard. On a granted host both
  the broad manifest match and the dynamic registration inject it, the two
  executions share one isolated world, and without the guard the second would
  throw on redeclaring its top-level bindings.

Fixed
- A host added while the Storage permission was off granted the origin but never
  persisted, so the feature silently never worked on that host unless it was
  heuristic-matched. Origins-as-truth repairs those users.

Removed
- Storage and Tabs permission switches, free-text host entry and its whole
  parse/validate/duplicate error surface, pending-add persistence (an
  interrupted grant now self-heals, because the popup re-derives its state from
  `chrome.permissions` on reopen), storage load/save, and input prefill.
- A host can now only be enabled while you are visiting it. That is the natural
  moment, and it deletes the entire input-validation surface.

Not planned
- Narrowing the content-script matches to the three GitHub hosts (the "3.2"
  change) is **not** scheduled. Un-narrowing re-adds a wildcard host match,
  which is a permission-warning *increase*: Chrome disables the extension for
  every user until each of them manually re-approves it. Narrowing is cheap to
  ship and catastrophic to revert, so it needs a compelling trigger — store
  policy pressure, or high confidence that the heuristic cohort has converted —
  rather than a date. See design §7 for the evidence bar.

Testing
- New: worker registration/migration units, marker-gating units, once-guard
  units, nudge units, popup state-machine and enable/disable units.
- Retired with their features: both permission-toggle suites, pending-add,
  add-duplicate, add-denied-permission, clear-button, prefill-reload-on-tabs,
  both parseHostInput suites, syncHosts, and the extraHosts allowlist test.
- E2E: fixed the extension-target lookup, which broke the moment a service
  worker existed, and switched the suite to a single browser. Added real-Chrome
  checks for the worker's permission set, the shared registration spec, the
  popup's rendered state, and V-5.

---

## [Unreleased]

Added
- Popup improvements: Storage and Tabs permission switches; input clear button (always visible); input prefill with current tab host (when Tabs is granted).
- Auto-reload flow: when enabling Tabs permission and after add/remove of a host (if Tabs is granted).
- Pending add finalize: if the Chrome permission prompt closes the popup, the host is finalized on next open.
- 8px border radius and visual polish for the popup; switch alignment fixes.
- Local dev site under `site/` and `scripts/dev-site.js` for quick testing; `npm run start:site`.
- Ngrok testing workflow documented in README.

Changed
- Removed "Copy" action from the host list.
- Input overflow and layout tightened (border-box, flex fixes).
- Host remove now reliably updates storage and UI immediately.
- `listGrantedHosts` now filters only wildcard hostnames (e.g., `https://*/*`), not all origins that contain `*` anywhere.
- Test layout consolidated under `test/`; root shims removed; puppeteer config under `test/`.

Fixed
- Popup list not updating after adding a host without manual refresh.
- Remove button not working under certain states.
- SPA navigation e2e flakiness; offline/timeout handling for external host tests.

Testing
- Significant UI and library test coverage added (tabs toggle, storage toggle, pending add, remove with reload, parse edge cases, reload edge cases).
- E2E test hardened to wait for SPA navigation and gracefully skip when offline.

---

## [2.1.0] - 2025-01-XX

Added
- Support for GitHub's new `/changes` URL pattern for pull request file changes preview (in addition to existing `/files` pattern)

Fixed
- Extension now activates on both `/files` and `/changes` pull request URLs

---

## [2.0.0] - 2025-10-03

Added
- Toolbar popup (action) to manage enterprise “GitHub-like” hosts.
- Runtime per-site host permission flow via the popup (no scripting permission).
- New 16x16 and 48x48 icons; manifest updated to reference them.

Changed
- Permissions posture: now uses "storage" permission and optional host permissions requested at runtime; still no background/service worker.
- Broadened content script match patterns to support typical GitHub routes on enterprise hosts (path-scoped), while gating behavior via allowlist at runtime.
- Version bumped to 2.0.0 (manifest 2.0.0.0, package.json 2.0.0).

Fixed
- URL matchers for enterprise paths (/owner/repo/pull|compare|commits|commit) to ensure correct injection once a host is granted.

Docs
- README updated to reflect the permissions and enterprise host workflow.

Testing
- Added unit tests for allowlist and isAllowedHost.
- Existing E2E tests validated against public GitHub.
