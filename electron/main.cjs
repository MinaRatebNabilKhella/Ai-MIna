const { app, BrowserWindow, shell, dialog } = require('electron');
const { URL } = require('node:url');
const appUrlConfig = require('./app-url.json');

const APP_URL = String(process.env.MINA_APP_URL || appUrlConfig.url || '').trim();
let mainWindow;

function isConfiguredHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.hostname.includes('YOUR_GITHUB_USERNAME') && !u.pathname.includes('YOUR_REPOSITORY');
  } catch { return false; }
}

async function createWindow() {
  if (!isConfiguredHttpsUrl(APP_URL)) {
    await app.whenReady();
    await dialog.showMessageBox({ type: 'error', title: 'Mina Student AI', message: 'لم يتم إعداد رابط التطبيق المنشور بعد.', detail: 'أضف رابط GitHub Pages إلى electron/app-url.json ثم أعد بناء ملف التثبيت.' });
    app.quit();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#101b35',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const trustedOrigin = new URL(APP_URL).origin;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.origin !== trustedOrigin) shell.openExternal(target.toString());
    } catch { /* ignore malformed popups */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin !== trustedOrigin) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch { event.preventDefault(); }
  });
  await mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
