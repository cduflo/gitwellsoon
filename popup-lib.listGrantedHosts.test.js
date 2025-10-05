/**
 * @jest-environment jsdom
 */

const PopupLib = require('./popup-lib.js');

describe('PopupLib.listGrantedHosts integration', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    // Clear origins
    global.chrome.__mockState.permState.origins.clear();
  });

  test('filters to only non-built-in https hosts without wildcards, deduped', async () => {
    const origins = [
      'https://abc.example.com/*',
      'https://github.com/*',
      'https://foo.github.com/*',
      'https://bar.ghe.com/*',
      'https://*/foo',
      'https://%2A/*',
      'http://bad.example.com/*',
      'https://abc.example.com/*', // duplicate
      'https://weird%2A.example.com/*', // encoded asterisk in host
    ];
    origins.forEach((o) => global.chrome.__mockState.permState.origins.add(o));

    const list = await PopupLib.listGrantedHosts(global.chrome);
    expect(list).toEqual(['abc.example.com']);
  });
});