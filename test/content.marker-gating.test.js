/**
 * @jest-environment jsdom
 */

// 3.1 gating: an explicit grant (window.__gwsGranted, set by granted-marker.js)
// enables the extension regardless of the legacy hostname heuristic; without a
// grant the heuristic is still honoured so no existing user goes dark.

const { resetWindow, loadContent, fireLoad, nudgeEl } = require('./content.load-helpers.js');

const GRANTED_ONLY = 'https://code.corp.example/owner/repo/pull/1/files';
const HEURISTIC = 'https://github.corp.example/owner/repo/pull/1/files';

describe('content.js marker gating', () => {
  test('granted marker enables the extension on a host the heuristic rejects', () => {
    resetWindow(GRANTED_ONLY);
    window.__gwsGranted = true;
    const { isGitHubSite, isHostEnabled } = loadContent();
    expect(isGitHubSite()).toBe(false);
    expect(isHostEnabled()).toBe(true);
    fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  test('granted hosts never see the nudge', () => {
    resetWindow(HEURISTIC);
    window.__gwsGranted = true;
    loadContent();
    fireLoad();
    expect(nudgeEl()).toBeNull();
  });

  test('no marker + heuristic pass = enabled and nudge-eligible', () => {
    resetWindow(HEURISTIC);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(true);
    fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(nudgeEl()).not.toBeNull();
  });

  test('no marker + heuristic fail = disabled, and no nudge', () => {
    resetWindow(GRANTED_ONLY);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(false);
    fireLoad();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(nudgeEl()).toBeNull();
  });

  test('built-in GitHub hosts are enabled with no marker and no nudge', () => {
    resetWindow('https://github.com/owner/repo/pull/1/files');
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(true);
    fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(nudgeEl()).toBeNull();
  });

  test('the marker is read lazily: set after load, before the load event', () => {
    // granted-marker.js can lose the document_start race against the
    // manifest-injected copy of content.js, so the flag must never be latched
    // at script-evaluation time.
    resetWindow(GRANTED_ONLY);
    const { isHostEnabled } = loadContent();
    expect(isHostEnabled()).toBe(false); // not yet marked
    window.__gwsGranted = true; // marker script wins the race late
    expect(isHostEnabled()).toBe(true);
    fireLoad();
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
