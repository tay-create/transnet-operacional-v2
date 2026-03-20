import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import TagInput from './TagInput';
import {
    Package, Anchor, X, Search, Box, Calendar, ArrowRight,
    MapPin, Circle, Trash2, AlertTriangle, Image, Edit2, Bell, Lock, ShieldCheck,
    CheckCircle, Clock, FileText, Warehouse, Truck
} from 'lucide-react';
import ModalChecklistCarreta from './ModalChecklistCarreta';
import ModalConfirm from './ModalConfirm';
import ModalImagem from './ModalImagem';
import ModalColetas from './ModalColetas';
import SLATimeline from './SLATimeline';
import { OPCOES_OPERACAO, OPCOES_VEICULO, CORES_STATUS, OPCOES_STATUS, DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA } from '../constants';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import { obterDataBrasilia } from '../utils/helpers';



const ehOperacaoRecife = (op) => op && op.includes('RECIFE');
const ehOperacaoMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));


// Ao mudar a operacao, limpar campos de unidades removidas e aplicar regras de parada
const handleOperacaoChange = async (item, novaOperacao, funcoes, lista, setLista, realIndex, api) => {
    const { updateList, mostrarNotificacao } = funcoes;
    const precisaRecife = ehOperacaoRecife(novaOperacao);
    const precisaMoreno = ehOperacaoMoreno(novaOperacao);

    // Backup para reverter em caso de erro
    const itemOriginal = { ...lista[realIndex] };

    // Construir objeto com todas as mudancas de uma vez
    const novaLista = [...lista];
    const itemAtualizado = { ...novaLista[realIndex], operacao: novaOperacao };

    if (!precisaRecife) {
        itemAtualizado.coletaRecife = '';
        itemAtualizado.rotaRecife = '';
        itemAtualizado.status_recife = 'AGUARDANDO';
        itemAtualizado.doca_recife = 'SELECIONE';
    }
    if (!precisaMoreno) {
        itemAtualizado.coletaMoreno = '';
        itemAtualizado.rotaMoreno = '';
        itemAtualizado.status_moreno = 'AGUARDANDO';
        itemAtualizado.doca_moreno = 'SELECIONE';
    }

    // Regra automatica de 1a e 2a parada
    const origemCriacao = item.origem_criacao || '';
    const criouEmMoreno = origemCriacao === 'Moreno' || origemCriacao === 'Porcelana' || origemCriacao === 'Eletrik' || origemCriacao === 'Delta Moreno';
    const criouEmRecife = origemCriacao === 'Recife';

    if (precisaRecife && precisaMoreno) {
        // Operacao mista: definir paradas baseado na origem de criacao
        if (criouEmMoreno) {
            itemAtualizado.primeira_parada = 'Moreno';
            itemAtualizado.segunda_parada = 'Recife';
        } else if (criouEmRecife) {
            itemAtualizado.primeira_parada = 'Recife';
            itemAtualizado.segunda_parada = 'Moreno';
        }
    } else {
        // Operacao de unidade unica: limpar paradas
        itemAtualizado.primeira_parada = '';
        itemAtualizado.segunda_parada = '';
    }

    novaLista[realIndex] = itemAtualizado;
    setLista(novaLista);

    // Persistir no backend em uma unica chamada
    if (itemAtualizado.id && api) {
        try {
            await api.put(`/veiculos/${itemAtualizado.id}`, itemAtualizado);
            mostrarNotificacao?.(`✅ Operação alterada: ${novaOperacao}`);
        } catch (err) {
            console.error("Erro ao salvar mudanca de operacao:", err);
            const msg = err.response?.data?.message || "Erro ao salvar mudança de operação.";
            mostrarNotificacao?.(`⚠️ ${msg}`);
            
            // Reverte o estado local em caso de erro
            setLista(prev => {
                const revertida = [...prev];
                revertida[realIndex] = itemOriginal;
                return revertida;
            });
        }
    }
};

