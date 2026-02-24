const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

let mainWindow;
let serverProcess;

// --- Banco de dados direto (modo desktop sem servidor HTTP) ---
const DB_PATH = path.join(__dirname, '..', 'tnetlog.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('[IPC DB] Erro SQLite:', err.message);
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows); });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

// --- IPC Handlers ---

// ─── Autenticação ─────────────────────────────────────────────────────────────
ipcMain.handle('login', async (_, { email, senha }) => {
    try {
        const user = await dbGet('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (!user) return { success: false, message: 'Usuário não encontrado' };
        const ok = await bcrypt.compare(senha, user.senha);
        if (!ok) return { success: false, message: 'Senha incorreta' };
        const { senha: _s, ...userData } = user;
        // Parsear permissões individuais se existirem
        userData.permissoesAcesso = JSON.parse(userData.permissoesAcesso || '[]');
        userData.permissoesEdicao = JSON.parse(userData.permissoesEdicao || '[]');
        return { success: true, user: userData };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Veículos ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-veiculos', async (_, { page = 1, limit = 200 } = {}) => {
    try {
        const offset = (page - 1) * limit;
        const [rows, countRow] = await Promise.all([
            dbAll('SELECT * FROM veiculos ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]),
            dbGet('SELECT COUNT(*) as total FROM veiculos')
        ]);
        const total = countRow?.total || 0;
        const veiculos = rows.map(row => ({
            ...JSON.parse(row.dados_json || '{}'),
            id: row.id
        }));
        return { success: true, veiculos, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-veiculo', async (_, dados) => {
    try {
        const result = await dbRun(
            'INSERT INTO veiculos (dados_json) VALUES (?)',
            [JSON.stringify(dados)]
        );
        return { success: true, id: result.lastID };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-veiculo', async (_, { id, dados }) => {
    try {
        await dbRun('UPDATE veiculos SET dados_json = ? WHERE id = ?', [JSON.stringify(dados), id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-veiculo', async (_, id) => {
    try {
        await dbRun('DELETE FROM veiculos WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Fila ─────────────────────────────────────────────────────────────────────
ipcMain.handle('get-fila', async () => {
    try {
        const rows = await dbAll('SELECT * FROM fila');
        const fila = rows.map(row => ({ id: row.id, ...JSON.parse(row.dados_json) }));
        return { success: true, fila };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-fila', async (_, dados) => {
    try {
        const result = await dbRun('INSERT INTO fila (dados_json) VALUES (?)', [JSON.stringify(dados)]);
        return { success: true, id: result.lastID };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-fila', async (_, { id, dados }) => {
    try {
        await dbRun('UPDATE fila SET dados_json = ? WHERE id = ?', [JSON.stringify(dados), id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-fila-reordenar', async (_, ordem) => {
    try {
        if (!Array.isArray(ordem)) return { success: false, message: 'Formato inválido' };
        await Promise.all(ordem.map(item =>
            dbRun('UPDATE fila SET dados_json = ? WHERE id = ?', [JSON.stringify(item), item.id])
        ));
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-fila', async (_, id) => {
    try {
        await dbRun('DELETE FROM fila WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Notificações ─────────────────────────────────────────────────────────────
ipcMain.handle('get-notificacoes', async () => {
    try {
        const rows = await dbAll('SELECT * FROM notificacoes ORDER BY id DESC');
        const notificacoes = rows.map(row => ({ idInterno: row.id, ...JSON.parse(row.dados_json) }));
        return { success: true, notificacoes };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-notificacao', async (_, id) => {
    try {
        await dbRun('DELETE FROM notificacoes WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Cubagens ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-cubagens', async () => {
    try {
        const cubagens = await dbAll('SELECT * FROM cubagens ORDER BY data_criacao DESC');
        if (cubagens.length === 0) return { success: true, cubagens: [] };

        const ids = cubagens.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        const todosItens = await dbAll(`SELECT * FROM cubagem_itens WHERE cubagem_id IN (${placeholders})`, ids);

        const itensPorCubagem = {};
        for (const item of todosItens) {
            if (!itensPorCubagem[item.cubagem_id]) itensPorCubagem[item.cubagem_id] = [];
            itensPorCubagem[item.cubagem_id].push(item);
        }
        for (const c of cubagens) c.itens = itensPorCubagem[c.id] || [];

        return { success: true, cubagens };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('get-cubagem-coleta', async (_, numero) => {
    try {
        const cubagem = await dbGet('SELECT * FROM cubagens WHERE numero_coleta = ?', [numero]);
        if (cubagem) {
            cubagem.itens = await dbAll('SELECT * FROM cubagem_itens WHERE cubagem_id = ?', [cubagem.id]);
        }
        return { success: true, cubagem };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-cubagem', async (_, dados) => {
    try {
        const { numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, itens, metragem_total, valor_mix_total, valor_kit_total } = dados;
        const result = await dbRun(
            `INSERT INTO cubagens (numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, metragem_total, valor_mix_total, valor_kit_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0]
        );
        const cubagemId = result.lastID;
        if (itens && Array.isArray(itens)) {
            for (const item of itens) {
                if (item.numero_nf || item.metragem) {
                    const metro = parseFloat(item.metragem) || 0;
                    const base = metro + (metro * 0.10);
                    const mix = (base / 2.5) / 1.3;
                    const kit = (base / 2.5) / 1.9;
                    await dbRun(
                        `INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit) VALUES (?, ?, ?, ?, ?)`,
                        [cubagemId, item.numero_nf || '', metro, mix, kit]
                    );
                }
            }
        }
        return { success: true, id: cubagemId };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-cubagem', async (_, { id, dados }) => {
    try {
        const { numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, itens, metragem_total, valor_mix_total, valor_kit_total } = dados;
        await dbRun(
            `UPDATE cubagens SET numero_coleta=?, motorista=?, cliente=?, redespacho=?, nome_redespacho=?, destino=?, volume=?, data=?, faturado=?, tipo=?, metragem_total=?, valor_mix_total=?, valor_kit_total=? WHERE id=?`,
            [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0, id]
        );
        await dbRun('DELETE FROM cubagem_itens WHERE cubagem_id = ?', [id]);
        if (itens && Array.isArray(itens)) {
            for (const item of itens) {
                if (item.numero_nf || item.metragem) {
                    const metro = parseFloat(item.metragem) || 0;
                    const base = metro + (metro * 0.10);
                    const mix = (base / 2.5) / 1.3;
                    const kit = (base / 2.5) / 1.9;
                    await dbRun(
                        `INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit) VALUES (?, ?, ?, ?, ?)`,
                        [id, item.numero_nf || '', metro, mix, kit]
                    );
                }
            }
        }
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-cubagem', async (_, id) => {
    try {
        await dbRun('DELETE FROM cubagens WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Usuários ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-usuarios', async () => {
    try {
        const rows = await dbAll('SELECT * FROM usuarios');
        const usuarios = rows.map(u => ({
            ...u,
            permissoesAcesso: JSON.parse(u.permissoesAcesso || '[]'),
            permissoesEdicao: JSON.parse(u.permissoesEdicao || '[]')
        }));
        return { success: true, usuarios };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-usuario', async (_, dados) => {
    try {
        const { nome, email, senha, cidade, cargo } = dados;
        const existente = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existente) return { success: false, message: 'Este email já está em uso!' };
        const hash = senha.startsWith('$2b$') || senha.startsWith('$2a$')
            ? senha
            : await bcrypt.hash(senha, 10);
        await dbRun('INSERT INTO usuarios (nome, email, senha, cidade, cargo) VALUES (?, ?, ?, ?, ?)',
            [nome, email, hash, cidade, cargo]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-usuario', async (_, { id, dados }) => {
    try {
        const atual = await dbGet('SELECT * FROM usuarios WHERE id=?', [id]);
        if (!atual) return { success: false, message: 'Usuário não encontrado' };
        const { usaPermissaoIndividual, permissoesAcesso, permissoesEdicao, cargo, cidade, nome } = dados;
        await dbRun(
            `UPDATE usuarios SET usaPermissaoIndividual=?, permissoesAcesso=?, permissoesEdicao=?, cargo=?, cidade=?, nome=? WHERE id=?`,
            [
                usaPermissaoIndividual !== undefined ? (usaPermissaoIndividual ? 1 : 0) : atual.usaPermissaoIndividual,
                JSON.stringify(permissoesAcesso ?? JSON.parse(atual.permissoesAcesso || '[]')),
                JSON.stringify(permissoesEdicao ?? JSON.parse(atual.permissoesEdicao || '[]')),
                cargo ?? atual.cargo,
                cidade ?? atual.cidade,
                nome ?? atual.nome,
                id
            ]
        );
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-usuario-avatar', async (_, { id, avatarUrl }) => {
    try {
        await dbRun('UPDATE usuarios SET avatarUrl = ? WHERE id = ?', [avatarUrl, id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-usuario', async (_, id) => {
    try {
        await dbRun('DELETE FROM usuarios WHERE id=?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Solicitações de cadastro ─────────────────────────────────────────────────
ipcMain.handle('get-solicitacoes', async () => {
    try {
        const s = await dbAll('SELECT * FROM solicitacoes');
        return { success: true, solicitacoes: s };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-solicitacao', async (_, dados) => {
    try {
        const { nome, emailPrefix, unidade, senha } = dados;
        const senhaHash = await bcrypt.hash(senha || '123456', 10);
        const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        await dbRun(
            "INSERT INTO solicitacoes (tipo, nome, email, unidade, senha, data_criacao) VALUES (?,?,?,?,?,?)",
            ['CADASTRO', nome, emailPrefix + '@tnetlog.com.br', unidade, senhaHash, agora]
        );
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('delete-solicitacao', async (_, id) => {
    try {
        await dbRun('DELETE FROM solicitacoes WHERE id=?', [id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Relatórios / Histórico CT-e ──────────────────────────────────────────────
ipcMain.handle('get-relatorios', async () => {
    try {
        const rows = await dbAll('SELECT dados_json FROM historico');
        return { historico: rows.map(r => JSON.parse(r.dados_json)) };
    } catch (e) {
        return { historico: [] };
    }
});

ipcMain.handle('post-historico-cte', async (_, dados) => {
    try {
        await dbRun('INSERT INTO historico_cte (dados_json) VALUES (?)', [JSON.stringify(dados)]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-cte-status', async (_, { cteId, statusAntigo, statusNovo, origem, coleta, usuario }) => {
    try {
        let acao = 'STATUS_CTE';
        let detalhes = `[${origem}] ${statusAntigo} → ${statusNovo} | Coleta: ${coleta}`;
        if (statusNovo === 'Em Emissão' && statusAntigo === 'Aguardando Emissão') {
            acao = 'EMISSAO_CTE';
            detalhes = `CT-e iniciou emissão | ${detalhes}`;
        } else if (statusNovo === 'Emitido') {
            acao = 'EMISSAO_CTE';
            detalhes = `CT-e finalizado e emitido | ${detalhes}`;
        } else if (statusAntigo === 'Emitido' || statusAntigo === 'Em Emissão') {
            acao = 'ESTORNO_CTE';
            detalhes = `⚠️ CT-e retrocedido: ${statusAntigo} → ${statusNovo} | ${origem} | Coleta: ${coleta}`;
        }
        await dbRun(
            'INSERT INTO logs (acao, usuario, alvo_id, alvo_tipo, valor_antigo, valor_novo, detalhes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [acao, usuario || 'sistema', cteId, 'cte', statusAntigo, statusNovo, detalhes]
        );
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Tokens de Marcação de Placas ─────────────────────────────────────────────
ipcMain.handle('get-tokens', async () => {
    try {
        const rows = await dbAll('SELECT * FROM tokens_motoristas ORDER BY data_criacao DESC');
        return { success: true, tokens: rows };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-token', async (_, telefone) => {
    try {
        let tel = (telefone || '').replace(/\D/g, '');
        if (!tel.startsWith('55')) tel = '55' + tel;
        if (tel.length < 12 || tel.length > 13) {
            return { success: false, message: 'Telefone inválido.' };
        }
        // Bloqueia se já existe token ativo para este número
        const ativo = await dbGet(
            "SELECT id FROM tokens_motoristas WHERE telefone = ? AND status = 'ativo'",
            [tel]
        );
        if (ativo) {
            return { success: false, message: 'Já existe um link ativo para este número. Inative-o antes de gerar um novo.' };
        }
        const token = crypto.randomUUID();
        const expiracao = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        const result = await dbRun(
            'INSERT INTO tokens_motoristas (telefone, token, data_expiracao) VALUES (?, ?, ?)',
            [tel, token, expiracao]
        );
        const novo = await dbGet('SELECT * FROM tokens_motoristas WHERE id = ?', [result.lastID]);
        return { success: true, token: novo };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('put-token', async (_, { id, status }) => {
    try {
        await dbRun('UPDATE tokens_motoristas SET status = ? WHERE id = ?', [status, id]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Marcações de Placas ──────────────────────────────────────────────────────
ipcMain.handle('validar-token', async (_, token) => {
    try {
        const row = await dbGet(
            'SELECT id, telefone, status, data_expiracao FROM tokens_motoristas WHERE token = ?',
            [token]
        );
        if (!row) return { success: false, message: 'Link inválido.' };
        if (row.status === 'utilizado') return { success: false, message: 'Este link já foi utilizado.' };
        if (row.status !== 'ativo') return { success: false, message: 'Link inativo.' };
        if (row.data_expiracao && new Date() > new Date(row.data_expiracao)) {
            await dbRun("UPDATE tokens_motoristas SET status = 'inativo' WHERE id = ?", [row.id]);
            return { success: false, message: 'Link expirado. Solicite um novo link ao operador.' };
        }
        return { success: true, telefone: row.telefone, tokenId: row.id };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-marcacao', async (_, dados) => {
    try {
        const {
            token_id, nome_motorista, telefone, placa1, placa2,
            tipo_veiculo, altura, largura, comprimento,
            estados_destino, estado_origem, ja_carregou,
            rastreador, status_rastreador, latitude, longitude,
            origem_cidade_uf, destino_desejado, disponibilidade
        } = dados;

        if (!nome_motorista || !telefone || !placa1 || !tipo_veiculo) {
            return { success: false, message: 'Campos obrigatórios faltando.' };
        }

        await dbRun(
            `INSERT INTO marcacoes_placas
             (token_id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
              altura, largura, comprimento, estados_destino, estado_origem,
              ja_carregou, rastreador, status_rastreador, latitude, longitude,
              origem_cidade_uf, destino_desejado, disponibilidade)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                token_id, nome_motorista, telefone, placa1, placa2 || '',
                tipo_veiculo, altura || null, largura || null, comprimento || null,
                JSON.stringify(estados_destino || []), estado_origem || '',
                ja_carregou || '', rastreador || 'Não possui', status_rastreador || 'Inativo',
                latitude || '', longitude || '',
                origem_cidade_uf || '', destino_desejado || '', disponibilidade || ''
            ]
        );

        if (token_id) {
            await dbRun("UPDATE tokens_motoristas SET status = 'utilizado' WHERE id = ?", [token_id]);
        }
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('get-marcacoes', async () => {
    try {
        const rows = await dbAll('SELECT * FROM marcacoes_placas ORDER BY data_marcacao DESC');
        const marcacoes = rows.map(r => ({
            ...r,
            estados_destino: JSON.parse(r.estados_destino || '[]')
        }));
        return { success: true, marcacoes };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('get-marcacoes-disponiveis', async () => {
    try {
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   origem_cidade_uf, destino_desejado, disponibilidade, data_marcacao
            FROM marcacoes_placas
            WHERE data_marcacao >= datetime('now', '-7 days')
            ORDER BY data_marcacao DESC
        `);
        const motoristas = rows.map(r => ({
            ...r,
            telefone: r.telefone.replace(/\D/g, '')
        }));
        return { success: true, motoristas };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Configurações / Permissões ───────────────────────────────────────────────
ipcMain.handle('get-configuracoes', async () => {
    try {
        const a = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_acesso'");
        const b = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_edicao'");
        return { success: true, acesso: JSON.parse(a.valor), edicao: JSON.parse(b.valor) };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-configuracoes', async (_, { acesso, edicao }) => {
    try {
        if (acesso) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_acesso'", [JSON.stringify(acesso)]);
        if (edicao) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_edicao'", [JSON.stringify(edicao)]);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Logs de Auditoria ────────────────────────────────────────────────────────
ipcMain.handle('get-logs', async (_, { page = 1, limit = 100 } = {}) => {
    try {
        const offset = (page - 1) * limit;
        const countResult = await dbGet('SELECT COUNT(*) as total FROM logs');
        const totalLogs = countResult.total;
        const logs = await dbAll(
            "SELECT id, acao, usuario, alvo_id, alvo_tipo, valor_antigo, valor_novo, detalhes, datetime(data_hora, 'localtime') as data_hora FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        return {
            success: true, logs,
            pagination: { currentPage: page, totalPages: Math.ceil(totalLogs / limit), totalLogs, limit }
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('post-log', async (_, { usuario, acao, detalhes }) => {
    try {
        const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        await dbRun(
            'INSERT INTO logs (usuario, acao, detalhes, data_hora) VALUES (?, ?, ?, ?)',
            [usuario, acao, detalhes || '', agora]
        );
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ─── Versão ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());

// --- Janela principal ---
function startBackend() {
    const serverPath = path.join(__dirname, '..', 'server.js');
    serverProcess = fork(serverPath, [], {
        env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
        silent: true
    });

    serverProcess.stdout.on('data', (data) => console.log('[Server]', data.toString()));
    serverProcess.stderr.on('data', (data) => console.error('[Server Error]', data.toString()));
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        title: 'Transnet Operacional',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const appUrl = 'http://localhost:3000';
        if (!url.startsWith(appUrl)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const startUrl = app.isPackaged
        ? `file://${path.join(__dirname, '..', 'build', 'index.html')}`
        : 'http://localhost:3000';

    mainWindow.loadURL(startUrl);
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    if (app.isPackaged) startBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    db.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
