const {
    normalizarColeta,
    extrairColetasDaCelula,
    normalizarCidadeUf,
    ABAS_CONFIG,
    inverterERecalcular,
} = require('./geradorRotas');

describe('normalizarColeta', () => {
    test('remove zeros à esquerda', () => {
        expect(normalizarColeta('00123')).toBe('123');
    });
    test('trim de espaços', () => {
        expect(normalizarColeta('  456  ')).toBe('456');
    });
    test('vazio vira string vazia', () => {
        expect(normalizarColeta('')).toBe('');
        expect(normalizarColeta(null)).toBe('');
    });
});

describe('extrairColetasDaCelula', () => {
    test('coleta única', () => {
        expect(extrairColetasDaCelula('1216')).toEqual(['1216']);
    });
    test('múltiplas separadas por espaços', () => {
        expect(extrairColetasDaCelula('1216  1304')).toEqual(['1216', '1304']);
    });
    test('múltiplas separadas por tab/quebra', () => {
        expect(extrairColetasDaCelula('1339\t1340')).toEqual(['1339', '1340']);
        expect(extrairColetasDaCelula('1339\n1340')).toEqual(['1339', '1340']);
    });
    test('separadores variados (vírgula, ponto-e-vírgula, pipe)', () => {
        expect(extrairColetasDaCelula('1,2;3|4')).toEqual(['1', '2', '3', '4']);
    });
    test('ignora não-numéricos', () => {
        expect(extrairColetasDaCelula('1216 abc 1304')).toEqual(['1216', '1304']);
    });
    test('vazio retorna array vazio', () => {
        expect(extrairColetasDaCelula('')).toEqual([]);
        expect(extrairColetasDaCelula(null)).toEqual([]);
    });
});

describe('normalizarCidadeUf', () => {
    test('remove acentos e maiúsculas', () => {
        expect(normalizarCidadeUf('São Paulo', 'sp')).toBe('SAO PAULO/SP');
    });
    test('trim de espaços', () => {
        expect(normalizarCidadeUf('  Recife  ', '  PE ')).toBe('RECIFE/PE');
    });
});

// Regressão: cabeçalho real da planilha Operação - (Mês/Ano) tem
//   DELTA-PORCELANA: AB = "DATA", AC = "ENTREGAS" (número)
//   ELETRIK:        M  = "DATA",  N  = "ENTREGAS"
// O bug original lia AC em DELTA-PORCELANA, descartando 100% das datas.
describe('ABAS_CONFIG — índices das colunas (regressão)', () => {
    test('DELTA-PORCELANA: colData aponta para AB (idx 27), não AC (idx 28)', () => {
        const delta = ABAS_CONFIG.find(c => c.nome === 'DELTA-PORCELANA');
        expect(delta).toBeDefined();
        expect(delta.colData).toBe(27); // AB
        expect(delta.colData).not.toBe(28); // AC é ENTREGAS
        // range deve estender até pelo menos AB
        expect(delta.range).toMatch(/A10:AB\d+/);
    });

    test('ELETRIK: colData aponta para M (idx 12)', () => {
        const eletrik = ABAS_CONFIG.find(c => c.nome === 'ELETRIK');
        expect(eletrik).toBeDefined();
        expect(eletrik.colData).toBe(12);
    });

    test('DELTA-PORCELANA: outras colunas preservadas', () => {
        const d = ABAS_CONFIG.find(c => c.nome === 'DELTA-PORCELANA');
        expect(d.colRota).toBe(0);     // A
        expect(d.colColeta).toBe(4);   // E
        expect(d.colCidade).toBe(8);   // I
        expect(d.colUf).toBe(9);       // J
    });
});

