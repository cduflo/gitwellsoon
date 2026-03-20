## Git Well Soon

![128x128](https://user-images.githubusercontent.com/15986207/199504950-32051d31-0a9d-4e79-8a5c-aeb207d3f746.png)

[GET IT in the Chrome App Store](https://chrome.google.com/webstore/detail/git-well-soon/ehpeaofieafibmhiagianfjjblpnmbdo)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z11M8JYN)

### About

Git Well Soon is a Chrome extension that automatically persists the 'Hide whitespace changes' setting when reviewing pull requests on GitHub and GitHub Enterprise instances.

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
  - Required: `storage` (enables saving your custom hosts in `chrome.storage.sync` under `extraHosts`).
  - Optional host origins (requested at runtime when you add a host via the popup).
  - Optional: `tabs` (requested from the popup only if you enable it; used to prefill the input with the active tab’s host and to auto-reload the active tab after enabling Tabs or after add/remove of a host). No background/service worker and no scripting permission.
- Content script scope: Runs on GitHub and, once granted, on your enterprise host(s) for PR files/changes, compare, commits, and commit pages. The logic is gated by an allowlist (`github.com` and typical GitHub-like hosts by default; your custom hosts are matched from `extraHosts`).
- Popup behavior:
  - Add/remove hosts; host list updates immediately; clear button always visible; input can prefill from the active tab if Tabs permission is granted.
  - If the Chrome permission prompt closes the popup, the pending add is finalized upon reopening (no second click).
- Implementation notes:
  - `listGrantedHosts` enumerates granted origins and excludes built-in GitHub hosts and wildcard-only hostnames.
  - `scheduleReloadIfActiveMatches` reloads the active tab (when Tabs is granted) if the hostname matches the host that was just added/removed.
- Tests & Dev:
  - All tests live in `test/`; UI and library coverage added; e2e tests hardened for SPA navigation and offline scenarios.
  - Local dev site under `site/` with a tiny server `scripts/dev-site.js`. Start with `npm run start:site` and (optionally) tunnel via `ngrok http 8080`.

The extension was created in response to a GitHub community issue where users requested persistent whitespace settings: [GitHub Community Discussion #5486](https://github.com/community/community/discussions/5486).

### Usage

Simply install the extension and browse GitHub pull requests as usual. The whitespace hiding is enabled by default and will be automatically applied to all pull request file views.

### Enterprise hosts

The extension targets some known GitHub Enterprise url patterns, but you can manually add your specific GitHub Enterprise url domain by:

1. Click the extension’s toolbar icon to open the popup.
2. Enable the required `Storage` permission, so the extension can save and manage your list of hosts.
3. Optionally, enable the `Tabs` permission, so the extension can intelligently reload and auto-fill host names. Again, this is an optional permission to enable nice-to-have features.
4. Enter your host (for example: `https://github.company.com`) and click Add.
5. Reload the target tab; `w=1` will be applied on PR files/compare/commit(s) routes on that host.

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

3. Grant the host in the extension popup

- Open the popup, enter exactly the host shown by ngrok, e.g. `https://1234567890.ngrok-free.app`, and click Add.
- Accept the permission prompt. If the Chrome permission prompt closes the popup, just reopen it; the host will finalize automatically.
- If you enable Tabs permission, the current tab will auto-reload after granting.

4. Navigate to the simulated PR files or changes URL

- Visit: `https://1234567890.ngrok-free.app/owner/repo/pull/123/files` or `https://1234567890.ngrok-free.app/owner/repo/pull/123/changes`
- The extension should append `?w=1` to the URL automatically.

What to verify:

- Adding/removing the host updates the popup list immediately (no manual refresh).
- With Tabs permission enabled, the active tab auto-reloads after add/remove.
- Storage permission off disables input and clears the list display; turning it back on restores the list.

Troubleshooting:

- If input doesn’t prefill with the current host, enable Tabs permission.
- If add appears to require a second click, just reopen the popup—pending adds are finalized automatically.
- Make sure you add the exact ngrok subdomain (no wildcards).
