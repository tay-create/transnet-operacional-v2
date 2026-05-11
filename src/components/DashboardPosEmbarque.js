import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';
import {
    Clock, MapPin, Truck, User, AlertTriangle, AlertCircle,
    CheckCircle, RefreshCw
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDataBR } from '../utils/dateFormatter';
import { calcularHorasAtraso, verificarAtraso, ordenarOcorrencias } from '../utils/slaUtils';

const TEMA = {
    escuro: {
        bg: 'transparent',
        cardBg: 'rgba(10,15,30,0.85)',
        cardBorder: (cor) => `1px solid ${cor}44`,
        textPrimary: '#f1f5f9',
        textSecondary: '#64748b',
        textMuted: '#546e7a',
        textCliente: '#e0f7fa',
        textMotorista: '#b0bec5',
        docBg: 'rgba(0,0,0,0.4)',
        docBorder: '1px solid rgba(0,229,255,0.08)',
        headerBg: (cor) => `linear-gradient(135deg, ${cor}11, transparent)`,
        kpiBg: 'rgba(10,15,30,0.8)',
        kpiBorder: (cor) => `1px solid ${cor}44`,
        titleColor: '#00e5ff',
    },
    claro: {
        bg: '#f1f5f9',
        cardBg: '#ffffff',
        cardBorder: (cor) => `1px solid ${cor}88`,
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        textCliente: '#0f172a',
        textMotorista: '#334155',
        docBg: '#f8fafc',
        docBorder: '1px solid #e2e8f0',
        headerBg: (cor) => `linear-gradient(135deg, ${cor}22, ${cor}08)`,
        kpiBg: '#ffffff',
        kpiBorder: (cor) => `1px solid ${cor}88`,
        titleColor: '#0f172a',
    },
};

// ──────────── Helpers ────────────────────────────────────

