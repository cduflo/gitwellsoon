/**
 * @jest-environment jsdom
 */

const PopupLib = require('../popup-lib.js');

describe('popup remove triggers reload and updates storage', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    document.body.innerHTML = `
      <div id="hosts-card"></div>
      <div id="hosts-nudge"></div>
      <span id="status-dot"></span>
      <span id="status-text"></span>
      <button id="storage-switch" aria-checked="true"></button>
      <button id="tabs-switch" aria-checked="true"></button>
      <div class="input-wrap">
        <input id="host" />
        <button id="clear-host"></button>
      </div>
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
    // Grant tabs permission
    global.chrome.permissions.request({ permissions: ['tabs'] }, () => {});
  });

  test('remove updates storage and schedules reload if active tab matches', async () => {
    const spy = jest.spyOn(PopupLib, 'scheduleReloadIfActiveMatches').mockResolvedValue(true);

    // Seed storage and origins
    await new Promise((r) => global.chrome.storage.sync.set({ extraHosts: ['abc-github.cloud.xyz'] }, () => r()));
    await new Promise((r) => global.chrome.permissions.request({ origins: ['https://abc-github.cloud.xyz/*'] }, () => r()));

    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const items = document.querySelectorAll('#list li');
    expect(items.length).toBe(1);

    // Click Remove
    const removeBtn = items[0].querySelector('button');
    removeBtn.click();
    await new Promise((r) => setTimeout(r, 30));

    const after = await new Promise((r) => global.chrome.storage.sync.get({ extraHosts: [] }, (v) => r(v.extraHosts)));
    expect(after).toEqual([]);
    expect(spy).toHaveBeenCalledWith(global.chrome, 'abc-github.cloud.xyz', 1000);

    spy.mockRestore();
  });
});
