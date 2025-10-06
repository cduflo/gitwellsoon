// Use PopupLib for core logic (available in browser via window, in tests via require)
const PopupLib =
  (typeof window !== 'undefined' && window.PopupLib) ||
  require('./popup-lib.js');

// Promise-wrapped helpers for chrome.permissions
function pPermissionsRequest(perms) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.request(perms, (granted) => resolve(!!granted));
    } catch (_) {
      resolve(false);
    }
  });
}
function pPermissionsRemove(perms) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.remove(perms, (removed) => resolve(!!removed));
    } catch (_) {
      resolve(false);
    }
  });
}

function pPermissionsContains(perms) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains(perms, (granted) => resolve(!!granted));
    } catch (_) {
      resolve(false);
    }
  });
}

// Storage helpers (top-level so render() can use them too)
async function loadHostsFromStorage() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions: ['storage'] }, (g) => {
        if (!g) return resolve([]);
        chrome.storage.sync.get({ extraHosts: [] }, (res) => {
          resolve(Array.isArray(res.extraHosts) ? res.extraHosts : []);
        });
      });
    } catch (_) {
      resolve([]);
    }
  });
}

async function saveHostsToStorage(next) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions: ['storage'] }, (g) => {
        if (!g) return resolve();
        chrome.storage.sync.set({ extraHosts: next }, () => resolve());
      });
    } catch (_) {
      resolve();
    }
});
}

// Pending-add helpers to survive popup closing during permission prompts
async function getPendingAdd() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions: ['storage'] }, (g) => {
        if (!g) return resolve(null);
        chrome.storage.sync.get({ pendingHost: null }, (res) => {
          resolve(res && res.pendingHost ? String(res.pendingHost) : null);
        });
      });
    } catch (_) {
      resolve(null);
    }
  });
}
async function setPendingAdd(host) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions: ['storage'] }, (g) => {
        if (!g) return resolve();
        chrome.storage.sync.set({ pendingHost: host }, () => resolve());
      });
    } catch (_) {
      resolve();
    }
  });
}
async function clearPendingAdd() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ permissions: ['storage'] }, (g) => {
        if (!g) return resolve();
        chrome.storage.sync.set({ pendingHost: null }, () => resolve());
      });
    } catch (_) {
      resolve();
    }
  });
}

