// In-memory stateful mock for Chrome extension APIs used by tests
(function setupMock() {
  const permState = {
    permissions: new Set(['scripting', 'activeTab']),
    origins: new Set(),
  };
  // Dynamic content-script registrations (chrome.scripting), kept stateful so
  // register/unregister/getRegistered behave like the real API across calls.
  const scriptState = { registered: [] };
  const tabState = {
    tabs: [{ id: 123, url: 'https://abc-github.cloud.xyz/owner/repo/pull/123/files' }],
    reloaded: [],
  };
  const events = {
    onInstalled: [],
    onStartup: [],
    onMessage: [],
    onAdded: [],
    onRemoved: [],
  };

  // MV3 service workers load shared code with importScripts(); jsdom has no
  // such global, so map it onto require() for worker unit tests.
  if (typeof global.importScripts !== 'function') {
    global.importScripts = (...files) => {
      files.forEach((f) => require('../' + String(f)));
    };
  }

  function hasAllPermissions(req) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    const permsOk = perms.every((p) => permState.permissions.has(p));
    // Chrome resolves origin containment by match pattern, so a granted
    // https://*.corp.example/* satisfies a query for https://a.corp.example/*.
    const originsOk = origins.every((o) => originIsCovered(o));
    return permsOk && originsOk;
  }

  const hostOf = (origin) => {
    const m = String(origin || '').match(/^https:\/\/([^/]+)/i);
    return m ? m[1].toLowerCase() : '';
  };

  function hostCoveredBy(grantHost, host) {
    if (!grantHost || !host) return false;
    if (grantHost === '*') return true;
    const base = grantHost.startsWith('*.') ? grantHost.slice(2) : grantHost;
    return host === base || host.endsWith('.' + base);
  }

  function originIsCovered(origin) {
    if (permState.origins.has(origin)) return true;
    const host = hostOf(origin);
    return Array.from(permState.origins).some((granted) =>
      hostCoveredBy(hostOf(granted), host)
    );
  }

  // Chrome's permissions/scripting APIs accept a callback *and* return a
  // promise; support both so worker code (promises) and popup code (callbacks)
  // can share the mock.
  function settle(cb, value) {
    if (typeof cb === 'function') cb(value);
    return Promise.resolve(value);
  }

  const fire = (name, ...args) => (events[name] || []).map((fn) => fn(...args));

  function requestPermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.add(p));
    origins.forEach((o) => permState.origins.add(o));
    if (perms.length || origins.length) fire('onAdded', { permissions: perms, origins });
    return settle(cb, true);
  }

  function removePermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.delete(p));
    origins.forEach((o) => permState.origins.delete(o));
    if (perms.length || origins.length) fire('onRemoved', { permissions: perms, origins });
    return settle(cb, true);
  }

  function containsPermissions(req, cb) {
    return settle(cb, hasAllPermissions(req));
  }

  function makeEvent(name) {
    return {
      addListener: jest.fn((fn) => {
        if (!events[name].includes(fn)) events[name].push(fn);
      }),
      removeListener: jest.fn((fn) => {
        const i = events[name].indexOf(fn);
        if (i >= 0) events[name].splice(i, 1);
      }),
      hasListener: jest.fn((fn) => events[name].includes(fn)),
    };
  }

  global.chrome = {
    runtime: {
      lastError: undefined,
      getManifest: jest.fn(() => ({})),
      onInstalled: makeEvent('onInstalled'),
      onStartup: makeEvent('onStartup'),
      onMessage: makeEvent('onMessage'),
      // Routes to whatever the worker registered, so content <-> worker round
      // trips can be exercised for real in a unit test.
      sendMessage: jest.fn((message, cb) => {
        let responded = false;
        let resolveFn;
        const promise = new Promise((r) => {
          resolveFn = r;
        });
        const sendResponse = (res) => {
          if (responded) return;
          responded = true;
          if (typeof cb === 'function') cb(res);
          resolveFn(res);
        };
        const sender = { id: 'mock-extension', url: 'https://sender.test/' };
        let keepAlive = false;
        events.onMessage.forEach((fn) => {
          if (fn(message, sender, sendResponse) === true) keepAlive = true;
        });
        if (!keepAlive && !responded) sendResponse(undefined);
        return promise;
      }),
    },
    permissions: {
      request: jest.fn((req, cb) => requestPermissions(req, cb)),
      remove: jest.fn((req, cb) => removePermissions(req, cb)),
      contains: jest.fn((req, cb) => containsPermissions(req, cb)),
      getAll: jest.fn((cb) =>
        settle(cb, {
          permissions: Array.from(permState.permissions),
          origins: Array.from(permState.origins),
        })
      ),
      onAdded: makeEvent('onAdded'),
      onRemoved: makeEvent('onRemoved'),
    },
    scripting: {
      registerContentScripts: jest.fn((scripts, cb) => {
        const list = Array.isArray(scripts) ? scripts : [scripts];
        const dup = list.find((s) => scriptState.registered.some((r) => r.id === s.id));
        if (dup) {
          // Real Chrome rejects the whole call on a duplicate id.
          return Promise.reject(new Error(`Duplicate script ID '${dup.id}'`));
        }
        list.forEach((s) => scriptState.registered.push(Object.assign({}, s)));
        return settle(cb, undefined);
      }),
      unregisterContentScripts: jest.fn((filter, cb) => {
        const ids = filter && filter.ids;
        if (Array.isArray(ids)) {
          scriptState.registered = scriptState.registered.filter((r) => !ids.includes(r.id));
        } else {
          scriptState.registered = [];
        }
        return settle(typeof filter === 'function' ? filter : cb, undefined);
      }),
      getRegisteredContentScripts: jest.fn((filter, cb) => {
        const done = typeof filter === 'function' ? filter : cb;
        return settle(done, scriptState.registered.map((r) => Object.assign({}, r)));
      }),
    },
    tabs: {
      query: jest.fn((queryInfo, cb) => {
        let out = tabState.tabs.slice();
        if (queryInfo && queryInfo.url) {
          const wanted = hostOf(queryInfo.url);
          out = out.filter((t) => hostCoveredBy(wanted, hostOf(t.url)));
        }
        return settle(cb, out);
      }),
      reload: jest.fn((tabId, cb) => {
        tabState.reloaded.push(tabId);
        return settle(cb, undefined);
      }),
    },
    __mockState: {
      permState,
      scriptState,
      tabState,
      events,
      // Fire a runtime event and return the listeners' return values so a test
      // can await an async handler.
      fireEvent: (name, ...args) => fire(name, ...args),
      reset: () => {
        permState.permissions = new Set(['scripting', 'activeTab']);
        permState.origins = new Set();
        scriptState.registered = [];
        tabState.tabs = [
          { id: 123, url: 'https://abc-github.cloud.xyz/owner/repo/pull/123/files' },
        ];
        tabState.reloaded = [];
        Object.keys(events).forEach((k) => {
          events[k].length = 0;
        });
      },
    },
  };
})();
