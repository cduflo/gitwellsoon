/**
 * @jest-environment jsdom
 */

describe('popup clear button behavior', () => {
  beforeEach(() => {
    jest.resetModules();
    require('./mock-extension-apis.js');
    document.body.innerHTML = `
      <div id="hosts-card"></div>
      <div id="hosts-nudge"></div>
      <span id="status-dot"></span>
      <span id="status-text"></span>
      <button id="storage-switch" aria-checked="true"></button>
      <button id="tabs-switch" aria-checked="false"></button>
      <div class="input-wrap">
        <input id="host" />
        <button id="clear-host"></button>
      </div>
      <button id="add"></button>
      <div id="msg"></div>
      <ul id="list"></ul>
    `;
  });

  test('clear button is always displayed and clears value', async () => {
    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const input = document.getElementById('host');
    const clearBtn = document.getElementById('clear-host');

    // Always visible
    expect(clearBtn.style.display).not.toBe('none');

    input.value = 'https://abc.example.com';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 10));
    expect(clearBtn.style.display).not.toBe('none');

    clearBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(input.value).toBe('');
    // Still visible after clearing
    expect(clearBtn.style.display).not.toBe('none');
  });

  test('clear button disabled when storage permission off and remains visible', async () => {
    require('../popup.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 10));

    const input = document.getElementById('host');
    const clearBtn = document.getElementById('clear-host');

    input.value = 'https://abc.example.com';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 10));

    // Turn off storage
    document.getElementById('storage-switch').click();
    await new Promise((r) => setTimeout(r, 10));
    expect(clearBtn.disabled).toBe(true);
    // It should remain visible even when disabled, as long as input has value
    expect(clearBtn.style.display).not.toBe('none');
  });
});
