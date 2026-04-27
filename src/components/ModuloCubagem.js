import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Warehouse, RefreshCw, Filter, CheckSquare, Square, Save,
    AlertCircle, Clock, Package, Truck, Box, ChevronUp, ChevronDown,
    DollarSign, X
} from 'lucide-react';
import api from '../services/apiService';
import { UFS_BRASIL, STATUS_CUBAGEM } from '../constants';

const POLL_INTERVAL = 300; // segundos

const STATUS_CORES = {
    'COLETADO':                      { bg: 'rgba(34,197,94,0.2)',  cor: '#4ade80' },
    'SEPARADO':                      { bg: 'rgba(59,130,246,0.2)', cor: '#60a5fa' },
    'EM SEPARAÇÃO':                  { bg: 'rgba(251,191,36,0.2)', cor: '#fbbf24' },
    'SEPARADO / AGUARDANDO ETIQUETA':{ bg: 'rgba(251,191,36,0.15)',cor: '#f59e0b' },
    'DEVOLUÇÃO REALIZADA':           { bg: 'rgba(239,68,68,0.2)',  cor: '#f87171' },
    'BLOQUEADO PELO COMERCIAL':      { bg: 'rgba(239,68,68,0.2)',  cor: '#f87171' },
};

const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
};

function formatCountdown(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatRelTime(iso) {
    if (!iso) return null;
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    return `há ${Math.floor(diff / 3600)}h`;
}

function BadgeStatus({ status }) {
    const s = (status || '').trim().toUpperCase();
    const c = STATUS_CORES[s] || { bg: 'rgba(100,116,139,0.2)', cor: '#94a3b8' };
    return (
        <span style={{
            background: c.bg, color: c.cor,
            border: `1px solid ${c.cor}40`,
            borderRadius: '6px', padding: '2px 7px',
            fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap',
            letterSpacing: '0.3px'
        }}>
            {s || '—'}
        </span>
    );
}

export default function ModuloCubagem() {
    const [linhas, setLinhas] = useState([]);
    const [selecionados, setSelecionados] = useState(new Set());
    const [countdown, setCountdown] = useState(POLL_INTERVAL);
    const [loading, setLoading] = useState(false);
    const [configurado, setConfigurado] = useState(true);
    const [atualizadoEm, setAtualizadoEm] = useState(null);
    const [filtroAtivo, setFiltroAtivo] = useState(true);
    const [coleta, setColeta] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [aviso, setAviso] = useState(null);
    const [ordenacao, setOrdenacao] = useState({ col: null, dir: 'asc' });
    const [modalRedespacho, setModalRedespacho] = useState(false);
    const [nomeRedespacho, setNomeRedespacho] = useState('');
    const [redespacho, setRedespacho] = useState(null); // null=nao decidido, false=nao, true=sim
    const [filtroUF, setFiltroUF] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [modalMultiRedespacho, setModalMultiRedespacho] = useState(false);
    const [redespachos, setRedespachos] = useState([]); // [{id, nome, uf, nfs: Set<_idx>}]
    const countdownRef = useRef(POLL_INTERVAL);
    const timerRef = useRef(null);

    const STATUS_OCULTOS = useMemo(() => new Set(['']), []);

    const buscar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/sheets/porcelana');
            const data = res.data;
            if (data.success) {
                setLinhas(data.linhas || []);
                setConfigurado(data.configurado !== false);
                setAtualizadoEm(data.atualizado_em || null);
            }
        } catch (e) {
            console.error('Sheets error:', e);
        } finally {
            setLoading(false);
            countdownRef.current = POLL_INTERVAL;
            setCountdown(POLL_INTERVAL);
        }
    }, []);

    useEffect(() => {
        buscar();
        timerRef.current = setInterval(() => {
            countdownRef.current -= 1;
            setCountdown(c => c - 1);
            if (countdownRef.current <= 0) buscar();
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [buscar]);

    const linhasFiltradas = useMemo(() => {
        let base = filtroAtivo
            ? linhas.filter(r => !STATUS_OCULTOS.has((r.status || '').trim().toUpperCase()))
            : linhas;
        if (filtroUF) base = base.filter(r => (r.uf || '').toUpperCase() === filtroUF);
        if (filtroStatus) base = base.filter(r => (r.status || '').trim().toUpperCase() === filtroStatus);
        if (!ordenacao.col) return base;
        return [...base].sort((a, b) => {
            let va = a[ordenacao.col], vb = b[ordenacao.col];
            if (typeof va === 'number') return ordenacao.dir === 'asc' ? va - vb : vb - va;
            return ordenacao.dir === 'asc'
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    }, [linhas, filtroAtivo, STATUS_OCULTOS, ordenacao, filtroUF, filtroStatus]);

    const opcoesUF = useMemo(() => {
        const extras = [...new Set(linhas.map(l => (l.uf || '').toUpperCase()).filter(Boolean))];
        return [...new Set([...UFS_BRASIL, ...extras])].sort();
    }, [linhas]);

    const opcoesStatus = useMemo(() => {
        const extras = [...new Set(linhas.map(l => (l.status || '').trim().toUpperCase()).filter(Boolean))];
        return [...new Set([...STATUS_CUBAGEM, ...extras])].sort();
    }, [linhas]);

    const totais = useMemo(() => {
        const sel = linhasFiltradas.filter(r => selecionados.has(r._idx));
        const totalM3 = sel.reduce((s, r) => s + r.m3, 0);
        const base = totalM3 * 1.10;
        const mix = base / 2.5 / 1.3;
        const kit = base / 2.5 / 1.9;
        const valorTotal = sel.reduce((s, r) => s + (r.valor || 0), 0);
        return {
            qtd: sel.length,
            m3: totalM3,
            base,
            mix,
            kit,
            valorTotal,
            volumes: sel.reduce((s, r) => s + r.volumes, 0),
            peso: sel.reduce((s, r) => s + r.peso_kg, 0),
        };
    }, [linhasFiltradas, selecionados]);

    const toggleSel = (idx) => {
        setSelecionados(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const toggleAll = () => {
        const todos = linhasFiltradas.map(r => r._idx);
        const todosSelected = todos.every(i => selecionados.has(i));
        setSelecionados(todosSelected ? new Set() : new Set(todos));
    };

    const ordenar = (col) => {
        setOrdenacao(prev =>
            prev.col === col
                ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { col, dir: 'asc' }
        );
    };

    const abrirModalRedespacho = () => {
        if (!coleta.trim()) { setAviso('Informe o número da coleta.'); return; }
        if (totais.qtd === 0) { setAviso('Selecione ao menos uma linha.'); return; }
        setRedespacho(null);
        setNomeRedespacho('');
        setModalRedespacho(true);
    };

    const salvar = async (isRedespacho, nomeRed, mapaRedespacho = null) => {
        setModalRedespacho(false);
        setModalMultiRedespacho(false);
        const sel = linhasFiltradas.filter(r => selecionados.has(r._idx));
        const clientesPrincipais = [...new Set(sel.map(r => r.cliente).filter(Boolean))].slice(0, 3).join(', ');
        const destinos = [...new Set(sel.map(r => r.uf).filter(Boolean))].join('/');
        const hoje = new Date().toISOString().split('T')[0];

        const payload = {
            numero_coleta: coleta.trim(),
            motorista: sel[0]?.motorista || '',
            cliente: clientesPrincipais || 'Porcelana',
            redespacho: isRedespacho,
            nome_redespacho: nomeRed || '',
            destino: destinos || 'Múltiplos',
            volume: String(totais.volumes),
            data: hoje,
            faturado: false,
            tipo: 'Porcelana',
            metragem_total: parseFloat(totais.m3.toFixed(3)),
            valor_mix_total: parseFloat(totais.mix.toFixed(2)),
            valor_kit_total: parseFloat(totais.kit.toFixed(2)),
            valor_total: parseFloat(totais.valorTotal.toFixed(2)),
            peso_total: parseFloat(totais.peso.toFixed(1)),
            itens: sel.map(r => ({
                numero_nf: r.nf,
                metragem: r.m3,
                uf: r.uf || '',
                regiao: r.regiao || '',
                valor: r.valor || 0,
                volumes: r.volumes || 0,
                peso_kg: r.peso_kg || 0,
                redespacho_nome: mapaRedespacho?.[r._idx]?.nome || null,
                redespacho_uf: mapaRedespacho?.[r._idx]?.uf || null,
            })),
        };

        setSalvando(true);
        try {
            const res = await api.post('/cubagens', payload);
            if (res.data?.success) {
                setAviso(`Cubagem salva! ID: ${res.data.id}`);
                setSelecionados(new Set());
                setColeta('');
            } else {
                setAviso('Erro ao salvar cubagem.');
            }
        } catch (e) {
            setAviso(e?.response?.data?.message || 'Erro ao salvar.');
        } finally {
            setSalvando(false);
        }
    };

    const SortIcon = ({ col }) => {
        if (ordenacao.col !== col) return null;
        return ordenacao.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
    };

    const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ── Tela não configurado ──────────────────────────────────────────────────
    if (!configurado) {
        return (
            <div style={{ padding: '20px', maxWidth: '860px', margin: '0 auto' }}>
                <div style={{ ...glassCard, padding: '40px', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
                    <h3 style={{ color: '#f59e0b', fontSize: '18px', marginBottom: '12px' }}>Google Sheets não configurado</h3>
                    <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px' }}>
                        Para espelhar a planilha de Porcelana, configure as variáveis de ambiente:
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px', textAlign: 'left', fontSize: '12px', fontFamily: 'monospace', color: '#a78bfa' }}>
                        GOOGLE_SERVICE_ACCOUNT_JSON={"{"}"type":"service_account",...{"}"}<br />
                        SHEETS_PORCELANA_ID=1abc...xyz<br />
                        SHEETS_PORCELANA_RANGE=Embarques!A1:AJ500
                    </div>
                    <p style={{ color: '#64748b', marginTop: '16px', fontSize: '12px' }}>
                        Compartilhe a planilha com o e-mail da service account como "Leitor".
                    </p>
                </div>
            </div>
        );
    }

    const todosSelecionados = linhasFiltradas.length > 0 && linhasFiltradas.every(r => selecionados.has(r._idx));

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>

            {/* MODAL REDESPACHO */}
            {modalRedespacho && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        ...glassCard,
                        border: '1px solid rgba(251,191,36,0.35)',
                        padding: '28px 32px',
                        maxWidth: '420px', width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ color: '#fbbf24', fontSize: '16px', fontWeight: '700' }}>
                                Cubagem com Redespacho?
                            </div>
                            <button onClick={() => setModalRedespacho(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {redespacho === null && (
                            <>
                                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.6' }}>
                                    Esta cubagem é um <strong style={{ color: '#fbbf24' }}>Redespacho</strong>?
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => salvar(false, '')}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#e2e8f0', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
                                        }}
                                    >
                                        Não
                                    </button>
                                    <button
                                        onClick={() => {
                                            setModalRedespacho(false);
                                            setRedespachos([{ id: Date.now(), nome: '', uf: '', nfs: new Set() }]);
                                            setModalMultiRedespacho(true);
                                        }}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #d97706, #92400e)',
                                            border: 'none',
                                            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700'
                                        }}
                                    >
                                        Sim
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}

            {/* MODAL MULTI-REDESPACHO */}
            {modalMultiRedespacho && (() => {
                const selAtual = linhasFiltradas.filter(r => selecionados.has(r._idx));
                const nfsEmRedespacho = new Set();
                redespachos.forEach(rd => rd.nfs.forEach(idx => nfsEmRedespacho.add(idx)));
                const nfsDiretas = selAtual.filter(r => !nfsEmRedespacho.has(r._idx));
                const tudoValido = redespachos.every(rd => rd.nome.trim() && rd.uf && rd.nfs.size > 0);

                const atualizarRedespacho = (id, campo, valor) => {
                    setRedespachos(prev => prev.map(rd => rd.id === id ? { ...rd, [campo]: valor } : rd));
                };
                const toggleNfNoRedespacho = (rdId, idx) => {
                    setRedespachos(prev => prev.map(rd => {
                        const nfs = new Set(rd.nfs);
                        if (rd.id === rdId) {
                            if (nfs.has(idx)) nfs.delete(idx);
                            else nfs.add(idx);
                        } else {
                            nfs.delete(idx); // garantir NF só em um redespacho
                        }
                        return { ...rd, nfs };
                    }));
                };
                const adicionarRedespacho = () => {
                    setRedespachos(prev => [...prev, { id: Date.now() + Math.random(), nome: '', uf: '', nfs: new Set() }]);
                };
                const removerRedespacho = (id) => {
                    setRedespachos(prev => prev.length > 1 ? prev.filter(rd => rd.id !== id) : prev);
                };
                const confirmar = () => {
                    if (!tudoValido) return;
                    const mapa = {};
                    redespachos.forEach(rd => {
                        rd.nfs.forEach(idx => { mapa[idx] = { nome: rd.nome.trim(), uf: rd.uf }; });
                    });
                    const nomes = redespachos.map(rd => rd.nome.trim()).join(' / ');
                    salvar(true, nomes, mapa);
                };

                return (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                        padding: '20px'
                    }}>
                        <div style={{
                            ...glassCard,
                            border: '1px solid rgba(251,191,36,0.35)',
                            padding: '24px 28px',
                            maxWidth: '900px', width: '100%', maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ color: '#fbbf24', fontSize: '17px', fontWeight: '700' }}>
                                    Configurar Redespachos
                                </div>
                                <button onClick={() => setModalMultiRedespacho(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                                {redespachos.map((rd, i) => {
                                    const ufsDisponiveis = [...new Set(
                                        selAtual.filter(r => rd.nfs.has(r._idx)).map(r => (r.uf || '').toUpperCase()).filter(Boolean)
                                    )].sort();
                                    return (
                                        <div key={rd.id} style={{
                                            background: 'rgba(251,191,36,0.05)',
                                            border: '1px solid rgba(251,191,36,0.2)',
                                            borderRadius: '10px', padding: '14px 16px', marginBottom: '12px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                <div style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px', minWidth: '100px' }}>
                                                    Redespacho {i + 1}
                                                </div>
                                                <input
                                                    value={rd.nome}
                                                    onChange={e => atualizarRedespacho(rd.id, 'nome', e.target.value)}
                                                    placeholder="Nome (ex: Transportadora XYZ)"
                                                    style={{
                                                        flex: 1, background: 'rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        borderRadius: '6px', color: '#e2e8f0',
                                                        padding: '7px 10px', fontSize: '13px',
                                                    }}
                                                />
                                                <select
                                                    value={rd.uf}
                                                    onChange={e => atualizarRedespacho(rd.id, 'uf', e.target.value)}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        borderRadius: '6px', color: '#e2e8f0',
                                                        padding: '7px 10px', fontSize: '13px', minWidth: '90px',
                                                    }}
                                                >
                                                    <option value="">UF…</option>
                                                    {ufsDisponiveis.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                                {redespachos.length > 1 && (
                                                    <button
                                                        onClick={() => removerRedespacho(rd.id)}
                                                        style={{
                                                            background: 'rgba(239,68,68,0.15)',
                                                            border: '1px solid rgba(239,68,68,0.3)',
                                                            borderRadius: '6px', color: '#f87171',
                                                            cursor: 'pointer', padding: '4px 8px', fontSize: '12px',
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>
                                                NFs deste redespacho ({rd.nfs.size}):
                                            </div>
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                                gap: '6px', maxHeight: '160px', overflowY: 'auto',
                                            }}>
                                                {selAtual.map(r => {
                                                    const isMine = rd.nfs.has(r._idx);
                                                    const isInOther = !isMine && nfsEmRedespacho.has(r._idx);
                                                    return (
                                                        <div
                                                            key={r._idx}
                                                            onClick={() => toggleNfNoRedespacho(rd.id, r._idx)}
                                                            style={{
                                                                background: isMine ? 'rgba(251,191,36,0.2)' : isInOther ? 'rgba(100,116,139,0.1)' : 'rgba(0,0,0,0.2)',
                                                                border: `1px solid ${isMine ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                                                borderRadius: '5px', padding: '5px 8px', cursor: 'pointer',
                                                                fontSize: '11px', color: isInOther ? '#475569' : '#cbd5e1',
                                                                display: 'flex', gap: '6px', alignItems: 'center',
                                                                opacity: isInOther ? 0.5 : 1,
                                                            }}
                                                        >
                                                            {isMine
                                                                ? <CheckSquare size={12} style={{ color: '#fbbf24' }} />
                                                                : <Square size={12} style={{ color: '#475569' }} />
                                                            }
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                NF {r.nf || '—'} · {r.uf || '—'} · {r.cliente || '—'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    onClick={adicionarRedespacho}
                                    style={{
                                        width: '100%', background: 'rgba(251,191,36,0.1)',
                                        border: '1px dashed rgba(251,191,36,0.4)',
                                        borderRadius: '8px', color: '#fbbf24',
                                        cursor: 'pointer', padding: '10px', fontSize: '13px', fontWeight: '600',
                                    }}
                                >
                                    + Adicionar outro redespacho
                                </button>
                            </div>

                            <div style={{
                                marginTop: '14px', padding: '10px 14px',
                                background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                color: '#94a3b8', fontSize: '12px',
                                display: 'flex', gap: '18px', flexWrap: 'wrap',
                            }}>
                                <span><strong style={{ color: '#fbbf24' }}>{nfsEmRedespacho.size}</strong> NF(s) em redespacho</span>
                                <span><strong style={{ color: '#60a5fa' }}>{nfsDiretas.length}</strong> NF(s) irão direto ao cliente</span>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button
                                    onClick={() => setModalMultiRedespacho(false)}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#94a3b8', cursor: 'pointer', fontSize: '13px',
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmar}
                                    disabled={!tudoValido}
                                    style={{
                                        flex: 2, padding: '10px', borderRadius: '8px',
                                        background: tudoValido
                                            ? 'linear-gradient(135deg, #d97706, #92400e)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: 'none',
                                        color: tudoValido ? '#fff' : '#475569',
                                        cursor: tudoValido ? 'pointer' : 'not-allowed',
                                        fontSize: '14px', fontWeight: '700',
                                    }}
                                >
                                    Confirmar e Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* AVISO */}
            {aviso && (
                <div style={{
                    ...glassCard,
                    padding: '14px 20px',
                    marginBottom: '16px',
                    border: '1px solid rgba(251,191,36,0.3)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    color: '#fbbf24', fontSize: '14px'
                }}>
                    <AlertCircle size={18} />
                    {aviso}
                    <button onClick={() => setAviso(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
            )}

            {/* CABEÇALHO */}
            <div style={{
                borderRadius: '16px',
                marginBottom: '16px',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
                boxShadow: '0 8px 32px rgba(217,119,6,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Warehouse size={28} style={{ color: '#fff' }} />
                    <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '18px', letterSpacing: '0.5px' }}>
                            Cubagem Porcelana
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>
                            Espelho Google Sheets — {linhas.length} registros
                            {atualizadoEm && ` · ${formatRelTime(atualizadoEm)}`}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.25)', borderRadius: '8px',
                        padding: '6px 12px', color: '#fff', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <Clock size={14} />
                        {formatCountdown(countdown)}
                    </div>
                    <button
                        onClick={buscar}
                        disabled={loading}
                        style={{
                            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px', color: '#fff', cursor: 'pointer',
                            padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Atualizar
                    </button>
                    <button
                        onClick={() => setFiltroAtivo(f => !f)}
                        style={{
                            background: filtroAtivo ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                            border: `1px solid ${filtroAtivo ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
                            borderRadius: '8px', color: '#fff', cursor: 'pointer',
                            padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <Filter size={14} />
                        {filtroAtivo ? 'Filtro ON' : 'Filtro OFF'}
                    </button>
                </div>
            </div>

            {/* CARDS DE TOTAIS */}
            {totais.qtd > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    {[
                        { label: 'SELECIONADOS', valor: totais.qtd, cor: '#f59e0b', icon: <CheckSquare size={16} /> },
                        { label: 'M³ TOTAL', valor: totais.m3.toFixed(3), cor: '#3b82f6', icon: <Box size={16} /> },
                        { label: 'BASE (+10%)', valor: totais.base.toFixed(3), cor: '#60a5fa', icon: <Box size={16} /> },
                        { label: 'MIX', valor: totais.mix.toFixed(2), cor: '#a78bfa', icon: <Truck size={16} /> },
                        { label: 'KIT', valor: totais.kit.toFixed(2), cor: '#818cf8', icon: <Truck size={16} /> },
                        { label: 'VOLUMES', valor: totais.volumes, cor: '#34d399', icon: <Package size={16} /> },
                        { label: 'VALOR TOTAL', valor: fmtBRL(totais.valorTotal), cor: '#f59e0b', icon: <DollarSign size={16} /> },
                    ].map(({ label, valor, cor, icon }) => (
                        <div key={label} style={{ ...glassCard, padding: '14px 16px', border: `1px solid ${cor}30` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '6px' }}>
                                <span style={{ color: cor }}>{icon}</span>
                                {label}
                            </div>
                            <div style={{ color: cor, fontSize: label === 'VALOR TOTAL' ? '15px' : '22px', fontWeight: '800' }}>{valor}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* TABELA */}
            <div style={{ ...glassCard, overflow: 'hidden', marginBottom: '16px' }}>
                {/* Cabeçalho da tabela */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 2fr 1.2fr 60px 60px 70px 80px 80px 100px 80px 120px',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(217,119,6,0.12)',
                    borderBottom: '1px solid rgba(217,119,6,0.2)',
                    fontSize: '10px', fontWeight: '700', color: '#d97706',
                    letterSpacing: '0.6px', textTransform: 'uppercase',
                }}>
                    <div
                        onClick={toggleAll}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        {todosSelecionados
                            ? <CheckSquare size={14} style={{ color: '#f59e0b' }} />
                            : <Square size={14} style={{ color: '#64748b' }} />
                        }
                    </div>
                    {[
                        ['cliente', 'Cliente'],
                        ['cidade', 'Cidade'],
                        ['uf', 'UF', 'filter-uf'],
                        ['doca', 'Doca'],
                        ['volumes', 'Vol'],
                        ['peso_kg', 'Peso kg'],
                        ['m3', 'M³'],
                        ['valor', 'Valor R$'],
                        ['nf', 'NF'],
                        ['status', 'Status', 'filter-status'],
                    ].map(([col, label, filterKind]) => {
                        if (filterKind === 'filter-uf') {
                            return (
                                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <select
                                        value={filtroUF}
                                        onChange={e => setFiltroUF(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            background: filtroUF ? 'rgba(30,41,59,0.8)' : 'rgba(0,0,0,0.25)',
                                            border: `1px solid ${filtroUF ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.25)'}`,
                                            borderRadius: '5px', color: filtroUF ? '#f1f5f9' : '#94a3b8', fontSize: '10px',
                                            padding: '2px 4px', fontWeight: '700', letterSpacing: '0.5px',
                                            cursor: 'pointer', width: '100%', textTransform: 'uppercase',
                                        }}
                                    >
                                        <option value="">UF ▾</option>
                                        {opcoesUF.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <span onClick={() => ordenar(col)} style={{ cursor: 'pointer' }}><SortIcon col={col} /></span>
                                </div>
                            );
                        }
                        if (filterKind === 'filter-status') {
                            return (
                                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <select
                                        value={filtroStatus}
                                        onChange={e => setFiltroStatus(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            background: filtroStatus ? 'rgba(30,41,59,0.8)' : 'rgba(0,0,0,0.25)',
                                            border: `1px solid ${filtroStatus ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.25)'}`,
                                            borderRadius: '5px', color: filtroStatus ? '#f1f5f9' : '#94a3b8', fontSize: '10px',
                                            padding: '2px 4px', fontWeight: '700', letterSpacing: '0.3px',
                                            cursor: 'pointer', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden',
                                        }}
                                    >
                                        <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>STATUS ▾</option>
                                        {opcoesStatus.map(s => <option key={s} value={s} style={{ background: '#1e293b', color: '#f1f5f9' }}>{s}</option>)}
                                    </select>
                                    <span onClick={() => ordenar(col)} style={{ cursor: 'pointer' }}><SortIcon col={col} /></span>
                                </div>
                            );
                        }
                        return (
                            <div
                                key={col}
                                onClick={() => ordenar(col)}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', userSelect: 'none' }}
                            >
                                {label} <SortIcon col={col} />
                            </div>
                        );
                    })}
                </div>

                {/* Linhas */}
                <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                    {linhasFiltradas.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                            {loading ? 'Carregando...' : 'Nenhum registro encontrado.'}
                        </div>
                    )}
                    {linhasFiltradas.map((r, i) => {
                        const sel = selecionados.has(r._idx);
                        return (
                            <div
                                key={r._idx}
                                onClick={() => toggleSel(r._idx)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '36px 2fr 1.2fr 60px 60px 70px 80px 80px 100px 80px 120px',
                                    gap: '8px',
                                    padding: '9px 16px',
                                    alignItems: 'center',
                                    background: sel
                                        ? 'rgba(217,119,6,0.15)'
                                        : i % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                                    borderLeft: sel ? '3px solid #d97706' : '3px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                    fontSize: '12px',
                                }}
                            >
                                <div onClick={e => { e.stopPropagation(); toggleSel(r._idx); }}>
                                    {sel
                                        ? <CheckSquare size={14} style={{ color: '#f59e0b' }} />
                                        : <Square size={14} style={{ color: '#475569' }} />
                                    }
                                </div>
                                <div style={{ color: '#e2e8f0', fontWeight: sel ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.cliente || '—'}
                                </div>
                                <div style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.cidade || '—'}
                                </div>
                                <div style={{ color: '#94a3b8', textAlign: 'center' }}>{r.uf || '—'}</div>
                                <div style={{ color: '#94a3b8', textAlign: 'center' }}>{r.doca || '—'}</div>
                                <div style={{ color: '#cbd5e1', textAlign: 'right' }}>{r.volumes || '—'}</div>
                                <div style={{ color: '#94a3b8', textAlign: 'right' }}>{r.peso_kg > 0 ? r.peso_kg.toLocaleString('pt-BR') : '—'}</div>
                                <div style={{ color: sel ? '#fbbf24' : '#60a5fa', fontWeight: '600', textAlign: 'right' }}>
                                    {r.m3 > 0 ? r.m3.toFixed(3) : '—'}
                                </div>
                                <div style={{ color: '#4ade80', textAlign: 'right', fontSize: '11px' }}>
                                    {r.valor > 0 ? r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.nf || '—'}
                                </div>
                                <div><BadgeStatus status={r.status} /></div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SALVAR */}
            <div style={{
                ...glassCard,
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
            }}>
                <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
                    Associar à coleta:
                </div>
                <input
                    value={coleta}
                    onChange={e => setColeta(e.target.value)}
                    placeholder="Número da coleta"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: '#e2e8f0',
                        padding: '8px 14px', fontSize: '14px', width: '180px'
                    }}
                />
                <div style={{ color: '#64748b', fontSize: '12px' }}>
                    {totais.qtd > 0
                        ? `${totais.qtd} NF(s) · ${totais.m3.toFixed(3)} m³ · Mix ${totais.mix.toFixed(2)} · Kit ${totais.kit.toFixed(2)} · ${fmtBRL(totais.valorTotal)}`
                        : 'Nenhuma NF selecionada'}
                </div>
                <button
                    onClick={abrirModalRedespacho}
                    disabled={salvando || totais.qtd === 0 || !coleta.trim()}
                    style={{
                        marginLeft: 'auto',
                        background: totais.qtd > 0 && coleta.trim()
                            ? 'linear-gradient(135deg, #d97706, #92400e)'
                            : 'rgba(255,255,255,0.05)',
                        border: 'none', borderRadius: '10px',
                        color: totais.qtd > 0 && coleta.trim() ? '#fff' : '#475569',
                        cursor: totais.qtd > 0 && coleta.trim() ? 'pointer' : 'not-allowed',
                        padding: '10px 24px', fontSize: '14px', fontWeight: '700',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: totais.qtd > 0 && coleta.trim() ? '0 4px 16px rgba(217,119,6,0.4)' : 'none',
                    }}
                >
                    <Save size={16} />
                    {salvando ? 'Salvando...' : 'Salvar Cubagem'}
                </button>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