describe('inverterERecalcular', () => {
    // Cenário: Recife (0) → Goiania (1) → Barreiras (2) → LEM (3)
    // Matriz de distância simulada (metros) e duração (segundos):
    //          R     G     B     L
    //    R [   -, 2000, 1500, 2500 ]
    //    G [2000,    -,  600, 1200 ]
    //    B [1500,  600,    -,  400 ]
    //    L [2500, 1200,  400,    - ]
    const pontos = [
        { cidade_uf: 'RECIFE/PE' },
        { cidade_uf: 'GOIANIA/GO' },
        { cidade_uf: 'BARREIRAS/BA' },
        { cidade_uf: 'LUIS EDUARDO MAGALHAES/BA' },
    ];
    const matriz = [
        [null, { distancia_metros: 2000, duracao_segundos: 10 }, { distancia_metros: 1500, duracao_segundos: 8 }, { distancia_metros: 2500, duracao_segundos: 12 }],
        [{ distancia_metros: 2000, duracao_segundos: 10 }, null, { distancia_metros: 600, duracao_segundos: 5 }, { distancia_metros: 1200, duracao_segundos: 7 }],
        [{ distancia_metros: 1500, duracao_segundos: 8 }, { distancia_metros: 600, duracao_segundos: 5 }, null, { distancia_metros: 400, duracao_segundos: 3 }],
        [{ distancia_metros: 2500, duracao_segundos: 12 }, { distancia_metros: 1200, duracao_segundos: 7 }, { distancia_metros: 400, duracao_segundos: 3 }, null],
    ];

    test('inverte ordem e recalcula distancia/duracao a partir da origem', () => {
        // Ordem do nearestNeighbor (saindo de Recife): Goiania → Barreiras → LEM
        const ordenados = [
            { cidade_uf: 'GOIANIA/GO',                ordem: 1, distancia_do_anterior: 2000, duracao_do_anterior: 10 },
            { cidade_uf: 'BARREIRAS/BA',              ordem: 2, distancia_do_anterior: 600,  duracao_do_anterior: 5 },
            { cidade_uf: 'LUIS EDUARDO MAGALHAES/BA', ordem: 3, distancia_do_anterior: 400,  duracao_do_anterior: 3 },
        ];
        const inv = inverterERecalcular(ordenados, pontos, matriz);
        expect(inv).toHaveLength(3);
        expect(inv[0].cidade_uf).toBe('LUIS EDUARDO MAGALHAES/BA');
        expect(inv[0].ordem).toBe(1);
        // distancia do anterior (Recife → LEM)
        expect(inv[0].distancia_do_anterior).toBe(2500);
        expect(inv[0].duracao_do_anterior).toBe(12);

        expect(inv[1].cidade_uf).toBe('BARREIRAS/BA');
        expect(inv[1].ordem).toBe(2);
        // LEM → Barreiras
        expect(inv[1].distancia_do_anterior).toBe(400);
        expect(inv[1].duracao_do_anterior).toBe(3);

        expect(inv[2].cidade_uf).toBe('GOIANIA/GO');
        expect(inv[2].ordem).toBe(3);
        // Barreiras → Goiania
        expect(inv[2].distancia_do_anterior).toBe(600);
        expect(inv[2].duracao_do_anterior).toBe(5);
    });

    test('lista vazia retorna vazia', () => {
        expect(inverterERecalcular([], pontos, matriz)).toEqual([]);
        expect(inverterERecalcular(null, pontos, matriz)).toEqual([]);
    });

    test('um destino só inverte trivialmente', () => {
        const ordenados = [
            { cidade_uf: 'BARREIRAS/BA', ordem: 1, distancia_do_anterior: 1500, duracao_do_anterior: 8 },
        ];
        const inv = inverterERecalcular(ordenados, pontos, matriz);
        expect(inv).toHaveLength(1);
        expect(inv[0].cidade_uf).toBe('BARREIRAS/BA');
        expect(inv[0].ordem).toBe(1);
        expect(inv[0].distancia_do_anterior).toBe(1500); // Recife → Barreiras
    });

    test('quando matriz falta dados, retorna nulls', () => {
        const ordenados = [
            { cidade_uf: 'GOIANIA/GO', ordem: 1, distancia_do_anterior: 2000, duracao_do_anterior: 10 },
            { cidade_uf: 'BARREIRAS/BA', ordem: 2, distancia_do_anterior: 600, duracao_do_anterior: 5 },
        ];
        const matrizParcial = [
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
        ];
        const inv = inverterERecalcular(ordenados, pontos, matrizParcial);
        expect(inv[0].distancia_do_anterior).toBeNull();
        expect(inv[0].duracao_do_anterior).toBeNull();
    });
});
