import React, { useState, useEffect } from 'react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';
import { Calendar, RefreshCw, BarChart, PieChart as PieChartIcon, FileDown, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { obterDataBrasilia } from '../utils/helpers';

const OPERACOES = ['Delta', 'Porcelana', 'Eletrik', 'Consolidados'];

const CORES_OPERACAO = {
    Delta: '#38bdf8',
    Consolidados: '#818cf8',
    Eletrik: '#fbbf24',
    Porcelana: '#a78bfa',
};

const isNovoFormato = (dados) =>
    Object.values(dados).some(d => d.reprogramado_recife !== undefined);

// Gera um gráfico de rosca em canvas e retorna dataURL para inserir no PDF
function gerarGraficoRosca(itens, titulo) {
    const W = 500, H = 480;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(titulo.toUpperCase(), W / 2, 24);

    const total = itens.reduce((s, d) => s + d.value, 0);
    const itensFiltrados = itens.filter(it => it.value > 0);
    const cx = W / 2, cy = 215;
    const outerR = 155, innerR = 88;

    if (total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sem dados', cx, cy);
    } else {
        let startAngle = -Math.PI / 2;
        itensFiltrados.forEach(it => {
            const angle = (it.value / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
            ctx.closePath();
            ctx.fillStyle = it.cor;
            ctx.fill();
            startAngle += angle;
        });
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 42px Arial';
        ctx.fillText(String(total), cx, cy - 10);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('total', cx, cy + 24);
    }

    ctx.textBaseline = 'alphabetic';
    const doisCols = itens.length > 2;
    const legendY = cy + outerR + 28;
    itens.forEach((it, idx) => {
        const col = doisCols ? idx % 2 : idx;
        const row = doisCols ? Math.floor(idx / 2) : 0;
        const lx = doisCols
            ? (col === 0 ? 30 : W / 2 + 10)
            : (idx === 0 ? 80 : W / 2 + 20);
        const ly = legendY + row * 26;
        const pct = total > 0 ? ((it.value / total) * 100).toFixed(0) : '0';
        ctx.beginPath();
        ctx.arc(lx + 7, ly - 4, 6, 0, 2 * Math.PI);
        ctx.fillStyle = it.cor;
        ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${it.label}: ${it.value} (${pct}%)`, lx + 18, ly);
    });

    return canvas.toDataURL('image/png');
}


export default function PainelProgramacao() {
    const { user } = useAuthStore();
    const podeGerar = ['Coordenador', 'Planejamento', 'Conhecimento'].includes(user?.cargo);
    const [programacoes, setProgramacoes] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [gerando, setGerando] = useState(null); // 'Inicial' | 'Final' | null

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

    const gerarProgramacao = async (turno) => {
        setGerando(turno);
        try {
            await api.post('/api/programacao-diaria/gerar', { turno });
            await carregarDados();
        } catch (e) {
            console.error('Erro ao gerar programação:', e);
            alert('Erro ao gerar programação. Verifique o console.');
        } finally {
            setGerando(null);
        }
    };

    const formatData = (dStr) => {
        if (!dStr) return '';
        const [a, m, d] = dStr.split('-');
        return `${d}/${m}/${a}`;
    };

    const handleExportPDF = async () => {
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const agora = new Date();
            const geradoEm = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            const periodoLabel = dataInicio === dataFim
                ? formatData(dataInicio)
                : `${formatData(dataInicio)} a ${formatData(dataFim)}`;

            // Buscar veículos do período
            const resVeiculos = await api.get(`/api/relatorio/veiculos?de=${dataInicio}&ate=${dataFim}`);
            const veiculosHoje = resVeiculos.data.veiculos || [];

            // Desenha cabeçalho padrão no topo da página atual, retorna Y após cabeçalho
            const drawCabecalho = () => {
                doc.setFontSize(15);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(15, 23, 42);
                doc.text('PROGRAMAÇÃO DIÁRIA DE EMBARQUES', 15, 16);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(`Data: ${periodoLabel}   |   Gerado em: ${geradoEm}`, 15, 22);
                doc.setDrawColor(30, 41, 59);
                doc.setLineWidth(0.4);
                doc.line(15, 25, 195, 25);
                return 30;
            };

            // Calcula totais de um prog para uso nos gráficos
            const calcTotais = (dados) => {
                let totProg = 0, totRepro = 0;
                const novoFmt = isNovoFormato(dados);
                OPERACOES.forEach(op => {
                    const d = dados[op] || {};
                    totProg += (d.recife || 0) + (d.moreno || 0);
                    totRepro += novoFmt
                        ? (d.reprogramado_recife || 0) + (d.reprogramado_moreno || 0)
                        : (d.reprogramado || 0);
                });
                return { totProg, totRepro, novoFmt };
            };

            let pagina = 0;

            // ── Página 1: Programação Inicial ──────────────────────────────────
            const progInicial = programacoesFiltradas.find(p => p.turno === 'Inicial');
            if (progInicial) {
                if (pagina > 0) doc.addPage();
                pagina++;
                let y = drawCabecalho();

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('PROGRAMAÇÃO INICIAL', 15, y + 7);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(formatData(progInicial.data_referencia), 195, y + 7, { align: 'right' });
                y += 13;

                const dados = progInicial.dados_json || {};
                const novoFmt = isNovoFormato(dados);
                const { totProg, totRepro } = calcTotais(dados);

                const bodyTabela = OPERACOES.map(op => {
                    const d = dados[op] || {};
                    const prog = (d.recife || 0) + (d.moreno || 0);
                    const repro = novoFmt
                        ? (d.reprogramado_recife || 0) + (d.reprogramado_moreno || 0)
                        : (d.reprogramado || 0);
                    return [op, prog, repro || '—'];
                });
                bodyTabela.push(['TOTAL GERAL', totProg, totRepro || '—']);

                autoTable(doc, {
                    startY: y,
                    head: [['OPERAÇÃO', 'PROGRAMADOS', 'REPROGRAMADOS']],
                    body: bodyTabela,
                    margin: { left: 15, right: 15 },
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252], fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9.5, textColor: [30, 41, 59] },
                    columnStyles: {
                        0: { cellWidth: 80 },
                        1: { cellWidth: 50, halign: 'center' },
                        2: { cellWidth: 50, halign: 'center' },
                    },
                    didParseCell: (data) => {
                        if (data.row.index === bodyTabela.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [241, 245, 249];
                        }
                    },
                });

                y = doc.lastAutoTable.finalY + 10;

                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139);
                doc.text('RESUMO DE EMBARQUES', 15, y + 4);
                y += 10;

                // Gráfico 1: Por Operação
                const itensPorOp = OPERACOES.map(op => {
                    const d = dados[op] || {};
                    return { label: op, value: (d.recife || 0) + (d.moreno || 0), cor: CORES_OPERACAO[op] };
                });
                const imgOp = gerarGraficoRosca(itensPorOp, 'Por Operação');
                doc.addImage(imgOp, 'PNG', 15, y, 82, 78);

                // Gráfico 2: Prog vs Reprog (somente se houver reprogramados)
                if (totRepro > 0) {
                    const itensRepro = [
                        { label: 'Programados', value: totProg, cor: '#3b82f6' },
                        { label: 'Reprogramados', value: totRepro, cor: '#dc2626' },
                    ];
                    const imgRepro = gerarGraficoRosca(itensRepro, 'Prog. vs Reprog.');
                    doc.addImage(imgRepro, 'PNG', 112, y, 82, 78);
                }
            }

            // ── Página 2: Programação Final ────────────────────────────────────
            const progFinal = programacoesFiltradas.find(p => p.turno === 'Final');
            if (progFinal) {
                if (pagina > 0) doc.addPage();
                pagina++;
                let y = drawCabecalho();

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(251, 146, 60);
                doc.text('PROGRAMAÇÃO FINAL', 15, y + 7);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(formatData(progFinal.data_referencia), 195, y + 7, { align: 'right' });
                y += 13;

                const dados = progFinal.dados_json || {};
                const { totProg } = calcTotais(dados);

                const bodyFinal = OPERACOES.map(op => {
                    const d = dados[op] || {};
                    return [op, (d.recife || 0) + (d.moreno || 0)];
                });
                bodyFinal.push(['TOTAL GERAL', totProg]);

                autoTable(doc, {
                    startY: y,
                    head: [['OPERAÇÃO', 'PROGRAMADOS']],
                    body: bodyFinal,
                    margin: { left: 15, right: 15 },
                    theme: 'grid',
                    headStyles: { fillColor: [251, 146, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9.5, textColor: [30, 41, 59] },
                    columnStyles: {
                        0: { cellWidth: 110 },
                        1: { cellWidth: 70, halign: 'center' },
                    },
                    didParseCell: (data) => {
                        if (data.row.index === bodyFinal.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [241, 245, 249];
                        }
                    },
                });

                y = doc.lastAutoTable.finalY + 15;

                const itensFinal = OPERACOES.map(op => {
                    const d = dados[op] || {};
                    return { label: op, value: (d.recife || 0) + (d.moreno || 0), cor: CORES_OPERACAO[op] };
                });
                const imgFinal = gerarGraficoRosca(itensFinal, 'Por Operação');
                // Centralizar: (210 - 15_esq - 15_dir - 82) / 2 + 15 = 64
                doc.addImage(imgFinal, 'PNG', 64, y, 82, 78);
            }

            // ── Página 3: Lista de Veículos ────────────────────────────────────
            if (pagina > 0) doc.addPage();
            pagina++;
            let y3 = drawCabecalho();

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('LISTA DE VEÍCULOS', 15, y3 + 7);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`${veiculosHoje.length} veículo(s)`, 195, y3 + 7, { align: 'right' });
            y3 += 13;

            const bodyVeiculos = veiculosHoje.map(v => {
                let dj = {};
                try { dj = JSON.parse(v.dados_json || '{}'); } catch {}
                const data = v.data_criacao ? v.data_criacao.substring(0, 10).split('-').reverse().join('/') : '';
                const coleta = v.coletaRecife || v.coletaMoreno || v.coleta || v.numero_coleta || '';
                const destino = [dj.destino_cidade_cad, dj.destino_uf_cad].filter(Boolean).join('/');
                const placas = [dj.placa1Motorista, dj.placa2Motorista].filter(Boolean).join(' / ');
                return [
                    data,
                    coleta,
                    dj.origem_cad || '',
                    destino,
                    v.motorista || '',
                    placas,
                    v.operacao || '',
                    v.rota_recife || v.rota_moreno || '',
                    v.observacao || '',
                ];
            });

            autoTable(doc, {
                startY: y3,
                head: [['Data Solic.', 'Nº Coleta', 'Origem', 'Destino', 'Motorista', 'Placas', 'Operação', 'Rota', 'Agendamento']],
                body: bodyVeiculos,
                margin: { left: 15, right: 15 },
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [248, 250, 252], fontStyle: 'bold', fontSize: 7 },
                bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
                styles: { overflow: 'linebreak', cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 22 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 32 },
                    5: { cellWidth: 22 },
                    6: { cellWidth: 15 },
                    7: { cellWidth: 15 },
                    8: { cellWidth: 16 },
                },
            });

            doc.save(`Programacao_Diaria_${dataInicio}.pdf`);
        } catch (e) {
            console.error('Erro ao exportar PDF:', e);
            alert('Erro ao gerar PDF. Verifique o console.');
        }
    };

    const programacoesFiltradas = programacoes.filter(prog => {
        if (dataInicio && dataFim && prog.data_referencia) {
            if (prog.data_referencia < dataInicio || prog.data_referencia > dataFim) return false;
        }
        return true;
    });

    return (
        <div style={{ padding: '20px 25px', height: 'calc(100vh - 124px)', overflowY: 'auto' }}>
            {/* Header */}
            <div className="glass-panel-internal" style={{ padding: '15px 25px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={18} />
                        PROGRAMAÇÃO DIÁRIA DE EMBARQUES <span style={{ color: '#fb923c' }}>/ HISTÓRICO</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                        Resumo consolidado diário dos veículos e origens, gerado manualmente pelos botões Gerar Inicial e Gerar Final.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {podeGerar && (
                        <>
                            <button
                                onClick={() => gerarProgramacao('Inicial')}
                                disabled={gerando === 'Inicial'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                                    color: '#60a5fa', borderRadius: '8px', padding: '8px 14px',
                                    cursor: gerando === 'Inicial' ? 'default' : 'pointer', fontSize: '12px',
                                    fontWeight: '700', transition: 'all 0.2s',
                                    opacity: gerando === 'Inicial' ? 0.6 : 1
                                }}
                            >
                                {gerando === 'Inicial' ? 'Gerando...' : 'Gerar Inicial'}
                            </button>
                            <button
                                onClick={() => gerarProgramacao('Final')}
                                disabled={gerando === 'Final'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)',
                                    color: '#fb923c', borderRadius: '8px', padding: '8px 14px',
                                    cursor: gerando === 'Final' ? 'default' : 'pointer', fontSize: '12px',
                                    fontWeight: '700', transition: 'all 0.2s',
                                    opacity: gerando === 'Final' ? 0.6 : 1
                                }}
                            >
                                {gerando === 'Final' ? 'Gerando...' : 'Gerar Final'}
                            </button>
                        </>
                    )}
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

                            let totalRecife = 0, totalMoreno = 0;
                            let totalReproRecife = 0, totalReproMoreno = 0;
                            let totalRepro = 0;

                            const novoFmt = isNovoFormato(dados);

                            // Calcular totais por unidade para os gráficos
                            OPERACOES.forEach(op => {
                                const d = dados[op] || { recife: 0, moreno: 0, reprogramado: 0 };
                                totalRecife += d.recife || 0;
                                totalMoreno += d.moreno || 0;
                                if (novoFmt) {
                                    totalReproRecife += d.reprogramado_recife || 0;
                                    totalReproMoreno += d.reprogramado_moreno || 0;
                                } else {
                                    totalRepro += d.reprogramado || 0;
                                }
                            });

                            const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' };

                            return (
                                <div key={prog.id} className="glass-panel-internal" style={{ borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
                                    {/* Header do turno */}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', fontSize: '15px' }}>
                                            <Calendar size={18} color="#60a5fa" />
                                            {formatData(prog.data_referencia)} — Programação {prog.turno}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                            Programação {prog.turno}
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
                                                        <th style={{ padding: '12px 20px', color: '#94a3b8', fontWeight: 'bold', textAlign: 'center' }}>PROGRAMADOS</th>
                                                        <th style={{ padding: '12px 20px', color: '#f43f5e', fontWeight: 'bold', textAlign: 'center' }}>REPROGRAMADOS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {OPERACOES.map((op, i) => {
                                                        const d = dados[op] || { recife: 0, moreno: 0, reprogramado: 0 };
                                                        return (
                                                            <tr key={op} style={{ borderBottom: i === OPERACOES.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.02)' }}>
                                                                <td style={{ padding: '12px 20px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CORES_OPERACAO[op], flexShrink: 0, display: 'inline-block' }} />
                                                                        <span style={{ color: '#f1f5f9', fontWeight: '500' }}>{op}</span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#e2e8f0' }}>
                                                                    {(d.recife || 0) + (d.moreno || 0)}
                                                                </td>
                                                                {(() => {
                                                                    const totalRepro = novoFmt
                                                                        ? (d.reprogramado_recife || 0) + (d.reprogramado_moreno || 0)
                                                                        : (d.reprogramado || 0);
                                                                    return (
                                                                        <td style={{ padding: '12px 20px', textAlign: 'center', color: totalRepro > 0 ? '#fca5a5' : '#64748b' }}>
                                                                            {totalRepro || '—'}
                                                                        </td>
                                                                    );
                                                                })()}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <td style={{ padding: '12px 20px', fontWeight: 'bold', color: '#f8fafc' }}>TOTAL GERAL</td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>
                                                            {totalRecife + totalMoreno}
                                                        </td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#f43f5e' }}>
                                                            {novoFmt ? (totalReproRecife + totalReproMoreno) : totalRepro}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Gráfico único: Programados vs Reprogramados */}
                                        <div style={{ flex: '1 1 45%', minWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                            <h4 style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <PieChartIcon size={12} /> Programados vs Reprogramados
                                            </h4>
                                            {(() => {
                                                const totalProg = totalRecife + totalMoreno;
                                                const totalReprog = novoFmt ? (totalReproRecife + totalReproMoreno) : totalRepro;
                                                const dadosGraficoUnico = [
                                                    { name: 'Programados', value: totalProg },
                                                    { name: 'Reprogramados', value: totalReprog },
                                                ].filter(i => i.value > 0);
                                                if (dadosGraficoUnico.length === 0) {
                                                    return <span style={{ fontSize: '11px', color: '#475569' }}>Sem dados</span>;
                                                }
                                                return (
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <PieChart>
                                                            <Pie
                                                                data={dadosGraficoUnico}
                                                                cx="50%" cy="50%"
                                                                innerRadius={40} outerRadius={65}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                <Cell fill="#3b82f6" />
                                                                <Cell fill="#dc2626" />
                                                            </Pie>
                                                            <Tooltip
                                                                contentStyle={tooltipStyle}
                                                                itemStyle={{ color: '#f1f5f9' }}
                                                                formatter={(value, name) => {
                                                                    const total = dadosGraficoUnico.reduce((a, i) => a + i.value, 0);
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
                                                );
                                            })()}
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
