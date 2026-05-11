import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, ChevronDown, AlertCircle, CheckCircle, Loader, Trash2, MapPin } from 'lucide-react';
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
    if (t.includes('CARRETA')) return 'CARRETA';
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

    return {
        coletaRecife: ehRecife ? coleta : '',
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

// Consolidar linhas com mesma placa em 1 LoteItem
function consolidarPorPlaca(linhasBrutas) {
    const grupos = new Map(); // chave: placa1+placa2

    for (const linha of linhasBrutas) {
        const chave = (linha.placa1 + '|' + (linha.placa2 || '')).toUpperCase();
        if (!grupos.has(chave)) {
            grupos.set(chave, []);
        }
        grupos.get(chave).push(linha);
    }

    const lotes = [];

    for (const [, grupo] of grupos) {
        if (grupo.length === 1) {
            const l = grupo[0];
            const { coletaRecife, slots } = extrairColetas(l.operacaoBase, l.numeroColeta);
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
                coletaInterestadual: '',
                rotaRecife: l.operacaoBase.includes('RECIFE') ? l.rota : '',
                rotaMoreno: !l.operacaoBase.includes('RECIFE') ? l.rota : '',
                observacao: l.obsRestante,
            });
        } else {
            // Consolidar múltiplas linhas
            const base = grupo[0];
            let slotsAcumulados = { plastico: '', porcelana: '', eletrik: '' };
            let coletaRecifeAcum = '';
            let operacaoCombinada = base.operacaoBase;
            const rotaSet = new Set();
            const obsSet = new Set();

            for (const l of grupo) {
                if (l.rota) rotaSet.add(l.rota);
                if (l.obsRestante) obsSet.add(l.obsRestante);

                const { coletaRecife, slots } = extrairColetas(l.operacaoBase, l.numeroColeta);
                if (coletaRecife) coletaRecifeAcum = coletaRecifeAcum ? coletaRecifeAcum + ',' + coletaRecife : coletaRecife;
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
                coletaInterestadual: '',
                rotaRecife: operacaoCombinada.includes('RECIFE') ? rotaFinal : '',
                rotaMoreno: !operacaoCombinada.includes('RECIFE') || operacaoCombinada.includes('/') ? rotaFinal : '',
                observacao: [...obsSet].join(' - '),
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

    console.log('[ImportarLotes] Colunas mapeadas:', { colNumeroColeta, colOperacao, colObservacao, colPlacaV, colPlacaC, colMotorista, colTipo });

    const linhasBrutas = [];

    for (const linha of linhas) {
        const get = (col) => col ? String(linha[col] ?? '').trim() : '';

        const numeroColeta = get(colNumeroColeta);
        const operacaoCSV  = get(colOperacao);
        const observacaoCSV = get(colObservacao);
        const placaVeiculo = get(colPlacaV).toUpperCase();
        const placaCarreta = get(colPlacaC).toUpperCase();
        const motorista    = get(colMotorista);
        const tipoVeiculo  = get(colTipo);

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
    const [eletrikPendente, setEletrikPendente] = useState(null);
    const [rotaNovaPendente, setRotaNovaPendente] = useState(null); // lotes com "ROTA NOVA" aguardando confirmação
    const [rotaNovaFila,  setRotaNovaFila]  = useState([]);
    const [rotaNovaAtual, setRotaNovaAtual] = useState(null);
    const [rotaNovaInput, setRotaNovaInput] = useState('');
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
                    (campo || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagsAtivas.add(t));
                }
            }
            const novasDuplicatas = {};
            for (const lote of lotesParaVerificar) {
                const tags = [
                    ...(lote.coletaRecife || '').split(','),
                    ...(lote.coletaMoreno || '').split(','),
                ].map(t => t.trim()).filter(Boolean);
                const dup = tags.filter(t => tagsAtivas.has(t));
                if (dup.length > 0) novasDuplicatas[lote._id] = dup;
            }
            setDuplicatas(novasDuplicatas);
        } catch (_) {
            setDuplicatas({});
        }
    }, []);

    const avancarParaPasso2 = (lotesResolvidos) => {
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
                const wb = XLSX.read(ev.target.result, { type: 'array' });
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

                // PORCELANA/ELETRIK é sempre Moreno — só ELETRIK puro é ambíguo
                const temEletrikAmbiguo = processados.some(l => l.operacao === 'ELETRIK');

                if (temEletrikAmbiguo) {
                    setEletrikPendente(processados);
                } else {
                    avancarParaPasso2(processados);
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

        for (const lote of lotes) {
            if (sucessos[lote._id]) { ok++; continue; } // já lançado
            try {
                const res = await lancarPayloadDireto({ ...lote, data_prevista: dataPrevista });
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
                return { lote: l, veiculo };
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
        setEletrikPendente(null);
        setRotaNovaPendente(null);
        setRotaNovaFila([]);
        setRotaNovaAtual(null);
        setRotaNovaInput('');
        setProvisaoFila([]);
        setProvisaoAtual(null);
        setDataPrevista(obterDataBrasiliaISO());
        onClose();
    };

    const resolverEletrik = (tipoEletrik) => {
        const resolvidos = eletrikPendente.map(lote => {
            if (lote.operacao === 'ELETRIK') {
                if (tipoEletrik === 'SUL') {
                    // coletaMoreno é "ELET:123" — extrair o número e mover para interestadual
                    const m = (lote.coletaMoreno || '').match(/ELET:([^|]+)/i);
                    const coletaElet = m ? m[1].trim() : lote.coletaMoreno || '';
                    return { ...lote, operacao: 'ELETRIK SUL', coletaMoreno: '', coletaInterestadual: coletaElet };
                }
                return lote; // Moreno: mantém operacao ELETRIK, coleta já está no coletaMoreno
            }
            return lote; // demais operações (PORCELANA/ELETRIK etc.) são sempre Moreno
        });
        setEletrikPendente(null);
        avancarParaPasso2(resolvidos);
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

                    {/* Modal Eletrik — sobrepõe o conteúdo quando há ambiguidade */}
                    {eletrikPendente && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                            background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
                        }}>
                            <AlertCircle size={36} color="#f59e0b" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
                                Operação Eletrik detectada
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px', maxWidth: '320px', lineHeight: 1.6 }}>
                                {eletrikPendente.filter(l => l.operacao === 'ELETRIK' || l.operacao === 'PORCELANA/ELETRIK').length} lote(s) com Eletrik identificados.
                                Qual unidade?
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => resolverEletrik('SUL')}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                                        color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Eletrik Sul
                                </button>
                                <button
                                    onClick={() => resolverEletrik('MORENO')}
                                    style={{
                                        padding: '12px 28px', borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(135deg,#d97706,#f59e0b)',
                                        color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Eletrik Moreno
                                </button>
                            </div>
                            <button
                                onClick={() => { setEletrikPendente(null); if (fileRef.current) fileRef.current.value = ''; }}
                                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                            >
                                Cancelar importação
                            </button>
                        </div>
                    )}

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

                            {/* Data global */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', background: 'rgba(59,130,246,0.08)',
                                border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px'
                            }}>
                                <label style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                    DATA PREVISTA (todos):
                                </label>
                                <input
                                    type="date"
                                    className="input-internal"
                                    value={dataPrevista}
                                    onChange={e => setDataPrevista(e.target.value)}
                                    style={{ width: '160px', padding: '6px 10px', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', color: '#475569' }}>
                                    Aplicada a todos os lançamentos
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
                veiculo={provisaoAtual.veiculo}
                motorista={provisaoAtual.lote.motorista}
                dataSaida={dataPrevista}
                onConfirmar={() => {
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

                    {/* Motorista + Placas + Tipo */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
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
