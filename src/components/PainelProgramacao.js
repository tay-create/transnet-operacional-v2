import React, { useState, useEffect } from 'react';
import api from '../services/apiService';
import { Calendar, RefreshCw, BarChart, PieChart as PieChartIcon, FileDown, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { obterDataBrasilia } from '../utils/helpers';

// Mapeamento de operação → unidade
const UNIDADE_RECIFE = ['Delta', 'Consolidados'];
const UNIDADE_MORENO = ['Eletrik', 'Porcelana'];
const OPERACOES = ['Delta', 'Porcelana', 'Eletrik', 'Consolidados'];

const CORES_OPERACAO = {
    Delta: '#38bdf8',
    Consolidados: '#818cf8',
    Eletrik: '#fbbf24',
    Porcelana: '#a78bfa',
};

export default function PainelProgramacao() {
    const [programacoes, setProgramacoes] = useState([]);
    const [carregando, setCarregando] = useState(false);

    const dataHoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(dataHoje);
    const [dataFim, setDataFim] = useState(dataHoje);

    const carregarDados = async () => {
        setCarregando(true);
        try {
            const res = await api.get('/api/programacao-diaria');
            if (res.data.success) setProgramacoes(res.data.programacoes);
        } catch (e) {
            console.error('Erro ao carregar programação:', e);
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    const formatData = (dStr) => {
        if (!dStr) return '';
        const [a, m, d] = dStr.split('-');
        return `${d}/${m}/${a}`;
    };

    const handleExportPDF = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const elemento = document.getElementById('relatorio-programacao');
        if (!elemento) return;
        html2pdf().set({
            margin: 10,
            filename: `Programacao_Diaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(elemento).save();
    };

    const programacoesFiltradas = programacoes.filter(prog => {
        if (dataInicio && dataFim && prog.data_referencia) {
            if (prog.data_referencia < dataInicio || prog.data_referencia > dataFim) return false;
        }
        return true;
    });

    return (
        <div style={{ padding: '20px 25px', height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
            {/* Header */}
            <div className="glass-panel-internal" style={{ padding: '15px 25px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={18} />
                        PROGRAMAÇÃO DIÁRIA DE CARREGAMENTO <span style={{ color: '#fb923c' }}>/ HISTÓRICO</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                        Resumo consolidado diário dos veículos e origens, extraído nos turnos das 10h e 17h.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={carregarDados}
                        disabled={carregando}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8', borderRadius: '8px', padding: '8px 14px',
                            cursor: carregando ? 'default' : 'pointer', fontSize: '12px',
                            transition: 'all 0.2s', opacity: carregando ? 0.6 : 1
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} />
                        Atualizar
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={programacoes.length === 0}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                            color: '#4ade80', borderRadius: '8px', padding: '8px 14px',
                            cursor: programacoes.length === 0 ? 'default' : 'pointer', fontSize: '12px',
                            fontWeight: '700', transition: 'all 0.2s',
                            opacity: programacoes.length === 0 ? 0.4 : 1
                        }}
                    >
                        <FileDown size={16} />
                        Exportar PDF
                    </button>

                    {/* Filtros de Data */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15,23,42,0.6)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginLeft: '10px' }}>
                        <Filter size={14} color="#64748b" />
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>PERÍODO:</span>
                        <input
                            type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                        />
                        <span style={{ color: '#64748b', fontSize: '11px' }}>até</span>
                        <input
                            type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                        />
                    </div>
                </div>
            </div>

            {/* Conteúdo exportável */}
            <div id="relatorio-programacao" style={{ background: 'transparent', padding: '0' }}>
                {programacoesFiltradas.length === 0 && !carregando ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                        <BarChart size={48} style={{ opacity: 0.3, marginBottom: '16px', margin: '0 auto' }} />
                        <p>Nenhuma programação encontrada neste período.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {programacoesFiltradas.map(prog => {
                            const dados = prog.dados_json || {};

                            let totalRecife = 0, totalMoreno = 0, totalRepro = 0;
                            let totalRecifeRepro = 0, totalMorenoRepro = 0;

                            // Calcular totais por unidade para os gráficos
                            OPERACOES.forEach(op => {
                                const d = dados[op] || { recife: 0, moreno: 0, reprogramado: 0 };
                                totalRecife += d.recife || 0;
                                totalMoreno += d.moreno || 0;
                                totalRepro += d.reprogramado || 0;

                                if (UNIDADE_RECIFE.includes(op)) {
                                    totalRecifeRepro += d.reprogramado || 0;
                                } else {
                                    totalMorenoRepro += d.reprogramado || 0;
                                }
                            });

                            // Dados gráfico 1: Operações por Unidade
                            const totalRecifeOp = UNIDADE_RECIFE.reduce((acc, op) => {
                                const d = dados[op] || { recife: 0, moreno: 0 };
                                return acc + (d.recife || 0) + (d.moreno || 0);
                            }, 0);
                            const totalMorenoOp = UNIDADE_MORENO.reduce((acc, op) => {
                                const d = dados[op] || { recife: 0, moreno: 0 };
                                return acc + (d.recife || 0) + (d.moreno || 0);
                            }, 0);
                            const dadosGrafico1 = [
                                { name: 'Recife', value: totalRecifeOp },
                                { name: 'Moreno', value: totalMorenoOp },
                            ].filter(i => i.value > 0);

                            // Dados gráfico 2: Reprogramados por Unidade
                            const dadosGrafico2 = [
                                { name: 'Recife', value: totalRecifeRepro },
                                { name: 'Moreno', value: totalMorenoRepro },
                            ].filter(i => i.value > 0);

                            const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' };

                            return (
                                <div key={prog.id} className="glass-panel-internal" style={{ borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
                                    {/* Header do turno */}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', fontSize: '15px' }}>
                                            <Calendar size={18} color="#60a5fa" />
                                            {formatData(prog.data_referencia)} — Turno {prog.turno}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                            Snapshot Automático
                                        </span>
                                    </div>

                                    {/* Corpo: Tabela + Gráficos */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', background: 'rgba(0,0,0,0.1)' }}>

                                        {/* Tabela */}
                                        <div style={{ flex: '1 1 55%', minWidth: '350px' }}>
                                            <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead>
                                                    <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <th style={{ padding: '12px 20px', color: '#94a3b8', fontWeight: 'bold' }}>OPERAÇÃO</th>
                                                        <th style={{ padding: '12px 20px', color: '#94a3b8', fontWeight: 'bold', textAlign: 'center' }}>QUANTIDADE</th>
                                                        <th style={{ padding: '12px 20px', color: '#f43f5e', fontWeight: 'bold', textAlign: 'center' }}>REPROGRAMADOS (D-1)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {OPERACOES.map((op, i) => {
                                                        const d = dados[op] || { recife: 0, moreno: 0, reprogramado: 0 };
                                                        const unidade = UNIDADE_RECIFE.includes(op) ? 'Recife' : 'Moreno';
                                                        return (
                                                            <tr key={op} style={{ borderBottom: i === OPERACOES.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.02)' }}>
                                                                <td style={{ padding: '12px 20px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CORES_OPERACAO[op], flexShrink: 0, display: 'inline-block' }} />
                                                                        <span style={{ color: '#f1f5f9', fontWeight: '500' }}>{op}</span>
                                                                        <span style={{
                                                                            fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
                                                                            background: unidade === 'Recife' ? 'rgba(56,189,248,0.1)' : 'rgba(251,191,36,0.1)',
                                                                            color: unidade === 'Recife' ? '#38bdf8' : '#fbbf24',
                                                                            border: `1px solid ${unidade === 'Recife' ? 'rgba(56,189,248,0.2)' : 'rgba(251,191,36,0.2)'}`
                                                                        }}>{unidade}</span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#e2e8f0' }}>
                                                                    {(d.recife || 0) + (d.moreno || 0)}
                                                                </td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: (d.reprogramado || 0) > 0 ? '#fca5a5' : '#64748b' }}>
                                                                    {d.reprogramado || 0}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <td style={{ padding: '12px 20px', fontWeight: 'bold', color: '#f8fafc' }}>TOTAL GERAL</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>{totalRecife + totalMoreno}</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#f43f5e' }}>{totalRepro}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Gráficos lado a lado */}
                                        <div style={{ flex: '1 1 45%', minWidth: '340px', display: 'flex', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

                                            {/* Gráfico 1: Operações por Unidade */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                                <h4 style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <PieChartIcon size={12} /> Operações / Unidade
                                                </h4>
                                                {dadosGrafico1.length === 0 ? (
                                                    <span style={{ fontSize: '11px', color: '#475569' }}>Sem dados</span>
                                                ) : (
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <PieChart>
                                                            <Pie
                                                                data={dadosGrafico1}
                                                                cx="50%" cy="50%"
                                                                innerRadius={40} outerRadius={65}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                <Cell fill="#38bdf8" />
                                                                <Cell fill="#fbbf24" />
                                                            </Pie>
                                                            <Tooltip
                                                                contentStyle={tooltipStyle}
                                                                itemStyle={{ color: '#f1f5f9' }}
                                                                formatter={(value, name) => {
                                                                    const total = dadosGrafico1.reduce((a, i) => a + i.value, 0);
                                                                    const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                                                    return [`${value} (${pct}%)`, name];
                                                                }}
                                                            />
                                                            <Legend
                                                                iconType="circle" iconSize={8}
                                                                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                                                                formatter={(value, entry) => (
                                                                    <span style={{ color: entry.color, fontWeight: '700' }}>
                                                                        {value}: {entry.payload.value}
                                                                    </span>
                                                                )}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </div>

                                            {/* Gráfico 2: Reprogramados por Unidade */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 8px' }}>
                                                <h4 style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <PieChartIcon size={12} color="#f43f5e" /> Reprogramados / Unidade
                                                </h4>
                                                {dadosGrafico2.length === 0 ? (
                                                    <span style={{ fontSize: '11px', color: '#475569' }}>Sem reprogramações</span>
                                                ) : (
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <PieChart>
                                                            <Pie
                                                                data={dadosGrafico2}
                                                                cx="50%" cy="50%"
                                                                innerRadius={40} outerRadius={65}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                <Cell fill="#ef4444" />
                                                                <Cell fill="#f97316" />
                                                            </Pie>
                                                            <Tooltip
                                                                contentStyle={tooltipStyle}
                                                                itemStyle={{ color: '#f1f5f9' }}
                                                                formatter={(value, name) => {
                                                                    const total = dadosGrafico2.reduce((a, i) => a + i.value, 0);
                                                                    const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                                                    return [`${value} (${pct}%)`, name];
                                                                }}
                                                            />
                                                            <Legend
                                                                iconType="circle" iconSize={8}
                                                                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                                                                formatter={(value, entry) => (
                                                                    <span style={{ color: entry.color, fontWeight: '700' }}>
                                                                        {value}: {entry.payload.value}
                                                                    </span>
                                                                )}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
