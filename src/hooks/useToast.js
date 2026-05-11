import { useState, useCallback, useMemo } from 'react';

export function useToast(duracao = 3000) {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((msg, tipo = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracao);
    }, [duracao]);

    const toast = useMemo(() => ({
        success: (msg) => add(msg, 'success'),
        error:   (msg) => add(msg, 'erro'),
        info:    (msg) => add(msg, 'info'),
    }), [add]);

    return { toasts, toast };
}
