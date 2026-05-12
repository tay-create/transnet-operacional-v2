// Helper de sincronização de data_prevista por unidade.
//
// Cards consolidados (Recife + Moreno na mesma linha) podem ter ciclos em dias
// diferentes — por isso existem data_prevista_recife e data_prevista_moreno.
// data_prevista é mantida como guarda-chuva: igual à menor das duas. Relatórios
// agregados continuam lendo data_prevista (consolidado conta como 1 card).

function _norm(d) {
    if (!d) return null;
    // Aceita 'YYYY-MM-DD' ou ISO 'YYYY-MM-DDT...'; reduz para 'YYYY-MM-DD'.
    const s = String(d).trim();
    if (!s) return null;
    return s.length >= 10 ? s.slice(0, 10) : s;
}

function derivarGuardaChuva(dpR, dpM) {
    const r = _norm(dpR);
    const m = _norm(dpM);
    if (r && m) return r < m ? r : m;
    return r || m || null;
}

// Aplica uma única data nas três colunas (criação ou edição "do card inteiro").
async function aplicarDataUnica(dbRun, veiculoId, data) {
    const d = _norm(data);
    if (!d) return null;
    await dbRun(
        `UPDATE veiculos
            SET data_prevista = ?,
                data_prevista_recife = ?,
                data_prevista_moreno = ?
          WHERE id = ?`,
        [d, d, d, veiculoId]
    );
    return { data_prevista: d, data_prevista_recife: d, data_prevista_moreno: d };
}

// Atualiza só data_prevista_{unidade}, recalcula guarda-chuva e persiste tudo.
// ctx: { registrarLog, usuario, motivo, alvoTipo='veiculo' }
async function aplicarDataUnidade(dbRun, dbGet, veiculoId, unidade, novaData, ctx = {}) {
    const lado = String(unidade || '').toLowerCase();
    if (lado !== 'recife' && lado !== 'moreno') {
        throw new Error(`aplicarDataUnidade: unidade inválida "${unidade}"`);
    }
    const d = _norm(novaData);
    if (!d) return null;

    const antes = await dbGet(
        `SELECT data_prevista, data_prevista_recife, data_prevista_moreno
           FROM veiculos WHERE id = ?`,
        [veiculoId]
    );
    if (!antes) return null;

    const novoR = lado === 'recife' ? d : _norm(antes.data_prevista_recife);
    const novoM = lado === 'moreno' ? d : _norm(antes.data_prevista_moreno);
    const novoGuarda = derivarGuardaChuva(novoR, novoM) || d;

    await dbRun(
        `UPDATE veiculos
            SET data_prevista_recife = ?,
                data_prevista_moreno = ?,
                data_prevista = ?
          WHERE id = ?`,
        [novoR, novoM, novoGuarda, veiculoId]
    );

    if (ctx.registrarLog) {
        try {
            await ctx.registrarLog(
                ctx.acao || 'DATA_PREVISTA_UNIDADE',
                ctx.usuario || 'sistema',
                veiculoId,
                ctx.alvoTipo || 'veiculo',
                JSON.stringify({
                    recife: _norm(antes.data_prevista_recife),
                    moreno: _norm(antes.data_prevista_moreno),
                    guarda: _norm(antes.data_prevista),
                }),
                JSON.stringify({ recife: novoR, moreno: novoM, guarda: novoGuarda }),
                ctx.motivo || `Atualização data_prevista_${lado} → ${d}`
            );
        } catch (e) {
            // Log não pode quebrar a operação principal
            console.error('[dataPrevistaSync] registrarLog falhou:', e.message);
        }
    }

    return {
        data_prevista: novoGuarda,
        data_prevista_recife: novoR,
        data_prevista_moreno: novoM,
    };
}

module.exports = {
    derivarGuardaChuva,
    aplicarDataUnica,
    aplicarDataUnidade,
};
