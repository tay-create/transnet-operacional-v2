import { useCallback } from 'react';
import { ehOperacaoRecife, ehOperacaoMoreno } from '../../utils/operacaoUtils';

// Ao mudar a operacao, limpar campos de unidades removidas e aplicar regras de parada
const handleOperacaoChangeImpl = async (item, novaOperacao, funcoes, lista, setLista, realIndex, api, coletaOverride = null) => {
    const { updateList, mostrarNotificacao, pedirCopiaColeta } = funcoes;
    const precisaRecife = ehOperacaoRecife(novaOperacao);
    const precisaMoreno = ehOperacaoMoreno(novaOperacao);

    // Backup para reverter em caso de erro
    const itemOriginal = { ...lista[realIndex] };

    // Quando a nova unidade exigida está sem coleta, oferecer copiar da outra unidade via modal
    const coletaRecifeAtual = (lista[realIndex].coletaRecife || '').trim();
    const coletaMorenoAtual = (lista[realIndex].coletaMoreno || '').trim();
    const { pedirInputColeta } = funcoes;
    if (!coletaOverride && precisaRecife && !coletaRecifeAtual) {
        if (coletaMorenoAtual && pedirCopiaColeta) {
            pedirCopiaColeta({
                unidadeDestino: 'Recife',
                coletaOrigem: coletaMorenoAtual,
                unidadeOrigem: 'Moreno',
                onConfirm: () => handleOperacaoChangeImpl(item, novaOperacao, funcoes, lista, setLista, realIndex, api, { campo: 'coletaRecife', valor: coletaMorenoAtual }),
                onRecusar: pedirInputColeta ? () => pedirInputColeta('Recife', (coleta) => handleOperacaoChangeImpl(item, novaOperacao, funcoes, lista, setLista, realIndex, api, { campo: 'coletaRecife', valor: coleta })) : null
            });
            return;
        }
        mostrarNotificacao('⚠️ Defina a coleta de Recife antes de trocar para esta operação.');
        return;
    }
    if (!coletaOverride && precisaMoreno && !coletaMorenoAtual) {
        if (coletaRecifeAtual && pedirCopiaColeta) {
            pedirCopiaColeta({
                unidadeDestino: 'Moreno',
                coletaOrigem: coletaRecifeAtual,
                unidadeOrigem: 'Recife',
                onConfirm: () => handleOperacaoChangeImpl(item, novaOperacao, funcoes, lista, setLista, realIndex, api, { campo: 'coletaMoreno', valor: coletaRecifeAtual }),
                onRecusar: pedirInputColeta ? () => pedirInputColeta('Moreno', (coleta) => handleOperacaoChangeImpl(item, novaOperacao, funcoes, lista, setLista, realIndex, api, { campo: 'coletaMoreno', valor: coleta })) : null
            });
            return;
        }
        mostrarNotificacao('⚠️ Defina a coleta de Moreno antes de trocar para esta operação.');
        return;
    }

    // Construir objeto com todas as mudancas de uma vez
    const novaLista = [...lista];
    const itemAtualizado = { ...novaLista[realIndex], operacao: novaOperacao };
    if (coletaOverride && coletaOverride.campo) {
        itemAtualizado[coletaOverride.campo] = coletaOverride.valor;
    }

    if (!precisaRecife) {
        itemAtualizado.coletaRecife = '';
        itemAtualizado.rotaRecife = '';
        itemAtualizado.status_recife = 'AGUARDANDO P/ SEPARAÇÃO';
        itemAtualizado.doca_recife = 'SELECIONE';
    }
    if (!precisaMoreno) {
        itemAtualizado.coletaMoreno = '';
        itemAtualizado.rotaMoreno = '';
        itemAtualizado.status_moreno = 'AGUARDANDO P/ SEPARAÇÃO';
        itemAtualizado.doca_moreno = 'SELECIONE';
    }

    // Regra automatica de 1a e 2a parada
    const origemCriacao = item.origem_criacao || '';
    const criouEmMoreno = origemCriacao === 'Moreno' || origemCriacao === 'Porcelana' || origemCriacao === 'Eletrik' || origemCriacao === 'Delta Moreno';
    const criouEmRecife = origemCriacao === 'Recife';

    // Corrigir unidade/origem_criacao baseado na operação, não em quem criou
    if (!precisaRecife && precisaMoreno) {
        itemAtualizado.unidade = 'Moreno';
        itemAtualizado.origem_criacao = 'Moreno';
        itemAtualizado.inicio_rota = 'Moreno';
    } else if (precisaRecife && !precisaMoreno) {
        itemAtualizado.unidade = 'Recife';
        itemAtualizado.origem_criacao = 'Recife';
        itemAtualizado.inicio_rota = 'Recife';
    }
    // misto: manter origem_criacao existente (define 1ª parada)

    if (precisaRecife && precisaMoreno) {
        // Operacao mista: definir paradas baseado na origem de criacao
        if (criouEmMoreno) {
            itemAtualizado.primeira_parada = 'Moreno';
            itemAtualizado.segunda_parada = 'Recife';
        } else if (criouEmRecife) {
            itemAtualizado.primeira_parada = 'Recife';
            itemAtualizado.segunda_parada = 'Moreno';
        }
    } else {
        // Operacao de unidade unica: limpar paradas
        itemAtualizado.primeira_parada = '';
        itemAtualizado.segunda_parada = '';
    }

    novaLista[realIndex] = itemAtualizado;
    setLista(novaLista);

    // Persistir no backend em uma unica chamada
    if (itemAtualizado.id && api) {
        try {
            await api.put(`/veiculos/${itemAtualizado.id}`, itemAtualizado);
            mostrarNotificacao?.(`✅ Operação alterada: ${novaOperacao}`);
        } catch (err) {
            console.error("Erro ao salvar mudanca de operacao:", err);
            const msg = err.response?.data?.message || "Erro ao salvar mudança de operação.";
            mostrarNotificacao?.(`⚠️ ${msg}`);

            // Reverte o estado local em caso de erro
            setLista(prev => {
                const revertida = [...prev];
                revertida[realIndex] = itemOriginal;
                return revertida;
            });
        }
    }
};

