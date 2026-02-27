import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Truck, MapPin, Hash, RefreshCw } from 'lucide-react';
import api from '../services/apiService';
import useConferenteStore from './useConferenteStore';

export default function ConferenteChecklist({ socket }) {
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const { openChecklistForm } = useConferenteStore();

    const carregarVeiculos = useCallback(async () => {
        try {
            const res = await api.get('/api/conferente/veiculos');
            if (res.data.success) {
                setVeiculos(res.data.veiculos);
            }
        } catch (e) {
            console.error('Erro ao carregar veículos:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarVeiculos();
    }, [carregarVeiculos]);

    // Socket: atualizar lista em tempo real
    useEffect(() => {
        if (!socket) return;
        const handler = () => carregarVeiculos();
        socket.on('receber_atualizacao', handler);
        socket.on('conferente_novo_veiculo', handler);
        return () => {
            socket.off('receber_atualizacao', handler);
            socket.off('conferente_novo_veiculo', handler);
        };
    }, [socket, carregarVeiculos]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <RefreshCw size={24} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div>
            {/* Título */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardCheck size={20} color="#3b82f6" />
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                        Checklist
                    </h2>
                    <span style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa', fontSize: '12px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '6px'
                    }}>
                        {veiculos.length}
                    </span>
                </div>
                <button
                    onClick={carregarVeiculos}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '8px',
                        cursor: 'pointer', color: '#94a3b8',
                        display: 'flex', alignItems: 'center'
                    }}
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {veiculos.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '40px 20px',
                    color: '#64748b', fontSize: '14px'
                }}>
                    <ClipboardCheck size={40} color="#334155" style={{ marginBottom: '12px' }} />
                    <p style={{ margin: 0 }}>Nenhum veículo aguardando checklist</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                        Cards aparecem quando o status muda para "LIBERADO P/ DOCA"
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px'
                }}>
                    {veiculos.map(v => (
                        <div
                            key={v.id}
                            onClick={() => openChecklistForm(v)}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '14px',
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderLeft: '3px solid #3b82f6'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Motorista */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                marginBottom: '10px'
                            }}>
                                <Truck size={14} color="#60a5fa" />
                                <span style={{
                                    fontSize: '14px', fontWeight: 600, color: '#e2e8f0',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    {v.motorista}
                                </span>
                            </div>

                            {/* Placas */}
                            <div style={{
                                display: 'flex', gap: '6px', flexWrap: 'wrap',
                                marginBottom: '8px'
                            }}>
                                {v.placa1Motorista && (
                                    <span style={{
                                        fontFamily: 'monospace', fontSize: '13px', fontWeight: 700,
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        padding: '3px 8px', borderRadius: '6px',
                                        color: '#cbd5e1', letterSpacing: '0.5px'
                                    }}>
                                        {v.placa1Motorista}
                                    </span>
                                )}
                                {v.placa2Motorista && (
                                    <span style={{
                                        fontFamily: 'monospace', fontSize: '13px', fontWeight: 700,
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        padding: '3px 8px', borderRadius: '6px',
                                        color: '#cbd5e1', letterSpacing: '0.5px'
                                    }}>
                                        {v.placa2Motorista}
                                    </span>
                                )}
                            </div>

                            {/* Info rodapé */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginTop: '4px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Hash size={12} color="#64748b" />
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {v.coleta || 'S/N'}
                                    </span>
                                </div>
                                {v.doca && v.doca !== 'SELECIONE' && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        padding: '3px 8px', borderRadius: '6px'
                                    }}>
                                        <MapPin size={12} color="#60a5fa" />
                                        <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>
                                            {v.doca}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
