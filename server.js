// Carregar variáveis de ambiente ANTES de tudo
require('dotenv').config();

// Fuso horário global — garante que new Date() respeite Brasília
process.env.TZ = 'America/Sao_Paulo';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { authMiddleware, authorize, generateToken } = require('./middleware/authMiddleware');
const { validate, loginSchema, novoLancamentoSchema, cubagemSchema, cadastroUsuarioSchema } = require('./middleware/validationMiddleware');

// ── Logger seguro: suprime dados sensíveis em produção ────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';
const logger = {
    info: (...args) => { if (!IS_PROD) console.log(...args); },
    warn: (...args) => console.warn(...args),   // avisos sempre visíveis
    error: (...args) => console.error(...args), // erros sempre visíveis
    audit: (acao, alvo) => {                    // log de auditoria seguro (sem PII)
        console.log(`[AUDIT] ${acao} | alvo: ${alvo}`);
    }
};

const app = express();

// ── Trust proxy: necessário para rate limit funcionar atrás de Cloudflare/Nginx
app.set('trust proxy', 1);

// Mapeamento estático: tipo de notificação → cargos que a recebem
const DESTINATARIOS_NOTIFICACAO = {
    'aceite_cte_pendente': ['Conhecimento', 'Planejamento'],
    'veiculo_carregado':   ['Planejamento'],
    'admin_cadastro':      ['Coordenador'],
    'admin_senha':         ['Coordenador'],
    'nova_ocorrencia':     ['Pos Embarque'],
    'nova_marcacao':       ['Pos Embarque'],
    'nova_marcacao_coord': [],
    'aviso':               ['Planejamento', 'Encarregado', 'Aux. Operacional'],
};

// ── Segurança: headers HTTP ───────────────────────────────────────────────────
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://static.cloudflareinsights.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3001", "https://portal.tnethub.com.br", "https://cloudflareinsights.com", "https://static.cloudflareinsights.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            objectSrc: ["'none'"],
        },
    },
}));

// Permite acesso à API de Clipboard nos browsers sem solicitar permissão explícita
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'clipboard-write=(self), clipboard-read=(self)');
    next();
});

// ── Rate limiting: login (10 tentativas / 15 min por IP) ─────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

// ── Rate limiting: rotas públicas de marcação (30 req / 5 min por IP) ────────
const marcacaoPublicaLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Limite de requisições atingido. Aguarde alguns minutos.' }
});

// ── Rate limiting: solicitações de cadastro (5 por hora por IP) ──────────────
const solicitacoesLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas solicitações. Tente novamente em 1 hora.' }
});

// ── Rate limiting: reset de senha via token (5 tentativas / 15 min por IP) ───
const resetSenhaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }
});

// Aumenta o limite para aceitar imagens em Base64 grandes (cards inteiros com fotos pesadas HD)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '200mb';
app.use(bodyParser.json({ limit: MAX_FILE_SIZE }));
app.use(bodyParser.urlencoded({ limit: MAX_FILE_SIZE, extended: true }));

// ── CORS: restrito ao frontend (defina FRONTEND_URL no .env em produção) ─────
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }
});

const { dbRun, dbAll, dbGet, dbTransaction } = require('./src/database/db');
const { inicializarBanco } = require('./src/database/migrations');

// --- BANCO DE DADOS ---
inicializarBanco();

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

// Helper para enviar e persistir notificações
async function enviarNotificacao(evento, dados) {
    try {
        const result = await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify(dados)]);
        const notificacaoFinal = { ...dados, idInterno: result.lastID };
        io.emit(evento, notificacaoFinal);
        console.log(`🔔 [enviarNotificacao] Evento: ${evento} | ID: ${result.lastID}`);
        return notificacaoFinal;
    } catch (e) {
        console.error("❌ [enviarNotificacao] Erro ao persistir notificação:", e);
        // Fallback: emite sem persistir se o banco falhar
        io.emit(evento, dados);
    }
}

// ── Servir arquivos estáticos do Frontend em produção ─────────────────────
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'build')));
}

// Registrar rotas após io e registrarLog estarem definidos
const veiculosRouter = require('./src/routes/veiculos')(io, registrarLog);
app.use('/veiculos', veiculosRouter);
app.use('/', veiculosRouter);

const checklistsRouter = require('./src/routes/checklists')(io);
app.use('/', checklistsRouter);

const ocorrenciasRouter = require('./src/routes/ocorrencias')(registrarLog, io);
app.use('/', ocorrenciasRouter);

// Reset de senha por Coordenador (gera senha padrão "123" e força troca)
app.post('/usuarios/:id/reset-senha', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        const usuario = await dbGet("SELECT id, nome, email FROM usuarios WHERE id = ?", [req.params.id]);
        if (!usuario) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        const senhaTemp = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
        const hashedPassword = await bcrypt.hash(senhaTemp, 10);
        await dbRun("UPDATE usuarios SET senha = ? WHERE id = ?", [hashedPassword, req.params.id]);
        // [FIX-6] Não loga email em produção — apenas ID para auditoria
        logger.audit('RESET_SENHA', `ID:${req.params.id}`);
        res.json({ success: true, message: `Senha de ${usuario.nome} resetada.`, senhaTemp });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/usuarios/:id/avatar', authMiddleware, async (req, res) => {
    const { avatarUrl } = req.body;
    const userId = Number(req.params.id);

    // [FIX-5] Validar formato do avatarUrl: aceita apenas Base64 ou URL HTTPS
    if (avatarUrl) {
        const isBase64 = typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/');
        const isHttpsUrl = typeof avatarUrl === 'string' && /^https:\/\/.+/.test(avatarUrl);
        if (!isBase64 && !isHttpsUrl) {
            return res.status(400).json({ success: false, message: 'Formato de avatar inválido. Use Base64 ou URL HTTPS.' });
        }
        // Limite de tamanho para Base64 (previne DoS por upload gigante)
        if (isBase64 && avatarUrl.length > 5 * 1024 * 1024) { // 5MB
            return res.status(413).json({ success: false, message: 'Imagem muito grande. Máximo: 5MB.' });
        }
    }

    logger.info(`📸 [Avatar] Solicitado update para usuário ${userId}`);

    // Usuário só pode alterar o próprio avatar, ou Coordenador altera qualquer um
    if (req.user.id !== userId && req.user.cargo !== 'Coordenador') {
        logger.warn(`🚫 [Avatar] Acesso negado: usuário ${req.user.id} tentando alterar avatar de ${userId}`);
        return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    try {
        // No PostgreSQL, avatarUrl se torna avatarurl se não for citado
        await dbRun("UPDATE usuarios SET avatarUrl = ? WHERE id = ?", [avatarUrl, userId]);

        logger.audit('AVATAR_ATUALIZADO', `ID:${userId}`);

        io.emit('receber_atualizacao', {
            tipo: 'avatar_mudou',
            userId: userId,
            newUrl: avatarUrl
        });

        res.json({ success: true });
    } catch (e) {
        logger.error("❌ [Avatar] Erro ao salvar foto:", e);
        res.status(500).json({ success: false, message: 'Erro ao salvar foto no servidor' });
    }
});

// ==================== MARCAÇÃO DE PLACAS ====================

