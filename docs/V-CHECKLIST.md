# V3.1 verification checklist

Tracks the open verification items from `docs/V3.1-DESIGN.md` §9. Each item is
either **automated-verified** (covered by `npx jest test/e2e.test.js`, which
launches headful Chrome with the unpacked extension) or **manually-pending**
with the exact steps to run before submitting to the Chrome Web Store.

Nothing here is marked verified on the strength of documentation or reasoning
alone — only on an observation from the running browser.

| Item | Status |
|---|---|
| V-1 activeTab gives the popup the active tab URL | manually-pending |
| V-2 scripting + activeTab produce no install warning | manually-pending |
| V-3 removing granted optional permissions is silent | manually-pending |
| V-4 current CWS listing shows the all-sites warning | manually-pending |
| V-5 onInstalled timing vs. an immediate page load | automated-verified (proxy) + manually-pending (granted half) |
| V-6 popup-registered scripts persist across restart | manually-pending |
| ngrok GHE end-to-end flow | partially automated; grant half manually-pending |

---

## Automated

### V-5 — extension reload then immediate navigation

`test/e2e.test.js` → *"V-5 extension reload then immediate navigation"*.
Launches a dedicated browser, calls `chrome.runtime.reload()` from the service
worker, then navigates to a GitHub PR files URL with no settling delay and
asserts `w=1` is still applied.

This covers the cohort that matters most: everyone served by the broad manifest
matches, who must not notice the update at all. It does **not** cover the
granted-origin half of V-5 (does `onInstalled` finish re-registering before a
same-instant load on a *granted* GHE host), because granting an origin needs the
native permission prompt — see the manual step below.

### Supporting real-Chrome observations (same e2e run)

- The MV3 service worker loads and `chrome.permissions.getAll()` reports exactly
  `scripting` and `activeTab` — no `storage`, no `tabs`.
- `importScripts('popup-lib.js')` works in the worker, so the worker and the
  popup genuinely share one host classifier and one registration spec.
- `chrome.scripting.getRegisteredContentScripts()` is empty on a profile with no
  grants, i.e. the extension registers nothing it was not told to.
- `popup.html` + `popup.js` render state 1 with an empty host list in a real
  extension context.
- No pin nudge renders on `github.com` (a built-in host).

### ngrok GHE flow — automated half

Verified on 2026-08-28 against a live `https://*.ngrok-free.app` tunnel serving
`site/` (`npm run start:site` + `ngrok http 8080`):

- An ungranted, non-GitHub-like https host with a GitHub-shaped path
  (`/owner/repo/pull/123/files`) is left completely alone: URL unchanged, no
  nudge.
- The popup classifies that host as state 4 "Enable on &lt;host&gt;" (not
  built-in, not heuristic-matched, not granted).
- `chrome.scripting.registerContentScripts()` is *accepted* for an origin the
  extension has not been granted, but the script does **not** inject, and the
  worker cannot even see the tab's URL. Injection follows the host permission,
  not the registration. This confirms the popup's ordering (request the grant
  first, then register) and means a stale registration is inert rather than a
  privacy leak.

> Note on measurement: `page.evaluate()` runs in the page's **main** world, so it
> can never observe `window.__gwsLoaded` / `window.__gwsGranted`, which live in
> the extension's isolated world. Any check of those flags from puppeteer must go
> through `chrome.scripting.executeScript({ world: 'ISOLATED' })` from the
> worker — which itself needs the host permission. Do not read a `false` from
> `page.evaluate` as evidence that the content script did not inject.

---

## Manually pending

Build first: `npm run build`, then load `dist/` (or the repo root) via
`chrome://extensions` → *Load unpacked*.

### V-1 — activeTab gives the popup the active tab URL

The whole popup design rests on this, and it cannot be automated: `activeTab` is
granted by a real click on the toolbar icon, which puppeteer cannot perform.

