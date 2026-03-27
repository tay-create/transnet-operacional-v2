import React, { useState, useEffect, useRef } from 'react';
import api from '../services/apiService';

const TELAS = ['Embarques', 'Operação', 'CT-e'];

const STATUS_COR = {
    'LIBERADO': '#22c55e', 'AGUARDANDO CTE': '#f59e0b', 'EM OPERAÇÃO': '#3b82f6',
    'CARREGANDO': '#a78bfa', 'CARREGADO': '#06b6d4', 'PENDENTE': '#f97316', 'CHEGOU': '#10b981',
};

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '71,85,105';
}

export default function MobileDashboardTV({ socket }) {
    const [tela, setTela] = useState(0);
    const [autoplay, setAutoplay] = useState(true);
    const [veiculos, setVeiculos] = useState([]);
    const [ctes, setCtes] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const touchStartX = useRef(null);

    useEffect(() => {
        const carregar = async () => {
            setCarregando(true);
            try {
                const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
                const [v, c] = await Promise.allSettled([
                    api.get('/veiculos'),
                    api.get(`/ctes?dataInicio=${hoje}&dataFim=${hoje}`),
                ]);
                if (v.status === 'fulfilled' && v.value.data.success) setVeiculos(v.value.data.veiculos || []);
                if (c.status === 'fulfilled' && c.value.data.success) setCtes(c.value.data.ctes || []);
            } catch (e) { console.error(e); }
            finally { setCarregando(false); }
        };
        carregar();
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handler = () => {
            api.get('/veiculos').then(r => { if (r.data.success) setVeiculos(r.data.veiculos || []); });
        };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket]);

    useEffect(() => {
        if (!autoplay) return;
        const id = setInterval(() => setTela(t => (t + 1) % TELAS.length), 12000);
        return () => clearInterval(id);
    }, [autoplay]);

    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) {
            setAutoplay(false);
            setTela(t => dx < 0 ? (t + 1) % TELAS.length : (t - 1 + TELAS.length) % TELAS.length);
        }
        touchStartX.current = null;
    };

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
    const veiculosHoje = veiculos.filter(v => (v.data_entrada || '').split('T')[0] === hoje);
    const ctesRecife = ctes.filter(c => c.origem === 'Recife');
    const ctesMoreno = ctes.filter(c => c.origem !== 'Recife');
    const contsPorStatus = veiculosHoje.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {});

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9' }}>Dashboard TV</div>
                    <button onClick={() => setAutoplay(a => !a)} style={{
                        background: autoplay ? 'rgba(167,139,250,0.12)' : '#1e293b',
                        border: `1px solid ${autoplay ? 'rgba(167,139,250,0.3)' : '#334155'}`,
                        borderRadius: '8px', color: autoplay ? '#a78bfa' : '#475569',
                        fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                    }}>
                        {autoplay ? '⏸ Auto' : '▶ Auto'}
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    {TELAS.map((nome, i) => (
                        <button key={i} onClick={() => { setTela(i); setAutoplay(false); }} style={{
                            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: tela === i ? '2px solid #a78bfa' : '2px solid transparent',
                            color: tela === i ? '#a78bfa' : '#475569',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>
                            {nome}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conteúdo com swipe */}
            <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ padding: '16px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : (
                    <>
                        {/* TELA 0: Embarques */}
                        {tela === 0 && (
                            <div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Hoje · {veiculosHoje.length} embarques
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                    {Object.entries(contsPorStatus).map(([status, qtd]) => {
                                        const cor = STATUS_COR[status] || '#475569';
                                        return (
                                            <div key={status} style={{
                                                background: `rgba(${hexToRgb(cor)},0.06)`,
                                                border: `1px solid rgba(${hexToRgb(cor)},0.2)`,
                                                borderLeft: `3px solid ${cor}`,
                                                borderRadius: '10px', padding: '12px 14px',
                                            }}>
                                                <div style={{ fontSize: '28px', fontWeight: '800', color: cor }}>{qtd}</div>
                                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{status}</div>
                                            </div>
                                        );
                                    })}
                                    {Object.keys(contsPorStatus).length === 0 && (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px', color: '#334155' }}>
                                            <div style={{ fontSize: '24px' }}>🚛</div>
                                            <div style={{ fontSize: '12px', marginTop: '8px' }}>Nenhum embarque hoje.</div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {veiculosHoje.slice(0, 20).map(v => {
                                        const cor = STATUS_COR[v.status] || '#475569';
                                        return (
                                            <div key={v.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: '#0f172a', border: '1px solid #1e293b',
                                                borderLeft: `3px solid ${cor}`, borderRadius: '8px', padding: '10px 12px',
                                            }}>
                                                <div>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb923c', fontWeight: '700' }}>{v.placa}</span>
                                                    {v.motorista && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>{v.motorista.split(' ')[0]}</span>}
                                                </div>
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: cor }}>{v.status}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TELA 1: Todos os veículos */}
                        {tela === 1 && (
                            <div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Todos os Veículos · {veiculos.length}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {veiculos.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>Nenhum veículo.</div>
                                    ) : veiculos.slice(0, 40).map(v => {
                                        const cor = STATUS_COR[v.status] || '#475569';
                                        return (
                                            <div key={v.id} style={{
                                                background: '#0f172a', border: '1px solid #1e293b',
                                                borderLeft: `3px solid ${cor}`, borderRadius: '8px',
                                                padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            }}>
                                                <div>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb923c', fontWeight: '700' }}>{v.placa}</span>
                                                    {v.motorista && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>{v.motorista.split(' ').slice(0,2).join(' ')}</span>}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: cor }}>{v.status}</div>
                                                    {v.origem && <div style={{ fontSize: '10px', color: '#334155' }}>{v.origem}</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {veiculos.length > 40 && <div style={{ textAlign: 'center', fontSize: '11px', color: '#475569', padding: '8px' }}>+{veiculos.length - 40} mais</div>}
                                </div>
                            </div>
                        )}

                        {/* TELA 2: CT-e */}
                        {tela === 2 && (
                            <div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CT-e de Hoje</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                    {[
                                        { label: 'Recife', qtd: ctesRecife.length, cor: '#3b82f6' },
                                        { label: 'Moreno', qtd: ctesMoreno.length, cor: '#22c55e' },
                                        { label: 'Total', qtd: ctes.length, cor: '#a78bfa' },
                                        { label: 'Com CT-e', qtd: ctes.filter(c => c.numero_cte).length, cor: '#f59e0b' },
                                    ].map(item => (
                                        <div key={item.label} style={{
                                            background: `rgba(${hexToRgb(item.cor)},0.06)`,
                                            border: `1px solid rgba(${hexToRgb(item.cor)},0.2)`,
                                            borderLeft: `3px solid ${item.cor}`,
                                            borderRadius: '10px', padding: '12px 14px',
                                        }}>
                                            <div style={{ fontSize: '28px', fontWeight: '800', color: item.cor }}>{item.qtd}</div>
                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {ctes.slice(0, 20).map(v => (
                                        <div key={v.id} style={{
                                            background: '#0f172a', border: '1px solid #1e293b',
                                            borderLeft: `3px solid ${v.origem === 'Recife' ? '#3b82f6' : '#22c55e'}`,
                                            borderRadius: '8px', padding: '10px 12px',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <div>
                                                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb923c', fontWeight: '700' }}>{v.placa}</span>
                                                {v.motorista && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>{v.motorista.split(' ')[0]}</span>}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {v.numero_cte ? <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '700' }}>✅ {v.numero_cte}</div> : <div style={{ fontSize: '10px', color: '#f59e0b' }}>{v.status}</div>}
                                                <div style={{ fontSize: '10px', color: '#334155' }}>{v.origem}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {ctes.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '32px', color: '#334155' }}>
                                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                                            <div style={{ fontSize: '12px' }}>Nenhum CT-e hoje.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Dots indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0 16px' }}>
                {TELAS.map((_, i) => (
                    <div key={i} style={{
                        width: tela === i ? '16px' : '6px', height: '6px',
                        borderRadius: '3px', background: tela === i ? '#a78bfa' : '#1e293b',
                        transition: 'width 0.3s, background 0.3s',
                    }} />
                ))}
            </div>
        </div>
    );
}
