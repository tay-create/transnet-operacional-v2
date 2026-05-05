import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../services/apiService';

function formatarData(dt) {
    if (!dt) return '—';
    try {
        const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
}

export default function ChecklistPainel({ socket, addToast }) {
    const [checklists, setChecklists] = useState([]);
    const [ocorrencias, setOcorrencias] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('checklists');
    const [fotoAmpliada, setFotoAmpliada] = useState(null);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const [rChk, rOc] = await Promise.all([
                api.get('/api/checklists'),
                api.get('/api/ocorrencias'),
            ]);
            if (rChk.data.success) {
                setChecklists((rChk.data.checklists || []).filter(c => c.status === 'PENDENTE'));
            }
            if (rOc.data.success) {
                setOcorrencias(rOc.data.ocorrencias || []);
            }
        } catch { /* silencioso */ }
        finally { setCarregando(false); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo === 'checklist_pendente' || data?.tipo === 'refresh_geral') carregar();
        };
        socket.on('receber_alerta', handler);
        socket.on('receber_atualizacao', handler);
        return () => {
            socket.off('receber_alerta', handler);
            socket.off('receber_atualizacao', handler);
        };
    }, [socket, carregar]);

    const acao = async (id, status) => {
        try {
            await api.put(`/api/checklists/${id}/status`, { status });
            setChecklists(prev => prev.filter(c => c.id !== id));
            addToast({ tipo: status === 'APROVADO' ? 'success' : 'error', mensagem: `Checklist ${status}` });
        } catch (e) {
            addToast({ tipo: 'error', mensagem: e.response?.data?.message || 'Erro ao atualizar checklist.' });
        }
    };

    const COR_STATUS = {
        PENDENTE: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
        APROVADO: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
        RECUSADO: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
    };

    const styleBtnAba = (aba) => ({
        flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
        fontWeight: '700', fontSize: '13px',
        background: abaAtiva === aba ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
        color: abaAtiva === aba ? '#60a5fa' : '#64748b',
        borderBottom: abaAtiva === aba ? '2px solid #3b82f6' : '2px solid transparent',
    });

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Abas */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button style={styleBtnAba('checklists')} onClick={() => setAbaAtiva('checklists')}>
                    <ClipboardCheck size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                    PENDENTES {checklists.length > 0 && <span style={{ background: '#f59e0b', color: '#000', borderRadius: '50%', padding: '0 5px', fontSize: '11px', marginLeft: '4px' }}>{checklists.length}</span>}
                </button>
                <button style={styleBtnAba('ocorrencias')} onClick={() => setAbaAtiva('ocorrencias')}>
                    <AlertTriangle size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                    OCORRÊNCIAS
                </button>
                <button
                    onClick={carregar}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer' }}
                >
                    <RefreshCw size={13} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} />
                </button>
            </div>

            {/* Aba Checklists Pendentes */}
            {abaAtiva === 'checklists' && (
                <>
                    {checklists.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                            <CheckCircle size={48} style={{ opacity: 0.3, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                            <p style={{ margin: 0 }}>Nenhum checklist pendente.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {checklists.map(c => {
                                const cor = COR_STATUS[c.status] || COR_STATUS.PENDENTE;
                                return (
                                    <div key={c.id} style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${cor.border}`,
                                        borderLeft: `4px solid ${cor.text}`,
                                        borderRadius: '12px', overflow: 'hidden'
                                    }}>
                                        <div style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#f1f5f9' }}>{c.motorista_nome}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{c.placa_carreta || '—'} · {formatarData(c.created_at)}</div>
                                                </div>
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '5px', background: cor.bg, color: cor.text, border: `1px solid ${cor.border}` }}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                                    {c.condicao_bau || '—'}
                                                </span>
                                                {c.is_paletizado && c.is_paletizado !== 'NÃO' && (
                                                    <span style={{ fontSize: '11px', color: '#fb923c', background: 'rgba(251,146,60,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                                        {c.is_paletizado} {c.qtd_paletes ? `· ${c.qtd_paletes} paletes` : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {c.foto_vazamento && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <img
                                                        src={c.foto_vazamento}
                                                        alt="vazamento"
                                                        onClick={() => setFotoAmpliada(c.foto_vazamento)}
                                                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)' }}
                                                    />
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => acao(c.id, 'RECUSADO')}
                                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                                >
                                                    <XCircle size={14} /> RECUSAR
                                                </button>
                                                <button
                                                    onClick={() => acao(c.id, 'APROVADO')}
                                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                                >
                                                    <CheckCircle size={14} /> APROVAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Aba Ocorrências */}
            {abaAtiva === 'ocorrencias' && (
                <>
                    {ocorrencias.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                            <AlertTriangle size={48} style={{ opacity: 0.3, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                            <p style={{ margin: 0 }}>Nenhuma ocorrência registrada.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {ocorrencias.map(o => (
                                <div key={o.id} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    borderLeft: '4px solid #f59e0b',
                                    borderRadius: '10px', padding: '12px 14px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9' }}>{o.motorista || '—'}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{o.operacao || o.unidade || '—'} · {formatarData(o.data_criacao)}</div>
                                        </div>
                                        {o.foto_base64 && (
                                            <img
                                                src={o.foto_base64}
                                                alt="ocorrência"
                                                onClick={(e) => { e.stopPropagation(); setFotoAmpliada(o.foto_base64); }}
                                                style={{ width: '72px', height: '56px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', border: '1px solid rgba(245,158,11,0.4)', flexShrink: 0, transition: 'transform 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                            />
                                        )}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{o.descricao}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Foto ampliada */}
            {fotoAmpliada && (
                <div
                    onClick={() => setFotoAmpliada(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                >
                    <img src={fotoAmpliada} alt="ampliada" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} />
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