1. Load the unpacked extension. Confirm `tabs` is **not** in the manifest.
2. Navigate a tab to `https://github.com/mui/material-ui/pull/45606/files`.
3. Click the toolbar icon to open the popup.
4. Expect: **"✓ Active on github.com"** and no button (state 2).
5. Right-click the popup → Inspect → console:
   `chrome.tabs.query({active:true,currentWindow:true}).then(t => console.log(t[0].url))`
6. **Pass**: the full URL is logged. **Fail**: `undefined` — fall back to
   re-adding optional `tabs` (warning-free, but resurrects a toggle).

### V-2 — no install/update warning for scripting + activeTab

1. Remove the extension. Load it unpacked again on a clean profile.
2. Read the install prompt and `chrome://extensions` → *Details*.
3. **Pass**: the only site-access warning is the pre-existing all-sites one from
   the broad content-script matches; `scripting` and `activeTab` add nothing.

### V-3 — removing granted optional permissions is silent

1. Check out the 2.x/3.0 manifest, load it unpacked, open the popup and grant
   **both** the Storage and Tabs switches.
2. Swap in the 3.1 build (which declares no `optional_permissions`) and hit
   *Reload* on the extension card.
3. **Pass**: no prompt, no disable, the extension stays enabled and working.
   **Fail**: 3.1 is not a silent update and must be re-sequenced.

### V-4 — the current CWS listing shows the all-sites warning

Open the public listing's *Permissions* section, or install from the store on a
clean profile, and record the exact warning text. This is the baseline that 3.2
would shrink — it changes nothing about 3.1.

### V-5 — granted half

1. Complete the grant flow below on a GHE-like host.
2. Hit *Reload* on the extension card and, without waiting, navigate that host
   to a `/owner/repo/pull/N/files` URL.
3. **Pass**: `w=1` is applied. **Accepted**: one missed page load that
   self-heals on the next navigation (design §5).

### V-6 — popup-registered scripts persist across a browser restart

1. Complete the grant flow below (the popup, not the worker, does the
   registration).
2. Quit Chrome entirely and reopen it.
3. In the service worker console:
   `chrome.scripting.getRegisteredContentScripts().then(console.log)`
4. **Pass**: `gws-<host>` is still listed with `persistAcrossSessions: true`.

### ngrok GHE flow — grant half

The native permission prompt is browser UI, not page content, so puppeteer
cannot accept it. Run this by hand:

1. `npm run start:site` (serves `site/` on :8080).
2. `ngrok http 8080` — note the `https://….ngrok-free.app` URL.
   (`optional_host_permissions` is https-only, so a localhost http origin cannot
   substitute for the tunnel.)
3. Visit `https://….ngrok-free.app/owner/repo/pull/123/files`.
4. Click the toolbar icon. Expect state 4: **"Enable on ….ngrok-free.app"**.
5. Click it and **accept** the Chrome permission prompt.
6. Expect: the tab reloads within ~1s, `?w=1` is appended, the popup now shows
   **"✓ Active on …"** with a **Disable** button, and the host appears in the
   Enabled hosts list.
7. In the service worker console, confirm `gws-….ngrok-free.app` is registered.
8. Click **Disable**. Expect: the grant is revoked, the registration is dropped,
   the tab reloads and `w=1` is no longer applied on a fresh navigation.

### Double-injection sanity check (hazard 1)

While a host from the ngrok flow is granted, and therefore matched by both the
broad manifest patterns and the dynamic registration:

1. Open the page's devtools console and select the extension's isolated world in
   the context dropdown.
2. Run `window.__gwsLoaded` → `true`, `window.__gwsGranted` → `true`.
3. **Pass**: `w=1` is applied exactly once, no duplicated nudge, and no
   `SyntaxError: Identifier … has already been declared` anywhere in the
   console. (The IIFE + once-guard exists precisely to prevent that error: two
   injections of the same file share one isolated world and one global lexical
   scope.)
