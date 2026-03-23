import React, { useEffect, useCallback } from 'react';
import useConferenteStore from './useConferenteStore';
import useAuthStore from '../store/useAuthStore';
import ConferenteHeader from './ConferenteHeader';
import ConferenteChecklist from './ConferenteChecklist';
import ConferenteChecklistForm from './ConferenteChecklistForm';
import ConferenteEmbarques from './ConferenteEmbarques';

// Som de notificação (beep simples via Web Audio API)
const playNotificationSound = () => {
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
    } catch (e) { /* audio context não suportado */ }
};

export default function ConferenteApp({ socket }) {
    const { page, selectedVeiculo, toasts, addToast, removeToast, triggerRefresh } = useConferenteStore();
    const user = useAuthStore(state => state.user);

    // PWA: usar manifest e título dedicados ao conferente
    useEffect(() => {
        document.title = 'Conferente — Transnet';
        let link = document.querySelector("link[rel='manifest']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
        }
        link.href = '/conferente-manifest.json';
        return () => {
            document.title = 'Transnet Operacional';
            if (link) link.href = '/manifest.json';
        };
    }, []);

    // Auto-remover toasts após 5 segundos
    useEffect(() => {
        if (toasts.length === 0) return;
        const last = toasts[toasts.length - 1];
        const timer = setTimeout(() => removeToast(last.id), 5000);
        return () => clearTimeout(timer);
    }, [toasts, removeToast]);

    const handleNovoVeiculo = useCallback((data) => {
        // Só notificar se for da mesma cidade do conferente
        if (data.cidade && data.cidade !== user?.cidade) return;
        addToast({
            tipo: 'info',
            mensagem: `Novo veículo para checklist: ${data.motorista} - Doca ${data.doca || 'N/A'}`
        });
        playNotificationSound();
        triggerRefresh();
    }, [user?.cidade, addToast, triggerRefresh]);

    const handleChecklistResultado = useCallback((data) => {
        if (data.status === 'RESET') {
            addToast({ tipo: 'info', mensagem: 'Checklist liberado para refazer.' });
            triggerRefresh();
        } else {
            const cor = data.status === 'APROVADO' ? 'success' : 'error';
            addToast({ tipo: cor, mensagem: `Checklist ${data.status}: ${data.motorista}` });
        }
        playNotificationSound();
    }, [addToast, triggerRefresh]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;
        socket.on('conferente_novo_veiculo', handleNovoVeiculo);
        socket.on('conferente_checklist_resultado', handleChecklistResultado);
        socket.on('receber_atualizacao', triggerRefresh);
        return () => {
            socket.off('conferente_novo_veiculo', handleNovoVeiculo);
            socket.off('conferente_checklist_resultado', handleChecklistResultado);
            socket.off('receber_atualizacao', triggerRefresh);
        };
    }, [socket, handleNovoVeiculo, handleChecklistResultado, triggerRefresh]);

    const TOAST_CORES = {
        info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' },
        success: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e' },
        error: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
            color: '#e2e8f0'
        }}>
            <ConferenteHeader />

            {/* Toasts */}
            <div style={{
                position: 'fixed', top: '70px', right: '16px',
                zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px',
                maxWidth: '340px', width: '100%'
            }}>
                {toasts.map(toast => {
                    const cores = TOAST_CORES[toast.tipo] || TOAST_CORES.info;
                    return (
                        <div
                            key={toast.id}
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: cores.bg,
                                border: `1px solid ${cores.border}`,
                                borderRadius: '10px',
                                padding: '12px 16px',
                                fontSize: '13px', fontWeight: 500,
                                color: 'white',
                                cursor: 'pointer',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                animation: 'slideIn 0.3s ease-out'
                            }}
                        >
                            {toast.mensagem}
                        </div>
                    );
                })}
            </div>

            {/* Conteúdo */}
            <main style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
                {page === 'checklist' && <ConferenteChecklist socket={socket} />}
                {page === 'checklistForm' && selectedVeiculo && <ConferenteChecklistForm veiculo={selectedVeiculo} socket={socket} />}
                {page === 'embarques' && <ConferenteEmbarques />}
            </main>

            {/* CSS animation for toasts */}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
