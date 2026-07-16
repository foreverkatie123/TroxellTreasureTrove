const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blackstoneDesktop', {
  sendCommand: (action, payload = {}) => ipcRenderer.send('overlay-command', { action, payload }),
  onCommand: callback => ipcRenderer.on('overlay-command', (_e, packet) => callback(packet.action, packet.payload)),
  publishState: payload => ipcRenderer.send('overlay-state', payload),
  onState: callback => ipcRenderer.on('overlay-state', (_e, payload) => callback(payload)),
  requestState: () => ipcRenderer.send('request-overlay-state'),
  openController: () => ipcRenderer.send('open-controller'),
  setOverlayInteractive: on => ipcRenderer.send('set-overlay-interactive', !!on),
  onOverlayInteractive: callback => ipcRenderer.on('overlay-interactive-changed', (_e, on) => callback(on)),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  moveOverlay: displayId => ipcRenderer.send('move-overlay', displayId)
});
