/**
 * @jest-environment jsdom
 */

// The pin nudge (design §6): one dismissible banner, rendered only when all
// conditions hold, remembered per page-domain in localStorage. Finding 7: it
// must gate on whether the host is actually GRANTED, not on whether this
// particular execution carries the registration marker.

const {
  resetWindow,
  mockWorkerGrant,
  loadContent,
  fireLoad,
  nudgeEl,
} = require('./content.load-helpers.js');

const HEURISTIC_DIFF = 'https://github.corp.example/owner/repo/pull/1/files?w=1';

async function run(href, workerAnswer = false) {
  resetWindow(href);
  mockWorkerGrant(workerAnswer);
  loadContent();
  await fireLoad();
}

describe('pin nudge render conditions', () => {
  test('renders on a heuristic-matched, ungranted, relevant page', async () => {
    await run(HEURISTIC_DIFF);
    const el = nudgeEl();
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('pin permission');
    expect(el.querySelector('button')).not.toBeNull();
  });

  test('does not render on a built-in GitHub host', async () => {
    await run('https://github.com/owner/repo/pull/1/files?w=1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render on a *.ghe.com built-in host', async () => {
    await run('https://acme.ghe.com/owner/repo/pull/1/files?w=1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render on a non-diff page', async () => {
    await run('https://github.corp.example/owner/repo/issues/1');
    expect(nudgeEl()).toBeNull();
  });

  test('does not render when the marker is present', async () => {
    resetWindow(HEURISTIC_DIFF);
    mockWorkerGrant(false);
    window.__gwsGranted = true;
    loadContent();
    await fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('does not render when the marker arrives after content.js loaded', async () => {
    // The ordering race: the flag must be read at nudge-decision time.
    resetWindow(HEURISTIC_DIFF);
    mockWorkerGrant(false);
    loadContent();
    window.__gwsGranted = true;
    await fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  // Finding 7: a parent-domain or wildcard grant covers this host, so the
  // marker is absent but the user has nothing left to pin.
  test('does not render when the worker says the host is already granted', async () => {
    await run(HEURISTIC_DIFF, true);
    expect(nudgeEl()).toBeNull();
  });

  test('still renders when the worker says the host is not granted', async () => {
    await run(HEURISTIC_DIFF, false);
    expect(nudgeEl()).not.toBeNull();
  });

  test('renders when the worker is unreachable (falls back to current behaviour)', async () => {
    await run(HEURISTIC_DIFF, 'unreachable');
    expect(nudgeEl()).not.toBeNull();
  });

  test('renders only once even when content.js is injected twice', async () => {
    resetWindow(HEURISTIC_DIFF);
    mockWorkerGrant(false);
    loadContent();
    loadContent();
    await fireLoad();
    expect(document.querySelectorAll('#gws-pin-nudge')).toHaveLength(1);
  });
});

describe('pin nudge dismissal', () => {
  test('dismiss removes the banner and persists the choice', async () => {
    await run(HEURISTIC_DIFF);
    nudgeEl().querySelector('button').click();
    expect(nudgeEl()).toBeNull();
    expect(window.localStorage.getItem('gws-pin-nudge')).toBe('dismissed');
  });

  test('a dismissed host never sees it again', async () => {
    resetWindow(HEURISTIC_DIFF);
    mockWorkerGrant(false);
    window.localStorage.setItem('gws-pin-nudge', 'dismissed');
    loadContent();
    await fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('survives pages that block localStorage', async () => {
    resetWindow(HEURISTIC_DIFF);
    mockWorkerGrant(false);
    const getItem = jest
      .spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const setItem = jest
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    loadContent();
    await expect(fireLoad()).resolves.toBeUndefined();
    const el = nudgeEl();
    expect(el).not.toBeNull();
    expect(() => el.querySelector('button').click()).not.toThrow();
    expect(nudgeEl()).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
