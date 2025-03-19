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

    await page.click('a[href*="/files"]');

    await new Promise((r) => setTimeout(r, 2000));

    // Get the current URL
    const currentUrl = page.url();

    // Verify whitespace parameter was added
    const url = new URL(currentUrl);
    expect(url.searchParams.get('w')).toBe('1');
  });
});
