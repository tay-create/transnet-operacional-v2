const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

const router = express.Router();

router.get('/api/veiculos/:id/ocorrencias', authMiddleware, async (req, res) => {
    try {
        const ocorrencias = await dbAll(
            "SELECT * FROM operacao_ocorrencias WHERE veiculo_id = ? ORDER BY data_criacao DESC",
            [req.params.id]
        );
        res.json({ success: true, ocorrencias });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST Nova Ocorrência ─────────────────────────
router.post('/api/veiculos/:id/ocorrencias', authMiddleware, async (req, res) => {
    try {
        const { descricao, foto_base64, motorista } = req.body;
        const veiculo_id = req.params.id;

        const result = await dbRun(
            `INSERT INTO operacao_ocorrencias (veiculo_id, motorista, descricao, foto_base64)
             VALUES (?, ?, ?, ?)`,
            [veiculo_id, motorista || 'N/A', descricao, foto_base64 || null]
        );

        res.json({ success: true, id: result.lastID });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET Todas as Ocorrências (com dados do veículo) ──
router.get('/api/ocorrencias', authMiddleware, async (req, res) => {
    try {
        const ocorrencias = await dbAll(`
            SELECT o.*, v.placa, v.operacao, v.coleta, v.unidade,
                   v.coletaRecife, v.coletaMoreno
            FROM operacao_ocorrencias o
            LEFT JOIN veiculos v ON o.veiculo_id = v.id
            ORDER BY o.data_criacao DESC
        `);
        res.json({ success: true, ocorrencias });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE Ocorrência ─────────────────────────────
router.delete('/api/ocorrencias/:id', authMiddleware, async (req, res) => {
    try {
        await dbRun("DELETE FROM operacao_ocorrencias WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});


module.exports = router;
