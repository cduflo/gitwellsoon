// In-memory stateful mock for Chrome extension APIs used by tests
(function setupMock() {
  const store = {
    extraHosts: [],
    pendingHost: null,
  };
  const permState = {
    permissions: new Set(['storage']), // default to storage enabled for most tests
    origins: new Set(),
  };

  function hasAllPermissions(req) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    const permsOk = perms.every((p) => permState.permissions.has(p));
    const originsOk = origins.every((o) => permState.origins.has(o));
    return permsOk && originsOk;
  }

  function requestPermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.add(p));
    origins.forEach((o) => permState.origins.add(o));
    if (typeof cb === 'function') cb(true);
  }

  function removePermissions(req, cb) {
    const perms = (req && req.permissions) || [];
    const origins = (req && req.origins) || [];
    perms.forEach((p) => permState.permissions.delete(p));
    origins.forEach((o) => permState.origins.delete(o));
    if (typeof cb === 'function') cb(true);
  }

  function containsPermissions(req, cb) {
    if (typeof cb === 'function') cb(hasAllPermissions(req));
  }

  global.chrome = {
    runtime: {
      getManifest: jest.fn(() => ({})),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    storage: {
      sync: {
        get: jest.fn((defaults, cb) => {
          const out = Object.assign({}, defaults);
          if (Object.prototype.hasOwnProperty.call(defaults || {}, 'extraHosts')) out.extraHosts = store.extraHosts.slice();
          if (Object.prototype.hasOwnProperty.call(defaults || {}, 'pendingHost')) out.pendingHost = store.pendingHost;
          cb(out);
        }),
        set: jest.fn((obj, cb) => {
          if (obj && Object.prototype.hasOwnProperty.call(obj, 'extraHosts')) {
            store.extraHosts = Array.isArray(obj.extraHosts) ? obj.extraHosts.slice() : [];
          }
          if (obj && Object.prototype.hasOwnProperty.call(obj, 'pendingHost')) {
            store.pendingHost = obj.pendingHost || null;
          }
          cb && cb();
        }),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    permissions: {
      request: jest.fn((req, cb) => requestPermissions(req, cb)),
      remove: jest.fn((req, cb) => removePermissions(req, cb)),
      contains: jest.fn((req, cb) => containsPermissions(req, cb)),
      getAll: jest.fn((cb) => cb({
        permissions: Array.from(permState.permissions),
        origins: Array.from(permState.origins),
      })),
    },
    tabs: {
      query: jest.fn((queryInfo, cb) => cb([{ id: 123, url: 'https://abc-github.cloud.xyz/owner/repo/pull/123/files' }])),
      reload: jest.fn(() => {}),
    },
    __mockState: { store, permState },
  };
})();