function render(listEl, hosts, setMsg) {
  const headerEl = document.getElementById('hosts-header');
  if (headerEl) headerEl.style.display = hosts && hosts.length ? '' : 'none';
  listEl.innerHTML = '';
  (hosts || []).forEach((h, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'host';
    span.textContent = `https://${h}`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      await pPermissionsRemove({ origins: [`https://${h}/*`] });

      // Update storage allowlist if enabled
      hosts = await loadHostsFromStorage();
      const next = (hosts || []).filter((x) => x !== h);
      await saveHostsToStorage(next);
      hosts = next;
      render(listEl, hosts, setMsg);

      chrome.permissions.contains({ permissions: ['tabs'] }, (ok) => {
        if (ok) {
          PopupLib.scheduleReloadIfActiveMatches(chrome, h, 1000);
        } else {
          setMsg(
            'Host removed. Please reload this tab to stop injection on that site.',
            'success'
          );
          setTimeout(() => setMsg(''), 4000);
        }
      });
    });
    actions.appendChild(btn);
    li.appendChild(span);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('host');
  const clearBtn = document.getElementById('clear-host');
  const addBtn = document.getElementById('add');
  const listEl = document.getElementById('list');
  const msgEl = document.getElementById('msg');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const storageSwitch = document.getElementById('storage-switch');
  const tabsSwitch = document.getElementById('tabs-switch');
  const hostsCard = document.getElementById('hosts-card');
  const hostsNudge = document.getElementById('hosts-nudge');

  function setMsg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'msg' + (kind ? ' ' + kind : '');
    msgEl.style.display = text ? '' : 'none';
  }

  async function refreshPermUI() {
    chrome.permissions.contains({ permissions: ['storage'] }, async (g) => {
      if (statusDot) statusDot.style.background = g ? '#2da44e' : '#d1242f';
      if (statusText) statusText.textContent = g ? 'Active' : 'Inactive';
      storageSwitch?.setAttribute('aria-checked', g ? 'true' : 'false');
      // Disable host input/list when storage is off; visually subdue card
      input.disabled = !g;
      clearBtn && (clearBtn.disabled = !g);
      addBtn.disabled = !g;
      if (hostsCard) hostsCard.classList.toggle('subdued', !g);
      if (hostsNudge) hostsNudge.style.display = g ? 'none' : '';

      // Keep the list display in sync with storage permission
      if (!g) {
        render(listEl, [], setMsg);
      } else {
        const latest = await loadHostsFromStorage();
        render(listEl, latest, setMsg);
      }
    });
    chrome.permissions.contains({ permissions: ['tabs'] }, (g) => {
      tabsSwitch?.setAttribute('aria-checked', g ? 'true' : 'false');
    });
  }

  let hosts = await loadHostsFromStorage();
  render(listEl, hosts, setMsg);
  await refreshPermUI();

  // If the popup closed during a permission prompt, finalize the pending host
  async function finalizePendingIfAny() {
    const pending = await getPendingAdd();
    if (!pending) return;
    const granted = await pPermissionsContains({ origins: [`https://${pending}/*`] });
    if (granted) {
      hosts = await loadHostsFromStorage();
      const next = Array.from(new Set([...(hosts || []), pending]));
      await saveHostsToStorage(next);
      hosts = next;
      render(listEl, hosts, setMsg);
      chrome.permissions.contains({ permissions: ['tabs'] }, (ok) => {
        if (ok) PopupLib.scheduleReloadIfActiveMatches(chrome, pending, 1000);
      });
    }
    await clearPendingAdd();
  }
  await finalizePendingIfAny();

  // Prefill input from active tab if tabs permission granted
  function prefillInputFromActiveTab() {
    try {
      chrome.permissions.contains({ permissions: ['tabs'] }, async (ok) => {
        if (!ok) return;
        const tab = await PopupLib.queryActiveTab(chrome);
        if (!tab || !tab.url) return;
        try {
          const u = new URL(tab.url);
          if (u.hostname) {
            input.value = `https://${u.hostname}`;
          }
        } catch (_) {}
      });
    } catch (_) {}
  }
  prefillInputFromActiveTab();

  function toggleSwitch(el, current, onEnable, onDisable) {
    el?.addEventListener('click', async () => {
      const next = el.getAttribute('aria-checked') !== 'true';
      if (next) await onEnable();
      else await onDisable();
      await refreshPermUI();
    });
    el?.addEventListener('keydown', async (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        el.click();
      }
    });
  }

  toggleSwitch(
    storageSwitch,
    false,
    () => pPermissionsRequest({ permissions: ['storage'] }),
    () => pPermissionsRemove({ permissions: ['storage'] })
  );
  toggleSwitch(
    tabsSwitch,
    false,
    () => pPermissionsRequest({ permissions: ['tabs'] }).then(async (granted) => {
      if (!granted) return false;
      if (input && !input.value) prefillInputFromActiveTab();
      // Reload active tab to apply features immediately
      try {
        const tab = await PopupLib.queryActiveTab(chrome);
        if (tab && tab.id != null) setTimeout(() => chrome.tabs.reload(tab.id), 300);
      } catch (_) {}
      return true;
    }),
    () => pPermissionsRemove({ permissions: ['tabs'] })
  );

  addBtn.addEventListener('click', async () => {
    setMsg('');
    const { host, error } = PopupLib.parseHostInput(input.value);
    if (error) {
      setMsg(error, 'error');
      return;
    }
    if (hosts.includes(host)) {
      setMsg('Host already added.', 'error');
      return;
    }

    // Stash pending so we can finish the add if the popup closes during the prompt
    await setPendingAdd(host);

    const granted = await pPermissionsRequest({ origins: [`https://${host}/*`] });
    if (!granted) {
      await clearPendingAdd();
      setMsg('Permission not granted for https://' + host + '/*', 'error');
      return;
    }

    // Persist only if storage permission is enabled
    hosts = await loadHostsFromStorage();
    const next = Array.from(new Set([...(hosts || []), host]));
    await saveHostsToStorage(next);
    hosts = next;
    render(listEl, hosts, setMsg);

    await clearPendingAdd();

    // Try auto-reload if tabs permission is enabled
    chrome.permissions.contains({ permissions: ['tabs'] }, (ok) => {
      if (ok) {
        PopupLib.scheduleReloadIfActiveMatches(chrome, host, 1000);
      } else {
        setMsg(
          'Host added. Please reload this tab to activate your changes.',
          'success'
        );
        setTimeout(() => setMsg(''), 4000);
      }
    });

    input.value = '';
  });

  input.addEventListener('input', () => {
    setMsg('');
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    input.focus();
  });
});
