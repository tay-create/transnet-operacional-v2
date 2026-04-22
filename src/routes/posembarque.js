const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');

module.exports = function createPosEmbarqueRouter(registrarLog, io) {
    const router = express.Router();

    // Helper: calcular SLA (24h em ms)
    function verificarAtraso(oc) {
        const inicio = new Date(`${oc.data_ocorrencia}T${oc.hora_ocorrencia}:00`);
        const fim = oc.situacao === 'RESOLVIDO'
            ? new Date(`${oc.data_conclusao}T${oc.hora_conclusao}:00`)
            : new Date();
        return (fim - inicio) > 24 * 60 * 60 * 1000;
    }

    // ── GET Listar ocorrências com filtros ──────────────────────────
    router.get('/api/posembarque/ocorrencias', authMiddleware, async (req, res) => {
        try {
            const { busca, situacao, arquivado } = req.query;
            let sql = 'SELECT * FROM posemb_ocorrencias WHERE 1=1';
            const params = [];

            if (arquivado !== undefined) {
                sql += ' AND arquivado = ?';
                params.push(parseInt(arquivado) || 0);
            }
            if (situacao) {
                sql += ' AND situacao = ?';
                params.push(situacao);
            }
            if (busca) {
                sql += ' AND (motorista ILIKE ? OR cliente ILIKE ? OR cte ILIKE ? OR motivo ILIKE ?)';
                const searchPattern = `%${busca}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }

            sql += ' ORDER BY data_criacao DESC';
            const ocorrencias = await dbAll(sql, params);
            res.json({ success: true, ocorrencias });
        } catch (e) {
            console.error('Erro ao listar ocorrências posembarque:', e);
            res.status(500).json({ success: false, message: 'Erro ao listar ocorrências.' });
        }
    });

    // ── POST Criar ocorrência ──────────────────────────
    router.post('/api/posembarque/ocorrencias', authMiddleware, authorize(['Pos Embarque', 'Planejamento', 'Coordenador', 'Direção']), async (req, res) => {
        try {
            const { data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, link_email } = req.body;
            const responsavel = req.user?.nome || 'desconhecido';

            console.log('[POSEMB] Criando ocorrência:', { motorista, cliente, motivo, responsavel });

            const result = await dbRun(
                `INSERT INTO posemb_ocorrencias (data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, link_email, responsavel, data_criacao, situacao, arquivado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Em Andamento', 0)`,
                [data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, link_email, responsavel, new Date().toISOString()]
            );

            console.log(`[POSEMB] Ocorrência criada com ID ${result.lastID}`);

            // Popular listas automaticamente quando valor novo (sem quebrar se der erro)
            try {
                if (motorista) await dbRun(`INSERT INTO posemb_motoristas (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING`, [motorista]);
                if (cliente) await dbRun(`INSERT INTO posemb_clientes (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING`, [cliente]);
                if (motivo) await dbRun(`INSERT INTO posemb_motivos (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING`, [motivo]);
            } catch (errListas) {
                console.warn('[POSEMB] Falha ao popular listas auxiliares:', errListas.message);
            }

            try {
                await registrarLog('POSEMB_OCORRENCIA_CRIADA', responsavel, result.lastID, 'posemb_ocorrencias', null, null, `${motorista} - ${motivo}`);
            } catch (errLog) {
                console.warn('[POSEMB] Falha ao registrar log (ocorrência ja foi criada):', errLog.message);
            }

            if (io) io.emit('posembarque_atualizada', { tipo: 'criada' });

            res.json({ success: true, id: result.lastID });
        } catch (e) {
            console.error('[POSEMB] Erro ao criar ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao criar ocorrência.' });
        }
    });

    // ── GET Detalhes de uma ocorrência ──────────────────────────
    router.get('/api/posembarque/ocorrencias/:id', authMiddleware, async (req, res) => {
        try {
            const oc = await dbGet('SELECT * FROM posemb_ocorrencias WHERE id = ?', [req.params.id]);
            if (!oc) return res.status(404).json({ success: false, message: 'Ocorrência não encontrada.' });

            // Parse fotos_json
            if (oc.fotos_json && typeof oc.fotos_json === 'string') {
                try { oc.fotos = JSON.parse(oc.fotos_json); } catch (_) { oc.fotos = []; }
            } else {
                oc.fotos = [];
            }

            res.json({ success: true, ocorrencia: oc });
        } catch (e) {
            console.error('Erro ao buscar ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar ocorrência.' });
        }
    });

    // ── PUT Atualizar ocorrência ──────────────────────────
    router.put('/api/posembarque/ocorrencias/:id', authMiddleware, authorize(['Pos Embarque', 'Planejamento', 'Coordenador', 'Direção']), async (req, res) => {
        try {
            const id = req.params.id;
            const { data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, link_email } = req.body;

            await dbRun(
                `UPDATE posemb_ocorrencias
                 SET data_ocorrencia = ?, hora_ocorrencia = ?, motorista = ?, modalidade = ?, cte = ?, operacao = ?, nfs = ?, cliente = ?, cidade = ?, motivo = ?, link_email = ?
                 WHERE id = ?`,
                [data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, link_email, id]
            );

            await registrarLog('POSEMB_OCORRENCIA_ATUALIZADA', req.user?.nome || '?', id, 'posemb_ocorrencias', null, null, `${motorista} - ${motivo}`);
            if (io) io.emit('posembarque_atualizada', { tipo: 'atualizada' });

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao atualizar ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao atualizar ocorrência.' });
        }
    });

    // ── DELETE Excluir ocorrência ──────────────────────────
    router.delete('/api/posembarque/ocorrencias/:id', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
        try {
            const id = req.params.id;
            await dbRun('DELETE FROM posemb_ocorrencias WHERE id = ?', [id]);
            await registrarLog('POSEMB_OCORRENCIA_DELETADA', req.user?.nome || '?', id, 'posemb_ocorrencias', null, null, '');
            if (io) io.emit('posembarque_atualizada', { tipo: 'deletada' });
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao deletar ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao deletar ocorrência.' });
        }
    });

    // ── POST Resolver ocorrência ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/resolver', authMiddleware, async (req, res) => {
        try {
            const id = req.params.id;
            const agora = new Date();
            const resolved_at = agora.toISOString();
            // Brasília UTC-3 para exibição nos campos legados
            const agoraBRT = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
            const data_conclusao = agoraBRT.toISOString().split('T')[0];
            const hora_conclusao = agoraBRT.toISOString().substring(11, 16);

            await dbRun(
                `UPDATE posemb_ocorrencias SET situacao = 'RESOLVIDO', data_conclusao = $1, hora_conclusao = $2, resolved_at = $3 WHERE id = $4`,
                [data_conclusao, hora_conclusao, resolved_at, id]
            );

            await registrarLog('POSEMB_OCORRENCIA_RESOLVIDA', req.user?.nome || '?', id, 'posemb_ocorrencias', 'Em Andamento', 'RESOLVIDO', '');
            if (io) io.emit('posembarque_atualizada', { tipo: 'resolvida' });

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao resolver ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao resolver ocorrência.' });
        }
    });

    // ── POST Solicitar edição ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/solicitar-edicao', authMiddleware, authorize(['Pos Embarque', 'Planejamento']), async (req, res) => {
        try {
            const { motivo_edicao } = req.body;
            await dbRun(
                `UPDATE posemb_ocorrencias SET status_edicao = 'SOLICITADO', motivo_edicao = ? WHERE id = ?`,
                [motivo_edicao || '', req.params.id]
            );
            await registrarLog('POSEMB_EDICAO_SOLICITADA', req.user?.nome || '?', req.params.id, 'posemb_ocorrencias', null, null, motivo_edicao || '');
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao solicitar edição:', e);
            res.status(500).json({ success: false, message: 'Erro ao solicitar edição.' });
        }
    });

    // ── POST Liberar edição ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/liberar-edicao', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
        try {
            await dbRun(
                `UPDATE posemb_ocorrencias SET status_edicao = 'AUTORIZADO' WHERE id = ?`,
                [req.params.id]
            );
            await registrarLog('POSEMB_EDICAO_LIBERADA', req.user?.nome || '?', req.params.id, 'posemb_ocorrencias', null, null, '');
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao liberar edição:', e);
            res.status(500).json({ success: false, message: 'Erro ao liberar edição.' });
        }
    });

    // ── POST Recusar edição ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/recusar-edicao', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
        try {
            await dbRun(
                `UPDATE posemb_ocorrencias SET status_edicao = 'BLOQUEADO', motivo_edicao = NULL WHERE id = ?`,
                [req.params.id]
            );
            await registrarLog('POSEMB_EDICAO_RECUSADA', req.user?.nome || '?', req.params.id, 'posemb_ocorrencias', null, null, '');
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao recusar edição:', e);
            res.status(500).json({ success: false, message: 'Erro ao recusar edição.' });
        }
    });

    // ── POST Arquivar resolvidos ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/arquivar', authMiddleware, authorize(['Coordenador', 'Direção']), async (req, res) => {
        try {
            await dbRun(
                `UPDATE posemb_ocorrencias SET arquivado = 1 WHERE id = ?`,
                [req.params.id]
            );
            await registrarLog('POSEMB_OCORRENCIA_ARQUIVADA', req.user?.nome || '?', req.params.id, 'posemb_ocorrencias', null, null, '');
            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao arquivar ocorrência:', e);
            res.status(500).json({ success: false, message: 'Erro ao arquivar ocorrência.' });
        }
    });

    // ── POST Adicionar foto ──────────────────────────
    router.post('/api/posembarque/ocorrencias/:id/fotos', authMiddleware, async (req, res) => {
        try {
            const id = req.params.id;
            const { base64, nome } = req.body;

            const oc = await dbGet('SELECT fotos_json FROM posemb_ocorrencias WHERE id = ?', [id]);
            if (!oc) return res.status(404).json({ success: false, message: 'Ocorrência não encontrada.' });

            let fotos = [];
            try { fotos = JSON.parse(oc.fotos_json || '[]'); } catch (_) { }

            if (fotos.length >= 5) {
                return res.status(400).json({ success: false, message: 'Máximo de 5 fotos atingido.' });
            }

            fotos.push({ nome: nome || `foto_${Date.now()}.jpg`, base64 });

            await dbRun(
                `UPDATE posemb_ocorrencias SET fotos_json = ? WHERE id = ?`,
                [JSON.stringify(fotos), id]
            );

            await registrarLog('POSEMB_FOTO_ADICIONADA', req.user?.nome || '?', id, 'posemb_ocorrencias', null, null, nome || '');

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao adicionar foto:', e);
            res.status(500).json({ success: false, message: 'Erro ao adicionar foto.' });
        }
    });

    // ── DELETE Remover foto ──────────────────────────
    router.delete('/api/posembarque/ocorrencias/:id/fotos/:index', authMiddleware, async (req, res) => {
        try {
            const id = req.params.id;
            const index = parseInt(req.params.index);

            const oc = await dbGet('SELECT fotos_json FROM posemb_ocorrencias WHERE id = ?', [id]);
            if (!oc) return res.status(404).json({ success: false, message: 'Ocorrência não encontrada.' });

            let fotos = [];
            try { fotos = JSON.parse(oc.fotos_json || '[]'); } catch (_) { }

            if (index < 0 || index >= fotos.length) {
                return res.status(400).json({ success: false, message: 'Índice de foto inválido.' });
            }

            fotos.splice(index, 1);

            await dbRun(
                `UPDATE posemb_ocorrencias SET fotos_json = ? WHERE id = ?`,
                [JSON.stringify(fotos), id]
            );

            await registrarLog('POSEMB_FOTO_REMOVIDA', req.user?.nome || '?', id, 'posemb_ocorrencias', null, null, '');

            res.json({ success: true });
        } catch (e) {
            console.error('Erro ao remover foto:', e);
            res.status(500).json({ success: false, message: 'Erro ao remover foto.' });
        }
    });

    // ── GET Listas (motoristas, clientes, motivos) ──────────────────────────
    router.get('/api/posembarque/listas', authMiddleware, async (req, res) => {
        try {
            const motoristas = await dbAll('SELECT DISTINCT nome FROM posemb_motoristas ORDER BY nome ASC');
            const clientes = await dbAll('SELECT DISTINCT nome FROM posemb_clientes ORDER BY nome ASC');
            const motivos = await dbAll('SELECT DISTINCT nome FROM posemb_motivos ORDER BY nome ASC');

            res.json({
                success: true,
                motoristas: motoristas.map(m => m.nome),
                clientes: clientes.map(c => c.nome),
                motivos: motivos.map(m => m.nome)
            });
        } catch (e) {
            console.error('Erro ao buscar listas:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar listas.' });
        }
    });

    // ── GET Relatório com filtros ──────────────────────────
    router.get('/api/posembarque/relatorio', authMiddleware, async (req, res) => {
        try {
            const { de, ate, motorista, cliente, cidade, motivo, operacao, situacao } = req.query;
            let sql = 'SELECT * FROM posemb_ocorrencias WHERE arquivado = 0';
            const params = [];

            if (de) { sql += ' AND data_ocorrencia >= ?'; params.push(de); }
            if (ate) { sql += ' AND data_ocorrencia <= ?'; params.push(ate); }
            if (motorista) { sql += ' AND motorista ILIKE ?'; params.push(`%${motorista}%`); }
            if (cliente) { sql += ' AND cliente ILIKE ?'; params.push(`%${cliente}%`); }
            if (cidade) { sql += ' AND cidade ILIKE ?'; params.push(`%${cidade}%`); }
            if (motivo) { sql += ' AND motivo ILIKE ?'; params.push(`%${motivo}%`); }
            if (operacao) { sql += ' AND operacao ILIKE ?'; params.push(`%${operacao}%`); }
            if (situacao) { sql += ' AND situacao = ?'; params.push(situacao); }

            sql += ' ORDER BY data_ocorrencia DESC, hora_ocorrencia DESC';
            const ocorrencias = await dbAll(sql, params);

            // Calcular métricas
            const total = ocorrencias.length;
            const resolvidos = ocorrencias.filter(o => o.situacao === 'RESOLVIDO').length;
            const atrasados = ocorrencias.filter(o => verificarAtraso(o)).length;
            const em_andamento = ocorrencias.filter(o => o.situacao === 'Em Andamento').length;

            // Agrupar por operacao para gráfico
            const por_operacao = {};
            ocorrencias.forEach(o => {
                const op = o.operacao || 'Não especificada';
                por_operacao[op] = (por_operacao[op] || 0) + 1;
            });

            // Top 5 motivos
            const por_motivo = {};
            ocorrencias.forEach(o => {
                const m = o.motivo || 'Não especificado';
                por_motivo[m] = (por_motivo[m] || 0) + 1;
            });
            const top_motivos = Object.entries(por_motivo)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([motivo, count]) => ({ motivo, count }));

            res.json({
                success: true,
                ocorrencias,
                metricas: { total, resolvidos, atrasados, em_andamento },
                por_operacao,
                top_motivos
            });
        } catch (e) {
            console.error('Erro ao buscar relatório:', e);
            res.status(500).json({ success: false, message: 'Erro ao buscar relatório.' });
        }
    });

    return router;
};
