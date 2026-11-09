const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  quitApp: () => {
    ipcRenderer.send('app-quit');
  }
});
