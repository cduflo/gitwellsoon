/**
 * @jest-environment jsdom
 */

// Ported from the 2.x remove flow: the per-row Remove button in the granted
// hosts list revokes the grant, drops the dynamic registration and reloads the
// active tab when it is the host being removed.

const PopupLib = require('../popup-lib.js');

const HOST = 'abc-github.cloud.xyz';

describe('popup Remove row triggers revoke, unregister and reload', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    global.chrome.__mockState.reset();
    document.body.innerHTML = `
      <div id="status"></div>
      <button id="action" hidden></button>
      <div id="msg" hidden></div>
      <div id="hosts-header" hidden></div>
      <ul id="list"></ul>
    `;
    global.chrome.__mockState.tabState.tabs = [
      { id: 321, url: `https://${HOST}/owner/repo/pull/1/files` },
    ];
  });

  test('remove revokes the origin, unregisters and reloads the matching tab', async () => {
    global.chrome.__mockState.permState.origins.add(`https://${HOST}/*`);
    await PopupLib.registerHosts(global.chrome, [HOST]);

    jest.resetModules();
    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const items = document.querySelectorAll('#list li');
    expect(items).toHaveLength(1);

    items[0].querySelector('button').click();
    await new Promise((r) => setTimeout(r, 30));

    expect(global.chrome.__mockState.permState.origins.has(`https://${HOST}/*`)).toBe(false);
    expect(global.chrome.__mockState.scriptState.registered).toEqual([]);
    expect(global.chrome.__mockState.tabState.reloaded).toContain(321);
    expect(document.querySelectorAll('#list li')).toHaveLength(0);
  });
});
