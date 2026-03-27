import React, { useState, useEffect } from 'react';
import { Truck, ShieldCheck, Link2, Monitor, ArrowRight, Wifi, WifiOff, LogOut } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';

const CARDS = [
    {
        id: 'operacional',
        Icon: Truck,
        titulo: 'Painel Operacional',
        descricao: 'Recife & Moreno',
        cor: '#3b82f6',
        corFundo: 'rgba(59,130,246,0.08)',
        corBorda: 'rgba(59,130,246,0.25)',
    },
    {
        id: 'cadastro',
        Icon: ShieldCheck,
        titulo: 'Ger. Risco',
        descricao: 'CT-e & Liberações',
        cor: '#f59e0b',
        corFundo: 'rgba(245,158,11,0.08)',
        corBorda: 'rgba(245,158,11,0.25)',
    },
    {
        id: 'marcacoes',
        Icon: Link2,
        titulo: 'Marcação de Placas',
        descricao: 'Links & Motoristas',
        cor: '#22c55e',
        corFundo: 'rgba(34,197,94,0.08)',
        corBorda: 'rgba(34,197,94,0.25)',
    },
    {
        id: 'dashboard',
        Icon: Monitor,
        titulo: 'Dashboard TV',
        descricao: 'Visão geral',
        cor: '#a78bfa',
        corFundo: 'rgba(167,139,250,0.08)',
        corBorda: 'rgba(167,139,250,0.25)',
    },
];

export default function MobileHome({ onNavegar }) {
    const { user, logout, temAcesso } = useAuthStore();
    const [hora, setHora] = useState(new Date());
    const [stats, setStats] = useState({ veiculos: 0, motoristas: 0, tokens: 0 });
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const t = setInterval(() => setHora(new Date()), 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    useEffect(() => {
        const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
        Promise.allSettled([
            api.get(`/api/veiculos?origem=Recife&dataInicio=${hoje}&dataFim=${hoje}`),
            api.get('/api/marcacoes?limite=1'),
            api.get('/api/tokens'),
        ]).then(([v, m, t]) => {
            setStats({
                veiculos: v.status === 'fulfilled' ? (v.value.data.veiculos?.length ?? 0) : 0,
                motoristas: m.status === 'fulfilled' ? (m.value.data.total ?? 0) : 0,
                tokens: t.status === 'fulfilled' ? (t.value.data.tokens?.filter(tk => tk.status === 'ativo').length ?? 0) : 0,
            });
        });
    }, []);

    const formatarHora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });
    const formatarData = (d) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Recife' });

    const badgePorCard = {
        operacional: stats.veiculos > 0 ? `${stats.veiculos} veíc.` : null,
        cadastro:    null,
        marcacoes:   stats.tokens > 0 ? `${stats.tokens} ativos` : null,
        dashboard:   null,
    };

    return (
        <div style={{ padding: '0', paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{
                padding: '20px 20px 16px',
                background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
                borderBottom: '1px solid #0f172a',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500', marginBottom: '4px' }}>
                            Olá, {user?.nome?.split(' ')[0]}
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-1px', lineHeight: 1 }}>
                            {formatarHora(hora)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', textTransform: 'capitalize' }}>
                            {formatarData(hora)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        {/* Badge online/offline */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '20px',
                            background: online ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${online ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                            {online
                                ? <Wifi size={11} color="#4ade80" strokeWidth={2} />
                                : <WifiOff size={11} color="#f87171" strokeWidth={2} />
                            }
                            <span style={{ fontSize: '11px', fontWeight: '600', color: online ? '#4ade80' : '#f87171' }}>
                                {online ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        {/* Logout */}
                        <button onClick={logout} style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: 'none', border: '1px solid #1e293b', borderRadius: '8px',
                            color: '#475569', fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>
                            <LogOut size={11} strokeWidth={2} />
                            Sair
                        </button>
                    </div>
                </div>

                {/* Cargo badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    marginTop: '12px', padding: '5px 12px', borderRadius: '20px',
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#60a5fa', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {user?.cargo}
                    </span>
                    {user?.cidade && (
                        <span style={{ fontSize: '11px', color: '#475569' }}>· {user.cidade}</span>
                    )}
                </div>
            </div>

            {/* Grid de cards */}
            <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {CARDS.filter(card => card.id !== 'marcacoes' || temAcesso('marcacao_placas')).map(card => (
                    <button
                        key={card.id}
                        onClick={() => onNavegar(card.id)}
                        style={{
                            background: card.corFundo,
                            border: `1px solid ${card.corBorda}`,
                            borderRadius: '16px',
                            padding: '20px 16px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                            outline: 'none',
                            position: 'relative',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                            boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
                            minHeight: '110px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                        }}
                        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {/* Badge de contagem */}
                        {badgePorCard[card.id] && (
                            <div style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: card.cor, borderRadius: '10px',
                                padding: '2px 7px', fontSize: '10px', fontWeight: '700', color: '#fff',
                            }}>
                                {badgePorCard[card.id]}
                            </div>
                        )}

                        <div>
                            <card.Icon size={28} color={card.cor} strokeWidth={1.6} style={{ marginBottom: '10px' }} />
                        </div>

                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1.2, marginBottom: '3px' }}>
                                {card.titulo}
                            </div>
                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>
                                {card.descricao}
                            </div>
                        </div>

                        {/* Seta indicadora */}
                        <div style={{ position: 'absolute', bottom: '12px', right: '14px', opacity: 0.5 }}>
                            <ArrowRight size={14} color={card.cor} strokeWidth={2} />
                        </div>
                    </button>
                ))}
            </div>

            {/* Rodapé */}
            <div style={{ padding: '0 16px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#1e293b' }}>Transnet Operacional · Portal Mobile</div>
            </div>
        </div>
    );
}
