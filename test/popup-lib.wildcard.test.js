/**
 * @jest-environment jsdom
 */

// Finding 6: a wildcard grant (https://*.corp.example/*) was dropped on the
// floor — never listed, never registered, and impossible to revoke from the
// popup because Disable tried to remove a narrower pattern than the one held.

const PopupLib = require('../popup-lib.js');

beforeEach(() => {
  jest.resetModules();
  require('./mock-extension-apis.js');
  global.chrome.__mockState.reset();
});

const grant = (o) => global.chrome.__mockState.permState.origins.add(o);

describe('hostFromOrigin with wildcard hosts', () => {
  test('keeps a leftmost-label wildcard host', () => {
    expect(PopupLib.hostFromOrigin('https://*.corp.example/*')).toBe('*.corp.example');
  });

  test('still rejects the all-sites umbrella and malformed hosts', () => {
    expect(PopupLib.hostFromOrigin('https://*/*')).toBe('');
    expect(PopupLib.hostFromOrigin('https://%2A/*')).toBe('');
    expect(PopupLib.hostFromOrigin('https://weird%2A.example.com/*')).toBe('');
    expect(PopupLib.hostFromOrigin('http://plain.example.com/*')).toBe('');
    expect(PopupLib.hostFromOrigin('https://*.*/*')).toBe('');
  });
});

describe('listGrantedHosts with wildcard hosts', () => {
  test('lists a wildcard grant alongside exact ones', async () => {
    grant('https://*.corp.example/*');
    grant('https://ghe.other.example/*');
    grant('https://*/*');
    grant('https://*.github.com/*'); // built-in, excluded

    await expect(PopupLib.listGrantedHosts(global.chrome)).resolves.toEqual([
      '*.corp.example',
      'ghe.other.example',
    ]);
  });
});

describe('registration spec for a wildcard host', () => {
  test('matches use the wildcard host, which the grant already covers', () => {
    const spec = PopupLib.registrationFor('*.corp.example');
    expect(spec.id).toBe('gws-*.corp.example');
    expect(spec.matches).toEqual([
      'https://*.corp.example/*/*/pull/*',
      'https://*.corp.example/*/*/compare/*',
      'https://*.corp.example/*/*/commits/*',
      'https://*.corp.example/*/*/commit/*',
    ]);
  });

  test('originForHost round-trips back to the granted pattern', () => {
    expect(PopupLib.originForHost('*.corp.example')).toBe('https://*.corp.example/*');
    expect(PopupLib.originForHost('ghe.corp.example')).toBe('https://ghe.corp.example/*');
  });
});

describe('originCoveringHost', () => {
  test('returns the wildcard pattern actually held, not a narrower one', async () => {
    grant('https://*.corp.example/*');
    await expect(
      PopupLib.originCoveringHost(global.chrome, 'code.corp.example')
    ).resolves.toBe('https://*.corp.example/*');
  });

  test('returns the parent-domain pattern actually held', async () => {
    grant('https://corp.example/*');
    await expect(
      PopupLib.originCoveringHost(global.chrome, 'code.corp.example')
    ).resolves.toBe('https://corp.example/*');
  });

  test('prefers the most specific grant when several cover the host', async () => {
    grant('https://*.corp.example/*');
    grant('https://code.corp.example/*');
    await expect(
      PopupLib.originCoveringHost(global.chrome, 'code.corp.example')
    ).resolves.toBe('https://code.corp.example/*');
  });

  test('returns null when nothing covers the host', async () => {
    grant('https://other.example/*');
    await expect(
      PopupLib.originCoveringHost(global.chrome, 'code.corp.example')
    ).resolves.toBeNull();
  });
});
