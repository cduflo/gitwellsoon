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
      get: jest.fn((defaults, cb) => cb({ extraHosts: [] })),
      set: jest.fn((obj, cb) => cb && cb()),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  permissions: {
    request: jest.fn(async () => true),
    remove: jest.fn(async () => true),
    contains: jest.fn((perms, cb) => cb(true)),
  },
  tabs: {
    query: jest.fn((queryInfo, cb) => cb([{ id: 123, url: 'https://abc-github.cloud.xyz/owner/repo/pull/123/files' }])),
    reload: jest.fn(() => {}),
  },
};
