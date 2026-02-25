const express = require('express');
const bcrypt = require('bcryptjs');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize, generateToken } = require('../../middleware/authMiddleware');
const { validate, loginSchema, cadastroUsuarioSchema } = require('../../middleware/validationMiddleware');

const router = express.Router();

router.post('/login', validate(loginSchema), async (req, res) => {
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
router.get('/usuarios', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
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
router.post('/usuarios', authMiddleware, authorize(['Coordenador']), validate(cadastroUsuarioSchema), async (req, res) => {
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
router.put('/usuarios/:id', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
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
