const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const APP_URL = 'https://portal.tnethub.com.br';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        title: 'Transnet Operacional',
        icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
        }
    });

    // Bloqueia navegação para fora do domínio
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(APP_URL)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // Bloqueia abertura de novas janelas
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    mainWindow.loadURL(APP_URL);
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
