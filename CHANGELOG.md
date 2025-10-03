# Changelog

All notable changes to this project will be documented in this file.

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
- WARP.md updated with MV3 context and runtime host permissions notes.

Testing
- Added unit tests for allowlist and isAllowedHost.
- Existing E2E tests validated against public GitHub.
