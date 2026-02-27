const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

module.exports = function createChecklistsRouter(io) {
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

        // Notificar conferente sobre resultado do checklist
        const checklist = await dbGet("SELECT veiculo_id, motorista_nome FROM checklists_carreta WHERE id = ?", [req.params.id]);
        if (checklist) {
            io.emit('conferente_checklist_resultado', {
                veiculoId: checklist.veiculo_id,
                motorista: checklist.motorista_nome,
                status
            });
            // Atualizar view da operação
            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: checklist.veiculo_id });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao atualizar checklist:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Conferente: Veículos com status "LIBERADO P/ DOCA" ──
router.get('/api/conferente/veiculos', authMiddleware, authorize(['Conferente', 'Coordenador']), async (req, res) => {
    try {
        const cidade = req.user.cidade; // 'Recife' ou 'Moreno'
        const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
        const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';

        const veiculos = await dbAll(
            `SELECT id, motorista, placa, dados_json, ${statusField} as status, ${docaField} as doca,
                    coleta, coletaRecife, coletaMoreno, data_prevista, situacao_cadastro
             FROM veiculos
             WHERE ${statusField} = 'LIBERADO P/ DOCA'
             ORDER BY id DESC`
        );

        const formatted = veiculos.map(v => {
            let dados = {};
            try { dados = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch {}
            return {
                id: v.id,
                motorista: v.motorista || 'A DEFINIR',
                placa1Motorista: dados.placa1Motorista || v.placa || '',
                placa2Motorista: dados.placa2Motorista || '',
                coleta: cidade === 'Moreno' ? v.coletaMoreno : v.coletaRecife,
                doca: v.doca,
                status: v.status,
                data_prevista: v.data_prevista,
                dados_json: v.dados_json,
                isFrotaMotorista: dados.isFrotaMotorista || false,
                situacao_cadastro: v.situacao_cadastro || dados.situacao_cadastro || 'NÃO CONFERIDO'
            };
        });

        res.json({ success: true, veiculos: formatted });
    } catch (e) {
        console.error('Erro ao listar veículos conferente:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Conferente: Lista de Embarques ──
router.get('/api/conferente/embarques', authMiddleware, authorize(['Conferente', 'Coordenador']), async (req, res) => {
    try {
        const cidade = req.user.cidade;
        const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
        const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';
        const { dataInicio, dataFim } = req.query;

        let where = '1=1';
        const params = [];
        if (dataInicio) { where += ` AND data_prevista >= ?`; params.push(dataInicio); }
        if (dataFim) { where += ` AND data_prevista <= ?`; params.push(dataFim); }

        const veiculos = await dbAll(
            `SELECT id, motorista, placa, dados_json, ${statusField} as status,
                    ${docaField} as doca, coleta, coletaRecife, coletaMoreno, data_prevista
             FROM veiculos WHERE ${where} ORDER BY id DESC LIMIT 200`,
            params
        );

        const formatted = veiculos.map(v => {
            let dados = {};
            try { dados = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch {}
            return {
                id: v.id,
                motorista: v.motorista || 'A DEFINIR',
                placa1Motorista: dados.placa1Motorista || v.placa || '',
                placa2Motorista: dados.placa2Motorista || '',
                coleta: cidade === 'Moreno' ? v.coletaMoreno : v.coletaRecife,
                status: v.status,
                doca: v.doca,
                data: v.data_prevista
            };
        });

        res.json({ success: true, embarques: formatted });
    } catch (e) {
        console.error('Erro ao listar embarques conferente:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Conferente: Liberar para Carregamento ──
router.post('/api/conferente/liberar-carregamento', authMiddleware, authorize(['Conferente', 'Coordenador']), async (req, res) => {
    try {
        const { veiculoId } = req.body;
        const cidade = req.user.cidade;
        const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
        const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';

        const veiculo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [veiculoId]);
        if (!veiculo) {
            return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });
        }

        const statusAtual = veiculo[statusField];
        if (statusAtual !== 'LIBERADO P/ DOCA') {
            return res.status(400).json({ success: false, message: `Status atual é "${statusAtual}", esperado "LIBERADO P/ DOCA".` });
        }

        // Verificar travas (Ger. Risco + Checklist)
        let dados = {};
        try { dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : (veiculo.dados_json || {}); } catch {}

        const situacao = veiculo.situacao_cadastro || dados.situacao_cadastro || 'NÃO CONFERIDO';
        let isFrota = String(dados.isFrotaMotorista) === 'true' || String(dados.isFrotaMotorista) === '1';

        if (!isFrota && veiculo.motorista) {
            const checkFrotaBd = await dbGet("SELECT is_frota FROM marcacoes_placas WHERE nome_motorista = ? AND nome_motorista != '' ORDER BY data_marcacao DESC LIMIT 1", [veiculo.motorista]);
            if (checkFrotaBd && checkFrotaBd.is_frota === 1) isFrota = true;
        }

        if (!isFrota) {
            const chk = await dbGet("SELECT id FROM checklists_carreta WHERE veiculo_id = ? AND status = 'APROVADO' LIMIT 1", [veiculoId]);
            const checklistAprovado = !!chk;

            if (situacao !== 'LIBERADO' || !checklistAprovado) {
                const motivos = [];
                if (situacao !== 'LIBERADO') motivos.push('Ger. Risco');
                if (!checklistAprovado) motivos.push('Checklist da Carreta');
                return res.status(403).json({
                    success: false,
                    message: `Bloqueado: É necessário aprovação do ${motivos.join(' e do ')} para liberar o carregamento.`
                });
            }

            // Trava de expiração 24h
            const dataLib = dados.data_liberacao || veiculo.data_liberacao;
            if (dataLib) {
                const dataLibStr = dataLib.endsWith('Z') ? dataLib : dataLib + 'Z';
                if ((Date.now() - new Date(dataLibStr).getTime()) > 24 * 60 * 60 * 1000) {
                    return res.status(403).json({
                        success: false,
                        message: 'Liberação expirada (mais de 24h). Solicite renovação no Cadastro.'
                    });
                }
            }
        }

        // Atualizar status para EM CARREGAMENTO
        const agora = new Date().toISOString();
        const agoraHHMM = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });

        // Atualizar tempos
        let tempos = {};
        try { tempos = typeof veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] === 'string' ? JSON.parse(veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] || '{}') : (veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] || {}); } catch {}
        if (!tempos.t_inicio_carregamento) tempos.t_inicio_carregamento = agoraHHMM;

        // Atualizar timestamps ISO
        let ts = {};
        try { ts = typeof veiculo.timestamps_status === 'string' ? JSON.parse(veiculo.timestamps_status || '{}') : (veiculo.timestamps_status || {}); } catch {}
        const tsKey = cidade === 'Moreno' ? 'carregamento_moreno_at' : 'carregamento_recife_at';
        if (!ts[tsKey]) ts[tsKey] = agora;

        const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';
        await dbRun(
            `UPDATE veiculos SET ${statusField} = 'EM CARREGAMENTO', ${temposField} = ?, timestamps_status = ? WHERE id = ?`,
            [JSON.stringify(tempos), JSON.stringify(ts), veiculoId]
        );

        // Emitir notificações
        io.emit('conferente_liberar_carregamento', {
            veiculoId,
            motorista: veiculo.motorista,
            placa: veiculo.placa,
            doca: veiculo[docaField]
        });
        io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: veiculoId });
        io.emit('enviar_alerta', {
            tipo: 'aviso',
            origem: cidade,
            mensagem: `Conferente liberou carregamento: ${veiculo.motorista || 'Motorista'} - Doca ${veiculo[docaField] || 'N/A'}`
        });

        res.json({ success: true, message: 'Veículo liberado para carregamento.' });
    } catch (e) {
        console.error('Erro ao liberar carregamento:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- ROTAS DE CUBAGEM ---

return router;
};
