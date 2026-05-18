// Cliente para serviços públicos do OpenStreetMap:
//   - Nominatim (geocoding): rate limit 1 req/s, User-Agent obrigatório.
//   - OSRM (matriz de distâncias): sem rate limit declarado, mas usar com moderação.
// Cache permanente em Postgres (geo_cache, dist_cache) — depois dos primeiros meses
// as chamadas externas viram raras.

const { dbGet, db: pool } = require('../database/db');

const USER_AGENT = 'Transnet-Operacional/1.0 (contato@tnetlog.com.br)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_TABLE_URL = 'https://router.project-osrm.org/table/v1/driving';
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

// Throttle serial para Nominatim (regra de uso: 1 req/s).
let _nominatimLock = Promise.resolve();
function withNominatimThrottle(fn) {
    const result = _nominatimLock.then(async () => {
        try {
            return await fn();
        } finally {
            await new Promise(r => setTimeout(r, 1100));
        }
    });
    _nominatimLock = result.catch(() => {});
    return result;
}

// Fetch com retry exponencial (2 retries adicionais, 500ms + 1500ms).
// Mitiga oscilações do OSRM público (router.project-osrm.org) e Nominatim que
// ocasionalmente respondem com fetch failed / 502 / 503.
async function fetchComRetry(url, options = {}, label = 'fetch') {
    const tentativas = 3;
    let ultimoErro = null;
    for (let i = 0; i < tentativas; i++) {
        try {
            const resp = await fetch(url, options);
            // 5xx do servidor é retentável; 4xx é erro permanente, propaga.
            if (resp.status >= 500 && resp.status < 600 && i < tentativas - 1) {
                ultimoErro = new Error(`${label} HTTP ${resp.status}`);
                await new Promise(r => setTimeout(r, 500 + i * 1000));
                continue;
            }
            return resp;
        } catch (e) {
            ultimoErro = e;
            if (i < tentativas - 1) {
                await new Promise(r => setTimeout(r, 500 + i * 1000));
                continue;
            }
            throw ultimoErro;
        }
    }
    throw ultimoErro || new Error(`${label}: todas as tentativas falharam`);
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

// Geocoda cidade+UF via Nominatim. Resultado é cacheado pra sempre em geo_cache.
// Lança erro se Nominatim retornar HTTP != 200 ou não encontrar a cidade.
// Retorna { cidade, uf, cidade_uf, lat, lon, display_name } — cidade/uf preservados
// para que o frontend possa exibir "${d.cidade}/${d.uf}" sem perder informação.
async function geocode(cidade, uf) {
    const chave = normalizarCidadeUf(cidade, uf);
    const cidadeStr = String(cidade ?? '').trim();
    const ufStr = String(uf ?? '').trim().toUpperCase();
    const cached = await dbGet(`SELECT cidade_uf, lat, lon, display_name FROM geo_cache WHERE cidade_uf = $1`, [chave]);
    if (cached) {
        return {
            cidade: cidadeStr,
            uf: ufStr,
            cidade_uf: cached.cidade_uf,
            lat: Number(cached.lat),
            lon: Number(cached.lon),
            display_name: cached.display_name,
        };
    }

    const q = `${cidade}, ${uf}, Brazil`;
    const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '1',
        countrycodes: 'br',
    });
    const url = `${NOMINATIM_URL}?${params.toString()}`;

    const body = await withNominatimThrottle(async () => {
        const resp = await fetchComRetry(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, 'Nominatim');
        if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status} para "${q}"`);
        return resp.json();
    });

    if (!Array.isArray(body) || body.length === 0) {
        throw new Error(`Nominatim não encontrou "${q}"`);
    }

    const lat = Number(body[0].lat);
    const lon = Number(body[0].lon);
    const display = body[0].display_name || q;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(`Nominatim retornou coords inválidas para "${q}"`);
    }

    await pool.query(
        `INSERT INTO geo_cache (cidade_uf, lat, lon, display_name)
         VALUES ($1, $2, $3, $4) ON CONFLICT (cidade_uf) DO NOTHING`,
        [chave, lat, lon, display]
    );
    return {
        cidade: cidadeStr,
        uf: ufStr,
        cidade_uf: chave,
        lat,
        lon,
        display_name: display,
    };
}

// Matriz NxN entre todos os pares de pontos via OSRM /table.
// Aceita pontos: [{ cidade_uf, lat, lon }, ...] (origem na posição 0, destinos a seguir).
// Retorna matriz[i][j] = { distancia_metros, duracao_segundos }. matriz[i][i] = null.
// Usa cache em dist_cache: só chama OSRM se houver pelo menos 1 par ausente.
async function tableMatrix(pontos) {
    const n = pontos.length;
    if (n < 2) return Array(n).fill(null).map(() => Array(n).fill(null));

    const matriz = Array(n).fill(null).map(() => Array(n).fill(null));
    const pares = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            pares.push([i, j]);
        }
    }

    // 1) Tenta resolver tudo pelo cache.
    let faltam = 0;
    for (const [i, j] of pares) {
        const a = pontos[i].cidade_uf;
        const b = pontos[j].cidade_uf;
        const row = await dbGet(
            `SELECT distancia_metros, duracao_segundos FROM dist_cache WHERE origem_key = $1 AND destino_key = $2`,
            [a, b]
        );
        if (row) {
            matriz[i][j] = { distancia_metros: row.distancia_metros, duracao_segundos: row.duracao_segundos };
        } else {
            faltam++;
        }
    }

    if (faltam === 0) return matriz;

    // 2) Pelo menos um par está fora do cache → chama OSRM em batch único com todos os pontos.
    const coords = pontos.map(p => `${p.lon},${p.lat}`).join(';');
    const url = `${OSRM_TABLE_URL}/${coords}?annotations=duration,distance`;
    const resp = await fetchComRetry(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, 'OSRM table');
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const body = await resp.json();
    if (body.code !== 'Ok' || !Array.isArray(body.distances) || !Array.isArray(body.durations)) {
        throw new Error(`OSRM resposta inválida: ${body.code || 'sem code'}`);
    }

    // 3) Atualiza matriz + grava no cache.
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const dist = body.distances[i][j];
            const dur = body.durations[i][j];
            if (typeof dist !== 'number' || typeof dur !== 'number') continue;
            matriz[i][j] = { distancia_metros: Math.round(dist), duracao_segundos: Math.round(dur) };
            try {
                await pool.query(
                    `INSERT INTO dist_cache (origem_key, destino_key, distancia_metros, duracao_segundos)
                     VALUES ($1, $2, $3, $4) ON CONFLICT (origem_key, destino_key) DO NOTHING`,
                    [pontos[i].cidade_uf, pontos[j].cidade_uf, Math.round(dist), Math.round(dur)]
                );
            } catch (_) {}
        }
    }
    return matriz;
}

// Busca a geometria de rota por estrada (OSRM /route) entre dois pontos.
// Resultado cacheado pra sempre em route_cache. Retorna:
//   { geometry: GeoJSON LineString, distancia_metros, duracao_segundos }
async function routeGeometry(origem, destino) {
    const a = origem.cidade_uf;
    const b = destino.cidade_uf;
    const cached = await dbGet(
        `SELECT geometry_json, distancia_metros, duracao_segundos FROM route_cache WHERE origem_key = $1 AND destino_key = $2`,
        [a, b]
    );
    if (cached) {
        return {
            geometry: JSON.parse(cached.geometry_json),
            distancia_metros: cached.distancia_metros,
            duracao_segundos: cached.duracao_segundos,
        };
    }
    const url = `${OSRM_ROUTE_URL}/${origem.lon},${origem.lat};${destino.lon},${destino.lat}?overview=full&geometries=geojson`;
    const resp = await fetchComRetry(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, 'OSRM route');
    if (!resp.ok) throw new Error(`OSRM route HTTP ${resp.status} (${a} → ${b})`);
    const body = await resp.json();
    if (body.code !== 'Ok' || !Array.isArray(body.routes) || !body.routes[0]) {
        throw new Error(`OSRM route resposta inválida: ${body.code || 'sem code'}`);
    }
    const r = body.routes[0];
    const geom = r.geometry;
    const dist = Math.round(r.distance);
    const dur = Math.round(r.duration);
    try {
        await pool.query(
            `INSERT INTO route_cache (origem_key, destino_key, geometry_json, distancia_metros, duracao_segundos)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (origem_key, destino_key) DO NOTHING`,
            [a, b, JSON.stringify(geom), dist, dur]
        );
    } catch (_) {}
    return { geometry: geom, distancia_metros: dist, duracao_segundos: dur };
}

module.exports = { geocode, tableMatrix, routeGeometry, normalizarCidadeUf };
