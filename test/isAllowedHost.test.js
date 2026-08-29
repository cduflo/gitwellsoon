/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { resetWindow, loadContent } = require('./content.load-helpers.js');

describe('isAllowedHost (built-ins)', () => {
  it('returns true for built-in github.com', () => {
    resetWindow('https://github.com/pull/1/files');
    const { isGitHubSite } = loadContent();
    expect(isGitHubSite()).toBe(true);
  });

  it('classifies built-in hosts independently of the heuristic', () => {
    resetWindow('https://github.com/pull/1/files');
    const { isBuiltInHost } = loadContent();
    expect(isBuiltInHost('github.com')).toBe(true);
    expect(isBuiltInHost('acme.ghe.com')).toBe(true);
    expect(isBuiltInHost('foo.github.com')).toBe(true);
    expect(isBuiltInHost('github.corp.example')).toBe(false);
  });
});
