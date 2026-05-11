// src/utils/dateFormatter.js

// "01/05/2025" — compatível com datas ISO "YYYY-MM-DD" e datetimes
// Strings de apenas data (10 chars) são fixadas em 12:00 BRT para evitar
// deslocamento UTC→BRT que inverte o dia.
export const formatDataBR = (d) => {
    if (!d) return '—';
    const s = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00-03:00' : d;
    return new Date(s).toLocaleDateString('pt-BR');
};

// "01/05/2025 14:30"
export const formatDataHoraBR = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

// "01/05" — para labels de gráficos, sem ano
export const formatDataCurta = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    return `${parts[2]}/${parts[1]}`;
};
