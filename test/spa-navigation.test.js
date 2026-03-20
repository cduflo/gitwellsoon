/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock chrome storage API before importing content.js
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((defaults, cb) => cb(defaults)),
    },
  },
};

const {
  setupRelevantPageObserver,
  interceptLinkClicks,
  isRelevantLink,
  updateLink,
} = require('../content.js');

// Mock replaceState and reload
window.history.replaceState = jest.fn();

describe('setupRelevantPageObserver - SPA navigation', () => {
  let reloadMock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    reloadMock = jest.fn();
    // Ensure body exists
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setLocation(url) {
    const parsed = new URL(url);
    Object.defineProperty(window, 'location', {
      value: {
        href: url,
        pathname: parsed.pathname,
        hostname: parsed.hostname,
        search: parsed.search,
        origin: parsed.origin,
        reload: reloadMock,
      },
      writable: true,
      configurable: true,
    });
  }

  it('should start observer even on non-relevant pages (Conversation tab)', () => {
    setLocation('https://github.com/owner/repo/pull/123');

    // Should not throw — observer should start even though page is not relevant
    expect(() => setupRelevantPageObserver()).not.toThrow();

    // replaceState should NOT be called since this is not a relevant page
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('should call addWhitespaceParam when URL changes to a relevant page', async () => {
    // Start on Conversation tab (non-relevant)
    setLocation('https://github.com/owner/repo/pull/123');
    setupRelevantPageObserver();

    expect(window.history.replaceState).not.toHaveBeenCalled();

    // Simulate GitHub SPA navigation: URL changes to /files and DOM mutates
    setLocation('https://github.com/owner/repo/pull/123/files');
    document.body.appendChild(document.createElement('div'));

    // Flush MutationObserver microtask, then advance past debounce (50ms)
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // addWhitespaceParam should have been called (replaceState is its indicator)
    expect(window.history.replaceState).toHaveBeenCalled();
    const calledUrl = window.history.replaceState.mock.calls[0][2];
    expect(calledUrl).toContain('/files');
    expect(calledUrl).toContain('w=1');
  });

  it('should call addWhitespaceParam when URL changes to /changes page', async () => {
    setLocation('https://github.com/owner/repo/pull/123');
    setupRelevantPageObserver();

    // Navigate to /changes via SPA
    setLocation('https://github.com/owner/repo/pull/123/changes');
    document.body.appendChild(document.createElement('span'));
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    expect(window.history.replaceState).toHaveBeenCalled();
    const calledUrl = window.history.replaceState.mock.calls[0][2];
    expect(calledUrl).toContain('/changes');
    expect(calledUrl).toContain('w=1');
  });

  it('should keep observing after navigating to a non-relevant page', async () => {
    // Start on Files tab (relevant)
    setLocation('https://github.com/owner/repo/pull/123/files?w=1');
    setupRelevantPageObserver();
    jest.clearAllMocks();

    // SPA navigate to Conversation tab (non-relevant)
    setLocation('https://github.com/owner/repo/pull/123');
    document.body.appendChild(document.createElement('div'));
    await Promise.resolve(); // flush MutationObserver microtask
    jest.advanceTimersByTime(100);

    // Should NOT call replaceState (non-relevant page)
    expect(window.history.replaceState).not.toHaveBeenCalled();

    // Now SPA navigate BACK to Files tab
    setLocation('https://github.com/owner/repo/pull/123/files');
    document.body.appendChild(document.createElement('div'));
    await Promise.resolve(); // flush MutationObserver microtask
    jest.advanceTimersByTime(100);

    // Should call replaceState (relevant page, w=1 missing)
    expect(window.history.replaceState).toHaveBeenCalled();
    const calledUrl = window.history.replaceState.mock.calls[0][2];
    expect(calledUrl).toContain('w=1');
  });

  it('should not call addWhitespaceParam if URL has not changed', async () => {
    setLocation('https://github.com/owner/repo/pull/123/files?w=1');
    setupRelevantPageObserver();
    jest.clearAllMocks();

    // DOM mutation without URL change
    document.body.appendChild(document.createElement('div'));
    await Promise.resolve();
    jest.advanceTimersByTime(100);

    // replaceState should NOT be called (w=1 already present)
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('should handle Conversation -> Commits -> Files SPA navigation', async () => {
    // Start on Conversation tab
    setLocation('https://github.com/owner/repo/pull/123');
    setupRelevantPageObserver();

    // SPA navigate to Commits tab (non-relevant for w=1)
    setLocation('https://github.com/owner/repo/pull/123/commits');
    document.body.appendChild(document.createElement('div'));
    await Promise.resolve(); // flush MutationObserver microtask
    jest.advanceTimersByTime(100);
    jest.clearAllMocks();

    // SPA navigate to Files tab
    setLocation('https://github.com/owner/repo/pull/123/files');
    document.body.appendChild(document.createElement('div'));
    await Promise.resolve(); // flush MutationObserver microtask
    jest.advanceTimersByTime(100);

    expect(window.history.replaceState).toHaveBeenCalled();
    const calledUrl = window.history.replaceState.mock.calls[0][2];
    expect(calledUrl).toContain('/files');
    expect(calledUrl).toContain('w=1');
  });
});

describe('interceptLinkClicks - SPA link updates', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/owner/repo/pull/123'),
      writable: true,
      configurable: true,
    });
  });

  it('should add w=1 to a clicked relevant link', () => {
    interceptLinkClicks();

    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files';
    document.body.appendChild(link);

    link.click();

    const url = new URL(link.href);
    expect(url.searchParams.get('w')).toBe('1');
  });

  it('should not modify a clicked non-relevant link', () => {
    interceptLinkClicks();

    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123';
    document.body.appendChild(link);

    const originalHref = link.href;
    link.click();

    expect(link.href).toBe(originalHref);
  });

  it('should not modify link if w=1 is already present', () => {
    interceptLinkClicks();

    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files?w=1';
    document.body.appendChild(link);

    const originalHref = link.href;
    link.click();

    expect(link.href).toBe(originalHref);
  });

  it('should not modify link if w=0 is explicitly set', () => {
    interceptLinkClicks();

    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files?w=0';
    document.body.appendChild(link);

    const originalHref = link.href;
    link.click();

    expect(link.href).toBe(originalHref);
  });
});

describe('updateLink', () => {
  it('should add w=1 to a relevant link', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files';
    updateLink(link);
    expect(new URL(link.href).searchParams.get('w')).toBe('1');
  });

  it('should not modify a link that already has w=1', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files?w=1';
    const original = link.href;
    updateLink(link);
    expect(link.href).toBe(original);
  });

  it('should not modify a non-relevant link', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123';
    const original = link.href;
    updateLink(link);
    expect(link.href).toBe(original);
  });

  it('should add w=1 to /changes link', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/456/changes';
    updateLink(link);
    expect(new URL(link.href).searchParams.get('w')).toBe('1');
  });
});

describe('isRelevantLink', () => {
  it('should match /pull/N/files links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/files';
    expect(isRelevantLink(link)).toBe(true);
  });

  it('should match /pull/N/changes links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123/changes';
    expect(isRelevantLink(link)).toBe(true);
  });

  it('should not match PR conversation links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/pull/123';
    expect(isRelevantLink(link)).toBe(false);
  });

  it('should match /compare/ links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/compare/main...feature';
    expect(isRelevantLink(link)).toBe(true);
  });

  it('should match /commit/ links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/commit/abc123';
    expect(isRelevantLink(link)).toBe(true);
  });

  it('should not match unrelated GitHub links', () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/owner/repo/issues/123';
    expect(isRelevantLink(link)).toBe(false);
  });
});
