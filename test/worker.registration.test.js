/**
 * @jest-environment jsdom
 */

// Worker unit: onInstalled/onStartup rebuild dynamic content-script
// registrations from granted origins (the sole source of truth in 3.1).

function loadWorker() {
  jest.resetModules();
  require('./mock-extension-apis.js');
  global.chrome.__mockState.reset();
  return () => require('../worker.js');
}

async function fire(name) {
  await Promise.all(global.chrome.__mockState.fireEvent(name));
}

function grant(origin) {
  global.chrome.__mockState.permState.origins.add(origin);
}

function registered() {
  return global.chrome.__mockState.scriptState.registered;
}

describe('worker dynamic script registration', () => {
  let load;
  beforeEach(() => {
    load = loadWorker();
  });

  test('registers listeners for onInstalled and onStartup only', () => {
    load();
    expect(global.chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(global.chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(global.chrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
  });

  test('registers a script for each granted non-built-in origin', async () => {
    grant('https://github.company.com/*');
    grant('https://code.example.org/*');
    load();
    await fire('onInstalled');

    const ids = registered().map((r) => r.id).sort();
    expect(ids).toEqual(['gws-code.example.org', 'gws-github.company.com']);

    const one = registered().find((r) => r.id === 'gws-github.company.com');
    expect(one.js).toEqual(['granted-marker.js', 'content.js']);
    expect(one.runAt).toBe('document_start');
    expect(one.persistAcrossSessions).toBe(true);
    expect(one.matches).toEqual([
      'https://github.company.com/*/*/pull/*',
      'https://github.company.com/*/*/compare/*',
      'https://github.company.com/*/*/commits/*',
      'https://github.company.com/*/*/commit/*',
    ]);
  });

  test('skips built-in GitHub hosts and non-https origins', async () => {
    grant('https://github.com/*');
    grant('https://foo.github.com/*');
    grant('https://bar.ghe.com/*');
    grant('http://insecure.example.com/*');
    grant('https://*/*');
    load();
    await fire('onInstalled');
    expect(registered()).toEqual([]);
  });

  test('re-running is idempotent (no duplicate-id rejection)', async () => {
    grant('https://github.company.com/*');
    load();
    await fire('onInstalled');
    await fire('onInstalled');
    await fire('onStartup');
    expect(registered().map((r) => r.id)).toEqual(['gws-github.company.com']);
  });

  test('drops registrations whose grant has since been revoked', async () => {
    grant('https://github.company.com/*');
    load();
    await fire('onInstalled');
    expect(registered()).toHaveLength(1);

    global.chrome.__mockState.permState.origins.delete('https://github.company.com/*');
    await fire('onStartup');
    expect(registered()).toEqual([]);
  });

  test('migration: grants drive registration, extraHosts storage is never read', async () => {
    // 3.1 drops the storage permission entirely; chrome.storage must not be touched.
    grant('https://ghe.internal.example/*');
    load();
    await fire('onInstalled');
    expect(registered().map((r) => r.id)).toEqual(['gws-ghe.internal.example']);
    expect(global.chrome.storage).toBeUndefined();
  });
});
