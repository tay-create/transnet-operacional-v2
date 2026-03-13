import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';
import ChecklistPainel from './ChecklistPainel';

const playBeep = () => {
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
};

export default function ChecklistApp({ socket }) {
    const { user, logout } = useAuthStore();
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback(({ tipo, mensagem }) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, tipo, mensagem }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    useEffect(() => {
        document.title = 'Checklist — Transnet';
        let link = document.querySelector("link[rel='manifest']");
        if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
        link.href = '/checklist-manifest.json';
        return () => { document.title = 'Transnet Operacional'; if (link) link.href = '/manifest.json'; };
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo === 'checklist_pendente') {
                addToast({ tipo: 'info', mensagem: `Novo checklist pendente: ${data.mensagem || ''}` });
                playBeep();
            }
        };
        socket.on('receber_alerta', handler);
        return () => socket.off('receber_alerta', handler);
    }, [socket, addToast]);

    const TOAST_CORES = {
        info:    { bg: 'rgba(59,130,246,0.9)', border: '#3b82f6' },
        success: { bg: 'rgba(34,197,94,0.9)',  border: '#22c55e' },
        error:   { bg: 'rgba(239,68,68,0.9)',  border: '#ef4444' },
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#020617 0%,#0f172a 50%,#020617 100%)', color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)' }}>
                <div>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#f1f5f9', letterSpacing: '1px' }}>TRANSNET CHECKLIST</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{user?.nome || 'Coordenador'}</div>
                </div>
                <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>
                    Sair
                </button>
            </div>

            {/* Toasts */}
            <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px', width: '100%' }}>
                {toasts.map(t => {
                    const cores = TOAST_CORES[t.tipo] || TOAST_CORES.info;
                    return (
                        <div key={t.id} onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} style={{ background: cores.bg, border: `1px solid ${cores.border}`, borderRadius: '10px', padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'white', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'slideIn 0.3s ease-out' }}>
                            {t.mensagem}
                        </div>
                    );
                })}
            </div>

            {/* Conteúdo */}
            <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
                <ChecklistPainel socket={socket} addToast={addToast} />
            </main>

            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>
        </div>
    );
}
