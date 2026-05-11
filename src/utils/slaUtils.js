// src/utils/slaUtils.js

function parseDatetimeBRT(data, hora) {
    const d = (data || '').substring(0, 10);
    const h = (hora || '00:00').substring(0, 5);
    return new Date(`${d}T${h}:00-03:00`);
}

export function calcularHorasAtraso(oc) {
    const inicio = parseDatetimeBRT(oc.data_ocorrencia, oc.hora_ocorrencia);
    const fim = oc.situacao === 'RESOLVIDO'
        ? (oc.resolved_at ? new Date(oc.resolved_at) : parseDatetimeBRT(oc.data_conclusao, oc.hora_conclusao))
        : new Date();
    return (fim - inicio) / (60 * 60 * 1000);
}

export function verificarAtraso(oc) {
    return calcularHorasAtraso(oc) > 24;
}

export function getLabelAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas <= 24) return null;
    const dias = Math.floor(horas / 24);
    const horasRestantes = Math.floor(horas % 24);
    if (dias >= 1) return `${dias}d ${horasRestantes}h atrasado`;
    return `${Math.floor(horas)}h atrasado`;
}

export function getCorAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas > 72) return '#dc2626';
    if (horas > 48) return '#ef4444';
    if (horas > 24) return '#f59e0b';
    return null;
}

export function getSituacaoDisplay(oc) {
    const horas = calcularHorasAtraso(oc);
    if (oc.situacao === 'RESOLVIDO') {
        return horas > 24
            ? { texto: 'RESOLVIDO (>24H)', cor: '#d97706' }
            : { texto: 'RESOLVIDO', cor: '#16a34a' };
    }
    return horas > 24
        ? { texto: 'ATRASADO (>24H)', cor: '#dc2626' }
        : { texto: 'EM ANDAMENTO', cor: '#64748b' };
}

export function ordenarOcorrencias(lista) {
    return [...lista].sort((a, b) => {
        const aEmAndamento = a.situacao === 'Em Andamento';
        const bEmAndamento = b.situacao === 'Em Andamento';
        const aAtrasado = aEmAndamento && verificarAtraso(a);
        const bAtrasado = bEmAndamento && verificarAtraso(b);
        if (aAtrasado && !bAtrasado) return -1;
        if (!aAtrasado && bAtrasado) return 1;
        if (aAtrasado && bAtrasado) return calcularHorasAtraso(b) - calcularHorasAtraso(a);
        if (aEmAndamento && !bEmAndamento) return -1;
        if (!aEmAndamento && bEmAndamento) return 1;
        return 0;
    });
}
