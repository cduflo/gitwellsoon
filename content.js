function isDebugEnabled() {
  try {
    return window.location.search.includes('debug=true');
  } catch (e) {
    // If anything goes wrong, default to false
    return false;
  }
}

const DEBUG = isDebugEnabled();

// Logging helper function
function log(message, ...data) {
  if (!DEBUG) return;
  console.log(`%c[Git Well Soon] ${message}`, 'color: #6f42c1;', ...data);
}

// Initial loading
log('Extension initialized');
log(`DEBUG mode: ${DEBUG ? 'ON' : 'OFF'}`);

// // Function to check if we're on a GitHub-related site
function isGitHubSite() {
  const host = window.location.hostname;
  const result =
    host === 'github.com' ||
    host.includes('ghe.com') ||
    host.includes('github') ||
    // Common GitHub Enterprise patterns
    /git\..*/.test(host);
  log(`Checking if GitHub site: ${host} => ${result}`);
  return result;
}

// Function to check if this is a PR/compare/commit page
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

// // Function to safely add the whitespace parameter while preserving all other query parameters
function addWhitespaceParam() {
  log('addWhitespaceParam called');

  if (!isGitHubSite()) {
    log('Not a GitHub site, exiting');
    return;
  }

  if (!isRelevantPage()) {
    log('Not a relevant page, exiting');
    return;
  }

  // Always create a new URL object from the current URL to ensure we have all parameters
  const url = new URL(window.location.href);
  const isHidingWhitespace = url.searchParams.get('w');

  // Log all existing query parameters
  const allParams = {};
  url.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });
  log(`Current URL: ${url.toString()}, all params:`, allParams);

  // Only modify if the parameter isn't already set
  if (isHidingWhitespace === null) {
    // Add w=1 while preserving all other parameters
    url.searchParams.set('w', '1');

    const urlString = url.toString();
    log(`Adding whitespace parameter, new URL: ${urlString}`);
    log(
      `All parameters after adding w=1:`,
      Object.fromEntries(url.searchParams.entries())
    );

    // Use history.replaceState to avoid a page reload
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

const observeUrlChange = () => {
  addWhitespaceParam();
  let oldHref = document.location.href;
  const body = document.querySelector('body');
  const observer = new MutationObserver((mutations) => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;
      log('URL changed', document.location.href);
      addWhitespaceParam();
    }
  });
  observer.observe(body, { childList: true, subtree: true });
};

window.addEventListener('load', observeUrlChange);
