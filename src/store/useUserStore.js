import { create } from 'zustand';
import api from '../services/apiService';

const useUserStore = create((set, get) => ({
    usuarios: [],
    pendencias: [],
    isLoading: false,

    // Estados para edição de usuário (ModalAdmin)
    usuarioEditando: null,
    tempAcessoUser: [],
    tempEdicaoUser: [],
    cargosSelecionados: {},

    carregarUsuarios: async () => {
        set({ isLoading: true });
        try {
            const response = await api.get('/usuarios');
            if (response.data.success) {
                set({ usuarios: response.data.usuarios });
            }
        } catch (e) {
            console.error("Erro ao carregar usuários:", e);
        } finally {
            set({ isLoading: false });
        }
    },

    carregarSolicitacoes: async () => {
        try {
            const response = await api.get('/solicitacoes');
            if (response.data.success) {
                set({ pendencias: response.data.solicitacoes });
            }
        } catch (e) {
            console.error("Erro ao buscar solicitações:", e);
        }
    },

    setUsuarioEditando: (usuario, permissoesPadrao = {}, permissoesEdicaoPadrao = {}) => {
        if (!usuario) {
            set({ usuarioEditando: null, tempAcessoUser: [], tempEdicaoUser: [] });
            return;
        }

        const tempAcesso = usuario.usaPermissaoIndividual
            ? (usuario.permissoesAcesso || [])
            : (permissoesPadrao[usuario.cargo] || []);

        const tempEdicao = usuario.usaPermissaoIndividual
            ? (usuario.permissoesEdicao || [])
            : (permissoesEdicaoPadrao[usuario.cargo] || []);

        set({
            usuarioEditando: usuario,
            tempAcessoUser: tempAcesso,
            tempEdicaoUser: tempEdicao
        });
    },

    setTempAcesso: (acesso) => set({ tempAcessoUser: acesso }),
    setTempEdicao: (edicao) => set({ tempEdicaoUser: edicao }),
    setCargosSelecionados: (cargos) => set({ cargosSelecionados: cargos }),

    aprovarPendencia: async (item, cargoEscolhido) => {
        try {
            if (item.idUsuario) {
                await api.post('/usuarios/recuperar', { idUsuario: item.idUsuario });
            } else {
                const novoUser = {
                    nome: item.nome,
                    identificador: item.identificador,
                    senha: item.senha,
                    cargo: cargoEscolhido,
                    unidade: item.unidade
                };

                const response = await api.post('/usuarios', novoUser);
                if (!response.data.success) {
                    throw new Error(response.data.message || 'Erro ao criar usuário');
                }
            }

            await api.delete(`/solicitacoes/${item.id}`);

            get().carregarSolicitacoes();
            get().carregarUsuarios();

            return { success: true };
        } catch (error) {
            console.error("Erro ao aprovar pendência:", error);
            return { success: false, error };
        }
    },

    recusarPendencia: async (id) => {
        try {
            await api.delete(`/solicitacoes/${id}`);
            get().carregarSolicitacoes();
            return { success: true };
        } catch (error) {
            console.error("Erro ao recusar pendência:", error);
            return { success: false, error };
        }
    },

    removerUsuario: async (id) => {
        try {
            await api.delete(`/usuarios/${id}`);
            get().carregarUsuarios();
            return { success: true };
        } catch (error) {
            console.error("Erro ao remover usuário:", error);
            return { success: false, error };
        }
    },

    alterarCargoUsuario: async (id, novoCargo) => {
        try {
            await api.put(`/usuarios/${id}`, { cargo: novoCargo });

            // Atualizar o usuário editando localmente se for o mesmo
            const currentEdit = get().usuarioEditando;
            if (currentEdit && currentEdit.id === id) {
                set({ usuarioEditando: { ...currentEdit, cargo: novoCargo } });
            }

            get().carregarUsuarios();
            return { success: true };
        } catch (error) {
            console.error("Erro ao mudar cargo:", error);
            return { success: false, error };
        }
    },

    salvarPermissoesIndividual: async () => {
        const { usuarioEditando, tempAcessoUser, tempEdicaoUser } = get();
        if (!usuarioEditando) return { success: false };

        const usuarioAtualizado = {
            ...usuarioEditando,
            usaPermissaoIndividual: true,
            permissoesAcesso: tempAcessoUser,
            permissoesEdicao: tempEdicaoUser
        };

        try {
            const response = await api.put(`/usuarios/${usuarioEditando.id}`, usuarioAtualizado);
            if (response.data.success) {
                get().carregarUsuarios();
                set({ usuarioEditando: null });
                return { success: true };
            }
            return { success: false };
        } catch (e) {
            console.error("Erro ao salvar permissões:", e);
            return { success: false, error: e };
        }
    },

    resetarParaCargo: async () => {
        const { usuarioEditando } = get();
        if (!usuarioEditando) return { success: false };

        const usuarioResetado = {
            ...usuarioEditando,
            usaPermissaoIndividual: false,
            permissoesAcesso: [],
            permissoesEdicao: []
        };

        try {
            await api.put(`/usuarios/${usuarioEditando.id}`, usuarioResetado);
            set({ usuarioEditando: null });
            get().carregarUsuarios();
            return { success: true };
        } catch (e) {
            console.error("Erro ao resetar permissões:", e);
            return { success: false, error: e };
        }
    }
}));

export default useUserStore;
