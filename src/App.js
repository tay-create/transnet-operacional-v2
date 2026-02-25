import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from './services/apiService';
import logoEmpresa from './assets/logo.png';
import { calcularDiferencaHoras, converterImagemParaBase64, obterDataBrasilia } from './utils/helpers';
import {
    DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA
} from './constants';
import PainelOperacional from './components/PainelOperacional';
import MainLayout from './components/layout/MainLayout';
import PainelCte from './components/PainelCte';
import { ModalTempos, ModalRelatorio, ModalFila, ModalRelatorioCte } from './components/Modals';
import ModuloCubagem from './components/ModuloCubagem';
import NovoLancamento from './components/NovoLancamento';
import LogsAuditoria from './components/LogsAuditoria';
import './App.css';
import DashboardTV from './components/DashboardTV';
import GestaoMarcacoes from './components/GestaoMarcacoes';
import RelatorioOperacional from './components/RelatorioOperacional';
import PainelCadastro from './components/PainelCadastro';
import PainelProgramacao from './components/PainelProgramacao';
import { CheckCircle as CheckCircleIcon } from 'lucide-react';
import PainelChecklist from './components/PainelChecklist';
import PainelOcorrencias from './components/PainelOcorrencias';
import useAuthStore from './store/useAuthStore';
import useUIStore from './store/useUIStore';
import useConfigStore from './store/useConfigStore';
import useUserStore from './store/useUserStore';
import LoginScreen from './components/LoginScreen';

