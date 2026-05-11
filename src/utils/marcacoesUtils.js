// Parse de datetime sem shift de timezone (strings sem Z/offset tratadas como local)
export function parseDateLocal(str) {
    if (!str) return null;
    // Se já vier com Z ou +offset, usa diretamente; caso contrário trata como local
    if (str.endsWith('Z') || str.includes('+')) return new Date(str);
    // Formato "YYYY-MM-DD HH:MM:SS" → substitui espaço por T para o parser JS
    return new Date(str.replace(' ', 'T'));
}

// Tempo de espera entre marcação e contratação
// Returns: { horas: number, label: string, cor: string } | null
export function calcularTempoEspera(dataMarcacao, dataContratacao) {
    if (!dataMarcacao) return null;
    const inicio = parseDateLocal(dataMarcacao);
    const fim = dataContratacao ? parseDateLocal(dataContratacao) : new Date();
    if (!inicio || isNaN(inicio)) return null;
    const min = Math.max(0, Math.floor((fim - inicio) / 60000));
    return { horas: min / 60, label: formatarTempo(min), cor: corTempo(min) };
}

// Formata minutos para string legível (ex: "2h30", "1d 3h", etc.)
function formatarTempo(minutos) {
    if (minutos === null) return '—';
    if (minutos < 60) return `${minutos}min`;
    const totalH = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (totalH < 24) return m > 0 ? `${totalH}h ${m}min` : `${totalH}h`;
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (h === 0 && m === 0) return `${d}d`;
    if (h === 0) return `${d}d ${m}min`;
    if (m === 0) return `${d}d ${h}h`;
    return `${d}d ${h}h ${m}min`;
}

// Cor do tempo de espera: verde (<1h), amarelo (1-4h), vermelho (>4h)
function corTempo(min) {
    if (min === null) return '#64748b';
    if (min < 60) return '#4ade80';
    if (min < 240) return '#fbbf24';
    return '#f87171';
}

// Cor da disponibilidade (localização): verde (PÁTIO), amarelo (POSTO), cinza (outros)
function corDisponibilidade(disp) {
    if (!disp) return '#64748b';
    if (disp === 'NO PÁTIO') return '#4ade80';
    if (disp === 'NO POSTO') return '#fbbf24';
    return '#94a3b8'; // EM CASA
}

export { formatarTempo, corTempo, corDisponibilidade };
