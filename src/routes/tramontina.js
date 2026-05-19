const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { calcularDiasUteis, classificarLeadTime, regiaoDeUF } = require('../utils/tramontinaLeadTime');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { ROLES } = require('../../middleware/roles');

const CARGOS_EDITAR = ['Coordenador', 'Planejamento', 'Desenvolvedor'];
// PlanejamentoDelta (2026-05-19): cargos que podem editar o operacional (rota/datas/motorista)
const CARGOS_EDITAR_OPERACIONAL = ['Coordenador', 'Planejamento', 'Desenvolvedor', 'Pos Embarque'];
// PlanejamentoDelta: cargos que podem editar campos financeiros (valor_carga/valor_frete/status_financeiro)
const CARGOS_EDITAR_FINANCEIRO = ['Coordenador', 'Planejamento', 'Pos Embarque', 'Desenvolvedor'];
const ABAS_VALIDAS = ['DELTA-PORCELANA', 'ELETRIK'];
const STATUS_FINANCEIRO_VALIDOS = ['CONCLUIDO', 'EM_ROTA_DE_ENTREGA', 'PENDENTE'];

// CARGOS_ADMIN já passam (definido em authorize); aqui são apenas os extras.
function temPermissaoFinanceiro(req) {
    const CARGOS_ADMIN = ['Coordenador', 'Direção', 'Adm Frota', 'Desenvolvedor'];
    const cargo = req.user?.cargo;
    return CARGOS_ADMIN.includes(cargo) || CARGOS_EDITAR_FINANCEIRO.includes(cargo);
}

