import React, { useState, useEffect, useCallback } from 'react';
import { Home, Truck, ShieldCheck, Link2, Monitor, ClipboardCheck } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useConfigStore from '../store/useConfigStore';
import MobileLogin from './MobileLogin';
import MobileHome from './MobileHome';
import MobileOperacional from './MobileOperacional';
import MobileCadastro from './MobileCadastro';
import MobileMarcacoes from './MobileMarcacoes';
import MobileDashboardTV from './MobileDashboardTV';
import ChecklistPainel from '../checklist/ChecklistPainel';

const CARGOS_CHECKLIST = ['Coordenador', 'Direção'];

const NAV_ITEMS = [
    { id: 'home',        Icon: Home,            label: 'Home' },
    { id: 'operacional', Icon: Truck,           label: 'Operação' },
    { id: 'cadastro',    Icon: ShieldCheck,     label: 'Ger. Risco' },
    { id: 'marcacoes',   Icon: Link2,           label: 'Marcações' },
    { id: 'dashboard',   Icon: Monitor,         label: 'Dashboard' },
    { id: 'checklist',   Icon: ClipboardCheck,  label: 'Checklist' },
];

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch { /* não suportado */ }
}

export default function MobileApp({ socket }) {
    const { isAuthenticated, temAcesso, user } = useAuthStore();
    const { carregarPermissoes } = useConfigStore();
    const [tela, setTela] = useState('home');
    const [toasts, setToasts] = useState([]);
    const [pendentesChecklist, setPendentesChecklist] = useState(0);

    const addToast = useCallback(({ tipo, mensagem }) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, tipo, mensagem }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    useEffect(() => {
        if (isAuthenticated) carregarPermissoes();
    }, [isAuthenticated, carregarPermissoes]);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo === 'checklist_pendente') {
                playBeep();
                addToast({ tipo: 'info', mensagem: `Novo checklist pendente: ${data.mensagem || ''}` });
                setPendentesChecklist(n => n + 1);
            }
        };
        socket.on('receber_alerta', handler);
        return () => socket.off('receber_alerta', handler);
    }, [socket, addToast]);

    if (!isAuthenticated) {
        return <MobileLogin />;
    }

    const temChecklist = CARGOS_CHECKLIST.includes(user?.cargo);

    const renderTela = () => {
        switch (tela) {
            case 'operacional': return <MobileOperacional socket={socket} />;
            case 'cadastro':    return <MobileCadastro socket={socket} />;
            case 'marcacoes':   return <MobileMarcacoes socket={socket} />;
            case 'dashboard':   return <MobileDashboardTV socket={socket} />;
            case 'checklist':   return (
                <div style={{ padding: '16px', paddingTop: 'env(safe-area-inset-top)' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '16px' }}>Checklist</div>
                    <ChecklistPainel socket={socket} addToast={addToast} />
                </div>
            );
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
            {/* Toasts */}
            {toasts.length > 0 && (
                <div style={{ position: 'fixed', top: '12px', right: '12px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px', width: 'calc(100% - 24px)' }}>
                    {toasts.map(t => (
                        <div key={t.id} onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} style={{
                            background: t.tipo === 'info' ? 'rgba(59,130,246,0.95)' : t.tipo === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
                            borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: 500,
                            color: 'white', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        }}>{t.mensagem}</div>
                    ))}
                </div>
            )}

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
                {NAV_ITEMS.filter(item => {
                    if (item.id === 'marcacoes') return temAcesso('marcacao_placas');
                    if (item.id === 'checklist') return temChecklist;
                    return true;
                }).map(item => {
                    const ativo = tela === item.id;
                    const badge = item.id === 'checklist' && pendentesChecklist > 0 ? pendentesChecklist : 0;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setTela(item.id); if (item.id === 'checklist') setPendentesChecklist(0); }}
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
                                position: 'relative',
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <item.Icon size={20} color={ativo ? '#3b82f6' : '#475569'} strokeWidth={ativo ? 2.5 : 1.8} />
                                {badge > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '-5px', right: '-7px',
                                        background: '#f59e0b', color: '#000', borderRadius: '50%',
                                        fontSize: '9px', fontWeight: '900', width: '15px', height: '15px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                                    }}>{badge > 9 ? '9+' : badge}</span>
                                )}
                            </div>
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
