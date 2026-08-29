/**
 * @jest-environment jsdom
 */

// Worker unit: registrations are reconciled against granted origins (the sole
// source of truth in 3.1) on every worker boot, on install/startup, and
// whenever a permission is added or removed.

function loadWorker() {
  jest.resetModules();
  require('./mock-extension-apis.js');
  global.chrome.__mockState.reset();
  return () => require('../worker.js');
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function fire(name, ...args) {
  await Promise.all(global.chrome.__mockState.fireEvent(name, ...args));
  await flush();
}

function grant(origin) {
  global.chrome.__mockState.permState.origins.add(origin);
}

function registered() {
  return global.chrome.__mockState.scriptState.registered;
}

const ids = () => registered().map((r) => r.id).sort();

describe('worker dynamic script registration', () => {
  let load;
  beforeEach(() => {
    load = loadWorker();
  });

  test('registers listeners for boot, install, startup and permission changes', () => {
    load();
    expect(global.chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(global.chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(global.chrome.permissions.onAdded.addListener).toHaveBeenCalledTimes(1);
    expect(global.chrome.permissions.onRemoved.addListener).toHaveBeenCalledTimes(1);
  });

  // Finding 1: a grant can land when neither onInstalled nor onStartup will
  // ever fire again — the popup closing mid-prompt, or a Site-access change
  // made from chrome://extensions.
  test('syncs on every worker boot, not only on install/startup', async () => {
    grant('https://github.company.com/*');
    load();
    await flush();
    expect(ids()).toEqual(['gws-github.company.com']);
  });

  test('a grant arriving with no popup open is registered via permissions.onAdded', async () => {
    load();
    await flush();
    expect(ids()).toEqual([]);

    // Simulates the prompt resolving after the popup context is gone.
    await new Promise((r) =>
      global.chrome.permissions.request({ origins: ['https://ghe.corp.example/*'] }, r)
    );
    await flush();

    expect(ids()).toEqual(['gws-ghe.corp.example']);
  });

  test('permissions.onAdded reloads the tabs the new grant covers', async () => {
    global.chrome.__mockState.tabState.tabs = [
      { id: 11, url: 'https://ghe.corp.example/owner/repo/pull/1/files' },
      { id: 22, url: 'https://unrelated.example/page' },
    ];
    load();
    await flush();

    await new Promise((r) =>
      global.chrome.permissions.request({ origins: ['https://ghe.corp.example/*'] }, r)
    );
    await flush();

    expect(global.chrome.__mockState.tabState.reloaded).toEqual([11]);
  });

  test('a revoked grant is unregistered via permissions.onRemoved', async () => {
    grant('https://ghe.corp.example/*');
    load();
    await flush();
    expect(ids()).toEqual(['gws-ghe.corp.example']);

    await new Promise((r) =>
      global.chrome.permissions.remove({ origins: ['https://ghe.corp.example/*'] }, r)
    );
    await flush();

    expect(ids()).toEqual([]);
  });

  test('registers a script for each granted non-built-in origin', async () => {
    grant('https://github.company.com/*');
    grant('https://code.example.org/*');
    load();
    await fire('onInstalled');

    expect(ids()).toEqual(['gws-code.example.org', 'gws-github.company.com']);

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
    expect(ids()).toEqual(['gws-github.company.com']);
  });

  test('drops registrations whose grant has since been revoked', async () => {
    grant('https://github.company.com/*');
    load();
    await fire('onInstalled');
    expect(registered()).toHaveLength(1);

    global.chrome.__mockState.permState.origins.delete('https://github.company.com/*');
    await fire('onStartup');
    expect(ids()).toEqual([]);
  });

  test('migration: grants drive registration, extraHosts storage is never read', async () => {
    // 3.1 drops the storage permission entirely; chrome.storage must not be touched.
    grant('https://ghe.internal.example/*');
    load();
    await fire('onInstalled');
    expect(ids()).toEqual(['gws-ghe.internal.example']);
    expect(global.chrome.storage).toBeUndefined();
  });
});

// Finding 4 + 10: the old sync wiped every registration and re-added them in
// one atomic batch. That defeated persistAcrossSessions (a session-restored tab
// could land in the gap) and let one bad host dark-ship all the others.
describe('worker sync is diff-based', () => {
  let load;
  beforeEach(() => {
    load = loadWorker();
  });

  test('an unchanged grant set is never unregistered or re-registered', async () => {
    grant('https://ghe.corp.example/*');
    load();
    await fire('onInstalled');

    global.chrome.scripting.unregisterContentScripts.mockClear();
    global.chrome.scripting.registerContentScripts.mockClear();

    await fire('onStartup');

    expect(global.chrome.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(global.chrome.scripting.registerContentScripts).not.toHaveBeenCalled();
    expect(ids()).toEqual(['gws-ghe.corp.example']);
  });

  test('never unregisters everything unconditionally', async () => {
    grant('https://a.corp.example/*');
    grant('https://b.corp.example/*');
    load();
    await fire('onInstalled');

    global.chrome.__mockState.permState.origins.delete('https://a.corp.example/*');
    await fire('onStartup');

    // Only the stale id is targeted; b is left registered throughout.
    const unregisterCalls = global.chrome.scripting.unregisterContentScripts.mock.calls;
    expect(unregisterCalls.every((c) => Array.isArray(c[0] && c[0].ids))).toBe(true);
    expect(ids()).toEqual(['gws-b.corp.example']);
  });

  test('registers per host, so one failing host cannot dark-ship the rest', async () => {
    grant('https://bad.corp.example/*');
    grant('https://good.corp.example/*');
    load();
    await flush();

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const real = global.chrome.scripting.registerContentScripts.getMockImplementation();
    global.chrome.scripting.registerContentScripts.mockImplementation((scripts, cb) => {
      const list = Array.isArray(scripts) ? scripts : [scripts];
      if (list.some((s) => s.id === 'gws-bad.corp.example')) {
        return Promise.reject(new Error('Invalid match pattern'));
      }
      return real(scripts, cb);
    });

    // Force a full re-register from an empty registration table.
    global.chrome.__mockState.scriptState.registered = [];
    await fire('onStartup');

    expect(ids()).toEqual(['gws-good.corp.example']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('leaves registrations belonging to anything but this extension alone', async () => {
    load();
    await flush();
    global.chrome.__mockState.scriptState.registered.push({ id: 'someone-else' });
    await fire('onStartup');
    expect(ids()).toEqual(['someone-else']);
  });
});
