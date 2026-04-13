import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardCheck, Truck, MapPin, Hash, RefreshCw, Anchor,
    ChevronRight, ShieldCheck, CheckCircle, X, AlertTriangle,
    Loader, Timer, Edit2, ArrowRightLeft, ChevronLeft, Calendar
} from 'lucide-react';
import api from '../services/apiService';
import useConferenteStore from './useConferenteStore';
import useAuthStore from '../store/useAuthStore';
import { DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA, CORES_STATUS } from '../constants';
import ModalOcorrencia from '../components/ModalOcorrencia';

// Ordem dos status que o conferente gerencia
const STATUS_CONFERENTE = ['AGUARDANDO P/ SEPARAÇÃO', 'EM SEPARAÇÃO', 'LIBERADO P/ CARREGAMENTO', 'EM CARREGAMENTO', 'CARREGADO'];

// Normaliza status antigos do banco para os novos nomes
const normalizarStatusDisplay = (s) => {
    if (s === 'AGUARDANDO') return 'AGUARDANDO P/ SEPARAÇÃO';
    if (s === 'LIBERADO P/ DOCA') return 'LIBERADO P/ CARREGAMENTO';
    return s;
};

// Badges de tempo ao vivo (mini versão para o card conferente)
function MiniTimer({ inicioAt, pausas = [], unidade = 'recife' }) {
    const [agora, setAgora] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    if (!inicioAt) return null;

    const pausasUnidade = pausas.filter(p => p.unidade === unidade);
    const temPausaAtiva = pausasUnidade.some(p => p.fim === null);

    // Calcular tempo total em pausa (ms)
    const msPausa = pausasUnidade.reduce((acc, p) => {
        const inicio = new Date(p.inicio).getTime();
        const fim = p.fim ? new Date(p.fim).getTime() : agora;
        return acc + Math.max(0, fim - inicio);
    }, 0);

    const msTotal = agora - new Date(inicioAt).getTime();
    const ms = Math.max(0, msTotal - msPausa);
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const texto = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
    const cor = temPausaAtiva ? '#94a3b8' : ms < 3600000 ? '#4ade80' : ms < 7200000 ? '#facc15' : '#f87171';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: cor, fontVariantNumeric: 'tabular-nums' }}>
            {temPausaAtiva ? '⏸' : <Timer size={9} />} {texto}
        </span>
    );
}

// Painel visual do Ger. Risco + Checklist
function PainelGerRisco({ v }) {
    if (v.isFrotaMotorista) return null;

    const situacao = v.situacao_cadastro || 'NÃO CONFERIDO';
    const corSit = situacao === 'LIBERADO' ? '#4ade80' : situacao === 'PENDENTE' ? '#fbbf24' : '#f87171';
    const items = [
        ['chk_cnh', 'CNH'],
        ['chk_antt', 'ANTT'],
        ['chk_tacografo', 'TAC'],
        ['chk_crlv', 'CRLV'],
    ];

    return (
        <div style={{
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '8px',
            border: `1px solid ${corSit}33`,
            marginTop: '8px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <ShieldCheck size={12} color={corSit} />
                {items.map(([campo, label]) => (
                    <span key={campo} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '10px', fontWeight: 'bold',
                        color: v[campo] ? '#4ade80' : '#f87171'
                    }}>
                        {v[campo] ? <CheckCircle size={10} /> : <X size={10} />} {label}
                    </span>
                ))}
                <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontWeight: 'bold',
                    color: corSit, padding: '2px 6px',
                    background: `${corSit}22`, borderRadius: '4px'
                }}>
                    {situacao}
                </span>
            </div>
        </div>
    );
}

