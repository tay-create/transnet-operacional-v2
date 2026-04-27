import React, { useState, useEffect, useCallback } from 'react';
import { Truck, RefreshCw, FileText, Package, Search, Lock, X } from 'lucide-react';
import api from '../services/apiService';

// Cores idênticas ao CORES_STATUS do desktop (src/constants.js)
const STATUS_COR = {
    'AGUARDANDO':                '#94a3b8',
    'EM SEPARAÇÃO':              '#facc15',
    'LIBERADO P/ DOCA':          '#60a5fa',
    'LIBERADO P/ CARREGAMENTO':  '#60a5fa',
    'EM CARREGAMENTO':           '#fb923c',
    'CARREGADO':                 '#4ade80',
    'LIBERADO P/ CT-e':          '#c084fc',
};

// Valor no banco é 'LIBERADO P/ DOCA' mas o nome exibido é 'LIBERADO P/ CARREGAMENTO'
const traduzirStatus = st => st === 'LIBERADO P/ DOCA' ? 'LIBERADO P/ CARREGAMENTO' : st;

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '71,85,105';
}

function parseFotos(raw) {
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function MobileOperacional() {
    const [fotoAmpliada, setFotoAmpliada] = useState(null);
    const [origem, setOrigem] = useState('Recife');
    const [todosVeiculos, setTodosVeiculos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState(null);
    const [puxando, setPuxando] = useState(false);
    const [startY, setStartY] = useState(null);

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/veiculos?limit=500');
            if (r.data.success) setTodosVeiculos(r.data.veiculos || []);
        } catch (e) { console.error(e); }
        finally { setCarregando(false); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    // Filtro igual ao PainelOperacional.js
    const veiculos = todosVeiculos.filter(v => {
        // Filtro de data — igual a PainelOperacional.js linha 437
        const dataRef = (origem === 'Recife' ? v.data_carregado_recife : v.data_carregado_moreno)
            || v.data_prevista || hoje;
        const dataV = (dataRef || '').split('T')[0];
        if (dataV < dataInicio || dataV > dataFim) return false;

        // Filtro de origem — igual a PainelOperacional.js linha 444
        const op = v.operacao || '';
        const envolveOrigem = origem === 'Recife'
            ? op.includes('RECIFE')
            : op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');
        if (!envolveOrigem) return false;

        // Busca por nome/coleta
        if (busca.trim()) {
            const b = busca.toLowerCase();
            const coleta = origem === 'Recife' ? (v.coletaRecife || '') : (v.coletaMoreno || '');
            if (
                !(v.motorista || '').toLowerCase().includes(b) &&
                !coleta.toLowerCase().includes(b) &&
                !(v.placa1Motorista || v.placa || '').toLowerCase().includes(b)
            ) return false;
        }

        return true;
    });

    const status = v => origem === 'Recife' ? (v.status_recife || 'AGUARDANDO') : (v.status_moreno || 'AGUARDANDO');
    const doca = v => origem === 'Recife' ? v.doca_recife : v.doca_moreno;
    const coleta = v => origem === 'Recife' ? v.coletaRecife : v.coletaMoreno;

    const contsPorStatus = veiculos.reduce((acc, v) => {
        const s = status(v);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    // Aplicar filtro de status (após calcular contagens)
    const veiculosFiltrados = filtroStatus
        ? veiculos.filter(v => status(v) === filtroStatus)
        : veiculos;

    // Resetar filtro quando mudar origem/datas/busca
    useEffect(() => { setFiltroStatus(null); }, [origem, dataInicio, dataFim, busca]);

    // Pull to refresh
    const onTouchStart = (e) => setStartY(e.touches[0].clientY);
    const onTouchEnd = (e) => {
        if (startY !== null && e.changedTouches[0].clientY - startY > 80) carregar();
        setStartY(null); setPuxando(false);
    };
    const onTouchMove = (e) => {
        if (startY !== null && e.touches[0].clientY - startY > 40) setPuxando(true);
    };

    return (
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>

            {/* Modal foto ampliada */}
            {fotoAmpliada && (
                <div onClick={() => setFotoAmpliada(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
                    zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <button onClick={() => setFotoAmpliada(null)} style={{
                        position: 'absolute', top: 16, right: 16,
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                        <X size={18} color="#f1f5f9" />
                    </button>
                    <img src={fotoAmpliada} alt="Lacre" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
                </div>
            )}

            {/* Header fixo */}
            <div style={{ background: '#0f172a', padding: '16px 16px 10px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '10px' }}>
                    Painel Operacional
                </div>

                {/* Toggle Recife/Moreno */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {['Recife', 'Moreno'].map(o => (
                        <button key={o} onClick={() => setOrigem(o)} style={{
                            flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                            background: origem === o ? '#3b82f6' : '#1e293b',
                            color: origem === o ? '#fff' : '#64748b',
                            fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>{o}</button>
                    ))}
                </div>

                {/* Filtro de data */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                        style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 8px', fontSize: '13px' }} />
                    <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                        style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 8px', fontSize: '13px' }} />
                    <button onClick={() => { setDataInicio(hoje); setDataFim(hoje); }} style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                        color: '#60a5fa', fontSize: '12px', padding: '6px 10px', cursor: 'pointer', fontWeight: '600',
                        WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
                    }}>Hoje</button>
                </div>

                {/* Busca */}
                <div style={{ position: 'relative' }}>
                    <Search size={14} color="#475569" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        type="text" value={busca} onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome, coleta ou placa..."
                        style={{
                            width: '100%', background: '#1e293b', border: '1px solid #334155',
                            borderRadius: '8px', color: '#f1f5f9', padding: '7px 10px 7px 30px',
                            fontSize: '13px', outline: 'none',
                        }}
                    />
                </div>
            </div>

            {puxando && <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#3b82f6' }}>↓ Solte para atualizar</div>}

            {/* Pills de status */}
            {veiculos.length > 0 && (
                <div style={{ padding: '8px 16px', display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <button onClick={() => setFiltroStatus(null)} style={{
                        flexShrink: 0, background: filtroStatus === null ? '#334155' : '#1e293b',
                        borderRadius: '6px', padding: '4px 10px', fontSize: '11px',
                        color: filtroStatus === null ? '#f1f5f9' : '#94a3b8', fontWeight: '600',
                        border: filtroStatus === null ? '1px solid #475569' : '1px solid transparent',
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    }}>
                        {veiculos.length} total
                    </button>
                    {Object.entries(contsPorStatus).map(([s, qtd]) => {
                        const cor = STATUS_COR[s] || '#475569';
                        const ativo = filtroStatus === s;
                        return (
                            <button key={s} onClick={() => setFiltroStatus(f => f === s ? null : s)} style={{
                                flexShrink: 0, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700',
                                background: ativo ? `rgba(${hexToRgb(cor)},0.25)` : `rgba(${hexToRgb(cor)},0.08)`,
                                color: cor,
                                border: ativo ? `1px solid ${cor}` : `1px solid rgba(${hexToRgb(cor)},0.25)`,
                                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                                opacity: filtroStatus && !ativo ? 0.5 : 1,
                            }}>
                                {traduzirStatus(s)}: {qtd}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Lista */}
            <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : veiculosFiltrados.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                            <Truck size={32} color="#334155" strokeWidth={1.5} />
                        </div>
                        <div style={{ fontSize: '13px' }}>
                            {filtroStatus ? `Nenhum veículo com status "${traduzirStatus(filtroStatus)}".` : 'Nenhum veículo neste período.'}
                        </div>
                    </div>
                ) : veiculosFiltrados.map(v => {
                    const st = status(v);
                    const cor = STATUS_COR[st] || '#475569';
                    const placa = v.placa1Motorista || v.placa || '—';
                    const placa2 = v.placa2Motorista || '';
                    const docaV = doca(v);
                    const coletaV = coleta(v);
                    const cteEmitido = v.numero_cte;
                    const campoLacre = origem === 'Moreno' ? v.foto_lacre_moreno : v.foto_lacre_recife;
                    const fotosLacre = parseFotos(campoLacre);
                    return (
                        <div key={v.id} style={{
                            background: '#0f172a', border: '1px solid #1e293b',
                            borderLeft: `3px solid ${cor}`, borderRadius: '12px', padding: '12px 14px',
                        }}>
                            {/* Placa + status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{
                                        fontFamily: 'monospace', fontWeight: '800', fontSize: '13px',
                                        color: '#fb923c', background: 'rgba(251,146,60,0.08)',
                                        padding: '2px 7px', borderRadius: '5px', border: '1px solid rgba(251,146,60,0.2)',
                                    }}>{placa}</span>
                                    {placa2 && (
                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>+{placa2}</span>
                                    )}
                                </div>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                                    background: `rgba(${hexToRgb(cor)},0.12)`, color: cor,
                                    border: `1px solid rgba(${hexToRgb(cor)},0.3)`, whiteSpace: 'nowrap',
                                }}>{traduzirStatus(st)}</span>
                            </div>

                            {/* Motorista */}
                            <div style={{ fontSize: '13px', color: v.motorista ? '#cbd5e1' : '#334155', fontWeight: '600', marginBottom: '5px' }}>
                                {v.motorista || '— Sem motorista'}
                            </div>

                            {/* Detalhes */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {docaV && (
                                    <span style={{ fontSize: '11px', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <Package size={10} color="#475569" strokeWidth={2} /> {docaV}
                                    </span>
                                )}
                                {v.operacao && (
                                    <span style={{ fontSize: '11px', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <RefreshCw size={10} color="#475569" strokeWidth={2} /> {v.operacao}
                                    </span>
                                )}
                                {coletaV && (
                                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                        Col. {coletaV}
                                    </span>
                                )}
                                {cteEmitido && (
                                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <FileText size={10} color="#22c55e" strokeWidth={2} /> CT-e {v.numero_cte}
                                    </span>
                                )}
                            </div>

                            {/* Fotos do lacre */}
                            {fotosLacre.length > 0 && (
                                <div style={{ marginTop: 10, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                                        <Lock size={10} color="#4ade80" strokeWidth={2} />
                                        <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Lacre ({fotosLacre.length})
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {fotosLacre.map((foto, i) => (
                                            <img
                                                key={i}
                                                src={foto}
                                                alt={`Lacre ${i + 1}`}
                                                onClick={() => setFotoAmpliada(foto)}
                                                style={{
                                                    width: 56, height: 56, objectFit: 'cover',
                                                    borderRadius: 6, border: '1px solid rgba(74,222,128,0.25)',
                                                    cursor: 'pointer',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
