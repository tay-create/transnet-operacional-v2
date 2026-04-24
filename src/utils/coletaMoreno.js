export const opTemPlastico = (op) => !!op && op.includes('PLÁSTICO(MORENO)');
export const opTemPorcelana = (op) => !!op && op.includes('PORCELANA');
export const opTemEletrik = (op) => !!op && op.includes('ELETRIK');

export const produtosMoreno = (op) => {
    const out = [];
    if (opTemPlastico(op)) out.push('plastico');
    if (opTemPorcelana(op)) out.push('porcelana');
    if (opTemEletrik(op)) out.push('eletrik');
    return out;
};

export const opPrecisaSplit = (op) => produtosMoreno(op).length >= 2;

export function parseColetaMoreno(str, operacao) {
    const s = (str || '').trim();
    const base = { plastico: '', porcelana: '', eletrik: '' };
    if (!s) return base;
    if (s.includes('PLAS:') || s.includes('PORC:') || s.includes('ELET:')) {
        s.split('|').forEach(part => {
            const p = part.trim();
            if (p.startsWith('PLAS:')) base.plastico = p.slice(5).trim();
            else if (p.startsWith('PORC:')) base.porcelana = p.slice(5).trim();
            else if (p.startsWith('ELET:')) base.eletrik = p.slice(5).trim();
        });
        return base;
    }
    const prods = produtosMoreno(operacao);
    if (prods.length === 1) {
        base[prods[0]] = s;
        return base;
    }
    base.porcelana = s;
    return base;
}

export function joinColetaMoreno({ plastico = '', porcelana = '', eletrik = '' }) {
    const parts = [];
    const pl = plastico.trim();
    const pc = porcelana.trim();
    const el = eletrik.trim();
    if (pl) parts.push(`PLAS:${pl}`);
    if (pc) parts.push(`PORC:${pc}`);
    if (el) parts.push(`ELET:${el}`);
    return parts.join(' | ');
}

export function displayColetaMoreno(str) {
    const s = (str || '').trim();
    if (!s) return '';
    if (!s.includes('PLAS:') && !s.includes('PORC:') && !s.includes('ELET:')) return s;
    return s
        .split('|')
        .map(part => part.trim().replace(/^(PLAS|PORC|ELET):/, '').trim())
        .filter(Boolean)
        .join(',');
}
