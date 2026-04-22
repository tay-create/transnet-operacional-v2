import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';
import { Filter, Calendar, MapPin, BarChart3, RefreshCw, Printer, PauseCircle } from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

// ── Classificação de operação ─────────────────────────────────────────────────

const classificarOperacao = (op) => {
    if (!op) return null;
    if (op.includes('/')) return 'consolidado';
    if (op === 'DELTA(RECIFE)' || op === 'PLÁSTICO(RECIFE)') return 'plasticoRec';
    if (op === 'DELTA(MORENO)' || op === 'PLÁSTICO(MORENO)') return 'plasticoMor';
    if (op === 'DELTA(RECIFE X MORENO)' || op === 'PLÁSTICO(RECIFE X MORENO)') return 'plasticoRxM';
    if (op === 'PORCELANA') return 'porcelana';
    if (op === 'ELETRIK') return 'eletrik';
    return null;
};

const ehOperacaoRecife = (op) => op && (op.includes('RECIFE') || (op.includes('/') && op.includes('RECIFE')));
const ehOperacaoMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK') || (op.includes('/') && !op.includes('RECIFE')));

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
    input: {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none',
    },
    label: {
        fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '5px', display: 'block',
    },
    card: {
        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px 20px',
    },
};

// ── Constantes de KPIs ────────────────────────────────────────────────────────

const COR = '#06b6d4';

const KPIS = [
    { id: 'plasticoRec', label: 'Plástico Recife' },
    { id: 'plasticoMor', label: 'Plástico Moreno' },
    { id: 'plasticoRxM', label: 'Plástico R×M' },
    { id: 'porcelana',   label: 'Porcelana' },
    { id: 'eletrik',     label: 'Eletrik' },
    { id: 'consolidado', label: 'Consolidado' },
];

// Cor por operação no gráfico horizontal
const COR_OP = {
    plasticoRec: '#3b82f6',
    plasticoMor: '#f59e0b',
    plasticoRxM: '#8b5cf6',
    porcelana:   '#ec4899',
    eletrik:     '#10b981',
    consolidado: '#06b6d4',
};

// ── Tooltips ──────────────────────────────────────────────────────────────────

const TooltipDia = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value || 0;
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#f1f5f9' }}>
            <div style={{ fontWeight: '700', color: '#94a3b8', marginBottom: '2px' }}>{label}</div>
            <div style={{ color: '#60a5fa' }}>{v} embarque{v !== 1 ? 's' : ''}</div>
        </div>
    );
};

