/**
 * @jest-environment jsdom
 */

// One-click enable / disable: grant or revoke the origin, register or
// unregister the dynamic content script, then reload the tab it applies to.

const PopupLib = require('../popup-lib.js');

const POPUP_DOM = `
  <div id="status"></div>
  <button id="action" hidden></button>
  <div id="msg" hidden></div>
  <div id="hosts-card" hidden>
    <div id="hosts-header">Enabled hosts</div>
    <ul id="list"></ul>
  </div>
`;

const HOST = 'code.corp.example';
const TAB_URL = `https://${HOST}/owner/repo/pull/1/files`;

function setActiveTab(url) {
  global.chrome.__mockState.tabState.tabs = url ? [{ id: 7, url }] : [];
}

const settle = () => new Promise((r) => setTimeout(r, 10));
const actionBtn = () => document.getElementById('action');
const msgEl = () => document.getElementById('msg');
const registered = () => global.chrome.__mockState.scriptState.registered;
const reloaded = () => global.chrome.__mockState.tabState.reloaded;

async function openPopup() {
  jest.resetModules();
  require('../popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await settle();
}

describe('popup enable / disable flow', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = POPUP_DOM;
    setActiveTab(TAB_URL);
  });

  test('enable grants the origin, registers the script and reloads the tab', async () => {
    await openPopup();
    actionBtn().click();
    await settle();

    expect(global.chrome.permissions.request).toHaveBeenCalledWith(
      { origins: [`https://${HOST}/*`] },
      expect.any(Function)
    );
    expect(registered().map((r) => r.id)).toContain(`gws-${HOST}`);
    expect(registered().find((r) => r.id === `gws-${HOST}`)).toMatchObject({
      js: ['granted-marker.js', 'content.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    });
  });

  // Finding 5: the reload was on a 1000ms timer, and the popup's JS context is
  // destroyed the moment the popup closes — which a permission prompt does.
  test('the tab reload is immediate, not on a timer', async () => {
    await openPopup();
    actionBtn().click();
    // Drain microtasks only — real time is never advanced here, so a reload
    // parked behind setTimeout(..., 1000) could not possibly have run yet.
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(reloaded()).toContain(7);
  });

  test('enable moves the popup to state 3 and lists the host', async () => {
    await openPopup();
    actionBtn().click();
    await settle();

    expect(document.getElementById('status').textContent).toBe(`✓ Active on ${HOST}`);
    expect(actionBtn().textContent).toBe('Disable');
    expect(document.querySelectorAll('#list li')).toHaveLength(1);
  });

  // Finding 8: previously the denied path re-rendered a pixel-identical popup,
  // so the click looked like it had done nothing at all.
  test('a denied grant shows a visible message and stays in state 4', async () => {
    global.chrome.permissions.request.mockImplementationOnce((req, cb) => {
      cb(false);
      return Promise.resolve(false);
    });
    await openPopup();
    actionBtn().click();
    await settle();

    expect(registered()).toEqual([]);
    expect(reloaded()).toEqual([]);
    expect(actionBtn().textContent).toBe(`Enable on ${HOST}`);
    expect(msgEl().hidden).toBe(false);
    expect(msgEl().textContent).toMatch(/Permission not granted/i);
    expect(msgEl().className).toContain('error');
  });

  test('the denied message clears on the next successful attempt', async () => {
    global.chrome.permissions.request.mockImplementationOnce((req, cb) => {
      cb(false);
      return Promise.resolve(false);
    });
    await openPopup();
    actionBtn().click();
    await settle();
    expect(msgEl().hidden).toBe(false);

    actionBtn().click();
    await settle();
    expect(msgEl().hidden).toBe(true);
  });

  test('disable revokes the origin, unregisters the script and reloads', async () => {
    global.chrome.__mockState.permState.origins.add(`https://${HOST}/*`);
    await PopupLib.registerHosts(global.chrome, [HOST]);
    await openPopup();
    expect(actionBtn().textContent).toBe('Disable');

    actionBtn().click();
    await settle();

    expect(global.chrome.permissions.remove).toHaveBeenCalledWith(
      { origins: [`https://${HOST}/*`] },
      expect.any(Function)
    );
    expect(registered()).toEqual([]);
    expect(reloaded()).toContain(7);
    expect(actionBtn().textContent).toBe(`Enable on ${HOST}`);
    expect(document.querySelectorAll('#list li')).toHaveLength(0);
  });

  test('an interrupted grant self-heals on reopen with no stored pending marker', async () => {
    // The permission prompt can close the popup mid-grant. 3.1 re-derives
    // everything from chrome.permissions, so simply reopening finishes the job.
    global.chrome.__mockState.permState.origins.add(`https://${HOST}/*`);
    await openPopup();
    expect(document.getElementById('status').textContent).toBe(`✓ Active on ${HOST}`);
    expect(document.querySelectorAll('#list li')).toHaveLength(1);
  });
});

// Finding 6: Disable has to revoke the pattern actually held.
describe('popup disable with a broader grant', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = POPUP_DOM;
  });

  test('revokes the wildcard origin, not a narrower one', async () => {
    global.chrome.__mockState.permState.origins.add('https://*.corp.example/*');
    setActiveTab('https://code.corp.example/owner/repo/pull/1/files');
    await openPopup();
    expect(actionBtn().textContent).toBe('Disable');

    actionBtn().click();
    await settle();

    expect(global.chrome.permissions.remove).toHaveBeenCalledWith(
      { origins: ['https://*.corp.example/*'] },
      expect.any(Function)
    );
    expect(global.chrome.__mockState.permState.origins.size).toBe(0);
  });

  test('revokes the parent-domain origin actually held', async () => {
    global.chrome.__mockState.permState.origins.add('https://corp.example/*');
    setActiveTab('https://code.corp.example/owner/repo/pull/1/files');
    await openPopup();

    actionBtn().click();
    await settle();

    expect(global.chrome.permissions.remove).toHaveBeenCalledWith(
      { origins: ['https://corp.example/*'] },
      expect.any(Function)
    );
  });
});

// Finding 9: on a heuristic host, Disable revokes the grant but the extension
// keeps working via pattern-matching. The popup must not imply otherwise.
describe('popup honesty on heuristic hosts', () => {
  const GH_HOST = 'github.corp.example';

  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = POPUP_DOM;
    setActiveTab(`https://${GH_HOST}/owner/repo/pull/1/files`);
  });

  test('after Disable it says the host is still active via pattern-matching', async () => {
    global.chrome.__mockState.permState.origins.add(`https://${GH_HOST}/*`);
    await openPopup();
    expect(actionBtn().textContent).toBe('Disable');

    actionBtn().click();
    await settle();

    expect(document.getElementById('status').textContent).toMatch(/pattern-matching/i);
    expect(document.getElementById('status').textContent).toContain(GH_HOST);
    expect(actionBtn().textContent).toBe(`Pin permission for ${GH_HOST}`);
  });

  test('an ungranted non-heuristic host does not claim to be active', async () => {
    setActiveTab(`https://${HOST}/owner/repo/pull/1/files`);
    await openPopup();
    expect(document.getElementById('status').textContent).not.toMatch(/pattern-matching/i);
    expect(document.getElementById('status').textContent).toMatch(/not enabled/i);
  });
});
