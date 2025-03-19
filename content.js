function isDebugEnabled() {
  try {
    return window.location.search.includes('debug=true');
  } catch (e) {
    return false;
  }
}

const DEBUG = isDebugEnabled();

function log(message, ...data) {
  if (!DEBUG) return;
  console.log(`%c[Git Well Soon] ${message}`, 'color: #6f42c1;', ...data);
}

log('Extension initialized');
log(`DEBUG mode: ${DEBUG ? 'ON' : 'OFF'}`);

function isGitHubSite() {
  const host = window.location.hostname;
  const result =
    host === 'github.com' ||
    host.includes('ghe.') ||
    host.includes('github.') ||
    // Common GitHub Enterprise patterns
    /git\..*/.test(host);
  log(`Checking if GitHub site: ${host} => ${result}`);
  return result;
}

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

const observeUrlChange = () => {
  if (!isGitHubSite()) {
    log('Not a GitHub site, exiting');
    return;
  }

  addWhitespaceParam();
  let oldHref = document.location.href;
  const body = document.querySelector('body');
  const observer = new MutationObserver(() => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;
      log('URL changed', document.location.href);
      addWhitespaceParam();
    }
  });
  observer.observe(body, { childList: true, subtree: true });

  window.addEventListener('unload', () => {
    observer.disconnect();
    log('Observer disconnected');
  });
};

window.addEventListener('load', observeUrlChange);

export { isDebugEnabled, isGitHubSite, isRelevantPage, addWhitespaceParam };
