import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import {
    Filter, Calendar, Truck, Clock, BarChart3, FileDown, RefreshCw, MapPin,
    PauseCircle, Timer, TrendingUp, ArrowDownRight, ArrowUpRight, Package
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── Utilitários ──────────────────────────────────────────────────────────────

function formatMin(min) {
    if (min === null || min === undefined) return '—';
    if (min < 0) min = 0;
    const d = Math.floor(min / (60 * 24));
    const h = Math.floor((min % (60 * 24)) / 60);
    const m = min % 60;
    if (d > 0) {
        if (h === 0 && m === 0) return `${d}d`;
        if (h === 0) return `${d}d ${m}min`;
        return `${d}d ${h}h${String(m).padStart(2, '0')}`;
    }
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

function corTempo(min) {
    if (min === null || min === undefined) return '#64748b';
    if (min < 60) return '#4ade80';
    if (min < 120) return '#facc15';
    return '#f87171';
}

const COR_ETAPA = {
    sep: '#8b5cf6',
    doca: '#3b82f6',
    carr: '#f59e0b',
};

// ── Componentes de UI ────────────────────────────────────────────────────────

function KpiCard({ icon, label, valor, subtexto, cor }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: 0,
            backdropFilter: 'blur(12px)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: `${cor || '#3b82f6'}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    {icon}
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.3px' }}>
                    {label}
                </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {valor}
            </div>
            {subtexto && (
                <span style={{ fontSize: '10px', color: '#64748b' }}>{subtexto}</span>
            )}
        </div>
    );
}

function BarraEtapa({ min, maxMin, cor, label }) {
    if (min === null || min === undefined || !maxMin) return null;
    const pct = Math.min(100, Math.max(2, (min / maxMin) * 100));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '9px', color: '#64748b', width: '32px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '3px', height: '8px', overflow: 'hidden', minWidth: 0 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: '10px', color: cor, fontWeight: 600, width: '42px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatMin(min)}
            </span>
        </div>
    );
}

function formatDataBR(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
}

