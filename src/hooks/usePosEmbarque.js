import { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';

export function usePosEmbarque() {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [listas, setListas] = useState({ motoristas: [], clientes: [], motivos: [] });
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState(null);

    // Auto-load listas on mount
    useEffect(() => {
        const carregar = async () => {
            try {
                const res = await api.get('/api/posembarque/listas');
                if (res.data.success) {
                    setListas({
                        motoristas: res.data.motoristas || [],
                        clientes: res.data.clientes || [],
                        motivos: res.data.motivos || [],
                    });
                }
            } catch (e) {
                console.error('Erro ao carregar listas:', e);
            }
        };
        carregar();
    }, []);

    // ── Leitura ──────────────────────────────────────────────────────────

    const carregarOcorrencias = useCallback(async (busca = '', filtroSituacao = '') => {
        setLoading(true);
        setErro(null);
        try {
            const res = await api.get('/api/posembarque/ocorrencias', {
                params: { busca, situacao: filtroSituacao, arquivado: 0 },
            });
            if (res.data.success) setOcorrencias(res.data.ocorrencias || []);
        } catch (e) {
            console.error('Erro ao carregar ocorrências:', e);
            setErro(e?.response?.data?.message || 'Erro ao carregar ocorrências');
        } finally {
            setLoading(false);
        }
    }, []);

    const carregarRelatorio = useCallback(async (params) => {
        try {
            const res = await api.get('/api/posembarque/relatorio', { params });
            if (res.data.success) return res.data;
        } catch (e) {
            console.error('Erro ao carregar relatório:', e);
            throw e;
        }
        return null;
    }, []);

    // ── Escrita ──────────────────────────────────────────────────────────

    const criarOcorrencia = useCallback(async (form) => {
        const res = await api.post('/api/posembarque/ocorrencias', form);
        if (!res.data?.success) {
            throw new Error(res.data?.message || 'Erro ao criar ocorrência');
        }
        return res.data.ocorrencia;
    }, []);

    const resolverOcorrencia = useCallback(async (id) => {
        await api.post(`/api/posembarque/ocorrencias/${id}/resolver`);
    }, []);

    const editarOcorrencia = useCallback(async (id, form) => {
        const res = await api.put(`/api/posembarque/ocorrencias/${id}`, form);
        if (!res.data?.success) {
            throw new Error(res.data?.message || 'Erro ao atualizar ocorrência');
        }
        return res.data.ocorrencia;
    }, []);

    const arquivarResolvidas = useCallback(async (lista) => {
        for (const oc of lista) {
            await api.post(`/api/posembarque/ocorrencias/${oc.id}/arquivar`);
        }
    }, []);

    const deletarOcorrencia = useCallback(async (id) => {
        await api.delete(`/api/posembarque/ocorrencias/${id}`);
    }, []);

    const adicionarFoto = useCallback(async (id, base64) => {
        await api.post(`/api/posembarque/ocorrencias/${id}/fotos`, {
            base64,
            nome: `foto_${Date.now()}.jpg`,
        });
    }, []);

    const deletarFoto = useCallback(async (id, index) => {
        await api.delete(`/api/posembarque/ocorrencias/${id}/fotos/${index}`);
    }, []);

    return {
        // Estado
        ocorrencias,
        listas,
        loading,
        erro,

        // Leitura
        carregarOcorrencias,
        carregarRelatorio,

        // Escrita
        criarOcorrencia,
        resolverOcorrencia,
        editarOcorrencia,
        arquivarResolvidas,
        deletarOcorrencia,
        adicionarFoto,
        deletarFoto,
    };
}
