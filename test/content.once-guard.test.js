/**
 * @jest-environment jsdom
 */

// On a granted host that ALSO matches the broad manifest patterns, content.js
// is injected twice (manifest match and dynamic registration are independent).
// The two injections share one isolated world, so the second execution must be
// a no-op: no duplicate listeners, no duplicate top-level declarations.

const { resetWindow, loadContent, fireLoad } = require('./content.load-helpers.js');

describe('content.js once-guard', () => {
  beforeEach(() => {
    resetWindow('https://github.company.com/owner/repo/pull/1/files');
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

  test('a doubly-injected page still applies w=1 exactly once', () => {
    loadContent();
    loadContent();
    fireLoad();
    expect(window.history.replaceState).toHaveBeenCalledTimes(1);
  });

  test('re-executing does not throw on top-level redeclaration', () => {
    loadContent();
    expect(() => loadContent()).not.toThrow();
  });
});
