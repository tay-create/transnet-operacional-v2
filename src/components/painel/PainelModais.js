import React, { useState } from 'react';
import { X, FileText, CheckCircle, Smartphone, Copy, MessageCircle, Lock } from 'lucide-react';
import { useApiCall } from '../../hooks/useApiCall';
import ModalChecklistCarreta from '../ModalChecklistCarreta';
import ModalConfirm from '../ModalConfirm';
import ModalImagem from '../ModalImagem';
import ModalColetas from '../ModalColetas';
import ModalEntregasProvisao from '../ModalEntregasProvisao';
import api from '../../services/apiService';

function ModalPausarUnidade({ origem, lista, onClose, onSucesso }) {
    const unidade = origem.toLowerCase();
    const [motivo, setMotivo] = useState('');
    const { loading: salvando, erro, execute } = useApiCall();

    const veiculosAtivos = lista.filter(v => {
        const s = v[origem === 'Recife' ? 'status_recife' : 'status_moreno'];
        return s && s !== 'AGUARDANDO' && s !== 'FINALIZADO';
    });
    // Header só enxerga pausas com fonte='operacao' (ignora pausas individuais do conferente)
    const algumPausado = veiculosAtivos.some(v => {
        const pausas = JSON.parse(v.pausas_status || '[]');
        return pausas.some(p => p.unidade === unidade && p.fonte === 'operacao' && p.fim === null);
    });

    const handleConfirmar = async () => {
        if (!algumPausado && !motivo.trim()) return;
        try { await execute(async () => {
            const endpoint = algumPausado ? 'retomar' : 'pausar';
            const body = algumPausado ? { unidade, fonte: 'operacao' } : { motivo, unidade, fonte: 'operacao' };
            const veiculosAlvo = algumPausado
                ? veiculosAtivos.filter(v => {
                    const pausas = JSON.parse(v.pausas_status || '[]');
                    return pausas.some(p => p.unidade === unidade && p.fonte === 'operacao' && p.fim === null);
                })
                : veiculosAtivos.filter(v => {
                    const pausas = JSON.parse(v.pausas_status || '[]');
                    return !pausas.some(p => p.unidade === unidade && p.fonte === 'operacao' && p.fim === null);
                });

            await Promise.all(veiculosAlvo.map(v =>
                api.post(`/api/veiculos/${v.id}/${endpoint}`, body)
            ));
            onSucesso(algumPausado ? `${veiculosAlvo.length} veículo(s) retomado(s)` : `${veiculosAlvo.length} veículo(s) pausado(s)`);
        }); } catch (_) {} // erro já tratado pelo useApiCall
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ background: 'linear-gradient(160deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '380px', padding: '24px', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>
                        {algumPausado ? '▶ Retomar Operação' : '⏸ Pausar Operação'} — {origem}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                    {algumPausado
                        ? `Irá retomar ${veiculosAtivos.filter(v => { const p = JSON.parse(v.pausas_status || '[]'); return p.some(x => x.unidade === unidade && x.fonte === 'operacao' && x.fim === null); }).length} veículo(s) pausado(s).`
                        : `Irá pausar ${veiculosAtivos.filter(v => { const p = JSON.parse(v.pausas_status || '[]'); return !p.some(x => x.unidade === unidade && x.fonte === 'operacao' && x.fim === null); }).length} veículo(s) ativo(s).`
                    }
                </div>
                {!algumPausado && (
                    <textarea
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Motivo da pausa (obrigatório)..."
                        style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'system-ui, sans-serif', marginBottom: '14px' }}
                        autoFocus
                    />
                )}
                {erro && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '10px' }}>{erro}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} disabled={salvando} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={salvando || (!algumPausado && !motivo.trim())}
                        style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: algumPausado ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#1c1917', fontWeight: '700', fontSize: '13px', cursor: salvando || (!algumPausado && !motivo.trim()) ? 'not-allowed' : 'pointer', opacity: salvando || (!algumPausado && !motivo.trim()) ? 0.5 : 1 }}
                    >
                        {salvando ? 'Aguarde...' : algumPausado ? '▶ Confirmar Retomada' : '⏸ Confirmar Pausa'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PainelModais({
    // Checklist
    modalChecklistAberto, setModalChecklistAberto,
    // Coletas
    modalColetasAberto, setModalColetasAberto,
    veiculoSelecionado, setVeiculoSelecionado,
    // Imagem ampliada
    imagemAmpliada, setImagemAmpliada,
    // Entregas
    modalEntregasCard, setModalEntregasCard,
    // Frota
    modalFrota, setModalFrota,
    frotaOrigem, setFrotaOrigem,
    frotaDestino, setFrotaDestino,
    // Lacre
    modalLacre, setModalLacre,
    // Link motorista
    modalLinkMotorista, setModalLinkMotorista,
    // Pausa
    modalPausaAberto, setModalPausaAberto,
    // Input coleta
    inputColetaModal, setInputColetaModal,
    inputColetaValor, setInputColetaValor,
    // Confirmações CTE
    confirmarLiberadoCte, setConfirmarLiberadoCte,
    confirmarReprogramar, setConfirmarReprogramar,
    confirmarMisto, setConfirmarMisto,
    confirmarLiberarChecklist, setConfirmarLiberarChecklist,
    confirmarCopiaColeta, setConfirmarCopiaColeta,
    confirmarFinalizar, setConfirmarFinalizar,
    proximaDataFinalizar, setProximaDataFinalizar,
    modalEscolhaDia, setModalEscolhaDia,
    finalizando, setFinalizando,
    // Operadores
    operadoresConhecimento,
    operadorSelecionado, setOperadorSelecionado,
    reenviarCte, setReenviarCte,
    operadorReenvio, setOperadorReenvio,
    // Dados
    lista, setLista,
    itensFiltrados,
    origem,
    // Funções
    salvarMotoristaNoCard,
    adicionarToast,
    mostrarNotificacao,
    funcoes,
    reprogramarItem,
    podeEditarNaUnidade,
    updateList,
}) {
    const { liberarParaCte } = funcoes || {};

    return (
        <>
            {/* Modal de Visualização de Imagem Ampliada */}
            <ModalImagem imagemAmpliada={imagemAmpliada} setImagemAmpliada={setImagemAmpliada} />

            {/* Modal Fotos do Lacre */}
            {modalLacre && (
                <div onClick={() => setModalLacre(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontWeight: '700', fontSize: '14px' }}>
                                <Lock size={14} color="#22c55e" />
                                Lacre{modalLacre.fotos.length > 1 ? `s (${modalLacre.fotos.length})` : ''} — {modalLacre.motorista}
                            </div>
                            <button onClick={() => setModalLacre(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                                <X size={16} />
                            </button>
                        </div>
                        {modalLacre.fotos.length === 1 ? (
                            <img src={modalLacre.fotos[0]} alt="Lacre" style={{ width: '100%', borderRadius: '10px', display: 'block' }} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {modalLacre.fotos.map((foto, idx) => (
                                    <div key={idx} style={{ position: 'relative' }}>
                                        <img src={foto} alt={`Lacre ${idx + 1}`} style={{ width: '100%', borderRadius: '8px', display: 'block', aspectRatio: '1', objectFit: 'cover' }} />
                                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.65)', borderRadius: '5px', fontSize: '11px', fontWeight: '700', color: '#f1f5f9', padding: '2px 6px' }}>#{idx + 1}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Coletas Embutido */}
            {modalColetasAberto && veiculoSelecionado && (
                <ModalColetas
                    veiculoSelecionado={veiculoSelecionado}
                    setModalColetasAberto={setModalColetasAberto}
                    setVeiculoSelecionado={setVeiculoSelecionado}
                    updateList={updateList}
                    podeEditarNaUnidade={podeEditarNaUnidade}
                />
            )}

            {/* Modal de Entregas do Provisionamento */}
            {modalEntregasCard && (
                <ModalEntregasProvisao
                    veiculo={modalEntregasCard.veiculo}
                    motorista={modalEntregasCard.item?.motorista || ''}
                    dataSaida={modalEntregasCard.item?.data_prevista ? modalEntregasCard.item.data_prevista.substring(0, 10) : new Date().toISOString().substring(0, 10)}
                    onConfirmar={() => setModalEntregasCard(null)}
                    onCancelar={() => setModalEntregasCard(null)}
                />
            )}

            {/* Modal de Checklist Embutido */}
            {modalChecklistAberto && veiculoSelecionado && (
                <ModalChecklistCarreta
                    veiculo={veiculoSelecionado.item}
                    onClose={() => { setModalChecklistAberto(false); setVeiculoSelecionado(null); }}
                    onSucesso={(msg) => adicionarToast(msg, 'sucesso')}
                />
            )}

            {/* Modal — Link Motorista (Leão SP / Eletrik Sul) */}
            {modalLinkMotorista && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', width: '100%', maxWidth: '460px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', background: 'rgba(34,211,238,0.12)', borderBottom: '1px solid rgba(34,211,238,0.3)' }}>
                            <Smartphone size={20} style={{ color: '#22d3ee' }} />
                            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '15px', flex: 1 }}>Link para o motorista</span>
                            <button onClick={() => setModalLinkMotorista(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px 0' }}>
                                Envie este link para <strong style={{ color: '#e2e8f0' }}>{modalLinkMotorista.motorista}</strong>.
                                Ele vai precisar digitar o número da coleta pra confirmar e poderá avançar os status do carregamento direto pelo celular.
                            </p>
                            {modalLinkMotorista.gerando ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                    <div style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #1e293b', borderTop: '2px solid #22d3ee', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <div style={{ marginTop: 10, fontSize: 13 }}>Gerando link...</div>
                                </div>
                            ) : (
                                <>
                                    <input
                                        readOnly value={modalLinkMotorista.url}
                                        onClick={e => e.target.select()}
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,211,238,0.25)',
                                            borderRadius: '10px', padding: '10px 12px', fontSize: '12px',
                                            color: '#22d3ee', fontFamily: 'monospace', outline: 'none',
                                        }}
                                    />
                                    <p style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>Válido por 24h ou até o motorista marcar como CARREGADO.</p>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: 14 }}>
                                        <button
                                            onClick={async () => {
                                                const url = modalLinkMotorista.url;
                                                let ok = false;
                                                // 1) API moderna (precisa HTTPS ou localhost)
                                                if (navigator.clipboard && window.isSecureContext) {
                                                    try { await navigator.clipboard.writeText(url); ok = true; } catch {}
                                                }
                                                // 2) Fallback via textarea + execCommand (funciona em HTTP)
                                                if (!ok) {
                                                    try {
                                                        const ta = document.createElement('textarea');
                                                        ta.value = url;
                                                        ta.style.position = 'fixed';
                                                        ta.style.left = '-9999px';
                                                        ta.style.top = '0';
                                                        ta.setAttribute('readonly', '');
                                                        document.body.appendChild(ta);
                                                        ta.select();
                                                        ta.setSelectionRange(0, ta.value.length);
                                                        ok = document.execCommand('copy');
                                                        document.body.removeChild(ta);
                                                    } catch { ok = false; }
                                                }
                                                if (ok) {
                                                    setModalLinkMotorista(prev => ({ ...prev, copiado: true }));
                                                    setTimeout(() => setModalLinkMotorista(prev => prev && ({ ...prev, copiado: false })), 1800);
                                                } else {
                                                    mostrarNotificacao?.('⚠️ Não foi possível copiar — selecione e copie manualmente.');
                                                }
                                            }}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '8px',
                                                background: modalLinkMotorista.copiado ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${modalLinkMotorista.copiado ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
                                                color: modalLinkMotorista.copiado ? '#4ade80' : '#cbd5e1',
                                                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            }}
                                        >
                                            {modalLinkMotorista.copiado ? <CheckCircle size={14} /> : <Copy size={14} />}
                                            {modalLinkMotorista.copiado ? 'Copiado!' : 'Copiar link'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const msg = `Olá ${modalLinkMotorista.motorista}, registre o status do carregamento aqui: ${modalLinkMotorista.url}`;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                            }}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '8px',
                                                background: '#25D366', border: 'none', color: 'white',
                                                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            }}
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — Liberar p/ CT-e (seleção de operador Conhecimento) */}
            {confirmarLiberadoCte && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', width: '100%', maxWidth: '420px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', background: 'rgba(56,189,248,0.12)', borderBottom: '1px solid rgba(56,189,248,0.3)' }}>
                            <FileText size={20} style={{ color: '#38bdf8' }} />
                            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '15px', flex: 1 }}>Liberar para CT-e</span>
                            <button onClick={() => { setConfirmarLiberadoCte(null); setOperadorSelecionado(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px 0' }}>Selecione o operador que receberá o CT-e:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {operadoresConhecimento.map(op => (
                                    <button
                                        key={op.id}
                                        onClick={() => setOperadorSelecionado(op)}
                                        style={{
                                            padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                                            background: operadorSelecionado?.id === op.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                                            border: operadorSelecionado?.id === op.id ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px' }}>{op.nome}</div>
                                            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{op.cidade}</span>
                                                {op.cargo && (
                                                    <span style={{
                                                        fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                                                        background: op.cargo === 'Planejamento' ? 'rgba(168,85,247,0.18)' : 'rgba(56,189,248,0.18)',
                                                        color: op.cargo === 'Planejamento' ? '#c4b5fd' : '#7dd3fc',
                                                        letterSpacing: '0.5px',
                                                    }}>{op.cargo.toUpperCase()}</span>
                                                )}
                                            </div>
                                        </div>
                                        {operadorSelecionado?.id === op.id && <CheckCircle size={18} style={{ color: '#38bdf8' }} />}
                                    </button>
                                ))}
                                {operadoresConhecimento.length === 0 && (
                                    <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '10px' }}>Nenhum operador encontrado.</p>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                            <button onClick={() => { setConfirmarLiberadoCte(null); setOperadorSelecionado(null); }} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>Cancelar</button>
                            <button
                                disabled={!operadorSelecionado}
                                onClick={() => {
                                    const { realIndex: ri, origem: o } = confirmarLiberadoCte;
                                    const opId = operadorSelecionado.id;
                                    const opNome = operadorSelecionado.nome;
                                    setConfirmarLiberadoCte(null);
                                    setOperadorSelecionado(null);
                                    liberarParaCte(lista, setLista, ri, o, opId, opNome);
                                }}
                                style={{
                                    padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: operadorSelecionado ? 'pointer' : 'not-allowed',
                                    background: operadorSelecionado ? '#0ea5e9' : '#1e293b', border: 'none',
                                    color: operadorSelecionado ? '#fff' : '#475569',
                                    opacity: operadorSelecionado ? 1 : 0.6,
                                }}
                            >Liberar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Reenviar CT-e */}
            {reenviarCte && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0', width: '360px', maxWidth: '95vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <span style={{ color: '#a855f7', fontWeight: 700, fontSize: '14px' }}>Reenviar CT-e para...</span>
                            <button onClick={() => { setReenviarCte(null); setOperadorReenvio(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '12px 16px', maxHeight: '220px', overflowY: 'auto' }}>
                            {operadoresConhecimento.map(op => (
                                <button key={op.id} onClick={() => setOperadorReenvio(op)} style={{
                                    width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${operadorReenvio?.id === op.id ? '#a855f7' : 'transparent'}`,
                                    background: operadorReenvio?.id === op.id ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: operadorReenvio?.id === op.id ? '#c084fc' : '#cbd5e1', cursor: 'pointer', marginBottom: '4px', fontSize: '13px'
                                }}>{op.nome}</button>
                            ))}
                            {operadoresConhecimento.length === 0 && <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center' }}>Nenhum operador encontrado.</p>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                            <button onClick={() => { setReenviarCte(null); setOperadorReenvio(null); }} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>Cancelar</button>
                            <button
                                disabled={!operadorReenvio}
                                onClick={async () => {
                                    const { item, origem: origemReenvio } = reenviarCte;
                                    const opId = operadorReenvio.id;
                                    const opNome = operadorReenvio.nome;
                                    setReenviarCte(null);
                                    setOperadorReenvio(null);
                                    try {
                                        await api.post('/api/cte/reenviar-notificacao', { veiculoId: item.id, destinatarioId: opId, destinatarioNome: opNome, origem: origemReenvio });
                                        mostrarNotificacao(`✅ Notificação de CT-e reenviada para ${opNome}.`);
                                    } catch (e) {
                                        mostrarNotificacao('❌ Erro ao reenviar notificação.');
                                    }
                                }}
                                style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: operadorReenvio ? 'pointer' : 'not-allowed', background: operadorReenvio ? '#a855f7' : '#1e293b', border: 'none', color: operadorReenvio ? '#fff' : '#475569', opacity: operadorReenvio ? 1 : 0.6 }}
                            >Reenviar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação — Reprogramar +1 dia */}
            {confirmarReprogramar && (
                <ModalConfirm
                    titulo="Reprogramar para amanhã?"
                    mensagem={`Deseja reprogramar este veículo para ${confirmarReprogramar.proxStr.split('-').reverse().slice(0, 2).join('/')}? Ele será contabilizado como reprogramado na programação diária.`}
                    textConfirm="Reprogramar"
                    textCancel="Cancelar"
                    onConfirm={() => {
                        const { lista: listaRep, setLista: setListaRep, realIndex, proxStr, origem: origemReprog } = confirmarReprogramar;
                        setConfirmarReprogramar(null);
                        reprogramarItem(listaRep, setListaRep, realIndex, proxStr, api, mostrarNotificacao, 1, origemReprog);
                    }}
                    onCancel={() => setConfirmarReprogramar(null)}
                />
            )}

            {/* Modal Escolha de Dia — Sexta-feira */}
            {modalEscolhaDia && (
                <div className="modal-overlay">
                    <div className="modal-neon-panel" style={{ width: '420px', textAlign: 'center' }}>
                        <h3 style={{ color: '#fbbf24', marginBottom: '8px', fontSize: '16px', fontWeight: '700' }}>
                            Finalizar Operação — Sexta-feira
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
                            Para qual dia os cards pendentes devem ser avançados?
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => {
                                    // Sábado = amanhã
                                    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                                    const sab = new Date(hoje);
                                    sab.setDate(sab.getDate() + 1);
                                    const sabStr = `${sab.getFullYear()}-${String(sab.getMonth() + 1).padStart(2, '0')}-${String(sab.getDate()).padStart(2, '0')}`;
                                    setProximaDataFinalizar(sabStr);
                                    setModalEscolhaDia(false);
                                    setConfirmarFinalizar(true);
                                }}
                                className="btn-neon"
                                style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: '700' }}
                            >
                                Sábado
                            </button>
                            <button
                                onClick={() => {
                                    // Segunda = hoje + 3 dias
                                    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                                    const seg = new Date(hoje);
                                    seg.setDate(seg.getDate() + 3);
                                    const segStr = `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, '0')}-${String(seg.getDate()).padStart(2, '0')}`;
                                    setProximaDataFinalizar(segStr);
                                    setModalEscolhaDia(false);
                                    setConfirmarFinalizar(true);
                                }}
                                className="btn-neon"
                                style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: '700', background: 'rgba(167,139,250,0.15)', borderColor: '#a78bfa', color: '#a78bfa' }}
                            >
                                Segunda-feira
                            </button>
                        </div>
                        <button
                            onClick={() => setModalEscolhaDia(false)}
                            style={{ marginTop: '16px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação — Finalizar Operação (ambas unidades) */}
            {confirmarFinalizar && (
                <ModalConfirm
                    titulo="Finalizar Operação — Recife + Moreno"
                    mensagem={`Isso vai avançar todos os veículos pendentes (Aguardando até Em Carregamento) de AMBAS as unidades para ${proximaDataFinalizar ? new Date(proximaDataFinalizar + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'o próximo dia útil'}. Deseja continuar?`}
                    textConfirm={finalizando ? 'Aguarde...' : 'Finalizar'}
                    textCancel="Cancelar"
                    variante="perigo"
                    onConfirm={async () => {
                        if (finalizando) return;
                        setFinalizando(true);
                        try {
                            const payload = { confirmarMisto: true, ...(proximaDataFinalizar ? { proxima_data: proximaDataFinalizar } : {}) };
                            const r1 = await api.post('/veiculos/finalizar-operacao', { unidade: 'Recife', ...payload });
                            const r2 = await api.post('/veiculos/finalizar-operacao', { unidade: 'Moreno', ...payload });
                            const totalRec = r1.data.veiculosAvancados || 0;
                            const totalMor = r2.data.veiculosAvancados || 0;
                            mostrarNotificacao?.(`✅ Finalizado! Recife: ${totalRec} veículo(s) | Moreno: ${totalMor} veículo(s)`);
                            setConfirmarFinalizar(false);
                            setProximaDataFinalizar(null);
                        } catch (err) {
                            const msg = err.response?.data?.message || 'Erro ao finalizar operação.';
                            mostrarNotificacao?.(`⚠️ ${msg}`);
                        } finally {
                            setFinalizando(false);
                        }
                    }}
                    onCancel={() => { if (!finalizando) { setConfirmarFinalizar(false); setProximaDataFinalizar(null); } }}
                />
            )}

            {/* Modal copiar coleta para nova unidade */}
            {confirmarCopiaColeta && (
                <ModalConfirm
                    titulo={`Coleta de ${confirmarCopiaColeta.unidadeDestino}`}
                    mensagem={`A nova operação exige coleta de ${confirmarCopiaColeta.unidadeDestino}, que está vazia. Deseja usar a mesma coleta de ${confirmarCopiaColeta.unidadeOrigem} (${confirmarCopiaColeta.coletaOrigem}) também em ${confirmarCopiaColeta.unidadeDestino}?`}
                    variante="aviso"
                    textConfirm="Sim"
                    textCancel="Não, digitar outra"
                    onConfirm={() => {
                        const fn = confirmarCopiaColeta.onConfirm;
                        setConfirmarCopiaColeta(null);
                        fn && fn();
                    }}
                    onCancel={() => {
                        const onRecusar = confirmarCopiaColeta.onRecusar;
                        setConfirmarCopiaColeta(null);
                        onRecusar && onRecusar();
                    }}
                />
            )}

            {/* Modal input de coleta para nova unidade */}
            {inputColetaModal && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-neon-panel" style={{ width: '420px', maxWidth: '95%', padding: '24px' }}>
                        <h3 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '16px' }}>Coleta de {inputColetaModal.unidadeDestino}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0' }}>Digite o número da coleta para {inputColetaModal.unidadeDestino}:</p>
                        <input
                            autoFocus
                            type="text"
                            value={inputColetaValor}
                            onChange={e => setInputColetaValor(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && inputColetaValor.trim()) {
                                    const fn = inputColetaModal.onConfirm;
                                    const val = inputColetaValor.trim();
                                    setInputColetaModal(null);
                                    setInputColetaValor('');
                                    fn && fn(val);
                                }
                                if (e.key === 'Escape') {
                                    setInputColetaModal(null);
                                    setInputColetaValor('');
                                }
                            }}
                            placeholder="Ex: 1097"
                            style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'white', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={() => { setInputColetaModal(null); setInputColetaValor(''); }} style={{ padding: '8px 18px', fontSize: '13px' }}>Cancelar</button>
                            <button
                                className="btn-neon"
                                disabled={!inputColetaValor.trim()}
                                onClick={() => {
                                    const fn = inputColetaModal.onConfirm;
                                    const val = inputColetaValor.trim();
                                    setInputColetaModal(null);
                                    setInputColetaValor('');
                                    fn && fn(val);
                                }}
                                style={{ padding: '8px 18px', fontSize: '13px' }}
                            >Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Liberar Checklist */}
            {confirmarLiberarChecklist && (
                <ModalConfirm
                    titulo="Liberar Checklist"
                    mensagem={`Liberar checklist do motorista ${confirmarLiberarChecklist.item.motorista}? O conferente poderá refazer o checklist.`}
                    variante="aviso"
                    textConfirm="Liberar"
                    onConfirm={async () => {
                        try {
                            await api.delete(`/api/checklists/veiculo/${confirmarLiberarChecklist.item.id}`);
                            mostrarNotificacao?.('✅ Checklist liberado para refazer.');
                        } catch {
                            mostrarNotificacao?.('⚠️ Erro ao liberar checklist.');
                        } finally {
                            setConfirmarLiberarChecklist(null);
                        }
                    }}
                    onCancel={() => setConfirmarLiberarChecklist(null)}
                />
            )}

            {/* Modal Pausar/Retomar Unidade */}
            {modalPausaAberto && (
                <ModalPausarUnidade
                    origem={origem}
                    lista={itensFiltrados}
                    onClose={() => setModalPausaAberto(false)}
                    onSucesso={(msg) => { adicionarToast(msg, 'sucesso'); setModalPausaAberto(false); }}
                />
            )}

            {/* Modal Origem/Destino para motorista FROTA */}
            {modalFrota && (
                <div onClick={() => setModalFrota(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
                    }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>
                            Motorista Frota
                        </div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                            {modalFrota.marcacao.nome_motorista} — Informe a Origem e o Destino da viagem:
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Origem</label>
                            <input
                                value={frotaOrigem}
                                onChange={e => setFrotaOrigem(e.target.value)}
                                placeholder="Ex: Recife-PE"
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Destino</label>
                            <input
                                value={frotaDestino}
                                onChange={e => setFrotaDestino(e.target.value)}
                                placeholder="Ex: Salvador-BA"
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalFrota(null)} style={{
                                padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                            }}>Cancelar</button>
                            <button
                                disabled={!frotaOrigem.trim() || !frotaDestino.trim()}
                                onClick={() => {
                                    const { item, marcacao, realIndex } = modalFrota;
                                    salvarMotoristaNoCard(item, realIndex, marcacao, frotaOrigem.trim(), frotaDestino.trim());
                                    setModalFrota(null);
                                }}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                                    background: (!frotaOrigem.trim() || !frotaDestino.trim()) ? '#1e3a5f' : '#2563eb',
                                    color: (!frotaOrigem.trim() || !frotaDestino.trim()) ? '#475569' : '#fff',
                                    fontSize: '13px', fontWeight: '600', cursor: (!frotaOrigem.trim() || !frotaDestino.trim()) ? 'not-allowed' : 'pointer'
                                }}
                            >Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
