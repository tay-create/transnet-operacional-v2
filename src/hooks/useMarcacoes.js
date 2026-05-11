import { useState, useCallback, useRef } from 'react';
import api from '../services/apiService';

export function useMarcacoes() {
    const [marcacoes, setMarcacoes] = useState([]);
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [erro, setErro] = useState(null);

    const abortRef = useRef(null);

    // ── Leitura ──────────────────────────────────────────────────────────────

    const carregarMarcacoes = useCallback(async (filtros = {}) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        setLoading(true);
        setErro(null);
        try {
            const res = await api.get('/api/marcacoes', {
                params: filtros,
                signal: abortRef.current.signal,
            });
            if (res.data.success) {
                setMarcacoes(res.data.marcacoes || []);
            }
        } catch (e) {
            if (e.name !== 'CanceledError' && e.name !== 'AbortError' && e.code !== 'ERR_CANCELED') {
                setErro(e.message);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const carregarTokens = useCallback(async () => {
        setLoadingTokens(true);
        try {
            const res = await api.get('/api/tokens');
            if (res.data.success) setTokens(res.data.tokens || []);
        } catch (e) {
            console.error('Erro ao carregar tokens:', e);
        } finally {
            setLoadingTokens(false);
        }
    }, []);

    // ── Ações sobre tokens ────────────────────────────────────────────────────

    const criarToken = useCallback(async (telefone) => {
        const res = await api.post('/api/tokens', { telefone });
        if (!res.data?.success) {
            throw new Error(res.data?.message || 'Erro ao criar token');
        }
        return res.data.token;
    }, []);

    const atualizarToken = useCallback(async (id, status) => {
        await api.put(`/api/tokens/${id}`, { status });
        setTokens(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    }, []);

    const deletarToken = useCallback(async (id) => {
        await api.delete(`/api/tokens/${id}`);
        setTokens(prev => prev.filter(t => t.id !== id));
    }, []);

    // ── Ações sobre marcações ─────────────────────────────────────────────────

    const deletarMarcacao = useCallback(async (id) => {
        await api.delete(`/api/marcacoes/${id}`);
        setMarcacoes(prev => prev.filter(m => m.id !== id));
    }, []);

    // Atualiza disponibilidade (status local — campo disponibilidade)
    const atualizarStatus = useCallback(async (id, status) => {
        const res = await api.put(`/api/marcacoes/${id}/status`, { status });
        if (res.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, disponibilidade: status } : m));
        }
    }, []);

    // Atualiza status_operacional
    const atualizarStatusOperacional = useCallback(async (id, status) => {
        const res = await api.put(`/api/marcacoes/${id}/status`, { status_operacional: status });
        if (res.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, status_operacional: status } : m));
        }
    }, []);

    // Atualiza tag (favorito, tag_motorista, etc.)
    const atualizarTag = useCallback(async (id, body) => {
        const res = await api.put(`/api/marcacoes/${id}/tag`, body);
        if (res.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, ...body } : m));
        }
    }, []);

    return {
        // Estado
        marcacoes,
        tokens,
        loading,
        loadingTokens,
        erro,

        // Ações de leitura
        carregarMarcacoes,
        carregarTokens,

        // Ações sobre tokens
        criarToken,
        atualizarToken,
        deletarToken,

        // Ações sobre marcações
        deletarMarcacao,
        atualizarStatus,
        atualizarStatusOperacional,
        atualizarTag,

        // Expose setMarcacoes for socket-driven updates in the component
        setMarcacoes,
    };
}
