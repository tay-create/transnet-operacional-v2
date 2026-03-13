import React, { useState } from 'react';
import { Package } from 'lucide-react';

export default function ModalColetas({ veiculoSelecionado, setModalColetasAberto, setVeiculoSelecionado, updateList, podeEditarNaUnidade }) {
    const [localSolicitadoData, setLocalSolicitadoData] = useState(veiculoSelecionado?.item?.status_coleta?.solicitado_data || '');
    const [localSolicitado, setLocalSolicitado] = useState(veiculoSelecionado?.item?.status_coleta?.solicitado || '');
    const [localLiberadoData, setLocalLiberadoData] = useState(veiculoSelecionado?.item?.status_coleta?.liberado_data || '');
    const [localLiberado, setLocalLiberado] = useState(veiculoSelecionado?.item?.status_coleta?.liberado || '');

    if (!veiculoSelecionado) return null;

    const handleClose = () => {
        const novaColeta = {
            ...veiculoSelecionado.item.status_coleta,
            solicitado_data: localSolicitadoData,
            solicitado: localSolicitado,
            liberado_data: localLiberadoData,
            liberado: localLiberado,
        };
        updateList(veiculoSelecionado.lista, veiculoSelecionado.setLista, veiculoSelecionado.realIndex, 'status_coleta', novaColeta, veiculoSelecionado.origem);
        setModalColetasAberto(false);
        setVeiculoSelecionado(null);
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleClose}
            style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', width: '380px', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}
            >
                <h3 style={{ color: '#f1f5f9', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                    <Package size={18} color="#60a5fa" />
                    Status das Coletas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>SOLICITADO</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="date"
                                className="input-internal"
                                style={{ flex: 1, fontSize: '14px', padding: '10px' }}
                                value={localSolicitadoData}
                                disabled={!podeEditarNaUnidade('timer_solicitado')}
                                onChange={e => setLocalSolicitadoData(e.target.value)}
                            />
                            <input
                                type="time"
                                className="input-internal"
                                style={{ width: '110px', fontSize: '14px', padding: '10px' }}
                                value={localSolicitado}
                                disabled={!podeEditarNaUnidade('timer_solicitado')}
                                onChange={e => setLocalSolicitado(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>LIBERADO</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="date"
                                className="input-internal"
                                style={{ flex: 1, fontSize: '14px', padding: '10px' }}
                                value={localLiberadoData}
                                disabled={!podeEditarNaUnidade('timer_liberado')}
                                onChange={e => setLocalLiberadoData(e.target.value)}
                            />
                            <input
                                type="time"
                                className="input-internal"
                                style={{ width: '110px', fontSize: '14px', padding: '10px' }}
                                value={localLiberado}
                                disabled={!podeEditarNaUnidade('timer_liberado')}
                                onChange={e => setLocalLiberado(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleClose}
                        style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                        SALVAR E FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
}
