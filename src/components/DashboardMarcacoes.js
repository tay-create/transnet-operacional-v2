import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, AlertTriangle, Truck, MapPin, Clock, TrendingUp } from 'lucide-react';
import api from '../services/apiService';

function Card({ icon, label, valor, cor }) {
    return (
        <div style={{
            background: 'rgba(0,0,0,0.25)', border: `1px solid ${cor}33`,
            borderRadius: '12px', padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '14px'
        }}>
            <div style={{ color: cor, flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: cor, lineHeight: 1 }}>{valor}</div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>{label}</div>
            </div>
        </div>
    );
}

export default function DashboardMarcacoes() {
    const [marcacoes, setMarcacoes] = useState([]);
    const [loading, setLoading] = useState(true);

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/marcacoes?limit=200&page=1');
            if (r.data.success) setMarcacoes(r.data.marcacoes || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    const terceiros = marcacoes.filter(m => !m.is_frota);
    const disponiveis = terceiros.filter(m => (m.status_operacional || 'DISPONIVEL') === 'DISPONIVEL' && m.disponibilidade !== 'Indisponível');
    const emViagem = terceiros.filter(m => m.status_operacional === 'EM VIAGEM' || m.status_operacional === 'EM ROTA');
    const favoritos = terceiros.filter(m => m.favorito);
    const problematicos = terceiros.filter(m => m.tag_motorista === 'PROBLEMÁTICO');
    const frota = marcacoes.filter(m => m.is_frota);

    function formatarData(dt) {
        if (!dt) return '—';
        const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const tabela = [
        ...problematicos.map(m => ({ ...m, _ordem: 0 })),
        ...favoritos.filter(m => m.tag_motorista !== 'PROBLEMÁTICO').map(m => ({ ...m, _ordem: 1 })),
        ...terceiros.filter(m => !m.favorito && m.tag_motorista !== 'PROBLEMÁTICO').map(m => ({ ...m, _ordem: 2 })),
    ];

    return (
        <div style={{ padding: '16px 20px', overflowY: 'auto', height: 'calc(100vh - 124px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <TrendingUp size={22} color="#60a5fa" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Dashboard de Marcações</span>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '60px' }}>Carregando...</div>
            ) : (
                <>
                    {/* Cards de resumo */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        <Card icon={<Users size={22} />} label="Total Terceiros" valor={terceiros.length} cor="#60a5fa" />
                        <Card icon={<MapPin size={22} />} label="Disponíveis" valor={disponiveis.length} cor="#4ade80" />
                        <Card icon={<Clock size={22} />} label="Em Viagem" valor={emViagem.length} cor="#facc15" />
                        <Card icon={<Star size={22} />} label="Favoritos" valor={favoritos.length} cor="#facc15" />
                        <Card icon={<AlertTriangle size={22} />} label="Problemáticos" valor={problematicos.length} cor="#f87171" />
                        <Card icon={<Truck size={22} />} label="Frota Própria" valor={frota.length} cor="#7dd3fc" />
                    </div>

                    {/* Tabela de motoristas */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    {['Motorista', 'Placa 1', 'Placa 2', 'Localização', 'Status', 'Viagens', 'Última Marcação', 'Tags'].map(h => (
                                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tabela.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '7px 10px', color: '#e2e8f0', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px' }}>
                                            {m.nome_motorista}
                                        </td>
                                        <td style={{ padding: '7px 10px', color: '#60a5fa', fontWeight: '700' }}>{m.placa1}</td>
                                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{m.placa2 || '—'}</td>
                                        <td style={{ padding: '7px 10px', color: m.disponibilidade === 'NO PÁTIO' ? '#4ade80' : m.disponibilidade === 'NO POSTO' ? '#fbbf24' : '#94a3b8' }}>
                                            {m.disponibilidade || '—'}
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700',
                                                background: m.status_operacional === 'DISPONIVEL' || !m.status_operacional ? 'rgba(34,197,94,0.12)' : m.status_operacional === 'EM VIAGEM' ? 'rgba(250,204,21,0.12)' : 'rgba(100,116,139,0.12)',
                                                color: m.status_operacional === 'DISPONIVEL' || !m.status_operacional ? '#4ade80' : m.status_operacional === 'EM VIAGEM' ? '#facc15' : '#94a3b8',
                                            }}>
                                                {m.status_operacional || 'DISPONIVEL'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '7px 10px', color: '#facc15', fontWeight: '700' }}>{m.viagens_realizadas ?? 0}</td>
                                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{formatarData(m.data_marcacao)}</td>
                                        <td style={{ padding: '7px 10px' }}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {m.favorito ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: '700', color: '#facc15', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '4px', padding: '1px 5px' }}>
                                                        <Star size={9} fill="#facc15" /> FAVORITO
                                                    </span>
                                                ) : null}
                                                {m.tag_motorista === 'PROBLEMÁTICO' ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '1px 5px' }}>
                                                        <AlertTriangle size={9} /> PROBLEMÁTICO
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {tabela.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Nenhuma marcação registrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