export default function PainelOperacional({
    origem, lista, setLista, opcoesDocas,
    termoBusca, setTermoBusca, user,
    funcoes
}) {
    const { podeEditar, updateList, liberarParaCte, socket, removerVeiculo, mostrarNotificacao } = funcoes;
    // Verifica se o usuário pode editar baseado na unidade
    const podeEditarNaUnidade = (permissao) => {
        if (user.cargo === 'Coordenador' || user.cargo === 'Planejamento') {
            return podeEditar(permissao);
        }
        if (user.cidade !== origem) {
            return false;
        }
        return podeEditar(permissao);
    };

    const [dataInicio, setDataInicio] = useState(() => {
        const salvo = localStorage.getItem('filtro_data_inicio_' + origem);
        const hoje = obterDataBrasilia();
        return (salvo && salvo >= hoje) ? salvo : hoje;
    });
    const [dataFim, setDataFim] = useState(() => {
        const salvo = localStorage.getItem('filtro_data_fim_' + origem);
        const hoje = obterDataBrasilia();
        return (salvo && salvo >= hoje) ? salvo : hoje;
    });
    const [filtroOperacao, setFiltroOperacao] = useState('');
    const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
    const [editandoMotorista, setEditandoMotorista] = useState(null); // id do card
    const [buscaMotoristaCard, setBuscaMotoristaCard] = useState({ id: null, texto: '' }); // texto digitado no input do card
    const [editandoPlaca, setEditandoPlaca] = useState(null); // id do card em edição de placa
    const [toasts, setToasts] = useState([]);
    const [modalColetasAberto, setModalColetasAberto] = useState(false);
    const [modalChecklistAberto, setModalChecklistAberto] = useState(false);
    const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
    const [docasInterditadas, setDocasInterditadas] = useState([]);
    const [modalPausaAberto, setModalPausaAberto] = useState(false);
    const [confirmarLiberadoCte, setConfirmarLiberadoCte] = useState(null);
    const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
    const [confirmarMisto, setConfirmarMisto] = useState(null); // { conflitos: N, detalhes: [] }
    const [finalizando, setFinalizando] = useState(false);
    const qtdMotoristasPrev = useRef(null);

    useEffect(() => {
        api.get('/api/docas-interditadas').then(r => {
            if (r.data && r.data.success) {
                setDocasInterditadas(r.data.docas);
            }
        }).catch(() => { });

        if (socket) {
            const handleDocas = (dados) => setDocasInterditadas(dados);
            socket.on('docas_interditadas_update', handleDocas);
            return () => socket.off('docas_interditadas_update', handleDocas);
        }
    }, [socket]);

    const addCardFulgaz = () => {
        api.post('/api/docas-interditadas', { unidade: origem }).catch(() => { });
    };
    const removerCardFulgaz = (id) => {
        api.delete(`/api/docas-interditadas/${id}`).catch(() => { });
    };
    const alterarDocaFulgaz = (id, doca) => {
        api.put(`/api/docas-interditadas/${id}`, { doca }).catch(() => { });
    };


    const adicionarToast = useCallback((msg, tipo = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }, []);

    // Carregar motoristas disponíveis e manter atualizado via socket
    useEffect(() => {
        const buscarMotoristas = () => {
            if (!useAuthStore.getState().isAuthenticated) return;
            api.get('/api/marcacoes/disponiveis')
                .then(r => {
                    if (!r.data.success) return;
                    const lista = r.data.motoristas;
                    setMotoristasDisponiveis(lista);
                    // Notificar se chegou novo motorista
                    if (qtdMotoristasPrev.current !== null && lista.length > qtdMotoristasPrev.current) {
                        const novos = lista.slice(0, lista.length - qtdMotoristasPrev.current);
                        novos.forEach(m => {
                            adicionarToast(`${m.nome_motorista} — ${m.disponibilidade || 'Disponível'} `);
                        });
                    }
                    qtdMotoristasPrev.current = lista.length;
                })
                .catch(() => { });
        };
        buscarMotoristas();
        if (socket) {
            socket.on('marcacao_atualizada', buscarMotoristas);
            return () => socket.off('marcacao_atualizada', buscarMotoristas);
        }
    }, [adicionarToast, socket]);



    function selecionarMotoristaNaEdicao(item, realIndex, m) {
        // Backup para reverter em caso de erro
        const itemOriginal = { ...lista[realIndex] };

        // Herda campos extras sem destruir o objeto
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[realIndex] };
        itemAtual.motorista = m.nome_motorista;
        itemAtual.telefoneMotorista = m.telefone || itemAtual.telefoneMotorista;

        // Se o motorista tem placa, sobrescreve. Se não tem, mantém a que já estava no card.
        itemAtual.placa1Motorista = m.placa1 || itemAtual.placa1Motorista || itemAtual.placa || '';
        itemAtual.placa2Motorista = m.placa2 || itemAtual.placa2Motorista || '';

        itemAtual.tipoVeiculo = m.tipo_veiculo?.toUpperCase().includes('TRUCK') ? 'TRUCK'
            : m.tipo_veiculo?.toUpperCase().includes('CARRETA') ? 'CARRETA' : itemAtual.tipoVeiculo;
        itemAtual.disponibilidadeMotorista = m.disponibilidade || '';
        itemAtual.isFrotaMotorista = m.is_frota ? true : false;
        itemAtual.origemMotorista = m.origem_cidade_uf || '';
        itemAtual.destinoMotorista = m.destino_desejado || '';
        novaLista[realIndex] = itemAtual;
        setLista(novaLista);

        if (itemAtual.id) {
            const payload = { ...itemAtual };
            delete payload.imagens;
            
            api.put(`/veiculos/${itemAtual.id}`, payload).then(() => {
                mostrarNotificacao?.(`🚛 Motorista vinculado: ${itemAtual.motorista}`);
            }).catch((err) => {
                console.error("Erro ao vincular motorista:", err);
                const msg = err.response?.data?.message || "Erro ao salvar motorista.";
                mostrarNotificacao?.(`⚠️ ${msg}`);
                
                // Reverte o estado local em caso de erro
                setLista(prev => {
                    const revertida = [...prev];
                    revertida[realIndex] = itemOriginal;
                    return revertida;
                });
            });
        }
        setEditandoMotorista(null);
        setBuscaMotoristaCard({ id: null, texto: '' });
    }

    function salvarMotoristaManual(item, realIndex, nome) {
        if (!nome.trim()) { setEditandoMotorista(null); setBuscaMotoristaCard({ id: null, texto: '' }); return; }
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[realIndex], motorista: nome.trim() };
        novaLista[realIndex] = itemAtual;
        setLista(novaLista);
        if (itemAtual.id) {
            const payload = { ...itemAtual };
            delete payload.imagens;

            api.put(`/veiculos/${itemAtual.id}`, payload).then(() => {
                mostrarNotificacao?.(`🚛 Motorista atualizado: ${itemAtual.motorista}`);
            }).catch(() => { mostrarNotificacao?.('⚠️ Erro ao salvar motorista.'); });
        }
        setEditandoMotorista(null);
        setBuscaMotoristaCard({ id: null, texto: '' });
    }

    // Atualiza o filtro de data automaticamente na virada da meia-noite (horário de Brasília)
    useEffect(() => {
        const calcularMsAteMeiaNoite = () => {
            const agora = new Date();
            const agoraBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const meiaNoiteBrasilia = new Date(agoraBrasilia);
            meiaNoiteBrasilia.setHours(24, 0, 0, 0);
            return meiaNoiteBrasilia - agoraBrasilia;
        };

        let timeout;
        const agendarVirada = () => {
            const msRestantes = calcularMsAteMeiaNoite();
            timeout = setTimeout(() => {
                const novaData = obterDataBrasilia();
                console.log(`[PainelOperacional] Virada de meia-noite detectada. Atualizando filtros para: ${novaData}`);
                
                setDataInicio(novaData);
                setDataFim(novaData);
                
                // Persistir no localStorage para evitar dessincronização em refresh
                localStorage.setItem('filtro_data_inicio_' + origem, novaData);
                localStorage.setItem('filtro_data_fim_' + origem, novaData);
                
                agendarVirada(); // Reagendar para a próxima meia-noite
            }, msRestantes);
        };

        agendarVirada();
        return () => clearTimeout(timeout);
    }, []);
    const [imagemAmpliada, setImagemAmpliada] = useState(null);


    // --- LÓGICA DE FILTROS ---
    const itensFiltrados = useMemo(() => lista.filter(item => {
        const itemData = item.data_prevista || obterDataBrasilia();
        const ehDataCerta = itemData >= dataInicio && itemData <= dataFim;

        // Verificar se a operação do card envolve esta unidade
        const op = item.operacao || '';
        const operacaoEnvolveRecife = op.includes('RECIFE');
        const operacaoEnvolveMoreno = op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');
        const operacaoEnvolveOrigem = origem === 'Recife' ? operacaoEnvolveRecife : operacaoEnvolveMoreno;

        // Se a operação não envolve esta origem, não exibir
        if (!operacaoEnvolveOrigem) return false;

        // Omitindo "deveAparecer = souCriador || temColetaPraMim" porque se a operacaoEnvolveOrigem,
        // TODOS os usuários dessa origem PRECISAM VER o card, mesmo não sendo os criadores e mesmo com coleta vazia.
        const meuStatus = origem === 'Recife' ? (item.status_recife || 'AGUARDANDO') : (item.status_moreno || 'AGUARDANDO');

        const buscaLower = termoBusca.toLowerCase();
        const bateuBusca = (item.coleta && item.coleta.toLowerCase().includes(buscaLower)) ||
            (item.coletaRecife && item.coletaRecife.toLowerCase().includes(buscaLower)) ||
            (item.coletaMoreno && item.coletaMoreno.toLowerCase().includes(buscaLower)) ||
            (item.motorista && item.motorista.toLowerCase().includes(buscaLower)) ||
            (meuStatus && meuStatus.toLowerCase().includes(buscaLower));


        const bateuOperacao = !filtroOperacao || (item.operacao || '') === filtroOperacao;

        return ehDataCerta && bateuBusca && bateuOperacao;
    }), [lista, dataInicio, dataFim, termoBusca, filtroOperacao, origem]); // eslint-disable-line

    const ORDEM_STATUS = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e'];
    const itensOrdenados = useMemo(() => [...itensFiltrados].sort((a, b) => {
        const campo = origem === 'Recife' ? 'status_recife' : 'status_moreno';
        return ORDEM_STATUS.indexOf(a[campo] || 'AGUARDANDO') - ORDEM_STATUS.indexOf(b[campo] || 'AGUARDANDO');
    }), [itensFiltrados, origem]); // eslint-disable-line

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
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
                {toasts.map(t => {
                    const ehErro = t.tipo === 'erro';
                    return (
                        <div key={t.id} style={{
                            background: 'rgba(15,23,42,0.95)',
                            border: `1px solid ${ehErro ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)'} `,
                            borderRadius: '10px', padding: '12px 16px', color: '#f1f5f9',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxWidth: '340px',
                            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
                            animation: 'slideIn 0.3s ease'
                        }}>
                            {ehErro
                                ? <Lock size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                                : <Bell size={16} color="#4ade80" style={{ flexShrink: 0 }} />
                            }
                            <div>
                                <div style={{ fontWeight: '700', color: ehErro ? '#ef4444' : '#4ade80', fontSize: '11px', marginBottom: '2px' }}>
                                    {ehErro ? 'AÇÃO BLOQUEADA' : 'NOVO MOTORISTA DISPONÍVEL'}
                                </div>
                                {t.msg}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* === CONTEÚDO PRINCIPAL === */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>

                {/* Header da Área Principal */}
                <div className="glass-panel-internal" style={{ padding: '15px 25px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div>
                            <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                PAINEL <span style={{ color: '#3b82f6' }}>{origem.toUpperCase()}</span>
                                {podeEditarNaUnidade('operacao') && (
                                    <button
                                        onClick={addCardFulgaz}
                                        title="Interditar Doca (Container Terceiro)"
                                        className="btn-neon-red"
                                        style={{
                                            marginLeft: '12px',
                                            padding: '4px 12px',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <AlertTriangle size={14} /> CONTAINER
                                    </button>
                                )}
                                {podeEditarNaUnidade('operacao') && (() => {
                                    const veiculosAtivos = itensFiltrados.filter(v => {
                                        const s = v[origem === 'Recife' ? 'status_recife' : 'status_moreno'];
                                        return s && s !== 'AGUARDANDO' && s !== 'FINALIZADO';
                                    });
                                    const unidadeLower = origem.toLowerCase();
                                    const algumPausado = veiculosAtivos.some(v => {
                                        const pausas = JSON.parse(v.pausas_status || '[]');
                                        return pausas.some(p => p.unidade === unidadeLower && p.fim === null);
                                    });
                                    if (veiculosAtivos.length === 0) return null;
                                    return (
                                        <button
                                            onClick={() => setModalPausaAberto(true)}
                                            title={algumPausado ? 'Retomar operações pausadas' : 'Pausar todas as operações ativas'}
                                            style={{
                                                marginLeft: '8px',
                                                padding: '4px 12px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                background: algumPausado ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                                                border: `1px solid ${algumPausado ? 'rgba(34,197,94,0.4)' : 'rgba(251,191,36,0.4)'}`,
                                                color: algumPausado ? '#4ade80' : '#fbbf24',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: '700'
                                            }}
                                        >
                                            {algumPausado ? '▶ RETOMAR' : '⏸ PAUSAR'}
                                        </button>
                                    );
                                })()}
                                {origem === 'Recife' && (podeEditarNaUnidade('operacao') || user.cargo === 'Conhecimento') && (
                                    <button
                                        onClick={() => setConfirmarFinalizar(true)}
                                        title="Finalizar operação: avança cards pendentes para o próximo dia útil (ambas as unidades)"
                                        style={{
                                            marginLeft: '8px',
                                            padding: '4px 12px',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(239,68,68,0.15)',
                                            border: '1px solid rgba(239,68,68,0.4)',
                                            color: '#f87171',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '700'
                                        }}
                                    >
                                        ✕ FINALIZAR
                                    </button>
                                )}
                            </h2>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                                <span className="badge-neon-pill" style={{ display: 'inline-block' }}>
                                    {itensFiltrados.length} VEÍCULOS
                                </span>
                            </div>
                        </div>

                        {/* Filtro de Datas */}
                        <div className="date-range-container">
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>DE:</span>
                            <input type="date" className="input-date-neon" value={dataInicio} onChange={e => { setDataInicio(e.target.value); localStorage.setItem('filtro_data_inicio_' + origem, e.target.value); }} />
                            <span style={{ fontSize: '10px', color: '#64748b' }}>➜</span>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>ATÉ:</span>
                            <input type="date" className="input-date-neon" value={dataFim} onChange={e => { setDataFim(e.target.value); localStorage.setItem('filtro_data_fim_' + origem, e.target.value); }} />
                        </div>

                        {/* Filtro de Operação */}
                        <select
                            value={filtroOperacao}
                            onChange={e => setFiltroOperacao(e.target.value)}
                            style={{
                                background: filtroOperacao ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                                border: filtroOperacao ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: filtroOperacao ? '#60a5fa' : '#94a3b8',
                                fontSize: '11px', fontWeight: '600',
                                padding: '5px 26px 5px 10px',
                                minWidth: '150px', cursor: 'pointer',
                                outline: 'none', appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2394a3b8' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 8px center',
                            }}
                        >
                            <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>Todas as operações</option>
                            {OPCOES_OPERACAO.filter(op =>
                                origem === 'Recife' ? op.includes('RECIFE') : (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'))
                            ).map(op => (
                                <option key={op} value={op} style={{ background: '#1e293b', color: '#e2e8f0' }}>{op}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campo de Busca */}
                    <div style={{ position: 'relative', width: '250px' }}>
                        <input
                            value={termoBusca}
                            onChange={e => setTermoBusca(e.target.value)}
                            placeholder="Buscar..."
                            className="input-internal"
                            style={{ paddingLeft: '35px', borderRadius: '20px' }}
                        />
                        <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                </div>

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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', paddingBottom: '40px' }}>
                            {docasInterditadas.filter(c => c.unidade === origem).map(card => (
                                <div key={`fulgaz-${card.id}`} className="glass-panel-internal card-neon-hover" style={{ borderLeft: '4px solid #ef4444', borderRadius: '12px', overflow: 'hidden', background: 'rgba(239, 68, 68, 0.05)' }}>
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 'bold', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <AlertTriangle size={14} color="#ef4444" />
                                            {card.nome || 'CONTAINER (TERCEIRO)'}
                                        </div>
                                        {podeEditarNaUnidade('operacao') && (
                                            <button onClick={() => removerCardFulgaz(card.id)} title="Remover" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
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
                                            onChange={(e) => alterarDocaFulgaz(card.id, e.target.value)}
                                            disabled={!podeEditarNaUnidade('operacao')}
                                        >
                                            <option value="SELECIONE">SELECIONE</option>
                                            {opcoesDocas.filter(d => d !== 'SELECIONE').map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}

                            {itensOrdenados.map((item) => {
                                const realIndex = lista.findIndex(i => i.id === item.id);
                                const campoStatusAlvo = origem === 'Recife' ? 'status_recife' : 'status_moreno';
                                const valorStatusAtual = item[campoStatusAlvo] || 'AGUARDANDO';
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
                                                <select value={item.operacao} onChange={(e) => handleOperacaoChange(item, e.target.value, funcoes, lista, setLista, realIndex, api)} disabled={!podeEditarNaUnidade('editar_operacao_card')} style={{ background: 'transparent', color: 'white', fontWeight: 'bold', border: 'none', width: '100%', outline: 'none', fontSize: '14px' }}>
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

                                            {podeEditarNaUnidade('adiar_dia') ? (
                                                <input
                                                    type="date"
                                                    value={item.data_prevista || ''}
                                                    onChange={e => updateList(lista, setLista, realIndex, 'data_prevista', e.target.value)}
                                                    title="Reagendar data prevista"
                                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', outline: 'none', padding: '0' }}
                                                />
                                            ) : (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} /> {item.data_prevista ? item.data_prevista.split('-').reverse().slice(0, 2).join('/') : ''}
                                                </div>
                                            )}

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
                                                            value={(origem === 'Recife' ? item.rotaRecife : item.rotaMoreno) || ''}
                                                            onChange={e => updateList(lista, setLista, realIndex, origem === 'Recife' ? 'rotaRecife' : 'rotaMoreno', e.target.value)}
                                                            placeholder="..."
                                                            style={getEstiloRota(origem === 'Recife' ? item.rotaRecife : item.rotaMoreno)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* LINHA 2: CAIXA DE NOTAS - CORRIGIDO para usar campo específico */}
                                                <div>
                                                    <TagInput
                                                        value={origem === 'Recife' ? (item.coletaRecife || '') : (item.coletaMoreno || '')}
                                                        onChange={val => updateList(lista, setLista, realIndex, origem === 'Recife' ? 'coletaRecife' : 'coletaMoreno', val)}
                                                        disabled={!podeEditarNaUnidade('coleta_card')}
                                                    />
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
                                                        <TagInput value={item.coletaMoreno || ''} onChange={val => updateList(lista, setLista, realIndex, 'coletaMoreno', val)} disabled={!podeEditarNaUnidade('coleta_card')} />
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
                                                        <TagInput value={item.coletaRecife || ''} onChange={val => updateList(lista, setLista, realIndex, 'coletaRecife', val)} disabled={!podeEditarNaUnidade('coleta_card')} />
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
                                                                                onMouseDown={() => selecionarMotoristaNaEdicao(item, realIndex, m)}
                                                                                style={{
                                                                                    padding: '8px 10px', cursor: 'pointer', fontSize: '12px',
                                                                                    color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                                                }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                <strong>{m.nome_motorista}</strong>
                                                                                {m.is_frota ? ' [FROTA]' : ''} — {m.placa1}
                                                                                {m.disponibilidade ? <span style={{ color: '#94a3b8' }}> [{m.disponibilidade}]</span> : ''}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="motorista-hover-wrapper" style={{ position: 'relative' }}>
                                                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f1f5f9', cursor: 'help' }}>{item.motorista || 'A DEFINIR'}</span>
                                                                {/* Caixa de informacao do hover */}
                                                                <div className="motorista-hover-card" style={{
                                                                    display: 'none', position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px',
                                                                    width: '240px', padding: '10px 12px', background: 'rgba(15,23,42,0.97)',
                                                                    border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px',
                                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 50, fontSize: '11px', color: '#cbd5e1',
                                                                    lineHeight: '1.6'
                                                                }}>
                                                                    <div style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '4px', fontSize: '12px' }}>{item.motorista || 'Sem Nome'}</div>
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
                                                const podEditarPlaca = ['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento'].includes(user.cargo);
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
                                                                    updateList(lista, setLista, realIndex, 'placa1Motorista', e.target.value.toUpperCase().trim());
                                                                }}
                                                                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '5px', color: '#fbbf24', fontWeight: 'bold', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '90px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                                            />
                                                            <span style={{ color: '#64748b', fontSize: '11px' }}>/</span>
                                                            <input
                                                                defaultValue={item.placa2Motorista || ''}
                                                                placeholder="Placa 2"
                                                                maxLength={8}
                                                                onBlur={e => {
                                                                    updateList(lista, setLista, realIndex, 'placa2Motorista', e.target.value.toUpperCase().trim());
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
                                                        {podEditarPlaca && (
                                                            <button onClick={() => setEditandoPlaca(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} title="Editar placa">
                                                                <Edit2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Doca e Status */}
                                            {podeEditarNaUnidade('alterar_status_operacao') ? (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {/* Select Doca */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                                                                    updateList(lista, setLista, realIndex, origem === 'Recife' ? 'status_recife' : 'status_moreno', novoStatus);
                                                                    mostrarNotificacao?.(`✅ Status alterado para ${novoStatus}`);
                                                                } catch (err) {
                                                                    const msg = err.response?.data?.message || 'Erro ao atualizar status.';
                                                                    mostrarNotificacao?.(`⚠️ ${msg}`);
                                                                }
                                                            }}
                                                            style={{ background: `${corStatus.border}22`, border: `1px solid ${corStatus.border}66`, borderRadius: '6px', color: corStatus.text, fontSize: '12px', fontWeight: 'bold', padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                                                        >
                                                            {OPCOES_STATUS.filter(s => s !== 'LIBERADO P/ CT-e').map(s => (
                                                                <option key={s} value={s} style={{ color: 'black' }}>{s}</option>
                                                            ))}
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
                                                !item.isFrotaMotorista && (() => {
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
                                            {valorStatusAtual !== 'CARREGADO' && ['Coordenador', 'Planejamento'].includes(user.cargo) && !item.isFrotaMotorista && (
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`Liberar checklist do veículo ${item.motorista}? O conferente poderá refazer o checklist.`)) return;
                                                        try {
                                                            await api.delete(`/api/checklists/veiculo/${item.id}`);
                                                            mostrarNotificacao?.('✅ Checklist liberado para refazer.');
                                                        } catch {
                                                            mostrarNotificacao?.('⚠️ Erro ao liberar checklist.');
                                                        }
                                                    }}
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
                                                {item.imagens && item.imagens.length > 0 && (
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
                                                <SLATimeline item={item} unidade={origem === 'Recife' ? 'recife' : 'moreno'} />
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
                                                    {isMista && souPrimeira && user.cidade === origem && (
                                                        <button onClick={() => socket.emit('enviar_alerta', { tipo: 'aviso', origem: origem, mensagem: `Veículo ${item.motorista} saindo!` })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', border: 'none', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Avisar Saída">
                                                            <Truck size={16} />
                                                        </button>
                                                    )}

                                                    {/* Botão Liberado p/ CTE */}
                                                    {(valorStatusAtual === 'CARREGADO' || valorStatusAtual === 'EM CARREGAMENTO') && !(origem === 'Recife' ? item.cte_antecipado_recife : item.cte_antecipado_moreno) && (
                                                        <button
                                                            onClick={() => setConfirmarLiberadoCte({ realIndex, campoStatusAlvo, origem })}
                                                            style={{
                                                                padding: '6px 14px', borderRadius: '8px',
                                                                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                                                                border: 'none', color: 'white',
                                                                fontSize: '11px', fontWeight: '700',
                                                                cursor: 'pointer', letterSpacing: '0.5px',
                                                                boxShadow: '0 2px 10px rgba(168,85,247,0.4)',
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                            title="Liberar para emissão do CT-e"
                                                        >
                                                            <CheckCircle size={13} /> LIBERADO P/ CT-e
                                                        </button>
                                                    )}
                                                    {/* Feedback: CT-e já liberado */}
                                                    {(valorStatusAtual === 'CARREGADO' || valorStatusAtual === 'EM CARREGAMENTO') && !!(origem === 'Recife' ? item.cte_antecipado_recife : item.cte_antecipado_moreno) && (
                                                        <span style={{ color: '#a855f7', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle size={12} /> CT-e liberado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div >
                                    </div >
                                );
                            })}
                        </div >
                    )}
                </div >
            </div >

            {/* Modal de Visualização de Imagem Ampliada */}
            <ModalImagem imagemAmpliada={imagemAmpliada} setImagemAmpliada={setImagemAmpliada} />

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

            {/* Modal de Checklist Embutido */}
            {modalChecklistAberto && veiculoSelecionado && (
                <ModalChecklistCarreta
                    veiculo={veiculoSelecionado.item}
                    onClose={() => { setModalChecklistAberto(false); setVeiculoSelecionado(null); }}
                    onSucesso={(msg) => adicionarToast(msg, 'sucesso')}
                />
            )}

            {/* Modal de Confirmação — Liberar p/ CT-e */}
            {confirmarLiberadoCte && (
                <ModalConfirm
                    titulo="Liberar para CT-e"
                    mensagem="Confirma a liberação deste veículo para emissão do CT-e?"
                    textConfirm="Liberar"
                    textCancel="Cancelar"
                    variante="info"
                    onConfirm={() => {
                        const { realIndex: ri, origem: o } = confirmarLiberadoCte;
                        setConfirmarLiberadoCte(null);
                        liberarParaCte(lista, setLista, ri, o);
                    }}
                    onCancel={() => setConfirmarLiberadoCte(null)}
                />
            )}

            {/* Modal de Confirmação — Finalizar Operação (ambas unidades) */}
            {confirmarFinalizar && (
                <ModalConfirm
                    titulo="Finalizar Operação — Recife + Moreno"
                    mensagem="Isso vai avançar todos os veículos pendentes (Aguardando até Em Carregamento) de AMBAS as unidades para o próximo dia útil. Deseja continuar?"
                    textConfirm={finalizando ? 'Aguarde...' : 'Finalizar'}
                    textCancel="Cancelar"
                    variante="perigo"
                    onConfirm={async () => {
                        if (finalizando) return;
                        setFinalizando(true);
                        try {
                            // Finaliza Recife
                            const r1 = await api.post('/veiculos/finalizar-operacao', { unidade: 'Recife', confirmarMisto: true });
                            // Finaliza Moreno
                            const r2 = await api.post('/veiculos/finalizar-operacao', { unidade: 'Moreno', confirmarMisto: true });
                            const totalRec = r1.data.veiculosAvancados || 0;
                            const totalMor = r2.data.veiculosAvancados || 0;
                            mostrarNotificacao?.(`✅ Finalizado! Recife: ${totalRec} veículo(s) | Moreno: ${totalMor} veículo(s)`);
                            setConfirmarFinalizar(false);
                        } catch (err) {
                            const msg = err.response?.data?.message || 'Erro ao finalizar operação.';
                            mostrarNotificacao?.(`⚠️ ${msg}`);
                        } finally {
                            setFinalizando(false);
                        }
                    }}
                    onCancel={() => { if (!finalizando) setConfirmarFinalizar(false); }}
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

        </div >
    );
}

function ModalPausarUnidade({ origem, lista, onClose, onSucesso }) {
    const unidade = origem.toLowerCase();
    const [motivo, setMotivo] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const veiculosAtivos = lista.filter(v => {
        const s = v[origem === 'Recife' ? 'status_recife' : 'status_moreno'];
        return s && s !== 'AGUARDANDO' && s !== 'FINALIZADO';
    });
    const algumPausado = veiculosAtivos.some(v => {
        const pausas = JSON.parse(v.pausas_status || '[]');
        return pausas.some(p => p.unidade === unidade && p.fim === null);
    });

    const handleConfirmar = async () => {
        if (!algumPausado && !motivo.trim()) return;
        setSalvando(true);
        setErro('');
        try {
            const endpoint = algumPausado ? 'retomar' : 'pausar';
            const body = algumPausado ? { unidade } : { motivo, unidade };
            const veiculosAlvo = algumPausado
                ? veiculosAtivos.filter(v => {
                    const pausas = JSON.parse(v.pausas_status || '[]');
                    return pausas.some(p => p.unidade === unidade && p.fim === null);
                })
                : veiculosAtivos.filter(v => {
                    const pausas = JSON.parse(v.pausas_status || '[]');
                    return !pausas.some(p => p.unidade === unidade && p.fim === null);
                });

            await Promise.all(veiculosAlvo.map(v =>
                api.post(`/api/veiculos/${v.id}/${endpoint}`, body)
            ));
            onSucesso(algumPausado ? `${veiculosAlvo.length} veículo(s) retomado(s)` : `${veiculosAlvo.length} veículo(s) pausado(s)`);
        } catch (e) {
            setErro(e?.response?.data?.message || 'Erro ao processar.');
        } finally {
            setSalvando(false);
        }
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
                        ? `Irá retomar ${veiculosAtivos.filter(v => { const p = JSON.parse(v.pausas_status || '[]'); return p.some(x => x.unidade === unidade && x.fim === null); }).length} veículo(s) pausado(s).`
                        : `Irá pausar ${veiculosAtivos.filter(v => { const p = JSON.parse(v.pausas_status || '[]'); return !p.some(x => x.unidade === unidade && x.fim === null); }).length} veículo(s) ativo(s).`
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