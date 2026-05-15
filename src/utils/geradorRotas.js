// Gerador de Rotas — busca rota e destinos de uma coleta na planilha DELTA-PORCELANA.
// Faz forward-fill da Col A (Rota) e Col E (Coleta), retornando todas as cidades/UF
// da mesma coleta na ordem em que aparecem na planilha.
//
// Cache em memória de 60s para evitar reler a planilha em cada importação em lote.

const path = require('path');
const { google } = require('googleapis');

let _cache = { rows: null, sheetId: null, ts: 0 };
const TTL_MS = 60 * 1000;

function normalizarColeta(s) {
    return String(s ?? '').trim().replace(/^0+/, '');
}

function normalizarCidadeUf(cidade, uf) {
    const c = String(cidade ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();
    const u = String(uf ?? '').trim().toUpperCase();
    return `${c}/${u}`;
}

async function lerPlanilha(sheetId) {
    const now = Date.now();
    if (_cache.rows && _cache.sheetId === sheetId && (now - _cache.ts) < TTL_MS) {
        return _cache.rows;
    }
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '..', 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'DELTA-PORCELANA'!A10:K1000`,
    });
    const rows = resp.data.values || [];
    _cache = { rows, sheetId, ts: now };
    return rows;
}

function invalidarCache() {
    _cache = { rows: null, sheetId: null, ts: 0 };
}

// UF brasileira válida (2 letras maiúsculas dentro da lista oficial).
const UFS_VALIDAS = new Set([
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]);

// Rota válida na DELTA-PORCELANA = número puro (ex: "110", "169").
// Tudo o que não bate (REGIÕES, NORDESTE, PORCELANA 100%, FALTA EMBARCAR, P.L, etc) é metadado.
function ehRotaValida(s) {
    return /^\d+$/.test(String(s || '').trim());
}

// Faz forward-fill de Rota (A) e Coleta (E) e retorna mapa coleta → { rota, destinos[] }.
// Para no primeiro Col A que não for rota numérica (sinal de fim dos dados, início de tabelas auxiliares).
function indexarPlanilha(rows) {
    const map = new Map();
    let rotaAtual = null;
    let coletaAtual = null;
    for (const row of rows) {
        if (!row) continue;
        const a = (row[0] ?? '').toString().trim();
        const e = (row[4] ?? '').toString().trim();
        const cidade = (row[8] ?? '').toString().trim();
        const uf = (row[9] ?? '').toString().trim().toUpperCase();

        // Se aparece um Col A não-numérico, é metadado/agregação → para o parse.
        if (a && !ehRotaValida(a)) break;

        // Nova rota: atualiza rotaAtual E reseta coletaAtual (forward-fill da coleta
        // não pode atravessar fronteira de rota).
        if (a) {
            rotaAtual = a;
            coletaAtual = null;
        }
        if (e) coletaAtual = normalizarColeta(e);

        // Pula linhas sem rota, sem coleta, ou sem destino válido.
        if (!rotaAtual || !coletaAtual) continue;
        if (!cidade || !UFS_VALIDAS.has(uf)) continue;

        if (!map.has(coletaAtual)) {
            map.set(coletaAtual, { rota: rotaAtual, destinos: [] });
        }
        map.get(coletaAtual).destinos.push({ cidade, uf, chave: normalizarCidadeUf(cidade, uf) });
    }
    return map;
}

// Busca uma coleta na planilha. Retorna { rota, destinos: [{cidade, uf, chave}, ...] }
// ou null se a coleta não foi encontrada.
async function buscarRotaPorColeta(coleta, sheetId) {
    if (!coleta) return null;
    const rows = await lerPlanilha(sheetId);
    const idx = indexarPlanilha(rows);
    return idx.get(normalizarColeta(coleta)) || null;
}

// Determina origem da rota a partir da operação do card.
// Regra (decidida com usuário): origem fixa pela operação, sem parada intermediária no consolidado misto.
//   - Recife puro / Consolidado RC+MO → RECIFE/PE
//   - Moreno puro / Consolidado MO+MO → MORENO/PE
function determinarOrigem(operacao) {
    const op = String(operacao || '').toUpperCase();
    if (op.includes('RECIFE')) return 'RECIFE/PE'; // recife puro OU consolidado RC+MO
    // Demais casos (moreno puro, MO+MO, eletrik, porcelana, etc): origem Moreno
    return 'MORENO/PE';
}

// Mesmo conjunto de destinos (ignora ordem) — usado em reimportação para evitar
// chamadas desnecessárias ao OSM quando a coleta não mudou.
function mesmoConjuntoDestinos(destinosA, destinosB) {
    if (!Array.isArray(destinosA) || !Array.isArray(destinosB)) return false;
    if (destinosA.length !== destinosB.length) return false;
    const setA = new Set(destinosA.map(d => normalizarCidadeUf(d.cidade, d.uf)));
    const setB = new Set(destinosB.map(d => normalizarCidadeUf(d.cidade, d.uf)));
    if (setA.size !== setB.size) return false;
    for (const k of setA) if (!setB.has(k)) return false;
    return true;
}

// Pipeline completo: dada uma coleta + operação, retorna { rota, destinos_json, origem_rota }
// pronto para gravar em veiculos. Em caso de falha, retorna campos null + flag erro.
// destinosAtuais (opcional) = destinos já gravados antes (reimportação) — se idênticos, evita chamadas OSM.
async function gerarRota({ coleta, operacao, sheetId, destinosAtuais }) {
    if (!coleta) return { rota: null, destinos_json: null, origem_rota: null, aviso: 'sem-coleta' };

    let dadosPlanilha;
    try {
        dadosPlanilha = await buscarRotaPorColeta(coleta, sheetId);
    } catch (err) {
        console.error('[gerarRota] erro lendo planilha:', err.message);
        return { rota: null, destinos_json: null, origem_rota: null, aviso: 'erro-planilha' };
    }
    if (!dadosPlanilha || !Array.isArray(dadosPlanilha.destinos) || dadosPlanilha.destinos.length === 0) {
        return { rota: null, destinos_json: null, origem_rota: null, aviso: 'coleta-nao-encontrada' };
    }

    const origem_rota = determinarOrigem(operacao);
    const { rota, destinos } = dadosPlanilha;

    // Reaproveitamento: se destinos atuais batem com os novos, mantém a ordem que já existia.
    if (destinosAtuais && mesmoConjuntoDestinos(destinosAtuais, destinos)) {
        console.log(`[gerarRota] coleta ${coleta}: destinos iguais aos atuais, mantendo ordem existente`);
        return { rota, destinos_json: JSON.stringify(destinosAtuais), origem_rota, aviso: null };
    }

    // Geocoda origem + destinos
    const { geocode, tableMatrix } = require('./osmClient');
    let origemGeo;
    const destinosGeo = [];
    try {
        // Origem: cidade/uf vem da chave "RECIFE/PE" ou "MORENO/PE"
        const [origCidade, origUf] = origem_rota.split('/');
        origemGeo = await geocode(origCidade, origUf);
        for (const d of destinos) {
            destinosGeo.push(await geocode(d.cidade, d.uf));
        }
    } catch (err) {
        console.error('[gerarRota] erro geocoding:', err.message);
        return { rota, destinos_json: null, origem_rota, aviso: 'erro-geocoding' };
    }

    // Matriz OSRM + ordenação por vizinho mais próximo
    let matriz;
    try {
        matriz = await tableMatrix([origemGeo, ...destinosGeo]);
    } catch (err) {
        console.error('[gerarRota] erro OSRM:', err.message);
        return { rota, destinos_json: null, origem_rota, aviso: 'erro-osrm' };
    }

    const { nearestNeighbor } = require('./roteirizador');
    const ordenados = nearestNeighbor([origemGeo, ...destinosGeo], matriz);

    return { rota, destinos_json: JSON.stringify(ordenados), origem_rota, aviso: null };
}

module.exports = {
    buscarRotaPorColeta,
    normalizarCidadeUf,
    normalizarColeta,
    invalidarCache,
    determinarOrigem,
    mesmoConjuntoDestinos,
    gerarRota,
};
