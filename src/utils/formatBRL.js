// Formata e parseia valores em Real brasileiro.
// Usado pelos inputs financeiros do PlanejamentoDelta.

export function formatBRL(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const n = Number(valor);
    if (isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

// Parse: "R$ 1.234,56" → 1234.56. "1.234,56" → 1234.56. "1234.56" → 1234.56. "" → null.
// Heurística: se tem vírgula, formato BR (ponto=milhar, vírgula=decimal).
// Se não tem vírgula, formato US/numérico (ponto=decimal).
export function parseBRL(texto) {
    if (texto === null || texto === undefined) return null;
    const s = String(texto).trim();
    if (!s) return null;
    let limpo = s.replace(/R\$\s?/g, '').replace(/\s+/g, '');
    if (limpo.includes(',')) {
        limpo = limpo.replace(/\./g, '').replace(',', '.');
    }
    const n = Number(limpo);
    return isNaN(n) ? null : n;
}
