/**
 * @jest-environment jsdom
 */

// On a granted host that ALSO matches the broad manifest patterns, content.js
// is injected twice (manifest match and dynamic registration are independent).
// The two injections share one isolated world, so the second execution must be
// a no-op: no duplicate listeners, no duplicate top-level declarations.

const {
  resetWindow,
  mockWorkerGrant,
  loadContent,
  fireLoad,
} = require('./content.load-helpers.js');

describe('content.js once-guard', () => {
  beforeEach(() => {
    resetWindow('https://github.company.com/owner/repo/pull/1/files');
    mockWorkerGrant(false);
  });

  test('first execution marks the world and installs its load listener', () => {
    const spy = jest.spyOn(window, 'addEventListener');
    const api = loadContent();
    expect(window.__gwsLoaded).toBe(true);
    expect(spy.mock.calls.some((c) => c[0] === 'load')).toBe(true);
    expect(typeof api.isGitHubSite).toBe('function');
    spy.mockRestore();
  });

  test('second execution in the same world installs nothing', () => {
    loadContent();
    const spy = jest.spyOn(window, 'addEventListener');
    loadContent(); // simulates the second injection
    expect(spy.mock.calls.some((c) => c[0] === 'load')).toBe(false);
    spy.mockRestore();
  });

  test('a doubly-injected page still applies w=1 exactly once', async () => {
    loadContent();
    loadContent();
    // jsdom dispatches its own window 'load' once per test file, which would
    // otherwise be counted here. Let it settle, then measure only our dispatch.
    await new Promise((r) => setTimeout(r, 5));
    const before = window.history.replaceState.mock.calls.length;

    await fireLoad();

    expect(window.history.replaceState.mock.calls.length - before).toBe(1);
  });

  test('re-executing does not throw on top-level redeclaration', () => {
    loadContent();
    expect(() => loadContent()).not.toThrow();
  });
});