module.exports = function createTramontinaRouter(io) {
    const router = express.Router();

    // Helper: recalcula dias úteis e lead status de uma entrega
    async function recalcularEntrega(entrega, rota) {
        const lead = await dbGet(
            `SELECT dias_uteis_padrao FROM tramontina_lead_padrao_uf WHERE uf_origem = ? AND uf_destino = ?`,
            ['PE', String(entrega.uf || '').toUpperCase()]
        );
        const padrao = lead?.dias_uteis_padrao ?? null;
        const dias = (rota?.data_embarque && entrega.data_entrega_cliente)
            ? calcularDiasUteis(rota.data_embarque, entrega.data_entrega_cliente)
            : null;
        const status = classificarLeadTime(dias, padrao);
        return { dias_uteis: dias, lead_status: status };
    }

    // ── GET Listar rotas + entregas do mês ──────────────────────────
    router.get('/api/tramontina/rotas', authMiddleware, asyncHandler(async (req, res) => {
            const mes = req.query.mes;
            if (!mes) return res.status(400).json({ success: false, message: 'Parâmetro mes obrigatório (formato YYYY-MM).' });
            const aba = (req.query.aba || 'DELTA-PORCELANA').toUpperCase();
            if (!ABAS_VALIDAS.includes(aba)) {
                return res.status(400).json({ success: false, message: 'Parâmetro aba inválido (use DELTA-PORCELANA ou ELETRIK).' });
            }
            const rotas = await dbAll(
                `SELECT * FROM tramontina_rotas WHERE mes_referencia = ? AND aba_origem = ? ORDER BY numero_rota ASC, id ASC`,
                [mes, aba]
            );
            if (!rotas.length) return res.json({ success: true, rotas: [] });
            const ids = rotas.map(r => r.id);
            const placeholders = ids.map(() => '?').join(',');
            const entregas = await dbAll(
                `SELECT * FROM tramontina_rota_entregas WHERE rota_id IN (${placeholders}) ORDER BY id ASC`,
                ids
            );
            const porRota = {};
            for (const e of entregas) {
                if (!porRota[e.rota_id]) porRota[e.rota_id] = [];
                porRota[e.rota_id].push(e);
            }
            res.json({ success: true, rotas: rotas.map(r => ({ ...r, entregas: porRota[r.id] || [] })) });
        }));

    // ── KPIs do mês ──────────────────────────
    router.get('/api/tramontina/kpis', authMiddleware, asyncHandler(async (req, res) => {
            const mes = req.query.mes;
            if (!mes) return res.status(400).json({ success: false, message: 'Parâmetro mes obrigatório.' });
            const aba = (req.query.aba || 'DELTA-PORCELANA').toUpperCase();
            if (!ABAS_VALIDAS.includes(aba)) {
                return res.status(400).json({ success: false, message: 'Parâmetro aba inválido.' });
            }
            const rotas = await dbAll(`SELECT * FROM tramontina_rotas WHERE mes_referencia = ? AND aba_origem = ?`, [mes, aba]);
            const total = rotas.length;
            const programadas = rotas.filter(r => r.status_embarque === 'PROGRAMADA').length;
            const embarcadas = rotas.filter(r => r.status_embarque === 'EMBARCADA').length;
            const pendentes = rotas.filter(r => r.status_embarque === 'PENDENTE').length;
            const entregas = await dbAll(
                `SELECT e.* FROM tramontina_rota_entregas e
                 INNER JOIN tramontina_rotas r ON r.id = e.rota_id
                 WHERE r.mes_referencia = ? AND r.aba_origem = ?`,
                [mes, aba]
            );
            const totalEnt = entregas.length;
            const cnt = { ANTECIPADO: 0, DENTRO: 0, FORA: 0, AGUARDANDO: 0 };
            const porRegiao = { N: 0, NE: 0, CO: 0, SE: 0, S: 0 };
            for (const e of entregas) {
                if (cnt[e.lead_status] !== undefined) cnt[e.lead_status]++;
                else cnt.AGUARDANDO++;
                if (porRegiao[e.regiao] !== undefined) porRegiao[e.regiao]++;
            }
            const pct = (n) => totalEnt > 0 ? Math.round((n / totalEnt) * 1000) / 10 : 0;

            // PlanejamentoDelta (2026-05-19): KPIs financeiros só pra ELETRIK
            let financeiro = null;
            if (aba === 'ELETRIK') {
                const fin = await dbGet(`
                    SELECT
                        COALESCE(SUM(valor_carga), 0) AS total_mercadoria,
                        COALESCE(SUM(valor_frete), 0) AS total_frete,
                        COALESCE(AVG(representatividade_pct) FILTER (WHERE representatividade_pct IS NOT NULL), 0) AS repres_media
                    FROM tramontina_rotas
                    WHERE mes_referencia = ? AND aba_origem = 'ELETRIK'
                `, [mes]);
                financeiro = {
                    total_mercadoria: parseFloat(fin?.total_mercadoria) || 0,
                    total_frete: parseFloat(fin?.total_frete) || 0,
                    repres_media: parseFloat(fin?.repres_media) || 0,
                };
            }

            res.json({
                success: true,
                kpis: {
                    rotas: { total, programadas, embarcadas, pendentes },
                    leadTime: {
                        antecipado: cnt.ANTECIPADO, dentro: cnt.DENTRO, fora: cnt.FORA, aguardando: cnt.AGUARDANDO,
                        pctAntecipado: pct(cnt.ANTECIPADO), pctDentro: pct(cnt.DENTRO), pctFora: pct(cnt.FORA), pctAguardando: pct(cnt.AGUARDANDO),
                    },
                    regioes: porRegiao,
                    totalEntregas: totalEnt,
                    financeiro,
                }
            });
        }));

    // ── POST Criar rota ──────────────────────────
    router.post('/api/tramontina/rotas', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const dados = req.body || {};
            const mes = dados.mes_referencia;
            if (!mes) return res.status(400).json({ success: false, message: 'mes_referencia obrigatório.' });

            // PlanejamentoDelta (2026-05-19): validar aba_origem
            const aba = (dados.aba_origem || 'DELTA-PORCELANA').toUpperCase();
            if (!ABAS_VALIDAS.includes(aba)) {
                return res.status(400).json({ success: false, message: 'aba_origem inválida (use DELTA-PORCELANA ou ELETRIK).' });
            }

            // PlanejamentoDelta: validar campos financeiros (permissão + valores)
            const tinhaFinanceiro = (
                dados.status_financeiro !== undefined ||
                dados.valor_carga !== undefined ||
                dados.valor_frete !== undefined
            );
            if (tinhaFinanceiro && !temPermissaoFinanceiro(req)) {
                return res.status(403).json({ success: false, message: 'Sem permissão para editar campos financeiros.' });
            }
            if (dados.status_financeiro !== undefined && dados.status_financeiro !== null
                && !STATUS_FINANCEIRO_VALIDOS.includes(dados.status_financeiro)) {
                return res.status(400).json({ success: false, message: 'status_financeiro inválido.' });
            }
            for (const campo of ['valor_carga', 'valor_frete']) {
                if (dados[campo] !== undefined && dados[campo] !== null) {
                    const n = Number(dados[campo]);
                    if (isNaN(n) || n < 0) {
                        return res.status(400).json({ success: false, message: `${campo} deve ser número não-negativo.` });
                    }
                    dados[campo] = n;
                }
            }

            const ult = await dbGet(`SELECT MAX(numero_rota) as max FROM tramontina_rotas WHERE mes_referencia = ? AND aba_origem = ?`, [mes, aba]);
            const proximoNum = (ult?.max || 0) + 1;
            const r = await dbRun(
                `INSERT INTO tramontina_rotas
                    (mes_referencia, numero_rota, coleta, data_prevista, data_embarque, operacao_codigo,
                     tipo_veiculo, motorista_nome, placa_cavalo, placa_carreta, redespacho,
                     status_embarque, observacao, criado_por, aba_origem,
                     status_financeiro, valor_carga, valor_frete)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mes, dados.numero_rota || proximoNum, dados.coleta || null,
                    dados.data_prevista || null, dados.data_embarque || null, dados.operacao_codigo || null,
                    dados.tipo_veiculo || null, dados.motorista_nome || null,
                    dados.placa_cavalo || null, dados.placa_carreta || null, dados.redespacho || null,
                    dados.status_embarque || 'PROGRAMADA', dados.observacao || null,
                    req.user?.nome || null,
                    aba,
                    dados.status_financeiro || null,
                    dados.valor_carga != null ? dados.valor_carga : null,
                    dados.valor_frete != null ? dados.valor_frete : null,
                ]
            );
            const novaId = r.lastID;
            const rota = await dbGet(`SELECT * FROM tramontina_rotas WHERE id = ?`, [novaId]);

            // PlanejamentoDelta (2026-05-19): aceita destinos[] junto pra criar rota+entregas num POST só
            const entregasCriadas = [];
            if (Array.isArray(dados.destinos) && dados.destinos.length > 0) {
                for (const d of dados.destinos) {
                    const uf = String(d.uf || '').toUpperCase().slice(0, 2);
                    const regiao = regiaoDeUF(uf);
                    const entregaParcial = { ...d, uf, regiao };
                    const calc = await recalcularEntrega(entregaParcial, rota);
                    const re = await dbRun(
                        `INSERT INTO tramontina_rota_entregas
                            (rota_id, cidade, uf, regiao, cliente, notas_fiscais,
                             status_agendamento, data_entrega_cliente, dias_uteis, lead_status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [novaId, d.cidade || null, uf || null, regiao || null,
                         d.cliente || null, d.notas_fiscais || null,
                         d.status_agendamento || null, d.data_entrega_cliente || null,
                         calc.dias_uteis, calc.lead_status]
                    );
                    const entregaCriada = await dbGet(`SELECT * FROM tramontina_rota_entregas WHERE id = ?`, [re.lastID]);
                    entregasCriadas.push(entregaCriada);
                }
            }

            io.emit('tramontina_rota_criada', { rota: { ...rota, entregas: entregasCriadas } });
            res.json({ success: true, rota: { ...rota, entregas: entregasCriadas } });
        }));

    // ── PUT Editar rota ──────────────────────────
    router.put('/api/tramontina/rotas/:id', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const id = Number(req.params.id);
            const rota = await dbGet(`SELECT * FROM tramontina_rotas WHERE id = ?`, [id]);
            if (!rota) return res.status(404).json({ success: false, message: 'Rota não encontrada.' });

            // PlanejamentoDelta (2026-05-19): valida financeiros se vierem no body
            const tinhaFinanceiro = (
                req.body.status_financeiro !== undefined ||
                req.body.valor_carga !== undefined ||
                req.body.valor_frete !== undefined
            );
            if (tinhaFinanceiro && !temPermissaoFinanceiro(req)) {
                return res.status(403).json({ success: false, message: 'Sem permissão para editar campos financeiros.' });
            }
            if (req.body.status_financeiro !== undefined && req.body.status_financeiro !== null
                && !STATUS_FINANCEIRO_VALIDOS.includes(req.body.status_financeiro)) {
                return res.status(400).json({ success: false, message: 'status_financeiro inválido.' });
            }
            for (const campo of ['valor_carga', 'valor_frete']) {
                if (req.body[campo] !== undefined && req.body[campo] !== null) {
                    const n = Number(req.body[campo]);
                    if (isNaN(n) || n < 0) {
                        return res.status(400).json({ success: false, message: `${campo} deve ser número não-negativo.` });
                    }
                    req.body[campo] = n;
                }
            }

            const campos = ['numero_rota','coleta','data_prevista','data_embarque','operacao_codigo','tipo_veiculo',
                            'motorista_nome','placa_cavalo','placa_carreta','redespacho','status_embarque','observacao',
                            'aba_origem','status_financeiro','valor_carga','valor_frete'];
            const sets = [];
            const vals = [];
            for (const c of campos) {
                if (Object.prototype.hasOwnProperty.call(req.body, c)) {
                    sets.push(`${c} = ?`);
                    vals.push(req.body[c]);
                }
            }
            if (!sets.length) return res.json({ success: true, rota });
            sets.push(`atualizado_em = NOW()`);
            vals.push(id);
            await dbRun(`UPDATE tramontina_rotas SET ${sets.join(', ')} WHERE id = ?`, vals);

            // Se data_embarque mudou, recalcular lead_status de todas as entregas
            const rotaNova = await dbGet(`SELECT * FROM tramontina_rotas WHERE id = ?`, [id]);
            if (rota.data_embarque !== rotaNova.data_embarque) {
                const entregas = await dbAll(`SELECT * FROM tramontina_rota_entregas WHERE rota_id = ?`, [id]);
                for (const ent of entregas) {
                    const calc = await recalcularEntrega(ent, rotaNova);
                    await dbRun(`UPDATE tramontina_rota_entregas SET dias_uteis = ?, lead_status = ? WHERE id = ?`,
                        [calc.dias_uteis, calc.lead_status, ent.id]);
                }
            }
            const entregas = await dbAll(`SELECT * FROM tramontina_rota_entregas WHERE rota_id = ? ORDER BY id ASC`, [id]);
            const payload = { ...rotaNova, entregas };
            io.emit('tramontina_rota_atualizada', { rota: payload });
            res.json({ success: true, rota: payload });
        }));

    // ── DELETE Remover rota ──────────────────────────
    router.delete('/api/tramontina/rotas/:id', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const id = Number(req.params.id);
            await dbRun(`DELETE FROM tramontina_rotas WHERE id = ?`, [id]);
            io.emit('tramontina_rota_removida', { id });
            res.json({ success: true });
        }));

    // ── POST Adicionar entrega ──────────────────────────
    router.post('/api/tramontina/rotas/:rotaId/entregas', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const rotaId = Number(req.params.rotaId);
            const rota = await dbGet(`SELECT * FROM tramontina_rotas WHERE id = ?`, [rotaId]);
            if (!rota) return res.status(404).json({ success: false, message: 'Rota não encontrada.' });
            const dados = req.body || {};
            const uf = String(dados.uf || '').toUpperCase().slice(0, 2);
            const regiao = regiaoDeUF(uf);
            const entregaParcial = { ...dados, uf, regiao };
            const calc = await recalcularEntrega(entregaParcial, rota);
            const r = await dbRun(
                `INSERT INTO tramontina_rota_entregas
                    (rota_id, cidade, uf, regiao, cliente, notas_fiscais,
                     status_agendamento, data_entrega_cliente, dias_uteis, lead_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [rotaId, dados.cidade || null, uf || null, regiao || null,
                 dados.cliente || null, dados.notas_fiscais || null,
                 dados.status_agendamento || null, dados.data_entrega_cliente || null,
                 calc.dias_uteis, calc.lead_status]
            );
            const entrega = await dbGet(`SELECT * FROM tramontina_rota_entregas WHERE id = ?`, [r.lastID]);
            io.emit('tramontina_entrega_criada', { rotaId, entrega });
            res.json({ success: true, entrega });
        }));

    // ── PUT Editar entrega ──────────────────────────
    router.put('/api/tramontina/entregas/:id', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const id = Number(req.params.id);
            const entrega = await dbGet(`SELECT * FROM tramontina_rota_entregas WHERE id = ?`, [id]);
            if (!entrega) return res.status(404).json({ success: false, message: 'Entrega não encontrada.' });
            const rota = await dbGet(`SELECT * FROM tramontina_rotas WHERE id = ?`, [entrega.rota_id]);
            const campos = ['cidade','uf','cliente','notas_fiscais','status_agendamento','data_entrega_cliente'];
            const novo = { ...entrega };
            for (const c of campos) {
                if (Object.prototype.hasOwnProperty.call(req.body, c)) novo[c] = req.body[c];
            }
            novo.uf = novo.uf ? String(novo.uf).toUpperCase().slice(0, 2) : null;
            novo.regiao = regiaoDeUF(novo.uf);
            const calc = await recalcularEntrega(novo, rota);
            await dbRun(
                `UPDATE tramontina_rota_entregas SET
                    cidade = ?, uf = ?, regiao = ?, cliente = ?, notas_fiscais = ?,
                    status_agendamento = ?, data_entrega_cliente = ?,
                    dias_uteis = ?, lead_status = ?
                 WHERE id = ?`,
                [novo.cidade, novo.uf, novo.regiao, novo.cliente, novo.notas_fiscais,
                 novo.status_agendamento, novo.data_entrega_cliente, calc.dias_uteis, calc.lead_status, id]
            );
            const final = await dbGet(`SELECT * FROM tramontina_rota_entregas WHERE id = ?`, [id]);
            io.emit('tramontina_entrega_atualizada', { rotaId: entrega.rota_id, entrega: final });
            res.json({ success: true, entrega: final });
        }));

    // ── DELETE Remover entrega ──────────────────────────
    router.delete('/api/tramontina/entregas/:id', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const id = Number(req.params.id);
            const ent = await dbGet(`SELECT rota_id FROM tramontina_rota_entregas WHERE id = ?`, [id]);
            if (!ent) return res.status(404).json({ success: false, message: 'Entrega não encontrada.' });
            await dbRun(`DELETE FROM tramontina_rota_entregas WHERE id = ?`, [id]);
            io.emit('tramontina_entrega_removida', { id, rotaId: ent.rota_id });
            res.json({ success: true });
        }));

    // ── Lock visual (broadcast quem está editando) ──────────────────────────
    router.post('/api/tramontina/editando', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
        const { rotaId, campo } = req.body || {};
        io.emit('tramontina_usuario_editando', {
            rotaId, campo,
            usuario: req.user?.nome || '?',
            expira_em: Date.now() + 5000
        });
        res.json({ success: true });
    }));

    // ── POST Importar (recebe JSON pré-parseado do frontend, ver ModalImportarTramontina.js) ──
    router.post('/api/tramontina/importar', authMiddleware, authorize(CARGOS_EDITAR_OPERACIONAL), asyncHandler(async (req, res) => {
            const { mes_referencia: mes, rotas: payload } = req.body || {};
            if (!mes) return res.status(400).json({ success: false, message: 'mes_referencia obrigatório.' });
            if (!Array.isArray(payload) || !payload.length) return res.status(400).json({ success: false, message: 'Nenhuma rota recebida.' });

            let rotasOk = 0, entregasOk = 0;
            for (const rota of payload) {
                const r = await dbRun(
                    `INSERT INTO tramontina_rotas
                        (mes_referencia, numero_rota, coleta, data_prevista, data_embarque,
                         operacao_codigo, tipo_veiculo, motorista_nome, placa_cavalo, placa_carreta,
                         redespacho, observacao, criado_por)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [mes, rota.numero_rota || (rotasOk + 1), rota.coleta || null,
                     rota.data_prevista || null, rota.data_embarque || null,
                     (rota.operacao_codigo || '').toUpperCase() || null,
                     (rota.tipo_veiculo || '').toUpperCase() || null,
                     rota.motorista_nome || null,
                     (rota.placa_cavalo || '').toUpperCase() || null,
                     (rota.placa_carreta || '').toUpperCase() || null,
                     rota.redespacho || null, rota.observacao || null,
                     req.user?.nome || 'importação']
                );
                const rotaId = r.lastID;
                rotasOk++;
                const rotaSalva = { ...rota, id: rotaId };
                for (const ent of (rota.entregas || [])) {
                    const uf = String(ent.uf || '').toUpperCase().slice(0, 2);
                    const regiao = regiaoDeUF(uf);
                    const calc = await recalcularEntrega({ ...ent, uf, regiao }, rotaSalva);
                    await dbRun(
                        `INSERT INTO tramontina_rota_entregas
                            (rota_id, cidade, uf, regiao, cliente, notas_fiscais,
                             status_agendamento, data_entrega_cliente, dias_uteis, lead_status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [rotaId, ent.cidade || null, uf || null, regiao || null,
                         ent.cliente || null, ent.notas_fiscais || null,
                         ent.status_agendamento || null, ent.data_entrega_cliente || null,
                         calc.dias_uteis, calc.lead_status]
                    );
                    entregasOk++;
                }
            }
            io.emit('tramontina_importacao_concluida', { mes, rotasOk, entregasOk });
            res.json({ success: true, importadas: rotasOk, entregas: entregasOk });
        }));

    return router;
};
