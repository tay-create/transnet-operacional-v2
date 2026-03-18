const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

// Cria entrada em saldo_paletes quando checklist é aprovado com paletização
async function criarSaldoPaletesDoChecklist({ veiculo_id, motorista_nome, placa_carreta, is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr }) {
    if (!is_paletizado || is_paletizado === 'NÃO' || !qtd_paletes || qtd_paletes <= 0) return;

    // Buscar placa do cavalo e unidade no veículo
    const veiculo = await dbGet("SELECT dados_json, inicio_rota FROM veiculos WHERE id = ?", [veiculo_id]).catch(() => null);
    let placaCavalo = '';
    let unidade = '';
    if (veiculo) {
        try {
            const dj = JSON.parse(veiculo.dados_json || '{}');
            placaCavalo = dj.placa1Motorista || '';
        } catch (_) {}
        unidade = veiculo.inicio_rota || '';
    }

    const qtdPbr = tipo_palete === 'PBR' ? (qtd_paletes || 0) : 0;
    const qtdDesc = tipo_palete === 'DESCARTAVEL' ? (qtd_paletes || 0) : 0;
    const tipoPaleteSaldo = tipo_palete || 'DESCARTAVEL';

    try {
        await dbRun(
            `INSERT INTO saldo_paletes
                (motorista, placa_cavalo, placa_carreta, tipo_palete, qtd_pbr, qtd_descartavel, fornecedor_pbr, unidade, observacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                motorista_nome, placaCavalo, placa_carreta,
                tipoPaleteSaldo, qtdPbr, qtdDesc,
                fornecedor_pbr || null, unidade,
                `Gerado automaticamente pelo checklist da carreta (veículo #${veiculo_id})`
            ]
        );
        console.log(`📦 [Saldo Paletes] Entrada criada automaticamente: ${motorista_nome} | ${tipoPaleteSaldo} x${qtd_paletes}`);
    } catch (e) {
        console.error('Erro ao criar saldo_paletes automaticamente:', e.message);
    }
}

