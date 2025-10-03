/**
 * @jest-environment jsdom
 */

const PopupLib = require('./popup-lib.js');

jest.useFakeTimers();

beforeEach(() => {
  jest.resetModules();
  require('./mock-extension-apis.js');
});

describe('scheduleReloadIfActiveMatches', () => {
  it('schedules reload when active tab host matches', async () => {
    // Active tab matches host
    global.chrome.tabs.query.mockImplementation((q, cb) => cb([{ id: 321, url: 'https://abc-github.cloud.xyz/owner/repo/pull/1/files' }]));

    const matched = await PopupLib.scheduleReloadIfActiveMatches(global.chrome, 'abc-github.cloud.xyz', 3000);
    expect(matched).toBe(true);

    jest.advanceTimersByTime(3000);
    expect(global.chrome.tabs.reload).toHaveBeenCalledWith(321);
  });

  it('does not reload when active tab does not match', async () => {
    global.chrome.tabs.query.mockImplementation((q, cb) => cb([{ id: 321, url: 'https://example.com' }]));

    const matched = await PopupLib.scheduleReloadIfActiveMatches(global.chrome, 'abc-github.cloud.xyz', 3000);
    expect(matched).toBe(false);

    jest.advanceTimersByTime(3000);
    expect(global.chrome.tabs.reload).not.toHaveBeenCalled();
  });
});
