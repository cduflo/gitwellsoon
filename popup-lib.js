(function(){
  function parseHostInput(input) {
    const s = (input || '').trim().toLowerCase();
    if (!s) return { error: 'Enter a full https URL, e.g., https://github.company.com' };
    if (!/^https:\/\//.test(s)) {
      return { error: 'Enter a full URL starting with https:// (e.g., https://github.company.com)' };
    }
    try {
      const url = new URL(s);
      if (url.protocol !== 'https:') {
        return { error: 'Only https hosts are supported.' };
      }
      const host = url.hostname;
      if (!host || !host.includes('.')) {
        return { error: 'Enter a full hostname, e.g., github.company.com' };
      }
      return { host };
    } catch {
      return { error: 'Invalid URL. Try something like https://github.company.com' };
    }
  }

  function pGet(chromeLike, defaults) {
    return new Promise((resolve) => {
      try {
        const ret = chromeLike.storage.sync.get(defaults, (res) => resolve(res));
        if (ret && typeof ret.then === 'function') {
          ret.then(resolve).catch(() => resolve(defaults));
        }
      } catch (_) {
        resolve(defaults);
      }
    });
  }

  function pSet(chromeLike, payload) {
    return new Promise((resolve) => {
      try {
        const ret = chromeLike.storage.sync.set(payload, () => resolve());
        if (ret && typeof ret.then === 'function') {
          ret.then(() => resolve()).catch(() => resolve());
        }
      } catch (_) {
        resolve();
      }
    });
  }

  async function getHosts(chromeLike) {
    const { extraHosts = [] } = await pGet(chromeLike, { extraHosts: [] });
    return Array.isArray(extraHosts) ? extraHosts : [];
  }

  async function setHosts(chromeLike, list) {
    await pSet(chromeLike, { extraHosts: list });
  }

  function containsPermission(chromeLike, host) {
    return new Promise((resolve) => {
      try {
        chromeLike.permissions.contains({ origins: [`https://${host}/*`] }, (granted) => resolve(!!granted));
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function syncHostsWithPermissions(chromeLike) {
    const current = await getHosts(chromeLike);
    const allowed = [];
    for (const h of current) {
      // eslint-disable-next-line no-await-in-loop
      if (await containsPermission(chromeLike, h)) allowed.push(h);
    }
    if (allowed.length !== current.length) {
      await setHosts(chromeLike, allowed);
    }
    return allowed;
  }

  function queryActiveTab(chromeLike) {
    return new Promise((resolve) => {
      try {
        chromeLike.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs && tabs[0];
          resolve(tab || null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function scheduleReloadIfActiveMatches(chromeLike, host, delayMs = 3000) {
    const tab = await queryActiveTab(chromeLike);
    if (!tab || !tab.url) return false;
    try {
      const url = new URL(tab.url);
      if (url.hostname === host) {
        setTimeout(() => chromeLike.tabs.reload(tab.id), delayMs);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  const api = {
    parseHostInput,
    getHosts,
    setHosts,
    containsPermission,
    syncHostsWithPermissions,
    queryActiveTab,
    scheduleReloadIfActiveMatches,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.PopupLib = api;
  }
})();