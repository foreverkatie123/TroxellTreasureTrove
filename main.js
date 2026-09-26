const { app, BrowserWindow, ipcMain, screen, globalShortcut, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let overlayWindow;
let controllerWindow;
let lastState = null;
let overlayInteractive = false;

// Panel pop-out: panelId -> BrowserWindow, for DM Remote panels torn out into
// their own window via controller.html's "⤢" button (e.g. "turn-initiative").
let panelWindows = {};

// Firebase's Google sign-in popup refuses to run on pages loaded over file://
// (it only supports http/https/chrome-extension). Serving the app's own files
// over a local-only HTTP server sidesteps that with no other changes needed —
// Firebase auto-trusts "localhost" for auth without any console configuration.
let localServerPort = null;
// Fixed rather than OS-assigned: Firebase Auth's signed-in session is scoped to the
// exact origin (http://localhost:PORT). A random port every launch means a brand-new,
// empty-storage origin each time — nothing to persist a sign-in into. Keeping this
// stable is what makes "stay signed in across restarts" actually work.
const PREFERRED_LOCAL_PORT = 47871;
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};
function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/overlay.html';
      const filePath = path.normalize(path.join(__dirname, reqPath));
      if (!filePath.startsWith(__dirname)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        res.end(data);
      });
    });
    let fallbackTried = false;
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && !fallbackTried) {
        // Preferred port taken (e.g. a previous instance didn't shut down cleanly).
        // Fall back to a random port so the app still starts — sign-in just won't
        // persist across restarts this session, same as before this fix.
        fallbackTried = true;
        console.warn(`Port ${PREFERRED_LOCAL_PORT} is in use — falling back to a random port. Sign-in won't persist across restarts until that port is free again.`);
        server.listen(0, 'localhost');
      } else {
        reject(err);
      }
    });
    // bind to loopback only — this never needs to be reachable from other devices.
    // Using the hostname "localhost" (not 127.0.0.1) both here and in loadURL below
    // matters: Firebase Auth auto-trusts the literal domain "localhost" for sign-in,
    // and that only lines up if the app is actually navigated to that same hostname.
    server.on('listening', () => {
      localServerPort = server.address().port;
      resolve(localServerPort);
    });
    server.listen(PREFERRED_LOCAL_PORT, 'localhost');
  });
}

function choosePlayerDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.find(d => d.id !== primary.id) || primary;
}

function applyClickThrough() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setIgnoreMouseEvents(!overlayInteractive, { forward: true });
  overlayWindow.webContents.send('overlay-interactive-changed', overlayInteractive);
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('overlay-interactive-changed', overlayInteractive);
  }
}

function createOverlay(display = choosePlayerDisplay()) {
  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadURL(`http://localhost:${localServerPort}/overlay.html`);
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.showInactive();
    applyClickThrough();
  });
}

function createController() {
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.show();
    controllerWindow.focus();
    return;
  }
  const primary = screen.getPrimaryDisplay();
  const width = 500;
  const height = Math.min(940, primary.workArea.height);
  controllerWindow = new BrowserWindow({
    width,
    height,
    x: primary.workArea.x + 20,
    y: primary.workArea.y + 20,
    title: 'Troxell Overlay Controller',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  controllerWindow.loadURL(`http://localhost:${localServerPort}/controller.html`);
  controllerWindow.on('closed', () => { controllerWindow = null; });
}

// ---------------------------------------------------------------------------
// Panel pop-out windows
//
// controller.html can tear an individual panel (currently just the grouped
// "Turn & Initiative" panel, id "turn-initiative") into its own window via
// window.blackstoneDesktop.openPanelWindow(panelId). That window loads
// controller.html again with ?panel=<id> in the URL, which tells the page's
// own script to hide everything except that one panel. All popped windows
// (and the main controller window) get told the current list of popped panel
// ids via 'popped-panels-changed' so each one can show/hide its "open in a
// separate window" placeholder correctly.
// ---------------------------------------------------------------------------
function poppedPanelIds() {
  return Object.keys(panelWindows);
}

function broadcastPoppedPanels() {
  const list = poppedPanelIds();
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('popped-panels-changed', list);
  }
  Object.values(panelWindows).forEach(win => {
    if (win && !win.isDestroyed()) win.webContents.send('popped-panels-changed', list);
  });
}

function createPanelWindow(panelId) {
  if (!panelId) return;
  const existing = panelWindows[panelId];
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return;
  }
  const primary = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: 380,
    height: Math.min(720, primary.workArea.height),
    x: primary.workArea.x + 40,
    y: primary.workArea.y + 40,
    title: 'Troxell Remote — ' + panelId,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL(`http://localhost:${localServerPort}/controller.html?panel=${encodeURIComponent(panelId)}`);
  win.webContents.on('did-finish-load', () => {
    // Give the freshly-opened panel window the latest known state immediately —
    // otherwise it sits blank until the next state broadcast from the TV.
    if (lastState) win.webContents.send('overlay-state', lastState);
  });
  win.on('closed', () => {
    delete panelWindows[panelId];
    broadcastPoppedPanels();
  });
  panelWindows[panelId] = win;
  broadcastPoppedPanels();
}

function closePanelWindow(panelId) {
  const win = panelWindows[panelId];
  if (win && !win.isDestroyed()) win.close();
}

app.whenReady().then(async () => {
  // Electron denies media (camera/mic) permission requests by default unless the
  // app explicitly allows them - the Mini Tracker panel's camera access would
  // otherwise silently fail with no prompt at all inside these windows.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  await startLocalServer();
  createOverlay();
  createController();
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    overlayInteractive = !overlayInteractive;
    applyClickThrough();
  });
});

ipcMain.on('overlay-command', (_event, packet) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('overlay-command', packet);
});

ipcMain.on('overlay-state', (_event, payload) => {
  lastState = payload;
  if (controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.webContents.send('overlay-state', payload);
  // Popped-out panel windows are just another controller.html instance and need
  // the same live state as the main Remote window (round number, HP, etc).
  Object.values(panelWindows).forEach(win => {
    if (win && !win.isDestroyed()) win.webContents.send('overlay-state', payload);
  });
});

ipcMain.on('request-overlay-state', (event) => {
  if (lastState) event.sender.send('overlay-state', lastState);
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('overlay-command', { action: '__requestState', payload: {} });
});

ipcMain.on('open-controller', createController);
ipcMain.on('set-overlay-interactive', (_event, on) => { overlayInteractive = !!on; applyClickThrough(); });
ipcMain.handle('get-displays', () => screen.getAllDisplays().map((d, i) => ({
  id: d.id,
  label: `${i + 1}: ${d.bounds.width}×${d.bounds.height} at ${d.bounds.x},${d.bounds.y}${d.id === screen.getPrimaryDisplay().id ? ' (primary)' : ''}`
})));
ipcMain.on('move-overlay', (_event, displayId) => {
  const display = screen.getAllDisplays().find(d => d.id === displayId);
  if (!display || !overlayWindow) return;
  overlayWindow.setBounds(display.bounds);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
});

ipcMain.on('open-panel-window', (_event, panelId) => createPanelWindow(panelId));
ipcMain.on('close-panel-window', (_event, panelId) => closePanelWindow(panelId));
ipcMain.on('request-popped-panels', (event) => {
  event.sender.send('popped-panels-changed', poppedPanelIds());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());