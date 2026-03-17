import React, { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, XCircle, Calendar, Search, Filter } from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';
import { obterDataBrasilia } from '../utils/helpers';
import ModalConfirm from './ModalConfirm';

export default function PainelChecklist() {
    const user = useAuthStore(state => state.user);
    const podeAprovar = ['Coordenador', 'Planejamento'].includes(user?.cargo);

    const [checklists, setChecklists] = useState([]);
    const [aviso, setAviso] = useState(null);
    const [loading, setLoading] = useState(true);

    const dataHoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(dataHoje);
    const [dataFim, setDataFim] = useState(dataHoje);
    const [termoBusca, setTermoBusca] = useState('');

    useEffect(() => {
        carregarChecklists();
    }, []);

    const carregarChecklists = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/checklists');
            if (res.data.success) {
                setChecklists(res.data.checklists);
            }
        } catch (error) {
            console.error('Erro ao carregar checklists', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAtualizarStatus = async (id, novoStatus) => {
        if (!podeAprovar) return;
        try {
            await api.put(`/api/checklists/${id}/status`, { status: novoStatus });
            setChecklists(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
        } catch (error) {
            setAviso('Erro ao atualizar status do checklist.');
        }
    };

    // Filtros Locais
    const checklistsFiltrados = checklists.filter(c => {
        // Filtro de Data
        if (dataInicio && dataFim && c.created_at) {
            const dataCriacao = c.created_at.split('T')[0];
            if (dataCriacao < dataInicio || dataCriacao > dataFim) return false;
        }

        // Filtro de Busca (Placa ou Motorista)
        if (termoBusca) {
            const termo = termoBusca.toLowerCase();
            const placa = (c.placa_carreta || '').toLowerCase();
            const mot = (c.motorista_nome || '').toLowerCase();
            if (!placa.includes(termo) && !mot.includes(termo)) return false;
        }

        return true;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'APROVADO': return { bg: 'rgba(34,197,94,0.1)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' };
            case 'RECUSADO': return { bg: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.3)' };
            default: return { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' };
        }
    };

    return (
        <div style={{ padding: '20px', color: '#f1f5f9', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {aviso && <ModalConfirm variante="aviso" mensagem={aviso} onCancel={() => setAviso(null)} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(249,115,22,0.1)', padding: '10px', borderRadius: '10px' }}>
                        <ClipboardCheck size={28} color="#f97316" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>Gestão de Checklists</h1>
                        <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 0 0' }}>Aprovação e histórico de vistorias de doca</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div style={{
                background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)',
                padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '300px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por placa ou motorista..."
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 10px 10px 36px', color: 'white', fontSize: '14px', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15,23,42,0.6)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Filter size={16} color="#64748b" />
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>PERÍODO:</span>
                    <input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#64748b' }}>até</span>
                    <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                    />
                </div>
            </div>

            {/* LISTAGEM */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }} className="custom-scroll">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>Carregando checklists...</div>
                ) : checklistsFiltrados.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#64748b', background: 'rgba(30,41,59,0.3)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                        <ClipboardCheck size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <span style={{ fontSize: '16px' }}>Nenhum checklist encontrado neste período.</span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', alignItems: 'start' }}>
                        {checklistsFiltrados.map(chk => {
                            const corStatus = getStatusColor(chk.status);

                            return (
                                <div key={chk.id} style={{
                                    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                                }}>
                                    {/* HEADER CARD */}
                                    <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '1px' }}>{chk.placa_carreta}</div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} />
                                                {new Date(chk.created_at).toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                        <div style={{
                                            background: corStatus.bg, color: corStatus.text, border: `1px solid ${corStatus.border}`,
                                            padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
                                        }}>
                                            {chk.status || 'PENDENTE'}
                                        </div>
                                    </div>

                                    {/* BODY CARD */}
                                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div>
                                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>MOTORISTA</span>
                                            <div style={{ fontSize: '14px', color: '#f1f5f9' }}>{chk.motorista_nome || 'N/I'}</div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CONDIÇÃO DO BAÚ</span>
                                            <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{chk.condicao_bau || 'N/I'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div>
                                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>PLACA CONFERE</span>
                                                <div style={{ fontSize: '13px', color: chk.placa_confere ? '#4ade80' : '#f87171' }}>{chk.placa_confere ? 'SIM' : 'NÃO'}</div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CORDAS</span>
                                                <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{chk.cordas > 0 ? `${chk.cordas} un.` : 'NÃO'}</div>
                                            </div>
                                        </div>

                                        {/* Detalhes de Paletização (NOVO) */}
                                        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>PALETIZAÇÃO</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{chk.is_paletizado === 'BATIDA_PALETIZADA' ? 'BATIDA E PALETIZADA' : (chk.is_paletizado || 'N/I')}</div>
                                                </div>
                                                {chk.tipo_palete && (
                                                    <div>
                                                        <span style={{ fontSize: '9px', color: '#64748b' }}>TIPO:</span>
                                                        <div style={{ fontSize: '12px', color: '#fb923c', fontWeight: 'bold' }}>{chk.tipo_palete}</div>
                                                    </div>
                                                )}
                                                {chk.qtd_paletes > 0 && (
                                                    <div>
                                                        <span style={{ fontSize: '9px', color: '#64748b' }}>QTD:</span>
                                                        <div style={{ fontSize: '12px', color: '#fb923c', fontWeight: 'bold' }}>{chk.qtd_paletes} un.</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* FOTO SE HOUVER */}
                                        {chk.foto_vazamento && (
                                            <div style={{ marginTop: '4px' }}>
                                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>FOTO DA AVARIA</span>
                                                <img src={chk.foto_vazamento} alt="Avaria" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }} />
                                            </div>
                                        )}

                                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.05)', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                            Registrado por: {chk.conferente_nome || 'Sistema'}
                                        </div>
                                    </div>

                                    {/* FOOTER ACTIONS (COORDENADOR) */}
                                    {podeAprovar && chk.status === 'PENDENTE' && (
                                        <div style={{ display: 'flex', background: 'rgba(15,23,42,0.4)', padding: '12px 16px', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button
                                                onClick={() => handleAtualizarStatus(chk.id, 'RECUSADO')}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                                            >
                                                <XCircle size={14} /> RECUSAR
                                            </button>
                                            <button
                                                onClick={() => handleAtualizarStatus(chk.id, 'APROVADO')}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.25)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
                                            >
                                                <CheckCircle size={14} /> APROVAR
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