module.exports = function createChecklistsRouter(io) {
    const router = express.Router();

    router.get('/api/checklists', authMiddleware, async (req, res) => {
        try {
            const cidade = req.user.cidade;
            const cargo = req.user.cargo;
            const filtrarPorCidade = ['Conferente', 'Encarregado'].includes(cargo);
            let checklists;
            if (filtrarPorCidade && cidade && cidade !== 'Ambas') {
                const cidadeFiltro = cidade === 'Moreno'
                    ? `(v.inicio_rota = 'Moreno' OR (v.coletamoreno IS NOT NULL AND v.coletamoreno != ''))`
                    : `(v.inicio_rota = 'Recife' AND (v.coletamoreno IS NULL OR v.coletamoreno = ''))`;
                checklists = await dbAll(
                    `SELECT c.* FROM checklists_carreta c
                     JOIN veiculos v ON v.id = c.veiculo_id
                     WHERE ${cidadeFiltro}
                     ORDER BY c.id DESC`
                );
            } else {
                checklists = await dbAll("SELECT * FROM checklists_carreta ORDER BY id DESC");
            }
            const formatted = checklists.map(c => ({
                ...c,
                placa_confere: c.placa_confere === 1
            }));
            res.json({ success: true, checklists: formatted });
        } catch (e) {
            console.error('Erro ao listar checklists:', e);
            res.status(500).json({ success: false, message: 'Erro ao listar checklists.' });
        }
    });

    router.post('/api/checklists', authMiddleware, async (req, res) => {
        try {
            const {
                veiculo_id, motorista_nome, placa_carreta, placa_confere,
                condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome,
                is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr
            } = req.body;

            const created_at = new Date().toISOString();

            // ── Auto-Aprovação ──
            const isAprovadoAto = placa_confere === true &&
                condicao_bau === 'Limpo e Intacto' &&
                !foto_vazamento;

            const statusChecklist = isAprovadoAto ? 'APROVADO' : 'PENDENTE';

            const result = await dbRun(
                `INSERT INTO checklists_carreta (
                    veiculo_id, motorista_nome, placa_carreta, placa_confere,
                    condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome,
                    created_at, status, is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0,
                    condicao_bau, cordas, foto_vazamento, assinatura, conferente_nome,
                    created_at, statusChecklist, is_paletizado, tipo_palete, qtd_paletes,
                    fornecedor_pbr || null
                ]
            );

            if (statusChecklist === 'PENDENTE') {
                // Emite alerta para Coordenador aprovar via socket apenas se ficou pendente
                io.emit('receber_alerta', {
                    tipo: 'checklist_pendente',
                    mensagem: `Novo checklist aguardando aprovação: ${placa_carreta}`
                });
            } else {
                // Se aprovado automaticamente, registrar saldo de paletes se houver paletização
                await criarSaldoPaletesDoChecklist({
                    veiculo_id, motorista_nome, placa_carreta,
                    is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr
                });
                // Avisa a operação para atualizar a view de bloqueios
                io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: veiculo_id });
            }

            res.json({ success: true, id: result.lastID, status: statusChecklist });
        } catch (e) {
            console.error('Erro ao criar checklist:', e);
            res.status(500).json({ success: false, message: 'Erro ao salvar checklist.' });
        }
    });

    router.put('/api/checklists/:id/status', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
        try {
            const { status } = req.body; // 'APROVADO' ou 'RECUSADO'
            if (!['APROVADO', 'RECUSADO'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Status inválido.' });
            }
            await dbRun("UPDATE checklists_carreta SET status = ? WHERE id = ?", [status, req.params.id]);

            // Notificar conferente sobre resultado do checklist
            const checklist = await dbGet(
                "SELECT veiculo_id, motorista_nome, placa_carreta, is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr FROM checklists_carreta WHERE id = ?",
                [req.params.id]
            );
            if (checklist) {
                if (status === 'APROVADO') {
                    // Registrar saldo de paletes ao aprovar manualmente
                    await criarSaldoPaletesDoChecklist(checklist);
                }
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
            res.status(500).json({ success: false, message: 'Erro ao atualizar status do checklist.' });
        }
    });

    // ── Conferente: Veículos ativos na operação (todos os status até CARREGADO) ──
    router.get('/api/conferente/veiculos', authMiddleware, authorize(['Conferente', 'Coordenador', 'Encarregado']), async (req, res) => {
        try {
            const cidade = req.user.cidade; // 'Recife', 'Moreno' ou 'Ambas' (teste)
            const STATUS_CONFERENTE = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO'];
            const placeholders = STATUS_CONFERENTE.map(() => '?').join(', ');
            const hoje = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];

            let rows = [];

            if (cidade === 'Ambas') {
                // Retorna cards de Recife E de Moreno, cada um como entrada separada
                const recife = await dbAll(
                    `SELECT id, motorista, placa, dados_json, status_recife as status, doca_recife as doca,
                        coleta, coletarecife, coletamoreno, data_prevista, situacao_cadastro,
                        tempos_recife as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, 'Recife' as _cidade
                     FROM veiculos WHERE status_recife IN (${placeholders}) AND data_prevista >= ? ORDER BY id DESC`,
                    [...STATUS_CONFERENTE, hoje]
                );
                const moreno = await dbAll(
                    `SELECT id, motorista, placa, dados_json, status_moreno as status, doca_moreno as doca,
                        coleta, coletarecife, coletamoreno, data_prevista, situacao_cadastro,
                        tempos_moreno as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, 'Moreno' as _cidade
                     FROM veiculos WHERE status_moreno IN (${placeholders}) AND data_prevista >= ? ORDER BY id DESC`,
                    [...STATUS_CONFERENTE, hoje]
                );
                rows = [...recife, ...moreno];
            } else {
                const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
                const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';
                const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';
                const cidadeFiltro = cidade === 'Moreno'
                    ? `(inicio_rota = 'Moreno' OR (coletamoreno IS NOT NULL AND coletamoreno != ''))`
                    : `(coletarecife IS NOT NULL AND coletarecife != '')`;
                rows = await dbAll(
                    `SELECT id, motorista, placa, dados_json, ${statusField} as status, ${docaField} as doca,
                        coleta, coletarecife, coletamoreno, data_prevista, situacao_cadastro,
                        ${temposField} as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, ? as _cidade
                     FROM veiculos WHERE ${statusField} IN (${placeholders}) AND data_prevista >= ? AND ${cidadeFiltro} ORDER BY id DESC`,
                    [cidade, ...STATUS_CONFERENTE, hoje]
                );
            }

            const formatted = await Promise.all(rows.map(async v => {
                const cidadeCard = v._cidade || cidade;
                let dados = {};
                try { dados = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch { }
                let ts = {};
                try { ts = typeof v.timestamps_status === 'string' ? JSON.parse(v.timestamps_status || '{}') : (v.timestamps_status || {}); } catch { }
                const coletaRecife = v.coletarecife || '';
                const coletaMoreno = v.coletamoreno || '';
                const isMista = !!(coletaRecife && coletaMoreno);

                // Verificar se checklist já foi aprovado (relevante para operações mistas)
                let checklistAprovado = false;
                if (isMista) {
                    const chk = await dbGet("SELECT id FROM checklists_carreta WHERE veiculo_id = ? AND status = 'APROVADO' LIMIT 1", [v.id]);
                    checklistAprovado = !!chk;
                }

                return {
                    id: v.id,
                    motorista: v.motorista || 'A DEFINIR',
                    placa1Motorista: dados.placa1Motorista || v.placa || '',
                    placa2Motorista: dados.placa2Motorista || '',
                    coleta: cidadeCard === 'Moreno' ? coletaMoreno : coletaRecife,
                    doca: v.doca,
                    status: v.status,
                    data_prevista: v.data_prevista,
                    isFrotaMotorista: dados.isFrotaMotorista || false,
                    situacao_cadastro: v.situacao_cadastro || dados.situacao_cadastro || 'NÃO CONFERIDO',
                    chk_cnh: v.chk_cnh || dados.chk_cnh || false,
                    chk_antt: v.chk_antt || dados.chk_antt || false,
                    chk_tacografo: v.chk_tacografo || dados.chk_tacografo || false,
                    chk_crlv: v.chk_crlv || dados.chk_crlv || false,
                    numero_liberacao: v.numero_liberacao || dados.numero_liberacao || '',
                    gerenciadora_risco: v.gerenciadora_risco || dados.gerenciadora_risco || '',
                    data_liberacao: v.data_liberacao || dados.data_liberacao || '',
                    timestamps_status: ts,
                    operacao: dados.operacao || '',
                    unidade: cidadeCard,
                    inicio_rota: v.inicio_rota || null,
                    isMista,
                    checklistAprovado
                };
            }));

            res.json({ success: true, veiculos: formatted });
        } catch (e) {
            console.error('Erro ao listar veículos conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao obter lista de veículos.' });
        }
    });

    // ── Conferente: Atualizar status e/ou doca ──
    router.post('/api/conferente/atualizar-status', authMiddleware, authorize(['Conferente', 'Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Auxiliar Operacional']), async (req, res) => {
        try {
            const { veiculoId, novoStatus, novaDoca, unidade, horaManual } = req.body;
            const cidade = req.user.cidade === 'Ambas' ? (unidade || 'Recife') : req.user.cidade;
            const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
            const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';
            const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';

            const veiculo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [veiculoId]);
            if (!veiculo) {
                console.warn(`⚠️ [Conferente/${cidade}] Tentativa de atualizar veículo ${veiculoId} não encontrado`);
                return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });
            }

            const statusAtual = veiculo[statusField];
            console.log(`🔄 [Conferente/${cidade}] Veículo #${veiculoId} (${veiculo.motorista || 'S/motorista'}): ${statusAtual} → ${novoStatus}${novaDoca ? ` | Doca: ${novaDoca}` : ''}`);

            // Ordem dos status para validar progressão
            const ORDEM = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO'];

            let dados = {};
            try { dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : (veiculo.dados_json || {}); } catch { }

            // ── Travas de segurança ao avançar para EM CARREGAMENTO ou além ──
            const STATUS_BLOQUEADOS = ['EM CARREGAMENTO', 'CARREGADO'];
            const avancoParaBloqueado = STATUS_BLOQUEADOS.includes(novoStatus) && !STATUS_BLOQUEADOS.includes(statusAtual);

            if (avancoParaBloqueado) {
                const situacao = veiculo.situacao_cadastro || dados.situacao_cadastro || 'NÃO CONFERIDO';
                let isFrota = String(dados.isFrotaMotorista) === 'true' || String(dados.isFrotaMotorista) === '1';

                if (!isFrota && veiculo.motorista) {
                    const checkFrota = await dbGet("SELECT is_frota FROM marcacoes_placas WHERE nome_motorista = ? AND nome_motorista != '' ORDER BY data_marcacao DESC LIMIT 1", [veiculo.motorista]);
                    if (checkFrota && checkFrota.is_frota === 1) isFrota = true;
                }

                if (!isFrota) {
                    // Verificar Ger. Risco
                    if (situacao !== 'LIBERADO') {
                        console.warn(`🔒 [Conferente/${cidade}] BLOQUEADO - Veículo #${veiculoId} (${veiculo.motorista}): Ger. Risco não liberado. Situação: ${situacao}`);
                        return res.status(403).json({ success: false, message: 'Bloqueado: Gerenciamento de Risco não liberou este veículo.' });
                    }

                    // Verificar checklist da carreta ao avançar para EM CARREGAMENTO
                    if (novoStatus === 'EM CARREGAMENTO') {
                        const chk = await dbGet("SELECT id FROM checklists_carreta WHERE veiculo_id = ? AND status = 'APROVADO' LIMIT 1", [veiculoId]);
                        if (!chk) {
                            console.warn(`🔒 [Conferente/${cidade}] BLOQUEADO - Veículo #${veiculoId} (${veiculo.motorista}): Checklist da Carreta não aprovado`);
                            return res.status(403).json({ success: false, message: 'Bloqueado: Checklist da Carreta não foi aprovado.' });
                        }

                        // Verificar expiração de 24h da liberação (coluna tem prioridade sobre dados_json)
                        const dataLib = veiculo.data_liberacao || dados.data_liberacao;
                        if (dataLib) {
                            const dataLibStr = dataLib.endsWith('Z') ? dataLib : dataLib + 'Z';
                            const idadeMs = Date.now() - new Date(dataLibStr).getTime();
                            if (idadeMs > 24 * 60 * 60 * 1000) {
                                const horas = Math.floor(idadeMs / 3600000);
                                console.warn(`🔒 [Conferente/${cidade}] BLOQUEADO - Veículo #${veiculoId} (${veiculo.motorista}): Liberação expirada há ${horas}h`);
                                return res.status(403).json({ success: false, expired: true, message: 'Liberação expirada (mais de 24h). Solicite renovação no Cadastro.' });
                            }
                        }
                    }
                }
            }

            // Montar timestamps e tempos conforme o novo status
            let agoraDt = new Date();
            if (horaManual && /^\d{2}:\d{2}$/.test(horaManual)) {
                const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
                agoraDt = new Date(`${hoje}T${horaManual}:00-03:00`);
            }
            const agora = agoraDt.toISOString();
            const agoraHHMM = horaManual || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });

            let ts = {};
            try { ts = typeof veiculo.timestamps_status === 'string' ? JSON.parse(veiculo.timestamps_status || '{}') : (veiculo.timestamps_status || {}); } catch { }
            let tempos = {};
            try { tempos = typeof veiculo[temposField] === 'string' ? JSON.parse(veiculo[temposField] || '{}') : (veiculo[temposField] || {}); } catch { }

            const prefix = cidade === 'Moreno' ? 'moreno' : 'recife';

            // Se horaManual, sempre sobrescreve o timestamp (correção manual)
            const forcar = !!horaManual;
            if (novoStatus === 'EM SEPARAÇÃO' && (forcar || !ts[`separacao_${prefix}_at`])) {
                ts[`separacao_${prefix}_at`] = agora;
            }
            if (novoStatus === 'LIBERADO P/ DOCA' && (forcar || !ts[`lib_doca_${prefix}_at`])) {
                ts[`lib_doca_${prefix}_at`] = agora;
            }
            if (novoStatus === 'EM CARREGAMENTO') {
                if (forcar || !ts[`carregamento_${prefix}_at`]) ts[`carregamento_${prefix}_at`] = agora;
                if (forcar || !tempos.t_inicio_carregamento) tempos.t_inicio_carregamento = agoraHHMM;
            }
            if (novoStatus === 'CARREGADO') {
                if (forcar || !ts[`carregado_${prefix}_at`]) ts[`carregado_${prefix}_at`] = agora;
                if (forcar || !tempos.t_inicio_carregado) tempos.t_inicio_carregado = agoraHHMM;
            }

            // Construir query de update
            const sets = [`${statusField} = ?`, `timestamps_status = ?`, `${temposField} = ?`];
            const vals = [novoStatus, JSON.stringify(ts), JSON.stringify(tempos)];

            if (novaDoca !== undefined && novaDoca !== null) {
                sets.push(`${docaField} = ?`);
                vals.push(novaDoca);
            }
            vals.push(veiculoId);

            await dbRun(`UPDATE veiculos SET ${sets.join(', ')} WHERE id = ?`, vals);
            console.log(`✅ [Conferente/${cidade}] Veículo #${veiculoId} (${veiculo.motorista || 'S/motorista'}) atualizado para "${novoStatus}" por ${req.user?.nome || 'conferente'}`);

            // Buscar o veículo atualizado do banco para emitir dados completos
            const veiculoAtualizado = await dbGet('SELECT * FROM veiculos WHERE id = ?', [veiculoId]);
            let dadosJson = {};
            try { dadosJson = JSON.parse(veiculoAtualizado?.dados_json || '{}'); } catch { }
            const socketPayload = {
                tipo: 'atualiza_veiculo',
                id: Number(veiculoId),
                ...(veiculoAtualizado || {}),
                rotaRecife: veiculoAtualizado?.rota_recife || '',
                rotaMoreno: veiculoAtualizado?.rota_moreno || '',
                coletaRecife: veiculoAtualizado?.coletarecife || '',
                coletaMoreno: veiculoAtualizado?.coletamoreno || '',
                tempos_recife: (() => { try { return JSON.parse(veiculoAtualizado?.tempos_recife || '{}'); } catch { return {}; } })(),
                tempos_moreno: (() => { try { return JSON.parse(veiculoAtualizado?.tempos_moreno || '{}'); } catch { return {}; } })(),
                status_coleta: (() => { try { return JSON.parse(veiculoAtualizado?.status_coleta || '{}'); } catch { return {}; } })(),
                imagens: (() => { try { return JSON.parse(veiculoAtualizado?.imagens || '[]'); } catch { return []; } })(),
                timestamps_status: (() => { try { return JSON.parse(veiculoAtualizado?.timestamps_status || '{}'); } catch { return {}; } })(),
                placa1Motorista: dadosJson.placa1Motorista || '',
                placa2Motorista: dadosJson.placa2Motorista || '',
                telefoneMotorista: dadosJson.telefoneMotorista || '',
            };

            // ── Notificações ──
            if (statusAtual !== novoStatus) {
                const docaAtual = novaDoca || veiculo[docaField] || 'N/A';
                const motoristaNome = veiculo.motorista || 'Motorista';
                const coletaNum = cidade === 'Moreno' ? (veiculo.coletamoreno || '') : (veiculo.coletarecife || '');
                const coletaInfo = coletaNum ? ` | Coleta: ${coletaNum}` : '';

                // Todos os status → notifica Auxiliar Operacional
                const cargosAlvo = ['Auxiliar Operacional'];

                // LIBERADO P/ DOCA → também notifica Cadastro e Conhecimento
                if (novoStatus === 'LIBERADO P/ DOCA') {
                    cargosAlvo.push('Cadastro', 'Conhecimento');
                    io.emit('conferente_novo_veiculo', {
                        veiculoId,
                        motorista: motoristaNome,
                        placa: veiculo.placa,
                        doca: docaAtual,
                        coleta: coletaNum,
                        cidade
                    });
                }

                io.emit('notificacao_direcionada', {
                    tipo: 'status_conferente',
                    mensagem: `[${cidade}] ${motoristaNome} → ${novoStatus} | Doca: ${docaAtual}${coletaInfo}`,
                    cargos_alvo: cargosAlvo
                });
            }

            io.emit('receber_atualizacao', socketPayload);

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao atualizar status pelo conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao atualizar status.' });
        }
    });

    // ── Conferente: Lista de Embarques ──
    router.get('/api/conferente/embarques', authMiddleware, authorize(['Conferente', 'Coordenador', 'Encarregado']), async (req, res) => {
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
                    ${docaField} as doca, coleta, coletarecife, coletamoreno, data_prevista
             FROM veiculos WHERE ${where} ORDER BY id DESC LIMIT 200`,
                params
            );

            const formatted = veiculos.map(v => {
                let dados = {};
                try { dados = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch { }
                return {
                    id: v.id,
                    motorista: v.motorista || 'A DEFINIR',
                    placa1Motorista: dados.placa1Motorista || v.placa || '',
                    placa2Motorista: dados.placa2Motorista || '',
                    coleta: cidade === 'Moreno' ? (v.coletamoreno || '') : (v.coletarecife || ''),
                    status: v.status,
                    doca: v.doca,
                    data: v.data_prevista
                };
            });

            res.json({ success: true, embarques: formatted });
        } catch (e) {
            console.error('Erro ao listar embarques conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao listar embarques.' });
        }
    });

    // ── Conferente: Liberar para Carregamento ──
    router.post('/api/conferente/liberar-carregamento', authMiddleware, authorize(['Conferente', 'Coordenador', 'Encarregado']), async (req, res) => {
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
            try { dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : (veiculo.dados_json || {}); } catch { }

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

                // Trava de expiração 24h (coluna tem prioridade sobre dados_json)
                const dataLib = veiculo.data_liberacao || dados.data_liberacao;
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
            try { tempos = typeof veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] === 'string' ? JSON.parse(veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] || '{}') : (veiculo[cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife'] || {}); } catch { }
            if (!tempos.t_inicio_carregamento) tempos.t_inicio_carregamento = agoraHHMM;

            // Atualizar timestamps ISO
            let ts = {};
            try { ts = typeof veiculo.timestamps_status === 'string' ? JSON.parse(veiculo.timestamps_status || '{}') : (veiculo.timestamps_status || {}); } catch { }
            const tsKey = cidade === 'Moreno' ? 'carregamento_moreno_at' : 'carregamento_recife_at';
            if (!ts[tsKey]) ts[tsKey] = agora;

            const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';
            await dbRun(
                `UPDATE veiculos SET ${statusField} = 'EM CARREGAMENTO', ${temposField} = ?, timestamps_status = ? WHERE id = ?`,
                [JSON.stringify(tempos), JSON.stringify(ts), veiculoId]
            );

            // Buscar veículo atualizado para emitir payload completo
            const veiculoAtualizado = await dbGet('SELECT * FROM veiculos WHERE id = ?', [veiculoId]);
            let dadosJsonAtual = {};
            try { dadosJsonAtual = JSON.parse(veiculoAtualizado?.dados_json || '{}'); } catch { }

            // Emitir notificações
            io.emit('conferente_liberar_carregamento', {
                veiculoId,
                motorista: veiculo.motorista,
                placa: veiculo.placa,
                doca: veiculo[docaField]
            });
            io.emit('receber_atualizacao', {
                tipo: 'atualiza_veiculo',
                id: Number(veiculoId),
                ...(veiculoAtualizado || {}),
                rotaRecife: veiculoAtualizado?.rota_recife || '',
                rotaMoreno: veiculoAtualizado?.rota_moreno || '',
                coletaRecife: veiculoAtualizado?.coletarecife || '',
                coletaMoreno: veiculoAtualizado?.coletamoreno || '',
                tempos_recife: (() => { try { return JSON.parse(veiculoAtualizado?.tempos_recife || '{}'); } catch { return {}; } })(),
                tempos_moreno: (() => { try { return JSON.parse(veiculoAtualizado?.tempos_moreno || '{}'); } catch { return {}; } })(),
                timestamps_status: (() => { try { return JSON.parse(veiculoAtualizado?.timestamps_status || '{}'); } catch { return {}; } })(),
                placa1Motorista: dadosJsonAtual.placa1Motorista || '',
                placa2Motorista: dadosJsonAtual.placa2Motorista || '',
                telefoneMotorista: dadosJsonAtual.telefoneMotorista || '',
            });
            io.emit('enviar_alerta', {
                tipo: 'aviso',
                origem: cidade,
                mensagem: `Conferente liberou carregamento: ${veiculo.motorista || 'Motorista'} - Doca ${veiculo[docaField] || 'N/A'}`
            });

            res.json({ success: true, message: 'Veículo liberado para carregamento.' });
        } catch (e) {
            console.error('Erro ao liberar carregamento:', e);
            res.status(500).json({ success: false, message: 'Erro ao processar liberação.' });
        }
    });

    // --- ROTAS DE CUBAGEM ---

    return router;
};
