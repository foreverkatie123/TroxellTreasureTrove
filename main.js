const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');

let overlayWindow;
let controllerWindow;
let lastState = null;
let overlayInteractive = false;

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
  overlayWindow.loadFile('overlay.html');
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
  controllerWindow.loadFile('controller.html');
  controllerWindow.on('closed', () => { controllerWindow = null; });
}

app.whenReady().then(() => {
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