const TooltipOp = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value || 0;
    const nome = payload[0]?.payload?.label || '';
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#f1f5f9' }}>
            <div style={{ fontWeight: '700', color: '#94a3b8', marginBottom: '2px' }}>{nome}</div>
            <div style={{ color: COR }}>{v} embarque{v !== 1 ? 's' : ''}</div>
        </div>
    );
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function RelatorioOperacional() {
    const hoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [filtroUnidade, setFiltroUnidade] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
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

    useEffect(() => { buscarDados(dataInicio, dataFim); }, [dataInicio, dataFim, buscarDados]);

    // ── Veículos filtrados só por unidade (KPIs sempre mostram totais reais) ──
    const veiculosPorUnidade = useMemo(() => {
        return veiculosBanco.filter(v => {
            if (filtroUnidade === 'Recife' && !ehOperacaoRecife(v.operacao)) return false;
            if (filtroUnidade === 'Moreno' && !ehOperacaoMoreno(v.operacao)) return false;
            return true;
        });
    }, [veiculosBanco, filtroUnidade]);

    // ── Veículos filtrados por unidade + tipo (gráficos) ─────────────────────
    const veiculosFiltrados = useMemo(() => {
        if (filtroTipo === 'Todas') return veiculosPorUnidade;
        return veiculosPorUnidade.filter(v => classificarOperacao(v.operacao) === filtroTipo);
    }, [veiculosPorUnidade, filtroTipo]);

    // ── Contadores KPI (ignoram filtroTipo) ───────────────────────────────────
    const contadores = useMemo(() => {
        const cnt = { plasticoRec: 0, plasticoMor: 0, plasticoRxM: 0, porcelana: 0, eletrik: 0, consolidado: 0 };
        veiculosPorUnidade.forEach(v => {
            const cat = classificarOperacao(v.operacao);
            if (cat && cnt[cat] !== undefined) cnt[cat]++;
        });
        return { ...cnt, total: veiculosPorUnidade.length };
    }, [veiculosPorUnidade]);

    // ── Gráfico 1: embarques por dia ──────────────────────────────────────────
    const dadosDia = useMemo(() => {
        const mapa = {};
        veiculosFiltrados.forEach(v => {
            const d = v.data_prevista || '';
            if (!d) return;
            mapa[d] = (mapa[d] || 0) + 1;
        });
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, total]) => ({
                data,
                label: data.split('-').reverse().slice(0, 2).join('/'),
                total,
            }));
    }, [veiculosFiltrados]);

    // ── Gráfico 2: embarques por operação (barras horizontais) ───────────────
    const dadosOp = useMemo(() => {
        const mapa = {};
        veiculosFiltrados.forEach(v => {
            const op = v.operacao || '—';
            mapa[op] = (mapa[op] || 0) + 1;
        });
        return Object.entries(mapa)
            .sort(([, a], [, b]) => b - a)
            .map(([op, total]) => ({
                op,
                label: op,
                total,
                cor: COR_OP[classificarOperacao(op)] || COR,
            }));
    }, [veiculosFiltrados]);

    // ── Impressão ─────────────────────────────────────────────────────────────
    const imprimir = () => {
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        const periodoStr = dataInicio === dataFim ? dataInicio.split('-').reverse().join('/') : `${dataInicio.split('-').reverse().join('/')} → ${dataFim.split('-').reverse().join('/')}`;
        const unidadeStr = filtroUnidade === 'Todas' ? 'Todas as unidades' : filtroUnidade;

        const kpiRows = KPIS.map(k => {
            const valor = contadores[k.id] || 0;
            const pct = contadores.total > 0 ? ((valor / contadores.total) * 100).toFixed(1) : '0.0';
            return `<div class="kpi-card"><div class="kpi-valor">${valor}</div><div class="kpi-pct">${pct}%</div><div class="kpi-label">${k.label}</div></div>`;
        }).join('');

        const opRows = dadosOp.map(d => {
            const pct = contadores.total > 0 ? ((d.total / contadores.total) * 100).toFixed(1) : '0.0';
            return `<tr>
                <td>${d.label}</td>
                <td><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${d.cor}"></div></div></td>
                <td class="num">${d.total}</td>
                <td class="pct">${pct}%</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Operacional</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 12px; padding: 32px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #06b6d4; padding-bottom: 14px; margin-bottom: 22px; }
  .header-left h1 { font-size: 22px; font-weight: 900; color: #0891b2; letter-spacing: -0.5px; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 10px; }
  .kpi-grid { display: grid; grid-template-columns: 1.6fr repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
  .kpi-total { background: #f0fdfe; border: 1px solid #a5f3fc; border-left: 4px solid #06b6d4; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: center; }
  .kpi-total .total-num { font-size: 42px; font-weight: 900; color: #0891b2; line-height: 1; }
  .kpi-total .total-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
  .kpi-total .total-sub { font-size: 11px; color: #64748b; margin-top: 6px; }
  .kpi-total .total-sub span { font-weight: 700; color: #0891b2; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-top: 3px solid #06b6d4; border-radius: 8px; padding: 10px 8px; text-align: center; }
  .kpi-valor { font-size: 28px; font-weight: 900; color: #0891b2; line-height: 1; }
  .kpi-pct { font-size: 11px; font-weight: 700; color: #22d3ee; margin-top: 2px; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { padding: 8px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
  td.num { font-weight: 700; color: #0891b2; text-align: right; width: 40px; }
  td.pct { color: #64748b; text-align: right; width: 50px; }
  .bar-wrap { background: #f1f5f9; border-radius: 4px; height: 12px; width: 100%; }
  .bar-fill { height: 12px; border-radius: 4px; min-width: 2px; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px 24px; } @page { margin: 12mm 10mm; size: A4 landscape; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Relatório Operacional</h1>
      <p>Período: ${periodoStr} &nbsp;·&nbsp; Unidade: ${unidadeStr} &nbsp;·&nbsp; ${contadores.total} embarque${contadores.total !== 1 ? 's' : ''}</p>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}</div>
  </div>
  <div class="section-title">Resumo por Tipo de Operação</div>
  <div class="kpi-grid">
    <div class="kpi-total">
      <div class="total-label">Total de Embarques</div>
      <div class="total-num">${contadores.total}</div>
      <div class="total-sub">
        <span>${veiculosPorUnidade.filter(v => ehOperacaoRecife(v.operacao)).length}</span> Recife &nbsp;·&nbsp;
        <span>${veiculosPorUnidade.filter(v => ehOperacaoMoreno(v.operacao)).length}</span> Moreno
      </div>
    </div>
    ${kpiRows}
  </div>
  <div class="section-title" style="margin-bottom:10px;">Embarques por Operação</div>
  <table>
    <thead><tr><th>Operação</th><th></th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${opRows}</tbody>
  </table>
  <div class="footer">
    <span>Transnet Logística — Relatório Operacional</span>
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
            setTimeout(() => document.body.removeChild(iframe), 1500);
        }, 800);
    };

    return (
        <div style={{ padding: '10px 0' }}>

            {/* ── Título ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <BarChart3 size={22} color="#38bdf8" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Relatório Operacional</span>
                {carregando && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => buscarDados(dataInicio, dataFim)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
                    >
                        <RefreshCw size={13} /> Atualizar
                    </button>
                    <button
                        onClick={imprimir}
                        disabled={contadores.total === 0}
                        style={{ background: contadores.total === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(6,182,212,0.1)', border: `1px solid ${contadores.total === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(6,182,212,0.3)'}`, borderRadius: '8px', padding: '7px 14px', cursor: contadores.total === 0 ? 'not-allowed' : 'pointer', color: contadores.total === 0 ? '#475569' : '#06b6d4', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600' }}
                    >
                        <Printer size={13} /> Imprimir
                    </button>
                </div>
            </div>

            {/* ── Filtros ── */}
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
                        {KPIS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', alignSelf: 'flex-end', paddingBottom: '8px', marginLeft: 'auto' }}>
                    {contadores.total} embarque{contadores.total !== 1 ? 's' : ''}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ ...s.card, borderLeft: `4px solid ${COR}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total de Embarques</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                        <span style={{ fontSize: '52px', fontWeight: '900', color: COR, lineHeight: 1 }}>{contadores.total}</span>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            <div><span style={{ color: COR, fontWeight: '700' }}>{veiculosPorUnidade.filter(v => ehOperacaoRecife(v.operacao)).length}</span> Recife</div>
                            <div><span style={{ color: COR, fontWeight: '700' }}>{veiculosPorUnidade.filter(v => ehOperacaoMoreno(v.operacao)).length}</span> Moreno</div>
                        </div>
                    </div>
                </div>
                {KPIS.map(kpi => {
                    const valor = contadores[kpi.id] || 0;
                    const pct = contadores.total > 0 ? ((valor / contadores.total) * 100).toFixed(1) : '0.0';
                    const ativo = filtroTipo === kpi.id;
                    return (
                        <div
                            key={kpi.id}
                            onClick={() => setFiltroTipo(prev => prev === kpi.id ? 'Todas' : kpi.id)}
                            style={{ ...s.card, borderTop: `3px solid ${COR_OP[kpi.id] || COR}`, textAlign: 'center', padding: '14px 10px', cursor: 'pointer', outline: ativo ? `2px solid ${COR_OP[kpi.id] || COR}` : 'none', transition: 'outline 0.1s' }}
                            title={`Filtrar por ${kpi.label}`}
                        >
                            <div style={{ fontSize: '32px', fontWeight: '900', color: COR_OP[kpi.id] || COR, lineHeight: 1 }}>{valor}</div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: ativo ? (COR_OP[kpi.id] || COR) : '#94a3b8', marginTop: '4px' }}>{pct}%</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Gráfico barras verticais por dia ── */}
            {dadosDia.length > 0 && (
                <div style={{ ...s.card, marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Embarques por Dia</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dadosDia} margin={{ top: 20, right: 8, left: -20, bottom: 4 }}>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipDia />} />
                            <Bar dataKey="total" fill={COR} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="total" position="top" style={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ── Gráfico barras horizontais por operação ── */}
            {dadosOp.length > 0 && (
                <div style={{ ...s.card }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Embarques por Operação</div>
                    <ResponsiveContainer width="100%" height={Math.max(dadosOp.length * 44, 120)}>
                        <BarChart
                            data={dadosOp}
                            layout="vertical"
                            margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                        >
                            <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={180} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipOp />} />
                            <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={28}>
                                {dadosOp.map((entry, index) => (
                                    <Cell key={index} fill={entry.cor} />
                                ))}
                                <LabelList dataKey="total" position="right" style={{ fill: '#94a3b8', fontSize: 12, fontWeight: '700' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {contadores.total === 0 && !carregando && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#475569', fontSize: '14px' }}>
                    Nenhum embarque para os filtros selecionados.
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
