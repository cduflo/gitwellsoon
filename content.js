(function () {
  // Once-guard. On a granted host the broad manifest match and the dynamic
  // registration both inject this file; they are independent, share one
  // isolated world, and would otherwise redeclare every top-level binding and
  // install every listener twice. Only the first execution does any work.
  if (typeof window !== 'undefined' && window.__gwsLoaded) return;
  if (typeof window !== 'undefined') window.__gwsLoaded = true;

  function isDebugEnabled() {
    try {
      return window.location.search.includes('debug=true');
    } catch (e) {
      return false;
    }
  }

  const DEBUG = isDebugEnabled();
  const OBSERVER_DEBOUNCE_MS = 50;
  const NUDGE_KEY = 'gws-pin-nudge';

  // Patterns for relevant GitHub pages (from manifest)
  const RELEVANT_PATH_PATTERNS = [
    /^\/[^/]+\/[^/]+\/pull\/\d+\/files$/,
    /^\/[^/]+\/[^/]+\/pull\/\d+\/changes$/,
    /\/compare\//,
    /\/commits\//,
    /\/commit\//,
  ];

  function log(message, ...data) {
    if (!DEBUG) return;
    console.log(`%c[Git Well Soon] ${message}`, 'color: #6f42c1;', ...data);
  }

  log('Extension initialized');
  log(`DEBUG mode: ${DEBUG ? 'ON' : 'OFF'}`);

  function isBuiltInHost(host) {
    const h = String(host || '').toLowerCase();
    return h === 'github.com' || h.endsWith('.github.com') || h.endsWith('.ghe.com');
  }

  function isGitHubSite() {
    const host = window.location.hostname;
    const result =
      host === 'github.com' ||
      host.includes('ghe.') ||
      host.includes('github.') ||
      /git\..*/.test(host);
    log(`Checking if GitHub site: ${host} => ${result}`);
    return result;
  }

  /**
   * May this injection act on the page, judged from this world alone?
   * Read LAZILY — granted-marker.js is injected alongside this file at
   * document_start and can lose the race against the manifest-matched copy,
   * so window.__gwsGranted must never be latched at script-evaluation time.
   */
  function isHostEnabled() {
    if (window.__gwsGranted === true) return true;
    return isGitHubSite();
  }

  /**
   * Ask the worker whether this host is covered by any grant we hold. A
   * manifest-injected copy carries no marker and cannot read the permission
   * list itself, so without this a grant on corp.example would no longer cover
   * code.corp.example — a silent regression against 2.x. Resolves false if the
   * worker cannot be reached, which falls back to heuristic-only behaviour.
   */
  function askWorkerGranted() {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        const ret = chrome.runtime.sendMessage(
          { type: 'gws-host-check', host: window.location.hostname },
          (res) => {
            if (chrome.runtime && chrome.runtime.lastError) return done(false);
            done(!!(res && res.granted));
          }
        );
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (res) => done(!!(res && res.granted)),
            () => done(false)
          );
        }
      } catch (_) {
        done(false);
      }
    });
  }

  /**
   * Decide whether to act, and whether the host is genuinely granted (which the
   * nudge needs — see maybeShowPinNudge). The worker is consulted only when its
   * answer could change something: to rescue a host the heuristic rejects, or
   * to suppress a nudge on a host that is already covered by a grant.
   */
  async function resolveActivation() {
    if (window.__gwsGranted === true) return { enabled: true, granted: true };
    if (isBuiltInHost(window.location.hostname)) return { enabled: true, granted: false };

    const heuristic = isGitHubSite();
    const nudgeCandidate = heuristic && isRelevantPage() && !nudgeDismissed();
    let granted = false;
    if (!heuristic || nudgeCandidate) granted = await askWorkerGranted();
    return { enabled: granted || heuristic, granted };
  }

  function isRelevantPage() {
    const path = window.location.pathname;
    const result =
      (path.includes('/pull/') && (path.includes('/files') || path.includes('/changes'))) ||
      path.includes('/compare/') ||
      path.includes('/commits/') ||
      path.includes('/commit/');
    log(`Checking if relevant page: ${path} => ${result}`);
    return result;
  }

  /**
   * Checks if a link is relevant for whitespace hiding.
   * Only matches PR files, compare, commits, and commit pages.
   * Logs the match result in debug mode.
   */
  function isRelevantLink(link) {
    try {
      const url = new URL(link.href);
      const match = RELEVANT_PATH_PATTERNS.some((re) => re.test(url.pathname));
      log('[isRelevantLink]', url.hostname, url.pathname, '->', match);
      return match;
    } catch (e) {
      log('[isRelevantLink] Error:', e);
      return false;
    }
  }

  /**
   * Updates a single link to include w=1 if relevant.
   * Logs the update in debug mode.
   */
  function updateLink(link) {
    if (!isRelevantLink(link)) return;
    try {
      const url = new URL(link.href);
      if (url.searchParams.get('w') !== '1') {
        url.searchParams.set('w', '1');
        link.href = url.toString();
        log('Updated link:', link.href);
      }
    } catch (e) {
      log('[updateLink] Error:', e);
    }
  }

  /**
   * Sets up a MutationObserver that is only active on relevant pages.
   * Disconnects the observer on navigation to non-relevant pages.
   * Debounces the callback to reduce performance impact.
   */
  function setupRelevantPageObserver() {
    addWhitespaceParam();
    let oldHref = document.location.href;
    const body = document.querySelector('body');
    let observerTimeout = null;
    let observer = null;

    function startObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      observer = new MutationObserver((mutations) => {
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
          log('MutationObserver callback', mutations.length, 'mutations');
          if (oldHref !== document.location.href) {
            oldHref = document.location.href;
            log('URL changed', document.location.href);
            addWhitespaceParam();
          }
          if (!isRelevantPage()) return;
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                if (node.tagName === 'A' && isRelevantLink(node)) {
                  log('Processing added link node:', node.href);
                  updateLink(node);
                }
                node.querySelectorAll &&
                  node.querySelectorAll('a[href]').forEach((l) => {
                    if (isRelevantLink(l)) {
                      log('Processing added descendant link:', l.href);
                      updateLink(l);
                    }
                  });
              }
            }
          }
        }, OBSERVER_DEBOUNCE_MS);
      });
      observer.observe(body, { childList: true, subtree: true });
      log('Observer started');
    }

    startObserver();
  }

  function addWhitespaceParam() {
    log('addWhitespaceParam called');

    if (!isRelevantPage()) {
      log('Not a relevant page, exiting');
      return;
    }

    const url = new URL(window.location.href);
    const isHidingWhitespace = url.searchParams.get('w');

    const allParams = {};
    url.searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    log(`Current URL: ${url.toString()}, all params:`, allParams);

    if (isHidingWhitespace === null) {
      url.searchParams.set('w', '1');

      const urlString = url.toString();
      log(`Adding whitespace parameter, new URL: ${urlString}`);
      log(
        `All parameters after adding w=1:`,
        Object.fromEntries(url.searchParams.entries())
      );

      try {
        window.history.replaceState(history.state, document.title, urlString);
        window.location.reload();
        log('Successfully called replaceState');
      } catch (e) {
        log('Error in replaceState:', e);
      }
    } else {
      log(`Whitespace parameter already set: ${isHidingWhitespace}`);
    }
  }

  // Intercept clicks on relevant links to ensure w=1 is present before navigation
  function interceptLinkClicks() {
    document.body.addEventListener(
      'click',
      function (e) {
        // Only handle left-clicks, no modifier keys, not already prevented
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        let link = e.target;
        while (link && link.tagName !== 'A') link = link.parentElement;
        if (!link || !isRelevantLink(link)) return;
        try {
          const url = new URL(link.href, window.location.origin);
          const w = url.searchParams.get('w');
          if (w === '1' || w === '0') return;
          url.searchParams.set('w', '1');
          link.href = url.toString();
          log('Intercepted click and updated link:', link.href);
          // No need to preventDefault; updating href is enough for GitHub's SPA
        } catch (e) {}
      },
      true
    ); // Use capture to run before GitHub's handlers
  }

  // --- Pin nudge: converts heuristic-matched hosts into explicit grants ---

  function nudgeDismissed() {
    try {
      return window.localStorage.getItem(NUDGE_KEY) === 'dismissed';
    } catch (_) {
      return false; // some pages block localStorage; show it rather than hide it
    }
  }

  function rememberNudgeDismissed() {
    try {
      window.localStorage.setItem(NUDGE_KEY, 'dismissed');
    } catch (_) {}
  }

  /**
   * Renders one dismissible banner when ALL of: no explicit grant, the legacy
   * heuristic matched, the host is not a built-in GitHub host, the page is a
   * diff view, and the banner was not already dismissed on this domain.
   *
   * `grantedByWorker` is what keeps it honest. The marker only says "this
   * execution came from a dynamic registration"; a parent-domain or wildcard
   * grant covers the host without registering it under this exact name, and
   * telling those users to pin a permission they already hold would burn the
   * one dismissal they get.
   */
  function maybeShowPinNudge(grantedByWorker) {
    if (window.__gwsGranted === true) return;
    if (grantedByWorker === true) return;
    if (isBuiltInHost(window.location.hostname)) return;
    if (!isGitHubSite()) return;
    if (!isRelevantPage()) return;
    if (nudgeDismissed()) return;
    if (document.getElementById(NUDGE_KEY)) return;

    const bar = document.createElement('div');
    bar.id = NUDGE_KEY;
    bar.setAttribute('role', 'status');
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;' +
      'align-items:center;justify-content:center;gap:12px;padding:10px 14px;' +
      'background:#fff8c5;color:#1f2328;border-top:1px solid #d4a72c;' +
      'font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;';

    const text = document.createElement('span');
    text.textContent =
      'Git Well Soon works here via pattern-matching. Click the extension icon to pin permission for this host.';

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.style.cssText =
      'padding:4px 10px;border:1px solid #d0d7de;border-radius:6px;background:#fff;cursor:pointer;font:inherit;';
    dismiss.addEventListener('click', () => {
      rememberNudgeDismissed();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });

    bar.appendChild(text);
    bar.appendChild(dismiss);
    (document.body || document.documentElement).appendChild(bar);
    log('Pin nudge rendered');
  }

  window.addEventListener('load', () => {
    resolveActivation()
      .then(({ enabled, granted }) => {
        if (!enabled) {
          log('Current host is neither granted nor GitHub-like; exiting');
          return;
        }
        interceptLinkClicks();
        setupRelevantPageObserver();
        maybeShowPinNudge(granted);
      })
      .catch((e) => log('Activation failed:', e));
  });

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isDebugEnabled,
      isBuiltInHost,
      isGitHubSite,
      isHostEnabled,
      resolveActivation,
      isRelevantPage,
      addWhitespaceParam,
      maybeShowPinNudge,
    };
  }
})();
