import { useState, useEffect } from 'react';
import api from '../../services/apiService';

export function useCteOperadores({ confirmarLiberadoCte }) {
    const [operadoresConhecimento, setOperadoresConhecimento] = useState([]);
    const [operadorSelecionado, setOperadorSelecionado] = useState(null);
    const [reenviarCte, setReenviarCte] = useState(null);
    const [operadorReenvio, setOperadorReenvio] = useState(null);

    useEffect(() => {
        api.get('/api/usuarios/conhecimento').then(r => {
            if (r.data?.success) setOperadoresConhecimento(r.data.usuarios);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!confirmarLiberadoCte) return;
        const op = confirmarLiberadoCte.operacao || '';
        const eInterestadual = op === 'LEÃO - SP' || op === 'ELETRIK SUL';
        api.get(`/api/usuarios/conhecimento${eInterestadual ? '?incluirPlanejamento=1' : ''}`).then(r => {
            if (r.data?.success) setOperadoresConhecimento(r.data.usuarios);
        }).catch(() => {});
    }, [confirmarLiberadoCte]);

    return {
        operadoresConhecimento,
        operadorSelecionado, setOperadorSelecionado,
        reenviarCte, setReenviarCte,
        operadorReenvio, setOperadorReenvio,
    };
}
