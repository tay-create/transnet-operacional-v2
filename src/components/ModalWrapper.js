import React from 'react';
import { X } from 'lucide-react';

export default function ModalWrapper({
    isOpen,
    onClose,
    children,
    maxWidth = '600px',
    zIndex = 9999,
    hideCloseButton = false,
}) {
    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                padding: '16px',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative', maxWidth, width: '100%',
                    margin: 'auto',
                    background: '#0f172a', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                    maxHeight: 'calc(100dvh - 32px)',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {!hideCloseButton && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '16px', right: '16px', zIndex: 1,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#64748b', padding: '2px',
                        }}
                    >
                        <X size={16} />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
