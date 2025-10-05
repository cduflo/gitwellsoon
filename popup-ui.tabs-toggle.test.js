/**
 * @jest-environment jsdom
 */

describe('popup tabs permission toggle', () => {
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
      <input id="host" />
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
  });

  test('tabs switch toggles aria-checked and permission state', async () => {
    require('./popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const tabsSwitch = document.getElementById('tabs-switch');

    // Initially off
    expect(tabsSwitch.getAttribute('aria-checked')).toBe('false');
    expect(global.chrome.__mockState.permState.permissions.has('tabs')).toBe(false);

    // Toggle on
    tabsSwitch.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(tabsSwitch.getAttribute('aria-checked')).toBe('true');
    expect(global.chrome.__mockState.permState.permissions.has('tabs')).toBe(true);

    // Toggle off
    tabsSwitch.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(tabsSwitch.getAttribute('aria-checked')).toBe('false');
    expect(global.chrome.__mockState.permState.permissions.has('tabs')).toBe(false);
  });
});