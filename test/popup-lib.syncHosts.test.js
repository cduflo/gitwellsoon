/**
 * @jest-environment jsdom
 */

const PopupLib = require('../popup-lib.js');

function makeChrome({ hosts = [], containsGranted = {} } = {}) {
  let stored = hosts.slice();
  return {
    storage: {
      sync: {
        get: jest.fn(async (defaults) => ({ extraHosts: stored })),
        set: jest.fn(async ({ extraHosts }) => {
          stored = Array.isArray(extraHosts) ? extraHosts : [];
        }),
      },
    },
    permissions: {
      contains: jest.fn((perms, cb) => {
        const origin = (perms.origins && perms.origins[0]) || '';
        const m = origin.match(/^https:\/\/([^/]+)/);
        const h = m ? m[1] : '';
        cb(!!containsGranted[h]);
      }),
    },
  };
}

describe('syncHostsWithPermissions', () => {
  test('filters out hosts without granted permissions', async () => {
    const chromeLike = makeChrome({ hosts: ['a.example.com', 'b.example.com'], containsGranted: { 'b.example.com': true } });
    const allowed = await PopupLib.syncHostsWithPermissions(chromeLike);
    expect(allowed).toEqual(['b.example.com']);
  });
});
