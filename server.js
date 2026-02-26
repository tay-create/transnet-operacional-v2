// Carregar variáveis de ambiente ANTES de tudo
require('dotenv').config();

// Fuso horário global — garante que new Date() respeite Brasília
process.env.TZ = 'America/Sao_Paulo';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
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

const { dbRun, dbAll, dbGet, dbTransaction } = require('./src/database/db');
const { inicializarBanco } = require('./src/database/migrations');

// --- BANCO DE DADOS ---
app.use('/api/ocorrencias', require('./src/routes/ocorrencias'));
app.use('/', require('./src/routes/ocorrencias'));
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

// Registrar rotas após io e registrarLog estarem definidos
const veiculosRouter = require('./src/routes/veiculos')(io, registrarLog);
app.use('/veiculos', veiculosRouter);
app.use('/', veiculosRouter);

const checklistsRouter = require('./src/routes/checklists')(io);
app.use('/', checklistsRouter);

// NOTA: PUT /usuarios/:id completo está mais abaixo com authMiddleware + authorize
// Esta rota (cargo apenas) foi migrada para a versão protegida

app.put('/usuarios/:id/avatar', authMiddleware, async (req, res) => {
    const { avatarUrl } = req.body;
    const userId = Number(req.params.id);

    console.log(`📸 [Avatar] Solicitado update para usuário ${userId}`);

    // Usuário só pode alterar o próprio avatar, ou Coordenador altera qualquer um
    if (req.user.id !== userId && req.user.cargo !== 'Coordenador') {
        console.warn(`🚫 [Avatar] Acesso negado para usuário ${req.user.id} tentando alterar o de ${userId}`);
        return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    try {
        // No PostgreSQL, avatarUrl se torna avatarurl se não for citado
        await dbRun("UPDATE usuarios SET avatarUrl = ? WHERE id = ?", [avatarUrl, userId]);

        console.log(`✅ [Avatar] Foto atualizada no banco para usuário ${userId}`);

        io.emit('receber_atualizacao', {
            tipo: 'avatar_mudou',
            userId: userId,
            newUrl: avatarUrl
        });

        res.json({ success: true });
    } catch (e) {
        console.error("❌ [Avatar] Erro ao salvar foto:", e);
        res.status(500).json({ success: false, message: 'Erro ao salvar foto no servidor' });
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
            if (status === 'ativo') {
                const novaExpiracao = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
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
                    data_marcacao=?, status_operacional='DISPONIVEL', data_contratacao=NULL
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
                   origem_cidade_uf, destino_desejado, disponibilidade, data_marcacao, data_contratacao,
                   viagens_realizadas, status_operacional, is_frota,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   situacao_cad, num_liberacao_cad, data_liberacao_cad,
                   estados_destino, destino_uf_cad
            FROM marcacoes_placas
            WHERE data_marcacao >= NOW() - INTERVAL '7 days'
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
                   disponibilidade, data_marcacao, data_contratacao,
                   chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                   seguradora_cad, num_liberacao_cad, data_liberacao_cad, situacao_cad,
                   comprovante_pdf, anexo_cnh, anexo_doc_veiculo, anexo_crlv_carreta, anexo_antt, anexo_outros,
                   origem_cad, destino_uf_cad, destino_cidade_cad
            FROM marcacoes_placas
            WHERE (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')
              AND (is_frota IS NULL OR is_frota = 0)
            ORDER BY data_marcacao DESC
        `);
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
        res.json({ success: true, situacao: situacao_cad });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Frota Própria: excluir motorista de frota ──
app.delete('/api/cadastro/frota/:id', authMiddleware, authorize(['Coordenador', 'Encarregado', 'Cadastro']), async (req, res) => {
    try {
        await dbRun("DELETE FROM marcacoes_placas WHERE id = ? AND is_frota = 1", [req.params.id]);
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
            SELECT v.id, v.motorista, v.dados_json,
                   v.chk_cnh, v.chk_antt, v.chk_tacografo, v.chk_crlv,
                   v.situacao_cadastro, v.numero_liberacao, v.data_liberacao,
                   v.placa, v.operacao, v.unidade,
                   v.status_recife, v.status_moreno,
                   m.placa1 AS mp_placa1, m.placa2 AS mp_placa2,
                   m.tipo_veiculo AS mp_tipo_veiculo,
                   m.seguradora_cad, m.origem_cad, m.destino_uf_cad, m.destino_cidade_cad
            FROM veiculos v
            LEFT JOIN marcacoes_placas m ON LOWER(TRIM(m.nome_motorista)) = LOWER(TRIM(v.motorista))
                AND v.motorista IS NOT NULL AND v.motorista != ''
            WHERE (v.status_recife IS NULL OR v.status_recife NOT IN ('FINALIZADO'))
              AND (v.status_moreno IS NULL OR v.status_moreno NOT IN ('FINALIZADO'))
              AND (v.status_cte IS NULL OR v.status_cte != 'Emitido')
            ORDER BY v.id DESC
        `);
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
        io.emit('marcacao_atualizada');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ==================== FIM MARCAÇÃO DE PLACAS ====================

// ==================== HISTÓRICO DE LIBERAÇÕES ====================

// GET - Listar estrutura (letras → motoristas → registros)
app.get('/api/historico-liberacoes', authMiddleware, async (req, res) => {
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
app.use('/', require('./src/routes/auth'));
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
                    // Busca pelo telefone primeiro, fallback pelo nome do motorista
                    const agora = new Date().toISOString();
                    let rowsAfetadas = 0;

                    if (telefoneMotorista) {
                        const r = await dbRun(
                            `UPDATE marcacoes_placas
                             SET viagens_realizadas = viagens_realizadas + 1,
                                 status_operacional = 'EM VIAGEM',
                                 data_contratacao = COALESCE(data_contratacao, ?),
                                 situacao_cad = 'ARQUIVADO',
                                 chk_cnh_cad = '0', chk_antt_cad = '0', chk_tacografo_cad = '0', chk_crlv_cad = '0',
                                 num_liberacao_cad = NULL, data_liberacao_cad = NULL
                             WHERE telefone = ?`,
                            [agora, telefoneMotorista]
                        );
                        rowsAfetadas = r.changes || 0;
                    }

                    // Fallback: buscar pelo nome do motorista se não achou pelo telefone
                    if (rowsAfetadas === 0 && veiculo.motorista) {
                        const r = await dbRun(
                            `UPDATE marcacoes_placas
                             SET viagens_realizadas = viagens_realizadas + 1,
                                 status_operacional = 'EM VIAGEM',
                                 data_contratacao = COALESCE(data_contratacao, ?),
                                 situacao_cad = 'ARQUIVADO',
                                 chk_cnh_cad = '0', chk_antt_cad = '0', chk_tacografo_cad = '0', chk_crlv_cad = '0',
                                 num_liberacao_cad = NULL, data_liberacao_cad = NULL
                             WHERE nome_motorista = ?`,
                            [agora, veiculo.motorista]
                        );
                        rowsAfetadas = r.changes || 0;
                    }

                    if (rowsAfetadas > 0) {
                        console.log(`✅ Motorista ${veiculo.motorista}: viagem registrada, status → EM VIAGEM, cadastro → ARQUIVADO`);
                    } else {
                        console.warn(`⚠️ Motorista ${veiculo.motorista}: marcação não encontrada para incrementar viagem`);
                    }
                }

                // Notificar painéis para sumir com o card (refresh geral)
                io.emit('receber_atualizacao', { tipo: 'refresh_geral' });
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
app.post('/api/checklists', authMiddleware, async (req, res) => {
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
        res.json({ success: true });
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

// ── VERIFICAÇÃO DE EXPIRAÇÃO DE LIBERAÇÕES (GR) ───────────────────────
// Roda a cada 15 minutos para checar liberações que estão prestes a expirar (2h) ou já expiraram
// Só alerta para motoristas em espera (marcacoes_placas com disponibilidade != Contratado)
// Guarda controle de alertas já enviados para não duplicar
const alertasJaEnviados = new Set(); // chave: `${id}_2h` ou `${id}_exp`

async function verificarExpiracaoLiberacoes() {
    try {
        const agora = Date.now();
        const LIMITE_24H = 24 * 60 * 60 * 1000;
        const ALERTA_2H = 2 * 60 * 60 * 1000;

        const motoristas = await dbAll(
            `SELECT id, nome_motorista, placa1, num_liberacao_cad, data_liberacao_cad, disponibilidade
             FROM marcacoes_placas
             WHERE data_liberacao_cad IS NOT NULL
               AND (disponibilidade IS NULL OR disponibilidade NOT IN ('Contratado', 'Indisponível'))
               AND situacao_cad = 'LIBERADO'`
        );

        for (const m of motoristas) {
            const dataStr = m.data_liberacao_cad.endsWith('Z') ? m.data_liberacao_cad : m.data_liberacao_cad + 'Z';
            const diffMs = agora - new Date(dataStr).getTime();
            const restanteMs = LIMITE_24H - diffMs;
            const placa = m.placa1 || 'S/Placa';
            const nome = m.nome_motorista;

            if (restanteMs <= 0) {
                // EXPIRADO
                const chave = `${m.id}_exp`;
                if (!alertasJaEnviados.has(chave)) {
                    alertasJaEnviados.add(chave);
                    // Remove o alerta de "2h" da memória para reenviar no próximo ciclo se necessário
                    alertasJaEnviados.delete(`${m.id}_2h`);

                    const msg = `⛔ LIBERAÇÃO EXPIRADA — ${nome} (${placa}) — Lib. Nº ${m.num_liberacao_cad || 'S/N'}. Solicite renovação!`;
                    console.log(`[CRON-LIB] ${msg}`);

                    await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify({
                        tipo: 'liberacao_expirada',
                        mensagem: msg,
                        motorista: nome,
                        placa,
                        num_liberacao: m.num_liberacao_cad,
                        data_criacao: new Date().toISOString(),
                    })]);

                    io.emit('notificacao_direcionada', {
                        mensagem: msg,
                        tipo: 'liberacao_expirada',
                        cargos_alvo: ['Coordenador', 'Cadastro', 'Encarregado', 'Planejamento'],
                    });
                }
            } else if (restanteMs <= ALERTA_2H) {
                // FALTAM MENOS DE 2 HORAS
                const chave = `${m.id}_2h`;
                if (!alertasJaEnviados.has(chave)) {
                    alertasJaEnviados.add(chave);

                    const hRestante = Math.floor(restanteMs / 3600000);
                    const mRestante = Math.floor((restanteMs % 3600000) / 60000);
                    const tempoStr = hRestante > 0 ? `${hRestante}h${String(mRestante).padStart(2, '0')}min` : `${mRestante}min`;

                    const msg = `⚠️ LIBERAÇÃO VENCENDO — ${nome} (${placa}) — ${tempoStr} restantes. Lib. Nº ${m.num_liberacao_cad || 'S/N'}`;
                    console.log(`[CRON-LIB] ${msg}`);

                    await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify({
                        tipo: 'liberacao_vencendo',
                        mensagem: msg,
                        motorista: nome,
                        placa,
                        num_liberacao: m.num_liberacao_cad,
                        data_criacao: new Date().toISOString(),
                    })]);

                    io.emit('notificacao_direcionada', {
                        mensagem: msg,
                        tipo: 'liberacao_vencendo',
                        cargos_alvo: ['Coordenador', 'Cadastro', 'Encarregado', 'Planejamento'],
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
        const query = `
            UPDATE veiculos
            SET data_prevista = ?
            WHERE
                (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
                AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
                AND NOT EXISTS (
                    SELECT 1 FROM veiculos v2
                    WHERE v2.id = veiculos.id
                    AND (v2.status_cte = 'Emitido' OR v2.dados_json::jsonb->>'status_cte' = 'Emitido')
                )
        `;
        const resultado = await dbRun(query, [amanhaStr]);

        console.log(`[CRON] Fecho do Dia concluído. ${resultado.changes} veículos transferidos para ${amanhaStr}.`);
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

// Endpoints para containers bloqueando docas (Persistente no Banco)
app.get('/api/docas-interditadas', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM docas_interditadas');
        res.json({ success: true, docas: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/docas-interditadas', async (req, res) => {
    try {
        const { unidade } = req.body;
        const result = await dbRun('INSERT INTO docas_interditadas (unidade, doca, nome) VALUES (?, ?, ?)', [unidade, 'SELECIONE', 'CONTAINER']);
        const newCard = { id: result.lastID, unidade, doca: 'SELECIONE', nome: 'CONTAINER' };

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true, doca: newCard });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/docas-interditadas/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { doca } = req.body;
        await dbRun('UPDATE docas_interditadas SET doca = ? WHERE id = ?', [doca, id]);

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/docas-interditadas/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await dbRun('DELETE FROM docas_interditadas WHERE id = ?', [id]);

        const allDocas = await dbAll('SELECT * FROM docas_interditadas');
        io.emit('docas_interditadas_update', allDocas);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Porta configurável via .env
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configurado via .env' : 'Usando chave padrão (MUDAR EM PRODUÇÃO!)'}\n`);
});