function formatDataBRFull(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function TooltipGrafico({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
            <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
                    <span style={{ color: '#94a3b8' }}>{p.name}:</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{formatMin(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function RelatorioPerformance() {
    const hoje = obterDataBrasilia().substring(0, 10);
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [unidade, setUnidade] = useState('todas');
    const [operacao, setOperacao] = useState('todas');
    const [linhas, setLinhas] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [ordenacao, setOrdenacao] = useState({ campo: 'data', dir: 'desc' });

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/performance?de=${dataInicio}&ate=${dataFim}&unidade=${unidade}&operacao=${operacao}`);
            setLinhas(res.data.linhas || []);
        } catch (e) {
            console.error('Erro ao buscar performance:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim, unidade, operacao]);

    // ── KPIs ─────────────────────────────────────────────────────────────────

    const kpis = useMemo(() => {
        const total = linhas.length;
        const comSep = linhas.filter(l => l.sep_min !== null);
        const comDoca = linhas.filter(l => l.doca_min !== null);
        const comCarr = linhas.filter(l => l.carr_min !== null);
        const comPatio = linhas.filter(l => l.total_patio_min !== null);
        const comDuracao = linhas.filter(l => l.duracao_min !== null);
        const comPausa = linhas.filter(l => l.pausas_min > 0);

        const media = arr => arr.length ? Math.round(arr.reduce((a, l) => a + l, 0) / arr.length) : null;

        return {
            total,
            mediaSep: media(comSep.map(l => l.sep_min)),
            mediaDoca: media(comDoca.map(l => l.doca_min)),
            mediaCarr: media(comCarr.map(l => l.carr_min)),
            mediaPatio: media(comPatio.map(l => l.total_patio_min)),
            mediaEfetivo: media(comDuracao.map(l => l.efetivo_min ?? l.duracao_min)),
            totalPausas: comPausa.length,
            mediaPausa: media(comPausa.map(l => l.pausas_min)),
        };
    }, [linhas]);

    // ── Gráfico por dia (barras empilhadas) ──────────────────────────────────

    const dadosGrafico = useMemo(() => {
        const porDia = {};
        for (const l of linhas) {
            if (l.sep_min === null && l.carr_min === null) continue;
            if (!porDia[l.data]) porDia[l.data] = { sep: [], doca: [], carr: [], n: 0 };
            porDia[l.data].n++;
            if (l.sep_min !== null) porDia[l.data].sep.push(l.sep_min);
            if (l.doca_min !== null) porDia[l.data].doca.push(l.doca_min);
            if (l.carr_min !== null) porDia[l.data].carr.push(l.carr_min);
        }
        const avg = arr => arr.length ? Math.round(arr.reduce((a, v) => a + v, 0) / arr.length) : 0;
        return Object.entries(porDia)
            .map(([data, v]) => ({
                data: formatDataBR(data),
                dataFull: data,
                Separação: avg(v.sep),
                'Lib. Doca': avg(v.doca),
                Carregamento: avg(v.carr),
                embarques: v.n,
            }))
            .sort((a, b) => a.dataFull.localeCompare(b.dataFull));
    }, [linhas]);

    // ── Tabela ordenada ──────────────────────────────────────────────────────

    const linhasOrdenadas = useMemo(() => {
        const sorted = [...linhas];
        const { campo, dir } = ordenacao;
        sorted.sort((a, b) => {
            let va = a[campo], vb = b[campo];
            if (va === null || va === undefined) va = dir === 'asc' ? Infinity : -Infinity;
            if (vb === null || vb === undefined) vb = dir === 'asc' ? Infinity : -Infinity;
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return dir === 'asc' ? va - vb : vb - va;
        });
        return sorted;
    }, [linhas, ordenacao]);

    const toggleOrdenacao = (campo) => {
        setOrdenacao(prev =>
            prev.campo === campo
                ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { campo, dir: 'asc' }
        );
    };

    // ── Exportar PDF ─────────────────────────────────────────────────────────

    function exportarPDF() {
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        const periodoStr = dataInicio === dataFim
            ? dataInicio.split('-').reverse().join('/')
            : `${dataInicio.split('-').reverse().join('/')} → ${dataFim.split('-').reverse().join('/')}`;
        const unidadeStr = unidade === 'todas' ? 'Todas as unidades' : unidade;

        // KPI cards HTML
        const kpiCards = [
            { label: 'EMBARQUES', valor: kpis.total, sub: `${kpis.totalPausas} com pausa`, cor: '#3b82f6' },
            { label: 'T.M SEPARAÇÃO', valor: formatMin(kpis.mediaSep), sub: '', cor: '#8b5cf6' },
            { label: 'T.M CARREGAMENTO', valor: formatMin(kpis.mediaCarr), sub: '', cor: '#f59e0b' },
            { label: 'T.M TOTAL PÁTIO', valor: formatMin(kpis.mediaPatio), sub: '', cor: '#06b6d4' },
            { label: 'T.M EFETIVO', valor: formatMin(kpis.mediaEfetivo), sub: 'descontando pausas', cor: '#4ade80' },
        ].map(k => `
            <div class="kpi-card" style="border-top:3px solid ${k.cor}">
                <div class="kpi-label">${k.label}</div>
                <div class="kpi-valor" style="color:${k.cor}">${k.valor}</div>
                ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
            </div>`).join('');

        // Gráfico de barras empilhadas usando SVG — funciona em qualquer contexto de impressão
        const HMAX = 160;
        const BARRA_W = 18;
        const GAP = 4;
        const maxGrafico = Math.max(...dadosGrafico.map(d => (d['Separação'] || 0) + (d['Lib. Doca'] || 0) + (d.Carregamento || 0)), 1);
        const nBars = dadosGrafico.length;
        const svgW = nBars * (BARRA_W + GAP);
        const svgH = HMAX + 20; // +20 para labels
        const svgBars = dadosGrafico.map((d, i) => {
            const sep = d['Separação'] || 0;
            const doca = d['Lib. Doca'] || 0;
            const carr = d.Carregamento || 0;
            const total = sep + doca + carr;
            const hTot = Math.round((total / maxGrafico) * HMAX);
            const hCar = total ? Math.round((carr / total) * hTot) : 0;
            const hDoc = total ? Math.round((doca / total) * hTot) : 0;
            const hSep = hTot - hCar - hDoc;
            const x = i * (BARRA_W + GAP);
            const yCar = HMAX - hCar;
            const yDoc = HMAX - hCar - hDoc;
            const ySep = HMAX - hCar - hDoc - hSep;
            return `
                ${hSep > 0 ? `<rect x="${x}" y="${ySep}" width="${BARRA_W}" height="${hSep}" fill="#8b5cf6"/>` : ''}
                ${hDoc > 0 ? `<rect x="${x}" y="${yDoc}" width="${BARRA_W}" height="${hDoc}" fill="#3b82f6"/>` : ''}
                ${hCar > 0 ? `<rect x="${x}" y="${yCar}" width="${BARRA_W}" height="${hCar}" fill="#f59e0b"/>` : ''}
                <text x="${x + BARRA_W / 2}" y="${HMAX + 12}" text-anchor="middle" font-size="7" fill="#94a3b8">${d.data}</text>`;
        }).join('');
        const graficoSVG = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <line x1="0" y1="${HMAX}" x2="${svgW}" y2="${HMAX}" stroke="#e2e8f0" stroke-width="1"/>
            ${svgBars}
        </svg>`;

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Performance de Embarque</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 11px; padding: 20px 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { font-size: 20px; font-weight: 900; color: #1e40af; }
  .header p { font-size: 10px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 9px; color: #94a3b8; line-height: 1.6; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi-card { border-radius: 10px; border: 1px solid #e2e8f0; padding: 14px 10px; text-align: center; }
  .kpi-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; }
  .kpi-valor { font-size: 26px; font-weight: 900; line-height: 1; }
  .kpi-sub { font-size: 8px; color: #94a3b8; margin-top: 4px; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
  .grafico-wrap { margin-bottom: 6px; overflow-x: auto; }
  .legenda { display: flex; gap: 16px; justify-content: center; margin-top: 6px; }
  .leg-item { display: flex; align-items: center; gap: 5px; font-size: 9px; color: #64748b; }
  .leg-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 12mm 14mm; } @page { margin: 0; size: A4 landscape; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Performance de Embarque</h1>
      <p>Período: ${periodoStr} &nbsp;·&nbsp; Unidade: ${unidadeStr} &nbsp;·&nbsp; ${kpis.total} embarque${kpis.total !== 1 ? 's' : ''}</p>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}</div>
  </div>

  <div class="kpi-grid">${kpiCards}</div>

  <div class="section-title">&#9641; Tempo médio por dia (min) — barras empilhadas</div>
  <div class="grafico-wrap">${graficoSVG}</div>
  <div class="legenda">
    <div class="leg-item"><div class="leg-dot" style="background:#f59e0b"></div>Carregamento</div>
    <div class="leg-item"><div class="leg-dot" style="background:#3b82f6"></div>Lib. Doca</div>
    <div class="leg-item"><div class="leg-dot" style="background:#8b5cf6"></div>Separação</div>
  </div>

  <div class="footer">
    <span>Transnet Logística — Performance de Embarque</span>
    <span>${periodoStr} · ${unidadeStr}</span>
  </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 400);
    }

    // ── Estilos ──────────────────────────────────────────────────────────────

    const inputStyle = {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#e2e8f0',
        fontSize: '13px',
        outline: 'none',
    };

    const selectStyle = {
        ...inputStyle,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '30px',
    };

    const thStyle = (campo) => ({
        padding: '12px 10px',
        textAlign: 'left',
        fontSize: '10px',
        fontWeight: 700,
        color: ordenacao.campo === campo ? '#e2e8f0' : '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    });

    const tdStyle = {
        padding: '10px 10px',
        fontSize: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <BarChart3 size={20} color="#fff" />
                </div>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                        Performance de Embarque
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        Tempos baseados em timestamps do servidor (fonte única)
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'flex-end',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={10} /> DE
                    </label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={10} /> ATÉ
                    </label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={10} /> UNIDADE
                    </label>
                    <select value={unidade} onChange={e => setUnidade(e.target.value)} style={selectStyle}>
                        <option value="todas">Todas</option>
                        <option value="Recife">Recife</option>
                        <option value="Moreno">Moreno</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Package size={10} /> OPERAÇÃO
                    </label>
                    <select value={operacao} onChange={e => setOperacao(e.target.value)} style={selectStyle}>
                        <option value="todas">Todas</option>
                        <option value="PLÁSTICO">Plástico</option>
                        <option value="PORCELANA">Porcelana</option>
                        <option value="ELETRIK">Eletrik</option>
                    </select>
                </div>
                <button
                    onClick={buscar}
                    disabled={carregando}
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: carregando ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: carregando ? 0.6 : 1,
                        boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                    }}
                >
                    {carregando ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Filter size={14} />}
                    Buscar
                </button>
                {linhas.length > 0 && (
                    <button
                        onClick={exportarPDF}
                        style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px',
                            padding: '10px 16px',
                            color: '#f87171',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginLeft: 'auto',
                        }}
                    >
                        <FileDown size={14} /> PDF
                    </button>
                )}
            </div>

            {/* Estado vazio */}
            {linhas.length === 0 && !carregando && (
                <div style={{
                    textAlign: 'center', padding: '80px 20px',
                    color: '#475569',
                }}>
                    <BarChart3 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>Selecione um período e clique em Buscar</p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Os tempos são calculados com base nos timestamps do servidor</p>
                </div>
            )}

            {linhas.length > 0 && (
                <>
                    {/* KPIs */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px',
                    }}>
                        <KpiCard
                            icon={<Truck size={16} color="#3b82f6" />}
                            label="EMBARQUES"
                            valor={kpis.total}
                            subtexto={`${kpis.totalPausas} com pausa`}
                            cor="#3b82f6"
                        />
                        <KpiCard
                            icon={<Timer size={16} color="#8b5cf6" />}
                            label="T.M SEPARAÇÃO"
                            valor={formatMin(kpis.mediaSep)}
                            cor="#8b5cf6"
                        />
                        <KpiCard
                            icon={<Timer size={16} color="#f59e0b" />}
                            label="T.M CARREGAMENTO"
                            valor={formatMin(kpis.mediaCarr)}
                            cor="#f59e0b"
                        />
                        <KpiCard
                            icon={<Clock size={16} color="#06b6d4" />}
                            label="T.M TOTAL PÁTIO"
                            valor={formatMin(kpis.mediaPatio)}
                            cor="#06b6d4"
                        />
                        <KpiCard
                            icon={<TrendingUp size={16} color="#4ade80" />}
                            label="T.M EFETIVO"
                            valor={formatMin(kpis.mediaEfetivo)}
                            subtexto="descontando pausas"
                            cor="#4ade80"
                        />
                    </div>

                    {/* Gráfico */}
                    {dadosGrafico.length > 0 && (
                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '14px',
                            padding: '20px',
                            marginBottom: '20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <BarChart3 size={14} color="#64748b" />
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                                    Tempo médio por dia (min) — barras empilhadas
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatMin(v)} />
                                    <Tooltip content={<TooltipGrafico />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                                        iconType="circle"
                                        iconSize={8}
                                    />
                                    <Bar dataKey="Separação" stackId="a" fill={COR_ETAPA.sep} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Lib. Doca" stackId="a" fill={COR_ETAPA.doca} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Carregamento" stackId="a" fill={COR_ETAPA.carr} radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Tabela */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                    }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                <thead>
                                    <tr>
                                        <th onClick={() => toggleOrdenacao('motorista')} style={thStyle('motorista')}>Motorista</th>
                                        <th onClick={() => toggleOrdenacao('operacao')} style={thStyle('operacao')}>Operação</th>
                                        <th onClick={() => toggleOrdenacao('unidade')} style={{ ...thStyle('unidade'), textAlign: 'center' }}>Un.</th>
                                        <th onClick={() => toggleOrdenacao('data')} style={{ ...thStyle('data'), textAlign: 'center' }}>Data</th>
                                        <th onClick={() => toggleOrdenacao('sep_min')} style={{ ...thStyle('sep_min'), textAlign: 'center' }}>
                                            <span style={{ color: COR_ETAPA.sep }}>SEP</span>
                                        </th>
                                        <th onClick={() => toggleOrdenacao('doca_min')} style={{ ...thStyle('doca_min'), textAlign: 'center' }}>
                                            <span style={{ color: COR_ETAPA.doca }}>DOCA</span>
                                        </th>
                                        <th onClick={() => toggleOrdenacao('carr_min')} style={{ ...thStyle('carr_min'), textAlign: 'center' }}>
                                            <span style={{ color: COR_ETAPA.carr }}>CARR</span>
                                        </th>
                                        <th onClick={() => toggleOrdenacao('total_patio_min')} style={{ ...thStyle('total_patio_min'), textAlign: 'center' }}>PÁTIO</th>
                                        <th style={{ ...thStyle('breakdown'), textAlign: 'left', cursor: 'default' }}>BREAKDOWN</th>
                                        <th onClick={() => toggleOrdenacao('pausas_min')} style={{ ...thStyle('pausas_min'), textAlign: 'center' }}>PAUSA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhasOrdenadas.map((l, i) => {
                                        const maxEtapa = Math.max(l.sep_min || 0, l.doca_min || 0, l.carr_min || 0, 1);
                                        return (
                                            <tr key={`${l.id}-${l.unidade}-${i}`} style={{
                                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                            }}>
                                                <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {l.motorista}
                                                </td>
                                                <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '11px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {l.operacao}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: 700,
                                                        padding: '2px 6px', borderRadius: '4px',
                                                        background: l.unidade === 'Recife' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: l.unidade === 'Recife' ? '#60a5fa' : '#fbbf24',
                                                    }}>
                                                        {l.unidade === 'Recife' ? 'REC' : 'MOR'}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                                                    {formatDataBR(l.data)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: corTempo(l.sep_min), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatMin(l.sep_min)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: corTempo(l.doca_min), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatMin(l.doca_min)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: corTempo(l.carr_min), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatMin(l.carr_min)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: corTempo(l.total_patio_min), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatMin(l.total_patio_min)}
                                                </td>
                                                <td style={{ ...tdStyle, minWidth: '160px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <BarraEtapa min={l.sep_min} maxMin={maxEtapa} cor={COR_ETAPA.sep} label="SEP" />
                                                        <BarraEtapa min={l.doca_min} maxMin={maxEtapa} cor={COR_ETAPA.doca} label="DOC" />
                                                        <BarraEtapa min={l.carr_min} maxMin={maxEtapa} cor={COR_ETAPA.carr} label="CAR" />
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {l.pausas_min > 0 ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                            fontSize: '10px', fontWeight: 700,
                                                            padding: '2px 7px', borderRadius: '6px',
                                                            background: 'rgba(251,191,36,0.12)',
                                                            border: '1px solid rgba(251,191,36,0.3)',
                                                            color: '#fbbf24',
                                                        }}>
                                                            <PauseCircle size={10} /> {formatMin(l.pausas_min)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#334155', fontSize: '11px' }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Rodapé */}
                    <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: '#475569' }}>
                        {linhas.length} embarques no período &bull; Dados extraídos de timestamps_status (servidor)
                    </div>
                </>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
