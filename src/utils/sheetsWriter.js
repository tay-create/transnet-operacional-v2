// Automações de escrita na planilha "Operação - (Mes/Ano)".
// Mantém coerência rota↔coleta e marca Embarcado quando o card transita pra LIBERADO P/ CT-e.
// Padrão segue o de `marcar-programadas` em server.js (mesma auth, mesma planilha).

const path = require('path');
const { google } = require('googleapis');

let _getResultadoSheetIdRef = null;

// Injetado uma vez por server.js no boot (evita require circular).
function setGetResultadoSheetId(fn) {
    _getResultadoSheetIdRef = fn;
}

function authSheets() {
    return new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '..', 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

function extrairNums(str) {
    return String(str || '')
        .split(/[\s,]+/)
        .map(s => s.trim().replace(/^0+/, ''))
        .filter(Boolean);
}

function hojeBR() {
    // Retorna DD/MM/AAAA no fuso de São Paulo
    return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Marca "x" na Col D (Embarcado) e data DD/MM/AAAA na Col H (DATA DE EMBARQUE)
 * da linha-cabeçalho da rota onde Col E (COLETA) contém alguma das coletas passadas.
 *
 * - Só roda na aba DELTA-PORCELANA (ELETRIK tem estrutura diferente).
 * - Idempotente: se Col D já tem "x", pula a linha.
 * - Só marca linha-cabeçalho (Col A com número puro).
 */
async function marcarEmbarcadoNaPlanilha(coletas) {
    if (!Array.isArray(coletas) || coletas.length === 0) return { marcadas: 0, detalhes: [] };
    if (!_getResultadoSheetIdRef) {
        console.warn('[sheetsWriter] getResultadoSheetId não injetado; pulando marcarEmbarcado');
        return { marcadas: 0, detalhes: [] };
    }
    const { sheetId } = await _getResultadoSheetIdRef();
    if (!sheetId) return { marcadas: 0, detalhes: [] };

    const sheets = google.sheets({ version: 'v4', auth: authSheets() });

    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'DELTA-PORCELANA'!A9:H670`,
    });
    const rows = resp.data.values || [];
    const setColetas = new Set(coletas.map(c => String(c).trim().replace(/^0+/, '')));

    const data = hojeBR();
    const updates = [];

    rows.forEach((row, idx) => {
        if (idx === 0) return; // header L9
        const colA = String(row[0] || '').trim();
        const colD = String(row[3] || '').trim().toLowerCase();
        const colE = row[4] || '';
        if (!colA || !/^\d+$/.test(colA)) return; // só linha-cabeçalho da rota
        if (colD === 'x') return;                  // idempotente
        const nums = extrairNums(colE);
        if (!nums.some(n => setColetas.has(n))) return;
        const linha = idx + 9;
        updates.push({ range: `'DELTA-PORCELANA'!D${linha}`, values: [['x']] });
        updates.push({ range: `'DELTA-PORCELANA'!H${linha}`, values: [[data]] });
    });

    if (updates.length === 0) return { marcadas: 0, detalhes: [] };

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: 'RAW', data: updates },
    });

    return {
        marcadas: updates.length / 2,
        detalhes: updates.filter(u => u.range.includes('!D')).map(u => u.range),
    };
}

/**
 * Quando uma coleta é lançada com rotaRecife/rotaMoreno apontando pra uma rota cadastrada
 * na planilha mas com Col E vazia, escreve a coleta. Se já tem outra coleta diferente, avisa.
 *
 * pares: [{ rota: '42', coleta: '9999' }]
 * Retorna: { inseridas: [range...], avisos: [{aba, rota, linha, coleta_planilha, coleta_lancada}] }
 */
async function inserirColetaNaRotaSeVazia(pares) {
    if (!Array.isArray(pares) || pares.length === 0) return { inseridas: [], avisos: [] };
    if (!_getResultadoSheetIdRef) {
        console.warn('[sheetsWriter] getResultadoSheetId não injetado; pulando inserirColeta');
        return { inseridas: [], avisos: [] };
    }
    const { sheetId } = await _getResultadoSheetIdRef();
    if (!sheetId) return { inseridas: [], avisos: [] };

    const sheets = google.sheets({ version: 'v4', auth: authSheets() });

    // Lê DELTA + ELETRIK em paralelo
    const [respDP, respEL] = await Promise.all([
        sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'DELTA-PORCELANA'!A10:E670`,
        }).catch(e => { console.warn('[inserirColeta] falha DELTA:', e.message); return { data: { values: [] } }; }),
        sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'ELETRIK'!A11:C500`,
        }).catch(e => { console.warn('[inserirColeta] falha ELETRIK:', e.message); return { data: { values: [] } }; }),
    ]);

    const updates = [];
    const avisos = [];

    function processarAba(rows, abaNome, idxColeta, colColeta, offsetLinha) {
        for (const par of pares) {
            const rotaAlvo = String(par.rota || '').trim();
            const coletaNova = String(par.coleta || '').trim().replace(/^0+/, '');
            if (!rotaAlvo || !coletaNova) continue;
            const idxLinha = rows.findIndex(r => String(r[0] || '').trim() === rotaAlvo);
            if (idxLinha === -1) continue; // rota não existe na planilha — silencioso
            const coletaExistente = String(rows[idxLinha][idxColeta] || '').trim();
            const linha = idxLinha + offsetLinha;
            if (!coletaExistente) {
                updates.push({ range: `'${abaNome}'!${colColeta}${linha}`, values: [[coletaNova]] });
            } else {
                const numsExistentes = extrairNums(coletaExistente);
                if (!numsExistentes.includes(coletaNova)) {
                    avisos.push({
                        aba: abaNome,
                        rota: rotaAlvo,
                        linha,
                        coleta_planilha: coletaExistente,
                        coleta_lancada: coletaNova,
                    });
                }
            }
        }
    }

    processarAba(respDP.data.values || [], 'DELTA-PORCELANA', 4, 'E', 10);
    processarAba(respEL.data.values || [], 'ELETRIK',         2, 'C', 11);

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { valueInputOption: 'RAW', data: updates },
        });
    }

    return {
        inseridas: updates.map(u => u.range),
        avisos,
    };
}

module.exports = {
    setGetResultadoSheetId,
    marcarEmbarcadoNaPlanilha,
    inserirColetaNaRotaSeVazia,
};
