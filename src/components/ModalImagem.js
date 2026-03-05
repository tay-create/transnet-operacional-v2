import React from 'react';
import { X } from 'lucide-react';

export default function ModalImagem({ imagemAmpliada, setImagemAmpliada }) {
    if (!imagemAmpliada) return null;

    return (
        <div
            className="modal-overlay"
            onClick={() => setImagemAmpliada(null)}
            style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <div
                style={{
                    position: 'relative',
                    maxWidth: '90%',
                    maxHeight: '90vh',
                    background: 'rgba(15, 23, 42, 0.95)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '2px solid rgba(59, 130, 246, 0.3)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={() => setImagemAmpliada(null)}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(239, 68, 68, 0.8)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        zIndex: 10000
                    }}
                >
                    <X size={18} />
                </button>
                <img
                    src={imagemAmpliada}
                    alt="Ampliada"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        objectFit: 'contain',
                        borderRadius: '8px'
                    }}
                />
            </div>
        </div>
    );
}
