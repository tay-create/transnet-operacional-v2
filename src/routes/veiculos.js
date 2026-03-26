const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

// Função centralizada de data/hora no timezone de Brasília
const obterDataHoraBrasilia = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Factory: recebe io e registrarLog do server.js
module.exports = function createVeiculosRouter(io, registrarLog) {
    const router = express.Router();

    router.get('/veiculos', authMiddleware, async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 200, 500);
            const offset = (page - 1) * limit;

            const [rows, countRow] = await Promise.all([
                dbAll(`
                SELECT v.*,
                       (SELECT m.telefone FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as telefone_bd,
                       (SELECT m.is_frota FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as is_frota_bd,
                       (SELECT COUNT(*) FROM checklists_carreta c WHERE c.veiculo_id = v.id) as checklist_count
                FROM veiculos v
                ORDER BY v.id DESC LIMIT ? OFFSET ?
            `, [limit, offset]),
                dbAll("SELECT COUNT(*) as total FROM veiculos")
            ]);

            const total = countRow[0]?.total || 0;
            const veiculos = rows.map(row => {
                let dados_json = {};
                try {
                    dados_json = JSON.parse(row.dados_json || '{}');
                } catch (e) { }

                // Spreada toda a row (SELECT v.* já traz todos os campos do banco)
                // e sobrescreve apenas os que precisam de tratamento especial
                return {
                    ...row,
                    // Campos renomeados no banco (snake_case / lowercase → camelCase do frontend)
                    rotaRecife: row.rota_recife,
                    rotaMoreno: row.rota_moreno,
                    coletaRecife: row.coletarecife || row.coletaRecife || '',
                    coletaMoreno: row.coletamoreno || row.coletaMoreno || '',
                    // Campos JSON que precisam de parse
                    tempos_recife: (() => { try { return JSON.parse(row.tempos_recife || '{}'); } catch { return {}; } })(),
                    tempos_moreno: (() => { try { return JSON.parse(row.tempos_moreno || '{}'); } catch { return {}; } })(),
                    status_coleta: (() => { try { return JSON.parse(row.status_coleta || '{}'); } catch { return {}; } })(),
                    imagens: (() => { try { return JSON.parse(row.imagens || '[]'); } catch { return []; } })(),
                    timestamps_status: (() => { try { return JSON.parse(row.timestamps_status || '{}'); } catch { return {}; } })(),
                    // Defaults para campos que podem ser null
                    observacao: row.observacao || '',
                    numero_coleta: row.numero_coleta || '',
                    numero_cte: row.numero_cte || '',
                    chave_cte: row.chave_cte || '',
                    situacao_cadastro: row.situacao_cadastro || 'NÃO CONFERIDO',
                    numero_liberacao: row.numero_liberacao || '',
                    data_liberacao: row.data_liberacao || null,
                    chk_cnh: row.chk_cnh ? 1 : 0,
                    chk_antt: row.chk_antt ? 1 : 0,
                    chk_tacografo: row.chk_tacografo ? 1 : 0,
                    chk_crlv: row.chk_crlv ? 1 : 0,
                    // Campos derivados do dados_json e de marcacoes_placas
                    tipoVeiculo: dados_json.tipoVeiculo || '',
                    placa1Motorista: dados_json.placa1Motorista || '',
                    placa2Motorista: dados_json.placa2Motorista || '',
                    telefoneMotorista: dados_json.telefoneMotorista || row.telefone_bd || '',
                    telefone: row.telefone_bd || dados_json.telefoneMotorista || '',
                    isFrotaMotorista: dados_json.isFrotaMotorista || row.is_frota_bd === 1 || false,
                    checklistFeito: parseInt(row.checklist_count) > 0,
                    dados_json: row.dados_json || '{}'
                };
            });
            res.json({ success: true, veiculos, total, page, limit, totalPages: Math.ceil(total / limit) });
        } catch (e) { res.status(500).json({ success: false }); }
    });

    router.get('/veiculos/:id', authMiddleware, async (req, res) => {
        try {
            const row = await dbGet(`
                SELECT v.*,
                       (SELECT m.telefone FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as telefone_bd,
                       (SELECT m.is_frota FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as is_frota_bd
                FROM veiculos v WHERE v.id = ?
            `, [req.params.id]);
            if (!row) return res.status(404).json({ success: false });
            const dados_json = (() => { try { return JSON.parse(row.dados_json || '{}'); } catch { return {}; } })();
            
            // Standardize transformation (same logic as GET /veiculos)
            const veiculo = {
                ...row,
                // Renamed fields (snake_case -> camelCase)
                rotaRecife: row.rota_recife,
                rotaMoreno: row.rota_moreno,
                coletaRecife: row.coletarecife || row.coletaRecife || '',
                coletaMoreno: row.coletamoreno || row.coletaMoreno || '',
                // JSON fields
                tempos_recife: (() => { try { return JSON.parse(row.tempos_recife || '{}'); } catch { return {}; } })(),
                tempos_moreno: (() => { try { return JSON.parse(row.tempos_moreno || '{}'); } catch { return {}; } })(),
                status_coleta: (() => { try { return JSON.parse(row.status_coleta || '{}'); } catch { return {}; } })(),
                imagens: (() => { try { return JSON.parse(row.imagens || '[]'); } catch { return []; } })(),
                timestamps_status: (() => { try { return JSON.parse(row.timestamps_status || '{}'); } catch { return {}; } })(),
                // Defaults
                observacao: row.observacao || '',
                numero_coleta: row.numero_coleta || '',
                numero_cte: row.numero_cte || '',
                chave_cte: row.chave_cte || '',
                situacao_cadastro: row.situacao_cadastro || 'NÃO CONFERIDO',
                numero_liberacao: row.numero_liberacao || '',
                data_liberacao: row.data_liberacao || null,
                chk_cnh: row.chk_cnh ? 1 : 0,
                chk_antt: row.chk_antt ? 1 : 0,
                chk_tacografo: row.chk_tacografo ? 1 : 0,
                chk_crlv: row.chk_crlv ? 1 : 0,
                // Extra fields from dados_json or related rows
                tipoVeiculo: dados_json.tipoVeiculo || '',
                placa1Motorista: dados_json.placa1Motorista || '',
                placa2Motorista: dados_json.placa2Motorista || '',
                telefoneMotorista: dados_json.telefoneMotorista || row.telefone_bd || '',
                telefone: row.telefone_bd || dados_json.telefoneMotorista || '',
                isFrotaMotorista: dados_json.isFrotaMotorista || row.is_frota_bd === 1 || false,
                dados_json: row.dados_json || '{}'
            };
            res.json({ success: true, veiculo });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    router.post('/veiculos', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), validate(novoLancamentoSchema), async (req, res) => {
        try {
            const v = req.body;
            const data_criacao = obterDataHoraBrasilia();

            // Validar coleta obrigatória conforme unidade da operação
            const temColetaRecife = (v.coletaRecife || '').trim().length > 0;
            const temColetaMoreno = (v.coletaMoreno || '').trim().length > 0;
            const ehRecife = v.operacao && /RECIFE/i.test(v.operacao);
            const ehMoreno = v.operacao && /MORENO/i.test(v.operacao);
            if (ehRecife && !temColetaRecife) {
                return res.status(400).json({ success: false, message: 'Campo obrigatório: Coleta Recife não pode estar vazio.' });
            }
            if (ehMoreno && !temColetaMoreno) {
                return res.status(400).json({ success: false, message: 'Campo obrigatório: Coleta Moreno não pode estar vazio.' });
            }

            // Herdar dados de checklist/liberação do cadastro do motorista do frontend como fallback, 
            // mas tentar buscar o mais atualizado pelo telefone, se existir
            let chk_cnh = v.chk_cnh ? 1 : 0, chk_antt = v.chk_antt ? 1 : 0, chk_tacografo = v.chk_tacografo ? 1 : 0, chk_crlv = v.chk_crlv ? 1 : 0;
            let situacao_cadastro = v.situacao_cadastro || 'NÃO CONFERIDO', numero_liberacao = v.numero_liberacao || null, data_liberacao = v.data_liberacao || null;
            let telefoneMotorista = v.telefoneMotorista ? v.telefoneMotorista.replace(/\D/g, '') : null;
            let isFrotaMotorista = v.isFrotaMotorista === true;
            const placaAlvo = (v.placa1Motorista || '').trim();
            const motoristaNome = (v.motorista || '').trim();

            if (telefoneMotorista || placaAlvo || motoristaNome) {
                const cad = await dbGet(
                    `SELECT telefone, is_frota, chk_cnh_cad, chk_antt_cad, chk_tacografo_cad, chk_crlv_cad,
                        situacao_cad, num_liberacao_cad, data_liberacao_cad
                 FROM marcacoes_placas
                 WHERE (telefone IS NOT NULL AND (REPLACE(REPLACE(REPLACE(telefone,' ',''),'-',''),'+','') LIKE '%' || ? || '%' OR telefone = ?))
                    OR (placa1 IS NOT NULL AND placa1 = ?)
                    OR (nome_motorista IS NOT NULL AND nome_motorista = ?)
                 ORDER BY data_marcacao DESC LIMIT 1`,
                    [
                        telefoneMotorista || 'NO_MATCH_123',
                        telefoneMotorista || 'NO_MATCH_123',
                        placaAlvo || 'NO_MATCH_123',
                        motoristaNome || 'NO_MATCH_123'
                    ]
                );
                if (cad) {
                    if (!telefoneMotorista && cad.telefone) {
                        telefoneMotorista = cad.telefone.replace(/\D/g, '');
                    }
                    if (!isFrotaMotorista && cad.is_frota) {
                        isFrotaMotorista = true;
                    }
                    chk_cnh = cad.chk_cnh_cad ? 1 : 0;
                    chk_antt = cad.chk_antt_cad ? 1 : 0;
                    chk_tacografo = cad.chk_tacografo_cad ? 1 : 0;
                    chk_crlv = cad.chk_crlv_cad ? 1 : 0;
                    situacao_cadastro = cad.situacao_cad || 'NÃO CONFERIDO';
                    numero_liberacao = cad.num_liberacao_cad || null;
                    data_liberacao = cad.data_liberacao_cad || null;
                }
            }

            // Garantir consistência: se coleta genérica existe mas o campo específico não, copiar
            if (ehMoreno && !temColetaMoreno && v.coleta) { v.coletaMoreno = v.coleta; }
            if (ehRecife && !temColetaRecife && v.coleta) { v.coletaRecife = v.coleta; }

            // Auto-extrair numero_coleta na criação
            const primeiroTagIns = (tags) => {
                if (!tags || !tags.trim()) return '';
                return tags.split(',').map(t => t.trim()).filter(Boolean)[0] || '';
            };
            const tagRecIns = primeiroTagIns(v.coletaRecife);
            const tagMorIns = primeiroTagIns(v.coletaMoreno);
            if (tagRecIns && tagMorIns) {
                v.numero_coleta = `REC: ${tagRecIns} | MOR: ${tagMorIns}`;
            } else if (tagRecIns) {
                v.numero_coleta = tagRecIns;
            } else if (tagMorIns) {
                v.numero_coleta = tagMorIns;
            }

            // Verificar coletas duplicadas em operações ativas
            const tagsRec = (v.coletaRecife || '').split(',').map(t => t.trim()).filter(Boolean);
            const tagsMor = (v.coletaMoreno || '').split(',').map(t => t.trim()).filter(Boolean);
            const STATUS_FINAIS = ['FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'];
            const placeholders = STATUS_FINAIS.map(() => '?').join(',');
            for (const tag of [...tagsRec, ...tagsMor]) {
                const existente = await dbGet(
                    `SELECT id, motorista FROM veiculos
                     WHERE (coletaRecife LIKE ? OR coletaMoreno LIKE ?)
                       AND (status_recife IS NULL OR status_recife NOT IN (${placeholders}))
                       AND (status_moreno IS NULL OR status_moreno NOT IN (${placeholders}))
                     LIMIT 1`,
                    [`%${tag}%`, `%${tag}%`, ...STATUS_FINAIS, ...STATUS_FINAIS]
                );
                if (existente) {
                    return res.status(409).json({
                        success: false,
                        message: `Coleta "${tag}" já está em uso (veículo #${existente.id} — ${existente.motorista || 'S/motorista'}).`
                    });
                }
            }

            // data_inicio_patio: herda data_marcacao (Tempo de Espera) se motorista tem marcação
            let data_inicio_patio = null;
            if (motoristaNome && motoristaNome !== 'A DEFINIR') {
                if (v.id_marcacao) {
                    const marcPatio = await dbGet("SELECT data_marcacao FROM marcacoes_placas WHERE id = ?", [v.id_marcacao]);
                    data_inicio_patio = marcPatio?.data_marcacao || data_criacao;
                } else if (telefoneMotorista) {
                    const marcPatio = await dbGet("SELECT data_marcacao FROM marcacoes_placas WHERE telefone = ? ORDER BY data_marcacao DESC LIMIT 1", [telefoneMotorista]);
                    data_inicio_patio = marcPatio?.data_marcacao || data_criacao;
                } else {
                    data_inicio_patio = data_criacao;
                }
            }

            const query = `INSERT INTO veiculos (
            placa, modelo, motorista, status_recife, status_moreno,
            doca_recife, doca_moreno, coleta, coletaRecife, coletaMoreno,
            rota_recife, rota_moreno, numero_coleta,
            unidade, operacao, inicio_rota, origem_criacao, data_prevista,
            data_criacao, tempos_recife, tempos_moreno, status_coleta,
            observacao, imagens,
            chk_cnh, chk_antt, chk_tacografo, chk_crlv,
            situacao_cadastro, numero_liberacao, data_liberacao,
            dados_json, data_prevista_original, data_inicio_patio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const values = [
                v.placa || 'NÃO INFORMADA', v.modelo, v.motorista, v.status_recife, v.status_moreno,
                v.doca_recife, v.doca_moreno, v.coleta, v.coletaRecife, v.coletaMoreno,
                v.rotaRecife || '', v.rotaMoreno || '', v.numero_coleta || '',
                v.unidade, v.operacao, v.inicio_rota, v.origem_criacao, v.data_prevista,
                data_criacao,
                JSON.stringify(v.tempos_recife || {}),
                JSON.stringify(v.tempos_moreno || {}),
                JSON.stringify(v.status_coleta || {}),
                v.observacao || '',
                JSON.stringify(v.imagens || []),
                chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                situacao_cadastro, numero_liberacao, data_liberacao,
                JSON.stringify({
                    ...v,
                    telefoneMotorista: telefoneMotorista,
                    isFrotaMotorista: isFrotaMotorista,
                    chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                    situacao_cadastro, numero_liberacao, data_liberacao
                }),
                v.data_prevista_original || v.data_prevista,
                data_inicio_patio
            ];

            const result = await dbRun(query, values);

            // Atualizar status da marcação para 'Contratado' ou 'EM ROTA' (congela tempo de espera informando data_contratacao)
            // Frota própria (is_frota=1) NÃO muda status — pode carregar múltiplas vezes por dia
            const agora = obterDataHoraBrasilia();
            if (v.id_marcacao) {
                const marc = await dbGet("SELECT is_frota FROM marcacoes_placas WHERE id = ?", [v.id_marcacao]);
                if (marc && marc.is_frota === 1) {
                    await dbRun("UPDATE marcacoes_placas SET data_contratacao = COALESCE(data_contratacao, ?) WHERE id = ?", [agora, v.id_marcacao]);
                } else {
                    await dbRun("UPDATE marcacoes_placas SET disponibilidade = 'Contratado', status_operacional = 'EM ROTA', data_contratacao = COALESCE(data_contratacao, ?) WHERE id = ?", [agora, v.id_marcacao]);
                }
                io.emit('marcacao_atualizada');
            } else if (telefoneMotorista) {
                const marc = await dbGet("SELECT is_frota FROM marcacoes_placas WHERE telefone = ?", [telefoneMotorista]);
                if (marc && marc.is_frota === 1) {
                    await dbRun("UPDATE marcacoes_placas SET data_contratacao = COALESCE(data_contratacao, ?) WHERE telefone = ?", [agora, telefoneMotorista]);
                } else {
                    await dbRun("UPDATE marcacoes_placas SET status_operacional = 'EM ROTA', data_contratacao = COALESCE(data_contratacao, ?) WHERE telefone = ?", [agora, telefoneMotorista]);
                }
                io.emit('marcacao_atualizada');
            }

            const novo = {
                id: result.lastID, ...v, data_criacao,
                telefone: telefoneMotorista || '',
                isFrotaMotorista: isFrotaMotorista || false,
                chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                situacao_cadastro, numero_liberacao, data_liberacao,
                dados_json: JSON.stringify({
                    ...v,
                    telefoneMotorista: telefoneMotorista,
                    isFrotaMotorista: isFrotaMotorista,
                    chk_cnh, chk_antt, chk_tacografo, chk_crlv,
                    situacao_cadastro, numero_liberacao, data_liberacao
                })
            };

            // Registrar log de criação
            await registrarLog(
                'CRIAÇÃO',
                req.user.nome,
                result.lastID,
                'veiculo',
                null,
                null,
                `Coleta: ${v.coleta || v.coletaRecife || v.coletaMoreno || 'N/A'} | Operação: ${v.operacao} | Motorista: ${v.motorista || 'A definir'}`
            );

            io.emit('receber_atualizacao', { tipo: 'novo_veiculo', dados: novo });
            res.json({ success: true, id: result.lastID });
        } catch (e) { console.error(e); res.status(500).json({ success: false }); }
    });
    router.put('/veiculos/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
        try {
            const v = req.body;
            console.log(`[DEBUG veiculos.js] PUT /veiculos/${req.params.id} -> req.body.motorista: "${v.motorista}", old motorista in req: "${v.itemOriginal?.motorista}"`);

            // Buscar dados antigos para auditoria
            const veiculoAntigo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [req.params.id]);

            // ── Trava de Segurança: bloquear avanço sem liberação do Ger. Risco ──
            // Bloqueia ao SAIR de "LIBERADO P/ DOCA" para o próximo status (EM CARREGAMENTO em diante)
            const STATUS_BLOQUEADOS = ['EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e', 'DESPACHADO'];
            if (veiculoAntigo) {
                const dadosAntigos = (() => { try { return JSON.parse(veiculoAntigo.dados_json || '{}'); } catch { return {}; } })();
                // Coluna dedicada tem prioridade sobre dados_json (evita leitura de valor desatualizado)
                const situacao = veiculoAntigo.situacao_cadastro || dadosAntigos.situacao_cadastro || 'NÃO CONFERIDO';

                const avancoRecife =
                    STATUS_BLOQUEADOS.includes(v.status_recife) &&
                    !STATUS_BLOQUEADOS.includes(veiculoAntigo.status_recife);
                const avancoMoreno =
                    STATUS_BLOQUEADOS.includes(v.status_moreno) &&
                    !STATUS_BLOQUEADOS.includes(veiculoAntigo.status_moreno);

                // Buscar status de frota diretamente do cadastro de placas para ser a prova de falhas
                let isFrota = String(v.isFrotaMotorista) === 'true' || String(v.isFrotaMotorista) === '1' || String(dadosAntigos.isFrotaMotorista) === 'true' || String(dadosAntigos.isFrotaMotorista) === '1';

                if (!isFrota && veiculoAntigo.motorista) {
                    const checkFrotaBd = await dbGet("SELECT is_frota FROM marcacoes_placas WHERE nome_motorista = ? AND nome_motorista != '' ORDER BY data_marcacao DESC LIMIT 1", [veiculoAntigo.motorista]);
                    if (checkFrotaBd && checkFrotaBd.is_frota === 1) {
                        isFrota = true;
                    }
                }

                if ((avancoRecife || avancoMoreno) && situacao !== 'LIBERADO' && !isFrota) {
                    return res.status(403).json({
                        success: false,
                        message: 'Checklist incompleto. Conclua a liberação no Cadastro antes de avançar o status.'
                    });
                }
                // Trava de expiração 24h (só valida ao avançar para EM CARREGAMENTO)
                const mudouParaCarregamentoRecife =
                    v.status_recife === 'EM CARREGAMENTO' &&
                    veiculoAntigo.status_recife !== 'EM CARREGAMENTO';
                const mudouParaCarregamentoMoreno =
                    v.status_moreno === 'EM CARREGAMENTO' &&
                    veiculoAntigo.status_moreno !== 'EM CARREGAMENTO';
                if ((mudouParaCarregamentoRecife || mudouParaCarregamentoMoreno) && situacao === 'LIBERADO' && veiculoAntigo.status_cte !== 'Emitido') {
                    const dataLib = veiculoAntigo.data_liberacao || dadosAntigos.data_liberacao;
                    if (dataLib) {
                        const dataLibStr = dataLib.endsWith('Z') ? dataLib : dataLib + 'Z';
                        if ((Date.now() - new Date(dataLibStr).getTime()) > 24 * 60 * 60 * 1000) {
                            return res.status(403).json({
                                success: false,
                                expired: true,
                                message: 'Liberação expirada (mais de 24h). Solicite renovação no Cadastro.'
                            });
                        }
                    }
                }

                // ── Trava Dupla: Ger. Risco + Checklist Carreta (a partir de EM CARREGAMENTO) ──
                const STATUS_TRAVA_DUPLA = ['EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e', 'DESPACHADO'];
                const avancoDuploRecife = STATUS_TRAVA_DUPLA.includes(v.status_recife) && !STATUS_TRAVA_DUPLA.includes(veiculoAntigo.status_recife);
                const avancoDuploMoreno = STATUS_TRAVA_DUPLA.includes(v.status_moreno) && !STATUS_TRAVA_DUPLA.includes(veiculoAntigo.status_moreno);

                if ((avancoDuploRecife || avancoDuploMoreno) && !isFrota) {
                    // Procura se existe ALGUM checklist aprovado para este veículo
                    const chk = await dbGet("SELECT id FROM checklists_carreta WHERE veiculo_id = ? AND status = 'APROVADO' LIMIT 1", [req.params.id]);

                    // Considera aprovado se encontrou pelo menos um registro com status APROVADO
                    const checklistAprovado = !!chk;

                    if (situacao !== 'LIBERADO' || !checklistAprovado) {
                        const motivos = [];
                        if (situacao !== 'LIBERADO') motivos.push('Ger. Risco');
                        if (!checklistAprovado) motivos.push('Checklist da Carreta');
                        return res.status(403).json({
                            success: false,
                            message: `Status bloqueado: É necessário aprovação do ${motivos.join(' e do ')} para iniciar o carregamento.`
                        });
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────────────

            // Lógica de visibilidade: limpar campos de unidades que não fazem mais parte da operação
            const op = v.operacao || '';
            const precisaRecife = op.includes('RECIFE');
            const precisaMoreno = op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');

            if (!precisaRecife) {
                v.coletaRecife = '';
                v.rotaRecife = '';
                v.status_recife = 'AGUARDANDO';
                v.doca_recife = 'SELECIONE';
            }
            if (!precisaMoreno) {
                v.coletaMoreno = '';
                v.rotaMoreno = '';
                v.status_moreno = 'AGUARDANDO';
                v.doca_moreno = 'SELECIONE';
            }

            // ── Gatilhos automáticos de tempo (HH:MM — mantidos para compatibilidade) ──
            {
                const agora = new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife'
                });
                const setIfNull = (obj, campo, valor) => { if (!obj[campo]) obj[campo] = valor; };

                const tr = v.tempos_recife && typeof v.tempos_recife === 'object' ? { ...v.tempos_recife } : {};
                const tm = v.tempos_moreno && typeof v.tempos_moreno === 'object' ? { ...v.tempos_moreno } : {};

                const srAntigo = veiculoAntigo ? veiculoAntigo.status_recife : null;
                const smAntigo = veiculoAntigo ? veiculoAntigo.status_moreno : null;

                if (v.status_recife !== srAntigo) {
                    if (v.status_recife === 'EM SEPARAÇÃO') setIfNull(tr, 't_inicio_separacao', agora);
                    if (v.status_recife === 'EM CARREGAMENTO') setIfNull(tr, 't_inicio_carregamento', agora);
                    if (v.status_recife === 'CARREGADO') tr.t_inicio_carregado = agora;
                    if (v.status_recife === 'LIBERADO P/ CT-e') tr.t_fim_liberado_cte = agora;
                }
                if (v.status_moreno !== smAntigo) {
                    if (v.status_moreno === 'EM SEPARAÇÃO') setIfNull(tm, 't_inicio_separacao', agora);
                    if (v.status_moreno === 'EM CARREGAMENTO') setIfNull(tm, 't_inicio_carregamento', agora);
                    if (v.status_moreno === 'CARREGADO') tm.t_inicio_carregado = agora;
                    if (v.status_moreno === 'LIBERADO P/ CT-e') tm.t_fim_liberado_cte = agora;
                }

                v.tempos_recife = tr;
                v.tempos_moreno = tm;
            }

            // ── Timestamps ISO completos para SLA (autoritativo) ──────────────────
            {
                const agora = new Date().toISOString();
                const setIfNull = (obj, campo, valor) => { if (!obj[campo]) obj[campo] = valor; };

                const ts = v.timestamps_status && typeof v.timestamps_status === 'object'
                    ? { ...v.timestamps_status }
                    : (() => { try { return JSON.parse(veiculoAntigo?.timestamps_status || '{}'); } catch { return {}; } })();

                const srAntigo = veiculoAntigo ? veiculoAntigo.status_recife : null;
                const smAntigo = veiculoAntigo ? veiculoAntigo.status_moreno : null;

                // Entrada no pátio = data_criacao do veículo (já existe, não sobrescrever)

                // Recife
                if (v.status_recife !== srAntigo) {
                    if (v.status_recife === 'EM SEPARAÇÃO') setIfNull(ts, 'separacao_recife_at', agora);
                    if (v.status_recife === 'LIBERADO P/ DOCA') setIfNull(ts, 'lib_doca_recife_at', agora);
                    if (v.status_recife === 'EM CARREGAMENTO') setIfNull(ts, 'carregamento_recife_at', agora);
                    if (v.status_recife === 'CARREGADO') {
                        ts.carregado_recife_at = agora;
                        v.data_carregado_recife = agora.substring(0, 10);
                    }
                    if (v.status_recife === 'LIBERADO P/ CT-e' && !ts.cte_recife_at) ts.cte_recife_at = agora;
                }

                // Moreno
                if (v.status_moreno !== smAntigo) {
                    if (v.status_moreno === 'EM SEPARAÇÃO') setIfNull(ts, 'separacao_moreno_at', agora);
                    if (v.status_moreno === 'LIBERADO P/ DOCA') setIfNull(ts, 'lib_doca_moreno_at', agora);
                    if (v.status_moreno === 'EM CARREGAMENTO') setIfNull(ts, 'carregamento_moreno_at', agora);
                    if (v.status_moreno === 'CARREGADO') {
                        ts.carregado_moreno_at = agora;
                        v.data_carregado_moreno = agora.substring(0, 10);
                    }
                    if (v.status_moreno === 'LIBERADO P/ CT-e' && !ts.cte_moreno_at) ts.cte_moreno_at = agora;
                }

                v.timestamps_status = ts;
            }
            // ───────────────────────────────────────────────────────────────────────

            // Auto-extrair numero_coleta a partir das tags coletaRecife/coletaMoreno
            const primeiroTag = (tags) => {
                if (!tags || !tags.trim()) return '';
                return tags.split(',').map(t => t.trim()).filter(Boolean)[0] || '';
            };
            const tagRec = primeiroTag(v.coletaRecife);
            const tagMor = primeiroTag(v.coletaMoreno);
            if (tagRec && tagMor) {
                v.numero_coleta = `REC: ${tagRec} | MOR: ${tagMor}`;
            } else if (tagRec) {
                v.numero_coleta = tagRec;
            } else if (tagMor) {
                v.numero_coleta = tagMor;
            } else {
                v.numero_coleta = v.numero_coleta || '';
            }

            // Manter campo genérico 'coleta' sincronizado (sempre sobrescrever com valor atual)
            v.coleta = v.coletaRecife || v.coletaMoreno || v.coleta || '';

            // Se motorista mudou, zerar campos de risco para nova conferência
            const motoristaNovo = (v.motorista || '').trim();
            const motoristaAntigo = (veiculoAntigo?.motorista || '').trim();
            if (veiculoAntigo && motoristaNovo && motoristaAntigo && motoristaNovo !== motoristaAntigo) {
                v.chk_cnh = 0;
                v.chk_antt = 0;
                v.chk_tacografo = 0;
                v.chk_crlv = 0;
                v.numero_liberacao = '';
                v.situacao_cadastro = 'NÃO CONFERIDO';
                v.data_liberacao = null;
                v.seguradora_cad = '';
                v.origem_cad = '';
                v.destino_uf_cad = '';
                v.destino_cidade_cad = '';
            }

            // Se motorista está sendo atribuído agora e data_inicio_patio era null, setar
            let data_inicio_patio_novo = veiculoAntigo?.data_inicio_patio || null;
            if (motoristaNovo && motoristaNovo !== 'A DEFINIR' && !data_inicio_patio_novo) {
                // Buscar data_marcacao do motorista se disponível (herda Tempo de Espera)
                const telefone = (v.telefoneMotorista || '').replace(/\D/g, '');
                if (telefone) {
                    const marcPatio = await dbGet("SELECT data_marcacao FROM marcacoes_placas WHERE telefone = ? ORDER BY data_marcacao DESC LIMIT 1", [telefone]);
                    data_inicio_patio_novo = marcPatio?.data_marcacao || obterDataHoraBrasilia();
                } else {
                    const marcPatio = await dbGet("SELECT data_marcacao FROM marcacoes_placas WHERE LOWER(TRIM(nome_motorista)) = LOWER(TRIM(?)) ORDER BY data_marcacao DESC LIMIT 1", [motoristaNovo]);
                    data_inicio_patio_novo = marcPatio?.data_marcacao || obterDataHoraBrasilia();
                }
            }

            const query = `UPDATE veiculos SET
            placa=?, modelo=?, motorista=?, status_recife=?, status_moreno=?,
            doca_recife=?, doca_moreno=?, coleta=?, coletaRecife=?, coletaMoreno=?, numero_coleta=?,
            rota_recife=?, rota_moreno=?,
            operacao=?, inicio_rota=?, origem_criacao=?,
            data_prevista=?, tempos_recife=?, tempos_moreno=?, status_coleta=?,
            observacao=?, imagens=?, numero_cte=?, chave_cte=?,
            chk_cnh=?, chk_antt=?, chk_tacografo=?, chk_crlv=?,
            gerenciadora_risco=?, status_gerenciadora=?, numero_liberacao=?, situacao_cadastro=?,
            data_liberacao=?, timestamps_status=?,
            cte_antecipado_recife=?, cte_antecipado_moreno=?,
            data_carregado_recife=?, data_carregado_moreno=?,
            dados_json=?, data_inicio_patio=?
            WHERE id = ?`;

            const values = [
                v.placa, v.modelo, v.motorista, v.status_recife, v.status_moreno,
                v.doca_recife, v.doca_moreno, v.coleta || '', v.coletaRecife || '', v.coletaMoreno || '', v.numero_coleta || '',
                v.rotaRecife || '', v.rotaMoreno || '',
                v.operacao || '', v.inicio_rota || '', v.origem_criacao || '',
                v.data_prevista,
                JSON.stringify(v.tempos_recife || {}),
                JSON.stringify(v.tempos_moreno || {}),
                JSON.stringify(v.status_coleta || {}),
                v.observacao || '',
                v.imagens !== undefined ? JSON.stringify(v.imagens) : (veiculoAntigo?.imagens || '[]'),
                v.numero_cte || '',
                v.chave_cte || '',
                v.chk_cnh ? 1 : 0,
                v.chk_antt ? 1 : 0,
                v.chk_tacografo ? 1 : 0,
                v.chk_crlv ? 1 : 0,
                v.gerenciadora_risco || '',
                v.status_gerenciadora || '',
                v.numero_liberacao || '',
                v.situacao_cadastro || 'NÃO CONFERIDO',
                (() => {
                    if (veiculoAntigo && motoristaNovo && motoristaAntigo && motoristaNovo !== motoristaAntigo) return null;
                    const anterior = veiculoAntigo?.data_liberacao || null;
                    if (v.numero_liberacao && !anterior) return new Date().toISOString();
                    return v.data_liberacao || anterior;
                })(),
                JSON.stringify(v.timestamps_status || {}),
                v.cte_antecipado_recife || null,
                v.cte_antecipado_moreno || null,
                v.data_carregado_recife ?? veiculoAntigo?.data_carregado_recife ?? null,
                v.data_carregado_moreno ?? veiculoAntigo?.data_carregado_moreno ?? null,
                JSON.stringify((() => {
                    const merged = {
                        ...(() => { try { return JSON.parse(veiculoAntigo?.dados_json || '{}'); } catch { return {}; } })(),
                        ...v,
                        placa1Motorista: v.placa1Motorista,
                        placa2Motorista: v.placa2Motorista,
                        telefoneMotorista: v.telefoneMotorista,
                    };
                    delete merged.imagens;
                    delete merged.dados_json;
                    return merged;
                })()),
                data_inicio_patio_novo,
                req.params.id
            ];

            await dbRun(query, values);

            // ── Sync Provisionamento: placa no card → EM_OPERACAO + sync CONJUNTO completo ──
            try {
                const placaCavalo = (v.placa1Motorista || v.placa || '').trim().toUpperCase();
                const placaCarreta = (v.placa2Motorista || '').trim().toUpperCase();
                const placasCard = [placaCavalo, placaCarreta].filter(p => p && p !== '-');
                const dataCard = v.data_prevista || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });

                console.log(`🔄 [Sync Prov] Card #${req.params.id}: cavalo=${placaCavalo}, carreta=${placaCarreta} (placa1Motorista=${v.placa1Motorista}, placa=${v.placa})`);

                if (placasCard.length > 0) {
                    // Buscar o cavalo no provisionamento
                    const provCavalo = placaCavalo ? await dbGet(
                        `SELECT id, placa, carreta, tipo_veiculo FROM prov_veiculos WHERE ativo = 1 AND UPPER(placa) = $1`,
                        [placaCavalo]
                    ) : null;

                    if (provCavalo) {
                        // Sync EM_OPERACAO na programação
                        await dbRun(
                            `INSERT INTO prov_programacao (veiculo_id, data, status)
                             VALUES ($1, $2, 'EM_OPERACAO')
                             ON CONFLICT (veiculo_id, data) DO UPDATE
                             SET status = 'EM_OPERACAO'
                             WHERE prov_programacao.status NOT IN ('CARREGANDO', 'MANUTENCAO')`,
                            [provCavalo.id, dataCard]
                        );
                        io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id: provCavalo.id, data: dataCard, status: 'EM_OPERACAO' });

                        // Sync CONJUNTO completo: card operacional é prioritário
                        if (provCavalo.tipo_veiculo === 'CONJUNTO' && placaCavalo && placaCarreta) {
                            const carretaAntigaDoCavalo = (provCavalo.carreta || '').toUpperCase();

                            if (carretaAntigaDoCavalo !== placaCarreta) {
                                // 1) Encontrar o OUTRO cavalo que usava essa carreta (placaCarreta) e desatrelar
                                const outroCavaloComEssaCarreta = await dbGet(
                                    `SELECT id, placa, carreta FROM prov_veiculos WHERE ativo = 1 AND UPPER(carreta) = $1 AND id != $2`,
                                    [placaCarreta, provCavalo.id]
                                );
                                if (outroCavaloComEssaCarreta) {
                                    await dbRun(`UPDATE prov_veiculos SET carreta = NULL WHERE id = $1`, [outroCavaloComEssaCarreta.id]);
                                    console.log(`🔄 [Sync Prov] Desatrelou carreta ${placaCarreta} do cavalo ${outroCavaloComEssaCarreta.placa} (id ${outroCavaloComEssaCarreta.id})`);
                                    // Setar status DISPONIVEL para o cavalo órfão no dia atual
                                    await dbRun(
                                        `INSERT INTO prov_programacao (veiculo_id, data, status) VALUES ($1, $2, 'DISPONIVEL')
                                         ON CONFLICT (veiculo_id, data) DO UPDATE SET status = 'DISPONIVEL'
                                         WHERE prov_programacao.status NOT IN ('MANUTENCAO')`,
                                        [outroCavaloComEssaCarreta.id, dataCard]
                                    );
                                    io.emit('receber_atualizacao', { tipo: 'prov_veiculo_atualizado', veiculo_id: outroCavaloComEssaCarreta.id });
                                    io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id: outroCavaloComEssaCarreta.id, data: dataCard, status: 'DISPONIVEL' });
                                }

                                // 2) A carreta antiga do cavalo atual fica livre (como CARRETA avulsa no dashboard)
                                if (carretaAntigaDoCavalo) {
                                    // Verificar se a carreta antiga é um registro próprio em prov_veiculos (tipo CARRETA)
                                    const provCarretaAntiga = await dbGet(
                                        `SELECT id FROM prov_veiculos WHERE ativo = 1 AND UPPER(placa) = $1`,
                                        [carretaAntigaDoCavalo]
                                    );
                                    if (provCarretaAntiga) {
                                        await dbRun(
                                            `INSERT INTO prov_programacao (veiculo_id, data, status) VALUES ($1, $2, 'DISPONIVEL')
                                             ON CONFLICT (veiculo_id, data) DO UPDATE SET status = 'DISPONIVEL'
                                             WHERE prov_programacao.status NOT IN ('MANUTENCAO')`,
                                            [provCarretaAntiga.id, dataCard]
                                        );
                                        io.emit('receber_atualizacao', { tipo: 'prov_status_atualizado', veiculo_id: provCarretaAntiga.id, data: dataCard, status: 'DISPONIVEL' });
                                    }
                                    console.log(`🔄 [Sync Prov] Carreta antiga ${carretaAntigaDoCavalo} do cavalo ${placaCavalo} agora está livre`);
                                }

                                // 3) Atualizar o cavalo com a nova carreta
                                await dbRun(
                                    `UPDATE prov_veiculos SET carreta = $1 WHERE id = $2`,
                                    [placaCarreta, provCavalo.id]
                                );
                                console.log(`🔄 [Sync Prov] CONJUNTO #${provCavalo.id} (${provCavalo.placa}): carreta ${carretaAntigaDoCavalo || 'vazio'} → ${placaCarreta}`);
                                io.emit('receber_atualizacao', { tipo: 'prov_veiculo_atualizado', veiculo_id: provCavalo.id });
                            }
                        }
                    }
                }
            } catch (syncErr) {
                console.error('⚠️ [Sync Prov] Erro ao sincronizar provisionamento:', syncErr);
            }
            // ───────────────────────────────────────────────────────

            // ── Transição Em Espera ↔ Na Operação no Ger. Risco ──
            if (veiculoAntigo && veiculoAntigo.motorista !== v.motorista) {
                if (v.motorista && v.motorista.trim()) {
                    await dbRun(
                        `UPDATE marcacoes_placas SET status_operacional = 'EM OPERACAO'
                         WHERE LOWER(TRIM(nome_motorista)) = LOWER(TRIM(?))
                           AND (status_operacional IS NULL OR status_operacional = 'DISPONIVEL')`,
                        [v.motorista]
                    );
                }
                if (veiculoAntigo.motorista && veiculoAntigo.motorista.trim()) {
                    await dbRun(
                        `UPDATE marcacoes_placas SET status_operacional = 'DISPONIVEL'
                         WHERE LOWER(TRIM(nome_motorista)) = LOWER(TRIM(?))
                           AND status_operacional = 'EM OPERACAO'`,
                        [veiculoAntigo.motorista]
                    );
                }
            }
            // ─────────────────────────────────────────────────────

            // ── Salvar histórico de liberação quando status muda para LIBERADO P/ CT-e ──
            if (veiculoAntigo) {
                const mudouCteRecife = v.status_recife === 'LIBERADO P/ CT-e' && veiculoAntigo.status_recife !== 'LIBERADO P/ CT-e';
                const mudouCteMoreno = v.status_moreno === 'LIBERADO P/ CT-e' && veiculoAntigo.status_moreno !== 'LIBERADO P/ CT-e';
                if (mudouCteRecife || mudouCteMoreno) {
                    try {
                        const motoristaNome = (v.motorista || '').trim().toUpperCase();
                        const primeiraLetra = motoristaNome[0] || '#';
                        const numColeta = v.coletaRecife || v.coletaMoreno || v.coleta || '';

                        // Buscar dados de origem/destino do cadastro do motorista
                        let origem = '', destino_uf = '', destino_cidade = '';
                        if (v.motorista) {
                            const cadMotorista = await dbGet(
                                `SELECT origem_cad, destino_uf_cad, destino_cidade_cad FROM marcacoes_placas WHERE nome_motorista = ? ORDER BY data_marcacao DESC LIMIT 1`,
                                [v.motorista]
                            );
                            if (cadMotorista) {
                                origem = cadMotorista.origem_cad || '';
                                destino_uf = cadMotorista.destino_uf_cad || '';
                                destino_cidade = cadMotorista.destino_cidade_cad || '';
                            }
                        }

                        const numLiberacao = v.numero_liberacao || veiculoAntigo.numero_liberacao || '';
                        const placa = v.placa || veiculoAntigo.placa || '';

                        await dbRun(
                            `INSERT INTO historico_liberacoes (primeira_letra, motorista_nome, num_coleta, num_liberacao, datetime_cte, origem, destino_uf, destino_cidade, placa, operacao, veiculo_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [primeiraLetra, motoristaNome, numColeta, numLiberacao, new Date().toISOString(), origem, destino_uf, destino_cidade, placa, v.operacao || '', req.params.id]
                        );
                    } catch (errHist) {
                        console.error('⚠️ Erro ao salvar histórico de liberação:', errHist);
                    }
                }
            }
            // ───────────────────────────────────────────────────────────────────────

            // Registrar logs de alterações
            if (veiculoAntigo) {
                const mudancas = [];

                // Verificar mudanças de status (mais importante)
                if (veiculoAntigo.status_recife !== v.status_recife) {
                    mudancas.push(`Status RECIFE: ${veiculoAntigo.status_recife} → ${v.status_recife}`);

                    // Se mudou para "LIBERADO P/ CT-e", marcar como fluxo CT-e
                    const ehFluxoCte = v.status_recife === 'LIBERADO P/ CT-e';
                    await registrarLog(
                        ehFluxoCte ? 'FLUXO_CTE' : 'MUDANÇA DE STATUS',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        veiculoAntigo.status_recife,
                        v.status_recife,
                        `[RECIFE] ${veiculoAntigo.status_recife} → ${v.status_recife} | Placa: ${v.placa}${ehFluxoCte ? ' | Card aguardando emissão de CT-e' : ''}`
                    );
                }
                if (veiculoAntigo.status_moreno !== v.status_moreno) {
                    mudancas.push(`Status MORENO: ${veiculoAntigo.status_moreno} → ${v.status_moreno}`);

                    // Se mudou para "LIBERADO P/ CT-e", marcar como fluxo CT-e
                    const ehFluxoCte = v.status_moreno === 'LIBERADO P/ CT-e';
                    await registrarLog(
                        ehFluxoCte ? 'FLUXO_CTE' : 'MUDANÇA DE STATUS',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        veiculoAntigo.status_moreno,
                        v.status_moreno,
                        `[MORENO] ${veiculoAntigo.status_moreno} → ${v.status_moreno} | Placa: ${v.placa}${ehFluxoCte ? ' | Card aguardando emissão de CT-e' : ''}`
                    );
                }

                // Verificar mudanças em campos importantes
                if (veiculoAntigo.motorista !== v.motorista) {
                    mudancas.push(`Motorista: ${veiculoAntigo.motorista || 'N/A'} → ${v.motorista || 'N/A'}`);
                }
                if (veiculoAntigo.doca_recife !== v.doca_recife) {
                    mudancas.push(`Doca RECIFE: ${veiculoAntigo.doca_recife} → ${v.doca_recife}`);
                }
                if (veiculoAntigo.doca_moreno !== v.doca_moreno) {
                    mudancas.push(`Doca MORENO: ${veiculoAntigo.doca_moreno} → ${v.doca_moreno}`);
                }
                if (veiculoAntigo.numero_coleta !== (v.numero_coleta || '')) {
                    mudancas.push(`Nº Coleta: ${veiculoAntigo.numero_coleta || 'N/A'} → ${v.numero_coleta || 'N/A'}`);
                }
                if (veiculoAntigo.data_prevista !== v.data_prevista) {
                    mudancas.push(`Data Prevista: ${veiculoAntigo.data_prevista} → ${v.data_prevista}`);
                }
                if (veiculoAntigo.operacao !== v.operacao) {
                    mudancas.push(`Operação: ${veiculoAntigo.operacao || 'N/A'} → ${v.operacao || 'N/A'}`);
                }

                // Verificar campos de dados_json extraídos
                const dadosAntigosJson = veiculoAntigo.dados_json ? JSON.parse(veiculoAntigo.dados_json) : {};
                if (dadosAntigosJson.placa1Motorista !== v.placa1Motorista) {
                    mudancas.push(`Placa 1: ${dadosAntigosJson.placa1Motorista || 'N/A'} → ${v.placa1Motorista || 'N/A'}`);
                }
                if (dadosAntigosJson.placa2Motorista !== v.placa2Motorista) {
                    mudancas.push(`Placa 2: ${dadosAntigosJson.placa2Motorista || 'N/A'} → ${v.placa2Motorista || 'N/A'}`);
                }
                if (dadosAntigosJson.telefoneMotorista !== v.telefoneMotorista) {
                    mudancas.push(`Telefone: ${dadosAntigosJson.telefoneMotorista || 'N/A'} → ${v.telefoneMotorista || 'N/A'}`);
                }

                // Verificar mudanças nos dados fiscais de CT-e
                if (veiculoAntigo.numero_cte !== (v.numero_cte || '')) {
                    const antigoNum = veiculoAntigo.numero_cte || '';
                    const novoNum = v.numero_cte || '';
                    if (!antigoNum && novoNum) {
                        // Inserção de número CT-e
                        await registrarLog(
                            'DADOS_FISCAIS_CTE',
                            req.user.nome,
                            req.params.id,
                            'veiculo',
                            null,
                            novoNum,
                            `CT-e Nº ${novoNum} vinculado ao Card | Placa: ${v.placa}`
                        );
                        mudancas.push(`CT-e Nº ${novoNum} vinculado`);
                    } else if (antigoNum !== novoNum) {
                        // Alteração de número CT-e
                        await registrarLog(
                            'DADOS_FISCAIS_CTE',
                            req.user.nome,
                            req.params.id,
                            'veiculo',
                            antigoNum,
                            novoNum,
                            `CT-e alterado: ${antigoNum} → ${novoNum} | Placa: ${v.placa}`
                        );
                        mudancas.push(`CT-e: ${antigoNum} → ${novoNum}`);
                    }
                }

                if (veiculoAntigo.chave_cte !== (v.chave_cte || '')) {
                    const antigaChave = veiculoAntigo.chave_cte || '';
                    const novaChave = v.chave_cte || '';
                    if (!antigaChave && novaChave) {
                        // Inserção de chave de acesso
                        await registrarLog(
                            'DADOS_FISCAIS_CTE',
                            req.user.nome,
                            req.params.id,
                            'veiculo',
                            null,
                            novaChave,
                            `Chave de Acesso vinculada ao Card | Placa: ${v.placa} | Chave: ${novaChave.substring(0, 15)}...`
                        );
                        mudancas.push(`Chave de Acesso vinculada`);
                    } else if (antigaChave !== novaChave) {
                        // Alteração de chave
                        mudancas.push(`Chave CT-e alterada`);
                    }
                }

                // Registrar edição geral para mudanças que não sejam exclusivamente de status
                const mudancasNaoStatus = mudancas.filter(m => !m.includes('Status'));
                if (mudancasNaoStatus.length > 0) {
                    await registrarLog(
                        'EDIÇÃO',
                        req.user.nome,
                        req.params.id,
                        'veiculo',
                        JSON.stringify(veiculoAntigo),
                        JSON.stringify(v),
                        mudancasNaoStatus.join(' | ')
                    );
                }
            }

            // Ler dados atualizados do banco (fonte de verdade) para emitir via socket
            const atualizado = await dbGet(`
                SELECT v.*,
                       (SELECT m.telefone FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as telefone_bd,
                       (SELECT m.is_frota FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as is_frota_bd
                FROM veiculos v WHERE v.id = ?
            `, [req.params.id]);
            if (atualizado) {
                const dj = (() => { try { return JSON.parse(atualizado.dados_json || '{}'); } catch { return {}; } })();
                const veiculoSocket = {
                    ...atualizado,
                    rotaRecife: atualizado.rota_recife,
                    rotaMoreno: atualizado.rota_moreno,
                    coletaRecife: atualizado.coletarecife || '',
                    coletaMoreno: atualizado.coletamoreno || '',
                    tempos_recife: (() => { try { return JSON.parse(atualizado.tempos_recife || '{}'); } catch { return {}; } })(),
                    tempos_moreno: (() => { try { return JSON.parse(atualizado.tempos_moreno || '{}'); } catch { return {}; } })(),
                    status_coleta: (() => { try { return JSON.parse(atualizado.status_coleta || '{}'); } catch { return {}; } })(),
                    imagens: (() => { try { return JSON.parse(atualizado.imagens || '[]'); } catch { return []; } })(),
                    timestamps_status: (() => { try { return JSON.parse(atualizado.timestamps_status || '{}'); } catch { return {}; } })(),
                    observacao: atualizado.observacao || '',
                    numero_coleta: atualizado.numero_coleta || '',
                    numero_cte: atualizado.numero_cte || '',
                    chave_cte: atualizado.chave_cte || '',
                    situacao_cadastro: atualizado.situacao_cadastro || 'NÃO CONFERIDO',
                    numero_liberacao: atualizado.numero_liberacao || '',
                    data_liberacao: atualizado.data_liberacao || null,
                    chk_cnh: atualizado.chk_cnh ? 1 : 0,
                    chk_antt: atualizado.chk_antt ? 1 : 0,
                    chk_tacografo: atualizado.chk_tacografo ? 1 : 0,
                    chk_crlv: atualizado.chk_crlv ? 1 : 0,
                    tipoVeiculo: dj.tipoVeiculo || '',
                    placa1Motorista: dj.placa1Motorista || '',
                    placa2Motorista: dj.placa2Motorista || '',
                    telefoneMotorista: dj.telefoneMotorista || atualizado.telefone_bd || '',
                    telefone: atualizado.telefone_bd || dj.telefoneMotorista || '',
                    isFrotaMotorista: dj.isFrotaMotorista || atualizado.is_frota_bd === 1 || false,
                };
                io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(req.params.id), ...veiculoSocket });
            } else {
                io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(req.params.id), ...v });
            }

            // ── Notificar conferente quando veículo chega em "LIBERADO P/ DOCA" ──
            if (veiculoAntigo) {
                const mudouParaDocaRecife = v.status_recife === 'LIBERADO P/ DOCA' && veiculoAntigo.status_recife !== 'LIBERADO P/ DOCA';
                const mudouParaDocaMoreno = v.status_moreno === 'LIBERADO P/ DOCA' && veiculoAntigo.status_moreno !== 'LIBERADO P/ DOCA';
                if (mudouParaDocaRecife || mudouParaDocaMoreno) {
                    io.emit('conferente_novo_veiculo', {
                        veiculoId: Number(req.params.id),
                        motorista: v.motorista || veiculoAntigo.motorista || 'A DEFINIR',
                        placa: v.placa || veiculoAntigo.placa || '',
                        doca: mudouParaDocaRecife ? v.doca_recife : v.doca_moreno,
                        coleta: mudouParaDocaRecife ? v.coletaRecife : v.coletaMoreno,
                        cidade: mudouParaDocaRecife ? 'Recife' : 'Moreno'
                    });
                }
            }

            res.json({ success: true });
        } catch (e) { console.error('Erro PUT /veiculos/:id', e); res.status(500).json({ success: false }); }
    });
    // Reprogramação explícita — atualiza data_prevista e flag foi_reprogramado
    // foi_reprogramado=1: avançou/mudou; foi_reprogramado=0: voltou para hoje
    router.put('/veiculos/:id/reprogramar', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
        try {
            const { nova_data, foi_reprogramado = 1 } = req.body;
            if (!nova_data) return res.status(400).json({ success: false, message: 'nova_data obrigatória.' });
            await dbRun(
                `UPDATE veiculos SET data_prevista = $1, foi_reprogramado = $2 WHERE id = $3`,
                [nova_data, foi_reprogramado ? 1 : 0, req.params.id]
            );
            io.emit('update');
            res.json({ success: true });
        } catch (e) { console.error('Erro PUT /veiculos/:id/reprogramar', e); res.status(500).json({ success: false }); }
    });

    router.delete('/veiculos/:id', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado']), async (req, res) => {
        try {
            console.log(`🗑️ [DELETE] Tentando excluir veículo ID: ${req.params.id}`);

            // Buscar dados do veículo antes de excluir para auditoria
            const veiculoExcluido = await dbGet("SELECT * FROM veiculos WHERE id = ?", [req.params.id]);

            if (!veiculoExcluido) {
                console.log(`⚠️ Veículo ID ${req.params.id} não encontrado no banco`);
                return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
            }

            let identificador = 'Desconhecida';
            try {
                const dados = JSON.parse(veiculoExcluido.dados_json || '{}');
                identificador = dados.placa1Motorista || dados.placa || veiculoExcluido.motorista || 'Sem Placa';
            } catch (e) { }

            console.log(`✅ Veículo encontrado: Placa ${identificador}`);

            // Deletar dados associados em cascata
            await dbRun("DELETE FROM checklists_carreta WHERE veiculo_id = ?", [req.params.id]);
            await dbRun("DELETE FROM operacao_ocorrencias WHERE veiculo_id = ?", [req.params.id]);

            // Deletar do banco
            await dbRun("DELETE FROM veiculos WHERE id = ?", [req.params.id]);
            console.log(`✅ Veículo deletado do banco`);

            // Registrar log de exclusão
            console.log(`📝 Registrando log de exclusão - Usuário: ${req.user.nome}`);
            await registrarLog(
                'EXCLUSÃO',
                req.user.nome,
                req.params.id,
                'veiculo',
                JSON.stringify(veiculoExcluido),
                null,
                `Placa: ${veiculoExcluido.placa} | Coleta: ${veiculoExcluido.coleta || veiculoExcluido.coletaRecife || veiculoExcluido.coletaMoreno || 'N/A'} | Operação: ${veiculoExcluido.operacao}`
            );
            console.log(`✅ Log de exclusão registrado com sucesso`);

            io.emit('receber_atualizacao', { tipo: 'remove_veiculo', id: Number(req.params.id) });
            res.json({ success: true });
        } catch (e) {
            console.error(`❌ Erro ao deletar veículo:`, e);
            res.status(500).json({ success: false, message: 'Erro interno ao excluir veículo.' });
        }
    });

    // ── DELETE Motorista do Card (mantém o card, libera motorista) ──
    router.delete('/veiculos/:id/motorista', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
        try {
            const veiculo = await dbGet("SELECT * FROM veiculos WHERE id = ?", [req.params.id]);
            if (!veiculo) return res.status(404).json({ success: false, message: 'Veículo não encontrado' });

            const motoristaAnterior = veiculo.motorista;

            // Limpar motorista e campos derivados no card
            let dados = {};
            try { dados = JSON.parse(veiculo.dados_json || '{}'); } catch { }
            dados.motorista = '';
            dados.telefoneMotorista = '';
            dados.placa1Motorista = '';
            dados.placa2Motorista = '';
            dados.isFrotaMotorista = false;
            dados.disponibilidadeMotorista = '';
            dados.origemMotorista = '';
            dados.destinoMotorista = '';
            // Limpar checagem de documentos e liberação do antigo motorista
            dados.chk_cnh = false;
            dados.chk_antt = false;
            dados.chk_tacografo = false;
            dados.chk_crlv = false;
            dados.situacao_cadastro = 'NÃO CONFERIDO';
            dados.numero_liberacao = '';
            dados.gerenciadora_risco = '';
            dados.data_liberacao = '';

            await dbRun(
                `UPDATE veiculos
                 SET motorista = '', placa = '', dados_json = $1,
                     chk_cnh = 0, chk_antt = 0, chk_tacografo = 0, chk_crlv = 0,
                     situacao_cadastro = 'NÃO CONFERIDO',
                     numero_liberacao = NULL, gerenciadora_risco = NULL,
                     data_liberacao = NULL, timestamps_status = '{}',
                     data_inicio_patio = NULL
                 WHERE id = $2`,
                [JSON.stringify(dados), req.params.id]
            );

            // Restaurar motorista na fila (status_operacional → DISPONIVEL)
            if (motoristaAnterior && motoristaAnterior.trim()) {
                await dbRun(
                    `UPDATE marcacoes_placas SET status_operacional = 'DISPONIVEL'
                     WHERE LOWER(TRIM(nome_motorista)) = LOWER(TRIM($1))
                       AND status_operacional = 'EM OPERACAO'`,
                    [motoristaAnterior]
                );
            }

            io.emit('receber_atualizacao', { tipo: 'refresh_geral' });
            io.emit('marcacao_atualizada');
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao remover motorista do card:', e);
            res.status(500).json({ success: false, message: 'Erro ao remover motorista.' });
        }
    });

    // ── GET Ocorrências da Operação ──────────────────

    // ── POST Pausar Veículo ───────────────────────────
    router.post('/api/veiculos/:id/pausar', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Conferente']), async (req, res) => {
        try {
            const { motivo, unidade, fonte } = req.body;
            // fonte: 'operacao' (pausa em lote pelo header) | 'conferente' (pausa individual)
            const fonteNorm = fonte === 'conferente' ? 'conferente' : 'operacao';
            const veiculo_id = req.params.id;

            const veiculo = await dbGet('SELECT pausas_status FROM veiculos WHERE id = ?', [veiculo_id]);
            if (!veiculo) return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });

            const pausas = JSON.parse(veiculo.pausas_status || '[]');

            // Verificar se já existe pausa ativa para esta unidade + fonte
            const pausaAtiva = pausas.find(p => p.unidade === unidade && p.fonte === fonteNorm && p.fim === null);
            if (pausaAtiva) return res.status(400).json({ success: false, message: 'Já existe uma pausa ativa.' });

            pausas.push({ inicio: new Date().toISOString(), fim: null, motivo: motivo || '', unidade, fonte: fonteNorm });
            await dbRun('UPDATE veiculos SET pausas_status = ? WHERE id = ?', [JSON.stringify(pausas), veiculo_id]);

            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(veiculo_id) });
            console.log(`⏸ [Pausa] Veículo #${veiculo_id} pausado por ${req.user?.nome || 'desconhecido'} | Fonte: ${fonteNorm} | Motivo: "${motivo}"`);
            await registrarLog('PAUSA_INICIADA', req.user?.nome || 'desconhecido', veiculo_id, 'veiculo', null, null, motivo);

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao pausar veículo:', e);
            res.status(500).json({ success: false, message: 'Erro ao pausar.' });
        }
    });

    // ── POST Retomar Veículo ──────────────────────────
    router.post('/api/veiculos/:id/retomar', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Conferente']), async (req, res) => {
        try {
            const { unidade, fonte } = req.body;
            // fonte: 'operacao' | 'conferente' — retoma somente pausas da própria fonte
            const fonteNorm = fonte === 'conferente' ? 'conferente' : 'operacao';
            const veiculo_id = req.params.id;

            const veiculo = await dbGet('SELECT pausas_status FROM veiculos WHERE id = ?', [veiculo_id]);
            if (!veiculo) return res.status(404).json({ success: false, message: 'Veículo não encontrado.' });

            const pausas = JSON.parse(veiculo.pausas_status || '[]');

            // Retoma somente a pausa da mesma unidade + fonte
            const idx = pausas.findIndex(p => p.unidade === unidade && p.fonte === fonteNorm && p.fim === null);
            if (idx === -1) return res.status(400).json({ success: false, message: 'Nenhuma pausa ativa.' });

            pausas[idx].fim = new Date().toISOString();
            await dbRun('UPDATE veiculos SET pausas_status = ? WHERE id = ?', [JSON.stringify(pausas), veiculo_id]);

            io.emit('receber_atualizacao', { tipo: 'atualiza_veiculo', id: Number(veiculo_id) });
            console.log(`▶ [Retomada] Veículo #${veiculo_id} retomado por ${req.user?.nome || 'desconhecido'} | Fonte: ${fonteNorm}`);
            await registrarLog('PAUSA_FINALIZADA', req.user?.nome || 'desconhecido', veiculo_id, 'veiculo', null, null, null);

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao retomar veículo:', e);
            res.status(500).json({ success: false, message: 'Erro ao retomar.' });
        }
    });

    // ── GET Relatório por período (dados próprios, não depende de memória do App) ──
    router.get('/api/relatorio/veiculos', authMiddleware, async (req, res) => {
        try {
            const { de, ate } = req.query;
            if (!de || !ate) return res.status(400).json({ success: false, message: 'Parâmetros de e ate obrigatórios.' });

            const rows = await dbAll(`
                SELECT v.*,
                    (SELECT m.is_frota FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as is_frota_bd
                FROM veiculos v
                WHERE v.data_prevista >= ? AND v.data_prevista <= ?
                ORDER BY v.data_prevista ASC, v.id ASC
            `, [de, ate]);

            const veiculos = rows.map(row => {
                let dados_json = {};
                try { dados_json = JSON.parse(row.dados_json || '{}'); } catch {}
                return {
                    ...row,
                    rotaRecife: row.rota_recife || '',
                    rotaMoreno: row.rota_moreno || '',
                    coletaRecife: row.coletarecife || row.coletaRecife || '',
                    coletaMoreno: row.coletamoreno || row.coletaMoreno || '',
                    tempos_recife: (() => { try { return JSON.parse(row.tempos_recife || '{}'); } catch { return {}; } })(),
                    tempos_moreno: (() => { try { return JSON.parse(row.tempos_moreno || '{}'); } catch { return {}; } })(),
                    timestamps_status: (() => { try { return JSON.parse(row.timestamps_status || '{}'); } catch { return {}; } })(),
                    pausas_status: row.pausas_status || '[]',
                    tipoVeiculo: dados_json.tipoVeiculo || '',
                    isFrotaMotorista: dados_json.isFrotaMotorista || row.is_frota_bd === 1 || false,
                };
            });

            res.json({ success: true, veiculos });
        } catch (e) {
            console.error('Erro ao buscar dados do relatório:', e);
            res.status(500).json({ success: false, message: 'Erro interno.' });
        }
    });

    // ── Finalizar Operação (manual) ────────────────────────────────────────
    // Avança data_prevista para o próximo dia útil nos cards com status AGUARDANDO até EM CARREGAMENTO
    router.post('/veiculos/finalizar-operacao', authMiddleware, authorize(['Coordenador', 'Planejamento', 'Conhecimento']), async (req, res) => {
        try {
            const { unidade, confirmarMisto } = req.body; // 'Recife' ou 'Moreno'
            if (!unidade || !['Recife', 'Moreno'].includes(unidade)) {
                return res.status(400).json({ success: false, message: 'Unidade inválida.' });
            }

            // Calcular hoje e próximo dia útil (pula domingo)
            const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
            const prox = new Date(agora);
            prox.setDate(prox.getDate() + 1);
            if (prox.getDay() === 0) prox.setDate(prox.getDate() + 1); // domingo → segunda
            const amanhaStr = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}-${String(prox.getDate()).padStart(2, '0')}`;

            const campoStatus = unidade === 'Recife' ? 'status_recife' : 'status_moreno';
            const campoCarregado = unidade === 'Recife' ? 'data_carregado_recife' : 'data_carregado_moreno';
            const statusParaAvancar = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO'];

            // Se não confirmou mistos, verificar conflitos antes de avançar
            if (!confirmarMisto) {
                const campoStatusOutro = unidade === 'Recife' ? 'status_moreno' : 'status_recife';
                const statusNaoFinalizados = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO'];

                const conflitosQuery = `
                    SELECT COUNT(*) as total,
                           STRING_AGG(COALESCE(operacao, 'Sem operação'), ', ') as operacoes
                    FROM veiculos
                    WHERE ${campoStatus} IN (${statusParaAvancar.map(() => '?').join(',')})
                      AND data_prevista = ?
                      AND ${campoStatusOutro} IN (${statusNaoFinalizados.map(() => '?').join(',')})
                `;
                const conflitosResult = await dbGet(conflitosQuery, [
                    ...statusParaAvancar,
                    hojeStr,
                    ...statusNaoFinalizados
                ]);

                if (conflitosResult && parseInt(conflitosResult.total) > 0) {
                    return res.json({
                        success: true,
                        requerConfirmacao: true,
                        conflitos: parseInt(conflitosResult.total),
                        detalhes: conflitosResult.operacoes ? conflitosResult.operacoes.split(', ') : []
                    });
                }
            }

            // Avança apenas veículos do dia de hoje (não toca dias anteriores)
            // Seta foi_reprogramado=1 pois estão sendo avançados para o próximo dia
            const query = `
                UPDATE veiculos
                SET data_prevista = ?, foi_reprogramado = 1
                WHERE ${campoStatus} IN (${statusParaAvancar.map(() => '?').join(',')})
                  AND data_prevista = ?
                  AND ${campoCarregado} IS NULL
            `;
            const resultado = await dbRun(query, [amanhaStr, ...statusParaAvancar, hojeStr]);

            // Avançar CT-es "Aguardando Emissão" associados — somente os de hoje e da mesma unidade
            const hojeFormatado = new Date(hojeStr + 'T12:00:00').toLocaleDateString('pt-BR'); // DD/MM/YYYY
            const ctesAguardando = await dbAll(
                "SELECT id, dados_json FROM ctes_ativos WHERE status = 'Aguardando Emissão' AND origem = $1",
                [unidade]
            );
            let ctesAtualizados = 0;
            for (const cte of ctesAguardando) {
                try {
                    const dados = JSON.parse(cte.dados_json);
                    // Só avança se data_entrada_cte for hoje
                    if (dados.data_entrada_cte !== hojeFormatado) continue;
                    dados.data_entrada_cte = new Date(amanhaStr + 'T12:00:00').toLocaleDateString('pt-BR');
                    await dbRun("UPDATE ctes_ativos SET dados_json = $1 WHERE id = $2", [JSON.stringify(dados), cte.id]);
                    ctesAtualizados++;
                } catch (_) {}
            }

            console.log(`[FINALIZAR] ${unidade}: ${resultado.changes} veículos → ${amanhaStr} | CT-es avançados: ${ctesAtualizados} | por ${req.user.nome}`);
            io.emit('receber_atualizacao', { tipo: 'refresh_geral' });

            res.json({
                success: true,
                message: `${resultado.changes} veículo(s) avançado(s) para ${amanhaStr.split('-').reverse().join('/')}`,
                veiculosAvancados: resultado.changes,
                ctesAvancados: ctesAtualizados
            });
        } catch (e) {
            console.error('Erro ao finalizar operação:', e);
            res.status(500).json({ success: false, message: 'Erro ao finalizar operação.' });
        }
    });

    return router;
};