const hojeISO = obterDataBrasilia();

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
    const [termoBusca, setTermoBusca] = useState('');
    const [fila, setFila] = useState([]);
    const [itemTempoAtivo, setItemTempoAtivo] = useState(null);
    const [relatorioDados, setRelatorioDados] = useState([]);
    const [filtroOrigem, setFiltroOrigem] = useState('Todas');
    const [filtroTipoOperacao, setFiltroTipoOperacao] = useState('Todas');
    const [filtroDataInicio, setFiltroDataInicio] = useState(obterDataBrasilia());
    const [filtroDataFim, setFiltroDataFim] = useState(obterDataBrasilia());
    const [filtroDataInicioCte, setFiltroDataInicioCte] = useState(obterDataBrasilia());
    const [filtroDataFimCte, setFiltroDataFimCte] = useState(obterDataBrasilia());
    const [toastCopiaMsg, setToastCopiaMsg] = useState('');
    const [formLanca, setFormLanca] = useState({
        operacao: 'DELTA(RECIFE)',
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

    const userRef = useRef(user);
    const mostrarNotificacaoRef = useRef(mostrarNotificacao);

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
            await api.post('/fila', novoItem);
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
        if (dados.tipo === 'admin_cadastro' && userRef.current.cargo !== 'Coordenador') return;
        if (dados.tipo === 'admin_senha' && userRef.current.cargo !== 'Coordenador') return;
        if (dados.tipo === 'admin_config_mudou' && userRef.current.cargo !== 'Coordenador') return;
        // Usa o idInterno do servidor se existir, senão cria um temporário
        const notificacaoComId = { ...dados, idInterno: dados.idInterno || Date.now() + Math.random() };
        adicionarNotificacao(notificacaoComId);

        if (dados.tipo === 'admin_config_mudou') {
            mostrarNotificacao("🔄 Permissões atualizadas!");
            carregarPermissoes();
        } else if (dados.tipo === 'aceite_cte_pendente') {
            const nome = dados.dadosVeiculo?.motorista || "Motorista";
            dispararNotificacaoWindows(`📄 NOVO CT-E!\nMotorista: ${nome}`);
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
        }
        else if (data.tipo === 'atualiza_veiculo') setListaVeiculos(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
        else if (data.tipo === 'remove_veiculo') setListaVeiculos(prev => prev.filter(c => c.id !== data.id));

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

        // ATUALIZAÇÃO DO AVATAR
        else if (data.tipo === 'avatar_mudou') {
            if (data.userId === userRef.current.id) {
                updateUser({ avatarUrl: data.newUrl });
                const saved = JSON.parse(localStorage.getItem('usuario_logado') || '{}');
                saved.avatarUrl = data.newUrl;
                localStorage.setItem('usuario_logado', JSON.stringify(saved));
            }
        }
    }, [updateUser]);

    // --- USE EFFECT (Com Filtro de Permissões) ---
    useEffect(() => {
        if (!logado) return; // TRAVA DE EXECUÇÃO: não buscar dados se não estiver logado

        carregarPermissoes();
        carregarVeiculos();
        carregarNotificacoes();
        carregarFila();
        carregarCtes();

        socket.on('connect', () => console.log("🟢 Socket Conectado:", socket.id));
        socket.on('disconnect', () => console.log("🔴 Socket Desconectado"));

        socket.on('receber_alerta', handleReceberAlerta);
        socket.on('receber_atualizacao', handleReceberAtualizacao);
        socket.on('notificacao_direcionada', (d) => {
            const meuCargo = userRef.current?.cargo || '';
            if (d.cargos_alvo && d.cargos_alvo.includes(meuCargo)) {
                mostrarNotificacaoRef.current(`🔔 ${d.mensagem}`);
                // Adicionar ao sininho também
                adicionarNotificacao({
                    ...d,
                    idInterno: Date.now() + Math.random(),
                    data_criacao: new Date().toISOString()
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
            }
        });

        return () => {
            socket.off('receber_alerta');
            socket.off('receber_atualizacao');
            socket.off('notificacao_direcionada');
            socket.off('cadastro_situacao_atualizada');
            socket.off('programacao_gerada');
        };
    }, [handleReceberAlerta, handleReceberAtualizacao, carregarNotificacoes, carregarPermissoes, adicionarNotificacao, socket, logado]);

    // Busca veiculos do banco SQLite
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

    // Busca CT-es ativos do banco SQLite
    const carregarCtes = async () => {
        try {
            const response = await api.get('/ctes');
            if (response.data.success) {
                const todos = response.data.ctes || [];
                setCtesRecife(todos.filter(c => c.origem === 'Recife'));
                setCtesMoreno(todos.filter(c => c.origem !== 'Recife'));
            }
        } catch (error) {
            console.error("Erro ao carregar CT-es ativos:", error);
        }
    };

    const temAcesso = (modulo) => {
        if (!user) return false;
        if (user.cargo === 'Coordenador') return true;
        if (user.usaPermissaoIndividual) {
            return user.permissoesAcesso && user.permissoesAcesso.includes(modulo);
        }
        return user.cargo && permissoes[user.cargo]?.includes(modulo);
    };

    const podeEditar = (modulo) => {
        if (!user) return false;
        if (user.cargo === 'Coordenador') return true;
        if (user.usaPermissaoIndividual) {
            return user.permissoesEdicao && user.permissoesEdicao.includes(modulo);
        }
        return user.cargo && permissoesEdicao[user.cargo]?.includes(modulo);
    };

    const { podeVerUnidade: authPodeVerUnidade } = useAuthStore();
    const podeVerUnidade = (cidadeAlvo) => authPodeVerUnidade(cidadeAlvo);



    const ehOperacaoRecife = (op) => op.includes('RECIFE');
    const ehOperacaoMoreno = (op) => op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');

    const ativarNotificacoes = () => {
        if (!("Notification" in window)) { mostrarNotificacao("❌ Este navegador não suporta notificações."); return; }
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                mostrarNotificacao("🔔 Alertas ativados!");
                new Notification("Teste de Notificação", { body: "Funcionando!" });
            }
        });
    };

    const salvarNoHistoricoCte = async (item, origem) => {
        const duracao = calcularDiferencaHoras(item.timestamps?.inicio_emissao, item.timestamps?.fim_emissao);
        try {
            await api.post('/historico_cte', {
                coleta: item.coleta,
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

        const ehEletrikOuPorcelana = formLanca.operacao === 'ELETRIK' || formLanca.operacao === 'PORCELANA' || formLanca.operacao === 'PORCELANA/ELETRIK';
        const unidadeForcada = ehEletrikOuPorcelana ? 'Moreno' : (formLanca.inicio || 'Recife');

        const novoItem = {
            placa: formLanca.operacao,
            modelo: formLanca.tipoVeiculo,
            tipoVeiculo: formLanca.tipoVeiculo,
            status: 'AGUARDANDO',
            motorista: formLanca.motorista || '',
            telefoneMotorista: formLanca.telefoneMotorista || '',
            placa1Motorista: formLanca.placa1Motorista || '',
            placa2Motorista: formLanca.placa2Motorista || '',
            isFrotaMotorista: formLanca.isFrotaMotorista || false,
            unidade: unidadeForcada,
            rotaRecife: formLanca.rotaRecife || '',
            rotaMoreno: formLanca.rotaMoreno || '',
            operacao: formLanca.operacao,
            status_recife: precisaRecife ? 'AGUARDANDO' : null,
            status_moreno: precisaMoreno ? 'AGUARDANDO' : null,
            doca_recife: 'SELECIONE',
            doca_moreno: 'SELECIONE',
            tempos_recife: { inicio_separacao: '', fim_separacao: '', inicio_carregamento: '', fim_carregamento: '', liberado_cte: '' },
            tempos_moreno: { inicio_separacao: '', fim_separacao: '', inicio_carregamento: '', fim_carregamento: '', liberado_cte: '' },
            status_coleta: { solicitado: '', liberado: '' },
            coletaRecife: formLanca.coletaRecife,
            coletaMoreno: formLanca.coletaMoreno,
            coleta: unidadeForcada === 'Recife' ? formLanca.coletaRecife : formLanca.coletaMoreno,
            origem_criacao: unidadeForcada,
            inicio_rota: unidadeForcada,
            data_prevista: formLanca.data_prevista,
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
            await api.post('/veiculos', novoItem);

            // Se veio da fila, remove o item original
            if (formLanca.idFilaOriginal) {
                await removerDaFila(formLanca.idFilaOriginal);
            }

            setFormLanca({ ...formLanca, coletaRecife: '', coletaMoreno: '', rotaRecife: '', rotaMoreno: '', motorista: '', telefoneMotorista: '', placa1Motorista: '', placa2Motorista: '', observacao: '', imagens: [], chk_cnh: 0, chk_antt: 0, chk_tacografo: 0, chk_crlv: 0, situacao_cadastro: 'NÃO CONFERIDO', numero_liberacao: '', data_liberacao: null, idFilaOriginal: null, id_marcacao: null });
            mostrarNotificacao("✅ Veículo Lançado !");
        } catch (error) {
            console.error("Erro ao lançar:", error);
            mostrarNotificacao("❌ Erro ao salvar no banco.");
        }
    };

    const aceitarCtePelaNotificacao = async (notificacao) => {
        const { dadosVeiculo, idInterno, origem } = notificacao;
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
            timestamps: { criado_em: new Date().toISOString(), inicio_emissao: '', fim_emissao: '' }
        };

        // Persistir no banco de dados
        try {
            const origemCte = user.cidade === 'Moreno' ? 'Moreno' : 'Recife';
            const response = await api.post('/ctes', { origem: origemCte, dados: dadosCte });
            if (response.data.success) {
                dadosCte.id = response.data.id;
            }
        } catch (error) {
            console.error("Erro ao persistir CT-e:", error);
        }

        if (user.cidade === 'Moreno') {
            setCtesMoreno(prev => [...prev, dadosCte]);
            mostrarNotificacao(`✅ CT-e Aceito! Enviado para MORENO.`);
        } else {
            setCtesRecife(prev => [...prev, dadosCte]);
            mostrarNotificacao(`✅ CT-e Aceito! Enviado para RECIFE.`);
        }

        // Remover notificação do backend e do state via handle unificado
        try {
            await handleRemoverNotificacao(idInterno);
        } catch (error) {
            console.error("Erro ao remover notificação:", error);
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


    const updateList = async (lista, setLista, index, campo, valor, origem = '') => {
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[index] };

        // Identifica se a lista sendo editada é a Fila ou o Painel de Veículos
        const ehFila = lista === fila;

        // Atualização do estado local
        if (campo.includes('.')) {
            const [pai, filho] = campo.split('.');
            itemAtual[pai] = { ...itemAtual[pai], [filho]: valor };
        } else {
            itemAtual[campo] = valor;
        }

        // Capturar timestamps de mudanças de status para temporizadores automáticos
        if (campo.includes('status')) {
            const agora = new Date().toISOString();

            // Inicializar timestamps_status se não existir
            if (!itemAtual.timestamps_status) {
                itemAtual.timestamps_status = {};
            }

            // Quando status muda para CARREGADO
            if (valor === 'CARREGADO') {
                itemAtual.timestamps_status.carregado_em = agora;
            }

            // Quando status muda para LIBERADO P/ CT-e
            if (valor === 'LIBERADO P/ CT-e') {
                const carregadoEm = itemAtual.timestamps_status?.carregado_em;
                if (carregadoEm) {
                    const tempoDecorrido = Math.floor((new Date() - new Date(carregadoEm)) / 1000 / 60);
                    itemAtual.timestamps_status.liberado_cte_em = agora;
                    itemAtual.timestamps_status.tempo_carregado_ate_cte = tempoDecorrido;

                    mostrarNotificacao(`⏱️ Tempo de carregamento: ${tempoDecorrido} min`);
                }
            }

            // ── Auto-preencher tempos operacionais para Performance CT-e ──
            const agoraHHMM = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const temposKey = campo === 'status_recife' ? 'tempos_recife' : 'tempos_moreno';
            if (!itemAtual[temposKey] || typeof itemAtual[temposKey] !== 'object') {
                itemAtual[temposKey] = {};
            }
            if (valor === 'EM SEPARAÇÃO' && !itemAtual[temposKey].t_inicio_separacao) {
                itemAtual[temposKey].t_inicio_separacao = agoraHHMM;
            }
            if (valor === 'EM CARREGAMENTO' && !itemAtual[temposKey].t_inicio_carregamento) {
                itemAtual[temposKey].t_inicio_carregamento = agoraHHMM;
            }
            if (valor === 'CARREGADO') {
                itemAtual[temposKey].t_inicio_carregado = agoraHHMM;
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
                // Buscar coleta válida: campo principal, ou coletaRecife/coletaMoreno
                const coletaValida = (itemAtual.coleta && itemAtual.coleta.trim()) ||
                    (itemAtual.coletaRecife && itemAtual.coletaRecife.trim()) ||
                    (itemAtual.coletaMoreno && itemAtual.coletaMoreno.trim());
                const motoristaValido = itemAtual.motorista && itemAtual.motorista.trim();

                if (!coletaValida || !motoristaValido) {
                    mostrarNotificacao("⚠️ Falta dados de Coleta/Motorista!");
                    return;
                }
                socket.emit('enviar_alerta', {
                    tipo: 'aceite_cte_pendente',
                    origem,
                    mensagem: `CT-e Liberado (${coletaValida})`,
                    dadosVeiculo: itemAtual
                });
                mostrarNotificacao(`✅ Enviado para Notificações!`);
            }

            if (campo.includes('status') && valor === 'LIBERADO P/ DOCA') {
                const doca = origem === 'Recife' ? itemAtual.doca_recife : itemAtual.doca_moreno;
                socket.emit('enviar_alerta', {
                    coleta: itemAtual.coleta,
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
                await api.put(`/${endpoint}/${itemAtual.id}`, itemAtual);
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
    };

    const removerVeiculo = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este veículo permanentemente?")) return;

        try {
            setListaVeiculos(prev => prev.filter(item => item.id !== id));

            await api.delete(`/veiculos/${id}`);

            mostrarNotificacao("🗑️ Veículo removido com sucesso!");
        } catch (error) {
            console.error("Erro ao deletar:", error);
            mostrarNotificacao("❌ Erro ao deletar do banco. Dê F5.");
            carregarVeiculos();
        }
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
                    coleta: itemAtual.coleta || itemAtual.numero_coleta || 'N/A',
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

            // Remover do banco de CT-es ativos (ja foi arquivado no historico)
            if (itemAtual.id) {
                try {
                    await api.delete(`/ctes/${itemAtual.id}`);
                } catch (error) {
                    console.error('Erro ao remover CT-e ativo do banco:', error);
                }
            }
            mostrarNotificacao("✅ CT-e Emitido!");
        }
        novaLista[index] = itemAtual;
        setLista(novaLista);

        // Persistir alteracoes no banco de dados (exceto se ja foi removido por ser Emitido)
        if (itemAtual.id && valor !== 'Emitido') {
            try {
                await api.put(`/ctes/${itemAtual.id}`, { dados: itemAtual });
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
        // Token already set during login; no need to call login again
        setAbaAtiva(usuarioData.cidade === 'Recife' ? 'op_recife' : 'op_moreno');
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
        >
            {/* Dashboard TV - Fullscreen overlay */}
            {abaAtiva === 'dashboard_tv' && temAcesso('dashboard_tv') && (
                <DashboardTV
                    listaVeiculos={listaVeiculos}
                    ctesRecife={ctesRecife}
                    ctesMoreno={ctesMoreno}
                    onSair={() => {
                        if (temAcesso('operacao') && podeVerUnidade('Recife')) setAbaAtiva('op_recife');
                        else if (temAcesso('operacao') && podeVerUnidade('Moreno')) setAbaAtiva('op_moreno');
                        else if (temAcesso('cte')) setAbaAtiva('cte_recife');
                        else setAbaAtiva('dashboard_tv');
                    }}
                />
            )}

            {/* CONTEÚDO PRINCIPAL */}
            <div className="container-central">

                {abaAtiva === 'op_recife' && temAcesso('operacao') && (
                    <PainelOperacional
                        origem="Recife"
                        lista={listaVeiculos}
                        setLista={setListaVeiculos}
                        opcoesDocas={DOCAS_RECIFE_LISTA}
                        termoBusca={termoBusca}
                        setTermoBusca={setTermoBusca}
                        user={user}
                        funcoes={{ temAcesso, podeEditar, updateList, setItemTempoAtivo, setModalTempoAberto: (val) => openModal('tempo'), removerVeiculo, socket }}
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
                        funcoes={{ temAcesso, podeEditar, updateList, setItemTempoAtivo, setModalTempoAberto: (val) => openModal('tempo'), removerVeiculo, socket }}
                    />
                )}

                {abaAtiva === 'novo_lancamento' && temAcesso('operacao') && (
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

                {abaAtiva === 'marcacao_placas' && (user.cargo === 'Coordenador' || user.cargo === 'Planejamento') && (
                    <GestaoMarcacoes socket={socket} />
                )}

                {abaAtiva === 'relatorio_op' && temAcesso('relatorios') && (
                    <RelatorioOperacional listaVeiculos={listaVeiculos} />
                )}

                {abaAtiva === 'cadastro' && temAcesso('cadastro') && (
                    <PainelCadastro user={user} />
                )}

                {abaAtiva === 'checklist_carreta' && temAcesso('checklist_carreta') && (
                    <PainelChecklist />
                )}

                {abaAtiva === 'programacao_diaria' && (
                    <PainelProgramacao />
                )}

                {abaAtiva === 'ocorrencias' && temAcesso('operacao') && (
                    <PainelOcorrencias />
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
                        updateListCte={updateListCte}
                        podeEditar={podeEditar}
                        setToastCopiaMsg={setToastCopiaMsg}
                    />
                )}

                {/* --- MODAIS --- */}
                <ModalTempos
                    item={itemTempoAtivo}
                    onClose={() => closeModal('tempo')}
                    isOpen={modals.tempo}
                    atualizarTempo={(chave, valor) => {
                        const campo = itemTempoAtivo.origem === 'Recife' ? 'tempos_recife' : 'tempos_moreno';
                        updateList(itemTempoAtivo.lista, itemTempoAtivo.setLista, itemTempoAtivo.index, `${campo}.${chave}`, valor);
                    }}
                />

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

            </div>
        </MainLayout>
    );
}

export default App;