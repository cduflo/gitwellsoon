// Use PopupLib for core logic (available in browser via window, in tests via require)
const PopupLib = (typeof window !== 'undefined' && window.PopupLib) || require('./popup-lib.js');

function render(listEl, hosts, setMsg) {
  const headerEl = document.getElementById('hosts-header');
  if (headerEl) headerEl.style.display = hosts && hosts.length ? '' : 'none';
  listEl.innerHTML = '';
  (hosts || []).forEach((h, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `https://${h}`;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      try { await chrome.permissions.remove({ origins: [`https://${h}/*`] }); } catch (_) {}
      const next = hosts.filter((_, idx) => idx !== i);
      await PopupLib.setHosts(chrome, next);
      render(listEl, next, setMsg);
      const matched = await PopupLib.scheduleReloadIfActiveMatches(chrome, h, 3000);
      setMsg(matched ? 'Host removed. Reloading tab in 3 seconds to activate your changes.' : 'Host removed.', 'success');
    });
    li.appendChild(span);
    li.appendChild(btn);
    listEl.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('host');
  const addBtn = document.getElementById('add');
  const listEl = document.getElementById('list');
  const msgEl = document.getElementById('msg');

  function setMsg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'msg' + (kind ? (' ' + kind) : '');
    msgEl.style.display = text ? '' : 'none';
  }

  let hosts = await PopupLib.syncHostsWithPermissions(chrome);
  render(listEl, hosts, setMsg);

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
    // Optimistically add host
    hosts = [...hosts, host];
    await PopupLib.setHosts(chrome, hosts);
    render(listEl, hosts, setMsg);

    const granted = await chrome.permissions.request({ origins: [`https://${host}/*`] }).catch(() => false);
    if (!granted) {
      hosts = hosts.filter((h) => h !== host);
      await PopupLib.setHosts(chrome, hosts);
      render(listEl, hosts, setMsg);
      setMsg('Permission not granted for https://' + host + '/*', 'error');
      return;
    }

    const matched = await PopupLib.scheduleReloadIfActiveMatches(chrome, host, 3000);
    setMsg(matched ? 'Host added. Reloading tab in 3 seconds to activate your changes.' : 'Host added.', 'success');

    input.value = '';
  });

  input.addEventListener('input', () => setMsg(''));
});
