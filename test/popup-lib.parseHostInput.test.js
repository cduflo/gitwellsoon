/**
 * @jest-environment jsdom
 */

const PopupLib = require('../popup-lib.js');

describe('parseHostInput', () => {
  test('accepts https URL and extracts hostname', () => {
    const { host, error } = PopupLib.parseHostInput('https://github.company.com');
    expect(error).toBeUndefined();
    expect(host).toBe('github.company.com');
  });

  test('accepts https URL with path/query', () => {
    const { host, error } = PopupLib.parseHostInput('https://abc-github.cloud.xyz/foo?bar=baz');
    expect(error).toBeUndefined();
    expect(host).toBe('abc-github.cloud.xyz');
  });

  test('rejects http URL', () => {
    const { error } = PopupLib.parseHostInput('http://github.company.com');
    expect(error).toMatch(/https:\/\//);
  });

  test('rejects bare hostname', () => {
    const { error } = PopupLib.parseHostInput('github.company.com');
    expect(error).toMatch(/full URL/);
  });

  test('rejects garbage', () => {
    const { error } = PopupLib.parseHostInput('not a url');
    expect(error).toMatch(/full URL starting with https:\/\//);
  });
});
