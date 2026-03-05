import { create } from 'zustand';

const useConferenteStore = create((set) => ({
    page: 'checklist',          // 'checklist' | 'embarques' | 'checklistForm'
    selectedVeiculo: null,
    toasts: [],

    setPage: (page) => set({ page, selectedVeiculo: null }),
    openChecklistForm: (veiculo) => set({ page: 'checklistForm', selectedVeiculo: veiculo }),
    goBack: () => set({ page: 'checklist', selectedVeiculo: null }),

    addToast: (toast) => set((state) => ({
        toasts: [...state.toasts, { ...toast, id: Date.now() }]
    })),
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    }))
}));

export default useConferenteStore;
