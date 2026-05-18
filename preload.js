const { contextBridge, ipcRenderer } = require('electron');

const isSettingsPage = location.protocol === 'file:';

if (isSettingsPage) {
  // Settings UI bridge (only on the local settings.html).
  contextBridge.exposeInMainWorld('zammadSettings', {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (cfg) => ipcRenderer.invoke('settings:save', cfg),
  });
} else {
  // Running inside the live Zammad web app: poll unread notifications.
  let timer = null;

  async function fetchUnread() {
    try {
      const res = await fetch(location.origin + '/api/v1/online_notifications', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return null; // 401 = not logged in yet, etc.
      const data = await res.json();
      let list = null;
      if (Array.isArray(data)) list = data;
      else if (data && Array.isArray(data.online_notifications)) list = data.online_notifications;
      if (!list) return null;
      return list.filter((n) => n && n.seen === false).length;
    } catch {
      return null;
    }
  }

  // DOM fallback (best effort across Zammad UI versions).
  function domUnread() {
    const sels = [
      '.js-toggleNotifications .counter',
      '.notifications .counter',
      '[data-test-id="notifications-counter"]',
      'button[aria-label*="otification"] .counter',
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) {
        const n = parseInt((el.textContent || '').replace(/\D/g, ''), 10);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  async function poll() {
    let count = await fetchUnread();
    if (count === null) count = domUnread();
    if (count !== null) ipcRenderer.send('zammad:unread', count);
  }

  async function start() {
    let seconds = 15;
    try {
      seconds = (await ipcRenderer.invoke('config:pollInterval')) || 15;
    } catch {
      /* default */
    }
    const ms = Math.max(5, Number(seconds)) * 1000;
    poll();
    timer = setInterval(poll, ms);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }
  window.addEventListener('beforeunload', () => timer && clearInterval(timer));
}
