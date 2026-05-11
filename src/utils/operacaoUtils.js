export function ehOperacaoInterestadual(op) {
    return op === 'LEÃO - SP' || op === 'ELETRIK SUL';
}

export function ehOperacaoRecife(op) {
    return op && !ehOperacaoInterestadual(op) && op.includes('RECIFE');
}

export function ehOperacaoMoreno(op) {
    return op && !ehOperacaoInterestadual(op) && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));
}
