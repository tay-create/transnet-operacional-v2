import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

/**
 * Modal de confirmação/alerta reutilizável.
 * Substitui window.confirm() e alert() nativos do browser.
 *
 * Props:
 *   titulo      - título do modal (opcional)
 *   mensagem    - texto principal
 *   onConfirm   - callback ao confirmar (se omitido, só mostra botão OK)
 *   onCancel    - callback ao cancelar
 *   textConfirm - label do botão confirmar (padrão: 'Confirmar')
 *   textCancel  - label do botão cancelar (padrão: 'Cancelar')
 *   variante    - 'perigo' (vermelho) | 'aviso' | 'info' (padrão: 'perigo')
 */
export default function ModalConfirm({
    titulo,
    mensagem,
    onConfirm,
    onCancel,
    textConfirm = 'Confirmar',
    textCancel = 'Cancelar',
    variante = 'perigo',
}) {
    const apenasAlerta = !onConfirm;

    const cores = {
        perigo: { icon: <AlertTriangle size={22} />, cor: '#f87171', fundo: 'rgba(239,68,68,0.15)', borda: 'rgba(239,68,68,0.3)' },
        aviso:  { icon: <AlertTriangle size={22} />, cor: '#fbbf24', fundo: 'rgba(251,191,36,0.12)', borda: 'rgba(251,191,36,0.3)' },
        info:   { icon: <Info size={22} />,           cor: '#38bdf8', fundo: 'rgba(56,189,248,0.12)', borda: 'rgba(56,189,248,0.3)' },
    };
    const tema = cores[variante] || cores.perigo;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
        }}>
            <div style={{
                background: '#0f172a',
                border: `1px solid ${tema.borda}`,
                borderRadius: '14px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                width: '100%', maxWidth: '420px',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '16px 20px',
                    background: tema.fundo,
                    borderBottom: `1px solid ${tema.borda}`,
                }}>
                    <span style={{ color: tema.cor }}>{tema.icon}</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '15px', flex: 1 }}>
                        {titulo || (apenasAlerta ? 'Aviso' : 'Confirmar ação')}
                    </span>
                    <button onClick={onCancel} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#64748b', padding: '2px',
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6 }}>
                    {mensagem}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: '10px',
                    padding: '12px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                }}>
                    <button onClick={onCancel} style={{
                        padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a3b8',
                    }}>
                        {apenasAlerta ? 'OK' : textCancel}
                    </button>
                    {!apenasAlerta && (
                        <button onClick={onConfirm} style={{
                            padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer',
                            background: variante === 'perigo' ? '#dc2626' : variante === 'aviso' ? '#d97706' : '#0ea5e9',
                            border: 'none', color: '#fff',
                        }}>
                            {textConfirm}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
