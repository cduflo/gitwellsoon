function isDebugEnabled() {
  try {
    return window.location.search.includes('debug=true');
  } catch (e) {
    return false;
  }
}

const DEBUG = isDebugEnabled();
const OBSERVER_DEBOUNCE_MS = 50;

// Patterns for relevant GitHub pages (from manifest)
const RELEVANT_PATH_PATTERNS = [
  /^\/[^/]+\/[^/]+\/pull\/\d+\/files$/,
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
log(`Current URL: ${window.location.href}`);
log(`Search params: ${window.location.search}`);
log(`Is test environment: ${window.location.search.includes('debug=true')}`);

// Make test navigation URL available globally
window.__gitWellSoonTestNavigation = null;

function isRelevantPage() {
  const path = window.location.pathname;
  const result =
    (path.includes('/pull/') && path.includes('/files')) ||
    path.includes('/compare/') ||
    path.includes('/commits/') ||
    path.includes('/commit/');
  log(`Checking if relevant page: ${path} => ${result}`);
  return result;
}

/**
 * Checks if a link is relevant for whitespace hiding.
 * Only matches PR files, compare, commits, and commit pages.
 * Host matching is handled by the manifest, so we only check the path here.
 */
function isRelevantLink(link) {
  try {
    const url = new URL(link.href);
    const result = RELEVANT_PATH_PATTERNS.some((pattern) =>
      pattern.test(url.pathname)
    );
    log('[isRelevantLink]', url.pathname, '->', result);
    return result;
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
          // Only observe if new page is relevant
          if (!isRelevantPage()) {
            observer.disconnect();
            observer = null;
            log('Observer disconnected (irrelevant page)');
            return;
          }
        }
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
    if (isRelevantPage()) {
      observer.observe(body, { childList: true, subtree: true });
      log('Observer started (relevant page)');
    }
  }

  startObserver();

  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
      observer = null;
      log('Observer disconnected');
    }
  });
}

function addWhitespaceParam() {
  log('addWhitespaceParam  // Only run on relevant pages (host matching is handled by manifest)');
  if (!isRelevantPage()) {
    log('Not a relevant page, skipping');
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
      // Only modify the URL if we're not in a test environment
      if (window.location.search.includes('debug=true')) {
        // In test environment, log the change in a way that's easy to check in tests
        const testMessage = `[Git Well Soon Test] Would have navigated to: ${urlString}`;
        console.log(testMessage);
        log(testMessage);
        // Also set it on window for easier access in tests
        window.__gitWellSoonTestNavigation = urlString;
      } else {
        // In production, update the URL and reload
        window.history.replaceState(history.state, document.title, urlString);
        window.location.reload();
      }
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

window.addEventListener('load', () => {
  interceptLinkClicks();
  setupRelevantPageObserver();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isDebugEnabled,
    isRelevantPage,
    addWhitespaceParam,
  };
}
