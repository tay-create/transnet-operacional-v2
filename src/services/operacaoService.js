import api from './apiService';

/**
 * Serviço de Operações
 * Centraliza chamadas para veículos, cubagens, fila e CTEs
 */

const operacaoService = {
    // === VEÍCULOS ===

    /**
     * Obter lista de veículos
     * @returns {Promise<Array>}
     */
    getVeiculos: async () => {
        try {
            const response = await api.get('/veiculos');
            return response.data.veiculos || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar veículos' };
        }
    },

    /**
     * Criar novo veículo/lançamento
     * @param {Object} veiculo - Dados do veículo
     * @returns {Promise<Object>}
     */
    criarVeiculo: async (veiculo) => {
        try {
            const response = await api.post('/veiculos', veiculo);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao criar veículo' };
        }
    },

    /**
     * Atualizar veículo
     * @param {number} id - ID do veículo
     * @param {Object} updates - Campos a atualizar
     * @returns {Promise<Object>}
     */
    atualizarVeiculo: async (id, updates) => {
        try {
            const response = await api.put(`/veiculos/${id}`, updates);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar veículo' };
        }
    },

    /**
     * Deletar veículo
     * @param {number} id - ID do veículo
     * @returns {Promise<Object>}
     */
    deletarVeiculo: async (id) => {
        try {
            const response = await api.delete(`/veiculos/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao deletar veículo' };
        }
    },

    // === CUBAGENS ===

    /**
     * Obter lista de cubagens
     * @returns {Promise<Array>}
     */
    getCubagens: async () => {
        try {
            const response = await api.get('/cubagens');
            return response.data.cubagens || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar cubagens' };
        }
    },

    /**
     * Buscar cubagem por número de coleta
     * @param {string} numeroColeta - Número da coleta
     * @returns {Promise<Object|null>}
     */
    getCubagemPorColeta: async (numeroColeta) => {
        try {
            const response = await api.get(`/cubagens/coleta/${numeroColeta}`);
            return response.data.cubagem || null;
        } catch (error) {
            console.warn(`Cubagem não encontrada para coleta ${numeroColeta}`);
            return null;
        }
    },

    /**
     * Criar nova cubagem
     * @param {Object} cubagem - Dados da cubagem
     * @returns {Promise<Object>}
     */
    criarCubagem: async (cubagem) => {
        try {
            const response = await api.post('/cubagens', cubagem);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao criar cubagem' };
        }
    },

    /**
     * Atualizar cubagem
     * @param {number} id - ID da cubagem
     * @param {Object} updates - Campos a atualizar
     * @returns {Promise<Object>}
     */
    atualizarCubagem: async (id, updates) => {
        try {
            const response = await api.put(`/cubagens/${id}`, updates);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar cubagem' };
        }
    },

    /**
     * Deletar cubagem
     * @param {number} id - ID da cubagem
     * @returns {Promise<Object>}
     */
    deletarCubagem: async (id) => {
        try {
            const response = await api.delete(`/cubagens/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao deletar cubagem' };
        }
    },

    // === FILA ===

    /**
     * Obter fila
     * @returns {Promise<Array>}
     */
    getFila: async () => {
        try {
            const response = await api.get('/fila');
            return response.data.fila || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar fila' };
        }
    },

    /**
     * Adicionar item à fila
     * @param {Object} item - Item da fila
     * @returns {Promise<Object>}
     */
    adicionarNaFila: async (item) => {
        try {
            const response = await api.post('/fila', item);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao adicionar na fila' };
        }
    },

    /**
     * Atualizar item da fila
     * @param {number} id - ID do item
     * @param {Object} updates - Campos a atualizar
     * @returns {Promise<Object>}
     */
    atualizarFila: async (id, updates) => {
        try {
            const response = await api.put(`/fila/${id}`, updates);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao atualizar fila' };
        }
    },

    /**
     * Deletar item da fila
     * @param {number} id - ID do item
     * @returns {Promise<Object>}
     */
    deletarDaFila: async (id) => {
        try {
            const response = await api.delete(`/fila/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao remover da fila' };
        }
    },

    // === NOTIFICAÇÕES ===

    /**
     * Obter notificações
     * @returns {Promise<Array>}
     */
    getNotificacoes: async () => {
        try {
            const response = await api.get('/notificacoes');
            return response.data.notificacoes || [];
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao buscar notificações' };
        }
    },

    /**
     * Deletar notificação
     * @param {number} id - ID da notificação
     * @returns {Promise<Object>}
     */
    deletarNotificacao: async (id) => {
        try {
            const response = await api.delete(`/notificacoes/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Erro ao deletar notificação' };
        }
    }
};

export default operacaoService;
