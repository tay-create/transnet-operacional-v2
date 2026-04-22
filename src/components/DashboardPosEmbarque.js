import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';
import {
    Clock, MapPin, Truck, User, AlertTriangle, AlertCircle,
    CheckCircle, RefreshCw
} from 'lucide-react';

// ──────────── Helpers ────────────────────────────────────
const formatData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function parseDatetime(data, hora) {
    // data_criacao / data_conclusao podem ser ISO completo ou "YYYY-MM-DD"
    if (data && data.length > 10) return new Date(data); // ISO completo — usa direto
    const d = (data || '').substring(0, 10);
    const h = (hora || '00:00').substring(0, 5);
    // Append -03:00 (Brasília) para evitar interpretação UTC
    return new Date(`${d}T${h}:00-03:00`);
}

function calcularHorasAtraso(oc) {
    // Prefere data_criacao (ISO preciso) como início; fallback para data_ocorrencia+hora
    const inicio = oc.data_criacao
        ? parseDatetime(oc.data_criacao, null)
        : parseDatetime(oc.data_ocorrencia, oc.hora_ocorrencia);
    const fim = oc.situacao === 'RESOLVIDO'
        ? parseDatetime(oc.data_conclusao, oc.hora_conclusao)
        : new Date();
    return (fim - inicio) / (60 * 60 * 1000);
}

function verificarAtraso(oc) {
    return calcularHorasAtraso(oc) > 24;
}

