const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Smart Notes',
    backgroundColor: '#F8FAF5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const prodPath = path.join(__dirname, 'dist', 'index.html');
  const clientPath = path.join(__dirname, '../packages/client/dist', 'index.html');
  const targetPath = fs.existsSync(prodPath) ? prodPath : clientPath;

  win.loadFile(targetPath);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
