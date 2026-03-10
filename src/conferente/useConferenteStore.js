import { create } from 'zustand';

const useConferenteStore = create((set) => ({
    page: 'checklist',          // 'checklist' | 'embarques' | 'checklistForm'
    selectedVeiculo: null,
    toasts: [],
    refreshKey: 0,

    setPage: (page) => set({ page, selectedVeiculo: null }),
    triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
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
