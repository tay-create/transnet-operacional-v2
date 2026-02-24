import { create } from 'zustand';

/**
 * Store de UI (Zustand)
 * Gerencia estado dos modais e notificações
 */
const useUIStore = create((set) => ({
    // === ESTADO DOS MODAIS ===
    modals: {
        cadastro: false,
        esqueciSenha: false,
        admin: false,
        tempo: false,
        relatorio: false,
        relatorioCte: false,
        fila: false,
        avatar: false,
        cubagem: false,
        logs: false,
        permissao: false
    },

    // === NOTIFICAÇÕES ===
    notificacao: '',
    notificacoes: [],

    // === MENU SIDEBAR ===
    menuAberto: false,
    menuNotificacaoAberto: false,
    abaAtiva: 'op_recife',

    // === AÇÕES ===

    /**
     * Definir a aba ativa
     * @param {string} aba - Nome da aba
     */
    setAbaAtiva: (aba) => {
        set({ abaAtiva: aba });
    },

    /**
     * Abrir modal específico
     * @param {string} modalName - Nome do modal
     */
    openModal: (modalName) => {
        set((state) => ({
            modals: { ...state.modals, [modalName]: true }
        }));
    },

    /**
     * Fechar modal específico
     * @param {string} modalName - Nome do modal
     */
    closeModal: (modalName) => {
        set((state) => ({
            modals: { ...state.modals, [modalName]: false }
        }));
    },

    /**
     * Fechar todos os modais
     */
    closeAllModals: () => {
        set({
            modals: {
                cadastro: false,
                esqueciSenha: false,
                admin: false,
                tempo: false,
                relatorio: false,
                relatorioCte: false,
                fila: false,
                avatar: false,
                cubagem: false,
                logs: false,
                permissao: false
            }
        });
    },

    /**
     * Mostrar notificação temporária
     * @param {string} mensagem - Texto da notificação
     * @param {number} duracao - Tempo em ms (padrão: 3000)
     */
    mostrarNotificacao: (mensagem, duracao = 3000) => {
        set({ notificacao: mensagem });
        setTimeout(() => {
            set({ notificacao: '' });
        }, duracao);
    },

    /**
     * Adicionar notificação à lista
     * @param {Object} notificacao - Objeto da notificação
     */
    adicionarNotificacao: (notificacao) => {
        set((state) => ({
            notificacoes: [notificacao, ...state.notificacoes]
        }));
    },

    /**
     * Remover notificação da lista
     * @param {number} id - ID da notificação
     */
    removerNotificacao: (id) => {
        set((state) => ({
            notificacoes: state.notificacoes.filter(n => n.idInterno !== id)
        }));
    },

    /**
     * Definir lista de notificações
     * @param {Array} notificacoes - Array de notificações
     */
    setNotificacoes: (val) => {
        set((state) => ({
            notificacoes: typeof val === 'function' ? val(state.notificacoes) : (Array.isArray(val) ? val : [])
        }));
    },

    /**
     * Toggle menu sidebar
     */
    toggleMenu: () => {
        set((state) => ({ menuAberto: !state.menuAberto }));
    },

    /**
     * Abrir/Fechar menu de notificações
     */
    toggleNotificacoes: () => {
        set((state) => ({ menuNotificacaoAberto: !state.menuNotificacaoAberto }));
    },

    /**
     * Fechar menu de notificações
     */
    closeMenuNotificacoes: () => {
        set({ menuNotificacaoAberto: false });
    }
}));

export default useUIStore;
