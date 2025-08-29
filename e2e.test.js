const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');

const EXTENSION_PATH = path.join(__dirname); // Get absolute path to extension directory
const TEST_PR_URL = 'https://github.com/mui/material-ui/pull/45606/files';
const TEST_NON_PR_URL = 'https://github.com/mui/material-ui/pull/45606';

const LOCAL_PORT = 8123;

// Local test server providing GitHub-like routes; we add ?debug=true so content.js logs only in tests
const GIT_POSITIVE_URLS = [
  `http://localhost:${LOCAL_PORT}/pull/1/files?debug=true`,
  `http://localhost:${LOCAL_PORT}/commit/1234567?debug=true`,
  `http://localhost:${LOCAL_PORT}/commits/main?debug=true`,
  `http://localhost:${LOCAL_PORT}/compare/abc...def?debug=true`,
];
const GIT_NEGATIVE_URLS = [
  `http://localhost:${LOCAL_PORT}/issues/1?debug=true`, // path not considered a diff page
  `http://localhost:${LOCAL_PORT}/pulls`, // path not covered by our patterns
];

// Start a local HTTP server that serves our test pages and content script
let _server;
beforeAll(async () => {
  const fs = require('fs').promises;
  let contentScript;
  
  try {
    // Read the content script
    contentScript = await fs.readFile(path.join(__dirname, 'content.js'), 'utf8');
  } catch (err) {
    console.error('Failed to read content script:', err);
    throw err;
  }
  
  _server = http.createServer(async (req, res) => {
    try {
      // Serve the content script
      if (req.url.endsWith('/content.js')) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        return res.end(contentScript);
      }
      
      // Serve HTML for test pages
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page: ${req.url}</title>
            <script src="/content.js"></script>
          </head>
          <body>
            <h1>Test Page: ${req.url}</h1>
            <div id="app">
              <a href="${req.url}" class="js-update-url-with-hash">Test Link</a>
            </div>
            <script>
              // Make console._messages available for tests
              console._messages = [];
              const originalLog = console.log;
              console.log = function() {
                const args = Array.from(arguments);
                console._messages.push(args.join(' '));
                originalLog.apply(console, arguments);
              };
            </script>
          </body>
        </html>
      `;
      res.end(html);
    } catch (err) {
      console.error('Error in test server:', err);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
  
  // Return a promise that resolves when the server is listening
  return new Promise(resolve => _server.listen(LOCAL_PORT, resolve));
});

afterAll((done) => {
  if (_server) _server.close(done);
  else done();
});

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
      `--host-resolver-rules=MAP git.example.com 127.0.0.1, MAP foo.git.com 127.0.0.1, EXCLUDE localhost`,
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
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0' });
    const currentUrl = page.url();

    // Verify we're on a GitHub PR files view
    expect(currentUrl).toContain('github.com');
    expect(currentUrl).toContain('/pull/');
    expect(currentUrl).toContain('/files');

    // Verify whitespace parameter was added
    const url = new URL(currentUrl);
    // Note: The extension might not modify the URL immediately due to GitHub's SPA navigation
    // So we'll check if the parameter is either already present or will be added on navigation
    const hasWhitespaceParam = url.searchParams.get('w') === '1';
    if (!hasWhitespaceParam) {
      // If not present, wait for potential SPA navigation
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      const newUrl = new URL(page.url());
      expect(newUrl.searchParams.get('w')).toBe('1');
    } else {
      expect(hasWhitespaceParam).toBe(true);
    }
  });

  test('should not modify URL if whitespace parameter already exists', async () => {
    const urlWithParam = `${TEST_PR_URL}?w=1`;
    await page.goto(urlWithParam, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();
    expect(currentUrl).toBe(urlWithParam);
  });

  test('should handle URL changes within GitHub', async () => {
    // Increase test timeout for this test
    jest.setTimeout(60000);
    
    // Navigate to a PR files view
    await page.goto(TEST_PR_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for the extension to potentially modify the URL
    await page.waitForFunction(
      'window.location.search.includes("w=1")',
      { timeout: 10000 }
    );
    
    // Verify URL has w=1
    let url = new URL(page.url());
    expect(url.searchParams.get('w')).toBe('1');

    // Navigate to a different GitHub URL that should also have w=1
    const newUrl = 'https://github.com/mui/material-ui/pull/45606/files/specific-commit';
    await page.goto(newUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for the extension to potentially modify the URL again
    await page.waitForFunction(
      'window.location.search.includes("w=1")',
      { timeout: 10000 }
    );
    
    // Verify the new URL also has w=1
    url = new URL(page.url());
    expect(url.searchParams.get('w')).toBe('1');
  }, 60000);

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

describe('git.* host gating (uses ?debug=true)', () => {
  test('injects on git.* hosts for relevant paths', async () => {
    // Increase test timeout for this test
    jest.setTimeout(60000);
    
    // Positive cases: expect w=1 to be added by content script
    for (const url of GIT_POSITIVE_URLS) {
      const page = await browser.newPage();
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
      
      // Navigate to the test URL
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // First, check if the content script is loaded
      const isContentScriptLoaded = await page.evaluate(() => {
        return typeof window.__gitWellSoonTestNavigation !== 'undefined';
      });
      
      if (!isContentScriptLoaded) {
        console.log('Content script not loaded, checking console logs...');
        const logs = await page.evaluate(() => {
          return Array.from(console._messages || []).map(m => m.text());
        });
        console.log('Console logs:', logs);
        throw new Error('Content script not loaded');
      }
      
      // Wait for the extension to set the test navigation URL
      const testNavigationUrl = await page.waitForFunction(
        'window.__gitWellSoonTestNavigation',
        { timeout: 10000, polling: 100 }
      );
      
      // Get the URL that the extension would have navigated to
      const newUrl = new URL(await testNavigationUrl.jsonValue());
      expect(newUrl.searchParams.get('w')).toBe('1');
      await page.close();
    }
  });

  test('does NOT inject on non-matching hosts/paths', async () => {
    // Negative cases: expect no w=1 param added
    for (const url of GIT_NEGATIVE_URLS) {
      const page = await browser.newPage();
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
      await page.goto(url, { waitUntil: 'networkidle0' });
      // Wait for extension to potentially modify the URL
      await new Promise((r) => setTimeout(r, 1000));
      const current = new URL(await page.url());
      expect(current.searchParams.get('w')).not.toBe('1');
      await page.close();
    }
  });
});
