import React from 'react';
import { AlertTriangle, Anchor, X } from 'lucide-react';

export default function PainelDocas({ docasInterditadas, origem, opcoesDocas, podeEditarNaUnidade, onRemover, onAlterarDoca }) {
    const docasDaOrigem = docasInterditadas.filter(c => c.unidade === origem);

    if (docasDaOrigem.length === 0) return null;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {docasDaOrigem.map(card => (
                <div key={`fulgaz-${card.id}`} className="glass-panel-internal card-neon-hover" style={{ borderLeft: '4px solid #ef4444', borderRadius: '12px', overflow: 'hidden', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} color="#ef4444" />
                            {card.nome || 'CONTAINER (TERCEIRO)'}
                        </div>
                        {podeEditarNaUnidade('operacao') && (
                            <button onClick={() => onRemover(card.id)} title="Remover" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div style={{ padding: '16px' }}>
                        <label className="label-tech-sm" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Anchor size={10} /> INTERDITAR DOCA
                        </label>
                        <select
                            className="input-internal"
                            style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5', width: '100%', outline: 'none', marginTop: '4px' }}
                            value={card.doca || 'SELECIONE'}
                            onChange={(e) => onAlterarDoca(card.id, e.target.value)}
                            disabled={!podeEditarNaUnidade('operacao')}
                        >
                            <option value="SELECIONE">SELECIONE</option>
                            {opcoesDocas.filter(d => d !== 'SELECIONE').map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            ))}
        </div>
    );
}
