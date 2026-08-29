(function () {
  // Paths that matter for whitespace hiding, mirrored from manifest.json's
  // broad match patterns. Used for dynamic registration on granted hosts.
  const DIFF_PATHS = ['pull', 'compare', 'commits', 'commit'];
  const ID_PREFIX = 'gws-';

  function warn(message, error) {
    try {
      console.warn('[Git Well Soon] ' + message, (error && error.message) || error || '');
    } catch (_) {}
  }

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

  /** The raw host of an origin pattern, wildcards included ('*', '*.corp.example'). */
  function rawHostOfOrigin(origin) {
    if (typeof origin !== 'string') return '';
    const m = origin.match(/^https:\/\/([^/]+)/i);
    if (!m) return '';
    let host = m[1];
    try {
      host = decodeURIComponent(host);
    } catch (_) {}
    return host.toLowerCase();
  }

  // A displayable/registerable host for an origin pattern, or '' if there is
  // none. A leftmost-label wildcard host (as in https://*.corp.example/*) IS a
  // usable host: registerable as a match pattern and revocable exactly as
  // written. The all-sites umbrella host ('*') is not a host at all.
  function hostFromOrigin(origin) {
    if (typeof origin !== 'string' || !origin.startsWith('https://')) return '';
    const host = rawHostOfOrigin(origin);
    if (!host || host === '*') return '';
    if (host.startsWith('*.')) {
      const base = host.slice(2);
      if (!base || !base.includes('.') || base.includes('*') || base.includes('%')) return '';
      return host;
    }
    if (host.includes('*') || host.includes('%')) return '';
    return host;
  }

  const originForHost = (host) => `https://${host}/*`;

  /**
   * Does a granted origin's host cover this concrete host? Mirrors the 2.x
   * allowlist semantics (exact or parent-domain suffix) and Chrome's own
   * wildcard matching, so granting corp.example keeps code.corp.example working.
   */
  function hostCoveredByGrant(grantHost, host) {
    const g = String(grantHost || '').toLowerCase();
    const h = String(host || '').toLowerCase();
    if (!g || !h) return false;
    // A bare '*' host is NOT evidence of a grant. chrome.permissions.getAll()
    // reports this extension's own broad content_scripts patterns
    // (https://*/*/*/pull/* and friends) as granted origins, so treating '*'
    // as "covers everything" would mark every site on the web as granted and
    // re-enable the extension on arbitrary hosts. Fail closed.
    if (g === '*') return false;
    const base = g.startsWith('*.') ? g.slice(2) : g;
    if (!base || base.includes('*')) return false;
    return h === base || h.endsWith('.' + base);
  }

  // Exact grants outrank wildcards, and longer bases outrank shorter ones.
  function grantSpecificity(grantHost) {
    if (grantHost === '*') return -1;
    const wild = grantHost.startsWith('*.');
    const base = wild ? grantHost.slice(2) : grantHost;
    return base.length * 2 + (wild ? 0 : 1);
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

  // Granted custom hosts: https origins with a usable hostname, minus built-ins.
  async function listGrantedHosts(chromeLike) {
    const { origins = [] } = await pGetAll(chromeLike);
    const hosts = origins.map(hostFromOrigin).filter((h) => h && !isBuiltInHost(h));
    return Array.from(new Set(hosts)).sort();
  }

  /** Is this concrete host covered by any grant we hold? */
  async function isHostGranted(chromeLike, host) {
    const h = String(host || '').toLowerCase();
    if (!h) return false;
    const { origins = [] } = await pGetAll(chromeLike);
    return origins.some(
      (o) => typeof o === 'string' && o.startsWith('https://') && hostCoveredByGrant(rawHostOfOrigin(o), h)
    );
  }

  /**
   * The origin pattern we actually hold that covers this host — which is what
   * has to be handed to permissions.remove. Revoking a narrower pattern than
   * the one granted silently does nothing.
   */
  async function originCoveringHost(chromeLike, host) {
    const h = String(host || '').toLowerCase();
    const { origins = [] } = await pGetAll(chromeLike);
    const covering = origins.filter(
      (o) => typeof o === 'string' && o.startsWith('https://') && hostCoveredByGrant(rawHostOfOrigin(o), h)
    );
    if (!covering.length) return null;
    covering.sort((a, b) => grantSpecificity(rawHostOfOrigin(b)) - grantSpecificity(rawHostOfOrigin(a)));
    return covering[0];
  }

  function containsPermission(chromeLike, host) {
    return new Promise((resolve) => {
      try {
        chromeLike.permissions.contains({ origins: [originForHost(host)] }, (granted) =>
          resolve(!!granted)
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  // --- Dynamic content-script registration (shared by worker.js and popup.js) ---
  const scriptId = (host) => ID_PREFIX + host;
  const matchesForHost = (host) => DIFF_PATHS.map((p) => `https://${host}/*/*/${p}/*`);
  const registrationFor = (host) => ({
    id: scriptId(host),
    matches: matchesForHost(host),
    js: ['granted-marker.js', 'content.js'],
    runAt: 'document_start',
    persistAcrossSessions: true,
  });

  async function getRegistered(chromeLike) {
    try {
      const list = await chromeLike.scripting.getRegisteredContentScripts();
      return Array.isArray(list) ? list : [];
    } catch (e) {
      warn('could not read registered content scripts', e);
      return [];
    }
  }

  /**
   * Register per host, never as one atomic batch: Chrome rejects the whole call
   * if any single registration is invalid, which would dark-ship every other
   * host while the popup still reported them active.
   */
  async function registerHosts(chromeLike, hosts) {
    if (!hosts || !hosts.length) return [];
    const have = new Set((await getRegistered(chromeLike)).map((s) => s.id));
    const registered = [];
    for (const host of hosts) {
      if (have.has(scriptId(host))) {
        registered.push(host);
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await chromeLike.scripting.registerContentScripts([registrationFor(host)]);
        registered.push(host);
      } catch (e) {
        warn(`could not register content script for ${host}`, e);
      }
    }
    return registered;
  }

  async function unregisterHosts(chromeLike, hosts) {
    const wanted = new Set((hosts || []).filter(Boolean).map(scriptId));
    if (!wanted.size) return;
    const ids = (await getRegistered(chromeLike)).map((s) => s.id).filter((id) => wanted.has(id));
    if (!ids.length) return;
    try {
      await chromeLike.scripting.unregisterContentScripts({ ids });
    } catch (e) {
      warn('could not unregister content scripts', e);
    }
  }

  /**
   * Reconcile registrations against the grants we hold, as a DIFF. The previous
   * wipe-then-re-add left a window in which a session-restored tab could reach
   * document_start with nothing registered, defeating persistAcrossSessions.
   */
  async function syncRegistrations(chromeLike) {
    try {
      const hosts = await listGrantedHosts(chromeLike);
      const wanted = new Set(hosts.map(scriptId));
      const existing = await getRegistered(chromeLike);

      const stale = existing
        .map((s) => s.id)
        .filter((id) => typeof id === 'string' && id.startsWith(ID_PREFIX) && !wanted.has(id));
      if (stale.length) {
        try {
          await chromeLike.scripting.unregisterContentScripts({ ids: stale });
        } catch (e) {
          warn('could not unregister stale content scripts', e);
        }
      }

      const have = new Set(existing.map((s) => s.id));
      await registerHosts(
        chromeLike,
        hosts.filter((h) => !have.has(scriptId(h)))
      );
      return hosts;
    } catch (e) {
      warn('registration sync failed', e);
      return [];
    }
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

  /**
   * Reload the active tab if this host applies to it. Immediate, deliberately:
   * the popup's JS context is destroyed the moment the popup closes — which the
   * permission prompt itself does — so anything left on a timer never runs.
   */
  async function reloadActiveTabIfMatches(chromeLike, host) {
    const tab = await queryActiveTab(chromeLike);
    if (!tab || !tab.url || tab.id == null) return false;
    try {
      const tabHost = new URL(tab.url).hostname.toLowerCase();
      if (!hostCoveredByGrant(String(host || '').toLowerCase(), tabHost)) return false;
      chromeLike.tabs.reload(tab.id);
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Worker-side fix-up: reload every tab a newly granted origin covers. */
  async function reloadTabsForOrigin(chromeLike, origin) {
    try {
      const tabs = await new Promise((resolve) => {
        try {
          chromeLike.tabs.query({ url: origin }, (t) => resolve(t || []));
        } catch (_) {
          resolve([]);
        }
      });
      tabs.forEach((t) => {
        if (!t || t.id == null) return;
        try {
          chromeLike.tabs.reload(t.id);
        } catch (e) {
          warn('could not reload tab ' + t.id, e);
        }
      });
      return tabs.length;
    } catch (e) {
      warn('could not reload tabs for ' + origin, e);
      return 0;
    }
  }

  const api = {
    isBuiltInHost,
    isGitHubLikeHost,
    hostFromOrigin,
    originForHost,
    hostCoveredByGrant,
    listGrantedHosts,
    isHostGranted,
    originCoveringHost,
    containsPermission,
    scriptId,
    matchesForHost,
    registrationFor,
    registerHosts,
    unregisterHosts,
    syncRegistrations,
    queryActiveTab,
    reloadActiveTabIfMatches,
    reloadTabsForOrigin,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  // window in the popup, self in the service worker (importScripts).
  if (typeof globalThis !== 'undefined') globalThis.PopupLib = api;
})();
