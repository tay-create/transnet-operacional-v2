import React, { useState, useEffect, useMemo } from 'react';
import { useApiCall } from '../hooks/useApiCall';
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
import { opPrecisaSplit } from '../utils/coletaMoreno';
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
import CardVeiculo from './painel/CardVeiculo';


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
                                return (
                                    <CardVeiculo
                                        key={item.id}
                                        item={item}
                                        realIndex={realIndex}
                                        origem={origem}
                                        operacoesFixas={operacoesFixas}
                                        campoStatus={campoStatus}
                                        lista={lista} setLista={setLista}
                                        opcoesDocas={opcoesDocas}
                                        user={user}
                                        podeEditarNaUnidade={podeEditarNaUnidade}
                                        funcoes={funcoes}
                                        motoristasDisponiveis={motoristasDisponiveis}
                                        editandoMotorista={editandoMotorista} setEditandoMotorista={setEditandoMotorista}
                                        editandoPlaca={editandoPlaca} setEditandoPlaca={setEditandoPlaca}
                                        buscaMotoristaCard={buscaMotoristaCard} setBuscaMotoristaCard={setBuscaMotoristaCard}
                                        selecionarMotoristaNaEdicao={selecionarMotoristaNaEdicao}
                                        salvarMotoristaNoCard={salvarMotoristaNoCard}
                                        salvarMotoristaManual={salvarMotoristaManual}
                                        removerMotoristaDoCard={removerMotoristaDoCard}
                                        itemTemPlacaNoProvisionamento={itemTemPlacaNoProvisionamento}
                                        checarPlacaProvisaoCard={checarPlacaProvisaoCard}
                                        loadingPdf={loadingPdf} setLoadingPdf={setLoadingPdf}
                                        setModalLacre={setModalLacre}
                                        setModalEntregasCard={setModalEntregasCard}
                                        setModalFrota={setModalFrota} setFrotaOrigem={setFrotaOrigem} setFrotaDestino={setFrotaDestino}
                                        setModalChecklistAberto={setModalChecklistAberto} setVeiculoSelecionado={setVeiculoSelecionado}
                                        setModalColetasAberto={setModalColetasAberto}
                                        setConfirmarReprogramar={setConfirmarReprogramar}
                                        setConfirmarLiberarChecklist={setConfirmarLiberarChecklist}
                                        setConfirmarLiberadoCte={setConfirmarLiberadoCte}
                                        setConfirmarMisto={setConfirmarMisto}
                                        setModalLinkMotorista={setModalLinkMotorista}
                                        setImagemAmpliada={setImagemAmpliada}
                                        setReenviarCte={setReenviarCte}
                                        setOperadorReenvio={setOperadorReenvio}
                                        handleOperacaoChange={handleOperacaoChange}
                                        reprogramarItem={reprogramarItem}
                                        setConfirmarCopiaColeta={setConfirmarCopiaColeta}
                                        setInputColetaModal={setInputColetaModal} setInputColetaValor={setInputColetaValor}
                                        mostrarNotificacao={mostrarNotificacao}
                                    />
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