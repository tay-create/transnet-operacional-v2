import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { Filter, Calendar, MapPin, BarChart3, RefreshCw, PauseCircle, Printer } from 'lucide-react';
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

// ── Utilitários de tempo ──────────────────────────────────────────────────────

function horaAtualBrasilia() {
    return new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit', hour12: false });
}

function calcularBruto(l) {
    if (!l.t_inicio_separacao) return null;
    const fim = l.fim_carregamento || (l.em_andamento ? horaAtualBrasilia() : null);
    return diffMin(l.t_inicio_separacao, fim);
}

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

// ── Construção de linhas planas ───────────────────────────────────────────────

function construirLinhas(listaVeiculos) {
    const linhas = [];
    for (const v of listaVeiculos) {
        const adicionarLinha = (origem, tempos, status) => {
            const pausas = JSON.parse(v.pausas_status || '[]').filter(p => p.unidade === origem.toLowerCase());
            const pausaMin = pausas.reduce((acc, p) => {
                if (!p.fim) return acc;
                return acc + Math.max(0, Math.floor((new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / 60000));
            }, 0);
            linhas.push({
                motorista: v.motorista || 'A DEFINIR',
                cardId: v.id,
                data: v.data_prevista || '',
                origem,
                tipoOp: classificarOperacao(v.operacao),
                operacao: v.operacao || '—',
                status: status || 'AGUARDANDO',
                t_inicio_separacao: tempos?.t_inicio_separacao || null,
                fim_carregamento: tempos?.fim_carregamento || null,
                em_andamento: !!(tempos?.t_inicio_separacao && !tempos?.fim_carregamento),
                pausaMin,
            });
        };

        const operaRecife = ehOperacaoRecife(v.operacao);
        const operaMoreno = ehOperacaoMoreno(v.operacao);

        if (operaRecife) {
            const tempos = v.tempos_recife && Object.keys(v.tempos_recife).length > 0 ? v.tempos_recife : null;
            adicionarLinha('Recife', tempos, v.status_recife);
        }
        if (operaMoreno) {
            const tempos = v.tempos_moreno && Object.keys(v.tempos_moreno).length > 0 ? v.tempos_moreno : null;
            adicionarLinha('Moreno', tempos, v.status_moreno);
        }
        // Operação não classificada — adiciona uma linha genérica
        if (!operaRecife && !operaMoreno) {
            adicionarLinha('—', null, v.status_recife || v.status_moreno);
        }
    }
    return linhas;
}

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
    th: {
        padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)',
        color: '#64748b', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
        letterSpacing: '0.5px', background: 'rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
    },
    td: {
        padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        color: '#e2e8f0', fontSize: '13px', verticalAlign: 'middle',
    },
};

// ── Tooltip do gráfico ────────────────────────────────────────────────────────

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

// ── Constantes de KPIs ────────────────────────────────────────────────────────

const COR = '#06b6d4'; // ciano único para todos os KPIs e gráfico

