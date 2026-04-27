import { useState, useEffect } from 'react';
import { Timer, CheckCircle } from 'lucide-react';

// Mapa de status → chave no timestamps_status por unidade
const ETAPAS = [
    { label: 'SEPARAÇÃO',  campoAt: (u) => `separacao_${u}_at`,     abrev: 'SEP' },
    { label: 'LIB. DOCA',  campoAt: (u) => `lib_doca_${u}_at`,      abrev: 'DOCA' },
    { label: 'CARREGAM.',  campoAt: (u) => `carregamento_${u}_at`,   abrev: 'CAR' },
    { label: 'CARREGADO',  campoAt: (u) => `carregado_${u}_at`,      abrev: 'FIM' },
    { label: 'CT-e',       campoAt: (u) => `cte_${u}_at`,            abrev: 'CTe' },
];

function formatarTempo(ms) {
    if (ms < 0) ms = 0;
    const totalMin = Math.floor(ms / 60000);
    const totalH = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (totalH < 24) {
        return totalH > 0 ? `${totalH}h${String(m).padStart(2, '0')}` : `${m}min`;
    }
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (h === 0 && m === 0) return `${d}d`;
    if (h === 0) return `${d}d ${m}min`;
    if (m === 0) return `${d}d ${h}h`;
    return `${d}d ${h}h${String(m).padStart(2, '0')}`;
}

