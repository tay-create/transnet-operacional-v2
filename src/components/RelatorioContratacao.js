import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    Legend, ReferenceLine, Cell
} from 'recharts';
import {
    Filter, Calendar, Truck, Clock, RefreshCw, TrendingUp, MapPin, Package
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── Constantes ───────────────────────────────────────────────────────────────

const REGIOES_ORDEM = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const REGIAO_SIGLA = { Norte: 'N', Nordeste: 'NE', 'Centro-Oeste': 'CO', Sudeste: 'SE', Sul: 'S' };
const REGIAO_COR = {
    Norte: '#06b6d4',
    Nordeste: '#f59e0b',
    'Centro-Oeste': '#a78bfa',
    Sudeste: '#3b82f6',
    Sul: '#34d399',
};
const OP_CORES = {
    'Plástico': '#3b82f6',
    Porcelana: '#f59e0b',
    Eletrik: '#a78bfa',
    Consolidados: '#34d399',
    Outros: '#6b7280',
};

// ── Utilitários ──────────────────────────────────────────────────────────────

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    if (hrs >= 24) {
        const d = Math.floor(hrs / 24);
        const rest = hrs % 24;
        return rest > 0 ? `${d}d ${rest}h` : `${d}d`;
    }
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

function corTempo(h) {
    if (h === null || h === undefined) return '#64748b';
    if (h < 2) return '#4ade80';
    if (h < 4) return '#facc15';
    return '#f87171';
}

// ── Estilos reutilizáveis ────────────────────────────────────────────────────

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
};

const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
};

