import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Filter, Calendar, Truck, ChevronDown, ChevronRight, Clock, BarChart3, FileDown, RefreshCw, MapPin } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import * as XLSX from 'xlsx';

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

export default function RelatorioPerformance() {
    const hoje = obterDataBrasilia().substring(0, 10);
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [unidade, setUnidade] = useState('todas');
    const [linhas, setLinhas] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [expandidos, setExpandidos] = useState({});

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/performance?de=${dataInicio}&ate=${dataFim}&unidade=${unidade}`);
            setLinhas(res.data.linhas || []);
            setExpandidos({});
        } catch (e) {
            console.error('Erro ao buscar performance:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim, unidade]);

    const agrupado = useMemo(() => {
        const mapa = {};
        for (const l of linhas) {
            if (!mapa[l.motorista]) mapa[l.motorista] = [];
            mapa[l.motorista].push(l);
        }
        return Object.entries(mapa).map(([motorista, cards]) => {
            const comDuracao = cards.filter(c => c.duracao_min !== null);
            const totalDuracao = comDuracao.reduce((acc, c) => acc + c.duracao_min, 0);
            const totalEfetivo = comDuracao.reduce((acc, c) => acc + (c.efetivo_min ?? c.duracao_min), 0);
            const mediaDuracao = comDuracao.length ? Math.round(totalDuracao / comDuracao.length) : null;
            return { motorista, cards, mediaDuracao, totalDuracao, totalEfetivo };
        }).sort((a, b) => (b.totalDuracao ?? 0) - (a.totalDuracao ?? 0));
    }, [linhas]);

    const resumo = useMemo(() => {
        const comDuracao = linhas.filter(l => l.duracao_min !== null);
        const mediaGeral = comDuracao.length ? Math.round(comDuracao.reduce((a, l) => a + l.duracao_min, 0) / comDuracao.length) : null;
        const mediaEfetivo = comDuracao.length ? Math.round(comDuracao.reduce((a, l) => a + (l.efetivo_min ?? l.duracao_min), 0) / comDuracao.length) : null;
        const reprogramados = linhas.filter(l => l.foi_reprogramado).length;
        return { total: linhas.length, mediaGeral, mediaEfetivo, reprogramados };
    }, [linhas]);

    const dadosGrafico = useMemo(() => {
        const porDia = {};
        for (const l of linhas) {
            if (l.duracao_min === null) continue;
            if (!porDia[l.data]) porDia[l.data] = { soma: 0, qtd: 0 };
            porDia[l.data].soma += l.duracao_min;
            porDia[l.data].qtd++;
        }
        return Object.entries(porDia).map(([data, v]) => ({
            data: data.substring(5).replace('-', '/'),
            media: Math.round(v.soma / v.qtd),
        })).sort((a, b) => a.data.localeCompare(b.data));
    }, [linhas]);

    function exportarXLSX() {
        const dados = linhas.map(l => ({
            Motorista: l.motorista,
            Data: l.data,
            Unidade: l.unidade,
            Operação: l.operacao,
            'Início Sep.': l.t_inicio_separacao || '',
            'Fim Carreg.': l.fim_carregamento || '',
            'Duração (min)': l.duracao_min ?? '',
            'Pausas (min)': l.pausas_min,
            'Efetivo (min)': l.efetivo_min ?? '',
            Reprogramado: l.foi_reprogramado ? 'Sim' : 'Não',
            Frota: l.is_frota ? 'Sim' : 'Não',
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Performance');
        XLSX.writeFile(wb, `performance_embarque_${dataInicio}_${dataFim}.xlsx`);
    }

    return (
        <div className="p-4 space-y-4">
            {/* Cabeçalho */}
            <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={20} className="text-blue-500" />
                <h2 className="text-lg font-semibold text-white">Performance de Embarque</h2>
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
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={12} /> Unidade</label>
                    <select value={unidade} onChange={e => setUnidade(e.target.value)}
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600">
                        <option value="todas">Todas</option>
                        <option value="Recife">Recife</option>
                        <option value="Moreno">Moreno</option>
                    </select>
                </div>
                <button onClick={buscar} disabled={carregando}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded transition">
                    {carregando ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />}
                    Buscar
                </button>
                {linhas.length > 0 && (
                    <button onClick={exportarXLSX}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded transition ml-auto">
                        <FileDown size={14} /> Exportar XLSX
                    </button>
                )}
            </div>

            {linhas.length === 0 && !carregando && (
                <div className="text-center text-gray-500 py-12">Selecione um período e clique em Buscar.</div>
            )}

            {linhas.length > 0 && (
                <>
                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total de cards', valor: resumo.total, icon: <Truck size={16} /> },
                            { label: 'Tempo médio', valor: formatMin(resumo.mediaGeral), icon: <Clock size={16} /> },
                            { label: 'Tempo efetivo médio', valor: formatMin(resumo.mediaEfetivo), icon: <Clock size={16} className="text-green-400" /> },
                            { label: 'Reprogramados', valor: `${resumo.reprogramados} (${resumo.total ? Math.round(resumo.reprogramados / resumo.total * 100) : 0}%)`, icon: <RefreshCw size={16} className="text-yellow-400" /> },
                        ].map(c => (
                            <div key={c.label} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                                <div className="text-blue-400">{c.icon}</div>
                                <div>
                                    <div className="text-xs text-gray-400">{c.label}</div>
                                    <div className="text-white font-semibold">{c.valor}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Gráfico */}
                    {dadosGrafico.length > 1 && (
                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-xs text-gray-400 mb-3">Tempo médio por dia (min)</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                        formatter={v => [`${v} min`, 'Média']} />
                                    <Bar dataKey="media" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Tabela agrupada por motorista */}
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-700 text-gray-300 text-xs">
                                    <th className="text-left px-3 py-2 w-6"></th>
                                    <th className="text-left px-3 py-2">Motorista</th>
                                    <th className="text-center px-3 py-2">Cards</th>
                                    <th className="text-center px-3 py-2">Média duração</th>
                                    <th className="text-center px-3 py-2">Total efetivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agrupado.map(({ motorista, cards, mediaDuracao, totalEfetivo }) => (
                                    <React.Fragment key={motorista}>
                                        <tr className="border-t border-gray-700 hover:bg-gray-750 cursor-pointer"
                                            onClick={() => setExpandidos(p => ({ ...p, [motorista]: !p[motorista] }))}>
                                            <td className="px-3 py-2 text-gray-400">
                                                {expandidos[motorista] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td className="px-3 py-2 text-white font-medium">{motorista}</td>
                                            <td className="px-3 py-2 text-center text-gray-300">{cards.length}</td>
                                            <td className="px-3 py-2 text-center text-blue-300">{formatMin(mediaDuracao)}</td>
                                            <td className="px-3 py-2 text-center text-green-300">{formatMin(totalEfetivo)}</td>
                                        </tr>
                                        {expandidos[motorista] && cards.map((c, i) => (
                                            <tr key={i} className="bg-gray-900 border-t border-gray-700 text-xs text-gray-400">
                                                <td></td>
                                                <td className="px-3 py-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs ${c.unidade === 'Recife' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                                                        {c.unidade}
                                                    </span>
                                                    <span className="ml-2">{c.data?.substring(5).replace('-', '/')}</span>
                                                    {c.foi_reprogramado && <span className="ml-2 text-yellow-500">↺</span>}
                                                </td>
                                                <td className="px-3 py-1.5 text-gray-500">{c.operacao}</td>
                                                <td className="px-3 py-1.5 text-center">
                                                    {c.t_inicio_separacao && c.fim_carregamento
                                                        ? `${c.t_inicio_separacao} → ${c.fim_carregamento}`
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                    <span className="text-blue-300">{formatMin(c.duracao_min)}</span>
                                                    {c.pausas_min > 0 && (
                                                        <span className="text-green-300 ml-2">{formatMin(c.efetivo_min)} efetivo</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
