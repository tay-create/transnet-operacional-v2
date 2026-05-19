import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/apiService';

// Hook que busca a geometria de rota (pernas OSRM) de um veículo.
//
// Estado de `pernas`:
//   null  → ainda carregando ou sem fetch disparado
//   []    → fetch terminou em erro/sem dados (frontend deve usar fallback linha reta)
//   [...] → array de pernas com { distancia_metros, duracao_segundos, geometry: { coordinates: [[lon,lat],...] } }
//
// Reflete o endpoint GET /veiculos/:id/rota-geometria do backend. Não cobre o caso POST preview
// (usado pelo ModalRotaCard desktop ao reordenar destinos localmente) — esse fica inline no desktop.
export default function useRotaGeometria(veiculoId, { ativo = true } = {}) {
    const [pernas, setPernas] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);
    const abortRef = useRef(null);

    const recarregar = useCallback(async () => {
        if (!veiculoId) {
            setPernas(null);
            return;
        }
        // Cancela request anterior em voo (race em troca rápida de veiculoId).
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setCarregando(true);
        setErro(null);
        try {
            const r = await api.get(`/veiculos/${veiculoId}/rota-geometria`, { signal: controller.signal });
            if (controller.signal.aborted) return;
            setPernas(Array.isArray(r.data?.pernas) ? r.data.pernas : []);
        } catch (err) {
            if (controller.signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
            console.error('[useRotaGeometria] falha:', err);
            setErro(err?.message || 'Erro ao buscar rota');
            setPernas([]);
        } finally {
            if (!controller.signal.aborted) setCarregando(false);
        }
    }, [veiculoId]);

    useEffect(() => {
        if (!ativo || !veiculoId) {
            setPernas(null);
            return;
        }
        recarregar();
    }, [ativo, veiculoId, recarregar]);

    // Cleanup: aborta fetch em voo quando hook desmonta.
    useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

    return { pernas, carregando, erro, recarregar };
}

// Rótulo "CIDADE/UF" de um destino, com fallback pro cidade_uf legado.
export function cidadeUfLabel(d) {
    if (d?.cidade && d?.uf) return `${d.cidade}/${d.uf}`;
    if (d?.cidade_uf) return d.cidade_uf;
    return '—';
}
