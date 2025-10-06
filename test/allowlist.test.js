/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('allowlist via EXTRA_HOSTS', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('treats user-added host as GitHub-like', () => {
    // Mock storage to return a custom host before loading content.js
    chrome.storage.sync.get.mockImplementation((defaults, cb) => {
      cb({ extraHosts: ['abc-github.cloud.xyz'] });
    });

    const functions = require('../content.js');
    const { isGitHubSite } = functions;

    Object.defineProperty(window, 'location', {
      value: new URL('https://abc-github.cloud.xyz/owner/repo/pull/123/files'),
      writable: true,
    });

    expect(isGitHubSite()).toBe(true);
  });
});
