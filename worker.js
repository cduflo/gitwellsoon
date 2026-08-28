// Git Well Soon 3.1 — minimal service worker.
//
// Dynamic content-script registrations do NOT survive an extension update, but
// granted origins do. So the registrations are reconciled against
// chrome.permissions, which is the sole source of truth (the 2.x `extraHosts`
// storage key dies unread — see docs/V3.1-DESIGN.md §5).
//
// It answers exactly one question for content scripts (gws-host-check) and
// holds no state of its own. See the "Revisions (post-review)" section of the
// design doc for why the no-messaging stance was amended.
importScripts('popup-lib.js');

const sync = () => PopupLib.syncRegistrations(chrome);

// On EVERY worker boot, not just install/startup: a grant can land at a moment
// when neither of those events will ever fire again — the popup being closed by
// the permission prompt, or site access edited from chrome://extensions. The
// old code left those grants orphaned until the next browser restart, with the
// popup cheerfully reporting the host as active while nothing injected.
sync();

chrome.runtime.onInstalled.addListener(() => sync());
chrome.runtime.onStartup.addListener(() => sync());

chrome.permissions.onAdded.addListener(async (perms) => {
  await sync();
  // Fix up any tab already sitting on the host that was just granted.
  const origins = (perms && perms.origins) || [];
  for (const origin of origins) {
    // eslint-disable-next-line no-await-in-loop
    await PopupLib.reloadTabsForOrigin(chrome, origin);
  }
});

chrome.permissions.onRemoved.addListener(() => sync());

// A manifest-injected content script carries no marker and cannot see the
// permission list, so it asks here before going dark. This is what restores
// 2.x's subdomain coverage: a grant on corp.example still enables
// code.corp.example, which exact-match gating had silently dropped.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'gws-host-check') return undefined;
  PopupLib.isHostGranted(chrome, message.host).then(
    (granted) => sendResponse({ granted }),
    () => sendResponse({ granted: false })
  );
  return true; // response is async
});