// ── Subcomponentes ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, valor, cor, subtexto }) {
    return (
        <div style={{
            ...glassCard,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: `${cor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cor, flexShrink: 0,
                }}>{icon}</div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                    {label}
                </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {valor}
            </div>
            {subtexto && <span style={{ fontSize: '10px', color: '#64748b' }}>{subtexto}</span>}
        </div>
    );
}

function RegiaoCard({ regiao, dados }) {
    const cor = REGIAO_COR[regiao];
    const bg = corTempo(dados.media_horas);
    const ops = dados.operacoes || {};
    const opDom = Object.entries(ops).sort((a, b) => b[1] - a[1])[0];
    const pctDom = dados.qtd && opDom ? Math.round(opDom[1] / dados.qtd * 100) : 0;

    return (
        <div style={{
            ...glassCard,
            padding: '16px',
            borderLeft: `3px solid ${cor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow sutil de fundo */}
            <div style={{
                position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                background: `radial-gradient(circle at top right, ${cor}22, transparent 70%)`,
                pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cor }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {regiao}
                </span>
            </div>

            {/* Tempo médio (destaque) */}
            <div>
                <div style={{
                    fontSize: '22px', fontWeight: 800,
                    color: bg,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>
                    {formatHoras(dados.media_horas)}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>tempo médio</div>
            </div>

            {/* Métricas secundárias */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{dados.qtd || 0}</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>contrat.</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{dados.ctes || 0}</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>CT-es</div>
                </div>
            </div>

            {/* Operação dominante */}
            {opDom && (
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '3px 8px', borderRadius: '999px', alignSelf: 'flex-start',
                    background: (OP_CORES[opDom[0]] || '#6b7280') + '22',
                    color: OP_CORES[opDom[0]] || '#9ca3af',
                    fontSize: '10px', fontWeight: 600,
                }}>
                    {opDom[0]} · {pctDom}%
                </div>
            )}
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function RelatorioContratacao() {
    const hoje = obterDataBrasilia().substring(0, 10);
    const [dataInicio, setDataInicio] = useState(() => {
        const d = new Date(hoje);
        d.setDate(d.getDate() - 29);
        return d.toISOString().substring(0, 10);
    });
    const [dataFim, setDataFim] = useState(hoje);
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/contratacao?de=${dataInicio}&ate=${dataFim}`);
            setDados(res.data);
        } catch (e) {
            console.error('Erro ao buscar relatório de contratação:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    // Dados para gráfico stacked (qtd por operação por região)
    const dadosOpRegiao = useMemo(() => {
        if (!dados) return [];
        return REGIOES_ORDEM.map(r => {
            const pr = dados.por_regiao?.[r] || {};
            return {
                regiao: REGIAO_SIGLA[r] || r,
                regiaoFull: r,
                ...(pr.operacoes || {}),
                total: pr.qtd || 0,
            };
        });
    }, [dados]);

    const dadosTempo = useMemo(() => {
        if (!dados) return [];
        return REGIOES_ORDEM.map(r => ({
            regiao: REGIAO_SIGLA[r] || r,
            regiaoFull: r,
            horas: dados.por_regiao?.[r]?.media_horas ?? null,
        })).filter(d => d.horas !== null);
    }, [dados]);

    const operacoes = useMemo(() => {
        if (!dados) return [];
        const ops = new Set();
        REGIOES_ORDEM.forEach(r => {
            const pr = dados.por_regiao?.[r];
            if (pr?.operacoes) Object.keys(pr.operacoes).forEach(op => ops.add(op));
        });
        return [...ops];
    }, [dados]);

    const temDados = dados && dados.total > 0;

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Truck size={20} color="#fff" />
                </div>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                        Tempo Médio de Contratação
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Baseado em <code style={{ color: '#94a3b8' }}>data_marcacao → data_contratacao</code> da fila de motoristas
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div style={{
                ...glassCard,
                padding: '16px 20px',
                display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <Calendar size={10} /> De
                    </label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <Calendar size={10} /> Até
                    </label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
                </div>
                <button
                    onClick={buscar}
                    disabled={carregando}
                    style={{
                        padding: '10px 18px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                        border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        cursor: carregando ? 'wait' : 'pointer',
                        opacity: carregando ? 0.7 : 1,
                    }}>
                    {carregando ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />}
                    Buscar
                </button>
            </div>

            {/* Estado vazio */}
            {!temDados && !carregando && (
                <div style={{
                    ...glassCard,
                    padding: '60px 20px', textAlign: 'center',
                    color: '#64748b', fontSize: '14px',
                }}>
                    Selecione um período e clique em Buscar para visualizar os dados.
                </div>
            )}

            {temDados && (
                <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <KpiCard
                            icon={<Clock size={16} />}
                            label="Tempo médio geral"
                            valor={formatHoras(dados.media_geral)}
                            cor={corTempo(dados.media_geral)}
                        />
                        <KpiCard
                            icon={<Truck size={16} />}
                            label="Total contratados"
                            valor={dados.total}
                            cor="#60a5fa"
                        />
                        <KpiCard
                            icon={<Package size={16} />}
                            label="Frota própria"
                            valor={`${dados.frota} (${dados.total ? Math.round(dados.frota / dados.total * 100) : 0}%)`}
                            cor="#a78bfa"
                        />
                        <KpiCard
                            icon={<MapPin size={16} />}
                            label="Regiões atendidas"
                            valor={REGIOES_ORDEM.filter(r => (dados.por_regiao?.[r]?.qtd || 0) > 0).length}
                            cor="#34d399"
                        />
                    </div>

                    {/* Cards por região */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '10px', color: '#64748b', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.8px',
                            marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <TrendingUp size={12} /> Desempenho por Região
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            {REGIOES_ORDEM.map(regiao => (
                                <RegiaoCard key={regiao} regiao={regiao} dados={dados.por_regiao?.[regiao] || {}} />
                            ))}
                        </div>
                    </div>

                    {/* Gráficos lado a lado */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        {/* Contratações por operação por região */}
                        <div style={{ ...glassCard, padding: '16px 20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Package size={12} /> Contratações por operação × região
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={dadosOpRegiao} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="regiao" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12, color: '#f1f5f9' }}
                                        labelFormatter={l => {
                                            const d = dadosOpRegiao.find(x => x.regiao === l);
                                            return d?.regiaoFull || l;
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: '8px' }} />
                                    {operacoes.map(op => (
                                        <Bar key={op} dataKey={op} stackId="a" fill={OP_CORES[op] || '#6b7280'} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Tempo médio por região */}
                        <div style={{ ...glassCard, padding: '16px 20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={12} /> Tempo médio por região (h)
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={dadosTempo} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="regiao" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                                    <Tooltip
                                        contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12, color: '#f1f5f9' }}
                                        formatter={v => [formatHoras(v), 'Tempo médio']}
                                        labelFormatter={l => {
                                            const d = dadosTempo.find(x => x.regiao === l);
                                            return d?.regiaoFull || l;
                                        }}
                                    />
                                    {dados.media_geral && (
                                        <ReferenceLine y={dados.media_geral} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.7}
                                            label={{ value: `Média: ${formatHoras(dados.media_geral)}`, fill: '#f87171', fontSize: 10, position: 'insideTopRight' }} />
                                    )}
                                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                                        {dadosTempo.map((entry, i) => (
                                            <Cell key={i} fill={REGIAO_COR[entry.regiaoFull] || '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                                {dadosTempo.map(d => (
                                    <div key={d.regiaoFull} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: REGIAO_COR[d.regiaoFull] }} />
                                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>{d.regiaoFull}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabela resumo */}
                    <div style={{ ...glassCard, overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            fontSize: '10px', color: '#64748b', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.8px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <MapPin size={12} /> Resumo detalhado por região
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        {['Região', 'Contratações', 'Tempo Médio', 'CT-es', 'Operações'].map((h, i) => (
                                            <th key={i} style={{
                                                padding: '12px 14px',
                                                textAlign: i === 0 || i === 4 ? 'left' : 'center',
                                                fontSize: '10px', fontWeight: 700, color: '#64748b',
                                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                whiteSpace: 'nowrap',
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {REGIOES_ORDEM.map(regiao => {
                                        const pr = dados.por_regiao?.[regiao] || {};
                                        if (!pr.qtd) return null;
                                        const cor = REGIAO_COR[regiao];
                                        const ops = pr.operacoes || {};
                                        return (
                                            <tr key={regiao} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '12px 14px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cor }} />
                                                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{regiao}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#cbd5e1' }}>{pr.qtd}</td>
                                                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                    <span style={{ color: corTempo(pr.media_horas), fontWeight: 600 }}>
                                                        {formatHoras(pr.media_horas)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#cbd5e1' }}>{pr.ctes}</td>
                                                <td style={{ padding: '12px 14px' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {Object.entries(ops).sort((a, b) => b[1] - a[1]).map(([op, qtd]) => (
                                                            <span key={op} style={{
                                                                padding: '2px 8px', borderRadius: '6px',
                                                                background: (OP_CORES[op] || '#6b7280') + '22',
                                                                color: OP_CORES[op] || '#9ca3af',
                                                                fontSize: '10px', fontWeight: 600,
                                                            }}>
                                                                {op} ({qtd})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }).filter(Boolean)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
