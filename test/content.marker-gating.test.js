/**
 * @jest-environment jsdom
 */

// 3.1 gating: an explicit grant (window.__gwsGranted, set by granted-marker.js)
// enables the extension regardless of the legacy hostname heuristic. Without a
// marker the heuristic is still honoured, and a manifest-injected execution
// that would otherwise go dark asks the worker first — which is what restores
// 2.x's subdomain coverage.

const {
  resetWindow,
  mockWorkerGrant,
  loadContent,
  fireLoad,
  nudgeEl,
} = require('./content.load-helpers.js');

const GRANTED_ONLY = 'https://code.corp.example/owner/repo/pull/1/files';
const HEURISTIC = 'https://github.corp.example/owner/repo/pull/1/files';

describe('content.js marker gating', () => {
  test('granted marker enables the extension on a host the heuristic rejects', async () => {
    resetWindow(GRANTED_ONLY);
    window.__gwsGranted = true;
    const send = mockWorkerGrant(false);
    const { isGitHubSite, isHostEnabled } = loadContent();
    expect(isGitHubSite()).toBe(false);
    expect(isHostEnabled()).toBe(true);
    await fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
    // The marker is authoritative; no round-trip needed.
    expect(send).not.toHaveBeenCalled();
  });

  test('granted hosts never see the nudge', async () => {
    resetWindow(HEURISTIC);
    window.__gwsGranted = true;
    mockWorkerGrant(false);
    loadContent();
    await fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('no marker + heuristic pass = enabled and nudge-eligible', async () => {
    resetWindow(HEURISTIC);
    mockWorkerGrant(false);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(true);
    await fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(nudgeEl()).not.toBeNull();
  });

  test('no marker + heuristic fail + not granted = disabled, and no nudge', async () => {
    resetWindow(GRANTED_ONLY);
    mockWorkerGrant(false);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(false);
    await fireLoad();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(nudgeEl()).toBeNull();
  });

  test('built-in GitHub hosts are enabled with no marker, no nudge, no round-trip', async () => {
    resetWindow('https://github.com/owner/repo/pull/1/files');
    const send = mockWorkerGrant(false);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(true);
    await fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(nudgeEl()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  test('the marker is read lazily: set after load, before the load event', async () => {
    // granted-marker.js can lose the document_start race against the
    // manifest-injected copy of content.js, so the flag must never be latched
    // at script-evaluation time.
    resetWindow(GRANTED_ONLY);
    mockWorkerGrant(false);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(false); // not yet marked
    window.__gwsGranted = true; // marker script wins the race late
    expect(isHostEnabled()).toBe(true);
    await fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});

// Finding 2: the regression this closes.
describe('content.js asks the worker before going dark', () => {
  test('a parent-domain grant re-enables a subdomain with no marker', async () => {
    resetWindow(GRANTED_ONLY); // code.corp.example, heuristic fails, no marker
    const send = mockWorkerGrant(true); // worker: corp.example covers you
    loadContent();
    await fireLoad();

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gws-host-check', host: 'code.corp.example' }),
      expect.any(Function)
    );
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  test('an unreachable worker falls back to the heuristic answer', async () => {
    resetWindow(GRANTED_ONLY);
    mockWorkerGrant('unreachable');
    loadContent();
    await expect(fireLoad()).resolves.toBeUndefined();
    // Heuristic fails and the worker cannot answer, so it stays dark rather
    // than acting on a host it cannot justify.
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  test('an unreachable worker still lets a heuristic host work', async () => {
    resetWindow(HEURISTIC);
    mockWorkerGrant('unreachable');
    loadContent();
    await fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  test('a throwing sendMessage is survivable', async () => {
    resetWindow(HEURISTIC);
    global.chrome.runtime.sendMessage = jest.fn(() => {
      throw new Error('Extension context invalidated');
    });
    loadContent();
    await expect(fireLoad()).resolves.toBeUndefined();
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
