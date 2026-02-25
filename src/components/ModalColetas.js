import React from 'react';
import { Package } from 'lucide-react';

export default function ModalColetas({ veiculoSelecionado, setModalColetasAberto, setVeiculoSelecionado, updateList, podeEditarNaUnidade }) {
    if (!veiculoSelecionado) return null;

    return (
        <div
            className="modal-overlay"
            onClick={() => { setModalColetasAberto(false); setVeiculoSelecionado(null); }}
            style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', width: '300px', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}
            >
                <h3 style={{ color: '#f1f5f9', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                    <Package size={18} color="#60a5fa" />
                    Status das Coletas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>SOLICITADO</label>
                        <input
                            type="time"
                            className="input-internal"
                            style={{ width: '100%', fontSize: '14px', padding: '10px' }}
                            value={veiculoSelecionado.item.status_coleta?.solicitado || ''}
                            disabled={!podeEditarNaUnidade('timer_solicitado')}
                            onChange={e => {
                                updateList(veiculoSelecionado.lista, veiculoSelecionado.setLista, veiculoSelecionado.realIndex, 'status_coleta.solicitado', e.target.value, veiculoSelecionado.origem);
                                setVeiculoSelecionado(prev => ({ ...prev, item: { ...prev.item, status_coleta: { ...prev.item.status_coleta, solicitado: e.target.value } } }));
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>LIBERADO</label>
                        <input
                            type="time"
                            className="input-internal"
                            style={{ width: '100%', fontSize: '14px', padding: '10px' }}
                            value={veiculoSelecionado.item.status_coleta?.liberado || ''}
                            disabled={!podeEditarNaUnidade('timer_liberado')}
                            onChange={e => {
                                updateList(veiculoSelecionado.lista, veiculoSelecionado.setLista, veiculoSelecionado.realIndex, 'status_coleta.liberado', e.target.value, veiculoSelecionado.origem);
                                setVeiculoSelecionado(prev => ({ ...prev, item: { ...prev.item, status_coleta: { ...prev.item.status_coleta, liberado: e.target.value } } }));
                            }}
                        />
                    </div>
                </div>
                <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => { setModalColetasAberto(false); setVeiculoSelecionado(null); }}
                        style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
}
