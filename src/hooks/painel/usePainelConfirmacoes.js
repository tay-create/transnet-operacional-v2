import { useState } from 'react';

export function usePainelConfirmacoes() {
    const [confirmarLiberadoCte, setConfirmarLiberadoCte] = useState(null);
    const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
    const [proximaDataFinalizar, setProximaDataFinalizar] = useState(null);
    const [modalEscolhaDia, setModalEscolhaDia] = useState(false);
    const [confirmarReprogramar, setConfirmarReprogramar] = useState(null);
    const [confirmarMisto, setConfirmarMisto] = useState(null);
    const [confirmarLiberarChecklist, setConfirmarLiberarChecklist] = useState(null);
    const [confirmarCopiaColeta, setConfirmarCopiaColeta] = useState(null);
    const [finalizando, setFinalizando] = useState(false);

    return {
        confirmarLiberadoCte, setConfirmarLiberadoCte,
        confirmarFinalizar, setConfirmarFinalizar,
        proximaDataFinalizar, setProximaDataFinalizar,
        modalEscolhaDia, setModalEscolhaDia,
        confirmarReprogramar, setConfirmarReprogramar,
        confirmarMisto, setConfirmarMisto,
        confirmarLiberarChecklist, setConfirmarLiberarChecklist,
        confirmarCopiaColeta, setConfirmarCopiaColeta,
        finalizando, setFinalizando,
    };
}
