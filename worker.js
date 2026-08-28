// Git Well Soon 3.1 — minimal service worker. Two events, no state.
//
// Dynamic content-script registrations do NOT survive an extension update, but
// granted origins do. So on every install/update and browser startup we rebuild
// the registrations from chrome.permissions, which is the sole source of truth
// (the 2.x `extraHosts` storage key dies unread — see docs/V3.1-DESIGN.md §5).
//
// Deliberately does NOT: handle messages, track tabs, use webNavigation,
// storage or alarms, or hold any state. The popup registers its own grants, so
// no user flow waits on this worker.
importScripts('popup-lib.js');

async function syncRegistrations() {
  try {
    const hosts = await PopupLib.listGrantedHosts(chrome);
    await PopupLib.unregisterHosts(chrome); // clears grants revoked since last run
    await PopupLib.registerHosts(chrome, hosts);
    return hosts;
  } catch (_) {
    return [];
  }
}

chrome.runtime.onInstalled.addListener(() => syncRegistrations());
chrome.runtime.onStartup.addListener(() => syncRegistrations());
