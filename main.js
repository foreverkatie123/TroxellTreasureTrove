const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let overlayWindow;
let controllerWindow;
let lastState = null;
let overlayInteractive = false;

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
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
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

app.whenReady().then(async () => {
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
});

ipcMain.on('request-overlay-state', () => {
  if (lastState && controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.webContents.send('overlay-state', lastState);
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

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());