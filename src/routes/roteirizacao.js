const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');

const CARGOS_GESTAO = ['Coordenador', 'Direção', 'Planejamento', 'Adm Frota', 'Desenvolvedor'];
const CARGOS_VISUALIZACAO = [...CARGOS_GESTAO, 'Aux. Operacional', 'Encarregado', 'Manutenção', 'Conhecimento', 'Cadastro', 'Conferente'];

// Calcula status automático com base nas datas
function calcularStatus(r) {
    if (['MANUTENCAO', 'CONCLUIDO'].includes(r.status)) return r.status;
    const agora = new Date();
    const saida = r.data_saida ? new Date(r.data_saida) : null;
    const retorno = r.data_retorno_prevista ? new Date(r.data_retorno_prevista + 'T23:59:59') : null;

    let destinos = [];
    try { destinos = JSON.parse(r.destinos_json || '[]'); } catch {}

    const ultimaEntrega = destinos.length > 0
        ? destinos.reduce((max, d) => d.data && d.data > max ? d.data : max, '')
        : null;

    if (!saida || agora < saida) return 'PREPARANDO';
    if (retorno && agora > retorno) return 'CONCLUIDO';
    if (ultimaEntrega && agora > new Date(ultimaEntrega + 'T23:59:59')) {
        return retorno ? 'RETORNANDO' : 'CONCLUIDO';
    }
    return 'EM_VIAGEM';
}

function formatarRoteirizacao(r) {
    let destinos = [];
    try { destinos = JSON.parse(r.destinos_json || '[]'); } catch {}
    return {
        ...r,
        destinos,
        status: calcularStatus(r),
        status_manual: r.status
    };
}

