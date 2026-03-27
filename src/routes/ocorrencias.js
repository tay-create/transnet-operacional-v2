const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
module.exports = function createOcorrenciasRouter(registrarLog, io) {
    const router = express.Router();

    router.get('/api/veiculos/:id/ocorrencias', authMiddleware, async (req, res) => {
        try {
            const ocorrencias = await dbAll(
                "SELECT * FROM operacao_ocorrencias WHERE veiculo_id = ? ORDER BY data_criacao DESC",
                [req.params.id]
            );
            res.json({ success: true, ocorrencias });
        } catch (e) {
            console.error('Erro ao buscar ocorrências:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar ocorrências.' });
        }
    });

    // ── POST Nova Ocorrência ─────────────────────────
    router.post('/api/veiculos/:id/ocorrencias', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção']), async (req, res) => {
        try {
            const { descricao, foto_base64, motorista } = req.body;
            const veiculo_id = req.params.id;

            const result = await dbRun(
                `INSERT INTO operacao_ocorrencias (veiculo_id, motorista, descricao, foto_base64)
             VALUES (?, ?, ?, ?)`,
                [veiculo_id, motorista || 'N/A', descricao, foto_base64 || null]
            );

            const criador = req.user?.nome || 'desconhecido';
            console.log(`🚨 [Ocorrência] Veículo #${veiculo_id} (${motorista || 'N/A'}) | Criada por: ${criador} | "${descricao?.substring(0, 60)}"`);
            await registrarLog('OCORRÊNCIA_CRIADA', criador, veiculo_id, 'veiculo', null, null, descricao);

            // Notifica Pos Embarque e Cadastro em tempo real
            if (io) {
                io.emit('receber_alerta', {
                    tipo: 'nova_ocorrencia',
                    mensagem: `Nova ocorrência registrada por ${criador}: "${(descricao || '').substring(0, 80)}"`,
                    motorista: motorista || 'N/A',
                    veiculo_id,
                    criador,
                    data_criacao: new Date().toISOString()
                });
                io.emit('ocorrencias_update');
            }

            res.json({ success: true, id: result.lastID });
        } catch (e) {
            console.error('Erro ao buscar ocorrências:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar ocorrências.' });
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
            console.error('Erro ao buscar ocorrências:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar ocorrências.' });
        }
    });

    // ── DELETE Ocorrência ─────────────────────────────
    router.delete('/api/ocorrencias/:id', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
        try {
            await dbRun("DELETE FROM operacao_ocorrencias WHERE id = ?", [req.params.id]);
            if (io) {
                io.emit('receber_atualizacao', { tipo: 'ocorrencia_deletada', id: req.params.id });
                io.emit('ocorrencias_update');
            }
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao buscar ocorrências:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar ocorrências.' });
        }
    });


    return router;
};
