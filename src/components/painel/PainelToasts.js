import React from 'react';
import { Lock, Bell } from 'lucide-react';

export default function PainelToasts({ toasts }) {
    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
            {toasts.map(t => {
                const ehErro = t.tipo === 'erro';
                return (
                    <div key={t.id} style={{
                        background: 'rgba(15,23,42,0.95)',
                        border: `1px solid ${ehErro ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)'} `,
                        borderRadius: '10px', padding: '12px 16px', color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxWidth: '340px',
                        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
                        animation: 'slideIn 0.3s ease'
                    }}>
                        {ehErro
                            ? <Lock size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                            : <Bell size={16} color="#4ade80" style={{ flexShrink: 0 }} />
                        }
                        <div>
                            <div style={{ fontWeight: '700', color: ehErro ? '#ef4444' : '#4ade80', fontSize: '11px', marginBottom: '2px' }}>
                                {ehErro ? 'AÇÃO BLOQUEADA' : 'NOVO MOTORISTA DISPONÍVEL'}
                            </div>
                            {t.msg}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
