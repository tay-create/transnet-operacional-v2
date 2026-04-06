import React, { useState, useMemo, useCallback } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell, Legend
} from 'recharts';
import { Filter, Calendar, FileText, Clock, BarChart3, FileDown, RefreshCw, MapPin, TrendingUp } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import * as XLSX from 'xlsx';

const CORES_TURNO = { 'Manhã': '#f59e0b', 'Tarde': '#3b82f6', 'Noite': '#8b5cf6' };
const TURNOS = ['Manhã', 'Tarde', 'Noite'];

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
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [registros, setRegistros] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [aba, setAba] = useState('tabela'); // 'tabela' | 'graficos'

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/cte?de=${dataInicio}&ate=${dataFim}`);
            setRegistros(res.data.registros || []);
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

    // CT-es por dia (para gráfico de linha)
    const dadosPorDia = useMemo(() => {
        const mapa = {};
        for (const r of registros) {
            if (!r.datetime_cte) continue;
            const dia = r.datetime_cte.substring(0, 10);
            mapa[dia] = (mapa[dia] || 0) + 1;
        }
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, qtd]) => ({ data: data.substring(5).replace('-', '/'), qtd }));
    }, [registros]);

    // Média por turno (para gráfico de barras)
    const dadosPorTurno = useMemo(() => {
        const mapa = { 'Manhã': [], 'Tarde': [], 'Noite': [] };
        for (const r of registros) {
            if (r.turno && mapa[r.turno] !== undefined) mapa[r.turno].push(r);
        }
        return TURNOS.map(t => ({
            turno: t,
            quantidade: mapa[t].length,
            media_horas: mapa[t].filter(r => r.horas_lancamento_cte !== null).length
                ? parseFloat((mapa[t].filter(r => r.horas_lancamento_cte !== null).reduce((a, r) => a + r.horas_lancamento_cte, 0)
                    / mapa[t].filter(r => r.horas_lancamento_cte !== null).length).toFixed(1))
                : 0,
        }));
    }, [registros]);

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

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <FileText size={20} className="text-yellow-500" />
                <h2 className="text-lg font-semibold text-white">CT-e & Liberações</h2>
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
                {registros.length > 0 && (
                    <button onClick={exportarXLSX}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded transition ml-auto">
                        <FileDown size={14} /> Exportar XLSX
                    </button>
                )}
            </div>

            {registros.length === 0 && !carregando && (
                <div className="text-center text-gray-500 py-12">Selecione um período e clique em Buscar.</div>
            )}

            {registros.length > 0 && (
                <>
                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total emitidos', valor: resumo.total, icon: <FileText size={16} /> },
                            { label: 'Tempo médio emissão', valor: formatHoras(resumo.media), icon: <Clock size={16} /> },
                            { label: 'Recife', valor: resumo.recife, icon: <MapPin size={16} className="text-blue-400" /> },
                            { label: 'Moreno', valor: resumo.moreno, icon: <MapPin size={16} className="text-purple-400" /> },
                        ].map(c => (
                            <div key={c.label} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                                <div className="text-yellow-400">{c.icon}</div>
                                <div>
                                    <div className="text-xs text-gray-400">{c.label}</div>
                                    <div className="text-white font-semibold">{c.valor}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-700">
                        {[{ id: 'tabela', label: 'Tabela' }, { id: 'graficos', label: 'Gráficos' }].map(t => (
                            <button key={t.id} onClick={() => setAba(t.id)}
                                className={`px-4 py-2 text-sm transition ${aba === t.id ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {aba === 'graficos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CT-es por dia */}
                            {dadosPorDia.length > 1 && (
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                        <TrendingUp size={12} /> CT-es emitidos por dia
                                    </div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={dadosPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                                formatter={v => [v, 'CT-es']} />
                                            <Line type="monotone" dataKey="qtd" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Quantidade e tempo médio por turno */}
                            <div className="bg-gray-800 rounded-lg p-4">
                                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                    <Clock size={12} /> CT-es por turno (qtd e tempo médio)
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
                                        <div key={t.turno} className="text-center">
                                            <div className="text-xs font-medium" style={{ color: CORES_TURNO[t.turno] }}>{t.turno}</div>
                                            <div className="text-white text-sm font-bold">{t.quantidade}</div>
                                            <div className="text-gray-400 text-xs">~{formatHoras(t.media_horas || null)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {aba === 'tabela' && (
                        <div className="bg-gray-800 rounded-lg overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-700 text-gray-300 text-xs">
                                        <th className="text-left px-3 py-2">Motorista</th>
                                        <th className="text-center px-3 py-2">Coleta</th>
                                        <th className="text-center px-3 py-2">Nº Lib.</th>
                                        <th className="text-center px-3 py-2">Lançamento</th>
                                        <th className="text-center px-3 py-2">CT-e emitido</th>
                                        <th className="text-center px-3 py-2">Tempo total</th>
                                        <th className="text-center px-3 py-2">Turno</th>
                                        <th className="text-center px-3 py-2">Origem</th>
                                        <th className="text-left px-3 py-2">Destino</th>
                                        <th className="text-left px-3 py-2">Operação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registros.map(r => (
                                        <tr key={r.id} className="border-t border-gray-700 hover:bg-gray-750 text-xs">
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
