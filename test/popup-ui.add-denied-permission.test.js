/**
 * @jest-environment jsdom
 */

describe('popup add host denied permission edge case', () => {
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

  test('denied permission does not add and clears pending', async () => {
    // Force deny grant for origins
    const origRequest = global.chrome.permissions.request;
    global.chrome.permissions.request = jest.fn((req, cb) => cb(false));

    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    // Attempt to add
    const input = document.getElementById('host');
    input.value = 'https://abc.example.com';
    const addBtn = document.getElementById('add');
    addBtn.click();

    await new Promise((r) => setTimeout(r, 20));

    // No items should be added
    expect(document.querySelectorAll('#list li').length).toBe(0);

    // pendingHost should be null, extraHosts remains []
    const storage = await new Promise((r) => global.chrome.storage.sync.get({ pendingHost: null, extraHosts: [] }, (v) => r(v)));
    expect(storage.pendingHost).toBe(null);
    expect(storage.extraHosts).toEqual([]);

    // Message shown
    const msg = document.getElementById('msg');
    expect(msg.textContent).toMatch(/Permission not granted/i);

    // Restore original
    global.chrome.permissions.request = origRequest;
  });
});
