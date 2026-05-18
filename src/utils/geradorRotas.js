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

// Algumas células da Col E têm MÚLTIPLAS coletas separadas por espaços, tabs ou quebras
// de linha (ex: "1216                   1304" ou "1339\t1340"). Retorna array de números
// já normalizados (sem zeros à esquerda, sem espaços).
function extrairColetasDaCelula(s) {
    const raw = String(s ?? '').trim();
    if (!raw) return [];
    return raw
        .split(/[\s,;|]+/)
        .map(t => t.replace(/^0+/, '').trim())
        .filter(t => /^\d+$/.test(t));
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

// Configuração das abas suportadas. Cada aba mapeia as colunas dos dados.
// Indexes 0-based (A=0, B=1, ...).
const ABAS_CONFIG = [
    {
        nome: 'DELTA-PORCELANA',
        range: "'DELTA-PORCELANA'!A10:AC1000", // dados começam em L10 (header em L9)
        colRota: 0,        // A
        colColeta: 4,      // E
        colCidade: 8,      // I
        colUf: 9,          // J
        colData: 28,       // AC
    },
    {
        nome: 'ELETRIK',
        range: "'ELETRIK'!A11:O1000",          // header em L10, dados começam em L11
        colRota: 0,        // A
        colColeta: 2,      // C
        colCidade: 5,      // F
        colUf: 6,          // G
        colData: 12,       // M
    },
];

// Lê todas as abas configuradas e devolve linhas NORMALIZADAS:
//   [{ rotaRaw, coletaRaw, cidade, uf, dataRaw, fonte, rowIdx }, ...]
// onde rotaRaw e coletaRaw podem estar vazias quando o forward-fill é necessário.
// A normalização aqui é só ESTRUTURAL — semântica (forward-fill, extrair múltiplas
// coletas, validar UF, parar em metadados) fica nas funções consumidoras.
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

    const todasLinhas = [];
    for (const cfg of ABAS_CONFIG) {
        try {
            const resp = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: cfg.range,
            });
            const rows = resp.data.values || [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i] || [];
                todasLinhas.push({
                    rotaRaw: (row[cfg.colRota] ?? '').toString().trim(),
                    coletaRaw: (row[cfg.colColeta] ?? '').toString().trim(),
                    cidade: (row[cfg.colCidade] ?? '').toString().trim(),
                    uf: (row[cfg.colUf] ?? '').toString().trim().toUpperCase(),
                    dataRaw: row[cfg.colData],
                    fonte: cfg.nome,
                    rowIdx: i,
                });
            }
            // Separador entre abas — força reset de forward-fill no parser
            // (rota e coleta vazias + cidade/uf vazias → linha ignorada).
            todasLinhas.push({ rotaRaw: '__SEPARADOR__', coletaRaw: '', cidade: '', uf: '', dataRaw: '', fonte: '__SEP__', rowIdx: -1 });
        } catch (e) {
            console.warn(`[lerPlanilha] falha ao ler aba ${cfg.nome}:`, e.message);
        }
    }
    _cache = { rows: todasLinhas, sheetId, ts: now };
    return todasLinhas;
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

