// Git Well Soon 3.1 popup: a five-state view over the active tab and
// chrome.permissions. No storage, no tabs permission, no free-text input — a
// host can only be enabled while you are visiting it, which is the natural
// moment and removes the whole parse/validate/duplicate error surface.
const PopupLib =
  (typeof window !== 'undefined' && window.PopupLib) || require('./popup-lib.js');

const $ = (id) => document.getElementById(id);

const pPermissions = (method, req) =>
  new Promise((resolve) => {
    try {
      chrome.permissions[method](req, (ok) => resolve(!!ok));
    } catch (_) {
      resolve(false);
    }
  });

async function enableHost(host) {
  const granted = await pPermissions('request', { origins: [`https://${host}/*`] });
  if (granted) {
    await PopupLib.registerHosts(chrome, [host]);
    await PopupLib.scheduleReloadIfActiveMatches(chrome, host, 1000);
  }
  await refresh();
}

async function disableHost(host) {
  await pPermissions('remove', { origins: [`https://${host}/*`] });
  await PopupLib.unregisterHosts(chrome, [host]);
  await PopupLib.scheduleReloadIfActiveMatches(chrome, host, 1000);
  await refresh();
}

async function renderGrantedHosts() {
  const listEl = $('list');
  const hosts = await PopupLib.listGrantedHosts(chrome);
  $('hosts-header').hidden = hosts.length === 0;
  listEl.innerHTML = '';
  hosts.forEach((host) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'host';
    name.textContent = `https://${host}`;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => disableHost(host));
    li.appendChild(name);
    li.appendChild(remove);
    listEl.appendChild(li);
  });
}

async function refresh() {
  const statusEl = $('status');
  const btn = $('action');
  const next = btn.cloneNode(false); // drop the previous state's click handler
  btn.replaceWith(next);
  next.hidden = true;

  const tab = await PopupLib.queryActiveTab(chrome);
  let url = null;
  try {
    url = tab && tab.url ? new URL(tab.url) : null;
  } catch (_) {}

  if (!url || url.protocol !== 'https:') {
    statusEl.textContent = 'Works on GitHub PR diff pages.'; // state 1
  } else {
    const host = url.hostname;
    if (PopupLib.isBuiltInHost(host)) {
      statusEl.textContent = `✓ Active on ${host}`; // state 2
    } else if (await PopupLib.containsPermission(chrome, host)) {
      statusEl.textContent = `✓ Active on ${host}`; // state 3
      next.textContent = 'Disable';
      next.hidden = false;
      next.addEventListener('click', () => disableHost(host));
    } else {
      // State 4. Heuristic-matched hosts already work in legacy mode, so they
      // are phrased as a pin — the landing spot for the in-page nudge.
      const pinnable = PopupLib.isGitHubLikeHost(host);
      statusEl.textContent = pinnable
        ? `Working here via pattern-matching on ${host}.`
        : `Not enabled on ${host}.`;
      next.textContent = pinnable ? `Pin permission for ${host}` : `Enable on ${host}`;
      next.hidden = false;
      next.addEventListener('click', () => enableHost(host));
    }
  }

  await renderGrantedHosts(); // state 5
}

document.addEventListener('DOMContentLoaded', refresh);