// Card individual de um veículo no conferente
function CardConferente({ v, expandido, onToggleExpandido, opcoesDocas, onAtualizarStatus, onRecarregar, onAbrirChecklist, cidade }) {
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [docaSelecionada, setDocaSelecionada] = useState(v.doca || 'SELECIONE');
    const [modalOcorrencia, setModalOcorrencia] = useState(false);
    const [modalPausa, setModalPausa] = useState(false);
    const [modalAlterarStatus, setModalAlterarStatus] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const [salvandoTransfer, setSalvandoTransfer] = useState(false);
    const [statusManual, setStatusManual] = useState(v.status || STATUS_CONFERENTE[0]);
    const [horaManual, setHoraManual] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    });

    const statusNormalizado = normalizarStatusDisplay(v.status);
    const corStatus = CORES_STATUS[statusNormalizado] || CORES_STATUS[v.status] || { border: '#64748b', text: '#94a3b8' };
    const idxAtual = STATUS_CONFERENTE.indexOf(statusNormalizado);

    // Timestamp da etapa atual para o timer ao vivo
    const ts = v.timestamps_status || {};
    const unidade = (v.unidade || 'Recife').toLowerCase() === 'moreno' ? 'moreno' : 'recife';
    const pausas = JSON.parse(v.pausas_status || '[]');
    // Conferente só enxerga pausas com fonte='conferente' (isolado do botão em lote do header)
    const temPausaAtiva = pausas.some(p => p.unidade === unidade && p.fonte === 'conferente' && p.fim === null);
    const timerAtKey = v.status === 'EM SEPARAÇÃO' ? `separacao_${unidade}_at`
        : (v.status === 'LIBERADO P/ CARREGAMENTO' || v.status === 'LIBERADO P/ DOCA') ? `lib_doca_${unidade}_at`
            : v.status === 'EM CARREGAMENTO' ? `carregamento_${unidade}_at`
                : v.status === 'CARREGADO' ? `carregado_${unidade}_at`
                    : null;

    const avancarStatus = async () => {
        const proximo = STATUS_CONFERENTE[idxAtual + 1];
        if (!proximo) return;
        setSalvando(true);
        setErro('');
        try {
            const res = await api.post('/api/conferente/atualizar-status', {
                veiculoId: v.id,
                novoStatus: proximo,
                novaDoca: docaSelecionada !== 'SELECIONE' ? docaSelecionada : undefined,
                unidade: v.unidade
            });
            if (res.data.success) {
                onAtualizarStatus(v.id, proximo, docaSelecionada);
            }
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao atualizar status.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarDoca = async (novaDoca) => {
        setDocaSelecionada(novaDoca);
        try {
            await api.post('/api/conferente/atualizar-status', {
                veiculoId: v.id,
                novoStatus: v.status,
                novaDoca: novaDoca !== 'SELECIONE' ? novaDoca : '',
                unidade: v.unidade
            });
            onAtualizarStatus(v.id, v.status, novaDoca);
        } catch { /* silencioso */ }
    };

    const alterarStatusManual = async () => {
        if (!horaManual) return;
        setSalvando(true);
        setErro('');
        try {
            const res = await api.post('/api/conferente/atualizar-status', {
                veiculoId: v.id,
                novoStatus: statusManual,
                novaDoca: docaSelecionada !== 'SELECIONE' ? docaSelecionada : undefined,
                unidade: v.unidade,
                horaManual
            });
            if (res.data.success) {
                setModalAlterarStatus(false);
                onAtualizarStatus(v.id, statusManual, docaSelecionada);
            }
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao alterar status.');
        } finally {
            setSalvando(false);
        }
    };

    const executarTransferencia = async () => {
        setSalvandoTransfer(true);
        setErro('');
        try {
            const res = await api.post('/api/conferente/transferencia', {
                veiculoId: v.id,
                unidade: v.unidade
            });
            if (res.data.success) {
                setConfirmTransfer(false);
                onAtualizarStatus(v.id, 'CARREGADO', docaSelecionada);
            }
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro na transferência.');
        } finally {
            setSalvandoTransfer(false);
        }
    };

    const proximoStatus = STATUS_CONFERENTE[idxAtual + 1];
    // Checklist da carreta:
    // - Mista com checklist já aprovado → não exige de novo em nenhuma unidade
    // - Mista sem checklist → exige apenas na unidade de inicio_rota
    // - Operação única → regra normal (inicio_rota = própria unidade)
    const unidadeCard = v.unidade || 'Recife';
    // Para operação mista: checklist só na unidade de início da rota
    // Para operação de unidade única: o card já filtrado pela API pertence a esta unidade, sem restrição de inicio_rota
    const ehUnidadeInicioRota = !v.isMista || !v.inicio_rota || v.inicio_rota === unidadeCard;
    const precisaChecklist = (v.status === 'LIBERADO P/ CARREGAMENTO' || v.status === 'LIBERADO P/ DOCA') && !v.isFrotaMotorista
        && !(v.isMista && v.checklistAprovado)
        && ehUnidadeInicioRota;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${corStatus.border}44`,
            borderLeft: `4px solid ${corStatus.border}`,
            borderRadius: '14px',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }}>
            {/* Header do card — sempre visível */}
            <div
                onClick={e => { e.stopPropagation(); onToggleExpandido(); }}
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
                <Truck size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.motorista}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {v.placa1Motorista && (
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', color: '#cbd5e1' }}>
                                {v.placa1Motorista}
                            </span>
                        )}
                        {v.placa2Motorista && (
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', color: '#cbd5e1' }}>
                                {v.placa2Motorista}
                            </span>
                        )}
                        {((cidade === 'Moreno' ? v.coletaMoreno : v.coletaRecife) || v.coleta) && (
                            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Hash size={9} /> {(cidade === 'Moreno' ? v.coletaMoreno : v.coletaRecife) || v.coleta}
                            </span>
                        )}
                    </div>
                </div>

                {/* Status badge + timer */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px',
                            background: `${corStatus.border}22`, border: `1px solid ${corStatus.border}66`,
                            color: corStatus.text, whiteSpace: 'nowrap'
                        }}>
                            {statusNormalizado}
                        </span>
                        <button
                            onClick={e => { e.stopPropagation(); setStatusManual(v.status); setModalAlterarStatus(true); }}
                            title="Alterar status manualmente"
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                color: '#64748b', display: 'flex', alignItems: 'center'
                            }}
                        >
                            <Edit2 size={11} />
                        </button>
                    </div>
                    {timerAtKey && ts[timerAtKey] && v.status_cte !== 'Emitido' && <MiniTimer inicioAt={ts[timerAtKey]} pausas={pausas} unidade={unidade} />}
                    {temPausaAtiva && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            ⏸ PAUSADO
                        </span>
                    )}
                    {v.doca && v.doca !== 'SELECIONE' && (
                        <span style={{ fontSize: '10px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={9} /> {v.doca}
                        </span>
                    )}
                </div>

                <ChevronRight size={16} color="#64748b" style={{ flexShrink: 0, transform: expandido ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {/* Painel expandido */}
            {expandido && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Seleção de doca */}
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Anchor size={10} /> DOCA
                        </label>
                        <select
                            value={docaSelecionada}
                            onChange={e => salvarDoca(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: '8px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(59,130,246,0.3)',
                                color: docaSelecionada !== 'SELECIONE' ? '#60a5fa' : '#64748b',
                                fontWeight: docaSelecionada !== 'SELECIONE' ? '700' : 'normal',
                                fontSize: '13px', outline: 'none'
                            }}
                        >
                            {opcoesDocas.map(d => <option key={d} value={d} style={{ color: 'black' }}>{d}</option>)}
                        </select>
                    </div>

                    {/* Painel Ger. Risco */}
                    <PainelGerRisco v={v} />

                    {/* Botão checklist da carreta (aparece quando LIBERADO P/ DOCA e não é frota) */}
                    {precisaChecklist && (
                        <button
                            onClick={() => onAbrirChecklist(v)}
                            style={{
                                width: '100%', padding: '10px',
                                borderRadius: '10px', border: '1px solid rgba(249,115,22,0.4)',
                                background: 'rgba(249,115,22,0.1)', color: '#fb923c',
                                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            <ClipboardCheck size={14} /> CHECKLIST DA CARRETA
                        </button>
                    )}

                    {/* Botão Transferência — pula direto para CARREGADO */}
                    {v.status !== 'CARREGADO' && (
                        confirmTransfer ? (
                            <div style={{
                                padding: '12px', borderRadius: '10px',
                                background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.35)',
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ fontSize: '12px', color: '#c4b5fd', textAlign: 'center' }}>
                                    Confirma transferência para <strong>CARREGADO</strong>?
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setConfirmTransfer(false)}
                                        disabled={salvandoTransfer}
                                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={executarTransferencia}
                                        disabled={salvandoTransfer}
                                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: salvandoTransfer ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white', fontSize: '12px', cursor: salvandoTransfer ? 'not-allowed' : 'pointer', fontWeight: '700' }}
                                    >
                                        {salvandoTransfer ? 'Aguarde...' : 'Confirmar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmTransfer(true)}
                                style={{
                                    width: '100%', padding: '9px',
                                    borderRadius: '10px', border: '1px solid rgba(168,85,247,0.35)',
                                    background: 'rgba(168,85,247,0.08)', color: '#c4b5fd',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                            >
                                <ArrowRightLeft size={14} /> TRANSFERÊNCIA
                            </button>
                        )
                    )}

                    {/* Botão de ocorrência */}
                    <button
                        onClick={() => setModalOcorrencia(true)}
                        style={{
                            width: '100%', padding: '9px',
                            borderRadius: '10px', border: '1px solid rgba(245,158,11,0.35)',
                            background: 'rgba(245,158,11,0.08)', color: '#fbbf24',
                            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                    >
                        <AlertTriangle size={14} /> REGISTRAR OCORRÊNCIA
                    </button>

                    {/* Botão Pausar/Retomar */}
                    {v.status !== 'AGUARDANDO' && v.status !== 'AGUARDANDO P/ SEPARAÇÃO' && v.status !== 'CARREGADO' && (
                        <button
                            onClick={() => setModalPausa(true)}
                            style={{
                                width: '100%', padding: '9px',
                                borderRadius: '10px',
                                border: temPausaAtiva ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(251,191,36,0.35)',
                                background: temPausaAtiva ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.06)',
                                color: temPausaAtiva ? '#4ade80' : '#fbbf24',
                                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            {temPausaAtiva ? '▶ RETOMAR OPERAÇÃO' : '⏸ PAUSAR OPERAÇÃO'}
                        </button>
                    )}

                    {/* Mensagem de erro */}
                    {erro && (
                        <div style={{
                            padding: '10px 12px', borderRadius: '8px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', fontSize: '12px',
                            display: 'flex', alignItems: 'flex-start', gap: '6px'
                        }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                            {erro}
                        </div>
                    )}

                    {/* Botão de avançar status */}
                    {proximoStatus && (
                        <button
                            onClick={avancarStatus}
                            disabled={salvando}
                            style={{
                                width: '100%', padding: '12px',
                                borderRadius: '10px', border: 'none',
                                background: salvando
                                    ? 'rgba(255,255,255,0.05)'
                                    : `linear-gradient(135deg, ${CORES_STATUS[proximoStatus]?.border || '#3b82f6'}, ${CORES_STATUS[proximoStatus]?.border || '#2563eb'}99)`,
                                color: 'white', fontSize: '13px', fontWeight: '700',
                                cursor: salvando ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: salvando ? 'none' : `0 4px 16px ${CORES_STATUS[proximoStatus]?.border || '#3b82f6'}44`
                            }}
                        >
                            {salvando
                                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                                : <><ChevronRight size={14} /> {proximoStatus}</>
                            }
                        </button>
                    )}

                    {/* Último status atingido */}
                    {!proximoStatus && (
                        v.status_cte === 'Emitido' ? (
                            <div style={{ textAlign: 'center', padding: '10px', color: '#4ade80', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <CheckCircle size={16} /> CT-e emitido
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <CheckCircle size={16} /> Operação finalizada — aguardando CT-e
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Modal Alterar Status Manualmente */}
            {modalAlterarStatus && (
                <div
                    onClick={() => setModalAlterarStatus(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#0f172a', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
                    >
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Edit2 size={14} color="#60a5fa" /> Alterar Status Manualmente
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>STATUS</label>
                                <select
                                    value={statusManual}
                                    onChange={e => setStatusManual(e.target.value)}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(96,165,250,0.3)', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}
                                >
                                    {STATUS_CONFERENTE.map(s => <option key={s} value={s} style={{ color: 'black' }}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>HORA EM QUE OCORREU *</label>
                                <input
                                    type="time"
                                    value={horaManual}
                                    onChange={e => setHoraManual(e.target.value)}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(96,165,250,0.3)', color: '#e2e8f0', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            {erro && <div style={{ fontSize: '12px', color: '#f87171', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>{erro}</div>}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button
                                    onClick={() => setModalAlterarStatus(false)}
                                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={alterarStatusManual}
                                    disabled={!horaManual || salvando}
                                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: !horaManual || salvando ? 'rgba(59,130,246,0.3)' : '#3b82f6', color: 'white', fontSize: '13px', cursor: !horaManual || salvando ? 'not-allowed' : 'pointer', fontWeight: '700' }}
                                >
                                    {salvando ? 'Salvando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Ocorrência */}
            {modalOcorrencia && (
                <ModalOcorrencia
                    veiculo={v}
                    onClose={() => setModalOcorrencia(false)}
                />
            )}

            {/* Modal Pausar/Retomar */}
            {modalPausa && (
                <ModalPausaCard
                    veiculo={v}
                    unidade={unidade}
                    temPausaAtiva={temPausaAtiva}
                    onClose={() => setModalPausa(false)}
                    onSucesso={() => { setModalPausa(false); onRecarregar(); }}
                />
            )}
        </div>
    );
}

function ModalPausaCard({ veiculo, unidade, temPausaAtiva, onClose, onSucesso }) {
    const [motivo, setMotivo] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const handleConfirmar = async () => {
        if (!temPausaAtiva && !motivo.trim()) return;
        setSalvando(true);
        setErro('');
        try {
            if (temPausaAtiva) {
                await api.post(`/api/veiculos/${veiculo.id}/retomar`, { unidade, fonte: 'conferente' });
            } else {
                await api.post(`/api/veiculos/${veiculo.id}/pausar`, { motivo, unidade, fonte: 'conferente' });
            }
            onSucesso();
        } catch (e) {
            setErro(e?.response?.data?.message || 'Erro ao processar.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
            <div style={{ background: 'linear-gradient(160deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '100%', maxWidth: '360px', padding: '22px', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>
                        {temPausaAtiva ? '▶ Retomar Operação' : '⏸ Pausar Operação'}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                    {veiculo.motorista} — {unidade.charAt(0).toUpperCase() + unidade.slice(1)}
                </div>
                {!temPausaAtiva && (
                    <textarea
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Motivo da pausa (obrigatório)..."
                        style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', fontFamily: 'system-ui, sans-serif', marginBottom: '14px' }}
                        autoFocus
                    />
                )}
                {erro && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '10px' }}>{erro}</div>}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} disabled={salvando} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={salvando || (!temPausaAtiva && !motivo.trim())}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: temPausaAtiva ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#1c1917', fontWeight: '700', fontSize: '13px', cursor: salvando || (!temPausaAtiva && !motivo.trim()) ? 'not-allowed' : 'pointer', opacity: salvando || (!temPausaAtiva && !motivo.trim()) ? 0.5 : 1 }}
                    >
                        {salvando ? 'Aguarde...' : temPausaAtiva ? '▶ Confirmar' : '⏸ Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ConferenteChecklist({ socket }) {
    const [veiculos, setVeiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandidos, setExpandidos] = useState(new Set());
    const { openChecklistForm, refreshKey } = useConferenteStore();
    const user = useAuthStore(state => state.user);

    const cidade = user?.cidade || 'Recife';
    const hoje = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];
    const [dataSelecionada, setDataSelecionada] = useState(hoje);

    const carregarVeiculos = useCallback(async () => {
        try {
            const res = await api.get('/api/conferente/veiculos', { params: { data: dataSelecionada } });
            if (res.data.success) {
                // Adiciona _key único e estável por posição no array original
                const comKeys = res.data.veiculos.map((v) => ({
                    ...v,
                    status: normalizarStatusDisplay(v.status),
                    _key: `${v.id}-${v.unidade || 'R'}`
                }));
                console.log('[Conferente] veículos carregados:', comKeys.map(v => ({ _key: v._key, id: v.id, unidade: v.unidade, coleta: v.coleta, status: v.status })));
                setVeiculos(comKeys);
            }
        } catch (e) {
            console.error('Erro ao carregar veículos:', e);
        } finally {
            setLoading(false);
        }
    }, [dataSelecionada]);

    useEffect(() => {
        carregarVeiculos();
    }, [carregarVeiculos, refreshKey]);

    // Socket: atualizar lista em tempo real
    useEffect(() => {
        if (!socket) return;
        const handler = () => carregarVeiculos();
        socket.on('receber_atualizacao', handler);
        socket.on('conferente_novo_veiculo', handler);
        socket.on('cadastro_situacao_atualizada', handler);
        // CT-e emitido no painel CTE → atualiza status_cte no card
        socket.on('cadastro_cte_emitido', handler);
        return () => {
            socket.off('receber_atualizacao', handler);
            socket.off('conferente_novo_veiculo', handler);
            socket.off('cadastro_situacao_atualizada', handler);
            socket.off('cadastro_cte_emitido', handler);
        };
    }, [socket, carregarVeiculos]);

    // Atualizar card localmente (otimista) sem recarregar tudo
    const handleAtualizarStatus = useCallback((id, novoStatus, novaDoca) => {
        setVeiculos(prev => {
            const atualizado = prev.map(v => {
                if (v.id !== id) return v;
                const novoV = { ...v, status: novoStatus };
                if (novaDoca && novaDoca !== 'SELECIONE') novoV.doca = novaDoca;
                // timestamps_status é AUTORITATIVO DO BACKEND — não gravar localmente.
                // O socket receber_atualizacao vai recarregar com dados frescos do banco.
                return novoV;
            });
            return atualizado.filter(v => STATUS_CONFERENTE.includes(v.status));
        });
    }, []);

    // Agrupar por status para exibição ordenada
    const porStatus = STATUS_CONFERENTE.map(s => ({
        status: s,
        itens: veiculos.filter(v => v.status === s)
    })).filter(g => g.itens.length > 0);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <RefreshCw size={24} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const mudarDia = (delta) => {
        const d = new Date(dataSelecionada + 'T12:00:00');
        d.setDate(d.getDate() + delta);
        setDataSelecionada(d.toISOString().split('T')[0]);
    };

    const eHoje = dataSelecionada === hoje;

    const formatarData = (iso) => {
        const [ano, mes, dia] = iso.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardCheck size={20} color="#3b82f6" />
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                        Operação da Doca
                    </h2>
                    <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                        {veiculos.length}
                    </span>
                </div>
                <button
                    onClick={carregarVeiculos}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Navegador de data */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <button
                    onClick={() => mudarDia(-1)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                >
                    <ChevronLeft size={16} />
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px' }}>
                    <Calendar size={13} color="#64748b" />
                    <input
                        type="date"
                        value={dataSelecionada}
                        onChange={e => setDataSelecionada(e.target.value)}
                        style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{formatarData(dataSelecionada)}</span>
                </div>
                <button
                    onClick={() => mudarDia(1)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                >
                    <ChevronRight size={16} />
                </button>
                {!eHoje && (
                    <button
                        onClick={() => setDataSelecionada(hoje)}
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#60a5fa', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                        Hoje
                    </button>
                )}
            </div>

            {veiculos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '14px' }}>
                    <ClipboardCheck size={40} color="#334155" style={{ marginBottom: '12px' }} />
                    <p style={{ margin: 0 }}>Nenhum veículo em operação</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                        Os cards aparecem aqui quando chegam no pátio
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {porStatus.map(grupo => {
                        const cor = CORES_STATUS[grupo.status] || { border: '#64748b', text: '#94a3b8' };
                        return (
                            <div key={grupo.status}>
                                {/* Header do grupo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cor.border, flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: cor.text, letterSpacing: '0.5px' }}>
                                        {grupo.status}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#475569' }}>({grupo.itens.length})</span>
                                    <div style={{ flex: 1, height: '1px', background: `${cor.border}33` }} />
                                </div>

                                {/* Cards do grupo */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                                    {grupo.itens.map(v => {
                                        const cardKey = v._key;
                                        const docasCard = (v.unidade || cidade) === 'Moreno' ? DOCAS_MORENO_LISTA : DOCAS_RECIFE_LISTA;
                                        return (
                                            <CardConferente
                                                key={cardKey}
                                                cardKey={cardKey}
                                                v={v}
                                                expandido={expandidos.has(cardKey)}
                                                onToggleExpandido={() => setExpandidos(prev => {
                                                    const next = new Set(prev);
                                                    next.has(cardKey) ? next.delete(cardKey) : next.add(cardKey);
                                                    return next;
                                                })}
                                                opcoesDocas={docasCard}
                                                onAtualizarStatus={handleAtualizarStatus}
                                                onRecarregar={carregarVeiculos}
                                                onAbrirChecklist={openChecklistForm}
                                                cidade={cidade}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
