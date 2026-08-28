/**
 * Shared helpers for the content.js jsdom unit tests.
 *
 * content.js is a classic content script wrapped in an IIFE with a once-guard,
 * so each scenario needs a pristine window flag state plus a fresh require.
 */

// jsdom keeps one window per test file, so load listeners installed by an
// earlier scenario would still fire in the next one. Track and detach them.
const trackedLoadListeners = [];
const nativeAddEventListener = window.addEventListener.bind(window);
window.addEventListener = function (type, fn, opts) {
  if (type === 'load') trackedLoadListeners.push(fn);
  return nativeAddEventListener(type, fn, opts);
};

function resetWindow(href) {
  while (trackedLoadListeners.length) {
    window.removeEventListener('load', trackedLoadListeners.pop());
  }
  delete window.__gwsLoaded;
  delete window.__gwsGranted;
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
  document.body.innerHTML = '';
  window.history.replaceState = jest.fn();
  try {
    window.localStorage.clear();
  } catch (_) {}
}

/** Require a fresh copy of content.js. Returns its exports. */
function loadContent() {
  jest.resetModules();
  return require('../content.js');
}

/** Fire the window load event that content.js defers all decisions to. */
function fireLoad() {
  window.dispatchEvent(new Event('load'));
}

function nudgeEl() {
  return document.getElementById('gws-pin-nudge');
}

module.exports = { resetWindow, loadContent, fireLoad, nudgeEl };
