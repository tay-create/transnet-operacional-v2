import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { Filter, Calendar, Truck, Clock, FileDown, RefreshCw, TrendingUp, MapPin, Package } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

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
    Plástico: '#3b82f6',
    Porcelana: '#f59e0b',
    Eletrik: '#a78bfa',
    Consolidados: '#34d399',
    Outros: '#6b7280',
};

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

function corTempo(h) {
    if (h === null || h === undefined) return '#374151';
    if (h < 2) return '#065f46';
    if (h < 4) return '#78350f';
    return '#7f1d1d';
}

function corTextoTempo(h) {
    if (h === null || h === undefined) return '#9ca3af';
    if (h < 2) return '#4ade80';
    if (h < 4) return '#fbbf24';
    return '#f87171';
}

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

    // Dados para gráfico de barras stacked (qtd por operação por região)
    const dadosOpRegiao = useMemo(() => {
        if (!dados) return [];
        return REGIOES_ORDEM.map(r => {
            const pr = dados.por_regiao?.[r] || {};
            const ops = pr.operacoes || {};
            return {
                regiao: REGIAO_SIGLA[r] || r,
                regiaoFull: r,
                ...ops,
                total: pr.qtd || 0,
            };
        });
    }, [dados]);

    // Dados para gráfico de tempo médio por região
    const dadosTempo = useMemo(() => {
        if (!dados) return [];
        return REGIOES_ORDEM.map(r => ({
            regiao: REGIAO_SIGLA[r] || r,
            regiaoFull: r,
            horas: dados.por_regiao?.[r]?.media_horas ?? null,
        })).filter(d => d.horas !== null);
    }, [dados]);

    // Operações presentes nos dados
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
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <Truck size={20} className="text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Tempo Médio de Contratação</h2>
            </div>

            {/* Filtros */}
            <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={12} /> De</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={12} /> Até</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600" />
                </div>
                <button onClick={buscar} disabled={carregando}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded transition">
                    {carregando ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />}
                    Buscar
                </button>
            </div>

            {!temDados && !carregando && (
                <div className="text-center text-gray-500 py-12">Selecione um período e clique em Buscar.</div>
            )}

            {temDados && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'Tempo médio geral',
                                valor: formatHoras(dados.media_geral),
                                icon: <Clock size={18} />,
                                cor: corTextoTempo(dados.media_geral),
                                bg: corTempo(dados.media_geral),
                            },
                            {
                                label: 'Total contratados',
                                valor: dados.total,
                                icon: <Truck size={18} />,
                                cor: '#60a5fa',
                                bg: '#1e3a5f',
                            },
                            {
                                label: 'Frota própria',
                                valor: `${dados.frota} (${dados.total ? Math.round(dados.frota / dados.total * 100) : 0}%)`,
                                icon: <Package size={18} />,
                                cor: '#a78bfa',
                                bg: '#2e1065',
                            },
                            {
                                label: 'Regiões atendidas',
                                valor: REGIOES_ORDEM.filter(r => (dados.por_regiao?.[r]?.qtd || 0) > 0).length,
                                icon: <MapPin size={18} />,
                                cor: '#34d399',
                                bg: '#064e3b',
                            },
                        ].map(c => (
                            <div key={c.label} className="rounded-xl p-4 flex items-center gap-3 border border-gray-700"
                                style={{ background: c.bg + '44' }}>
                                <div style={{ color: c.cor }}>{c.icon}</div>
                                <div>
                                    <div className="text-xs text-gray-400">{c.label}</div>
                                    <div className="text-white font-bold text-lg" style={{ color: c.cor }}>{c.valor}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cards por região */}
                    <div>
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Desempenho por Região
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {REGIOES_ORDEM.map(regiao => {
                                const pr = dados.por_regiao?.[regiao] || {};
                                const cor = REGIAO_COR[regiao];
                                const bg = corTempo(pr.media_horas);
                                const textCor = corTextoTempo(pr.media_horas);
                                const ops = pr.operacoes || {};
                                const opDom = Object.entries(ops).sort((a, b) => b[1] - a[1])[0];
                                const pctDom = pr.qtd && opDom ? Math.round(opDom[1] / pr.qtd * 100) : 0;

                                return (
                                    <div key={regiao}
                                        className="rounded-xl p-4 border flex flex-col gap-2 relative overflow-hidden"
                                        style={{ borderColor: cor + '55', background: bg + '66' }}>
                                        {/* Nome da região */}
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cor }}>
                                                {regiao}
                                            </span>
                                        </div>

                                        {/* Tempo médio — destaque */}
                                        <div className="mt-1">
                                            <div className="text-2xl font-bold" style={{ color: textCor }}>
                                                {formatHoras(pr.media_horas)}
                                            </div>
                                            <div className="text-xs text-gray-500">tempo médio</div>
                                        </div>

                                        {/* Métricas secundárias */}
                                        <div className="grid grid-cols-2 gap-1 mt-1">
                                            <div className="bg-gray-900 bg-opacity-50 rounded p-1.5 text-center">
                                                <div className="text-white font-semibold text-sm">{pr.qtd || 0}</div>
                                                <div className="text-gray-500 text-xs">contrat.</div>
                                            </div>
                                            <div className="bg-gray-900 bg-opacity-50 rounded p-1.5 text-center">
                                                <div className="text-white font-semibold text-sm">{pr.ctes || 0}</div>
                                                <div className="text-gray-500 text-xs">CT-es</div>
                                            </div>
                                        </div>

                                        {/* Operação dominante */}
                                        {opDom && (
                                            <div className="mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                    style={{ background: (OP_CORES[opDom[0]] || '#6b7280') + '33', color: OP_CORES[opDom[0]] || '#9ca3af' }}>
                                                    {opDom[0]} {pctDom}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Gráficos lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Qtd por operação por região (stacked) */}
                        {dadosOpRegiao.some(d => d.total > 0) && (
                            <div className="bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                    <Package size={12} /> Contratações por operação e região
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={dadosOpRegiao} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="regiao" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                            formatter={(v, name) => [v, name]}
                                            labelFormatter={l => {
                                                const d = dadosOpRegiao.find(x => x.regiao === l);
                                                return d?.regiaoFull || l;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                                        {operacoes.map(op => (
                                            <Bar key={op} dataKey={op} stackId="a" fill={OP_CORES[op] || '#6b7280'} radius={[0, 0, 0, 0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Tempo médio por região */}
                        {dadosTempo.length > 0 && (
                            <div className="bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                    <Clock size={12} /> Tempo médio de contratação por região (h)
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={dadosTempo} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="regiao" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                            formatter={v => [formatHoras(v), 'Tempo médio']}
                                            labelFormatter={l => {
                                                const d = dadosTempo.find(x => x.regiao === l);
                                                return d?.regiaoFull || l;
                                            }}
                                        />
                                        {dados.media_geral && (
                                            <ReferenceLine y={dados.media_geral} stroke="#e5e7eb" strokeDasharray="4 2"
                                                label={{ value: `Média: ${formatHoras(dados.media_geral)}`, fill: '#9ca3af', fontSize: 10, position: 'insideTopRight' }} />
                                        )}
                                        <Bar dataKey="horas" radius={[4, 4, 0, 0]}>
                                            {dadosTempo.map((entry, i) => (
                                                <rect key={i} fill={REGIAO_COR[entry.regiaoFull] || '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                {/* Legenda manual de cores */}
                                <div className="mt-3 flex flex-wrap gap-3 justify-center">
                                    {dadosTempo.map(d => (
                                        <div key={d.regiaoFull} className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: REGIAO_COR[d.regiaoFull] }} />
                                            <span className="text-xs text-gray-400">{d.regiaoFull}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tabela de CT-es por região */}
                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                            <FileDown size={14} className="text-gray-400" />
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Resumo por Região</span>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-750 text-gray-400 text-xs">
                                    <th className="text-left px-4 py-2">Região</th>
                                    <th className="text-center px-4 py-2">Contratações</th>
                                    <th className="text-center px-4 py-2">Tempo Médio</th>
                                    <th className="text-center px-4 py-2">CT-es Emitidos</th>
                                    <th className="text-left px-4 py-2">Operações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {REGIOES_ORDEM.map(regiao => {
                                    const pr = dados.por_regiao?.[regiao] || {};
                                    if (!pr.qtd) return null;
                                    const cor = REGIAO_COR[regiao];
                                    const ops = pr.operacoes || {};
                                    return (
                                        <tr key={regiao} className="border-t border-gray-700 hover:bg-gray-700 transition text-xs">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                                                    <span className="text-white font-medium">{regiao}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-gray-300">{pr.qtd}</td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className="font-medium" style={{ color: corTextoTempo(pr.media_horas) }}>
                                                    {formatHoras(pr.media_horas)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-gray-300">{pr.ctes}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(ops).sort((a, b) => b[1] - a[1]).map(([op, qtd]) => (
                                                        <span key={op} className="px-1.5 py-0.5 rounded text-xs font-medium"
                                                            style={{ background: (OP_CORES[op] || '#6b7280') + '33', color: OP_CORES[op] || '#9ca3af' }}>
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
                </>
            )}
        </div>
    );
}
