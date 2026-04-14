import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend
} from 'recharts';
import {
    Warehouse, Filter, Calendar, DollarSign, Box, Package,
    Weight, TrendingUp, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── Estilos ──────────────────────────────────────────────────────────────────

const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS_EXIBIR = Array.from({ length: 17 }, (_, i) => i + 6); // 6h – 22h

const REGIOES_ORDEM = ['NORTE', 'NORDESTE', 'CENTRO-OESTE', 'SUDESTE', 'SUL'];

// ── Utilitários ──────────────────────────────────────────────────────────────

function primeiroDiaMes() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function hoje() {
    return obterDataBrasilia();
}

function fmtBRL(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function RelatorioCubagem() {
    const [de, setDe] = useState(primeiroDiaMes());
    const [ate, setAte] = useState(hoje());
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState(null);
    const [tabelaAberta, setTabelaAberta] = useState(true);

    const buscar = useCallback(async () => {
        if (!de || !ate) return;
        setLoading(true);
        setErro(null);
        try {
            const res = await api.get('/api/relatorio/cubagem', { params: { de, ate } });
            if (res.data?.success) {
                setDados(res.data);
            } else {
                setErro(res.data?.error || 'Erro ao carregar dados.');
            }
        } catch (e) {
            setErro(e?.response?.data?.error || 'Erro de conexão.');
        } finally {
            setLoading(false);
        }
    }, [de, ate]);

    // KPIs agregados
    const kpis = useMemo(() => {
        if (!dados) return null;
        const cubagens = dados.cubagens || [];
        return {
            qtd: cubagens.length,
            m3: cubagens.reduce((s, c) => s + (c.metragem_total || 0), 0),
            valor: cubagens.reduce((s, c) => s + (c.valor_total || 0), 0),
            peso: cubagens.reduce((s, c) => s + (c.peso_total || 0), 0),
            mix: cubagens.reduce((s, c) => s + (c.valor_mix_total || 0), 0),
            kit: cubagens.reduce((s, c) => s + (c.valor_kit_total || 0), 0),
            redespacho: cubagens.filter(c => c.redespacho).length,
        };
    }, [dados]);

    // Dados para gráfico de barras por região
    const dadosBarras = useMemo(() => {
        if (!dados?.por_regiao) return [];
        const regioes = dados.por_regiao;
        return REGIOES_ORDEM
            .map(nome => {
                const r = regioes.find(x => (x.regiao || '').toUpperCase() === nome);
                return r ? { regiao: nome, m3: r.m3_total || 0, valor: r.valor_total || 0, peso: r.peso_total || 0 } : null;
            })
            .filter(Boolean)
            .concat(
                regioes
                    .filter(r => !REGIOES_ORDEM.includes((r.regiao || '').toUpperCase()))
                    .map(r => ({ regiao: r.regiao || 'Outros', m3: r.m3_total || 0, valor: r.valor_total || 0, peso: r.peso_total || 0 }))
            );
    }, [dados]);

    // Heatmap: grid[dia][hora] = qtd
    const heatmapGrid = useMemo(() => {
        if (!dados?.heatmap) return { grid: {}, max: 1 };
        const grid = {};
        let max = 0;
        (dados.heatmap || []).forEach(({ dia_semana, hora, qtd }) => {
            if (!grid[dia_semana]) grid[dia_semana] = {};
            grid[dia_semana][hora] = qtd;
            if (qtd > max) max = qtd;
        });
        return { grid, max: max || 1 };
    }, [dados]);

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>

            {/* CABEÇALHO */}
            <div style={{
                borderRadius: '16px',
                marginBottom: '20px',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
                boxShadow: '0 8px 32px rgba(217,119,6,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Warehouse size={32} style={{ color: '#fff' }} />
                    <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '20px', letterSpacing: '0.5px' }}>
                            Relatório de Cubagem Porcelana
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>
                            Análise por período, região e horário
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                        <input
                            type="date"
                            value={de}
                            onChange={e => setDe(e.target.value)}
                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>até</span>
                        <input
                            type="date"
                            value={ate}
                            onChange={e => setAte(e.target.value)}
                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                        />
                    </div>
                    <button
                        onClick={buscar}
                        disabled={loading}
                        style={{
                            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: '8px', color: '#fff', cursor: 'pointer',
                            padding: '8px 18px', fontSize: '13px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>
            </div>

            {/* ERRO */}
            {erro && (
                <div style={{ ...glassCard, padding: '14px 20px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px' }}>
                    {erro}
                </div>
            )}

            {/* SEM DADOS */}
            {!dados && !loading && (
                <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: '#475569' }}>
                    <Filter size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
                    <div style={{ fontSize: '15px' }}>Selecione o período e clique em Buscar</div>
                </div>
            )}

            {dados && kpis && (
                <>
                    {/* KPI CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '20px' }}>
                        {[
                            { label: 'CUBAGENS', valor: kpis.qtd, cor: '#f59e0b', icon: <Warehouse size={16} />, fmt: v => v },
                            { label: 'M³ TOTAL', valor: kpis.m3, cor: '#3b82f6', icon: <Box size={16} />, fmt: v => v.toFixed(3) },
                            { label: 'VALOR TOTAL', valor: kpis.valor, cor: '#4ade80', icon: <DollarSign size={16} />, fmt: fmtBRL },
                            { label: 'PESO TOTAL', valor: kpis.peso, cor: '#60a5fa', icon: <Weight size={16} />, fmt: v => `${v.toLocaleString('pt-BR')} kg` },
                            { label: 'MIX', valor: kpis.mix, cor: '#a78bfa', icon: <TrendingUp size={16} />, fmt: v => Number(v).toFixed(4) },
                            { label: 'KIT', valor: kpis.kit, cor: '#818cf8', icon: <Package size={16} />, fmt: v => Number(v).toFixed(4) },
                            { label: 'REDESPACHO', valor: kpis.redespacho, cor: '#fb923c', icon: <TrendingUp size={16} />, fmt: v => `${v} (${kpis.qtd > 0 ? Math.round((v / kpis.qtd) * 100) : 0}%)` },
                        ].map(({ label, valor, cor, icon, fmt }) => (
                            <div key={label} style={{ ...glassCard, padding: '16px', border: `1px solid ${cor}25` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '8px' }}>
                                    <span style={{ color: cor }}>{icon}</span>
                                    {label}
                                </div>
                                <div style={{ color: cor, fontSize: label === 'VALOR TOTAL' ? '14px' : '22px', fontWeight: '800', lineHeight: '1.2' }}>
                                    {fmt(valor)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CARDS POR REGIÃO */}
                    {dados.por_regiao && dados.por_regiao.length > 0 && (
                        <div style={{ ...glassCard, padding: '20px', marginBottom: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '13px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                Distribuição por Região
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {dados.por_regiao.map(r => {
                                    const pct = kpis.valor > 0 ? (r.valor_total / kpis.valor) : 0;
                                    const corBorda = pct > 0.4 ? '#4ade80' : pct > 0.2 ? '#fbbf24' : pct > 0.05 ? '#60a5fa' : '#475569';
                                    return (
                                        <div key={r.regiao} style={{
                                            ...glassCard,
                                            padding: '14px 18px',
                                            border: `1px solid ${corBorda}40`,
                                            borderLeft: `4px solid ${corBorda}`,
                                            minWidth: '170px',
                                            flex: '1'
                                        }}>
                                            <div style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                                {(r.regiao || '—').toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>M³</span>
                                                    <span style={{ color: '#60a5fa', fontWeight: '600' }}>{Number(r.m3_total || 0).toFixed(3)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Valor</span>
                                                    <span style={{ color: '#4ade80', fontWeight: '600' }}>{fmtBRL(r.valor_total)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Peso</span>
                                                    <span style={{ color: '#94a3b8' }}>{Number(r.peso_total || 0).toLocaleString('pt-BR')} kg</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Volumes</span>
                                                    <span style={{ color: '#94a3b8' }}>{r.volumes_total || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* GRÁFICOS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

                        {/* Barras por região */}
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '12px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                M³ e Valor por Região
                            </div>
                            {dadosBarras.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={dadosBarras} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="regiao" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                                        <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => fmtBRL(v)} width={80} />
                                        <Tooltip cursor={false} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar yAxisId="left" dataKey="m3" name="M³" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar yAxisId="right" dataKey="valor" name="Valor R$" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', color: '#475569', padding: '60px 0', fontSize: '13px' }}>Sem dados por região</div>
                            )}
                        </div>

                        {/* Heatmap */}
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '12px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Horário de Emissão (Dia × Hora)
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${HORAS_EXIBIR.length}, 1fr)`, gap: '2px', minWidth: '500px' }}>
                                    {/* Cabeçalho de horas */}
                                    <div />
                                    {HORAS_EXIBIR.map(h => (
                                        <div key={h} style={{ textAlign: 'center', fontSize: '9px', color: '#64748b', paddingBottom: '4px' }}>
                                            {h}h
                                        </div>
                                    ))}
                                    {/* Linhas por dia */}
                                    {DIAS_SEMANA.map((dia, d) => (
                                        <React.Fragment key={dia}>
                                            <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                                                {dia}
                                            </div>
                                            {HORAS_EXIBIR.map(h => {
                                                const qtd = (heatmapGrid.grid[d] || {})[h] || 0;
                                                const opacity = qtd > 0 ? 0.15 + (qtd / heatmapGrid.max) * 0.85 : 0;
                                                return (
                                                    <div
                                                        key={h}
                                                        title={qtd > 0 ? `${dia} ${h}h: ${qtd} cubagem(ns)` : ''}
                                                        style={{
                                                            height: '20px',
                                                            borderRadius: '3px',
                                                            background: qtd > 0 ? `rgba(217,119,6,${opacity.toFixed(2)})` : 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.04)',
                                                        }}
                                                    />
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                                {/* Legenda */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Menos</span>
                                    {[0.1, 0.3, 0.55, 0.75, 1].map(op => (
                                        <div key={op} style={{ width: '14px', height: '14px', borderRadius: '2px', background: `rgba(217,119,6,${op})` }} />
                                    ))}
                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Mais</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABELA DE CUBAGENS */}
                    <div style={{ ...glassCard, overflow: 'hidden' }}>
                        <div
                            onClick={() => setTabelaAberta(a => !a)}
                            style={{
                                padding: '16px 20px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderBottom: tabelaAberta ? '1px solid rgba(217,119,6,0.2)' : 'none',
                                background: 'rgba(217,119,6,0.08)'
                            }}
                        >
                            <div style={{ color: '#d97706', fontSize: '13px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                Cubagens no Período ({dados.cubagens?.length || 0})
                            </div>
                            {tabelaAberta ? <ChevronUp size={16} style={{ color: '#d97706' }} /> : <ChevronDown size={16} style={{ color: '#d97706' }} />}
                        </div>

                        {tabelaAberta && (
                            <>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '110px 1fr 1fr 80px 80px 90px 90px 80px',
                                    gap: '8px', padding: '10px 20px',
                                    fontSize: '10px', fontWeight: '700', color: '#d97706',
                                    letterSpacing: '0.6px', textTransform: 'uppercase',
                                    background: 'rgba(217,119,6,0.08)'
                                }}>
                                    <div>Data</div>
                                    <div>Coleta</div>
                                    <div>Cliente</div>
                                    <div style={{ textAlign: 'right' }}>M³</div>
                                    <div style={{ textAlign: 'right' }}>Valor</div>
                                    <div style={{ textAlign: 'right' }}>Mix</div>
                                    <div style={{ textAlign: 'right' }}>Kit</div>
                                    <div style={{ textAlign: 'center' }}>Redesp.</div>
                                </div>
                                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                    {(dados.cubagens || []).map((c, i) => (
                                        <div
                                            key={c.id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '110px 1fr 1fr 80px 80px 90px 90px 80px',
                                                gap: '8px', padding: '9px 20px',
                                                alignItems: 'center',
                                                background: i % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                                                fontSize: '12px',
                                                borderLeft: c.redespacho ? '3px solid #fb923c' : '3px solid transparent',
                                            }}
                                        >
                                            <div style={{ color: '#64748b', fontSize: '11px' }}>{fmtData(c.data_criacao)}</div>
                                            <div style={{ color: '#e2e8f0', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.numero_coleta || '—'}
                                            </div>
                                            <div style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.cliente || '—'}
                                            </div>
                                            <div style={{ color: '#60a5fa', textAlign: 'right', fontWeight: '600' }}>
                                                {Number(c.metragem_total || 0).toFixed(3)}
                                            </div>
                                            <div style={{ color: '#4ade80', textAlign: 'right', fontSize: '11px' }}>
                                                {fmtBRL(c.valor_total)}
                                            </div>
                                            <div style={{ color: '#a78bfa', textAlign: 'right', fontSize: '11px' }}>
                                                {Number(c.valor_mix_total || 0).toFixed(4)}
                                            </div>
                                            <div style={{ color: '#818cf8', textAlign: 'right', fontSize: '11px' }}>
                                                {Number(c.valor_kit_total || 0).toFixed(4)}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                {c.redespacho ? (
                                                    <span style={{
                                                        background: 'rgba(251,146,60,0.2)', color: '#fb923c',
                                                        border: '1px solid rgba(251,146,60,0.4)',
                                                        borderRadius: '5px', padding: '2px 6px',
                                                        fontSize: '9px', fontWeight: '700'
                                                    }} title={c.nome_redespacho || ''}>
                                                        Redesp.
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#334155', fontSize: '10px' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {(dados.cubagens || []).length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                                            Nenhuma cubagem no período.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
