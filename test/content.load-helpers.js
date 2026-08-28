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
  if (global.chrome && global.chrome.__mockState) global.chrome.__mockState.reset();
}

/**
 * Stand in for the worker's gws-host-check reply.
 * `answer` is a boolean, or 'unreachable' to simulate a dead worker.
 */
function mockWorkerGrant(answer) {
  global.chrome.runtime.sendMessage = jest.fn((message, cb) => {
    if (answer === 'unreachable') {
      // Chrome surfaces this as lastError plus an undefined response.
      if (typeof cb === 'function') cb(undefined);
      return Promise.reject(new Error('Could not establish connection'));
    }
    const res = { granted: !!answer };
    if (typeof cb === 'function') cb(res);
    return Promise.resolve(res);
  });
  return global.chrome.runtime.sendMessage;
}

/** Require a fresh copy of content.js. Returns its exports. */
function loadContent() {
  jest.resetModules();
  return require('../content.js');
}

/**
 * Fire the window load event that content.js defers all decisions to, then let
 * the worker round-trip settle. Await it.
 */
function fireLoad() {
  window.dispatchEvent(new Event('load'));
  return new Promise((r) => setTimeout(r, 0));
}

function nudgeEl() {
  return document.getElementById('gws-pin-nudge');
}

module.exports = { resetWindow, mockWorkerGrant, loadContent, fireLoad, nudgeEl };
