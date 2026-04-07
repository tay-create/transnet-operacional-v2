import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { Filter, Calendar, MapPin, BarChart3, RefreshCw, PauseCircle } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── Classificação de operação ─────────────────────────────────────────────────

const classificarOperacao = (op) => {
    if (!op) return null;
    if (op.includes('/')) return 'consolidado';
    if (op === 'DELTA(RECIFE)' || op === 'PLÁSTICO(RECIFE)') return 'plasticoRec';
    if (op === 'DELTA(MORENO)' || op === 'PLÁSTICO(MORENO)') return 'plasticoMor';
    if (op === 'DELTA(RECIFE X MORENO)' || op === 'PLÁSTICO(RECIFE X MORENO)') return 'plasticoRxM';
    if (op === 'PORCELANA') return 'porcelana';
    if (op === 'ELETRIK') return 'eletrik';
    return null;
};

const ehOperacaoRecife = (op) => op && (op.includes('RECIFE') || (op.includes('/') && op.includes('RECIFE')));
const ehOperacaoMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK') || (op.includes('/') && !op.includes('RECIFE')));

// ── Utilitários de tempo ──────────────────────────────────────────────────────

function calcularMinutos(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const p = hhmm.split(':');
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}
function diffMin(inicio, fim) {
    const i = calcularMinutos(inicio), f = calcularMinutos(fim);
    if (i === null || f === null) return null;
    return f >= i ? f - i : null;
}
function formatMin(min) {
    if (min === null || min === undefined) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

// ── Construção de linhas planas ───────────────────────────────────────────────

function construirLinhas(listaVeiculos) {
    const linhas = [];
    for (const v of listaVeiculos) {
        const adicionarLinha = (origem, tempos, status) => {
            const pausas = JSON.parse(v.pausas_status || '[]').filter(p => p.unidade === origem.toLowerCase());
            const pausaMin = pausas.reduce((acc, p) => {
                if (!p.fim) return acc;
                return acc + Math.max(0, Math.floor((new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / 60000));
            }, 0);
            linhas.push({
                motorista: v.motorista || 'A DEFINIR',
                cardId: v.id,
                data: v.data_prevista || '',
                origem,
                tipoOp: classificarOperacao(v.operacao),
                operacao: v.operacao || '—',
                status: status || 'AGUARDANDO',
                t_inicio_separacao: tempos?.t_inicio_separacao || null,
                fim_carregamento: tempos?.fim_carregamento || null,
                pausaMin,
            });
        };

        if (v.tempos_recife && Object.keys(v.tempos_recife).length > 0)
            adicionarLinha('Recife', v.tempos_recife, v.status_recife);
        else if (ehOperacaoRecife(v.operacao))
            adicionarLinha('Recife', null, v.status_recife);

        if (v.tempos_moreno && Object.keys(v.tempos_moreno).length > 0)
            adicionarLinha('Moreno', v.tempos_moreno, v.status_moreno);
        else if (ehOperacaoMoreno(v.operacao) && !ehOperacaoRecife(v.operacao))
            adicionarLinha('Moreno', null, v.status_moreno);
    }
    return linhas;
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
    input: {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none',
    },
    label: {
        fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '5px', display: 'block',
    },
    card: {
        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px 20px',
    },
    th: {
        padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)',
        color: '#64748b', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '0.5px', background: 'rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
    },
    td: {
        padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        color: '#e2e8f0', fontSize: '13px', verticalAlign: 'middle',
    },
};

// ── Tooltip do gráfico ────────────────────────────────────────────────────────

const TooltipDia = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value || 0;
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#f1f5f9' }}>
            <div style={{ fontWeight: '700', color: '#94a3b8', marginBottom: '2px' }}>{label}</div>
            <div style={{ color: '#60a5fa' }}>{v} embarque{v !== 1 ? 's' : ''}</div>
        </div>
    );
};

// ── Constantes de KPIs ────────────────────────────────────────────────────────

const COR = '#06b6d4'; // ciano único para todos os KPIs e gráfico

