import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from './services/apiService';
import logoEmpresa from './assets/logo.png';
import { calcularDiferencaHoras, converterImagemParaBase64, obterDataBrasilia } from './utils/helpers';
import {
    DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA
} from './constants';
import MainLayout from './components/layout/MainLayout';
import './App.css';
import { CheckCircle as CheckCircleIcon, Phone, LayoutGrid } from 'lucide-react';
import useAuthStore from './store/useAuthStore';
import useUIStore from './store/useUIStore';
import useConfigStore from './store/useConfigStore';
import useUserStore from './store/useUserStore';
import LoginScreen from './components/LoginScreen';
import ModalConfirm from './components/ModalConfirm';

// Lazy imports — carregam sob demanda na primeira navegação
const PainelOperacional    = React.lazy(() => import('./components/PainelOperacional'));
const PainelCte            = React.lazy(() => import('./components/PainelCte'));
const ModuloCubagem        = React.lazy(() => import('./components/ModuloCubagem'));
const NovoLancamento       = React.lazy(() => import('./components/NovoLancamento'));
const LogsAuditoria        = React.lazy(() => import('./components/LogsAuditoria'));
const DashboardTV          = React.lazy(() => import('./components/DashboardTV'));
const GestaoMarcacoes      = React.lazy(() => import('./components/GestaoMarcacoes'));
const DashboardMarcacoes   = React.lazy(() => import('./components/DashboardMarcacoes'));
const RelatorioOperacional = React.lazy(() => import('./components/RelatorioOperacional'));
const PainelCadastro       = React.lazy(() => import('./components/PainelCadastro'));
const HistoricoLiberacoes  = React.lazy(() => import('./components/HistoricoLiberacoes'));
const PainelProgramacao    = React.lazy(() => import('./components/PainelProgramacao'));
const PainelChecklist      = React.lazy(() => import('./components/PainelChecklist'));
const PainelOcorrencias    = React.lazy(() => import('./components/PainelOcorrencias'));
const PainelSaldoPaletes   = React.lazy(() => import('./components/PainelSaldoPaletes'));
const ProvisionamentoFrota = React.lazy(() => import('./components/ProvisionamentoFrota'));
const DashboardFrota       = React.lazy(() => import('./components/DashboardFrota'));
const PainelFrota          = React.lazy(() => import('./components/PainelFrota'));
const RoteirizacaoFrota    = React.lazy(() => import('./components/RoteirizacaoFrota'));
const RelatorioPerformance = React.lazy(() => import('./components/RelatorioPerformance'));
const RelatorioContratacao = React.lazy(() => import('./components/RelatorioContratacao'));
const RelatorioCte         = React.lazy(() => import('./components/RelatorioCte'));
const RelatorioCubagem     = React.lazy(() => import('./components/RelatorioCubagem'));
const PainelPosEmbarque    = React.lazy(() => import('./components/PainelPosEmbarque'));
const DashboardPosEmbarque = React.lazy(() => import('./components/DashboardPosEmbarque'));

// Modals lazy — só carregam quando abertos
const ModalRelatorio    = React.lazy(() => import('./components/Modals').then(m => ({ default: m.ModalRelatorio })));
const ModalFila         = React.lazy(() => import('./components/Modals').then(m => ({ default: m.ModalFila })));
const ModalRelatorioCte = React.lazy(() => import('./components/Modals').then(m => ({ default: m.ModalRelatorioCte })));

const hojeISO = obterDataBrasilia();

// Tabela de destinatários por tipo de notificação (fora do componente — constante estática)
const DESTINATARIOS_ALERTA = {
    'admin_cadastro':      ['Coordenador'],
    'admin_senha':         ['Coordenador'],
    'aceite_cte_pendente': ['Conhecimento', 'Planejamento'],
    'veiculo_carregado':   ['Planejamento'],
    'checklist_pendente':  [],
    'aviso':               ['Planejamento', 'Encarregado', 'Aux. Operacional'],
    'nova_ocorrencia':     ['Pos Embarque'],
    'nova_marcacao':       ['Pos Embarque'],
    'nova_marcacao_coord': [],
    'doca':                ['Cadastro', 'Conhecimento'],
    'veiculo_manutencao':  ['Manutenção', 'Coordenador', 'Adm Frota'],
};

console.log("🚀 [App] Carregando v0.3.4");

