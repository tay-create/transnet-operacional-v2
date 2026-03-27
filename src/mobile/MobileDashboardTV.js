import React, { useState, useEffect, useRef } from 'react';
import { Truck, FileText, Play, Pause } from 'lucide-react';
import api from '../services/apiService';

const TELAS = ['Embarques', 'Operação', 'CT-e'];

const STATUS_COR = {
    'AGUARDANDO':        '#64748b',
    'EM SEPARAÇÃO':      '#a78bfa',
    'LIBERADO P/ DOCA':  '#f59e0b',
    'EM CARREGAMENTO':   '#3b82f6',
    'CARREGADO':         '#06b6d4',
    'LIBERADO P/ CT-e':  '#22c55e',
};

const CORES_OP = {
    delta:       '#2563eb',
    consolidado: '#3b82f6',
    deltaRxM:    '#60a5fa',
    porcelana:   '#a78bfa',
    eletrik:     '#f59e0b',
};

const LABELS_OP = {
    delta:       'Delta 100%',
    consolidado: 'Consolidado',
    deltaRxM:    'Delta RxM',
    porcelana:   'Porcelana',
    eletrik:     'Eletrik',
};

function classificarOperacao(op) {
    if (!op) return null;
    if (op === 'DELTA(RECIFE)' || op === 'DELTA(MORENO)') return 'delta';
    if (op === 'DELTA(RECIFE X MORENO)') return 'deltaRxM';
    if (op === 'PORCELANA') return 'porcelana';
    if (op === 'ELETRIK') return 'eletrik';
    if (op.includes('/')) return 'consolidado';
    return null;
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '71,85,105';
}

