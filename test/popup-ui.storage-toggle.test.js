/**
 * @jest-environment jsdom
 */

describe('popup storage permission toggle restores list', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    document.body.innerHTML = `
      <div id="hosts-card"></div>
      <div id="hosts-nudge"></div>
      <span id="status-dot"></span>
      <span id="status-text"></span>
      <button id="storage-switch" aria-checked="true"></button>
      <button id="tabs-switch"></button>
      <input id="host" />
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
  });

  test('list clears when storage off and returns when storage back on', async () => {
    // Seed storage
    await new Promise((r) => global.chrome.storage.sync.set({ extraHosts: ['abc.example.com'] }, () => r()));

    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    // Initially shows 1 item
    expect(document.querySelectorAll('#list li').length).toBe(1);

    const storageSwitch = document.getElementById('storage-switch');

    // Toggle storage off
    storageSwitch.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelectorAll('#list li').length).toBe(0);

    // Toggle storage on
    storageSwitch.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelectorAll('#list li').length).toBe(1);
  });
});