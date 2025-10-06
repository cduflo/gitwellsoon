const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname); // Get absolute path to extension directory
const TEST_PR_URL = 'https://github.com/mui/material-ui/pull/45606/files';
const TEST_NON_PR_URL = 'https://github.com/mui/material-ui/pull/45606';

let browser;
let page;

beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-logging',
      '--v=1',
    ],
    // Don't disable extensions and allow them to load properly
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  });

  // Wait for extension to be loaded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create a new page
  page = await browser.newPage();

  // Add console logging for debugging
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));
  page.on('error', (error) => console.log('ERROR:', error.message));

  // Enable verbose logging for extension background page
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (target) =>
      target.type() === 'service_worker' &&
      target._targetInfo.title === 'Git Well Soon'
  );
  if (extensionTarget) {
    const extensionPage = await extensionTarget.worker();
    extensionPage.on('console', (msg) =>
      console.log('EXTENSION LOG:', msg.text())
    );
  }
});

afterEach(async () => {
  if (browser) {
    await browser.close();
  }
  browser = undefined;
  page = undefined;
});

describe('Git Well Soon Extension E2E Tests', () => {
  beforeEach(async () => {
    // Add console logging for debugging
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));
    page.on('error', (error) => console.log('ERROR:', error.message));

    // Enable verbose logging for extension background page
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      (target) =>
        target.type() === 'service_worker' &&
        target._targetInfo.title === 'Git Well Soon'
    );
    if (extensionTarget) {
      const extensionPage = await extensionTarget.worker();
      extensionPage.on('console', (msg) =>
        console.log('EXTENSION LOG:', msg.text())
      );
    }

    // Wait for extension to be loaded
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  test('should add whitespace parameter to PR files view', async () => {
    // Navigate to the test PR
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });

    // Wait for extension to process
    await new Promise((r) => setTimeout(r, 2000));

    // Get the current URL
    const currentUrl = page.url();

    // Verify whitespace parameter was added
    const url = new URL(currentUrl);
    expect(url.searchParams.get('w')).toBe('1');
  });

  test('should not modify URL if whitespace parameter already exists', async () => {
    const urlWithParam = `${TEST_PR_URL}?w=1`;
    await page.goto(urlWithParam, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();
    expect(currentUrl).toBe(urlWithParam);
  });

  test('should handle URL changes within GitHub', async () => {
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    let url = new URL(page.url());
    expect(url.searchParams.get('w')).toBe('1');

    await page.goto(
      'https://github.com/mui/material-ui/pull/45606/files/specific-commit',
      { waitUntil: 'networkidle0' }
    );
    await new Promise((r) => setTimeout(r, 2000));

    url = new URL(page.url());
    expect(url.searchParams.get('w')).toBe('1');
  });

  test('should not modify non-relevant GitHub pages', async () => {
    await page.goto(TEST_NON_PR_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();
    expect(currentUrl).toBe(TEST_NON_PR_URL);
  });

  test('should add whitespace parameter to PR files view, on SPA navigation', async () => {
    await page.goto(TEST_NON_PR_URL, { waitUntil: 'networkidle0' });

    await new Promise((r) => setTimeout(r, 2000));

    await page.waitForSelector('a[href*="/files"]', { timeout: 15000 });
    await page.click('a[href*="/files"]');

    // wait until URL includes /files and the extension injects w=1
    await page.waitForFunction(() => {
      try {
        const u = new URL(window.location.href);
        return u.pathname.includes('/files') && u.searchParams.get('w') === '1';
      } catch (_) { return false; }
    }, { timeout: 15000 });

    // Get the current URL
    const currentUrl = page.url();

    // Verify whitespace parameter was added
    const url = new URL(currentUrl);
    expect(url.searchParams.get('w')).toBe('1');
  });

  test('should not modify arbitrary hosts without permission', async () => {
    // Preflight: skip test if network not available
    let online = true;
    try {
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) {
      online = false;
    }
    if (!online) {
      console.warn('Skipping non-permission host test due to offline/unreachable example.com');
      return;
    }

    // Navigate to a GitHub-like path on example.com, which is not granted
    await page.goto('https://example.com/owner/repo/pull/123/files', { waitUntil: 'domcontentloaded', timeout: 45000 });

    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();
    const url = new URL(currentUrl);
    expect(url.hostname).toContain('example.com');
    expect(url.searchParams.get('w')).toBeNull();
  }, 60000);
});
