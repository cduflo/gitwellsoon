/**
 * @jest-environment jsdom
 */

// One-click enable / disable: grant or revoke the origin, register or
// unregister the dynamic content script, then reload the tab it applies to.

const PopupLib = require('../popup-lib.js');

const POPUP_DOM = `
  <div id="status"></div>
  <button id="action" hidden></button>
  <div id="hosts-header" hidden></div>
  <ul id="list"></ul>
`;

const HOST = 'code.corp.example';
const TAB_URL = `https://${HOST}/owner/repo/pull/1/files`;

function setActiveTab(url) {
  global.chrome.tabs.query.mockImplementation((q, cb) => cb(url ? [{ id: 7, url }] : []));
}

async function openPopup() {
  jest.resetModules();
  require('../popup.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await settle();
}

const settle = () => new Promise((r) => setTimeout(r, 10));
const actionBtn = () => document.getElementById('action');
const registered = () => global.chrome.__mockState.scriptState.registered;

describe('popup enable / disable flow', () => {
  let reloadSpy;

  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = POPUP_DOM;
    setActiveTab(TAB_URL);
    reloadSpy = jest.spyOn(PopupLib, 'scheduleReloadIfActiveMatches').mockResolvedValue(true);
  });

  afterEach(() => reloadSpy.mockRestore());

  test('enable grants the origin, registers the script and reloads the tab', async () => {
    await openPopup();
    actionBtn().click();
    await settle();

    expect(global.chrome.permissions.request).toHaveBeenCalledWith(
      { origins: [`https://${HOST}/*`] },
      expect.any(Function)
    );
    expect(registered()).toHaveLength(1);
    expect(registered()[0]).toMatchObject({
      id: `gws-${HOST}`,
      js: ['granted-marker.js', 'content.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    });
    expect(registered()[0].matches).toContain(`https://${HOST}/*/*/pull/*`);
    expect(reloadSpy).toHaveBeenCalledWith(global.chrome, HOST, 1000);
  });

  test('enable moves the popup to state 3 and lists the host', async () => {
    await openPopup();
    actionBtn().click();
    await settle();

    expect(document.getElementById('status').textContent).toBe(`✓ Active on ${HOST}`);
    expect(actionBtn().textContent).toBe('Disable');
    expect(document.querySelectorAll('#list li')).toHaveLength(1);
  });

  test('a denied grant is a no-op: no registration, still state 4', async () => {
    global.chrome.permissions.request.mockImplementationOnce((req, cb) => {
      cb(false);
      return Promise.resolve(false);
    });
    await openPopup();
    actionBtn().click();
    await settle();

    expect(registered()).toEqual([]);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(actionBtn().textContent).toBe(`Enable on ${HOST}`);
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
    expect(reloadSpy).toHaveBeenCalledWith(global.chrome, HOST, 1000);
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
