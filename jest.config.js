/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'jest-puppeteer',
  setupFiles: ['<rootDir>/mock-extension-apis.js'],
  testEnvironment: 'jest-environment-puppeteer',
  testMatch: ['**/?(*.)+(spec|test).(js|ts)'],
  testTimeout: 30000,
  globalSetup: 'jest-environment-puppeteer/setup',
  globalTeardown: 'jest-environment-puppeteer/teardown',
};
