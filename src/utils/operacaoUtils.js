export function ehOperacaoInterestadual(op) {
    return op === 'LEÃO - SP' || op === 'ELETRIK SUL';
}

export function ehOperacaoRecife(op) {
    return op && !ehOperacaoInterestadual(op) && op.includes('RECIFE');
}

export function ehOperacaoMoreno(op) {
    return op && !ehOperacaoInterestadual(op) && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));
}

export function ehInterestadualOp(op) {
    return op === 'LEÃO - SP' || op === 'ELETRIK SUL';
}

export function normalizarStatusInterestadual(item, status) {
    if (!ehInterestadualOp(item.operacao)) return status;
    if (status === 'AGUARDANDO' || status === 'AGUARDANDO P/ SEPARAÇÃO' || status === 'EM SEPARAÇÃO' || status === 'LIBERADO P/ DOCA') {
        return 'LIBERADO P/ CARREGAMENTO';
    }
    return status;
}

export function getCampoStatus(origem, operacoesFixas) {
    return (origem === 'Recife' || operacoesFixas) ? 'status_recife' : 'status_moreno';
}

export function getStatus(item, campoStatus) {
    return normalizarStatusInterestadual(item, item[campoStatus] || 'AGUARDANDO');
}
