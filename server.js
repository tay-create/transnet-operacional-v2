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
const crypto = require('crypto');
const cron = require('node-cron');
const { authMiddleware, authorize, generateToken } = require('./middleware/authMiddleware');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./src/services/emailService');

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const limparPrefixoColeta = (str) => {
    const s = (str || '').toString().trim();
    if (!s) return '';
    if (!s.includes('PLAS:') && !s.includes('PORC:') && !s.includes('ELET:')) return s;
    return s.split('|').map(p => p.trim().replace(/^(PLAS|PORC|ELET):/, '').trim()).filter(Boolean).join(',');
};
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
    'aceite_cte_pendente': ['Conhecimento', 'Planejamento', 'Coordenador', 'Desenvolvedor'],
    'veiculo_carregado':   ['Planejamento'],
    'admin_cadastro':      ['Coordenador', 'Direção'],
    'admin_senha':         ['Coordenador', 'Direção'],
    'nova_ocorrencia':     ['Pos Embarque'],
    'nova_marcacao':       ['Pos Embarque'],
    'nova_marcacao_coord': [],
    'aviso':               ['Planejamento', 'Encarregado', 'Aux. Operacional'],
    'alerta_usabilidade_frota': ['Coordenador', 'Planejamento', 'Adm Frota'],
    'veiculo_manutencao':       ['Manutenção', 'Coordenador', 'Adm Frota'],
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
            mediaSrc: ["'self'", "blob:", "data:"],
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

