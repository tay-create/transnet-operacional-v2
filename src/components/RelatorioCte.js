import React, { useState, useMemo, useCallback } from 'react';
import {
    Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell, Legend
} from 'recharts';
import { Filter, Calendar, FileText, Clock, FileDown, RefreshCw, MapPin, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import * as XLSX from 'xlsx';

const CORES_TURNO = { 'Manhã': '#f59e0b', 'Tarde': '#3b82f6', 'Noite': '#8b5cf6' };
const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function RelatorioCte() {
    const hoje = obterDataBrasilia().substring(0, 10);
    const [dataInicio, setDataInicio] = useState(() => {
        const d = new Date(hoje);
        d.setDate(d.getDate() - 29);
        return d.toISOString().substring(0, 10);
    });
    const [dataFim, setDataFim] = useState(hoje);
    const [registros, setRegistros] = useState([]);
    const [heatmap, setHeatmap] = useState([]);
    const [ociosidade, setOciosidade] = useState({});
    const [carregando, setCarregando] = useState(false);
    const [aba, setAba] = useState('graficos'); // 'graficos' | 'heatmap' | 'tabela'

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/cte?de=${dataInicio}&ate=${dataFim}`);
            setRegistros(res.data.registros || []);
            setHeatmap(res.data.heatmap || []);
            setOciosidade(res.data.ociosidade || {});
        } catch (e) {
            console.error('Erro ao buscar relatório CT-e:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    const resumo = useMemo(() => {
        const comHoras = registros.filter(r => r.horas_lancamento_cte !== null);
        const media = comHoras.length
            ? comHoras.reduce((a, r) => a + r.horas_lancamento_cte, 0) / comHoras.length
            : null;
        const recife = registros.filter(r => r.origem === 'Recife').length;
        const moreno = registros.filter(r => r.origem === 'Moreno').length;
        return { total: registros.length, media, recife, moreno };
    }, [registros]);

    // CT-es por dia separados por unidade
    const dadosPorDia = useMemo(() => {
        const mapa = {};
        for (const r of registros) {
            if (!r.datetime_cte) continue;
            const dia = r.datetime_cte.substring(0, 10);
            if (!mapa[dia]) mapa[dia] = { Recife: 0, Moreno: 0 };
            if (r.origem === 'Recife') mapa[dia].Recife++;
            else if (r.origem === 'Moreno') mapa[dia].Moreno++;
        }
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, v]) => ({ data: data.substring(5).replace('-', '/'), ...v }));
    }, [registros]);

    // Média por turno
    const dadosPorTurno = useMemo(() => {
        const mapa = { 'Manhã': [], 'Tarde': [], 'Noite': [] };
        for (const r of registros) {
            if (r.turno && mapa[r.turno] !== undefined) mapa[r.turno].push(r);
        }
        return TURNOS.map(t => ({
            turno: t,
            quantidade: mapa[t].length,
            media_horas: mapa[t].filter(r => r.horas_lancamento_cte !== null).length
                ? parseFloat((mapa[t].filter(r => r.horas_lancamento_cte !== null)
                    .reduce((a, r) => a + r.horas_lancamento_cte, 0)
                    / mapa[t].filter(r => r.horas_lancamento_cte !== null).length).toFixed(1))
                : 0,
        }));
    }, [registros]);

    // Heatmap: matriz [dia_semana][hora] = qtd
    const heatmapMatrix = useMemo(() => {
        const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
        for (const cell of heatmap) {
            const d = parseInt(cell.dia_semana, 10);
            const h = parseInt(cell.hora, 10);
            const q = parseInt(cell.qtd, 10);
            if (d >= 0 && d < 7 && h >= 0 && h < 24) matrix[d][h] = q;
        }
        return matrix;
    }, [heatmap]);

    const heatmapMax = useMemo(() => Math.max(1, ...heatmapMatrix.flat()), [heatmapMatrix]);

    // Horas relevantes (6-22)
    const horasVisiveis = Array.from({ length: 17 }, (_, i) => i + 6);

    function exportarXLSX() {
        const dados = registros.map(r => ({
            Motorista: r.motorista,
            Coleta: r.num_coleta,
            'Nº Liberação': r.num_liberacao,
            'Data Lançamento': r.data_lancamento ? formatDateTime(r.data_lancamento) : '',
            'Data CT-e': formatDateTime(r.datetime_cte),
            'Horas lanç.→CT-e': r.horas_lancamento_cte ?? '',
            Turno: r.turno,
            Origem: r.origem,
            'Destino UF': r.destino_uf,
            'Destino Cidade': r.destino_cidade,
            Operação: r.operacao,
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CT-e');
        XLSX.writeFile(wb, `relatorio_cte_${dataInicio}_${dataFim}.xlsx`);
    }

    const temDados = registros.length > 0;

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <FileText size={20} className="text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">Relatório CT-e</h2>
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
                {temDados && (
                    <button onClick={exportarXLSX}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded transition ml-auto">
                        <FileDown size={14} /> Exportar XLSX
                    </button>
                )}
            </div>

            {!temDados && !carregando && (
                <div className="text-center text-gray-500 py-12">Selecione um período e clique em Buscar.</div>
            )}

            {temDados && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total emitidos', valor: resumo.total, icon: <FileText size={16} />, cor: '#fbbf24', bg: '#78350f44' },
                            { label: 'Tempo médio emissão', valor: formatHoras(resumo.media), icon: <Clock size={16} />, cor: '#60a5fa', bg: '#1e3a5f44' },
                            { label: 'Recife', valor: resumo.recife, icon: <MapPin size={16} />, cor: '#60a5fa', bg: '#1e3a5f44' },
                            { label: 'Moreno', valor: resumo.moreno, icon: <MapPin size={16} />, cor: '#a78bfa', bg: '#2e106544' },
                        ].map(c => (
                            <div key={c.label} className="rounded-xl p-4 flex items-center gap-3 border border-gray-700"
                                style={{ background: c.bg }}>
                                <div style={{ color: c.cor }}>{c.icon}</div>
                                <div>
                                    <div className="text-xs text-gray-400">{c.label}</div>
                                    <div className="text-lg font-bold" style={{ color: c.cor }}>{c.valor}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Ociosidade / Gargalo */}
                    {(ociosidade.Recife || ociosidade.Moreno) && (
                        <div>
                            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                <AlertTriangle size={12} /> Ociosidade entre CT-es (gargalos)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {['Recife', 'Moreno'].map(u => {
                                    const o = ociosidade[u] || {};
                                    const maxH = o.max_gap_horas;
                                    const gaps = o.gaps_acima_2h || 0;
                                    const corGap = maxH > 4 ? '#f87171' : maxH > 2 ? '#fbbf24' : '#4ade80';
                                    const bgGap = maxH > 4 ? '#7f1d1d44' : maxH > 2 ? '#78350f44' : '#065f4644';
                                    return (
                                        <div key={u} className="rounded-xl p-4 border border-gray-700 flex items-start gap-4"
                                            style={{ background: bgGap }}>
                                            <div className="flex flex-col items-center justify-center w-16 shrink-0">
                                                <Activity size={20} style={{ color: corGap }} />
                                                <span className="text-xs text-gray-400 mt-1">{u}</span>
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-bold" style={{ color: corGap }}>
                                                        {formatHoras(maxH)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">maior gap entre CT-es</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-400">{gaps} gap{gaps !== 1 ? 's' : ''} acima de 2h</span>
                                                    <span className="text-gray-600">·</span>
                                                    <span className="text-gray-400">{o.total || 0} CT-es no período</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-700">
                        {[
                            { id: 'graficos', label: 'Gráficos', icon: <TrendingUp size={12} /> },
                            { id: 'heatmap', label: 'Heatmap', icon: <Activity size={12} /> },
                            { id: 'tabela', label: 'Tabela', icon: <FileText size={12} /> },
                        ].map(t => (
                            <button key={t.id} onClick={() => setAba(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm transition ${aba === t.id ? 'text-white border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-200'}`}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Aba Gráficos */}
                    {aba === 'graficos' && (
                        <div className="space-y-4">
                            {/* Comparativo Recife vs Moreno por dia */}
                            {dadosPorDia.length > 0 && (
                                <div className="bg-gray-800 rounded-xl p-4">
                                    <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                        <TrendingUp size={12} /> CT-es por dia — Recife vs Moreno
                                    </div>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={dadosPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                                formatter={(v, name) => [v, name]} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                                            <Bar dataKey="Recife" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                                            <Bar dataKey="Moreno" fill="#8b5cf6" radius={[3, 3, 0, 0]} stackId="a" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Turnos */}
                            <div className="bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                    <Clock size={12} /> CT-es por turno (quantidade e tempo médio)
                                </div>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={dadosPorTurno} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="turno" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                            formatter={(v, name) => [name === 'quantidade' ? `${v} CT-es` : `${v}h`, name === 'quantidade' ? 'Quantidade' : 'Tempo médio']} />
                                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                                        <Bar yAxisId="left" dataKey="quantidade" name="quantidade" radius={[3, 3, 0, 0]}>
                                            {dadosPorTurno.map((entry, i) => <Cell key={i} fill={CORES_TURNO[entry.turno]} />)}
                                        </Bar>
                                        <Line yAxisId="right" type="monotone" dataKey="media_horas" name="media_horas"
                                            stroke="#e5e7eb" strokeWidth={2} dot={{ r: 4 }} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {dadosPorTurno.map(t => (
                                        <div key={t.turno} className="text-center bg-gray-700 rounded-lg py-2">
                                            <div className="text-xs font-medium" style={{ color: CORES_TURNO[t.turno] }}>{t.turno}</div>
                                            <div className="text-white text-sm font-bold">{t.quantidade}</div>
                                            <div className="text-gray-400 text-xs">{formatHoras(t.media_horas || null)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Aba Heatmap */}
                    {aba === 'heatmap' && (
                        <div className="bg-gray-800 rounded-xl p-4">
                            <div className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                                <Activity size={12} /> Horários de pico — CT-es por dia da semana × hora
                            </div>

                            {/* Legenda de intensidade */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs text-gray-500">Menos</span>
                                <div className="flex gap-0.5">
                                    {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map(op => (
                                        <div key={op} className="w-5 h-3 rounded-sm"
                                            style={{ background: `rgba(251,191,36,${op})` }} />
                                    ))}
                                </div>
                                <span className="text-xs text-gray-500">Mais</span>
                            </div>

                            {/* Grade heatmap */}
                            <div className="overflow-x-auto">
                                <div style={{ minWidth: 540 }}>
                                    {/* Cabeçalho de horas */}
                                    <div className="flex mb-1" style={{ paddingLeft: 36 }}>
                                        {horasVisiveis.map(h => (
                                            <div key={h} className="text-xs text-gray-500 text-center"
                                                style={{ width: 28, flexShrink: 0 }}>
                                                {h}h
                                            </div>
                                        ))}
                                    </div>

                                    {/* Linhas por dia da semana */}
                                    {DIAS_SEMANA.map((dia, d) => (
                                        <div key={d} className="flex items-center mb-1">
                                            <div className="text-xs text-gray-400 w-9 shrink-0 text-right pr-2">{dia}</div>
                                            {horasVisiveis.map(h => {
                                                const qtd = heatmapMatrix[d][h];
                                                const opacity = qtd === 0 ? 0.05 : 0.15 + (qtd / heatmapMax) * 0.85;
                                                return (
                                                    <div key={h}
                                                        className="rounded-sm flex items-center justify-center cursor-default"
                                                        style={{
                                                            width: 26, height: 22, marginRight: 2,
                                                            background: `rgba(251,191,36,${opacity.toFixed(2)})`,
                                                        }}
                                                        title={`${dia} ${h}h: ${qtd} CT-e${qtd !== 1 ? 's' : ''}`}>
                                                        {qtd > 0 && (
                                                            <span className="text-xs font-bold"
                                                                style={{ color: opacity > 0.5 ? '#1f2937' : '#fbbf24', fontSize: 9 }}>
                                                                {qtd}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Insight do pico */}
                            {heatmap.length > 0 && (() => {
                                const pico = heatmap.reduce((m, c) => parseInt(c.qtd, 10) > parseInt(m.qtd, 10) ? c : m, heatmap[0]);
                                return (
                                    <div className="mt-4 p-3 rounded-lg border border-yellow-500 border-opacity-30 bg-yellow-500 bg-opacity-10">
                                        <span className="text-xs text-yellow-300">
                                            Pico: <strong>{DIAS_SEMANA[parseInt(pico.dia_semana, 10)]}</strong> às <strong>{pico.hora}h</strong> com <strong>{pico.qtd}</strong> CT-e{parseInt(pico.qtd, 10) !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Aba Tabela */}
                    {aba === 'tabela' && (
                        <div className="bg-gray-800 rounded-xl overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-700 text-gray-300 text-xs">
                                        <th className="text-left px-3 py-2">Motorista</th>
                                        <th className="text-center px-3 py-2">Coleta</th>
                                        <th className="text-center px-3 py-2">Nº Lib.</th>
                                        <th className="text-center px-3 py-2">Lançamento</th>
                                        <th className="text-center px-3 py-2">CT-e emitido</th>
                                        <th className="text-center px-3 py-2">Tempo</th>
                                        <th className="text-center px-3 py-2">Turno</th>
                                        <th className="text-center px-3 py-2">Origem</th>
                                        <th className="text-left px-3 py-2">Destino</th>
                                        <th className="text-left px-3 py-2">Operação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...registros].reverse().map(r => (
                                        <tr key={r.id} className="border-t border-gray-700 hover:bg-gray-700 transition text-xs">
                                            <td className="px-3 py-2 text-white">{r.motorista}</td>
                                            <td className="px-3 py-2 text-center text-gray-400">{r.num_coleta || '—'}</td>
                                            <td className="px-3 py-2 text-center text-gray-400">{r.num_liberacao || '—'}</td>
                                            <td className="px-3 py-2 text-center text-gray-500">{formatDateTime(r.data_lancamento)}</td>
                                            <td className="px-3 py-2 text-center text-gray-300">{formatDateTime(r.datetime_cte)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`font-medium ${r.horas_lancamento_cte > 8 ? 'text-red-400' : r.horas_lancamento_cte > 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {formatHoras(r.horas_lancamento_cte)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="px-1.5 py-0.5 rounded text-xs"
                                                    style={{ background: CORES_TURNO[r.turno] + '33', color: CORES_TURNO[r.turno] }}>
                                                    {r.turno}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${r.origem === 'Recife' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                                                    {r.origem}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-400">{r.destino_cidade ? `${r.destino_cidade}/${r.destino_uf}` : r.destino_uf || '—'}</td>
                                            <td className="px-3 py-2 text-gray-400">{r.operacao || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
