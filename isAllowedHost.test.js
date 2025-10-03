/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('isAllowedHost', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns true for built-in github.com', () => {
    // Ensure storage returns empty allowlist
    chrome.storage.sync.get.mockImplementation((defaults, cb) => cb({ extraHosts: [] }));
    const { isAllowedHost } = require('./content.js');
    expect(isAllowedHost('github.com')).toBe(true);
  });

  it('returns false for non-allowed example.com', () => {
    chrome.storage.sync.get.mockImplementation((defaults, cb) => cb({ extraHosts: [] }));
    const { isAllowedHost } = require('./content.js');
    expect(isAllowedHost('example.com')).toBe(false);
  });

  it('returns true for user-allowlisted abc-github.cloud.xyz', () => {
    chrome.storage.sync.get.mockImplementation((defaults, cb) => cb({ extraHosts: ['abc-github.cloud.xyz'] }));
    const { isAllowedHost } = require('./content.js');
    expect(isAllowedHost('abc-github.cloud.xyz')).toBe(true);
  });
});
