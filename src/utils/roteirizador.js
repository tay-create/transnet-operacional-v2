// Algoritmo "vizinho mais próximo" para ordenar destinos a partir de uma origem.
// Dada a matriz NxN do OSRM (índice 0 = origem, 1..N-1 = destinos), retorna
// os destinos ordenados pela sequência que percorre sempre o ponto não-visitado
// mais próximo do atual.

function nearestNeighbor(pontos, matriz) {
    const n = pontos.length;
    if (n <= 1) return [];
    if (n === 2) {
        return [{
            ...pontos[1],
            ordem: 1,
            distancia_do_anterior: matriz?.[0]?.[1]?.distancia_metros ?? null,
            duracao_do_anterior: matriz?.[0]?.[1]?.duracao_segundos ?? null,
        }];
    }

    const visitados = new Set([0]); // origem
    const ordem = [];
    let atual = 0;

    while (visitados.size < n) {
        let melhor = -1;
        let melhorDist = Infinity;
        for (let j = 1; j < n; j++) {
            if (visitados.has(j)) continue;
            const par = matriz?.[atual]?.[j];
            const dist = par?.distancia_metros;
            if (typeof dist !== 'number') continue;
            if (dist < melhorDist) {
                melhorDist = dist;
                melhor = j;
            }
        }
        if (melhor === -1) {
            // Sem dados de distância pra resto; preserva ordem de entrada para o que sobrou.
            for (let j = 1; j < n; j++) if (!visitados.has(j)) {
                visitados.add(j);
                ordem.push({
                    ...pontos[j],
                    ordem: ordem.length + 1,
                    distancia_do_anterior: null,
                    duracao_do_anterior: null,
                });
            }
            break;
        }
        const par = matriz[atual][melhor];
        ordem.push({
            ...pontos[melhor],
            ordem: ordem.length + 1,
            distancia_do_anterior: par.distancia_metros,
            duracao_do_anterior: par.duracao_segundos,
        });
        visitados.add(melhor);
        atual = melhor;
    }

    return ordem;
}

module.exports = { nearestNeighbor };
