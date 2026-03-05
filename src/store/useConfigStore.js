import { create } from 'zustand';
import api from '../services/apiService';

const useConfigStore = create((set, get) => ({
    permissoes: {},
    permissoesEdicao: {},
    isLoading: false,

    carregarPermissoes: async () => {
        set({ isLoading: true });
        try {
            const response = await api.get('/configuracoes');
            if (response.data.success) {
                set({
                    permissoes: response.data.acesso || {},
                    permissoesEdicao: response.data.edicao || {}
                });
            }
        } catch (e) {
            console.error("Erro ao carregar permissões:", e);
        } finally {
            set({ isLoading: false });
        }
    },

    togglePermissao: (tipo, cargo, moduloId) => {
        const stateKey = tipo === 'acesso' ? 'permissoes' : 'permissoesEdicao';
        const estadoAtual = get()[stateKey];

        const permissoesCargo = estadoAtual[cargo] ? [...estadoAtual[cargo]] : [];

        let novoArr;
        if (permissoesCargo.includes(moduloId)) {
            novoArr = permissoesCargo.filter(p => p !== moduloId);
        } else {
            novoArr = [...permissoesCargo, moduloId];
        }

        set({
            [stateKey]: { ...estadoAtual, [cargo]: novoArr }
        });
    },

    salvarConfiguracoesPermissao: async () => {
        const { permissoes, permissoesEdicao } = get();
        try {
            await api.post('/configuracoes', { acesso: permissoes, edicao: permissoesEdicao });
            return { success: true };
        } catch (e) {
            console.error("Erro ao salvar configurações:", e);
            return { success: false, error: e };
        }
    }
}));

export default useConfigStore;
