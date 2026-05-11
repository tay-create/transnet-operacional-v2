import React from 'react';
import { X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

export default function ModalImagem({ imagemAmpliada, setImagemAmpliada }) {
    return (
        <ModalWrapper isOpen={!!imagemAmpliada} onClose={() => setImagemAmpliada(null)} maxWidth="90%" hideCloseButton>
            <div style={{ padding: '20px', position: 'relative' }}>
                <button
                    onClick={() => setImagemAmpliada(null)}
                    style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '50%',
                        width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10000
                    }}
                >
                    <X size={18} />
                </button>
                <img src={imagemAmpliada} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
        </ModalWrapper>
    );
}
