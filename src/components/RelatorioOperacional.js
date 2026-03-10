import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, CartesianGrid
} from 'recharts';
import { Filter, Calendar, MapPin, Truck, ChevronDown, ChevronRight, Clock, BarChart3, FileDown, RefreshCw } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ── Mesma lógica de classificação do DashboardTV ─────────────────────────────

const classificarOperacao = (op) => {
    if (!op) return null;
    if (op === 'DELTA(RECIFE)') return 'delta';
    if (op === 'DELTA(RECIFE X MORENO)') return 'deltaRxM';
    if (op === 'PORCELANA') return 'porcelana';
    if (op === 'ELETRIK') return 'eletrik';
    if (op.includes('/')) return 'consolidado';
    return null;
};

const ehOperacaoRecife = (op) => op && op.includes('RECIFE');
const ehOperacaoMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));

const TIPOS_OP = [
    { id: 'delta', label: 'Delta', cor: '#2563eb' },
    { id: 'consolidado', label: 'Consolidado', cor: '#3b82f6' },
    { id: 'deltaRxM', label: 'Delta R×M', cor: '#60a5fa' },
    { id: 'porcelana', label: 'Porcelana', cor: '#93c5fd' },
    { id: 'eletrik', label: 'Eletrik', cor: '#bfdbfe' },
];

// ── Utilitários de tempo ─────────────────────────────────────────────────────

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

// ── Estilos compartilhados ────────────────────────────────────────────────────

const s = {
    input: {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none'
    },
    label: {
        fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '5px', display: 'block'
    },
    card: {
        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px', padding: '16px 20px'
    },
    th: {
        padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)',
        color: '#64748b', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '0.5px', background: 'rgba(0,0,0,0.3)'
    },
    tdMain: {
        padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        color: '#f1f5f9', fontWeight: '700', verticalAlign: 'middle'
    },
    tdSub: {
        padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
        color: '#cbd5e1', fontSize: '12px', verticalAlign: 'middle'
    },
    badgeRec: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700',
        color: '#60a5fa', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '4px', padding: '1px 6px'
    },
    badgeMor: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700',
        color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '4px', padding: '1px 6px'
    },
};

// ── Construção de linhas planas a partir de listaVeiculos ────────────────────

function construirLinhas(listaVeiculos) {
    const linhas = [];
    for (const v of listaVeiculos) {
        const motorista = v.motorista || 'A DEFINIR';
        const tipoOp = classificarOperacao(v.operacao);

        const adicionarLinha = (origem, tempos, coleta, status) => {
            if (!tempos || !tempos.t_inicio_separacao) return;
            const { t_inicio_separacao, fim_separacao, t_inicio_carregamento, fim_carregamento, t_inicio_carregado, t_fim_liberado_cte } = tempos;

            // Calcular minutos em pausa para esta unidade
            const unidadeLower = origem.toLowerCase();
            const pausas = JSON.parse(v.pausas_status || '[]').filter(p => p.unidade === unidadeLower);
            const pausaMin = pausas.reduce((acc, p) => {
                if (!p.fim) return acc; // pausa ainda ativa — não conta no relatório
                const diffMs = new Date(p.fim).getTime() - new Date(p.inicio).getTime();
                return acc + Math.max(0, Math.floor(diffMs / 60000));
            }, 0);

            linhas.push({
                motorista,
                cardId: v.id,
                data: v.data_prevista || '',
                origem,
                tipoOp,
                operacao: v.operacao || '—',
                coleta: coleta || '—',
                status: status || 'AGUARDANDO',
                t_inicio_separacao, fim_separacao,
                t_inicio_carregamento, fim_carregamento,
                t_inicio_carregado, t_fim_liberado_cte,
                pausaMin
            });
        };

        if (v.tempos_recife) adicionarLinha('Recife', v.tempos_recife, v.coletaRecife || v.coleta, v.status_recife);
        if (v.tempos_moreno) adicionarLinha('Moreno', v.tempos_moreno, v.coletaMoreno || v.coleta, v.status_moreno);
    }
    return linhas;
}

// ── Agrupamento para a tabela ─────────────────────────────────────────────────

