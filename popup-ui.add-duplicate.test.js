/**
 * @jest-environment jsdom
 */

describe('popup add duplicate host behavior', () => {
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

  test('adding the same host twice shows error and does not duplicate', async () => {
    require('./popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const input = document.getElementById('host');
    const addBtn = document.getElementById('add');

    input.value = 'https://abc.example.com';
    addBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    // second add
    input.value = 'https://abc.example.com';
    addBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    const items = document.querySelectorAll('#list li');
    expect(items.length).toBe(1);
    expect(document.getElementById('msg').textContent).toMatch(/already added/i);
  });
});