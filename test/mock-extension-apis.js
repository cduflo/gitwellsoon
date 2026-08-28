// In-memory stateful mock for Chrome extension APIs used by tests
(function setupMock() {
  const permState = {
    permissions: new Set(['scripting', 'activeTab']),
    origins: new Set(),
  };
  // Dynamic content-script registrations (chrome.scripting), kept stateful so
  // register/unregister/getRegistered behave like the real API across calls.
  const scriptState = { registered: [] };
  const events = { onInstalled: [], onStartup: [] };

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
    const originsOk = origins.every((o) => permState.origins.has(o));
    return permsOk && originsOk;
  }

  // Chrome's permissions/scripting APIs accept a callback *and* return a
  // promise; support both so worker code (promises) and popup code (callbacks)
  // can share the mock.
  function settle(cb, value) {
    if (typeof cb === 'function') cb(value);
    return Promise.resolve(value);
  }

  function requestPermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.add(p));
    origins.forEach((o) => permState.origins.add(o));
    return settle(cb, true);
  }

  function removePermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.delete(p));
    origins.forEach((o) => permState.origins.delete(o));
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
      getManifest: jest.fn(() => ({})),
      onInstalled: makeEvent('onInstalled'),
      onStartup: makeEvent('onStartup'),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
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
    },
    scripting: {
      registerContentScripts: jest.fn((scripts, cb) => {
        const list = Array.isArray(scripts) ? scripts : [scripts];
        const dup = list.find((s) =>
          scriptState.registered.some((r) => r.id === s.id)
        );
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
          scriptState.registered = scriptState.registered.filter(
            (r) => !ids.includes(r.id)
          );
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
      query: jest.fn((queryInfo, cb) =>
        settle(cb, [
          {
            id: 123,
            url: 'https://abc-github.cloud.xyz/owner/repo/pull/123/files',
          },
        ])
      ),
      reload: jest.fn(() => {}),
    },
    __mockState: {
      permState,
      scriptState,
      events,
      // Fire a runtime event and return the listeners' return values so a test
      // can await an async handler.
      fireEvent: (name, ...args) => (events[name] || []).map((fn) => fn(...args)),
      reset: () => {
        permState.permissions = new Set(['scripting', 'activeTab']);
        permState.origins = new Set();
        scriptState.registered = [];
        events.onInstalled.length = 0;
        events.onStartup.length = 0;
      },
    },
  };
})();
