const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  url: '',
  runInTray: true,
  autostart: true,
  unreadBadge: true,
  sound: true,
  ignoreCertErrors: false,
  pollInterval: 15,
};

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();
let mainWindow = null;
let settingsWindow = null;
let tray = null;
let lastUnread = 0;
let startHidden = process.argv.includes('--hidden');

const ICON_APP = path.join(__dirname, 'build', 'icon.png');
const ICON_TRAY = path.join(__dirname, 'build', 'tray.png');
const ICON_BADGE = path.join(__dirname, 'build', 'badge.png');

// Present as a normal Chrome browser. Google SSO refuses to sign in from
// user agents it recognises as embedded webviews (the default Electron UA
// contains "Electron"/app name and triggers a generic error page).
const CHROME_VERSION = process.versions.chrome;
app.userAgentFallback =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

function isValidUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

// Single instance: focus existing window instead of starting twice.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

const LINUX_AUTOSTART = path.join(
  app.getPath('home'),
  '.config',
  'autostart',
  'zammad-desktop.desktop'
);

function applyAutostart() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: !!config.autostart,
      args: ['--hidden'],
    });
  } else if (process.platform === 'linux') {
    applyAutostartLinux();
  }
}

function applyAutostartLinux() {
  try {
    if (config.autostart) {
      const exec = app.isPackaged
        ? `"${process.execPath}" --hidden`
        : `"${process.execPath}" "${app.getAppPath()}" --hidden`;
      const entry =
        '[Desktop Entry]\n' +
        'Type=Application\n' +
        'Name=Zammad Desktop\n' +
        `Exec=${exec}\n` +
        'Icon=zammad-desktop\n' +
        'Terminal=false\n' +
        'X-GNOME-Autostart-enabled=true\n';
      fs.mkdirSync(path.dirname(LINUX_AUTOSTART), { recursive: true });
      fs.writeFileSync(LINUX_AUTOSTART, entry);
    } else if (fs.existsSync(LINUX_AUTOSTART)) {
      fs.unlinkSync(LINUX_AUTOSTART);
    }
  } catch {
    /* ignore */
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: ICON_APP,
    autoHideMenuBar: true,
    title: 'Zammad Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(config.url);

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow.show();
    startHidden = false;
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    if (code === -3) return; // aborted (normal during redirects)
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<body style="font-family:Segoe UI,sans-serif;background:#1f7a8c;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
           <h2>Verbindung fehlgeschlagen</h2>
           <p>${desc} (${code})<br>${failedUrl}</p>
           <p>Pr&uuml;fe die URL in den Einstellungen (Tray-Icon &rarr; Einstellungen).</p>
           </body>`
        )
    );
  });

  // Web links (http/https) — including SSO popups like Google — must stay
  // inside the app so the OAuth session/cookies land in this window.
  // Only non-web schemes (mailto:, tel:, …) go to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Style OAuth popup windows (e.g. Google sign-in) sensibly.
  mainWindow.webContents.on('did-create-window', (win) => {
    win.setMenuBarVisibility(false);
    win.setIcon(ICON_APP);
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) return { action: 'allow' };
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!/^https?:\/\//i.test(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Close => minimize to tray (unless really quitting).
  mainWindow.on('close', (e) => {
    if (config.runInTray && !app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  if (!config.url || !isValidUrl(config.url)) {
    openSettings();
    return;
  }
  if (!mainWindow) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    icon: ICON_APP,
    title: 'Einstellungen',
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function buildTray() {
  const img = nativeImage.createFromPath(ICON_TRAY);
  tray = new Tray(img);
  tray.setToolTip('Zammad Desktop');
  refreshTrayMenu();
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });
}

function refreshTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Zammad öffnen', click: () => showMainWindow() },
    {
      label: lastUnread > 0 ? `${lastUnread} ungelesen` : 'Keine neuen Benachrichtigungen',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Test-Benachrichtigung senden',
      click: () => {
        if (!Notification.isSupported()) return;
        const n = new Notification({
          title: 'Zammad — Test',
          body: 'Wenn du das siehst, funktionieren Windows-Benachrichtigungen.',
          icon: ICON_APP,
          silent: !config.sound,
        });
        n.on('click', () => showMainWindow());
        n.show();
      },
    },
    {
      label: 'Neu laden',
      click: () => mainWindow && mainWindow.webContents.reload(),
    },
    { label: 'Einstellungen', click: () => openSettings() },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function updateUnread(count) {
  count = Number(count) || 0;
  const increased = count > lastUnread;
  const previous = lastUnread;
  lastUnread = count;

  if (process.platform === 'linux') {
    app.setBadgeCount(config.unreadBadge && count > 0 ? count : 0);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    if (config.unreadBadge && count > 0) {
      mainWindow.setOverlayIcon(
        nativeImage.createFromPath(ICON_BADGE),
        `${count} ungelesene Benachrichtigungen`
      );
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  if (tray) {
    tray.setToolTip(count > 0 ? `Zammad Desktop — ${count} ungelesen` : 'Zammad Desktop');
    refreshTrayMenu();
  }

  // Native notification when something new arrives and window isn't focused.
  const focused = mainWindow && mainWindow.isVisible() && mainWindow.isFocused();
  if (increased && previous >= 0 && !focused && Notification.isSupported()) {
    const delta = count - previous;
    const n = new Notification({
      title: 'Zammad',
      body:
        delta === 1
          ? 'Eine neue Benachrichtigung'
          : `${count} ungelesene Benachrichtigungen`,
      icon: ICON_APP,
      silent: !config.sound,
    });
    n.on('click', () => showMainWindow());
    n.show();
  }
}

// --- IPC ---
ipcMain.handle('settings:get', () => config);

ipcMain.handle('settings:save', (_e, incoming) => {
  const prevUrl = config.url;
  config = { ...config, ...incoming };
  saveConfig(config);
  applyAutostart();

  if (settingsWindow) settingsWindow.close();

  if (!isValidUrl(config.url)) return { ok: false, error: 'Ungültige URL' };

  if (!mainWindow) {
    createMainWindow();
    if (!startHidden) showMainWindow();
  } else if (prevUrl !== config.url) {
    mainWindow.loadURL(config.url);
    showMainWindow();
  } else {
    showMainWindow();
  }
  return { ok: true };
});

ipcMain.on('zammad:unread', (_e, count) => updateUnread(count));

ipcMain.handle('config:pollInterval', () => config.pollInterval);

// --- Certificate handling for self-hosted instances ---
app.on('certificate-error', (event, _wc, url, _err, _cert, callback) => {
  if (config.ignoreCertErrors) {
    try {
      const host = new URL(config.url).host;
      if (new URL(url).host === host) {
        event.preventDefault();
        callback(true);
        return;
      }
    } catch {
      /* ignore */
    }
  }
  callback(false);
});

app.whenReady().then(() => {
  applyAutostart();
  buildTray();

  if (isValidUrl(config.url)) {
    createMainWindow();
  } else {
    openSettings();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showMainWindow();
  });
});

// Keep running in tray; only quit via tray menu.
app.on('window-all-closed', (e) => {
  if (config.runInTray && !app.isQuiting) {
    // stay alive in tray
  } else {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
});
