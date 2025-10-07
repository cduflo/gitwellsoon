/**
 * @jest-environment jsdom
 */

describe('popup pending-add finalize', () => {
  beforeEach(() => {
    jest.resetModules();
    // Ensure mocks are initialized fresh
    require('./mock-extension-apis.js');
    // Minimal DOM from popup.html
    document.body.innerHTML = `
      <div id="hosts-card"></div>
      <div id="hosts-nudge"></div>
      <span id="status-dot"></span>
      <span id="status-text"></span>
      <button id="storage-switch"></button>
      <button id="tabs-switch"></button>
      <input id="host" />
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
  });

  test('finalizes a pending host if permission granted while popup was closed', async () => {
    // Pre-grant the origin and set pendingHost in storage
    await new Promise((r) => global.chrome.permissions.request({ origins: ['https://abc.example.com/*'] }, () => r()));
    await new Promise((r) => global.chrome.storage.sync.set({ pendingHost: 'abc.example.com', extraHosts: [] }, () => r()));

    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Allow async callbacks to run
    await new Promise((r) => setTimeout(r, 10));

    const items = document.querySelectorAll('#list li');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.host').textContent).toBe('https://abc.example.com');

    // pendingHost should be cleared and extraHosts should include the host
    const storage = await new Promise((r) => global.chrome.storage.sync.get({ pendingHost: null, extraHosts: [] }, (v) => r(v)));
    expect(storage.pendingHost).toBe(null);
    expect(storage.extraHosts).toEqual(['abc.example.com']);
  });
});