const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize, generateToken } = require('../../middleware/authMiddleware');
const { validate, loginSchema, cadastroUsuarioSchema } = require('../../middleware/validationMiddleware');

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

        // Gerar token JWT
        const token = generateToken(usuario);

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
            permissoesEdicao: parseJson(usuario.permissoesedicao || usuario.permissoesEdicao)
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

        const cargoFinal = req.user.cargo === 'Coordenador' ? (cargo ?? usuarioAtual.cargo) : usuarioAtual.cargo;

        await dbRun(
            `UPDATE usuarios SET usaPermissaoIndividual=$1, permissoesAcesso=$2, permissoesEdicao=$3, cargo=$4, cidade=$5, nome=$6, telefone=$7 WHERE id=$8`,
            [
                usaPermissaoIndividual !== undefined ? (usaPermissaoIndividual ? 1 : 0) : usuarioAtual.usapermissaoindividual,
                JSON.stringify(permissoesAcesso ?? JSON.parse(usuarioAtual.permissoesacesso || '[]')),
                JSON.stringify(permissoesEdicao ?? JSON.parse(usuarioAtual.permissoesedicao || '[]')),
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
