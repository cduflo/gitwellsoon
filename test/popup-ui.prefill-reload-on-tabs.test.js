/**
 * @jest-environment jsdom
 */

describe('popup prefill and reload on enabling tabs', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    document.body.innerHTML = `
      <div id="hosts-card"></div>
      <div id="hosts-nudge"></div>
      <span id="status-dot"></span>
      <span id="status-text"></span>
      <button id="storage-switch" aria-checked="true"></button>
      <button id="tabs-switch" aria-checked="false"></button>
      <div class="input-wrap">
        <input id="host" />
        <button id="clear-host"></button>
      </div>
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
  });

  test('enabling tabs pre-fills host if input empty and reloads tab', async () => {
    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 20));

    const input = document.getElementById('host');
    const tabsSwitch = document.getElementById('tabs-switch');

    expect(input.value).toBe('');
    tabsSwitch.click();

    // wait for prefill and delayed reload
    await new Promise((r) => setTimeout(r, 500));

    expect(input.value).toBe('https://abc-github.cloud.xyz');
    expect(global.chrome.tabs.reload).toHaveBeenCalledWith(123);
  });
});
