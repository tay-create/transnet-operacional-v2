import React, { useState, useEffect, useMemo } from 'react';
import { useApiCall } from '../hooks/useApiCall';
import TagInput from './TagInput';
import {
    Package, Anchor, X, Search, Box, Calendar, ArrowRight,
    MapPin, Circle, Trash2, AlertTriangle, Image, Edit2, Bell, Lock, ShieldCheck,
    CheckCircle, Clock, FileText, Warehouse, Truck, CalendarPlus, CalendarCheck, UserX, Download,
    Smartphone
} from 'lucide-react';
import { gerarPdfCubagem } from '../utils/cubagemPdf';
import SLATimeline from './SLATimeline';
import { OPCOES_OPERACAO, OPCOES_VEICULO, CORES_STATUS, OPCOES_STATUS, DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA } from '../constants';
import api from '../services/apiService';
import { obterDataBrasilia } from '../utils/helpers';
import { parseColetaMoreno, joinColetaMoreno, opTemPlastico, opTemPorcelana, opTemEletrik, opPrecisaSplit } from '../utils/coletaMoreno';
import { ehOperacaoInterestadual, ehOperacaoRecife, ehOperacaoMoreno, normalizarStatusInterestadual, getCampoStatus, getStatus } from '../utils/operacaoUtils';
import { usePainelFiltros } from '../hooks/painel/usePainelFiltros';
import { usePainelModais } from '../hooks/painel/usePainelModais';
import { usePainelConfirmacoes } from '../hooks/painel/usePainelConfirmacoes';
import { useCteOperadores } from '../hooks/painel/useCteOperadores';
import { useDocasPainel } from '../hooks/painel/useDocasPainel';
import { useOperacaoActions } from '../hooks/painel/useOperacaoActions';
import { useMotoristasPainel } from '../hooks/painel/useMotoristasPainel';
import PainelToasts from './painel/PainelToasts';
import PainelHeader from './painel/PainelHeader';
import PainelDocas from './painel/PainelDocas';
import PainelModais from './painel/PainelModais';


const SUB_STYLES_CARD = {
    plastico: { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)', badgeBg: 'rgba(148,163,184,0.22)', text: '#cbd5e1', badgeBorder: 'rgba(148,163,184,0.45)', label: 'PLÁSTICO' },
    porcelana: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', badgeBg: 'rgba(168,85,247,0.2)', text: '#c084fc', badgeBorder: 'rgba(168,85,247,0.4)', label: 'PORCELANA' },
    eletrik:   { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)', badgeBg: 'rgba(6,182,212,0.2)', text: '#22d3ee', badgeBorder: 'rgba(6,182,212,0.4)', label: 'ELETRIK' },
};

function ColetaMorenoSplit({ valor, operacao, onChange, disabled }) {
    const parsed = parseColetaMoreno(valor, operacao);
    const showPlas = opTemPlastico(operacao);
    const showPorc = opTemPorcelana(operacao);
    const showElet = opTemEletrik(operacao);
    const upd = (parte, val) => {
        const atual = { ...parsed, [parte]: val };
        onChange(joinColetaMoreno(atual));
    };
    const Sub = ({ parte }) => {
        const s = SUB_STYLES_CARD[parte];
        return (
            <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '8px', fontWeight: '800', letterSpacing: '0.4px', padding: '1px 6px', borderRadius: '3px', background: s.badgeBg, color: s.text, border: `1px solid ${s.badgeBorder}` }}>{s.label}</span>
                </div>
                <TagInput value={parsed[parte]} onChange={v => upd(parte, v)} disabled={disabled} />
            </div>
        );
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {showPlas && <Sub parte="plastico" />}
            {showPorc && <Sub parte="porcelana" />}
            {showElet && <Sub parte="eletrik" />}
        </div>
    );
}