function corSLA(ms) {
    if (ms < 0) return { text: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' };
    if (ms < 3600000)  return { text: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  };
    if (ms < 7200000)  return { text: '#facc15', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)'  };
    return                    { text: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  };
}

// Calcula o tempo total pausado (ms) que faz overlap com o intervalo [inicioMs, fimMs]
function calcularTempoPausa(pausas, unidade, inicioMs, fimMs) {
    if (!pausas || !pausas.length) return 0;
    let total = 0;
    const agora = Date.now();
    for (const p of pausas) {
        if (p.unidade !== unidade) continue;
        const pInicio = new Date(p.inicio).getTime();
        const pFim = p.fim ? new Date(p.fim).getTime() : agora;
        // Calcula overlap entre [pInicio, pFim] e [inicioMs, fimMs]
        const overlapInicio = Math.max(pInicio, inicioMs);
        const overlapFim = Math.min(pFim, fimMs);
        if (overlapFim > overlapInicio) {
            total += (overlapFim - overlapInicio);
        }
    }
    return total;
}

// Etapa individual: mostra tempo decorrido descontando pausas.
function EtapaCard({ label, inicioAt, fimAt, aoVivo, pausaMs }) {
    const [agora, setAgora] = useState(Date.now());

    useEffect(() => {
        if (!aoVivo) return;
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [aoVivo]);

    if (!inicioAt) return null;

    const inicio = new Date(inicioAt).getTime();
    const fim = fimAt ? new Date(fimAt).getTime() : agora;
    const duracao = (fim - inicio) - (pausaMs || 0);
    const cor = corSLA(duracao);

    return (
        <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            padding: '3px 8px', borderRadius: '6px', minWidth: '56px',
            background: cor.bg, border: `1px solid ${cor.border}`,
            fontSize: '9px', lineHeight: '1.4', gap: '1px',
            position: 'relative'
        }}>
            <span style={{ color: '#64748b', fontWeight: '600', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {aoVivo && <Timer size={8} style={{ flexShrink: 0 }} />}
                {!aoVivo && fimAt && <CheckCircle size={8} style={{ flexShrink: 0, color: '#4ade80' }} />}
                {label}
            </span>
            <span style={{ color: cor.text, fontWeight: '700', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
                {formatarTempo(duracao)}
            </span>
        </div>
    );
}

// Badge de Total Pátio — NÃO desconta pausa (continua rodando)
// Usa data_inicio_patio (herda Tempo de Espera da marcação) em vez de data_criacao
function TotalPatioCard({ dataInicioPatio, cteAt }) {
    const [agora, setAgora] = useState(Date.now());
    const aoVivo = !cteAt;

    useEffect(() => {
        if (!aoVivo) return;
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [aoVivo]);

    if (!dataInicioPatio) return null;

    const inicio = new Date(dataInicioPatio).getTime();
    const fim = cteAt ? new Date(cteAt).getTime() : agora;
    const duracao = fim - inicio;
    const cor = corSLA(duracao);

    return (
        <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            padding: '3px 8px', borderRadius: '6px', minWidth: '62px',
            background: cor.bg, border: `1px solid ${cor.border}`,
            fontSize: '9px', lineHeight: '1.4', gap: '1px'
        }}>
            <span style={{ color: '#64748b', fontWeight: '600', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {aoVivo && <Timer size={8} style={{ flexShrink: 0 }} />}
                {!aoVivo && <CheckCircle size={8} style={{ flexShrink: 0, color: '#4ade80' }} />}
                TOTAL PÁTIO
            </span>
            <span style={{ color: cor.text, fontWeight: '700', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
                {formatarTempo(duracao)}
            </span>
        </div>
    );
}

// Componente principal exportado
// Props: item (objeto do veículo), unidade ('recife' | 'moreno'), pausas (array de pausas)
export default function SLATimeline({ item, unidade, pausas }) {
    const ts = item?.timestamps_status;
    const dataInicioPatio = item?.data_inicio_patio;

    if (!ts && !dataInicioPatio) return null;

    // Detectar qual é a última etapa com timestamp — ela recebe cronômetro ao vivo
    const etapasComAt = ETAPAS.map((e, i) => ({
        ...e,
        at: ts?.[e.campoAt(unidade)] || null,
        index: i,
    }));

    const cteAt = ts?.[`cte_${unidade}_at`] || null;
    const carregadoAt = ts?.[`carregado_${unidade}_at`] || null;

    const algumBadge = dataInicioPatio || etapasComAt.some(e => e.at);
    if (!algumBadge) return null;

    // data_emissao do CT-e por unidade (vem do JOIN com ctes_ativos no backend)
    const dataEmissaoCte = unidade === 'recife' ? item?.data_emissao_cte_recife : item?.data_emissao_cte_moreno;
    const cteEmitido = item?.status_cte === 'Emitido' && !!dataEmissaoCte;

    // Última etapa real ainda em andamento (ao vivo) — descarta etapas que já têm "fim" conhecido
    const etapasComFim = etapasComAt.map((etapa, i) => {
        if (!etapa.at) return { ...etapa, fimAt: null };
        const ehCte = etapa.label === 'CT-e';
        const ehCarregado = etapa.label === 'CARREGADO';
        let fimAt = null;
        if (ehCte) {
            // CT-e para quando emitido
            fimAt = cteEmitido ? dataEmissaoCte : null;
        } else if (ehCarregado) {
            // CARREGADO para apenas quando carregado_at existe (o card foi marcado fisicamente)
            // — não para com o CT-e antecipado
            fimAt = carregadoAt || null;
        } else {
            // Demais etapas param na próxima etapa cujo timestamp seja >= o atual
            // (evita "fim negativo" quando próxima etapa foi marcada antes da atual — ex.: CT-e antecipado)
            const inicioMs = new Date(etapa.at).getTime();
            for (let j = i + 1; j < etapasComAt.length; j++) {
                const prox = etapasComAt[j].at;
                if (prox && new Date(prox).getTime() >= inicioMs) {
                    fimAt = prox;
                    break;
                }
            }
        }
        return { ...etapa, fimAt };
    });

    const ultimaIdx = etapasComFim.reduce((acc, e, i) => (e.at && !e.fimAt ? i : acc), -1);
    const agora = Date.now();

    return (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {etapasComFim.map((etapa, i) => {
                if (!etapa.at) return null;
                const aoVivo = i === ultimaIdx;
                const inicioMs = new Date(etapa.at).getTime();
                const fimMs = etapa.fimAt ? new Date(etapa.fimAt).getTime() : agora;
                const pausaMs = calcularTempoPausa(pausas || [], unidade, inicioMs, fimMs);
                return (
                    <EtapaCard
                        key={etapa.label}
                        label={etapa.label}
                        inicioAt={etapa.at}
                        fimAt={etapa.fimAt}
                        aoVivo={aoVivo}
                        pausaMs={pausaMs}
                    />
                );
            })}
            {dataInicioPatio && (
                <TotalPatioCard dataInicioPatio={dataInicioPatio} cteAt={carregadoAt || cteAt} />
            )}
        </div>
    );
}
