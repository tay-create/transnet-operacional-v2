import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ClipboardCheck, List, LogOut, User } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useConferenteStore from './useConferenteStore';

export default function ConferenteHeader() {
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);
    const { page, setPage } = useConferenteStore();
    const [menuAberto, setMenuAberto] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickFora = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuAberto(false);
            }
        };
        document.addEventListener('mousedown', handleClickFora);
        return () => document.removeEventListener('mousedown', handleClickFora);
    }, []);

    const handleLogout = () => {
        logout();
        window.location.href = '/conferente';
    };

    const menuItems = [
        { label: 'Checklist', icon: ClipboardCheck, page: 'checklist', cor: '#3b82f6' },
        { label: 'Lista de Embarques', icon: List, page: 'embarques', cor: '#8b5cf6' },
    ];

    return (
        <header style={{
            position: 'sticky', top: 0, zIndex: 50,
            background: 'rgba(2, 6, 23, 0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '16px', letterSpacing: '1px' }}>TRANSNET</span>
                <span style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    fontSize: '10px', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '6px',
                    letterSpacing: '0.5px', textTransform: 'uppercase'
                }}>
                    CONFERENTE
                </span>
            </div>

            {/* Profile Dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setMenuAberto(!menuAberto)}
                    style={{
                        background: menuAberto ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', color: '#e2e8f0',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <User size={14} color="#60a5fa" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.nome || 'Conferente'}
                    </span>
                    <ChevronDown size={14} color="#94a3b8" style={{
                        transform: menuAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                    }} />
                </button>

                {menuAberto && (
                    <div style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                        background: 'rgba(15, 23, 42, 0.98)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '6px',
                        minWidth: '200px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                        {/* Info do usuário */}
                        <div style={{
                            padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            marginBottom: '4px'
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{user?.nome}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{user?.cidade} - Conferente</div>
                        </div>

                        {/* Menu Items */}
                        {menuItems.map((item) => (
                            <button
                                key={item.page}
                                onClick={() => { setPage(item.page); setMenuAberto(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '10px 12px',
                                    background: page === item.page ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    border: 'none', borderRadius: '8px',
                                    cursor: 'pointer', color: page === item.page ? '#60a5fa' : '#cbd5e1',
                                    fontSize: '13px', fontWeight: 500,
                                    transition: 'all 0.15s',
                                    textAlign: 'left'
                                }}
                            >
                                <item.icon size={16} color={page === item.page ? item.cor : '#94a3b8'} />
                                {item.label}
                            </button>
                        ))}

                        {/* Separador */}
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', padding: '10px 12px',
                                background: 'transparent', border: 'none', borderRadius: '8px',
                                cursor: 'pointer', color: '#f87171',
                                fontSize: '13px', fontWeight: 500,
                                transition: 'all 0.15s',
                                textAlign: 'left'
                            }}
                        >
                            <LogOut size={16} color="#f87171" />
                            Sair
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
