import React, { useState } from 'react';
import { Plus, Trash2, X, Truck, RotateCcw } from 'lucide-react';
import api from '../services/apiService';

/**
 * Modal obrigatório para registrar datas de entrega quando uma placa
 * cadastrada no Provisionamento de Frota é utilizada em um lançamento.
 *
 * Props:
 *   veiculo    — objeto prov_veiculos { id, placa, carreta, tipo_veiculo, motorista }
 *   motorista  — nome do motorista sendo lançado
 *   dataSaida  — string YYYY-MM-DD (data prevista do lançamento, usada como padrão para data_saida)
 *   onConfirmar(entradas) — callback após POST bem-sucedido
 *   onCancelar — callback ao cancelar (limpa a placa no form pai)
 */
export default function ModalEntregasProvisao({ veiculo, motorista, dataSaida, onConfirmar, onCancelar }) {
    const [dataSaidaModal, setDataSaidaModal] = useState(dataSaida || '');
    const [dataRetorno, setDataRetorno] = useState('');
    const [entradas, setEntradas] = useState([{ cidade: '', data: '' }]);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const addEntrada = () => setEntradas(prev => [...prev, { cidade: '', data: '' }]);
    const removeEntrada = (i) => setEntradas(prev => prev.filter((_, idx) => idx !== i));
    const updateEntrada = (i, campo, valor) => setEntradas(prev => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e));

    const podeSalvar = dataSaidaModal && entradas.length > 0 && entradas.every(e => e.data);

    async function confirmar() {
        if (!podeSalvar) return;
        setSalvando(true);
        setErro('');
        try {
            await api.post('/api/provisionamento/viagem', {
                veiculo_id: veiculo.id,
                motorista: motorista || veiculo.motorista || '',
                data_saida: dataSaidaModal,
                data_retorno: dataRetorno || null,
                entradas: entradas.map(e => ({ cidade: e.cidade.trim(), data: e.data })),
            });
            onConfirmar(entradas);
        } catch (e) {
            setErro('Erro ao registrar viagem. Tente novamente.');
            setSalvando(false);
        }
    }

    const placaLabel = veiculo.carreta ? `${veiculo.placa} / ${veiculo.carreta}` : veiculo.placa;

    const inputStyle = {
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: '6px', color: '#f1f5f9', padding: '8px 10px',
        fontSize: '13px', outline: 'none',
    };

    const labelStyle = {
        color: '#94a3b8', fontSize: '11px', fontWeight: '600',
        letterSpacing: '0.5px', marginBottom: '8px',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
            <div style={{
                background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px',
                padding: '24px', width: '460px', maxWidth: '95vw', maxHeight: '90vh',
                overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Truck size={20} color="#3b82f6" />
                        <div>
                            <div style={{ color: '#f1f5f9', fontWeight: '700', fontSize: '15px' }}>
                                Registrar Viagem — Provisionamento
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>
                                {placaLabel} · {veiculo.tipo_veiculo}
                            </div>
                        </div>
                    </div>
                    <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                        <X size={18} />
                    </button>
                </div>

                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
                    Informe a data em que o veículo vai sair e as datas de entrega. Os dias entre o
                    carregamento e a saída ficarão como <strong style={{ color: '#4ade80' }}>Carregado</strong>.
                </p>

                {/* Data de Saída (obrigatória) */}
                <div style={labelStyle}>
                    DATA DE SAÍDA <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
                    padding: '12px', background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px',
                }}>
                    <Truck size={15} color="#60a5fa" />
                    <span style={{ color: '#94a3b8', fontSize: '12px', flex: 1 }}>Sai em:</span>
                    <input
                        type="date"
                        value={dataSaidaModal}
                        onChange={e => setDataSaidaModal(e.target.value)}
                        style={{ ...inputStyle, width: '150px' }}
                    />
                </div>

                {/* Datas de Entrega */}
                <div style={labelStyle}>
                    DATAS DE ENTREGA
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {entradas.map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={e.cidade}
                                onChange={ev => updateEntrada(i, 'cidade', ev.target.value)}
                                placeholder="Cidade destino (opcional)"
                                style={{ ...inputStyle, flex: 1 }}
                            />
                            <input
                                type="date"
                                value={e.data}
                                onChange={ev => updateEntrada(i, 'data', ev.target.value)}
                                style={{ ...inputStyle, width: '140px', flexShrink: 0 }}
                            />
                            {entradas.length > 1 && (
                                <button onClick={() => removeEntrada(i)} style={{
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '6px', color: '#f87171', cursor: 'pointer', padding: '7px 9px',
                                    flexShrink: 0,
                                }}>
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={addEntrada} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', padding: '7px 12px',
                    fontSize: '12px', marginBottom: '20px',
                }}>
                    <Plus size={13} /> Adicionar data de entrega
                </button>

                {/* Data de Retorno (opcional) */}
                <div style={labelStyle}>
                    DATA PREVISTA DE RETORNO <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '12px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px' }}>
                    <RotateCcw size={15} color="#fbbf24" />
                    <span style={{ color: '#94a3b8', fontSize: '12px', flex: 1 }}>Retorna em:</span>
                    <input
                        type="date"
                        value={dataRetorno}
                        onChange={e => setDataRetorno(e.target.value)}
                        style={{ ...inputStyle, width: '150px' }}
                    />
                    {dataRetorno && (
                        <button onClick={() => setDataRetorno('')} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px',
                        }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {erro && (
                    <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                        {erro}
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onCancelar} style={{
                        background: 'transparent', border: '1px solid #334155', borderRadius: '6px',
                        color: '#94a3b8', cursor: 'pointer', padding: '9px 16px', fontSize: '13px',
                    }}>
                        Cancelar
                    </button>
                    <button onClick={confirmar} disabled={!podeSalvar || salvando} style={{
                        background: podeSalvar && !salvando ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : '#1e293b',
                        border: 'none', borderRadius: '6px', color: podeSalvar && !salvando ? '#fff' : '#64748b',
                        cursor: podeSalvar && !salvando ? 'pointer' : 'not-allowed',
                        padding: '9px 20px', fontSize: '13px', fontWeight: '600',
                    }}>
                        {salvando ? 'Salvando...' : 'Confirmar entregas'}
                    </button>
                </div>
            </div>
        </div>
    );
}
