import { useState, useCallback } from 'react';

export function useApiCall() {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const execute = useCallback(async (fn) => {
        try {
            setLoading(true);
            setErro('');
            return await fn();
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Erro ao processar';
            setErro(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, erro, execute };
}
