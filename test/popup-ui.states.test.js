/**
 * @jest-environment jsdom
 */

// Popup state machine (design §4), derived entirely from the active tab and
// chrome.permissions — no storage, no tabs permission, no free-text input.

const POPUP_DOM = `
  <div id="status"></div>
  <button id="action" hidden></button>
  <div id="msg" hidden></div>
  <div id="hosts-card" hidden>
    <div id="hosts-header">Enabled hosts</div>
    <ul id="list"></ul>
  </div>
`;

function setActiveTab(url) {
  global.chrome.__mockState.tabState.tabs = url ? [{ id: 7, url }] : [];
}

async function openPopup() {
  jest.resetModules();
  require('../popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 10));
}

const statusText = () => document.getElementById('status').textContent;
const actionBtn = () => document.getElementById('action');

describe('popup states', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = POPUP_DOM;
  });

  test('state 1: non-https page shows neutral text and no button', async () => {
    setActiveTab('chrome://extensions');
    await openPopup();
    expect(statusText()).toBe('Works on GitHub PR diff pages.');
    expect(actionBtn().hidden).toBe(true);
  });

  test('state 1: no active tab URL at all', async () => {
    setActiveTab(null);
    await openPopup();
    expect(statusText()).toBe('Works on GitHub PR diff pages.');
    expect(actionBtn().hidden).toBe(true);
  });

  test('state 2: built-in GitHub host is active with no button', async () => {
    setActiveTab('https://github.com/owner/repo/pull/1/files');
    await openPopup();
    expect(statusText()).toBe('✓ Active on github.com');
    expect(actionBtn().hidden).toBe(true);
  });

  test('state 2: *.ghe.com is built-in too', async () => {
    setActiveTab('https://acme.ghe.com/owner/repo/pull/1/files');
    await openPopup();
    expect(statusText()).toBe('✓ Active on acme.ghe.com');
    expect(actionBtn().hidden).toBe(true);
  });

  test('state 3: granted custom host is active and offers Disable', async () => {
    global.chrome.__mockState.permState.origins.add('https://code.corp.example/*');
    setActiveTab('https://code.corp.example/owner/repo/pull/1/files');
    await openPopup();
    expect(statusText()).toBe('✓ Active on code.corp.example');
    expect(actionBtn().hidden).toBe(false);
    expect(actionBtn().textContent).toBe('Disable');
  });

  test('state 3: a wildcard grant covering the tab host also reads as active', async () => {
    global.chrome.__mockState.permState.origins.add('https://*.corp.example/*');
    setActiveTab('https://code.corp.example/owner/repo/pull/1/files');
    await openPopup();
    expect(statusText()).toBe('✓ Active on code.corp.example');
    expect(actionBtn().textContent).toBe('Disable');
  });

  test('state 4: ungranted custom host offers Enable', async () => {
    setActiveTab('https://code.corp.example/owner/repo/pull/1/files');
    await openPopup();
    expect(actionBtn().hidden).toBe(false);
    expect(actionBtn().textContent).toBe('Enable on code.corp.example');
  });

  test('state 4: heuristic-matched host is phrased as a pin, matching the nudge', async () => {
    setActiveTab('https://github.corp.example/owner/repo/pull/1/files');
    await openPopup();
    expect(actionBtn().hidden).toBe(false);
    expect(actionBtn().textContent).toBe('Pin permission for github.corp.example');
    // Finding 9: it keeps working without a grant, and must say so.
    expect(statusText()).toMatch(/pattern-matching/i);
  });

  test('state 5: granted hosts are listed with a Remove action, built-ins excluded', async () => {
    ['https://code.corp.example/*', 'https://ghe.corp.example/*', 'https://github.com/*'].forEach(
      (o) => global.chrome.__mockState.permState.origins.add(o)
    );
    setActiveTab('https://github.com/owner/repo/pull/1/files');
    await openPopup();

    const rows = document.querySelectorAll('#list li');
    expect(rows).toHaveLength(2);
    expect(Array.from(rows).map((li) => li.querySelector('.host').textContent)).toEqual([
      'https://code.corp.example',
      'https://ghe.corp.example',
    ]);
    expect(rows[0].querySelector('button').textContent).toBe('Remove');
    expect(document.getElementById('hosts-card').hidden).toBe(false);
  });

  test('state 5: a wildcard grant is listed and removable', async () => {
    global.chrome.__mockState.permState.origins.add('https://*.corp.example/*');
    setActiveTab('https://github.com/owner/repo/pull/1/files');
    await openPopup();

    const rows = document.querySelectorAll('#list li');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.host').textContent).toBe('https://*.corp.example');

    rows[0].querySelector('button').click();
    await new Promise((r) => setTimeout(r, 10));
    expect(global.chrome.permissions.remove).toHaveBeenCalledWith(
      { origins: ['https://*.corp.example/*'] },
      expect.any(Function)
    );
  });

  test('state 5: the list header hides when nothing is granted', async () => {
    setActiveTab('https://github.com/owner/repo/pull/1/files');
    await openPopup();
    expect(document.querySelectorAll('#list li')).toHaveLength(0);
    expect(document.getElementById('hosts-card').hidden).toBe(true);
  });
});
