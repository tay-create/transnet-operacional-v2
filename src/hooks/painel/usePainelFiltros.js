import { useState, useEffect, useMemo } from 'react';
import { obterDataBrasilia } from '../../utils/helpers';
import { ehOperacaoRecife, ehOperacaoMoreno, normalizarStatusInterestadual, getCampoStatus } from '../../utils/operacaoUtils';
import { OPCOES_STATUS } from '../../constants';

export function usePainelFiltros({ origem, lista, operacoesFixas, termoBusca }) {
    const campoStatus = getCampoStatus(origem, operacoesFixas);

    const [dataInicio, setDataInicio] = useState(() => {
        const salvo = localStorage.getItem('filtro_data_inicio_' + origem);
        const hoje = obterDataBrasilia();
        if (operacoesFixas) {
            if (salvo) return salvo;
            const d = new Date(hoje + 'T00:00:00');
            d.setDate(d.getDate() - 30);
            return d.toISOString().substring(0, 10);
        }
        return hoje;
    });

    const [dataFim, setDataFim] = useState(() => {
        const salvo = localStorage.getItem('filtro_data_fim_' + origem);
        const hoje = obterDataBrasilia();
        if (operacoesFixas) {
            if (salvo) return salvo;
            const d = new Date(hoje + 'T00:00:00');
            d.setDate(d.getDate() + 30);
            return d.toISOString().substring(0, 10);
        }
        return hoje;
    });

    const [filtroOperacao, setFiltroOperacao] = useState('');

    useEffect(() => {
        const calcularMsAteMeiaNoite = () => {
            const agora = new Date();
            const agoraBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const meiaNoiteBrasilia = new Date(agoraBrasilia);
            meiaNoiteBrasilia.setHours(24, 0, 0, 0);
            return meiaNoiteBrasilia - agoraBrasilia;
        };
        let timeout;
        const agendarVirada = () => {
            const msRestantes = calcularMsAteMeiaNoite();
            timeout = setTimeout(() => {
                const novaData = obterDataBrasilia();
                setDataInicio(novaData);
                setDataFim(novaData);
                localStorage.setItem('filtro_data_inicio_' + origem, novaData);
                localStorage.setItem('filtro_data_fim_' + origem, novaData);
                agendarVirada();
            }, msRestantes);
        };
        agendarVirada();
        return () => clearTimeout(timeout);
    }, [origem]);

    const itensFiltrados = useMemo(() => lista.filter(item => {
        const dataCarregadoUnidade = operacoesFixas ? null : (origem === 'Recife' ? item.data_carregado_recife : item.data_carregado_moreno);
        const dpUnidadeFiltro = origem === 'Recife'
            ? (item.data_prevista_recife || item.data_prevista)
            : (item.data_prevista_moreno || item.data_prevista);
        const rawData = dataCarregadoUnidade || dpUnidadeFiltro || obterDataBrasilia();
        const itemData = String(rawData).substring(0, 10);
        const ehDataCerta = itemData >= dataInicio && itemData <= dataFim;

        const op = item.operacao || '';
        const operacaoEnvolveOrigem = origem === 'Recife' ? ehOperacaoRecife(op) : ehOperacaoMoreno(op);
        if (!operacoesFixas && !operacaoEnvolveOrigem) return false;

        const meuStatus = normalizarStatusInterestadual(item, item[campoStatus] || 'AGUARDANDO');
        const buscaLower = termoBusca.toLowerCase();
        const bateuBusca =
            (item.coletaRecife && item.coletaRecife.toLowerCase().includes(buscaLower)) ||
            (item.coletaMoreno && item.coletaMoreno.toLowerCase().includes(buscaLower)) ||
            (item.coletaInterestadual && item.coletaInterestadual.toLowerCase().includes(buscaLower)) ||
            (item.motorista && item.motorista.toLowerCase().includes(buscaLower)) ||
            (item.placa && item.placa.toLowerCase().includes(buscaLower)) ||
            (meuStatus && meuStatus.toLowerCase().includes(buscaLower));

        const bateuOperacao = operacoesFixas
            ? operacoesFixas.includes(item.operacao || '')
            : (!filtroOperacao || (item.operacao || '') === filtroOperacao);

        return ehDataCerta && bateuBusca && bateuOperacao;
    }), [lista, dataInicio, dataFim, termoBusca, filtroOperacao, operacoesFixas, origem, campoStatus]); // eslint-disable-line

    const itensOrdenados = useMemo(() => [...itensFiltrados].sort((a, b) => {
        const sa = normalizarStatusInterestadual(a, a[campoStatus] || OPCOES_STATUS[0]);
        const sb = normalizarStatusInterestadual(b, b[campoStatus] || OPCOES_STATUS[0]);
        return OPCOES_STATUS.indexOf(sa) - OPCOES_STATUS.indexOf(sb);
    }), [itensFiltrados, campoStatus]); // eslint-disable-line

    return {
        dataInicio, setDataInicio,
        dataFim, setDataFim,
        filtroOperacao, setFiltroOperacao,
        itensFiltrados, itensOrdenados,
        campoStatus,
    };
}
