import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { Filter, Calendar, Truck, Clock, BarChart3, FileDown, RefreshCw, CheckCircle, XCircle, Users } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import * as XLSX from 'xlsx';

const FAIXAS = [
    { label: '< 1h', min: 0, max: 1, cor: '#22c55e' },
    { label: '1–2h', min: 1, max: 2, cor: '#3b82f6' },
    { label: '2–4h', min: 2, max: 4, cor: '#f59e0b' },
    { label: '> 4h', min: 4, max: Infinity, cor: '#ef4444' },
];

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

function CheckIcon({ ok }) {
    return ok
        ? <CheckCircle size={14} className="text-green-400 inline" />
        : <XCircle size={14} className="text-red-500 inline" />;
}

export default function RelatorioLiberacoes() {
    const hoje = obterDataBrasilia().substring(0, 10);
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [liberacoes, setLiberacoes] = useState([]);
    const [carregando, setCarregando] = useState(false);

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/liberacoes?de=${dataInicio}&ate=${dataFim}`);
            setLiberacoes(res.data.liberacoes || []);
        } catch (e) {
            console.error('Erro ao buscar liberações:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    const resumo = useMemo(() => {
        const comHoras = liberacoes.filter(l => l.horas_ate_liberacao !== null);
        const media = comHoras.length
            ? comHoras.reduce((a, l) => a + l.horas_ate_liberacao, 0) / comHoras.length
            : null;
        const todosChecks = liberacoes.filter(l => l.chk_cnh && l.chk_antt && l.chk_tacografo && l.chk_crlv).length;
        const frota = liberacoes.filter(l => l.is_frota).length;
        return {
            total: liberacoes.length,
            media,
            pctChecks: liberacoes.length ? Math.round(todosChecks / liberacoes.length * 100) : 0,
            pctFrota: liberacoes.length ? Math.round(frota / liberacoes.length * 100) : 0,
        };
    }, [liberacoes]);

    const dadosGrafico = useMemo(() => {
        return FAIXAS.map(f => ({
            label: f.label,
            qtd: liberacoes.filter(l => l.horas_ate_liberacao !== null && l.horas_ate_liberacao >= f.min && l.horas_ate_liberacao < f.max).length,
            cor: f.cor,
        }));
    }, [liberacoes]);

    function exportarXLSX() {
        const dados = liberacoes.map(l => ({
            Motorista: l.motorista,
            Data: l.data,
            Operação: l.operacao,
            'Nº Liberação': l.numero_liberacao,
            'Data Lançamento': l.data_criacao ? new Date(l.data_criacao).toLocaleString('pt-BR') : '',
            'Data Liberação': l.data_liberacao ? new Date(l.data_liberacao).toLocaleString('pt-BR') : '',
            'Horas até liberação': l.horas_ate_liberacao ?? '',
            'CNH': l.chk_cnh ? 'OK' : 'Pendente',
            'ANTT': l.chk_antt ? 'OK' : 'Pendente',
            'Tacógrafo': l.chk_tacografo ? 'OK' : 'Pendente',
            'CRLV': l.chk_crlv ? 'OK' : 'Pendente',
            Situação: l.situacao_cadastro,
            Frota: l.is_frota ? 'Sim' : 'Não',
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Liberações');
        XLSX.writeFile(wb, `liberacoes_${dataInicio}_${dataFim}.xlsx`);
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-green-500" />
                <h2 className="text-lg font-semibold text-white">Tempo de Liberação</h2>
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
                {liberacoes.length > 0 && (
                    <button onClick={exportarXLSX}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm px-4 py-1.5 rounded transition ml-auto">
                        <FileDown size={14} /> Exportar XLSX
                    </button>
                )}
            </div>

            {liberacoes.length === 0 && !carregando && (
                <div className="text-center text-gray-500 py-12">Selecione um período e clique em Buscar.</div>
            )}

            {liberacoes.length > 0 && (
                <>
                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total liberados', valor: resumo.total, icon: <Truck size={16} /> },
                            { label: 'Tempo médio', valor: formatHoras(resumo.media), icon: <Clock size={16} /> },
                            { label: 'Docs completos', valor: `${resumo.pctChecks}%`, icon: <CheckCircle size={16} className="text-green-400" /> },
                            { label: 'Frota própria', valor: `${resumo.pctFrota}%`, icon: <Users size={16} className="text-purple-400" /> },
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

                    {/* Gráfico distribuição */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-xs text-gray-400 mb-3">Distribuição por tempo até liberação</div>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#fff', fontSize: 12 }}
                                    formatter={v => [v, 'Veículos']} />
                                <Bar dataKey="qtd" radius={[3, 3, 0, 0]}>
                                    {dadosGrafico.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Tabela */}
                    <div className="bg-gray-800 rounded-lg overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-700 text-gray-300 text-xs">
                                    <th className="text-left px-3 py-2">Motorista</th>
                                    <th className="text-center px-3 py-2">Data</th>
                                    <th className="text-left px-3 py-2">Operação</th>
                                    <th className="text-center px-3 py-2">Nº Lib.</th>
                                    <th className="text-center px-3 py-2">Lançamento</th>
                                    <th className="text-center px-3 py-2">Liberação</th>
                                    <th className="text-center px-3 py-2">Tempo</th>
                                    <th className="text-center px-3 py-2">CNH</th>
                                    <th className="text-center px-3 py-2">ANTT</th>
                                    <th className="text-center px-3 py-2">Taco</th>
                                    <th className="text-center px-3 py-2">CRLV</th>
                                    <th className="text-center px-3 py-2">Tipo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {liberacoes.map(l => (
                                    <tr key={l.id} className="border-t border-gray-700 hover:bg-gray-750 text-xs">
                                        <td className="px-3 py-2 text-white">{l.motorista}</td>
                                        <td className="px-3 py-2 text-center text-gray-400">{l.data?.substring(5).replace('-', '/')}</td>
                                        <td className="px-3 py-2 text-gray-300">{l.operacao}</td>
                                        <td className="px-3 py-2 text-center text-gray-300">{l.numero_liberacao || '—'}</td>
                                        <td className="px-3 py-2 text-center text-gray-400">
                                            {l.data_criacao ? new Date(l.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-400">
                                            {l.data_liberacao ? new Date(l.data_liberacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`font-medium ${l.horas_ate_liberacao > 4 ? 'text-red-400' : l.horas_ate_liberacao > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                {formatHoras(l.horas_ate_liberacao)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center"><CheckIcon ok={l.chk_cnh} /></td>
                                        <td className="px-3 py-2 text-center"><CheckIcon ok={l.chk_antt} /></td>
                                        <td className="px-3 py-2 text-center"><CheckIcon ok={l.chk_tacografo} /></td>
                                        <td className="px-3 py-2 text-center"><CheckIcon ok={l.chk_crlv} /></td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-xs ${l.is_frota ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-400'}`}>
                                                {l.is_frota ? 'Frota' : 'Terceiro'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
