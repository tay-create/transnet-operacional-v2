import React, { useState } from 'react';
import { X, Image as ImageIcon, Check, Upload } from 'lucide-react';

export default function ModalAvatar({ isOpen, onClose, user, onUpdateAvatar }) {
    // Começa com a imagem atual do usuário ou vazia
    const [preview, setPreview] = useState(user.avatarUrl);

    if (!isOpen) return null;

    // Função que lê o arquivo do computador
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result); // Mostra o preview imediato
            };
            reader.readAsDataURL(file); // Converte para Base64
        }
    };

    const handleSave = () => {
        onUpdateAvatar(preview); // Manda a imagem (Base64) para o App
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-glass" style={{ width: '400px', position: 'relative' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 className="title-neon-blue" style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ImageIcon size={20} /> EDITAR FOTO
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Preview Circular */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
                    <div style={{ 
                        width: '120px', height: '120px', borderRadius: '50%', 
                        border: '4px solid #3b82f6', overflow: 'hidden',
                        background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {preview ? (
                            <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ color: '#64748b', fontSize: '10px' }}>Sem foto</span>
                        )}
                    </div>
                </div>

                {/* Área de Upload */}
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <label 
                        htmlFor="avatar-upload" 
                        className="btn-menu-toggle" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 20px', width: 'auto' }}
                    >
                        <Upload size={16} /> ESCOLHER ARQUIVO
                    </label>
                    <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                    <p style={{ fontSize: '10px', color: '#64748b', marginTop: '10px' }}>
                        Formatos aceitos: JPG, PNG.
                    </p>
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} className="btn-menu-toggle" style={{ flex: 1, justifyContent: 'center' }}>
                        CANCELAR
                    </button>
                    <button onClick={handleSave} className="btn-azul" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Check size={16} /> SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
}