const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

const router = express.Router();

router.get('/api/checklists', authMiddleware, async (req, res) => {
    try {
        const checklists = await dbAll("SELECT * FROM checklists_carreta ORDER BY id DESC");
        // Cast sqlite integers back to booleans
        const formatted = checklists.map(c => ({
            ...c,
            placa_confere: c.placa_confere === 1
        }));
        res.json({ success: true, checklists: formatted });
    } catch (e) {
        console.error('Erro ao listar checklists:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

router.post('/api/checklists', authMiddleware, async (req, res) => {
    try {
        const { veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome } = req.body;

        const created_at = new Date().toISOString();

        // ── Auto-Aprovação ──
        // A placa física confere com a informada acima? == SIM (placa_confere == true)
        // 2. Condição do Baú == "Limpo e Intacto"
        // 4. Estrutura (Vazamentos ou furos no teto) == NÃO (!foto_vazamento)
        const isAprovadoAto = placa_confere === true &&
            condicao_bau === 'Limpo e Intacto' &&
            !foto_vazamento;

        const statusChecklist = isAprovadoAto ? 'APROVADO' : 'PENDENTE';

        const result = await dbRun(
            `INSERT INTO checklists_carreta (veiculo_id, motorista_nome, placa_carreta, placa_confere, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0, condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome, created_at, statusChecklist]
        );

        if (statusChecklist === 'PENDENTE') {
            // Emite alerta para Coordenador aprovar via socket apenas se ficou pendente
            io.emit('receber_alerta', {
                tipo: 'checklist_pendente',
                mensagem: `Novo checklist aguardando aprovação: ${placa_carreta}`
            });
        } else {
            // Se aprovado automaticamente, avisa a operação para atualizar a view de bloqueios
            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: veiculo_id });
        }

        res.json({ success: true, id: result.lastID, status: statusChecklist });
    } catch (e) {
        console.error('Erro ao criar checklist:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

router.put('/api/checklists/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
    try {
        const { status } = req.body; // 'APROVADO' ou 'RECUSADO'
        if (!['APROVADO', 'RECUSADO'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        await dbRun("UPDATE checklists_carreta SET status = ? WHERE id = ?", [status, req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao atualizar checklist:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- ROTAS DE CUBAGEM ---


module.exports = router;