function agruparPorMotorista(linhas) {
    const mapa = new Map();
    for (const l of linhas) {
        if (!mapa.has(l.motorista)) mapa.set(l.motorista, []);
        mapa.get(l.motorista).push(l);
    }
    const resultado = [];
    for (const [motorista, cards] of mapa.entries()) {
        const totalMin = cards.reduce((acc, c) => {
            const d = diffMin(c.t_inicio_separacao, c.fim_carregamento);
            return d !== null ? acc + d : acc;
        }, 0);
        resultado.push({ motorista, cards, totalMin: totalMin > 0 ? totalMin : null });
    }
    resultado.sort((a, b) => a.motorista.localeCompare(b.motorista));
    return resultado;
}

// ── Tooltip customizado ───────────────────────────────────────────────────────

const TooltipCustom = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((acc, p) => acc + (p.value || 0), 0);
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#f1f5f9' }}>
            <div style={{ fontWeight: '700', marginBottom: '4px', color: '#94a3b8' }}>{label}</div>
            {payload.map((p, i) => {
                const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0.0';
                return (
                    <div key={i} style={{ color: p.color || '#f1f5f9' }}>{p.value} viagem{p.value !== 1 ? 's' : ''} ({pct}%)</div>
                );
            })}
        </div>
    );
};

