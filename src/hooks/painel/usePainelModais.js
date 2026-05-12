import { useState } from 'react';

export function usePainelModais() {
    const [modalColetasAberto, setModalColetasAberto] = useState(false);
    const [modalChecklistAberto, setModalChecklistAberto] = useState(false);
    const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
    const [modalPausaAberto, setModalPausaAberto] = useState(false);
    const [imagemAmpliada, setImagemAmpliada] = useState(null);
    const [modalEntregasCard, setModalEntregasCard] = useState(null);
    const [modalFrota, setModalFrota] = useState(null);
    const [frotaOrigem, setFrotaOrigem] = useState('');
    const [frotaDestino, setFrotaDestino] = useState('');
    const [loadingPdf, setLoadingPdf] = useState({});
    const [modalLacre, setModalLacre] = useState(null);
    const [modalLinkMotorista, setModalLinkMotorista] = useState(null);
    const [inputColetaModal, setInputColetaModal] = useState(null);
    const [inputColetaValor, setInputColetaValor] = useState('');

    return {
        modalColetasAberto, setModalColetasAberto,
        modalChecklistAberto, setModalChecklistAberto,
        veiculoSelecionado, setVeiculoSelecionado,
        modalPausaAberto, setModalPausaAberto,
        imagemAmpliada, setImagemAmpliada,
        modalEntregasCard, setModalEntregasCard,
        modalFrota, setModalFrota,
        frotaOrigem, setFrotaOrigem,
        frotaDestino, setFrotaDestino,
        loadingPdf, setLoadingPdf,
        modalLacre, setModalLacre,
        modalLinkMotorista, setModalLinkMotorista,
        inputColetaModal, setInputColetaModal,
        inputColetaValor, setInputColetaValor,
    };
}
