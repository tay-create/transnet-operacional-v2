const { app, BrowserWindow, shell, Menu, globalShortcut, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_URL = 'https://portal.tnethub.com.br';

Menu.setApplicationMenu(null);

// Silencia logs do updater em produção
autoUpdater.logger = null;

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

    // Bloqueia abertura de novas janelas do Electron, mas abre no navegador padrão
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    mainWindow.loadURL(APP_URL);

    // Desloga ao fechar, salvo se "Manter conectado" estiver marcado
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.webContents.executeJavaScript(`
            (function() {
                const manter = localStorage.getItem('manter_conectado');
                if (manter !== '1') {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth-storage');
                }
            })();
        `).finally(() => {
            mainWindow.destroy();
        });
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// Notifica quando atualização está baixada e pronta para instalar
autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Atualização disponível',
        message: 'Uma nova versão do Transnet Operacional foi baixada.',
        detail: 'Deseja reiniciar o aplicativo agora para aplicar a atualização?',
        buttons: ['Reiniciar agora', 'Mais tarde'],
        defaultId: 0,
    }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
    });
});

app.whenReady().then(() => {
    createWindow();

    // Recarregar página — menu removido, registrar atalhos manualmente
    globalShortcut.register('F5', () => {
        if (mainWindow) mainWindow.webContents.reload();
    });
    globalShortcut.register('CommandOrControl+R', () => {
        if (mainWindow) mainWindow.webContents.reload();
    });

    // Verificar atualizações 10 segundos após o app abrir
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 10000);
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
