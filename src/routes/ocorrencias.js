const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { ROLES } = require('../../middleware/roles');
module.exports = function createOcorrenciasRouter(registrarLog, io) {
    const router = express.Router();

    router.get('/api/veiculos/:id/ocorrencias', authMiddleware, asyncHandler(async (req, res) => {
            const ocorrencias = await dbAll(
                "SELECT * FROM operacao_ocorrencias WHERE veiculo_id = ? ORDER BY data_criacao DESC",
                [req.params.id]
            );
            res.json({ success: true, ocorrencias });
        }));

    // ── POST Nova Ocorrência ─────────────────────────
    router.post('/api/veiculos/:id/ocorrencias', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção']), asyncHandler(async (req, res) => {
            const { descricao, foto_base64, midias_json, motorista } = req.body;
            const veiculo_id = req.params.id;

            const midiasStr = midias_json ? JSON.stringify(midias_json) : null;

            const result = await dbRun(
                `INSERT INTO operacao_ocorrencias (veiculo_id, motorista, descricao, foto_base64, midias_json)
             VALUES (?, ?, ?, ?, ?)`,
                [veiculo_id, motorista || 'N/A', descricao, foto_base64 || null, midiasStr]
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
        }));

    // ── GET Todas as Ocorrências (com dados do veículo) ──
    router.get('/api/ocorrencias', authMiddleware, asyncHandler(async (req, res) => {
            const ocorrencias = await dbAll(`
            SELECT o.*, v.placa, v.operacao, v.coleta, v.unidade,
                   v.coletaRecife, v.coletaMoreno
            FROM operacao_ocorrencias o
            LEFT JOIN veiculos v ON o.veiculo_id = v.id
            ORDER BY o.data_criacao DESC
        `);
            // Para vídeos: omitir campo 'data' (base64 pesado) na listagem, manter só thumb
            const ocorrenciasLeves = ocorrencias.map(o => {
                if (!o.midias_json) return o;
                try {
                    const midias = typeof o.midias_json === 'string' ? JSON.parse(o.midias_json) : o.midias_json;
                    if (!Array.isArray(midias)) return o;
                    const midiasLeves = midias.map(m => m.tipo === 'video' ? { tipo: 'video', thumb: m.thumb || null, tem_video: true } : m);
                    return { ...o, midias_json: JSON.stringify(midiasLeves) };
                } catch (_) { return o; }
            });
            res.json({ success: true, ocorrencias: ocorrenciasLeves });
        }));

    // ── GET Mídias completas de uma ocorrência (inclui vídeo base64) ──
    router.get('/api/ocorrencias/:id/midias', authMiddleware, asyncHandler(async (req, res) => {
            const o = await dbGet("SELECT midias_json FROM operacao_ocorrencias WHERE id = ?", [req.params.id]);
            if (!o) return res.status(404).json({ success: false });
            let midias = [];
            if (o.midias_json) {
                try { midias = typeof o.midias_json === 'string' ? JSON.parse(o.midias_json) : o.midias_json; } catch (_) {}
            }
            res.json({ success: true, midias });
        }));

    // ── DELETE Ocorrência ─────────────────────────────
    router.delete('/api/ocorrencias/:id', authMiddleware, authorize(['Coordenador', 'Direção']), asyncHandler(async (req, res) => {
            await dbRun("DELETE FROM operacao_ocorrencias WHERE id = ?", [req.params.id]);
            if (io) {
                io.emit('receber_atualizacao', { tipo: 'ocorrencia_deletada', id: req.params.id });
                io.emit('ocorrencias_update');
            }
            res.json({ success: true });
        }));


    return router;
};
