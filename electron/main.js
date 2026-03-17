const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_URL = 'https://portal.tnethub.com.br';

Menu.setApplicationMenu(null);

// Habilita logs básicos para depuração em caso de erro na atualização
autoUpdater.logger = console;

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        title: 'Transnet Operacional',
        icon: path.join(__dirname, '..', 'public', 'appicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
        }
    });

    // Permite notificações do Windows via Notification API do browser
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'notifications') return callback(true);
        callback(false);
    });
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'notifications') return true;
        return false;
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

    mainWindow.webContents.session.clearCache().then(() => {
        mainWindow.loadURL(APP_URL);
    });

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

    // Atalhos locais — só disparam quando esta janela está focada
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F5') {
            mainWindow.webContents.reload();
            event.preventDefault();
        } else if (input.key === 'F11') {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
            event.preventDefault();
        } else if (input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        } else if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
            mainWindow.webContents.reload();
            event.preventDefault();
        }
    });
}

// ── Auto-Updater com Barra de Progresso Visível ──────────────────────────────

// Injeta overlay de progresso na página do app
function injectUpdateOverlay() {
    if (!mainWindow) return;
    mainWindow.webContents.executeJavaScript(`
        (function() {
            if (document.getElementById('update-overlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'update-overlay';
            overlay.innerHTML = \`
                <div style="
                    position:fixed; top:0; left:0; right:0; z-index:99999;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border-bottom: 2px solid #3b82f6;
                    padding: 16px 24px;
                    display:flex; align-items:center; gap:16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    font-family: 'Segoe UI', sans-serif;
                ">
                    <div style="
                        width:36px; height:36px; border:3px solid #3b82f6; border-top-color:transparent;
                        border-radius:50%; animation: updSpin 0.8s linear infinite;
                    "></div>
                    <div style="flex:1;">
                        <div style="color:#e2e8f0; font-weight:700; font-size:14px; margin-bottom:6px;" id="update-title">
                            🚀 Nova versão encontrada! Baixando atualização...
                        </div>
                        <div style="
                            background: rgba(255,255,255,0.1); border-radius:8px;
                            height:10px; overflow:hidden; position:relative;
                        ">
                            <div id="update-bar" style="
                                width:0%; height:100%; border-radius:8px;
                                background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
                                background-size: 200% 100%;
                                animation: updShimmer 1.5s ease infinite;
                                transition: width 0.3s ease;
                            "></div>
                        </div>
                        <div style="color:#94a3b8; font-size:11px; margin-top:4px; display:flex; justify-content:space-between;">
                            <span id="update-percent">0%</span>
                            <span id="update-speed"></span>
                        </div>
                    </div>
                </div>
            \`;
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes updSpin { to { transform: rotate(360deg); } }
                @keyframes updShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
            \`;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        })();
    `).catch(() => {});
}

function updateProgress(percent, speed) {
    if (!mainWindow) return;
    const pct = Math.round(percent);
    const spd = speed > 1024 ? (speed / 1024).toFixed(1) + ' MB/s' : Math.round(speed) + ' KB/s';
    mainWindow.webContents.executeJavaScript(`
        (function() {
            const bar = document.getElementById('update-bar');
            const pctEl = document.getElementById('update-percent');
            const spdEl = document.getElementById('update-speed');
            if (bar) bar.style.width = '${pct}%';
            if (pctEl) pctEl.textContent = '${pct}%';
            if (spdEl) spdEl.textContent = '${spd}';
        })();
    `).catch(() => {});
    mainWindow.setProgressBar(pct / 100);
}

function updateComplete() {
    if (!mainWindow) return;
    mainWindow.setProgressBar(-1);
    mainWindow.webContents.executeJavaScript(`
        (function() {
            const title = document.getElementById('update-title');
            const bar = document.getElementById('update-bar');
            const pctEl = document.getElementById('update-percent');
            const spdEl = document.getElementById('update-speed');
            if (title) title.textContent = '✅ Atualização baixada com sucesso! Reiniciando...';
            if (bar) { bar.style.width = '100%'; bar.style.background = '#22c55e'; }
            if (pctEl) pctEl.textContent = '100% — Pronto!';
            if (spdEl) spdEl.textContent = '';
        })();
    `).catch(() => {});
}

autoUpdater.on('update-available', () => {
    injectUpdateOverlay();
    // Inicia o download explicitamente (autoDownload = false)
    autoUpdater.downloadUpdate().catch(() => {});
});

autoUpdater.on('update-not-available', () => {
    // Nenhuma atualização — não faz nada
});

autoUpdater.on('error', (err) => {
    if (!mainWindow) return;
    mainWindow.setProgressBar(-1);
    mainWindow.webContents.executeJavaScript(`
        (function() {
            const overlay = document.getElementById('update-overlay');
            const title = document.getElementById('update-title');
            if (title) title.textContent = '⚠️ Falha ao baixar atualização. Reinicie o app para tentar novamente.';
            const bar = document.getElementById('update-bar');
            if (bar) { bar.style.background = '#ef4444'; bar.style.width = '100%'; }
            setTimeout(() => { if (overlay) overlay.remove(); }, 5000);
        })();
    `).catch(() => {});
});

autoUpdater.on('download-progress', (progress) => {
    updateProgress(progress.percent, progress.bytesPerSecond / 1024);
});

autoUpdater.on('update-downloaded', () => {
    updateComplete();
    setTimeout(() => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Atualização pronta!',
            message: 'A nova versão do Transnet Operacional foi baixada.',
            detail: 'Deseja reiniciar o aplicativo agora para aplicar a atualização?',
            buttons: ['Reiniciar agora', 'Mais tarde'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) autoUpdater.quitAndInstall();
        });
    }, 1500);
});

app.whenReady().then(() => {
    createWindow();

    // Verificar atualizações 10 segundos após o app abrir
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 10000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
