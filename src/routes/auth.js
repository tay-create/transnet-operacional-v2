const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize, generateToken } = require('../../middleware/authMiddleware');
const { validate, loginSchema, cadastroUsuarioSchema } = require('../../middleware/validationMiddleware');

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    const { nome, senha } = req.body;
    const emailLogin = nome.trim().toLowerCase();

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

        // Verificar limite de sessões simultâneas (máximo 2)
        const contaSessoes = await dbGet(
            'SELECT COUNT(*) AS count FROM sessoes WHERE usuario_id = $1 AND ativa = TRUE',
            [usuario.id]
        );
        if (parseInt(contaSessoes?.count || 0) >= 2) {
            return res.status(403).json({
                success: false,
                message: 'Limite de sessões simultâneas atingido (máximo 2). Faça logout em outro dispositivo ou peça ao administrador para revogar.'
            });
        }

        // Gerar token JWT
        const manterConectado = req.body.manterConectado === true || req.body.manterConectado === 'true';
        const token = generateToken(usuario, manterConectado);

        // Registrar sessão no banco
        // Dashboard Viewer nunca expira (fica sempre na TV sem interação humana)
        const ehViewer = usuario.cargo === 'Dashboard Viewer';
        const expiresAt = ehViewer
            ? null
            : manterConectado
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)   // 7 dias
                : new Date(Date.now() + 8 * 60 * 60 * 1000);        // 8 horas
        await dbRun(
            'INSERT INTO sessoes (usuario_id, token_hash, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [usuario.id, tokenHash(token), req.ip, req.headers['user-agent'] || '', expiresAt]
        );

        // Preparar dados do usuário (sem senha)
        // PostgreSQL retorna campos em minúsculo (avatarurl, permissoesacesso, etc)
        const parseJson = (val, fallback = '[]') => { try { return JSON.parse(val || fallback); } catch { return JSON.parse(fallback); } };
        const usuarioSemSenha = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            cidade: usuario.cidade,
            cargo: usuario.cargo,
            telefone: usuario.telefone || null,
            avatarUrl: usuario.avatarurl || usuario.avatarUrl,
            usaPermissaoIndividual: !!(usuario.usapermissaoindividual || usuario.usaPermissaoIndividual),
            permissoesAcesso: parseJson(usuario.permissoesacesso || usuario.permissoesAcesso),
            permissoesEdicao: parseJson(usuario.permissoesedicao || usuario.permissoesEdicao),
            email_pessoal: usuario.email_pessoal || null,
            email_pessoal_verificado: usuario.email_pessoal_verificado || 0
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

router.get('/usuarios', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const rows = await dbAll("SELECT id, nome, email, cidade, cargo, avatarurl, permissoesacesso, permissoesedicao, usapermissaoindividual FROM usuarios");
        const parseJson = (val, fallback = '[]') => { try { return JSON.parse(val || fallback); } catch { return JSON.parse(fallback); } };
        const usuarios = rows.map(u => ({
            ...u,
            avatarUrl: u.avatarurl || u.avatarUrl,
            permissoesAcesso: parseJson(u.permissoesacesso || u.permissoesAcesso),
            permissoesEdicao: parseJson(u.permissoesedicao || u.permissoesEdicao)
        }));
        res.json({ success: true, usuarios });
    } catch (e) {
        console.error("Erro ao buscar usuarios:", e);
        res.status(500).json({ success: false });
    }
});

router.post('/usuarios', authMiddleware, authorize(['Coordenador']), validate(cadastroUsuarioSchema), async (req, res) => {
    const { nome, email, senha, cidade, cargo } = req.body;

    try {
        const usuarioExistente = await dbGet("SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)", [email]);
        if (usuarioExistente) {
            return res.status(400).json({ success: false, message: "Este email já está em uso!" });
        }

        // Hash da senha com bcrypt (evita double-hash se já vier pré-hashado de solicitações)
        const hashedPassword = (senha.startsWith('$2b$') || senha.startsWith('$2a$'))
            ? senha
            : await bcrypt.hash(senha, 10);

        await dbRun("INSERT INTO usuarios (nome, email, senha, cidade, cargo) VALUES (?, ?, ?, ?, ?)",
            [nome, email, hashedPassword, cidade, cargo]);

        res.json({ success: true, message: "Usuário criado com sucesso!" });
    } catch (e) {
        console.error("❌ [POST /usuarios] Erro ao criar usuário:", e);
        res.status(500).json({ success: false, message: "Erro interno do servidor ao criar usuário." });
    }
});

router.put('/usuarios/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    const { usaPermissaoIndividual, permissoesAcesso, permissoesEdicao, cargo, cidade, nome, telefone } = req.body;
    try {
        const usuarioAtual = await dbGet("SELECT * FROM usuarios WHERE id=$1", [req.params.id]);
        if (!usuarioAtual) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

        const ehCoordenador = req.user.cargo === 'Coordenador';
        const cargoFinal = ehCoordenador ? (cargo ?? usuarioAtual.cargo) : usuarioAtual.cargo;

        // Campos de permissão individual só podem ser alterados por Coordenador
        const usaPermFinal = ehCoordenador
            ? (usaPermissaoIndividual !== undefined ? (usaPermissaoIndividual ? 1 : 0) : usuarioAtual.usapermissaoindividual)
            : usuarioAtual.usapermissaoindividual;
        const permAcessoFinal = ehCoordenador
            ? JSON.stringify(permissoesAcesso ?? JSON.parse(usuarioAtual.permissoesacesso || '[]'))
            : usuarioAtual.permissoesacesso;
        const permEdicaoFinal = ehCoordenador
            ? JSON.stringify(permissoesEdicao ?? JSON.parse(usuarioAtual.permissoesedicao || '[]'))
            : usuarioAtual.permissoesedicao;

        await dbRun(
            `UPDATE usuarios SET usaPermissaoIndividual=$1, permissoesAcesso=$2, permissoesEdicao=$3, cargo=$4, cidade=$5, nome=$6, telefone=$7 WHERE id=$8`,
            [
                usaPermFinal,
                permAcessoFinal,
                permEdicaoFinal,
                cargoFinal,
                cidade ?? usuarioAtual.cidade,
                nome ?? usuarioAtual.nome,
                telefone !== undefined ? (telefone ? telefone.replace(/\D/g, '') : null) : (usuarioAtual.telefone || null),
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao atualizar usuário:", e);
        res.status(500).json({ success: false });
    }
});

router.delete('/usuarios/:id', authMiddleware, authorize(['Coordenador']), async (req, res) => {
    try {
        await dbRun("DELETE FROM usuarios WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao deletar usuário:", e);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