module.exports = (io) => {
    // Listar roteirizações ativas (não concluídas, exceto as de manutenção que devem aparecer)
    router.get('/api/roteirizacao', authMiddleware, authorize(CARGOS_VISUALIZACAO), async (req, res) => {
        try {
            const rows = await dbAll(`
                SELECT * FROM frota_roteirizacoes
                WHERE status != 'CONCLUIDO'
                ORDER BY
                    CASE status
                        WHEN 'EM_VIAGEM' THEN 1
                        WHEN 'PREPARANDO' THEN 2
                        WHEN 'RETORNANDO' THEN 3
                        WHEN 'MANUTENCAO' THEN 4
                        ELSE 5
                    END,
                    data_saida ASC NULLS LAST
            `);
            res.json({ success: true, roteirizacoes: rows.map(formatarRoteirizacao) });
        } catch (e) {
            console.error('Erro ao listar roteirizações:', e);
            res.status(500).json({ success: false });
        }
    });

    // Criar nova roteirização
    router.post('/api/roteirizacao', authMiddleware, authorize(CARGOS_GESTAO), async (req, res) => {
        const {
            nome_cliente, coleta_recife, coleta_moreno, operacao,
            motorista_nome, motorista_id, placa_cavalo, placa_carreta,
            origem, quantidade_entregas, destinos, data_saida, data_retorno_prevista
        } = req.body;

        if (!operacao || !motorista_nome) {
            return res.status(400).json({ success: false, message: 'Operação e motorista são obrigatórios.' });
        }

        try {
            const result = await dbRun(`
                INSERT INTO frota_roteirizacoes
                    (nome_cliente, coleta_recife, coleta_moreno, operacao, motorista_nome, motorista_id,
                     placa_cavalo, placa_carreta, origem, quantidade_entregas, destinos_json,
                     data_saida, data_retorno_prevista, status, criado_por)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PREPARANDO',$14)
                RETURNING id
            `, [
                nome_cliente || '', coleta_recife || '', coleta_moreno || '', operacao,
                motorista_nome, motorista_id || null, placa_cavalo || '', placa_carreta || '',
                origem || '', quantidade_entregas || 1,
                JSON.stringify(destinos || []),
                data_saida || null, data_retorno_prevista || null,
                req.user.id
            ]);

            const nova = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [result.id || result.lastID]);

            io.emit('receber_atualizacao', { tipo: 'roteirizacao_atualizada', acao: 'criada', roteirizacao: formatarRoteirizacao(nova) });

            // Sincronizar com provisionamento se tiver veiculo vinculado
            if (placa_cavalo && destinos?.length > 0 && data_saida) {
                try {
                    const veiculo = await dbGet(
                        "SELECT id FROM prov_veiculos WHERE LOWER(placa) = LOWER($1) AND ativo = TRUE LIMIT 1",
                        [placa_cavalo]
                    );
                    if (veiculo) {
                        const entradas = destinos.map(d => ({ cidade: `${d.cidade}${d.uf ? ' - ' + d.uf : ''}`, data: d.data }));
                        await dbRun(`
                            INSERT INTO prov_programacao (veiculo_id, data, status, destino, motorista)
                            VALUES ($1, $2, 'EM_VIAGEM', $3, $4)
                            ON CONFLICT (veiculo_id, data) DO UPDATE SET status='EM_VIAGEM', destino=EXCLUDED.destino, motorista=EXCLUDED.motorista
                        `, [veiculo.id, data_saida.substring(0, 10), entradas.map(e => e.cidade).join(', '), motorista_nome]);
                    }
                } catch (syncErr) {
                    console.warn('Aviso: não foi possível sincronizar com provisionamento:', syncErr.message);
                }
            }

            res.json({ success: true, id: nova.id });
        } catch (e) {
            console.error('Erro ao criar roteirização:', e);
            res.status(500).json({ success: false, message: 'Erro interno ao criar roteirização.' });
        }
    });

    // Atualizar roteirização completa (edição)
    router.put('/api/roteirizacao/:id', authMiddleware, authorize(CARGOS_GESTAO), async (req, res) => {
        const {
            nome_cliente, coleta_recife, coleta_moreno, operacao,
            motorista_nome, motorista_id, placa_cavalo, placa_carreta,
            origem, quantidade_entregas, destinos, data_saida, data_retorno_prevista
        } = req.body;
        try {
            await dbRun(`
                UPDATE frota_roteirizacoes SET
                    nome_cliente=$1, coleta_recife=$2, coleta_moreno=$3, operacao=$4,
                    motorista_nome=$5, motorista_id=$6, placa_cavalo=$7, placa_carreta=$8,
                    origem=$9, quantidade_entregas=$10, destinos_json=$11,
                    data_saida=$12, data_retorno_prevista=$13, atualizado_em=NOW()
                WHERE id=$14
            `, [
                nome_cliente || '', coleta_recife || '', coleta_moreno || '', operacao,
                motorista_nome, motorista_id || null, placa_cavalo || '', placa_carreta || '',
                origem || '', quantidade_entregas || 1, JSON.stringify(destinos || []),
                data_saida || null, data_retorno_prevista || null, req.params.id
            ]);

            const atualizada = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [req.params.id]);
            io.emit('receber_atualizacao', { tipo: 'roteirizacao_atualizada', acao: 'editada', roteirizacao: formatarRoteirizacao(atualizada) });
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao editar roteirização:', e);
            res.status(500).json({ success: false });
        }
    });

    // Atualizar status manualmente
    router.patch('/api/roteirizacao/:id/status', authMiddleware, authorize(CARGOS_GESTAO), async (req, res) => {
        const { status, observacao_manutencao } = req.body;
        const statusValidos = ['PREPARANDO', 'EM_VIAGEM', 'RETORNANDO', 'CONCLUIDO', 'MANUTENCAO'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        try {
            await dbRun(
                'UPDATE frota_roteirizacoes SET status=$1, observacao_manutencao=$2, atualizado_em=NOW() WHERE id=$3',
                [status, observacao_manutencao || null, req.params.id]
            );
            const atualizada = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [req.params.id]);
            io.emit('receber_atualizacao', { tipo: 'roteirizacao_atualizada', acao: 'status', roteirizacao: formatarRoteirizacao(atualizada) });
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao atualizar status:', e);
            res.status(500).json({ success: false });
        }
    });

    // Duplicar roteirização (para substituição em caso de manutenção)
    router.post('/api/roteirizacao/:id/duplicar', authMiddleware, authorize(CARGOS_GESTAO), async (req, res) => {
        const { motorista_nome, motorista_id, placa_cavalo, placa_carreta } = req.body;
        try {
            const original = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [req.params.id]);
            if (!original) return res.status(404).json({ success: false });

            const result = await dbRun(`
                INSERT INTO frota_roteirizacoes
                    (nome_cliente, coleta_recife, coleta_moreno, operacao, motorista_nome, motorista_id,
                     placa_cavalo, placa_carreta, origem, quantidade_entregas, destinos_json,
                     data_saida, data_retorno_prevista, status, criado_por)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PREPARANDO',$14)
                RETURNING id
            `, [
                original.nome_cliente, original.coleta_recife, original.coleta_moreno, original.operacao,
                motorista_nome, motorista_id || null, placa_cavalo, placa_carreta,
                original.origem, original.quantidade_entregas, original.destinos_json,
                original.data_saida, original.data_retorno_prevista, req.user.id
            ]);

            const nova = await dbGet('SELECT * FROM frota_roteirizacoes WHERE id = $1', [result.id || result.lastID]);
            io.emit('receber_atualizacao', { tipo: 'roteirizacao_atualizada', acao: 'criada', roteirizacao: formatarRoteirizacao(nova) });
            res.json({ success: true, id: nova.id });
        } catch (e) {
            console.error('Erro ao duplicar roteirização:', e);
            res.status(500).json({ success: false });
        }
    });

    // Excluir (concluir)
    router.delete('/api/roteirizacao/:id', authMiddleware, authorize(['Coordenador', 'Direção', 'Desenvolvedor']), async (req, res) => {
        try {
            await dbRun('UPDATE frota_roteirizacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', ['CONCLUIDO', req.params.id]);
            io.emit('receber_atualizacao', { tipo: 'roteirizacao_atualizada', acao: 'concluida', id: parseInt(req.params.id) });
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao excluir roteirização:', e);
            res.status(500).json({ success: false });
        }
    });

    return router;
};
