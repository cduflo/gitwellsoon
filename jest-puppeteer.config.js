const path = require('path');

/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
module.exports = {
  launch: {
    headless: false,
    product: 'chrome',
    args: [
      `--disable-extensions-except=${path.join(__dirname)}`,
      `--load-extension=${path.join(__dirname)}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-logging',
      '--v=1',
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  },
  browserContext: 'default',
  exitOnPageError: false,
};
