import React, { useState } from 'react';

const TagInput = ({ value, onChange, disabled }) => {
    const [digitando, setDigitando] = useState('');
    const tags = value ? String(value).split(',').map(t => t.trim()).filter(Boolean) : [];

    const adicionar = (texto) => {
        const limpo = texto.trim().toUpperCase();
        if (!limpo) return;
        if (!tags.includes(limpo)) {
            const novasTags = [...tags, limpo];
            onChange(novasTags.join(', '));
        }
        setDigitando('');
    };

    const remover = (tagParaRemover) => {
        const novasTags = tags.filter(t => t !== tagParaRemover);
        onChange(novasTags.join(', '));
    };

    const mover = (index, direcao) => {
        const novasTags = [...tags];
        const novoIndex = index + direcao;
        if (novoIndex < 0 || novoIndex >= novasTags.length) return;
        [novasTags[index], novasTags[novoIndex]] = [novasTags[novoIndex], novasTags[index]];
        onChange(novasTags.join(', '));
    };

    const handleKeyDown = (e) => {
        if (['Enter', 'Tab', ','].includes(e.key)) {
            e.preventDefault();
            adicionar(digitando);
        }
        if (e.key === 'Backspace' && !digitando && tags.length > 0) {
            remover(tags[tags.length - 1]);
        }
    };

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '5px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', backgroundColor: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)', minHeight: '38px', alignItems: 'center' }}>
            {tags.map((tag, i) => (
                <span key={i} style={{ backgroundColor: '#e0f2fe', color: '#004a99', padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ color: '#64748b', fontSize: '9px', fontWeight: '600', marginRight: '1px' }}>{i + 1}ª</span>
                    {tag}
                    {!disabled && tags.length > 1 && (
                        <>
                            {i > 0 && <button onClick={() => mover(i, -1)} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '10px', padding: '0 1px', lineHeight: 1 }} title="Subir">▲</button>}
                            {i < tags.length - 1 && <button onClick={() => mover(i, 1)} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '10px', padding: '0 1px', lineHeight: 1 }} title="Descer">▼</button>}
                        </>
                    )}
                    {!disabled && <button onClick={() => remover(tag)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>✕</button>}
                </span>
            ))}
            {!disabled && (
                <input
                    value={digitando}
                    onChange={e => setDigitando(e.target.value)}
                    onBlur={() => adicionar(digitando)}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length === 0 ? "Digite..." : ""}
                    style={{ border: 'none', outline: 'none', flex: 1, minWidth: '60px', fontSize: '13px', background: 'transparent' }}
                />
            )}
        </div>
    );
};

export default TagInput;
