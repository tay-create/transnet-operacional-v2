const {
    normalizarData,
    parseLinhasLeadTime,
    classificarEntrega,
    agregarLeadTime,
} = require('./leadTimeOperacional');

// Helper: cria linha com 28 colunas (A..AB) preenchendo só os campos relevantes.
// Indices: 0=Rota, 7=Embarque, 8=Cidade, 9=UF, 10=Regiao, 27=Agendamento
function linha({ rota = '', embarque = '', cidade = '', uf = '', regiao = '', agendamento = '' } = {}) {
    const r = new Array(28).fill('');
    r[0] = rota;
    r[7] = embarque;
    r[8] = cidade;
    r[9] = uf;
    r[10] = regiao;
    r[27] = agendamento;
    return r;
}

describe('normalizarData', () => {
    test('aceita DD/MM/YYYY', () => {
        expect(normalizarData('13/05/2026')).toBe('2026-05-13');
    });
    test('aceita YYYY-MM-DD', () => {
        expect(normalizarData('2026-05-13')).toBe('2026-05-13');
    });
    test('aceita Date', () => {
        expect(normalizarData(new Date(Date.UTC(2026, 4, 13)))).toBe('2026-05-13');
    });
    test('retorna null para vazio/inválido', () => {
        expect(normalizarData('')).toBeNull();
        expect(normalizarData(null)).toBeNull();
        expect(normalizarData('xyz')).toBeNull();
    });
    test('número pequeno (ex: "4") NÃO vira data — regressão do bug de col AC', () => {
        // "4" estava em AC (idx 28) e era lido como agendamento, descartando todas as linhas.
        // Após a correção (idx 27 = AB "DATA"), AC nem é mais lido.
        expect(normalizarData('4')).toBeNull();
        expect(normalizarData('1')).toBeNull();
    });
});

describe('parseLinhasLeadTime', () => {
    test('parseia linha completa lendo agendamento de row[27] (col AB)', () => {
        const rows = [
            linha({
                rota: '1', embarque: '07/05/2026', cidade: 'CARLOS BARBOSA',
                uf: 'RS', regiao: 'S', agendamento: '13/05/2026',
            }),
        ];
        const out = parseLinhasLeadTime(rows);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({
            rota: '1',
            embarque: '2026-05-07',
            cidade: 'CARLOS BARBOSA',
            uf: 'RS',
            regiao: 'S',
            agendamento: '2026-05-13',
        });
    });

    test('regressão: row[28] (AC "ENTREGAS") NÃO deve ser usado como agendamento', () => {
        // Simula a estrutura real da planilha — AC contém número de entregas, não data.
        const row = linha({
            rota: '1', embarque: '07/05/2026', cidade: 'CARLOS BARBOSA',
            uf: 'RS', regiao: 'S', agendamento: '13/05/2026',
        });
        row.push('4'); // AC = ENTREGAS
        row.push('CARRETA'); // AD = VEÍCULO
        const out = parseLinhasLeadTime([row]);
        expect(out).toHaveLength(1);
        expect(out[0].agendamento).toBe('2026-05-13');
    });

    test('forward-fill: linhas seguintes sem rota herdam a rota anterior', () => {
        const rows = [
            linha({ rota: '1', embarque: '07/05/2026', uf: 'RS', regiao: 'S', agendamento: '13/05/2026' }),
            linha({ uf: 'PR', regiao: 'S', agendamento: '12/05/2026' }),
        ];
        const out = parseLinhasLeadTime(rows);
        expect(out).toHaveLength(2);
        expect(out[0].rota).toBe('1');
        expect(out[1].rota).toBe('1');
        expect(out[1].uf).toBe('PR');
    });

    test('descarta linhas sem UF ou sem agendamento', () => {
        const rows = [
            linha({ rota: '1', embarque: '07/05/2026', uf: '', regiao: 'S', agendamento: '13/05/2026' }),
            linha({ rota: '2', embarque: '07/05/2026', uf: 'RS', regiao: 'S', agendamento: '' }),
        ];
        expect(parseLinhasLeadTime(rows)).toHaveLength(0);
    });

    test('infere região a partir da UF quando coluna K vier vazia', () => {
        const rows = [
            linha({ rota: '1', embarque: '07/05/2026', uf: 'BA', regiao: '', agendamento: '13/05/2026' }),
        ];
        const [e] = parseLinhasLeadTime(rows);
        expect(e.regiao).toBe('NE');
        expect(e.regiaoNome).toBe('NORDESTE');
    });

    test('inclui regiaoNome completo para todas as regiões', () => {
        const casos = [
            { uf: 'RS', regiao: 'S', nome: 'SUL' },
            { uf: 'SP', regiao: 'SE', nome: 'SUDESTE' },
            { uf: 'BA', regiao: 'NE', nome: 'NORDESTE' },
            { uf: 'GO', regiao: 'CO', nome: 'CENTRO-OESTE' },
            { uf: 'AM', regiao: 'N', nome: 'NORTE' },
        ];
        for (const c of casos) {
            const [e] = parseLinhasLeadTime([
                linha({ rota: '1', embarque: '07/05/2026', uf: c.uf, regiao: c.regiao, agendamento: '13/05/2026' }),
            ]);
            expect(e.regiao).toBe(c.regiao);
            expect(e.regiaoNome).toBe(c.nome);
        }
    });

    test('lida com rows vazio/null', () => {
        expect(parseLinhasLeadTime([])).toEqual([]);
        expect(parseLinhasLeadTime(null)).toEqual([]);
    });
});

describe('classificarEntrega + agregarLeadTime', () => {
    const mapUF = { RS: 5, BA: 8 };
    const mapRegiao = { S: 6, NE: 9 };

    test('classifica e agrega entregas reais', () => {
        const entregas = parseLinhasLeadTime([
            // embarque 04/05 -> agendamento 07/05 = 3 dias úteis -> DENTRO (lead 5) p/ RS
            linha({ rota: '1', embarque: '04/05/2026', uf: 'RS', regiao: 'S', agendamento: '07/05/2026' }),
            // embarque 04/05 -> agendamento 18/05 = 10 dias úteis -> FORA (lead 5) p/ RS
            linha({ rota: '2', embarque: '04/05/2026', uf: 'RS', regiao: 'S', agendamento: '18/05/2026' }),
        ]);
        const classificadas = entregas.map(e => classificarEntrega(e, mapUF, mapRegiao));
        const agg = agregarLeadTime(classificadas);

        expect(agg.transnet.total).toBe(2);
        expect(agg.transnet.dentro + agg.transnet.fora + agg.transnet.antecipado).toBe(2);
        expect(agg.porUF.RS.total).toBe(2);
        expect(agg.porRegiao.S.total).toBe(2);
        expect(agg.porRegiao.S.regiaoNome).toBe('SUL');
    });
});
