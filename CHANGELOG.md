# Changelog

All notable changes to this project will be documented in this file.

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
