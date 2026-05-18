import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Truck, RotateCcw, FileSpreadsheet, Loader2 } from 'lucide-react';
import api from '../services/apiService';

function formatarDataBr(iso) {
    if (!iso || typeof iso !== 'string') return '—';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

/**
 * Modal obrigatório para registrar datas de entrega quando uma placa
 * cadastrada no Provisionamento de Frota é utilizada em um lançamento.
 *
 * Quando coletaPrincipal é informada, o modal busca automaticamente as entregas
 * agendadas na planilha (Col E coleta, Col I cidade, Col J UF, Col AC data agendamento)
 * e exibe em modo read-only. O usuário só preenche data de saída e (opcional) retorno.
 * Se a coleta não estiver na planilha, cai no modo manual editável.
 *
 * Props:
 *   veiculo            — objeto prov_veiculos { id, placa, carreta, tipo_veiculo, motorista }
 *   motorista          — nome do motorista sendo lançado
 *   dataSaida          — string YYYY-MM-DD (data prevista do lançamento, padrão para data_saida)
 *   coletaPrincipal    — string com número da coleta (busca na planilha)
 *   onConfirmar(entradas) — callback após POST bem-sucedido
 *   onCancelar         — callback ao cancelar (limpa a placa no form pai)
 */
export default function ModalEntregasProvisao({ veiculo, motorista, dataSaida, coletaPrincipal, onConfirmar, onCancelar }) {
    const [dataSaidaModal, setDataSaidaModal] = useState(dataSaida || '');
    const [dataRetorno, setDataRetorno] = useState('');
    const [entradas, setEntradas] = useState([{ cidade: '', data: '' }]);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    // Pré-busca de entregas via planilha
    const [carregandoPlanilha, setCarregandoPlanilha] = useState(false);
    const [origemEntradas, setOrigemEntradas] = useState('manual'); // 'manual' | 'planilha'
    const [rotaPlanilha, setRotaPlanilha] = useState(null);

    useEffect(() => {
        if (!coletaPrincipal) return;
        let cancelado = false;
        setCarregandoPlanilha(true);
        const num = String(coletaPrincipal).trim().replace(/^0+/, '');
        api.get(`/api/provisionamento/entregas-da-coleta?coleta=${encodeURIComponent(num)}`)
            .then(r => {
                if (cancelado) return;
                if (r.data?.encontrada && Array.isArray(r.data.entregas) && r.data.entregas.length > 0) {
                    setEntradas(r.data.entregas.map(e => ({ cidade: e.cidade, uf: e.uf, data: e.data })));
                    setOrigemEntradas('planilha');
                    setRotaPlanilha(r.data.rota || null);
                }
            })
            .catch(err => console.warn('Falha ao pré-buscar entregas da planilha:', err))
            .finally(() => { if (!cancelado) setCarregandoPlanilha(false); });
        return () => { cancelado = true; };
    }, [coletaPrincipal]);

    const addEntrada = () => setEntradas(prev => [...prev, { cidade: '', data: '' }]);
    const removeEntrada = (i) => setEntradas(prev => prev.filter((_, idx) => idx !== i));
    const updateEntrada = (i, campo, valor) => setEntradas(prev => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e));

    const podeSalvar = dataSaidaModal && entradas.length > 0 && entradas.every(e => e.data);

    // Quando o usuário clica Confirmar, primeiro pergunta sobre remanejamento.
    const [perguntandoRemanejamento, setPerguntandoRemanejamento] = useState(false);
    const [aguardandoConfirmar, setAguardandoConfirmar] = useState(false);

    async function confirmar() {
        if (!podeSalvar) return;
        // Se a viagem tem múltiplos destinos, pergunta antes se vai ter remanejamento.
        if (entradas.length > 1 && !aguardandoConfirmar) {
            setPerguntandoRemanejamento(true);
            return;
        }
        await executarConfirmacao(false);
    }

    async function executarConfirmacao(comRemanejamento) {
        setSalvando(true);
        setErro('');
        try {
            await api.post('/api/provisionamento/viagem', {
                veiculo_id: veiculo.id,
                motorista: motorista || veiculo.motorista || '',
                data_saida: dataSaidaModal,
                data_retorno: dataRetorno || null,
                entradas: entradas.map(e => ({ cidade: (e.cidade || '').trim(), data: e.data })),
                // Quando origem = planilha, preservar o dia da operação como EM_OPERACAO
                // (não sobrescrever com EM_VIAGEM). A viagem começa no dia seguinte.
                preservar_data_saida_em_operacao: origemEntradas === 'planilha',
            });
            onConfirmar(entradas, { abrirRemanejamento: comRemanejamento });
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
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
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

                {/* Datas de Entrega — modo planilha (read-only) ou manual (editável) */}
                <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>DATAS DE ENTREGA</span>
                    {carregandoPlanilha && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#60a5fa', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Buscando na planilha…
                        </span>
                    )}
                    {origemEntradas === 'planilha' && !carregandoPlanilha && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4ade80', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                            <FileSpreadsheet size={11} /> Da planilha {rotaPlanilha ? `· rota ${rotaPlanilha}` : ''}
                        </span>
                    )}
                </div>

                {origemEntradas === 'planilha' ? (
                    /* MODO PLANILHA: entradas vieram da planilha, read-only */
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)',
                            borderRadius: '8px', padding: '10px 12px',
                        }}>
                            {entradas.map((e, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 0',
                                    borderBottom: i < entradas.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                }}>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%', background: '#4ade80',
                                        color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 11, flexShrink: 0
                                    }}>{i + 1}</div>
                                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                                        {e.cidade}{e.uf ? `/${e.uf}` : ''}
                                    </span>
                                    <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>
                                        {formatarDataBr(e.data)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: 11, color: '#64748b', margin: '8px 0 0', lineHeight: 1.4 }}>
                            O dia da operação fica como <strong style={{ color: '#a78bfa' }}>Em Operação</strong> (segue o fluxo do conferente).
                            Do dia seguinte até a última entrega, fica como <strong style={{ color: '#facc15' }}>Em Viagem</strong> — com cidade nos dias de entrega.
                        </p>
                    </div>
                ) : (
                    /* MODO MANUAL: lista editável (fallback) */
                    <>
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
                    </>
                )}

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

            {/* Overlay de pergunta: vai ter remanejamento? */}
            {perguntandoRemanejamento && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }} onClick={() => setPerguntandoRemanejamento(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#0f172a', borderRadius: 12, padding: 24,
                        maxWidth: 440, border: '1px solid rgba(167,139,250,0.4)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ background: 'rgba(167,139,250,0.18)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                            </div>
                            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Vai haver remanejamento?</div>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' }}>
                            Algumas viagens longas têm parte dos destinos finais transferidos para outros caminhões da frota.
                            Se for o caso desta viagem, configure agora — caso contrário, prosseguir normalmente.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setPerguntandoRemanejamento(false); setAguardandoConfirmar(true); executarConfirmacao(false); }}
                                disabled={salvando}
                                style={{
                                    background: 'transparent', color: '#94a3b8',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer'
                                }}
                            >
                                Não, prosseguir
                            </button>
                            <button
                                onClick={() => { setPerguntandoRemanejamento(false); setAguardandoConfirmar(true); executarConfirmacao(true); }}
                                disabled={salvando}
                                style={{
                                    background: '#a78bfa', color: '#fff', border: 0,
                                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Sim, configurar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
