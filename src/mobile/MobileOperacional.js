import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';

const STATUS_COR = {
    'LIBERADO': '#22c55e',
    'AGUARDANDO CTE': '#f59e0b',
    'EM OPERAÇÃO': '#3b82f6',
    'CARREGANDO': '#a78bfa',
    'CARREGADO': '#06b6d4',
    'PENDENTE': '#f97316',
    'CHEGOU': '#10b981',
};

const STATUS_LABEL = {
    'LIBERADO': 'Liberado',
    'AGUARDANDO CTE': 'Aguard. CT-e',
    'EM OPERAÇÃO': 'Em Operação',
    'CARREGANDO': 'Carregando',
    'CARREGADO': 'Carregado',
    'PENDENTE': 'Pendente',
    'CHEGOU': 'Chegou',
};

export default function MobileOperacional() {
    const [origem, setOrigem] = useState('Recife');
    const [veiculos, setVeiculos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [dataInicio, setDataInicio] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' }));
    const [dataFim, setDataFim] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' }));
    const [puxando, setPuxando] = useState(false);
    const [startY, setStartY] = useState(null);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/veiculos');
            if (r.data.success) {
                const todos = r.data.veiculos || [];
                const filtrados = todos.filter(v => {
                    if (v.origem !== origem) return false;
                    const dataV = v.data_entrada?.split('T')[0] || v.data_entrada;
                    return dataV >= dataInicio && dataV <= dataFim;
                });
                setVeiculos(filtrados);
            }
        } catch (e) { console.error(e); }
        finally { setCarregando(false); }
    }, [origem, dataInicio, dataFim]);

    useEffect(() => { carregar(); }, [carregar]);

    // Pull to refresh
    const onTouchStart = (e) => setStartY(e.touches[0].clientY);
    const onTouchEnd = (e) => {
        if (startY !== null && e.changedTouches[0].clientY - startY > 80) carregar();
        setStartY(null);
        setPuxando(false);
    };
    const onTouchMove = (e) => {
        if (startY !== null && e.touches[0].clientY - startY > 40) setPuxando(true);
    };

    const contsPorStatus = veiculos.reduce((acc, v) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
    }, {});

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });

    return (
        <div
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 12px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '12px' }}>
                    Painel Operacional
                </div>

                {/* Toggle Recife/Moreno */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {['Recife', 'Moreno'].map(o => (
                        <button key={o} onClick={() => setOrigem(o)} style={{
                            flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                            background: origem === o ? '#3b82f6' : '#1e293b',
                            color: origem === o ? '#fff' : '#64748b',
                            fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>
                            {o}
                        </button>
                    ))}
                </div>

                {/* Filtro de data */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                        style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                    <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                        style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                    <button onClick={() => { setDataInicio(hoje); setDataFim(hoje); }} style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                        color: '#60a5fa', fontSize: '12px', padding: '6px 10px', cursor: 'pointer', fontWeight: '600',
                        WebkitTapHighlightColor: 'transparent',
                    }}>Hoje</button>
                </div>
            </div>

            {/* Indicador pull-to-refresh */}
            {puxando && (
                <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#3b82f6' }}>↓ Solte para atualizar</div>
            )}

            {/* Contadores por status */}
            {veiculos.length > 0 && (
                <div style={{ padding: '10px 16px', display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ flexShrink: 0, background: '#1e293b', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                        {veiculos.length} total
                    </div>
                    {Object.entries(contsPorStatus).map(([status, qtd]) => (
                        <div key={status} style={{
                            flexShrink: 0, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700',
                            background: `rgba(${hexToRgb(STATUS_COR[status] || '#475569')},0.12)`,
                            color: STATUS_COR[status] || '#475569',
                            border: `1px solid rgba(${hexToRgb(STATUS_COR[status] || '#475569')},0.3)`,
                        }}>
                            {STATUS_LABEL[status] || status}: {qtd}
                        </div>
                    ))}
                </div>
            )}

            {/* Lista de veículos */}
            <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : veiculos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#334155' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚛</div>
                        <div style={{ fontSize: '13px' }}>Nenhum veículo neste período.</div>
                    </div>
                ) : veiculos.map(v => {
                    const cor = STATUS_COR[v.status] || '#475569';
                    const cteEmitido = v.status === 'LIBERADO' && v.numero_cte;
                    return (
                        <div key={v.id} style={{
                            background: '#0f172a',
                            border: `1px solid #1e293b`,
                            borderLeft: `3px solid ${cor}`,
                            borderRadius: '12px',
                            padding: '14px 16px',
                        }}>
                            {/* Linha 1: Placa + Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{
                                        fontFamily: 'monospace', fontWeight: '800', fontSize: '14px',
                                        color: '#fb923c', letterSpacing: '1px',
                                        background: 'rgba(251,146,60,0.08)', padding: '2px 8px',
                                        borderRadius: '5px', border: '1px solid rgba(251,146,60,0.2)',
                                    }}>
                                        {v.placa || '—'}
                                    </span>
                                    {v.placa_carreta && (
                                        <span style={{
                                            fontFamily: 'monospace', fontWeight: '600', fontSize: '11px',
                                            color: '#64748b', letterSpacing: '0.5px',
                                        }}>
                                            +{v.placa_carreta}
                                        </span>
                                    )}
                                </div>
                                <span style={{
                                    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                                    background: `rgba(${hexToRgb(cor)},0.12)`, color: cor,
                                    border: `1px solid rgba(${hexToRgb(cor)},0.3)`,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {STATUS_LABEL[v.status] || v.status}
                                </span>
                            </div>

                            {/* Motorista */}
                            <div style={{ fontSize: '13px', color: v.motorista ? '#cbd5e1' : '#334155', fontWeight: '600', marginBottom: '4px' }}>
                                {v.motorista || '— Sem motorista'}
                            </div>

                            {/* Info adicional */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {v.doca && (
                                    <span style={{ fontSize: '11px', color: '#475569' }}>
                                        📦 Doca {v.doca}
                                    </span>
                                )}
                                {v.operacao && (
                                    <span style={{ fontSize: '11px', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        🔄 {v.operacao}
                                    </span>
                                )}
                                {cteEmitido && (
                                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '700' }}>
                                        ✅ CT-e {v.numero_cte}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '71,85,105';
}
