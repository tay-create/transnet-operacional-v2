import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, ChevronDown, AlertCircle, CheckCircle, Loader, Trash2, MapPin, CalendarPlus } from 'lucide-react';
import { OPCOES_OPERACAO, OPCOES_VEICULO } from '../constants';
import { joinColetaMoreno } from '../utils/coletaMoreno';
import api from '../services/apiService';
import ModalEntregasProvisao from './ModalEntregasProvisao';
import ModalWrapper from './ModalWrapper';

// ── Helpers de mapeamento ──────────────────────────────────────────────────

function obterDataBrasiliaISO() {
    return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        .split('/').reverse().join('-');
}

// Converte "11/05/2026", Date object ou Excel serial number para "YYYY-MM-DD". Vazio se inválido.
function parseDataPrevisao(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    // xlsx pode entregar Date object quando cellDates:true
    if (valor instanceof Date && !isNaN(valor)) {
        const y = valor.getFullYear();
        const m = String(valor.getMonth() + 1).padStart(2, '0');
        const d = String(valor.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    // Excel serial number (dias desde 1900-01-01, ajustado pelo bug do 1900)
    if (typeof valor === 'number' && valor > 25569 && valor < 80000) {
        // 25569 = dias entre 1900-01-01 e 1970-01-01. valor*86400000 = ms desde epoch
        const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
        if (!isNaN(d)) {
            const y = d.getUTCFullYear();
            const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
            const da = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${mo}-${da}`;
        }
    }
    const s = String(valor).trim();
    // dd/mm/yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
    // yyyy-mm-dd
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return s;
    return '';
}

function mapearOperacao(textoCSV) {
    const t = (textoCSV || '').toUpperCase().trim();
    // LEÃO ALIMENTOS E BEBIDAS → operação interestadual Leão - SP
    if (t.includes('LEAO') || t.includes('LEÃO')) return 'LEÃO - SP';
    if (t.includes('PORCELANA') && t.includes('ELETRIK')) return 'PORCELANA/ELETRIK';
    if (t.includes('PORCELANA')) return 'PORCELANA';
    if (t.includes('ELETRIK')) return 'ELETRIK'; // ambiguidade — modal vai resolver
    // "TRAMONTINA DELTA S/A" sem sufixo → PLÁSTICO(RECIFE)
    return 'PLÁSTICO(RECIFE)';
}

function mapearTipoVeiculo(textoCSV) {
    const t = (textoCSV || '').toUpperCase().trim();
    if (t.includes('3/4') || t === '3/4') return '3/4';
    if (t.includes('CARRETA')) return 'CARRETA';
    if (t.includes('SIDER')) return 'SIDER';
    if (t.includes('TRUCK')) return 'TRUCK';
    return 'TRUCK';
}

function limparNumeroColeta(num) {
    const s = String(num || '').trim();
    // Remove zeros à esquerda
    return s.replace(/^0+/, '') || s;
}

function extrairRota(obs) {
    const s = (obs || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const match = s.match(/ROTA\s+(\d+)/i);
    const rota = match ? match[1] : '';
    const obsRestante = s
        .replace(/ROTA\s+\d+/gi, '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join(' - ');
    return { rota, obsRestante };
}

// Determina qual operação combinada resulta da fusão de duas operações base
function combinarOperacoes(opA, opB) {
    const temRecife = (op) => op.includes('RECIFE') || op === 'PLÁSTICO(RECIFE)';
    const temMoreno = (op) => op.includes('MORENO') || op.includes('RECIFE X MORENO');
    const temPorcelana = (op) => op.includes('PORCELANA');
    const temEletrik = (op) => op.includes('ELETRIK') && !op.includes('ELETRIK SUL');

    const ops = [opA, opB];
    const hasRecife = ops.some(temRecife);
    const hasMoreno = ops.some(temMoreno);
    const hasPorcelana = ops.some(temPorcelana);
    const hasEletrik = ops.some(temEletrik);

    // Combinações possíveis com RECIFE
    if (hasRecife && hasPorcelana && hasEletrik) return 'PLÁSTICO(RECIFE)/PORCELANA/ELETRIK';
    if (hasRecife && hasPorcelana) return 'PLÁSTICO(RECIFE)/PORCELANA';
    if (hasRecife && hasEletrik) return 'PLÁSTICO(RECIFE)/ELETRIK';
    if (hasRecife && hasMoreno) return 'PLÁSTICO(RECIFE X MORENO)';

    // Combinações Moreno
    if (hasMoreno && hasPorcelana && hasEletrik) return 'PLÁSTICO(MORENO)/PORCELANA/ELETRIK';
    if (hasMoreno && hasPorcelana) return 'PLÁSTICO(MORENO)/PORCELANA';
    if (hasMoreno && hasEletrik) return 'PLÁSTICO(MORENO)/ELETRIK';

    // Apenas porcelana + eletrik
    if (hasPorcelana && hasEletrik) return 'PORCELANA/ELETRIK';

    // Caso base: usa opA
    return opA;
}

// Extrai coletas do lote bruto para os slots corretos
function extrairColetas(operacaoBase, numeroColeta) {
    const op = operacaoBase;
    const coleta = limparNumeroColeta(numeroColeta);
    const ehRecife = op === 'PLÁSTICO(RECIFE)' || op === 'PLÁSTICO(RECIFE X MORENO)';
    const ehMoreno = op === 'PLÁSTICO(MORENO)';
    const ehPorcelana = op === 'PORCELANA' || op === 'PORCELANA/ELETRIK';
    const ehEletrik = op === 'ELETRIK';
    const ehInterestadual = op === 'LEÃO - SP' || op === 'ELETRIK SUL';

    return {
        coletaRecife: ehRecife ? coleta : '',
        coletaInterestadual: ehInterestadual ? coleta : '',
        slots: {
            plastico: ehMoreno ? coleta : '',
            porcelana: ehPorcelana ? coleta : '',
            eletrik: ehEletrik ? coleta : '',
        }
    };
}

function gerarId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Extrai apenas os números de coleta de uma string que pode conter prefixos
// (PLAS:, PORC:, ELET:), separadores (|, ,) e espaços. Retorna array de strings limpas.
// Exemplos:
//   "PLAS:1216 | PORC:1304" -> ["1216", "1304"]
//   "1318" -> ["1318"]
//   "1213,PORC:1317" -> ["1213", "1317"]
function extrairNumerosColeta(str) {
    if (!str) return [];
    return String(str)
        .split(/[|,]/)
        .map(p => p.trim().replace(/^(PLAS|PORC|ELET):\s*/i, '').trim())
        .filter(Boolean);
}

// Consolidar linhas com mesma placa+data em 1 LoteItem (placas iguais em datas diferentes viram lotes separados)
function consolidarPorPlaca(linhasBrutas) {
    const grupos = new Map(); // chave: placa1+placa2+data

    for (const linha of linhasBrutas) {
        const chave = (linha.placa1 + '|' + (linha.placa2 || '') + '|' + (linha.dataPrevista || '')).toUpperCase();
        if (!grupos.has(chave)) {
            grupos.set(chave, []);
        }
        grupos.get(chave).push(linha);
    }

    const lotes = [];

    for (const [, grupo] of grupos) {
        if (grupo.length === 1) {
            const l = grupo[0];
            const { coletaRecife, coletaInterestadual: coletaInt, slots } = extrairColetas(l.operacaoBase, l.numeroColeta);
            const coletaMoreno = joinColetaMoreno(slots);
            lotes.push({
                _id: gerarId(),
                motorista: l.motorista,
                placa1: l.placa1,
                placa2: l.placa2,
                tipoVeiculo: l.tipoVeiculo,
                operacao: l.operacaoBase,
                coletaRecife,
                coletaMoreno,
                coletaInterestadual: coletaInt || '',
                rotaRecife: l.operacaoBase.includes('RECIFE') ? l.rota : '',
                rotaMoreno: !l.operacaoBase.includes('RECIFE') ? l.rota : '',
                observacao: l.obsRestante,
                dataPrevista: l.dataPrevista || '',
            });
        } else {
            // Consolidar múltiplas linhas
            const base = grupo[0];
            let slotsAcumulados = { plastico: '', porcelana: '', eletrik: '' };
            let coletaRecifeAcum = '';
            let coletaInterestadualAcum = '';
            let operacaoCombinada = base.operacaoBase;
            const rotaSet = new Set();
            const obsSet = new Set();

            for (const l of grupo) {
                if (l.rota) rotaSet.add(l.rota);
                if (l.obsRestante) obsSet.add(l.obsRestante);

                const { coletaRecife, coletaInterestadual: coletaInt, slots } = extrairColetas(l.operacaoBase, l.numeroColeta);
                if (coletaRecife) coletaRecifeAcum = coletaRecifeAcum ? coletaRecifeAcum + ',' + coletaRecife : coletaRecife;
                if (coletaInt) coletaInterestadualAcum = coletaInterestadualAcum ? coletaInterestadualAcum + ',' + coletaInt : coletaInt;
                for (const [k, v] of Object.entries(slots)) {
                    if (v) slotsAcumulados[k] = slotsAcumulados[k] ? slotsAcumulados[k] + ',' + v : v;
                }
            }

            // Combinar operações de todas as linhas do grupo
            const todasOps = grupo.map(l => l.operacaoBase);
            operacaoCombinada = todasOps.reduce((acc, op) => combinarOperacoes(acc, op), todasOps[0]);

            const coletaMoreno = joinColetaMoreno(slotsAcumulados);
            const rotaFinal = [...rotaSet].join('/');

            lotes.push({
                _id: gerarId(),
                motorista: base.motorista,
                placa1: base.placa1,
                placa2: base.placa2,
                tipoVeiculo: base.tipoVeiculo,
                operacao: operacaoCombinada,
                coletaRecife: coletaRecifeAcum,
                coletaMoreno,
                coletaInterestadual: coletaInterestadualAcum,
                rotaRecife: operacaoCombinada.includes('RECIFE') ? rotaFinal : '',
                rotaMoreno: !operacaoCombinada.includes('RECIFE') || operacaoCombinada.includes('/') ? rotaFinal : '',
                observacao: [...obsSet].join(' - '),
                dataPrevista: base.dataPrevista || '',
            });
        }
    }

    return lotes;
}

function normalizarChave(k) {
    return k.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
        .replace(/[^a-z0-9]/g, ''); // remove tudo que não é letra/número
}

function processarPlanilha(linhas) {
    if (!linhas.length) return [];

    // Indexa as chaves normalizadas da primeira linha para encontrar colunas independente de acento/espaço
    const chavesMapa = Object.keys(linhas[0]).reduce((acc, k) => {
        acc[normalizarChave(k)] = k;
        return acc;
    }, {});

    console.log('[ImportarLotes] Colunas encontradas:', Object.keys(linhas[0]));
    console.log('[ImportarLotes] Mapa normalizado:', chavesMapa);

    const buscarChave = (...candidatos) => {
        for (const c of candidatos) {
            const norm = normalizarChave(c);
            if (chavesMapa[norm]) return chavesMapa[norm];
        }
        return null;
    };

    const colNumeroColeta = buscarChave('N° Coleta', 'N Coleta', 'Nº Coleta', 'N°Coleta', 'NColeta', 'Numero Coleta', 'NumeroColeta');
    const colOperacao    = buscarChave('Operação', 'Operacao');
    const colObservacao  = buscarChave('Observação', 'Observacao');
    const colPlacaV      = buscarChave('Placa Veículo', 'Placa Veiculo', 'Placa do Veículo', 'PlacaVeiculo');
    const colPlacaC      = buscarChave('Placa Carreta', 'Placa da Carreta', 'PlacaCarreta');
    const colMotorista   = buscarChave('Motorista');
    const colTipo        = buscarChave('Tipo de Veículo', 'Tipo Veiculo', 'Tipo Veículo', 'TipoVeiculo');
    const colDataPrev    = buscarChave('Data de Previsão', 'Data de Previsao', 'Data Previsao', 'Data Prevista', 'DataPrevisao', 'DataPrevista');
    console.log('[ImportarLotes] colDataPrev =', colDataPrev, '| primeira amostra =', colDataPrev ? linhas[0][colDataPrev] : '(coluna não encontrada)', '| tipo =', colDataPrev ? typeof linhas[0][colDataPrev] : '?');

    console.log('[ImportarLotes] Colunas mapeadas:', { colNumeroColeta, colOperacao, colObservacao, colPlacaV, colPlacaC, colMotorista, colTipo });

    const linhasBrutas = [];

    for (const linha of linhas) {
        const get = (col) => col ? String(linha[col] ?? '').trim() : '';
        const getRaw = (col) => col ? linha[col] : '';

        const numeroColeta = get(colNumeroColeta);
        const operacaoCSV  = get(colOperacao);
        const observacaoCSV = get(colObservacao);
        const placaVeiculo = get(colPlacaV).toUpperCase();
        const placaCarreta = get(colPlacaC).toUpperCase();
        const motorista    = get(colMotorista);
        const tipoVeiculo  = get(colTipo);
        const dataPrevista = parseDataPrevisao(getRaw(colDataPrev));

        if (!motorista && !placaVeiculo) continue; // linha realmente vazia

        const operacaoBase = mapearOperacao(operacaoCSV);
        const { rota, obsRestante } = extrairRota(observacaoCSV);

        linhasBrutas.push({
            numeroColeta,
            operacaoBase,
            placa1: placaVeiculo,
            placa2: placaCarreta,
            motorista,
            tipoVeiculo: mapearTipoVeiculo(tipoVeiculo),
            rota,
            obsRestante,
            dataPrevista,
        });
    }

    return consolidarPorPlaca(linhasBrutas);
}

// ── Componente Principal ───────────────────────────────────────────────────

export default function ModalImportacaoLotes({ isOpen, onClose, lancarPayloadDireto, mostrarNotificacao }) {
    const [passo, setPasso] = useState(1);
    const [lotes, setLotes] = useState([]);
    const [dataPrevista, setDataPrevista] = useState(obterDataBrasiliaISO());
    const [lancando, setLancando] = useState(false);
    const [erros, setErros] = useState({});
    const [sucessos, setSucessos] = useState({});
    const [duplicatas, setDuplicatas] = useState({});
    const [eletrikFila, setEletrikFila] = useState([]);
    const [eletrikAtual, setEletrikAtual] = useState(null);
    const [eletrikResolvidos, setEletrikResolvidos] = useState([]);
    const [rotaNovaPendente, setRotaNovaPendente] = useState(null); // lotes com "ROTA NOVA" aguardando confirmação
    const [rotaNovaFila,  setRotaNovaFila]  = useState([]);
    const [rotaNovaAtual, setRotaNovaAtual] = useState(null);
    const [rotaNovaInput, setRotaNovaInput] = useState('');
    const [coletasSumidas,  setColetasSumidas]  = useState(null);
    const [excluindoId, setExcluindoId] = useState(null);
    const [liberarCteLotes, setLiberarCteLotes] = useState(null); // lotes com LIBERAR CTE na obs
    const [liberarCteExcluidos, setLiberarCteExcluidos] = useState(new Set());
    const [reprogramarCard, setReprogramarCard] = useState(null);
    const [novaDataRepro,   setNovaDataRepro]   = useState('');
    const [veiculosProvisao, setVeiculosProvisao] = useState([]);
    const [provisaoFila, setProvisaoFila] = useState([]);
    const [provisaoAtual, setProvisaoAtual] = useState(null);
    const fileRef = useRef();
    const inputRotaRef = useRef();

    useEffect(() => {
        if (rotaNovaAtual) {
            setTimeout(() => inputRotaRef.current?.focus(), 50);
        }
    }, [rotaNovaAtual]);

    useEffect(() => {
        api.get('/api/provisionamento/veiculos').then(r => {
            if (r.data?.success) setVeiculosProvisao(r.data.veiculos || []);
        }).catch(() => {});
    }, []);

    const verificarDuplicatas = useCallback(async (lotesParaVerificar) => {
        try {
            const r = await api.get('/veiculos');
            const veiculos = r.data.veiculos || [];
            const STATUS_FINAIS = ['FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'];
            const ativos = veiculos.filter(v =>
                (!v.status_recife || !STATUS_FINAIS.includes(v.status_recife)) &&
                (!v.status_moreno || !STATUS_FINAIS.includes(v.status_moreno))
            );
            const tagsAtivas = new Set();
            for (const v of ativos) {
                // Backend mapeia coletainterestadual → coletaInterestadual no payload (camelCase)
                for (const campo of [v.coletaRecife, v.coletaMoreno, v.coletaInterestadual, v.coletainterestadual]) {
                    extrairNumerosColeta(campo).forEach(t => tagsAtivas.add(t));
                }
            }
            const novasDuplicatas = {};
            for (const lote of lotesParaVerificar) {
                const tags = [
                    ...extrairNumerosColeta(lote.coletaRecife),
                    ...extrairNumerosColeta(lote.coletaMoreno),
                ];
                const dup = tags.filter(t => tagsAtivas.has(t));
                if (dup.length > 0) novasDuplicatas[lote._id] = dup;
            }
            setDuplicatas(novasDuplicatas);
        } catch (_) {
            setDuplicatas({});
        }
    }, []);

    const REGEX_LIBERAR_CTE = /liber[a-z]*\s*c\.?\s*[t-]\.?\s*[e-]?/i;

    const avancarParaRotaNova = (lotesResolvidos) => {
        const comRotaNova = lotesResolvidos.filter(l =>
            /rota\s*nova/i.test(l.observacao || '')
        );
        if (comRotaNova.length > 0) {
            setLotes(lotesResolvidos);
            setRotaNovaPendente(comRotaNova);
        } else {
            setLotes(lotesResolvidos);
            setPasso(2);
            verificarDuplicatas(lotesResolvidos);
        }
    };

    const verificarLiberarCte = (lotesResolvidos) => {
        const comCte = lotesResolvidos.filter(l => REGEX_LIBERAR_CTE.test(l.observacao || ''));
        if (comCte.length > 0) {
            setLotes(lotesResolvidos);
            setLiberarCteExcluidos(new Set());
            setLiberarCteLotes(comCte);
        } else {
            avancarParaRotaNova(lotesResolvidos);
        }
    };

    const confirmarLiberarCte = () => {
        const lotesFinais = lotes.filter(l => !liberarCteExcluidos.has(l._id));
        setLiberarCteLotes(null);
        avancarParaRotaNova(lotesFinais);
    };

    const detectarSumidas = useCallback(async (lotesResolvidos) => {
        try {
            const r = await api.get('/veiculos');
            const veiculos = r.data.veiculos || [];
            const STATUS_FINAIS = ['FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'];

            const coletasNovas = new Set();
            const datasDosLotes = new Set();
            for (const l of lotesResolvidos) {
                if (l.dataPrevista) datasDosLotes.add(l.dataPrevista);
                for (const campo of [l.coletaRecife, l.coletaMoreno, l.coletaInterestadual]) {
                    extrairNumerosColeta(campo).forEach(t => coletasNovas.add(t));
                }
            }
            // Se nenhum lote tem data, usa a global (compat)
            if (datasDosLotes.size === 0) datasDosLotes.add(dataPrevista);

            const sumidos = veiculos.filter(v => {
                const recFinal = !v.status_recife || STATUS_FINAIS.includes(v.status_recife);
                const morFinal = !v.status_moreno || STATUS_FINAIS.includes(v.status_moreno);
                if (recFinal && morFinal) return false;
                if (!datasDosLotes.has(v.data_prevista || '')) return false;
                // Cards reprogramados de outro dia não devem aparecer como 'sumidos' —
                // eles foram movidos automaticamente (rollover ou reprogramação manual),
                // não se espera que estejam na planilha do dia destino.
                const dataOrig = v.data_prevista_original || '';
                if (v.foi_reprogramado && dataOrig && dataOrig !== v.data_prevista) return false;
                const coletas = [
                    ...extrairNumerosColeta(v.coletaRecife),
                    ...extrairNumerosColeta(v.coletaMoreno),
                    ...extrairNumerosColeta(v.coletaInterestadual || v.coletainterestadual),
                ];
                return coletas.length > 0 && coletas.every(t => !coletasNovas.has(t));
            }).map(v => ({
                id: v.id,
                motorista: v.motorista || '—',
                placa1: v.placa1Motorista || v.placa || '',
                placa2: v.placa2Motorista || '',
                coleta: v.coletaRecife || v.coletaMoreno || v.coletaInterestadual || v.coletainterestadual || '',
                operacao: v.operacao || '',
                _full: v,
            }));

            setLotes(lotesResolvidos);
            if (sumidos.length > 0) {
                setColetasSumidas(sumidos);
            } else {
                verificarLiberarCte(lotesResolvidos);
            }
        } catch {
            setLotes(lotesResolvidos);
            verificarLiberarCte(lotesResolvidos);
        }
    }, [dataPrevista, avancarParaRotaNova]);

    const resolverSumida = useCallback((idResolvido, lotesParaProximo) => {
        const novaLista = (coletasSumidas || []).filter(c => c.id !== idResolvido);
        setColetasSumidas(novaLista.length > 0 ? novaLista : null);
        if (novaLista.length === 0) {
            verificarLiberarCte(lotesParaProximo);
        }
    }, [coletasSumidas, verificarLiberarCte]);

    const avancarRotaNova = useCallback(() => {
        const proxima = rotaNovaFila[0] ?? null;
        setRotaNovaFila(prev => prev.slice(1));
        setRotaNovaAtual(proxima);
        setRotaNovaInput('');
        if (!proxima) {
            setPasso(2);
            verificarDuplicatas(lotes);
        }
    }, [rotaNovaFila, lotes, verificarDuplicatas]);

    const handleArquivo = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];

                // Lê sem header para encontrar a linha que contém os cabeçalhos reais
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                console.log('[ImportarLotes] Primeiras 5 linhas brutas:', raw.slice(0, 5));

                // Encontra a linha-header: aquela que contém "Motorista" ou "Placa"
                const palavrasChave = ['motorista', 'placa', 'operacao', 'operação', 'coleta'];
                const headerRowIdx = raw.findIndex(row =>
                    row.some(cell => palavrasChave.some(p =>
                        normalizarChave(String(cell)).includes(normalizarChave(p))
                    ))
                );

                if (headerRowIdx === -1) {
                    mostrarNotificacao('⚠️ Não foi possível encontrar os cabeçalhos na planilha.');
                    return;
                }

                console.log('[ImportarLotes] Linha de cabeçalho encontrada no índice:', headerRowIdx, raw[headerRowIdx]);

                // Reconstrói como JSON usando a linha correta como header
                const linhas = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerRowIdx });
                const processados = processarPlanilha(linhas);
                if (processados.length === 0) {
                    mostrarNotificacao('⚠️ Nenhuma linha válida encontrada na planilha.');
                    return;
                }
                setErros({});
                setSucessos({});
                setDuplicatas({});

                // Marcar coletas como programadas na planilha (fire-and-forget, não bloqueia o fluxo)
                const todosNumerosColeta = [];
                for (const l of processados) {
                    for (const campo of [l.coletaRecife, l.coletaMoreno, l.coletaInterestadual]) {
                        extrairNumerosColeta(campo).forEach(n => todosNumerosColeta.push(n));
                    }
                }
                if (todosNumerosColeta.length > 0) {
                    api.post('/api/planilha/marcar-programadas', { coletas: todosNumerosColeta })
                        .catch(() => {}); // silencioso — não interrompe importação se falhar
                }

                // PORCELANA/ELETRIK é sempre Moreno — só ELETRIK puro é ambíguo
                const ambiguos = processados.filter(l => l.operacao === 'ELETRIK');
                const semAmbiguidade = processados.filter(l => l.operacao !== 'ELETRIK');

                if (ambiguos.length > 0) {
                    setEletrikResolvidos(semAmbiguidade);
                    setEletrikAtual(ambiguos[0]);
                    setEletrikFila(ambiguos.slice(1));
                } else {
                    detectarSumidas(processados);
                }
            } catch (err) {
                mostrarNotificacao('❌ Erro ao ler o arquivo. Verifique o formato.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const atualizarLote = (id, campo, valor) => {
        setLotes(prev => prev.map(l => l._id === id ? { ...l, [campo]: valor } : l));
    };

    const removerLote = (id) => {
        setLotes(prev => prev.filter(l => l._id !== id));
    };

    const confirmarLotes = async () => {
        setLancando(true);
        const novosErros = {};
        const novosSucessos = {};
        let ok = 0;

        const idsPorLote = {}; // _id -> veiculo_id retornado pelo backend
        for (const lote of lotes) {
            if (sucessos[lote._id]) { ok++; continue; } // já lançado
            try {
                const res = await lancarPayloadDireto({ ...lote, data_prevista: lote.dataPrevista || dataPrevista });
                if (res?.id) idsPorLote[lote._id] = res.id;
                if (res?.atualizado) {
                    novosSucessos[lote._id] = 'atualizado';
                } else if (res?.duplicata) {
                    novosSucessos[lote._id] = 'duplicata';
                } else {
                    novosSucessos[lote._id] = true;
                }
                ok++;
            } catch (e) {
                novosErros[lote._id] = e?.response?.data?.message || 'Erro ao lançar';
            }
        }

        setErros(novosErros);
        setSucessos(prev => ({ ...prev, ...novosSucessos }));
        setLancando(false);

        // PlanejamentoDelta (2026-05-20): manter coerência rota↔coleta na planilha (fire-and-forget)
        try {
            const paresPlanilha = [];
            for (const lote of lotes) {
                const status = novosSucessos[lote._id];
                if (!status || status === 'duplicata') continue;
                const coletaNum = String(lote.coletaRecife || lote.coletaMoreno || lote.coletaInterestadual || '')
                    .split(/[\s,|]+/)
                    .map(t => t.replace(/^(PLAS|PORC|ELET):\s*/i, '').trim().replace(/^0+/, ''))
                    .filter(Boolean)[0];
                if (!coletaNum) continue;
                if (lote.rotaRecife) paresPlanilha.push({ rota: String(lote.rotaRecife).trim(), coleta: coletaNum });
                if (lote.rotaMoreno) paresPlanilha.push({ rota: String(lote.rotaMoreno).trim(), coleta: coletaNum });
            }
            if (paresPlanilha.length > 0) {
                api.post('/api/planilha/inserir-coleta-rota', { pares: paresPlanilha })
                    .then(r => {
                        if (r.data?.avisos?.length > 0) {
                            mostrarNotificacao(`⚠️ ${r.data.avisos.length} aviso(s): coleta lançada difere da planilha`);
                        }
                    })
                    .catch(() => {}); // silencioso — não interrompe importação
            }
        } catch (_) {}

        if (Object.keys(novosErros).length === 0) {
            // Verificar se há veículos de frota nos lotes lançados com sucesso
            const placasProvisao = new Set(veiculosProvisao.flatMap(v => [v.placa, v.carreta].filter(Boolean).map(p => p.toUpperCase())));
            const lotesFreota = lotes.filter(l =>
                placasProvisao.has((l.placa1 || '').toUpperCase()) ||
                placasProvisao.has((l.placa2 || '').toUpperCase())
            ).map(l => {
                const veiculo = veiculosProvisao.find(v =>
                    (v.placa || '').toUpperCase() === (l.placa1 || '').toUpperCase() ||
                    (v.carreta || '').toUpperCase() === (l.placa1 || '').toUpperCase() ||
                    (v.placa || '').toUpperCase() === (l.placa2 || '').toUpperCase()
                );
                return { lote: l, veiculo, veiculo_id_card: idsPorLote[l._id] || null };
            }).filter(x => x.veiculo);

            if (lotesFreota.length > 0) {
                mostrarNotificacao(`✅ ${ok} lançamento(s) importado(s)! Registrando viagens da frota...`);
                setProvisaoFila(lotesFreota.slice(1));
                setProvisaoAtual(lotesFreota[0]);
            } else {
                mostrarNotificacao(`✅ ${ok} lançamento(s) importado(s)!`);
                fechar();
            }
        } else {
            mostrarNotificacao(`⚠️ ${ok} ok, ${Object.keys(novosErros).length} com erro. Verifique e tente novamente.`);
        }
    };

    const fechar = () => {
        setPasso(1);
        setLotes([]);
        setErros({});
        setSucessos({});
        setDuplicatas({});
        setEletrikFila([]);
        setEletrikAtual(null);
        setEletrikResolvidos([]);
        setRotaNovaPendente(null);
        setRotaNovaFila([]);
        setRotaNovaAtual(null);
        setRotaNovaInput('');
        setProvisaoFila([]);
        setProvisaoAtual(null);
        setDataPrevista(obterDataBrasiliaISO());
        setColetasSumidas(null);
        setExcluindoId(null);
        setReprogramarCard(null);
        setNovaDataRepro('');
        onClose();
    };

    const resolverEletrikAtual = (tipoEletrik) => {
        if (!eletrikAtual) return;
        let resolvido;
        if (tipoEletrik === 'SUL') {
            // coletaMoreno é "ELET:123" — extrair o número e mover para interestadual
            const m = (eletrikAtual.coletaMoreno || '').match(/ELET:([^|]+)/i);
            const coletaElet = m ? m[1].trim() : eletrikAtual.coletaMoreno || '';
            resolvido = { ...eletrikAtual, operacao: 'ELETRIK SUL', coletaMoreno: '', coletaInterestadual: coletaElet };
        } else {
            // MORENO: mantém ELETRIK
            resolvido = { ...eletrikAtual };
        }
        const novosResolvidos = [...eletrikResolvidos, resolvido];
        const proxima = eletrikFila[0] ?? null;
        const novaFila = eletrikFila.slice(1);
        if (proxima) {
            setEletrikResolvidos(novosResolvidos);
            setEletrikAtual(proxima);
            setEletrikFila(novaFila);
        } else {
            setEletrikAtual(null);
            setEletrikFila([]);
            setEletrikResolvidos([]);
            detectarSumidas(novosResolvidos);
        }
    };

    const cancelarEletrik = () => {
        setEletrikAtual(null);
        setEletrikFila([]);
        setEletrikResolvidos([]);
        if (fileRef.current) fileRef.current.value = '';
    };

    const ehRecife = (op) => op && (op.includes('RECIFE') || op === 'PLÁSTICO(RECIFE X MORENO)');
    const ehMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || (op.includes('ELETRIK') && !op.includes('ELETRIK SUL')));

    return (
        <>
        <ModalWrapper isOpen={isOpen} onClose={fechar} maxWidth={passo === 2 ? '900px' : '480px'} hideCloseButton>
            <div style={{
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Upload size={18} color="#60a5fa" />
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '0.03em' }}>
                            IMPORTAR COLETAS
                        </span>
                        {passo === 2 && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>
                                — {lotes.length} lançamento(s)
                            </span>
                        )}
                    </div>
                    <button onClick={fechar} disabled={lancando}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>

                    {/* Modal ROTA NOVA — questiona se já existe rota */}
                    {rotaNovaPendente && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
                        }}>
                            <MapPin size={36} color="#f59e0b" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
                                Coleta(s) sem rota cadastrada
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', maxWidth: '340px', lineHeight: 1.6 }}>
                                {rotaNovaPendente.length} lote(s) com "ROTA NOVA" na observação. Já existe uma rota para esta(s) coleta(s)?
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px', width: '100%', maxWidth: '320px' }}>
                                {rotaNovaPendente.map(l => (
                                    <div key={l._id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                                        borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                                    }}>
                                        <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{l.motorista || '—'}</span>
                                        <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{l.placa1}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        const fila = rotaNovaPendente || [];
                                        setRotaNovaPendente(null);
                                        if (fila.length > 0) {
                                            setRotaNovaAtual(fila[0]);
                                            setRotaNovaFila(fila.slice(1));
                                            setRotaNovaInput('');
                                        } else {
                                            setPasso(2);
                                            verificarDuplicatas(lotes);
                                        }
                                    }}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(135deg,#d97706,#f59e0b)',
                                        color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Sim, tenho a rota
                                </button>
                                <button
                                    onClick={() => { setRotaNovaPendente(null); setPasso(2); verificarDuplicatas(lotes); }}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Ainda não
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modal Eletrik — passo a passo, um lote por vez */}
                    {eletrikAtual && (() => {
                        const coletaElet = (() => {
                            const m = (eletrikAtual.coletaMoreno || '').match(/ELET:([^|]+)/i);
                            return m ? m[1].trim() : (eletrikAtual.coletaMoreno || '—');
                        })();
                        const obsTexto = (eletrikAtual.observacao || '').toUpperCase();
                        const provavelConsolidado = obsTexto.includes('CONSOLIDADO');
                        const restantes = eletrikFila.length;
                        return (
                            <div style={{
                                position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                                background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center', overflowY: 'auto',
                            }}>
                                <AlertCircle size={32} color="#f59e0b" style={{ marginBottom: '12px' }} />
                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>
                                    Operação Eletrik detectada
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                                    Defina a unidade para este lote
                                </div>

                                <div style={{
                                    width: '100%', maxWidth: '360px',
                                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                                    borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', textAlign: 'left',
                                }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#e2e8f0', marginBottom: '4px' }}>
                                        {eletrikAtual.motorista || '— sem motorista'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '6px' }}>
                                        {eletrikAtual.placa1}{eletrikAtual.placa2 ? ` / ${eletrikAtual.placa2}` : ''}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#a78bfa', fontFamily: 'monospace', marginBottom: '6px' }}>
                                        Coleta ELET: <strong>{coletaElet}</strong>
                                    </div>
                                    {eletrikAtual.observacao && (
                                        <div style={{ fontSize: '10.5px', color: '#64748b', lineHeight: 1.5, marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                            {eletrikAtual.observacao}
                                        </div>
                                    )}
                                    {provavelConsolidado && (
                                        <div style={{
                                            marginTop: '8px', padding: '6px 10px',
                                            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                                            borderRadius: '6px', fontSize: '10.5px', color: '#fbbf24', fontWeight: '700',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                        }}>
                                            <AlertCircle size={11} /> Provavelmente consolidado — sugerido Moreno
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => resolverEletrikAtual('SUL')}
                                        style={{
                                            padding: '10px 22px', borderRadius: '10px', border: 'none',
                                            background: provavelConsolidado ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                                            color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                            opacity: provavelConsolidado ? 0.7 : 1,
                                        }}
                                    >
                                        Eletrik Sul
                                    </button>
                                    <button
                                        onClick={() => resolverEletrikAtual('MORENO')}
                                        style={{
                                            padding: '10px 22px', borderRadius: '10px',
                                            border: provavelConsolidado ? '2px solid #f59e0b' : 'none',
                                            background: 'linear-gradient(135deg,#d97706,#f59e0b)',
                                            color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                            boxShadow: provavelConsolidado ? '0 0 12px rgba(245,158,11,0.5)' : 'none',
                                        }}
                                    >
                                        Eletrik Moreno
                                    </button>
                                </div>

                                {restantes > 0 && (
                                    <div style={{ marginTop: '14px', fontSize: '11px', color: '#475569' }}>
                                        {restantes} lote(s) Eletrik restante(s)
                                    </div>
                                )}
                                <button
                                    onClick={cancelarEletrik}
                                    style={{ marginTop: '16px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                                >
                                    Cancelar importação
                                </button>
                            </div>
                        );
                    })()}

                    {/* Overlay ROTA NOVA — passo a passo por lote */}
                    {rotaNovaAtual && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
                        }}>
                            <MapPin size={36} color="#60a5fa" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
                                Qual a rota desta coleta?
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                                {rotaNovaAtual.motorista || '—'} · <span style={{ fontFamily: 'monospace' }}>{rotaNovaAtual.placa1}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '20px', fontFamily: 'monospace' }}>
                                Coleta: {rotaNovaAtual.coletaRecife || rotaNovaAtual.coletaMoreno || rotaNovaAtual.coletaInterestadual || '—'}
                            </div>
                            <input
                                ref={inputRotaRef}
                                className="input-internal"
                                placeholder="Nº da Rota"
                                value={rotaNovaInput}
                                onChange={e => setRotaNovaInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && rotaNovaInput.trim()) {
                                        const ehRec = ehRecife(rotaNovaAtual.operacao);
                                        const ehMor = ehMoreno(rotaNovaAtual.operacao);
                                        if (ehRec) atualizarLote(rotaNovaAtual._id, 'rotaRecife', rotaNovaInput.trim());
                                        if (ehMor) atualizarLote(rotaNovaAtual._id, 'rotaMoreno', rotaNovaInput.trim());
                                        avancarRotaNova();
                                    }
                                }}
                                style={{ width: '200px', textAlign: 'center', fontSize: '14px', marginBottom: '24px' }}
                            />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        if (!rotaNovaInput.trim()) return;
                                        const ehRec = ehRecife(rotaNovaAtual.operacao);
                                        const ehMor = ehMoreno(rotaNovaAtual.operacao);
                                        if (ehRec) atualizarLote(rotaNovaAtual._id, 'rotaRecife', rotaNovaInput.trim());
                                        if (ehMor) atualizarLote(rotaNovaAtual._id, 'rotaMoreno', rotaNovaInput.trim());
                                        avancarRotaNova();
                                    }}
                                    disabled={!rotaNovaInput.trim()}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: 'none',
                                        background: rotaNovaInput.trim() ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : 'rgba(59,130,246,0.3)',
                                        color: 'white', fontWeight: '700', fontSize: '13px',
                                        cursor: rotaNovaInput.trim() ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => avancarRotaNova()}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Pular
                                </button>
                            </div>
                            {rotaNovaFila.length > 0 && (
                                <div style={{ marginTop: '16px', fontSize: '11px', color: '#475569' }}>
                                    {rotaNovaFila.length} coleta(s) restante(s)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlay Coletas Sumidas */}
                    {coletasSumidas && !reprogramarCard && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center',
                            overflowY: 'auto',
                        }}>
                            <AlertCircle size={36} color="#f59e0b" style={{ marginBottom: '16px', flexShrink: 0 }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>
                                Coletas não encontradas no novo arquivo
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px', maxWidth: '360px', lineHeight: 1.6 }}>
                                As coletas abaixo estavam no painel com esta data, mas não vieram nesta importação.
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '420px', marginBottom: '8px' }}>
                                {coletasSumidas.map(card => (
                                    <div key={card.id} style={{
                                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                                        borderRadius: '10px', padding: '10px 14px',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                    }}>
                                        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>
                                                {card.motorista}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                                                {card.placa1}{card.placa2 ? ` / ${card.placa2}` : ''} · Coleta: {card.coleta || '—'}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748b' }}>{card.operacao}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                            <button
                                                onClick={async () => {
                                                    if (excluindoId) return;
                                                    setExcluindoId(card.id);
                                                    try { await api.delete(`/veiculos/${card.id}`); } catch { /* ignorar */ }
                                                    setExcluindoId(null);
                                                    resolverSumida(card.id, lotes);
                                                }}
                                                disabled={!!excluindoId}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '7px', border: 'none',
                                                    background: excluindoId ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.15)',
                                                    color: excluindoId ? '#64748b' : '#fca5a5',
                                                    fontSize: '11px', fontWeight: '700',
                                                    cursor: excluindoId ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                {excluindoId === card.id ? '...' : 'Excluída'}
                                            </button>
                                            <button
                                                onClick={() => { setReprogramarCard(card); setNovaDataRepro(dataPrevista); }}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '7px', border: 'none',
                                                    background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                                }}
                                            >
                                                Reprogramada
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sub-overlay Reprogramar */}
                    {reprogramarCard && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 11, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.98)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
                        }}>
                            <CalendarPlus size={36} color="#60a5fa" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>
                                Nova data para esta coleta
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                                {reprogramarCard.motorista} · <span style={{ fontFamily: 'monospace' }}>{reprogramarCard.placa1}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '20px', fontFamily: 'monospace' }}>
                                Coleta: {reprogramarCard.coleta || '—'}
                            </div>
                            <input
                                type="date"
                                className="input-internal"
                                value={novaDataRepro}
                                onChange={e => setNovaDataRepro(e.target.value)}
                                style={{ width: '180px', textAlign: 'center', fontSize: '13px', marginBottom: '24px' }}
                            />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={async () => {
                                        if (!novaDataRepro) return;
                                        try {
                                            await api.put(`/veiculos/${reprogramarCard.id}`, {
                                                ...reprogramarCard._full,
                                                data_prevista: novaDataRepro,
                                                data_prevista_original: reprogramarCard._full.data_prevista_original || dataPrevista,
                                                status_recife: reprogramarCard._full.status_recife ? 'AGUARDANDO P/ SEPARAÇÃO' : null,
                                                status_moreno: reprogramarCard._full.status_moreno ? 'AGUARDANDO P/ SEPARAÇÃO' : null,
                                            });
                                        } catch { /* falha silenciosa */ }
                                        const idResolvido = reprogramarCard.id;
                                        setReprogramarCard(null);
                                        setNovaDataRepro('');
                                        resolverSumida(idResolvido, lotes);
                                    }}
                                    disabled={!novaDataRepro}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: 'none',
                                        background: novaDataRepro ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : 'rgba(59,130,246,0.3)',
                                        color: 'white', fontWeight: '700', fontSize: '13px',
                                        cursor: novaDataRepro ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => { setReprogramarCard(null); setNovaDataRepro(''); }}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Overlay LIBERAR CTE */}
                    {liberarCteLotes && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 12, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', padding: '40px 32px', overflowY: 'auto',
                        }}>
                            <AlertCircle size={36} color="#f59e0b" style={{ marginBottom: '16px', flexShrink: 0 }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px', textAlign: 'center' }}>
                                Coletas com "LIBERAR CTE" na observação
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px', maxWidth: '400px', lineHeight: 1.6, textAlign: 'center' }}>
                                Decida individualmente quais serão importadas. As marcadas para remover não entrarão no painel.
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '460px', marginBottom: '24px' }}>
                                {liberarCteLotes.map(lote => {
                                    const excluido = liberarCteExcluidos.has(lote._id);
                                    return (
                                        <div key={lote._id} style={{
                                            background: excluido ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                                            border: `1px solid ${excluido ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
                                            borderRadius: '10px', padding: '10px 14px',
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            opacity: excluido ? 0.6 : 1,
                                        }}>
                                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>
                                                    {lote.motorista || '—'} · <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{lote.placa1 || lote.placa || ''}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                                    Coleta: {lote.coletaRecife || lote.coletaMoreno || lote.coletaInterestadual || '—'} · {lote.operacao || ''}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontStyle: 'italic' }}>
                                                    {(lote.observacao || '').slice(0, 80)}{(lote.observacao || '').length > 80 ? '…' : ''}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setLiberarCteExcluidos(prev => {
                                                    const novo = new Set(prev);
                                                    if (novo.has(lote._id)) novo.delete(lote._id);
                                                    else novo.add(lote._id);
                                                    return novo;
                                                })}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '7px', border: 'none',
                                                    background: excluido ? 'rgba(100,116,139,0.2)' : 'rgba(239,68,68,0.15)',
                                                    color: excluido ? '#94a3b8' : '#fca5a5',
                                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer', flexShrink: 0,
                                                }}
                                            >
                                                {excluido ? 'Incluir' : 'Remover'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={confirmarLiberarCte}
                                style={{
                                    padding: '12px 36px', borderRadius: '10px', border: 'none',
                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                }}
                            >
                                Continuar importação
                                {liberarCteExcluidos.size > 0 && ` (${liberarCteExcluidos.size} removida${liberarCteExcluidos.size > 1 ? 's' : ''})`}
                            </button>
                        </div>
                    )}

                    {/* PASSO 1: Upload */}
                    {passo === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                                Selecione um arquivo <strong style={{ color: '#cbd5e1' }}>.xlsx</strong> ou <strong style={{ color: '#cbd5e1' }}>.xls</strong> com as colunas:<br />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>N° Coleta · Operação · Observação · Placa Veículo · Placa Carreta · Motorista · Tipo de Veículo</span>
                            </p>

                            <div
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    border: '2px dashed rgba(59,130,246,0.4)', borderRadius: '12px',
                                    padding: '40px', textAlign: 'center', cursor: 'pointer',
                                    background: 'rgba(59,130,246,0.04)',
                                    transition: 'border-color 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.7)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'}
                            >
                                <Upload size={32} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Clique para selecionar o arquivo</div>
                                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>.xlsx · .xls · .csv</div>
                            </div>

                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleArquivo}
                                style={{ display: 'none' }}
                            />
                        </div>
                    )}

                    {/* PASSO 2: Revisão */}
                    {passo === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Override de data — aplica em TODOS os lotes ao clicar */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', background: 'rgba(59,130,246,0.08)',
                                border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px'
                            }}>
                                <label style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                    SOBRESCREVER DATA:
                                </label>
                                <input
                                    type="date"
                                    className="input-internal"
                                    value={dataPrevista}
                                    onChange={e => setDataPrevista(e.target.value)}
                                    style={{ width: '160px', padding: '6px 10px', fontSize: '12px' }}
                                />
                                <button
                                    onClick={() => {
                                        if (!dataPrevista) return;
                                        setLotes(prev => prev.map(l => ({ ...l, dataPrevista })));
                                    }}
                                    disabled={!dataPrevista}
                                    style={{
                                        padding: '6px 14px', fontSize: '11px', fontWeight: '700',
                                        background: dataPrevista ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)',
                                        border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd',
                                        borderRadius: '6px', cursor: dataPrevista ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Aplicar em todos
                                </button>
                                <span style={{ fontSize: '11px', color: '#475569' }}>
                                    Por padrão, cada lote usa a data do CSV
                                </span>
                            </div>

                            {/* Cards de lotes */}
                            {lotes.map((lote) => (
                                <CardLote
                                    key={lote._id}
                                    lote={lote}
                                    erro={erros[lote._id]}
                                    sucesso={!!sucessos[lote._id]}
                                    duplicata={duplicatas[lote._id]}
                                    onChange={atualizarLote}
                                    onRemover={removerLote}
                                    ehRecife={ehRecife}
                                    ehMoreno={ehMoreno}
                                    lancando={lancando}
                                />
                            ))}

                            {lotes.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#475569', padding: '24px', fontSize: '13px' }}>
                                    Todos os lançamentos foram removidos.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {passo === 2 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {Object.keys(duplicatas).length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: '12px', fontWeight: '600' }}>
                                <AlertCircle size={14} />
                                {Object.keys(duplicatas).length} lote(s) com coleta já ativa — serão barrados ao confirmar. Remova-os ou corrija os números.
                            </div>
                        )}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                            onClick={() => { setPasso(1); setLotes([]); setErros({}); setSucessos({}); }}
                            disabled={lancando}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8', borderRadius: '8px', padding: '9px 18px',
                                fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}
                        >
                            Novo arquivo
                        </button>
                        <button
                            onClick={confirmarLotes}
                            disabled={lancando || lotes.length === 0}
                            style={{
                                background: lancando || lotes.length === 0 ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                border: 'none', color: 'white', borderRadius: '8px',
                                padding: '9px 22px', fontSize: '12px', fontWeight: '700',
                                cursor: lancando || lotes.length === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: lancando ? 'none' : '0 4px 14px rgba(59,130,246,0.35)'
                            }}
                        >
                            {lancando ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Lançando...</> : <>Confirmar e Lançar {lotes.length}</>}
                        </button>
                    </div>
                    </div>
                )}
            </div>
        </ModalWrapper>

        {/* Modal de Registrar Viagem para veículos de frota */}
        {provisaoAtual && (
            <ModalEntregasProvisao
                key={provisaoAtual.veiculo?.id || provisaoAtual.lote?.placa1}
                veiculo={provisaoAtual.veiculo}
                motorista={provisaoAtual.lote.motorista}
                dataSaida={dataPrevista}
                coletaPrincipal={
                    provisaoAtual.lote?.coletaRecife
                    || provisaoAtual.lote?.coletaMoreno
                    || provisaoAtual.lote?.coletaInterestadual
                    || ''
                }
                onConfirmar={async (_entradas, opts) => {
                    console.log('[remanejamento-lote] opts:', opts, 'veiculo_id_card:', provisaoAtual?.veiculo_id_card);
                    // Se o usuário pediu remanejamento, busca o card e dispara evento global ANTES de avançar
                    if (opts?.abrirRemanejamento && provisaoAtual?.veiculo_id_card) {
                        try {
                            const r = await api.get(`/veiculos/${provisaoAtual.veiculo_id_card}`);
                            const cardCriado = r.data?.veiculo || r.data;
                            console.log('[remanejamento-lote] card buscado:', cardCriado?.id);
                            if (cardCriado) {
                                window.dispatchEvent(new CustomEvent('abrir-remanejamento', { detail: cardCriado }));
                            }
                        } catch (e) {
                            console.warn('Falha ao buscar card para remanejamento:', e);
                        }
                    }
                    if (provisaoFila.length > 0) {
                        setProvisaoAtual(provisaoFila[0]);
                        setProvisaoFila(prev => prev.slice(1));
                    } else {
                        setProvisaoAtual(null);
                        fechar();
                    }
                }}
                onCancelar={() => {
                    if (provisaoFila.length > 0) {
                        setProvisaoAtual(provisaoFila[0]);
                        setProvisaoFila(prev => prev.slice(1));
                    } else {
                        setProvisaoAtual(null);
                        fechar();
                    }
                }}
            />
        )}
        </>
    );
}

