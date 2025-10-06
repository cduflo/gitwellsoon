/**
 * @jest-environment jsdom
 */

const PopupLib = require('./popup-lib.js');

describe('parseHostInput edge cases', () => {
  test('trims and accepts uppercase scheme/host', () => {
    const { host, error } = PopupLib.parseHostInput('  HTTPS://ABC.EXAMPLE.COM  ');
    expect(error).toBeUndefined();
    expect(host).toBe('abc.example.com');
  });

  test('accepts https URL with port and strips it from hostname', () => {
    const { host, error } = PopupLib.parseHostInput('https://abc.example.com:443/path');
    expect(error).toBeUndefined();
    expect(host).toBe('abc.example.com');
  });

  test('accepts punycode domains', () => {
    const { host, error } = PopupLib.parseHostInput('https://xn--bcher-kva.example');
    expect(error).toBeUndefined();
    expect(host).toBe('xn--bcher-kva.example');
  });
});