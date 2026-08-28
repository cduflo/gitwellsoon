## Git Well Soon

![128x128](https://user-images.githubusercontent.com/15986207/199504950-32051d31-0a9d-4e79-8a5c-aeb207d3f746.png)

[GET IT in the Chrome App Store](https://chrome.google.com/webstore/detail/git-well-soon/ehpeaofieafibmhiagianfjjblpnmbdo)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z11M8JYN)

### About

Git Well Soon is a Chrome extension (version 3.1.0.0) that automatically persists the 'Hide whitespace changes' setting when reviewing pull requests on GitHub and GitHub Enterprise instances.

The name is cheeky way of saying I hope GitHub will implement this feature themselves and make my extension obsolete, Git Well Soon!

### Features

- **Automatic Whitespace Handling**: Automatically adds the whitespace hiding query parameter (`w=1`) to GitHub pull request URLs
- **Works with GitHub & GitHub Enterprise**: Compatible with both public GitHub and private GitHub Enterprise instances
- **User Preference Respect**: Honors manual user toggles of the whitespace setting
- **Seamless Integration**: Works behind the scenes without requiring any user configuration
- **Minimal Permissions**: Uses only the necessary permissions to function, enhancing your privacy and security

### How It Works

When you navigate to a pull request page with the `/files` or `/changes` view on GitHub or GitHub Enterprise, the extension:

1. Detects if you're on a GitHub pull request page
2. Checks if the whitespace parameter is already set
3. If not set, automatically adds `?w=1` to hide whitespace changes
4. Respects manual changes to the whitespace setting by monitoring the checkbox

### Technical Details

- Manifest: MV3
- Permissions:
  - Required: `scripting` (registers the content script on the enterprise origins you explicitly grant) and `activeTab` (reads the current tab's hostname so the popup can offer one-click enable, and reloads that tab afterwards). Both are warning-free.
  - Optional host origins, requested at runtime when you enable a host from the popup.
  - No `storage` and no `tabs` permission. Granted origins are the only place host state lives.
- Content script scope: Runs on GitHub and, once granted, on your enterprise host(s) for PR files/changes, compare, commits, and commit pages. A host is allowed to act when it carries an explicit grant, or when it matches the built-in GitHub-like hostname heuristic (`github.`, `ghe.`, `git.`), which is what keeps existing enterprise users working with no setup.
- Background: a minimal service worker (`worker.js`) that does exactly one thing — on install/update and browser startup it rebuilds the dynamic content-script registrations from your granted origins. Dynamic registrations do not survive an extension update; permissions do.
- Popup behavior (five states, derived from the active tab):
  1. Not an https page — a neutral note, no button.
  2. Built-in GitHub host — "✓ Active on &lt;host&gt;".
  3. Granted host — "✓ Active on &lt;host&gt;" plus **Disable**.
  4. Ungranted host — **Enable on &lt;host&gt;**, or **Pin permission for &lt;host&gt;** if the host already works via the heuristic.
  5. Below that, the list of granted hosts, each with **Remove**.
  A host can only be enabled while you are visiting it. If the Chrome permission prompt closes the popup mid-grant, just reopen it — the popup re-derives everything from your permissions, so nothing is left half-done.
- In-page nudge: on an enterprise host that works via the heuristic but has no explicit grant, a small dismissible banner on diff pages points you at the popup. Dismissing it is remembered per domain and it never returns.
- Implementation notes:
  - `popup-lib.js` is shared by the popup (`<script>`) and the worker (`importScripts`), so both use one host classifier and one registration spec.
  - `listGrantedHosts` enumerates granted origins and excludes built-in GitHub hosts and wildcard-only hostnames.
  - `scheduleReloadIfActiveMatches` reloads the active tab if its hostname matches the host just enabled or removed.
  - `content.js` is wrapped in an IIFE with a once-guard: on a granted host it is injected twice (manifest match plus dynamic registration) into one shared isolated world, and only the first execution may install anything.
- Tests & Dev:
  - All tests live in `test/`. Unit tests: `npx jest --testPathIgnorePatterns=test/e2e.test.js`. E2E (headful Chrome against live GitHub): `npm run test:e2e`.
  - Local dev site under `site/` with a tiny server `scripts/dev-site.js`. Start with `npm run start:site` and (optionally) tunnel via `ngrok http 8080`.
  - `docs/V3.1-DESIGN.md` is the 3.1 decision record; `docs/V-CHECKLIST.md` tracks what still needs a manual pass in real Chrome before a store submission.

The extension was created in response to a GitHub community issue where users requested persistent whitespace settings: [GitHub Community Discussion #5486](https://github.com/community/community/discussions/5486).

### Usage

Simply install the extension and browse GitHub pull requests as usual. The whitespace hiding is enabled by default and will be automatically applied to all pull request file views.

### Enterprise hosts

The extension already works on many GitHub Enterprise hosts out of the box (anything with `github.`, `ghe.` or `git.` in the hostname). To pin permission for your host explicitly — recommended, and required for hosts that don't match those patterns:

1. Visit a pull request page on your enterprise host.
2. Click the extension’s toolbar icon.
3. Click **Enable on &lt;host&gt;** (or **Pin permission for &lt;host&gt;**) and accept the Chrome permission prompt.
4. The tab reloads itself and `w=1` is applied on PR files/changes, compare, commits and commit routes on that host.

To turn a host off again, open the popup on that host and click **Disable**, or use **Remove** in the Enabled hosts list.

---

### Local testing via ngrok (simulate a GHE host)

You can test the extension end-to-end against a temporary HTTPS host using ngrok. This is useful to verify optional host permissions, popup behavior, and the content script on non-github.com domains.

Prereqs:

- ngrok installed and logged in (https://ngrok.com/download)
- Any simple static server (examples below use Node or Python). macOS/Linux are fine.

Steps:

1. Run a static server on localhost:8080:

- Node (built-in): `npm run start:site` (equivalent to `node scripts/dev-site.js -p 8080`)

2. Start an HTTPS tunnel

- `ngrok http 8080`
- Note the https URL shown, e.g.: `https://1234567890.ngrok-free.app`

3. Navigate to the simulated PR files or changes URL

- Visit: `https://1234567890.ngrok-free.app/owner/repo/pull/123/files` or `https://1234567890.ngrok-free.app/owner/repo/pull/123/changes`
- Nothing happens yet: the host is not granted and does not match the GitHub-like heuristic.

4. Enable the host from the popup

- Click the toolbar icon. The popup should offer **Enable on 1234567890.ngrok-free.app**.
- Click it and accept the Chrome permission prompt. If the prompt closes the popup, just reopen it — the popup re-derives its state from your permissions.
- The tab reloads itself and `?w=1` is appended.

What to verify:

- Before granting: the URL is untouched and no banner appears.
- After granting: the popup shows "✓ Active on …" with a **Disable** button, and the host appears in the Enabled hosts list.
- In the service worker console (`chrome://extensions` → *service worker*), `chrome.scripting.getRegisteredContentScripts()` lists `gws-1234567890.ngrok-free.app`.
- **Disable** revokes the grant, drops the registration, and `w=1` is no longer applied on a fresh navigation.

Troubleshooting:

- `optional_host_permissions` is https-only, so a plain `http://localhost` origin cannot substitute for the tunnel.
- Free ngrok domains do not contain `github.`/`ghe.`/`git.`, which is exactly what makes them a good stand-in for an enterprise host that needs an explicit grant.
- The full checklist, including what still needs a manual pass, lives in `docs/V-CHECKLIST.md`.
