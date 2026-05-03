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
            const checklists = await dbAll("SELECT * FROM checklists_carreta ORDER BY id DESC");
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
                condicao_bau, cordas, foto_vazamento, midias_json, assinatura, conferente_nome,
                is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr
            } = req.body;

            const created_at = new Date().toISOString();
            const midiasStr = midias_json ? JSON.stringify(midias_json) : null;

            // ── Auto-Aprovação ──
            const isAprovadoAto = placa_confere === true &&
                condicao_bau === 'Limpo e Intacto' &&
                !foto_vazamento && !midias_json?.length;

            const statusChecklist = isAprovadoAto ? 'APROVADO' : 'PENDENTE';

            const result = await dbRun(
                `INSERT INTO checklists_carreta (
                    veiculo_id, motorista_nome, placa_carreta, placa_confere,
                    condicao_bau, cordas, foto_vazamento, midias_json, assinatura, conferente_nome,
                    created_at, status, is_paletizado, tipo_palete, qtd_paletes, fornecedor_pbr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    veiculo_id, motorista_nome, placa_carreta, placa_confere ? 1 : 0,
                    condicao_bau, cordas, foto_vazamento, midiasStr, assinatura, conferente_nome,
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
            console.error('Erro ao criar checklist:', e.message, e.stack);
            res.status(500).json({ success: false, message: e.message || 'Erro ao salvar checklist.' });
        }
    });

    router.put('/api/checklists/:id/status', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento', 'Encarregado']), async (req, res) => {
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

    // ── Reset Checklist (Coordenador libera para conferente refazer) ──
    router.delete('/api/checklists/veiculo/:veiculoId', authMiddleware, authorize(['Coordenador', 'Direção', 'Planejamento']), async (req, res) => {
        try {
            const veiculoId = Number(req.params.veiculoId);
            await dbRun("DELETE FROM checklists_carreta WHERE veiculo_id = ?", [veiculoId]);
            console.log(`🔄 [Checklist Reset] Veículo #${veiculoId} — checklist liberado por ${req.user?.nome || '?'}`);
            // Notificar conferentes que o checklist foi liberado
            io.emit('conferente_checklist_resultado', { veiculoId, status: 'RESET' });
            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: veiculoId });
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao resetar checklist:', e);
            res.status(500).json({ success: false, message: 'Erro ao resetar checklist.' });
        }
    });

    // ── Conferente: Veículos ativos na operação (todos os status até CARREGADO) ──
    router.get('/api/conferente/veiculos', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Encarregado']), async (req, res) => {
        try {
            const cidade = req.user.cidade; // 'Recife', 'Moreno' ou 'Ambas' (teste)
            const STATUS_CONFERENTE = ['AGUARDANDO P/ SEPARAÇÃO', 'AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ CARREGAMENTO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO'];
            const placeholders = STATUS_CONFERENTE.map(() => '?').join(', ');
            const hoje = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];

            const data = req.query.data || hoje;
            let rows = [];

            // Filtro por operação: determina se o veículo pertence a Recife ou Moreno pela string de operação
            const FILTRO_RECIFE = `(operacao LIKE '%RECIFE%')`;
            const FILTRO_MORENO = `(operacao LIKE '%MORENO%' OR operacao LIKE '%PORCELANA%' OR operacao LIKE '%ELETRIK%')`;

            if (cidade === 'Ambas') {
                // Retorna cards de Recife E de Moreno, cada um como entrada separada
                const recife = await dbAll(
                    `SELECT id, motorista, placa, dados_json, status_recife as status, doca_recife as doca,
                        status_recife, status_moreno,
                        coleta, coletarecife, coletamoreno, data_prevista, data_carregado_recife, data_carregado_moreno,
                        situacao_cadastro, tempos_recife as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, pausas_status, status_cte, 'Recife' as _cidade
                     FROM veiculos WHERE status_recife IN (${placeholders})
                       AND (
                         (status_recife != 'CARREGADO' AND data_prevista = ?)
                         OR (status_recife = 'CARREGADO' AND COALESCE(data_carregado_recife, data_prevista) = ?)
                       )
                       AND ${FILTRO_RECIFE} ORDER BY id DESC`,
                    [...STATUS_CONFERENTE, data, data]
                );
                const moreno = await dbAll(
                    `SELECT id, motorista, placa, dados_json, status_moreno as status, doca_moreno as doca,
                        status_recife, status_moreno,
                        coleta, coletarecife, coletamoreno, data_prevista, data_carregado_recife, data_carregado_moreno,
                        situacao_cadastro, tempos_moreno as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, pausas_status, status_cte, 'Moreno' as _cidade
                     FROM veiculos WHERE status_moreno IN (${placeholders})
                       AND (
                         (status_moreno != 'CARREGADO' AND data_prevista = ?)
                         OR (status_moreno = 'CARREGADO' AND COALESCE(data_carregado_moreno, data_prevista) = ?)
                       )
                       AND ${FILTRO_MORENO} ORDER BY id DESC`,
                    [...STATUS_CONFERENTE, data, data]
                );
                rows = [...recife, ...moreno];
            } else {
                const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
                const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';
                const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';
                const campoCarregado = cidade === 'Moreno' ? 'data_carregado_moreno' : 'data_carregado_recife';
                const cidadeFiltro = cidade === 'Moreno' ? FILTRO_MORENO : FILTRO_RECIFE;
                rows = await dbAll(
                    `SELECT id, motorista, placa, dados_json, ${statusField} as status, ${docaField} as doca,
                        status_recife, status_moreno,
                        coleta, coletarecife, coletamoreno, data_prevista, data_carregado_recife, data_carregado_moreno,
                        situacao_cadastro, ${temposField} as tempos, timestamps_status, inicio_rota,
                        chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                        numero_liberacao, gerenciadora_risco, data_liberacao, pausas_status, status_cte, ? as _cidade
                     FROM veiculos WHERE ${statusField} IN (${placeholders})
                       AND (
                         (${statusField} != 'CARREGADO' AND data_prevista = ?)
                         OR (${statusField} = 'CARREGADO' AND COALESCE(${campoCarregado}, data_prevista) = ?)
                       )
                       AND ${cidadeFiltro} ORDER BY id DESC`,
                    [cidade, ...STATUS_CONFERENTE, data, data]
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
                    pausas_status: v.pausas_status || '[]',
                    operacao: dados.operacao || '',
                    unidade: cidadeCard,
                    inicio_rota: v.inicio_rota || null,
                    coletaRecife,
                    coletaMoreno,
                    isMista,
                    checklistAprovado,
                    status_cte: v.status_cte || '',
                    status_recife: v.status_recife || '',
                    status_moreno: v.status_moreno || '',
                    entregaLocal: dados.entregaLocal || false
                };
            }));

            res.json({ success: true, veiculos: formatted });
        } catch (e) {
            console.error('Erro ao listar veículos conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao obter lista de veículos.' });
        }
    });

    // ── Conferente: Atualizar status e/ou doca ──
    router.post('/api/conferente/atualizar-status', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Auxiliar Operacional']), async (req, res) => {
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
            const ORDEM = ['AGUARDANDO P/ SEPARAÇÃO', 'AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ CARREGAMENTO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO'];

            let dados = {};
            try { dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : (veiculo.dados_json || {}); } catch { }

            const ehInterestadual = veiculo.operacao === 'LEÃO - SP' || veiculo.operacao === 'ELETRIK SUL';

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

                // Placas cadastradas no Provisionamento também ignoram as travas (igual frota)
                if (!isFrota) {
                    const placasVeiculo = [
                        veiculo.placa,
                        dados.placa,
                        dados.placa1Motorista,
                        dados.placa2Motorista,
                    ].filter(p => p && p !== '-' && p.trim() !== '');
                    if (placasVeiculo.length > 0) {
                        const ph = placasVeiculo.map(() => '?').join(', ');
                        const provV = await dbGet(
                            `SELECT id FROM prov_veiculos WHERE ativo = 1 AND (placa IN (${ph}) OR carreta IN (${ph})) LIMIT 1`,
                            [...placasVeiculo, ...placasVeiculo]
                        );
                        if (provV) isFrota = true;
                    }
                }

                if (!isFrota) {
                    // Verificar Ger. Risco
                    if (situacao !== 'LIBERADO') {
                        console.warn(`🔒 [Conferente/${cidade}] BLOQUEADO - Veículo #${veiculoId} (${veiculo.motorista}): Ger. Risco não liberado. Situação: ${situacao}`);
                        return res.status(403).json({ success: false, message: 'Bloqueado: Gerenciamento de Risco não liberou este veículo.' });
                    }

                    // Verificar checklist da carreta ao avançar para EM CARREGAMENTO (exceto interestaduais)
                    if (novoStatus === 'EM CARREGAMENTO' && !ehInterestadual) {
                        const chk = await dbGet("SELECT id FROM checklists_carreta WHERE veiculo_id = ? AND status = 'APROVADO' LIMIT 1", [veiculoId]);
                        if (!chk) {
                            console.warn(`🔒 [Conferente/${cidade}] BLOQUEADO - Veículo #${veiculoId} (${veiculo.motorista}): Checklist da Carreta não aprovado`);
                            return res.status(403).json({ success: false, message: 'Bloqueado: Checklist da Carreta não foi aprovado.' });
                        }

                        // Verificar expiração de 24h da liberação (coluna tem prioridade sobre dados_json)
                        // Pula verificação se CT-e já foi emitido
                        if (veiculo.status_cte !== 'Emitido') {
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
            if ((novoStatus === 'LIBERADO P/ CARREGAMENTO' || novoStatus === 'LIBERADO P/ DOCA') && (forcar || !ts[`lib_doca_${prefix}_at`])) {
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

            // Bloquear CARREGADO sem foto do lacre
            // Em operação consolidada (ambas coletas preenchidas), a primeira unidade pode pular — lacre só vai na última
            // Entrega Local e operações interestaduais dispensam foto do lacre
            if (novoStatus === 'CARREGADO' && !dados.entregaLocal && !ehInterestadual) {
                const campoLacre = prefix === 'moreno' ? 'foto_lacre_moreno' : 'foto_lacre_recife';
                const ehConsolidada = !!(veiculo.coletarecife && veiculo.coletamoreno);
                const statusOutraUnidade = prefix === 'moreno' ? veiculo.status_recife : veiculo.status_moreno;
                const outraJaCarregada = statusOutraUnidade === 'CARREGADO';
                // Só permite pular se for consolidada E a outra unidade ainda não foi carregada (é a "primeira")
                const podePular = ehConsolidada && !outraJaCarregada;

                if (!veiculo[campoLacre] && !podePular) {
                    return res.status(403).json({
                        success: false,
                        precisaFotoLacre: true,
                        message: 'Foto do lacre obrigatória para marcar como CARREGADO.',
                    });
                }
            }

            // Construir query de update
            const sets = [`${statusField} = ?`, `timestamps_status = ?`, `${temposField} = ?`];
            const vals = [novoStatus, JSON.stringify(ts), JSON.stringify(tempos)];

            if (novaDoca !== undefined && novaDoca !== null) {
                sets.push(`${docaField} = ?`);
                vals.push(novaDoca);
            }

            // Gravar âncora de data ao marcar CARREGADO (garante que o card fique no dia certo)
            if (novoStatus === 'CARREGADO') {
                const campoDataCarregado = cidade === 'Moreno' ? 'data_carregado_moreno' : 'data_carregado_recife';
                const dataCarregado = agoraDt.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
                sets.push(`${campoDataCarregado} = ?`);
                vals.push(dataCarregado);
            }

            vals.push(veiculoId);

            await dbRun(`UPDATE veiculos SET ${sets.join(', ')} WHERE id = ?`, vals);
            console.log(`✅ [Conferente/${cidade}] Veículo #${veiculoId} (${veiculo.motorista || 'S/motorista'}) atualizado para "${novoStatus}" por ${req.user?.nome || 'conferente'}`);

            // ── Sync Provisionamento: AGUARDANDO P/ SEPARAÇÃO → EM_OPERACAO / EM CARREGAMENTO → CARREGANDO / CARREGADO → CARREGADO ──
            const STATUS_SYNC_PROV = { 'AGUARDANDO P/ SEPARAÇÃO': 'EM_OPERACAO', 'AGUARDANDO': 'EM_OPERACAO', 'EM CARREGAMENTO': 'CARREGANDO', 'CARREGADO': 'CARREGADO' };
            if (STATUS_SYNC_PROV[novoStatus]) {
                try {
                    const dataSync = agoraDt.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
                    const placas = [
                        veiculo.placa,
                        veiculo.carreta,
                        dados.placa1Motorista,
                        dados.placa2Motorista,
                    ].filter(p => p && p !== '-' && p.trim() !== '');
                    if (placas.length > 0) {
                        const provV = await dbGet(
                            `SELECT id, placa FROM prov_veiculos WHERE ativo = 1 AND (placa = ANY($1) OR COALESCE(carreta,'') = ANY($1))`,
                            [placas]
                        );
                        if (provV) {
                            const statusProv = STATUS_SYNC_PROV[novoStatus];
                            await dbRun(
                                `INSERT INTO prov_programacao (veiculo_id, data, status)
                                 VALUES ($1, $2, $3)
                                 ON CONFLICT (veiculo_id, data) DO UPDATE SET status = $3`,
                                [provV.id, dataSync, statusProv]
                            );
                            io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id: provV.id, data: dataSync, status: statusProv, placa: provV.placa });

                            // Propagar para frota_roteirizacoes
                            try {
                                const rot = await dbGet(
                                    `SELECT id FROM frota_roteirizacoes
                                     WHERE (LOWER(placa_cavalo) = LOWER($1) OR LOWER(placa_carreta) = LOWER($1))
                                       AND status NOT IN ('CONCLUIDO')
                                     ORDER BY id DESC LIMIT 1`,
                                    [provV.placa]
                                );
                                if (rot) {
                                    await dbRun(`UPDATE frota_roteirizacoes SET status=$1, atualizado_em=NOW() WHERE id=$2`, [statusProv, rot.id]);
                                    const rotAtualizada = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [rot.id]);
                                    let destinos = [];
                                    try { destinos = JSON.parse(rotAtualizada.destinos_json || '[]'); } catch {}
                                    io.emit('receber_atualizacao', {
                                        tipo: 'roteirizacao_atualizada', acao: 'status',
                                        roteirizacao: { ...rotAtualizada, destinos, status_manual: rotAtualizada.status }
                                    });
                                }
                            } catch (syncFrota) {
                                console.warn('⚠️ [Sync Frota] Erro ao propagar status conferente→frota:', syncFrota.message);
                            }
                        }
                    }
                } catch (syncErr) {
                    console.error('⚠️ [Sync Prov] Erro ao atualizar provisionamento:', syncErr);
                }
            }
            // ──────────────────────────────────────────────────────────

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
                const cargosAlvo = (novoStatus === 'LIBERADO P/ CARREGAMENTO' || novoStatus === 'LIBERADO P/ DOCA')
                    ? ['Cadastro', 'Conhecimento']
                    : ['Auxiliar Operacional'];

                // LIBERADO P/ CARREGAMENTO → também notifica Cadastro e Conhecimento
                if (novoStatus === 'LIBERADO P/ CARREGAMENTO' || novoStatus === 'LIBERADO P/ DOCA') {
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

                // CARREGADO → notifica Planejamento no sininho (alerta persistido)
                if (novoStatus === 'CARREGADO') {
                    try {
                        const alertaDados = {
                            tipo: 'veiculo_carregado',
                            origem: cidade,
                            mensagem: `Veículo carregado: ${motoristaNome}${coletaInfo}`,
                            data_criacao: new Date().toISOString()
                        };
                        const result = await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify(alertaDados)]);
                        io.emit('receber_alerta', { ...alertaDados, idInterno: result.lastID });
                    } catch (e) {
                        console.error('Erro ao emitir alerta veiculo_carregado:', e);
                    }
                }
            }

            io.emit('receber_atualizacao', socketPayload);

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao atualizar status pelo conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao atualizar status.' });
        }
    });

    // ── Conferente: Salvar fotos do lacre (array) ──
    router.post('/api/conferente/salvar-lacre', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Auxiliar Operacional']), async (req, res) => {
        try {
            const { veiculoId, unidade, fotos } = req.body;
            if (!veiculoId || !fotos || !fotos.length) return res.status(400).json({ success: false, message: 'veiculoId e fotos obrigatórios.' });
            const veiculo = await dbGet(`SELECT coletarecife, coletamoreno FROM veiculos WHERE id = ?`, [veiculoId]);
            const ehConsolidada = !!(veiculo && veiculo.coletarecife && veiculo.coletamoreno);
            const valor = JSON.stringify(fotos);

            if (ehConsolidada) {
                // Em consolidada: salva nos dois campos para aparecer em ambos os cards
                await dbRun(`UPDATE veiculos SET foto_lacre_recife = $1, foto_lacre_moreno = $1 WHERE id = $2`, [valor, veiculoId]);
                io.emit('receber_atualizacao', { tipo: 'foto_lacre', veiculoId, campo: 'foto_lacre_recife', fotos });
                io.emit('receber_atualizacao', { tipo: 'foto_lacre', veiculoId, campo: 'foto_lacre_moreno', fotos });
            } else {
                const cidade = req.user.cidade === 'Ambas' ? (unidade || 'Recife') : req.user.cidade;
                const campo = cidade === 'Moreno' ? 'foto_lacre_moreno' : 'foto_lacre_recife';
                await dbRun(`UPDATE veiculos SET ${campo} = $1 WHERE id = $2`, [valor, veiculoId]);
                io.emit('receber_atualizacao', { tipo: 'foto_lacre', veiculoId, campo, fotos });
            }
            res.json({ success: true });
        } catch (e) {
            console.error('[Conferente/salvar-lacre] Erro:', e);
            res.status(500).json({ success: false, message: 'Erro ao salvar fotos do lacre.' });
        }
    });

    // ── Conferente: Transferência (pula direto para CARREGADO, sem validações) ──
    router.post('/api/conferente/transferencia', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Encarregado']), async (req, res) => {
        try {
            const { veiculoId, unidade } = req.body;
            const cidade = req.user.cidade === 'Ambas' ? (unidade || 'Recife') : req.user.cidade;
            const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
            const temposField = cidade === 'Moreno' ? 'tempos_moreno' : 'tempos_recife';
            const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';

            const veiculo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [veiculoId]);
            if (!veiculo) return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });

            const statusAtual = veiculo[statusField];
            if (statusAtual === 'CARREGADO') return res.json({ success: true, message: 'Já está CARREGADO.' });

            const agora = new Date().toISOString();
            const agoraHHMM = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });
            const prefix = cidade === 'Moreno' ? 'moreno' : 'recife';

            let ts = {};
            try { ts = JSON.parse(veiculo.timestamps_status || '{}'); } catch { }
            let tempos = {};
            try { tempos = JSON.parse(veiculo[temposField] || '{}'); } catch { }

            // Preencher timestamps intermediários faltantes para manter SLA consistente
            if (!ts[`separacao_${prefix}_at`]) ts[`separacao_${prefix}_at`] = agora;
            if (!ts[`lib_doca_${prefix}_at`]) ts[`lib_doca_${prefix}_at`] = agora;
            if (!ts[`carregamento_${prefix}_at`]) ts[`carregamento_${prefix}_at`] = agora;
            ts[`carregado_${prefix}_at`] = agora;

            if (!tempos.t_inicio_carregamento) tempos.t_inicio_carregamento = agoraHHMM;
            tempos.t_inicio_carregado = agoraHHMM;

            await dbRun(
                `UPDATE veiculos SET ${statusField} = 'CARREGADO', timestamps_status = ?, ${temposField} = ? WHERE id = ?`,
                [JSON.stringify(ts), JSON.stringify(tempos), veiculoId]
            );

            console.log(`🔄 [Transferência/${cidade}] Veículo #${veiculoId} (${veiculo.motorista || '?'}): ${statusAtual} → CARREGADO por ${req.user?.nome || 'conferente'}`);

            // Buscar dados atualizados para socket
            const atualizado = await dbGet('SELECT * FROM veiculos WHERE id = ?', [veiculoId]);
            let dadosJson = {};
            try { dadosJson = JSON.parse(atualizado?.dados_json || '{}'); } catch { }
            io.emit('receber_atualizacao', {
                tipo: 'atualiza_veiculo',
                id: Number(veiculoId),
                ...(atualizado || {}),
                rotaRecife: atualizado?.rota_recife || '',
                rotaMoreno: atualizado?.rota_moreno || '',
                coletaRecife: atualizado?.coletarecife || '',
                coletaMoreno: atualizado?.coletamoreno || '',
                tempos_recife: (() => { try { return JSON.parse(atualizado?.tempos_recife || '{}'); } catch { return {}; } })(),
                tempos_moreno: (() => { try { return JSON.parse(atualizado?.tempos_moreno || '{}'); } catch { return {}; } })(),
                status_coleta: (() => { try { return JSON.parse(atualizado?.status_coleta || '{}'); } catch { return {}; } })(),
                imagens: (() => { try { return JSON.parse(atualizado?.imagens || '[]'); } catch { return []; } })(),
                timestamps_status: (() => { try { return JSON.parse(atualizado?.timestamps_status || '{}'); } catch { return {}; } })(),
                placa1Motorista: dadosJson.placa1Motorista || '',
                placa2Motorista: dadosJson.placa2Motorista || '',
                telefoneMotorista: dadosJson.telefoneMotorista || '',
            });

            // Notificar
            const motoristaNome = veiculo.motorista || 'Motorista';
            const coletaNum = cidade === 'Moreno' ? (veiculo.coletamoreno || '') : (veiculo.coletarecife || '');
            io.emit('notificacao_direcionada', {
                tipo: 'status_conferente',
                mensagem: `[${cidade}] TRANSFERÊNCIA — ${motoristaNome} → CARREGADO${coletaNum ? ` | Coleta: ${coletaNum}` : ''}`,
                cargos_alvo: ['Auxiliar Operacional', 'Planejamento']
            });

            // Notifica Planejamento no sininho (alerta persistido)
            try {
                const coletaInfo = coletaNum ? ` | Coleta: ${coletaNum}` : '';
                const alertaDados = {
                    tipo: 'veiculo_carregado',
                    origem: cidade,
                    mensagem: `Veículo carregado: ${motoristaNome}${coletaInfo}`,
                    data_criacao: new Date().toISOString()
                };
                const result = await dbRun(`INSERT INTO notificacoes (dados_json) VALUES (?)`, [JSON.stringify(alertaDados)]);
                io.emit('receber_alerta', { ...alertaDados, idInterno: result.lastID });
            } catch (e) {
                console.error('Erro ao emitir alerta veiculo_carregado (transferência):', e);
            }

            res.json({ success: true });
        } catch (e) {
            console.error('Erro na transferência:', e);
            res.status(500).json({ success: false, message: 'Erro ao processar transferência.' });
        }
    });

    // ── Conferente: Lista de Embarques ──
    router.get('/api/conferente/embarques', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Encarregado']), async (req, res) => {
        try {
            const cidade = req.user.cidade;
            const statusField = cidade === 'Moreno' ? 'status_moreno' : 'status_recife';
            const docaField = cidade === 'Moreno' ? 'doca_moreno' : 'doca_recife';
            const { dataInicio, dataFim } = req.query;

            let where = `${statusField} IS NOT NULL`;
            const params = [];
            if (dataInicio) { where += ` AND data_prevista >= ?`; params.push(dataInicio); }
            if (dataFim) { where += ` AND data_prevista <= ?`; params.push(dataFim); }

            const veiculos = await dbAll(
                `SELECT id, motorista, placa, dados_json, ${statusField} as status,
                    ${docaField} as doca, coleta, coletarecife, coletamoreno, data_prevista,
                    timestamps_status, pausas_status, unidade, operacao, inicio_rota,
                    situacao_cadastro, numero_liberacao, data_liberacao, status_cte,
                    chk_cnh, chk_antt, chk_tacografo, chk_crlv
             FROM veiculos WHERE ${where} ORDER BY id DESC LIMIT 200`,
                params
            );

            const formatted = veiculos.map(v => {
                let dados = {};
                try { dados = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {}); } catch { }
                const isMista = (v.operacao || '').includes('X') || (v.operacao || '').includes('/');
                return {
                    id: v.id,
                    motorista: v.motorista || 'A DEFINIR',
                    placa1Motorista: dados.placa1Motorista || v.placa || '',
                    placa2Motorista: dados.placa2Motorista || '',
                    coleta: cidade === 'Moreno' ? (v.coletamoreno || '') : (v.coletarecife || ''),
                    status: v.status,
                    doca: v.doca,
                    data: v.data_prevista,
                    unidade: v.unidade || 'Recife',
                    operacao: v.operacao || '',
                    inicio_rota: v.inicio_rota || '',
                    isMista,
                    situacao_cadastro: v.situacao_cadastro || dados.situacao_cadastro || '',
                    numero_liberacao: v.numero_liberacao || dados.numero_liberacao || '',
                    data_liberacao: v.data_liberacao || dados.data_liberacao || null,
                    status_cte: v.status_cte || '',
                    isFrotaMotorista: String(dados.isFrotaMotorista) === 'true' || String(dados.isFrotaMotorista) === '1',
                    chk_cnh: v.chk_cnh, chk_antt: v.chk_antt, chk_tacografo: v.chk_tacografo, chk_crlv: v.chk_crlv,
                    timestamps_status: (() => { try { return JSON.parse(v.timestamps_status || '{}'); } catch { return {}; } })(),
                    pausas_status: v.pausas_status || '[]',
                };
            });

            res.json({ success: true, embarques: formatted });
        } catch (e) {
            console.error('Erro ao listar embarques conferente:', e);
            res.status(500).json({ success: false, message: 'Erro ao listar embarques.' });
        }
    });

    // ── Conferente: Liberar para Carregamento ──
    router.post('/api/conferente/liberar-carregamento', authMiddleware, authorize(['Conferente', 'Coordenador', 'Direção', 'Encarregado']), async (req, res) => {
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
            if (statusAtual !== 'LIBERADO P/ CARREGAMENTO' && statusAtual !== 'LIBERADO P/ DOCA') {
                return res.status(400).json({ success: false, message: `Status atual é "${statusAtual}", esperado "LIBERADO P/ CARREGAMENTO".` });
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

            // Placas cadastradas no Provisionamento também ignoram as travas (igual frota)
            if (!isFrota) {
                const placasVeiculo = [veiculo.placa, veiculo.carreta].filter(p => p && p !== '-');
                if (placasVeiculo.length > 0) {
                    const ph = placasVeiculo.map(() => '?').join(', ');
                    const provV = await dbGet(
                        `SELECT id FROM prov_veiculos WHERE ativo = 1 AND (placa IN (${ph}) OR carreta IN (${ph})) LIMIT 1`,
                        [...placasVeiculo, ...placasVeiculo]
                    );
                    if (provV) isFrota = true;
                }
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
                // Pula verificação se CT-e já foi emitido
                if (veiculo.status_cte !== 'Emitido') {
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