const KPIS = [
    { id: 'plasticoRec', label: 'Plástico Recife' },
    { id: 'plasticoMor', label: 'Plástico Moreno' },
    { id: 'plasticoRxM', label: 'Plástico R×M' },
    { id: 'porcelana',   label: 'Porcelana' },
    { id: 'eletrik',     label: 'Eletrik' },
    { id: 'consolidado', label: 'Consolidado' },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function RelatorioOperacional() {
    const hoje = obterDataBrasilia();
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);
    const [filtroUnidade, setFiltroUnidade] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
    const [veiculosBanco, setVeiculosBanco] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

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

    // ── Veículos filtrados por unidade + tipo (tabela e gráfico) ─────────────
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
    }, [veiculosFiltrados]);

    // ── Gráfico: embarques por dia ────────────────────────────────────────────
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

    // ── Tabela: linhas planas ─────────────────────────────────────────────────
    const linhas = useMemo(() => {
        return construirLinhas(veiculosFiltrados)
            .sort((a, b) => b.data.localeCompare(a.data) || a.motorista.localeCompare(b.motorista));
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

        const tabelaRows = linhas.map(l => {
            const bruto = calcularBruto(l);
            const efetivo = bruto !== null ? Math.max(0, bruto - (l.pausaMin || 0)) : null;
            const temPausa = (l.pausaMin || 0) > 0;
            const dataFmt = l.data ? l.data.split('-').reverse().join('/') : '—';
            const unidadeBadge = `<span class="badge badge-${l.origem.toLowerCase()}">${l.origem}</span>`;
            const pausaBadge = temPausa ? `<span class="badge badge-pausa">${formatMin(l.pausaMin)}</span>` : '—';
            return `<tr>
                <td>${l.motorista}</td>
                <td>${l.operacao}</td>
                <td>${unidadeBadge}</td>
                <td>${dataFmt}</td>
                <td class="${bruto !== null ? 'col-tempo' : 'col-vazio'}">${formatMin(bruto)}</td>
                <td class="${efetivo !== null && temPausa ? 'col-efetivo' : 'col-vazio'}">${temPausa ? formatMin(efetivo) : '—'}</td>
                <td>${pausaBadge}</td>
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
  thead tr { background: #f1f5f9; }
  th { padding: 8px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge-recife { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
  .badge-moreno { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .badge-pausa { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
  .col-tempo { font-weight: 700; color: #16a34a; }
  .col-efetivo { font-weight: 700; color: #d97706; }
  .col-vazio { color: #cbd5e1; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 20px 24px; }
    @page { margin: 12mm 10mm; size: A4 landscape; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Relatório Operacional</h1>
      <p>Período: ${periodoStr} &nbsp;·&nbsp; Unidade: ${unidadeStr} &nbsp;·&nbsp; ${contadores.total} embarque${contadores.total !== 1 ? 's' : ''}</p>
    </div>
    <div class="header-right">
      Transnet Logística<br/>
      Gerado em ${geradoEm}
    </div>
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

  <div class="section-title" style="margin-bottom:10px;">Embarques — ${linhas.length} registro${linhas.length !== 1 ? 's' : ''}</div>
  <table>
    <thead>
      <tr>
        <th>Motorista</th><th>Operação</th><th>Unidade</th><th>Data</th>
        <th>Tempo</th><th>Efetivo</th><th>Pausa</th>
      </tr>
    </thead>
    <tbody>${tabelaRows}</tbody>
  </table>

  <div class="footer">
    <span>Transnet Logística — Relatório Operacional</span>
    <span>${periodoStr} · ${unidadeStr}</span>
  </div>
</body>
</html>`;

        // window.open é bloqueado no Electron — usa iframe oculto para impressão
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
                {/* Total */}
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
                {/* KPIs por tipo */}
                {KPIS.map(kpi => {
                    const valor = contadores[kpi.id] || 0;
                    const pct = contadores.total > 0 ? ((valor / contadores.total) * 100).toFixed(1) : '0.0';
                    const ativo = filtroTipo === kpi.id;
                    return (
                        <div
                            key={kpi.id}
                            onClick={() => setFiltroTipo(prev => prev === kpi.id ? 'Todas' : kpi.id)}
                            style={{ ...s.card, borderTop: `3px solid ${COR}`, textAlign: 'center', padding: '14px 10px', cursor: 'pointer', outline: ativo ? `2px solid ${COR}` : 'none', transition: 'outline 0.1s' }}
                            title={`Filtrar por ${kpi.label}`}
                        >
                            <div style={{ fontSize: '32px', fontWeight: '900', color: COR, lineHeight: 1 }}>{valor}</div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: ativo ? COR : '#94a3b8', marginTop: '4px' }}>{pct}%</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Gráfico de barras por dia ── */}
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

            {/* ── Tabela ── */}
            {linhas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#475569', fontSize: '14px' }}>
                    Nenhum embarque para os filtros selecionados.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', ...s.card, padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={s.th}>Motorista</th>
                                <th style={s.th}>Operação</th>
                                <th style={s.th}>Unidade</th>
                                <th style={s.th}>Data</th>
                                <th style={{ ...s.th, color: '#4ade80' }}>Tempo</th>
                                <th style={{ ...s.th, color: '#fbbf24' }}>Efetivo</th>
                                <th style={{ ...s.th, color: '#fb923c' }}>Pausa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((l, i) => {
                                void tick;
                                const bruto = calcularBruto(l);
                                const efetivo = bruto !== null ? Math.max(0, bruto - (l.pausaMin || 0)) : null;
                                const temPausa = (l.pausaMin || 0) > 0;
                                const dataFmt = l.data ? l.data.split('-').reverse().join('/') : '—';
                                return (
                                    <tr key={`${l.cardId}-${l.origem}-${i}`}
                                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                                        <td style={{ ...s.td, fontWeight: '600', color: '#f1f5f9' }}>{l.motorista}</td>
                                        <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>{l.operacao}</td>
                                        <td style={s.td}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                                                background: l.origem === 'Recife' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                                                color: l.origem === 'Recife' ? '#60a5fa' : '#fbbf24',
                                                border: `1px solid ${l.origem === 'Recife' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)'}`,
                                            }}>{l.origem}</span>
                                        </td>
                                        <td style={{ ...s.td, color: '#64748b', fontSize: '12px' }}>{dataFmt}</td>
                                        <td style={{ ...s.td, fontWeight: '700', color: bruto !== null ? '#4ade80' : '#334155' }}>
                                            {formatMin(bruto)}
                                        </td>
                                        <td style={{ ...s.td, fontWeight: '700', color: efetivo !== null ? (temPausa ? '#fbbf24' : '#4ade80') : '#334155' }}>
                                            {temPausa ? formatMin(efetivo) : '—'}
                                        </td>
                                        <td style={s.td}>
                                            {temPausa ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                                                    <PauseCircle size={10} /> {formatMin(l.pausaMin)}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#334155' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