function getStatusDisplay(oc) {
    if (oc.situacao === 'RESOLVIDO') return { label: 'RESOLVIDO', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    const h = calcularHorasAtraso(oc);
    if (h > 48) {
        const dias = Math.floor(h / 24);
        return { label: `ATRASADO +${dias}D`, color: '#ff1744', bg: 'rgba(255,23,68,0.2)' };
    }
    if (h > 24) return { label: 'ATRASADO +24H', color: '#ff5252', bg: 'rgba(255,82,82,0.15)' };
    return { label: 'EM ANDAMENTO', color: '#ff9100', bg: 'rgba(255,145,0,0.15)' };
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

function getCardGlow() {
    return "none";
}

// ──────────── CSS Animações ────────────────────────────────────
const neonCSS = `
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
@keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
`;

// ──────────── Componente Principal ────────────────────────────────────
export default function DashboardPosEmbarque({ socket }) {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [loading, setLoading] = useState(true);
    const { tema: temaGlobal } = useTheme();
    const modoClaro = temaGlobal === 'claro';
    const tema = modoClaro ? TEMA.claro : TEMA.escuro;

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
                <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', }} />
                <span style={{ marginLeft: 14, fontSize: 18 }}>Carregando ocorrências...</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', color: tema.textPrimary, minHeight: '100vh', background: tema.bg, transition: 'background 0.3s, color 0.3s' }}>
            <style>{neonCSS}</style>

            {/* ── KPI BAR ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {kpis.map((k, i) => (
                    <div key={i} style={{
                        background: tema.kpiBg,
                        backdropFilter: 'blur(16px)',
                        border: tema.kpiBorder(k.cor),
                        borderBottom: `3px solid ${k.cor}`,
                        borderRadius: '16px',
                        padding: '22px 16px',
                        textAlign: 'center',
                        boxShadow: `0 2px 12px ${k.corGlow}`,
                        animation: `slideIn 0.5s ease ${i * 0.1}s both`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8, color: k.cor }}>
                            {k.icon}
                            <span style={{ fontSize: 38, fontWeight: 'bold' }}>{k.valor}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: k.cor, letterSpacing: 2, opacity: 0.85 }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* ── HEADER ── */}
            <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative' }}>
                <h1 style={{
                    fontSize: '26px', fontWeight: 'bold', margin: 0, letterSpacing: 4, color: tema.titleColor,
                    
                }}>
                    PAINEL DE OCORRÊNCIAS
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{
                        width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                        background: '#00e676',
                        
                        animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ fontSize: 13, color: '#00e676', fontWeight: 600 }}>Online — Tempo Real</span>
                </div>
                <div style={{
                    marginTop: 12, height: 2, maxWidth: 300, margin: '12px auto 0',
                    background: modoClaro ? '#e2e8f0' : 'rgba(255,255,255,0.15)',
                }} />
            </div>

            {/* ── GRID DE CARDS ── */}
            {ocorrencias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#00e5ff' }}>
                    <AlertCircle size={52} style={{ marginBottom: 14, opacity: 0.5,  }} />
                    <p style={{ fontSize: 17,  }}>Nenhuma ocorrência ativa</p>
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
                                background: tema.cardBg,
                                backdropFilter: 'blur(16px)',
                                border: tema.cardBorder(bordaCor),
                                borderLeft: `4px solid ${bordaCor}`,
                                borderRadius: '16px',
                                padding: 0,
                                overflow: 'hidden',
                                boxShadow: modoClaro ? `0 2px 12px ${bordaCor}33` : 'none',
                                animation: `slideIn 0.4s ease ${idx * 0.05}s both`,
                                transition: 'transform 0.3s, box-shadow 0.3s',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                                e.currentTarget.style.boxShadow = `0 8px 24px ${bordaCor}55`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = modoClaro ? `0 2px 12px ${bordaCor}33` : 'none';
                            }}
                            >
                                {/* TOPO: Status + Data/Hora */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 16px',
                                    borderBottom: `1px solid ${bordaCor}22`,
                                    background: tema.headerBg(bordaCor),
                                }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                        background: status.bg, color: status.color, letterSpacing: 0.5,
                                        border: `1px solid ${status.color}33`,
                                    }}>
                                        {status.label}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: tema.textSecondary }}>
                                        <Clock size={12} />
                                        {formatDataBR(oc.data_ocorrencia)} {oc.hora_ocorrencia || ''}
                                    </div>
                                </div>

                                {/* CORPO */}
                                <div style={{ padding: '14px 16px' }}>
                                    {/* Operação + Tempo */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        {oc.operacao && (
                                            <span style={{
                                                padding: '4px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                                                background: 'rgba(0,229,255,0.1)', color: '#00e5ff',
                                                border: '1px solid rgba(0,229,255,0.3)',
                                                
                                            }}>
                                                OP: {oc.operacao}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: 15, fontWeight: 700,
                                            color: isResolvido ? '#00e676' : (isAtrasado ? '#ff5252' : '#ff9100'),
                                        }}>
                                            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                            {getTempoLabel(oc)}
                                        </span>
                                    </div>

                                    {/* Cliente */}
                                    <div style={{
                                        fontSize: 17, fontWeight: 'bold', color: tema.textCliente, marginBottom: 8,
                                        textTransform: 'uppercase', letterSpacing: 0.5,
                                        
                                    }}>
                                        {oc.cliente || '—'}
                                    </div>

                                    {/* Cidade */}
                                    {oc.cidade && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#80cbc4', fontSize: 13 }}>
                                            <MapPin size={14} style={{  }} /> {oc.cidade}
                                        </div>
                                    )}

                                    {/* Documentos */}
                                    {(oc.cte || oc.nfs) && (
                                        <div style={{
                                            background: tema.docBg, borderRadius: 10, padding: '12px 14px',
                                            marginBottom: 10, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13,
                                            border: tema.docBorder,
                                        }}>
                                            {oc.cte && (
                                                <span style={{ color: tema.textSecondary, fontWeight: 700, letterSpacing: 0.3 }}>
                                                    CTE: <span style={{
                                                        color: modoClaro ? '#0f172a' : '#e0f7fa',
                                                        fontWeight: 800, fontSize: 15, letterSpacing: 0.5,
                                                    }}>{oc.cte}</span>
                                                </span>
                                            )}
                                            {oc.nfs && (
                                                <span style={{ color: tema.textSecondary, fontWeight: 700, letterSpacing: 0.3 }}>
                                                    NF: <span style={{
                                                        color: modoClaro ? '#0f172a' : '#e0f7fa',
                                                        fontWeight: 800, fontSize: 15, letterSpacing: 0.5,
                                                    }}>{oc.nfs}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Motorista + Modalidade */}
                                    {oc.motorista && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: tema.textMotorista }}>
                                            <Truck size={15} style={{ color: '#ff9100',  }} />
                                            <span style={{ fontWeight: 500 }}>{oc.motorista}</span>
                                            {oc.modalidade && (
                                                <span style={{
                                                    marginLeft: 6, padding: '2px 8px', borderRadius: 6, fontSize: 10,
                                                    background: 'rgba(124,77,255,0.15)', color: '#b388ff', fontWeight: 700,
                                                    border: '1px solid rgba(124,77,255,0.3)',
                                                    
                                                }}>
                                                    {oc.modalidade}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Motivo */}
                                    {oc.motivo && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, fontSize: 13, color: '#ff8a80' }}>
                                            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0,  }} />
                                            <span>{oc.motivo}</span>
                                        </div>
                                    )}

                                    {/* Responsável */}
                                    {oc.responsavel && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tema.textMuted }}>
                                            <User size={13} />
                                            RESP: <span style={{ color: tema.textSecondary, fontWeight: 500 }}>{oc.responsavel}</span>
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
