/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'jest-puppeteer',
  roots: ['<rootDir>/test'],
  setupFiles: ['<rootDir>/test/mock-extension-apis.js'],
  testEnvironment: 'jest-environment-puppeteer',
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  globalSetup: 'jest-environment-puppeteer/setup',
  globalTeardown: 'jest-environment-puppeteer/teardown',
  globals: {
    'jest-puppeteer': require('./test/jest-puppeteer.config.js'),
  },
};
