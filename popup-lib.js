(function () {
  // Paths that matter for whitespace hiding, mirrored from manifest.json's
  // broad match patterns. Used for dynamic registration on granted hosts.
  const DIFF_PATHS = ['pull', 'compare', 'commits', 'commit'];

  function isBuiltInHost(host) {
    const h = String(host || '').toLowerCase();
    return h === 'github.com' || h.endsWith('.github.com') || h.endsWith('.ghe.com');
  }

  // The legacy heuristic (content.js isGitHubSite) — a host that already works
  // without an explicit grant, and so is a candidate for the pin nudge.
  function isGitHubLikeHost(host) {
    const h = String(host || '').toLowerCase();
    return h === 'github.com' || h.includes('ghe.') || h.includes('github.') || /git\..*/.test(h);
  }

  function hostFromOrigin(origin) {
    if (typeof origin !== 'string' || !origin.startsWith('https://')) return '';
    // Only skip when the hostname itself is a wildcard (e.g., https://*/* or https://%2A/*)
    const mHost = origin.match(/^https:\/\/([^/]+)/i);
    const rawHost = mHost ? mHost[1] : '';
    if (!rawHost || rawHost === '*' || rawHost.toLowerCase() === '%2a') return '';
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch (e) {
      host = rawHost;
    }
    try {
      host = decodeURIComponent(host);
    } catch (_) {}
    if (!host || host.includes('%') || host.includes('*')) return '';
    return host;
  }

  function pGetAll(chromeLike) {
    return new Promise((resolve) => {
      try {
        chromeLike.permissions.getAll((perms) => resolve(perms || { origins: [], permissions: [] }));
      } catch (_) {
        resolve({ origins: [], permissions: [] });
      }
    });
  }

  // Granted custom hosts: https origins with a real hostname, minus built-ins.
  async function listGrantedHosts(chromeLike) {
    const { origins = [] } = await pGetAll(chromeLike);
    const hosts = origins.map(hostFromOrigin).filter((h) => h && !isBuiltInHost(h));
    return Array.from(new Set(hosts)).sort();
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

  // --- Dynamic content-script registration (shared by worker.js and popup.js) ---
  const scriptId = (host) => `gws-${host}`;
  const matchesForHost = (host) => DIFF_PATHS.map((p) => `https://${host}/*/*/${p}/*`);
  const registrationFor = (host) => ({
    id: scriptId(host),
    matches: matchesForHost(host),
    js: ['granted-marker.js', 'content.js'],
    runAt: 'document_start',
    persistAcrossSessions: true,
  });

  async function unregisterHosts(chromeLike, hosts) {
    try {
      await chromeLike.scripting.unregisterContentScripts(
        hosts ? { ids: hosts.map(scriptId) } : undefined
      );
    } catch (_) {}
  }

  async function registerHosts(chromeLike, hosts) {
    if (!hosts || !hosts.length) return [];
    await unregisterHosts(chromeLike, hosts); // keep re-runs idempotent
    try {
      await chromeLike.scripting.registerContentScripts(hosts.map(registrationFor));
    } catch (_) {}
    return hosts;
  }

  function queryActiveTab(chromeLike) {
    return new Promise((resolve) => {
      try {
        chromeLike.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve((tabs && tabs[0]) || null);
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
    isBuiltInHost,
    isGitHubLikeHost,
    hostFromOrigin,
    listGrantedHosts,
    containsPermission,
    scriptId,
    matchesForHost,
    registrationFor,
    registerHosts,
    unregisterHosts,
    queryActiveTab,
    scheduleReloadIfActiveMatches,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  // window in the popup, self in the service worker (importScripts).
  if (typeof globalThis !== 'undefined') globalThis.PopupLib = api;
})();
