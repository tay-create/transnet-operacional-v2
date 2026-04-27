import React, { useEffect, useState } from 'react';
import {
    Bell, User, Check, X,
    Calendar, LogOut, ClipboardList, FileText,
    AlertTriangle, ShieldOff, MessageCircle, MessageSquare
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useUIStore from '../store/useUIStore';
import api from '../services/apiService';
import logoImg from '../assets/logo.png';
import ModalChamados from './ModalChamados';

function BotaoWhatsapp({ usuarioId, telefone, nome, onEnviado }) {
    const [enviado, setEnviado] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleEnviar = async () => {
        if (loading || enviado) return;
        setLoading(true);
        try {
            const r = await api.post(`/usuarios/${usuarioId}/gerar-token-reset`);
            if (r.data.success) {
                const tel = (r.data.telefone || telefone || '').replace(/\D/g, '');
                const msg = encodeURIComponent(
                    `Olá ${nome}! Seu código de recuperação de senha do sistema Transnet é: *${r.data.token}*. Válido por 15 minutos. Não compartilhe com ninguém.`
                );
                window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
                setEnviado(true);
                setTimeout(() => onEnviado?.(), 1500);
            }
        } catch {
            // silently fail — coordinator sees nothing happened
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleEnviar}
            disabled={loading || enviado}
            style={{
                background: enviado ? '#15803d' : '#25D366',
                border: 'none', color: 'white',
                padding: '4px 10px', borderRadius: '4px',
                fontSize: '10px', fontWeight: 'bold',
                cursor: enviado ? 'default' : 'pointer',
                marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px',
                opacity: loading ? 0.7 : 1
            }}
        >
            <MessageCircle size={12} />
            {enviado ? 'ENVIADO ✓' : loading ? 'GERANDO...' : 'ENVIAR WHATSAPP'}
        </button>
    );
}

export default function Header({
    onLogout,
    aceitarCtePelaNotificacao,
    handleRemoverNotificacao,
    socket
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
    const [modalChamadosAberto, setModalChamadosAberto] = useState(false);

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
        <>
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

                {(user.cargo === 'Coordenador' || user.cargo === 'Planejamento' || user.cargo === 'Desenvolvedor') && (
                    <button
                        onClick={() => openModal('logs')}
                        className="btn-menu-toggle"
                        title="Logs e Auditoria"
                        style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FileText size={18} color="#a855f7" />
                    </button>
                )}

                <button
                    onClick={() => setModalChamadosAberto(true)}
                    className="btn-menu-toggle"
                    title="Chamados e Melhorias"
                    style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <MessageSquare size={18} color="#34d399" />
                </button>

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
                                    (Array.isArray(notificacoes) ? notificacoes : []).filter(notif => notif.mensagem).map((notif, index) => (
                                        <div key={index} className="notif-item" style={{
                                            borderLeft: notif.tipo === 'liberacao_expirada' ? '3px solid #ef4444'
                                                : notif.tipo === 'liberacao_vencendo' ? '3px solid #f59e0b'
                                                    : undefined
                                        }}>
                                            <div className="notif-icon">
                                                {notif.tipo === 'aceite_cte_pendente' && <Check size={16} color="#22c55e" />}
                                                {notif.tipo === 'liberacao_expirada' && <ShieldOff size={16} color="#ef4444" />}
                                                {notif.tipo === 'liberacao_vencendo' && <AlertTriangle size={16} color="#f59e0b" />}
                                                {notif.tipo === 'admin_senha' && <MessageCircle size={16} color="#25D366" />}
                                                {!['aceite_cte_pendente', 'liberacao_expirada', 'liberacao_vencendo', 'admin_senha'].includes(notif.tipo) && <Bell size={16} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: '0 0 4px 0', lineHeight: '1.4' }}>{notif.mensagem}</p>
                                                {notif.data_criacao && (
                                                    <span style={{ fontSize: '10px', color: '#475569' }}>
                                                        {new Date(notif.data_criacao).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                                {notif.tipo === 'aceite_cte_pendente' && (
                                                    <button onClick={() => { aceitarCtePelaNotificacao(notif); toggleNotificacoes(); }} style={{ background: '#22c55e', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>ACEITAR CT-E</button>
                                                )}
                                                {notif.tipo === 'admin_senha' && (
                                                    <BotaoWhatsapp
                                                        usuarioId={notif.usuarioId}
                                                        telefone={notif.telefone}
                                                        nome={notif.nome}
                                                        onEnviado={() => onRemoverClick(notif.idInterno)}
                                                    />
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

        {modalChamadosAberto && (
            <ModalChamados
                user={user}
                socket={socket}
                onClose={() => setModalChamadosAberto(false)}
            />
        )}
        </>
    );
}