function getStatusDisplay(oc) {
    if (oc.situacao === 'RESOLVIDO') return { label: 'RESOLVIDO', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', glow: '0 0 12px rgba(34,197,94,0.4)' };
    const h = calcularHorasAtraso(oc);
    if (h > 48) {
        const dias = Math.floor(h / 24);
        return { label: `ATRASADO +${dias}D`, color: '#ff1744', bg: 'rgba(255,23,68,0.2)', glow: '0 0 16px rgba(255,23,68,0.5)' };
    }
    if (h > 24) return { label: 'ATRASADO +24H', color: '#ff5252', bg: 'rgba(255,82,82,0.15)', glow: '0 0 12px rgba(255,82,82,0.4)' };
    return { label: 'EM ANDAMENTO', color: '#ff9100', bg: 'rgba(255,145,0,0.15)', glow: '0 0 10px rgba(255,145,0,0.3)' };
}

function getTempoLabel(oc) {
    const h = calcularHorasAtraso(oc);
    const dias = Math.floor(h / 24);
    const horas = Math.floor(h % 24);
    if (dias >= 1) return `${dias}d ${horas}h`;
    return `${Math.floor(h)}h`;
}

function getBordaEsquerda(oc) {
    if (oc.situacao === 'RESOLVIDO') return '#00e676';
    const h = calcularHorasAtraso(oc);
    if (h > 48) return '#ff1744';
    if (h > 24) return '#ff5252';
    return '#ff9100';
}

function getCardGlow(oc) {
    if (oc.situacao === 'RESOLVIDO') return '0 0 20px rgba(0,230,118,0.15)';
    const h = calcularHorasAtraso(oc);
    if (h > 48) return '0 0 25px rgba(255,23,68,0.25), 0 0 50px rgba(255,23,68,0.1)';
    if (h > 24) return '0 0 20px rgba(255,82,82,0.2)';
    return '0 0 15px rgba(255,145,0,0.15)';
}

function ordenarOcorrencias(lista) {
    return [...lista].sort((a, b) => {
        const aEm = a.situacao === 'Em Andamento';
        const bEm = b.situacao === 'Em Andamento';
        const aAt = aEm && verificarAtraso(a);
        const bAt = bEm && verificarAtraso(b);
        if (aAt && !bAt) return -1;
        if (!aAt && bAt) return 1;
        if (aAt && bAt) return calcularHorasAtraso(b) - calcularHorasAtraso(a);
        if (aEm && !bEm) return -1;
        if (!aEm && bEm) return 1;
        return 0;
    });
}

// ──────────── CSS Animações ────────────────────────────────────
const neonCSS = `
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
@keyframes neonPulse {
    0%, 100% { text-shadow: 0 0 10px rgba(0,229,255,0.6), 0 0 20px rgba(0,229,255,0.4), 0 0 40px rgba(0,229,255,0.2); }
    50% { text-shadow: 0 0 20px rgba(0,229,255,0.8), 0 0 40px rgba(0,229,255,0.5), 0 0 60px rgba(0,229,255,0.3); }
}
@keyframes borderGlow {
    0%, 100% { border-color: rgba(0,229,255,0.3); box-shadow: 0 0 15px rgba(0,229,255,0.1); }
    50% { border-color: rgba(0,229,255,0.6); box-shadow: 0 0 25px rgba(0,229,255,0.2); }
}
@keyframes kpiGlow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.2); }
}
@keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes gradientMove {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}
@keyframes cardPulseRed {
    0%, 100% { box-shadow: 0 0 20px rgba(255,23,68,0.15); }
    50% { box-shadow: 0 0 35px rgba(255,23,68,0.3), 0 0 60px rgba(255,23,68,0.1); }
}
@keyframes cardPulseGreen {
    0%, 100% { box-shadow: 0 0 15px rgba(0,230,118,0.1); }
    50% { box-shadow: 0 0 25px rgba(0,230,118,0.2); }
}
`;

// ──────────── Componente Principal ────────────────────────────────────
export default function DashboardPosEmbarque({ socket }) {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [loading, setLoading] = useState(true);

    const carregar = useCallback(async () => {
        try {
            const { data } = await api.get('/api/posembarque/ocorrencias?arquivado=0');
            if (data.success) setOcorrencias(ordenarOcorrencias(data.ocorrencias));
        } catch (e) {
            console.error('Erro ao carregar ocorrências:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    // Socket.io — tempo real
    useEffect(() => {
        if (!socket) return;
        const handler = () => carregar();
        socket.on('posembarque_atualizada', handler);
        return () => socket.off('posembarque_atualizada', handler);
    }, [socket, carregar]);

    // ── KPIs ──
    const emAndamento = ocorrencias.filter(o => o.situacao === 'Em Andamento');
    const resolvidas = ocorrencias.filter(o => o.situacao === 'RESOLVIDO');
    const atrasadas = emAndamento.filter(o => verificarAtraso(o));

    const kpis = [
        { label: 'EM ANDAMENTO', valor: emAndamento.length, cor: '#ff9100', corGlow: 'rgba(255,145,0,0.4)', icon: <Clock size={28} /> },
        { label: 'RESOLVIDAS', valor: resolvidas.length, cor: '#00e676', corGlow: 'rgba(0,230,118,0.4)', icon: <CheckCircle size={28} /> },
        { label: '+24 HORAS', valor: atrasadas.length, cor: '#ff1744', corGlow: 'rgba(255,23,68,0.4)', icon: <AlertTriangle size={28} /> },
        { label: 'TOTAL GERAL', valor: ocorrencias.length, cor: '#00e5ff', corGlow: 'rgba(0,229,255,0.4)', icon: <AlertCircle size={28} /> },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#00e5ff' }}>
                <style>{neonCSS}</style>
                <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' }} />
                <span style={{ marginLeft: 14, fontSize: 18, textShadow: '0 0 10px rgba(0,229,255,0.5)' }}>Carregando ocorrências...</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', color: '#f1f5f9', minHeight: '100vh' }}>
            <style>{neonCSS}</style>

            {/* ── KPI BAR ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {kpis.map((k, i) => (
                    <div key={i} style={{
                        background: 'rgba(10,15,30,0.8)',
                        backdropFilter: 'blur(16px)',
                        border: `1px solid ${k.cor}44`,
                        borderBottom: `3px solid ${k.cor}`,
                        borderRadius: '16px',
                        padding: '22px 16px',
                        textAlign: 'center',
                        boxShadow: `0 0 20px ${k.corGlow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                        animation: `slideIn 0.5s ease ${i * 0.1}s both, kpiGlow 3s ease-in-out infinite`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8, color: k.cor, filter: `drop-shadow(0 0 6px ${k.corGlow})` }}>
                            {k.icon}
                            <span style={{ fontSize: 38, fontWeight: 'bold', textShadow: `0 0 15px ${k.corGlow}` }}>{k.valor}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: k.cor, letterSpacing: 2, opacity: 0.85 }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* ── HEADER ── */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 style={{
                    fontSize: '26px', fontWeight: 'bold', margin: 0, letterSpacing: 4, color: '#00e5ff',
                    animation: 'neonPulse 3s ease-in-out infinite',
                }}>
                    PAINEL DE OCORRÊNCIAS
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{
                        width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                        background: '#00e676',
                        boxShadow: '0 0 8px rgba(0,230,118,0.8), 0 0 16px rgba(0,230,118,0.4)',
                        animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ fontSize: 13, color: '#00e676', fontWeight: 600, textShadow: '0 0 8px rgba(0,230,118,0.4)' }}>Online — Tempo Real</span>
                </div>
                {/* Linha decorativa neon */}
                <div style={{
                    marginTop: 12, height: 2, maxWidth: 300, margin: '12px auto 0',
                    background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)',
                    boxShadow: '0 0 10px rgba(0,229,255,0.5)',
                }} />
            </div>

            {/* ── GRID DE CARDS ── */}
            {ocorrencias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#00e5ff' }}>
                    <AlertCircle size={52} style={{ marginBottom: 14, opacity: 0.5, filter: 'drop-shadow(0 0 10px rgba(0,229,255,0.5))' }} />
                    <p style={{ fontSize: 17, textShadow: '0 0 10px rgba(0,229,255,0.3)' }}>Nenhuma ocorrência ativa</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
                    {ocorrencias.map((oc, idx) => {
                        const status = getStatusDisplay(oc);
                        const bordaCor = getBordaEsquerda(oc);
                        const h = calcularHorasAtraso(oc);
                        const isAtrasado = oc.situacao !== 'RESOLVIDO' && h > 24;
                        const isResolvido = oc.situacao === 'RESOLVIDO';

                        return (
                            <div key={oc.id} style={{
                                background: 'rgba(10,15,30,0.85)',
                                backdropFilter: 'blur(16px)',
                                border: `1px solid ${bordaCor}44`,
                                borderLeft: `4px solid ${bordaCor}`,
                                borderRadius: '16px',
                                padding: 0,
                                overflow: 'hidden',
                                boxShadow: getCardGlow(oc),
                                animation: `slideIn 0.4s ease ${idx * 0.05}s both${isAtrasado && h > 48 ? ', cardPulseRed 2.5s ease-in-out infinite' : ''}${isResolvido ? ', cardPulseGreen 3s ease-in-out infinite' : ''}`,
                                transition: 'transform 0.3s, box-shadow 0.3s',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                                e.currentTarget.style.boxShadow = `0 0 35px ${bordaCor}44, 0 12px 40px rgba(0,0,0,0.5)`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = getCardGlow(oc);
                            }}
                            >
                                {/* TOPO: Status + Data/Hora */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 16px',
                                    borderBottom: `1px solid ${bordaCor}22`,
                                    background: `linear-gradient(135deg, ${bordaCor}11, transparent)`,
                                }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                        background: status.bg, color: status.color, letterSpacing: 0.5,
                                        boxShadow: status.glow,
                                        border: `1px solid ${status.color}33`,
                                    }}>
                                        {status.label}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                                        <Clock size={12} />
                                        {formatData(oc.data_ocorrencia)} {oc.hora_ocorrencia || ''}
                                    </div>
                                </div>

                                {/* CORPO */}
                                <div style={{ padding: '14px 16px' }}>
                                    {/* Operação + Tempo */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        {oc.operacao && (
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                background: 'rgba(0,229,255,0.1)', color: '#00e5ff',
                                                border: '1px solid rgba(0,229,255,0.3)',
                                                boxShadow: '0 0 8px rgba(0,229,255,0.2)',
                                            }}>
                                                OP: {oc.operacao}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: 12, fontWeight: 700,
                                            color: isResolvido ? '#00e676' : (isAtrasado ? '#ff5252' : '#ff9100'),
                                            textShadow: `0 0 8px ${isResolvido ? 'rgba(0,230,118,0.4)' : isAtrasado ? 'rgba(255,82,82,0.4)' : 'rgba(255,145,0,0.3)'}`,
                                        }}>
                                            <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                            {getTempoLabel(oc)}
                                        </span>
                                    </div>

                                    {/* Cliente */}
                                    <div style={{
                                        fontSize: 17, fontWeight: 'bold', color: '#e0f7fa', marginBottom: 8,
                                        textTransform: 'uppercase', letterSpacing: 0.5,
                                        textShadow: '0 0 6px rgba(0,229,255,0.15)',
                                    }}>
                                        {oc.cliente || '—'}
                                    </div>

                                    {/* Cidade */}
                                    {oc.cidade && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#80cbc4', fontSize: 13 }}>
                                            <MapPin size={14} style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.3))' }} /> {oc.cidade}
                                        </div>
                                    )}

                                    {/* Documentos */}
                                    {(oc.cte || oc.nfs) && (
                                        <div style={{
                                            background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '10px 14px',
                                            marginBottom: 10, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12,
                                            border: '1px solid rgba(0,229,255,0.08)',
                                        }}>
                                            {oc.cte && <span style={{ color: '#78909c' }}>CTE: <span style={{ color: '#b2ebf2', fontWeight: 600 }}>{oc.cte}</span></span>}
                                            {oc.nfs && <span style={{ color: '#78909c' }}>NF: <span style={{ color: '#b2ebf2', fontWeight: 600 }}>{oc.nfs}</span></span>}
                                        </div>
                                    )}

                                    {/* Motorista + Modalidade */}
                                    {oc.motorista && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: '#b0bec5' }}>
                                            <Truck size={15} style={{ color: '#ff9100', filter: 'drop-shadow(0 0 4px rgba(255,145,0,0.4))' }} />
                                            <span style={{ fontWeight: 500 }}>{oc.motorista}</span>
                                            {oc.modalidade && (
                                                <span style={{
                                                    marginLeft: 6, padding: '2px 8px', borderRadius: 6, fontSize: 10,
                                                    background: 'rgba(124,77,255,0.15)', color: '#b388ff', fontWeight: 700,
                                                    border: '1px solid rgba(124,77,255,0.3)',
                                                    boxShadow: '0 0 6px rgba(124,77,255,0.2)',
                                                }}>
                                                    {oc.modalidade}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Motivo */}
                                    {oc.motivo && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, fontSize: 13, color: '#ff8a80' }}>
                                            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0, filter: 'drop-shadow(0 0 3px rgba(255,82,82,0.4))' }} />
                                            <span>{oc.motivo}</span>
                                        </div>
                                    )}

                                    {/* Responsável */}
                                    {oc.responsavel && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#546e7a' }}>
                                            <User size={13} />
                                            RESP: <span style={{ color: '#78909c', fontWeight: 500 }}>{oc.responsavel}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
