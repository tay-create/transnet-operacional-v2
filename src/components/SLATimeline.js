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
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

function corSLA(ms) {
    if (ms < 0) return { text: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' };
    if (ms < 3600000)  return { text: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  };
    if (ms < 7200000)  return { text: '#facc15', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)'  };
    return                    { text: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  };
}

// Etapa individual: mostra tempo decorrido.
// - Se etapa concluída (próxima etapa também tem timestamp): mostra duração estática
// - Se etapa em andamento (última com timestamp): mostra cronômetro ao vivo
// - Se não iniciada: não renderiza
function EtapaCard({ label, inicioAt, fimAt, aoVivo }) {
    const [agora, setAgora] = useState(Date.now());

    useEffect(() => {
        if (!aoVivo) return;
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [aoVivo]);

    if (!inicioAt) return null;

    const inicio = new Date(inicioAt).getTime();
    const fim = fimAt ? new Date(fimAt).getTime() : agora;
    const duracao = fim - inicio;
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

// Badge de Total Pátio — sempre ao vivo se não finalizou (LIBERADO P/ CT-e)
function TotalPatioCard({ dataCriacao, cteAt }) {
    const [agora, setAgora] = useState(Date.now());
    const aoVivo = !cteAt;

    useEffect(() => {
        if (!aoVivo) return;
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [aoVivo]);

    if (!dataCriacao) return null;

    const inicio = new Date(dataCriacao).getTime();
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
// Props: item (objeto do veículo), unidade ('recife' | 'moreno')
export default function SLATimeline({ item, unidade }) {
    const ts = item?.timestamps_status;
    const dataCriacao = item?.data_criacao;

    if (!ts && !dataCriacao) return null;

    // Detectar qual é a última etapa com timestamp — ela recebe cronômetro ao vivo
    const etapasComAt = ETAPAS.map((e, i) => ({
        ...e,
        at: ts?.[e.campoAt(unidade)] || null,
        index: i,
    }));

    const ultimaIdx = etapasComAt.reduce((acc, e, i) => (e.at ? i : acc), -1);
    const cteAt = ts?.[`cte_${unidade}_at`] || null;

    const algumBadge = dataCriacao || etapasComAt.some(e => e.at);
    if (!algumBadge) return null;

    const cteEmitido = item?.status_cte === 'Emitido';

    return (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {etapasComAt.map((etapa, i) => {
                if (!etapa.at) return null;
                const ehEtapaCte = etapa.label === 'CT-e';
                const proxAt = ehEtapaCte
                    ? (cteEmitido ? (item?.datetime_cte || etapa.at) : null)
                    : (etapasComAt[i + 1]?.at || null);
                const aoVivo = (i === ultimaIdx) && !proxAt;
                return (
                    <EtapaCard
                        key={etapa.label}
                        label={etapa.label}
                        inicioAt={etapa.at}
                        fimAt={proxAt}
                        aoVivo={aoVivo}
                    />
                );
            })}
            {dataCriacao && (
                <TotalPatioCard dataCriacao={dataCriacao} cteAt={cteAt} />
            )}
        </div>
    );
}