// Reprograma item: chama endpoint dedicado e atualiza estado local.
// foiReprogramado=1 ao avançar ou mudar data; foiReprogramado=0 ao voltar para hoje.
// unidade ('Recife'|'Moreno'|undefined): se preenchido, reprograma só o lado;
// senão sincroniza ambos (comportamento legado).
const reprogramarItemImpl = async (lista, setLista, realIndex, novaData, api, mostrarNotificacao, foiReprogramado = 1, unidade) => {
    const item = lista[realIndex];
    if (!item?.id) return;
    const ladoLower = unidade ? String(unidade).toLowerCase() : undefined;
    const consolidado = String(item.operacao || '').includes('/');
    const novaLista = [...lista];
    const itemAtualizado = { ...item, foi_reprogramado: foiReprogramado };
    if (ladoLower === 'recife' && consolidado) {
        itemAtualizado.data_prevista_recife = novaData;
        // guarda-chuva otimista = menor das duas
        const outraData = item.data_prevista_moreno || novaData;
        itemAtualizado.data_prevista = (novaData < outraData) ? novaData : outraData;
    } else if (ladoLower === 'moreno' && consolidado) {
        itemAtualizado.data_prevista_moreno = novaData;
        const outraData = item.data_prevista_recife || novaData;
        itemAtualizado.data_prevista = (novaData < outraData) ? novaData : outraData;
    } else {
        // Não-consolidado ou sem lado especificado: força os 3 iguais
        itemAtualizado.data_prevista = novaData;
        itemAtualizado.data_prevista_recife = novaData;
        itemAtualizado.data_prevista_moreno = novaData;
    }
    novaLista[realIndex] = itemAtualizado;
    setLista(novaLista);
    try {
        await api.put(`/veiculos/${item.id}/reprogramar`, {
            nova_data: novaData,
            foi_reprogramado: foiReprogramado,
            ...(ladoLower ? { unidade: ladoLower } : {}),
        });
        // Marcar "R" na planilha (Col B) só quando reprograma de fato.
        // foiReprogramado=0 significa volta pra hoje (desfaz reprogramação) — não marca R.
        if (foiReprogramado === 1) {
            const extrairNums = (s) => String(s || '').split(/[\s,|]+/)
                .map(t => t.replace(/^(PLAS|PORC|ELET):\s*/i, '').trim().replace(/^0+/, ''))
                .filter(Boolean);
            const coletas = [];
            if (!ladoLower || ladoLower === 'recife') coletas.push(...extrairNums(item.coletaRecife));
            if (!ladoLower || ladoLower === 'moreno') coletas.push(...extrairNums(item.coletaMoreno));
            if (coletas.length === 0) extrairNums(item.coletaInterestadual).forEach(c => coletas.push(c));
            if (coletas.length > 0) {
                api.post('/api/planilha/marcar-reprogramada', { coletas })
                    .catch(err => console.error('[reprogramar] falha ao marcar R na planilha:', err?.message));
            }
        }
    } catch (err) {
        console.error('Erro ao reprogramar:', err);
        mostrarNotificacao?.('⚠️ Erro ao reprogramar. Recarregue a página.');
        setLista(prev => { const r = [...prev]; r[realIndex] = item; return r; });
    }
};

export function useOperacaoActions() {
    const handleOperacaoChange = useCallback(handleOperacaoChangeImpl, []);
    const reprogramarItem = useCallback(reprogramarItemImpl, []);
    return { handleOperacaoChange, reprogramarItem };
}
