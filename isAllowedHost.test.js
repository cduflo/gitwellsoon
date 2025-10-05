/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('isAllowedHost (built-ins)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns true for built-in github.com', () => {
    // Ensure storage returns empty allowlist
    chrome.storage.sync.get.mockImplementation((defaults, cb) => cb({ extraHosts: [] }));
const { isGitHubSite } = require('./content.js');
Object.defineProperty(window, 'location', { value: new URL('https://github.com/pull/1/files'), writable: true });
expect(isGitHubSite()).toBe(true);
  });


});
