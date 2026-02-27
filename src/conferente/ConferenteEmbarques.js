import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar, RefreshCw, Truck, MapPin, Hash } from 'lucide-react';
import { CORES_STATUS } from '../constants';
import api from '../services/apiService';

export default function ConferenteEmbarques() {
    const [embarques, setEmbarques] = useState([]);
    const [loading, setLoading] = useState(true);

    // Datas padrão: hoje
    const hoje = new Date().toISOString().split('T')[0];
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);

    const carregarEmbarques = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/conferente/embarques', {
                params: { dataInicio, dataFim }
            });
            if (res.data.success) {
                setEmbarques(res.data.embarques);
            }
        } catch (e) {
            console.error('Erro ao carregar embarques:', e);
        } finally {
            setLoading(false);
        }
    }, [dataInicio, dataFim]);

    useEffect(() => {
        carregarEmbarques();
    }, [carregarEmbarques]);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const inputStyle = {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#e2e8f0',
        fontSize: '13px',
        outline: 'none',
        flex: 1,
        minWidth: 0
    };

    const getStatusCor = (status) => {
        return CORES_STATUS[status] || { border: '#64748b', text: '#94a3b8' };
    };

    return (
        <div>
            {/* Título */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '16px'
            }}>
                <List size={20} color="#8b5cf6" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                    Lista de Embarques
                </h2>
            </div>

            {/* Filtros de data */}
            <div style={{
                display: 'flex', gap: '10px', alignItems: 'center',
                marginBottom: '16px', flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '140px' }}>
                    <Calendar size={14} color="#64748b" />
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>DE</span>
                    <input
                        type="date"
                        value={dataInicio}
                        onChange={e => setDataInicio(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '140px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ATÉ</span>
                    <input
                        type="date"
                        value={dataFim}
                        onChange={e => setDataFim(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <button
                    onClick={carregarEmbarques}
                    style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px', padding: '8px 12px',
                        cursor: 'pointer', color: '#a78bfa',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', fontWeight: 600
                    }}
                >
                    <RefreshCw size={14} />
                    Buscar
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <RefreshCw size={24} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : embarques.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '40px 20px',
                    color: '#64748b', fontSize: '14px'
                }}>
                    <List size={40} color="#334155" style={{ marginBottom: '12px' }} />
                    <p style={{ margin: 0 }}>Nenhum embarque encontrado</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Ajuste o filtro de datas</p>
                </div>
            ) : isMobile ? (
                /* Mobile: Cards empilhados */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {embarques.map(e => {
                        const cor = getStatusCor(e.status);
                        return (
                            <div key={e.id} style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderLeft: `3px solid ${cor.border}`,
                                borderRadius: '12px',
                                padding: '14px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Truck size={14} color="#94a3b8" />
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{e.motorista}</span>
                                    </div>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 700,
                                        color: cor.text,
                                        background: `${cor.border}20`,
                                        padding: '2px 8px', borderRadius: '6px'
                                    }}>
                                        {e.status || 'N/A'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8' }}>
                                    {(e.placa1Motorista || e.placa2Motorista) && (
                                        <span style={{ fontFamily: 'monospace' }}>
                                            {[e.placa1Motorista, e.placa2Motorista].filter(Boolean).join(' / ')}
                                        </span>
                                    )}
                                    {e.coleta && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Hash size={11} /> {e.coleta}
                                        </span>
                                    )}
                                    {e.doca && e.doca !== 'SELECIONE' && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <MapPin size={11} /> {e.doca}
                                        </span>
                                    )}
                                    {e.data && (
                                        <span>{e.data}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Tablet/Desktop: Tabela */
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Motorista', 'Placas', 'Coleta', 'Status', 'Doca', 'Data'].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 12px', textAlign: 'left',
                                        fontSize: '10px', fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {embarques.map(e => {
                                const cor = getStatusCor(e.status);
                                return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 500 }}>{e.motorista}</td>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#cbd5e1', fontSize: '12px' }}>
                                            {[e.placa1Motorista, e.placa2Motorista].filter(Boolean).join(' / ') || '-'}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{e.coleta || '-'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 700,
                                                color: cor.text,
                                                background: `${cor.border}20`,
                                                padding: '3px 8px', borderRadius: '6px'
                                            }}>
                                                {e.status || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{e.doca && e.doca !== 'SELECIONE' ? e.doca : '-'}</td>
                                        <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '12px' }}>{e.data || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
