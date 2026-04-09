import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';
import {
    Clock, MapPin, Truck, User, AlertTriangle, AlertCircle,
    CheckCircle, Camera, Mail, ExternalLink, Edit2, Trash2,
    RefreshCw, Archive, X, ChevronLeft, ChevronRight
} from 'lucide-react';

// ──────────── Helpers ────────────────────────────────────
const formatData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function calcularHorasAtraso(oc) {
    const inicio = new Date(`${oc.data_ocorrencia}T${oc.hora_ocorrencia}:00`);
    const fim = oc.situacao === 'RESOLVIDO'
        ? new Date(`${oc.data_conclusao}T${oc.hora_conclusao}:00`)
        : new Date();
    return (fim - inicio) / (60 * 60 * 1000);
}

function verificarAtraso(oc) {
    return calcularHorasAtraso(oc) > 24;
}

function getStatusDisplay(oc) {
    if (oc.situacao === 'RESOLVIDO') return { label: 'RESOLVIDO', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    const h = calcularHorasAtraso(oc);
    if (h > 48) return { label: 'ATRASADO +48H', color: '#dc2626', bg: 'rgba(220,38,38,0.2)' };
    if (h > 24) return { label: 'ATRASADO +24H', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
    return { label: 'EM ANDAMENTO', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
}

function getTempoLabel(oc) {
    const h = calcularHorasAtraso(oc);
    const dias = Math.floor(h / 24);
    const horas = Math.floor(h % 24);
    if (dias >= 1) return `${dias}d ${horas}h`;
    return `${Math.floor(h)}h`;
}

function getBordaEsquerda(oc) {
    if (oc.situacao === 'RESOLVIDO') return '#22c55e';
    const h = calcularHorasAtraso(oc);
    if (h > 48) return '#dc2626';
    if (h > 24) return '#ef4444';
    return '#f97316';
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

// ──────────── Estilos ────────────────────────────────────
const glassCard = (extraBorder) => ({
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(12px)',
    border: `1px solid ${extraBorder || 'rgba(255,255,255,0.10)'}`,
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
});

// ──────────── Componente Principal ────────────────────────────────────
export default function DashboardPosEmbarque() {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalFotos, setModalFotos] = useState(null);
    const [fotoAmpliada, setFotoAmpliada] = useState(null);
    const [fotoIdx, setFotoIdx] = useState(0);
    const [editando, setEditando] = useState(null);
    const [formEdit, setFormEdit] = useState({});

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

    // Auto-refresh a cada 30s
    useEffect(() => {
        const interval = setInterval(carregar, 30000);
        return () => clearInterval(interval);
    }, [carregar]);

    // ── Ações ──
    const resolver = async (id) => {
        if (!window.confirm('Marcar como RESOLVIDO?')) return;
        try {
            await api.post(`/api/posembarque/ocorrencias/${id}/resolver`);
            carregar();
        } catch (e) { console.error(e); }
    };

    const excluir = async (id) => {
        if (!window.confirm('Excluir esta ocorrência?')) return;
        try {
            await api.delete(`/api/posembarque/ocorrencias/${id}`);
            carregar();
        } catch (e) { console.error(e); }
    };

    const arquivarResolvidas = async () => {
        const resolvidas = ocorrencias.filter(o => o.situacao === 'RESOLVIDO');
        if (resolvidas.length === 0) return;
        if (!window.confirm(`Arquivar ${resolvidas.length} ocorrência(s) resolvida(s)?`)) return;
        try {
            await Promise.all(resolvidas.map(o =>
                api.put(`/api/posembarque/ocorrencias/${o.id}`, { ...o, arquivado: 1 })
            ));
            carregar();
        } catch (e) { console.error(e); }
    };

    const abrirEdicao = (oc) => {
        setEditando(oc.id);
        setFormEdit({
            data_ocorrencia: oc.data_ocorrencia || '',
            hora_ocorrencia: oc.hora_ocorrencia || '',
            motorista: oc.motorista || '',
            modalidade: oc.modalidade || '',
            cte: oc.cte || '',
            operacao: oc.operacao || '',
            nfs: oc.nfs || '',
            cliente: oc.cliente || '',
            cidade: oc.cidade || '',
            motivo: oc.motivo || '',
            link_email: oc.link_email || ''
        });
    };

    const salvarEdicao = async () => {
        try {
            await api.put(`/api/posembarque/ocorrencias/${editando}`, formEdit);
            setEditando(null);
            carregar();
        } catch (e) { console.error(e); }
    };

    const abrirFotos = async (oc) => {
        try {
            const { data } = await api.get(`/api/posembarque/ocorrencias/${oc.id}`);
            if (data.success && data.ocorrencia.fotos && data.ocorrencia.fotos.length > 0) {
                setModalFotos(data.ocorrencia.fotos);
                setFotoIdx(0);
            } else {
                setModalFotos([]);
            }
        } catch (e) { console.error(e); }
    };

    // ── KPIs ──
    const emAndamento = ocorrencias.filter(o => o.situacao === 'Em Andamento');
    const resolvidas = ocorrencias.filter(o => o.situacao === 'RESOLVIDO');
    const atrasadas = emAndamento.filter(o => verificarAtraso(o));

    const kpis = [
        { label: 'EM ANDAMENTO', valor: emAndamento.length, cor: '#f97316', icon: <Clock size={24} /> },
        { label: 'RESOLVIDAS', valor: resolvidas.length, cor: '#22c55e', icon: <CheckCircle size={24} /> },
        { label: '+24 HORAS', valor: atrasadas.length, cor: '#ef4444', icon: <AlertTriangle size={24} /> },
        { label: 'TOTAL GERAL', valor: ocorrencias.length, cor: '#3b82f6', icon: <AlertCircle size={24} /> },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>
                <RefreshCw size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: 12, fontSize: 18 }}>Carregando ocorrências...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ padding: '16px', color: '#f1f5f9', minHeight: '100vh' }}>
            {/* ── KPI BAR ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {kpis.map((k, i) => (
                    <div key={i} style={{
                        ...glassCard(),
                        padding: '20px',
                        borderBottom: `3px solid ${k.cor}`,
                        textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, color: k.cor }}>
                            {k.icon}
                            <span style={{ fontSize: 32, fontWeight: 'bold' }}>{k.valor}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', letterSpacing: 1 }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, letterSpacing: 2, color: '#f1f5f9' }}>
                        PAINEL DE OCORRÊNCIAS
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: 12, color: '#22c55e' }}>Online</span>
                    </div>
                    <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {resolvidas.length > 0 && (
                        <button onClick={arquivarResolvidas} style={{
                            padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)',
                            background: 'rgba(139,92,246,0.15)', color: '#a78bfa', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <Archive size={14} /> Arquivar Resolvidas ({resolvidas.length})
                        </button>
                    )}
                    <button onClick={carregar} style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.4)',
                        background: 'rgba(6,182,212,0.15)', color: '#06b6d4', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                    }}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            {/* ── GRID DE CARDS ── */}
            {ocorrencias.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                    <AlertCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p style={{ fontSize: 16 }}>Nenhuma ocorrência ativa</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                    {ocorrencias.map(oc => {
                        const status = getStatusDisplay(oc);
                        const fotos = oc.fotos_json ? (() => { try { return JSON.parse(oc.fotos_json); } catch { return []; } })() : [];

                        return (
                            <div key={oc.id} style={{
                                ...glassCard(),
                                borderLeft: `4px solid ${getBordaEsquerda(oc)}`,
                                padding: 0,
                                overflow: 'hidden',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                            >
                                {/* TOPO: Status + Data/Hora */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                        background: status.bg, color: status.color, letterSpacing: 0.5
                                    }}>
                                        {status.label}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                                        <Clock size={12} />
                                        {formatData(oc.data_ocorrencia)} {oc.hora_ocorrencia || ''}
                                    </div>
                                </div>

                                {/* CORPO */}
                                <div style={{ padding: '12px 16px' }}>
                                    {/* Operação + Tempo */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        {oc.operacao && (
                                            <span style={{
                                                padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)'
                                            }}>
                                                OP: {oc.operacao}
                                            </span>
                                        )}
                                        <span style={{
                                            fontSize: 11, fontWeight: 600,
                                            color: oc.situacao === 'RESOLVIDO' ? '#22c55e' : (verificarAtraso(oc) ? '#ef4444' : '#f97316')
                                        }}>
                                            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                                            {getTempoLabel(oc)}
                                        </span>
                                    </div>

                                    {/* Cliente */}
                                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 6, textTransform: 'uppercase' }}>
                                        {oc.cliente || '—'}
                                    </div>

                                    {/* Cidade */}
                                    {oc.cidade && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#94a3b8', fontSize: 13 }}>
                                            <MapPin size={14} /> {oc.cidade}
                                        </div>
                                    )}

                                    {/* Documentos */}
                                    {(oc.cte || oc.nfs) && (
                                        <div style={{
                                            background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 12px',
                                            marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12
                                        }}>
                                            {oc.cte && <span style={{ color: '#94a3b8' }}>CTE: <span style={{ color: '#e2e8f0' }}>{oc.cte}</span></span>}
                                            {oc.nfs && <span style={{ color: '#94a3b8' }}>NF: <span style={{ color: '#e2e8f0' }}>{oc.nfs}</span></span>}
                                        </div>
                                    )}

                                    {/* Motorista + Modalidade */}
                                    {oc.motorista && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13, color: '#cbd5e1' }}>
                                            <Truck size={14} style={{ color: '#f97316' }} />
                                            <span>{oc.motorista}</span>
                                            {oc.modalidade && (
                                                <span style={{
                                                    marginLeft: 6, padding: '2px 6px', borderRadius: 4, fontSize: 10,
                                                    background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontWeight: 600
                                                }}>
                                                    {oc.modalidade}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Motivo */}
                                    {oc.motivo && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6, fontSize: 13, color: '#fca5a5' }}>
                                            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                                            <span>{oc.motivo}</span>
                                        </div>
                                    )}

                                    {/* Responsável */}
                                    {oc.responsavel && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, color: '#64748b' }}>
                                            <User size={13} />
                                            RESP: <span style={{ color: '#94a3b8' }}>{oc.responsavel}</span>
                                        </div>
                                    )}
                                </div>

                                {/* AÇÕES */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                                    borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap'
                                }}>
                                    {/* Fotos */}
                                    <button onClick={() => abrirFotos(oc)} style={btnStyle('#06b6d4', 'rgba(6,182,212,0.15)')}>
                                        <Camera size={13} /> {fotos.length > 0 ? fotos.length : 0}
                                    </button>

                                    {/* Email link */}
                                    {oc.link_email && (
                                        <a href={oc.link_email} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                            <button style={btnStyle('#8b5cf6', 'rgba(139,92,246,0.15)')}>
                                                <ExternalLink size={13} /> Email
                                            </button>
                                        </a>
                                    )}

                                    {/* Concluir */}
                                    {oc.situacao !== 'RESOLVIDO' && (
                                        <button onClick={() => resolver(oc.id)} style={btnStyle('#22c55e', 'rgba(34,197,94,0.15)')}>
                                            <CheckCircle size={13} /> Concluir
                                        </button>
                                    )}

                                    {/* Editar */}
                                    <button onClick={() => abrirEdicao(oc)} style={btnStyle('#f97316', 'rgba(249,115,22,0.15)')}>
                                        <Edit2 size={13} />
                                    </button>

                                    {/* Excluir */}
                                    <button onClick={() => excluir(oc.id)} style={btnStyle('#ef4444', 'rgba(239,68,68,0.15)')}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODAL FOTOS ── */}
            {modalFotos !== null && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => { setModalFotos(null); setFotoAmpliada(null); }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                        padding: 24, maxWidth: 700, width: '90%', maxHeight: '85vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Fotos da Ocorrência ({modalFotos.length})</h3>
                            <button onClick={() => { setModalFotos(null); setFotoAmpliada(null); }}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        {modalFotos.length === 0 ? (
                            <p style={{ color: '#64748b', textAlign: 'center' }}>Nenhuma foto registrada.</p>
                        ) : fotoAmpliada ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <button onClick={() => { const ni = (fotoIdx - 1 + modalFotos.length) % modalFotos.length; setFotoIdx(ni); setFotoAmpliada(modalFotos[ni]); }}
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f1f5f9', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}>{fotoIdx + 1} / {modalFotos.length}</span>
                                    <button onClick={() => { const ni = (fotoIdx + 1) % modalFotos.length; setFotoIdx(ni); setFotoAmpliada(modalFotos[ni]); }}
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f1f5f9', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                                <img
                                    src={fotoAmpliada.base64 ? `data:${fotoAmpliada.mime || 'image/jpeg'};base64,${fotoAmpliada.base64}` : fotoAmpliada}
                                    alt="Foto ampliada"
                                    style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, objectFit: 'contain' }}
                                />
                                <button onClick={() => setFotoAmpliada(null)}
                                    style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                                    Voltar para thumbnails
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                                {modalFotos.map((f, i) => (
                                    <img key={i}
                                        src={f.base64 ? `data:${f.mime || 'image/jpeg'};base64,${f.base64}` : f}
                                        alt={`Foto ${i + 1}`}
                                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid rgba(255,255,255,0.1)' }}
                                        onClick={() => { setFotoAmpliada(f); setFotoIdx(i); }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL EDIÇÃO ── */}
            {editando && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setEditando(null)}>
                    <div style={{
                        background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                        padding: 24, maxWidth: 500, width: '90%', maxHeight: '85vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Editar Ocorrência #{editando}</h3>
                            <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { key: 'cliente', label: 'Cliente' },
                                { key: 'cidade', label: 'Cidade' },
                                { key: 'motorista', label: 'Motorista' },
                                { key: 'modalidade', label: 'Modalidade' },
                                { key: 'operacao', label: 'Operação' },
                                { key: 'cte', label: 'CTE' },
                                { key: 'nfs', label: 'Nota Fiscal' },
                                { key: 'motivo', label: 'Motivo' },
                                { key: 'link_email', label: 'Link Email' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>{label}</label>
                                    <input
                                        value={formEdit[key] || ''}
                                        onChange={e => setFormEdit(p => ({ ...p, [key]: e.target.value }))}
                                        style={inputStyle}
                                    />
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button onClick={salvarEdicao} style={{
                                    flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                                    background: 'rgba(6,182,212,0.2)', color: '#06b6d4', fontWeight: 600, cursor: 'pointer'
                                }}>
                                    Salvar
                                </button>
                                <button onClick={() => setEditando(null)} style={{
                                    flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                                    background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600, cursor: 'pointer'
                                }}>
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Styles helpers ──
const btnStyle = (color, bg) => ({
    padding: '5px 10px', borderRadius: 6, border: `1px solid ${color}33`,
    background: bg, color, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4
});

const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box'
};
