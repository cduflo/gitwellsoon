/**
 * @jest-environment jsdom
 */

// The pin nudge (design §6): one dismissible banner, rendered only when all
// five conditions hold, remembered per page-domain in localStorage.

const { resetWindow, loadContent, fireLoad, nudgeEl } = require('./content.load-helpers.js');

const HEURISTIC_DIFF = 'https://github.corp.example/owner/repo/pull/1/files?w=1';

function run(href) {
  resetWindow(href);
  loadContent();
  fireLoad();
}

describe('pin nudge render conditions', () => {
  test('renders on a heuristic-matched, ungranted, relevant page', () => {
    run(HEURISTIC_DIFF);
    const el = nudgeEl();
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('pin permission');
    expect(el.querySelector('button')).not.toBeNull();
  });

  test('does not render on a built-in GitHub host', () => {
    run('https://github.com/owner/repo/pull/1/files?w=1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render on a *.ghe.com built-in host', () => {
    run('https://acme.ghe.com/owner/repo/pull/1/files?w=1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render on a non-diff page', () => {
    run('https://github.corp.example/owner/repo/issues/1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render when the marker is present', () => {
    resetWindow(HEURISTIC_DIFF);
    window.__gwsGranted = true;
    loadContent();
    fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('does not render when the marker arrives after content.js loaded', () => {
    // The ordering race: the flag must be read at nudge-decision time.
    resetWindow(HEURISTIC_DIFF);
    loadContent();
    window.__gwsGranted = true;
    fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('renders only once even when content.js is injected twice', () => {
    resetWindow(HEURISTIC_DIFF);
    loadContent();
    loadContent();
    fireLoad();
    expect(document.querySelectorAll('#gws-pin-nudge')).toHaveLength(1);
  });
});

describe('pin nudge dismissal', () => {
  test('dismiss removes the banner and persists the choice', () => {
    run(HEURISTIC_DIFF);
    nudgeEl().querySelector('button').click();
    expect(nudgeEl()).toBeNull();
    expect(window.localStorage.getItem('gws-pin-nudge')).toBe('dismissed');
  });

  test('a dismissed host never sees it again', () => {
    resetWindow(HEURISTIC_DIFF);
    window.localStorage.setItem('gws-pin-nudge', 'dismissed');
    loadContent();
    fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('survives pages that block localStorage', () => {
    resetWindow(HEURISTIC_DIFF);
    const getItem = jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    loadContent();
    expect(() => fireLoad()).not.toThrow();
    const el = nudgeEl();
    expect(el).not.toBeNull();
    expect(() => el.querySelector('button').click()).not.toThrow();
    expect(nudgeEl()).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
