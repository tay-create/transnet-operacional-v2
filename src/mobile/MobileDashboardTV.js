import React, { useState, useEffect, useRef } from 'react';
import { Truck, FileText, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA } from '../constants';
import api from '../services/apiService';

const TELAS = ['Embarques', 'Operação', 'CT-e'];

// Cores idênticas ao CORES_STATUS do desktop (src/constants.js)
const STATUS_COR = {
    'AGUARDANDO':                '#94a3b8',
    'EM SEPARAÇÃO':              '#facc15',
    'LIBERADO P/ DOCA':          '#60a5fa',
    'LIBERADO P/ CARREGAMENTO':  '#60a5fa',
    'EM CARREGAMENTO':           '#fb923c',
    'CARREGADO':                 '#4ade80',
    'LIBERADO P/ CT-e':          '#c084fc',
};

// Valor no banco é 'LIBERADO P/ DOCA' mas o nome exibido é 'LIBERADO P/ CARREGAMENTO'
const traduzirStatus = st => st === 'LIBERADO P/ DOCA' ? 'LIBERADO P/ CARREGAMENTO' : st;

const CORES_OP = {
    delta:       '#2563eb',
    consolidado: '#3b82f6',
    deltaRxM:    '#60a5fa',
    porcelana:   '#a78bfa',
    eletrik:     '#f59e0b',
};

const LABELS_OP = {
    delta:       'Plástico 100%',
    consolidado: 'Consolidado',
    deltaRxM:    'Plástico R×M',
    porcelana:   'Porcelana',
    eletrik:     'Eletrik',
};

function getHoje() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
}

function addDias(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
}

function classificarOperacao(op) {
    if (!op) return null;
    if (op === 'DELTA(RECIFE)' || op === 'DELTA(MORENO)' || op === 'PLÁSTICO(RECIFE)' || op === 'PLÁSTICO(MORENO)') return 'delta';
    if (op === 'DELTA(RECIFE X MORENO)' || op === 'PLÁSTICO(RECIFE X MORENO)') return 'deltaRxM';
    if (op === 'PORCELANA') return 'porcelana';
    if (op === 'ELETRIK') return 'eletrik';
    if (op.includes('/')) return 'consolidado';
    return null;
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '71,85,105';
}

function buildDocaMap(veiculosUnidade, docasLista, docasInterdUnidade, campoStatus, campoDoca) {
    const PRIO = { 'AGUARDANDO': 0, 'EM SEPARAÇÃO': 1, 'LIBERADO P/ DOCA': 2, 'EM CARREGAMENTO': 3 };
    const map = {};
    docasLista.filter(d => d !== 'SELECIONE').forEach(d => { map[d] = null; });
    veiculosUnidade.forEach(v => {
        const doca = v[campoDoca];
        if (!doca || doca === 'SELECIONE' || !(doca in map)) return;
        const st = v[campoStatus] || 'AGUARDANDO';
        if (st === 'CARREGADO' || st === 'LIBERADO P/ CT-e') return;
        if (!map[doca] || (PRIO[st] ?? 0) > (PRIO[map[doca]] ?? 0)) map[doca] = st;
    });
    docasInterdUnidade.forEach(c => {
        if (c.doca && c.doca !== 'SELECIONE') map[c.doca] = 'FULGAZ';
    });
    return map;
}

