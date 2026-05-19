import { formatBRL, parseBRL } from './formatBRL';

// Intl pode usar NBSP ( ) ou narrow no-break space ( ) entre "R$" e o número.
// Normaliza qualquer espaço Unicode pra espaço ASCII pra comparações estáveis.
const norm = (s) => s.replace(/[\s  ]+/g, ' ');

describe('formatBRL', () => {
    test('formata número inteiro como R$ pt-BR', () => {
        expect(norm(formatBRL(1000))).toBe('R$ 1.000,00');
    });
    test('formata decimal com 2 casas', () => {
        expect(norm(formatBRL(1234.56))).toBe('R$ 1.234,56');
    });
    test('arredonda para 2 casas', () => {
        expect(norm(formatBRL(1234.567))).toBe('R$ 1.234,57');
    });
    test('formata zero', () => {
        expect(norm(formatBRL(0))).toBe('R$ 0,00');
    });
    test('retorna vazio para null', () => {
        expect(formatBRL(null)).toBe('');
    });
    test('retorna vazio para undefined', () => {
        expect(formatBRL(undefined)).toBe('');
    });
    test('retorna vazio para string vazia', () => {
        expect(formatBRL('')).toBe('');
    });
    test('retorna vazio para NaN', () => {
        expect(formatBRL('abc')).toBe('');
    });
    test('aceita string numérica', () => {
        expect(norm(formatBRL('1234.56'))).toBe('R$ 1.234,56');
    });
});

describe('parseBRL', () => {
    test('parseia formato BR completo', () => {
        expect(parseBRL('R$ 1.234,56')).toBe(1234.56);
    });
    test('parseia sem prefixo R$', () => {
        expect(parseBRL('1.234,56')).toBe(1234.56);
    });
    test('parseia número simples com ponto', () => {
        expect(parseBRL('1234.56')).toBe(1234.56);
    });
    test('parseia número inteiro', () => {
        expect(parseBRL('1234')).toBe(1234);
    });
    test('parseia com múltiplos separadores de milhar', () => {
        expect(parseBRL('R$ 1.234.567,89')).toBe(1234567.89);
    });
    test('retorna null para vazio', () => {
        expect(parseBRL('')).toBeNull();
    });
    test('retorna null para null', () => {
        expect(parseBRL(null)).toBeNull();
    });
    test('retorna null para undefined', () => {
        expect(parseBRL(undefined)).toBeNull();
    });
    test('retorna null para string não-numérica', () => {
        expect(parseBRL('abc')).toBeNull();
    });
    test('roundtrip formatBRL -> parseBRL', () => {
        const original = 9876.54;
        expect(parseBRL(formatBRL(original))).toBe(original);
    });
});
