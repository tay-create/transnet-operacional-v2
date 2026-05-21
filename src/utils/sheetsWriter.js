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
        .split(/[\s,/|]+/)
        .map(s => s.trim().replace(/^(PLAS|PORC|ELET):\s*/i, '').replace(/^0+/, ''))
        .filter(Boolean);
}

function hojeBR() {
    // Retorna DD/MM/AAAA no fuso de São Paulo
    return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function dataIsoParaBR(iso) {
    // 'YYYY-MM-DD' → 'DD/MM/YYYY'. Retorna null se entrada inválida.
    if (!iso || typeof iso !== 'string') return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
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
        range: `'DELTA-PORCELANA'!A9:H730`,
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
 * na planilha mas com Col E vazia, escreve a coleta na primeira linha da rota e a data
 * prevista (DD/MM/YYYY) em col G de todas as linhas até a próxima rota.
 *
 * - Só roda na aba DELTA-PORCELANA por enquanto.
 * - Quando há múltiplas coletas no card (consolidado P+P), junta com " / " na mesma célula.
 * - Se col E já tem coleta diferente:
 *   - Modo padrão (naoConcatenar:false): concatena as faltantes e gera aviso.
 *   - Modo estrito (naoConcatenar:true): NÃO escreve, só gera aviso com motivo='rota-ja-tem-coleta-diferente'.
 *
 * pares: [{ rota: '42', coletas: ['1426', '1427'], dataPrevista: '2026-05-21', naoConcatenar?: false }]
 *   - aceita também body antigo { rota, coleta } pra compatibilidade.
 * Retorna: { inseridas: [range...], avisos: [{rota, linha, coleta_planilha, coletas_lancadas, motivo?}] }
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

    // Lê a aba inteira pra ter col A (rota), E (coleta) e descobrir os limites de cada rota
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'DELTA-PORCELANA'!A10:G730`,
    });
    const rows = resp.data.values || [];

    const updates = [];
    const avisos = [];

    // Normaliza pra estrutura única
    const paresNorm = pares.map(p => {
        const rota = String(p.rota || '').trim();
        let coletas = [];
        if (Array.isArray(p.coletas)) {
            coletas = p.coletas.map(c => String(c || '').trim().replace(/^0+/, '')).filter(Boolean);
        } else if (p.coleta) {
            // compat com body antigo
            coletas = [String(p.coleta).trim().replace(/^0+/, '')].filter(Boolean);
        }
        const dataPrevista = dataIsoParaBR(p.dataPrevista);
        const naoConcatenar = p.naoConcatenar === true;
        return { rota, coletas, dataPrevista, naoConcatenar };
    }).filter(p => p.rota && p.coletas.length > 0);

    for (const par of paresNorm) {
        // Acha índice da rota
        const idxLinha = rows.findIndex(r => String(r[0] || '').trim() === par.rota);
        if (idxLinha === -1) continue; // rota não existe — silencioso

        const linhaPrimeira = idxLinha + 10;
        const coletaExistente = String(rows[idxLinha][4] || '').trim();
        const valorNovoColetas = par.coletas.join(' / ');

        if (!coletaExistente) {
            updates.push({ range: `'DELTA-PORCELANA'!E${linhaPrimeira}`, values: [[valorNovoColetas]] });
        } else {
            const numsExistentes = extrairNums(coletaExistente);
            const faltantes = par.coletas.filter(n => !numsExistentes.includes(n));
            if (faltantes.length === 0) {
                // Tudo já presente — nada a fazer, sem aviso.
            } else if (par.naoConcatenar) {
                // Modo estrito: não sobrescrever, só avisar.
                avisos.push({
                    rota: par.rota,
                    linha: linhaPrimeira,
                    coleta_planilha: coletaExistente,
                    coletas_lancadas: par.coletas,
                    motivo: 'rota-ja-tem-coleta-diferente',
                });
            } else if (numsExistentes.length === 0) {
                // Improvável: existente parsing zerou. Sobrescreve.
                updates.push({ range: `'DELTA-PORCELANA'!E${linhaPrimeira}`, values: [[valorNovoColetas]] });
            } else {
                // Concatena faltantes com o que já tem (separador " / ")
                const novoValor = [...numsExistentes, ...faltantes].join(' / ');
                updates.push({ range: `'DELTA-PORCELANA'!E${linhaPrimeira}`, values: [[novoValor]] });
                avisos.push({
                    rota: par.rota,
                    linha: linhaPrimeira,
                    coleta_planilha: coletaExistente,
                    coletas_lancadas: par.coletas,
                });
            }
        }

        // Escreve col G (DATA PREVISÃO) em todas as linhas da rota até a próxima rota
        if (par.dataPrevista) {
            let i = idxLinha;
            while (i < rows.length) {
                if (i > idxLinha) {
                    const a = String(rows[i][0] || '').trim();
                    if (a && /^\d+$/.test(a)) break; // próxima rota
                }
                const linha = i + 10;
                const colGAtual = String(rows[i][6] || '').trim();
                if (colGAtual !== par.dataPrevista) {
                    updates.push({ range: `'DELTA-PORCELANA'!G${linha}`, values: [[par.dataPrevista]] });
                }
                i++;
                // Limita a 50 linhas por segurança (rotas têm tipicamente 2-10 destinos)
                if (i - idxLinha > 50) break;
            }
        }
    }

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

/**
 * Escreve o nome do motorista na col AE (idx 30) da linha-cabeçalho de cada rota
 * onde a coleta bate. Se já houver motorista diferente, sobrescreve e devolve aviso.
 *
 * pares: [{ rota: '42', coleta: '9999', motorista: 'JOSE ...' }]
 * Retorna: { escritas: [range...], substituicoes: [{rota, linha, motorista_anterior, motorista_novo}] }
 */
async function escreverMotoristaNaPlanilha(pares) {
    if (!Array.isArray(pares) || pares.length === 0) return { escritas: [], substituicoes: [] };
    if (!_getResultadoSheetIdRef) {
        console.warn('[sheetsWriter] getResultadoSheetId não injetado; pulando escreverMotorista');
        return { escritas: [], substituicoes: [] };
    }
    const { sheetId } = await _getResultadoSheetIdRef();
    if (!sheetId) return { escritas: [], substituicoes: [] };

    const sheets = google.sheets({ version: 'v4', auth: authSheets() });

    // Range A10:AE730 — pega rota, coleta e motorista
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'DELTA-PORCELANA'!A10:AE730`,
    });
    const rows = resp.data.values || [];

    const updates = [];
    const substituicoes = [];

    for (const par of pares) {
        const rota = String(par.rota || '').trim();
        const coleta = String(par.coleta || '').trim().replace(/^(PLAS|PORC|ELET):\s*/i, '').replace(/^0+/, '');
        const motoristaNovo = String(par.motorista || '').trim();
        if (!rota || !coleta || !motoristaNovo) continue;

        // Acha linha-cabeçalho da rota
        const idxLinha = rows.findIndex(r => String(r[0] || '').trim() === rota);
        if (idxLinha === -1) continue;

        // Confirma que a coleta dessa rota inclui a coleta passada (segurança)
        const colE = rows[idxLinha][4] || '';
        const numsExistentes = extrairNums(colE);
        if (numsExistentes.length > 0 && !numsExistentes.includes(coleta)) {
            // Coleta lançada diverge da planilha; ainda assim escreve o motorista
            // (a discrepância de coleta vai ter sido tratada em outro caller).
        }

        const linha = idxLinha + 10;
        // AE é o índice 30. rows tem A..AE (idx 0..30).
        const motoristaAtual = String(rows[idxLinha][30] || '').trim();
        if (motoristaAtual === motoristaNovo) continue; // idempotente

        updates.push({ range: `'DELTA-PORCELANA'!AE${linha}`, values: [[motoristaNovo]] });
        if (motoristaAtual && motoristaAtual.toLowerCase() !== motoristaNovo.toLowerCase()) {
            substituicoes.push({
                rota,
                linha,
                motorista_anterior: motoristaAtual,
                motorista_novo: motoristaNovo,
            });
        }
    }

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { valueInputOption: 'RAW', data: updates },
        });
    }

    return {
        escritas: updates.map(u => u.range),
        substituicoes,
    };
}

module.exports = {
    setGetResultadoSheetId,
    marcarEmbarcadoNaPlanilha,
    inserirColetaNaRotaSeVazia,
    escreverMotoristaNaPlanilha,
    extrairNums,        // exportado pra testes
    dataIsoParaBR,      // exportado pra testes
};
