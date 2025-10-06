/**
 * @jest-environment jsdom
 */

const PopupLib = require('./popup-lib.js');

describe('scheduleReloadIfActiveMatches edge cases', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
  });

  test('returns false when there is no active tab', async () => {
    global.chrome.tabs.query.mockImplementation((q, cb) => cb([]));
    const matched = await PopupLib.scheduleReloadIfActiveMatches(global.chrome, 'abc.example.com', 1000);
    expect(matched).toBe(false);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });

  test('returns false for invalid tab URL', async () => {
    global.chrome.tabs.query.mockImplementation((q, cb) => cb([{ id: 1, url: '::::' }]));
    const matched = await PopupLib.scheduleReloadIfActiveMatches(global.chrome, 'abc.example.com', 1000);
    expect(matched).toBe(false);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });
});