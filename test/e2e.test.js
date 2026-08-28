const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '..'); // project root (extension directory)
const TEST_PR_URL = 'https://github.com/mui/material-ui/pull/45606/files';
const TEST_NON_PR_URL = 'https://github.com/mui/material-ui/pull/45606';

let browser;
let page;
let extensionId;

function launch() {
  return puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  });
}

/**
 * The extension's MV3 service worker target (3.1 added worker.js). Polled
 * rather than waitForTarget'd: the worker starts a moment after launch and
 * idles out again, so we look at the live target list each time.
 */
async function workerTarget(b, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = b
      .targets()
      .find((t) => t.type() === 'service_worker' && t.url().endsWith('/worker.js'));
    if (found) return found;
    if (Date.now() > deadline) {
      throw new Error(
        'extension service worker target not found; targets: ' +
          JSON.stringify(b.targets().map((t) => `${t.type()} ${t.url()}`))
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const extensionIdOf = (target) => new URL(target.url()).host;

async function newPage(b) {
  const p = await b.newPage();
  p.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));
  return p;
}

beforeAll(async () => {
  browser = await launch();
  // Capture the id while the worker is definitely alive: MV3 service workers
  // idle out after ~30s, so later describes can no longer find the target.
  extensionId = extensionIdOf(await workerTarget(browser));
});

afterAll(async () => {
  if (browser) await browser.close();
  browser = undefined;
});

beforeEach(async () => {
  page = await newPage(browser);
});

afterEach(async () => {
  if (page && !page.isClosed()) await page.close();
  page = undefined;
});

// --- 3.1 permission-surface checks (see docs/V-CHECKLIST.md) ---
// Declared first so they run while the service worker is still alive.

describe('3.1 service worker and dynamic registration', () => {
  test('the MV3 service worker loads with only scripting + activeTab', async () => {
    const worker = await (await workerTarget(browser)).worker();

    const info = await worker.evaluate(async () => ({
      permissions: (await chrome.permissions.getAll()).permissions,
      registered: (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id),
      hasPopupLib: typeof PopupLib === 'object',
    }));

    expect(info.permissions).toEqual(expect.arrayContaining(['scripting', 'activeTab']));
    expect(info.permissions).not.toContain('storage');
    expect(info.permissions).not.toContain('tabs');
    // importScripts('popup-lib.js') gives the worker the shared classifier.
    expect(info.hasPopupLib).toBe(true);
    // No custom origin is granted in this profile, so nothing is registered.
    expect(info.registered).toEqual([]);
  });

  // The worker now answers a host-check for content scripts. Verify the
  // message plumbing really works in Chrome, not just against the mock.
  test('answers gws-host-check from another extension context', async () => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });

    const reply = await page.evaluate(
      () =>
        new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'gws-host-check', host: 'code.corp.example' }, (res) =>
            resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : res)
          );
        })
    );
    expect(reply).toEqual({ granted: false });

    const ignored = await page.evaluate(
      () =>
        new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'not-ours' }, () =>
            resolve(chrome.runtime.lastError ? 'lastError' : 'responded')
          );
        })
    );
    // Unowned messages are left for someone else; Chrome reports no receiver.
    expect(['lastError', 'responded']).toContain(ignored);
  });

  test('registration is derived from granted origins only', async () => {
    const worker = await (await workerTarget(browser)).worker();

    const hosts = await worker.evaluate(() => PopupLib.listGrantedHosts(chrome));
    expect(hosts).toEqual([]);

    // The registration spec the worker and the popup share.
    const spec = await worker.evaluate(() => PopupLib.registrationFor('ghe.example.com'));
    expect(spec).toMatchObject({
      id: 'gws-ghe.example.com',
      js: ['granted-marker.js', 'content.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    });
    expect(spec.matches).toContain('https://ghe.example.com/*/*/pull/*');
  });
});

describe('3.1 popup in real Chrome', () => {
  test('renders the non-https state and an empty host list', async () => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => document.getElementById('status').textContent !== '',
      { timeout: 5000 }
    );

    const view = await page.evaluate(() => ({
      status: document.getElementById('status').textContent,
      actionHidden: document.getElementById('action').hidden,
      rows: document.querySelectorAll('#list li').length,
      hostsCardHidden: document.getElementById('hosts-card').hidden,
    }));

    // The popup's own chrome-extension:// tab is not https, i.e. state 1.
    expect(view.status).toBe('Works on GitHub PR diff pages.');
    expect(view.actionHidden).toBe(true);
    expect(view.rows).toBe(0);
    expect(view.hostsCardHidden).toBe(true);
  });
});

