import React, { useState, useEffect } from 'react';
import api from '../services/apiService';
import { Calendar, RefreshCw, BarChart, PieChart as PieChartIcon, FileDown, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { obterDataBrasilia } from '../utils/helpers';

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
            if (res.data.success) {
                setProgramacoes(res.data.programacoes);
            }
        } catch (e) {
            console.error('Erro ao carregar programação:', e);
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // Formatar data localmente (YYYY-MM-DD -> DD/MM/YYYY)
    const formatData = (dStr) => {
        if (!dStr) return '';
        const [a, m, d] = dStr.split('-');
        return `${d}/${m}/${a}`;
    };

    // Gerador de PDF Profissional
    const handleExportPDF = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const elemento = document.getElementById('relatorio-programacao');
        if (!elemento) return;
        const opcoes = {
            margin: 10,
            filename: `Programacao_Diaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opcoes).from(elemento).save();
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
                            type="date"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                        />
                        <span style={{ color: '#64748b', fontSize: '11px' }}>até</span>
                        <input
                            type="date"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                        />
                    </div>
                </div>
            </div>

            {/* Conteudo exportavel para PDF */}
            <div id="relatorio-programacao" style={{ background: 'transparent', padding: '0' }}>

                {/* Listagem das Programações */}
                {programacoesFiltradas.length === 0 && !carregando ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                        <BarChart size={48} style={{ opacity: 0.3, marginBottom: '16px', margin: '0 auto' }} />
                        <p>Nenhuma programação encontrada neste período.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {programacoesFiltradas.map(prog => {
                            const dados = prog.dados_json || {};
                            const clientes = ['Delta', 'Porcelana', 'Eletrik', 'Consolidados'];

                            // Somatórios do turno
                            let totalRecife = 0;
                            let totalMoreno = 0;
                            let totalRepro = 0;

                            return (
                                <div key={prog.id} className="glass-panel-internal" style={{ borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
                                    {/* Header da Tabela (Turno e Data) */}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', fontSize: '15px' }}>
                                            <Calendar size={18} color="#60a5fa" />
                                            {formatData(prog.data_referencia)} — Turno {prog.turno}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                            Snapshot Automático
                                        </span>
                                    </div>

                                    {/* Corpo Dividido: Tabela e Gráfico */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', background: 'rgba(0,0,0,0.1)' }}>
                                        {/* Tabela */}
                                        <div style={{ flex: '1 1 60%', minWidth: '350px' }}>
                                            <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead>
                                                    <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <th style={{ padding: '12px 20px', color: '#94a3b8', fontWeight: 'bold' }}>CLIENTE</th>
                                                        <th style={{ padding: '12px 20px', color: '#38bdf8', fontWeight: 'bold', textAlign: 'center' }}>QTD RECIFE</th>
                                                        <th style={{ padding: '12px 20px', color: '#fbbf24', fontWeight: 'bold', textAlign: 'center' }}>QTD MORENO</th>
                                                        <th style={{ padding: '12px 20px', color: '#f43f5e', fontWeight: 'bold', textAlign: 'center' }}>REPROGRAMADOS (D-1)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clientes.map((c, i) => {
                                                        const d = dados[c] || { recife: 0, moreno: 0, reprogramado: 0 };
                                                        totalRecife += d.recife;
                                                        totalMoreno += d.moreno;
                                                        totalRepro += d.reprogramado;
                                                        return (
                                                            <tr key={c} style={{ borderBottom: i === clientes.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.02)' }}>
                                                                <td style={{ padding: '12px 20px', color: '#f1f5f9', fontWeight: '500' }}>{c}</td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#e2e8f0' }}>{d.recife}</td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#e2e8f0' }}>{d.moreno}</td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#fca5a5' }}>{d.reprogramado}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {/* Rodapé Totais */}
                                                <tfoot>
                                                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <td style={{ padding: '12px 20px', fontWeight: 'bold', color: '#f8fafc' }}>TOTAL GERAL</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#38bdf8' }}>{totalRecife}</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#fbbf24' }}>{totalMoreno}</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#f43f5e' }}>{totalRepro}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Gráfico de Pizza */}
                                        <div style={{ flex: '1 1 40%', minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '15px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                            <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <PieChartIcon size={14} /> DISTRIBUIÇÃO TOTAL (%)
                                            </h4>
                                            <div style={{ width: '100%', height: '220px' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={clientes.map(c => {
                                                                const d = dados[c] || { recife: 0, moreno: 0, reprogramado: 0 };
                                                                return { name: c, value: d.recife + d.moreno + d.reprogramado };
                                                            }).filter(i => i.value > 0)}
                                                            cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                                            dataKey="value"
                                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                            labelLine={false}
                                                            stroke="none"
                                                        >
                                                            {clientes.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={['#38bdf8', '#fbbf24', '#a78bfa', '#94a3b8'][index % 4]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} itemStyle={{ color: '#f1f5f9' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
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
