// Helpers do painel Lead Time Operacional.
// Parse com forward-fill de Rota (Col A) e Data de Embarque (Col H),
// e agregação por UF/Região para classificações Transnet + Tramontina.

const {
    calcularDiasUteis,
    classificarLeadTime,
    regiaoDeUF,
    normalizarRegiao,
    nomeDeRegiao,
    LEAD_PADRAO_TRAMONTINA_REGIAO,
} = require('./tramontinaLeadTime');

// Converte data vinda da planilha (vários formatos) para 'YYYY-MM-DD'.
// Aceita 'DD/MM/YYYY', 'YYYY-MM-DD', número serial do Excel, Date.
function normalizarData(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) {
        const y = v.getUTCFullYear();
        const m = String(v.getUTCMonth() + 1).padStart(2, '0');
        const d = String(v.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    if (!s) return null;
    // YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    // DD/MM/YYYY ou DD/MM/YY
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (brMatch) {
        let [, d, m, y] = brMatch;
        if (y.length === 2) y = '20' + y;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // Serial do Excel (número de dias desde 1900-01-01)
    const num = Number(s);
    if (!Number.isNaN(num) && num > 25569) { // 25569 = 1970-01-01
        const ms = (num - 25569) * 86400 * 1000;
        const dt = new Date(ms);
        return normalizarData(dt);
    }
    return null;
}

// Faz parse das linhas vindas de DELTA-PORCELANA!A10:AB730 aplicando forward-fill.
// Espera array de arrays (rows). Cada linha entrega:
//   [0]=A Rota, [7]=H Data Embarque, [8]=I Cidade, [9]=J UF, [10]=K Região, [27]=AB Data Agendamento
// Retorna array de { rota, embarque, cidade, uf, regiao, agendamento }.
function parseLinhasLeadTime(rows) {
    const out = [];
    let rotaAtual = null;
    let embarqueAtual = null;
    for (const row of (rows || [])) {
        if (!row) continue;
        const rotaCell = (row[0] || '').toString().trim();
        const embarqueCell = normalizarData(row[7]);
        if (rotaCell) {
            rotaAtual = rotaCell;
            embarqueAtual = embarqueCell; // pode vir vazio na 1a linha; será null
        } else if (embarqueCell) {
            // Linha sem rota mas com embarque preenchido: atualiza só o embarque
            embarqueAtual = embarqueCell;
        }
        const cidade = (row[8] || '').toString().trim();
        const uf = (row[9] || '').toString().trim().toUpperCase();
        const regiaoRaw = (row[10] || '').toString().trim();
        const agendamento = normalizarData(row[27]);

        // Descarta linhas sem dados úteis
        if (!rotaAtual || !uf || !agendamento) continue;
        const regiao = normalizarRegiao(regiaoRaw) || regiaoDeUF(uf);
        out.push({
            rota: rotaAtual,
            embarque: embarqueAtual,
            cidade,
            uf,
            regiao,
            regiaoNome: nomeDeRegiao(regiao),
            agendamento,
        });
    }
    return out;
}

// Classifica uma entrega já parseada vs leads padrão.
// mapUF: { 'SP': 5, 'BA': 2, ... } (lead Transnet PE→UF destino).
// mapRegiao: { 'NE': 8, 'SE': 10, ... } (lead Tramontina por região).
function classificarEntrega(entrega, mapUF, mapRegiao) {
    const { embarque, agendamento, uf, regiao } = entrega;
    const diasUteis = embarque && agendamento ? calcularDiasUteis(embarque, agendamento) : null;
    const leadTransnet = mapUF[uf] ?? null;
    const leadTramontina = regiao ? (mapRegiao[regiao] ?? LEAD_PADRAO_TRAMONTINA_REGIAO[regiao] ?? null) : null;
    return {
        ...entrega,
        diasUteis,
        leadPadraoTransnet: leadTransnet,
        leadPadraoTramontina: leadTramontina,
        classTransnet: classificarLeadTime(diasUteis, leadTransnet),
        classTramontina: classificarLeadTime(diasUteis, leadTramontina),
    };
}

// Inicializa um agregador { antecipado, dentro, fora, aguardando, total, somaDias }
function novoAgregador() {
    return { antecipado: 0, dentro: 0, fora: 0, aguardando: 0, total: 0, somaDias: 0 };
}

function acumular(agg, classe, diasUteis) {
    agg.total += 1;
    if (classe === 'ANTECIPADO') agg.antecipado += 1;
    else if (classe === 'DENTRO') agg.dentro += 1;
    else if (classe === 'FORA') agg.fora += 1;
    else agg.aguardando += 1;
    if (typeof diasUteis === 'number') agg.somaDias += diasUteis;
}

function finalizarAgg(agg) {
    const computados = agg.antecipado + agg.dentro + agg.fora;
    return {
        antecipado: agg.antecipado,
        dentro: agg.dentro,
        fora: agg.fora,
        aguardando: agg.aguardando,
        total: agg.total,
        mediaDias: computados > 0 ? Number((agg.somaDias / computados).toFixed(2)) : null,
    };
}

// Agrega entregas já classificadas em totais Transnet/Tramontina, porUF e porRegiao.
function agregarLeadTime(entregasClassificadas) {
    const totaisT = novoAgregador();
    const totaisM = novoAgregador();
    const porUF = {};
    const porRegiao = {};

    for (const e of entregasClassificadas) {
        acumular(totaisT, e.classTransnet, e.diasUteis);
        acumular(totaisM, e.classTramontina, e.diasUteis);

        if (e.uf) {
            if (!porUF[e.uf]) porUF[e.uf] = novoAgregador();
            // Por convenção usamos a classificação Transnet para o agregado por UF
            acumular(porUF[e.uf], e.classTransnet, e.diasUteis);
        }
        if (e.regiao) {
            if (!porRegiao[e.regiao]) porRegiao[e.regiao] = novoAgregador();
            // Por convenção usamos a classificação Tramontina para o agregado por região
            acumular(porRegiao[e.regiao], e.classTramontina, e.diasUteis);
        }
    }

    return {
        transnet: finalizarAgg(totaisT),
        tramontina: finalizarAgg(totaisM),
        porUF: Object.fromEntries(Object.entries(porUF).map(([k, v]) => [k, finalizarAgg(v)])),
        porRegiao: Object.fromEntries(
            Object.entries(porRegiao).map(([k, v]) => [k, { ...finalizarAgg(v), regiaoNome: nomeDeRegiao(k) }])
        ),
    };
}

module.exports = {
    normalizarData,
    parseLinhasLeadTime,
    classificarEntrega,
    agregarLeadTime,
};
