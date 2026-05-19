import React from 'react';
import { ChevronDown, Truck, MapPin } from 'lucide-react';
import BlocoDadosRota from './BlocoDadosRota';
import BlocoDestinos from './BlocoDestinos';
import BlocoFinanceiro from './BlocoFinanceiro';
import { formatBRL } from '../../utils/formatBRL';

const corStatusEmbarque = {
    PROGRAMADA: { bg: 'rgba(96,165,250,0.15)', border: '#60a5fa', text: '#93c5fd' },
    EMBARCADA: { bg: 'rgba(74,222,128,0.15)', border: '#4ade80', text: '#86efac' },
    PENDENTE: { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fcd34d' },
};

function StatusBadge({ status }) {
    const cor = corStatusEmbarque[status] || corStatusEmbarque.PROGRAMADA;
    return (
        <span style={{
            background: cor.bg, border: `1px solid ${cor.border}`,
            color: cor.text, padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        }}>{status || 'PROGRAMADA'}</span>
    );
}

export default function CardRota({
    rota, entregas = [], expanded, onToggle,
    abaAtiva, podeEditarOperacional, podeEditarFinanceiro,
    onSalvarRota, onAlteradoEntregas,
}) {
    const primeiroDestino = entregas[0];
    const temFinanceiro = abaAtiva === 'ELETRIK';

    return (
        <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            marginBottom: 8,
            overflow: 'hidden',
            transition: 'all 0.2s',
        }}>
            {/* HEADER */}
            <div onClick={onToggle} style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer',
                userSelect: 'none',
                background: expanded ? 'rgba(30,41,59,0.4)' : 'transparent',
            }}>
                <span style={{
                    background: 'rgba(167,139,250,0.15)',
                    color: '#a78bfa', fontWeight: 700, fontSize: 13,
                    padding: '4px 10px', borderRadius: 5, minWidth: 40, textAlign: 'center',
                }}>#{rota.numero_rota ?? '?'}</span>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>
                        {rota.motorista_nome || <em style={{ color: '#64748b' }}>sem motorista</em>}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Truck size={10} /> {rota.tipo_veiculo || '—'}
                    </span>
                </div>

                <StatusBadge status={rota.status_embarque} />

                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                    Coleta <strong style={{ color: '#e2e8f0' }}>{rota.coleta || '—'}</strong>
                </span>

                <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} />
                    {primeiroDestino
                        ? `${primeiroDestino.cidade || '?'}/${primeiroDestino.uf || '?'}${entregas.length > 1 ? ` +${entregas.length - 1}` : ''}`
                        : <em style={{ color: '#64748b' }}>sem destinos</em>
                    }
                </span>

                {temFinanceiro && rota.valor_carga != null && (
                    <span style={{
                        marginLeft: 'auto', color: '#a78bfa', fontSize: 12,
                        fontFamily: 'monospace',
                    }}>
                        {formatBRL(rota.valor_carga)} · Frete {formatBRL(rota.valor_frete)}
                        {rota.representatividade_pct != null && ` (${Number(rota.representatividade_pct).toFixed(2)}%)`}
                    </span>
                )}

                <ChevronDown size={16} color="#64748b" style={{
                    marginLeft: temFinanceiro && rota.valor_carga != null ? 8 : 'auto',
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                }} />
            </div>

            {/* EXPANDIDO */}
            {expanded && (
                <>
                    <BlocoDadosRota rota={rota} podeEditar={podeEditarOperacional} onSalvar={onSalvarRota} />
                    <BlocoDestinos rota={rota} entregas={entregas} podeEditar={podeEditarOperacional} onAlterado={onAlteradoEntregas} />
                    {temFinanceiro && (
                        <BlocoFinanceiro rota={rota} podeEditar={podeEditarFinanceiro} onSalvar={onSalvarRota} />
                    )}
                </>
            )}
        </div>
    );
}
