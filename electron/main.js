const { app, BrowserWindow, shell, Menu, globalShortcut } = require('electron');
const path = require('path');

const APP_URL = 'https://portal.tnethub.com.br';

Menu.setApplicationMenu(null);

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

    // Desloga ao fechar: limpa token do localStorage antes de destruir a janela
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.webContents.executeJavaScript(`
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth-storage');
        `).finally(() => {
            mainWindow.destroy();
        });
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    createWindow();

    // Recarregar página — menu removido, registrar atalhos manualmente
    globalShortcut.register('F5', () => {
        if (mainWindow) mainWindow.webContents.reload();
    });
    globalShortcut.register('CommandOrControl+R', () => {
        if (mainWindow) mainWindow.webContents.reload();
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
