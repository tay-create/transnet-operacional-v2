// Carregar variáveis de ambiente ANTES de tudo
require('dotenv').config();

// Fuso horário global — garante que new Date() respeite Brasília
process.env.TZ = 'America/Sao_Paulo';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { authMiddleware, authorize, generateToken } = require('./middleware/authMiddleware');
const { validate, loginSchema, novoLancamentoSchema, cubagemSchema, cadastroUsuarioSchema } = require('./middleware/validationMiddleware');

const app = express();
// Aumenta o limite para aceitar imagens em Base64 grandes
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '10mb';
app.use(bodyParser.json({ limit: MAX_FILE_SIZE }));
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// --- BANCO DE DADOS ---
const DB_PATH = path.join(__dirname, 'tnetlog.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Erro SQLite:', err.message);
    else {
        console.log('Conectado ao SQLite.');
        inicializarBanco();
    }
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows); });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
});

// Configurações Padrão de Permissões
const PERMISSOES_PADRAO = JSON.stringify({
    'Coordenador': ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro'],
    'Planejamento': ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota'],
    'Encarregado': ['operacao', 'cte', 'relatorios', 'relatorio_op', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro'],
    'Aux. Operacional': ['operacao', 'cte', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Conhecimento': ['cte', 'operacao', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Cadastro': ['operacao', 'cadastro', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Dashboard Viewer': ['dashboard_tv']
});

const PERMISSOES_EDICAO_PADRAO = JSON.stringify({
    'Coordenador': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila'],
    'Planejamento': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem'],
    'Encarregado': ['operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo'],
    'Aux. Operacional': ['operacao', 'editar_operacao_card', 'coleta_card', 'timer_solicitado', 'timer_liberado'],
    'Conhecimento': ['cte'],
    'Cadastro': []
});

const inicializarBanco = async () => {
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT, senha TEXT, cidade TEXT, cargo TEXT, avatarUrl TEXT, usaPermissaoIndividual INTEGER DEFAULT 0, permissoesAcesso TEXT, permissoesEdicao TEXT)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS solicitacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, nome TEXT, email TEXT, unidade TEXT, senha TEXT, data_criacao TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico_cte (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS veiculos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT,
            placa TEXT, modelo TEXT, motorista TEXT,
            status_recife TEXT, status_moreno TEXT,
            doca_recife TEXT, doca_moreno TEXT,
            coleta TEXT, coletaRecife TEXT, coletaMoreno TEXT,
            rota_recife TEXT, rota_moreno TEXT,
            unidade TEXT, operacao TEXT, inicio_rota TEXT, origem_criacao TEXT,
            data_prevista TEXT, data_criacao TEXT,
            tempos_recife TEXT, tempos_moreno TEXT, status_coleta TEXT,
            observacao TEXT, imagens TEXT
         )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS notificacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT, data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS fila (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS checklists_carreta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            veiculo_id INTEGER,
            motorista_nome TEXT,
            placa_carreta TEXT,
            placa_confere INTEGER,
            condicao_bau TEXT,
            cordas INTEGER,
            foto_vazamento TEXT,
            assinatura TEXT,
            conferente_nome TEXT,
            status TEXT DEFAULT 'PENDENTE',
            created_at TEXT
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            acao TEXT NOT NULL,
            usuario TEXT NOT NULL,
            alvo_id INTEGER,
            alvo_tipo TEXT,
            valor_antigo TEXT,
            valor_novo TEXT,
            detalhes TEXT,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_coleta TEXT,
            motorista TEXT,
            cliente TEXT,
            redespacho INTEGER DEFAULT 0,
            nome_redespacho TEXT,
            destino TEXT,
            volume TEXT,
            data TEXT,
            faturado INTEGER DEFAULT 0,
            tipo TEXT,
            metragem_total REAL DEFAULT 0,
            valor_mix_total REAL DEFAULT 0,
            valor_kit_total REAL DEFAULT 0,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Adicionar colunas faltantes em tabelas existentes (ALTER TABLE é seguro - ignora se já existe)
        const colunasParaAdicionar = [
            { tabela: 'cubagens', coluna: 'metragem_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'valor_mix_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'valor_kit_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'nome_redespacho', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'observacao', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'imagens', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_cte', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'chave_cte', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_coleta', tipo: 'TEXT' },
            // Módulo de Checklist / Liberação
            { tabela: 'veiculos', coluna: 'chk_cnh', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_antt', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_tacografo', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_crlv', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'gerenciadora_risco', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'status_gerenciadora', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_liberacao', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'situacao_cadastro', tipo: "TEXT DEFAULT 'NÃO CONFERIDO'" },
            { tabela: 'veiculos', coluna: 'data_liberacao', tipo: 'TEXT' },
            // Módulo Cadastro / Gerenciamento de Risco (pré-liberação em marcacoes_placas)
            { tabela: 'marcacoes_placas', coluna: 'chk_cnh_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_antt_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_tacografo_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_crlv_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'seguradora_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'num_liberacao_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'data_liberacao_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'situacao_cad', tipo: "TEXT DEFAULT 'PENDENTE'" },
            { tabela: 'marcacoes_placas', coluna: 'comprovante_pdf', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_cnh', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_doc_veiculo', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_crlv_carreta', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_antt', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_outros', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'origem_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'destino_uf_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'destino_cidade_cad', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'status_cte', tipo: "TEXT DEFAULT 'Aguardando Emissão'" },
            { tabela: 'veiculos', coluna: 'timestamps_cte', tipo: 'TEXT' }
        ];

        // Tabela da Programação Diária
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_programacao_diaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_referencia TEXT,
            turno TEXT,
            dados_json TEXT
        )`);

        // Tabela de CT-es Ativos (persistencia entre reloads)
        await dbRun(`CREATE TABLE IF NOT EXISTS ctes_ativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origem TEXT NOT NULL,
            status TEXT DEFAULT 'Aguardando Emissão',
            dados_json TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        for (const { tabela, coluna, tipo } of colunasParaAdicionar) {
            try {
                await dbRun(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
                console.log(`✅ Coluna ${coluna} adicionada em ${tabela}`);
            } catch (e) {
                // Coluna já existe - ignorar
            }
        }

        // Marcação de Placas
        await dbRun(`CREATE TABLE IF NOT EXISTS tokens_motoristas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefone TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'ativo',
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_expiracao DATETIME
        )`);
        // Migração: adiciona coluna em banco existente sem ela
        try { await dbRun(`ALTER TABLE tokens_motoristas ADD COLUMN data_expiracao DATETIME`); } catch (_) { }
        await dbRun(`CREATE TABLE IF NOT EXISTS marcacoes_placas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_id INTEGER,
            nome_motorista TEXT NOT NULL,
            telefone TEXT NOT NULL,
            placa1 TEXT NOT NULL,
            placa2 TEXT,
            tipo_veiculo TEXT NOT NULL,
            altura REAL,
            largura REAL,
            comprimento REAL,
            estados_destino TEXT,
            estado_origem TEXT,
            ja_carregou TEXT,
            rastreador TEXT,
            status_rastreador TEXT,
            latitude TEXT,
            longitude TEXT,
            origem_cidade_uf TEXT,
            destino_desejado TEXT,
            disponibilidade TEXT,
            data_marcacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (token_id) REFERENCES tokens_motoristas(id)
        )`);
        for (const [tabela, coluna, tipo] of [
            ['marcacoes_placas', 'origem_cidade_uf', 'TEXT'],
            ['marcacoes_placas', 'destino_desejado', 'TEXT'],
            ['marcacoes_placas', 'disponibilidade', 'TEXT'],
            ['marcacoes_placas', 'viagens_realizadas', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'status_operacional', "TEXT DEFAULT 'DISPONIVEL'"],
            ['marcacoes_placas', 'is_frota', 'INTEGER DEFAULT 0'],
        ]) {
            try { await dbRun(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`); } catch (_) { }
        }
        // Garantir UNIQUE no telefone (cria índice único se não existir)
        try {
            await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_marcacoes_telefone ON marcacoes_placas (telefone)`);
        } catch (_) { }

        // Garantir UNIQUE no email de usuarios (migration segura para bancos existentes)
        try {
            await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email)`);
        } catch (_) { }

        // Tabela separada para itens de cubagem (relação N:1)
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagem_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cubagem_id INTEGER NOT NULL,
            numero_nf TEXT,
            metragem REAL DEFAULT 0,
            valor_mix REAL DEFAULT 0,
            valor_kit REAL DEFAULT 0,
            FOREIGN KEY (cubagem_id) REFERENCES cubagens(id) ON DELETE CASCADE
        )`);

        // ── Módulo de Frota e Telemetria ────────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_motoristas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cpf TEXT NOT NULL UNIQUE,
            celular TEXT,
            senha TEXT,
            modo_plantao INTEGER NOT NULL DEFAULT 0
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_veiculos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            placa TEXT NOT NULL UNIQUE,
            tipo TEXT NOT NULL,
            modelo TEXT
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_viagens_ativas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            motorista_id INTEGER NOT NULL,
            cavalo_id INTEGER,
            carreta_id INTEGER,
            status_atual TEXT NOT NULL DEFAULT 'DISPONÍVEL',
            ultima_lat_lng TEXT,
            previsao_disponibilidade TEXT,
            data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (motorista_id) REFERENCES frota_motoristas(id),
            FOREIGN KEY (cavalo_id) REFERENCES frota_veiculos(id),
            FOREIGN KEY (carreta_id) REFERENCES frota_veiculos(id)
        )`);
        // Migration: adiciona coluna se não existir (banco existente)
        try { await dbRun(`ALTER TABLE frota_viagens_ativas ADD COLUMN previsao_disponibilidade TEXT`); } catch (_) { };
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_ocorrencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viagem_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            descricao TEXT,
            foto_base64 TEXT,
            data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            status_ciencia INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (viagem_id) REFERENCES frota_viagens_ativas(id)
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            motorista_id INTEGER,
            motorista_nome TEXT,
            placa_carreta TEXT,
            placa_confere INTEGER NOT NULL DEFAULT 0,
            condicao_bau TEXT,
            cordas INTEGER NOT NULL DEFAULT 0,
            foto_vazamento TEXT,
            assinatura TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        const admin = await dbGet("SELECT * FROM usuarios WHERE email = ?", ['julio@tnetlog.com.br']);
        if (!admin) {
            const hashedPassword = await bcrypt.hash('123', 10);
            await dbRun(`INSERT INTO usuarios (nome, email, senha, cidade, cargo) VALUES (?, ?, ?, ?, ?)`,
                ['Julio', 'julio@tnetlog.com.br', hashedPassword, 'Recife', 'Coordenador']);
            console.log("✅ Usuário admin criado com senha hasheada");
        }

        const testePlanejamento = await dbGet("SELECT * FROM usuarios WHERE email = ?", ['teste@tnetlog.com.br']);
        if (!testePlanejamento) {
            const hashedPassword = await bcrypt.hash('123', 10);
            await dbRun(`INSERT INTO usuarios (nome, email, senha, cidade, cargo) VALUES (?, ?, ?, ?, ?)`,
                ['will.teste', 'teste@tnetlog.com.br', hashedPassword, 'Moreno', 'Planejamento']);
            console.log("✅ Usuário de teste (Planejamento) criado com senha hasheada");
        }

        // FORÇA ATUALIZAÇÃO DAS PERMISSÕES SEMPRE AO INICIAR
        const perm = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_acesso'");
        if (!perm) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_acesso', PERMISSOES_PADRAO]);
            console.log("✅ Permissões de ACESSO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, apenas adiciona cargos/módulos novos que ainda não existem
            const permSalvas = JSON.parse(perm.valor);
            const permPadrao = JSON.parse(PERMISSOES_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permPadrao)) {
                if (!permSalvas[cargo]) {
                    permSalvas[cargo] = permPadrao[cargo];
                    atualizado = true;
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_acesso'", [JSON.stringify(permSalvas)]);
                console.log("✅ Permissões de ACESSO: novos cargos adicionados.");
            }
        }

        const permEd = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_edicao'");
        if (!permEd) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_edicao', PERMISSOES_EDICAO_PADRAO]);
            console.log("✅ Permissões de EDIÇÃO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, apenas adiciona cargos novos
            const permEdSalvas = JSON.parse(permEd.valor);
            const permEdPadrao = JSON.parse(PERMISSOES_EDICAO_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permEdPadrao)) {
                if (!permEdSalvas[cargo]) {
                    permEdSalvas[cargo] = permEdPadrao[cargo];
                    atualizado = true;
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_edicao'", [JSON.stringify(permEdSalvas)]);
                console.log("✅ Permissões de EDIÇÃO: novos cargos adicionados.");
            }
        }

        console.log("✅ Banco pronto com permissões atualizadas!");
    } catch (e) { console.error("Erro inicializar:", e); }
};

// Função para obter data/hora no timezone de Brasília (America/Sao_Paulo)
function obterDataHoraBrasilia() {
    const agora = new Date();
    return agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function obterDataBrasilia() {
    const agora = new Date();
    const dataBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const ano = dataBrasilia.getFullYear();
    const mes = String(dataBrasilia.getMonth() + 1).padStart(2, '0');
    const dia = String(dataBrasilia.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Função auxiliar para registrar logs (DEVE estar antes dos endpoints que a usam)
async function registrarLog(acao, usuario, alvoId = null, alvoTipo = null, valorAntigo = null, valorNovo = null, detalhes = null) {
    try {
        console.log(`📋 [registrarLog] Ação: ${acao} | Usuário: ${usuario} | Alvo: ${alvoTipo}#${alvoId}`);
        const data_hora = obterDataHoraBrasilia();
        await dbRun(
            "INSERT INTO logs (acao, usuario, alvo_id, alvo_tipo, valor_antigo, valor_novo, detalhes, data_hora) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [acao, usuario, alvoId, alvoTipo, valorAntigo, valorNovo, detalhes, data_hora]
        );
        console.log(`✅ [registrarLog] Log registrado com sucesso`);
    } catch (e) {
        console.error("❌ [registrarLog] Erro ao registrar log:", e);
    }
}

// NOTA: PUT /usuarios/:id completo está mais abaixo com authMiddleware + authorize
// Esta rota (cargo apenas) foi migrada para a versão protegida

app.put('/usuarios/:id/avatar', authMiddleware, async (req, res) => {
    const { avatarUrl } = req.body;
    // Usuário só pode alterar o próprio avatar, ou Coordenador altera qualquer um
    if (req.user.id !== Number(req.params.id) && req.user.cargo !== 'Coordenador') {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    try {
        await dbRun("UPDATE usuarios SET avatarUrl = ? WHERE id = ?", [avatarUrl, req.params.id]);
        io.emit('receber_atualizacao', { tipo: 'avatar_mudou', userId: Number(req.params.id), newUrl: avatarUrl });
        res.json({ success: true });
    } catch (e) {
        console.error("Erro avatar:", e);
        res.status(500).json({ success: false });
    }
});

// ==================== MARCAÇÃO DE PLACAS ====================

// Gestão de tokens (links de motorista)
app.get('/api/tokens', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM tokens_motoristas ORDER BY data_criacao DESC");
        res.json({ success: true, tokens: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/tokens', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        let telefone = (req.body.telefone || '').replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
        if (telefone.length < 12 || telefone.length > 13) {
            return res.status(400).json({ success: false, message: 'Telefone inválido.' });
        }
        // Bloqueia se já existe token ativo para este número
        const ativo = await dbGet(
            "SELECT id FROM tokens_motoristas WHERE telefone = ? AND status = 'ativo'",
            [telefone]
        );
        if (ativo) {
            return res.status(400).json({ success: false, message: 'Já existe um link ativo para este número. Inative-o antes de gerar um novo.' });
        }
        const token = require('crypto').randomUUID();
        const expiracao = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        const result = await dbRun(
            "INSERT INTO tokens_motoristas (telefone, token, data_expiracao) VALUES (?, ?, ?)",
            [telefone, token, expiracao]
        );
        const novo = await dbGet("SELECT * FROM tokens_motoristas WHERE id = ?", [result.lastID]);
        res.json({ success: true, token: novo });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/tokens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM tokens_motoristas WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/tokens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { status, telefone } = req.body;
        if (status) {
            await dbRun("UPDATE tokens_motoristas SET status = ? WHERE id = ?", [status, req.params.id]);
        }
        if (telefone) {
            let tel = telefone.replace(/\D/g, '');
            if (!tel.startsWith('55')) tel = '55' + tel;
            await dbRun("UPDATE tokens_motoristas SET telefone = ? WHERE id = ?", [tel, req.params.id]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Validação pública do token (sem auth — chamada pelo form do motorista)
app.get('/api/marcacoes/validar/:token', async (req, res) => {
    try {
        const row = await dbGet(
            "SELECT id, telefone, status, data_expiracao FROM tokens_motoristas WHERE token = ?",
            [req.params.token]
        );
        if (!row) {
            return res.status(403).json({ success: false, message: 'Link inválido.' });
        }
        if (row.status === 'utilizado') {
            return res.status(403).json({ success: false, message: 'Este link já foi utilizado.' });
        }
        if (row.status !== 'ativo') {
            return res.status(403).json({ success: false, message: 'Link inativo.' });
        }
        if (row.data_expiracao && new Date() > new Date(row.data_expiracao)) {
            // Marca como inativo para não precisar recalcular nas próximas tentativas
            await dbRun("UPDATE tokens_motoristas SET status = 'inativo' WHERE id = ?", [row.id]);
            return res.status(403).json({ success: false, message: 'Link expirado. Solicite um novo link ao operador.' });
        }
        res.json({ success: true, telefone: row.telefone, tokenId: row.id });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Submissão pública do formulário (sem auth) — UPSERT por telefone
app.post('/api/marcacoes', async (req, res) => {
    try {
        const {
            token_id, nome_motorista, telefone, placa1, placa2,
            tipo_veiculo, altura, largura, comprimento,
            estados_destino, estado_origem, ja_carregou,
            rastreador, status_rastreador, latitude, longitude,
            disponibilidade, comprovante_pdf,
            anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros
        } = req.body;

        if (!nome_motorista || !telefone || !placa1 || !tipo_veiculo) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
        }

        const estadosJson = JSON.stringify(estados_destino || []);
        const agora = new Date().toISOString();

        // Verifica se já existe registro com este telefone
        const existente = await dbGet("SELECT id FROM marcacoes_placas WHERE telefone = ?", [telefone]);

        if (existente) {
            // UPDATE: atualiza dados e reseta SLA (data_marcacao) e status para DISPONIVEL
            await dbRun(
                `UPDATE marcacoes_placas SET
                    token_id=?, nome_motorista=?, placa1=?, placa2=?, tipo_veiculo=?,
                    altura=?, largura=?, comprimento=?, estados_destino=?, estado_origem=?,
                    ja_carregou=?, rastreador=?, status_rastreador=?, latitude=?, longitude=?,
                    disponibilidade=?, comprovante_pdf=?,
                    anexo_cnh=?, anexo_doc_veiculo=?, anexo_crlv_carreta=?, anexo_antt=?, anexo_outros=?,
                    data_marcacao=?, status_operacional='DISPONIVEL'
                WHERE telefone=?`,
                [
                    token_id, nome_motorista, placa1, placa2 || '',
                    tipo_veiculo, altura || null, largura || null, comprimento || null,
                    estadosJson, estado_origem || '',
                    ja_carregou || '', rastreador || 'Não possui', status_rastreador || 'Inativo',
                    latitude || '', longitude || '',
                    disponibilidade || '', comprovante_pdf || null,
                    anexo_cnh || null, anexo_doc_veiculo || null, anexo_crlv_carreta || null, anexo_antt || null, anexo_outros || null,
                    agora, telefone
                ]
            );
        } else {
            // INSERT novo registro
            await dbRun(
                `INSERT INTO marcacoes_placas
                 (token_id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                  altura, largura, comprimento, estados_destino, estado_origem,
                  ja_carregou, rastreador, status_rastreador, latitude, longitude,
                  disponibilidade, comprovante_pdf,
                  anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                  status_operacional)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DISPONIVEL')`,
                [
                    token_id, nome_motorista, telefone, placa1, placa2 || '',
                    tipo_veiculo, altura || null, largura || null, comprimento || null,
                    estadosJson, estado_origem || '',
                    ja_carregou || '', rastreador || 'Não possui', status_rastreador || 'Inativo',
                    latitude || '', longitude || '',
                    disponibilidade || '', comprovante_pdf || null,
                    anexo_cnh || null, anexo_doc_veiculo || null, anexo_crlv_carreta || null, anexo_antt || null, anexo_outros || null
                ]
            );
        }

        // Marca token como utilizado (uso único — burn after submit)
        if (token_id) {
            await dbRun("UPDATE tokens_motoristas SET status = 'utilizado' WHERE id = ?", [token_id]);
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Leitura de todas as marcações (autenticado)
app.get('/api/marcacoes', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll(
            "SELECT * FROM marcacoes_placas ORDER BY data_marcacao DESC"
        );
        const marcacoes = rows.map(r => ({
            ...r,
            estados_destino: JSON.parse(r.estados_destino || '[]')
        }));
        res.json({ success: true, marcacoes });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Motoristas disponíveis (status DISPONIVEL, últimos 7 dias)
app.get('/api/marcacoes/disponiveis', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   origem_cidade_uf, destino_desejado, disponibilidade, data_marcacao,
                   viagens_realizadas, status_operacional, is_frota,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   situacao_cad, num_liberacao_cad, data_liberacao_cad,
                   estados_destino, destino_uf_cad
            FROM marcacoes_placas
            WHERE data_marcacao >= datetime('now', '-7 days')
              AND (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
            ORDER BY data_marcacao DESC
        `);
        const motoristas = rows.map(r => ({
            ...r,
            telefone: r.telefone.replace(/\D/g, ''),
            estados_destino: (() => { try { return JSON.parse(r.estados_destino || '[]'); } catch { return []; } })()
        }));
        res.json({ success: true, motoristas });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/marcacoes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM marcacoes_placas WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT: Alterar Status de Disponibilidade (Fila) ────────────────
app.put('/api/marcacoes/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Disponível', 'Contratado', 'Indisponível'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        await dbRun("UPDATE marcacoes_placas SET disponibilidade = ? WHERE id = ?", [status, req.params.id]);
        io.emit('marcacao_atualizada');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Módulo Cadastro / Gerenciamento de Risco ─────────────────────────────────
app.get('/api/cadastro/motoristas', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   disponibilidade, data_marcacao,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   comprovante_pdf, anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                   origem_cad, destino_uf_cad, destino_cidade_cad
            FROM marcacoes_placas
            WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
            ORDER BY data_marcacao DESC
        `);
        res.json({ success: true, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cadastro/motoristas/:id', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const { chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad, seguradora_cad, num_liberacao_cad, origem_cad, destino_uf_cad, destino_cidade_cad, data_liberacao_manual } = req.body;
        const atual = await dbGet("SELECT num_liberacao_cad, data_liberacao_cad FROM marcacoes_placas WHERE id = ?", [req.params.id]);
        if (!atual) return res.status(404).json({ success: false, message: 'Motorista não encontrado.' });

        // Usar data manual informada pelo operador, ou calcular automaticamente
        const numMudou = (num_liberacao_cad || '') !== (atual.num_liberacao_cad || '');
        let novaDataLib = null;
        if (num_liberacao_cad) {
            if (data_liberacao_manual) {
                novaDataLib = new Date(data_liberacao_manual).toISOString();
            } else if (numMudou) {
                novaDataLib = new Date().toISOString();
            } else {
                novaDataLib = atual.data_liberacao_cad || new Date().toISOString();
            }
        }

        // Calcular situacao_cad automaticamente
        const todosChk = !!(chk_cnh_cad && chk_antt_cad && chk_tacografo_cad && chk_crlv_cad);
        const liberado = todosChk && !!seguradora_cad && !!num_liberacao_cad;
        const situacao = liberado ? 'LIBERADO'
            : (todosChk || seguradora_cad || num_liberacao_cad) ? 'PENDENTE'
                : 'NÃO CONFERIDO';

        await dbRun(
            `UPDATE marcacoes_placas SET
                chk_cnh_cad=?, chk_antt_cad=?, chk_tacografo_cad=?, chk_crlv_cad=?,
                seguradora_cad=?, num_liberacao_cad=?, data_liberacao_cad=?, situacao_cad=?,
                origem_cad=?, destino_uf_cad=?, destino_cidade_cad=?
             WHERE id=?`,
            [
                chk_cnh_cad ? 1 : 0,
                chk_antt_cad ? 1 : 0,
                chk_tacografo_cad ? 1 : 0,
                chk_crlv_cad ? 1 : 0,
                seguradora_cad || '',
                num_liberacao_cad || '',
                novaDataLib,
                situacao,
                origem_cad || '',
                destino_uf_cad || '',
                destino_cidade_cad || '',
                req.params.id
            ]
        );

        // Sincronizar situacao_cadastro + checks individuais na tabela veiculos e notificar em tempo real
        const marcacao = await dbGet(
            "SELECT telefone, placa1, placa2 FROM marcacoes_placas WHERE id = ?",
            [req.params.id]
        );
        if (marcacao?.telefone) {
            await dbRun(
                `UPDATE veiculos SET
                    situacao_cadastro=?, data_liberacao=?, numero_liberacao=?,
                    chk_cnh=?, chk_antt=?, chk_tacografo=?, chk_crlv=?
                 WHERE json_extract(dados_json, '$.telefoneMotorista') = ?`,
                [
                    situacao, novaDataLib, num_liberacao_cad || null,
                    chk_cnh_cad ? 1 : 0,
                    chk_antt_cad ? 1 : 0,
                    chk_tacografo_cad ? 1 : 0,
                    chk_crlv_cad ? 1 : 0,
                    marcacao.telefone
                ]
            );
            io.emit('cadastro_situacao_atualizada', {
                telefone: marcacao.telefone,
                placa1: marcacao.placa1 || null,
                placa2: marcacao.placa2 || null,
                situacao,
                data_liberacao: novaDataLib,
                numero_liberacao: num_liberacao_cad || null,
                chk_cnh: chk_cnh_cad ? 1 : 0,
                chk_antt: chk_antt_cad ? 1 : 0,
                chk_tacografo: chk_tacografo_cad ? 1 : 0,
                chk_crlv: chk_crlv_cad ? 1 : 0,
            });

            // Notificação direcionada por cargo
            const placaDesc = [marcacao.placa1, marcacao.placa2].filter(Boolean).join('/');
            io.emit('notificacao_direcionada', {
                mensagem: `Checklist de ${placaDesc} atualizado — ${situacao}`,
                situacao,
                cargos_alvo: ['Coordenador', 'Cadastro', 'Encarregado'],
            });
        }

        res.json({ success: true, situacao, data_liberacao_cad: novaDataLib });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Cadastro: motoristas já lançados na operação (tabela veiculos) ────────────
app.get('/api/cadastro/veiculos-em-operacao', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, motorista, dados_json,
                   chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                   situacao_cadastro, numero_liberacao, data_liberacao,
                   placa, operacao, unidade,
                   status_recife, status_moreno
            FROM veiculos
            WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO'))
              AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO'))
            ORDER BY id DESC
        `);
        const veiculos = rows.map(r => {
            const dj = (() => { try { return JSON.parse(r.dados_json || '{}'); } catch { return {}; } })();
            return {
                id: r.id,
                nome_motorista: r.motorista || 'A DEFINIR',
                placa1: dj.placa1Motorista || r.placa || '',
                placa2: dj.placa2Motorista || '',
                tipo_veiculo: dj.tipoVeiculo || '',
                telefone: dj.telefoneMotorista || '',
                operacao: r.operacao || '',
                unidade: r.unidade || '',
                // Mapear campos de veiculos para o esquema de marcacoes_placas usado pelo frontend
                chk_cnh_cad: r.chk_cnh ? 1 : 0,
                chk_antt_cad: r.chk_antt ? 1 : 0,
                chk_tacografo_cad: r.chk_tacografo ? 1 : 0,
                chk_crlv_cad: r.chk_crlv ? 1 : 0,
                situacao_cad: r.situacao_cadastro || 'NÃO CONFERIDO',
                num_liberacao_cad: r.numero_liberacao || '',
                data_liberacao_cad: r.data_liberacao || null,
                seguradora_cad: '',
                origem_cad: '',
                destino_uf_cad: '',
                destino_cidade_cad: '',
                _fonte: 'operacao',
            };
        });
        res.json({ success: true, veiculos });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cadastro/veiculos-em-operacao/:id', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const { chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad, num_liberacao_cad, data_liberacao_manual } = req.body;

        // Calcular situação automaticamente
        const todosChk = !!(chk_cnh_cad && chk_antt_cad && chk_tacografo_cad && chk_crlv_cad);
        const liberado = todosChk && !!num_liberacao_cad;
        const situacao = liberado ? 'LIBERADO'
            : (todosChk || num_liberacao_cad) ? 'PENDENTE'
                : 'NÃO CONFERIDO';

        const atual = await dbGet("SELECT numero_liberacao, data_liberacao, dados_json FROM veiculos WHERE id = ?", [req.params.id]);
        if (!atual) return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });

        // Usar data manual informada pelo operador, ou calcular automaticamente
        const numMudou = (num_liberacao_cad || '') !== (atual.numero_liberacao || '');
        let novaDataLib = null;
        if (num_liberacao_cad) {
            if (data_liberacao_manual) {
                novaDataLib = new Date(data_liberacao_manual).toISOString();
            } else if (numMudou) {
                novaDataLib = new Date().toISOString();
            } else {
                novaDataLib = atual.data_liberacao || new Date().toISOString();
            }
        }

        await dbRun(
            `UPDATE veiculos SET
                chk_cnh=?, chk_antt=?, chk_tacografo=?, chk_crlv=?,
                numero_liberacao=?, situacao_cadastro=?, data_liberacao=?
             WHERE id=?`,
            [
                chk_cnh_cad ? 1 : 0,
                chk_antt_cad ? 1 : 0,
                chk_tacografo_cad ? 1 : 0,
                chk_crlv_cad ? 1 : 0,
                num_liberacao_cad || null,
                situacao,
                novaDataLib,
                req.params.id
            ]
        );

        // Emitir socket + sincronizar em marcacoes_placas
        const dj = (() => { try { return JSON.parse(atual.dados_json || '{}'); } catch { return {}; } })();
        io.emit('cadastro_situacao_atualizada', {
            veiculoId: Number(req.params.id),
            telefone: dj.telefoneMotorista || null,
            situacao,
            data_liberacao: novaDataLib,
            numero_liberacao: num_liberacao_cad || null,
            chk_cnh: chk_cnh_cad ? 1 : 0,
            chk_antt: chk_antt_cad ? 1 : 0,
            chk_tacografo: chk_tacografo_cad ? 1 : 0,
            chk_crlv: chk_crlv_cad ? 1 : 0,
        });
        if (dj.telefoneMotorista) {
            // Sincronizar de volta em marcacoes_placas (para manter consistência caso haja nova viagem)
            await dbRun(
                `UPDATE marcacoes_placas SET
                    chk_cnh_cad=?, chk_antt_cad=?, chk_tacografo_cad=?, chk_crlv_cad=?,
                    num_liberacao_cad=?, situacao_cad=?, data_liberacao_cad=?
                 WHERE telefone = ? OR REPLACE(REPLACE(telefone,'+55',''),' ','') = ?`,
                [
                    chk_cnh_cad ? 1 : 0, chk_antt_cad ? 1 : 0,
                    chk_tacografo_cad ? 1 : 0, chk_crlv_cad ? 1 : 0,
                    num_liberacao_cad || null, situacao, novaDataLib,
                    dj.telefoneMotorista, dj.telefoneMotorista
                ]
            );
        }

        res.json({ success: true, situacao, data_liberacao_cad: novaDataLib });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ─────────────────────────────────────────────────────────────────────────────

// Cadastro direto de motorista da frota própria (sem token)
// Requer apenas nome e telefone — placas são vinculadas no despacho
app.post('/api/frota', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { nome_motorista, telefone } = req.body;
        if (!nome_motorista || !telefone)
            return res.status(400).json({ success: false, message: 'Nome e Telefone são obrigatórios.' });

        let tel = telefone.replace(/\D/g, '');
        if (!tel.startsWith('55')) tel = '55' + tel;

        const agora = new Date().toISOString();
        const existente = await dbGet("SELECT id FROM marcacoes_placas WHERE telefone = ?", [tel]);
        if (existente) {
            await dbRun(
                `UPDATE marcacoes_placas SET nome_motorista=?, is_frota=1,
                    status_operacional='DISPONIVEL', data_marcacao=?
                 WHERE telefone=?`,
                [nome_motorista, agora, tel]
            );
        } else {
            await dbRun(
                `INSERT INTO marcacoes_placas (nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                    is_frota, status_operacional, estados_destino)
                 VALUES (?,?,'','','',1,'DISPONIVEL','[]')`,
                [nome_motorista, tel]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== FIM MARCAÇÃO DE PLACAS ====================

app.get('/fila', authMiddleware, async (req, res) => { try { const rows = await dbAll("SELECT * FROM fila"); const fila = rows.map(row => ({ id: row.id, ...JSON.parse(row.dados_json) })); res.json({ success: true, fila }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/fila', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => { try { const item = req.body; const result = await dbRun(`INSERT INTO fila (dados_json) VALUES (?)`, [JSON.stringify(item)]); const novo = { id: result.lastID, ...item }; io.emit('receber_atualizacao', { tipo: 'novo_fila', dados: novo }); res.json({ success: true, id: result.lastID }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/fila/:id', authMiddleware, async (req, res) => { try { await dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(req.body), req.params.id]); io.emit('receber_atualizacao', { tipo: 'atualiza_fila', id: Number(req.params.id), ...req.body }); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/fila/reordenar', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const { ordem } = req.body; // [{ id, coleta, motorista }, ...]
        if (!Array.isArray(ordem)) return res.status(400).json({ success: false });
        await Promise.all(ordem.map(item => dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(item), item.id])));
        io.emit('receber_atualizacao', { tipo: 'reordenar_fila', ordem });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.delete('/fila/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => { try { await dbRun("DELETE FROM fila WHERE id = ?", [req.params.id]); io.emit('receber_atualizacao', { tipo: 'remove_fila', id: Number(req.params.id) }); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });

app.get('/notificacoes', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM notificacoes ORDER BY id DESC");
        const lista = (rows || []).map(row => {
            try {
                return { idInterno: row.id, ...JSON.parse(row.dados_json) };
            } catch (err) {
                return { idInterno: row.id, mensagem: "Erro ao processar notificação" };
            }
        });
        res.json({ success: true, notificacoes: lista });
    } catch (e) {
        console.error("Erro na rota /notificacoes:", e);
        res.json({ success: true, notificacoes: [] }); // Retorna sucesso vazio para não quebrar o front
    }
});
app.delete('/notificacoes/:id', authMiddleware, async (req, res) => { try { await dbRun("DELETE FROM notificacoes WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });

// --- ROTAS DE CT-E ATIVOS ---

// Listar todos os CT-es ativos
app.get('/ctes', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM ctes_ativos ORDER BY id ASC");
        const lista = rows.map(row => {
            try {
                return { ...JSON.parse(row.dados_json), id: row.id, origem: row.origem, status: row.status };
            } catch (_) {
                return { id: row.id, origem: row.origem, status: row.status };
            }
        });
        res.json({ success: true, ctes: lista });
    } catch (e) {
        console.error("Erro ao carregar CT-es ativos:", e);
        res.json({ success: true, ctes: [] });
    }
});

// Criar novo CT-e ativo
app.post('/ctes', authMiddleware, async (req, res) => {
    try {
        const { origem, dados } = req.body;
        const status = dados.status || 'Aguardando Emissão';
        const result = await dbRun(
            `INSERT INTO ctes_ativos (origem, status, dados_json) VALUES (?, ?, ?)`,
            [origem, status, JSON.stringify(dados)]
        );
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        console.error("Erro ao criar CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Atualizar CT-e ativo
app.put('/ctes/:id', authMiddleware, async (req, res) => {
    try {
        const { dados } = req.body;
        const status = dados.status || 'Aguardando Emissão';
        await dbRun(
            `UPDATE ctes_ativos SET status = ?, dados_json = ? WHERE id = ?`,
            [status, JSON.stringify(dados), req.params.id]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao atualizar CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Remover CT-e ativo (apos arquivar no historico)
app.delete('/ctes/:id', authMiddleware, async (req, res) => {
    try {
        await dbRun("DELETE FROM ctes_ativos WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao remover CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});
// --- ROTAS DE CHECKLIST DA CARRETA ---
app.get('/api/checklists', authMiddleware, async (req, res) => {
    try {
        const checklists = await dbAll("SELECT * FROM checklists_carreta ORDER BY id DESC");
        // Cast sqlite integers back to booleans
        const formatted = checklists.map(c => ({
            ...c,
            placa_confere: c.placa_confere === 1
        }));
        res.json({ success: true, checklists: formatted });
    } catch (e) {
        console.error('Erro ao listar checklists:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/checklists', authMiddleware, async (req, res) => {
    try {
        const { veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome } = req.body;

        const created_at = new Date().toISOString();
        const result = await dbRun(
            `INSERT INTO checklists_carreta (veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, 'PENDENTE']
        );

        // Emite alerta para Coordenador aprovar via socket
        io.emit('receber_alerta', {
            tipo: 'checklist_pendente',
            mensagem: `Novo checklist aguardando aprovação: ${placa_carreta}`
        });

        res.json({ success: true, id: result.lastID });
    } catch (e) {
        console.error('Erro ao criar checklist:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/checklists/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { status } = req.body; // 'APROVADO' ou 'RECUSADO'
        if (!['APROVADO', 'RECUSADO'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        await dbRun("UPDATE checklists_carreta SET status = ? WHERE id = ?", [status, req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao atualizar checklist:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- ROTAS DE CUBAGEM ---

app.get('/cubagens', authMiddleware, async (req, res) => {
    try {
        const cubagens = await dbAll("SELECT * FROM cubagens ORDER BY data_criacao DESC");
        if (cubagens.length === 0) return res.json({ success: true, cubagens: [] });

        const ids = cubagens.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        const todosItens = await dbAll(`SELECT * FROM cubagem_itens WHERE cubagem_id IN (${placeholders})`, ids);

        const itensPorCubagem = {};
        for (const item of todosItens) {
            if (!itensPorCubagem[item.cubagem_id]) itensPorCubagem[item.cubagem_id] = [];
            itensPorCubagem[item.cubagem_id].push(item);
        }
        for (const c of cubagens) c.itens = itensPorCubagem[c.id] || [];

        res.json({ success: true, cubagens });
    } catch (e) {
        console.error('Erro ao listar cubagens:', e);
        res.status(500).json({ success: false });
    }
});

app.get('/cubagens/coleta/:numero', authMiddleware, async (req, res) => {
    try {
        const cubagem = await dbGet("SELECT * FROM cubagens WHERE numero_coleta = ?", [req.params.numero]);
        if (cubagem) {
            cubagem.itens = await dbAll("SELECT * FROM cubagem_itens WHERE cubagem_id = ?", [cubagem.id]);
        }
        res.json({ success: true, cubagem });
    } catch (e) {
        console.error('Erro ao buscar cubagem por coleta:', e);
        res.status(500).json({ success: false });
    }
});

app.post('/cubagens', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), validate(cubagemSchema), async (req, res) => {
    try {
        const { numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, itens, metragem_total, valor_mix_total, valor_kit_total } = req.body;

        const result = await dbRun(
            `INSERT INTO cubagens (numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, metragem_total, valor_mix_total, valor_kit_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0]
        );

        const cubagemId = result.lastID;

        // Inserir itens na tabela separada
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

        res.json({ success: true, id: cubagemId });
    } catch (e) {
        console.error('Erro ao salvar cubagem:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/cubagens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), validate(cubagemSchema), async (req, res) => {
    try {
        const { numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, itens, metragem_total, valor_mix_total, valor_kit_total } = req.body;
        const id = req.params.id;

        await dbRun(
            `UPDATE cubagens SET numero_coleta=?, motorista=?, cliente=?, redespacho=?, nome_redespacho=?, destino=?, volume=?, data=?, faturado=?, tipo=?, metragem_total=?, valor_mix_total=?, valor_kit_total=? WHERE id=?`,
            [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0, id]
        );

        // Recriar itens
        await dbRun("DELETE FROM cubagem_itens WHERE cubagem_id = ?", [id]);
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

        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao atualizar cubagem:', e);
        res.status(500).json({ success: false });
    }
});

app.delete('/cubagens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM cubagem_itens WHERE cubagem_id = ?", [req.params.id]);
        await dbRun("DELETE FROM cubagens WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});
app.get('/veiculos', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 200;
        const offset = (page - 1) * limit;

        const [rows, countRow] = await Promise.all([
            dbAll("SELECT * FROM veiculos ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset]),
            dbAll("SELECT COUNT(*) as total FROM veiculos")
        ]);

        const total = countRow[0]?.total || 0;
        const veiculos = rows.map(row => {
            let dados_json = {};
            try {
                dados_json = JSON.parse(row.dados_json || '{}');
            } catch (e) { }

            return {
                id: row.id,
                placa: row.placa,
                modelo: row.modelo,
                motorista: row.motorista,
                status_recife: row.status_recife, status_moreno: row.status_moreno,
                doca_recife: row.doca_recife, doca_moreno: row.doca_moreno,
                coleta: row.coleta, coletaRecife: row.coletaRecife, coletaMoreno: row.coletaMoreno,
                rotaRecife: row.rota_recife,
                rotaMoreno: row.rota_moreno,
                unidade: row.unidade, operacao: row.operacao,
                inicio_rota: row.inicio_rota, origem_criacao: row.origem_criacao,
                data_prevista: row.data_prevista,
                tempos_recife: JSON.parse(row.tempos_recife || '{}'),
                tempos_moreno: JSON.parse(row.tempos_moreno || '{}'),
                status_coleta: JSON.parse(row.status_coleta || '{}'),
                observacao: row.observacao || '',
                imagens: JSON.parse(row.imagens || '[]'),
                chk_cnh: row.chk_cnh ? 1 : 0,
                chk_antt: row.chk_antt ? 1 : 0,
                chk_tacografo: row.chk_tacografo ? 1 : 0,
                chk_crlv: row.chk_crlv ? 1 : 0,
                situacao_cadastro: row.situacao_cadastro || 'NÃO CONFERIDO',
                numero_liberacao: row.numero_liberacao || '',
                data_liberacao: row.data_liberacao || null,
                tipoVeiculo: dados_json.tipoVeiculo || '',
                placa1Motorista: dados_json.placa1Motorista || '',
                placa2Motorista: dados_json.placa2Motorista || '',
                telefoneMotorista: dados_json.telefoneMotorista || '',
                dados_json: row.dados_json || '{}'
            };
        });
        res.json({ success: true, veiculos, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.post('/veiculos', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), validate(novoLancamentoSchema), async (req, res) => {
    try {
        const v = req.body;
        const data_criacao = obterDataHoraBrasilia();

        // Herdar dados de checklist/liberação do cadastro do motorista do frontend como fallback, 
        // mas tentar buscar o mais atualizado pelo telefone, se existir
        let chk_cnh = v.chk_cnh ? 1 : 0, chk_antt = v.chk_antt ? 1 : 0, chk_tacografo = v.chk_tacografo ? 1 : 0, chk_crlv = v.chk_crlv ? 1 : 0;
        let situacao_cadastro = v.situacao_cadastro || 'NÃO CONFERIDO', numero_liberacao = v.numero_liberacao || null, data_liberacao = v.data_liberacao || null;
        const telefoneMotorista = v.telefoneMotorista ? v.telefoneMotorista.replace(/\D/g, '') : null;
        const placaAlvo = (v.placa1Motorista || '').trim();
        const motoristaNome = (v.motorista || '').trim();

        if (telefoneMotorista || placaAlvo || motoristaNome) {
            const cad = await dbGet(
                `SELECT chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                        situacao_cad, num_liberacao_cad, data_liberacao_cad
                 FROM marcacoes_placas
                 WHERE (telefone IS NOT NULL AND (REPLACE(REPLACE(REPLACE(telefone,' ',''),'-',''),'+','') LIKE '%' || ? || '%' OR telefone = ?))
                    OR (placa1 IS NOT NULL AND placa1 = ?)
                    OR (nome_motorista IS NOT NULL AND nome_motorista LIKE ?)
                 ORDER BY data_marcacao DESC LIMIT 1`,
                [telefoneMotorista || '999999999', telefoneMotorista || '999999999', placaAlvo, `%${motoristaNome}%`]
            );
            if (cad) {
                chk_cnh = cad.chk_cnh_cad ? 1 : 0;
                chk_antt = cad.chk_antt_cad ? 1 : 0;
                chk_tacografo = cad.chk_tacografo_cad ? 1 : 0;
                chk_crlv = cad.chk_crlv_cad ? 1 : 0;
                situacao_cadastro = cad.situacao_cad || 'NÃO CONFERIDO';
                numero_liberacao = cad.num_liberacao_cad || null;
                data_liberacao = cad.data_liberacao_cad || null;
            }
        }

        const query = `INSERT INTO veiculos (
            placa, modelo, motorista, status_recife, status_moreno,
            doca_recife, doca_moreno, coleta, coletaRecife, coletaMoreno,
            rota_recife, rota_moreno, numero_coleta,
            unidade, operacao, inicio_rota, origem_criacao, data_prevista,
            data_criacao, tempos_recife, tempos_moreno, status_coleta,
            observacao, imagens,
            chk_cnh, chk_antt, chk_tacografo, chk_crlv,
            situacao_cadastro, numero_liberacao, data_liberacao,
            dados_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            v.placa || 'NÃO INFORMADA', v.modelo, v.motorista, v.status_recife, v.status_moreno,
            v.doca_recife, v.doca_moreno, v.coleta, v.coletaRecife, v.coletaMoreno,
            v.rotaRecife || '', v.rotaMoreno || '', v.numero_coleta || '',
            v.unidade, v.operacao, v.inicio_rota, v.origem_criacao, v.data_prevista,
            data_criacao,
            JSON.stringify(v.tempos_recife || {}),
            JSON.stringify(v.tempos_moreno || {}),
            JSON.stringify(v.status_coleta || {}),
            v.observacao || '',
            JSON.stringify(v.imagens || []),
            chk_cnh, chk_antt, chk_tacografo, chk_crlv,
            situacao_cadastro, numero_liberacao, data_liberacao,
            JSON.stringify({
                ...v,
                chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                situacao_cadastro, numero_liberacao, data_liberacao
            })
        ];

        const result = await dbRun(query, values);
        const novo = {
            id: result.lastID, ...v, data_criacao,
            chk_cnh, chk_antt, chk_tacografo, chk_crlv,
            situacao_cadastro, numero_liberacao, data_liberacao,
            dados_json: JSON.stringify({
                ...v,
                chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                situacao_cadastro, numero_liberacao, data_liberacao
            })
        };

        // Registrar log de criação
        await registrarLog(
            'CRIAÇÃO',
            req.user.nome,
            result.lastID,
            'veiculo',
            null,
            null,
            `Coleta: ${v.coleta || v.coletaRecife || v.coletaMoreno || 'N/A'} | Operação: ${v.operacao} | Motorista: ${v.motorista || 'A definir'}`
        );

        io.emit('receber_atualizacao', { tipo: 'novo_veiculo', dados: novo });
        res.json({ success: true, id: result.lastID });
    } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});
app.put('/veiculos/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const v = req.body;

        // Buscar dados antigos para auditoria
        const veiculoAntigo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [req.params.id]);

        // ── Trava de Segurança: bloquear qualquer avanço além de EM SEPARAÇÃO sem liberação ──
        const STATUS_BLOQUEADOS = ['LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e'];
        if (veiculoAntigo) {
            const dadosAntigos = (() => { try { return JSON.parse(veiculoAntigo.dados_json || '{}'); } catch { return {}; } })();
            const situacao = dadosAntigos.situacao_cadastro || veiculoAntigo.situacao_cadastro || 'NÃO CONFERIDO';

            const avancoRecife =
                STATUS_BLOQUEADOS.includes(v.status_recife) &&
                !STATUS_BLOQUEADOS.includes(veiculoAntigo.status_recife);
            const avancoMoreno =
                STATUS_BLOQUEADOS.includes(v.status_moreno) &&
                !STATUS_BLOQUEADOS.includes(veiculoAntigo.status_moreno);

            if ((avancoRecife || avancoMoreno) && situacao !== 'LIBERADO') {
                return res.status(403).json({
                    success: false,
                    message: 'Checklist incompleto. Conclua a liberação no Cadastro antes de avançar o status.'
                });
            }
            // Trava de expiração 24h (só valida ao avançar para EM CARREGAMENTO)
            const mudouParaCarregamentoRecife =
                v.status_recife === 'EM CARREGAMENTO' &&
                veiculoAntigo.status_recife !== 'EM CARREGAMENTO';
            const mudouParaCarregamentoMoreno =
                v.status_moreno === 'EM CARREGAMENTO' &&
                veiculoAntigo.status_moreno !== 'EM CARREGAMENTO';
            if ((mudouParaCarregamentoRecife || mudouParaCarregamentoMoreno) && situacao === 'LIBERADO') {
                const dataLib = dadosAntigos.data_liberacao || veiculoAntigo.data_liberacao;
                if (dataLib) {
                    const dataLibStr = dataLib.endsWith('Z') ? dataLib : dataLib + 'Z';
                    if ((Date.now() - new Date(dataLibStr).getTime()) > 24 * 60 * 60 * 1000) {
                        return res.status(403).json({
                            success: false,
                            expired: true,
                            message: 'Liberação expirada (mais de 24h). Solicite renovação no Cadastro.'
                        });
                    }
                }
            }

            // ── Trava de Checklist da Carreta (Avanço após Liberado P/ Doca) ──
            const STATUS_CHECKLIST = ['EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e'];
            const avancoChecklistRecife = STATUS_CHECKLIST.includes(v.status_recife) && !STATUS_CHECKLIST.includes(veiculoAntigo.status_recife);
            const avancoChecklistMoreno = STATUS_CHECKLIST.includes(v.status_moreno) && !STATUS_CHECKLIST.includes(veiculoAntigo.status_moreno);

            if (avancoChecklistRecife || avancoChecklistMoreno) {
                const chk = await dbGet("SELECT status FROM checklists_carreta WHERE veiculo_id = ? ORDER BY id DESC LIMIT 1", [req.params.id]);
                if (!chk || chk.status !== 'APROVADO') {
                    return res.status(403).json({
                        success: false,
                        message: 'Status bloqueado: Checklist da carreta pendente ou recusado.'
                    });
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Lógica de visibilidade: limpar campos de unidades que não fazem mais parte da operação
        const op = v.operacao || '';
        const precisaRecife = op.includes('RECIFE');
        const precisaMoreno = op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');

        if (!precisaRecife) {
            v.coletaRecife = '';
            v.rotaRecife = '';
            v.status_recife = 'AGUARDANDO';
            v.doca_recife = 'SELECIONE';
        }
        if (!precisaMoreno) {
            v.coletaMoreno = '';
            v.rotaMoreno = '';
            v.status_moreno = 'AGUARDANDO';
            v.doca_moreno = 'SELECIONE';
        }

        // ── Gatilhos automáticos de tempo ──────────────────────────────────────
        // Registrar o horário atual (Recife/Brasília) na primeira transição de cada fase
        {
            const agora = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife'
            });
            const setIfNull = (obj, campo, valor) => { if (!obj[campo]) obj[campo] = valor; };

            const tr = v.tempos_recife && typeof v.tempos_recife === 'object' ? { ...v.tempos_recife } : {};
            const tm = v.tempos_moreno && typeof v.tempos_moreno === 'object' ? { ...v.tempos_moreno } : {};

            const srAntigo = veiculoAntigo ? veiculoAntigo.status_recife : null;
            const smAntigo = veiculoAntigo ? veiculoAntigo.status_moreno : null;

            if (v.status_recife !== srAntigo) {
                if (v.status_recife === 'EM SEPARAÇÃO') setIfNull(tr, 't_inicio_separacao', agora);
                if (v.status_recife === 'EM CARREGAMENTO') setIfNull(tr, 't_inicio_carregamento', agora);
                if (v.status_recife === 'CARREGADO') tr.t_inicio_carregado = agora;
                if (v.status_recife === 'LIBERADO P/ CT-e') tr.t_fim_liberado_cte = agora;
            }
            if (v.status_moreno !== smAntigo) {
                if (v.status_moreno === 'EM SEPARAÇÃO') setIfNull(tm, 't_inicio_separacao', agora);
                if (v.status_moreno === 'EM CARREGAMENTO') setIfNull(tm, 't_inicio_carregamento', agora);
                if (v.status_moreno === 'CARREGADO') tm.t_inicio_carregado = agora;
                if (v.status_moreno === 'LIBERADO P/ CT-e') tm.t_fim_liberado_cte = agora;
            }

            v.tempos_recife = tr;
            v.tempos_moreno = tm;
        }
        // ───────────────────────────────────────────────────────────────────────

        const query = `UPDATE veiculos SET
            placa=?, modelo=?, motorista=?, status_recife=?, status_moreno=?,
            doca_recife=?, doca_moreno=?, coleta=?, coletaRecife=?, coletaMoreno=?, numero_coleta=?,
            rota_recife=?, rota_moreno=?,
            operacao=?, inicio_rota=?, origem_criacao=?,
            data_prevista=?, tempos_recife=?, tempos_moreno=?, status_coleta=?,
            observacao=?, imagens=?, numero_cte=?, chave_cte=?,
            chk_cnh=?, chk_antt=?, chk_tacografo=?, chk_crlv=?,
            gerenciadora_risco=?, status_gerenciadora=?, numero_liberacao=?, situacao_cadastro=?,
            data_liberacao=?,
            dados_json=?
            WHERE id = ?`;

        const values = [
            v.placa, v.modelo, v.motorista, v.status_recife, v.status_moreno,
            v.doca_recife, v.doca_moreno, v.coleta, v.coletaRecife, v.coletaMoreno, v.numero_coleta || '',
            v.rotaRecife || '', v.rotaMoreno || '',
            v.operacao || '', v.inicio_rota || '', v.origem_criacao || '',
            v.data_prevista,
            JSON.stringify(v.tempos_recife || {}),
            JSON.stringify(v.tempos_moreno || {}),
            JSON.stringify(v.status_coleta || {}),
            v.observacao || '',
            JSON.stringify(v.imagens || []),
            v.numero_cte || '',
            v.chave_cte || '',
            v.chk_cnh ? 1 : 0,
            v.chk_antt ? 1 : 0,
            v.chk_tacografo ? 1 : 0,
            v.chk_crlv ? 1 : 0,
            v.gerenciadora_risco || '',
            v.status_gerenciadora || '',
            v.numero_liberacao || '',
            v.situacao_cadastro || 'NÃO CONFERIDO',
            // Preservar data_liberacao: atualizar só quando numero_liberacao é preenchido pela primeira vez
            (() => {
                const anterior = veiculoAntigo?.data_liberacao || null;
                if (v.numero_liberacao && !anterior) return new Date().toISOString();
                return v.data_liberacao || anterior;
            })(),
            JSON.stringify(v),
            req.params.id
        ];

        await dbRun(query, values);

        // Registrar logs de alterações
        if (veiculoAntigo) {
            const mudancas = [];

            // Verificar mudanças de status (mais importante)
            if (veiculoAntigo.status_recife !== v.status_recife) {
                mudancas.push(`Status RECIFE: ${veiculoAntigo.status_recife} → ${v.status_recife}`);

                // Se mudou para "LIBERADO P/ CT-e", marcar como fluxo CT-e
                const ehFluxoCte = v.status_recife === 'LIBERADO P/ CT-e';
                await registrarLog(
                    ehFluxoCte ? 'FLUXO_CTE' : 'MUDANÇA DE STATUS',
                    req.user.nome,
                    req.params.id,
                    'veiculo',
                    veiculoAntigo.status_recife,
                    v.status_recife,
                    `[RECIFE] ${veiculoAntigo.status_recife} → ${v.status_recife} | Placa: ${v.placa}${ehFluxoCte ? ' | Card aguardando emissão de CT-e' : ''}`
                );
            }
            if (veiculoAntigo.status_moreno !== v.status_moreno) {
                mudancas.push(`Status MORENO: ${veiculoAntigo.status_moreno} → ${v.status_moreno}`);

                // Se mudou para "LIBERADO P/ CT-e", marcar como fluxo CT-e
                const ehFluxoCte = v.status_moreno === 'LIBERADO P/ CT-e';
                await registrarLog(
                    ehFluxoCte ? 'FLUXO_CTE' : 'MUDANÇA DE STATUS',
                    req.user.nome,
                    req.params.id,
                    'veiculo',
                    veiculoAntigo.status_moreno,
                    v.status_moreno,
                    `[MORENO] ${veiculoAntigo.status_moreno} → ${v.status_moreno} | Placa: ${v.placa}${ehFluxoCte ? ' | Card aguardando emissão de CT-e' : ''}`
                );
            }

            // Verificar mudanças em campos importantes
            if (veiculoAntigo.motorista !== v.motorista) {
                mudancas.push(`Motorista: ${veiculoAntigo.motorista || 'N/A'} → ${v.motorista || 'N/A'}`);
            }
            if (veiculoAntigo.doca_recife !== v.doca_recife) {
                mudancas.push(`Doca RECIFE: ${veiculoAntigo.doca_recife} → ${v.doca_recife}`);
            }
            if (veiculoAntigo.doca_moreno !== v.doca_moreno) {
                mudancas.push(`Doca MORENO: ${veiculoAntigo.doca_moreno} → ${v.doca_moreno}`);
            }
            if (veiculoAntigo.numero_coleta !== (v.numero_coleta || '')) {
                mudancas.push(`Nº Coleta: ${veiculoAntigo.numero_coleta || 'N/A'} → ${v.numero_coleta || 'N/A'}`);
            }
            if (veiculoAntigo.data_prevista !== v.data_prevista) {
                mudancas.push(`Data Prevista: ${veiculoAntigo.data_prevista} → ${v.data_prevista}`);
            }

            // Verificar mudanças nos dados fiscais de CT-e
            if (veiculoAntigo.numero_cte !== (v.numero_cte || '')) {
                const antigoNum = veiculoAntigo.numero_cte || '';
                const novoNum = v.numero_cte || '';
                if (!antigoNum && novoNum) {
                    // Inserção de número CT-e
                    await registrarLog(
                        'DADOS_FISCAIS_CTE',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        null,
                        novoNum,
                        `CT-e Nº ${novoNum} vinculado ao Card | Placa: ${v.placa}`
                    );
                    mudancas.push(`CT-e Nº ${novoNum} vinculado`);
                } else if (antigoNum !== novoNum) {
                    // Alteração de número CT-e
                    await registrarLog(
                        'DADOS_FISCAIS_CTE',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        antigoNum,
                        novoNum,
                        `CT-e alterado: ${antigoNum} → ${novoNum} | Placa: ${v.placa}`
                    );
                    mudancas.push(`CT-e: ${antigoNum} → ${novoNum}`);
                }
            }

            if (veiculoAntigo.chave_cte !== (v.chave_cte || '')) {
                const antigaChave = veiculoAntigo.chave_cte || '';
                const novaChave = v.chave_cte || '';
                if (!antigaChave && novaChave) {
                    // Inserção de chave de acesso
                    await registrarLog(
                        'DADOS_FISCAIS_CTE',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        null,
                        novaChave,
                        `Chave de Acesso vinculada ao Card | Placa: ${v.placa} | Chave: ${novaChave.substring(0, 15)}...`
                    );
                    mudancas.push(`Chave de Acesso vinculada`);
                } else if (antigaChave !== novaChave) {
                    // Alteração de chave
                    mudancas.push(`Chave CT-e alterada`);
                }
            }

            // Verificar cubagem (campo em dados_json)
            const dadosAntigosJson = veiculoAntigo.dados_json ? JSON.parse(veiculoAntigo.dados_json) : {};
            const cubagem_antiga = dadosAntigosJson.cubagem || {};
            const cubagem_nova = v.cubagem || {};

            if (JSON.stringify(cubagem_antiga) !== JSON.stringify(cubagem_nova)) {
                mudancas.push(`Cubagem alterada`);
            }

            // Registrar edição geral para mudanças que não sejam exclusivamente de status
            const mudancasNaoStatus = mudancas.filter(m => !m.includes('Status'));
            if (mudancasNaoStatus.length > 0) {
                await registrarLog(
                    'EDIÇÃO',
                    req.user.nome,
                    req.params.id,
                    'veiculo',
                    JSON.stringify(veiculoAntigo),
                    JSON.stringify(v),
                    mudancasNaoStatus.join(' | ')
                );
            }
        }

        io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(req.params.id), ...v });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.delete('/veiculos/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        console.log(`🗑️ [DELETE] Tentando excluir veículo ID: ${req.params.id}`);

        // Buscar dados do veículo antes de excluir para auditoria
        const veiculoExcluido = await dbGet("SELECT * FROM veiculos WHERE id = ?", [req.params.id]);

        if (!veiculoExcluido) {
            console.log(`⚠️ Veículo ID ${req.params.id} não encontrado no banco`);
            return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
        }

        let identificador = 'Desconhecida';
        try {
            const dados = JSON.parse(veiculoExcluido.dados_json || '{}');
            identificador = dados.placa1Motorista || dados.placa || veiculoExcluido.motorista || 'Sem Placa';
        } catch (e) { }

        console.log(`✅ Veículo encontrado: Placa ${identificador}`);

        // Deletar do banco
        await dbRun("DELETE FROM veiculos WHERE id = ?", [req.params.id]);
        console.log(`✅ Veículo deletado do banco`);

        // Registrar log de exclusão
        console.log(`📝 Registrando log de exclusão - Usuário: ${req.user.nome}`);
        await registrarLog(
            'EXCLUSÃO',
            req.user.nome,
            req.params.id,
            'veiculo',
            JSON.stringify(veiculoExcluido),
            null,
            `Placa: ${veiculoExcluido.placa} | Coleta: ${veiculoExcluido.coleta || veiculoExcluido.coletaRecife || veiculoExcluido.coletaMoreno || 'N/A'} | Operação: ${veiculoExcluido.operacao}`
        );
        console.log(`✅ Log de exclusão registrado com sucesso`);

        io.emit('receber_atualizacao', { tipo: 'remove_veiculo', id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) {
        console.error(`❌ Erro ao deletar veículo:`, e);
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/login', validate(loginSchema), async (req, res) => {
    const { nome, senha } = req.body;
    let emailLogin = nome.trim().toLowerCase();
    if (!emailLogin.includes('@')) emailLogin = `${emailLogin}@tnetlog.com.br`;

    try {
        const usuario = await dbGet("SELECT * FROM usuarios WHERE email = ?", [emailLogin]);

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Verificar senha com bcrypt
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Gerar token JWT
        const token = generateToken(usuario);

        // Preparar dados do usuário (sem senha)
        const usuarioSemSenha = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            cidade: usuario.cidade,
            cargo: usuario.cargo,
            avatarUrl: usuario.avatarUrl,
            permissoesAcesso: usuario.permissoesAcesso ? JSON.parse(usuario.permissoesAcesso) : [],
            permissoesEdicao: usuario.permissoesEdicao ? JSON.parse(usuario.permissoesEdicao) : []
        };

        res.json({
            success: true,
            usuario: usuarioSemSenha,
            token
        });
    } catch (e) {
        console.error('Erro no login:', e);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});
app.get('/usuarios', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM usuarios");
        const usuarios = rows.map(u => ({
            ...u,
            permissoesAcesso: JSON.parse(u.permissoesAcesso || '[]'),
            permissoesEdicao: JSON.parse(u.permissoesEdicao || '[]')
        }));
        res.json({ success: true, usuarios });
    } catch (e) {
        console.error("Erro ao buscar usuarios:", e);
        res.status(500).json({ success: false });
    }
});
app.post('/usuarios', authMiddleware, authorize(['Coordenador']), validate(cadastroUsuarioSchema), async (req, res) => {
    const { nome, email, senha, cidade, cargo } = req.body;

    try {
        const usuarioExistente = await dbGet("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (usuarioExistente) {
            return res.status(400).json({ success: false, message: "Este email já está em uso!" });
        }

        // Hash da senha com bcrypt (pula se já vier hashada da solicitação)
        const hashedPassword = senha.startsWith('$2b$') || senha.startsWith('$2a$')
            ? senha
            : await bcrypt.hash(senha, 10);

        await dbRun("INSERT INTO usuarios (nome, email, senha, cidade, cargo) VALUES (?, ?, ?, ?, ?)",
            [nome, email, hashedPassword, cidade, cargo]);

        res.json({ success: true, message: "Usuário criado com sucesso!" });
    } catch (e) {
        console.error("Erro ao criar usuário:", e);
        res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
});
app.put('/usuarios/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    const { usaPermissaoIndividual, permissoesAcesso, permissoesEdicao, cargo, cidade, nome } = req.body;
    try {
        // Buscar dados atuais para não sobrescrever campos não enviados
        const usuarioAtual = await dbGet("SELECT * FROM usuarios WHERE id=?", [req.params.id]);
        if (!usuarioAtual) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

        // Apenas Coordenador pode alterar cargo
        const cargoFinal = req.user.cargo === 'Coordenador' ? (cargo ?? usuarioAtual.cargo) : usuarioAtual.cargo;

        await dbRun(
            `UPDATE usuarios SET usaPermissaoIndividual=?, permissoesAcesso=?, permissoesEdicao=?, cargo=?, cidade=?, nome=? WHERE id=?`,
            [
                usaPermissaoIndividual !== undefined ? (usaPermissaoIndividual ? 1 : 0) : usuarioAtual.usaPermissaoIndividual,
                JSON.stringify(permissoesAcesso ?? JSON.parse(usuarioAtual.permissoesAcesso || '[]')),
                JSON.stringify(permissoesEdicao ?? JSON.parse(usuarioAtual.permissoesEdicao || '[]')),
                cargoFinal,
                cidade ?? usuarioAtual.cidade,
                nome ?? usuarioAtual.nome,
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao atualizar usuário:", e);
        res.status(500).json({ success: false });
    }
});
app.delete('/usuarios/:id', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        await dbRun("DELETE FROM usuarios WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao deletar usuário:", e);
        res.status(500).json({ success: false });
    }
});
app.get('/configuracoes', authMiddleware, async (req, res) => { try { const a = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_acesso'"); const b = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_edicao'"); res.json({ success: true, acesso: JSON.parse(a.valor), edicao: JSON.parse(b.valor) }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/configuracoes', authMiddleware, authorize(['Coordenador']), async (req, res) => { const { acesso, edicao } = req.body; if (acesso) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_acesso'", [JSON.stringify(acesso)]); if (edicao) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_edicao'", [JSON.stringify(edicao)]); io.emit('receber_alerta', { tipo: 'admin_config_mudou', mensagem: 'Permissões atualizadas' }); res.json({ success: true }); });
app.get('/solicitacoes', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => { try { const s = await dbAll("SELECT * FROM solicitacoes"); res.json({ success: true, solicitacoes: s }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/solicitacoes', async (req, res) => { const { nome, emailPrefix, unidade, senha } = req.body; const senhaHash = await bcrypt.hash(senha || '123456', 10); await dbRun("INSERT INTO solicitacoes (tipo, nome, email, unidade, senha, data_criacao) VALUES (?,?,?,?,?,?)", ['CADASTRO', nome, emailPrefix + '@tnetlog.com.br', unidade, senhaHash, obterDataHoraBrasilia()]); io.emit('receber_alerta', { tipo: 'admin_cadastro', mensagem: `Novo cadastro: ${nome}` }); res.json({ success: true }); });
app.delete('/solicitacoes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => { await dbRun("DELETE FROM solicitacoes WHERE id=?", [req.params.id]); res.json({ success: true }); });
app.get('/relatorios', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => { const rows = await dbAll("SELECT dados_json FROM historico"); res.json({ historico: rows.map(r => JSON.parse(r.dados_json)) }); });
app.post('/historico_cte', authMiddleware, async (req, res) => { await dbRun("INSERT INTO historico_cte (dados_json) VALUES (?)", [JSON.stringify(req.body)]); res.json({ success: true }); });
app.get('/relatorios_cte', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Conhecimento']), async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        const rows = await dbAll("SELECT dados_json FROM historico_cte ORDER BY rowid DESC");
        let registros = rows.map(r => { try { return JSON.parse(r.dados_json); } catch (_) { return null; } }).filter(Boolean);
        if (dataInicio) registros = registros.filter(r => r.data_registro >= dataInicio);
        if (dataFim) registros = registros.filter(r => r.data_registro <= dataFim);
        res.json({ success: true, registros });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Endpoint para atualizar status de CT-e com auditoria
app.put('/cte/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Conhecimento']), async (req, res) => {
    try {
        const { cteId, statusAntigo, statusNovo, origem, coleta } = req.body;

        // Registrar mudança de status do CT-e
        let acao = 'STATUS_CTE';
        let detalhes = `[${origem}] ${statusAntigo} → ${statusNovo} | Coleta: ${coleta}`;

        // Identificar tipo específico de transição
        if (statusNovo === 'Em Emissão' && statusAntigo === 'Aguardando Emissão') {
            acao = 'EMISSAO_CTE';
            detalhes = `CT-e iniciou emissão | ${detalhes}`;
        } else if (statusNovo === 'Emitido') {
            acao = 'EMISSAO_CTE';
            detalhes = `CT-e finalizado e emitido | ${detalhes}`;

            // Buscar motorista do card para incrementar viagens e marcar EM VIAGEM
            try {
                // cteId pode ser o id do veículo ou uma string do CT-e — busca pelo id direto
                const veiculo = await dbGet("SELECT motorista FROM veiculos WHERE id = ?", [cteId]);
                if (veiculo && veiculo.motorista) {
                    // Busca marcação pelo nome do motorista (pode não ter telefone direto no card)
                    // Tenta também por telefone herdado no card (campo telefoneMotorista gravado no dados_json)
                    const dadosVeiculo = await dbGet("SELECT dados_json FROM veiculos WHERE id = ?", [cteId]);
                    let telefoneMotorista = null;
                    if (dadosVeiculo && dadosVeiculo.dados_json) {
                        try {
                            const dj = JSON.parse(dadosVeiculo.dados_json);
                            telefoneMotorista = dj.telefoneMotorista || null;
                        } catch (_) { }
                    }
                    if (telefoneMotorista) {
                        await dbRun(
                            `UPDATE marcacoes_placas
                             SET viagens_realizadas = viagens_realizadas + 1,
                                 status_operacional = 'EM VIAGEM',
                                 situacao_cad = 'ARQUIVADO',
                                 chk_cnh_cad = 0, chk_antt_cad = 0, chk_tacografo_cad = 0, chk_crlv_cad = 0,
                                 seguradora_cad = '', num_liberacao_cad = '', data_liberacao_cad = NULL
                             WHERE telefone = ?`,
                            [telefoneMotorista]
                        );
                        console.log(`✅ Motorista ${veiculo.motorista} (tel: ${telefoneMotorista}): viagem registrada, status → EM VIAGEM, cadastro → ARQUIVADO`);
                    }
                }
            } catch (errViagem) {
                console.error('Erro ao incrementar viagem do motorista:', errViagem);
            }
        } else if (statusAntigo === 'Emitido' || statusAntigo === 'Em Emissão') {
            // Estorno/Cancelamento
            acao = 'ESTORNO_CTE';
            detalhes = `⚠️ CT-e retrocedido: ${statusAntigo} → ${statusNovo} | ${origem} | Coleta: ${coleta}`;
        }

        await registrarLog(
            acao,
            req.user.nome,
            cteId,
            'cte',
            statusAntigo,
            statusNovo,
            detalhes
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao registrar status CT-e:', e);
        res.status(500).json({ success: false });
    }
});

// Endpoint de Logs com Paginação
app.get('/logs', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Contar total de logs
        const countResult = await dbGet("SELECT COUNT(*) as total FROM logs");
        const totalLogs = countResult.total;

        // Buscar logs da página atual (ordenados do mais recente para o mais antigo)
        const logs = await dbAll(
            "SELECT id, acao, usuario, alvo_id, alvo_tipo, valor_antigo, valor_novo, detalhes, datetime(data_hora, 'localtime') as data_hora FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        res.json({
            success: true,
            logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalLogs / limit),
                totalLogs,
                limit
            }
        });
    } catch (e) {
        console.error("Erro ao buscar logs:", e);
        res.status(500).json({ success: false, message: 'Erro ao buscar logs' });
    }
});

// Endpoint para criar um novo log
app.post('/logs', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { acao, alvoId, alvoTipo, valorAntigo, valorNovo, detalhes } = req.body;
        const usuario = req.user.nome;

        await registrarLog(acao, usuario, alvoId, alvoTipo, valorAntigo, valorNovo, detalhes);

        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao criar log:", e);
        res.status(500).json({ success: false, message: 'Erro ao criar log' });
    }
});

// ============================================================
// MÓDULO DE FROTA E TELEMETRIA
// ============================================================

// Utilitário: verifica se é fim de semana e se motorista tem plantão
function verificarBloqueioFimDeSemana(modePlantao) {
    const diasemana = new Date().getDay(); // 0=Dom, 6=Sáb
    if (diasemana === 0 || diasemana === 6) {
        if (!modePlantao) {
            return diasemana === 6 ? 'SABADO' : 'DOMINGO';
        }
    }
    return null; // sem bloqueio
}

// ── Motoristas ───────────────────────────────────────────────
app.get('/api/frota/motoristas', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll(`SELECT id, nome, cpf, celular, modo_plantao FROM frota_motoristas ORDER BY nome`);
        res.json({ success: true, motoristas: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/frota/motoristas', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { nome, cpf, celular, senha } = req.body;
        if (!nome || !cpf) return res.status(400).json({ success: false, message: 'Nome e CPF são obrigatórios.' });
        const cpfLimpo = cpf.replace(/\D/g, '');
        const senhaHash = senha ? await bcrypt.hash(senha, 10) : null;
        const result = await dbRun(
            `INSERT INTO frota_motoristas (nome, cpf, celular, senha) VALUES (?, ?, ?, ?)`,
            [nome.trim(), cpfLimpo, celular?.trim() || null, senhaHash]
        );
        await registrarLog('FROTA_MOTORISTA_CADASTRO', req.user.nome, result.lastID, 'frota_motorista', null, nome.trim(), `CPF: ${cpfLimpo}`);
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'CPF já cadastrado.' });
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/frota/motoristas/:id', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        const mot = await dbGet(`SELECT nome, cpf FROM frota_motoristas WHERE id = ?`, [req.params.id]);
        await dbRun(`DELETE FROM frota_motoristas WHERE id = ?`, [req.params.id]);
        await registrarLog('FROTA_MOTORISTA_EXCLUSAO', req.user.nome, req.params.id, 'frota_motorista', mot?.nome, null, `CPF: ${mot?.cpf}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Toggle modo_plantao
app.patch('/api/frota/motoristas/:id/plantao', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const row = await dbGet(`SELECT nome, modo_plantao FROM frota_motoristas WHERE id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({ success: false, message: 'Motorista não encontrado.' });
        const novoValor = row.modo_plantao ? 0 : 1;
        await dbRun(`UPDATE frota_motoristas SET modo_plantao = ? WHERE id = ?`, [novoValor, req.params.id]);
        await registrarLog('FROTA_PLANTAO_TOGGLE', req.user.nome, req.params.id, 'frota_motorista', row.modo_plantao ? 'PLANTÃO' : 'NORMAL', novoValor ? 'PLANTÃO' : 'NORMAL', `Motorista: ${row.nome}`);
        res.json({ success: true, modo_plantao: novoValor });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Veículos ─────────────────────────────────────────────────
app.get('/api/frota/veiculos', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll(`SELECT id, placa, tipo, modelo FROM frota_veiculos ORDER BY placa`);
        res.json({ success: true, veiculos: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/frota/veiculos', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { placa, tipo, modelo } = req.body;
        if (!placa || !tipo) return res.status(400).json({ success: false, message: 'Placa e tipo são obrigatórios.' });
        const placaFmt = placa.toUpperCase().trim();
        const result = await dbRun(
            `INSERT INTO frota_veiculos (placa, tipo, modelo) VALUES (?, ?, ?)`,
            [placaFmt, tipo.trim(), modelo?.trim() || null]
        );
        await registrarLog('FROTA_VEICULO_CADASTRO', req.user.nome, result.lastID, 'frota_veiculo', null, placaFmt, `Tipo: ${tipo} | Modelo: ${modelo || '—'}`);
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'Placa já cadastrada.' });
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/frota/veiculos/:id', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        const vei = await dbGet(`SELECT placa, tipo FROM frota_veiculos WHERE id = ?`, [req.params.id]);
        await dbRun(`DELETE FROM frota_veiculos WHERE id = ?`, [req.params.id]);
        await registrarLog('FROTA_VEICULO_EXCLUSAO', req.user.nome, req.params.id, 'frota_veiculo', vei?.placa, null, `Tipo: ${vei?.tipo}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Despacho (cria ou atualiza viagem ativa) ─────────────────
app.post('/api/frota/despacho', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { motorista_id, cavalo_id, carreta_id } = req.body;
        if (!motorista_id) return res.status(400).json({ success: false, message: 'motorista_id é obrigatório.' });

        const motorista = await dbGet(`SELECT modo_plantao FROM frota_motoristas WHERE id = ?`, [motorista_id]);
        if (!motorista) return res.status(404).json({ success: false, message: 'Motorista não encontrado.' });

        const bloqueio = verificarBloqueioFimDeSemana(motorista.modo_plantao);
        const statusInicial = bloqueio || 'DISPONÍVEL';

        // Verifica se já existe viagem ativa para este motorista
        const viagemExistente = await dbGet(`SELECT id, status_atual FROM frota_viagens_ativas WHERE motorista_id = ?`, [motorista_id]);
        if (viagemExistente) {
            // Em edição preserva o status atual (não reseta para DISPONÍVEL)
            const statusPreservado = bloqueio || viagemExistente.status_atual;
            await dbRun(
                `UPDATE frota_viagens_ativas SET cavalo_id = ?, carreta_id = ?, status_atual = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE motorista_id = ?`,
                [cavalo_id || null, carreta_id || null, statusPreservado, motorista_id]
            );
            const mot = await dbGet(`SELECT nome FROM frota_motoristas WHERE id = ?`, [motorista_id]);
            const cav = cavalo_id ? await dbGet(`SELECT placa FROM frota_veiculos WHERE id = ?`, [cavalo_id]) : null;
            const carr = carreta_id ? await dbGet(`SELECT placa FROM frota_veiculos WHERE id = ?`, [carreta_id]) : null;
            await registrarLog('FROTA_CONJUNTO_EDICAO', req.user.nome, viagemExistente.id, 'frota_viagem', null, null, `Motorista: ${mot?.nome} | Cavalo: ${cav?.placa || '—'} | Carreta: ${carr?.placa || '—'}`);
            res.json({ success: true, id: viagemExistente.id, status: statusPreservado });
        } else {
            const result = await dbRun(
                `INSERT INTO frota_viagens_ativas (motorista_id, cavalo_id, carreta_id, status_atual) VALUES (?, ?, ?, ?)`,
                [motorista_id, cavalo_id || null, carreta_id || null, statusInicial]
            );
            const mot = await dbGet(`SELECT nome FROM frota_motoristas WHERE id = ?`, [motorista_id]);
            const cav = cavalo_id ? await dbGet(`SELECT placa FROM frota_veiculos WHERE id = ?`, [cavalo_id]) : null;
            const carr = carreta_id ? await dbGet(`SELECT placa FROM frota_veiculos WHERE id = ?`, [carreta_id]) : null;
            await registrarLog('FROTA_DESPACHO', req.user.nome, result.lastID, 'frota_viagem', null, null, `Motorista: ${mot?.nome} | Cavalo: ${cav?.placa || '—'} | Carreta: ${carr?.placa || '—'}`);
            res.json({ success: true, id: result.lastID, status: statusInicial });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Desvincular conjunto (remove viagem ativa pelo id) ──
app.delete('/api/frota/despacho/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const viagem = await dbGet(
            `SELECT va.id, m.nome AS motorista_nome, c.placa AS cavalo_placa, r.placa AS carreta_placa
             FROM frota_viagens_ativas va
             JOIN frota_motoristas m ON va.motorista_id = m.id
             LEFT JOIN frota_veiculos c ON va.cavalo_id = c.id
             LEFT JOIN frota_veiculos r ON va.carreta_id = r.id
             WHERE va.id = ?`, [req.params.id]
        );
        await dbRun(`DELETE FROM frota_viagens_ativas WHERE id = ?`, [req.params.id]);
        await registrarLog('FROTA_DESVINCULAR', req.user.nome, req.params.id, 'frota_viagem', null, null, `Motorista: ${viagem?.motorista_nome} | Cavalo: ${viagem?.cavalo_placa || '—'} | Carreta: ${viagem?.carreta_placa || '—'}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Login do Motorista (sem JWT — via CPF) ───────────────────
app.post('/api/frota/login', async (req, res) => {
    try {
        const { cpf, senha } = req.body;
        if (!cpf || !senha) return res.status(400).json({ success: false, message: 'CPF e senha são obrigatórios.' });
        const cpfLimpo = cpf.replace(/\D/g, '');
        const mot = await dbGet(`SELECT * FROM frota_motoristas WHERE REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','') = ?`, [cpfLimpo]);
        if (!mot) return res.status(404).json({ success: false, message: 'Motorista não encontrado.' });

        // Primeiro acesso: senha nula → gravar definitivamente
        if (!mot.senha) {
            const hash = await bcrypt.hash(senha, 10);
            await dbRun(`UPDATE frota_motoristas SET senha = ? WHERE id = ?`, [hash, mot.id]);
            await registrarLog('FROTA_MOTORISTA_PRIMEIRO_ACESSO', mot.nome, mot.id, 'frota_motorista', null, null, `CPF: ${mot.cpf}`);
            return res.json({ success: true, motorista: { id: mot.id, nome: mot.nome, cpf: mot.cpf, celular: mot.celular, modo_plantao: mot.modo_plantao }, primeiroAcesso: true });
        }

        const ok = await bcrypt.compare(senha, mot.senha);
        if (!ok) return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        await registrarLog('FROTA_MOTORISTA_LOGIN', mot.nome, mot.id, 'frota_motorista', null, null, `CPF: ${mot.cpf}`);
        res.json({ success: true, motorista: { id: mot.id, nome: mot.nome, cpf: mot.cpf, celular: mot.celular, modo_plantao: mot.modo_plantao }, primeiroAcesso: false });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Minha viagem (dados do conjunto vinculado) ───────────────
app.get('/api/frota/minha-viagem/:motoristaId', async (req, res) => {
    try {
        const row = await dbGet(`
            SELECT va.id, va.status_atual, va.ultima_lat_lng, va.data_atualizacao,
                   va.previsao_disponibilidade,
                   m.nome AS motorista_nome, m.modo_plantao,
                   c.placa AS cavalo_placa, c.tipo AS cavalo_tipo, c.modelo AS cavalo_modelo,
                   r.placa AS carreta_placa, r.tipo AS carreta_tipo
            FROM frota_viagens_ativas va
            JOIN frota_motoristas m ON va.motorista_id = m.id
            LEFT JOIN frota_veiculos c ON va.cavalo_id = c.id
            LEFT JOIN frota_veiculos r ON va.carreta_id = r.id
            WHERE va.motorista_id = ?
        `, [req.params.motoristaId]);
        if (!row) return res.status(404).json({ success: false, message: 'Nenhuma viagem ativa para este motorista.' });
        res.json({ success: true, viagem: row });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Atualizar status + GPS ────────────────────────────────────
app.put('/api/frota/status', async (req, res) => {
    try {
        const { motorista_id, novo_status, ultima_lat_lng } = req.body;
        if (!motorista_id || !novo_status) return res.status(400).json({ success: false, message: 'motorista_id e novo_status são obrigatórios.' });
        const motorista = await dbGet(`SELECT nome, modo_plantao FROM frota_motoristas WHERE id = ?`, [motorista_id]);
        if (!motorista) return res.status(404).json({ success: false, message: 'Motorista não encontrado.' });
        const bloqueio = verificarBloqueioFimDeSemana(motorista.modo_plantao);
        const statusFinal = bloqueio || novo_status;
        const latLngFinal = ultima_lat_lng || null;
        await dbRun(
            `UPDATE frota_viagens_ativas SET status_atual = ?, ultima_lat_lng = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE motorista_id = ?`,
            [statusFinal, latLngFinal, motorista_id]
        );
        const viagem = await dbGet(
            `SELECT c.placa AS cavalo_placa, r.placa AS carreta_placa
             FROM frota_viagens_ativas va
             LEFT JOIN frota_veiculos c ON va.cavalo_id = c.id
             LEFT JOIN frota_veiculos r ON va.carreta_id = r.id
             WHERE va.motorista_id = ?`,
            [motorista_id]
        );
        const payload = {
            motorista_id,
            motorista_nome: motorista.nome,
            status: statusFinal,
            cavalo_placa: viagem?.cavalo_placa || null,
            carreta_placa: viagem?.carreta_placa || null,
            lat_lng: latLngFinal,
        };
        io.emit('frota_status_atualizado', payload);
        await registrarLog('FROTA_STATUS', motorista.nome, motorista_id, 'frota_motorista', null, statusFinal, latLngFinal ? `GPS: ${latLngFinal}` : 'GPS indisponível');
        res.json({ success: true, status: statusFinal, bloqueado: !!bloqueio });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Previsão de disponibilidade (informada pelo motorista) ───
app.put('/api/frota/previsao', async (req, res) => {
    try {
        const { motorista_id, previsao_disponibilidade } = req.body;
        if (!motorista_id) return res.status(400).json({ success: false, message: 'motorista_id é obrigatório.' });
        await dbRun(
            `UPDATE frota_viagens_ativas SET previsao_disponibilidade = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE motorista_id = ?`,
            [previsao_disponibilidade || null, motorista_id]
        );
        const motorista = await dbGet(`SELECT nome FROM frota_motoristas WHERE id = ?`, [motorista_id]);
        await registrarLog('FROTA_PREVISAO', motorista?.nome || motorista_id, motorista_id, 'frota_motorista', null, previsao_disponibilidade, null);
        io.emit('frota_previsao_atualizada', { motorista_id, previsao_disponibilidade: previsao_disponibilidade || null });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Registrar ocorrência com foto ────────────────────────────
app.post('/api/frota/ocorrencias', async (req, res) => {
    try {
        const { motorista_id, tipo, descricao, foto_base64 } = req.body;
        if (!motorista_id || !tipo) return res.status(400).json({ success: false, message: 'motorista_id e tipo são obrigatórios.' });
        const viagem = await dbGet(
            `SELECT va.id, m.nome AS motorista_nome, v.placa AS cavalo_placa FROM frota_viagens_ativas va JOIN frota_motoristas m ON va.motorista_id = m.id LEFT JOIN frota_veiculos v ON va.cavalo_id = v.id WHERE va.motorista_id = ?`,
            [motorista_id]
        );
        if (!viagem) return res.status(404).json({ success: false, message: 'Nenhuma viagem ativa para este motorista.' });
        const result = await dbRun(
            `INSERT INTO frota_ocorrencias (viagem_id, tipo, descricao, foto_base64) VALUES (?, ?, ?, ?)`,
            [viagem.id, tipo, descricao || null, foto_base64 || null]
        );
        io.emit('frota_nova_ocorrencia', { viagem_id: viagem.id, tipo, motorista_id, motorista_nome: viagem.motorista_nome, cavalo_placa: viagem.cavalo_placa || null });
        await registrarLog('FROTA_OCORRENCIA', viagem.motorista_nome, viagem.id, 'frota_viagem', null, tipo, descricao || null);
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Checklist da carreta (motorista envia) ───────────────────
app.post('/api/frota/checklist', async (req, res) => {
    try {
        const { motorista_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura } = req.body;
        if (!motorista_id || !placa_carreta || !assinatura) {
            return res.status(400).json({ success: false, message: 'motorista_id, placa_carreta e assinatura são obrigatórios.' });
        }
        const created_at = obterDataHoraBrasilia();
        const result = await dbRun(
            `INSERT INTO frota_checklists (motorista_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [motorista_id, motorista_nome || null, placa_carreta, placa_confere ? 1 : 0, condicao_bau || null, cordas || 0, foto_vazamento || null, assinatura, created_at]
        );
        io.emit('frota_novo_checklist', { motorista_id, motorista_nome, placa_carreta, placa_confere });
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Nova Rota de Checklist (Operacional / Doca) ───────────────────
app.post('/api/checklists', authMiddleware, async (req, res) => {
    try {
        const { veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome } = req.body;
        if (!veiculo_id || !placa_carreta || !assinatura) {
            return res.status(400).json({ success: false, message: 'Dados obrigatórios faltando.' });
        }
        const created_at = obterDataHoraBrasilia();
        const result = await dbRun(
            `INSERT INTO checklists_carreta (veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE')`,
            [veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0, condicao_bau || null, cordas || 0, foto_vazamento || null, assinatura, conferente_nome || null, created_at]
        );
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET: Checklists (Painel do Coordenador) ────────────────────
app.get('/api/checklists', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Aux. Operacional', 'Encarregado']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, veiculo_id, motorista_nome, placa_carreta, placa_confere,
                   condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome,
                   status, created_at
            FROM checklists_carreta
            ORDER BY created_at DESC
        `);
        res.json({ success: true, checklists: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── PUT: Aprovar/Reprovar Checklist ──────────────────────────────
app.put('/api/checklists/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['APROVADO', 'RECUSADO', 'PENDENTE'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        await dbRun("UPDATE checklists_carreta SET status = ? WHERE id = ?", [status, req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Checklists (Antigo/Legado) ────────────────────────
app.get('/api/frota/checklists', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (_req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, motorista_id, motorista_nome, placa_carreta, placa_confere,
                   condicao_bau, cordas, foto_vazamento, assinatura, created_at
            FROM frota_checklists
            ORDER BY created_at DESC
        `);
        res.json({ success: true, checklists: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Viagens ativas (listagem para painel) ────────────────────
app.get('/api/frota/viagens', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT va.id, va.motorista_id, va.status_atual, va.ultima_lat_lng, va.data_atualizacao,
                   va.previsao_disponibilidade,
                   m.nome AS motorista_nome, m.modo_plantao,
                   c.placa AS cavalo_placa, c.tipo AS cavalo_tipo,
                   r.placa AS carreta_placa, r.tipo AS carreta_tipo
            FROM frota_viagens_ativas va
            JOIN frota_motoristas m ON va.motorista_id = m.id
            LEFT JOIN frota_veiculos c ON va.cavalo_id = c.id
            LEFT JOIN frota_veiculos r ON va.carreta_id = r.id
            ORDER BY va.data_atualizacao DESC
        `);
        res.json({ success: true, viagens: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Socket.io
io.on('connection', (socket) => {
    socket.on('enviar_alerta', async (dados) => {
        try {
            const result = await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify(dados)]);
            const notificacaoFinal = { ...dados, idInterno: result.lastID };
            io.emit('receber_alerta', notificacaoFinal);
        } catch (e) { console.error("Erro ao salvar notificação:", e); }
    });
    socket.on('nova_atualizacao', (dados) => { io.emit('receber_atualizacao', dados); });
    socket.on('update_user_avatar', (dados) => { io.emit('receber_atualizacao', { tipo: 'avatar_mudou', ...dados }); });
});
// ── PROGRAMAÇÃO DIÁRIA (Cron Jobs) ──────────────────────────────
async function gerarProgramacaoDiaria(turno) {
    try {
        console.log(`[CRON] Iniciando Programação Diária - Turno: ${turno}`);
        const rows = await dbAll(`
            SELECT id, unidade, operacao, data_criacao, status_recife, status_moreno,
                   coletaRecife, coletaMoreno
            FROM veiculos
            WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
              AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
        `);

        // YYYY-MM-DD local
        const hojeStr = new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(',')[0];

        const totais = {
            Delta: { recife: 0, moreno: 0, reprogramado: 0 },
            Porcelana: { recife: 0, moreno: 0, reprogramado: 0 },
            Eletrik: { recife: 0, moreno: 0, reprogramado: 0 },
            Consolidados: { recife: 0, moreno: 0, reprogramado: 0 }
        };

        rows.forEach(v => {
            let cliente = 'Consolidados';
            const op = (v.operacao || '').toUpperCase();
            if (op.includes('DELTA')) cliente = 'Delta';
            else if (op.includes('PORCELANA')) cliente = 'Porcelana';
            else if (op.includes('ELETRIK')) cliente = 'Eletrik';

            const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';
            const dataC = typeof v.data_criacao === 'string' ? v.data_criacao.substring(0, 10) : '';

            // Se for anterior a hoje -> Reprogramado
            if (dataC && dataC < hojeStr) {
                totais[cliente].reprogramado += 1;
            } else {
                // Se for de hoje ou vazio
                totais[cliente][un] += 1;
            }
        });

        // Salvar no BD
        const dados_json = JSON.stringify(totais);
        await dbRun(
            "INSERT INTO frota_programacao_diaria (data_referencia, turno, dados_json) VALUES (?, ?, ?)",
            [hojeStr, turno, dados_json]
        );

        io.emit('programacao_gerada', { turno, data_referencia: hojeStr });
        console.log(`[CRON] Programação Diária (${turno}) concluída.`);
    } catch (e) {
        console.error(`[CRON] Erro ao gerar programação diária:`, e);
    }
}

// Rodar de seg a sex (1-5), às 10:00 e 17:00
cron.schedule('0 10 * * 1-5', () => gerarProgramacaoDiaria('10h'), { scheduled: true, timezone: "America/Sao_Paulo" });
cron.schedule('0 17 * * 1-5', () => gerarProgramacaoDiaria('17h'), { scheduled: true, timezone: "America/Sao_Paulo" });

// ── ROLLOVER AUTOMÁTICO DE DIA (Fecho do Dia) ─────────────────────────
// Roda todos os dias de semana (1-5) às 23:59 no horário de Brasília
cron.schedule('59 23 * * 1-5', async () => {
    try {
        console.log(`[CRON] Iniciando Rollover/Fecho Automático do Dia...`);
        // O rollover altera apenas a "data_prevista" para o próximo dia útil (hoje + 1 dia)
        // Apenas para veículos pendentes cujo status NÃO seja de saída
        // E que NÃO tenham status fiscal "Emitido"

        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const amanhaStr = amanha.toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(',')[0];

        // Atualiza a data_prevista apenas de quem não foi finalizado/não tem CTE Emitido
        const resultado = await new Promise((resolve, reject) => {
            const query = `
                UPDATE veiculos
                SET data_prevista = ?
                WHERE 
                    (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
                    AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
                    AND (
                        id NOT IN (
                            SELECT v.id FROM veiculos v WHERE v.status_cte = 'Emitido' 
                            OR v.dados_json LIKE '%"status_cte":"Emitido"%'
                        )
                    )
            `;
            db.run(query, [amanhaStr], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        console.log(`[CRON] Fecho do Dia concluído. ${resultado} veículos transferidos para ${amanhaStr}.`);
        io.emit('receber_atualizacao', { tipo: 'refresh_geral' }); // Força atualização dos painéis na virada
    } catch (e) {
        console.error(`[CRON] Erro ao processar Rollover Automático:`, e);
    }
}, { scheduled: true, timezone: "America/Sao_Paulo" });

// Rota GET para o front-end consultar o histórico
app.get('/api/programacao-diaria', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM frota_programacao_diaria ORDER BY id DESC LIMIT 50');
        const programas = rows.map(r => ({
            id: r.id,
            data_referencia: r.data_referencia,
            turno: r.turno,
            dados_json: (() => { try { return JSON.parse(r.dados_json || '{}'); } catch { return {}; } })()
        }));
        res.json({ success: true, programacoes: programas });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// ────────────────────────────────────────────────────────────

// Porta configurável via .env
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configurado via .env' : 'Usando chave padrão (MUDAR EM PRODUÇÃO!)'}\n`);
});