// ── Card individual de lote ────────────────────────────────────────────────

function CardLote({ lote, erro, sucesso, duplicata, onChange, onRemover, ehRecife, ehMoreno, lancando }) {
    const [expandido, setExpandido] = useState(true);
    const temRecife = ehRecife(lote.operacao);
    const temMoreno = ehMoreno(lote.operacao);
    const temInterestadual = lote.operacao === 'ELETRIK SUL' || lote.operacao === 'LEÃO - SP';

    const foiAtualizado = sucesso === 'atualizado';
    const foiDuplicataSemMudanca = sucesso === 'duplicata';
    const foiLancado = sucesso === true;
    const temSucesso = !!sucesso;
    const borderColor = foiAtualizado ? '#facc15' : foiDuplicataSemMudanca ? '#94a3b8' : foiLancado ? '#22c55e' : erro ? '#ef4444' : duplicata?.length ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)';

    return (
        <div style={{
            background: foiAtualizado ? 'rgba(250,204,21,0.05)' : foiDuplicataSemMudanca ? 'rgba(148,163,184,0.05)' : foiLancado ? 'rgba(34,197,94,0.05)' : erro ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${borderColor}`,
            borderRadius: '10px', overflow: 'hidden'
        }}>
            {/* Cabeçalho do card */}
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                    cursor: 'pointer', borderBottom: expandido ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
                onClick={() => setExpandido(e => !e)}
            >
                <ChevronDown size={14} color="#64748b"
                    style={{ transform: expandido ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lote.motorista || '(sem motorista)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                        {lote.placa1}{lote.placa2 ? ` / ${lote.placa2}` : ''} · {lote.operacao}
                    </div>
                </div>
                {foiLancado && <CheckCircle size={15} color="#22c55e" />}
                {foiAtualizado && <CheckCircle size={15} color="#facc15" />}
                {foiDuplicataSemMudanca && <CheckCircle size={15} color="#94a3b8" />}
                {erro && <AlertCircle size={15} color="#ef4444" />}
                {!temSucesso && !erro && duplicata?.length > 0 && <AlertCircle size={15} color="#fbbf24" />}
                {!temSucesso && (
                    <button
                        onClick={e => { e.stopPropagation(); onRemover(lote._id); }}
                        disabled={lancando}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                        title="Remover lançamento"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* Aviso de coleta duplicada (pré-confirmação) */}
            {duplicata?.length > 0 && !temSucesso && !erro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: '11px', fontWeight: '600' }}>
                    <AlertCircle size={12} style={{ flexShrink: 0 }} />
                    Coleta já ativa: {duplicata.join(', ')}
                </div>
            )}
            {/* Resultado pós-confirmação */}
            {foiAtualizado && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(250,204,21,0.08)', borderBottom: '1px solid rgba(250,204,21,0.2)', color: '#facc15', fontSize: '11px', fontWeight: '600' }}>
                    <CheckCircle size={12} style={{ flexShrink: 0 }} />
                    Coleta já existia — motorista/placas atualizados e cadastro resetado
                </div>
            )}
            {foiDuplicataSemMudanca && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(148,163,184,0.08)', borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>
                    <CheckCircle size={12} style={{ flexShrink: 0 }} />
                    Coleta já existia — sem alterações
                </div>
            )}

            {/* Corpo expansível */}
            {expandido && !sucesso && (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                    {/* Motorista + Placas + Tipo + Data */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <Campo label="MOTORISTA">
                            <input className="input-internal" style={{ fontSize: '11px' }}
                                value={lote.motorista}
                                onChange={e => onChange(lote._id, 'motorista', e.target.value)} />
                        </Campo>
                        <Campo label="PLACA 1">
                            <input className="input-internal" style={{ fontSize: '11px', fontFamily: 'monospace' }}
                                value={lote.placa1}
                                onChange={e => onChange(lote._id, 'placa1', e.target.value.toUpperCase())} />
                        </Campo>
                        <Campo label="PLACA 2">
                            <input className="input-internal" style={{ fontSize: '11px', fontFamily: 'monospace' }}
                                value={lote.placa2}
                                onChange={e => onChange(lote._id, 'placa2', e.target.value.toUpperCase())} />
                        </Campo>
                        <Campo label="TIPO">
                            <select className="input-internal" style={{ fontSize: '11px' }}
                                value={lote.tipoVeiculo}
                                onChange={e => onChange(lote._id, 'tipoVeiculo', e.target.value)}>
                                {OPCOES_VEICULO.map(v => <option key={v} style={{ color: 'black' }}>{v}</option>)}
                            </select>
                        </Campo>
                        <Campo label="DATA PREVISTA" cor={lote.dataPrevista ? '#60a5fa' : '#f87171'}>
                            <input type="date" className="input-internal" style={{ fontSize: '11px' }}
                                value={lote.dataPrevista || ''}
                                onChange={e => onChange(lote._id, 'dataPrevista', e.target.value)} />
                        </Campo>
                    </div>

                    {/* Operação */}
                    <Campo label="OPERAÇÃO">
                        <select className="input-internal" style={{ fontSize: '11px' }}
                            value={lote.operacao}
                            onChange={e => onChange(lote._id, 'operacao', e.target.value)}>
                            {OPCOES_OPERACAO.map(op => <option key={op} style={{ color: 'black' }}>{op}</option>)}
                        </select>
                    </Campo>

                    {/* Coletas */}
                    <div style={{ display: 'grid', gridTemplateColumns: temRecife && temMoreno ? '1fr 1fr' : '1fr', gap: '8px' }}>
                        {temRecife && (
                            <Campo label="COLETA RECIFE" cor="#3b82f6">
                                <input className="input-internal" style={{ fontSize: '11px', borderColor: 'rgba(59,130,246,0.4)' }}
                                    value={lote.coletaRecife}
                                    onChange={e => onChange(lote._id, 'coletaRecife', e.target.value)} />
                            </Campo>
                        )}
                        {temMoreno && (
                            <Campo label="COLETA MORENO" cor="#f59e0b">
                                <input className="input-internal" style={{ fontSize: '11px', borderColor: 'rgba(245,158,11,0.4)' }}
                                    value={lote.coletaMoreno}
                                    onChange={e => onChange(lote._id, 'coletaMoreno', e.target.value)}
                                    placeholder="PLAS:x | PORC:y | ELET:z" />
                            </Campo>
                        )}
                        {temInterestadual && (
                            <Campo label="COLETA" cor="#f97316">
                                <input className="input-internal" style={{ fontSize: '11px', borderColor: 'rgba(249,115,22,0.4)' }}
                                    value={lote.coletaInterestadual || ''}
                                    onChange={e => onChange(lote._id, 'coletaInterestadual', e.target.value)} />
                            </Campo>
                        )}
                    </div>

                    {/* Rotas + Observação */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                        {temRecife && (
                            <Campo label="ROTA RECIFE">
                                <input className="input-internal" style={{ fontSize: '11px' }}
                                    value={lote.rotaRecife}
                                    onChange={e => onChange(lote._id, 'rotaRecife', e.target.value)} />
                            </Campo>
                        )}
                        {temMoreno && (
                            <Campo label="ROTA MORENO">
                                <input className="input-internal" style={{ fontSize: '11px' }}
                                    value={lote.rotaMoreno}
                                    onChange={e => onChange(lote._id, 'rotaMoreno', e.target.value)} />
                            </Campo>
                        )}
                        <Campo label="OBSERVAÇÃO" style={{ gridColumn: !temRecife && !temMoreno ? '1 / -1' : '' }}>
                            <input className="input-internal" style={{ fontSize: '11px' }}
                                value={lote.observacao}
                                onChange={e => onChange(lote._id, 'observacao', e.target.value)} />
                        </Campo>
                    </div>

                    {/* Erro */}
                    {erro && (
                        <div style={{
                            fontSize: '11px', color: '#fca5a5', background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '6px 10px',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <AlertCircle size={12} /> {erro}
                        </div>
                    )}
                </div>
            )}

            {/* Sucesso compacto */}
            {sucesso && (
                <div style={{ padding: '6px 14px 8px', fontSize: '11px', color: '#4ade80' }}>
                    Lançado com sucesso
                </div>
            )}
        </div>
    );
}

function Campo({ label, cor, children, style }) {
    return (
        <div style={style}>
            <label style={{ fontSize: '9px', fontWeight: '700', color: cor || '#64748b', letterSpacing: '0.05em', display: 'block', marginBottom: '3px' }}>
                {label}
            </label>
            {children}
        </div>
    );
}
