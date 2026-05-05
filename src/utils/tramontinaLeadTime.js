// Helpers de lead time para o módulo Planejamento Tramontina
// Calcula dias úteis entre embarque e entrega ao cliente, e classifica
// vs. o padrão da rota (PE → UF destino).

const REGIOES_BR = {
    AC:'N',  AP:'N',  AM:'N',  PA:'N',  RO:'N',  RR:'N',  TO:'N',
    AL:'NE', BA:'NE', CE:'NE', MA:'NE', PB:'NE', PE:'NE', PI:'NE', RN:'NE', SE:'NE',
    DF:'CO', GO:'CO', MT:'CO', MS:'CO',
    ES:'SE', MG:'SE', RJ:'SE', SP:'SE',
    PR:'S',  RS:'S',  SC:'S',
};

function parseData(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const s = String(d).slice(0, 10);
    const [y, m, dia] = s.split('-').map(Number);
    if (!y || !m || !dia) return null;
    return new Date(Date.UTC(y, m - 1, dia));
}

// Conta dias úteis (seg-sex) inclusivos entre duas datas. Se inverso, retorna negativo.
function calcularDiasUteis(dataInicio, dataFim) {
    const di = parseData(dataInicio);
    const df = parseData(dataFim);
    if (!di || !df) return null;
    const sinal = df < di ? -1 : 1;
    const a = sinal === 1 ? di : df;
    const b = sinal === 1 ? df : di;
    let count = 0;
    const cursor = new Date(a);
    while (cursor <= b) {
        const dow = cursor.getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    // exclui o próprio dia de início — convenção: dia útil entre = entre as duas datas
    return sinal * Math.max(0, count - 1);
}

// Classifica o lead time: ANTECIPADO se entrega chegou ANTES do prazo padrão,
// DENTRO se chegou no prazo, FORA se atrasou. AGUARDANDO quando faltam dados.
function classificarLeadTime(diasUteis, leadPadrao) {
    if (diasUteis === null || diasUteis === undefined) return 'AGUARDANDO';
    if (leadPadrao === null || leadPadrao === undefined) return 'AGUARDANDO';
    if (diasUteis < leadPadrao) return 'ANTECIPADO';
    if (diasUteis === leadPadrao) return 'DENTRO';
    return 'FORA';
}

function regiaoDeUF(uf) {
    if (!uf) return null;
    return REGIOES_BR[String(uf).toUpperCase()] || null;
}

module.exports = {
    calcularDiasUteis,
    classificarLeadTime,
    regiaoDeUF,
    REGIOES_BR,
};
