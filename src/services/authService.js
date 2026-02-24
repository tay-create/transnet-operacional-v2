import api from './apiService';

/**
 * Serviço de Autenticação
 * Centraliza todas as chamadas relacionadas a login, logout e gestão de usuários
 */

const authService = {
    /**
     * Realizar login
     * @param {Object} credentials - { nome, senha }
     * @returns {Promise<Object>} - { success, usuario, token }
     */
    login: async (credentials) => {
        try {
            const response = await api.post('/login', credentials);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao fazer login' };
        }
    },

    /**
     * Obter lista de usuários (Admin)
     * @returns {Promise<Array>}
     */
    getUsuarios: async () => {
        try {
            const response = await api.get('/usuarios');
            return response.data.usuarios || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar usuários' };
        }
    },

    /**
     * Criar novo usuário (Admin)
     * @param {Object} userData - { nome, email, senha, cidade, cargo }
     * @returns {Promise<Object>}
     */
    criarUsuario: async (userData) => {
        try {
            const response = await api.post('/usuarios', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao criar usuário' };
        }
    },

    /**
     * Atualizar usuário
     * @param {number} id - ID do usuário
     * @param {Object} updates - Campos a atualizar
     * @returns {Promise<Object>}
     */
    atualizarUsuario: async (id, updates) => {
        try {
            const response = await api.put(`/usuarios/${id}`, updates);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar usuário' };
        }
    },

    /**
     * Alterar cargo do usuário
     * @param {number} id - ID do usuário
     * @param {string} novoCargo - Novo cargo
     * @returns {Promise<Object>}
     */
    alterarCargo: async (id, novoCargo) => {
        try {
            const response = await api.put(`/usuarios/${id}`, { cargo: novoCargo });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao alterar cargo' };
        }
    },

    /**
     * Atualizar avatar do usuário
     * @param {number} id - ID do usuário
     * @param {string} avatarUrl - URL/Base64 do avatar
     * @returns {Promise<Object>}
     */
    atualizarAvatar: async (id, avatarUrl) => {
        try {
            const response = await api.put(`/usuarios/${id}/avatar`, { avatarUrl });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar avatar' };
        }
    },

    /**
     * Deletar usuário (Admin)
     * @param {number} id - ID do usuário
     * @returns {Promise<Object>}
     */
    deletarUsuario: async (id) => {
        try {
            const response = await api.delete(`/usuarios/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao deletar usuário' };
        }
    },

    /**
     * Obter solicitações de cadastro pendentes
     * @returns {Promise<Array>}
     */
    getSolicitacoes: async () => {
        try {
            const response = await api.get('/solicitacoes');
            return response.data.solicitacoes || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar solicitações' };
        }
    },

    /**
     * Criar solicitação de cadastro
     * @param {Object} solicitacao - Dados da solicitação
     * @returns {Promise<Object>}
     */
    criarSolicitacao: async (solicitacao) => {
        try {
            const response = await api.post('/solicitacoes', solicitacao);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao criar solicitação' };
        }
    },

    /**
     * Deletar solicitação
     * @param {number} id - ID da solicitação
     * @returns {Promise<Object>}
     */
    deletarSolicitacao: async (id) => {
        try {
            const response = await api.delete(`/solicitacoes/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao deletar solicitação' };
        }
    },

    /**
     * Obter configurações de permissões
     * @returns {Promise<Object>} - { acesso, edicao }
     */
    getConfiguracoes: async () => {
        try {
            const response = await api.get('/configuracoes');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar configurações' };
        }
    },

    /**
     * Atualizar configurações de permissões
     * @param {Object} config - { acesso, edicao }
     * @returns {Promise<Object>}
     */
    atualizarConfiguracoes: async (config) => {
        try {
            const response = await api.post('/configuracoes', config);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar configurações' };
        }
    }
};

export default authService;
