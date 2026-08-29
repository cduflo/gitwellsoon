/**
 * @jest-environment jsdom
 */

const PopupLib = require('../popup-lib.js');

describe('reloadActiveTabIfMatches edge cases', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
  });

  test('returns false when there is no active tab', async () => {
    global.chrome.__mockState.tabState.tabs = [];
    const matched = await PopupLib.reloadActiveTabIfMatches(global.chrome, 'abc.example.com');
    expect(matched).toBe(false);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });

  test('returns false for an invalid tab URL', async () => {
    global.chrome.__mockState.tabState.tabs = [{ id: 1, url: '::::' }];
    const matched = await PopupLib.reloadActiveTabIfMatches(global.chrome, 'abc.example.com');
    expect(matched).toBe(false);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });

  test('survives a tabs API that throws', async () => {
    global.chrome.tabs.query.mockImplementation(() => {
      throw new Error('no access');
    });
    const matched = await PopupLib.reloadActiveTabIfMatches(global.chrome, 'abc.example.com');
    expect(matched).toBe(false);
  });
});
