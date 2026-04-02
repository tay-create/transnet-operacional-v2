import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store de Autenticação (Zustand)
 * Gerencia sessão do usuário, token JWT e permissões
 */
const useAuthStore = create(
    persist(
        (set, get) => ({
            // === ESTADO ===
            user: null,
            token: null,
            isAuthenticated: false,

            // === AÇÕES ===

            /**
             * Fazer login
             * @param {Object} userData - Dados do usuário
             * @param {string} jwtToken - Token JWT
             */
            login: (userData, jwtToken) => {
                set({
                    user: userData,
                    token: jwtToken,
                    isAuthenticated: true
                });
                // Store token for API interceptor compatibility if present
                if (jwtToken) {
                    localStorage.setItem('auth_token', jwtToken);
                }
            },

            /**
             * Fazer logout (revoga sessão no servidor antes de limpar estado local)
             */
            logout: async () => {
                try {
                    const token = localStorage.getItem('auth_token');
                    if (token) {
                        await fetch('/logout', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    }
                } catch (_) {}
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false
                });
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth-storage');
                localStorage.removeItem('user_data');
            },

            /**
             * Atualizar dados do usuário (ex: avatar, cargo)
             * @param {Object} updates - Campos a atualizar
             */
            updateUser: (updates) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null
                }));
            },

            /**
             * Obter token atual
             * @returns {string|null}
             */
            getToken: () => {
                return get().token;
            },

            /**
             * Verificar se tem permissão de acesso
             * @param {string} modulo - Nome do módulo
             * @returns {boolean}
             */
            temAcesso: (modulo) => {
                const { user } = get();
                if (!user) return false;

                // Verificar permissões individuais
                if (user.usaPermissaoIndividual && user.permissoesAcesso) {
                    return user.permissoesAcesso.includes(modulo);
                }

                // Fallback: usar permissões padrão por cargo do configStore
                const { permissoes } = require('./useConfigStore').default.getState();
                return permissoes[user.cargo]?.includes(modulo) ?? false;
            },

            /**
             * Verificar se pode editar
             * @param {string} acao - Nome da ação
             * @returns {boolean}
             */
            podeEditar: (acao) => {
                const { user } = get();
                if (!user) return false;

                if (user.usaPermissaoIndividual && user.permissoesEdicao) {
                    return user.permissoesEdicao.includes(acao);
                }

                // Fallback: usar permissões de edição padrão por cargo do configStore
                const { permissoesEdicao } = require('./useConfigStore').default.getState();
                return permissoesEdicao[user.cargo]?.includes(acao) ?? false;
            },

            /**
             * Verificar se é coordenador ou admin
             * @returns {boolean}
             */
            isAdmin: () => {
                const { user } = get();
                return ['Coordenador', 'Direção', 'Adm Frota'].includes(user?.cargo);
            },

            /**
             * Verificar se o usuário pode ver uma unidade específica
             * @param {string} cidadeAlvo - Nome da cidade (Recife/Moreno)
             * @returns {boolean}
             */
            podeVerUnidade: (cidadeAlvo) => {
                const { user, temAcesso } = get();
                if (!user) return false;
                if (['Coordenador', 'Direção', 'Adm Frota'].includes(user.cargo)) return true;

                if (user.usaPermissaoIndividual) {
                    if (cidadeAlvo === 'Recife' && temAcesso('ver_unidade_recife')) return true;
                    if (cidadeAlvo === 'Moreno' && temAcesso('ver_unidade_moreno')) return true;
                    return false;
                }

                if (user.cargo === 'Planejamento') return true;

                return user.cidade === cidadeAlvo;
            },

            /**
             * Obter cidade do usuário
             * @returns {string|null}
             */
            getCidade: () => {
                return get().user?.cidade || null;
            },

            /**
             * Obter cargo do usuário
             * @returns {string|null}
             */
            getCargo: () => {
                return get().user?.cargo || null;
            }
        }),
        {
            name: 'auth-storage', // Nome da chave no localStorage
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
);

export default useAuthStore;