// Gestão de tokens (links de motorista)
app.get('/api/tokens', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM tokens_motoristas ORDER BY data_criacao DESC");
        res.json({ success: true, tokens: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/tokens', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        let telefone = (req.body.telefone || '').replace(/\D/g, '');
        if (telefone.length <= 11) telefone = '55' + telefone;
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
        const expiracao = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        const result = await dbRun(
            "INSERT INTO tokens_motoristas (telefone, token, data_expiracao) VALUES (?, ?, ?)",
            [telefone, token, expiracao]
        );
        const novo = await dbGet("SELECT * FROM tokens_motoristas WHERE id = ?", [result.lastID]);
        const criador = req.user?.nome || '?';
        await registrarLog('TOKEN_CRIADO', criador, result.lastID, 'token', null, null, `Token para tel ${telefone}`);
        io.emit('receber_alerta', { tipo: 'nova_marcacao', mensagem: `Link criado por ${criador}`, criador, data_criacao: new Date().toISOString() });
        io.emit('receber_alerta', { tipo: 'nova_marcacao_coord', mensagem: `${criador} criou um link de cadastro`, criador, data_criacao: new Date().toISOString() });
        io.emit('marcacao_atualizada', { tipo: 'token_criado' });
        res.json({ success: true, token: novo });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/tokens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        await dbRun("DELETE FROM tokens_motoristas WHERE id = ?", [req.params.id]);
        const criador = req.user?.nome || '?';
        await registrarLog('TOKEN_DELETADO', criador, req.params.id, 'token', null, null, null);
        io.emit('marcacao_atualizada', { tipo: 'token_deletado', id: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/tokens/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const { status, telefone } = req.body;
        if (status) {
            if (status === 'ativo') {
                const novaExpiracao = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
                await dbRun("UPDATE tokens_motoristas SET status = ?, data_expiracao = ? WHERE id = ?", [status, novaExpiracao, req.params.id]);
            } else {
                await dbRun("UPDATE tokens_motoristas SET status = ? WHERE id = ?", [status, req.params.id]);
            }
        }
        if (telefone) {
            let tel = telefone.replace(/\D/g, '');
            if (!tel.startsWith('55')) tel = '55' + tel;
            await dbRun("UPDATE tokens_motoristas SET telefone = ? WHERE id = ?", [tel, req.params.id]);
        }
        const criador = req.user?.nome || '?';
        await registrarLog('TOKEN_ATUALIZADO', criador, req.params.id, 'token', null, null, JSON.stringify(req.body));
        io.emit('marcacao_atualizada', { tipo: 'token_atualizado', id: req.params.id });
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
app.post('/api/marcacoes', marcacaoPublicaLimiter, async (req, res) => {
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

        const telefoneLimpo = telefone.replace(/\D/g, '');

        const estadosJson = JSON.stringify(estados_destino || []);
        const agora = obterDataHoraBrasilia();

        // Validar token antes de prosseguir — previne race condition de duplo envio
        if (token_id) {
            const tokenAtual = await dbGet("SELECT status FROM tokens_motoristas WHERE id = ?", [token_id]);
            if (!tokenAtual || tokenAtual.status === 'utilizado') {
                return res.status(409).json({ success: false, message: 'Este link já foi utilizado. Solicite um novo link ao operador.' });
            }
        }

        // ── Trava anti-duplicata por nome + dia ───────────────────────────────
        // Impede que o mesmo motorista se cadastre duas vezes no mesmo dia via links diferentes,
        // enquanto ainda está disponível/aguardando (antes de completar o ciclo e voltar).
        const nomeNormalizado = (nome_motorista || '').trim().toUpperCase();
        const duplicataNome = await dbGet(
            `SELECT id, status_operacional FROM marcacoes_placas
             WHERE UPPER(TRIM(nome_motorista)) = ?
               AND telefone != ?
               AND data_marcacao >= NOW() - INTERVAL '1 day'
               AND status_operacional NOT IN ('EM ROTA', 'FINALIZADO')`,
            [nomeNormalizado, telefoneLimpo]
        );
        if (duplicataNome) {
            // Marca token como utilizado mesmo assim (evita reenvio)
            if (token_id) {
                await dbRun("UPDATE tokens_motoristas SET status = 'utilizado' WHERE id = ?", [token_id]);
            }
            return res.status(409).json({
                success: false,
                message: 'Já existe uma marcação ativa para este motorista hoje. Aguarde o operador ou realize nova marcação pelo link mais recente.'
            });
        }
        // ─────────────────────────────────────────────────────────────────────

        // Verifica se já existe registro com este telefone
        const existente = await dbGet("SELECT id, disponibilidade FROM marcacoes_placas WHERE telefone = ?", [telefoneLimpo]);

        if (existente) {
            // Se estava Indisponível, revoga automaticamente para Disponível ao refazer marcação
            const novaDisponibilidade = (existente.disponibilidade === 'Indisponível') ? 'Disponível' : (disponibilidade || existente.disponibilidade || '');

            // UPDATE: atualiza dados e reseta SLA (data_marcacao) e status para DISPONIVEL
            await dbRun(
                `UPDATE marcacoes_placas SET
                    token_id=?, nome_motorista=?, placa1=?, placa2=?, tipo_veiculo=?,
                    altura=?, largura=?, comprimento=?, estados_destino=?, estado_origem=?,
                    ja_carregou=?, rastreador=?, status_rastreador=?, latitude=?, longitude=?,
                    disponibilidade=?, comprovante_pdf=?,
                    anexo_cnh=?, anexo_doc_veiculo=?, anexo_crlv_carreta=?, anexo_antt=?, anexo_outros=?,
                    data_marcacao=?, status_operacional='DISPONIVEL', data_contratacao=NULL,
                    chk_cnh_cad=0, chk_antt_cad=0, chk_tacografo_cad=0, chk_crlv_cad=0,
                    situacao_cad='PENDENTE', num_liberacao_cad=NULL, data_liberacao_cad=NULL
                WHERE telefone=?`,
                [
                    token_id, nome_motorista, placa1, placa2 || '',
                    tipo_veiculo, altura || null, largura || null, comprimento || null,
                    estadosJson, estado_origem || '',
                    ja_carregou || '', rastreador || 'Não possui', status_rastreador || 'Inativo',
                    latitude || '', longitude || '',
                    novaDisponibilidade, comprovante_pdf || null,
                    anexo_cnh || null, anexo_doc_veiculo || null, anexo_crlv_carreta || null, anexo_antt || null, anexo_outros || null,
                    agora, telefoneLimpo
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
                  status_operacional, data_contratacao)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DISPONIVEL',NULL)`,
                [
                    token_id, nome_motorista, telefoneLimpo, placa1, placa2 || '',
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

        const nomeMarcacao = nome_motorista || 'Motorista';
        await registrarLog('MARCACAO_CRIADA', nomeMarcacao, null, 'marcacao', null, null, `Placa: ${placa1}`);
        io.emit('receber_alerta', { tipo: 'nova_marcacao', mensagem: `${nomeMarcacao} marcou placa (${placa1})`, criador: nomeMarcacao, data_criacao: new Date().toISOString() });
        io.emit('receber_alerta', { tipo: 'nova_marcacao_coord', mensagem: `${nomeMarcacao} marcou placa`, criador: nomeMarcacao, data_criacao: new Date().toISOString() });
        io.emit('marcacao_atualizada', { tipo: 'nova_marcacao' });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Leitura de todas as marcações (autenticado)
app.get('/api/marcacoes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
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
app.get('/api/marcacoes/disponiveis', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const semFiltroUnidade = ['Coordenador', 'Planejamento', 'Encarregado'].includes(req.user.cargo);
        const cidade = req.user.cidade;
        const cidadeFilter = (!semFiltroUnidade && cidade)
            ? "AND (origem_cidade_uf ILIKE $1 OR origem_cidade_uf IS NULL OR origem_cidade_uf = '')"
            : '';
        const params = (!semFiltroUnidade && cidade) ? [`%${cidade}%`] : [];
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   origem_cidade_uf, destino_desejado, disponibilidade, data_marcacao, data_contratacao,
                   viagens_realizadas, status_operacional, is_frota,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   situacao_cad, num_liberacao_cad, data_liberacao_cad,
                   estados_destino, destino_uf_cad
            FROM marcacoes_placas
            WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL' OR is_frota = 1)
              ${cidadeFilter}
            ORDER BY is_frota DESC, data_marcacao DESC
        `, params);
        const motoristas = rows.map(r => ({
            ...r,
            telefone: r.telefone.replace(/\D/g, ''),
            estados_destino: (() => { try { return JSON.parse(r.estados_destino || '[]'); } catch { return []; } })()
        }));
        res.json({ success: true, motoristas });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/marcacoes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        await dbRun("DELETE FROM marcacoes_placas WHERE id = ?", [req.params.id]);
        const criador = req.user?.nome || '?';
        await registrarLog('MARCACAO_DELETADA', criador, req.params.id, 'marcacao', null, null, null);
        io.emit('receber_alerta', { tipo: 'nova_marcacao', mensagem: `Marcação removida por ${criador}`, criador, data_criacao: new Date().toISOString() });
        io.emit('marcacao_atualizada', { tipo: 'marcacao_removida', id: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT: Alterar Status de Disponibilidade (Fila) ────────────────
app.put('/api/marcacoes/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { status } = req.body;
        const statusValidos = ['Disponível', 'Contratado', 'Indisponível', 'EM CASA', 'NO PÁTIO', 'NO POSTO'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }

        const timestampDataContratacao = status === 'Contratado' ? obterDataHoraBrasilia() : null;

        await dbRun("UPDATE marcacoes_placas SET disponibilidade = ?, data_contratacao = COALESCE(data_contratacao, ?) WHERE id = ?", [status, timestampDataContratacao, req.params.id]);

        // Se mudou para disponível, zera a data de contratação
        if (status === 'Disponível') {
            await dbRun("UPDATE marcacoes_placas SET data_contratacao = NULL WHERE id = ?", [req.params.id]);
        }

        await registrarLog('MARCACAO_STATUS', req.user?.nome || '?', req.params.id, 'marcacao', null, status, null);
        io.emit('marcacao_atualizada');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Módulo Cadastro / Gerenciamento de Risco ─────────────────────────────────
app.get('/api/cadastro/motoristas', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro', 'Conhecimento']), async (req, res) => {
    try {
        const isCoordenador = req.user.cargo === 'Coordenador';
        const cidade = req.user.cidade;
        const cidadeFilter = (!isCoordenador && cidade)
            ? "AND (origem_cidade_uf ILIKE $1 OR origem_cidade_uf IS NULL OR origem_cidade_uf = '')"
            : '';
        const params = (!isCoordenador && cidade) ? [`%${cidade}%`] : [];
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   disponibilidade, data_marcacao, data_contratacao,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   comprovante_pdf, anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                   origem_cad, destino_uf_cad, destino_cidade_cad, origem_cidade_uf
            FROM marcacoes_placas
            WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL' OR is_frota = 1)
              ${cidadeFilter}
            ORDER BY data_marcacao DESC
        `, params);
        res.json({ success: true, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: listar motoristas de frota para o PainelCadastro ──
app.get('/api/cadastro/frota', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   data_marcacao, data_contratacao,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   is_frota
            FROM marcacoes_placas
            WHERE is_frota = 1
            ORDER BY nome_motorista ASC
        `);
        res.json({ success: true, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: atualizar liberação ──
app.put('/api/cadastro/frota/:id', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const { num_liberacao_cad, data_liberacao_cad, seguradora_cad } = req.body;
        // Calcular situacao_cad: LIBERADO se tem num_liberacao + seguradora e não expirou (1 ano)
        let situacao_cad = 'NÃO CONFERIDO';
        if (num_liberacao_cad && seguradora_cad) {
            situacao_cad = 'LIBERADO';
            if (data_liberacao_cad) {
                const dataLibStr = data_liberacao_cad.endsWith('Z') ? data_liberacao_cad : data_liberacao_cad + 'Z';
                const diffMs = Date.now() - new Date(dataLibStr).getTime();
                if (diffMs > 365 * 24 * 60 * 60 * 1000) {
                    situacao_cad = 'PENDENTE'; // Expirado (mais de 1 ano)
                }
            }
        } else if (num_liberacao_cad || seguradora_cad) {
            situacao_cad = 'PENDENTE';
        }

        await dbRun(`UPDATE marcacoes_placas SET
            num_liberacao_cad = ?, data_liberacao_cad = ?, seguradora_cad = ?, situacao_cad = ?
            WHERE id = ? AND is_frota = 1`,
            [num_liberacao_cad || '', data_liberacao_cad || null, seguradora_cad || '', situacao_cad, req.params.id]
        );
        await registrarLog('FROTA_LIBERACAO', req.user?.nome || '?', req.params.id, 'frota', null, situacao_cad, `Liberação: ${num_liberacao_cad || '-'}`);
        res.json({ success: true, situacao: situacao_cad });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: excluir motorista de frota ──
app.delete('/api/cadastro/frota/:id', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        await dbRun("DELETE FROM marcacoes_placas WHERE id = ? AND is_frota = 1", [req.params.id]);
        await registrarLog('FROTA_DELETADO', req.user?.nome || '?', req.params.id, 'frota', null, null, null);
        res.json({ success: true });
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
                 WHERE dados_json::jsonb->>'telefoneMotorista' = ?`,
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
            enviarNotificacao('notificacao_direcionada', {
                mensagem: `Checklist de ${placaDesc} atualizado — ${situacao}`,
                situacao,
                cargos_alvo: ['Cadastro', 'Encarregado'],
                data_criacao: new Date().toISOString()
            });
        }

        await registrarLog('MOTORISTA_CADASTRO', req.user?.nome || '?', req.params.id, 'marcacao', null, situacao, `Liberação: ${num_liberacao_cad || '-'}`);
        res.json({ success: true, situacao, data_liberacao_cad: novaDataLib });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Cadastro: motoristas já lançados na operação (tabela veiculos) ────────────
app.get('/api/cadastro/veiculos-em-operacao', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Conhecimento']), async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
        const dInicio = dataInicio || hoje;
        const dFim = dataFim || hoje;

        const rows = await dbAll(`
            SELECT v.id, v.motorista, v.dados_json,
                   v.chk_cnh, v.chk_antt, v.chk_tacografo, v.chk_crlv,
                   v.situacao_cadastro, v.numero_liberacao, v.data_liberacao,
                   v.placa, v.operacao, v.unidade,
                   v.status_recife, v.status_moreno, v.status_cte,
                   m.placa1 AS mp_placa1, m.placa2 AS mp_placa2,
                   m.tipo_veiculo AS mp_tipo_veiculo,
                   COALESCE(v.seguradora_cad, m.seguradora_cad) AS seguradora_cad,
                   COALESCE(v.origem_cad, m.origem_cad) AS origem_cad,
                   COALESCE(v.destino_uf_cad, m.destino_uf_cad) AS destino_uf_cad,
                   COALESCE(v.destino_cidade_cad, m.destino_cidade_cad) AS destino_cidade_cad
            FROM veiculos v
            LEFT JOIN marcacoes_placas m ON m.id = (
                SELECT mp.id FROM marcacoes_placas mp
                WHERE v.motorista IS NOT NULL AND v.motorista != ''
                  AND LOWER(TRIM(mp.nome_motorista)) = LOWER(TRIM(v.motorista))
                ORDER BY mp.data_marcacao DESC LIMIT 1
            )
            WHERE (v.status_recife IS NULL OR v.status_recife NOT IN ('FINALIZADO'))
              AND (v.status_moreno IS NULL OR v.status_moreno NOT IN ('FINALIZADO'))
              AND (COALESCE(v.data_prevista, v.data_criacao::date::text)::date BETWEEN $1::date AND $2::date)
            ORDER BY v.id DESC
        `, [dInicio, dFim]);
        const veiculos = rows.map(r => {
            const dj = (() => { try { return JSON.parse(r.dados_json || '{}'); } catch { return {}; } })();
            // Placas: prioridade dados_json > marcacoes_placas > fallback vazio
            const placa1 = dj.placa1Motorista || r.mp_placa1 || '';
            const placa2 = dj.placa2Motorista || r.mp_placa2 || '';
            return {
                id: r.id,
                nome_motorista: r.motorista || 'A DEFINIR',
                placa1,
                placa2,
                tipo_veiculo: dj.tipoVeiculo || r.mp_tipo_veiculo || '',
                telefone: dj.telefoneMotorista || '',
                operacao: r.operacao || '',
                unidade: r.unidade || '',
                isFrotaMotorista: String(dj.isFrotaMotorista) === 'true' || String(dj.isFrotaMotorista) === '1',
                chk_cnh_cad: r.chk_cnh ? 1 : 0,
                chk_antt_cad: r.chk_antt ? 1 : 0,
                chk_tacografo_cad: r.chk_tacografo ? 1 : 0,
                chk_crlv_cad: r.chk_crlv ? 1 : 0,
                situacao_cad: r.situacao_cadastro || 'NÃO CONFERIDO',
                num_liberacao_cad: r.numero_liberacao || '',
                data_liberacao_cad: r.data_liberacao || null,
                seguradora_cad: r.seguradora_cad || '',
                origem_cad: r.origem_cad || '',
                destino_uf_cad: r.destino_uf_cad || '',
                destino_cidade_cad: r.destino_cidade_cad || '',
                status_cte: r.status_cte || null,
                _fonte: 'operacao',
            };
        });
        res.json({ success: true, veiculos });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cadastro/veiculos-em-operacao/:id', authMiddleware, authorize(['Coordenador', 'Cadastro', 'Conhecimento']), async (req, res) => {
    try {
        const { chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad, num_liberacao_cad, data_liberacao_manual, seguradora_cad, origem_cad, destino_uf_cad, destino_cidade_cad } = req.body;

        // Calcular situação automaticamente
        const todosChk = !!(chk_cnh_cad && chk_antt_cad && chk_tacografo_cad && chk_crlv_cad);
        const liberado = todosChk && !!num_liberacao_cad;
        const situacao = liberado ? 'LIBERADO'
            : (todosChk || num_liberacao_cad) ? 'PENDENTE'
                : 'NÃO CONFERIDO';

        const atual = await dbGet("SELECT numero_liberacao, data_liberacao, dados_json, motorista FROM veiculos WHERE id = ?", [req.params.id]);
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
                numero_liberacao=?, situacao_cadastro=?, data_liberacao=?,
                seguradora_cad=?, origem_cad=?, destino_uf_cad=?, destino_cidade_cad=?
             WHERE id=?`,
            [
                chk_cnh_cad ? 1 : 0,
                chk_antt_cad ? 1 : 0,
                chk_tacografo_cad ? 1 : 0,
                chk_crlv_cad ? 1 : 0,
                num_liberacao_cad || null,
                situacao,
                novaDataLib,
                seguradora_cad || null,
                origem_cad || null,
                destino_uf_cad || null,
                destino_cidade_cad || null,
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

        // Notificação persistente
        const motoristaNome = atual.motorista || dj.motorista || 'Motorista';
        enviarNotificacao('notificacao_direcionada', {
            mensagem: `Checklist de ${motoristaNome} atualizado — ${situacao}`,
            situacao,
            cargos_alvo: ['Cadastro', 'Encarregado'],
            veiculoId: Number(req.params.id),
            data_criacao: new Date().toISOString()
        });
        if (dj.telefoneMotorista) {
            // Sincronizar de volta em marcacoes_placas (para manter consistência caso haja nova viagem)
            await dbRun(
                `UPDATE marcacoes_placas SET
                    chk_cnh_cad=?, chk_antt_cad=?, chk_tacografo_cad=?, chk_crlv_cad=?,
                    num_liberacao_cad=?, situacao_cad=?, data_liberacao_cad=?,
                    seguradora_cad=?, origem_cad=?, destino_uf_cad=?, destino_cidade_cad=?
                 WHERE telefone = ? OR REPLACE(REPLACE(telefone,'+55',''),' ','') = ?`,
                [
                    chk_cnh_cad ? 1 : 0, chk_antt_cad ? 1 : 0,
                    chk_tacografo_cad ? 1 : 0, chk_crlv_cad ? 1 : 0,
                    num_liberacao_cad || null, situacao, novaDataLib,
                    seguradora_cad || '', origem_cad || '', destino_uf_cad || '', destino_cidade_cad || '',
                    dj.telefoneMotorista, dj.telefoneMotorista
                ]
            );
        } else if (atual.motorista) {
            // Fallback: sincronizar pelo nome do motorista quando não há telefone
            await dbRun(
                `UPDATE marcacoes_placas SET
                    seguradora_cad=?, origem_cad=?, destino_uf_cad=?, destino_cidade_cad=?
                 WHERE LOWER(TRIM(nome_motorista)) = LOWER(TRIM(?))`,
                [seguradora_cad || '', origem_cad || '', destino_uf_cad || '', destino_cidade_cad || '', atual.motorista]
            );
        }

        await registrarLog('VEICULO_CADASTRO', req.user?.nome || '?', req.params.id, 'veiculo', null, situacao, `Liberação: ${num_liberacao_cad || '-'}`);
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
        io.emit('marcacao_atualizada');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== FIM MARCAÇÃO DE PLACAS ====================

// ==================== HISTÓRICO DE LIBERAÇÕES ====================

// GET - Listar estrutura (letras → motoristas → registros)
app.get('/api/historico-liberacoes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { letra, motorista } = req.query;
        if (motorista) {
            // Retorna todos os registros do motorista específico
            const rows = await dbAll(
                `SELECT * FROM historico_liberacoes WHERE motorista_nome = ? ORDER BY datetime_cte DESC`,
                [motorista]
            );
            return res.json({ success: true, registros: rows });
        }
        if (letra) {
            // Retorna lista de motoristas distintos para a letra
            const rows = await dbAll(
                `SELECT DISTINCT motorista_nome FROM historico_liberacoes WHERE primeira_letra = ? ORDER BY motorista_nome`,
                [letra.toUpperCase()]
            );
            return res.json({ success: true, motoristas: rows.map(r => r.motorista_nome) });
        }
        // Retorna letras disponíveis com contagem
        const rows = await dbAll(
            `SELECT primeira_letra, COUNT(DISTINCT motorista_nome) as total_motoristas, COUNT(*) as total_liberacoes
             FROM historico_liberacoes GROUP BY primeira_letra ORDER BY primeira_letra`
        );
        res.json({ success: true, letras: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST - Salvar registro de liberação usada
app.post('/api/historico-liberacoes', authMiddleware, async (req, res) => {
    try {
        const { motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id } = req.body;
        if (!motorista_nome) return res.status(400).json({ success: false, message: 'motorista_nome é obrigatório' });

        const nomeLimpo = (motorista_nome || '').trim().toUpperCase();
        const primeira_letra = nomeLimpo[0] || '#';

        await dbRun(
            `INSERT INTO historico_liberacoes (primeira_letra, motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [primeira_letra, nomeLimpo, num_coleta || '', num_liberacao || '', datetime_cte || new Date().toISOString(), origem || '', destino_uf || '', destino_cidade || '', placa || '', operacao || '', veiculo_id || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== FIM HISTÓRICO DE LIBERAÇÕES ====================

app.get('/fila', authMiddleware, authorize(['Coordenador', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const isCoordenador = req.user.cargo === 'Coordenador';
        const cidade = req.user.cidade;
        let rows;
        if (isCoordenador) {
            rows = await dbAll("SELECT * FROM fila ORDER BY id ASC");
        } else {
            rows = await dbAll("SELECT * FROM fila WHERE unidade = ? OR unidade IS NULL ORDER BY id ASC", [cidade]);
        }
        const fila = rows.map(row => ({ id: row.id, unidade: row.unidade, ...JSON.parse(row.dados_json) }));
        res.json({ success: true, fila });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.post('/fila', authMiddleware, authorize(['Coordenador', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const item = req.body;
        const unidade = item.unidade || req.user.cidade || 'Recife';
        const result = await dbRun(`INSERT INTO fila (dados_json, unidade) VALUES (?, ?)`, [JSON.stringify(item), unidade]);
        const novo = { id: result.lastID, unidade, ...item };
        await registrarLog('FILA_CRIADA', req.user?.nome || '?', result.lastID, 'fila', null, null, `Unidade: ${unidade}`);
        io.emit('receber_atualizacao', { tipo: 'novo_fila', dados: novo });
        res.json({ success: true, id: result.lastID });
    } catch (e) { res.status(500).json({ success: false }); }
});
// ATENÇÃO: /fila/reordenar deve vir ANTES de /fila/:id para evitar conflito de rota
app.put('/fila/reordenar', authMiddleware, authorize(['Coordenador', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const { ordem } = req.body;
        if (!Array.isArray(ordem)) return res.status(400).json({ success: false });
        await Promise.all(ordem.map(item => dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(item), item.id])));
        await registrarLog('FILA_REORDENADA', req.user?.nome || '?', null, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'reordenar_fila', ordem });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.put('/fila/:id', authMiddleware, authorize(['Coordenador', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        await dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(req.body), req.params.id]);
        await registrarLog('FILA_ATUALIZADA', req.user?.nome || '?', req.params.id, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'atualiza_fila', id: Number(req.params.id), ...req.body });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.delete('/fila/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM fila WHERE id = ?", [req.params.id]);
        await registrarLog('FILA_REMOVIDA', req.user?.nome || '?', req.params.id, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'remove_fila', id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/notificacoes', authMiddleware, async (req, res) => {
    try {
        const meuCargo = req.user?.cargo || '';
        const minhaCidade = req.user?.cidade || '';
        const userId = req.user?.id;
        // Exclui notificações que este usuário já dispensou
        const rows = await dbAll(
            `SELECT n.* FROM notificacoes n
             WHERE NOT EXISTS (SELECT 1 FROM notificacoes_lidas nl WHERE nl.notificacao_id = n.id AND nl.user_id = $1)
             ORDER BY n.id DESC`,
            [userId]
        );
        const lista = (rows || []).map(row => {
            try {
                return { idInterno: row.id, ...JSON.parse(row.dados_json) };
            } catch (err) {
                return { idInterno: row.id, mensagem: "Erro ao processar notificação" };
            }
        }).filter(n => {
            // Filtrar por destinatário específico (ex: operador Conhecimento selecionado no modal CT-e)
            if (n.destinatario_id && n.destinatario_id !== userId) return false;
            // Filtrar por cargo
            if (n.tipo) {
                const alvo = DESTINATARIOS_NOTIFICACAO[n.tipo];
                if (alvo && !alvo.includes(meuCargo)) return false;
            }
            // Filtrar por unidade: se tem origem, só mostra para a mesma cidade (Coordenador vê tudo)
            if (n.origem && meuCargo !== 'Coordenador' && minhaCidade && n.origem !== minhaCidade) return false;
            // notificacao_direcionada: filtrar por cargos_alvo E unidade
            if (n.cargos_alvo) {
                if (!n.cargos_alvo.includes(meuCargo)) return false;
            }
            return true;
        });
        res.json({ success: true, notificacoes: lista });
    } catch (e) {
        console.error("Erro na rota /notificacoes:", e);
        res.json({ success: true, notificacoes: [] });
    }
});
app.delete('/notificacoes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user && req.user.id;
        const global = req.query.global === 'true'; // ex: aceitar CT-e remove para todos
        if (!isNaN(id)) {
            if (global) {
                // Remoção global (CT-e aceito, etc): deleta do banco + avisa todos
                await dbRun("DELETE FROM notificacoes WHERE id = $1", [id]);
                await dbRun("DELETE FROM notificacoes_lidas WHERE notificacao_id = $1", [id]);
                io.emit('notificacao_removida', { id });
            } else if (userId) {
                // Per-user dismissal: marca como lida para este usuário apenas
                await dbRun(
                    "INSERT INTO notificacoes_lidas (notificacao_id, user_id) VALUES ($1, $2) ON CONFLICT (notificacao_id, user_id) DO NOTHING",
                    [id, userId]
                );
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- ROTAS DE CT-E ATIVOS ---

// Listar todos os CT-es ativos
app.get('/ctes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
    try {
        const hoje = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];
        const dataInicio = req.query.dataInicio || hoje;
        const dataFim = req.query.dataFim || hoje;
        // Busca por data_criacao OU por data_entrada_cte no JSON (que pode ser avançada pelo Finalizar)
        const rows = await dbAll(
            `SELECT * FROM ctes_ativos
             WHERE data_criacao::date BETWEEN $1::date AND $2::date
                OR (
                    dados_json::json->>'data_entrada_cte' IS NOT NULL
                    AND LENGTH(dados_json::json->>'data_entrada_cte') = 10
                    AND TO_DATE(dados_json::json->>'data_entrada_cte', 'DD/MM/YYYY') BETWEEN $1::date AND $2::date
                )
             ORDER BY id ASC`,
            [dataInicio, dataFim]
        );
        const lista = rows.map(row => {
            try {
                const dados = JSON.parse(row.dados_json);
                return {
                    ...dados,
                    id: row.id,
                    origem: row.origem,
                    status: row.status,
                    // Colunas dedicadas têm prioridade sobre dados_json
                    motorista: row.motorista || dados.motorista || '',
                    placa1Motorista: row.placa1 || dados.placa1Motorista || '',
                    coleta: row.coleta || dados.coleta || '',
                    numero_liberacao: row.numero_liberacao || dados.numero_liberacao || '',
                    data_liberacao: row.data_liberacao || dados.data_liberacao || null,
                    origem_cad: row.origem_cad || dados.origem_cad || '',
                    destino_uf_cad: row.destino_uf_cad || dados.destino_uf_cad || '',
                    destino_cidade_cad: row.destino_cidade_cad || dados.destino_cidade_cad || '',
                    usuario_aceitou: row.usuario_aceitou || dados.usuario_aceitou || ''
                };
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
app.post('/ctes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
    try {
        const { origem, dados } = req.body;

        // Proteção contra duplicatas: mesmo motorista + número de liberação com status ativo
        if (dados.motorista && dados.numero_liberacao) {
            const duplicado = await dbGet(
                `SELECT id FROM ctes_ativos
                 WHERE motorista = $1 AND numero_liberacao = $2
                 AND status != 'Emitido'`,
                [dados.motorista, dados.numero_liberacao]
            );
            if (duplicado) {
                return res.status(409).json({ success: false, message: 'CT-e já registrado para este motorista e número de liberação.' });
            }
        }

        const status = dados.status || 'Aguardando Emissão';
        const result = await dbRun(
            `INSERT INTO ctes_ativos (origem, status, dados_json, motorista, placa1, coleta, numero_liberacao, data_liberacao, origem_cad, destino_uf_cad, destino_cidade_cad, usuario_aceitou)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                origem, status, JSON.stringify(dados),
                dados.motorista || null,
                dados.placa1Motorista || null,
                dados.coleta || null,
                dados.numero_liberacao || null,
                dados.data_liberacao || null,
                dados.origem_cad || null,
                dados.destino_uf_cad || null,
                dados.destino_cidade_cad || null,
                dados.usuario_aceitou || null
            ]
        );
        const novo = { id: result.lastID, origem, status, ...dados };
        await registrarLog('CTE_CRIADO', req.user?.nome || '?', result.lastID, 'cte', null, null, `Motorista: ${dados.motorista || '-'} | Coleta: ${dados.coleta || '-'}`);
        io.emit('receber_atualizacao', { tipo: 'novo_cte', dados: novo });
        res.json({ success: true, id: result.lastID });
    } catch (e) {
        console.error("Erro ao criar CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Atualizar CT-e ativo
app.put('/ctes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
    try {
        const { dados } = req.body;
        const status = dados.status || 'Aguardando Emissão';
        await dbRun(
            `UPDATE ctes_ativos SET status = ?, dados_json = ?, motorista = ?, placa1 = ?, coleta = ?, numero_liberacao = ?, data_liberacao = ?, origem_cad = ?, destino_uf_cad = ?, destino_cidade_cad = ?, usuario_aceitou = ? WHERE id = ?`,
            [
                status, JSON.stringify(dados),
                dados.motorista || null,
                dados.placa1Motorista || null,
                dados.coleta || null,
                dados.numero_liberacao || null,
                dados.data_liberacao || null,
                dados.origem_cad || null,
                dados.destino_uf_cad || null,
                dados.destino_cidade_cad || null,
                dados.usuario_aceitou || null,
                req.params.id
            ]
        );
        // Quando CT-e é emitido, salvar no histórico de liberações + remover do cadastro
        if (status === 'Emitido') {
            try {
                const cte = await dbGet("SELECT * FROM ctes_ativos WHERE id = ?", [req.params.id]);
                if (cte && cte.motorista) {
                    const nomeLimpo = cte.motorista.trim().toUpperCase();
                    await dbRun(
                        `INSERT INTO historico_liberacoes (primeira_letra, motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT DO NOTHING`,
                        [
                            nomeLimpo[0] || '#', nomeLimpo,
                            cte.coleta || '',
                            cte.numero_liberacao || '',
                            new Date().toISOString(),
                            cte.origem || '',
                            cte.destino_uf_cad || '',
                            cte.destino_cidade_cad || '',
                            cte.placa1 || '',
                            dados.operacao || '',
                            dados.id || null
                        ]
                    );
                    io.emit('receber_atualizacao', { tipo: 'cadastro_cte_emitido', motorista: cte.motorista });
                }
            } catch (errHist) {
                console.error('Erro ao salvar histórico de liberações:', errHist);
            }
        }
        await registrarLog('CTE_ATUALIZADO', req.user?.nome || '?', req.params.id, 'cte', null, status, `Motorista: ${dados.motorista || '-'}`);
        io.emit('receber_atualizacao', { tipo: 'atualiza_cte', id: Number(req.params.id), status, ...dados });
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao atualizar CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Remover CT-e ativo (apos arquivar no historico)
app.delete('/ctes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM ctes_ativos WHERE id = ?", [req.params.id]);
        await registrarLog('CTE_DELETADO', req.user?.nome || '?', req.params.id, 'cte', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'remove_cte', id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao remover CT-e ativo:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});
// --- ROTAS DE CHECKLIST DA CARRETA ---
app.get('/cubagens', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
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

app.get('/cubagens/coleta/:numero', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
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

        const cubagemId = await dbTransaction(async ({ run }) => {
            const result = await run(
                `INSERT INTO cubagens (numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, metragem_total, valor_mix_total, valor_kit_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0]
            );

            const id = result.lastID;

            // Batch INSERT dos itens em uma única query
            const itensFiltrados = (itens || []).filter(item => item.numero_nf || item.metragem);
            if (itensFiltrados.length > 0) {
                const valores = itensFiltrados.map(item => {
                    const metro = parseFloat(item.metragem) || 0;
                    const base = metro + (metro * 0.10);
                    return [id, item.numero_nf || '', metro, (base / 2.5) / 1.3, (base / 2.5) / 1.9];
                });
                const placeholders = valores.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ');
                await run(`INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit) VALUES ${placeholders}`, valores.flat());
            }

            return id;
        });

        await registrarLog('CUBAGEM_CRIADA', req.user?.nome || '?', cubagemId, 'cubagem', null, null, `Coleta: ${numero_coleta} | Motorista: ${motorista}`);
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

        await dbTransaction(async ({ run }) => {
            await run(
                `UPDATE cubagens SET numero_coleta=?, motorista=?, cliente=?, redespacho=?, nome_redespacho=?, destino=?, volume=?, data=?, faturado=?, tipo=?, metragem_total=?, valor_mix_total=?, valor_kit_total=? WHERE id=?`,
                [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0, id]
            );

            // Recriar itens com batch INSERT
            await run("DELETE FROM cubagem_itens WHERE cubagem_id = ?", [id]);
            const itensFiltrados = (itens || []).filter(item => item.numero_nf || item.metragem);
            if (itensFiltrados.length > 0) {
                const valores = itensFiltrados.map(item => {
                    const metro = parseFloat(item.metragem) || 0;
                    const base = metro + (metro * 0.10);
                    return [id, item.numero_nf || '', metro, (base / 2.5) / 1.3, (base / 2.5) / 1.9];
                });
                const placeholders = valores.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ');
                await run(`INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit) VALUES ${placeholders}`, valores.flat());
            }
        });

        await registrarLog('CUBAGEM_ATUALIZADA', req.user?.nome || '?', id, 'cubagem', null, null, `Coleta: ${numero_coleta}`);
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
        await registrarLog('CUBAGEM_DELETADA', req.user?.nome || '?', req.params.id, 'cubagem', null, null, null);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});
app.use('/login', loginLimiter);
app.use('/', require('./src/routes/auth'));
app.get('/configuracoes', authMiddleware, async (req, res) => { try { const a = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_acesso'"); const b = await dbGet("SELECT valor FROM configuracoes WHERE chave='permissoes_edicao'"); res.json({ success: true, acesso: JSON.parse(a.valor), edicao: JSON.parse(b.valor) }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/configuracoes', authMiddleware, authorize(['Coordenador']), async (req, res) => { const { acesso, edicao } = req.body; if (acesso) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_acesso'", [JSON.stringify(acesso)]); if (edicao) await dbRun("UPDATE configuracoes SET valor=? WHERE chave='permissoes_edicao'", [JSON.stringify(edicao)]); enviarNotificacao('receber_alerta', { tipo: 'admin_config_mudou', mensagem: 'Permissões atualizadas', data_criacao: new Date().toISOString() }); res.json({ success: true }); });
app.get('/solicitacoes', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => { try { const s = await dbAll("SELECT * FROM solicitacoes"); res.json({ success: true, solicitacoes: s }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/solicitacoes', solicitacoesLimiter, async (req, res) => {
    try {
        const { nome, emailPrefix, unidade, senha } = req.body;
        if (!nome || !emailPrefix || !senha) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
        }
        if (!/^[a-zA-Z0-9._+-]+$/.test(emailPrefix)) {
            return res.status(400).json({ success: false, message: 'Prefixo de e-mail inválido.' });
        }
        const senhaHash = await bcrypt.hash(senha || '123456', 10);
        await dbRun("INSERT INTO solicitacoes (tipo, nome, email, unidade, senha, data_criacao) VALUES (?,?,?,?,?,?)",
            ['CADASTRO', nome, emailPrefix + '@tnetlog.com.br', unidade, senhaHash, obterDataHoraBrasilia()]);
        enviarNotificacao('receber_alerta', { tipo: 'admin_cadastro', mensagem: `Novo cadastro: ${nome}`, data_criacao: new Date().toISOString() });
        res.json({ success: true });
    } catch (e) {
        console.error("❌ [/solicitacoes] Erro ao processar cadastro:", e);
        res.status(500).json({ success: false, message: 'Erro interno ao processar cadastro. Verifique a conexão com o banco.' });
    }
});
app.delete('/solicitacoes/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => { await dbRun("DELETE FROM solicitacoes WHERE id=?", [req.params.id]); res.json({ success: true }); });

// Listar operadores com cargo Conhecimento (para modal de seleção CT-e)
app.get('/api/usuarios/conhecimento', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll("SELECT id, nome, cidade FROM usuarios WHERE cargo = 'Conhecimento' ORDER BY nome", []);
        res.json({ success: true, usuarios: rows || [] });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Buscar usuário por nome (usado no fluxo de recuperação de senha — público, sem login)
app.get('/usuarios/buscar', async (req, res) => {
    try {
        const { nome } = req.query;
        if (!nome || nome.trim().length < 3) return res.status(400).json({ success: false, message: 'Nome muito curto.' });
        const usuario = await dbGet("SELECT id, nome, email, cargo, telefone FROM usuarios WHERE LOWER(nome) LIKE LOWER($1)", [`%${nome.trim()}%`]);
        if (!usuario) return res.json({ success: false, message: 'Usuário não encontrado.' });
        res.json({ success: true, id: usuario.id, nome: usuario.nome, email: usuario.email, telefone: usuario.telefone || null });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// Salvar telefone WhatsApp do usuário (próprio usuário ou Coordenador)
app.post('/usuarios/:id/telefone', authMiddleware, async (req, res) => {
    try {
        const idAlvo = Number(req.params.id);
        const { telefone } = req.body;
        if (!telefone || telefone.replace(/\D/g, '').length < 10) {
            return res.status(400).json({ success: false, message: 'Telefone inválido. Informe DDD + número.' });
        }
        // Só o próprio usuário ou um Coordenador pode salvar
        if (req.user.id !== idAlvo && req.user.cargo !== 'Coordenador') {
            return res.status(403).json({ success: false, message: 'Sem permissão.' });
        }
        const tel = telefone.replace(/\D/g, '');
        await dbRun("UPDATE usuarios SET telefone = $1 WHERE id = $2", [tel, idAlvo]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Gerar token de reset de senha (só Coordenador) — retorna código para enviar via WhatsApp
app.post('/usuarios/:id/gerar-token-reset', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        const idAlvo = Number(req.params.id);
        const usuario = await dbGet("SELECT id, nome, telefone FROM usuarios WHERE id = $1", [idAlvo]);
        if (!usuario) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (!usuario.telefone) return res.status(400).json({ success: false, message: 'Usuário sem telefone cadastrado.' });

        // Invalida tokens anteriores do usuário
        await dbRun("UPDATE reset_tokens SET usado = 1 WHERE usuario_id = $1", [idAlvo]);

        // Gera código de 6 dígitos criptograficamente seguro e salva com TTL de 15 min
        const token = require('crypto').randomInt(100000, 1000000).toString();
        await dbRun(
            "INSERT INTO reset_tokens (usuario_id, token, expira_em) VALUES ($1, $2, NOW() + interval '15 minutes')",
            [idAlvo, token]
        );
        logger.audit('GERAR_TOKEN_RESET', `ID:${idAlvo}`);
        res.json({ success: true, token, telefone: usuario.telefone, nome: usuario.nome });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Trocar senha usando token recebido via WhatsApp (sem auth — usuário ainda não está logado)
app.post('/reset-senha-token', resetSenhaLimiter, async (req, res) => {
    const MSG_INVALIDO = 'Código inválido ou expirado.';
    try {
        const { email, token, novaSenha } = req.body;
        if (!email || !token || !novaSenha) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios: email, token, novaSenha.' });
        }
        if (novaSenha.length < 6) {
            return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres.' });
        }

        const usuario = await dbGet("SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)", [email.trim()]);
        // Retorna a mesma mensagem para email inválido e código inválido (evita email enumeration)
        if (!usuario) return res.status(400).json({ success: false, message: MSG_INVALIDO });

        const registro = await dbGet(
            "SELECT id FROM reset_tokens WHERE usuario_id = $1 AND token = $2 AND usado = 0 AND expira_em > NOW()",
            [usuario.id, token.trim()]
        );
        if (!registro) {
            return res.status(400).json({ success: false, message: MSG_INVALIDO });
        }

        const hash = await bcrypt.hash(novaSenha, 10);
        await dbRun("UPDATE usuarios SET senha = $1 WHERE id = $2", [hash, usuario.id]);
        await dbRun("UPDATE reset_tokens SET usado = 1 WHERE id = $1", [registro.id]);
        logger.audit('RESET_SENHA_TOKEN', `ID:${usuario.id}`);
        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (e) {
        console.error('❌ [reset-senha-token]:', e);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
app.get('/relatorios', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => { const rows = await dbAll("SELECT dados_json FROM historico"); res.json({ historico: rows.map(r => JSON.parse(r.dados_json)) }); });
app.post('/historico_cte', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => { await dbRun("INSERT INTO historico_cte (dados_json) VALUES (?)", [JSON.stringify(req.body)]); res.json({ success: true }); });
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

                    // Buscar contador ANTES para logar a progressão
                    const marcacaoAntes = telefoneMotorista
                        ? await dbGet("SELECT viagens_realizadas FROM marcacoes_placas WHERE telefone = ?", [telefoneMotorista])
                        : await dbGet("SELECT viagens_realizadas FROM marcacoes_placas WHERE nome_motorista = ?", [veiculo.motorista]);
                    const viagensAntes = marcacaoAntes?.viagens_realizadas ?? '?';
                    console.log(`🚛 [CT-e Emitido] Motorista: "${veiculo.motorista}" | Tel: ${telefoneMotorista || 'não registrado'} | Viagens antes: ${viagensAntes}`);

                    // Busca pelo telefone primeiro, fallback pelo nome do motorista
                    const agora = new Date().toISOString();
                    let rowsAfetadas = 0;

                    if (telefoneMotorista) {
                        const r = await dbRun(
                            `UPDATE marcacoes_placas
                             SET viagens_realizadas = viagens_realizadas + 1,
                                 status_operacional = 'EM VIAGEM',
                                 data_contratacao = COALESCE(data_contratacao, ?)
                             WHERE telefone = ? AND (is_frota IS NULL OR is_frota = 0)`,
                            [agora, telefoneMotorista]
                        );
                        rowsAfetadas = r.changes || 0;
                        if (rowsAfetadas > 0) console.log(`   ✅ Encontrado por telefone (${telefoneMotorista})`);
                    }

                    // Fallback: buscar pelo nome do motorista se não achou pelo telefone
                    if (rowsAfetadas === 0 && veiculo.motorista) {
                        const r = await dbRun(
                            `UPDATE marcacoes_placas
                             SET viagens_realizadas = viagens_realizadas + 1,
                                 status_operacional = 'EM VIAGEM',
                                 data_contratacao = COALESCE(data_contratacao, ?)
                             WHERE nome_motorista = ? AND (is_frota IS NULL OR is_frota = 0)`,
                            [agora, veiculo.motorista]
                        );
                        rowsAfetadas = r.changes || 0;
                        if (rowsAfetadas > 0) console.log(`   ✅ Encontrado por nome ("${veiculo.motorista}")`);
                    }

                    if (rowsAfetadas > 0) {
                        const marcacaoDepois = telefoneMotorista
                            ? await dbGet("SELECT viagens_realizadas FROM marcacoes_placas WHERE telefone = ?", [telefoneMotorista])
                            : await dbGet("SELECT viagens_realizadas FROM marcacoes_placas WHERE nome_motorista = ?", [veiculo.motorista]);
                        const viagensDepois = marcacaoDepois?.viagens_realizadas ?? '?';
                        console.log(`✅ [CT-e] Viagem registrada: "${veiculo.motorista}" | ${viagensAntes} → ${viagensDepois} viagens | status → EM VIAGEM | cadastro → ARQUIVADO`);
                    } else {
                        console.warn(`⚠️ [CT-e] Motorista "${veiculo.motorista}" NÃO encontrado em marcacoes_placas`);
                        console.warn(`   Buscou por telefone: ${telefoneMotorista || 'N/A'} | por nome: "${veiculo.motorista}"`);
                        console.warn(`   Veículo ID: ${cteId} | Coleta: ${coleta} — contador de viagens NÃO incrementado`);
                    }
                }

                // Marcar status_cte no veículo para sumir da aba "Na operação"
                try {
                    await dbRun("UPDATE veiculos SET status_cte = 'Emitido' WHERE id = ?", [cteId]);
                    console.log(`✅ [CT-e] status_cte = 'Emitido' gravado no veículo id=${cteId}`);
                } catch (errStatus) {
                    console.error('Erro ao gravar status_cte no veículo:', errStatus);
                }

                // Notificar PainelCadastro para remover card em tempo real
                io.emit('receber_atualizacao', { tipo: 'cadastro_situacao_atualizada' });
            } catch (errViagem) {
                console.error('Erro ao incrementar viagem do motorista:', errViagem);
            }
        } else if (statusAntigo === 'Emitido' || statusAntigo === 'Em Emissão') {
            // Estorno/Cancelamento
            acao = 'ESTORNO_CTE';
            detalhes = `⚠️ CT-e retrocedido: ${statusAntigo} → ${statusNovo} | ${origem} | Coleta: ${coleta}`;
        }

        // Sempre persistir o status no veículo para não perder no reload (v0.2.3 fix)
        try {
            await dbRun("UPDATE veiculos SET status_cte = ? WHERE id = ?", [statusNovo, cteId]);
            console.log(`✅ [CT-e] status_cte = '${statusNovo}' gravado no veículo id=${cteId}`);
        } catch (errStatus) {
            console.error('Erro ao gravar status_cte no veículo:', errStatus);
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

        // Notificar painel operacional sobre a mudança de status do vínculo CT-e
        io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(cteId), status_cte: statusNovo });

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
            "SELECT id, acao, usuario, alvo_id, alvo_tipo, valor_antigo, valor_novo, detalhes, data_hora AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as data_hora FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
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

// ── Nova Rota de Checklist (Operacional / Doca) ───────────────────
app.post('/api/checklists', authMiddleware, authorize(['Conferente', 'Coordenador']), async (req, res) => {
    try {
        const { veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome } = req.body;
        if (!veiculo_id || !placa_carreta || !assinatura) {
            return res.status(400).json({ success: false, message: 'Dados obrigatórios faltando.' });
        }

        // Auto-aprovação: condições perfeitas dispensam revisão manual do Coordenador
        const autoAprovado =
            placa_confere === true &&
            condicao_bau === 'Limpo e Intacto' &&
            !foto_vazamento;
        const status = autoAprovado ? 'APROVADO' : 'PENDENTE';

        const created_at = obterDataHoraBrasilia();
        const result = await dbRun(
            `INSERT INTO checklists_carreta (veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0, condicao_bau || null, cordas || 0, foto_vazamento || null, assinatura, conferente_nome || null, created_at, status]
        );

        await registrarLog('CHECKLIST_CRIADO', req.user?.nome || '?', veiculo_id, 'veiculo', null, status, `Placa: ${placa_carreta} | Conferente: ${conferente_nome || '-'}`);
        // Se auto-aprovado, dispara socket para atualizar a fila operacional sem precisar de refresh
        if (autoAprovado) {
            io.emit('receber_atualizacao');
        }

        res.json({ success: true, id: result.lastID, status });
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
        await registrarLog('CHECKLIST_STATUS', req.user?.nome || '?', req.params.id, 'checklist', null, status, null);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Socket.io
io.on('connection', (socket) => {
    socket.on('enviar_alerta', async (dados) => {
        console.log(`🔌 [Socket] enviar_alerta recebido:`, dados.tipo, dados.mensagem);
        await enviarNotificacao('receber_alerta', { ...dados, data_criacao: dados.data_criacao || new Date().toISOString() });
    });
    socket.on('nova_atualizacao', (dados) => { io.emit('receber_atualizacao', dados); });
    socket.on('update_user_avatar', (dados) => { io.emit('receber_atualizacao', { tipo: 'avatar_mudou', ...dados }); });
});
// ── PROGRAMAÇÃO DIÁRIA (Manual) ──────────────────────────────────────
async function gerarProgramacaoDiaria(turno) {
    try {
        console.log(`[PROG] Iniciando Programação Diária - Turno: ${turno}`);
        const hojeStr = new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(',')[0];

        const totais = {
            Delta:        { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
        };

        let rows;
        if (turno === 'Inicial') {
            rows = await dbAll(`
                SELECT id, unidade, operacao, data_prevista, data_prevista_original, data_criacao
                FROM veiculos
                WHERE LEFT(data_prevista, 10) = ?
                  AND NOT (
                    COALESCE(status_recife,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO')
                    AND COALESCE(status_moreno,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO')
                  )
            `, [hojeStr]);

            rows.forEach(v => {
                const op = (v.operacao || '').toUpperCase();
                let cliente = 'Consolidados';
                if (op.includes('/')) {
                    cliente = 'Consolidados';
                } else if (op.includes('DELTA')) {
                    cliente = 'Delta';
                } else if (op.includes('PORCELANA')) {
                    cliente = 'Porcelana';
                } else if (op.includes('ELETRIK')) {
                    cliente = 'Eletrik';
                }

                const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';

                const foiReprogramado =
                    v.data_prevista_original
                        ? v.data_prevista_original.substring(0, 10) !== v.data_prevista.substring(0, 10)
                        : (v.data_criacao && v.data_criacao.substring(0, 10) < v.data_prevista.substring(0, 10));

                if (foiReprogramado) {
                    totais[cliente][`reprogramado_${un}`] += 1;
                } else {
                    totais[cliente][un] += 1;
                }
            });

        } else { // Final
            rows = await dbAll(`
                SELECT id, unidade, operacao
                FROM veiculos
                WHERE LEFT(data_prevista, 10) = ?
                  AND NOT (
                    COALESCE(status_recife,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue')
                    AND COALESCE(status_moreno,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue')
                  )
            `, [hojeStr]);

            rows.forEach(v => {
                const op = (v.operacao || '').toUpperCase();
                let cliente = 'Consolidados';
                if (op.includes('/')) {
                    cliente = 'Consolidados';
                } else if (op.includes('DELTA')) {
                    cliente = 'Delta';
                } else if (op.includes('PORCELANA')) {
                    cliente = 'Porcelana';
                } else if (op.includes('ELETRIK')) {
                    cliente = 'Eletrik';
                }

                const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';
                totais[cliente][un] += 1;
            });
        }

        // Idempotência: apagar snapshot anterior do mesmo (data, turno)
        await dbRun(
            'DELETE FROM frota_programacao_diaria WHERE data_referencia = ? AND turno = ?',
            [hojeStr, turno]
        );

        const dados_json = JSON.stringify(totais);
        await dbRun(
            'INSERT INTO frota_programacao_diaria (data_referencia, turno, dados_json) VALUES (?, ?, ?)',
            [hojeStr, turno, dados_json]
        );

        enviarNotificacao('programacao_gerada', { turno, data_referencia: hojeStr, data_criacao: new Date().toISOString() });
        console.log(`[PROG] Programação Diária (${turno}) concluída. ${rows.length} veículos processados.`);
        return { turno, data_referencia: hojeStr };
    } catch (e) {
        console.error(`[PROG] Erro ao gerar programação diária:`, e);
        throw e;
    }
}

// ── VERIFICAÇÃO DE EXPIRAÇÃO DE LIBERAÇÕES (GR) ───────────────────────
// Roda a cada 15 minutos para checar liberações que estão prestes a expirar (2h) ou já expiraram
// Só alerta para motoristas em espera (marcacoes_placas com disponibilidade != Contratado)
// Guarda controle de alertas já enviados para não duplicar
const alertasJaEnviados = new Set(); // chave: `${id}_2h` ou `${id}_exp`
// Limpar o Set uma vez por dia (motoristas removidos do banco não limpam automaticamente)
setInterval(async () => {
    alertasJaEnviados.clear();
    // Limpar notificações antigas (>7 dias) e seus registros de leitura
    try {
        await dbRun("DELETE FROM notificacoes_lidas WHERE notificacao_id IN (SELECT id FROM notificacoes WHERE data_criacao < NOW() - INTERVAL '7 days')");
        await dbRun("DELETE FROM notificacoes WHERE data_criacao < NOW() - INTERVAL '7 days'");
    } catch (e) { console.error('[CLEANUP] Erro ao limpar notificações antigas:', e); }
}, 24 * 60 * 60 * 1000);

async function verificarExpiracaoLiberacoes() {
    try {
        const agora = Date.now();
        const LIMITE_24H = 24 * 60 * 60 * 1000;
        const ALERTA_2H = 2 * 60 * 60 * 1000;

        const motoristas = await dbAll(
            `SELECT id, nome_motorista, placa1, num_liberacao_cad, data_liberacao_cad, disponibilidade
             FROM marcacoes_placas mp
             WHERE data_liberacao_cad IS NOT NULL
               AND (disponibilidade IS NULL OR disponibilidade NOT IN ('Contratado', 'Indisponível'))
               AND situacao_cad = 'LIBERADO'
               AND NOT EXISTS (
                   SELECT 1 FROM veiculos v
                   WHERE LOWER(TRIM(v.motorista)) = LOWER(TRIM(mp.nome_motorista))
                     AND v.status_cte = 'Emitido'
               )`
        );

        for (const m of motoristas) {
            const dataStr = m.data_liberacao_cad.endsWith('Z') ? m.data_liberacao_cad : m.data_liberacao_cad + 'Z';
            const diffMs = agora - new Date(dataStr).getTime();
            const restanteMs = LIMITE_24H - diffMs;
            const placa = m.placa1 || 'S/Placa';
            const nome = m.nome_motorista;

            if (restanteMs <= 0) {
                // EXPIRADO — verificar se já existe notificação no BD (não apenas em memória)
                const chave = `${m.id}_exp`;
                if (!alertasJaEnviados.has(chave)) {
                    // Checar no BD se já existe notificação liberacao_expirada para este motorista
                    const existeNoBd = await dbGet(
                        `SELECT id FROM notificacoes WHERE dados_json LIKE $1 AND dados_json LIKE '%"tipo":"liberacao_expirada"%'`,
                        [`%"motorista":"${nome.replace(/'/g, "''")}"%`]
                    );
                    if (existeNoBd) {
                        // Já existe no BD — apenas adicionar à memória para não checar novamente
                        alertasJaEnviados.add(chave);
                        continue;
                    }

                    alertasJaEnviados.add(chave);
                    alertasJaEnviados.delete(`${m.id}_2h`);

                    const msg = `⛔ LIBERAÇÃO EXPIRADA — ${nome} (${placa}) — Lib. Nº ${m.num_liberacao_cad || 'S/N'}. Solicite renovação!`;
                    console.log(`[CRON-LIB] ${msg}`);

                    await enviarNotificacao('notificacao_direcionada', {
                        mensagem: msg,
                        tipo: 'liberacao_expirada',
                        cargos_alvo: ['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento'],
                        motorista: nome,
                        placa,
                        num_liberacao: m.num_liberacao_cad,
                        data_criacao: new Date().toISOString(),
                    });
                }
            } else if (restanteMs <= ALERTA_2H) {
                // FALTAM MENOS DE 2 HORAS
                const chave = `${m.id}_2h`;
                if (!alertasJaEnviados.has(chave)) {
                    // Checar no BD se já existe notificação liberacao_vencendo para este motorista
                    const existeNoBd = await dbGet(
                        `SELECT id FROM notificacoes WHERE dados_json LIKE $1 AND dados_json LIKE '%"tipo":"liberacao_vencendo"%'`,
                        [`%"motorista":"${nome.replace(/'/g, "''")}"%`]
                    );
                    if (existeNoBd) {
                        alertasJaEnviados.add(chave);
                        continue;
                    }

                    alertasJaEnviados.add(chave);

                    const hRestante = Math.floor(restanteMs / 3600000);
                    const mRestante = Math.floor((restanteMs % 3600000) / 60000);
                    const tempoStr = hRestante > 0 ? `${hRestante}h${String(mRestante).padStart(2, '0')}min` : `${mRestante}min`;

                    const msg = `⚠️ LIBERAÇÃO VENCENDO — ${nome} (${placa}) — ${tempoStr} restantes. Lib. Nº ${m.num_liberacao_cad || 'S/N'}`;
                    console.log(`[CRON-LIB] ${msg}`);

                    await enviarNotificacao('notificacao_direcionada', {
                        mensagem: msg,
                        tipo: 'liberacao_vencendo',
                        cargos_alvo: ['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento'],
                        motorista: nome,
                        placa,
                        num_liberacao: m.num_liberacao_cad,
                        data_criacao: new Date().toISOString(),
                    });
                }
            } else {
                // Liberação ainda válida e fora da janela de alerta — limpar estado
                alertasJaEnviados.delete(`${m.id}_2h`);
                alertasJaEnviados.delete(`${m.id}_exp`);
            }
        }
    } catch (e) {
        console.error('[CRON-LIB] Erro ao verificar expiração de liberações:', e);
    }
}

// Rodar a cada 15 minutos, todos os dias
cron.schedule('*/15 * * * *', verificarExpiracaoLiberacoes, { scheduled: true, timezone: "America/Sao_Paulo" });

// ── ROLLOVER AUTOMÁTICO REMOVIDO — agora é manual via botão "Finalizar Operação" nos painéis ──

// ── AUDITORIA DE DEPENDÊNCIAS (A cada 15 dias) ───────────────────────
// Roda no dia 1 e 15 de cada mês às 03:00 da manhã
cron.schedule('0 3 1,15 * *', () => {
    const { exec } = require('child_process');
    console.log('[CRON-AUDIT] Iniciando auditoria de segurança (npm audit)...');

    exec('npm audit --json', (error, stdout, stderr) => {
        try {
            const results = JSON.parse(stdout);
            const vulns = results.metadata.vulnerabilities;
            const total = vulns.low + vulns.moderate + vulns.high + vulns.critical;

            if (total > 0) {
                console.warn(`⚠️ [CRON-AUDIT] Encontradas ${total} vulnerabilidades! (High: ${vulns.high}, Critical: ${vulns.critical})`);
                // Aqui você poderia enviar um email ou notificação interna
            } else {
                console.log('✅ [CRON-AUDIT] Nenhuma vulnerabilidade encontrada.');
            }
        } catch (e) {
            console.error('[CRON-AUDIT] Erro ao processar resultado do npm audit');
        }
    });
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

app.post('/api/programacao-diaria/gerar', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
    const { turno } = req.body;
    if (turno !== 'Inicial' && turno !== 'Final') {
        return res.status(400).json({ success: false, message: "turno deve ser 'Inicial' ou 'Final'" });
    }
    try {
        const resultado = await gerarProgramacaoDiaria(turno);
        res.json({ success: true, turno: resultado.turno, data_referencia: resultado.data_referencia });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// ────────────────────────────────────────────────────────────

// Endpoints para containers bloqueando docas (Persistente no Banco)
app.get('/api/docas-interditadas', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM docas_interditadas');
        res.json({ success: true, docas: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/docas-interditadas', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const { unidade } = req.body;
        const result = await dbRun('INSERT INTO docas_interditadas (unidade, doca, nome) VALUES (?, ?, ?)', [unidade, 'SELECIONE', 'CONTAINER']);
        const newCard = { id: result.lastID, unidade, doca: 'SELECIONE', nome: 'CONTAINER' };

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        await registrarLog('DOCA_CRIADA', req.user?.nome || '?', result.lastID, 'doca', null, null, `Unidade: ${unidade}`);
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true, doca: newCard });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/docas-interditadas/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { doca } = req.body;
        await dbRun('UPDATE docas_interditadas SET doca = ? WHERE id = ?', [doca, id]);

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        await registrarLog('DOCA_ATUALIZADA', req.user?.nome || '?', id, 'doca', null, doca, null);
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/docas-interditadas/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        await dbRun('DELETE FROM docas_interditadas WHERE id = ?', [id]);

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        await registrarLog('DOCA_DELETADA', req.user?.nome || '?', id, 'doca', null, null, null);
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== SALDO DE PALETES ====================

app.get('/api/saldo-paletes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM saldo_paletes ORDER BY data_entrada DESC");
        res.json({ success: true, registros: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/saldo-paletes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const { motorista, telefone, placa_cavalo, placa_carreta, tipo_palete, qtd_pbr, qtd_descartavel, fornecedor_pbr, observacao, unidade } = req.body;
        if (!motorista || !tipo_palete) {
            return res.status(400).json({ success: false, message: 'Motorista e tipo de palete são obrigatórios.' });
        }
        if ((tipo_palete === 'PBR' || tipo_palete === 'MISTO') && !fornecedor_pbr) {
            return res.status(400).json({ success: false, message: 'Fornecedor é obrigatório para paletes PBR.' });
        }
        const result = await dbRun(
            `INSERT INTO saldo_paletes (motorista, telefone, placa_cavalo, placa_carreta, tipo_palete, qtd_pbr, qtd_descartavel, fornecedor_pbr, observacao, unidade)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [motorista, telefone || '', placa_cavalo || '', placa_carreta || '', tipo_palete, qtd_pbr || 0, qtd_descartavel || 0, fornecedor_pbr || '', observacao || '', unidade || '']
        );
        await registrarLog('PALETE_CRIADO', req.user?.nome || '?', result.lastID || result.id, 'palete', null, null, `Motorista: ${motorista} | Tipo: ${tipo_palete}`);
        io.emit('saldo_paletes_update');
        res.json({ success: true, id: result.lastID || result.id });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/saldo-paletes/:id/devolucao', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { qtd_devolvida_pbr, qtd_devolvida_desc, total } = req.body;
        const registro = await dbGet("SELECT * FROM saldo_paletes WHERE id = ?", [id]);
        if (!registro) return res.status(404).json({ success: false, message: 'Registro não encontrado.' });

        let devPbr = qtd_devolvida_pbr || 0;
        let devDesc = qtd_devolvida_desc || 0;
        if (total) {
            devPbr = registro.qtd_pbr;
            devDesc = registro.qtd_descartavel;
        }
        const todosDevolvidos = (devPbr >= registro.qtd_pbr) && (devDesc >= registro.qtd_descartavel);
        await dbRun(
            `UPDATE saldo_paletes SET qtd_devolvida_pbr = ?, qtd_devolvida_desc = ?, devolvido = ?, data_devolucao = CURRENT_TIMESTAMP WHERE id = ?`,
            [devPbr, devDesc, todosDevolvidos, id]
        );
        await registrarLog('PALETE_DEVOLUCAO', req.user?.nome || '?', id, 'palete', null, null, `PBR: ${devPbr}, Desc: ${devDesc}`);
        io.emit('saldo_paletes_update');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/saldo-paletes/:id', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        await dbRun("DELETE FROM saldo_paletes WHERE id = ?", [Number(req.params.id)]);
        await registrarLog('PALETE_DELETADO', req.user?.nome || '?', req.params.id, 'palete', null, null, null);
        io.emit('saldo_paletes_update');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Porta configurável via .env
const PORT = process.env.PORT || 3001;

// ── ERRO GLOBAL (FALLBACK DE SEGURANÇA) ──────────────────────────────
app.use((err, req, res, next) => {
    // JSON malformado enviado pelo cliente (SyntaxError do body-parser)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, message: 'JSON inválido na requisição.' });
    }
    console.error('❌ [ERRO SERVIDOR]:', err.message || err);
    res.status(500).json({
        success: false,
        message: 'Erro interno no servidor.'
    });
});

// ── Fallback para React (SPA) ────────────────────────────────────────────────
// Deve ser uma das últimas rotas para não interferir nas rotas da API
if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');

    // PWA Conferente: serve index.html com manifest correto para /conferente e subpaths
    app.get(['/conferente', '/conferente/*splat'], (req, res) => {
        const indexPath = path.join(__dirname, 'build', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace('/manifest.json', '/conferente-manifest.json');
        res.set('Content-Type', 'text/html');
        res.send(html);
    });

    // PWA Checklist: serve index.html com manifest correto para /checklist e subpaths
    app.get(['/checklist', '/checklist/*splat'], (req, res) => {
        const indexPath = path.join(__dirname, 'build', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace('/manifest.json', '/checklist-manifest.json');
        res.set('Content-Type', 'text/html');
        res.send(html);
    });

    app.get('/*splat', (req, res) => {
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configurado via .env' : 'Usando chave padrão (MUDAR EM PRODUÇÃO!)'}\n`);
});