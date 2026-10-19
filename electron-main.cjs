const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("https://") ||
      url.startsWith("http://")
    ) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  void win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