function KpiCard({ valor, label, cor }) {
    return (
        <div style={{
            background: `rgba(${hexToRgb(cor)},0.08)`,
            border: `1px solid rgba(${hexToRgb(cor)},0.25)`,
            borderTop: `3px solid ${cor}`,
            borderRadius: '12px', padding: '14px 10px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '36px', fontWeight: '900', color: cor, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        </div>
    );
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
                    api.get('/veiculos?limit=500'),
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
            api.get('/veiculos?limit=500').then(r => { if (r.data.success) setVeiculos(r.data.veiculos || []); });
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

    // Veículos do dia — filtra por data_prevista (igual ao PainelOperacional.js)
    const veiculosHoje = veiculos.filter(v => (v.data_prevista || '').split('T')[0] === hoje);

    // Tela 0 — Embarques: agrupa por operação
    const contOp = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
    veiculosHoje.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat) contOp[cat]++;
    });
    const totalGeral = Object.values(contOp).reduce((a, b) => a + b, 0);

    const statusCte = {
        aguardando: ctes.filter(c => c.status === 'Aguardando Emissão' || c.status === 'Aguardando Emissao').length,
        emEmissao:  ctes.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length,
        emitido:    ctes.filter(c => c.status === 'Emitido').length,
    };

    // Tela 1 — Operação: contagem por status (só números)
    const statusRecife = {};
    const statusMoreno = {};
    veiculosHoje.forEach(v => {
        if (v.status_recife) statusRecife[v.status_recife] = (statusRecife[v.status_recife] || 0) + 1;
        if (v.status_moreno) statusMoreno[v.status_moreno] = (statusMoreno[v.status_moreno] || 0) + 1;
    });

    // Tela 2 — CT-e
    const ctesRecife = ctes.filter(c => c.origem === 'Recife');
    const ctesMoreno = ctes.filter(c => c.origem !== 'Recife');

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9' }}>Dashboard</div>
                    <button onClick={() => setAutoplay(a => !a)} style={{
                        background: autoplay ? 'rgba(167,139,250,0.12)' : '#1e293b',
                        border: `1px solid ${autoplay ? 'rgba(167,139,250,0.3)' : '#334155'}`,
                        borderRadius: '8px', color: autoplay ? '#a78bfa' : '#475569',
                        fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                        {autoplay ? <Pause size={11} strokeWidth={2} /> : <Play size={11} strokeWidth={2} />}
                        Auto
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
                        }}>{nome}</button>
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
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Hoje — {new Date().toLocaleDateString('pt-BR')}
                                </div>

                                {/* Total geral */}
                                <div style={{
                                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                    borderLeft: '4px solid #3b82f6', borderRadius: '12px',
                                    padding: '16px', textAlign: 'center', marginBottom: '14px',
                                }}>
                                    <div style={{ fontSize: '56px', fontWeight: '900', color: '#3b82f6', lineHeight: 1 }}>{totalGeral}</div>
                                    <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Embarques</div>
                                </div>

                                {/* KPIs por operação */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                                    {Object.entries(contOp).map(([key, val]) => (
                                        <KpiCard key={key} valor={val} label={LABELS_OP[key]} cor={CORES_OP[key]} />
                                    ))}
                                </div>

                                {/* Status CT-e */}
                                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ fontSize: '10px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Status CT-e</div>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        {[
                                            { label: 'Aguardando', valor: statusCte.aguardando, cor: '#f59e0b' },
                                            { label: 'Em Emissão', valor: statusCte.emEmissao,  cor: '#3b82f6' },
                                            { label: 'Emitidos',   valor: statusCte.emitido,    cor: '#22c55e' },
                                        ].map(s => (
                                            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '28px', fontWeight: '900', color: s.cor }}>{s.valor}</span>
                                                <span style={{ fontSize: '11px', color: '#475569' }}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TELA 1: Operação — só números */}
                        {tela === 1 && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Operação Hoje · {veiculosHoje.length} veículos
                                </div>

                                {Object.keys(statusRecife).length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Recife</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {Object.entries(statusRecife).map(([st, qtd]) => (
                                                <KpiCard key={st} valor={qtd} label={st} cor={STATUS_COR[st] || '#475569'} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {Object.keys(statusMoreno).length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Moreno</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {Object.entries(statusMoreno).map(([st, qtd]) => (
                                                <KpiCard key={st} valor={qtd} label={st} cor={STATUS_COR[st] || '#475569'} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {veiculosHoje.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                            <Truck size={28} color="#334155" strokeWidth={1.5} />
                                        </div>
                                        <div style={{ fontSize: '12px' }}>Nenhum veículo hoje.</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TELA 2: CT-e */}
                        {tela === 2 && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CT-e de Hoje</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                    {[
                                        { label: 'Recife',   qtd: ctesRecife.length,                       cor: '#3b82f6' },
                                        { label: 'Moreno',   qtd: ctesMoreno.length,                       cor: '#22c55e' },
                                        { label: 'Total',    qtd: ctes.length,                             cor: '#a78bfa' },
                                        { label: 'Com CT-e', qtd: ctes.filter(c => c.numero_cte).length,   cor: '#f59e0b' },
                                    ].map(item => (
                                        <KpiCard key={item.label} valor={item.qtd} label={item.label} cor={item.cor} />
                                    ))}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {ctes.slice(0, 30).map(v => {
                                        const corOrigem = v.origem === 'Recife' ? '#3b82f6' : '#22c55e';
                                        const placa = v.placa1Motorista || v.placa || 'Não inf.';
                                        return (
                                            <div key={v.id} style={{
                                                background: '#0f172a', border: '1px solid #1e293b',
                                                borderLeft: `3px solid ${corOrigem}`, borderRadius: '8px',
                                                padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            }}>
                                                <div>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb923c', fontWeight: '700' }}>{placa}</span>
                                                    {v.motorista && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>{v.motorista.split(' ')[0]}</span>}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    {v.numero_cte
                                                        ? <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                                                            <FileText size={10} color="#4ade80" strokeWidth={2} /> {v.numero_cte}
                                                          </div>
                                                        : <div style={{ fontSize: '10px', color: '#f59e0b' }}>{v.status}</div>
                                                    }
                                                    <div style={{ fontSize: '10px', color: '#334155' }}>{v.origem}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {ctes.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '32px', color: '#334155' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                                <FileText size={24} color="#334155" strokeWidth={1.5} />
                                            </div>
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
