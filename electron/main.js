const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_URL = 'https://portal.tnethub.com.br';

app.setName('Transnet Operacional');
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
                if (manter === '1') return Promise.resolve();
                const token = localStorage.getItem('auth_token');
                const p = token
                    ? fetch('/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).catch(() => {})
                    : Promise.resolve();
                return p.finally(() => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth-storage');
                });
            })()
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
        const updateModal = new BrowserWindow({
            parent: mainWindow,
            modal: true,
            show: false,
            width: 480,
            height: 240,
            frame: false,
            resizable: false,
            backgroundColor: '#0f172a',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        const modalHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; overflow: hidden; border: 1px solid #1e293b; border-radius: 8px; box-sizing: border-box; }
        .header { background: #1e293b; padding: 15px 20px; font-weight: 600; font-size: 16px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 10px; }
        .content { padding: 25px 20px; flex: 1; font-size: 14.5px; color: #cbd5e1; line-height: 1.5; text-align: center; }
        .footer { padding: 15px 20px; background: #1e293b; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #334155; }
        button { cursor: pointer; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: 600; border: none; transition: all 0.2s; outline: none; }
        .btn-later { background: transparent; color: #94a3b8; border: 1px solid #475569; }
        .btn-later:hover { background: #334155; color: #f8fafc; transform: translateY(-1px); }
        .btn-restart { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); border: 1px solid #2563eb; }
        .btn-restart:hover { background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5); }
        .icon { width: 22px; height: 22px; color: #3b82f6; }
    </style>
</head>
<body>
    <div class="header">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        Atualização Pronta!
    </div>
    <div class="content">
        <strong style="color: #f8fafc; font-size: 16.5px; display: block; margin-bottom: 8px;">A nova versão do Transnet Operacional foi baixada!</strong>
        Deseja reiniciar o aplicativo agora para aplicar a atualização e aproveitar as novidades?
    </div>
    <div class="footer">
        <button class="btn-later" id="btn-later" tabindex="2">Mais tarde</button>
        <button class="btn-restart" id="btn-restart" tabindex="1">Reiniciar agora</button>
    </div>
    <script>
        const { ipcRenderer } = require('electron');
        document.getElementById('btn-restart').onclick = () => {
            document.getElementById('btn-restart').innerText = 'Reiniciando...';
            document.getElementById('btn-restart').style.opacity = '0.7';
            ipcRenderer.send('update-action', 'restart');
        };
        document.getElementById('btn-later').onclick = () => {
            ipcRenderer.send('update-action', 'later');
        };
        document.getElementById('btn-restart').focus();
    </script>
</body>
</html>`;

        updateModal.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(modalHtml)}`);

        // Using ipcMain.on instead of once to handle potential multiple clicks edge cases, but we remove all listeners when the window closes
        ipcMain.once('update-action', (event, action) => {
            if (action === 'restart') {
                autoUpdater.quitAndInstall();
            } else {
                updateModal.close();
                if (mainWindow) {
                    mainWindow.webContents.executeJavaScript(`
                        (function() {
                            const overlay = document.getElementById('update-overlay');
                            if (overlay) overlay.style.display = 'none';
                        })();
                    `).catch(() => {});
                }
            }
        });

        // Cleanup listener if modal is closed via other means (e.g. alt-f4)
        updateModal.on('closed', () => {
            ipcMain.removeAllListeners('update-action');
        });

        updateModal.once('ready-to-show', () => {
            updateModal.show();
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
