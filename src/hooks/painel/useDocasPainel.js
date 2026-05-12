import { useState, useEffect, useCallback } from 'react';
import api from '../../services/apiService';

export function useDocasPainel({ origem, dataInicio, socket }) {
    const [docasInterditadas, setDocasInterditadas] = useState([]);

    useEffect(() => {
        api.get(`/api/docas-interditadas?data=${dataInicio}`).then(r => {
            if (r.data && r.data.success) setDocasInterditadas(r.data.docas);
        }).catch(() => {});

        if (socket) {
            const handleDocas = (payload) => {
                const docas = Array.isArray(payload) ? payload : (payload?.docas || []);
                const dataPayload = Array.isArray(payload) ? null : payload?.data;
                if (!dataPayload || dataPayload === dataInicio) {
                    setDocasInterditadas(docas);
                }
            };
            socket.on('docas_interditadas_update', handleDocas);
            return () => socket.off('docas_interditadas_update', handleDocas);
        }
    }, [socket, dataInicio]);

    const addCardFulgaz = useCallback(() => {
        api.post('/api/docas-interditadas', { unidade: origem, data: dataInicio }).catch(() => {});
    }, [origem, dataInicio]);

    const removerCardFulgaz = useCallback((id) => {
        api.delete(`/api/docas-interditadas/${id}`).catch(() => {});
    }, []);

    const alterarDocaFulgaz = useCallback((id, doca) => {
        api.put(`/api/docas-interditadas/${id}`, { doca }).catch(() => {});
    }, []);

    return { docasInterditadas, addCardFulgaz, removerCardFulgaz, alterarDocaFulgaz };
}
