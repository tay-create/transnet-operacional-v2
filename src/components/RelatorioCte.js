import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell, Legend
} from 'recharts';
import {
    Filter, Calendar, FileText, Clock, FileDown, RefreshCw, MapPin,
    TrendingUp, Activity, AlertTriangle, X,
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const CORES_TURNO = { 'Manhã': '#f59e0b', 'Tarde': '#3b82f6', 'Noite': '#8b5cf6' };
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
};

const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
};

function KpiCard({ icon, label, valor, cor, onClick, ativo }) {
    const clicavel = typeof onClick === 'function';
    return (
        <div
            onClick={clicavel ? onClick : undefined}
            title={clicavel ? (ativo ? 'Clique para limpar filtro' : 'Clique para filtrar') : undefined}
            style={{
                ...glassCard,
                padding: '18px 16px',
                display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0,
                cursor: clicavel ? 'pointer' : 'default',
                border: ativo ? `1px solid ${cor}` : glassCard.border,
                boxShadow: ativo ? `0 0 0 2px ${cor}33` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: `${cor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cor, flexShrink: 0,
                }}>{icon}</div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                    {label}
                </span>
                {ativo && (
                    <span style={{
                        marginLeft: 'auto', fontSize: 9, padding: '2px 6px',
                        borderRadius: 6, background: `${cor}22`, color: cor, fontWeight: 700,
                    }}>FILTRADO</span>
                )}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {valor}
            </div>
        </div>
    );
}

function OciosidadeCard({ unidade, dados }) {
    const maxH = dados?.max_gap_horas;
    const gaps = dados?.gaps_acima_2h || 0;
    const cor = maxH > 4 ? '#f87171' : maxH > 2 ? '#facc15' : '#4ade80';
    const corUnidade = unidade === 'Recife' ? '#60a5fa' : '#a78bfa';

    return (
        <div style={{
            ...glassCard,
            padding: '16px 20px',
            borderLeft: `3px solid ${corUnidade}`,
            display: 'flex', gap: '16px', alignItems: 'center',
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: `${cor}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cor, flexShrink: 0,
            }}>
                <Activity size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: corUnidade, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {unidade}
                    </span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>· {dados?.total || 0} CT-es</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                        {formatHoras(maxH)}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>maior gap</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    {gaps} gap{gaps !== 1 ? 's' : ''} acima de 2h
                    {dados?.janela ? <span style={{ color: '#64748b', marginLeft: 6 }}>· {dados.janela}</span> : null}
                </div>
            </div>
        </div>
    );
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
    const [stats, setStats] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [exportandoPdf, setExportandoPdf] = useState(false);
    const [erro, setErro] = useState(null);
    const [aba, setAba] = useState('graficos');
    const [unidadeFiltro, setUnidadeFiltro] = useState(null); // 'Recife' | 'Moreno' | null

    const buscar = useCallback(async () => {
        setCarregando(true);
        setErro(null);
        try {
            const res = await api.get(`/api/relatorio/cte?de=${dataInicio}&ate=${dataFim}`);
            setRegistros(res.data.registros || []);
            setHeatmap(res.data.heatmap || []);
            setOciosidade(res.data.ociosidade || {});
            setStats(res.data.stats || null);
            setUnidadeFiltro(null);
        } catch (e) {
            console.error('Erro ao buscar relatório CT-e:', e);
            setErro(e?.response?.data?.message || e?.message || 'Falha ao carregar relatório.');
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    const registrosFiltrados = useMemo(() => {
        if (!unidadeFiltro) return registros;
        return registros.filter(r => r.origem === unidadeFiltro);
    }, [registros, unidadeFiltro]);

    const totaisPorUnidade = useMemo(() => {
        let recife = 0;
        let moreno = 0;
        for (const r of registros) {
            if (r.origem === 'Recife') recife++;
            else if (r.origem === 'Moreno') moreno++;
        }
        return { recife, moreno };
    }, [registros]);

    // Stats recalculados client-side quando há filtro de unidade.
    // Sem filtro, usa stats do servidor (cálculo idêntico).
    const statsFiltradas = useMemo(() => {
        if (!unidadeFiltro) {
            return { media: stats?.media ?? null, mediana: stats?.mediana ?? null };
        }
        const tempos = registrosFiltrados
            .map(r => r.horas_lancamento_cte)
            .filter(v => v !== null && v !== undefined && !Number.isNaN(v))
            .sort((a, b) => a - b);
        if (tempos.length === 0) return { media: null, mediana: null };
        const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
        const meio = tempos[Math.min(tempos.length - 1, Math.floor(0.5 * tempos.length))];
        return {
            media: parseFloat(media.toFixed(2)),
            mediana: parseFloat(meio.toFixed(2)),
        };
    }, [unidadeFiltro, registrosFiltrados, stats]);

    const resumo = useMemo(() => ({
        total: registrosFiltrados.length,
        media: statsFiltradas.media,
        mediana: statsFiltradas.mediana,
        recife: totaisPorUnidade.recife,
        moreno: totaisPorUnidade.moreno,
    }), [registrosFiltrados, statsFiltradas, totaisPorUnidade]);

    const dadosPorDia = useMemo(() => {
        const mapa = {};
        for (const r of registrosFiltrados) {
            if (!r.datetime_cte) continue;
            const dia = r.datetime_cte.substring(0, 10);
            if (!mapa[dia]) mapa[dia] = { Recife: 0, Moreno: 0 };
            if (r.origem === 'Recife') mapa[dia].Recife++;
            else if (r.origem === 'Moreno') mapa[dia].Moreno++;
        }
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, v]) => ({ data: data.substring(5).replace('-', '/'), ...v }));
    }, [registrosFiltrados]);

    const dadosPorTurno = useMemo(() => {
        const acc = { 'Manhã': { qtd: 0, soma: 0, com: 0 }, 'Tarde': { qtd: 0, soma: 0, com: 0 }, 'Noite': { qtd: 0, soma: 0, com: 0 } };
        for (const r of registrosFiltrados) {
            const t = r.turno;
            if (!acc[t]) continue;
            acc[t].qtd++;
            if (r.horas_lancamento_cte !== null && r.horas_lancamento_cte !== undefined) {
                acc[t].soma += r.horas_lancamento_cte;
                acc[t].com++;
            }
        }
        return TURNOS.map(t => ({
            turno: t,
            quantidade: acc[t].qtd,
            media_horas: acc[t].com > 0 ? parseFloat((acc[t].soma / acc[t].com).toFixed(1)) : 0,
        }));
    }, [registrosFiltrados]);

    // Heatmap: quando há filtro, recalcula client-side; sem filtro, usa o agregado do servidor.
    const heatmapFiltrado = useMemo(() => {
        if (!unidadeFiltro) return heatmap;
        const acc = {};
        for (const r of registrosFiltrados) {
            if (r.dow_recife == null || r.hora_recife == null) continue;
            const k = `${r.dow_recife}-${r.hora_recife}`;
            acc[k] = acc[k] || { dia_semana: r.dow_recife, hora: r.hora_recife, qtd: 0 };
            acc[k].qtd++;
        }
        return Object.values(acc);
    }, [unidadeFiltro, registrosFiltrados, heatmap]);

    const picoHeatmap = useMemo(() => {
        if (heatmapFiltrado.length === 0) return null;
        return heatmapFiltrado.reduce((m, c) => parseInt(c.qtd, 10) > parseInt(m.qtd, 10) ? c : m, heatmapFiltrado[0]);
    }, [heatmapFiltrado]);

    const heatmapMatrix = useMemo(() => {
        const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
        for (const cell of heatmapFiltrado) {
            const d = parseInt(cell.dia_semana, 10);
            const h = parseInt(cell.hora, 10);
            const q = parseInt(cell.qtd, 10);
            if (d >= 0 && d < 7 && h >= 0 && h < 24) matrix[d][h] = q;
        }
        return matrix;
    }, [heatmapFiltrado]);

    const heatmapMax = useMemo(() => Math.max(1, ...heatmapMatrix.flat()), [heatmapMatrix]);
    const horasVisiveis = Array.from({ length: 17 }, (_, i) => i + 6);

    // Ociosidade filtrada: quando há filtro, mostra só a unidade
    const ociosidadeFiltrada = useMemo(() => {
        if (!unidadeFiltro) return ociosidade;
        return { [unidadeFiltro]: ociosidade?.[unidadeFiltro] };
    }, [ociosidade, unidadeFiltro]);

    async function exportarPDF() {
        setExportandoPdf(true);
        setErro(null);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const W = 210;
            const margemX = 14;
            const larguraUtil = W - margemX * 2;
            let y = 14;

            // Cabeçalho
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(20, 30, 50);
            doc.text('Relatório CT-e', margemX, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            const periodo = `Período: ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`;
            const filtroTxt = unidadeFiltro ? ` · Unidade: ${unidadeFiltro}` : ' · Recife + Moreno';
            doc.text(periodo + filtroTxt, margemX, y);
            y += 2;
            doc.setDrawColor(220, 226, 232);
            doc.line(margemX, y, W - margemX, y);
            y += 6;

            // KPI grid (sem P90) — oculta a unidade que não está no filtro
            const kpis = [
                { label: 'Total emitidos', valor: String(resumo.total), cor: [250, 204, 21] },
                { label: 'Tempo médio', valor: formatHoras(resumo.media), cor: [96, 165, 250] },
                { label: 'Mediana', valor: formatHoras(resumo.mediana), cor: [34, 211, 238] },
                ...(unidadeFiltro !== 'Moreno' ? [{ label: 'Recife', valor: String(resumo.recife), cor: [96, 165, 250] }] : []),
                ...(unidadeFiltro !== 'Recife' ? [{ label: 'Moreno', valor: String(resumo.moreno), cor: [167, 139, 250] }] : []),
            ];
            const colKpi = 3;
            const wKpi = larguraUtil / colKpi;
            const hKpi = 18;
            kpis.forEach((k, i) => {
                const cx = margemX + (i % colKpi) * wKpi;
                const cy = y + Math.floor(i / colKpi) * (hKpi + 2);
                doc.setDrawColor(230, 232, 240);
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(cx + 1, cy, wKpi - 2, hKpi, 2, 2, 'FD');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text(k.label.toUpperCase(), cx + 4, cy + 5);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(k.cor[0], k.cor[1], k.cor[2]);
                doc.text(k.valor, cx + 4, cy + 14);
            });
            y += Math.ceil(kpis.length / colKpi) * (hKpi + 2) + 4;

            // Ociosidade
            const ociRecife = ociosidadeFiltrada?.Recife;
            const ociMoreno = ociosidadeFiltrada?.Moreno;
            if (ociRecife || ociMoreno) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text('Gargalos (horário comercial seg-sex 6h-22h)', margemX, y);
                y += 5;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105);
                const linhasOciosidade = [
                    ...(unidadeFiltro !== 'Moreno' && ociRecife ? [['Recife', ociRecife]] : []),
                    ...(unidadeFiltro !== 'Recife' && ociMoreno ? [['Moreno', ociMoreno]] : []),
                ];
                for (const [unidade, dados] of linhasOciosidade) {
                    const gap = dados.max_gap_horas !== null && dados.max_gap_horas !== undefined ? formatHoras(dados.max_gap_horas) : '—';
                    doc.text(`${unidade}: maior gap ${gap} · ${dados.gaps_acima_2h || 0} acima de 2h · ${dados.total || 0} CT-es`, margemX + 2, y);
                    y += 4;
                }
                y += 3;
            }

            // CT-es por dia
            if (dadosPorDia.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text('CT-es por dia', margemX, y);
                y += 4;
                const grafW = larguraUtil;
                const linhaH = 4;
                const mostraRecife = unidadeFiltro !== 'Moreno';
                const mostraMoreno = unidadeFiltro !== 'Recife';
                const maxDia = Math.max(1, ...dadosPorDia.map(d =>
                    (mostraRecife ? (d.Recife || 0) : 0) + (mostraMoreno ? (d.Moreno || 0) : 0)
                ));
                const labelW = 14;
                const barW = grafW - labelW;
                dadosPorDia.forEach((d, i) => {
                    const by = y + i * linhaH;
                    doc.setFontSize(6);
                    doc.setTextColor(100, 116, 139);
                    doc.text(d.data, margemX, by + 3);
                    const totRec = mostraRecife ? (d.Recife || 0) : 0;
                    const totMor = mostraMoreno ? (d.Moreno || 0) : 0;
                    const wRec = (totRec / maxDia) * barW;
                    const wMor = (totMor / maxDia) * barW;
                    if (mostraRecife) {
                        doc.setFillColor(59, 130, 246);
                        doc.rect(margemX + labelW, by, wRec, linhaH - 1, 'F');
                    }
                    if (mostraMoreno) {
                        doc.setFillColor(139, 92, 246);
                        doc.rect(margemX + labelW + wRec, by, wMor, linhaH - 1, 'F');
                    }
                });
                y += dadosPorDia.length * linhaH + 4;
                // Legenda — só quando ambas unidades estão visíveis
                if (mostraRecife && mostraMoreno) {
                    doc.setFontSize(7);
                    doc.setFillColor(59, 130, 246);
                    doc.rect(margemX, y, 3, 3, 'F');
                    doc.setTextColor(71, 85, 105);
                    doc.text('Recife', margemX + 5, y + 2.5);
                    doc.setFillColor(139, 92, 246);
                    doc.rect(margemX + 22, y, 3, 3, 'F');
                    doc.text('Moreno', margemX + 27, y + 2.5);
                    y += 7;
                }
            }

            // Por turno
            if (dadosPorTurno.some(t => t.quantidade > 0)) {
                if (y > 250) { doc.addPage(); y = 14; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text('Por turno', margemX, y);
                y += 5;
                const wCol = larguraUtil / 3;
                const coresTurno = { 'Manhã': [245, 158, 11], 'Tarde': [59, 130, 246], 'Noite': [139, 92, 246] };
                dadosPorTurno.forEach((t, i) => {
                    const cx = margemX + i * wCol;
                    const c = coresTurno[t.turno] || [100, 116, 139];
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(c[0], c[1], c[2]);
                    doc.roundedRect(cx + 1, y, wCol - 2, 18, 2, 2, 'FD');
                    doc.setFontSize(8);
                    doc.setTextColor(c[0], c[1], c[2]);
                    doc.setFont('helvetica', 'bold');
                    doc.text(t.turno.toUpperCase(), cx + 4, y + 5);
                    doc.setFontSize(13);
                    doc.setTextColor(30, 41, 59);
                    doc.text(String(t.quantidade), cx + 4, y + 12);
                });
                y += 22;
            }

            // Heatmap
            if (picoHeatmap) {
                if (y > 220) { doc.addPage(); y = 14; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text('Horários de pico', margemX, y);
                y += 5;
                const cellW = (larguraUtil - 8) / horasVisiveis.length;
                const cellH = 4.5;
                doc.setFontSize(6);
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'normal');
                horasVisiveis.forEach((h, i) => {
                    doc.text(`${h}h`, margemX + 8 + i * cellW + cellW / 2 - 1.5, y);
                });
                y += 1;
                DIAS_SEMANA.forEach((dia, d) => {
                    doc.setFontSize(6);
                    doc.setTextColor(100, 116, 139);
                    doc.text(dia, margemX, y + cellH - 1);
                    horasVisiveis.forEach((h, i) => {
                        const qtd = heatmapMatrix[d][h];
                        const opacity = qtd === 0 ? 0.05 : 0.2 + (qtd / heatmapMax) * 0.8;
                        const fr = Math.round(255 - (255 - 251) * opacity);
                        const fg = Math.round(255 - (255 - 191) * opacity);
                        const fb = Math.round(255 - (255 - 36) * opacity);
                        doc.setFillColor(fr, fg, fb);
                        doc.rect(margemX + 8 + i * cellW, y, cellW - 0.3, cellH - 0.3, 'F');
                        if (qtd > 0) {
                            doc.setFontSize(5);
                            doc.setTextColor(15, 23, 42);
                            doc.text(String(qtd), margemX + 8 + i * cellW + cellW / 2 - 1, y + cellH - 1.2);
                        }
                    });
                    y += cellH;
                });
                y += 4;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(180, 130, 12);
                doc.text(
                    `Pico: ${DIAS_SEMANA[parseInt(picoHeatmap.dia_semana, 10)]} às ${picoHeatmap.hora}h com ${picoHeatmap.qtd} CT-e${parseInt(picoHeatmap.qtd, 10) !== 1 ? 's' : ''}`,
                    margemX, y
                );
            }

            // Rodapé
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
            doc.text(`Gerado em ${geradoEm} · Transnet`, margemX, 290);

            const nomeArquivo = `relatorio_cte_${dataInicio}_${dataFim}${unidadeFiltro ? `_${unidadeFiltro}` : ''}.pdf`;
            doc.save(nomeArquivo);
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            setErro('Falha ao gerar PDF: ' + (e?.message || 'erro desconhecido'));
        } finally {
            setExportandoPdf(false);
        }
    }

    const temDados = registros.length > 0;

    const tabStyle = (ativo) => ({
        padding: '10px 18px',
        background: 'transparent',
        border: 'none',
        borderBottom: ativo ? '2px solid #facc15' : '2px solid transparent',
        color: ativo ? '#f1f5f9' : '#64748b',
        fontSize: '12px', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    });

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <FileText size={20} color="#fff" />
                </div>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                        Relatório CT-e
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Tempo de emissão · Recife × Moreno · Horários de pico · Ociosidade
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div style={{
                ...glassCard,
                padding: '16px 20px',
                display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <Calendar size={10} /> De
                    </label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <Calendar size={10} /> Até
                    </label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
                </div>
                <button
                    onClick={buscar}
                    disabled={carregando}
                    style={{
                        padding: '10px 18px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        cursor: carregando ? 'wait' : 'pointer',
                        opacity: carregando ? 0.7 : 1,
                    }}>
                    {carregando ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />}
                    Buscar
                </button>
                {temDados && (
                    <button
                        onClick={exportarPDF}
                        disabled={exportandoPdf}
                        style={{
                            padding: '10px 18px', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5', fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            cursor: exportandoPdf ? 'wait' : 'pointer',
                            marginLeft: 'auto',
                            opacity: exportandoPdf ? 0.7 : 1,
                        }}>
                        {exportandoPdf ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
                        {exportandoPdf ? 'Gerando...' : 'Exportar PDF'}
                    </button>
                )}
            </div>

            {erro && !carregando && (
                <div style={{
                    ...glassCard,
                    padding: '16px 20px',
                    marginBottom: '20px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                    fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <AlertTriangle size={16} /> {erro}
                </div>
            )}

            {!temDados && !carregando && !erro && (
                <div style={{
                    ...glassCard,
                    padding: '60px 20px', textAlign: 'center',
                    color: '#64748b', fontSize: '14px',
                }}>
                    Selecione um período e clique em Buscar para visualizar os dados.
                </div>
            )}

            {temDados && (
                <>
                    {/* KPI Cards — Recife/Moreno clicáveis filtram o restante */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <KpiCard icon={<FileText size={16} />} label="Total emitidos" valor={resumo.total} cor="#facc15" />
                        <KpiCard icon={<Clock size={16} />} label="Tempo médio" valor={formatHoras(resumo.media)} cor="#60a5fa" />
                        <KpiCard icon={<Clock size={16} />} label="Mediana" valor={formatHoras(resumo.mediana)} cor="#22d3ee" />
                        {unidadeFiltro !== 'Moreno' && (
                            <KpiCard
                                icon={<MapPin size={16} />} label="Recife" valor={resumo.recife} cor="#60a5fa"
                                ativo={unidadeFiltro === 'Recife'}
                                onClick={() => setUnidadeFiltro(prev => prev === 'Recife' ? null : 'Recife')}
                            />
                        )}
                        {unidadeFiltro !== 'Recife' && (
                            <KpiCard
                                icon={<MapPin size={16} />} label="Moreno" valor={resumo.moreno} cor="#a78bfa"
                                ativo={unidadeFiltro === 'Moreno'}
                                onClick={() => setUnidadeFiltro(prev => prev === 'Moreno' ? null : 'Moreno')}
                            />
                        )}
                    </div>

                    {unidadeFiltro && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 14px', marginBottom: '16px',
                            background: 'rgba(59,130,246,0.08)',
                            border: '1px solid rgba(59,130,246,0.25)',
                            borderRadius: '10px',
                            fontSize: '12px', color: '#93c5fd',
                        }}>
                            <Filter size={13} />
                            Filtrando por <strong>{unidadeFiltro}</strong>
                            <button
                                onClick={() => setUnidadeFiltro(null)}
                                style={{
                                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 10px', borderRadius: '6px',
                                    background: 'transparent',
                                    border: '1px solid rgba(147,197,253,0.4)',
                                    color: '#bfdbfe', fontSize: '11px', fontWeight: 600,
                                    cursor: 'pointer',
                                }}>
                                <X size={11} /> Limpar
                            </button>
                        </div>
                    )}

                    {/* Ociosidade */}
                    {(ociosidadeFiltrada.Recife || ociosidadeFiltrada.Moreno) && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                fontSize: '10px', color: '#64748b', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.8px',
                                marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <AlertTriangle size={12} /> Ociosidade / Gargalos
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                                {ociosidadeFiltrada.Recife && <OciosidadeCard unidade="Recife" dados={ociosidadeFiltrada.Recife} />}
                                {ociosidadeFiltrada.Moreno && <OciosidadeCard unidade="Moreno" dados={ociosidadeFiltrada.Moreno} />}
                            </div>
                        </div>
                    )}

                    {/* Tabs (sem aba Tabela) */}
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
                        {[
                            { id: 'graficos', label: 'Gráficos', icon: <TrendingUp size={12} /> },
                            { id: 'heatmap', label: 'Heatmap', icon: <Activity size={12} /> },
                        ].map(t => (
                            <button key={t.id} onClick={() => setAba(t.id)} style={tabStyle(aba === t.id)}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {aba === 'graficos' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {dadosPorDia.length > 0 && (
                                <div style={{ ...glassCard, padding: '16px 20px' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TrendingUp size={12} /> CT-es por dia {unidadeFiltro ? `— ${unidadeFiltro}` : '— Recife × Moreno'}
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart data={dadosPorDia} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" allowDecimals={false} />
                                            <Tooltip cursor={false} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: '8px' }} />
                                            {unidadeFiltro !== 'Moreno' && (
                                                <Bar dataKey="Recife" stackId="a" fill="#3b82f6"
                                                    radius={unidadeFiltro === 'Recife' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                                            )}
                                            {unidadeFiltro !== 'Recife' && (
                                                <Bar dataKey="Moreno" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <div style={{ ...glassCard, padding: '16px 20px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} /> CT-es por turno
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={dadosPorTurno} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="turno" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" allowDecimals={false} />
                                        <Tooltip
                                            cursor={false}
                                            contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12, color: '#f1f5f9' }}
                                            formatter={(v, name) => [name === 'quantidade' ? `${v} CT-es` : `${v}h`, name === 'quantidade' ? 'Quantidade' : 'Tempo médio']} />
                                        <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                                            {dadosPorTurno.map((entry, i) => <Cell key={i} fill={CORES_TURNO[entry.turno]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {dadosPorTurno.map(t => (
                                        <div key={t.turno} style={{
                                            background: CORES_TURNO[t.turno] + '11',
                                            border: `1px solid ${CORES_TURNO[t.turno]}33`,
                                            borderRadius: '10px', padding: '10px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: CORES_TURNO[t.turno], textTransform: 'uppercase' }}>{t.turno}</div>
                                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>{t.quantidade}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {aba === 'heatmap' && (
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Activity size={12} /> Horários de pico — dia da semana × hora
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Menos</span>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map(op => (
                                        <div key={op} style={{ width: '22px', height: '10px', borderRadius: '2px', background: `rgba(251,191,36,${op})` }} />
                                    ))}
                                </div>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Mais</span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ minWidth: '560px' }}>
                                    <div style={{ display: 'flex', marginBottom: '4px', paddingLeft: '42px' }}>
                                        {horasVisiveis.map(h => (
                                            <div key={h} style={{ width: '28px', fontSize: '10px', color: '#64748b', textAlign: 'center', flexShrink: 0 }}>
                                                {h}h
                                            </div>
                                        ))}
                                    </div>

                                    {DIAS_SEMANA.map((dia, d) => (
                                        <div key={d} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                                            <div style={{ width: '40px', fontSize: '10px', color: '#94a3b8', textAlign: 'right', paddingRight: '8px', flexShrink: 0, fontWeight: 600 }}>
                                                {dia}
                                            </div>
                                            {horasVisiveis.map(h => {
                                                const qtd = heatmapMatrix[d][h];
                                                const opacity = qtd === 0 ? 0.04 : 0.15 + (qtd / heatmapMax) * 0.85;
                                                return (
                                                    <div key={h}
                                                        title={`${dia} ${h}h: ${qtd} CT-e${qtd !== 1 ? 's' : ''}`}
                                                        style={{
                                                            width: '26px', height: '24px', marginRight: '2px',
                                                            borderRadius: '3px',
                                                            background: `rgba(251,191,36,${opacity.toFixed(2)})`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                        {qtd > 0 && (
                                                            <span style={{
                                                                fontSize: '9px', fontWeight: 700,
                                                                color: opacity > 0.5 ? '#0f172a' : '#fbbf24',
                                                            }}>
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

                            {picoHeatmap && (
                                <div style={{
                                    marginTop: '16px', padding: '12px 16px',
                                    background: 'rgba(251,191,36,0.1)',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: '10px',
                                    fontSize: '12px', color: '#fbbf24',
                                }}>
                                    <strong>Pico:</strong> {DIAS_SEMANA[parseInt(picoHeatmap.dia_semana, 10)]} às {picoHeatmap.hora}h
                                    com <strong>{picoHeatmap.qtd}</strong> CT-e{parseInt(picoHeatmap.qtd, 10) !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