const KPIS = [
    { id: 'plasticoRec', label: 'Plástico Recife' },
    { id: 'plasticoMor', label: 'Plástico Moreno' },
    { id: 'plasticoRxM', label: 'Plástico R×M' },
    { id: 'porcelana',   label: 'Porcelana' },
    { id: 'eletrik',     label: 'Eletrik' },
    { id: 'consolidado', label: 'Consolidado' },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function RelatorioOperacional() {
    const hoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [filtroUnidade, setFiltroUnidade] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
    const [veiculosBanco, setVeiculosBanco] = useState([]);
    const [carregando, setCarregando] = useState(false);

    const buscarDados = useCallback(async (de, ate) => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/veiculos?de=${de}&ate=${ate}`);
            if (res.data.success) setVeiculosBanco(res.data.veiculos);
        } catch (e) {
            console.error('Erro ao buscar dados do relatório:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { buscarDados(dataInicio, dataFim); }, [dataInicio, dataFim, buscarDados]);

    // ── Veículos filtrados só por unidade (KPIs sempre mostram totais reais) ──
    const veiculosPorUnidade = useMemo(() => {
        return veiculosBanco.filter(v => {
            if (filtroUnidade === 'Recife' && !ehOperacaoRecife(v.operacao)) return false;
            if (filtroUnidade === 'Moreno' && !ehOperacaoMoreno(v.operacao)) return false;
            return true;
        });
    }, [veiculosBanco, filtroUnidade]);

    // ── Veículos filtrados por unidade + tipo (tabela e gráfico) ─────────────
    const veiculosFiltrados = useMemo(() => {
        if (filtroTipo === 'Todas') return veiculosPorUnidade;
        return veiculosPorUnidade.filter(v => classificarOperacao(v.operacao) === filtroTipo);
    }, [veiculosPorUnidade, filtroTipo]);

    // ── Contadores KPI (ignoram filtroTipo) ───────────────────────────────────
    const contadores = useMemo(() => {
        const cnt = { plasticoRec: 0, plasticoMor: 0, plasticoRxM: 0, porcelana: 0, eletrik: 0, consolidado: 0 };
        veiculosPorUnidade.forEach(v => {
            const cat = classificarOperacao(v.operacao);
            if (cat && cnt[cat] !== undefined) cnt[cat]++;
        });
        return { ...cnt, total: veiculosPorUnidade.length };
    }, [veiculosFiltrados]);

    // ── Gráfico: embarques por dia ────────────────────────────────────────────
    const dadosDia = useMemo(() => {
        const mapa = {};
        veiculosFiltrados.forEach(v => {
            const d = v.data_prevista || '';
            if (!d) return;
            mapa[d] = (mapa[d] || 0) + 1;
        });
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, total]) => ({
                data,
                label: data.split('-').reverse().slice(0, 2).join('/'),
                total,
            }));
    }, [veiculosFiltrados]);

    // ── Tabela: linhas planas ─────────────────────────────────────────────────
    const linhas = useMemo(() => {
        return construirLinhas(veiculosFiltrados)
            .sort((a, b) => b.data.localeCompare(a.data) || a.motorista.localeCompare(b.motorista));
    }, [veiculosFiltrados]);

    return (
        <div style={{ padding: '10px 0' }}>

            {/* ── Título ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <BarChart3 size={22} color="#38bdf8" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Relatório Operacional</span>
                {carregando && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <button
                    onClick={() => buscarDados(dataInicio, dataFim)}
                    style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
                >
                    <RefreshCw size={13} /> Atualizar
                </button>
            </div>

            {/* ── Filtros ── */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Filter size={16} color="#64748b" style={{ marginBottom: '8px' }} />
                <div>
                    <label style={s.label}><Calendar size={11} style={{ display: 'inline', marginRight: '4px' }} />De</label>
                    <input type="date" style={s.input} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                    <label style={s.label}><Calendar size={11} style={{ display: 'inline', marginRight: '4px' }} />Até</label>
                    <input type="date" style={s.input} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <div>
                    <label style={s.label}><MapPin size={11} style={{ display: 'inline', marginRight: '4px' }} />Unidade</label>
                    <select style={s.input} value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}>
                        <option>Todas</option>
                        <option>Recife</option>
                        <option>Moreno</option>
                    </select>
                </div>
                <div>
                    <label style={s.label}>Tipo de Operação</label>
                    <select style={s.input} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                        <option value="Todas">Todas</option>
                        {KPIS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', alignSelf: 'flex-end', paddingBottom: '8px', marginLeft: 'auto' }}>
                    {contadores.total} embarque{contadores.total !== 1 ? 's' : ''}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {/* Total */}
                <div style={{ ...s.card, borderLeft: `4px solid ${COR}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total de Embarques</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                        <span style={{ fontSize: '52px', fontWeight: '900', color: COR, lineHeight: 1 }}>{contadores.total}</span>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            <div><span style={{ color: COR, fontWeight: '700' }}>{veiculosPorUnidade.filter(v => ehOperacaoRecife(v.operacao)).length}</span> Recife</div>
                            <div><span style={{ color: COR, fontWeight: '700' }}>{veiculosPorUnidade.filter(v => ehOperacaoMoreno(v.operacao)).length}</span> Moreno</div>
                        </div>
                    </div>
                </div>
                {/* KPIs por tipo */}
                {KPIS.map(kpi => {
                    const valor = contadores[kpi.id] || 0;
                    const pct = contadores.total > 0 ? ((valor / contadores.total) * 100).toFixed(1) : '0.0';
                    const ativo = filtroTipo === kpi.id;
                    return (
                        <div
                            key={kpi.id}
                            onClick={() => setFiltroTipo(prev => prev === kpi.id ? 'Todas' : kpi.id)}
                            style={{ ...s.card, borderTop: `3px solid ${COR}`, textAlign: 'center', padding: '14px 10px', cursor: 'pointer', outline: ativo ? `2px solid ${COR}` : 'none', transition: 'outline 0.1s' }}
                            title={`Filtrar por ${kpi.label}`}
                        >
                            <div style={{ fontSize: '32px', fontWeight: '900', color: COR, lineHeight: 1 }}>{valor}</div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: ativo ? COR : '#94a3b8', marginTop: '4px' }}>{pct}%</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Gráfico de barras por dia ── */}
            {dadosDia.length > 0 && (
                <div style={{ ...s.card, marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Embarques por Dia</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dadosDia} margin={{ top: 20, right: 8, left: -20, bottom: 4 }}>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipDia />} />
                            <Bar dataKey="total" fill={COR} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="total" position="top" style={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ── Tabela ── */}
            {linhas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#475569', fontSize: '14px' }}>
                    Nenhum embarque para os filtros selecionados.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', ...s.card, padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={s.th}>Motorista</th>
                                <th style={s.th}>Operação</th>
                                <th style={s.th}>Unidade</th>
                                <th style={s.th}>Data</th>
                                <th style={{ ...s.th, color: '#4ade80' }}>Tempo</th>
                                <th style={{ ...s.th, color: '#fbbf24' }}>Efetivo</th>
                                <th style={{ ...s.th, color: '#fb923c' }}>Pausa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((l, i) => {
                                const bruto = diffMin(l.t_inicio_separacao, l.fim_carregamento);
                                const efetivo = bruto !== null ? Math.max(0, bruto - (l.pausaMin || 0)) : null;
                                const temPausa = (l.pausaMin || 0) > 0;
                                const dataFmt = l.data ? l.data.split('-').reverse().join('/') : '—';
                                return (
                                    <tr key={`${l.cardId}-${l.origem}-${i}`}
                                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                                        <td style={{ ...s.td, fontWeight: '600', color: '#f1f5f9' }}>{l.motorista}</td>
                                        <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>{l.operacao}</td>
                                        <td style={s.td}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                                                background: l.origem === 'Recife' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                                                color: l.origem === 'Recife' ? '#60a5fa' : '#fbbf24',
                                                border: `1px solid ${l.origem === 'Recife' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)'}`,
                                            }}>{l.origem}</span>
                                        </td>
                                        <td style={{ ...s.td, color: '#64748b', fontSize: '12px' }}>{dataFmt}</td>
                                        <td style={{ ...s.td, fontWeight: '700', color: bruto !== null ? '#4ade80' : '#334155' }}>
                                            {formatMin(bruto)}
                                        </td>
                                        <td style={{ ...s.td, fontWeight: '700', color: efetivo !== null ? (temPausa ? '#fbbf24' : '#4ade80') : '#334155' }}>
                                            {temPausa ? formatMin(efetivo) : '—'}
                                        </td>
                                        <td style={s.td}>
                                            {temPausa ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                                                    <PauseCircle size={10} /> {formatMin(l.pausaMin)}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#334155' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