const OPCOES_STATUS_OP = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO', 'CARREGADO', 'LIBERADO P/ CT-e'];
const CORES_STATUS_BAR = {
    'AGUARDANDO': '#64748b', 'EM SEPARAÇÃO': '#eab308', 'LIBERADO P/ DOCA': '#3b82f6',
    'EM CARREGAMENTO': '#f97316', 'CARREGADO': '#22c55e', 'LIBERADO P/ CT-e': '#a855f7',
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function RelatorioOperacional() {
    const hoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [filtroUnidade, setFiltroUnidade] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
    const [expandidos, setExpandidos] = useState(new Set());
    const [veiculosBanco, setVeiculosBanco] = useState([]);
    const [carregando, setCarregando] = useState(false);

    const buscarDados = useCallback(async (de, ate) => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/veiculos?de=${de}&ate=${ate}`);
            if (res.data.success) setVeiculosBanco(res.data.veiculos);
        } catch (e) {
            console.error('Erro ao buscar dados do relatório:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        buscarDados(dataInicio, dataFim);
    }, [dataInicio, dataFim, buscarDados]);

    // Linhas brutas — uma por card com tempos registrados
    const todasLinhas = useMemo(() => construirLinhas(veiculosBanco), [veiculosBanco]);

    // ── Dados filtrados por unidade/tipo (data já filtrada pelo backend) ────────
    const dadosFiltrados = useMemo(() => {
        return todasLinhas.filter(l => {
            if (filtroUnidade === 'Recife' && l.origem !== 'Recife') return false;
            if (filtroUnidade === 'Moreno' && l.origem !== 'Moreno') return false;
            if (filtroTipo !== 'Todas' && l.tipoOp !== filtroTipo) return false;
            return true;
        });
    }, [todasLinhas, filtroUnidade, filtroTipo]);

    // ── Contadores por tipo de operação ──────────────────────────────────────
    const contTipos = useMemo(() => {
        const veicsFiltrados = veiculosBanco.filter(v => {
            if (filtroUnidade === 'Recife' && !ehOperacaoRecife(v.operacao)) return false;
            if (filtroUnidade === 'Moreno' && !ehOperacaoMoreno(v.operacao)) return false;
            if (filtroTipo !== 'Todas' && classificarOperacao(v.operacao) !== filtroTipo) return false;
            return true;
        });
        const cnt = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
        veicsFiltrados.forEach(v => {
            const cat = classificarOperacao(v.operacao);
            if (cat && cnt[cat] !== undefined) cnt[cat]++;
        });
        const totalRecife = veicsFiltrados.filter(v => ehOperacaoRecife(v.operacao)).length;
        const totalMoreno = veicsFiltrados.filter(v => ehOperacaoMoreno(v.operacao)).length;
        return { ...cnt, totalRecife, totalMoreno, total: veicsFiltrados.length };
    }, [veiculosBanco, filtroUnidade, filtroTipo]);

    // ── Gráfico de barras: volume por status (das linhas com tempo) ───────────
    const dadosBarras = useMemo(() => {
        return OPCOES_STATUS_OP.map(st => ({
            status: st.replace('LIBERADO P/ DOCA', 'LIB. DOCA').replace('LIBERADO P/ CT-e', 'LIB. CT-e')
                .replace('EM SEPARAÇÃO', 'SEPARAÇÃO').replace('EM CARREGAMENTO', 'CARREGANDO'),
            statusReal: st,
            total: dadosFiltrados.filter(l => l.status === st).length,
        })).filter(d => d.total > 0);
    }, [dadosFiltrados]);

    // ── Gráfico de pizza: proporção por tipo de operação (= dashboard) ────────
    const dadosPizza = useMemo(() => {
        return TIPOS_OP
            .map(t => ({ name: t.label, value: contTipos[t.id] || 0, fill: t.cor }))
            .filter(d => d.value > 0);
    }, [contTipos]);

    // ── Tabela agrupada ──────────────────────────────────────────────────────
    const grupos = useMemo(() => agruparPorMotorista(dadosFiltrados), [dadosFiltrados]);

    function toggleExpandir(motorista) {
        setExpandidos(prev => {
            const novo = new Set(prev);
            if (novo.has(motorista)) novo.delete(motorista); else novo.add(motorista);
            return novo;
        });
    }

    // ── Exportação ───────────────────────────────────────────────────────────
    function linhasParaExportar() {
        const rows = [];
        for (const { motorista, cards } of grupos) {
            for (const c of cards) {
                const duracao = diffMin(c.t_inicio_separacao, c.fim_carregamento);
                const efetivo = duracao !== null ? Math.max(0, duracao - (c.pausaMin || 0)) : null;
                rows.push([
                    motorista, c.origem, c.coleta, c.data, c.operacao, c.status,
                    c.t_inicio_separacao || '—', c.fim_separacao || '—',
                    c.t_inicio_carregamento || '—', c.fim_carregamento || '—',
                    c.t_inicio_carregado || '—', c.t_fim_liberado_cte || '—',
                    formatMin(duracao),
                    formatMin(efetivo),
                ]);
            }
        }
        return rows;
    }

    const CABECALHO_EXPORT = ['Motorista', 'Origem', 'Coleta', 'Data', 'Operação', 'Status', 'Início Sep.', 'Fim Sep.', 'Início Car.', 'Fim Car.', 'Carregado', 'Lib. CT-e', 'Duração', 'Efetivo'];

    function exportarPDF() {
        if (dadosFiltrados.length === 0) return;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });

        // ── Cabeçalho colorido ──
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 297, 22, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(56, 189, 248);
        doc.text('RELATÓRIO OPERACIONAL', 14, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Período: ${dataInicio} → ${dataFim}  |  Unidade: ${filtroUnidade}  |  Tipo: ${filtroTipo}  |  ${contTipos.total} embarques  |  Gerado: ${geradoEm}`, 14, 17);

        // ── Tabela ── (fundo branco, legível em qualquer leitor)
        autoTable(doc, {
            head: [CABECALHO_EXPORT],
            body: linhasParaExportar(),
            startY: 26,
            styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
            headStyles: { fillColor: [15, 23, 42], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 7.5 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            bodyStyles: { fillColor: [255, 255, 255] },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                // Colorir coluna Status
                if (data.column.index === 5) {
                    const v = data.cell.raw;
                    if (v === 'LIBERADO P/ CT-e') data.cell.styles.textColor = [168, 85, 247];
                    else if (v === 'CARREGADO') data.cell.styles.textColor = [34, 197, 94];
                    else if (v === 'EM CARREGAMENTO') data.cell.styles.textColor = [249, 115, 22];
                    else if (v === 'LIBERADO P/ DOCA') data.cell.styles.textColor = [59, 130, 246];
                    else if (v === 'EM SEPARAÇÃO') data.cell.styles.textColor = [202, 138, 4];
                }
                // Colorir coluna Duração e Efetivo
                if (data.column.index === 12 && data.cell.raw !== '—') {
                    data.cell.styles.textColor = [34, 197, 94];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (data.column.index === 13 && data.cell.raw !== '—') {
                    data.cell.styles.textColor = [251, 191, 36];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });

        // ── Rodapé paginado ──
        const totalPags = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPags; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Transnet Logística — Relatório Operacional — ${dataInicio} a ${dataFim}`, 14, 207);
            doc.text(`Pág. ${i}/${totalPags}`, 283, 207, { align: 'right' });
        }

        const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-operacional-${dataInicio}-${dataFim}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportarXLSX() {
        if (dadosFiltrados.length === 0) return;
        const linhas = linhasParaExportar();
        const ws = XLSX.utils.aoa_to_sheet([CABECALHO_EXPORT, ...linhas]);
        ws['!cols'] = [22, 10, 18, 12, 28, 22, 12, 10, 12, 10, 12, 12, 10, 10].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        // Usar write + Blob para compatibilidade garantida com browsers
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-operacional-${dataInicio}-${dataFim}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div style={{ padding: '10px 0' }}>

            {/* ── Título + botões de exportação ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <BarChart3 size={22} color="#38bdf8" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Relatório Operacional</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Tempos & Desempenho</span>
                {carregando && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button onClick={exportarXLSX} disabled={dadosFiltrados.length === 0} title="Exportar XLSX"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: dadosFiltrados.length === 0 ? '#475569' : '#4ade80', cursor: dadosFiltrados.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        <FileDown size={14} /> XLSX
                    </button>
                    <button onClick={exportarPDF} disabled={dadosFiltrados.length === 0} title="Exportar PDF"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: dadosFiltrados.length === 0 ? '#475569' : '#f87171', cursor: dadosFiltrados.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        <FileDown size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* ── Barra de Filtros ── */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Filter size={16} color="#64748b" style={{ marginBottom: '8px' }} />
                <div>
                    <label style={s.label}><Calendar size={11} style={{ display: 'inline', marginRight: '4px' }} />De</label>
                    <input type="date" style={s.input} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                    <label style={s.label}><Calendar size={11} style={{ display: 'inline', marginRight: '4px' }} />Até</label>
                    <input type="date" style={s.input} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <div>
                    <label style={s.label}><MapPin size={11} style={{ display: 'inline', marginRight: '4px' }} />Unidade</label>
                    <select style={s.input} value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}>
                        <option>Todas</option>
                        <option>Recife</option>
                        <option>Moreno</option>
                    </select>
                </div>
                <div>
                    <label style={s.label}>Tipo de Operação</label>
                    <select style={s.input} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                        <option value="Todas">Todas</option>
                        {TIPOS_OP.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', alignSelf: 'flex-end', paddingBottom: '8px', marginLeft: 'auto' }}>
                    {contTipos.total} embarques · {grupos.length} motorista(s)
                </div>
            </div>

            {/* ── Cards: Total Geral + 5 tipos (= dashboard) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {/* Total grande */}
                <div style={{ ...s.card, borderLeft: '4px solid #38bdf8', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total de Embarques</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                        <span style={{ fontSize: '48px', fontWeight: '900', color: '#38bdf8', lineHeight: 1 }}>{contTipos.total}</span>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            <div><span style={{ color: '#60a5fa', fontWeight: '700' }}>{contTipos.totalRecife}</span> Recife</div>
                            <div><span style={{ color: '#93c5fd', fontWeight: '700' }}>{contTipos.totalMoreno}</span> Moreno</div>
                        </div>
                    </div>
                </div>
                {/* KPIs por tipo */}
                {TIPOS_OP.map(tipo => (
                    <div key={tipo.id} style={{ ...s.card, borderTop: `3px solid ${tipo.cor}`, textAlign: 'center', padding: '14px 10px', cursor: 'pointer', outline: filtroTipo === tipo.id ? `2px solid ${tipo.cor}` : 'none' }}
                        onClick={() => setFiltroTipo(prev => prev === tipo.id ? 'Todas' : tipo.id)}
                        title={`Filtrar por ${tipo.label}`}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: tipo.cor, lineHeight: 1 }}>{contTipos[tipo.id] || 0}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tipo.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Gráficos ── */}
            {contTipos.total > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Barras por status */}
                    <div style={s.card}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px' }}>Volume por Status</div>
                        {dadosBarras.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={dadosBarras} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                                    <XAxis dataKey="status" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<TooltipCustom />} />
                                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                        {dadosBarras.map((entry, idx) => (
                                            <Cell key={idx} fill={CORES_STATUS_BAR[entry.statusReal] || '#64748b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: '13px' }}>Sem dados</div>
                        )}
                    </div>

                    {/* Pizza por tipo de operação (igual ao dashboard) */}
                    <div style={s.card}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px' }}>Distribuição por Operação</div>
                        {dadosPizza.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={dadosPizza}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={75}
                                        innerRadius={38}
                                        paddingAngle={3}
                                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                                        labelLine={false}
                                    >
                                        {dadosPizza.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val, name, props) => {
                                        const pct = props.payload?.percent ? (props.payload.percent * 100).toFixed(1) : '0.0';
                                        return [`${val} embarque(s) (${pct}%)`, name];
                                    }} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: '13px' }}>Sem dados</div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tabela expandível ── */}
            {grupos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '14px' }}>
                    <Clock size={32} color="#334155" style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                    Nenhuma operação com tempo registrado para os filtros selecionados.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', ...s.card, padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={s.th} colSpan={2}>Motorista</th>
                                <th style={s.th}>Origem</th>
                                <th style={s.th}>Coleta</th>
                                <th style={s.th}>Início Sep.</th>
                                <th style={s.th}>Fim Sep.</th>
                                <th style={s.th}>Início Car.</th>
                                <th style={s.th}>Fim Car.</th>
                                <th style={s.th}>Carregado</th>
                                <th style={s.th}>Lib. CT-e</th>
                                <th style={s.th}>Duração</th>
                                <th style={{ ...s.th, color: '#fbbf24' }}>Efetivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupos.map(({ motorista, cards, totalMin }) => {
                                const aberto = expandidos.has(motorista);
                                return (
                                    <React.Fragment key={motorista}>
                                        <tr
                                            onClick={() => toggleExpandir(motorista)}
                                            style={{ cursor: 'pointer', background: 'rgba(15,23,42,0.6)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.6)'}
                                        >
                                            <td style={{ ...s.tdMain, width: '24px', paddingRight: '4px' }}>
                                                {aberto ? <ChevronDown size={14} color="#60a5fa" /> : <ChevronRight size={14} color="#64748b" />}
                                            </td>
                                            <td style={s.tdMain}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Truck size={13} color="#60a5fa" />
                                                    {motorista}
                                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                                                        ({cards.length} card{cards.length !== 1 ? 's' : ''})
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={s.tdMain} colSpan={8}></td>
                                            <td style={{ ...s.tdMain, color: totalMin ? '#4ade80' : '#475569', fontWeight: '700' }}>
                                                {formatMin(totalMin)}
                                            </td>
                                            <td style={{ ...s.tdMain, color: '#fbbf24', fontWeight: '700' }}>
                                                {formatMin(cards.reduce((acc, c) => {
                                                    const d = diffMin(c.t_inicio_separacao, c.fim_carregamento);
                                                    if (d === null) return acc;
                                                    return acc + Math.max(0, d - (c.pausaMin || 0));
                                                }, 0) || null)}
                                            </td>
                                        </tr>
                                        {aberto && cards.map((c, idx) => {
                                            const duracao = diffMin(c.t_inicio_separacao, c.fim_carregamento);
                                            const efetivo = duracao !== null ? Math.max(0, duracao - (c.pausaMin || 0)) : null;
                                            return (
                                                <tr key={`${c.cardId}-${c.origem}-${idx}`} style={{ background: 'rgba(0,0,0,0.15)' }}>
                                                    <td style={s.tdSub}></td>
                                                    <td style={{ ...s.tdSub, paddingLeft: '24px', color: '#94a3b8', fontSize: '11px' }}>#{c.cardId}</td>
                                                    <td style={s.tdSub}>
                                                        <span style={c.origem === 'Recife' ? s.badgeRec : s.badgeMor}>{c.origem}</span>
                                                    </td>
                                                    <td style={{ ...s.tdSub, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.coleta}</td>
                                                    <td style={{ ...s.tdSub, color: '#fbbf24' }}>{c.t_inicio_separacao || '—'}</td>
                                                    <td style={s.tdSub}>{c.fim_separacao || '—'}</td>
                                                    <td style={{ ...s.tdSub, color: '#f97316' }}>{c.t_inicio_carregamento || '—'}</td>
                                                    <td style={s.tdSub}>{c.fim_carregamento || '—'}</td>
                                                    <td style={{ ...s.tdSub, color: '#4ade80' }}>{c.t_inicio_carregado || '—'}</td>
                                                    <td style={{ ...s.tdSub, color: '#a78bfa' }}>{c.t_fim_liberado_cte || '—'}</td>
                                                    <td style={{ ...s.tdSub, fontWeight: '700', color: duracao !== null ? '#4ade80' : '#475569' }}>{formatMin(duracao)}</td>
                                                    <td style={{ ...s.tdSub, fontWeight: '700', color: efetivo !== null ? (c.pausaMin > 0 ? '#fbbf24' : '#4ade80') : '#475569' }}>
                                                        {formatMin(efetivo)}
                                                        {c.pausaMin > 0 && <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>(-{formatMin(c.pausaMin)})</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
