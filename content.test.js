const {
  isDebugEnabled,
  isGitHubSite,
  isRelevantPage,
  addWhitespaceParam,
} = require('./content');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

// Create a new JSDOM instance
const dom = new JSDOM('', { url: 'https://github.com/pull/123/files' });
global.window = dom.window;
global.document = dom.window.document;

global.window.history.replaceState = jest.fn();

describe('isDebugEnabled', () => {
  it('should return true if debug=true is in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?debug=true'),
      writable: true,
    });
    expect(isDebugEnabled()).toBe(true);
  });

  it('should return false if debug=true is not in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files'),
      writable: true,
    });
    expect(isDebugEnabled()).toBe(false);
  });

  it('should return true if debug=true is among multiple query parameters', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'https://github.com/pull/123/files?foo=bar&debug=true&baz=qux'
      ),
      writable: true,
    });
    expect(isDebugEnabled()).toBe(true);
  });

  it('should return false if debug=false is in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?debug=false'),
      writable: true,
    });
    expect(isDebugEnabled()).toBe(false);
  });
});

describe('isGitHubSite - extended tests', () => {
  it('should return false for gitlab.com', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://gitlab.com/pull/123/files'),
      writable: true,
    });
    expect(isGitHubSite()).toBe(false);
  });

  it('should return true for git.zias.io', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://git.zias.io/pull/123/files'),
      writable: true,
    });
    expect(isGitHubSite()).toBe(true);
  });

  it('should return true for ghe.whatever.com', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ghe.whatever.com/pull/123/files'),
      writable: true,
    });
    expect(isGitHubSite()).toBe(true);
  });

  it('should return true for github.wlhat.com', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.wlhat.com/pull/123/files'),
      writable: true,
    });
    expect(isGitHubSite()).toBe(true);
  });

  it('should return false for google.com', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://google.com/pull/123/files'),
      writable: true,
    });
    expect(isGitHubSite()).toBe(false);
  });
});

describe('isRelevantPage', () => {
  it('should return true for pull request files page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });

  it('should return false for non-relevant pages', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/issues/123'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(false);
  });

  it('should return true for compare branches page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/user/repo/compare/branch1...branch2'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });

  it('should return true for commit view page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/user/repo/commit/sha'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });

  it('should return true for commits list page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/user/repo/commits/branch'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });

  it('should return true for comparing commits page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/user/repo/compare/sha1..sha2'),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });

  it('should return true for comparing across forks page', () => {
    Object.defineProperty(window, 'location', {
      value: new URL(
        'https://github.com/octocat/linguist/compare/octocat:master...octo-org:main'
      ),
      writable: true,
    });
    expect(isRelevantPage()).toBe(true);
  });
});

describe('addWhitespaceParam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files'),
      writable: true,
    });
  });

  it('should add whitespace parameter if not present', () => {
    addWhitespaceParam();
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should not add whitespace parameter if already present and truthy', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?w=1'),
      writable: true,
    });
    addWhitespaceParam();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('should not add whitespace parameter if already present and falsy', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?w=0'),
      writable: true,
    });
    addWhitespaceParam();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('should add whitespace parameter when URL has multiple parameters', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?foo=bar&baz=qux'),
      writable: true,
    });
    addWhitespaceParam();
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should handle malformed URLs gracefully', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/pull/123/files?foo=bar&baz=qux'),
      writable: true,
    });
    window.location.href = 'https://github.com/pull/123/files?foo=bar&baz=qux';
    addWhitespaceParam();
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
