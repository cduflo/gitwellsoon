/**
 * @jest-environment jsdom
 */

// Finding 2: 2.x gated on an endsWith allowlist, so granting corp.example also
// covered code.corp.example. 3.1's exact-grant-or-heuristic test lost that, and
// those users go dark with no error. The worker answers the subdomain question
// for any content script that asks.

function loadWorker(origins = []) {
  jest.resetModules();
  require('./mock-extension-apis.js');
  global.chrome.__mockState.reset();
  origins.forEach((o) => global.chrome.__mockState.permState.origins.add(o));
  require('../worker.js');
  return new Promise((r) => setTimeout(r, 0));
}

function ask(host) {
  return new Promise((resolve) => {
    global.chrome.runtime.sendMessage({ type: 'gws-host-check', host }, (res) => resolve(res));
  });
}

describe('worker gws-host-check', () => {
  test('an exact grant answers granted', async () => {
    await loadWorker(['https://ghe.corp.example/*']);
    await expect(ask('ghe.corp.example')).resolves.toEqual({ granted: true });
  });

  test('a parent-domain grant covers its subdomains (the 2.x behaviour)', async () => {
    await loadWorker(['https://corp.example/*']);
    await expect(ask('code.corp.example')).resolves.toEqual({ granted: true });
    await expect(ask('deep.code.corp.example')).resolves.toEqual({ granted: true });
  });

  test('a wildcard grant covers the base domain and its subdomains', async () => {
    await loadWorker(['https://*.corp.example/*']);
    await expect(ask('corp.example')).resolves.toEqual({ granted: true });
    await expect(ask('code.corp.example')).resolves.toEqual({ granted: true });
  });

  // Verified against real Chrome: permissions.getAll() reports this
  // extension's own broad content_scripts patterns as granted origins, so a
  // bare '*' host says nothing about what the user actually granted. Treating
  // it as "everything" marked every site on the web as granted and re-enabled
  // the extension on arbitrary hosts (caught by the example.com e2e test).
  test('a bare-wildcard host is never treated as a grant', async () => {
    await loadWorker([
      'https://*/*',
      'https://*/*/*/pull/*',
      'https://*/*/*/compare/*',
    ]);
    await expect(ask('anything.example')).resolves.toEqual({ granted: false });
    await expect(ask('example.com')).resolves.toEqual({ granted: false });
  });

  test('the manifest built-ins do not make unrelated hosts granted', async () => {
    await loadWorker([
      'https://github.com/*',
      'https://*.github.com/*',
      'https://*.ghe.com/*',
      'https://*/*/*/pull/*',
    ]);
    await expect(ask('example.com')).resolves.toEqual({ granted: false });
    await expect(ask('code.corp.example')).resolves.toEqual({ granted: false });
  });

  test('an unrelated host is not granted', async () => {
    await loadWorker(['https://corp.example/*']);
    await expect(ask('corp.example.evil.test')).resolves.toEqual({ granted: false });
    await expect(ask('notcorp.example')).resolves.toEqual({ granted: false });
    await expect(ask('other.test')).resolves.toEqual({ granted: false });
  });

  test('no grants at all answers not granted', async () => {
    await loadWorker([]);
    await expect(ask('code.corp.example')).resolves.toEqual({ granted: false });
  });

  test('ignores messages it does not own', async () => {
    await loadWorker(['https://corp.example/*']);
    const res = await new Promise((resolve) => {
      global.chrome.runtime.sendMessage({ type: 'something-else' }, resolve);
    });
    expect(res).toBeUndefined();
  });
});
