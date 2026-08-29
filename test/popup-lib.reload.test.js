/**
 * @jest-environment jsdom
 */

// Ported from the 2.x reload helper. Finding 5: the reload used to be on a
// 1000ms timer, but the popup's JS context dies the instant the popup closes —
// which the permission prompt itself causes — so the timer never fired and the
// tab was left stale. It is immediate now.

const PopupLib = require('../popup-lib.js');

beforeEach(() => {
  jest.resetModules();
  require('./mock-extension-apis.js');
  global.chrome.__mockState.reset();
});

describe('reloadActiveTabIfMatches', () => {
  it('reloads immediately when the active tab host matches', async () => {
    global.chrome.__mockState.tabState.tabs = [
      { id: 321, url: 'https://abc-github.cloud.xyz/owner/repo/pull/1/files' },
    ];

    const matched = await PopupLib.reloadActiveTabIfMatches(
      global.chrome,
      'abc-github.cloud.xyz'
    );
    expect(matched).toBe(true);
    // No timer advance: the reload has already happened.
    expect(global.chrome.tabs.reload).toHaveBeenCalledWith(321);
  });

  it('does not reload when the active tab does not match', async () => {
    global.chrome.__mockState.tabState.tabs = [{ id: 321, url: 'https://example.com' }];

    const matched = await PopupLib.reloadActiveTabIfMatches(
      global.chrome,
      'abc-github.cloud.xyz'
    );
    expect(matched).toBe(false);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('treats a covering wildcard host as a match', async () => {
    global.chrome.__mockState.tabState.tabs = [
      { id: 9, url: 'https://code.corp.example/owner/repo/pull/1/files' },
    ];
    const matched = await PopupLib.reloadActiveTabIfMatches(global.chrome, '*.corp.example');
    expect(matched).toBe(true);
    expect(global.chrome.tabs.reload).toHaveBeenCalledWith(9);
  });
});

describe('reloadTabsForOrigin (worker fix-up path)', () => {
  it('reloads every tab the newly granted origin covers', async () => {
    global.chrome.__mockState.tabState.tabs = [
      { id: 1, url: 'https://ghe.corp.example/owner/repo/pull/1/files' },
      { id: 2, url: 'https://ghe.corp.example/owner/repo/pull/2/files' },
      { id: 3, url: 'https://unrelated.example/x' },
    ];

    await PopupLib.reloadTabsForOrigin(global.chrome, 'https://ghe.corp.example/*');
    expect(global.chrome.__mockState.tabState.reloaded).toEqual([1, 2]);
  });

  it('is a no-op for an origin with no open tabs', async () => {
    global.chrome.__mockState.tabState.tabs = [{ id: 3, url: 'https://unrelated.example/x' }];
    await PopupLib.reloadTabsForOrigin(global.chrome, 'https://ghe.corp.example/*');
    expect(global.chrome.__mockState.tabState.reloaded).toEqual([]);
  });
});
