const mockGet = jest.fn();
const mockBatchUpdate = jest.fn().mockResolvedValue({});
const mockSheetsClient = {
    spreadsheets: {
        values: {
            get: mockGet,
            batchUpdate: mockBatchUpdate,
        },
    },
};

jest.mock('googleapis', () => ({
    google: {
        auth: { GoogleAuth: function () { return {}; } },
        sheets: () => mockSheetsClient,
    },
}));
const {
    extrairNums,
    dataIsoParaBR,
    setGetResultadoSheetId,
    inserirColetaNaRotaSeVazia,
} = require('./sheetsWriter');

beforeEach(() => {
    mockGet.mockReset();
    mockBatchUpdate.mockClear();
    setGetResultadoSheetId(async () => ({ sheetId: 'fake-sheet-id' }));
});

describe('extrairNums', () => {
    test('coleta unica', () => {
        expect(extrairNums('1451')).toEqual(['1451']);
    });
    test('multiplas separadas por barra', () => {
        expect(extrairNums('1451 / 1452')).toEqual(['1451', '1452']);
    });
    test('remove zeros a esquerda', () => {
        expect(extrairNums('001451')).toEqual(['1451']);
    });
    test('remove prefixo PLAS/PORC/ELET', () => {
        expect(extrairNums('PLAS: 1451')).toEqual(['1451']);
        expect(extrairNums('PORC: 1451')).toEqual(['1451']);
        expect(extrairNums('ELET: 1451')).toEqual(['1451']);
    });
    test('multiplos separadores: espaco, virgula, pipe', () => {
        expect(extrairNums('1,2 3|4')).toEqual(['1', '2', '3', '4']);
    });
    test('vazio/null', () => {
        expect(extrairNums('')).toEqual([]);
        expect(extrairNums(null)).toEqual([]);
        expect(extrairNums(undefined)).toEqual([]);
    });
});

describe('dataIsoParaBR', () => {
    test('ISO valido', () => {
        expect(dataIsoParaBR('2026-05-21')).toBe('21/05/2026');
    });
    test('ISO com hora', () => {
        expect(dataIsoParaBR('2026-05-21T10:30:00Z')).toBe('21/05/2026');
    });
    test('invalido retorna null', () => {
        expect(dataIsoParaBR('')).toBe(null);
        expect(dataIsoParaBR(null)).toBe(null);
        expect(dataIsoParaBR('not a date')).toBe(null);
        expect(dataIsoParaBR(123)).toBe(null);
    });
});

describe('inserirColetaNaRotaSeVazia', () => {
    test('col E vazia + 1 coleta — escreve na 1a linha', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '', '', ''],
                ['',   '', '', '', '', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'] }]);
        expect(r.inseridas).toContain("'DELTA-PORCELANA'!E10");
        expect(r.avisos).toEqual([]);
        expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const e10 = updates.find(u => u.range === "'DELTA-PORCELANA'!E10");
        expect(e10.values).toEqual([['1451']]);
    });

    test('col E vazia + 2 coletas — escreve "1451 / 1452"', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451', '1452'] }]);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const e10 = updates.find(u => u.range === "'DELTA-PORCELANA'!E10");
        expect(e10.values).toEqual([['1451 / 1452']]);
    });

    test('rota inexistente — nao escreve, sem aviso', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['200', '', '', '', '', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'] }]);
        expect(r.inseridas).toEqual([]);
        expect(r.avisos).toEqual([]);
        expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    test('col E ja tem mesma coleta — idempotente, nao escreve', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '1451', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'] }]);
        expect(r.inseridas).toEqual([]);
        expect(r.avisos).toEqual([]);
    });

    test('col E com coleta diferente + naoConcatenar:true — aborta com aviso', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '9999', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'], naoConcatenar: true }]);
        expect(r.inseridas).toEqual([]);
        expect(r.avisos).toHaveLength(1);
        expect(r.avisos[0]).toMatchObject({
            rota: '181',
            coleta_planilha: '9999',
            coletas_lancadas: ['1451'],
            motivo: 'rota-ja-tem-coleta-diferente',
        });
        expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    test('col E com coleta diferente SEM flag — concatena (regressao)', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '9999', '', ''],
            ]},
        });
        const r = await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'] }]);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const e10 = updates.find(u => u.range === "'DELTA-PORCELANA'!E10");
        expect(e10.values).toEqual([['9999 / 1451']]);
        expect(r.avisos).toHaveLength(1);
        expect(r.avisos[0].motivo).toBeUndefined();
    });

    test('col G data — para na proxima rota (numero puro em col A)', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '', 'JOAO PESSOA', ''],
                ['',    '', '', '', '', 'GUARABIRA',   ''],
                ['200', '', '', '', '', 'CARUARU',     ''],
            ]},
        });
        await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'], dataPrevista: '2026-05-22' }]);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const ranges = updates.map(u => u.range).filter(r => r.includes('!G'));
        expect(ranges).toEqual(["'DELTA-PORCELANA'!G10", "'DELTA-PORCELANA'!G11"]);
        expect(ranges).not.toContain("'DELTA-PORCELANA'!G12");
    });

    test('col G data — para em metadado (col A com texto nao-numerico)', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181',     '', '', '', '', 'JOAO PESSOA', ''],
                ['',        '', '', '', '', 'GUARABIRA',   ''],
                ['REGIOES', '', '', '', '', '',            ''],
                ['',        '', '', '', '', '',            ''],
            ]},
        });
        await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'], dataPrevista: '2026-05-22' }]);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const ranges = updates.map(u => u.range).filter(r => r.includes('!G'));
        expect(ranges).toEqual(["'DELTA-PORCELANA'!G10", "'DELTA-PORCELANA'!G11"]);
    });

    test('col G data — para em linha completamente vazia (separador visual)', async () => {
        mockGet.mockResolvedValueOnce({
            data: { values: [
                ['181', '', '', '', '', 'JOAO PESSOA', ''],
                ['',    '', '', '', '', 'GUARABIRA',   ''],
                ['',    '', '', '', '', '',            ''],
                ['',    '', '', '', '', 'CARUARU',     ''],
            ]},
        });
        await inserirColetaNaRotaSeVazia([{ rota: '181', coletas: ['1451'], dataPrevista: '2026-05-22' }]);
        const updates = mockBatchUpdate.mock.calls[0][0].requestBody.data;
        const ranges = updates.map(u => u.range).filter(r => r.includes('!G'));
        expect(ranges).toEqual(["'DELTA-PORCELANA'!G10", "'DELTA-PORCELANA'!G11"]);
        expect(ranges).not.toContain("'DELTA-PORCELANA'!G12");
        expect(ranges).not.toContain("'DELTA-PORCELANA'!G13");
    });
});