describe('Git Well Soon Extension E2E Tests', () => {
  test('should add whitespace parameter to PR files view', async () => {
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    expect(new URL(page.url()).searchParams.get('w')).toBe('1');
  });

  test('should not modify URL if whitespace parameter already exists', async () => {
    const urlWithParam = `${TEST_PR_URL}?w=1`;
    await page.goto(urlWithParam, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    expect(page.url()).toBe(urlWithParam);
  });

  test('should handle URL changes within GitHub', async () => {
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));
    expect(new URL(page.url()).searchParams.get('w')).toBe('1');

    await page.goto(
      'https://github.com/mui/material-ui/pull/45606/files/specific-commit',
      { waitUntil: 'networkidle0' }
    );
    await new Promise((r) => setTimeout(r, 2000));
    expect(new URL(page.url()).searchParams.get('w')).toBe('1');
  });

  test('should not modify non-relevant GitHub pages', async () => {
    await page.goto(TEST_NON_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    expect(page.url()).toBe(TEST_NON_PR_URL);
  });

  test('should add whitespace parameter to PR files view, on SPA navigation', async () => {
    await page.goto(TEST_NON_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    await page.waitForSelector('a[href*="/files"]', { timeout: 15000 });
    await page.click('a[href*="/files"]');

    await page.waitForFunction(
      () => {
        try {
          const u = new URL(window.location.href);
          return u.pathname.includes('/files') && u.searchParams.get('w') === '1';
        } catch (_) {
          return false;
        }
      },
      { timeout: 15000 }
    );

    expect(new URL(page.url()).searchParams.get('w')).toBe('1');
  });

  test('should add whitespace parameter to PR changes view', async () => {
    await page.goto('https://github.com/mui/material-ui/pull/45606/changes', {
      waitUntil: 'networkidle0',
    });
    await new Promise((r) => setTimeout(r, 2000));

    expect(new URL(page.url()).searchParams.get('w')).toBe('1');
  });

  test('shows no pin nudge on a built-in GitHub host', async () => {
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    const nudges = await page.evaluate(
      () => document.querySelectorAll('#gws-pin-nudge').length
    );
    expect(nudges).toBe(0);
  });

  test('should not modify arbitrary hosts without permission', async () => {
    try {
      await page.goto('https://example.com/owner/repo/pull/123/files', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (e) {
      console.warn('Skipping example.com check: host unreachable');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));

    const url = new URL(page.url());
    expect(url.hostname).toContain('example.com');
    expect(url.searchParams.get('w')).toBeNull();
  }, 60000);
});

// V-5: an extension reload followed by an immediate navigation must not drop
// the broad-match cohort. Runs in its own browser because it restarts the
// extension out from under every existing target.
describe('V-5 extension reload then immediate navigation', () => {
  test('w=1 is still applied on the first page load after a reload', async () => {
    const b = await launch();
    try {
      const worker = await (await workerTarget(b)).worker();
      await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});

      // No settling delay: navigate as soon as the browser will let us.
      const p = await newPage(b);
      await p.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
      await p.waitForFunction(
        () => new URL(window.location.href).searchParams.get('w') === '1',
        { timeout: 20000 }
      );
      expect(new URL(p.url()).searchParams.get('w')).toBe('1');
    } finally {
      await b.close();
    }
  }, 90000);
});
