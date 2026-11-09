const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let isQuitting = false;

ipcMain.on('app-quit', () => {
  isQuitting = true;
  app.quit();
});

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Smart Notes',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#F8FAF5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true
  });

  // Handle window close confirmation
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Yes, Exit', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Exit Smart Notes',
        message: 'Are you sure you want to exit Smart Notes?',
        detail: 'Please ensure all your recent notes and consistency data are synced to the cloud.',
        noLink: true
      });
      if (choice === 0) {
        isQuitting = true;
        app.quit();
      }
    }
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