export default function PainelOperacional({
    origem, lista, setLista, opcoesDocas,
    termoBusca, setTermoBusca, user,
    funcoes, operacoesFixas = null
}) {
    const { podeEditar, updateList, liberarParaCte, socket, removerVeiculo, mostrarNotificacao } = funcoes;
    // Verifica se o usuário pode editar baseado na unidade
    const podeEditarNaUnidade = (permissao) => {
        if (user.cargo === 'Coordenador' || user.cargo === 'Planejamento' || user.cargo === 'Desenvolvedor') {
            return podeEditar(permissao);
        }
        // Painel com operações fixas (ex: Leão/Eletrik Sul) não tem restrição por cidade
        if (operacoesFixas) return podeEditar(permissao);
        if (user.cidade !== origem) {
            return false;
        }
        return podeEditar(permissao);
    };

    const { dataInicio, setDataInicio, dataFim, setDataFim, filtroOperacao, setFiltroOperacao, itensFiltrados, itensOrdenados, campoStatus } = usePainelFiltros({ origem, lista, operacoesFixas, termoBusca });
    const {
        modalColetasAberto, setModalColetasAberto,
        modalChecklistAberto, setModalChecklistAberto,
        veiculoSelecionado, setVeiculoSelecionado,
        modalPausaAberto, setModalPausaAberto,
        imagemAmpliada, setImagemAmpliada,
        modalEntregasCard, setModalEntregasCard,
        modalFrota, setModalFrota,
        frotaOrigem, setFrotaOrigem,
        frotaDestino, setFrotaDestino,
        loadingPdf, setLoadingPdf,
        modalLacre, setModalLacre,
        modalLinkMotorista, setModalLinkMotorista,
        inputColetaModal, setInputColetaModal,
        inputColetaValor, setInputColetaValor,
    } = usePainelModais();
    const ORDEM_STATUS = OPCOES_STATUS;
    const {
        confirmarLiberadoCte, setConfirmarLiberadoCte,
        confirmarFinalizar, setConfirmarFinalizar,
        proximaDataFinalizar, setProximaDataFinalizar,
        modalEscolhaDia, setModalEscolhaDia,
        confirmarReprogramar, setConfirmarReprogramar,
        confirmarMisto, setConfirmarMisto,
        confirmarLiberarChecklist, setConfirmarLiberarChecklist,
        confirmarCopiaColeta, setConfirmarCopiaColeta,
        finalizando, setFinalizando,
    } = usePainelConfirmacoes();
    const {
        operadoresConhecimento,
        operadorSelecionado, setOperadorSelecionado,
        reenviarCte, setReenviarCte,
        operadorReenvio, setOperadorReenvio,
    } = useCteOperadores({ confirmarLiberadoCte });
    const { docasInterditadas, addCardFulgaz, removerCardFulgaz, alterarDocaFulgaz } = useDocasPainel({ origem, dataInicio, socket });
    const { handleOperacaoChange, reprogramarItem } = useOperacaoActions();
    const {
        motoristasDisponiveis,
        editandoMotorista, setEditandoMotorista,
        editandoPlaca, setEditandoPlaca,
        buscaMotoristaCard, setBuscaMotoristaCard,
        toasts,
        adicionarToast,
        itemTemPlacaNoProvisionamento,
        checarPlacaProvisaoCard,
        selecionarMotoristaNaEdicao,
        salvarMotoristaNoCard,
        salvarMotoristaManual,
        removerMotoristaDoCard,
    } = useMotoristasPainel({ lista, setLista, socket, mostrarNotificacao, setModalEntregasCard });

    const getEstiloRota = (valor) => ({
        background: 'transparent',
        borderBottom: valor ? '1px solid #d8b4fe' : '1px solid rgba(255,255,255,0.2)', // Apenas linha embaixo
        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
        color: valor ? '#d8b4fe' : '#94a3b8',
        borderRadius: '0px',
        padding: '0px 4px',
        fontSize: '11px',
        width: '60px',
        outline: 'none',
        textAlign: 'center',
        fontWeight: valor ? 'bold' : 'normal'
    });

    return (
        <div style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 124px)', padding: '0 10px 20px 20px' }}>
            <style>{`
@keyframes slideIn { from{ opacity: 0; transform: translateX(30px) } to{ opacity: 1; transform: translateX(0) } }
                .motorista - hover - wrapper: hover.motorista - hover - card { display: block!important; }
`}</style>

            {/* Toasts de notificação */}
            <PainelToasts toasts={toasts} />

            {/* === CONTEÚDO PRINCIPAL === */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>

                {/* Header da Área Principal */}
                <PainelHeader
                    origem={origem}
                    dataInicio={dataInicio} setDataInicio={setDataInicio}
                    dataFim={dataFim} setDataFim={setDataFim}
                    filtroOperacao={filtroOperacao} setFiltroOperacao={setFiltroOperacao}
                    termoBusca={termoBusca} setTermoBusca={setTermoBusca}
                    operacoesFixas={operacoesFixas}
                    itensFiltrados={itensFiltrados}
                    campoStatus={campoStatus}
                    user={user}
                    podeEditarNaUnidade={podeEditarNaUnidade}
                    onAddContainer={addCardFulgaz}
                    onAbrirPausa={() => setModalPausaAberto(true)}
                    onFinalizarClick={() => {
                        const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                        if (hoje.getDay() === 5) {
                            setModalEscolhaDia(true);
                        } else {
                            setProximaDataFinalizar(null);
                            setConfirmarFinalizar(true);
                        }
                    }}
                />

                {/* Grid Scrollável */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                    {itensFiltrados.length === 0 && docasInterditadas.filter(c => c.unidade === origem).length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                                <Box size={40} color="#94a3b8" strokeWidth={1.5} />
                            </div>
                            <h3 style={{ color: 'white', fontWeight: '300', margin: 0 }}>Nenhum veículo encontrado</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '10px' }}>Verifique os filtros ou faça um novo lançamento.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
                            <PainelDocas
                                docasInterditadas={docasInterditadas}
                                origem={origem}
                                opcoesDocas={opcoesDocas}
                                podeEditarNaUnidade={podeEditarNaUnidade}
                                onRemover={removerCardFulgaz}
                                onAlterarDoca={alterarDocaFulgaz}
                            />

                            {ORDEM_STATUS.map(status => {
                                const campoGrupo = campoStatus;
                                const grupo = itensOrdenados.filter(item => normalizarStatusInterestadual(item, item[campoGrupo] || OPCOES_STATUS[0]) === status);
                                if (grupo.length === 0) return null;
                                const corGrupo = CORES_STATUS[status] || { border: '#64748b', text: '#94a3b8' };
                                return (
                                    <div key={status}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: corGrupo.border, flexShrink: 0 }} />
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: corGrupo.text, letterSpacing: '0.5px' }}>{status}</span>
                                            <span style={{ fontSize: '11px', color: '#475569' }}>({grupo.length})</span>
                                            <div style={{ flex: 1, height: '1px', background: `${corGrupo.border}33` }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                            {grupo.map((item) => {
                                const realIndex = lista.findIndex(i => i.id === item.id);
                                const campoStatusAlvo = campoStatus;
                                const valorStatusAtual = normalizarStatusInterestadual(item, item[campoStatusAlvo] || 'AGUARDANDO');
                                const corStatus = CORES_STATUS[valorStatusAtual] || { border: '#fff', text: '#fff' };
                                const isMista = item.coletaRecife && item.coletaMoreno;

                                // Determinar se é 1ª ou 2ª parada baseado no inicio_rota
                                // A unidade que tem inicio_rota === origem é a 1ª parada
                                // A outra unidade (se for mista) é a 2ª parada
                                let souPrimeira = false;
                                if (isMista) {
                                    // Se inicio_rota está definido, usar ele
                                    if (item.inicio_rota) {
                                        souPrimeira = item.inicio_rota === origem;
                                    }
                                    // Fallback: usar origem_criacao
                                    else if (item.origem_criacao) {
                                        souPrimeira = item.origem_criacao === origem;
                                    }
                                    // Último fallback: verificar qual unidade tem coleta primeiro
                                    else {
                                        const temColetaRecife = item.coletaRecife && item.coletaRecife.trim().length > 0;
                                        const temColetaMoreno = item.coletaMoreno && item.coletaMoreno.trim().length > 0;

                                        if (temColetaRecife && !temColetaMoreno) {
                                            souPrimeira = origem === 'Recife';
                                        } else if (temColetaMoreno && !temColetaRecife) {
                                            souPrimeira = origem === 'Moreno';
                                        } else {
                                            // Ambos têm coleta: assumir Recife como primeira se origem for Recife
                                            souPrimeira = origem === 'Recife';
                                        }
                                    }
                                }

                                const precisaCampoMoreno = origem === 'Recife' && ehOperacaoMoreno(item.operacao);
                                const precisaCampoRecife = origem === 'Moreno' && ehOperacaoRecife(item.operacao);
                                const pausasCard = JSON.parse(item.pausas_status || '[]');
                                const temPausaAtiva = pausasCard.some(p => p.unidade === origem.toLowerCase() && p.fim === null);

                                return (
                                    <div key={item.id} className="glass-panel-internal card-neon-hover" style={{ borderLeft: `4px solid ${corStatus.border}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                                        {/* Header do Card */}
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ flex: 1 }}>
                                                <select value={item.operacao} onChange={(e) => handleOperacaoChange(item, e.target.value, { ...funcoes, pedirCopiaColeta: setConfirmarCopiaColeta, pedirInputColeta: (unidadeDestino, onConfirmColeta) => { setInputColetaValor(''); setInputColetaModal({ unidadeDestino, onConfirm: onConfirmColeta }); } }, lista, setLista, realIndex, api)} disabled={!podeEditarNaUnidade('editar_operacao_card')} style={{ background: 'transparent', color: 'white', fontWeight: 'bold', border: 'none', width: '100%', outline: 'none', fontSize: '14px' }}>
                                                    {OPCOES_OPERACAO.map(op => <option key={op} style={{ color: 'black' }}>{op}</option>)}
                                                </select>
                                                {/* Exibicao sutil da 1a e 2a parada */}
                                                {item.primeira_parada && item.segunda_parada && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                                        <MapPin size={9} color="#60a5fa" /> <span style={{ color: '#93c5fd' }}>{item.primeira_parada}</span>
                                                        <ArrowRight size={9} color="#64748b" />
                                                        <span style={{ color: '#fcd34d' }}>{item.segunda_parada}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                {/* Data — específica da unidade da coluna (fallback no guarda-chuva pra cards pré-migração) */}
                                                {(() => {
                                                    const dpUnidade = origem === 'Recife'
                                                        ? (item.data_prevista_recife || item.data_prevista)
                                                        : (item.data_prevista_moreno || item.data_prevista);
                                                    return (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                                    <Calendar size={12} style={podeEditarNaUnidade('adiar_dia') ? { cursor: 'pointer' } : {}} />
                                                    {dpUnidade ? dpUnidade.split('-').reverse().slice(0, 2).join('/') : '—'}
                                                    {podeEditarNaUnidade('adiar_dia') && (
                                                        <input
                                                            type="date"
                                                            value={dpUnidade || ''}
                                                            onChange={e => e.target.value && reprogramarItem(lista, setLista, realIndex, e.target.value, api, mostrarNotificacao, 1, origem)}
                                                            style={{
                                                                position: 'absolute', inset: 0, opacity: 0,
                                                                cursor: 'pointer', width: '100%', height: '100%'
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                                {/* Botões de reprogramação */}
                                                {podeEditarNaUnidade('adiar_dia') && (() => {
                                                    const hoje = new Date().toISOString().slice(0, 10);
                                                    const prox = new Date();
                                                    prox.setDate(prox.getDate() + 1);
                                                    if (prox.getDay() === 0) prox.setDate(prox.getDate() + 1);
                                                    const proxStr = prox.toISOString().slice(0, 10);
                                                    const dataCarregadoUnidade = origem === 'Recife' ? item.data_carregado_recife : item.data_carregado_moreno;
                                                    const dataCarregadoOutraUnidade = origem === 'Recife' ? item.data_carregado_moreno : item.data_carregado_recife;
                                                    const statusAtualItem = getStatus(item, campoStatus);
                                                    const dpUnidadeBtn = origem === 'Recife'
                                                        ? (item.data_prevista_recife || item.data_prevista)
                                                        : (item.data_prevista_moreno || item.data_prevista);
                                                    const eHoje = dpUnidadeBtn === hoje;
                                                    // Card misto: outra parada já carregou (ancorando nela), mas esta parada ainda não
                                                    // Nesse caso o data_prevista pode ser ontem — ainda assim pode avançar para amanhã
                                                    const outraParadaJaCarregou = !!(item.coletaRecife && item.coletaMoreno && dataCarregadoOutraUnidade);
                                                    const podeAvancarDia = (eHoje || outraParadaJaCarregou) && !dataCarregadoUnidade && !['CARREGADO', 'LIBERADO P/ CT-e'].includes(statusAtualItem);
                                                    return (
                                                        <>
                                                            {/* Avançar para amanhã — conta como reprogramado */}
                                                            {podeAvancarDia && (
                                                                <button
                                                                    onClick={() => setConfirmarReprogramar({ lista, setLista, realIndex, proxStr, origem })}
                                                                    title={`Reprogramar para ${proxStr.split('-').reverse().slice(0,2).join('/')}`}
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                        padding: '3px 7px', borderRadius: '5px', cursor: 'pointer',
                                                                        fontSize: '10px', fontWeight: '700',
                                                                        background: 'rgba(250,204,21,0.12)',
                                                                        color: '#facc15',
                                                                        border: '1px solid rgba(250,204,21,0.3)'
                                                                    }}
                                                                >
                                                                    <CalendarPlus size={11} /> +1 dia
                                                                </button>
                                                            )}
                                                            {/* Voltar para hoje — só faz sentido se a outra parada NÃO ancoroucom carregamento */}
                                                            {!eHoje && !outraParadaJaCarregou && (
                                                                <button
                                                                    onClick={() => reprogramarItem(lista, setLista, realIndex, hoje, api, mostrarNotificacao, 0)}
                                                                    title="Voltar para hoje"
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                        padding: '3px 7px', borderRadius: '5px', cursor: 'pointer',
                                                                        fontSize: '10px', fontWeight: '700',
                                                                        background: 'rgba(34,197,94,0.12)',
                                                                        color: '#4ade80',
                                                                        border: '1px solid rgba(34,197,94,0.3)'
                                                                    }}
                                                                >
                                                                    <CalendarCheck size={11} /> Hoje
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {isMista && (
                                                <div style={{ fontSize: '10px', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', background: souPrimeira ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: souPrimeira ? '#60a5fa' : '#fbbf24', marginLeft: '10px' }}>
                                                    {souPrimeira ? <MapPin size={10} /> : <ArrowRight size={10} />} {souPrimeira ? '1ª PARADA' : '2ª PARADA'}
                                                </div>
                                            )}
                                            {temPausaAtiva && (
                                                <div style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', marginLeft: '6px', fontWeight: '700', letterSpacing: '0.5px' }}>
                                                    ⏸ PAUSADO
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                                {podeEditarNaUnidade('operacao') && (
                                                    <button
                                                        onClick={() => removerVeiculo(item.id)}
                                                        title="Excluir Veículo"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            cursor: 'pointer',
                                                            color: '#fca5a5',
                                                            borderRadius: '6px',
                                                            padding: '4px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Corpo do Card */}
                                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>

                                            {/* Coletas e Flags */}
                                            {/* BLOCO COLETA PRINCIPAL */}
                                            <div>
                                                {/* LINHA 1: TÍTULO + ROTA */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <label className="label-tech-sm" style={{ color: origem === 'Recife' ? '#60a5fa' : '#fbbf24', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Package size={12} /> COLETA ({origem})
                                                    </label>

                                                    {/* ROTA AQUI EM CIMA */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '9px', color: '#64748b' }}>ROTA:</span>
                                                        <input
                                                            value={(operacoesFixas ? item.rotaRecife : origem === 'Recife' ? item.rotaRecife : item.rotaMoreno) || ''}
                                                            onChange={e => updateList(lista, setLista, realIndex, origem === 'Recife' || operacoesFixas ? 'rotaRecife' : 'rotaMoreno', e.target.value)}
                                                            placeholder="..."
                                                            style={getEstiloRota(origem === 'Recife' ? item.rotaRecife : item.rotaMoreno)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* LINHA 2: CAIXA DE NOTAS - CORRIGIDO para usar campo específico */}
                                                <div>
                                                    {origem === 'Moreno' && opPrecisaSplit(item.operacao) ? (
                                                        <ColetaMorenoSplit
                                                            valor={item.coletaMoreno || ''}
                                                            operacao={item.operacao}
                                                            onChange={val => updateList(lista, setLista, realIndex, 'coletaMoreno', val)}
                                                            disabled={!podeEditarNaUnidade('coleta_card')}
                                                        />
                                                    ) : (
                                                        <div style={origem === 'Recife'
                                                            ? { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', padding: '8px' }
                                                            : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '8px' }
                                                        }>
                                                            <TagInput
                                                                value={operacoesFixas ? (item.coletaInterestadual || '') : origem === 'Recife' ? (item.coletaRecife || '') : (item.coletaMoreno || '')}
                                                                onChange={val => updateList(lista, setLista, realIndex, operacoesFixas ? 'coletaInterestadual' : origem === 'Recife' ? 'coletaRecife' : 'coletaMoreno', val)}
                                                                disabled={!podeEditarNaUnidade('coleta_card')}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {precisaCampoMoreno && (
                                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '6px', border: '1px dashed rgba(245, 158, 11, 0.3)', marginTop: '8px' }}>

                                                    {/* LINHA 1: TÍTULO MORENO + ROTA MORENO */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Circle size={10} fill="currentColor" color="#fbbf24" />
                                                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fbbf24' }}>MORENO</span>
                                                        </div>

                                                        {/* ROTA MORENO */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '9px', color: '#b45309' }}>ROTA:</span>
                                                            <input
                                                                value={item.rotaMoreno || ''}
                                                                onChange={e => updateList(lista, setLista, realIndex, 'rotaMoreno', e.target.value)}
                                                                placeholder="..."
                                                                style={{
                                                                    ...getEstiloRota(item.rotaMoreno),
                                                                    borderBottom: '1px solid rgba(245, 158, 11, 0.5)',
                                                                    color: '#fcd34d'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* LINHA 2: TAGS MORENO */}
                                                    <div>
                                                        {opPrecisaSplit(item.operacao) ? (
                                                            <ColetaMorenoSplit
                                                                valor={item.coletaMoreno || ''}
                                                                operacao={item.operacao}
                                                                onChange={val => updateList(lista, setLista, realIndex, 'coletaMoreno', val)}
                                                                disabled={!podeEditarNaUnidade('coleta_card')}
                                                            />
                                                        ) : (
                                                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '8px' }}>
                                                                <TagInput value={item.coletaMoreno || ''} onChange={val => updateList(lista, setLista, realIndex, 'coletaMoreno', val)} disabled={!podeEditarNaUnidade('coleta_card')} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {precisaCampoRecife && (
                                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '6px', border: '1px dashed rgba(59, 130, 246, 0.3)', marginTop: '8px' }}>

                                                    {/* LINHA 1: TÍTULO RECIFE + ROTA RECIFE */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Circle size={10} fill="currentColor" color="#60a5fa" />
                                                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#60a5fa' }}>RECIFE</span>
                                                        </div>

                                                        {/* ROTA RECIFE */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '9px', color: '#1e3a8a' }}>ROTA:</span>
                                                            <input
                                                                value={item.rotaRecife || ''}
                                                                onChange={e => updateList(lista, setLista, realIndex, 'rotaRecife', e.target.value)}
                                                                placeholder="..."
                                                                style={{
                                                                    ...getEstiloRota(item.rotaRecife),
                                                                    borderBottom: '1px solid rgba(59, 130, 246, 0.5)',
                                                                    color: '#93c5fd'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* LINHA 2: TAGS RECIFE */}
                                                    <div>
                                                        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', padding: '8px' }}>
                                                            <TagInput value={item.coletaRecife || ''} onChange={val => updateList(lista, setLista, realIndex, 'coletaRecife', val)} disabled={!podeEditarNaUnidade('coleta_card')} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Motorista e Veículo */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                                                <div>
                                                    <label className="label-tech-sm">MOTORISTA</label>
                                                    {/* Renderizacao do Motorista e Botoes do WhatsApp */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                                                        {/* Condicao de edicao apenas para o nome */}
                                                        {editandoMotorista === item.id ? (
                                                            <div style={{ position: 'relative' }}>
                                                                <input
                                                                    className="input-internal"
                                                                    autoFocus
                                                                    placeholder="Digite ou selecione..."
                                                                    value={buscaMotoristaCard.id === item.id ? buscaMotoristaCard.texto : ''}
                                                                    onChange={e => setBuscaMotoristaCard({ id: item.id, texto: e.target.value })}
                                                                    onBlur={() => {
                                                                        setTimeout(() => {
                                                                            salvarMotoristaManual(item, realIndex, buscaMotoristaCard.id === item.id ? buscaMotoristaCard.texto : '');
                                                                        }, 150);
                                                                    }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') salvarMotoristaManual(item, realIndex, buscaMotoristaCard.id === item.id ? buscaMotoristaCard.texto : '');
                                                                        if (e.key === 'Escape') { setEditandoMotorista(null); setBuscaMotoristaCard({ id: null, texto: '' }); }
                                                                    }}
                                                                    style={{ width: '100%' }}
                                                                />
                                                                {buscaMotoristaCard.id === item.id && buscaMotoristaCard.texto.length > 0 && motoristasDisponiveis.filter(m =>
                                                                    m.nome_motorista.toLowerCase().includes(buscaMotoristaCard.texto.toLowerCase()) ||
                                                                    m.placa1.toLowerCase().includes(buscaMotoristaCard.texto.toLowerCase())
                                                                ).length > 0 && (
                                                                    <div style={{
                                                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                                                                        background: '#0f172a', border: '1px solid rgba(59,130,246,0.4)',
                                                                        borderRadius: '6px', maxHeight: '200px', overflowY: 'auto',
                                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                                                                    }}>
                                                                        {motoristasDisponiveis.filter(m =>
                                                                            m.nome_motorista.toLowerCase().includes(buscaMotoristaCard.texto.toLowerCase()) ||
                                                                            m.placa1.toLowerCase().includes(buscaMotoristaCard.texto.toLowerCase())
                                                                        ).map(m => (
                                                                            <div
                                                                                key={m.id}
                                                                                onMouseDown={() => {
                                                                                    const resultado = selecionarMotoristaNaEdicao(item, realIndex, m);
                                                                                    if (resultado?.abrirFrota) {
                                                                                        setModalFrota(resultado.abrirFrota);
                                                                                        setFrotaOrigem('');
                                                                                        setFrotaDestino('');
                                                                                    }
                                                                                }}
                                                                                style={{
                                                                                    padding: '8px 10px', cursor: 'pointer', fontSize: '12px',
                                                                                    color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                                                }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                <strong style={{ textTransform: 'uppercase' }}>{m.nome_motorista}</strong>
                                                                                {m.is_frota ? ' [FROTA]' : ''} — {m.placa1}
                                                                                {m.disponibilidade ? <span style={{ color: '#94a3b8' }}> [{m.disponibilidade}]</span> : ''}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="motorista-hover-wrapper" style={{ position: 'relative' }}>
                                                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f1f5f9', cursor: 'help', textTransform: 'uppercase' }}>{item.motorista || 'A DEFINIR'}</span>
                                                                {/* Caixa de informacao do hover */}
                                                                <div className="motorista-hover-card" style={{
                                                                    display: 'none', position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px',
                                                                    width: '240px', padding: '10px 12px', background: 'rgba(15,23,42,0.97)',
                                                                    border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px',
                                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 50, fontSize: '11px', color: '#cbd5e1',
                                                                    lineHeight: '1.6'
                                                                }}>
                                                                    <div style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase' }}>{item.motorista || 'Sem Nome'}</div>
                                                                    <div>Placa: <strong style={{ color: '#fbbf24' }}>{item.placa1Motorista || item.placa || '—'}</strong>{item.placa2Motorista ? ` / ${item.placa2Motorista} ` : ''}</div>
                                                                    <div>Telefone: <strong style={{ color: item.telefoneMotorista ? '#4ade80' : '#f87171' }}>{item.telefoneMotorista || 'NAO REGISTRADO'}</strong></div>
                                                                    {item.disponibilidadeMotorista && <div>Local: {item.disponibilidadeMotorista}</div>}
                                                                    {item.origemMotorista && <div>Origem: {item.origemMotorista}</div>}
                                                                    {item.destinoMotorista && <div>Destino: {item.destinoMotorista}</div>}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Botao 1: SEMPRE VISIVEL */}
                                                        <a
                                                            href={`https://wa.me/${((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '').length <= 11 ? '55' + ((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '') : ((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '')}?text=${encodeURIComponent('Prezado motorista, comparecer a portaria para a conferencia da sua documentação')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="WhatsApp: Documentação na portaria"
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px',
                                                                background: 'rgba(34,197,94,0.15)',
                                                                borderRadius: '50%',
                                                                color: '#22c55e',
                                                                cursor: 'pointer',
                                                                transition: 'color 0.2s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#15803d'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#22c55e'}
                                                        >
                                                            <FileText size={16} />
                                                        </a>

                                                        {/* Badge Entrega Local */}
                                                        {item.entregaLocal && !ehOperacaoInterestadual(item.operacao) && (
                                                            <span
                                                                title="Entrega Local — sem lacre"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 7px', background: 'rgba(16,185,129,0.15)', borderRadius: '12px', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', fontSize: '10px', fontWeight: '700' }}
                                                            >
                                                                <MapPin size={11} /> LOCAL
                                                            </span>
                                                        )}

                                                        {/* Badge Lacre — carrega fotos sob demanda ao clicar */}
                                                        {!item.entregaLocal && (() => {
                                                            const temFoto = origem === 'Moreno' ? item.tem_foto_lacre_moreno : item.tem_foto_lacre_recife;
                                                            if (!temFoto) return null;
                                                            const origemParam = origem === 'Moreno' ? 'moreno' : 'recife';
                                                            return (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            const r = await api.get(`/veiculos/${item.id}/foto-lacre/${origemParam}`);
                                                                            const raw = r.data?.foto;
                                                                            if (!raw) return;
                                                                            let fotos = [];
                                                                            try { fotos = JSON.parse(raw); } catch { fotos = [raw]; }
                                                                            if (!fotos.length) return;
                                                                            setModalLacre({ fotos, motorista: item.motorista });
                                                                        } catch (e) { console.error('Erro ao carregar foto do lacre:', e); }
                                                                    }}
                                                                    title="Ver fotos do lacre"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 6px', background: 'rgba(34,197,94,0.15)', borderRadius: '12px', color: '#22c55e', cursor: 'pointer', border: 'none', fontSize: '10px', fontWeight: '700' }}
                                                                >
                                                                    <Lock size={13} />
                                                                </button>
                                                            );
                                                        })()}

                                                        {/* Botao 2: Chamada para Doca */}
                                                        {
                                                            (() => {
                                                                const campoDocaAlvo = origem === 'Recife' ? 'doca_recife' : 'doca_moreno';
                                                                const docaAtual = item[campoDocaAlvo];
                                                                if (valorStatusAtual === 'LIBERADO P/ DOCA' && docaAtual && docaAtual !== 'SELECIONE') {
                                                                    return (
                                                                        <a
                                                                            href={`https://wa.me/${((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '').length <= 11 ? '55' + ((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '') : ((item?.telefone || item?.telefoneMotorista) || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Prezado motorista, por gentileza encostar na doca ${docaAtual} da unidade ${item.unidade || origem} o mais breve possivel.`)}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title="WhatsApp: Avisar liberação da doca"
                                                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px', background: 'rgba(59,130,246,0.15)', borderRadius: '50%', color: '#3b82f6', cursor: 'pointer', transition: 'color 0.2s' }}
                                                                            onMouseEnter={e => e.currentTarget.style.color = '#1d4ed8'}
                                                                            onMouseLeave={e => e.currentTarget.style.color = '#3b82f6'}
                                                                        >
                                                                            <Warehouse size={16} />
                                                                        </a>
                                                                    );
                                                                }
                                                                return null;
                                                            })()
                                                        }

                                                        {/* Botao Editar Nome */}
                                                        {podeEditarNaUnidade('operacao') && (
                                                            <button
                                                                onClick={() => { setEditandoMotorista(item.id); setBuscaMotoristaCard({ id: item.id, texto: item.motorista || '' }); }}
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, marginLeft: 'auto' }}
                                                                title="Trocar motorista"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                        {/* Botao Remover Motorista */}
                                                        {podeEditarNaUnidade('operacao') && item.motorista && item.motorista.trim() && (
                                                            <button
                                                                onClick={() => removerMotoristaDoCard(item, realIndex)}
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171', padding: 0 }}
                                                                title="Remover motorista (volta para a fila)"
                                                            >
                                                                <UserX size={14} />
                                                            </button>
                                                        )}
                                                    </div >
                                                </div >
                                                <div>
                                                    <label className="label-tech-sm">VEÍCULO</label>
                                                    <select className="input-internal" value={item.tipoVeiculo} onChange={e => updateList(lista, setLista, realIndex, 'tipoVeiculo', e.target.value)} disabled={!podeEditarNaUnidade('operacao')}>
                                                        {OPCOES_VEICULO.map(v => <option key={v} style={{ color: 'black' }}>{v}</option>)}
                                                    </select>
                                                </div>
                                            </div >

                                            {/* Linha de Placa — visível e editável para Aux. Operacional e Cadastro */}
                                            {(() => {
                                                const podEditarPlaca = ['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Desenvolvedor'].includes(user.cargo);
                                                const placaExibida = item.placa1Motorista || item.placa || '—';
                                                const placa2Exibida = item.placa2Motorista || '';
                                                if (editandoPlaca === item.id) {
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '6px 10px' }}>
                                                            <Truck size={12} color="#fbbf24" />
                                                            <input
                                                                autoFocus
                                                                defaultValue={item.placa1Motorista || item.placa || ''}
                                                                placeholder="Placa 1"
                                                                maxLength={8}
                                                                onBlur={e => {
                                                                    const val = e.target.value.toUpperCase().trim();
                                                                    updateList(lista, setLista, realIndex, 'placa1Motorista', val);
                                                                    checarPlacaProvisaoCard(val, item);
                                                                }}
                                                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '5px', color: '#fbbf24', fontWeight: 'bold', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '90px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                                            />
                                                            <span style={{ color: '#64748b', fontSize: '11px' }}>/</span>
                                                            <input
                                                                defaultValue={item.placa2Motorista || ''}
                                                                placeholder="Placa 2"
                                                                maxLength={8}
                                                                onBlur={e => {
                                                                    const val = e.target.value.toUpperCase().trim();
                                                                    updateList(lista, setLista, realIndex, 'placa2Motorista', val);
                                                                    checarPlacaProvisaoCard(val, item);
                                                                }}
                                                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(100,116,139,0.4)', borderRadius: '5px', color: '#94a3b8', fontWeight: 'bold', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '90px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                                            />
                                                            <button onClick={() => setEditandoPlaca(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', padding: '2px', display: 'flex', alignItems: 'center' }} title="Fechar">
                                                                <CheckCircle size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '4px 8px' }}>
                                                        <Truck size={11} color="#64748b" />
                                                        <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold', fontFamily: 'monospace' }}>{placaExibida}</span>
                                                        {placa2Exibida && <><span style={{ color: '#475569', fontSize: '11px' }}>/</span><span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>{placa2Exibida}</span></>}
                                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {itemTemPlacaNoProvisionamento(item) && (
                                                                <button
                                                                    onClick={() => checarPlacaProvisaoCard(item.placa1Motorista || item.placa || '', item)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                    title="Registrar datas no Provisionamento"
                                                                >
                                                                    <CalendarPlus size={12} />
                                                                </button>
                                                            )}
                                                            {podEditarPlaca && (
                                                                <button onClick={() => setEditandoPlaca(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex', alignItems: 'center' }} title="Editar placa">
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Doca e Status */}
                                            {podeEditarNaUnidade('alterar_status_operacao') ? (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {/* Select Doca — oculto quando não há docas (ex: Painel Leão) */}
                                                    <div style={{ display: opcoesDocas.length === 0 ? 'none' : 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Anchor size={11} color="#60a5fa" />
                                                        <select
                                                            value={item[origem === 'Recife' ? 'doca_recife' : 'doca_moreno'] || 'SELECIONE'}
                                                            onChange={async (e) => {
                                                                const novaDoca = e.target.value;
                                                                try {
                                                                    await api.post('/api/conferente/atualizar-status', {
                                                                        veiculoId: item.id,
                                                                        novoStatus: valorStatusAtual,
                                                                        novaDoca
                                                                    });
                                                                    updateList(lista, setLista, realIndex, origem === 'Recife' ? 'doca_recife' : 'doca_moreno', novaDoca);
                                                                    mostrarNotificacao?.(`✅ Doca alterada para ${novaDoca}`);
                                                                } catch (err) {
                                                                    const msg = err.response?.data?.message || 'Erro ao atualizar doca.';
                                                                    mostrarNotificacao?.(`⚠️ ${msg}`);
                                                                }
                                                            }}
                                                            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', color: '#60a5fa', fontSize: '12px', fontWeight: 'bold', padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                                                        >
                                                            {(origem === 'Recife' ? DOCAS_RECIFE_LISTA : DOCAS_MORENO_LISTA).map(d => (
                                                                <option key={d} value={d} style={{ color: 'black' }}>{d}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {/* Select Status */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Circle size={8} fill={corStatus.border} color={corStatus.border} />
                                                        <select
                                                            value={valorStatusAtual}
                                                            onChange={async (e) => {
                                                                const novoStatus = e.target.value;
                                                                try {
                                                                    await api.post('/api/conferente/atualizar-status', {
                                                                        veiculoId: item.id,
                                                                        novoStatus,
                                                                        novaDoca: item[origem === 'Recife' ? 'doca_recife' : 'doca_moreno'] || 'SELECIONE'
                                                                    });
                                                                    updateList(lista, setLista, realIndex, campoStatus, novoStatus);
                                                                    mostrarNotificacao?.(`✅ Status alterado para ${novoStatus}`);
                                                                } catch (err) {
                                                                    const msg = err.response?.data?.message || 'Erro ao atualizar status.';
                                                                    mostrarNotificacao?.(`⚠️ ${msg}`);
                                                                }
                                                            }}
                                                            style={{ background: `${corStatus.border}22`, border: `1px solid ${corStatus.border}66`, borderRadius: '6px', color: corStatus.text, fontSize: '12px', fontWeight: 'bold', padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                                                        >
                                                            {(() => {
                                                                const eInterestadual = item.operacao === 'LEÃO - SP' || item.operacao === 'ELETRIK SUL';
                                                                const opcoes = eInterestadual
                                                                    ? ['LIBERADO P/ CARREGAMENTO', 'EM CARREGAMENTO', 'CARREGADO']
                                                                    : OPCOES_STATUS.filter(s => s !== 'LIBERADO P/ CT-e');
                                                                return opcoes.map(s => (
                                                                    <option key={s} value={s} style={{ color: 'black' }}>{s}</option>
                                                                ));
                                                            })()}
                                                        </select>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {/* Badge da Doca (read-only) */}
                                                    {(() => {
                                                        const docaAtual = item[origem === 'Recife' ? 'doca_recife' : 'doca_moreno'];
                                                        if (!docaAtual || docaAtual === 'SELECIONE') return null;
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px' }}>
                                                                <Anchor size={11} color="#60a5fa" />
                                                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>{docaAtual}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {/* Badge de Status (read-only) */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: `${corStatus.border}22`, border: `1px solid ${corStatus.border}66`, borderRadius: '6px' }}>
                                                        <Circle size={8} fill={corStatus.border} color={corStatus.border} />
                                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: corStatus.text }}>{valorStatusAtual}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Toggle Entrega Local */}
                                            {podeEditarNaUnidade('operacao') && !ehOperacaoInterestadual(item.operacao) && (
                                                <div
                                                    onClick={() => {
                                                        const novaLista = [...lista];
                                                        novaLista[realIndex] = { ...novaLista[realIndex], entregaLocal: !item.entregaLocal };
                                                        setLista(novaLista);
                                                        const payload = { ...novaLista[realIndex] };
                                                        delete payload.imagens;
                                                        delete payload.dados_json;
                                                        api.put(`/veiculos/${item.id}`, payload).catch(() => {});
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                                                        background: item.entregaLocal ? 'rgba(16,185,129,0.12)' : 'rgba(30,41,59,0.5)',
                                                        border: `1px solid ${item.entregaLocal ? 'rgba(16,185,129,0.4)' : 'rgba(71,85,105,0.3)'}`,
                                                        userSelect: 'none'
                                                    }}
                                                >
                                                    <input type="checkbox" checked={!!item.entregaLocal} onChange={() => {}} style={{ accentColor: '#10b981', width: '13px', height: '13px', cursor: 'pointer' }} />
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: item.entregaLocal ? '#10b981' : '#64748b', letterSpacing: '0.04em' }}>ENTREGA LOCAL</span>
                                                    <span style={{ fontSize: '10px', color: '#475569' }}>(sem lacre)</span>
                                                </div>
                                            )}

                                            {/* Campo de Observação */}
                                            < div >
                                                <label className="label-tech-sm"><FileText size={10} style={{ display: 'inline', marginRight: '2px' }} /> OBSERVAÇÃO</label>
                                                <textarea
                                                    className="input-internal"
                                                    value={item.observacao || ''}
                                                    onChange={e => updateList(lista, setLista, realIndex, 'observacao', e.target.value)}
                                                    placeholder="Anotações..."
                                                    rows={2}
                                                    disabled={!podeEditarNaUnidade('operacao')}
                                                    style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '11px' }}
                                                />
                                            </div >

                                            {/* Checklist Liberação — Read Only */}
                                            {
                                                !item.isFrotaMotorista && !itemTemPlacaNoProvisionamento(item) && (() => {
                                                    const situacao = item.situacao_cadastro || 'NÃO CONFERIDO';
                                                    const cor = situacao === 'LIBERADO' ? '#4ade80'
                                                        : situacao === 'PENDENTE' ? '#fbbf24'
                                                            : '#f87171';
                                                    return (
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            padding: '6px 10px', background: 'rgba(0,0,0,0.2)',
                                                            borderRadius: '6px', flexWrap: 'wrap',
                                                            border: `1px solid ${cor}33`
                                                        }}>
                                                            <ShieldCheck size={12} color={cor} />
                                                            {[['chk_cnh', 'CNH'], ['chk_antt', 'ANTT'], ['chk_tacografo', 'TAC'], ['chk_crlv', 'CRLV']].map(([c, l]) => (
                                                                <span key={c} style={{
                                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                                    fontSize: '10px', fontWeight: 'bold',
                                                                    color: item[c] ? '#4ade80' : '#f87171'
                                                                }}>
                                                                    {item[c] ? <CheckCircle size={11} /> : <X size={11} />} {l}
                                                                </span>
                                                            ))}
                                                            <span style={{
                                                                marginLeft: 'auto', fontSize: '10px', fontWeight: 'bold',
                                                                color: cor, padding: '2px 6px',
                                                                background: `${cor}22`, borderRadius: '4px'
                                                            }}>
                                                                {situacao}
                                                            </span>
                                                            {item.numero_liberacao && (
                                                                <span style={{ width: '100%', fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                                                                    Lib: <strong style={{ color: '#e2e8f0' }}>{item.numero_liberacao}</strong>
                                                                    {item.gerenciadora_risco && <span style={{ color: '#60a5fa', marginLeft: '6px' }}>{item.gerenciadora_risco}</span>}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            }

                                            {/* Botão Liberar Checklist — some quando CARREGADO (Coordenador/Planejamento) */}
                                            {valorStatusAtual !== 'CARREGADO' && ['Coordenador', 'Planejamento', 'Desenvolvedor'].includes(user.cargo) && !item.isFrotaMotorista && !itemTemPlacaNoProvisionamento(item) && !ehOperacaoInterestadual(item.operacao) && (
                                                <button
                                                    onClick={() => setConfirmarLiberarChecklist({ item })}
                                                    style={{
                                                        padding: '5px 10px', fontSize: '10px', fontWeight: 700,
                                                        background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
                                                        color: '#c084fc', borderRadius: '6px', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '5px'
                                                    }}
                                                >
                                                    🔓 LIBERAR CHECKLIST
                                                </button>
                                            )}

                                            {/* Campo de Imagens */}
                                            <div>
                                                <label className="label-tech-sm"><Image size={10} style={{ display: 'inline', marginRight: '2px' }} /> IMAGENS</label>
                                                {podeEditarNaUnidade('operacao') && (
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="input-internal"
                                                        onChange={(e) => {
                                                            const files = Array.from(e.target.files);
                                                            files.forEach(file => {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    updateList(lista, setLista, realIndex, 'imagens', [...(item.imagens || []), reader.result]);
                                                                };
                                                                reader.readAsDataURL(file);
                                                            });
                                                            e.target.value = '';
                                                        }}
                                                        style={{ padding: '6px', cursor: 'pointer', fontSize: '10px' }}
                                                    />
                                                )}

                                                {/* Preview das Imagens */}
                                                {Array.isArray(item.imagens) && item.imagens.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                                        {item.imagens.map((img, idx) => (
                                                            <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                                                                <img
                                                                    src={img}
                                                                    alt={`${idx + 1}`}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover',
                                                                        borderRadius: '4px',
                                                                        border: '2px solid rgba(59, 130, 246, 0.3)',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    onClick={() => setImagemAmpliada(img)}
                                                                />
                                                                {podeEditarNaUnidade('operacao') && (
                                                                    <button
                                                                        onClick={() => updateList(lista, setLista, realIndex, 'imagens', item.imagens.filter((_, i) => i !== idx))}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '-5px',
                                                                            right: '-5px',
                                                                            background: '#ef4444',
                                                                            border: 'none',
                                                                            borderRadius: '50%',
                                                                            width: '18px',
                                                                            height: '18px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            color: 'white',
                                                                            padding: 0
                                                                        }}
                                                                    >
                                                                        <X size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div >

                                        {/* Footer / Timers e Ações */}
                                        < div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>

                                            {/* SLA Timeline */}
                                            <div style={{ marginBottom: '8px' }}>
                                                <SLATimeline item={item} unidade={origem === 'Recife' ? 'recife' : 'moreno'} pausas={(() => { try { return JSON.parse(item.pausas_status || '[]'); } catch { return []; } })()} />
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                                {/* Bloco Timers */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            setVeiculoSelecionado({ item, realIndex, lista, setLista, origem });
                                                            setModalColetasAberto(true);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                                            color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f1f5f9'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                                                    >
                                                        <Package size={14} className="text-slate-500" /> COLETAS
                                                    </button>

                                                    {item.timestamps_status?.tempo_carregado_ate_cte > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', color: '#4ade80', marginTop: '6px' }}>
                                                            <Clock size={12} />
                                                            <span>{item.timestamps_status.tempo_carregado_ate_cte} min</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Botões de Ação */}
                                                <div style={{ display: 'flex', gap: '8px', marginLeft: '10px', alignItems: 'center' }}>
                                                    {/* Botão PDF Cubagem — só para PORCELANA */}
                                                    {item.operacao?.includes('PORCELANA') && item.coletaMoreno && (
                                                        <button
                                                            disabled={!!loadingPdf[item.id]}
                                                            onClick={async () => {
                                                                const { porcelana } = parseColetaMoreno(item.coletaMoreno, item.operacao);
                                                                const coleta = (porcelana || '').split(',')[0].trim();
                                                                if (!coleta) return;
                                                                setLoadingPdf(p => ({ ...p, [item.id]: true }));
                                                                try {
                                                                    const res = await api.get(`/cubagens/coleta/${coleta}`);
                                                                    if (res.data?.success && res.data.cubagem) {
                                                                        const cub = res.data.cubagem;
                                                                        if (!cub.motorista || !String(cub.motorista).trim()) cub.motorista = item.motorista || '';
                                                                        gerarPdfCubagem(cub);
                                                                    }
                                                                } finally {
                                                                    setLoadingPdf(p => ({ ...p, [item.id]: false }));
                                                                }
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                padding: '5px 10px', borderRadius: '6px',
                                                                background: 'rgba(168,85,247,0.15)',
                                                                border: '1px solid rgba(168,85,247,0.4)',
                                                                color: '#c084fc', fontSize: '11px', fontWeight: '600',
                                                                cursor: loadingPdf[item.id] ? 'not-allowed' : 'pointer',
                                                                opacity: loadingPdf[item.id] ? 0.6 : 1,
                                                            }}
                                                            title="Baixar PDF da cubagem"
                                                        >
                                                            <Download size={13} />
                                                            {loadingPdf[item.id] ? '...' : 'PDF'}
                                                        </button>
                                                    )}
                                                    {isMista && souPrimeira && user.cidade === origem && (
                                                        <button onClick={() => socket.emit('enviar_alerta', { tipo: 'aviso', origem: origem, mensagem: `Veículo ${item.motorista} saindo!` })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', border: 'none', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Avisar Saída">
                                                            <Truck size={16} />
                                                        </button>
                                                    )}

                                                    {/* Botão Link Motorista — só Leão SP / Eletrik Sul, status pré-CARREGADO */}
                                                    {(item.operacao === 'LEÃO - SP' || item.operacao === 'ELETRIK SUL') &&
                                                     valorStatusAtual !== 'CARREGADO' && valorStatusAtual !== 'LIBERADO P/ CT-e' && item.motorista?.trim() && (
                                                        <button
                                                            onClick={async () => {
                                                                setModalLinkMotorista({ veiculoId: item.id, motorista: item.motorista, gerando: true, url: '', copiado: false });
                                                                try {
                                                                    const r = await api.post('/api/operacao-motorista/gerar', { veiculo_id: item.id });
                                                                    if (r.data?.success) {
                                                                        setModalLinkMotorista(prev => ({ ...prev, gerando: false, url: r.data.url }));
                                                                    } else {
                                                                        setModalLinkMotorista(null);
                                                                        mostrarNotificacao?.(`⚠️ ${r.data?.message || 'Erro ao gerar link.'}`);
                                                                    }
                                                                } catch (e) {
                                                                    setModalLinkMotorista(null);
                                                                    mostrarNotificacao?.(`⚠️ ${e.response?.data?.message || 'Erro ao gerar link.'}`);
                                                                }
                                                            }}
                                                            title="Gerar link para o motorista atualizar status"
                                                            style={{
                                                                padding: '6px 10px', borderRadius: '8px',
                                                                background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
                                                                border: 'none', color: 'white',
                                                                fontSize: '11px', fontWeight: '700',
                                                                cursor: 'pointer', letterSpacing: '0.4px',
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                        >
                                                            <Smartphone size={13} /> LINK MOTORISTA
                                                        </button>
                                                    )}

                                                    {/* Botão Liberado p/ CTE */}
                                                    {(valorStatusAtual === 'CARREGADO' || valorStatusAtual === 'EM CARREGAMENTO') && !(origem === 'Recife' ? item.cte_antecipado_recife : origem === 'Moreno' ? item.cte_antecipado_moreno : item.cte_antecipado_interestadual) && (
                                                        <button
                                                            onClick={() => item.motorista?.trim() && setConfirmarLiberadoCte({ realIndex, campoStatusAlvo, origem, operacao: item.operacao })}
                                                            style={{
                                                                padding: '6px 14px', borderRadius: '8px',
                                                                background: item.motorista?.trim()
                                                                    ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                                                                    : 'rgba(100,116,139,0.3)',
                                                                border: item.motorista?.trim() ? 'none' : '1px solid rgba(100,116,139,0.4)',
                                                                color: item.motorista?.trim() ? 'white' : '#64748b',
                                                                fontSize: '11px', fontWeight: '700',
                                                                cursor: item.motorista?.trim() ? 'pointer' : 'not-allowed',
                                                                letterSpacing: '0.5px',
                                                                boxShadow: item.motorista?.trim() ? '0 2px 10px rgba(168,85,247,0.4)' : 'none',
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                            title={item.motorista?.trim() ? 'Liberar para emissão do CT-e' : 'Adicione o motorista antes de liberar o CT-e'}
                                                        >
                                                            <CheckCircle size={13} /> LIBERADO P/ CT-e
                                                        </button>
                                                    )}
                                                    {/* Feedback: CT-e já liberado */}
                                                    {(valorStatusAtual === 'CARREGADO' || valorStatusAtual === 'EM CARREGAMENTO') && !!(origem === 'Recife' ? item.cte_antecipado_recife : origem === 'Moreno' ? item.cte_antecipado_moreno : item.cte_antecipado_interestadual) && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ color: '#a855f7', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <CheckCircle size={12} /> CT-e liberado
                                                            </span>
                                                            {podeEditar && (
                                                                <button
                                                                    onClick={() => { setReenviarCte({ item, origem }); setOperadorReenvio(null); }}
                                                                    title="Reenviar notificação de CT-e"
                                                                    style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '5px', color: '#a855f7', fontSize: '10px', padding: '2px 6px', cursor: 'pointer', fontWeight: 600 }}
                                                                >
                                                                    Reenviar
                                                                </button>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div >
                                    </div >
                                );
                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div >
            </div >

            <PainelModais
                modalChecklistAberto={modalChecklistAberto} setModalChecklistAberto={setModalChecklistAberto}
                modalColetasAberto={modalColetasAberto} setModalColetasAberto={setModalColetasAberto}
                veiculoSelecionado={veiculoSelecionado} setVeiculoSelecionado={setVeiculoSelecionado}
                imagemAmpliada={imagemAmpliada} setImagemAmpliada={setImagemAmpliada}
                modalEntregasCard={modalEntregasCard} setModalEntregasCard={setModalEntregasCard}
                modalFrota={modalFrota} setModalFrota={setModalFrota}
                frotaOrigem={frotaOrigem} setFrotaOrigem={setFrotaOrigem}
                frotaDestino={frotaDestino} setFrotaDestino={setFrotaDestino}
                modalLacre={modalLacre} setModalLacre={setModalLacre}
                modalLinkMotorista={modalLinkMotorista} setModalLinkMotorista={setModalLinkMotorista}
                modalPausaAberto={modalPausaAberto} setModalPausaAberto={setModalPausaAberto}
                inputColetaModal={inputColetaModal} setInputColetaModal={setInputColetaModal}
                inputColetaValor={inputColetaValor} setInputColetaValor={setInputColetaValor}
                confirmarLiberadoCte={confirmarLiberadoCte} setConfirmarLiberadoCte={setConfirmarLiberadoCte}
                confirmarReprogramar={confirmarReprogramar} setConfirmarReprogramar={setConfirmarReprogramar}
                confirmarMisto={confirmarMisto} setConfirmarMisto={setConfirmarMisto}
                confirmarLiberarChecklist={confirmarLiberarChecklist} setConfirmarLiberarChecklist={setConfirmarLiberarChecklist}
                confirmarCopiaColeta={confirmarCopiaColeta} setConfirmarCopiaColeta={setConfirmarCopiaColeta}
                confirmarFinalizar={confirmarFinalizar} setConfirmarFinalizar={setConfirmarFinalizar}
                proximaDataFinalizar={proximaDataFinalizar} setProximaDataFinalizar={setProximaDataFinalizar}
                modalEscolhaDia={modalEscolhaDia} setModalEscolhaDia={setModalEscolhaDia}
                finalizando={finalizando} setFinalizando={setFinalizando}
                operadoresConhecimento={operadoresConhecimento}
                operadorSelecionado={operadorSelecionado} setOperadorSelecionado={setOperadorSelecionado}
                reenviarCte={reenviarCte} setReenviarCte={setReenviarCte}
                operadorReenvio={operadorReenvio} setOperadorReenvio={setOperadorReenvio}
                lista={lista} setLista={setLista}
                itensFiltrados={itensFiltrados}
                origem={origem}
                salvarMotoristaNoCard={salvarMotoristaNoCard}
                adicionarToast={adicionarToast}
                mostrarNotificacao={mostrarNotificacao}
                funcoes={funcoes}
                podeEditarNaUnidade={podeEditarNaUnidade}
                updateList={updateList}
            />


        </div >
    );
}