function App({ socket }) {
    // === ESTADO GLOBAL (Zustand) ===
    const { user, isAuthenticated: logado, updateUser, logout } = useAuthStore();
    const {
        abaAtiva, setAbaAtiva,
        setNotificacoes,
        adicionarNotificacao,
        removerNotificacao,
        mostrarNotificacao,
        modals, openModal, closeModal
    } = useUIStore();

    const { carregarPermissoes, permissoes, permissoesEdicao } = useConfigStore();
    useUserStore();

    // === ESTADO LOCAL RESTANTE ===
    // aviso substituído pela notificacao do store
    const [listaVeiculos, setListaVeiculos] = useState([]);
    const [ctesRecife, setCtesRecife] = useState([]);
    const [ctesMoreno, setCtesMoreno] = useState([]);
    // Estado exclusivo para o dashboard (sempre = hoje, nunca afetado pelo filtro do PainelCte)
    const [ctesRecifeHoje, setCtesRecifeHoje] = useState([]);
    const [ctesMorenoHoje, setCtesMorenoHoje] = useState([]);
    const [termoBusca, setTermoBusca] = useState('');
    const [fila, setFila] = useState([]);
    const [relatorioDados, setRelatorioDados] = useState([]);
    const [filtroOrigem, setFiltroOrigem] = useState('Todas');
    const [filtroTipoOperacao, setFiltroTipoOperacao] = useState('Todas');
    const [filtroDataInicio, setFiltroDataInicio] = useState(obterDataBrasilia());
    const [filtroDataFim, setFiltroDataFim] = useState(obterDataBrasilia());
    const [filtroDataInicioCte, setFiltroDataInicioCte] = useState(obterDataBrasilia());
    const [filtroDataFimCte, setFiltroDataFimCte] = useState(obterDataBrasilia());
    const [toastCopiaMsg, setToastCopiaMsg] = useState('');
    const [formLanca, setFormLanca] = useState({
        operacao: 'PLÁSTICO(RECIFE)',
        data_prevista: hojeISO,
        motorista: '',
        tipoVeiculo: 'TRUCK',
        coletaRecife: '',
        coletaMoreno: '',
        rotaRecife: '',
        rotaMoreno: '',
        inicio: 'Recife',
        observacao: '',
        imagens: [],
        idFilaOriginal: null
    });

    const [modalTelefone, setModalTelefone] = useState(false);
    const [telefonePrimeiroLogin, setTelefonePrimeiroLogin] = useState('');
    const [modalEmailPessoal, setModalEmailPessoal] = useState(false);
    const [emailPessoalInput, setEmailPessoalInput] = useState('');
    const [emailPessoalEnviado, setEmailPessoalEnviado] = useState(false);
    const [confirmarRemover, setConfirmarRemover] = useState(null);

    const userRef = useRef(user);
    const mostrarNotificacaoRef = useRef(mostrarNotificacao);
    const isFirstConnectRef = useRef(true);
    const recarregarDadosRef = useRef(null);
    const aceitandoCteIds = useRef(new Set());

    // === LÓGICA DE VIRADA DE DATA À MEIA-NOITE ===
    useEffect(() => {
        const agendarVirada = () => {
            const agora = new Date();
            const agoraBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const meiaNoiteBrasilia = new Date(agoraBrasilia);
            meiaNoiteBrasilia.setHours(24, 0, 0, 0);
            const msRestantes = meiaNoiteBrasilia - agoraBrasilia;

            return setTimeout(() => {
                const novaData = obterDataBrasilia();
                console.log(`[App] Virada de meia-noite detectada. Atualizando estados globais para: ${novaData}`);

                setFiltroDataInicio(novaData);
                setFiltroDataFim(novaData);
                setFiltroDataInicioCte(novaData);
                setFiltroDataFimCte(novaData);

                // Também atualiza o formulário de novo lançamento
                setFormLanca(prev => ({ ...prev, data_prevista: novaData }));

                agendarVirada();
            }, msRestantes);
        };

        const timeout = agendarVirada();
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        mostrarNotificacaoRef.current = mostrarNotificacao;
    }, [mostrarNotificacao]);

    // --- FUNÇÕES ---
    // mostrarNotificacao agora vem do useUIStore como uiMostrarNotificacao



    const handleUpdateAvatar = async (newUrl) => {
        updateUser({ avatarUrl: newUrl });

        const savedUser = JSON.parse(localStorage.getItem('usuario_logado'));
        if (savedUser) {
            savedUser.avatarUrl = newUrl;
            localStorage.setItem('usuario_logado', JSON.stringify(savedUser));
        }

        try {
            await api.put(`/usuarios/${user.id}/avatar`, { avatarUrl: newUrl });
            socket.emit('update_user_avatar', { userId: user.id, newUrl });
            mostrarNotificacao("✅ Foto de perfil salva!");
        } catch (error) {
            console.error("Erro ao salvar avatar:", error);
            mostrarNotificacao("❌ Erro ao salvar foto no servidor.");
        }
    };

    const dispararNotificacaoWindows = (msg) => {
        if (Notification.permission === 'granted') {
            try { new Notification("ALERTA LOGÍSTICA 🚚", { body: msg, icon: logoEmpresa, requireInteraction: true, silent: false }); } catch (e) { console.error(e); }
        }
    };

    const carregarNotificacoes = useCallback(async () => {
        try {
            const response = await api.get('/notificacoes');
            if (response.data.success) {
                setNotificacoes(response.data.notificacoes || []);
            }
        } catch (error) {
            console.error("Erro ao carregar notificações", error);
        }
    }, [setNotificacoes]);

    const carregarFila = async () => {
        try {
            const response = await api.get('/fila');
            if (response.data.success) {
                setFila(response.data.fila);
            }
        } catch (error) {
            console.error("Erro ao carregar fila:", error);
        }
    };

    const adicionarNaFila = async (novoItem) => {
        try {
            await api.post('/fila', { ...novoItem, unidade: user?.cidade || 'Recife' });
            mostrarNotificacao("✅ Adicionado à Fila!")
        } catch (e) {
            console.error(e);
            mostrarNotificacao("❌ Erro ao adicionar na fila.");
        }
    };

    const removerDaFila = async (id) => {
        try {
            await api.delete(`/fila/${id}`);
        } catch (e) { console.error(e); }
    };

    const promoverFilaOperacao = (item) => {
        // Preenche o formulário de lançamento com os dados da fila
        setFormLanca(prev => ({
            ...prev,
            motorista: item.motorista || '',
            telefoneMotorista: item.telefone || '',
            placa1Motorista: item.placa1 || '',
            placa2Motorista: item.placa2 || '',
            coletaRecife: item.coleta || '',
            coletaMoreno: item.coleta || '',
            idFilaOriginal: item.id || null,
            id_marcacao: item.id || null,
            // Herdar checklist se disponível
            chk_cnh: item.chk_cnh_cad ? 1 : 0,
            chk_antt: item.chk_antt_cad ? 1 : 0,
            chk_tacografo: item.chk_tacografo_cad ? 1 : 0,
            chk_crlv: item.chk_crlv_cad ? 1 : 0,
            situacao_cadastro: item.situacao_cad || 'NÃO CONFERIDO',
            numero_liberacao: item.num_liberacao_cad || '',
            data_liberacao: item.data_liberacao_cad || null,
        }));

        // Navega para a aba de lançamento
        setAbaAtiva('novo_lancamento');

        // Fecha o modal da fila
        closeModal('fila');

        mostrarNotificacao(`🚀 Dados de ${item.motorista || 'Motorista'} carregados!`);
    };

    const handleReceberAlerta = useCallback((dados) => {
        const meuCargo = userRef.current?.cargo || '';
        const alvo = DESTINATARIOS_ALERTA[dados.tipo] || [];
        
        console.log(`%c🔔 ALERTA RECEBIDO: ${dados.tipo}`, 'background: #222; color: #bada55; font-size: 14px', { dados, meuCargo, alvo });

        // admin_config_mudou: recarrega permissões para todos, sem notificação visual
        if (dados.tipo === 'admin_config_mudou') {
            carregarPermissoes();
            return;
        }

        if (!alvo.includes(meuCargo)) {
            console.log(`🚫 Alerta ignorado: cargo '${meuCargo}' não está na lista de alvos.`);
            return;
        }

        // Filtrar por destinatário específico (ex: operador Conhecimento selecionado no modal CT-e)
        if (dados.destinatario_id && dados.destinatario_id !== userRef.current?.id) {
            console.log(`🚫 Alerta ignorado: destinatário ${dados.destinatario_id} não sou eu (${userRef.current?.id}).`);
            return;
        }

        // Filtrar por unidade: se a notificação tem origem, só exibe para usuários da mesma cidade (Coordenador vê tudo)
        // Exceção: tipos que devem atravessar unidades (doca: Cadastro/Conhecimento precisam ver ambas)
        const TIPOS_SEM_FILTRO_CIDADE = ['doca', 'aceite_cte_pendente', 'admin_senha', 'admin_cadastro'];
        const minhaCidade = userRef.current?.cidade || '';
        if (dados.origem && meuCargo !== 'Coordenador' && minhaCidade && dados.origem !== minhaCidade && !TIPOS_SEM_FILTRO_CIDADE.includes(dados.tipo)) {
            console.log(`🚫 Alerta ignorado: origem '${dados.origem}' não é da minha cidade '${minhaCidade}'.`);
            return;
        }

        const notificacaoComId = {
            ...dados,
            idInterno: dados.idInterno || (dados.tipo + '_' + Date.now()),
            data_criacao: dados.data_criacao || new Date().toISOString()
        };
        adicionarNotificacao(notificacaoComId);
        
        const msgTexto = dados.mensagem || `Novo alerta: ${dados.tipo}`;
        mostrarNotificacao(`🔔 ${msgTexto}`);

        if (dados.tipo === 'aceite_cte_pendente') {
            const nome = dados.dadosVeiculo?.motorista || "Motorista";
            dispararNotificacaoWindows(`📄 NOVO CT-E!\nMotorista: ${nome}`);
        } else if (dados.tipo === 'veiculo_carregado') {
            dispararNotificacaoWindows(`🚛 CARREGADO!\n${dados.mensagem}`);
        } else {
            dispararNotificacaoWindows(`⚠️ NOTIFICAÇÃO!\n${dados.mensagem}`);
        }
    }, [carregarPermissoes, adicionarNotificacao, mostrarNotificacao]);

    const handleReceberAtualizacao = useCallback((data) => {
        // CORREÇÃO: Adiciona verificação de duplicatas no novo_veiculo (igual ao novo_fila)
        if (data.tipo === 'novo_veiculo') {
            setListaVeiculos(prev => {
                const existe = prev.find(item => item.id === data.dados.id);
                if (existe) return prev;
                return [data.dados, ...prev];
            });

            const hoje = obterDataBrasilia();
            const dataVeiculo = data.dados?.data_prevista || hoje;
            if (dataVeiculo !== hoje) {
                mostrarNotificacaoRef.current?.(`📅 Novo lançamento para ${dataVeiculo} — ajuste o filtro para ver`);
            }
        }
        else if (data.tipo === 'atualiza_veiculo') {
            const temDados = data.status_recife !== undefined || data.status_moreno !== undefined || data.status_cte !== undefined || data.dados_json !== undefined || data.motorista !== undefined;
            if (temDados) {
                const dataNormalizado = { ...data };
                if (dataNormalizado.imagens && !Array.isArray(dataNormalizado.imagens)) {
                    try { dataNormalizado.imagens = JSON.parse(dataNormalizado.imagens); } catch { dataNormalizado.imagens = []; }
                }
                setListaVeiculos(prev => prev.map(c => c.id === data.id ? { ...c, ...dataNormalizado } : c));
            } else {
                // Só veio o id — busca dado completo do banco para não perder campos
                api.get(`/veiculos/${data.id}`).then(r => {
                    if (r.data?.success && r.data.veiculo) {
                        setListaVeiculos(prev => prev.map(c => c.id === data.id ? { ...c, ...r.data.veiculo } : c));
                    }
                }).catch(() => {});
            }
            // Auto-remover da fila quando status mudar para EM SEPARAÇÃO
            if (data.status_recife === 'EM SEPARAÇÃO' || data.status_moreno === 'EM SEPARAÇÃO') {
                setFila(prev => {
                    const item = prev.find(f => f.veiculo_id === data.id);
                    if (item?.id) api.delete(`/fila/${item.id}`).catch(() => {});
                    return prev;
                });
            }
        }
        else if (data.tipo === 'remove_veiculo') setListaVeiculos(prev => prev.filter(c => c.id !== data.id));

        // --- Sincronização de CT-e ---
        else if (data.tipo === 'novo_cte') {
            if (data.dados.origem === 'Moreno') {
                const adder = prev => prev.find(c => c.id === data.dados.id) ? prev : [...prev, data.dados];
                setCtesMoreno(adder);
                setCtesMorenoHoje(adder);
            } else {
                const adder = prev => prev.find(c => c.id === data.dados.id) ? prev : [...prev, data.dados];
                setCtesRecife(adder);
                setCtesRecifeHoje(adder);
            }
        }
        else if (data.tipo === 'atualiza_cte') {
            const updater = prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c);
            setCtesRecife(updater);
            setCtesMoreno(updater);
            setCtesRecifeHoje(updater);
            setCtesMorenoHoje(updater);
        }
        else if (data.tipo === 'remove_cte') {
            const filter = prev => prev.filter(c => c.id !== data.id);
            setCtesRecife(filter);
            setCtesMoreno(filter);
            setCtesRecifeHoje(filter);
            setCtesMorenoHoje(filter);
        }

        // CORREÇÃO DO PISCAR NA FILA (Verifica se já existe)
        else if (data.tipo === 'novo_fila') {
            setFila(prev => {
                const existe = prev.find(item => item.id === data.dados.id);
                if (existe) return prev;
                return [...prev, data.dados];
            });
        }
        else if (data.tipo === 'atualiza_fila') setFila(prev => prev.map(f => f.id === data.id ? { ...f, ...data } : f));
        else if (data.tipo === 'remove_fila') setFila(prev => prev.filter(f => f.id !== data.id));
        else if (data.tipo === 'reordenar_fila' && Array.isArray(data.ordem)) setFila(data.ordem);

        // ATUALIZAÇÃO DO AVATAR
        else if (data.tipo === 'avatar_mudou') {
            if (data.userId === userRef.current.id) {
                updateUser({ avatarUrl: data.newUrl });
                const saved = JSON.parse(localStorage.getItem('usuario_logado') || '{}');
                saved.avatarUrl = data.newUrl;
                localStorage.setItem('usuario_logado', JSON.stringify(saved));
            }
        }
        // REFRESH GERAL (rollover/fim do dia ou CT-e despachado) — recarrega dados completos
        else if (data.tipo === 'refresh_geral') {
            recarregarDadosRef.current?.();
        }
    }, [updateUser]);

    // --- USE EFFECT: carregamento inicial de dados (só na montagem / logout) ---
    useEffect(() => {
        if (!logado) return;
        carregarPermissoes();
        carregarVeiculos();
        carregarNotificacoes();
        carregarFila();
        // Limpar CT-es antes de recarregar para não exibir dados de sessões anteriores
        setCtesRecife([]);
        setCtesMoreno([]);
        setCtesRecifeHoje([]);
        setCtesMorenoHoje([]);
        carregarCtes();
        // Verificar e-mail pessoal (cobre tanto login novo quanto sessão restaurada do localStorage)
        if (!user?.email_pessoal) {
            setModalEmailPessoal(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logado]);

    // --- USE EFFECT: registro de listeners Socket.IO ---
    useEffect(() => {
        if (!logado) return;

        console.log(`🔌 [Socket] Inicializando listeners. Conectado: ${socket.connected}`);
        
        const monitorInterval = setInterval(() => {
            if (!socket.connected) console.warn("🔴 [Socket] ATENÇÃO: Socket desconectado!");
        }, 5000);
        socket.on('connect', () => {
            console.log("🟢 Socket Conectado:", socket.id);
            if (!isFirstConnectRef.current) {
                // Reconectou após queda — recarrega dados que podem ter chegado durante a desconexão
                recarregarDadosRef.current?.();
            }
            isFirstConnectRef.current = false;
        });
        socket.on('disconnect', () => console.log("🔴 Socket Desconectado"));

        socket.on('receber_alerta', handleReceberAlerta);
        socket.on('receber_atualizacao', handleReceberAtualizacao);

        // Se socket já está conectado mas lista está vazia (remount sem reload), recarregar
        if (socket.connected) {
            recarregarDadosRef.current?.();
        }
        socket.on('notificacao_direcionada', (d) => {
            const meuCargo = userRef.current?.cargo || '';
            const minhaCidade = userRef.current?.cidade || '';
            // Filtrar por unidade (Coordenador vê tudo)
            if (d.origem && meuCargo !== 'Coordenador' && minhaCidade && d.origem !== minhaCidade) return;
            if (d.cargos_alvo && d.cargos_alvo.includes(meuCargo)) {
                mostrarNotificacaoRef.current(`🔔 ${d.mensagem}`);
                adicionarNotificacao({
                    ...d,
                    idInterno: d.idInterno || ('dir_' + Date.now()),
                    data_criacao: d.data_criacao || new Date().toISOString()
                });
            }
        });
        socket.on('cadastro_situacao_atualizada', (d) => {
            setListaVeiculos(prev => prev.map(v => {
                try {
                    const dj = typeof v.dados_json === 'string' ? JSON.parse(v.dados_json) : (v.dados_json || {});
                    const telV = (dj.telefoneMotorista || '').replace(/\D/g, '').slice(-9);
                    const telD = (d.telefone || '').replace(/\D/g, '').slice(-9);

                    if ((telV && telD && telV === telD) || (d.veiculoId && v.id === d.veiculoId)) {
                        const novosDados = {
                            ...v,
                            situacao_cadastro: d.situacao,
                            data_liberacao: d.data_liberacao,
                            numero_liberacao: d.numero_liberacao,
                            chk_cnh: d.chk_cnh,
                            chk_antt: d.chk_antt,
                            chk_tacografo: d.chk_tacografo,
                            chk_crlv: d.chk_crlv,
                            dados_json: JSON.stringify({
                                ...dj,
                                situacao_cadastro: d.situacao,
                                data_liberacao: d.data_liberacao,
                                numero_liberacao: d.numero_liberacao,
                                chk_cnh: d.chk_cnh,
                                chk_antt: d.chk_antt,
                                chk_tacografo: d.chk_tacografo,
                                chk_crlv: d.chk_crlv,
                            })
                        };
                        return novosDados;
                    }
                } catch (_) { }
                return v;
            }));
        });
        socket.on('programacao_gerada', (dados) => {
            const meuCargo = userRef.current?.cargo || '';
            if (meuCargo === 'Coordenador' || meuCargo === 'Planejamento') {
                mostrarNotificacaoRef.current(`📊 Programação das ${dados.turno} consolidada com sucesso! Clique em H. de Programação.`);
                adicionarNotificacao({
                    ...dados,
                    tipo: 'programacao_gerada',
                    mensagem: `📊 Programação das ${dados.turno} consolidada com sucesso!`,
                    idInterno: dados.idInterno || ('prog_' + Date.now()),
                    data_criacao: dados.data_criacao || new Date().toISOString()
                });
            }
        });

        // Remove notificação globalmente (ex: CT-e aceito por outro usuário)
        socket.on('notificacao_removida', ({ id }) => {
            removerNotificacao(id);
        });

        return () => {
            clearInterval(monitorInterval);
            socket.off('connect');
            socket.off('disconnect');
            socket.off('receber_alerta', handleReceberAlerta);
            socket.off('receber_atualizacao', handleReceberAtualizacao);
            socket.off('notificacao_direcionada');
            socket.off('cadastro_situacao_atualizada');
            socket.off('programacao_gerada');
            socket.off('notificacao_removida');
        };
    }, [handleReceberAlerta, handleReceberAtualizacao, adicionarNotificacao, socket, logado]);

    // Busca veiculos do banco
    const carregarVeiculos = async () => {
        try {
            const response = await api.get('/veiculos');
            if (response.data.success) {
                setListaVeiculos(response.data.veiculos);
            }
        } catch (error) {
            console.error("Erro ao carregar veículos:", error);
        }
    };

    // Busca CT-es ativos do banco
    const carregarCtes = async (dataInicio, dataFim) => {
        try {
            const params = dataInicio && dataFim ? `?dataInicio=${dataInicio}&dataFim=${dataFim}` : '';
            const response = await api.get(`/ctes${params}`);
            if (response.data.success) {
                const todos = response.data.ctes || [];
                setCtesRecife(todos.filter(c => c.origem === 'Recife'));
                setCtesMoreno(todos.filter(c => c.origem !== 'Recife'));
                // Sem params = carga inicial (hoje) → também atualiza o estado do dashboard
                if (!params) {
                    setCtesRecifeHoje(todos.filter(c => c.origem === 'Recife'));
                    setCtesMorenoHoje(todos.filter(c => c.origem !== 'Recife'));
                }
            }
        } catch (error) {
            console.error("Erro ao carregar CT-es ativos:", error);
        }
    };

    // Mantém ref atualizada para uso dentro de event handlers do socket
    recarregarDadosRef.current = () => {
        carregarVeiculos();
        carregarCtes();
        carregarFila();
    };

    const temAcesso = (modulo) => {
        if (!user) return false;
        if (user.cargo === 'Coordenador' || user.cargo === 'Desenvolvedor') return true;
        if (user.usaPermissaoIndividual) {
            return user.permissoesAcesso && user.permissoesAcesso.includes(modulo);
        }
        return user.cargo && permissoes[user.cargo]?.includes(modulo);
    };

    const podeEditar = (modulo) => {
        if (!user) return false;
        if (user.cargo === 'Coordenador' || user.cargo === 'Desenvolvedor') return true;
        if (user.usaPermissaoIndividual) {
            if (user.permissoesEdicao && user.permissoesEdicao.length > 0) {
                return user.permissoesEdicao.includes(modulo);
            }
            // Fallback para permissões padrão do cargo quando individual não configurada
            return permissoesEdicao[user.cargo]?.includes(modulo) ?? false;
        }
        return user.cargo && permissoesEdicao[user.cargo]?.includes(modulo);
    };

    const { podeVerUnidade: authPodeVerUnidade } = useAuthStore();
    const podeVerUnidade = (cidadeAlvo) => authPodeVerUnidade(cidadeAlvo);



    const ehOperacaoInterestadual = (op) => op === 'LEÃO - SP' || op === 'ELETRIK SUL';
    const ehOperacaoRecife = (op) => op && !ehOperacaoInterestadual(op) && op.includes('RECIFE');
    const ehOperacaoMoreno = (op) => op && !ehOperacaoInterestadual(op) && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));

    const ativarNotificacoes = () => {
        if (!("Notification" in window)) { mostrarNotificacao("❌ Este navegador não suporta notificações."); return; }
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                mostrarNotificacao("🔔 Alertas ativados!");
                new Notification("Teste de Notificação", { body: "Funcionando!" });
            }
        });
    };

    // Auto-solicita permissão de notificação ao abrir o app (só pede se ainda não foi decidido)
    useEffect(() => {
        if ("Notification" in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const salvarNoHistoricoCte = async (item, origem) => {
        const duracao = calcularDiferencaHoras(item.timestamps?.inicio_emissao, item.timestamps?.fim_emissao);
        try {
            await api.post('/historico_cte', {
                coleta: item.coletaRecife || item.coletaMoreno,
                motorista: item.motorista,
                origem: origem,
                inicio_emissao: item.timestamps?.inicio_emissao,
                fim_emissao: item.timestamps?.fim_emissao,
                duracao: duracao,
                usuario_responsavel: user.nome,
                data_registro: obterDataBrasilia()
            });
        } catch (e) {
            console.error("Erro ao salvar histórico CT-e:", e);
        }
    };

    // --- LANÇAMENTO NOVO (MIGRADO PARA API) ---
    const lancarVeiculoInteligente = async () => {
        const precisaRecife = ehOperacaoRecife(formLanca.operacao);
        const precisaMoreno = ehOperacaoMoreno(formLanca.operacao);

        if (precisaRecife && !formLanca.coletaRecife) return mostrarNotificacao("⚠️ Digite a coleta de Recife!");
        if (precisaMoreno && !formLanca.coletaMoreno) return mostrarNotificacao("⚠️ Digite a coleta de Moreno!");

        // Unidade determinada pela operação, não pela cidade do usuário
        const unidadeForcada = (!precisaRecife && precisaMoreno) ? 'Moreno'
            : (!precisaMoreno && precisaRecife) ? 'Recife'
            : (formLanca.inicio || 'Recife'); // misto: usa seleção manual

        const novoItem = {
            placa: formLanca.placa1Motorista || '',
            modelo: formLanca.tipoVeiculo,
            tipoVeiculo: formLanca.tipoVeiculo,
            status: 'AGUARDANDO P/ SEPARAÇÃO',
            motorista: formLanca.motorista || '',
            telefoneMotorista: formLanca.telefoneMotorista || '',
            placa1Motorista: formLanca.placa1Motorista || '',
            placa2Motorista: formLanca.placa2Motorista || '',
            isFrotaMotorista: formLanca.isFrotaMotorista || false,
            unidade: unidadeForcada,
            rotaRecife: formLanca.rotaRecife || '',
            rotaMoreno: formLanca.rotaMoreno || '',
            operacao: formLanca.operacao,
            status_recife: precisaRecife ? 'AGUARDANDO P/ SEPARAÇÃO' : null,
            status_moreno: precisaMoreno ? 'AGUARDANDO P/ SEPARAÇÃO' : null,
            doca_recife: 'SELECIONE',
            doca_moreno: 'SELECIONE',
            tempos_recife: { inicio_separacao: '', fim_separacao: '', inicio_carregamento: '', fim_carregamento: '', liberado_cte: '' },
            tempos_moreno: { inicio_separacao: '', fim_separacao: '', inicio_carregamento: '', fim_carregamento: '', liberado_cte: '' },
            status_coleta: { solicitado: '', liberado: '' },
            coletaRecife: precisaRecife ? formLanca.coletaRecife : (ehOperacaoInterestadual(formLanca.operacao) ? formLanca.coletaRecife : ''),
            coletaMoreno: precisaMoreno ? formLanca.coletaMoreno : '',
            origem_criacao: unidadeForcada,
            inicio_rota: unidadeForcada,
            data_prevista: formLanca.data_prevista,
            data_prevista_original: formLanca.data_prevista,
            observacao: formLanca.observacao || '',
            imagens: formLanca.imagens || [],
            id_marcacao: formLanca.id_marcacao || null,
            // Checklists herdados
            chk_cnh: formLanca.chk_cnh || 0,
            chk_antt: formLanca.chk_antt || 0,
            chk_tacografo: formLanca.chk_tacografo || 0,
            chk_crlv: formLanca.chk_crlv || 0,
            situacao_cadastro: formLanca.situacao_cadastro || 'NÃO CONFERIDO',
            numero_liberacao: formLanca.numero_liberacao || '',
            data_liberacao: formLanca.data_liberacao || null
        };

        try {
            const respLanca = await api.post('/veiculos', novoItem);

            // Se veio da fila, remove o item original
            if (formLanca.idFilaOriginal) {
                await removerDaFila(formLanca.idFilaOriginal);
            }

            // Auto-adicionar à fila de separação
            const coletaFila = novoItem.coletaRecife || novoItem.coletaMoreno || novoItem.coleta || '';
            if (coletaFila && !formLanca.idFilaOriginal) {
                await api.post('/fila', {
                    coleta: coletaFila,
                    motorista: novoItem.motorista || '',
                    unidade: novoItem.unidade || user?.cidade || 'Recife',
                    pendente: false,
                    veiculo_id: respLanca.data?.id
                });
            }

            setFormLanca({ ...formLanca, coletaRecife: '', coletaMoreno: '', rotaRecife: '', rotaMoreno: '', motorista: '', telefoneMotorista: '', placa1Motorista: '', placa2Motorista: '', observacao: '', imagens: [], chk_cnh: 0, chk_antt: 0, chk_tacografo: 0, chk_crlv: 0, situacao_cadastro: 'NÃO CONFERIDO', numero_liberacao: '', data_liberacao: null, idFilaOriginal: null, id_marcacao: null });
            mostrarNotificacao("✅ Veículo Lançado !");
        } catch (error) {
            console.error("Erro ao lançar:", error);
            const msg = error?.response?.data?.message || "Erro ao salvar no banco.";
            mostrarNotificacao(`❌ ${msg}`);
        }
    };

    const aceitarCtePelaNotificacao = async (notificacao) => {
        const { dadosVeiculo, idInterno, origem } = notificacao;
        if (aceitandoCteIds.current.has(idInterno)) return;
        aceitandoCteIds.current.add(idInterno);
        // Herdar t_fim_liberado_cte dos tempos do veículo (para o dashboard de efetividade)
        const temposVeic = origem === 'Recife'
            ? (dadosVeiculo.tempos_recife || {})
            : (dadosVeiculo.tempos_moreno || {});
        const dadosCte = {
            ...dadosVeiculo,
            origem: origem,
            usuario_aceitou: user.nome,
            unidade_emissao: user.cidade,
            status: 'Aguardando Emissão',
            data_entrada_cte: new Date().toLocaleDateString('pt-BR'),
            t_fim_liberado_cte: temposVeic.t_fim_liberado_cte || null,
            numero_liberacao: dadosVeiculo.numero_liberacao || '',
            data_liberacao: dadosVeiculo.data_liberacao || null,
            // Campos de rota herdados do cadastro
            origem_cad: dadosVeiculo.origem_cad || '',
            destino_uf_cad: dadosVeiculo.destino_uf_cad || '',
            destino_cidade_cad: dadosVeiculo.destino_cidade_cad || '',
            timestamps: { criado_em: new Date().toISOString(), inicio_emissao: '', fim_emissao: '' }
        };

        // Persistir no banco de dados
        let cteCriado = false;
        try {
            const origemCte = origem || (user.cidade === 'Moreno' ? 'Moreno' : 'Recife');
            const response = await api.post('/ctes', { origem: origemCte, dados: dadosCte });
            if (response.data.success) {
                dadosCte.id = response.data.id;
                cteCriado = true;
            }
        } catch (error) {
            console.error("Erro ao persistir CT-e:", error);
            const msg = error?.response?.data?.message || error.message || 'Erro desconhecido';
            mostrarNotificacao(`❌ Falha ao criar CT-e: ${msg}`);
            aceitandoCteIds.current.delete(idInterno);
            return; // Não remove a notificação se falhou
        }

        const origemLabel = user.cidade === 'Moreno' ? 'MORENO' : 'RECIFE';
        mostrarNotificacao(cteCriado
            ? `✅ CT-e Aceito! Enviado para ${origemLabel}.`
            : `⚠️ CT-e já existia — duplicata ignorada.`
        );

        // Remover notificação globalmente (CT-e aceito = remove para todos)
        try {
            removerNotificacao(idInterno);
            await api.delete(`/notificacoes/${idInterno}?global=true`);
        } catch (error) {
            console.error("Erro ao remover notificação:", error);
        } finally {
            aceitandoCteIds.current.delete(idInterno);
        }
    };

    const handleRemoverNotificacao = async (idInterno) => {
        removerNotificacao(idInterno);
        try {
            await api.delete(`/notificacoes/${idInterno}`);
        } catch (error) {
            console.error("Erro ao deletar notificação do banco", error);
        }
    };


    const updateList = useCallback(async (lista, setLista, index, campo, valor, origem = '') => {
        console.log(`📝 [updateList] Chamado: ${campo} -> ${valor} (ID: ${lista[index]?.id})`);
        const novaLista = [...lista];
        // Clone profundo dos objetos aninhados para não mutar o item original
        // (necessário para que o revert no catch funcione corretamente)
        const itemAtual = {
            ...novaLista[index],
            timestamps_status: { ...(novaLista[index].timestamps_status || {}) },
            tempos_recife: { ...(novaLista[index].tempos_recife || {}) },
            tempos_moreno: { ...(novaLista[index].tempos_moreno || {}) },
        };

        // Identifica se a lista sendo editada é a Fila ou o Painel de Veículos
        const ehFila = lista === fila;

        // Atualização do estado local
        if (campo.includes('.')) {
            const [pai, filho] = campo.split('.');
            itemAtual[pai] = { ...itemAtual[pai], [filho]: valor };
        } else {
            itemAtual[campo] = valor;
        }

        // timestamps_status agora é AUTORITATIVO DO BACKEND — frontend não grava mais.
        // O backend (veiculos.js PUT) grava os timestamps ISO com base na mudança de status.
        // Apenas tempos HH:MM são mantidos localmente para exibição rápida no painel.
        if (campo.includes('status')) {
            const agoraHHMM = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const temposKey = campo === 'status_recife' ? 'tempos_recife' : 'tempos_moreno';
            if (valor === 'EM SEPARAÇÃO' && !itemAtual[temposKey].t_inicio_separacao) {
                itemAtual[temposKey].t_inicio_separacao = agoraHHMM;
            }
            if (valor === 'LIBERADO P/ DOCA' || valor === 'EM CARREGAMENTO') {
                if (!itemAtual[temposKey].fim_separacao) {
                    itemAtual[temposKey].fim_separacao = agoraHHMM;
                }
            }
            if (valor === 'EM CARREGAMENTO' && !itemAtual[temposKey].t_inicio_carregamento) {
                itemAtual[temposKey].t_inicio_carregamento = agoraHHMM;
            }
            if (valor === 'CARREGADO') {
                itemAtual[temposKey].t_inicio_carregado = agoraHHMM;
                itemAtual[temposKey].fim_carregamento = agoraHHMM;
            }
            if (valor === 'LIBERADO P/ CT-e') {
                itemAtual[temposKey].t_fim_liberado_cte = agoraHHMM;
            }
        }

        novaLista[index] = itemAtual;
        setLista(novaLista);

        // Lógica de Sockets e Alertas (Apenas para veículos do Painel)
        if (!ehFila) {
            if (campo.includes('status') && valor === 'LIBERADO P/ CT-e') {
                // Buscar dados atualizados do servidor para garantir coleta correta no alerta
                let dadosAlerta = itemAtual;
                try {
                    const resp = await api.get(`/veiculos/${itemAtual.id}`);
                    if (resp.data?.success && resp.data.veiculo) dadosAlerta = resp.data.veiculo;
                } catch (_) { }

                const coletaValida = (dadosAlerta.coletaRecife && dadosAlerta.coletaRecife.trim()) ||
                    (dadosAlerta.coletaMoreno && dadosAlerta.coletaMoreno.trim());
                const motoristaValido = dadosAlerta.motorista && dadosAlerta.motorista.trim();

                if (motoristaValido) {
                    socket.emit('enviar_alerta', {
                        tipo: 'aceite_cte_pendente',
                        origem,
                        mensagem: `CT-e Liberado${coletaValida ? ` (${coletaValida})` : ` — ${motoristaValido}`}`,
                        dadosVeiculo: dadosAlerta
                    });
                } else {
                    mostrarNotificacao("⚠️ CT-e liberado, mas alerta não enviado (motorista ausente).");
                }
            }

            if (campo.includes('status') && valor === 'CARREGADO') {
                socket.emit('enviar_alerta', {
                    tipo: 'veiculo_carregado',
                    origem,
                    mensagem: `Veículo carregado: ${itemAtual.motorista || itemAtual.placa || '?'}`,
                    dadosVeiculo: itemAtual
                });
            }

            if (campo.includes('status') && valor === 'LIBERADO P/ DOCA') {
                const doca = origem === 'Recife' ? itemAtual.doca_recife : itemAtual.doca_moreno;
                socket.emit('enviar_alerta', {
                    coleta: origem === 'Recife' ? itemAtual.coletaRecife : itemAtual.coletaMoreno,
                    doca: doca || '?',
                    origem,
                    tipo: 'doca',
                    mensagem: `Na Doca: ${doca}`
                });
            }
        }

        // Persistência no Banco de Dados
        try {
            if (itemAtual.id) {
                const endpoint = ehFila ? 'fila' : 'veiculos';
                const payload = { ...itemAtual };
                delete payload.imagens; // Economiza rede e previne erro 413 (Payload Too Large)
                delete payload.dados_json; // Remove lixo pesado salvo em transações antigas
                await api.put(`/${endpoint}/${itemAtual.id}`, payload);
            }
        } catch (e) {
            // Reverter estado otimista apenas do item afetado sem recarregar a tela toda
            const erroMsg = e.response?.data?.message || 'Erro ao sincronizar com o servidor.';
            mostrarNotificacao(`⚠️ ${erroMsg}`);
            console.warn(`[API Update Erro] ${erroMsg}`);

            setLista(prev => {
                const stateRevertido = [...prev];
                stateRevertido[index] = lista[index]; // restaura o backup do item antes da falha
                return stateRevertido;
            });
        }
    }, [fila, socket, mostrarNotificacao]);

    // Libera CT-e: marca flag cte_antecipado_*, emite alerta para o operador Conhecimento selecionado.
    const liberarParaCte = useCallback(async (lista, setLista, index, origem, operadorId, operadorNome) => {
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[index] };
        const agora = new Date().toISOString();
        const campo = origem === 'Recife' ? 'cte_antecipado_recife' : 'cte_antecipado_moreno';
        const valorAnterior = itemAtual[campo];

        itemAtual[campo] = agora;
        novaLista[index] = itemAtual;
        setLista(novaLista);

        try {
            if (itemAtual.id) {
                const payload = { ...itemAtual };
                delete payload.imagens;
                delete payload.dados_json;
                await api.put(`/veiculos/${itemAtual.id}`, payload);

                // Buscar dados atualizados do servidor para garantir coleta correta no alerta
                let dadosParaAlerta = itemAtual;
                try {
                    const resp = await api.get(`/veiculos/${itemAtual.id}`);
                    if (resp.data?.success && resp.data.veiculo) {
                        dadosParaAlerta = resp.data.veiculo;
                    }
                } catch (_) { /* usa dados locais como fallback */ }

                const coletaValida = (dadosParaAlerta.coletaRecife && dadosParaAlerta.coletaRecife.trim()) ||
                    (dadosParaAlerta.coletaMoreno && dadosParaAlerta.coletaMoreno.trim());
                const motorista = dadosParaAlerta.motorista?.trim();

                if (motorista) {
                    socket.emit('enviar_alerta', {
                        tipo: 'aceite_cte_pendente',
                        origem,
                        destinatario_id: operadorId || null,
                        destinatario_nome: operadorNome || null,
                        mensagem: `CT-e Liberado${coletaValida ? ` (${coletaValida})` : ` — ${motorista}`}`,
                        dadosVeiculo: dadosParaAlerta
                    });
                    mostrarNotificacao(`✅ CT-e liberado — enviado para ${operadorNome || 'Conhecimento'}.`);
                } else {
                    mostrarNotificacao('⚠️ CT-e liberado, mas alerta não enviado (motorista ausente).');
                }
            }
        } catch (e) {
            mostrarNotificacao('⚠️ Erro ao salvar liberação de CT-e.');
            setLista(prev => prev.map(item =>
                item.id === itemAtual.id ? { ...item, [campo]: valorAnterior } : item
            ));
        }
    }, [socket, mostrarNotificacao]);

    const removerVeiculo = (id) => {
        setConfirmarRemover({
            mensagem: 'Tem certeza que deseja excluir este veículo permanentemente?',
            onConfirm: async () => {
                setConfirmarRemover(null);
                try {
                    setListaVeiculos(prev => prev.filter(item => item.id !== id));
                    await api.delete(`/veiculos/${id}`);
                    mostrarNotificacao("🗑️ Veículo removido com sucesso!");
                } catch (error) {
                    console.error("Erro ao deletar:", error);
                    mostrarNotificacao("❌ Erro ao deletar do banco. Dê F5.");
                    carregarVeiculos();
                }
            }
        });
    };

    const updateListCte = async (lista, setLista, index, campo, valor, origem) => {
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[index] };
        const statusAnterior = itemAtual[campo]; // Salvar status antigo
        itemAtual[campo] = valor;
        if (!itemAtual.timestamps) itemAtual.timestamps = {};

        // Registrar auditoria de mudança de status CT-e
        if (campo === 'status' && statusAnterior !== valor) {
            try {
                await api.put('/cte/status', {
                    cteId: itemAtual.id,
                    statusAntigo: statusAnterior,
                    statusNovo: valor,
                    origem: origem,
                    coleta: itemAtual.coletaRecife || itemAtual.coletaMoreno || 'N/A',
                    usuario: user.nome
                });
            } catch (error) {
                console.error('Erro ao registrar log de CT-e:', error);
            }
        }

        // Quando status muda para "Em Emissão"
        if (campo === 'status' && valor === 'Em Emissão') {
            const agora = new Date();
            itemAtual.timestamps.inicio_emissao = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Calcular tempo de espera desde criação do CT-e
            const criadoEm = itemAtual.timestamps?.criado_em || itemAtual.data_entrada_cte;
            if (criadoEm) {
                try {
                    const dataCriacao = typeof criadoEm === 'string' && criadoEm.includes('T')
                        ? new Date(criadoEm)
                        : new Date(criadoEm.split('/').reverse().join('-'));

                    const tempoDecorrido = Math.floor((agora - dataCriacao) / 1000 / 60);
                    itemAtual.timestamps.tempo_aguardando_emissao = tempoDecorrido;

                    mostrarNotificacao(`⏱️ Tempo aguardando emissão: ${tempoDecorrido} min`);
                } catch (e) {
                    console.error("Erro ao calcular tempo de espera:", e);
                }
            }
        }

        if (campo === 'status' && valor === 'Emitido') {
            const fimStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            itemAtual.timestamps.fim_emissao = fimStr;

            // Calcular minutos_cte automaticamente (fim_emissao - inicio_emissao)
            const inicioStr = itemAtual.timestamps.inicio_emissao;
            if (inicioStr && fimStr) {
                const [hi, mi] = inicioStr.split(':').map(Number);
                const [hf, mf] = fimStr.split(':').map(Number);
                const totalMin = (hf * 60 + mf) - (hi * 60 + mi);
                if (totalMin > 0) itemAtual.minutos_cte = totalMin;
            }

            salvarNoHistoricoCte(itemAtual, origem);

            // Persiste status Emitido no banco (card permanece visível no painel CT-e)
            if (itemAtual.id) {
                try {
                    await api.put(`/ctes/${itemAtual.id}`, { dados: itemAtual, origem });
                    setLista(prev => prev.map((c, mIndex) => mIndex === index ? itemAtual : c));
                    mostrarNotificacao("✅ CT-e Emitido!");
                } catch (error) {
                    const msgErro = error.response?.data?.message || 'Erro ao persistir status Emitido (PUT).';
                    console.error('Erro ao persistir status Emitido:', error);
                    mostrarNotificacao(`⚠️ ${msgErro}`);
                }
            } else {
                setLista(prev => prev.map((c, mIndex) => mIndex === index ? itemAtual : c));
                mostrarNotificacao("✅ CT-e Emitido!");
            }
            return; // Interrompe para não executar o update genérico abaixo
        }

        // Para outros status, atualiza localmente primeiro (estado otimista)
        novaLista[index] = itemAtual;
        setLista(novaLista);

        // Persistir alteracoes no banco de dados (exceto se ja foi removido por ser Emitido)
        if (itemAtual.id && valor !== 'Emitido') {
            try {
                await api.put(`/ctes/${itemAtual.id}`, { dados: itemAtual, origem });
            } catch (error) {
                const erroMsg = error.response?.data?.message || 'Erro ao persistir CT-e no servidor.';
                mostrarNotificacao(`⚠️ ${erroMsg}`);
                console.error(`[API Update Erro] ${erroMsg}`);

                setLista(prev => {
                    const stateRevertido = [...prev];
                    stateRevertido[index] = lista[index]; // restaura o backup do item antes da falha
                    return stateRevertido;
                });
            }
        }
    };

    const handleSortFila = async (_fila) => {
        const backupFila = [...fila]; // Guardar backup local caso a API falhe
        setFila(_fila);
        try {
            await api.put('/fila/reordenar', { ordem: _fila });
        } catch (error) {
            console.error("Erro ao salvar ordem da fila:", error);
            mostrarNotificacao("⚠️ Falha ao salvar a nova ordem da fila. Revertendo...");
            setFila(backupFila);
        }
    };



    const buscarRelatorio = async () => {
        try {
            const response = await api.get(`/relatorios?dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}`);
            setRelatorioDados(response.data.historico || []);
            setFiltroOrigem('Todas');
            setFiltroTipoOperacao('Todas');
            openModal('relatorio');
        } catch (e) {
            console.error("Erro ao buscar relatório:", e);
            mostrarNotificacao("❌ Erro ao gerar relatório.");
        }
    };

    const buscarRelatorioCte = () => {
        openModal('relatorioCte');
    };

    const filtrarDados = (dados) => dados.filter(item => (filtroOrigem === 'Todas' || item.origem === filtroOrigem) && (filtroTipoOperacao === 'Todas' || item.tipo_operacao === filtroTipoOperacao));

    const baixarPDF = async () => {
        const dadosFiltrados = filtrarDados(relatorioDados);
        if (dadosFiltrados.length === 0) return mostrarNotificacao("⚠️ Sem dados.");
        const doc = new jsPDF();
        try {
            const imgData = await converterImagemParaBase64(logoEmpresa);
            doc.addImage(imgData, 'PNG', (doc.internal.pageSize.getWidth() - 50) / 2, 10, 50, 20);
        } catch (e) { }
        doc.text(filtroOrigem === 'Todas' ? "Relatório Operacional - GERAL" : `Relatório - ${filtroOrigem.toUpperCase()}`, 14, 40);
        autoTable(doc, {
            head: [["Data", "Coleta", "Motorista", "Origem", "Operação", "Início", "Fim", "Total"]],
            body: dadosFiltrados.map(i => [i.data_registro, i.coleta, i.motorista, i.origem, i.tipo_operacao, i.inicio_separacao, i.fim_carregamento, i.duracao_total]),
            startY: 45,
            margin: { left: 6, right: 6 },
            styles: { cellPadding: 1.5, fontSize: 6.5, overflow: 'linebreak' },
            headStyles: { fillColor: [30, 64, 175], fontSize: 6.5, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 28 },
                2: { cellWidth: 38 },
                3: { cellWidth: 20 },
                4: { cellWidth: 22 },
                5: { cellWidth: 16 },
                6: { cellWidth: 16 },
                7: { cellWidth: 18 },
            },
            alternateRowStyles: { fillColor: [241, 245, 249] },
        });
        doc.save('relatorio.pdf');
    };

    const handleLoginSuccess = (usuarioData) => {
        if (usuarioData.cargo === 'Dashboard Viewer') {
            setAbaAtiva('dashboard_tv');
        } else {
            setAbaAtiva(usuarioData.cidade === 'Recife' ? 'op_recife' : 'op_moreno');
        }
        if (!usuarioData.email_pessoal) {
            setModalEmailPessoal(true);
        }
    };

    const salvarTelefonePrimeiroLogin = async () => {
        const tel = telefonePrimeiroLogin.replace(/\D/g, '');
        if (tel.length < 10) {
            mostrarNotificacao('Telefone inválido. Informe DDD + número (ex: 81912345678).', 'aviso');
            return;
        }
        try {
            await api.post(`/usuarios/${user.id}/telefone`, { telefone: tel });
            updateUser({ telefone: tel });
            setModalTelefone(false);
            setTelefonePrimeiroLogin('');
        } catch {
            mostrarNotificacao('Erro ao salvar telefone. Tente novamente.', 'erro');
        }
    };

    const handleLogout = () => {
        logout();
    };

    // --- RENDERIZAÇÃO ---

    if (!logado) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} socket={socket} />;
    }

    return (
        <MainLayout
            onLogout={handleLogout}
            aceitarCtePelaNotificacao={aceitarCtePelaNotificacao}
            buscarRelatorioCte={buscarRelatorioCte}
            ativarNotificacoes={ativarNotificacoes}
            handleUpdateAvatar={handleUpdateAvatar}
            handleRemoverNotificacao={handleRemoverNotificacao}
            socket={socket}
        >
            {/* MODAL DE CONFIRMAÇÃO GLOBAL */}
            {confirmarRemover && <ModalConfirm titulo="Excluir veículo" mensagem={confirmarRemover.mensagem} textConfirm="Excluir" onConfirm={confirmarRemover.onConfirm} onCancel={() => setConfirmarRemover(null)} />}

            {/* MODAL OBRIGATÓRIO — CADASTRO DE TELEFONE NO PRIMEIRO LOGIN */}
            {modalTelefone && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="modal-glass" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', background: 'rgba(37,211,102,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid rgba(37,211,102,0.3)' }}>
                            <Phone size={28} color="#25D366" />
                        </div>
                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white', fontSize: '16px' }}>
                            Cadastre seu WhatsApp
                        </h3>
                        <p className="modal-desc" style={{ marginBottom: '20px' }}>
                            Para poder recuperar sua senha pelo WhatsApp, informe seu número com DDD. Este passo é obrigatório.
                        </p>
                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                                <Phone size={12} /> Número WhatsApp (com DDD)
                            </label>
                            <input
                                className="input-dark"
                                placeholder="81912345678"
                                value={telefonePrimeiroLogin}
                                onChange={e => setTelefonePrimeiroLogin(e.target.value.replace(/\D/g, ''))}
                                maxLength={11}
                                onKeyDown={e => e.key === 'Enter' && salvarTelefonePrimeiroLogin()}
                                autoFocus
                            />
                        </div>
                        <button onClick={salvarTelefonePrimeiroLogin} className="btn-primary-glow" style={{ background: '#25D366', color: 'white', width: '100%' }}>
                            SALVAR E CONTINUAR
                        </button>
                    </div>
                </div>
            )}
            {/* MODAL OBRIGATÓRIO — CADASTRO DE E-MAIL PESSOAL (recuperação de senha) */}
            {modalEmailPessoal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="modal-glass" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', background: 'rgba(56,189,248,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid rgba(56,189,248,0.3)' }}>
                            <span style={{ fontSize: '28px' }}>📧</span>
                        </div>
                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white', fontSize: '16px' }}>
                            Cadastre seu E-mail de Recuperação
                        </h3>
                        {!emailPessoalEnviado ? (
                            <>
                                <p className="modal-desc" style={{ marginBottom: '20px' }}>
                                    Cadastre um e-mail pessoal (Gmail, Hotmail, etc.) para poder recuperar sua senha automaticamente se perder o acesso.
                                </p>
                                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Seu E-mail Pessoal</label>
                                    <input
                                        className="input-dark"
                                        type="email"
                                        placeholder="seuemail@gmail.com"
                                        value={emailPessoalInput}
                                        onChange={e => setEmailPessoalInput(e.target.value)}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter') {
                                                if (!emailPessoalInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPessoalInput)) {
                                                    mostrarNotificacao('Digite um e-mail válido.', 'aviso'); return;
                                                }
                                                try {
                                                    await api.post(`/usuarios/${user.id}/email-pessoal`, { email_pessoal: emailPessoalInput });
                                                    setEmailPessoalEnviado(true);
                                                    updateUser({ email_pessoal: emailPessoalInput });
                                                } catch (err) {
                                                    mostrarNotificacao(err.response?.data?.message || 'Erro ao salvar e-mail.', 'erro');
                                                }
                                            }
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={async () => {
                                        if (!emailPessoalInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPessoalInput)) {
                                            mostrarNotificacao('Digite um e-mail válido.', 'aviso'); return;
                                        }
                                        try {
                                            await api.post(`/usuarios/${user.id}/email-pessoal`, { email_pessoal: emailPessoalInput });
                                            setEmailPessoalEnviado(true);
                                            updateUser({ email_pessoal: emailPessoalInput });
                                        } catch (e) {
                                            mostrarNotificacao(e.response?.data?.message || 'Erro ao salvar e-mail.', 'erro');
                                        }
                                    }} className="btn-primary-glow" style={{ background: '#0ea5e9', color: 'white', flex: 1 }}>
                                        SALVAR E VERIFICAR
                                    </button>
                                    <button onClick={() => setModalEmailPessoal(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                        DEPOIS
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="modal-desc" style={{ marginBottom: '20px' }}>
                                    E-mail de verificação enviado para <strong style={{ color: '#38bdf8' }}>{emailPessoalInput}</strong>.<br /><br />
                                    Verifique sua caixa de entrada e clique no link para confirmar.
                                </p>
                                <button onClick={() => { setModalEmailPessoal(false); setEmailPessoalEnviado(false); setEmailPessoalInput(''); }} className="btn-primary-glow" style={{ background: '#22c55e', color: 'white', width: '100%' }}>
                                    OK, FECHAR
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Dashboard TV - Fullscreen overlay */}
            {abaAtiva === 'dashboard_tv' && temAcesso('dashboard_tv') && (
                <React.Suspense fallback={null}>
                <DashboardTV
                    listaVeiculos={listaVeiculos}
                    ctesRecife={ctesRecifeHoje}
                    ctesMoreno={ctesMorenoHoje}
                    socket={socket}
                    onRefresh={() => recarregarDadosRef.current?.()}
                    onSair={() => {
                        if (temAcesso('operacao') && podeVerUnidade('Recife')) setAbaAtiva('op_recife');
                        else if (temAcesso('operacao') && podeVerUnidade('Moreno')) setAbaAtiva('op_moreno');
                        else if (temAcesso('cte')) setAbaAtiva('cte_recife');
                        else setAbaAtiva('dashboard_tv');
                    }}
                />
                </React.Suspense>
            )}

            {/* CONTEÚDO PRINCIPAL */}
            <div className="container-central">
            <React.Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#475569', fontSize: '13px', gap: '10px' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #1e293b', borderTop: '2px solid #60a5fa', animation: 'spin 0.7s linear infinite' }} />
                    Carregando...
                </div>
            }>

                {abaAtiva === 'op_recife' && temAcesso('operacao') && (
                    <PainelOperacional
                        origem="Recife"
                        lista={listaVeiculos}
                        setLista={setListaVeiculos}
                        opcoesDocas={DOCAS_RECIFE_LISTA}
                        termoBusca={termoBusca}
                        setTermoBusca={setTermoBusca}
                        user={user}
                        funcoes={{ podeEditar, updateList, liberarParaCte, removerVeiculo, socket, mostrarNotificacao }}
                    />
                )}

                {abaAtiva === 'op_moreno' && temAcesso('operacao') && (
                    <PainelOperacional
                        origem="Moreno"
                        lista={listaVeiculos}
                        setLista={setListaVeiculos}
                        opcoesDocas={DOCAS_MORENO_LISTA}
                        termoBusca={termoBusca}
                        setTermoBusca={setTermoBusca}
                        user={user}
                        funcoes={{ podeEditar, updateList, liberarParaCte, removerVeiculo, socket, mostrarNotificacao }}
                    />
                )}

                {abaAtiva === 'painel_leao' && temAcesso('operacao') && (
                    <PainelOperacional
                        origem="Leao"
                        lista={listaVeiculos}
                        setLista={setListaVeiculos}
                        opcoesDocas={[]}
                        termoBusca={termoBusca}
                        setTermoBusca={setTermoBusca}
                        user={user}
                        funcoes={{ podeEditar, updateList, liberarParaCte, removerVeiculo, socket, mostrarNotificacao }}
                        operacoesFixas={['LEÃO - SP', 'ELETRIK SUL']}
                    />
                )}

                {abaAtiva === 'novo_lancamento' && temAcesso('operacao') && !['Encarregado'].includes(user?.cargo) && (
                    <NovoLancamento
                        user={user}
                        formLanca={formLanca}
                        setFormLanca={setFormLanca}
                        lancarVeiculoInteligente={lancarVeiculoInteligente}
                        podeEditar={podeEditar}
                        mostrarNotificacao={mostrarNotificacao}
                    />
                )}

                {abaAtiva === 'cubagem' && temAcesso('cubagem') && (
                    <ModuloCubagem />
                )}

                {abaAtiva === 'marcacao_placas' && temAcesso('marcacao_placas') && (
                    <GestaoMarcacoes socket={socket} />
                )}

                {abaAtiva === 'dashboard_marcacoes' && temAcesso('marcacao_placas') && (
                    <DashboardMarcacoes />
                )}

                {abaAtiva === 'saldo_paletes' && (user.cargo === 'Coordenador' || user.cargo === 'Planejamento' || user.cargo === 'Encarregado' || user.cargo === 'Desenvolvedor' || temAcesso('saldo_paletes')) && (
                    <PainelSaldoPaletes />
                )}

                {abaAtiva === 'relatorio_op' && temAcesso('relatorios') && (
                    <RelatorioOperacional />
                )}

                {abaAtiva === 'relatorio_performance' && temAcesso('relatorios') && (
                    <RelatorioPerformance />
                )}

                {abaAtiva === 'relatorio_liberacoes' && temAcesso('relatorios') && (
                    <RelatorioContratacao />
                )}

                {abaAtiva === 'relatorio_cte' && temAcesso('relatorios') && (
                    <RelatorioCte />
                )}

                {abaAtiva === 'relatorio_cubagem' && temAcesso('relatorios') && (
                    <RelatorioCubagem />
                )}

                {abaAtiva === 'cadastro' && temAcesso('cadastro') && (
                    <PainelCadastro user={user} socket={socket} />
                )}

                {abaAtiva === 'historico_liberacoes' && temAcesso('cadastro') && (
                    <HistoricoLiberacoes />
                )}

                {abaAtiva === 'checklist_carreta' && temAcesso('checklist_carreta') && (
                    <PainelChecklist />
                )}

                {abaAtiva === 'programacao_diaria' && (
                    <PainelProgramacao />
                )}

                {abaAtiva === 'provisionamento' && (
                    <ProvisionamentoFrota socket={socket} user={user} />
                )}

                {abaAtiva === 'frota_dashboard' && (
                    <DashboardFrota socket={socket} />
                )}

                {abaAtiva === 'painel_frota' && (
                    <PainelFrota socket={socket} user={user} />
                )}

                {abaAtiva === 'roteirizacao_frota' && (
                    <RoteirizacaoFrota socket={socket} user={user} />
                )}

                {abaAtiva === 'ocorrencias' && (temAcesso('operacao') || user?.cargo === 'Pos Embarque') && (
                    <PainelOcorrencias />
                )}

                {abaAtiva === 'pos_embarque' && (
                    <PainelPosEmbarque />
                )}

                {abaAtiva === 'pos_embarque_dashboard' && (
                    <DashboardPosEmbarque socket={socket} />
                )}

                {abaAtiva.startsWith('cte_') && temAcesso('cte') && (
                    <PainelCte
                        abaAtiva={abaAtiva}
                        ctesRecife={ctesRecife}
                        ctesMoreno={ctesMoreno}
                        setCtesRecife={setCtesRecife}
                        setCtesMoreno={setCtesMoreno}
                        filtroDataInicioCte={filtroDataInicioCte}
                        filtroDataFimCte={filtroDataFimCte}
                        setFiltroDataInicioCte={setFiltroDataInicioCte}
                        setFiltroDataFimCte={setFiltroDataFimCte}
                        carregarCtes={carregarCtes}
                        updateListCte={updateListCte}
                        podeEditar={podeEditar}
                        setToastCopiaMsg={setToastCopiaMsg}
                        socket={socket}
                    />
                )}

                {/* --- MODAIS --- */}

                <ModalRelatorio
                    isOpen={modals.relatorio}
                    onClose={() => closeModal('relatorio')}
                    dados={filtrarDados(relatorioDados)}
                    filtros={{ inicio: filtroDataInicio, fim: filtroDataFim, origem: filtroOrigem }}
                    setFiltros={(f) => { setFiltroDataInicio(f.inicio); setFiltroDataFim(f.fim); setFiltroOrigem(f.origem); }}
                    buscar={buscarRelatorio}
                    baixarPDF={baixarPDF}
                />

                <ModalRelatorioCte
                    isOpen={modals.relatorioCte}
                    onClose={() => closeModal('relatorioCte')}
                    ctesRecife={ctesRecife}
                    ctesMoreno={ctesMoreno}
                />

                <ModalFila
                    isOpen={modals.fila}
                    onClose={() => closeModal('fila')}
                    fila={fila}
                    setFila={setFila}
                    onDragSort={handleSortFila}
                    updateList={(index, campo, valor) => updateList(fila, setFila, index, campo, valor)}
                    onAdd={(item) => adicionarNaFila(item)}
                    onRemove={(id) => removerDaFila(id)}
                    onPromote={promoverFilaOperacao}
                    unidadeUsuario={user?.cargo !== 'Coordenador' ? user?.cidade : null}
                />



                <LogsAuditoria
                    isOpen={modals.logs}
                    onClose={() => closeModal('logs')}
                />

                {/* Toast de cópia de número de liberação */}
                {toastCopiaMsg && (
                    <div style={{
                        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                        background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(34,197,94,0.4)',
                        borderRadius: '10px', padding: '12px 16px', color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxWidth: '300px',
                        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
                        animation: 'slideIn 0.3s ease'
                    }}>
                        <CheckCircleIcon size={16} color="#4ade80" style={{ flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: '700', color: '#4ade80', fontSize: '11px', marginBottom: '2px' }}>COPIADO</div>
                            {toastCopiaMsg}
                        </div>
                    </div>
                )}

            </React.Suspense>
            </div>
        </MainLayout>
    );
}

export default App;