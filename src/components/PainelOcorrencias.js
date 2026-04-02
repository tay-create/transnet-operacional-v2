import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search, Trash2, Loader, Image as ImageIcon, Video as VideoIcon, X, RefreshCw, Filter } from 'lucide-react';
import api from '../services/apiService';

export default function PainelOcorrencias() {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const [filtroOrigem, setFiltroOrigem] = useState('Todas');
    const [imagemAberta, setImagemAberta] = useState(null);
    const [confirmandoExcluir, setConfirmandoExcluir] = useState(null);

    const carregarOcorrencias = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get('/api/ocorrencias');
            if (res.data.success) {
                setOcorrencias(res.data.ocorrencias || []);
            }
        } catch (e) {
            console.error('Erro ao carregar ocorrências:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarOcorrencias();
    }, [carregarOcorrencias]);

    const excluirOcorrencia = async (id) => {
        try {
            const res = await api.delete(`/api/ocorrencias/${id}`);
            if (res.data.success) {
                setOcorrencias(prev => prev.filter(o => o.id !== id));
            }
        } catch (e) {
            console.error('Erro ao excluir ocorrência:', e);
        } finally {
            setConfirmandoExcluir(null);
        }
    };

    const origens = ['Todas', ...new Set(ocorrencias.map(o => o.unidade).filter(Boolean))];

    const ocorrenciasFiltradas = ocorrencias.filter(o => {
        const termo = termoBusca.toLowerCase();
        const matchBusca = !termo ||
            (o.motorista || '').toLowerCase().includes(termo) ||
            (o.descricao || '').toLowerCase().includes(termo) ||
            (o.operacao || '').toLowerCase().includes(termo) ||
            (o.coleta || '').toLowerCase().includes(termo) ||
            (o.coletaRecife || '').toLowerCase().includes(termo) ||
            (o.coletaMoreno || '').toLowerCase().includes(termo);
        const matchOrigem = filtroOrigem === 'Todas' || o.unidade === filtroOrigem;
        return matchBusca && matchOrigem;
    });

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={24} color="#fbbf24" />
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>
                        Painel de Ocorrências
                    </h2>
                    <span style={{
                        background: 'rgba(251,191,36,0.3)', color: '#fbbf24',
                        padding: '4px 14px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold',
                        border: '1px solid rgba(251,191,36,0.5)',
                        boxShadow: '0 0 8px rgba(251,191,36,0.2)',
                        letterSpacing: '0.5px'
                    }}>
                        {ocorrenciasFiltradas.length}
                    </span>
                </div>
                <button
                    onClick={carregarOcorrencias}
                    disabled={carregando}
                    style={{
                        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                        color: '#60a5fa', borderRadius: '8px', padding: '8px 14px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
                    }}
                >
                    <RefreshCw size={14} className={carregando ? 'spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Filtros */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        placeholder="Buscar por motorista, descrição, operação, coleta..."
                        className="input-internal"
                        style={{ width: '100%', paddingLeft: '36px', height: '40px' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={14} color="#64748b" />
                    <select
                        value={filtroOrigem}
                        onChange={(e) => setFiltroOrigem(e.target.value)}
                        className="input-internal"
                        style={{ height: '40px', minWidth: '130px' }}
                    >
                        {origens.map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Loading */}
            {carregando && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader className="spin" size={28} color="#94a3b8" />
                </div>
            )}

            {/* Empty State */}
            {!carregando && ocorrenciasFiltradas.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '60px 20px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <AlertTriangle size={40} color="#475569" style={{ marginBottom: '12px' }} />
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        Nenhuma ocorrência encontrada.
                    </p>
                </div>
            )}

            {/* Lista de Ocorrências */}
            {!carregando && ocorrenciasFiltradas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {ocorrenciasFiltradas.map(o => {
                        const coleta = o.coleta || o.coletaRecife || o.coletaMoreno || '—';
                        return (
                            <div key={o.id} style={{
                                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px', padding: '16px',
                                transition: 'border-color 0.2s'
                            }}>
                                {/* Cabeçalho do card */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                    marginBottom: '10px', flexWrap: 'wrap', gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold'
                                        }}>
                                            {o.operacao || 'N/A'}
                                        </span>
                                        {o.unidade && (
                                            <span style={{
                                                background: o.unidade === 'Recife' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                                                color: o.unidade === 'Recife' ? '#60a5fa' : '#a78bfa',
                                                padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold'
                                            }}>
                                                {o.unidade}
                                            </span>
                                        )}
                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                                            Coleta: <strong style={{ color: '#cbd5e1' }}>{coleta}</strong>
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11px' }}>
                                            {o.data_criacao ? new Date(o.data_criacao).toLocaleString('pt-BR') : ''}
                                        </span>
                                        {confirmandoExcluir === o.id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '11px', color: '#f87171' }}>Excluir?</span>
                                                <button
                                                    onClick={() => excluirOcorrencia(o.id)}
                                                    style={{
                                                        background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                                                        color: '#f87171', borderRadius: '6px', padding: '3px 10px',
                                                        cursor: 'pointer', fontSize: '11px', fontWeight: '700'
                                                    }}
                                                >
                                                    Sim
                                                </button>
                                                <button
                                                    onClick={() => setConfirmandoExcluir(null)}
                                                    style={{
                                                        background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)',
                                                        color: '#94a3b8', borderRadius: '6px', padding: '3px 10px',
                                                        cursor: 'pointer', fontSize: '11px', fontWeight: '700'
                                                    }}
                                                >
                                                    Não
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmandoExcluir(o.id)}
                                                title="Excluir ocorrência"
                                                style={{
                                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                                    color: '#f87171', borderRadius: '6px', padding: '4px 8px',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px'
                                                }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Motorista */}
                                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#94a3b8' }}>
                                    Motorista: <strong style={{ color: '#e2e8f0' }}>{o.motorista}</strong>
                                </div>

                                {/* Descrição */}
                                <p style={{
                                    margin: 0, fontSize: '13px', color: '#f1f5f9',
                                    whiteSpace: 'pre-wrap', lineHeight: '1.5',
                                    background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px'
                                }}>
                                    {o.descricao}
                                </p>

                                {/* Mídias (novo formato midias_json + legado foto_base64) */}
                                {(() => {
                                    let midias = [];
                                    if (o.midias_json) {
                                        try { midias = JSON.parse(o.midias_json); } catch (_) {}
                                    }
                                    if (!midias.length && o.foto_base64) {
                                        midias = [{ tipo: 'foto', data: o.foto_base64 }];
                                    }
                                    if (!midias.length) return null;
                                    return (
                                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {midias.map((m, i) => m.tipo === 'foto' ? (
                                                <button key={i} onClick={() => setImagemAberta(m.data)}
                                                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px', cursor: 'pointer' }}>
                                                    <img src={m.data} alt="Evidência" style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                                                </button>
                                            ) : (
                                                <div key={i} style={{ position: 'relative', width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }}
                                                    onClick={() => setImagemAberta({ tipo: 'video', data: m.data })}>
                                                    {m.thumb
                                                        ? <img src={m.thumb} alt="Vídeo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><VideoIcon size={24} color="#94a3b8" /></div>
                                                    }
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                                        <VideoIcon size={18} color="white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Imagem Ampliada */}
            {imagemAberta && (
                <div
                    onClick={() => setImagemAberta(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10000, cursor: 'pointer', padding: '20px'
                    }}
                >
                    <button
                        onClick={() => setImagemAberta(null)}
                        style={{
                            position: 'absolute', top: '20px', right: '20px',
                            background: 'rgba(255,255,255,0.1)', border: 'none',
                            color: 'white', borderRadius: '50%', width: '40px', height: '40px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                    {imagemAberta?.tipo === 'video'
                        ? <video src={imagemAberta.data} controls autoPlay style={{ maxWidth: '90%', maxHeight: '90vh', borderRadius: '12px' }} onClick={e => e.stopPropagation()} />
                        : <img src={typeof imagemAberta === 'string' ? imagemAberta : imagemAberta?.data} alt="Evidência ampliada" style={{ maxWidth: '90%', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
                    }
                </div>
            )}
        </div>
    );
}
