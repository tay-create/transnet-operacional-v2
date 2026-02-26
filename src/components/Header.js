import React, { useEffect, useState } from 'react';
import {
    Bell, User, Check, X,
    Calendar, LogOut, ClipboardList, FileText,
    AlertTriangle, ShieldOff
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useUIStore from '../store/useUIStore';
import logoImg from '../assets/logo.png';

export default function Header({
    onLogout,
    aceitarCtePelaNotificacao,
    handleRemoverNotificacao
}) {
    const { user, temAcesso } = useAuthStore();
    const {
        notificacoes,
        menuNotificacaoAberto,
        toggleNotificacoes,
        removerNotificacao,
        openModal
    } = useUIStore();

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateString = time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

    const onRemoverClick = (idInterno) => {
        if (typeof handleRemoverNotificacao === 'function') {
            handleRemoverNotificacao(idInterno);
        } else {
            removerNotificacao(idInterno);
        }
    };

    return (
        <header className="header-glass">
            {/* LOGOTIPO - USANDO NOVO ASSET logo.png */}
            <div style={{ padding: '2px 0', marginLeft: '10px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'default',
                    userSelect: 'none',
                    transition: 'transform 0.3s ease'
                }} className="logo-group">
                    <img
                        src={logoImg}
                        alt="TRANSNET"
                        className="animate-wind"
                        style={{
                            height: '90px', /* Aumentado conforme solicitado */
                            width: 'auto',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.2))'
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: 'white', lineHeight: '1', textShadow: '0 0 10px rgba(59,130,246,0.5)' }}>
                        {timeString}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={10} /> {dateString}
                    </div>
                </div>

                <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }}></div>

                {temAcesso('fila') && (
                    <button
                        onClick={() => openModal('fila')}
                        className="btn-menu-toggle"
                        title="Abrir Fila de Espera"
                        style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ClipboardList size={18} color="#fbbf24" />
                    </button>
                )}

                {(user.cargo === 'Coordenador' || user.cargo === 'Planejamento') && (
                    <button
                        onClick={() => openModal('logs')}
                        className="btn-menu-toggle"
                        title="Logs e Auditoria"
                        style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FileText size={18} color="#a855f7" />
                    </button>
                )}

                <div style={{ position: 'relative' }}>
                    <button className="notification-btn" onClick={toggleNotificacoes} style={{ position: 'relative' }}>
                        <Bell size={24} />
                        {(notificacoes || []).length > 0 && (
                            <span className="notification-badge">
                                {(notificacoes || []).length > 9 ? '+9' : (notificacoes || []).length}
                            </span>
                        )}
                    </button>

                    {menuNotificacaoAberto && (
                        <div className="notification-dropdown">
                            <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>NOTIFICAÇÕES ({(notificacoes || []).length})</span>
                                <span onClick={toggleNotificacoes} style={{ cursor: 'pointer', fontSize: '10px', color: '#64748b' }}>FECHAR</span>
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {Array.isArray(notificacoes) && notificacoes.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Nenhum alerta recente.</div>
                                ) : (
                                    (Array.isArray(notificacoes) ? notificacoes : []).map((notif, index) => (
                                        <div key={index} className="notif-item" style={{
                                            borderLeft: notif.tipo === 'liberacao_expirada' ? '3px solid #ef4444'
                                                : notif.tipo === 'liberacao_vencendo' ? '3px solid #f59e0b'
                                                    : undefined
                                        }}>
                                            <div className="notif-icon">
                                                {notif.tipo === 'aceite_cte_pendente' && <Check size={16} color="#22c55e" />}
                                                {notif.tipo === 'liberacao_expirada' && <ShieldOff size={16} color="#ef4444" />}
                                                {notif.tipo === 'liberacao_vencendo' && <AlertTriangle size={16} color="#f59e0b" />}
                                                {!['aceite_cte_pendente', 'liberacao_expirada', 'liberacao_vencendo'].includes(notif.tipo) && <Bell size={16} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: '0 0 5px 0', lineHeight: '1.4' }}>{notif.mensagem}</p>
                                                {notif.tipo === 'aceite_cte_pendente' && (
                                                    <button onClick={() => { aceitarCtePelaNotificacao(notif); toggleNotificacoes(); }} style={{ background: '#22c55e', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>ACEITAR CT-E</button>
                                                )}
                                            </div>
                                            <button onClick={() => onRemoverClick(notif.idInterno)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={14} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }}></div>

                <div className="user-chip" onClick={() => openModal('avatar')} style={{ cursor: 'pointer' }}>
                    <div className="user-info">
                        <span className="user-name">{user?.nome ?? '...'}</span>
                        <span className="user-role">{user?.cargo}</span>
                    </div>
                    <div className="user-avatar" style={{ overflow: 'hidden', border: '2px solid rgba(59,130,246,0.5)' }}>
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <User size={18} />
                        )}
                    </div>
                </div>

                <button onClick={onLogout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title="Sair do Sistema">
                    <LogOut size={16} />
                </button>
            </div>
        </header>
    );
}