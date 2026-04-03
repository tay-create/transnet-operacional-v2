const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { dbGet, dbRun } = require('../src/database/db');

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Carregar variáveis de ambiente
require('dotenv').config();

// Chave secreta para assinar tokens — obrigatória via variável de ambiente
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET não definido no .env! O servidor não pode iniciar sem ele.');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware de autenticação JWT
 * Intercepta requisições e valida o token no header Authorization
 */
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Extrair token do header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token de autenticação não fornecido'
            });
        }

        // Formato esperado: "Bearer TOKEN_AQUI"
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Formato de token inválido'
            });
        }

        const token = parts[1];

        // 2. Verificar e decodificar token JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }

        // 3. Verificar sessão ativa no banco
        const hash = tokenHash(token);
        const sessao = await dbGet('SELECT ativa, expires_at FROM sessoes WHERE token_hash = $1', [hash]);
        if (!sessao || !sessao.ativa) {
            return res.status(401).json({
                success: false,
                message: 'Sessão inválida ou expirada. Faça login novamente.'
            });
        }
        // Verificar expiração da sessão (manter conectado respeita 7d vs 8h)
        if (sessao.expires_at && new Date() > new Date(sessao.expires_at)) {
            dbRun('UPDATE sessoes SET ativa = FALSE WHERE token_hash = $1', [hash]).catch(() => {});
            return res.status(401).json({
                success: false,
                message: 'Sessão expirada. Faça login novamente.'
            });
        }

        // Atualizar última atividade (fire-and-forget)
        dbRun('UPDATE sessoes SET ultima_atividade = NOW() WHERE token_hash = $1', [hash]).catch(() => {});

        // 4. Anexar dados do usuário ao request
        req.user = {
            id: decoded.id,
            nome: decoded.nome,
            email: decoded.email,
            cargo: decoded.cargo,
            cidade: decoded.cidade
        };

        // 5. Prosseguir para a próxima rota
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Erro ao processar autenticação'
        });
    }
};

/**
 * Middleware de autorização por cargo
 * Uso: authorize(['Coordenador', 'Planejamento'])
 */
const authorize = (cargosPermitidos) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const CARGOS_ADMIN = ['Coordenador', 'Direção', 'Adm Frota'];
        const temAcesso = CARGOS_ADMIN.includes(req.user.cargo) || cargosPermitidos.includes(req.user.cargo);
        if (!temAcesso) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado: permissão insuficiente'
            });
        }

        next();
    };
};

/**
 * Gera um token JWT para o usuário
 * manterConectado=true → expira em 7 dias; false → 8 horas
 */
const generateToken = (user, manterConectado = false) => {
    const payload = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        cidade: user.cidade
    };
    // Dashboard Viewer fica sempre online (TV/painel sem interação humana) — JWT sem expiração
    if (user.cargo === 'Dashboard Viewer') {
        return jwt.sign(payload, JWT_SECRET);
    }
    const expiresIn = manterConectado ? '7d' : '8h';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

module.exports = {
    authMiddleware,
    authorize,
    generateToken,
    JWT_SECRET
};
