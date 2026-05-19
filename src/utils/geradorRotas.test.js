const {
    normalizarColeta,
    extrairColetasDaCelula,
    normalizarCidadeUf,
    ABAS_CONFIG,
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
