const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');

module.exports = (io) => {
    // Listar todos os chamados
    router.get('/api/chamados', authMiddleware, async (req, res) => {
        try {
            const chamados = await dbAll(`
                SELECT c.*,
                    COALESCE(json_agg(ci.imagem ORDER BY ci.criado_em) FILTER (WHERE ci.id IS NOT NULL), '[]') as imagens,
                    COALESCE((
                        SELECT json_agg(h ORDER BY h.criado_em)
                        FROM chamados_historico h WHERE h.chamado_id = c.id
                    ), '[]') as historico
                FROM chamados c
                LEFT JOIN chamados_imagens ci ON ci.chamado_id = c.id
                GROUP BY c.id
                ORDER BY c.criado_em DESC
            `, []);
            res.json({ success: true, chamados });
        } catch (e) {
            console.error('[chamados] GET erro:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // Criar novo chamado
    router.post('/api/chamados', authMiddleware, async (req, res) => {
        try {
            const { titulo, descricao, tipo = 'ajuste', imagens = [] } = req.body;
            if (!titulo?.trim() || !descricao?.trim()) {
                return res.status(400).json({ success: false, message: 'Título e descrição são obrigatórios.' });
            }
            if (imagens.length > 5) {
                return res.status(400).json({ success: false, message: 'Máximo de 5 imagens por chamado.' });
            }

            const result = await dbRun(`
                INSERT INTO chamados (titulo, descricao, tipo, status, autor_nome, autor_cargo, criado_em, atualizado_em)
                VALUES ($1, $2, $3, 'Analisando', $4, $5, NOW(), NOW())
                RETURNING id
            `, [titulo.trim(), descricao.trim(), tipo, req.user.nome, req.user.cargo]);

            const chamadoId = result.rows ? result.rows[0].id : result.lastID;

            for (const img of imagens) {
                await dbRun(`INSERT INTO chamados_imagens (chamado_id, imagem) VALUES ($1, $2)`, [chamadoId, img]);
            }

            await dbRun(`
                INSERT INTO chamados_historico (chamado_id, status_anterior, status_novo, autor_nome, criado_em)
                VALUES ($1, NULL, 'Analisando', $2, NOW())
            `, [chamadoId, req.user.nome]);

            const chamado = await dbGet(`
                SELECT c.*,
                    COALESCE(json_agg(ci.imagem ORDER BY ci.criado_em) FILTER (WHERE ci.id IS NOT NULL), '[]') as imagens,
                    COALESCE((
                        SELECT json_agg(h ORDER BY h.criado_em)
                        FROM chamados_historico h WHERE h.chamado_id = c.id
                    ), '[]') as historico
                FROM chamados c
                LEFT JOIN chamados_imagens ci ON ci.chamado_id = c.id
                WHERE c.id = $1
                GROUP BY c.id
            `, [chamadoId]);

            io.emit('chamado_novo', chamado);
            res.json({ success: true, chamado });
        } catch (e) {
            console.error('[chamados] POST erro:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // Atualizar status — apenas Desenvolvedor
    router.patch('/api/chamados/:id/status', authMiddleware, authorize(['Desenvolvedor']), async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const STATUS_VALIDOS = ['Analisando', 'Em andamento', 'Concluído'];
            if (!STATUS_VALIDOS.includes(status)) {
                return res.status(400).json({ success: false, message: 'Status inválido.' });
            }

            const chamado = await dbGet('SELECT * FROM chamados WHERE id = $1', [id]);
            if (!chamado) return res.status(404).json({ success: false, message: 'Chamado não encontrado.' });

            await dbRun(`
                UPDATE chamados SET status = $1, atualizado_em = NOW() WHERE id = $2
            `, [status, id]);

            await dbRun(`
                INSERT INTO chamados_historico (chamado_id, status_anterior, status_novo, autor_nome, criado_em)
                VALUES ($1, $2, $3, $4, NOW())
            `, [id, chamado.status, status, req.user.nome]);

            const atualizado = await dbGet(`
                SELECT c.*,
                    COALESCE(json_agg(ci.imagem ORDER BY ci.criado_em) FILTER (WHERE ci.id IS NOT NULL), '[]') as imagens,
                    COALESCE((
                        SELECT json_agg(h ORDER BY h.criado_em)
                        FROM chamados_historico h WHERE h.chamado_id = c.id
                    ), '[]') as historico
                FROM chamados c
                LEFT JOIN chamados_imagens ci ON ci.chamado_id = c.id
                WHERE c.id = $1
                GROUP BY c.id
            `, [id]);

            io.emit('chamado_status', atualizado);
            res.json({ success: true, chamado: atualizado });
        } catch (e) {
            console.error('[chamados] PATCH status erro:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    });

    return router;
};
