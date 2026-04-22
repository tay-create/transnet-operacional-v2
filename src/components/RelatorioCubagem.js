import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend
} from 'recharts';
import {
    Warehouse, Filter, Calendar, DollarSign, Box, Package,
    Weight, TrendingUp, RefreshCw, ChevronDown, ChevronUp, FileDown
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── PDF do Relatório ──────────────────────────────────────────────────────────

function gerarPdfRelatorio(dados, kpis, dadosBarras, de, ate) {
    if (!dados || !kpis) return;

    const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtData = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR'); };
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const HORAS = Array.from({ length: 17 }, (_, i) => i + 6);

    // ── Heatmap grid ──────────────────────────────────────────────────────────
    const hmGrid = {};
    let hmMax = 1;
    (dados.heatmap || []).forEach(({ dia_semana, hora, qtd }) => {
        if (!hmGrid[dia_semana]) hmGrid[dia_semana] = {};
        hmGrid[dia_semana][hora] = qtd;
        if (qtd > hmMax) hmMax = qtd;
    });

    // ── SVG barras por região ─────────────────────────────────────────────────
    const SVG_W = 760, BAR_W = 22, PAIR_GAP = 6, GRP_GAP = 28, SVG_H = 260, BOTTOM = 50, MAX_H = 180;
    const maxM3 = Math.max(...dadosBarras.map(d => d.m3), 1);
    const maxVal = Math.max(...dadosBarras.map(d => d.valor), 1);
    let svgBars = '';
    let svgLabels = '';
    let svgVals = '';
    let x = 30;
    dadosBarras.forEach(d => {
        const h1 = Math.max(2, (d.m3 / maxM3) * MAX_H);
        const h2 = Math.max(2, (d.valor / maxVal) * MAX_H);
        const y1 = SVG_H - BOTTOM - h1;
        const y2 = SVG_H - BOTTOM - h2;
        svgBars += `<rect x="${x}" y="${y1}" width="${BAR_W}" height="${h1}" fill="#3b82f6" rx="3"/>`;
        svgBars += `<rect x="${x + BAR_W + PAIR_GAP}" y="${y2}" width="${BAR_W}" height="${h2}" fill="#f59e0b" rx="3"/>`;
        const cx = x + BAR_W + PAIR_GAP / 2;
        svgLabels += `<text x="${cx}" y="${SVG_H - 6}" text-anchor="middle" font-size="10" fill="#64748b">${d.regiao.substring(0, 8)}</text>`;
        svgVals += `<text x="${x + BAR_W / 2}" y="${y1 - 4}" text-anchor="middle" font-size="9" fill="#3b82f6">${d.m3.toFixed(1)}</text>`;
        svgVals += `<text x="${x + BAR_W + PAIR_GAP + BAR_W / 2}" y="${y2 - 4}" text-anchor="middle" font-size="9" fill="#f59e0b">${fmtBRL(d.valor).replace('R$\u00a0', 'R$')}</text>`;
        x += BAR_W * 2 + PAIR_GAP + GRP_GAP;
    });
    const svgWidth = x;

    // ── Heatmap HTML ──────────────────────────────────────────────────────────
    const hmHeaderCells = HORAS.map(h => `<th style="min-width:28px;font-size:9px;font-weight:normal;color:#94a3b8;padding:2px 0;text-align:center">${h}h</th>`).join('');
    const hmRows = DIAS.map((dia, di) => {
        const cells = HORAS.map(h => {
            const qtd = (hmGrid[di] || {})[h] || 0;
            const op = qtd > 0 ? (0.15 + (qtd / hmMax) * 0.85).toFixed(2) : '0';
            return `<td style="background:rgba(217,119,6,${op});width:28px;height:22px;border-radius:3px;text-align:center;font-size:9px;color:${qtd > 0 ? '#fff' : 'transparent'}">${qtd || ''}</td>`;
        }).join('');
        return `<tr><td style="font-size:10px;color:#64748b;padding-right:8px;font-weight:600">${dia}</td>${cells}</tr>`;
    }).join('');

    // ── Tabela cubagens ───────────────────────────────────────────────────────
    const cubagens = dados.cubagens || [];
    const linhasCub = cubagens.map((c, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
        const redesp = c.redespacho ? `<span style="background:#ea580c;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:4px">Redesp.</span>` : '';
        return `<tr style="background:${bg}">
            <td>${fmtData(c.data_criacao)}</td>
            <td>${c.numero_coleta || '—'}</td>
            <td>${c.cliente || '—'}${redesp}</td>
            <td>${c.destino || '—'}</td>
            <td style="text-align:right">${Number(c.metragem_total || 0).toFixed(3)}</td>
            <td style="text-align:right">${fmtBRL(c.valor_total)}</td>
            <td style="text-align:right">${Number(c.valor_mix_total || 0).toFixed(2)}</td>
            <td style="text-align:right">${Number(c.valor_kit_total || 0).toFixed(2)}</td>
        </tr>`;
    }).join('');
    const totalRow = `<tr style="background:#d97706;color:#fff;font-weight:700">
        <td colspan="4">TOTAL (${cubagens.length} cubagens)</td>
        <td style="text-align:right">${kpis.m3.toFixed(3)}</td>
        <td style="text-align:right">${fmtBRL(kpis.valor)}</td>
        <td style="text-align:right">${kpis.mix.toFixed(2)}</td>
        <td style="text-align:right">${kpis.kit.toFixed(2)}</td>
    </tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Relatório Cubagem Porcelana ${de} a ${ate}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; background: #f8fafc; }
        .header { background: linear-gradient(135deg, #d97706, #92400e); color: #fff; padding: 24px 32px; }
        .header h1 { margin: 0 0 4px; font-size: 20px; }
        .header p { margin: 0; font-size: 12px; opacity: 0.8; }
        .body { padding: 24px 32px; }
        .section-title { font-size: 12px; font-weight: 700; color: #78716c; text-transform: uppercase;
            letter-spacing: 0.8px; margin: 24px 0 12px; border-bottom: 2px solid #fef3c7; padding-bottom: 6px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 10px; margin-bottom: 24px; }
        .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 10px; text-align: center; }
        .kpi-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 6px; }
        .kpi-val { font-size: 18px; font-weight: 800; }
        .regiao-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
        .regiao-card { background: #fff; border-left: 4px solid #d97706; border-radius: 6px; padding: 10px 14px; min-width: 140px; }
        .regiao-nome { font-size: 11px; font-weight: 700; color: #92400e; margin-bottom: 6px; }
        .regiao-row { font-size: 10px; color: #64748b; line-height: 1.8; }
        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .chart-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .chart-box h3 { font-size: 11px; font-weight: 700; color: #78716c; text-transform: uppercase; margin: 0 0 12px; letter-spacing: 0.6px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th { background: #d97706; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        .legend { display: flex; gap: 16px; align-items: center; font-size: 10px; color: #64748b; margin-top: 8px; }
        .legend-dot { width: 12px; height: 12px; border-radius: 2px; display: inline-block; margin-right: 4px; vertical-align: middle; }
        .hm-table { border-collapse: separate; border-spacing: 2px; }
        .hm-table td, .hm-table th { border: none; }
    </style></head><body>
    <div class="header">
        <h1>TRANSNET — Relatório de Cubagem Porcelana</h1>
        <p>Período: ${de} a ${ate} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <div class="body">

        <div class="section-title">Indicadores do Período</div>
        <div class="kpi-grid">
            <div class="kpi"><div class="kpi-label">Cubagens</div><div class="kpi-val" style="color:#f59e0b">${kpis.qtd}</div></div>
            <div class="kpi"><div class="kpi-label">M³ Total</div><div class="kpi-val" style="color:#3b82f6">${kpis.m3.toFixed(3)}</div></div>
            <div class="kpi"><div class="kpi-label">Valor Total</div><div class="kpi-val" style="color:#4ade80;font-size:14px">${fmtBRL(kpis.valor)}</div></div>
            <div class="kpi"><div class="kpi-label">Peso Total</div><div class="kpi-val" style="color:#60a5fa;font-size:14px">${kpis.peso.toLocaleString('pt-BR')} kg</div></div>
            <div class="kpi"><div class="kpi-label">Mix</div><div class="kpi-val" style="color:#a78bfa">${kpis.mix.toFixed(2)}</div></div>
            <div class="kpi"><div class="kpi-label">Kit</div><div class="kpi-val" style="color:#818cf8">${kpis.kit.toFixed(2)}</div></div>
            <div class="kpi"><div class="kpi-label">Redespacho</div><div class="kpi-val" style="color:#fb923c">${kpis.redespacho} (${kpis.qtd > 0 ? Math.round(kpis.redespacho / kpis.qtd * 100) : 0}%)</div></div>
        </div>

        <div class="section-title">Distribuição por Região</div>
        <div class="regiao-grid">
            ${(dados.por_regiao || []).map(r => `
            <div class="regiao-card">
                <div class="regiao-nome">${r.regiao || 'Outros'}</div>
                <div class="regiao-row">M³: <strong>${Number(r.m3_total || 0).toFixed(3)}</strong></div>
                <div class="regiao-row">Valor: <strong>${fmtBRL(r.valor_total)}</strong></div>
                <div class="regiao-row">Peso: <strong>${Number(r.peso_total || 0).toLocaleString('pt-BR')} kg</strong></div>
                <div class="regiao-row">Volumes: <strong>${Number(r.volumes_total || 0)}</strong></div>
            </div>`).join('')}
        </div>

        <div class="charts-row">
            <div class="chart-box">
                <h3>M³ e Valor por Região</h3>
                <svg width="${svgWidth}" height="${SVG_H}" style="overflow:visible">
                    ${svgBars}${svgVals}${svgLabels}
                </svg>
                <div class="legend">
                    <span><span class="legend-dot" style="background:#3b82f6"></span>M³</span>
                    <span><span class="legend-dot" style="background:#f59e0b"></span>Valor R$</span>
                </div>
            </div>
            <div class="chart-box">
                <h3>Horário de Emissão (Heatmap)</h3>
                <table class="hm-table">
                    <thead><tr><th></th>${hmHeaderCells}</tr></thead>
                    <tbody>${hmRows}</tbody>
                </table>
                <div class="legend" style="margin-top:6px">
                    ${[0.15, 0.35, 0.55, 0.75, 1.0].map(o => `<span><span class="legend-dot" style="background:rgba(217,119,6,${o})"></span></span>`).join('')}
                    <span style="font-size:9px">menos → mais</span>
                </div>
            </div>
        </div>

        <div class="section-title">Cubagens no Período</div>
        <table>
            <thead>
                <tr>
                    <th>Data</th><th>Coleta</th><th>Cliente</th><th>Destino</th>
                    <th style="text-align:right">M³</th><th style="text-align:right">Valor</th>
                    <th style="text-align:right">Mix</th><th style="text-align:right">Kit</th>
                </tr>
            </thead>
            <tbody>${linhasCub}</tbody>
            <tfoot>${totalRow}</tfoot>
        </table>
    </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) { alert('Popup bloqueado. Permita popups para este site e tente novamente.'); return; }
    win.focus();
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS_EXIBIR = Array.from({ length: 17 }, (_, i) => i + 6); // 6h – 22h

const REGIOES_ORDEM = ['NORTE', 'NORDESTE', 'CENTRO-OESTE', 'SUDESTE', 'SUL'];

// ── Utilitários ──────────────────────────────────────────────────────────────

function primeiroDiaMes() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function hoje() {
    return obterDataBrasilia();
}

function fmtBRL(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function RelatorioCubagem() {
    const [de, setDe] = useState(primeiroDiaMes());
    const [ate, setAte] = useState(hoje());
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState(null);
    const [tabelaAberta, setTabelaAberta] = useState(true);
    const [linhaAberta, setLinhaAberta] = useState(null);

    const buscar = useCallback(async () => {
        if (!de || !ate) return;
        setLoading(true);
        setErro(null);
        try {
            const res = await api.get('/api/relatorio/cubagem', { params: { de, ate } });
            if (res.data?.success) {
                setDados(res.data);
            } else {
                setErro(res.data?.error || 'Erro ao carregar dados.');
            }
        } catch (e) {
            setErro(e?.response?.data?.error || 'Erro de conexão.');
        } finally {
            setLoading(false);
        }
    }, [de, ate]);

    // KPIs agregados
    const kpis = useMemo(() => {
        if (!dados) return null;
        const cubagens = dados.cubagens || [];
        return {
            qtd: cubagens.length,
            m3: cubagens.reduce((s, c) => s + (c.metragem_total || 0), 0),
            valor: cubagens.reduce((s, c) => s + (c.valor_total || 0), 0),
            peso: cubagens.reduce((s, c) => s + (c.peso_total || 0), 0),
            mix: cubagens.reduce((s, c) => s + (c.valor_mix_total || 0), 0),
            kit: cubagens.reduce((s, c) => s + (c.valor_kit_total || 0), 0),
            redespacho: cubagens.filter(c => c.redespacho).length,
        };
    }, [dados]);

    // Dados para gráfico de barras por região
    const dadosBarras = useMemo(() => {
        if (!dados?.por_regiao) return [];
        const regioes = dados.por_regiao;
        return REGIOES_ORDEM
            .map(nome => {
                const r = regioes.find(x => (x.regiao || '').toUpperCase() === nome);
                return r ? { regiao: nome, m3: r.m3_total || 0, valor: r.valor_total || 0, peso: r.peso_total || 0 } : null;
            })
            .filter(Boolean)
            .concat(
                regioes
                    .filter(r => !REGIOES_ORDEM.includes((r.regiao || '').toUpperCase()))
                    .map(r => ({ regiao: r.regiao || 'Outros', m3: r.m3_total || 0, valor: r.valor_total || 0, peso: r.peso_total || 0 }))
            );
    }, [dados]);

    // Heatmap: grid[dia][hora] = qtd
    const heatmapGrid = useMemo(() => {
        if (!dados?.heatmap) return { grid: {}, max: 1 };
        const grid = {};
        let max = 0;
        (dados.heatmap || []).forEach(({ dia_semana, hora, qtd }) => {
            if (!grid[dia_semana]) grid[dia_semana] = {};
            grid[dia_semana][hora] = qtd;
            if (qtd > max) max = qtd;
        });
        return { grid, max: max || 1 };
    }, [dados]);

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>

            {/* CABEÇALHO */}
            <div style={{
                borderRadius: '16px',
                marginBottom: '20px',
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
                boxShadow: '0 8px 32px rgba(217,119,6,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Warehouse size={32} style={{ color: '#fff' }} />
                    <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '20px', letterSpacing: '0.5px' }}>
                            Relatório de Cubagem Porcelana
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>
                            Análise por período, região e horário
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                        <input
                            type="date"
                            value={de}
                            onChange={e => setDe(e.target.value)}
                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>até</span>
                        <input
                            type="date"
                            value={ate}
                            onChange={e => setAte(e.target.value)}
                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                        />
                    </div>
                    <button
                        onClick={buscar}
                        disabled={loading}
                        style={{
                            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: '8px', color: '#fff', cursor: 'pointer',
                            padding: '8px 18px', fontSize: '13px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                    <button
                        onClick={() => gerarPdfRelatorio(dados, kpis, dadosBarras, de, ate)}
                        disabled={!dados}
                        style={{
                            background: dados ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px', color: dados ? '#fff' : 'rgba(255,255,255,0.3)',
                            cursor: dados ? 'pointer' : 'not-allowed',
                            padding: '8px 18px', fontSize: '13px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                        title={dados ? 'Exportar relatório como PDF' : 'Busque os dados primeiro'}
                    >
                        <FileDown size={14} />
                        Exportar PDF
                    </button>
                </div>
            </div>

            {/* ERRO */}
            {erro && (
                <div style={{ ...glassCard, padding: '14px 20px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px' }}>
                    {erro}
                </div>
            )}

            {/* SEM DADOS */}
            {!dados && !loading && (
                <div style={{ ...glassCard, padding: '60px', textAlign: 'center', color: '#475569' }}>
                    <Filter size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
                    <div style={{ fontSize: '15px' }}>Selecione o período e clique em Buscar</div>
                </div>
            )}

            {dados && kpis && (
                <>
                    {/* KPI CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '20px' }}>
                        {[
                            { label: 'CUBAGENS', valor: kpis.qtd, cor: '#f59e0b', icon: <Warehouse size={16} />, fmt: v => v },
                            { label: 'M³ TOTAL', valor: kpis.m3, cor: '#3b82f6', icon: <Box size={16} />, fmt: v => v.toFixed(3) },
                            { label: 'VALOR TOTAL', valor: kpis.valor, cor: '#4ade80', icon: <DollarSign size={16} />, fmt: fmtBRL },
                            { label: 'PESO TOTAL', valor: kpis.peso, cor: '#60a5fa', icon: <Weight size={16} />, fmt: v => `${v.toLocaleString('pt-BR')} kg` },
                            { label: 'MIX', valor: kpis.mix, cor: '#a78bfa', icon: <TrendingUp size={16} />, fmt: v => Number(v).toFixed(2) },
                            { label: 'KIT', valor: kpis.kit, cor: '#818cf8', icon: <Package size={16} />, fmt: v => Number(v).toFixed(2) },
                            { label: 'REDESPACHO', valor: kpis.redespacho, cor: '#fb923c', icon: <TrendingUp size={16} />, fmt: v => `${v} (${kpis.qtd > 0 ? Math.round((v / kpis.qtd) * 100) : 0}%)` },
                        ].map(({ label, valor, cor, icon, fmt }) => (
                            <div key={label} style={{ ...glassCard, padding: '16px', border: `1px solid ${cor}25` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '8px' }}>
                                    <span style={{ color: cor }}>{icon}</span>
                                    {label}
                                </div>
                                <div style={{ color: cor, fontSize: label === 'VALOR TOTAL' ? '14px' : '22px', fontWeight: '800', lineHeight: '1.2' }}>
                                    {fmt(valor)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CARDS POR REGIÃO */}
                    {dados.por_regiao && dados.por_regiao.length > 0 && (
                        <div style={{ ...glassCard, padding: '20px', marginBottom: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '13px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                Distribuição por Região
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {dados.por_regiao.map(r => {
                                    const pct = kpis.valor > 0 ? (r.valor_total / kpis.valor) : 0;
                                    const corBorda = pct > 0.4 ? '#4ade80' : pct > 0.2 ? '#fbbf24' : pct > 0.05 ? '#60a5fa' : '#475569';
                                    return (
                                        <div key={r.regiao} style={{
                                            ...glassCard,
                                            padding: '14px 18px',
                                            border: `1px solid ${corBorda}40`,
                                            borderLeft: `4px solid ${corBorda}`,
                                            minWidth: '170px',
                                            flex: '1'
                                        }}>
                                            <div style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                                {(r.regiao || '—').toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>M³</span>
                                                    <span style={{ color: '#60a5fa', fontWeight: '600' }}>{Number(r.m3_total || 0).toFixed(3)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Valor</span>
                                                    <span style={{ color: '#4ade80', fontWeight: '600' }}>{fmtBRL(r.valor_total)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Peso</span>
                                                    <span style={{ color: '#94a3b8' }}>{Number(r.peso_total || 0).toLocaleString('pt-BR')} kg</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                    <span style={{ color: '#64748b' }}>Volumes</span>
                                                    <span style={{ color: '#94a3b8' }}>{r.volumes_total || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* GRÁFICOS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

                        {/* Barras por região */}
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '12px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '16px', textTransform: 'uppercase' }}>
                                M³ e Valor por Região
                            </div>
                            {dadosBarras.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={dadosBarras} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="regiao" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                                        <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => fmtBRL(v)} width={80} />
                                        <Tooltip cursor={false} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar yAxisId="left" dataKey="m3" name="M³" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar yAxisId="right" dataKey="valor" name="Valor R$" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', color: '#475569', padding: '60px 0', fontSize: '13px' }}>Sem dados por região</div>
                            )}
                        </div>

                        {/* Heatmap */}
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ color: '#d97706', fontSize: '12px', fontWeight: '700', letterSpacing: '0.6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Horário de Emissão (Dia × Hora)
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${HORAS_EXIBIR.length}, 1fr)`, gap: '2px', minWidth: '500px' }}>
                                    {/* Cabeçalho de horas */}
                                    <div />
                                    {HORAS_EXIBIR.map(h => (
                                        <div key={h} style={{ textAlign: 'center', fontSize: '9px', color: '#64748b', paddingBottom: '4px' }}>
                                            {h}h
                                        </div>
                                    ))}
                                    {/* Linhas por dia */}
                                    {DIAS_SEMANA.map((dia, d) => (
                                        <React.Fragment key={dia}>
                                            <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                                                {dia}
                                            </div>
                                            {HORAS_EXIBIR.map(h => {
                                                const qtd = (heatmapGrid.grid[d] || {})[h] || 0;
                                                const opacity = qtd > 0 ? 0.15 + (qtd / heatmapGrid.max) * 0.85 : 0;
                                                return (
                                                    <div
                                                        key={h}
                                                        title={qtd > 0 ? `${dia} ${h}h: ${qtd} cubagem(ns)` : ''}
                                                        style={{
                                                            height: '20px',
                                                            borderRadius: '3px',
                                                            background: qtd > 0 ? `rgba(217,119,6,${opacity.toFixed(2)})` : 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.04)',
                                                        }}
                                                    />
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                                {/* Legenda */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Menos</span>
                                    {[0.1, 0.3, 0.55, 0.75, 1].map(op => (
                                        <div key={op} style={{ width: '14px', height: '14px', borderRadius: '2px', background: `rgba(217,119,6,${op})` }} />
                                    ))}
                                    <span style={{ fontSize: '9px', color: '#64748b' }}>Mais</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABELA DE CUBAGENS */}
                    <div style={{ ...glassCard, overflow: 'hidden' }}>
                        <div
                            onClick={() => setTabelaAberta(a => !a)}
                            style={{
                                padding: '16px 20px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderBottom: tabelaAberta ? '1px solid rgba(217,119,6,0.2)' : 'none',
                                background: 'rgba(217,119,6,0.08)'
                            }}
                        >
                            <div style={{ color: '#d97706', fontSize: '13px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                Cubagens no Período ({dados.cubagens?.length || 0})
                            </div>
                            {tabelaAberta ? <ChevronUp size={16} style={{ color: '#d97706' }} /> : <ChevronDown size={16} style={{ color: '#d97706' }} />}
                        </div>

                        {tabelaAberta && (
                            <>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '110px 1fr 1fr 80px 80px 90px 90px 80px',
                                    gap: '8px', padding: '10px 20px',
                                    fontSize: '10px', fontWeight: '700', color: '#d97706',
                                    letterSpacing: '0.6px', textTransform: 'uppercase',
                                    background: 'rgba(217,119,6,0.08)'
                                }}>
                                    <div>Data</div>
                                    <div>Coleta</div>
                                    <div>Cliente</div>
                                    <div style={{ textAlign: 'right' }}>M³</div>
                                    <div style={{ textAlign: 'right' }}>Valor</div>
                                    <div style={{ textAlign: 'right' }}>Mix</div>
                                    <div style={{ textAlign: 'right' }}>Kit</div>
                                    <div style={{ textAlign: 'center' }}>Redesp.</div>
                                </div>
                                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                    {(dados.cubagens || []).map((c, i) => (
                                        <React.Fragment key={c.id}>
                                        <div
                                            onClick={() => setLinhaAberta(a => a === c.id ? null : c.id)}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '110px 1fr 1fr 80px 80px 90px 90px 80px',
                                                gap: '8px', padding: '9px 20px',
                                                alignItems: 'center',
                                                background: i % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                borderLeft: c.redespacho ? '3px solid #fb923c' : '3px solid transparent',
                                            }}
                                        >
                                            <div style={{ color: '#64748b', fontSize: '11px' }}>{fmtData(c.data_criacao)}</div>
                                            <div style={{ color: '#e2e8f0', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.numero_coleta || '—'}
                                            </div>
                                            <div style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.cliente || '—'}
                                            </div>
                                            <div style={{ color: '#60a5fa', textAlign: 'right', fontWeight: '600' }}>
                                                {Number(c.metragem_total || 0).toFixed(3)}
                                            </div>
                                            <div style={{ color: '#4ade80', textAlign: 'right', fontSize: '11px' }}>
                                                {fmtBRL(c.valor_total)}
                                            </div>
                                            <div style={{ color: '#a78bfa', textAlign: 'right', fontSize: '11px' }}>
                                                {Number(c.valor_mix_total || 0).toFixed(4)}
                                            </div>
                                            <div style={{ color: '#818cf8', textAlign: 'right', fontSize: '11px' }}>
                                                {Number(c.valor_kit_total || 0).toFixed(4)}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                {c.redespacho ? (
                                                    <span style={{
                                                        background: 'rgba(251,146,60,0.2)', color: '#fb923c',
                                                        border: '1px solid rgba(251,146,60,0.4)',
                                                        borderRadius: '5px', padding: '2px 6px',
                                                        fontSize: '9px', fontWeight: '700'
                                                    }} title={c.nome_redespacho || ''}>
                                                        Redesp.
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#334155', fontSize: '10px' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                        {linhaAberta === c.id && (() => {
                                            const itens = c.itens || [];
                                            const grupos = new Map();
                                            itens.forEach(it => {
                                                const chave = (it.redespacho_nome && String(it.redespacho_nome).trim())
                                                    ? `R::${String(it.redespacho_nome).trim()}::${it.redespacho_uf || ''}`
                                                    : 'DIRETO';
                                                if (!grupos.has(chave)) grupos.set(chave, []);
                                                grupos.get(chave).push(it);
                                            });
                                            const entradas = [...grupos.entries()].sort((a, b) =>
                                                a[0] === 'DIRETO' ? 1 : b[0] === 'DIRETO' ? -1 : a[0].localeCompare(b[0])
                                            );
                                            return (
                                                <div style={{ padding: '12px 20px 16px', background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid #d97706' }}>
                                                    {entradas.length === 0 && (
                                                        <div style={{ color: '#64748b', fontSize: '11px', padding: '8px 0' }}>Sem itens.</div>
                                                    )}
                                                    {entradas.map(([chave, lista]) => {
                                                        const ehDireto = chave === 'DIRETO';
                                                        const [, nome, uf] = ehDireto ? [null, null, null] : chave.split('::');
                                                        const subM3 = lista.reduce((s, it) => s + Number(it.metragem || 0), 0);
                                                        const subVol = lista.reduce((s, it) => s + Number(it.volumes || 0), 0);
                                                        const subPeso = lista.reduce((s, it) => s + Number(it.peso_kg || 0), 0);
                                                        const subValor = lista.reduce((s, it) => s + Number(it.valor || 0), 0);
                                                        return (
                                                            <div key={chave} style={{ marginBottom: '10px' }}>
                                                                <div style={{
                                                                    background: ehDireto ? '#1e40af' : '#92400e',
                                                                    color: '#fff', padding: '6px 12px', borderRadius: '5px 5px 0 0',
                                                                    display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11px', fontWeight: '700'
                                                                }}>
                                                                    <span>{ehDireto ? 'ENTREGA DIRETA AO CLIENTE' : `REDESPACHO: ${nome}`}</span>
                                                                    {!ehDireto && uf && <span style={{ opacity: 0.8, fontWeight: '500' }}>UF: {uf}</span>}
                                                                    <span style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: '3px', fontSize: '10px' }}>{lista.length} NF(s)</span>
                                                                </div>
                                                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0 0 5px 5px', padding: '6px 10px' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 50px 70px 70px 80px 90px', gap: '6px', fontSize: '10px', color: '#64748b', fontWeight: '700', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                        <div>NF</div><div>UF</div>
                                                                        <div style={{ textAlign: 'right' }}>M³</div>
                                                                        <div style={{ textAlign: 'right' }}>Vol</div>
                                                                        <div style={{ textAlign: 'right' }}>Peso</div>
                                                                        <div style={{ textAlign: 'right' }}>Valor</div>
                                                                    </div>
                                                                    {lista.map((it, idx) => (
                                                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 50px 70px 70px 80px 90px', gap: '6px', fontSize: '11px', padding: '4px 0', color: '#cbd5e1' }}>
                                                                            <div>{it.numero_nf || '—'}</div>
                                                                            <div>{it.uf || '—'}</div>
                                                                            <div style={{ textAlign: 'right', color: '#60a5fa' }}>{Number(it.metragem || 0).toFixed(3)}</div>
                                                                            <div style={{ textAlign: 'right' }}>{Number(it.volumes || 0)}</div>
                                                                            <div style={{ textAlign: 'right' }}>{Number(it.peso_kg || 0).toLocaleString('pt-BR')}</div>
                                                                            <div style={{ textAlign: 'right', color: '#4ade80' }}>{it.valor > 0 ? fmtBRL(it.valor) : '—'}</div>
                                                                        </div>
                                                                    ))}
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '140px 70px 70px 80px 90px', gap: '6px', fontSize: '11px', fontWeight: '700', padding: '6px 0 2px', color: '#f59e0b', borderTop: '1px solid rgba(245,158,11,0.3)' }}>
                                                                        <div>SUBTOTAL</div>
                                                                        <div style={{ textAlign: 'right' }}>{subM3.toFixed(3)}</div>
                                                                        <div style={{ textAlign: 'right' }}>{subVol}</div>
                                                                        <div style={{ textAlign: 'right' }}>{subPeso.toLocaleString('pt-BR')} kg</div>
                                                                        <div style={{ textAlign: 'right' }}>{fmtBRL(subValor)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                        </React.Fragment>
                                    ))}
                                    {(dados.cubagens || []).length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                                            Nenhuma cubagem no período.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