// Helper: página HTML simples para rotas não-React (verificação de e-mail, admin, etc.)
const htmlSimples = (mensagem, tipo = 'info') => {
    const cor = tipo === 'success' ? '#22c55e' : tipo === 'warn' ? '#f59e0b' : tipo === 'error' ? '#ef4444' : '#38bdf8';
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Transnet</title>
    <style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:#1e293b;border:1px solid ${cor}33;border-radius:12px;padding:32px 40px;max-width:480px;text-align:center}
    h2{color:${cor};margin-bottom:8px}p{color:#94a3b8;margin-top:8px}
    a{color:#38bdf8;text-decoration:none}</style></head>
    <body><div class="card"><h2>${mensagem}</h2><p><a href="/">← Voltar ao sistema</a></p></div></body></html>`;
};

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

const posembarqueRouter = require('./src/routes/posembarque')(registrarLog, io);
app.use('/', posembarqueRouter);

const chamadosRouter = require('./src/routes/chamados')(io);
app.use('/', chamadosRouter);

const roteirizacaoRouter = require('./src/routes/roteirizacao')(io);
app.use('/', roteirizacaoRouter);

// Reset de senha por Coordenador (gera senha padrão "123" e força troca)
app.post('/usuarios/:id/reset-senha', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
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
    if (req.user.id !== userId && !['Coordenador', 'Direção'].includes(req.user.cargo)) {
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
app.get('/api/tokens', authMiddleware, authorize(['Coordenador', 'Direção', 'Adm Frota', 'Planejamento', 'Cadastro', 'Conhecimento', 'Pos Embarque', 'Encarregado']), async (req, res) => {
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
        // Bloqueia se já existe qualquer link para este número (pelos 8 últimos dígitos)
        const ultimos8 = telefone.slice(-8);
        const duplicado = await dbGet(
            "SELECT id, status FROM tokens_motoristas WHERE RIGHT(telefone, 8) = $1 LIMIT 1",
            [ultimos8]
        );
        if (duplicado) {
            return res.status(400).json({ success: false, message: 'Já existe um link para este número. Reative o link existente ao invés de criar um novo.' });
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
            estados_destino, ja_carregou,
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
                    altura=?, largura=?, comprimento=?, estados_destino=?,
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
                    estadosJson,
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
                  altura, largura, comprimento, estados_destino,
                  ja_carregou, rastreador, status_rastreador, latitude, longitude,
                  disponibilidade, comprovante_pdf,
                  anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                  status_operacional, data_contratacao)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DISPONIVEL',NULL)`,
                [
                    token_id, nome_motorista, telefoneLimpo, placa1, placa2 || '',
                    tipo_veiculo, altura || null, largura || null, comprimento || null,
                    estadosJson,
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

        // ── Envio para Torre de Monitoramento (fire-and-forget, não bloqueia resposta) ──
        if (process.env.TORRE_SUPABASE_URL && process.env.TORRE_SUPABASE_KEY) {
            const torrePayload = {
                driver_name: nome_motorista,
                phone: telefoneLimpo,
                plate1: placa1,
                ...(placa2 ? { plate2: placa2 } : {})
            };
            fetch(`${process.env.TORRE_SUPABASE_URL}/rest/v1/third_party_drivers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.TORRE_SUPABASE_KEY,
                    'Authorization': `Bearer ${process.env.TORRE_SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(torrePayload)
            }).then(r => {
                if (!r.ok) r.text().then(t => console.warn(`[TORRE] Falha ao cadastrar motorista: ${r.status} ${t}`));
                else console.log(`[TORRE] Motorista cadastrado: ${nome_motorista} (${placa1})`);
            }).catch(err => console.warn(`[TORRE] Erro de conexão: ${err.message}`));
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Auto-delete: remove marcações de terceiros com 15+ dias sem sair de Disponível ──
let ultimaLimpezaMarcacoes = 0;
async function limparMarcacoesAntigas() {
    const agora = Date.now();
    if (agora - ultimaLimpezaMarcacoes < 3600000) return; // max 1x por hora
    ultimaLimpezaMarcacoes = agora;
    try {
        const result = await dbRun(
            `DELETE FROM marcacoes_placas
             WHERE (is_frota IS NULL OR is_frota = 0)
             AND (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
             AND data_marcacao < NOW() - INTERVAL '15 days'`
        );
        if (result && result.changes > 0) {
            console.log(`[auto-delete] ${result.changes} marcações antigas removidas.`);
        }
    } catch (e) {
        console.error('[auto-delete] Erro:', e.message);
    }
}

// ── Stats endpoint para DashboardMarcacoes ────────────────────────────────────
app.get('/api/marcacoes/stats', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const mes = req.query.mes || new Date().toISOString().slice(0, 7); // YYYY-MM
        const [anoStr, mesStr] = mes.split('-');
        const ano = parseInt(anoStr);
        const mesNum = parseInt(mesStr);

        const [contadores, porTipo, porUF, porRastreador, top5, novatosParceiros, resumoMensal] = await Promise.all([
            // Contadores — filtrados pelo mês selecionado
            dbAll(`SELECT
                COUNT(*) FILTER (WHERE is_frota = 0 OR is_frota IS NULL) AS marcaram_placa,
                COUNT(*) FILTER (WHERE status_operacional = 'EM OPERACAO') AS em_operacao,
                COUNT(*) FILTER (WHERE status_operacional IN ('CONTRATADO','EM VIAGEM','EM ROTA')) AS contratados
             FROM marcacoes_placas
             WHERE EXTRACT(YEAR FROM data_marcacao) = $1
             AND EXTRACT(MONTH FROM data_marcacao) = $2`, [ano, mesNum]),
            // Por tipo de veículo
            dbAll(`SELECT tipo_veiculo AS tipo, COUNT(*) AS total
             FROM marcacoes_placas WHERE is_frota = 0 OR is_frota IS NULL
             GROUP BY tipo_veiculo ORDER BY total DESC`),
            // Por UF — apenas disponíveis (excluindo contratados, em operação e indisponíveis)
            dbAll(`SELECT uf, COUNT(*) AS total FROM (
                SELECT jsonb_array_elements_text(estados_destino::jsonb) AS uf
                FROM marcacoes_placas
                WHERE (is_frota = 0 OR is_frota IS NULL)
                  AND (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
                  AND disponibilidade != 'Indisponível'
            ) t GROUP BY uf ORDER BY total DESC`),
            // Por rastreador
            dbAll(`SELECT
                COALESCE(rastreador, 'Não possui') AS rastreador,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status_rastreador = 'Ativo') AS ativos,
                COUNT(*) FILTER (WHERE status_rastreador = 'Inativo' OR status_rastreador IS NULL) AS inativos
             FROM marcacoes_placas WHERE is_frota = 0 OR is_frota IS NULL
             GROUP BY rastreador ORDER BY total DESC`),
            // Top 5 por viagens
            dbAll(`SELECT nome_motorista AS nome, viagens_realizadas AS viagens, favorito, tipo_veiculo
             FROM marcacoes_placas WHERE is_frota = 0 OR is_frota IS NULL
             ORDER BY viagens_realizadas DESC NULLS LAST LIMIT 5`),
            // Novatos e Parceiros
            dbAll(`SELECT
                COUNT(*) FILTER (WHERE ja_carregou = 'Nao' AND (viagens_realizadas IS NULL OR viagens_realizadas < 2)) AS novatos,
                COUNT(*) FILTER (WHERE NOT (ja_carregou = 'Nao' AND (viagens_realizadas IS NULL OR viagens_realizadas < 2)) AND (viagens_realizadas IS NULL OR viagens_realizadas < 2)) AS parceiros_baixo,
                COUNT(*) FILTER (WHERE viagens_realizadas >= 2) AS parceiros_alto
             FROM marcacoes_placas WHERE is_frota = 0 OR is_frota IS NULL`),
            // Resumo mensal — TO_CHAR garante que data chegue como string YYYY-MM-DD
            dbAll(`SELECT
                TO_CHAR(data_marcacao, 'YYYY-MM-DD') AS data,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status_operacional IS NULL OR status_operacional = 'DISPONIVEL') AS disponivel,
                COUNT(*) FILTER (WHERE status_operacional = 'EM OPERACAO') AS em_operacao,
                COUNT(*) FILTER (WHERE status_operacional IN ('CONTRATADO','EM VIAGEM','EM ROTA')) AS contratado
             FROM marcacoes_placas
             WHERE (is_frota = 0 OR is_frota IS NULL)
             AND EXTRACT(YEAR FROM data_marcacao) = $1
             AND EXTRACT(MONTH FROM data_marcacao) = $2
             GROUP BY TO_CHAR(data_marcacao, 'YYYY-MM-DD')
             ORDER BY data ASC`, [ano, mesNum]),
        ]);

        const c = contadores[0] || {};
        res.json({
            success: true,
            contadores: {
                marcaram_placa: parseInt(c.marcaram_placa || 0),
                em_operacao: parseInt(c.em_operacao || 0),
                contratados: parseInt(c.contratados || 0),
            },
            por_tipo_veiculo: porTipo.map(r => ({ tipo: r.tipo || 'Outros', total: parseInt(r.total) })),
            por_uf: porUF.map(r => ({ uf: r.uf, total: parseInt(r.total) })),
            por_rastreador: porRastreador.map(r => ({ rastreador: r.rastreador, total: parseInt(r.total), ativos: parseInt(r.ativos || 0), inativos: parseInt(r.inativos || 0) })),
            top5: top5.map(r => ({ nome: r.nome, viagens: parseInt(r.viagens || 0), favorito: !!r.favorito, tipo_veiculo: r.tipo_veiculo })),
            novatos_parceiros: {
                novatos: parseInt(novatosParceiros[0]?.novatos || 0),
                parceiros_baixo: parseInt(novatosParceiros[0]?.parceiros_baixo || 0),
                parceiros_alto: parseInt(novatosParceiros[0]?.parceiros_alto || 0),
            },
            resumo_mensal: resumoMensal.map(r => ({
                data: r.data,
                total: parseInt(r.total),
                disponivel: parseInt(r.disponivel || 0),
                em_operacao: parseInt(r.em_operacao || 0),
                contratado: parseInt(r.contratado || 0),
            })),
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Leitura de todas as marcações (autenticado) — com paginação e projeção de colunas
app.get('/api/marcacoes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        // Auto-delete de registros antigos (max 1x/hora)
        limparMarcacoesAntigas();

        const limite = Math.min(parseInt(req.query.limit) || 50, 200);
        const pagina = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (pagina - 1) * limite;

        const { disponibilidade, local, busca, estado, tipo_veiculo, tag, tempo_min, tempo_max } = req.query;
        const conditions = [];
        const params = [];

        // Filtro de status operacional (disponivel, indisponivel, contratado)
        if (disponibilidade === 'disponivel') {
            conditions.push(`disponibilidade NOT IN ('Indisponível', 'Contratado')`);
            conditions.push(`COALESCE(status_operacional,'') NOT IN ('EM OPERACAO','EM VIAGEM','EM ROTA','CONTRATADO')`);
        } else if (disponibilidade === 'indisponivel') {
            conditions.push(`disponibilidade = 'Indisponível'`);
        } else if (disponibilidade === 'contratado') {
            conditions.push(`(disponibilidade = 'Contratado' OR status_operacional IN ('EM OPERACAO','EM VIAGEM','EM ROTA','CONTRATADO'))`);
        } else if (['EM CASA','NO PÁTIO','NO POSTO'].includes(disponibilidade)) {
            params.push(disponibilidade);
            conditions.push(`disponibilidade = $${params.length}`);
        }

        // Filtro de local (NO PÁTIO, NO POSTO, EM CASA) — independente do status
        if (local && ['EM CASA','NO PÁTIO','NO POSTO'].includes(local)) {
            params.push(local);
            conditions.push(`disponibilidade = $${params.length}`);
        }

        if (busca && busca.trim()) {
            const b = busca.trim();
            const soDigitos = b.replace(/\D/g, '');
            params.push(`%${b}%`);
            let buscaCond = `unaccent(nome_motorista) ILIKE unaccent($${params.length})`;
            if (soDigitos.length >= 3) {
                params.push(`%${soDigitos}%`);
                buscaCond += ` OR telefone LIKE $${params.length}`;
            }
            conditions.push(`(${buscaCond})`);
        }

        if (estado && estado.trim()) {
            params.push(`%"${estado.trim()}"%`);
            conditions.push(`estados_destino::text ILIKE $${params.length}`);
        }

        if (tipo_veiculo && tipo_veiculo.trim()) {
            params.push(tipo_veiculo.trim());
            conditions.push(`tipo_veiculo = $${params.length}`);
        }

        if (tag === 'favorito') {
            conditions.push(`favorito = 1`);
        } else if (tag === 'problematico') {
            conditions.push(`tag_motorista = 'PROBLEMÁTICO'`);
        }

        if (tempo_min !== undefined && tempo_max !== undefined) {
            const minVal = parseInt(tempo_min);
            const maxVal = parseInt(tempo_max);
            if (!isNaN(minVal) && !isNaN(maxVal)) {
                // Tempo = data_contratacao - data_marcacao (se contratado) ou NOW() - data_marcacao
                // Igual ao cálculo exibido na coluna TEMPO do frontend (calcularTempoEspera)
                conditions.push(
                    `EXTRACT(EPOCH FROM (COALESCE(data_contratacao, NOW()) - data_marcacao)) / 60 >= ${minVal}` +
                    ` AND EXTRACT(EPOCH FROM (COALESCE(data_contratacao, NOW()) - data_marcacao)) / 60 < ${maxVal}`
                );
            }
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const dataParams = [...params, limite, offset];
        const countParams = [...params];

        const [rows, totalRow, contRow] = await Promise.all([
            dbAll(
                `SELECT id, token_id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                        altura, largura, comprimento, estados_destino, ja_carregou,
                        rastreador, status_rastreador, latitude, longitude, disponibilidade,
                        data_marcacao, data_contratacao, viagens_realizadas, status_operacional,
                        is_frota, situacao_cad, comprovante_pdf, anexo_cnh, anexo_doc_veiculo,
                        anexo_crlv_carreta, anexo_antt, anexo_outros, favorito, tag_motorista
                 FROM marcacoes_placas
                 ${whereClause}
                 ORDER BY data_marcacao DESC
                 LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
                dataParams
            ),
            dbAll(`SELECT COUNT(*) AS total FROM marcacoes_placas ${whereClause}`, countParams),
            dbAll(`SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL') AND disponibilidade != 'Indisponível') AS disponiveis,
                COUNT(*) FILTER (WHERE status_operacional = 'EM OPERACAO') AS em_operacao,
                COUNT(*) FILTER (WHERE status_operacional IN ('CONTRATADO','EM VIAGEM','EM ROTA')) AS contratados,
                COUNT(*) FILTER (WHERE disponibilidade = 'Indisponível') AS indisponiveis
             FROM marcacoes_placas ${whereClause}`, countParams)
        ]);

        const marcacoes = rows.map(r => ({
            ...r,
            estados_destino: JSON.parse(r.estados_destino || '[]')
        }));
        const total = parseInt(totalRow[0]?.total ?? 0);
        const c = contRow[0] || {};
        res.json({
            success: true, marcacoes, total, pagina, limite,
            contadores: {
                total: parseInt(c.total || 0),
                disponiveis: parseInt(c.disponiveis || 0),
                em_operacao: parseInt(c.em_operacao || 0),
                contratados: parseInt(c.contratados || 0),
                indisponiveis: parseInt(c.indisponiveis || 0),
            }
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Motoristas por UF de destino
app.get('/api/marcacoes/por-uf/:uf', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const uf = req.params.uf.toUpperCase();
        const rows = await dbAll(`
            SELECT nome_motorista, placa1, tipo_veiculo, status_operacional, disponibilidade, telefone, data_marcacao, data_contratacao
            FROM marcacoes_placas
            WHERE (is_frota IS NULL OR is_frota = 0)
              AND (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
              AND disponibilidade != 'Indisponível'
              AND estados_destino::text ILIKE $1
            ORDER BY nome_motorista
        `, [`%"${uf}"%`]);
        res.json({ success: true, uf, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Motoristas disponíveis (status DISPONIVEL, últimos 7 dias)
app.get('/api/marcacoes/disponiveis', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const semFiltroUnidade = ['Coordenador', 'Direção', 'Planejamento', 'Encarregado'].includes(req.user.cargo);
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
                   situacao_cad, num_liberacao_cad, data_liberacao_cad, seguradora_cad,
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

// Toggle favorito / tag_motorista
app.put('/api/marcacoes/:id/tag', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque']), async (req, res) => {
    try {
        const { favorito, tag_motorista } = req.body;
        const campos = [];
        const params = [];
        if (favorito !== undefined) { params.push(favorito ? 1 : 0); campos.push(`favorito = $${params.length}`); }
        if (tag_motorista !== undefined) { params.push(tag_motorista || null); campos.push(`tag_motorista = $${params.length}`); }
        if (campos.length === 0) return res.status(400).json({ success: false, message: 'Nenhum campo a atualizar' });
        params.push(req.params.id);
        await dbRun(`UPDATE marcacoes_placas SET ${campos.join(', ')} WHERE id = $${params.length}`, params);
        res.json({ success: true });
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

// ── PUT: Foto do motorista ────────────────────────────────────────
app.put('/api/marcacoes/:id/foto', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { foto } = req.body;
        if (foto && (!foto.startsWith('data:image/') || foto.length > 2 * 1024 * 1024)) {
            return res.status(400).json({ success: false, message: 'Imagem inválida ou muito grande (máx 2MB).' });
        }
        await dbRun('UPDATE marcacoes_placas SET foto = $1 WHERE id = $2', [foto || null, req.params.id]);
        io.emit('marcacao_atualizada', { tipo: 'foto_atualizada', id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT: Alterar Status de Disponibilidade (Fila) ────────────────
app.put('/api/marcacoes/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { status, status_operacional } = req.body;

        // Modo 1: status_operacional (fluxo Disponível → Em Operação → Contratado)
        if (status_operacional !== undefined) {
            const statusOpValidos = ['DISPONIVEL', 'EM OPERACAO', 'CONTRATADO'];
            if (!statusOpValidos.includes(status_operacional)) {
                return res.status(400).json({ success: false, message: 'status_operacional inválido.' });
            }
            await dbRun(
                `UPDATE marcacoes_placas SET status_operacional = $1 WHERE id = $2`,
                [status_operacional, req.params.id]
            );
            await registrarLog('MARCACAO_STATUS_OP', req.user?.nome || '?', req.params.id, 'marcacao', null, status_operacional, null);
            io.emit('marcacao_atualizada');
            return res.json({ success: true });
        }

        // Modo 2: disponibilidade (localização: EM CASA, NO PÁTIO, NO POSTO, Indisponível, Contratado)
        const statusValidos = ['Disponível', 'Contratado', 'Indisponível', 'EM CASA', 'NO PÁTIO', 'NO POSTO'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }

        const timestampDataContratacao = status === 'Contratado' ? obterDataHoraBrasilia() : null;

        await dbRun(`UPDATE marcacoes_placas SET disponibilidade = $1, data_contratacao = COALESCE(data_contratacao, $2) WHERE id = $3`, [status, timestampDataContratacao, req.params.id]);

        // Se mudou para disponível, zera a data de contratação
        if (status === 'Disponível') {
            await dbRun(`UPDATE marcacoes_placas SET data_contratacao = NULL WHERE id = $1`, [req.params.id]);
        }

        await registrarLog('MARCACAO_STATUS', req.user?.nome || '?', req.params.id, 'marcacao', null, status, null);
        io.emit('marcacao_atualizada');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Módulo Cadastro / Gerenciamento de Risco ─────────────────────────────────
app.get('/api/cadastro/motoristas', authMiddleware, authorize(['Coordenador', 'Direção', 'Encarregado', 'Cadastro', 'Conhecimento']), async (req, res) => {
    try {
        const isCoordenador = ['Coordenador', 'Direção'].includes(req.user.cargo);
        const cidade = req.user.cidade;
        const cidadeFilter = (!isCoordenador && cidade)
            ? "AND (origem_cidade_uf ILIKE $1 OR origem_cidade_uf IS NULL OR origem_cidade_uf = '')"
            : '';
        const params = (!isCoordenador && cidade) ? [`%${cidade}%`] : [];
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   disponibilidade, data_marcacao, data_contratacao, is_frota,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   comprovante_pdf, anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                   origem_cad, destino_uf_cad, destino_cidade_cad, origem_cidade_uf
            FROM marcacoes_placas
            WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
              AND (is_frota IS NULL OR is_frota = 0)
              ${cidadeFilter}
            ORDER BY data_marcacao DESC
        `, params);
        res.json({ success: true, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: listar motoristas de frota para o PainelCadastro ──
app.get('/api/cadastro/frota', authMiddleware, authorize(['Coordenador', 'Direção', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT id, nome_motorista, telefone, placa1, placa2, tipo_veiculo,
                   data_marcacao, data_contratacao,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   is_frota, foto
            FROM marcacoes_placas
            WHERE is_frota = 1
            ORDER BY nome_motorista ASC
        `);
        res.json({ success: true, motoristas: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: atualizar liberação ──
app.put('/api/cadastro/frota/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        const { num_liberacao_cad, seguradora_cad, data_liberacao_manual } = req.body;
        // data pode vir como data_liberacao_cad ou data_liberacao_manual (compatibilidade com frontend)
        const data_liberacao_cad = req.body.data_liberacao_cad || (data_liberacao_manual ? new Date(data_liberacao_manual).toISOString() : null) || null;

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
        res.json({ success: true, situacao: situacao_cad, data_liberacao_cad: data_liberacao_cad || null });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: excluir motorista de frota ──
app.delete('/api/cadastro/frota/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        await dbRun("DELETE FROM marcacoes_placas WHERE id = ? AND is_frota = 1", [req.params.id]);
        await registrarLog('FROTA_DELETADO', req.user?.nome || '?', req.params.id, 'frota', null, null, null);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cadastro/motoristas/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Encarregado', 'Cadastro']), async (req, res) => {
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
        const { dataInicio, dataFim, excluirProv } = req.query;
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
        const dInicio = dataInicio || hoje;
        const dFim = dataFim || hoje;
        const filtroProvisionamento = excluirProv === '1' ? `
              AND NOT EXISTS (
                SELECT 1 FROM prov_veiculos pv
                WHERE pv.ativo = 1
                  AND (pv.placa = m.placa1 OR pv.carreta = m.placa1
                    OR pv.placa = m.placa2 OR pv.carreta = m.placa2)
              )` : '';

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
              ${filtroProvisionamento}
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

        // Propagar numero_liberacao + origem/destino para ctes_ativos e notificar PainelCte em tempo real
        if (atual.motorista) {
            await dbRun(
                `UPDATE ctes_ativos SET
                    numero_liberacao = COALESCE($1, numero_liberacao),
                    data_liberacao = COALESCE($2, data_liberacao),
                    origem_cad = $3,
                    destino_uf_cad = $4,
                    destino_cidade_cad = $5
                 WHERE UPPER(TRIM(motorista)) = UPPER(TRIM($6)) AND status != 'Emitido'`,
                [num_liberacao_cad || null, novaDataLib, origem_cad || null, destino_uf_cad || null, destino_cidade_cad || null, atual.motorista]
            );


            const ctesMotorista = await dbAll(
                `SELECT id FROM ctes_ativos WHERE UPPER(TRIM(motorista)) = UPPER(TRIM($1)) AND status != 'Emitido'`,
                [atual.motorista]
            );
            for (const cte of ctesMotorista) {
                io.emit('receber_atualizacao', {
                    tipo: 'atualiza_cte',
                    id: cte.id,
                    numero_liberacao: num_liberacao_cad,
                    data_liberacao: novaDataLib,
                    origem_cad: origem_cad || null,
                    destino_uf_cad: destino_uf_cad || null,
                    destino_cidade_cad: destino_cidade_cad || null,
                });
            }
        }

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
app.post('/api/frota', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento']), async (req, res) => {
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
app.post('/api/historico-liberacoes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id } = req.body;
        if (!motorista_nome) return res.status(400).json({ success: false, message: 'motorista_nome é obrigatório' });

        const nomeLimpo = (motorista_nome || '').trim().toUpperCase();
        const primeira_letra = nomeLimpo[0] || '#';

        await dbRun(
            `INSERT INTO historico_liberacoes (primeira_letra, motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (motorista_nome, num_liberacao, num_coleta) DO NOTHING`,
            [primeira_letra, nomeLimpo, num_coleta || '', num_liberacao || '', datetime_cte || new Date().toISOString(), origem || '', destino_uf || '', destino_cidade || '', placa || '', operacao || '', veiculo_id || null]
        );

        // Se motorista for frota própria, registrar também no histórico de frota
        const ehFrota = await dbGet(
            'SELECT id FROM marcacoes_placas WHERE UPPER(nome_motorista) = $1 AND is_frota = 1 LIMIT 1',
            [nomeLimpo]
        );
        if (ehFrota) {
            await dbRun(
                `INSERT INTO historico_frota (primeira_letra, motorista_nome, placa, origem, destino, operacao, veiculo_id, data_viagem)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
                [primeira_letra, nomeLimpo, placa || '', origem || '',
                 `${destino_cidade || ''} - ${destino_uf || ''}`.replace(/^ - | - $/g, '').trim(),
                 operacao || '', veiculo_id || null, datetime_cte || new Date().toISOString()]
            );
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== HISTÓRICO FROTA PRÓPRIA ====================

app.get('/api/historico-frota', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { letra, motorista } = req.query;
        if (motorista) {
            const rows = await dbAll(
                `SELECT * FROM historico_frota WHERE motorista_nome = ? ORDER BY data_viagem DESC`,
                [motorista]
            );
            return res.json({ success: true, registros: rows });
        }
        if (letra) {
            const rows = await dbAll(
                `SELECT DISTINCT motorista_nome FROM historico_frota WHERE primeira_letra = ? ORDER BY motorista_nome`,
                [letra.toUpperCase()]
            );
            return res.json({ success: true, motoristas: rows.map(r => r.motorista_nome) });
        }
        const rows = await dbAll(
            `SELECT primeira_letra, COUNT(DISTINCT motorista_nome) as total_motoristas, COUNT(*) as total_viagens
             FROM historico_frota GROUP BY primeira_letra ORDER BY primeira_letra`
        );
        res.json({ success: true, letras: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/historico-frota', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Cadastro', 'Pos Embarque']), async (req, res) => {
    try {
        const { motorista_nome, placa, origem, destino, operacao, veiculo_id, data_viagem } = req.body;
        if (!motorista_nome) return res.status(400).json({ success: false, message: 'motorista_nome é obrigatório' });

        const nomeLimpo = (motorista_nome || '').trim().toUpperCase();
        const primeira_letra = nomeLimpo[0] || '#';

        await dbRun(
            `INSERT INTO historico_frota (primeira_letra, motorista_nome, placa, origem, destino, operacao, veiculo_id, data_viagem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [primeira_letra, nomeLimpo, placa || '', origem || '', destino || '', operacao || '', veiculo_id || null, data_viagem || new Date().toISOString()]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== FIM HISTÓRICO DE LIBERAÇÕES ====================

app.get('/fila', authMiddleware, authorize(['Coordenador', 'Direção', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const isCoordenador = ['Coordenador', 'Direção'].includes(req.user.cargo);
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
app.post('/fila', authMiddleware, authorize(['Coordenador', 'Direção', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
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
app.put('/fila/reordenar', authMiddleware, authorize(['Coordenador', 'Direção', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        const { ordem } = req.body;
        if (!Array.isArray(ordem)) return res.status(400).json({ success: false });
        await Promise.all(ordem.map(item => dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(item), item.id])));
        await registrarLog('FILA_REORDENADA', req.user?.nome || '?', null, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'reordenar_fila', ordem });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.put('/fila/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Aux. Operacional', 'Planejamento', 'Encarregado']), async (req, res) => {
    try {
        await dbRun(`UPDATE fila SET dados_json = ? WHERE id = ?`, [JSON.stringify(req.body), req.params.id]);
        await registrarLog('FILA_ATUALIZADA', req.user?.nome || '?', req.params.id, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'atualiza_fila', id: Number(req.params.id), ...req.body });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});
app.delete('/fila/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento']), async (req, res) => {
    try {
        await dbRun("DELETE FROM fila WHERE id = ?", [req.params.id]);
        await registrarLog('FILA_REMOVIDA', req.user?.nome || '?', req.params.id, 'fila', null, null, null);
        io.emit('receber_atualizacao', { tipo: 'remove_fila', id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Reenviar notificação de CT-e pendente para um operador específico
app.post('/api/cte/reenviar-notificacao', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Direção', 'Desenvolvedor']), async (req, res) => {
    try {
        const { veiculoId, destinatarioId, destinatarioNome, origem } = req.body;
        if (!veiculoId || !destinatarioId) return res.status(400).json({ success: false, message: 'veiculoId e destinatarioId são obrigatórios.' });

        const veiculo = await dbGet('SELECT * FROM veiculos WHERE id = $1', [veiculoId]);
        if (!veiculo) return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });

        let dados = {};
        try { dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : (veiculo.dados_json || {}); } catch {}

        const coletaValida = veiculo.coletarecife || veiculo.coletamoreno || veiculo.coletainterestadual || '';
        const motorista = veiculo.motorista?.trim();
        if (!motorista) return res.status(400).json({ success: false, message: 'Veículo sem motorista.' });

        const notif = await enviarNotificacao('notificacao_direcionada', {
            tipo: 'aceite_cte_pendente',
            origem: origem || dados.origem || 'Recife',
            destinatario_id: Number(destinatarioId),
            destinatario_nome: destinatarioNome || null,
            mensagem: `CT-e Liberado${coletaValida ? ` (${coletaValida})` : ` — ${motorista}`}`,
            dadosVeiculo: { ...dados, id: veiculo.id, motorista: veiculo.motorista, coletaRecife: veiculo.coletarecife, coletaMoreno: veiculo.coletamoreno, coletaInterestadual: veiculo.coletainterestadual },
            data_criacao: new Date().toISOString()
        });

        await registrarLog('CTE_REENVIO', req.user?.nome || '?', veiculoId, 'veiculos', null, null, `Reenvio para ${destinatarioNome || destinatarioId}`);
        res.json({ success: true, notificacao: notif });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
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
            // Exceções: tipos que atravessam unidades (doca, aceite_cte_pendente, admin_*) e quando é destinatário explícito
            const TIPOS_SEM_FILTRO_CIDADE = ['doca', 'aceite_cte_pendente', 'admin_senha', 'admin_cadastro'];
            const souDestinatarioExplicito = n.destinatario_id && n.destinatario_id === userId;
            if (n.origem && !['Coordenador', 'Direção'].includes(meuCargo) && minhaCidade && n.origem !== minhaCidade && !TIPOS_SEM_FILTRO_CIDADE.includes(n.tipo) && !souDestinatarioExplicito) return false;
            // notificacao_direcionada: filtrar por cargos_alvo E unidade
            if (n.cargos_alvo) {
                if (!n.cargos_alvo.includes(meuCargo)) return false;
            }
            // Excluir notificações sem mensagem (fantasmas)
            if (!n.mensagem || !String(n.mensagem).trim()) return false;
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
app.get('/ctes', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Conhecimento', 'Dashboard Viewer']), async (req, res) => {
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
                    coleta: row.coleta || dados.coletaRecife || limparPrefixoColeta(dados.coletaMoreno) || '',
                    numero_liberacao: row.numero_liberacao || dados.numero_liberacao || '',
                    data_liberacao: row.data_liberacao || dados.data_liberacao || null,
                    origem_cad: row.origem_cad || dados.origem_cad || '',
                    destino_uf_cad: row.destino_uf_cad || dados.destino_uf_cad || '',
                    destino_cidade_cad: row.destino_cidade_cad || dados.destino_cidade_cad || '',
                    usuario_aceitou: row.usuario_aceitou || dados.usuario_aceitou || '',
                    data_emissao: row.data_emissao || null
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
        const coletaFinal = dados.coletaInterestadual || dados.coletaRecife || limparPrefixoColeta(dados.coletaMoreno) || null;
        const result = await dbRun(
            `INSERT INTO ctes_ativos (origem, status, dados_json, motorista, placa1, coleta, numero_liberacao, data_liberacao, origem_cad, destino_uf_cad, destino_cidade_cad, usuario_aceitou)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                origem, status, JSON.stringify(dados),
                dados.motorista || null,
                dados.placa1Motorista || null,
                coletaFinal,
                dados.numero_liberacao || null,
                dados.data_liberacao || null,
                dados.origem_cad || null,
                dados.destino_uf_cad || null,
                dados.destino_cidade_cad || null,
                dados.usuario_aceitou || null
            ]
        );
        const novo = { id: result.lastID, origem, status, ...dados };
        await registrarLog('CTE_CRIADO', req.user?.nome || '?', result.lastID, 'cte', null, null, `Motorista: ${dados.motorista || '-'} | Coleta: ${coletaFinal || '-'}`);
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
        const { dados, origem } = req.body;
        const status = dados.status || 'Aguardando Emissão';
        const origemCte = origem || dados.origem || 'Recife';
        await dbRun(
            `INSERT INTO ctes_ativos (id, origem, status, dados_json, motorista, placa1, coleta, numero_liberacao, data_liberacao, origem_cad, destino_uf_cad, destino_cidade_cad, usuario_aceitou, data_emissao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CASE WHEN $3 = 'Emitido' THEN NOW() ELSE NULL END)
             ON CONFLICT (id) DO UPDATE SET
                status = $3, dados_json = $4, motorista = $5, placa1 = $6, coleta = $7,
                numero_liberacao = $8, data_liberacao = $9, origem_cad = $10,
                destino_uf_cad = $11, destino_cidade_cad = $12, usuario_aceitou = $13,
                data_emissao = CASE WHEN $3 = 'Emitido' THEN NOW() ELSE ctes_ativos.data_emissao END`,
            [
                req.params.id, origemCte, status, JSON.stringify(dados),
                dados.motorista || null,
                dados.placa1Motorista || null,
                dados.coletaRecife || limparPrefixoColeta(dados.coletaMoreno) || null,
                dados.numero_liberacao || null,
                dados.data_liberacao || null,
                dados.origem_cad || null,
                dados.destino_uf_cad || null,
                dados.destino_cidade_cad || null,
                dados.usuario_aceitou || null,
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
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                         ON CONFLICT (motorista_nome, num_liberacao, num_coleta) DO NOTHING`,
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
                    // Se motorista for frota própria, registrar também no histórico de frota
                    const ehFrotaCte = await dbGet(
                        'SELECT id FROM marcacoes_placas WHERE UPPER(nome_motorista) = $1 AND is_frota = 1 LIMIT 1',
                        [nomeLimpo]
                    );
                    if (ehFrotaCte) {
                        const destCte = `${cte.destino_cidade_cad || ''} - ${cte.destino_uf_cad || ''}`.replace(/^ - | - $/g, '').trim();
                        await dbRun(
                            `INSERT INTO historico_frota (primeira_letra, motorista_nome, placa, origem, destino, operacao, veiculo_id, data_viagem)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
                            [nomeLimpo[0] || '#', nomeLimpo, cte.placa1 || '', cte.origem || '',
                             destCte, dados.operacao || '', dados.id || null, new Date().toISOString()]
                        );
                    }
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

app.get('/cubagens/coleta/:numero', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Conferente', 'Adm Frota', 'Conhecimento']), async (req, res) => {
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
        const { numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, itens, metragem_total, valor_mix_total, valor_kit_total, valor_total, peso_total } = req.body;

        const cubagemId = await dbTransaction(async ({ run }) => {
            const result = await run(
                `INSERT INTO cubagens (numero_coleta, motorista, cliente, redespacho, nome_redespacho, destino, volume, data, faturado, tipo, metragem_total, valor_mix_total, valor_kit_total, valor_total, peso_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [numero_coleta, motorista, cliente, redespacho ? 1 : 0, nome_redespacho || '', destino, volume, data, faturado ? 1 : 0, tipo, metragem_total || 0, valor_mix_total || 0, valor_kit_total || 0, valor_total || 0, peso_total || 0]
            );

            const id = result.lastID;

            // Batch INSERT dos itens em uma única query
            const itensFiltrados = (itens || []).filter(item => item.numero_nf || item.metragem);
            if (itensFiltrados.length > 0) {
                const valores = itensFiltrados.map(item => {
                    const metro = parseFloat(item.metragem) || 0;
                    const base = metro + (metro * 0.10);
                    return [
                        id,
                        item.numero_nf || '',
                        metro,
                        (base / 2.5) / 1.3,
                        (base / 2.5) / 1.9,
                        item.uf || '',
                        item.regiao || '',
                        parseFloat(item.valor) || 0,
                        parseInt(item.volumes) || 0,
                        parseFloat(item.peso_kg) || 0,
                        item.redespacho_nome || null,
                        item.redespacho_uf || null,
                    ];
                });
                const placeholders = valores.map((_, i) => `($${i*12+1}, $${i*12+2}, $${i*12+3}, $${i*12+4}, $${i*12+5}, $${i*12+6}, $${i*12+7}, $${i*12+8}, $${i*12+9}, $${i*12+10}, $${i*12+11}, $${i*12+12})`).join(', ');
                await run(`INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit, uf, regiao, valor, volumes, peso_kg, redespacho_nome, redespacho_uf) VALUES ${placeholders}`, valores.flat());
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
                    return [
                        id,
                        item.numero_nf || '',
                        metro,
                        (base / 2.5) / 1.3,
                        (base / 2.5) / 1.9,
                        item.uf || '',
                        item.regiao || '',
                        parseFloat(item.valor) || 0,
                        parseInt(item.volumes) || 0,
                        parseFloat(item.peso_kg) || 0,
                        item.redespacho_nome || null,
                        item.redespacho_uf || null,
                    ];
                });
                const placeholders = valores.map((_, i) => `($${i*12+1}, $${i*12+2}, $${i*12+3}, $${i*12+4}, $${i*12+5}, $${i*12+6}, $${i*12+7}, $${i*12+8}, $${i*12+9}, $${i*12+10}, $${i*12+11}, $${i*12+12})`).join(', ');
                await run(`INSERT INTO cubagem_itens (cubagem_id, numero_nf, metragem, valor_mix, valor_kit, uf, regiao, valor, volumes, peso_kg, redespacho_nome, redespacho_uf) VALUES ${placeholders}`, valores.flat());
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
// loginLimiter aplicado diretamente no handler em src/routes/auth.js
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
        const senhaHash = await bcrypt.hash(senha, 10);
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

// Buscar usuário por nome (usado no fluxo de recuperação de senha — retorna apenas id e nome)
app.get('/usuarios/buscar', async (req, res) => {
    try {
        const { nome } = req.query;
        if (!nome || nome.trim().length < 3) return res.status(400).json({ success: false, message: 'Nome muito curto.' });
        const usuario = await dbGet("SELECT id, nome, email_pessoal_verificado FROM usuarios WHERE LOWER(nome) LIKE LOWER($1)", [`%${nome.trim()}%`]);
        if (!usuario) return res.json({ success: false, message: 'Usuário não encontrado.' });
        res.json({ success: true, id: usuario.id, nome: usuario.nome, temEmailPessoal: !!usuario.email_pessoal_verificado });
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
        // Só o próprio usuário ou um Coordenador/Direção pode salvar
        if (req.user.id !== idAlvo && !['Coordenador', 'Direção'].includes(req.user.cargo)) {
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
app.post('/usuarios/:id/gerar-token-reset', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
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
// Rota /reset-senha-token removida — fluxo WhatsApp substituído por e-mail automático (/solicitar-reset-senha)
// ── Logout server-side (revoga sessão no banco) ───────────────────────────────
app.post('/logout', authMiddleware, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await dbRun('UPDATE sessoes SET ativa = FALSE WHERE token_hash = $1', [tokenHash(token)]).catch(() => {});
        }
        res.json({ success: true });
    } catch (_) {
        res.json({ success: true }); // sempre retorna sucesso para não travar o cliente
    }
});

// ── E-mail pessoal para recuperação de senha ──────────────────────────────────
app.post('/usuarios/:id/email-pessoal', authMiddleware, async (req, res) => {
    try {
        const idAlvo = Number(req.params.id);
        if (req.user.id !== idAlvo && !['Coordenador', 'Direção'].includes(req.user.cargo)) {
            return res.status(403).json({ success: false, message: 'Sem permissão.' });
        }
        const { email_pessoal } = req.body;
        if (!email_pessoal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_pessoal)) {
            return res.status(400).json({ success: false, message: 'E-mail inválido.' });
        }
        await dbRun('UPDATE usuarios SET email_pessoal = $1, email_pessoal_verificado = 0 WHERE id = $2',
            [email_pessoal.toLowerCase(), idAlvo]);
        // Invalida tokens de verificação anteriores
        await dbRun("UPDATE email_verification_tokens SET usado = 1 WHERE usuario_id = $1 AND tipo = 'verificacao'", [idAlvo]);
        const token = crypto.randomUUID();
        const expira = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await dbRun(
            'INSERT INTO email_verification_tokens (usuario_id, token, tipo, expira_em) VALUES ($1, $2, $3, $4)',
            [idAlvo, token, 'verificacao', expira]
        );
        await sendVerificationEmail(email_pessoal, token);
        res.json({ success: true, message: 'E-mail de verificação enviado.' });
    } catch (e) {
        console.error('❌ [/email-pessoal]:', e);
        res.status(500).json({ success: false, message: 'Erro ao salvar e-mail.' });
    }
});

// Confirmar e-mail pessoal via link (rota pública — acessada pelo link no Gmail)
app.get('/verificar-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send(htmlSimples('❌ Token não fornecido.', 'error'));
        const reg = await dbGet(
            "SELECT * FROM email_verification_tokens WHERE token = $1 AND tipo = 'verificacao' AND usado = 0", [token]
        );
        if (!reg || new Date(reg.expira_em) < new Date()) {
            return res.send(htmlSimples('⚠️ Link inválido ou expirado. Solicite um novo e-mail de verificação.', 'warn'));
        }
        await dbRun('UPDATE usuarios SET email_pessoal_verificado = 1 WHERE id = $1', [reg.usuario_id]);
        await dbRun('UPDATE email_verification_tokens SET usado = 1 WHERE id = $1', [reg.id]);
        res.send(htmlSimples('✅ E-mail confirmado! Você já pode usar este e-mail para recuperar sua senha.', 'success'));
    } catch (e) {
        res.status(500).send(htmlSimples('Erro interno. Tente novamente.', 'error'));
    }
});

// Solicitar reset de senha por e-mail (público — substitui fluxo WhatsApp)
app.post('/solicitar-reset-senha', resetSenhaLimiter, async (req, res) => {
    const MSG = 'Se o e-mail estiver cadastrado e verificado, você receberá um link em breve.';
    try {
        const { email } = req.body;
        if (!email) return res.json({ success: true, message: MSG });
        const usuario = await dbGet("SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)", [email.trim()]);
        if (!usuario || !usuario.email_pessoal || !usuario.email_pessoal_verificado) {
            return res.json({ success: true, message: MSG });
        }
        // Invalida tokens de reset anteriores
        await dbRun("UPDATE email_verification_tokens SET usado = 1 WHERE usuario_id = $1 AND tipo = 'reset'", [usuario.id]);
        const token = crypto.randomUUID();
        const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await dbRun(
            'INSERT INTO email_verification_tokens (usuario_id, token, tipo, expira_em) VALUES ($1, $2, $3, $4)',
            [usuario.id, token, 'reset', expira]
        );
        await sendPasswordResetEmail(usuario.email_pessoal, token, usuario.nome);
        logger.audit('SOLICITAR_RESET_EMAIL', `ID:${usuario.id}`);
        res.json({ success: true, message: MSG });
    } catch (e) {
        console.error('❌ [/solicitar-reset-senha]:', e);
        res.json({ success: true, message: MSG }); // não revelar erro para evitar enumeração
    }
});

// Confirmar reset de senha via token do link de e-mail (público)
app.post('/confirmar-reset-senha', resetSenhaLimiter, async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios: token e novaSenha.' });
        }
        if (novaSenha.length < 8) {
            return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 8 caracteres.' });
        }
        const reg = await dbGet(
            "SELECT * FROM email_verification_tokens WHERE token = $1 AND tipo = 'reset' AND usado = 0", [token]
        );
        if (!reg || new Date(reg.expira_em) < new Date()) {
            return res.status(400).json({ success: false, message: 'Link inválido ou expirado.' });
        }
        const hash = await bcrypt.hash(novaSenha, 10);
        await dbRun('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, reg.usuario_id]);
        await dbRun('UPDATE email_verification_tokens SET usado = 1 WHERE id = $1', [reg.id]);
        // Revogar todas as sessões ativas do usuário após reset de senha
        await dbRun('UPDATE sessoes SET ativa = FALSE WHERE usuario_id = $1', [reg.usuario_id]);
        logger.audit('CONFIRMAR_RESET_EMAIL', `ID:${reg.usuario_id}`);
        res.json({ success: true, message: 'Senha alterada com sucesso! Faça login.' });
    } catch (e) {
        console.error('❌ [/confirmar-reset-senha]:', e);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ── Admin de sessões (force-logout — protegido por ADMIN_MASTER_PASSWORD) ─────
const adminAuth = (req, res, next) => {
    const key = req.query.key || req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_MASTER_PASSWORD) {
        return res.status(401).send(htmlSimples('⛔ Acesso negado. Chave inválida.', 'error'));
    }
    next();
};

const gerarHtmlSessoes = (sessoes, key) => {
    const linhas = sessoes.map(s => `
        <tr>
            <td>${s.nome || '—'}</td>
            <td>${s.cargo || '—'}</td>
            <td>${s.ip || '—'}</td>
            <td>${s.criada_em ? new Date(s.criada_em).toLocaleString('pt-BR') : '—'}</td>
            <td>${s.ultima_atividade ? new Date(s.ultima_atividade).toLocaleString('pt-BR') : '—'}</td>
            <td>
                <form method="POST" action="/admin/sessoes/revogar?key=${key}" style="display:inline">
                    <input type="hidden" name="sessao_id" value="${s.id}">
                    <button type="submit" style="background:#dc2626;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer">Revogar</button>
                </form>
                <form method="POST" action="/admin/sessoes/revogar-usuario?key=${key}" style="display:inline;margin-left:6px">
                    <input type="hidden" name="usuario_id" value="${s.usuario_id}">
                    <button type="submit" style="background:#7c3aed;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer">Revogar Todas</button>
                </form>
            </td>
        </tr>
    `).join('');
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Sessões Ativas — Transnet Admin</title>
    <style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
    h1{color:#38bdf8}table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #1e293b}
    th{background:#1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase}
    tr:hover td{background:#1e293b}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px}
    </style></head><body>
    <h1>🔐 Sessões Ativas — Transnet Admin</h1>
    <p style="color:#64748b">Total: <strong style="color:#e2e8f0">${sessoes.length}</strong> sessão(ões) ativa(s)</p>
    <table><thead><tr><th>Usuário</th><th>Cargo</th><th>IP</th><th>Criada em</th><th>Última Atividade</th><th>Ação</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="6" style="color:#64748b;text-align:center">Nenhuma sessão ativa</td></tr>'}</tbody></table>
    <p style="margin-top:24px"><a href="/admin/sessoes?key=${key}" style="color:#38bdf8">↻ Atualizar</a></p>
    </body></html>`;
};

app.get('/admin/sessoes', adminAuth, async (req, res) => {
    try {
        const sessoes = await dbAll(`
            SELECT s.id, s.usuario_id, u.nome, u.cargo, s.ip, s.criada_em, s.ultima_atividade
            FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.ativa = TRUE ORDER BY s.ultima_atividade DESC
        `);
        res.send(gerarHtmlSessoes(sessoes, req.query.key));
    } catch (e) {
        res.status(500).send(htmlSimples('Erro ao carregar sessões.', 'error'));
    }
});

app.post('/admin/sessoes/revogar', adminAuth, express.urlencoded({ extended: false }), async (req, res) => {
    const { sessao_id } = req.body;
    if (sessao_id) await dbRun('UPDATE sessoes SET ativa = FALSE WHERE id = $1', [sessao_id]).catch(() => {});
    res.redirect(`/admin/sessoes?key=${req.query.key}`);
});

app.post('/admin/sessoes/revogar-usuario', adminAuth, express.urlencoded({ extended: false }), async (req, res) => {
    const { usuario_id } = req.body;
    if (usuario_id) await dbRun('UPDATE sessoes SET ativa = FALSE WHERE usuario_id = $1', [Number(usuario_id)]).catch(() => {});
    res.redirect(`/admin/sessoes?key=${req.query.key}`);
});

app.get('/relatorios', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => { const rows = await dbAll("SELECT dados_json FROM historico"); res.json({ historico: rows.map(r => JSON.parse(r.dados_json)) }); });
app.post('/historico_cte', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => { await dbRun("INSERT INTO historico_cte (dados_json) VALUES (?)", [JSON.stringify(req.body)]); res.json({ success: true }); });
app.get('/relatorios_cte', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Conhecimento']), async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        const rows = await dbAll("SELECT dados_json FROM historico_cte ORDER BY id DESC");
        let registros = rows.map(r => { try { return JSON.parse(r.dados_json); } catch (_) { return null; } }).filter(Boolean);
        if (dataInicio) registros = registros.filter(r => r.data_registro >= dataInicio);
        if (dataFim) registros = registros.filter(r => r.data_registro <= dataFim);
        res.json({ success: true, registros });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Relatório CT-e — histórico_liberacoes com métricas de tempo, turno, heatmap e ociosidade
app.get('/api/relatorio/cte', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Conhecimento', 'Direção']), async (req, res) => {
    try {
        const { de, ate } = req.query;
        if (!de || !ate) return res.status(400).json({ success: false, message: 'Parâmetros de e ate obrigatórios.' });

        const rows = await dbAll(`
            SELECT
                hl.id, hl.motorista_nome, hl.num_coleta, hl.num_liberacao,
                hl.datetime_cte, hl.origem, hl.destino_uf, hl.destino_cidade,
                hl.operacao, hl.veiculo_id,
                v.data_criacao AS data_lancamento,
                EXTRACT(EPOCH FROM (hl.datetime_cte::timestamptz - v.data_criacao::timestamptz)) / 3600.0 AS horas_lancamento_cte
            FROM historico_liberacoes hl
            LEFT JOIN veiculos v ON v.id = hl.veiculo_id
            WHERE hl.datetime_cte::timestamptz >= $1::date AND hl.datetime_cte::timestamptz < ($2::date + interval '1 day')
            ORDER BY hl.datetime_cte ASC
        `, [de, ate]);

        // Heatmap: dia da semana × hora (fuso Recife = UTC-3)
        const heatmapRows = await dbAll(`
            SELECT
                EXTRACT(DOW FROM datetime_cte::timestamptz AT TIME ZONE 'America/Recife')::int AS dia_semana,
                EXTRACT(HOUR FROM datetime_cte::timestamptz AT TIME ZONE 'America/Recife')::int AS hora,
                COUNT(*)::int AS qtd
            FROM historico_liberacoes
            WHERE datetime_cte::timestamptz >= $1::date AND datetime_cte::timestamptz < ($2::date + interval '1 day')
            GROUP BY dia_semana, hora
            ORDER BY dia_semana, hora
        `, [de, ate]);

        function turno(dtStr) {
            if (!dtStr) return 'Indefinido';
            const h = new Date(dtStr).getHours();
            if (h >= 6 && h < 12) return 'Manhã';
            if (h >= 12 && h < 18) return 'Tarde';
            return 'Noite';
        }

        const registros = rows.map(row => ({
            id: row.id,
            motorista: row.motorista_nome,
            num_coleta: row.num_coleta || '',
            num_liberacao: row.num_liberacao || '',
            datetime_cte: row.datetime_cte,
            data_lancamento: row.data_lancamento || null,
            horas_lancamento_cte: row.horas_lancamento_cte !== null ? parseFloat(parseFloat(row.horas_lancamento_cte).toFixed(2)) : null,
            origem: row.origem || '',
            destino_uf: row.destino_uf || '',
            destino_cidade: row.destino_cidade || '',
            operacao: row.operacao || '',
            turno: turno(row.datetime_cte),
        }));

        // Ociosidade/gargalo por unidade — gaps entre CT-es consecutivos
        const ociosidade = {};
        for (const unidade of ['Recife', 'Moreno']) {
            const ctesDaUnidade = rows
                .filter(r => r.origem === unidade && r.datetime_cte)
                .map(r => new Date(r.datetime_cte).getTime())
                .sort((a, b) => a - b);

            let maxGap = 0;
            let gapsAcima2h = 0;
            for (let i = 1; i < ctesDaUnidade.length; i++) {
                const gapH = (ctesDaUnidade[i] - ctesDaUnidade[i - 1]) / 3600000;
                if (gapH > maxGap) maxGap = gapH;
                if (gapH > 2) gapsAcima2h++;
            }
            ociosidade[unidade] = {
                max_gap_horas: ctesDaUnidade.length > 1 ? parseFloat(maxGap.toFixed(2)) : null,
                gaps_acima_2h: gapsAcima2h,
                total: ctesDaUnidade.length,
            };
        }

        res.json({
            success: true,
            registros,
            heatmap: heatmapRows,
            ociosidade,
        });
    } catch (e) {
        console.error('Erro ao buscar relatório CT-e:', e);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});

// Endpoint para atualizar status de CT-e com auditoria
app.put('/cte/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Conhecimento']), async (req, res) => {
    try {
        const { cteId, statusAntigo, statusNovo, origem, coleta } = req.body;

        // Resolve o veículo correspondente ao CT-e (cteId é id da ctes_ativos, não de veiculos)
        const cteRowBase = await dbGet("SELECT motorista FROM ctes_ativos WHERE id = $1", [cteId]);
        const nomeMotoristaBase = cteRowBase?.motorista;
        const veiculoBase = nomeMotoristaBase
            ? await dbGet("SELECT id FROM veiculos WHERE LOWER(TRIM(motorista)) = LOWER(TRIM($1)) ORDER BY id DESC LIMIT 1", [nomeMotoristaBase])
            : null;
        const veiculoIdReal = veiculoBase?.id;

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
                // Reutiliza veiculoIdReal e nomeMotoristaBase resolvidos no início do handler
                const veiculoId = veiculoIdReal;
                const nomeMotorista = nomeMotoristaBase;
                const veiculo = veiculoId ? { id: veiculoId, motorista: nomeMotorista } : null;
                if (veiculo && veiculo.motorista) {
                    const dadosVeiculo = veiculoId
                        ? await dbGet("SELECT dados_json FROM veiculos WHERE id = $1", [veiculoId])
                        : null;
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
                    if (veiculoId) {
                        await dbRun("UPDATE veiculos SET status_cte = 'Emitido' WHERE id = $1", [veiculoId]);
                        console.log(`✅ [CT-e] status_cte = 'Emitido' gravado no veículo id=${veiculoId}`);
                    } else {
                        console.warn(`⚠️ [CT-e] Veículo não encontrado para motorista "${nomeMotorista}" — status_cte não gravado`);
                    }
                } catch (errStatus) {
                    console.error('Erro ao gravar status_cte no veículo:', errStatus);
                }

                // Se motorista é FROTA, salvar no histórico de frota
                try {
                    const veiculoFull = veiculoId
                        ? await dbGet("SELECT motorista, operacao, placa, dados_json FROM veiculos WHERE id = $1", [veiculoId])
                        : null;
                    if (veiculoFull) {
                        let djFrota = {};
                        try { djFrota = JSON.parse(veiculoFull.dados_json || '{}'); } catch (_) {}
                        const isFrota = String(djFrota.isFrotaMotorista) === 'true' || String(djFrota.isFrotaMotorista) === '1';
                        if (isFrota && veiculoFull.motorista) {
                            const nomeLimpo = veiculoFull.motorista.trim().toUpperCase();
                            const primeiraLetraFrota = nomeLimpo[0] || '#';
                            const placaFrota = djFrota.placa1Motorista || veiculoFull.placa || '';
                            const origemFrota = djFrota.origem_frota || '';
                            const destinoFrota = djFrota.destino_frota || '';
                            await dbRun(
                                `INSERT INTO historico_frota (primeira_letra, motorista_nome, placa, origem, destino, operacao, veiculo_id, data_viagem)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [primeiraLetraFrota, nomeLimpo, placaFrota, origemFrota, destinoFrota, veiculoFull.operacao || '', veiculoId, new Date().toISOString()]
                            );
                            console.log(`📋 [Histórico Frota] ${nomeLimpo} | Placa: ${placaFrota} | ${origemFrota} → ${destinoFrota}`);
                        }
                    }
                } catch (errFrota) {
                    console.error('⚠️ Erro ao salvar histórico frota:', errFrota);
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
            if (veiculoIdReal) {
                await dbRun("UPDATE veiculos SET status_cte = $1 WHERE id = $2", [statusNovo, veiculoIdReal]);
                console.log(`✅ [CT-e] status_cte = '${statusNovo}' gravado no veículo id=${veiculoIdReal}`);
            }
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
        if (veiculoIdReal) {
            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(veiculoIdReal), status_cte: statusNovo });
        }

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

        // Bloquear checklist duplicado — conferente não pode enviar novo sem reset do Coordenador
        const chkExistente = await dbGet(
            "SELECT id, status FROM checklists_carreta WHERE veiculo_id = ? AND status IN ('PENDENTE', 'APROVADO') LIMIT 1",
            [veiculo_id]
        );
        if (chkExistente) {
            return res.status(400).json({
                success: false,
                message: chkExistente.status === 'APROVADO'
                    ? 'Este veículo já possui checklist aprovado.'
                    : 'Este veículo já possui checklist pendente de aprovação. Aguarde a revisão.'
            });
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
            Plástico:     { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
            Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
        };

        let rows;
        const listaVeiculos = []; // snapshot individual para aba de motoristas

        const resolverCliente = (operacao) => {
            const op = (operacao || '').toUpperCase();
            if (op.includes('/')) return 'Consolidados';
            if (op.includes('PLÁSTICO') || op.includes('PLASTICO') || op.includes('DELTA')) return 'Plástico';
            if (op.includes('PORCELANA')) return 'Porcelana';
            if (op.includes('ELETRIK')) return 'Eletrik';
            return 'Consolidados';
        };

        if (turno === 'Inicial') {
            rows = await dbAll(`
                SELECT id, unidade, operacao, data_prevista, data_prevista_original, data_criacao,
                       foi_reprogramado, motorista, placa, coletaRecife, coletaMoreno, coleta, numero_coleta, dados_json
                FROM veiculos
                WHERE LEFT(data_prevista, 10) = ?
                  AND NOT (
                    COALESCE(status_recife,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO')
                    AND COALESCE(status_moreno,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO')
                  )
            `, [hojeStr]);

            rows.forEach(v => {
                const cliente = resolverCliente(v.operacao);
                const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';

                // Lógica híbrida: flag explícita OU comparação de datas (mantém compatibilidade com registros antigos)
                const foiReprogramado =
                    v.foi_reprogramado === 1 || v.foi_reprogramado === true
                    || (v.data_prevista_original
                        ? v.data_prevista_original.substring(0, 10) !== v.data_prevista.substring(0, 10)
                        : (v.data_criacao && v.data_criacao.substring(0, 10) < v.data_prevista.substring(0, 10)));

                if (foiReprogramado) {
                    totais[cliente][`reprogramado_${un}`] += 1;
                } else {
                    totais[cliente][un] += 1;
                }

                let dj = {}; try { dj = JSON.parse(v.dados_json || '{}'); } catch {}
                const placaExibir = dj.placa1Motorista || v.placa || '';
                const placa2Exibir = dj.placa2Motorista || '';
                listaVeiculos.push({
                    id: v.id,
                    motorista: v.motorista || '',
                    placa: [placaExibir, placa2Exibir].filter(Boolean).join(' / '),
                    operacao: v.operacao || '',
                    cliente,
                    unidade: v.unidade || '',
                    coleta: v.coletaRecife || limparPrefixoColeta(v.coletaMoreno) || v.coleta || v.numero_coleta || '',
                    reprogramado: foiReprogramado ? 1 : 0,
                });
            });

        } else { // Final
            rows = await dbAll(`
                SELECT id, unidade, operacao, motorista, placa, coletaRecife, coletaMoreno, coleta, numero_coleta, dados_json
                FROM veiculos
                WHERE LEFT(data_prevista, 10) = ?
                  AND NOT (
                    COALESCE(status_recife,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue')
                    AND COALESCE(status_moreno,'') IN ('FINALIZADO','Despachado','Em Trânsito','Entregue')
                  )
            `, [hojeStr]);

            rows.forEach(v => {
                const cliente = resolverCliente(v.operacao);
                const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';
                totais[cliente][un] += 1;

                let dj2 = {}; try { dj2 = JSON.parse(v.dados_json || '{}'); } catch {}
                const placaEx2 = dj2.placa1Motorista || v.placa || '';
                const placa2Ex2 = dj2.placa2Motorista || '';
                listaVeiculos.push({
                    id: v.id,
                    motorista: v.motorista || '',
                    placa: [placaEx2, placa2Ex2].filter(Boolean).join(' / '),
                    operacao: v.operacao || '',
                    cliente,
                    unidade: v.unidade || '',
                    coleta: v.coletaRecife || limparPrefixoColeta(v.coletaMoreno) || v.coleta || v.numero_coleta || '',
                    reprogramado: 0,
                });
            });
        }

        // Idempotência: apagar snapshot anterior do mesmo (data, turno)
        await dbRun(
            'DELETE FROM frota_programacao_diaria WHERE data_referencia = ? AND turno = ?',
            [hojeStr, turno]
        );

        const dados_json = JSON.stringify({ ...totais, _veiculos: listaVeiculos });
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
                        [`%"motorista":"${nome.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_')}"%`]
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
                        [`%"motorista":"${nome.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_')}"%`]
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

// ── PAUSA AUTOMÁTICA: 21:50 BRT — pausa todos os cards "EM SEPARAÇÃO" ────────
cron.schedule('50 21 * * *', async () => {
    console.log('[CRON-PAUSA] 21:50 — pausando todos os veículos EM SEPARAÇÃO...');
    try {
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
        const veiculos = await dbAll(
            `SELECT id, status_recife, status_moreno, pausas_status FROM veiculos
             WHERE data_prevista = ? AND (status_recife = 'EM SEPARAÇÃO' OR status_moreno = 'EM SEPARAÇÃO')`,
            [hoje]
        );
        let pausados = 0;
        for (const v of veiculos) {
            const pausas = JSON.parse(v.pausas_status || '[]');
            const unidades = [];
            if (v.status_recife === 'EM SEPARAÇÃO') unidades.push('Recife');
            if (v.status_moreno === 'EM SEPARAÇÃO') unidades.push('Moreno');
            for (const unidade of unidades) {
                const jaAtiva = pausas.find(p => p.unidade === unidade && p.fonte === 'operacao' && p.fim === null);
                if (!jaAtiva) {
                    pausas.push({ inicio: new Date().toISOString(), fim: null, motivo: 'Pausa automática 21:50', unidade, fonte: 'operacao' });
                    pausados++;
                }
            }
            await dbRun('UPDATE veiculos SET pausas_status = ? WHERE id = ?', [JSON.stringify(pausas), v.id]);
            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(v.id) });
        }
        console.log(`[CRON-PAUSA] ${pausados} pausa(s) aplicada(s) em ${veiculos.length} veículo(s).`);
    } catch (e) {
        console.error('[CRON-PAUSA] Erro:', e);
    }
}, { scheduled: true, timezone: 'America/Sao_Paulo' });

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

// ── Provisionamento de Frota ─────────────────────────────────────────────────

const PROV_EDITORES = ['Coordenador', 'Direção', 'Planejamento', 'Adm Frota', 'Manutenção'];
const STATUS_VIAGEM_PROV = ['EM_VIAGEM', 'EM_VIAGEM_FRETE_RETORNO', 'AGUARDANDO_FRETE_RETORNO', 'RETORNANDO', 'CARREGANDO', 'PUXADA', 'TRANSFERENCIA', 'PROJETO_SUL', 'PROJETO_SP'];

// GET /api/provisionamento/veiculos — listar veículos ativos
app.get('/api/provisionamento/veiculos', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM prov_veiculos WHERE ativo = 1 ORDER BY ordem ASC, id ASC');
        res.json({ success: true, veiculos: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/provisionamento/veiculos — cadastrar veículo
app.post('/api/provisionamento/veiculos', authMiddleware, authorize(PROV_EDITORES), async (req, res) => {
    try {
        const { placa, carreta, tipo_veiculo, modelo, motorista, ordem } = req.body;
        if (!placa || !tipo_veiculo) return res.status(400).json({ success: false, message: 'Placa e tipo_veiculo são obrigatórios.' });
        const r = await dbRun(
            'INSERT INTO prov_veiculos (placa, carreta, tipo_veiculo, modelo, motorista, ordem) VALUES ($1,$2,$3,$4,$5,$6)',
            [placa.trim().toUpperCase(), (carreta || '').trim().toUpperCase() || null, tipo_veiculo, modelo || null, motorista || null, ordem || 0]
        );
        res.json({ success: true, id: r.lastID || r.insertId });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/provisionamento/veiculos/:id — editar veículo
app.put('/api/provisionamento/veiculos/:id', authMiddleware, authorize(PROV_EDITORES), async (req, res) => {
    try {
        const { placa, carreta, tipo_veiculo, modelo, motorista, ordem } = req.body;
        await dbRun(
            'UPDATE prov_veiculos SET placa=$1, carreta=$2, tipo_veiculo=$3, modelo=$4, motorista=$5, ordem=$6 WHERE id=$7',
            [placa.trim().toUpperCase(), (carreta || '').trim().toUpperCase() || null, tipo_veiculo, modelo || null, motorista || null, ordem || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/provisionamento/veiculos/:id — inativar (soft delete)
app.delete('/api/provisionamento/veiculos/:id', authMiddleware, authorize(PROV_EDITORES), async (req, res) => {
    try {
        await dbRun('UPDATE prov_veiculos SET ativo = 0 WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/provisionamento/semana?inicio=YYYY-MM-DD — grade completa da semana
app.get('/api/provisionamento/semana', authMiddleware, async (req, res) => {
    try {
        const { inicio } = req.query;
        if (!inicio) return res.status(400).json({ success: false, message: 'Parâmetro inicio (YYYY-MM-DD) obrigatório.' });

        // Calcular os 7 dias
        const dias = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(inicio + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() + i);
            dias.push(d.toISOString().substring(0, 10));
        }

        const veiculos = await dbAll('SELECT * FROM prov_veiculos WHERE ativo = 1 ORDER BY ordem ASC, id ASC');
        const progs = await dbAll(
            'SELECT veiculo_id, data::text as data, status, destino, motorista, destinos_json FROM prov_programacao WHERE data >= $1 AND data <= $2',
            [dias[0], dias[6]]
        );

        // Montar mapa de programação
        const programacao = {};
        for (const p of progs) {
            if (!programacao[p.veiculo_id]) programacao[p.veiculo_id] = {};
            programacao[p.veiculo_id][p.data] = { status: p.status, destino: p.destino, motorista: p.motorista || null, destinos_json: p.destinos_json || null };
        }

        // Calcular totalizadores por dia
        const TIPOS_PROV = ['TRUCK', '3/4', 'CONJUNTO', 'CARRETA'];
        const tipoVeiculo = (v) => {
            const t = v.tipo_veiculo || '';
            if (t === 'TRUCK') return 'TRUCK';
            if (t === '3/4') return '3/4';
            if (t === 'CONJUNTO') return 'CONJUNTO';
            if (t === 'CARRETA' || t.toUpperCase().includes('CARRETA')) return 'CARRETA';
            return 'OUTROS';
        };
        const totais = {};
        for (const dia of dias) {
            let disponiveis = 0, manutencao = 0, em_viagem = 0, carregando = 0, em_operacao = 0, outros = 0, trucks = 0, carretas = 0, tres_quartos = 0;
            const breakdown = {
                disponiveis:  { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
                em_operacao:  { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
                em_viagem:    { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
                carregando:   { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
                manutencao:   { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
                outros:       { TRUCK: 0, '3/4': 0, CONJUNTO: 0, CARRETA: 0 },
            };
            for (const v of veiculos) {
                const st = (programacao[v.id]?.[dia]?.status) || 'DISPONIVEL';
                const tipo = tipoVeiculo(v);
                if (st === 'DISPONIVEL') {
                    disponiveis++;
                    if (tipo === 'TRUCK') trucks++;
                    else if (tipo === 'CONJUNTO' || tipo === 'CARRETA') carretas++;
                    else if (tipo === '3/4') tres_quartos++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.disponiveis[tipo]++;
                } else if (st === 'MANUTENCAO') {
                    manutencao++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.manutencao[tipo]++;
                } else if (['EM_VIAGEM', 'EM_VIAGEM_FRETE_RETORNO', 'AGUARDANDO_FRETE_RETORNO', 'RETORNANDO', 'PUXADA', 'TRANSFERENCIA', 'PROJETO_SUL', 'PROJETO_SP'].includes(st)) {
                    em_viagem++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.em_viagem[tipo]++;
                } else if (st === 'EM_OPERACAO') {
                    em_operacao++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.em_operacao[tipo]++;
                } else if (st === 'CARREGANDO') {
                    carregando++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.carregando[tipo]++;
                } else {
                    outros++;
                    if (TIPOS_PROV.includes(tipo)) breakdown.outros[tipo]++;
                }
            }
            totais[dia] = { disponiveis, manutencao, em_viagem, em_operacao, carregando, outros, trucks, carretas, tres_quartos, total: veiculos.length, breakdown };
        }

        res.json({ success: true, veiculos, dias, programacao, totais });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/provisionamento/status — UPSERT status de uma célula
app.put('/api/provisionamento/status', authMiddleware, authorize(PROV_EDITORES), async (req, res) => {
    try {
        const { veiculo_id, data, status, destino } = req.body;
        if (!veiculo_id || !data || !status) return res.status(400).json({ success: false, message: 'veiculo_id, data e status são obrigatórios.' });
        await dbRun(
            `INSERT INTO prov_programacao (veiculo_id, data, status, destino)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (veiculo_id, data) DO UPDATE SET status = $3, destino = $4`,
            [veiculo_id, data, status, destino || null]
        );

        const veiculo = await dbGet(`SELECT placa FROM prov_veiculos WHERE id = $1`, [veiculo_id]);
        const placa = veiculo?.placa || null;

        io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id, data, status, destino: destino || null, placa });

        // Sincronizar com frota_roteirizacoes se houver roteirização ativa com esta placa
        if (placa) {
            const PROV_PARA_FROTA = {
                EM_OPERACAO: 'EM_OPERACAO', CARREGANDO: 'CARREGANDO', CARREGADO: 'CARREGADO',
                EM_VIAGEM: 'EM_VIAGEM', RETORNANDO: 'RETORNANDO', MANUTENCAO: 'MANUTENCAO',
            };
            const statusFrota = PROV_PARA_FROTA[status];
            if (statusFrota) {
                try {
                    const rot = await dbGet(
                        `SELECT id FROM frota_roteirizacoes
                         WHERE (LOWER(placa_cavalo) = LOWER($1) OR LOWER(placa_carreta) = LOWER($1))
                           AND status NOT IN ('CONCLUIDO')
                         ORDER BY id DESC LIMIT 1`,
                        [placa]
                    );
                    if (rot) {
                        await dbRun(
                            `UPDATE frota_roteirizacoes SET status=$1, atualizado_em=NOW() WHERE id=$2`,
                            [statusFrota, rot.id]
                        );
                        const rotAtualizada = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [rot.id]);
                        let destinos = [];
                        try { destinos = JSON.parse(rotAtualizada.destinos_json || '[]'); } catch {}
                        io.emit('receber_atualizacao', {
                            tipo: 'roteirizacao_atualizada', acao: 'status',
                            roteirizacao: { ...rotAtualizada, destinos, status_manual: rotAtualizada.status }
                        });
                    }
                } catch (syncErr) {
                    console.warn('⚠️ [Sync Frota] Erro ao propagar status prov→frota:', syncErr.message);
                }
            }
        }

        if (status === 'MANUTENCAO') {
            const placaNot = placa || `#${veiculo_id}`;
            await enviarNotificacao('receber_alerta', {
                tipo: 'veiculo_manutencao',
                mensagem: `Veículo ${placaNot} está em manutenção`,
                placa: placaNot,
                veiculo_id,
                data,
                data_criacao: new Date().toISOString(),
            });
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/provisionamento/viagem — Registra dias EM_VIAGEM para um veículo do provisionamento
// body: { veiculo_id, motorista, data_saida (YYYY-MM-DD), entradas: [{ cidade, data (YYYY-MM-DD) }] }
app.post('/api/provisionamento/viagem', authMiddleware, async (req, res) => {
    try {
        const { veiculo_id, motorista, data_saida, data_retorno, entradas } = req.body;
        if (!veiculo_id || !data_saida || !Array.isArray(entradas) || entradas.length === 0) {
            return res.status(400).json({ success: false, message: 'veiculo_id, data_saida e entradas são obrigatórios.' });
        }
        // Determinar intervalo de viagem: data_saida até max(entradas[].data)
        const datasEntrega = entradas.map(e => e.data).filter(Boolean).sort();
        const dataFimViagem = datasEntrega[datasEntrega.length - 1] || data_saida;
        const destinosJson = JSON.stringify(entradas);

        // Gerar dias de viagem [data_saida, dataFimViagem] — todos EM_VIAGEM
        // Os dias anteriores a data_saida (CARREGADO) não são tocados aqui.
        const diasViagem = [];
        const cursorV = new Date(data_saida + 'T00:00:00Z');
        const fimV = new Date(dataFimViagem + 'T00:00:00Z');
        while (cursorV <= fimV) {
            diasViagem.push(cursorV.toISOString().substring(0, 10));
            cursorV.setUTCDate(cursorV.getUTCDate() + 1);
        }

        for (const dia of diasViagem) {
            // Destino preenchido apenas nos dias que coincidem com alguma entrada que tem cidade
            const cidadesDoDia = entradas
                .filter(e => e.data === dia && e.cidade && e.cidade.trim())
                .map(e => e.cidade.trim());
            const destinoDia = cidadesDoDia.length > 0 ? [...new Set(cidadesDoDia)].join(' / ') : null;
            await dbRun(
                `INSERT INTO prov_programacao (veiculo_id, data, status, motorista, destino, destinos_json)
                 VALUES ($1, $2, 'EM_VIAGEM', $3, $4, $5)
                 ON CONFLICT (veiculo_id, data) DO UPDATE SET status = 'EM_VIAGEM', motorista = $3, destino = $4, destinos_json = $5`,
                [veiculo_id, dia, motorista || null, destinoDia, destinosJson]
            );
            io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id, data: dia, status: 'EM_VIAGEM', motorista: motorista || null, destino: destinoDia });
        }

        // Gerar dias de retorno (dia seguinte ao último destino até o dia ANTERIOR ao retorno) — RETORNANDO
        // O próprio dia de retorno fica DISPONIVEL
        let diasRetorno = 0;
        if (data_retorno && data_retorno > dataFimViagem) {
            const cursorR = new Date(dataFimViagem + 'T00:00:00Z');
            cursorR.setUTCDate(cursorR.getUTCDate() + 1); // começa no dia seguinte ao último destino
            const fimR = new Date(data_retorno + 'T00:00:00Z');
            while (cursorR < fimR) {
                const dia = cursorR.toISOString().substring(0, 10);
                await dbRun(
                    `INSERT INTO prov_programacao (veiculo_id, data, status, motorista, destino, destinos_json)
                     VALUES ($1, $2, 'RETORNANDO', $3, NULL, $4)
                     ON CONFLICT (veiculo_id, data) DO UPDATE SET status = 'RETORNANDO', motorista = $3, destino = NULL, destinos_json = $4`,
                    [veiculo_id, dia, motorista || null, destinosJson]
                );
                io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id, data: dia, status: 'RETORNANDO', motorista: motorista || null, destino: null });
                cursorR.setUTCDate(cursorR.getUTCDate() + 1);
                diasRetorno++;
            }
            // Dia de retorno = DISPONIVEL
            await dbRun(
                `INSERT INTO prov_programacao (veiculo_id, data, status, motorista, destino, destinos_json)
                 VALUES ($1, $2, 'DISPONIVEL', $3, NULL, $4)
                 ON CONFLICT (veiculo_id, data) DO UPDATE SET status = 'DISPONIVEL', motorista = $3, destino = NULL, destinos_json = $4`,
                [veiculo_id, data_retorno, motorista || null, destinosJson]
            );
            io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id, data: data_retorno, status: 'DISPONIVEL', motorista: motorista || null, destino: null });
            diasRetorno++;
        }

        res.json({ success: true, dias_afetados: diasViagem.length + diasRetorno });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/provisionamento/dashboard?data=YYYY-MM-DD — contagens por status e tipo para o dia
app.get('/api/provisionamento/dashboard', authMiddleware, async (req, res) => {
    try {
        const data = req.query.data || new Date().toISOString().substring(0, 10);
        const veiculos = await dbAll('SELECT * FROM prov_veiculos WHERE ativo = 1');
        const progs = await dbAll(
            'SELECT veiculo_id, status, destino, destinos_json, motorista, observacao FROM prov_programacao WHERE data = $1',
            [data]
        );
        const progMap = {};
        for (const p of progs) progMap[p.veiculo_id] = p;

        // Para cada veículo, determinar status efetivo no dia
        const resultado = veiculos.map(v => {
            const p = progMap[v.id];
            return {
                id: v.id,
                placa: v.placa,
                carreta: v.carreta || null,
                tipo_veiculo: v.tipo_veiculo,
                motorista: p?.motorista || v.motorista || null,
                status: p?.status || 'DISPONIVEL',
                destino: p?.destino || null,
                destinos_json: p?.destinos_json || null,
                observacao: p?.observacao || '',
            };
        });

        res.json({ success: true, data, veiculos: resultado });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/provisionamento/obs — observação por veículo/dia
app.put('/api/provisionamento/obs', authMiddleware, async (req, res) => {
    try {
        const { veiculo_id, data, observacao } = req.body;
        if (!veiculo_id || !data) return res.status(400).json({ success: false, message: 'veiculo_id e data obrigatórios' });
        await dbRun(
            `INSERT INTO prov_programacao (veiculo_id, data, status, observacao)
             VALUES ($1, $2, 'DISPONIVEL', $3)
             ON CONFLICT (veiculo_id, data) DO UPDATE SET observacao = $3`,
            [veiculo_id, data, observacao || '']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/frota/obs-dia?data=YYYY-MM-DD — observação geral do dia para programação da frota
app.get('/api/frota/obs-dia', authMiddleware, async (req, res) => {
    try {
        const data = req.query.data || new Date().toISOString().slice(0, 10);
        const row = await dbGet('SELECT observacao FROM frota_obs_diarias WHERE data_referencia = $1', [data]);
        res.json({ success: true, observacao: row?.observacao || '' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/frota/obs-dia — salvar/atualizar observação do dia
app.put('/api/frota/obs-dia', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { data, observacao } = req.body;
        if (!data) return res.status(400).json({ success: false, message: 'data obrigatória.' });
        await dbRun(
            `INSERT INTO frota_obs_diarias (data_referencia, observacao, atualizada_em)
             VALUES ($1, $2, NOW())
             ON CONFLICT (data_referencia) DO UPDATE SET observacao = $2, atualizada_em = NOW()`,
            [data, observacao || '']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Taxa de Usabilidade da Frota ─────────────────────────────────────────────
const STATUS_OPERANDO = new Set(['EM_VIAGEM','EM_OPERACAO','CARREGANDO','CARREGADO','RETORNANDO','EM_VIAGEM_FRETE_RETORNO','TRANSFERENCIA','PUXADA']);
const STATUS_OCIOSO = new Set(['DISPONIVEL','AGUARDANDO_FRETE_RETORNO']);
const STATUS_EXCLUIDO = new Set(['MANUTENCAO','SABADO']);
const TIPOS_USAB = ['TRUCK','3/4','CONJUNTO'];
const META_USAB = 85;
const ALERTA_USAB = 80;
const LABEL_MOTIVO = {
    DISPONIVEL: 'Disponível sem viagem',
    AGUARDANDO_FRETE_RETORNO: 'Aguardando frete retorno',
    MANUTENCAO: 'Em manutenção',
    SABADO: 'Sábado (sem operação)',
};

function quinzenaDe(dataStr) {
    const [y, m, d] = dataStr.split('-').map(Number);
    const ultimoDia = new Date(y, m, 0).getDate();
    if (d <= 15) return { inicio: `${y}-${String(m).padStart(2,'0')}-01`, fim: `${y}-${String(m).padStart(2,'0')}-15`, label: `${String(m).padStart(2,'0')}/Q1` };
    return { inicio: `${y}-${String(m).padStart(2,'0')}-16`, fim: `${y}-${String(m).padStart(2,'0')}-${ultimoDia}`, label: `${String(m).padStart(2,'0')}/Q2` };
}

function quinzenaAnterior(q) {
    const [y, m, d] = q.inicio.split('-').map(Number);
    if (d === 1) {
        const prevMes = m === 1 ? 12 : m - 1;
        const prevAno = m === 1 ? y - 1 : y;
        const ultimoDia = new Date(prevAno, prevMes, 0).getDate();
        return { inicio: `${prevAno}-${String(prevMes).padStart(2,'0')}-16`, fim: `${prevAno}-${String(prevMes).padStart(2,'0')}-${ultimoDia}`, label: `${String(prevMes).padStart(2,'0')}/Q2` };
    }
    return { inicio: `${y}-${String(m).padStart(2,'0')}-01`, fim: `${y}-${String(m).padStart(2,'0')}-15`, label: `${String(m).padStart(2,'0')}/Q1` };
}

function dataRecife() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
}

function listarDias(inicio, fim) {
    const dias = [];
    const [y1, m1, d1] = inicio.split('-').map(Number);
    const [y2, m2, d2] = fim.split('-').map(Number);
    const cur = new Date(Date.UTC(y1, m1 - 1, d1));
    const end = new Date(Date.UTC(y2, m2 - 1, d2));
    while (cur <= end) {
        dias.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dias;
}

async function calcularUsabilidadePeriodo(inicio, fim) {
    const veiculos = await dbAll(
        "SELECT id, tipo_veiculo FROM prov_veiculos WHERE ativo = 1 AND tipo_veiculo = ANY($1)",
        [TIPOS_USAB]
    );
    const totalFrota = veiculos.length;
    const vidMap = new Map(veiculos.map(v => [v.id, v.tipo_veiculo]));

    const progs = await dbAll(
        "SELECT veiculo_id, data::text AS data, status FROM prov_programacao WHERE data BETWEEN $1 AND $2 AND veiculo_id = ANY($3)",
        [inicio, fim, veiculos.map(v => v.id)]
    );

    const dias = listarDias(inicio, fim);
    const porDia = new Map();
    for (const d of dias) porDia.set(d, new Map());
    for (const p of progs) {
        const m = porDia.get(p.data);
        if (m) m.set(p.veiculo_id, p.status);
    }

    const diario = [];
    let somaTaxa = 0, diasComBase = 0;
    const porTipoAgg = Object.fromEntries(TIPOS_USAB.map(t => [t, { operando: 0, base: 0 }]));

    for (const d of dias) {
        const mapVid = porDia.get(d);
        // Dia sem nenhum registro de provisionamento = ainda não lançado, não entra no cálculo
        if (mapVid.size === 0) {
            diario.push({ data: d, taxa: null, operando: 0, ocioso: 0, excluido: 0, total: totalFrota, motivos_dia: [] });
            continue;
        }
        let operando = 0, ocioso = 0, excluido = 0;
        const motivosCount = {};
        for (const v of veiculos) {
            const st = mapVid.get(v.id) || 'DISPONIVEL';
            if (STATUS_OPERANDO.has(st)) { operando++; porTipoAgg[v.tipo_veiculo].operando++; porTipoAgg[v.tipo_veiculo].base++; }
            else if (STATUS_OCIOSO.has(st)) { ocioso++; porTipoAgg[v.tipo_veiculo].base++; motivosCount[st] = (motivosCount[st] || 0) + 1; }
            else { excluido++; motivosCount[st] = (motivosCount[st] || 0) + 1; }
        }
        const base = operando + ocioso;
        const taxa = base > 0 ? (operando / base) * 100 : null;
        const motivos_dia = Object.entries(motivosCount)
            .map(([status, qtd]) => ({ status, qtd, label: LABEL_MOTIVO[status] || status }))
            .sort((a, b) => b.qtd - a.qtd);
        diario.push({ data: d, taxa, operando, ocioso, excluido, total: totalFrota, motivos_dia });
        if (taxa !== null) { somaTaxa += taxa; diasComBase++; }
    }

    const motivosAgregados = {};
    for (const d of diario) {
        for (const m of d.motivos_dia) {
            if (!motivosAgregados[m.status]) {
                motivosAgregados[m.status] = { status: m.status, label: m.label, veiculo_dias: 0, dias_presente: 0 };
            }
            motivosAgregados[m.status].veiculo_dias += m.qtd;
            motivosAgregados[m.status].dias_presente += 1;
        }
    }
    const motivos_quinzena = Object.values(motivosAgregados)
        .sort((a, b) => b.veiculo_dias - a.veiculo_dias)
        .slice(0, 5);

    const taxa_periodo = diasComBase > 0 ? somaTaxa / diasComBase : 0;
    const por_tipo = {};
    for (const t of TIPOS_USAB) {
        const a = porTipoAgg[t];
        por_tipo[t] = a.base > 0 ? (a.operando / a.base) * 100 : null;
    }

    let status_atual = 'VERDE';
    if (taxa_periodo <= ALERTA_USAB) status_atual = 'VERMELHO';
    else if (taxa_periodo < META_USAB) status_atual = 'AMARELO';

    return { taxa_periodo, status_atual, diario, por_tipo, total_frota: totalFrota, motivos_quinzena };
}

app.get('/api/frota/usabilidade', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Adm Frota', 'Encarregado']), async (req, res) => {
    try {
        const hoje = dataRecife();
        const qAtual = quinzenaDe(hoje);
        const inicio = req.query.inicio || qAtual.inicio;
        const fim = req.query.fim || qAtual.fim;

        const atual = await calcularUsabilidadePeriodo(inicio, fim);

        const anteriores = [];
        let q = { inicio, fim };
        for (let i = 0; i < 3; i++) {
            q = quinzenaAnterior(q);
            const prev = await calcularUsabilidadePeriodo(q.inicio, q.fim);
            anteriores.push({ label: q.label, inicio: q.inicio, fim: q.fim, taxa: prev.taxa_periodo });
        }

        res.json({
            success: true,
            periodo: { inicio, fim },
            taxa_periodo: atual.taxa_periodo,
            taxa_meta: META_USAB,
            taxa_alerta: ALERTA_USAB,
            status_atual: atual.status_atual,
            total_frota: atual.total_frota,
            diario: atual.diario,
            por_tipo: atual.por_tipo,
            motivos_quinzena: atual.motivos_quinzena,
            quinzenas_anteriores: anteriores,
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// CRON: alertas de usabilidade 3x/dia (08h, 13h, 17h Recife) quando taxa ≤ 80%
cron.schedule('0 8,13,17 * * *', async () => {
    try {
        const hoje = dataRecife();
        const { inicio, fim } = quinzenaDe(hoje);
        const dados = await calcularUsabilidadePeriodo(inicio, fim);

        // Auto-resolve: marcar alertas pendentes como resolvidos se taxa voltou a >= META
        if (dados.taxa_periodo >= META_USAB) {
            await dbRun(
                `UPDATE usabilidade_alertas_log SET resolvido_em = NOW()
                 WHERE resolvido_em IS NULL AND periodo_inicio = $1 AND periodo_fim = $2`,
                [inicio, fim]
            );
            return;
        }
        if (dados.taxa_periodo > ALERTA_USAB) return;

        const hora = new Date().toLocaleString('en-US', { timeZone: 'America/Recife', hour: 'numeric', hour12: false });
        const ja = await dbGet(
            `SELECT 1 FROM usabilidade_alertas_log
             WHERE DATE(disparado_em AT TIME ZONE 'America/Recife') = $1
               AND EXTRACT(HOUR FROM disparado_em AT TIME ZONE 'America/Recife') = $2`,
            [hoje, Number(hora)]
        );
        if (ja) return;

        const diaHoje = dados.diario.find(d => d.data === hoje);
        const taxaDia = diaHoje?.taxa ?? dados.taxa_periodo;
        await enviarNotificacao('alerta_usabilidade_frota', {
            tipo: 'alerta_usabilidade_frota',
            mensagem: `Taxa de usabilidade da frota em ${taxaDia.toFixed(1)}% (meta ${META_USAB}%). Dia ${hoje.split('-').reverse().join('/')}.`,
            taxa: taxaDia,
            periodo: { inicio, fim },
            data_criacao: new Date().toISOString(),
        });
        await dbRun(
            `INSERT INTO usabilidade_alertas_log (disparado_em, taxa, periodo_inicio, periodo_fim)
             VALUES (NOW(), $1, $2, $3)`,
            [dados.taxa_periodo.toFixed(2), inicio, fim]
        );
    } catch (e) {
        console.error('[CRON usabilidade]', e.message);
    }
}, { scheduled: true, timezone: 'America/Recife' });

// ─────────────────────────────────────────────────────────────────────────────

// Endpoints para containers bloqueando docas (por data)
app.get('/api/docas-interditadas', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Dashboard Viewer']), async (req, res) => {
    try {
        const data = req.query.data || new Date().toISOString().slice(0, 10);
        const rows = await dbAll('SELECT * FROM docas_interditadas WHERE data_referencia = $1 OR data_referencia IS NULL', [data]);
        res.json({ success: true, docas: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/docas-interditadas', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const { unidade, data } = req.body;
        const dataRef = data || new Date().toISOString().slice(0, 10);
        const result = await dbRun(
            'INSERT INTO docas_interditadas (unidade, doca, nome, data_referencia) VALUES ($1, $2, $3, $4)',
            [unidade, 'SELECIONE', 'CONTAINER', dataRef]
        );
        const newCard = { id: result.lastID || result.rows?.[0]?.id, unidade, doca: 'SELECIONE', nome: 'CONTAINER', data_referencia: dataRef };

        const allDocas = await dbAll('SELECT * FROM docas_interditadas WHERE data_referencia = $1', [dataRef]);
        await registrarLog('DOCA_CRIADA', req.user?.nome || '?', newCard.id, 'doca', null, null, `Unidade: ${unidade} Data: ${dataRef}`);
        io.emit('docas_interditadas_update', { data: dataRef, docas: allDocas });
        res.json({ success: true, doca: newCard });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/docas-interditadas/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { doca } = req.body;
        await dbRun('UPDATE docas_interditadas SET doca = $1 WHERE id = $2', [doca, id]);

        const row = await dbGet('SELECT data_referencia FROM docas_interditadas WHERE id = $1', [id]);
        const dataRef = row?.data_referencia?.toISOString?.().slice(0, 10) || row?.data_referencia || new Date().toISOString().slice(0, 10);
        const allDocas = await dbAll('SELECT * FROM docas_interditadas WHERE data_referencia = $1', [dataRef]);
        await registrarLog('DOCA_ATUALIZADA', req.user?.nome || '?', id, 'doca', null, doca, null);
        io.emit('docas_interditadas_update', { data: dataRef, docas: allDocas });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/docas-interditadas/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const row = await dbGet('SELECT data_referencia FROM docas_interditadas WHERE id = $1', [id]);
        const dataRef = row?.data_referencia?.toISOString?.().slice(0, 10) || row?.data_referencia || new Date().toISOString().slice(0, 10);
        await dbRun('DELETE FROM docas_interditadas WHERE id = $1', [id]);

        const allDocas = await dbAll('SELECT * FROM docas_interditadas WHERE data_referencia = $1', [dataRef]);
        await registrarLog('DOCA_DELETADA', req.user?.nome || '?', id, 'doca', null, null, null);
        io.emit('docas_interditadas_update', { data: dataRef, docas: allDocas });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== SALDO DE PALETES ====================

// Buscar dados de um veículo pelo número de coleta para pré-preencher o lançamento manual
app.get('/api/saldo-paletes/buscar-coleta/:numero', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const numero = req.params.numero;
        const v = await dbGet(
            `SELECT motorista, placa, dados_json, placa1motorista, placa2motorista FROM veiculos
             WHERE coleta = ? OR coletarecife = ? OR coletamoreno = ?
             ORDER BY id DESC LIMIT 1`,
            [numero, numero, numero]
        );
        if (!v) return res.json({ success: false, message: 'Coleta não encontrada.' });
        let dj = {};
        try { dj = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch {}
        res.json({
            success: true,
            motorista: v.motorista || '',
            placa_cavalo: v.placa1motorista || dj.placa1Motorista || v.placa || '',
            placa_carreta: v.placa2motorista || dj.placa2Motorista || '',
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/saldo-paletes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM saldo_paletes ORDER BY data_entrada DESC");
        res.json({ success: true, registros: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/saldo-paletes', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const { motorista, telefone, placa_cavalo, placa_carreta, tipo_palete, qtd_pbr, qtd_descartavel, fornecedor_pbr, observacao, unidade, data_entrada_manual, numero_coleta } = req.body;
        if (!motorista || !tipo_palete) {
            return res.status(400).json({ success: false, message: 'Motorista e tipo de palete são obrigatórios.' });
        }
        if ((tipo_palete === 'PBR' || tipo_palete === 'MISTO') && !fornecedor_pbr) {
            return res.status(400).json({ success: false, message: 'Fornecedor é obrigatório para paletes PBR.' });
        }
        const dataEntrada = data_entrada_manual ? new Date(data_entrada_manual).toISOString() : new Date().toISOString();
        const result = await dbRun(
            `INSERT INTO saldo_paletes (motorista, telefone, placa_cavalo, placa_carreta, tipo_palete, qtd_pbr, qtd_descartavel, fornecedor_pbr, observacao, unidade, data_entrada, numero_coleta)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [motorista, telefone || '', placa_cavalo || '', placa_carreta || '', tipo_palete, qtd_pbr || 0, qtd_descartavel || 0, fornecedor_pbr || '', observacao || '', unidade || '', dataEntrada, numero_coleta || null]
        );
        await registrarLog('PALETE_CRIADO', req.user?.nome || '?', result.lastID || result.id, 'palete', null, null, `Motorista: ${motorista} | Tipo: ${tipo_palete}`);
        io.emit('saldo_paletes_update');
        res.json({ success: true, id: result.lastID || result.id });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/saldo-paletes/:id/devolucao', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
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

app.delete('/api/saldo-paletes/:id', authMiddleware, authorize(['Coordenador', 'Encarregado']), async (req, res) => {
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

// ── Google Sheets — Planilha Porcelana ───────────────────────────────────────
app.get('/api/sheets/porcelana', authMiddleware, authorize(['Direção', 'Coordenador', 'Adm Frota', 'Planejamento']), async (req, res) => {
    try {
        const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        const sheetId = process.env.SHEETS_PORCELANA_ID;
        const range   = process.env.SHEETS_PORCELANA_RANGE || 'Embarques - ABRIL 2026!A1:AJ5000';

        if (!saJson || !sheetId) {
            return res.json({ success: true, configurado: false, linhas: [] });
        }

        const { google } = require('googleapis');
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(saJson),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
        const rows = resp.data.values || [];

        // 4 linhas de cabeçalho → dados a partir do índice 4
        const linhas = rows.slice(4).map((row, i) => ({
            _idx: i,
            cliente:        row[1]  || '',
            cidade:         row[2]  || '',
            uf:             row[3]  || '',
            regiao:         row[4]  || '',
            volumes:        parseFloat((row[6]  || '0').replace(',', '.')) || 0,
            peso_kg:        parseFloat((row[7]  || '0').replace(',', '.')) || 0,
            m3:             parseFloat((row[8]  || '0').replace(',', '.')) || 0,
            valor:          parseFloat((row[9]  || '0').replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0,
            nf:             row[10] || '',
            status:         row[15] || '',
            doca:           row[16] || '',
            rota:           row[17] || '',
            motorista:      row[23] || '',
            placa:          row[24] || '',
            transportadora: row[27] || '',
            data_coleta:    row[31] || '',
        })).filter(r => r.cliente || r.nf);

        res.json({ success: true, configurado: true, atualizado_em: new Date().toISOString(), total: linhas.length, linhas });
    } catch (err) {
        console.error('Sheets error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Relatório de Cubagem ─────────────────────────────────────────────────────
app.get('/api/relatorio/cubagem', authMiddleware, authorize(['Direção', 'Coordenador', 'Adm Frota', 'Planejamento']), async (req, res) => {
    try {
        const { de, ate } = req.query;
        if (!de || !ate) return res.status(400).json({ success: false, error: 'Parâmetros de e ate são obrigatórios' });

        const cubagens = await dbAll(`
            SELECT c.id, c.numero_coleta, c.motorista, c.cliente, c.destino,
                   c.metragem_total, c.valor_mix_total, c.valor_kit_total,
                   c.valor_total, c.peso_total, c.redespacho, c.nome_redespacho,
                   c.tipo, c.data_criacao,
                   COALESCE(json_agg(json_build_object(
                       'numero_nf', ci.numero_nf, 'metragem', ci.metragem,
                       'uf', ci.uf, 'regiao', ci.regiao, 'valor', ci.valor,
                       'volumes', ci.volumes, 'peso_kg', ci.peso_kg,
                       'redespacho_nome', ci.redespacho_nome, 'redespacho_uf', ci.redespacho_uf
                   ) ORDER BY ci.id) FILTER (WHERE ci.id IS NOT NULL), '[]') AS itens
            FROM cubagens c
            LEFT JOIN cubagem_itens ci ON ci.cubagem_id = c.id
            WHERE c.data_criacao::date >= $1 AND c.data_criacao::date <= $2
              AND c.tipo = 'Porcelana'
            GROUP BY c.id
            ORDER BY c.data_criacao DESC
        `, [de, ate]);

        const porRegiao = await dbAll(`
            SELECT
                ci.regiao,
                COUNT(DISTINCT c.id)::int AS qtd_cubagens,
                ROUND(SUM(ci.metragem)::numeric, 3)::float AS m3_total,
                ROUND(SUM(ci.peso_kg)::numeric, 1)::float AS peso_total,
                ROUND(SUM(ci.valor)::numeric, 2)::float AS valor_total,
                SUM(ci.volumes)::int AS volumes_total
            FROM cubagens c
            JOIN cubagem_itens ci ON ci.cubagem_id = c.id
            WHERE c.data_criacao::date >= $1 AND c.data_criacao::date <= $2
              AND c.tipo = 'Porcelana'
              AND ci.regiao <> ''
            GROUP BY ci.regiao
            ORDER BY ci.regiao
        `, [de, ate]);

        const heatmap = await dbAll(`
            SELECT
                EXTRACT(DOW FROM data_criacao AT TIME ZONE 'America/Recife')::int AS dia_semana,
                EXTRACT(HOUR FROM data_criacao AT TIME ZONE 'America/Recife')::int AS hora,
                COUNT(*)::int AS qtd
            FROM cubagens
            WHERE data_criacao::date >= $1 AND data_criacao::date <= $2
              AND tipo = 'Porcelana'
            GROUP BY dia_semana, hora
            ORDER BY dia_semana, hora
        `, [de, ate]);

        res.json({ success: true, cubagens, por_regiao: porRegiao, heatmap });
    } catch (e) {
        console.error('Erro relatorio cubagem:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Task Dashboard (antes do catch-all do React) ─────────────────────────────
const tasksRouter = require('./src/routes/tasks')(adminAuth);
app.use('/', tasksRouter);

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

    // /checklist foi integrado ao /mobile — redirecionar permanentemente
    app.get(['/checklist', '/checklist/*splat'], (req, res) => {
        res.redirect(301, '/mobile');
    });

    // PWA Mobile: serve index.html com manifest correto para /mobile e subpaths
    app.get(['/mobile', '/mobile/*splat'], (req, res) => {
        const indexPath = path.join(__dirname, 'build', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace('/manifest.json', '/mobile-manifest.json');
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

    // Cleanup de sessões expiradas (1x por hora) — remove sessões com mais de 9h
    setInterval(async () => {
        try {
            await dbRun("DELETE FROM sessoes WHERE criada_em < NOW() - INTERVAL '9 hours' AND expires_at IS NOT NULL");
        } catch (_) {}
    }, 60 * 60 * 1000);

    // Cleanup de tokens de e-mail expirados (1x por dia)
    setInterval(async () => {
        try {
            await dbRun("DELETE FROM email_verification_tokens WHERE expira_em < NOW() AND usado = 1");
        } catch (_) {}
    }, 24 * 60 * 60 * 1000);
});