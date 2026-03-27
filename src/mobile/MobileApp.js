import React, { useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import MobileLogin from './MobileLogin';
import MobileHome from './MobileHome';
import MobileOperacional from './MobileOperacional';
import MobileCadastro from './MobileCadastro';
import MobileMarcacoes from './MobileMarcacoes';
import MobileDashboardTV from './MobileDashboardTV';

const NAV_ITEMS = [
    { id: 'home',        icon: '🏠', label: 'Home' },
    { id: 'operacional', icon: '🚛', label: 'Operação' },
    { id: 'cadastro',    icon: '📋', label: 'Ger. Risco' },
    { id: 'marcacoes',   icon: '🔗', label: 'Marcações' },
    { id: 'dashboard',   icon: '📺', label: 'Dashboard' },
];

export default function MobileApp({ socket }) {
    const { isAuthenticated } = useAuthStore();
    const [tela, setTela] = useState('home');

    if (!isAuthenticated) {
        return <MobileLogin />;
    }

    const renderTela = () => {
        switch (tela) {
            case 'operacional': return <MobileOperacional socket={socket} />;
            case 'cadastro':    return <MobileCadastro socket={socket} />;
            case 'marcacoes':   return <MobileMarcacoes socket={socket} />;
            case 'dashboard':   return <MobileDashboardTV socket={socket} />;
            default:            return <MobileHome onNavegar={setTela} socket={socket} />;
        }
    };

    return (
        <div style={{
            background: '#020617',
            minHeight: '100vh',
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: '#f1f5f9',
            overflowX: 'hidden',
        }}>
            {/* Conteúdo */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
            }}>
                {renderTela()}
            </div>

            {/* Bottom Navigation */}
            <nav style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(64px + env(safe-area-inset-bottom))',
                background: 'rgba(15,23,42,0.97)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'flex-start',
                paddingTop: '4px',
                paddingBottom: 'env(safe-area-inset-bottom)',
                zIndex: 1000,
            }}>
                {NAV_ITEMS.map(item => {
                    const ativo = tela === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setTela(item.id)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px 4px',
                                minHeight: '56px',
                                WebkitTapHighlightColor: 'transparent',
                                outline: 'none',
                            }}
                        >
                            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: ativo ? '700' : '500',
                                color: ativo ? '#3b82f6' : '#475569',
                                letterSpacing: '0.2px',
                                lineHeight: 1.2,
                            }}>
                                {item.label}
                            </span>
                            {ativo && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 'calc(env(safe-area-inset-bottom) + 4px)',
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                }} />
                            )}
                        </button>
                    );
                })}
            </nav>

            <style>{`
                * { box-sizing: border-box; }
                input, select, textarea { font-size: 16px !important; }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