function KpiCard({ valor, label, cor }) {
    return (
        <div style={{
            background: `rgba(${hexToRgb(cor)},0.08)`,
            border: `1px solid rgba(${hexToRgb(cor)},0.25)`,
            borderTop: `3px solid ${cor}`,
            borderRadius: '12px', padding: '14px 10px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '36px', fontWeight: '900', color: cor, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        </div>
    );
}

function DocaGrid({ docaMap, docasLista }) {
    const docas = docasLista.filter(d => d !== 'SELECIONE');
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
            {docas.map(doca => {
                const st = docaMap[doca];
                const livre = !st;
                const cor = STATUS_COR[st] || null;
                const bg = st === 'FULGAZ' ? 'rgba(239,68,68,0.2)' : livre ? 'rgba(52,211,153,0.10)' : `${cor}18`;
                const border = st === 'FULGAZ' ? '#ef4444' : livre ? '#34d399' : (cor || '#475569');
                return (
                    <div key={doca} style={{
                        padding: '8px 4px', borderRadius: '8px', textAlign: 'center',
                        background: bg, border: `1px solid ${border}`,
                        boxShadow: livre ? '0 0 5px rgba(52,211,153,0.15)' : 'none',
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: '700',
                            color: st === 'FULGAZ' ? '#fca5a5' : livre ? '#34d399' : (cor || '#94a3b8') }}>{doca}</div>
                        <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px',
                            fontWeight: st === 'FULGAZ' ? '900' : 'normal' }}>
                            {st === 'FULGAZ' ? 'CONTAINER' : (st || 'Livre')}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function MobileDashboardTV({ socket }) {
    const hoje = useRef(getHoje()).current;

    const [tela, setTela] = useState(0);
    const [autoplay, setAutoplay] = useState(true);
    const [dataSel, setDataSel] = useState(hoje);
    const [veiculos, setVeiculos] = useState([]);
    const [ctes, setCtes] = useState([]);
    const [docasInterditadas, setDocasInterditadas] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [abaOp, setAbaOp] = useState('recife');
    const touchStartX = useRef(null);

    useEffect(() => {
        const carregar = async () => {
            setCarregando(true);
            try {
                const [v, c, d] = await Promise.allSettled([
                    api.get('/veiculos?limit=500'),
                    api.get(`/ctes?dataInicio=${dataSel}&dataFim=${dataSel}`),
                    api.get(`/api/docas-interditadas?data=${dataSel}`),
                ]);
                if (v.status === 'fulfilled' && v.value.data.success) setVeiculos(v.value.data.veiculos || []);
                if (c.status === 'fulfilled' && c.value.data.success) setCtes(c.value.data.ctes || []);
                if (d.status === 'fulfilled' && d.value.data.success) setDocasInterditadas(d.value.data.docas || []);
            } catch (e) { console.error(e); }
            finally { setCarregando(false); }
        };
        carregar();
    }, [dataSel]);

    useEffect(() => {
        if (!socket) return;
        const handleCtes = () => {
            api.get(`/ctes?dataInicio=${dataSel}&dataFim=${dataSel}`).then(r => {
                if (r.data.success) setCtes(r.data.ctes || []);
            });
        };
        const handleDocas = () => {
            api.get(`/api/docas-interditadas?data=${dataSel}`).then(r => {
                if (r.data.success) setDocasInterditadas(r.data.docas || []);
            });
        };
        const handleAtualizacao = (data) => {
            api.get('/veiculos?limit=500').then(r => { if (r.data.success) setVeiculos(r.data.veiculos || []); });
            if (data?.tipo === 'novo_cte' || data?.tipo === 'atualiza_cte' || data?.tipo === 'remove_cte') {
                handleCtes();
            }
        };
        socket.on('receber_atualizacao', handleAtualizacao);
        socket.on('docas_interditadas_update', handleDocas);
        return () => {
            socket.off('receber_atualizacao', handleAtualizacao);
            socket.off('docas_interditadas_update', handleDocas);
        };
    }, [socket, dataSel]);

    useEffect(() => {
        if (!autoplay) return;
        const id = setInterval(() => setTela(t => (t + 1) % TELAS.length), 12000);
        return () => clearInterval(id);
    }, [autoplay]);

    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) {
            setAutoplay(false);
            setTela(t => dx < 0 ? (t + 1) % TELAS.length : (t - 1 + TELAS.length) % TELAS.length);
        }
        touchStartX.current = null;
    };

    // Veículos do dia selecionado — data_prevista tem prioridade (igual ao DashboardTV desktop)
    const veiculosHoje = veiculos.filter(v => {
        const dataR = v.data_prevista || v.data_carregado_recife || v.data_carregado_moreno || '';
        return dataR.split('T')[0] === dataSel;
    });

    // Tela 0 — Embarques: agrupa por operação
    const contOp = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
    veiculosHoje.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat) contOp[cat]++;
    });
    const totalGeral = Object.values(contOp).reduce((a, b) => a + b, 0);

    // Tela 1 — Operação
    const STATUS_ORDEM = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e'];
    // STATUS_ORDEM usa o valor do banco ('LIBERADO P/ DOCA') para buscar contagens; label exibido é traduzido.

    const vRecife = veiculosHoje.filter(v => (v.operacao || '').includes('RECIFE'));
    const vMoreno = veiculosHoje.filter(v => {
        const op = v.operacao || '';
        // Excluir consolidados que têm RECIFE na operação (ex: PLÁSTICO(RECIFE)/PORCELANA)
        if (op.includes('RECIFE')) return false;
        return op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK');
    });

    const statusCte = {
        emEmissao: ctes.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length,
        emitido:   ctes.filter(c => c.status === 'Emitido').length,
    };
    // Aguardando = total de veículos do dia - os que já têm CT-e em algum estado
    // Usar veiculosHoje.length (não vRecife+vMoreno) para evitar dupla contagem de operações R×M
    statusCte.aguardando = Math.max(0, veiculosHoje.length - statusCte.emEmissao - statusCte.emitido);

    const statusRecife = {};
    const statusMoreno = {};
    vRecife.forEach(v => {
        const st = v.status_recife || 'AGUARDANDO';
        statusRecife[st] = (statusRecife[st] || 0) + 1;
        if (v.cte_antecipado_recife && st !== 'LIBERADO P/ CT-e') {
            statusRecife['LIBERADO P/ CT-e'] = (statusRecife['LIBERADO P/ CT-e'] || 0) + 1;
        }
    });
    vMoreno.forEach(v => {
        const st = v.status_moreno || 'AGUARDANDO';
        statusMoreno[st] = (statusMoreno[st] || 0) + 1;
        if (v.cte_antecipado_moreno && st !== 'LIBERADO P/ CT-e') {
            statusMoreno['LIBERADO P/ CT-e'] = (statusMoreno['LIBERADO P/ CT-e'] || 0) + 1;
        }
    });

    // Mapas de docas
    const docaMapRecife = buildDocaMap(vRecife, DOCAS_RECIFE_LISTA,
        docasInterditadas.filter(c => c.unidade === 'Recife'), 'status_recife', 'doca_recife');
    const docaMapMoreno = buildDocaMap(vMoreno, DOCAS_MORENO_LISTA,
        docasInterditadas.filter(c => c.unidade === 'Moreno'), 'status_moreno', 'doca_moreno');

    // Tela 2 — CT-e
    const ctesRecife = ctes.filter(c => c.origem === 'Recife');
    const ctesMoreno = ctes.filter(c => c.origem !== 'Recife');

    // Label da data selecionada
    const labelData = dataSel === hoje
        ? `Hoje — ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Recife' })}`
        : new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Recife' });

    // Estilos dos botões de navegação de data
    const btnNavStyle = {
        background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
        padding: '4px', display: 'flex', alignItems: 'center',
        WebkitTapHighlightColor: 'transparent',
    };
    const dataBtnStyle = {
        background: 'none', border: '1px solid transparent', borderRadius: '6px',
        cursor: 'pointer', fontSize: '11px', fontWeight: '600', padding: '3px 7px',
        WebkitTapHighlightColor: 'transparent',
    };

    const amanha = addDias(hoje, 1);

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '12px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#f1f5f9' }}>Dashboard</div>

                    {/* Seletor de data compacto */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button onClick={() => setDataSel(d => addDias(d, -1))} style={btnNavStyle}>
                            <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>
                        {[addDias(dataSel, -1), dataSel, addDias(dataSel, 1)].map(d => {
                            const isSelected = d === dataSel;
                            const isHoje = d === hoje;
                            const isDisabled = d > amanha;
                            return (
                                <button
                                    key={d}
                                    onClick={() => !isDisabled && setDataSel(d)}
                                    disabled={isDisabled}
                                    style={{
                                        ...dataBtnStyle,
                                        background: isSelected ? 'rgba(167,139,250,0.15)' : 'none',
                                        color: isDisabled ? '#1e293b' : isSelected ? '#a78bfa' : '#475569',
                                        border: isSelected ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                                    }}
                                >
                                    {isHoje ? 'Hoje' : d.slice(5).replace('-', '/')}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setDataSel(d => { const next = addDias(d, 1); return next <= amanha ? next : d; })}
                            disabled={dataSel >= amanha}
                            style={{ ...btnNavStyle, color: dataSel >= amanha ? '#1e293b' : '#475569' }}
                        >
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                    </div>

                    <button onClick={() => setAutoplay(a => !a)} style={{
                        background: autoplay ? 'rgba(167,139,250,0.12)' : '#1e293b',
                        border: `1px solid ${autoplay ? 'rgba(167,139,250,0.3)' : '#334155'}`,
                        borderRadius: '8px', color: autoplay ? '#a78bfa' : '#475569',
                        fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                        {autoplay ? <Pause size={11} strokeWidth={2} /> : <Play size={11} strokeWidth={2} />}
                        Auto
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    {TELAS.map((nome, i) => (
                        <button key={i} onClick={() => { setTela(i); setAutoplay(false); }} style={{
                            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: tela === i ? '2px solid #a78bfa' : '2px solid transparent',
                            color: tela === i ? '#a78bfa' : '#475569',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>{nome}</button>
                    ))}
                </div>
            </div>

            {/* Conteúdo com swipe */}
            <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ padding: '16px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : (
                    <>
                        {/* TELA 0: Embarques */}
                        {tela === 0 && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {labelData}
                                </div>

                                {/* Total geral */}
                                <div style={{
                                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                    borderLeft: '4px solid #3b82f6', borderRadius: '12px',
                                    padding: '16px', textAlign: 'center', marginBottom: '14px',
                                }}>
                                    <div style={{ fontSize: '56px', fontWeight: '900', color: '#3b82f6', lineHeight: 1 }}>{totalGeral}</div>
                                    <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Embarques</div>
                                </div>

                                {/* KPIs por operação */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                                    {Object.entries(contOp).map(([key, val]) => (
                                        <KpiCard key={key} valor={val} label={LABELS_OP[key]} cor={CORES_OP[key]} />
                                    ))}
                                </div>

                                {/* Status CT-e */}
                                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ fontSize: '10px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Status CT-e</div>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        {[
                                            { label: 'Aguardando', valor: statusCte.aguardando, cor: '#f59e0b' },
                                            { label: 'Em Emissão', valor: statusCte.emEmissao,  cor: '#3b82f6' },
                                            { label: 'Emitidos',   valor: statusCte.emitido,    cor: '#22c55e' },
                                        ].map(s => (
                                            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '28px', fontWeight: '900', color: s.cor }}>{s.valor}</span>
                                                <span style={{ fontSize: '11px', color: '#475569' }}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TELA 1: Operação — sub-abas Recife/Moreno + docas */}
                        {tela === 1 && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {labelData} · {veiculosHoje.length} veículos
                                </div>

                                {/* Sub-abas */}
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '3px' }}>
                                    {[
                                        { id: 'recife', label: `Recife · ${vRecife.length}`, cor: '#60a5fa', bg: 'rgba(59,130,246,0.3)' },
                                        { id: 'moreno', label: `Moreno · ${vMoreno.length}`, cor: '#fbbf24', bg: 'rgba(245,158,11,0.3)' },
                                    ].map(aba => (
                                        <button key={aba.id} onClick={() => setAbaOp(aba.id)} style={{
                                            flex: 1, padding: '7px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                            fontWeight: '700', fontSize: '12px',
                                            background: abaOp === aba.id ? aba.bg : 'transparent',
                                            color: abaOp === aba.id ? aba.cor : '#475569',
                                            WebkitTapHighlightColor: 'transparent',
                                        }}>
                                            {aba.label}
                                        </button>
                                    ))}
                                </div>

                                {/* KPIs por status */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                                    {STATUS_ORDEM.map(st => (
                                        <KpiCard key={st}
                                            valor={abaOp === 'recife' ? (statusRecife[st] || 0) : (statusMoreno[st] || 0)}
                                            label={traduzirStatus(st)} cor={STATUS_COR[st] || '#475569'} />
                                    ))}
                                </div>

                                {/* Mapa de docas */}
                                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px' }}>
                                    <div style={{ fontSize: '10px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Docas — {abaOp === 'recife' ? 'Recife' : 'Moreno'}
                                    </div>
                                    <DocaGrid
                                        docaMap={abaOp === 'recife' ? docaMapRecife : docaMapMoreno}
                                        docasLista={abaOp === 'recife' ? DOCAS_RECIFE_LISTA : DOCAS_MORENO_LISTA}
                                    />
                                </div>

                                {veiculosHoje.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '24px', color: '#334155' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                            <Truck size={28} color="#334155" strokeWidth={1.5} />
                                        </div>
                                        <div style={{ fontSize: '12px' }}>Nenhum veículo neste dia.</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TELA 2: CT-e */}
                        {tela === 2 && (() => {
                            // Funil Recife
                            const emEmissaoR = ctesRecife.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length;
                            const emitidoR   = ctesRecife.filter(c => c.status === 'Emitido').length;
                            const aguardandoR = Math.max(0, vRecife.length - emEmissaoR - emitidoR);
                            const totalR = vRecife.length;
                            const pctR = (v) => totalR > 0 ? `${Math.round((v / totalR) * 100)}%` : '0%';

                            // Funil Moreno
                            const emEmissaoM = ctesMoreno.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length;
                            const emitidoM   = ctesMoreno.filter(c => c.status === 'Emitido').length;
                            const aguardandoM = Math.max(0, vMoreno.length - emEmissaoM - emitidoM);
                            const totalM = vMoreno.length;
                            const pctM = (v) => totalM > 0 ? `${Math.round((v / totalM) * 100)}%` : '0%';

                            const FunilUnidade = ({ label, cor, items, pct }) => (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: cor, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cor, boxShadow: `0 0 6px ${cor}` }} />
                                        Fluxo CT-e — {label}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {items.map(item => (
                                            <div key={item.label} style={{
                                                background: `rgba(${hexToRgb(item.cor)},0.07)`,
                                                border: `1px solid rgba(${hexToRgb(item.cor)},0.2)`,
                                                borderLeft: `4px solid ${item.cor}`,
                                                borderRadius: '10px', padding: '12px 14px',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1' }}>{item.label}</div>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                    <span style={{ fontSize: '32px', fontWeight: '900', color: item.cor, filter: `drop-shadow(0 0 5px ${item.cor}60)`, lineHeight: 1 }}>{item.valor}</span>
                                                    <span style={{ fontSize: '11px', color: '#475569' }}>{pct(item.valor)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );

                            return (
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        CT-e · {labelData}
                                    </div>

                                    {/* KPIs totais */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                        {[
                                            { label: 'Total CT-e',  qtd: veiculosHoje.length,        cor: '#a78bfa' },
                                            { label: 'Emitidos',    qtd: ctes.filter(c => c.status === 'Emitido').length, cor: '#22c55e' },
                                            { label: 'Em Emissão',  qtd: ctes.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length, cor: '#3b82f6' },
                                            { label: 'Aguardando',  qtd: statusCte.aguardando, cor: '#f59e0b' },
                                        ].map(item => (
                                            <KpiCard key={item.label} valor={item.qtd} label={item.label} cor={item.cor} />
                                        ))}
                                    </div>

                                    {/* Funil Recife */}
                                    <FunilUnidade
                                        label="Recife" cor="#60a5fa" pct={pctR}
                                        items={[
                                            { label: 'Aguardando P/ Emissão', valor: aguardandoR, cor: '#f59e0b' },
                                            { label: 'Em Emissão',            valor: emEmissaoR,  cor: '#3b82f6' },
                                            { label: 'Emitido',               valor: emitidoR,    cor: '#34d399' },
                                        ]}
                                    />

                                    {/* Funil Moreno */}
                                    <FunilUnidade
                                        label="Moreno" cor="#fbbf24" pct={pctM}
                                        items={[
                                            { label: 'Aguardando P/ Emissão', valor: aguardandoM, cor: '#f59e0b' },
                                            { label: 'Em Emissão',            valor: emEmissaoM,  cor: '#3b82f6' },
                                            { label: 'Emitido',               valor: emitidoM,    cor: '#34d399' },
                                        ]}
                                    />

                                    {ctes.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '32px', color: '#334155' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                                <FileText size={24} color="#334155" strokeWidth={1.5} />
                                            </div>
                                            <div style={{ fontSize: '12px' }}>Nenhum CT-e neste dia.</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Dots indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0 16px' }}>
                {TELAS.map((_, i) => (
                    <div key={i} style={{
                        width: tela === i ? '16px' : '6px', height: '6px',
                        borderRadius: '3px', background: tela === i ? '#a78bfa' : '#1e293b',
                        transition: 'width 0.3s, background 0.3s',
                    }} />
                ))}
            </div>
        </div>
    );
}
