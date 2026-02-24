import { create } from 'zustand';

/**
 * Store de Dados (Zustand)
 * Gerencia dados voláteis: veículos, cubagens, fila, CTEs
 */
const useDataStore = create((set, get) => ({
    // === ESTADO ===
    veiculos: [],
    cubagens: [],
    cubagemTemp: { itens: [] }, // Para calculadora de cubagem
    fila: [],
    ctesRecife: [],
    ctesMoreno: [],

    // === AÇÕES - VEÍCULOS ===

    /**
     * Definir lista de veículos
     * @param {Array} veiculos - Array de veículos
     */
    setVeiculos: (veiculos) => {
        set({ veiculos });
    },

    /**
     * Adicionar veículo
     * @param {Object} veiculo - Objeto do veículo
     */
    adicionarVeiculo: (veiculo) => {
        set((state) => ({
            veiculos: [...state.veiculos, veiculo]
        }));
    },

    /**
     * Atualizar veículo
     * @param {number} id - ID do veículo
     * @param {Object} updates - Campos a atualizar
     */
    atualizarVeiculo: (id, updates) => {
        set((state) => ({
            veiculos: state.veiculos.map(v =>
                v.id === id ? { ...v, ...updates } : v
            )
        }));
    },

    /**
     * Remover veículo
     * @param {number} id - ID do veículo
     */
    removerVeiculo: (id) => {
        set((state) => ({
            veiculos: state.veiculos.filter(v => v.id !== id)
        }));
    },

    // === AÇÕES - CUBAGENS ===

    /**
     * Definir lista de cubagens
     * @param {Array} cubagens - Array de cubagens
     */
    setCubagens: (cubagens) => {
        set({ cubagens });
    },

    /**
     * Adicionar cubagem
     * @param {Object} cubagem - Objeto da cubagem
     */
    adicionarCubagem: (cubagem) => {
        set((state) => ({
            cubagens: [...state.cubagens, cubagem]
        }));
    },

    /**
     * Atualizar cubagem temporária (calculadora)
     * @param {Object} updates - Campos a atualizar
     */
    atualizarCubagemTemp: (updates) => {
        set((state) => ({
            cubagemTemp: { ...state.cubagemTemp, ...updates }
        }));
    },

    /**
     * Adicionar item à cubagem temporária
     * @param {Object} item - Item da cubagem
     */
    adicionarItemCubagem: (item) => {
        set((state) => ({
            cubagemTemp: {
                ...state.cubagemTemp,
                itens: [...state.cubagemTemp.itens, item]
            }
        }));
    },

    /**
     * Remover item da cubagem temporária
     * @param {number} index - Índice do item
     */
    removerItemCubagem: (index) => {
        set((state) => ({
            cubagemTemp: {
                ...state.cubagemTemp,
                itens: state.cubagemTemp.itens.filter((_, i) => i !== index)
            }
        }));
    },

    /**
     * Limpar cubagem temporária
     */
    limparCubagemTemp: () => {
        set({ cubagemTemp: { itens: [] } });
    },

    // === AÇÕES - FILA ===

    /**
     * Definir fila
     * @param {Array} fila - Array da fila
     */
    setFila: (fila) => {
        set({ fila });
    },

    /**
     * Adicionar item à fila
     * @param {Object} item - Item da fila
     */
    adicionarNaFila: (item) => {
        set((state) => ({
            fila: [...state.fila, item]
        }));
    },

    /**
     * Remover item da fila
     * @param {number} id - ID do item
     */
    removerDaFila: (id) => {
        set((state) => ({
            fila: state.fila.filter(item => item.id !== id)
        }));
    },

    /**
     * Reordenar fila (drag and drop)
     * @param {number} fromIndex - Índice de origem
     * @param {number} toIndex - Índice de destino
     */
    reordenarFila: (fromIndex, toIndex) => {
        set((state) => {
            const novaFila = [...state.fila];
            const [item] = novaFila.splice(fromIndex, 1);
            novaFila.splice(toIndex, 0, item);
            return { fila: novaFila };
        });
    },

    // === AÇÕES - CTEs ===

    /**
     * Adicionar CTE (Recife ou Moreno)
     * @param {Object} cte - Objeto do CTE
     * @param {string} unidade - 'Recife' ou 'Moreno'
     */
    adicionarCte: (cte, unidade) => {
        set((state) => ({
            [unidade === 'Recife' ? 'ctesRecife' : 'ctesMoreno']: [
                ...state[unidade === 'Recife' ? 'ctesRecife' : 'ctesMoreno'],
                cte
            ]
        }));
    },

    /**
     * Atualizar status de CTE
     * @param {number} id - ID do CTE
     * @param {string} status - Novo status
     * @param {string} unidade - 'Recife' ou 'Moreno'
     */
    atualizarStatusCte: (id, status, unidade) => {
        const campo = unidade === 'Recife' ? 'ctesRecife' : 'ctesMoreno';
        set((state) => ({
            [campo]: state[campo].map(cte =>
                cte.id === id ? { ...cte, status } : cte
            )
        }));
    }
}));

export default useDataStore;