// Faz forward-fill de Rota e Coleta dentro de cada aba e retorna mapa coleta → { rota, destinos[], fonte }.
// Itera as linhas NORMALIZADAS (já mapeadas em rotaRaw/coletaRaw/cidade/uf por lerPlanilha).
// O separador `__SEPARADOR__` reseta o estado entre abas. Em cada aba, para de processar
// na primeira linha cujo Col A não é número (= metadado/agregação no fim dos dados).
function indexarPlanilha(rows) {
    const map = new Map();
    let rotaAtual = null;
    let coletasAtuais = [];
    let abaAtual = null;
    let abaPausada = false; // true após encontrar metadado, ignora resto até próximo separador
    for (const row of rows) {
        if (!row) continue;

        // Separador entre abas: reseta tudo
        if (row.rotaRaw === '__SEPARADOR__') {
            rotaAtual = null;
            coletasAtuais = [];
            abaAtual = null;
            abaPausada = false;
            continue;
        }

        // Detecta troca de aba (primeira linha de aba nova)
        if (row.fonte !== abaAtual) {
            abaAtual = row.fonte;
            rotaAtual = null;
            coletasAtuais = [];
            abaPausada = false;
        }

        if (abaPausada) continue;

        const a = row.rotaRaw;
        const e = row.coletaRaw;
        const cidade = row.cidade;
        const uf = row.uf;

        // Se aparece um Col A não-numérico, é metadado/agregação → pausa a aba atual.
        if (a && !ehRotaValida(a)) { abaPausada = true; continue; }

        // Nova rota: atualiza rotaAtual E reseta coletas (forward-fill não atravessa fronteira).
        if (a) {
            rotaAtual = a;
            coletasAtuais = [];
        }
        if (e) {
            const lista = extrairColetasDaCelula(e);
            if (lista.length > 0) coletasAtuais = lista;
        }

        // Pula linhas sem rota, sem coletas, ou sem destino válido.
        if (!rotaAtual || coletasAtuais.length === 0) continue;
        if (!cidade || !UFS_VALIDAS.has(uf)) continue;

        const chave = normalizarCidadeUf(cidade, uf);
        // Registra destino em CADA coleta da célula (múltiplas coletas compartilham a rota).
        for (const col of coletasAtuais) {
            if (!map.has(col)) {
                map.set(col, { rota: rotaAtual, destinos: [], fonte: abaAtual, _chavesVistas: new Set(), _rotasDistintas: new Set([rotaAtual]) });
            } else {
                // Se a mesma coleta já existia com OUTRA rota, é erro de digitação na planilha.
                const grupo = map.get(col);
                grupo._rotasDistintas.add(rotaAtual);
            }
            const grupo = map.get(col);
            // Dedup por cidade/uf dentro do grupo.
            if (!grupo._chavesVistas.has(chave)) {
                grupo._chavesVistas.add(chave);
                grupo.destinos.push({ cidade, uf, chave });
            }
        }
    }
    // Limpa helpers e marca coletas duplicadas em rotas distintas.
    for (const [k, v] of map.entries()) {
        if (v._rotasDistintas && v._rotasDistintas.size > 1) {
            v.duplicadaEmRotas = Array.from(v._rotasDistintas);
        }
        delete v._chavesVistas;
        delete v._rotasDistintas;
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
//   - ELETRIK SUL → CD Carlos Barbosa (CARLOS BARBOSA/RS)
//   - LEÃO - SP → MORENO/PE (sai de Moreno na operação Leão)
//   - Recife puro / Consolidado RC+MO → RECIFE/PE
//   - Moreno puro / Consolidado MO+MO / Porcelana / Eletrik → MORENO/PE
function determinarOrigem(operacao) {
    const op = String(operacao || '').toUpperCase().trim();
    if (op === 'ELETRIK SUL') return 'CARLOS BARBOSA/RS';
    if (op.includes('RECIFE')) return 'RECIFE/PE'; // recife puro OU consolidado RC+MO
    // Demais casos (moreno puro, MO+MO, eletrik, porcelana, leão-sp, etc): origem Moreno
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
    // Mesma coleta em mais de uma rota → erro de digitação na planilha. Não gera rota.
    if (Array.isArray(dadosPlanilha.duplicadaEmRotas) && dadosPlanilha.duplicadaEmRotas.length > 1) {
        return {
            rota: null,
            destinos_json: null,
            origem_rota: null,
            aviso: 'coleta-duplicada-em-rotas',
            rotas_duplicadas: dadosPlanilha.duplicadaEmRotas,
        };
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

// Busca entregas agendadas de uma coleta na planilha. Diferente de buscarRotaPorColeta
// (que deduplica destinos para a roteirização), aqui mantemos cada (cidade, data) — pois
// duas entregas no mesmo destino em datas diferentes são marcadas em datas diferentes.
//
// Retorna { encontrada, rota, entregas: [{ cidade, uf, data: 'YYYY-MM-DD' }, ...] }
// — entregas ordenadas por data ascendente.
async function buscarEntregasAgendadasPorColeta(coleta, sheetId) {
    if (!coleta) return { encontrada: false, entregas: [] };
    const { normalizarData } = require('./leadTimeOperacional');
    const rows = await lerPlanilha(sheetId);
    const alvo = normalizarColeta(coleta);
    let rotaAtual = null;
    let coletasAtuais = [];
    let rotaDaColeta = null;
    const rotasOndeAlvoApareceu = new Set();
    const entregas = [];
    const dedup = new Set();
    let abaAtual = null;
    let abaPausada = false;
    for (const row of rows) {
        if (!row) continue;

        // Separador entre abas: reseta forward-fill
        if (row.rotaRaw === '__SEPARADOR__') {
            rotaAtual = null;
            coletasAtuais = [];
            abaAtual = null;
            abaPausada = false;
            continue;
        }

        // Troca de aba
        if (row.fonte !== abaAtual) {
            abaAtual = row.fonte;
            rotaAtual = null;
            coletasAtuais = [];
            abaPausada = false;
        }

        if (abaPausada) continue;

        const a = row.rotaRaw;
        // Pausa a aba ao encontrar metadado
        if (a && !/^\d+$/.test(a)) { abaPausada = true; continue; }
        if (a) {
            rotaAtual = a;
            coletasAtuais = [];
        }
        const e = row.coletaRaw;
        if (e) {
            const lista = extrairColetasDaCelula(e);
            if (lista.length > 0) coletasAtuais = lista;
        }
        // Filtra linhas que NÃO pertencem à coleta alvo
        if (!rotaAtual || !coletasAtuais.includes(alvo)) continue;
        rotasOndeAlvoApareceu.add(rotaAtual);

        const cidade = row.cidade;
        const uf = row.uf;
        const dataRaw = row.dataRaw;
        if (!cidade || !UFS_VALIDAS.has(uf)) continue;
        const data = normalizarData(dataRaw);
        if (!data) continue;

        const chave = `${cidade}|${uf}|${data}`;
        if (dedup.has(chave)) continue;
        dedup.add(chave);
        if (!rotaDaColeta) rotaDaColeta = rotaAtual;
        entregas.push({ cidade, uf, data });
    }
    // Coleta presente em rotas distintas = erro de digitação na planilha.
    if (rotasOndeAlvoApareceu.size > 1) {
        return {
            encontrada: false,
            duplicada_em_rotas: Array.from(rotasOndeAlvoApareceu),
            entregas: [],
        };
    }
    entregas.sort((a, b) => a.data.localeCompare(b.data));
    return {
        encontrada: entregas.length > 0,
        rota: rotaDaColeta,
        entregas,
    };
}

module.exports = {
    buscarRotaPorColeta,
    buscarEntregasAgendadasPorColeta,
    normalizarCidadeUf,
    normalizarColeta,
    extrairColetasDaCelula,
    invalidarCache,
    determinarOrigem,
    mesmoConjuntoDestinos,
    gerarRota,
};
