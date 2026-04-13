import React, { useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell, Legend
} from 'recharts';
import {
    Filter, Calendar, FileText, Clock, FileDown, RefreshCw, MapPin,
    TrendingUp, Activity, AlertTriangle
} from 'lucide-react';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';
import * as XLSX from 'xlsx';

// ── Constantes ───────────────────────────────────────────────────────────────

const CORES_TURNO = { 'Manhã': '#f59e0b', 'Tarde': '#3b82f6', 'Noite': '#8b5cf6' };
const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── Utilitários ──────────────────────────────────────────────────────────────

function formatHoras(h) {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h${String(min).padStart(2, '0')}` : `${min}min`;
}

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Estilos reutilizáveis ────────────────────────────────────────────────────

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

// ── Subcomponentes ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, valor, cor }) {
    return (
        <div style={{
            ...glassCard,
            padding: '18px 16px',
            display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0,
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
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────

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
    const [carregando, setCarregando] = useState(false);
    const [aba, setAba] = useState('graficos');

    const buscar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get(`/api/relatorio/cte?de=${dataInicio}&ate=${dataFim}`);
            setRegistros(res.data.registros || []);
            setHeatmap(res.data.heatmap || []);
            setOciosidade(res.data.ociosidade || {});
        } catch (e) {
            console.error('Erro ao buscar relatório CT-e:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    const resumo = useMemo(() => {
        const comHoras = registros.filter(r => r.horas_lancamento_cte !== null);
        const media = comHoras.length
            ? comHoras.reduce((a, r) => a + r.horas_lancamento_cte, 0) / comHoras.length
            : null;
        const recife = registros.filter(r => r.origem === 'Recife').length;
        const moreno = registros.filter(r => r.origem === 'Moreno').length;
        return { total: registros.length, media, recife, moreno };
    }, [registros]);

    const dadosPorDia = useMemo(() => {
        const mapa = {};
        for (const r of registros) {
            if (!r.datetime_cte) continue;
            const dia = r.datetime_cte.substring(0, 10);
            if (!mapa[dia]) mapa[dia] = { Recife: 0, Moreno: 0 };
            if (r.origem === 'Recife') mapa[dia].Recife++;
            else if (r.origem === 'Moreno') mapa[dia].Moreno++;
        }
        return Object.entries(mapa)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([data, v]) => ({ data: data.substring(5).replace('-', '/'), ...v }));
    }, [registros]);

    const dadosPorTurno = useMemo(() => {
        const mapa = { 'Manhã': [], 'Tarde': [], 'Noite': [] };
        for (const r of registros) {
            if (r.turno && mapa[r.turno] !== undefined) mapa[r.turno].push(r);
        }
        return TURNOS.map(t => ({
            turno: t,
            quantidade: mapa[t].length,
            media_horas: mapa[t].filter(r => r.horas_lancamento_cte !== null).length
                ? parseFloat((mapa[t].filter(r => r.horas_lancamento_cte !== null)
                    .reduce((a, r) => a + r.horas_lancamento_cte, 0)
                    / mapa[t].filter(r => r.horas_lancamento_cte !== null).length).toFixed(1))
                : 0,
        }));
    }, [registros]);

    const heatmapMatrix = useMemo(() => {
        const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
        for (const cell of heatmap) {
            const d = parseInt(cell.dia_semana, 10);
            const h = parseInt(cell.hora, 10);
            const q = parseInt(cell.qtd, 10);
            if (d >= 0 && d < 7 && h >= 0 && h < 24) matrix[d][h] = q;
        }
        return matrix;
    }, [heatmap]);

    const heatmapMax = useMemo(() => Math.max(1, ...heatmapMatrix.flat()), [heatmapMatrix]);
    const horasVisiveis = Array.from({ length: 17 }, (_, i) => i + 6);

    function exportarXLSX() {
        const dados = registros.map(r => ({
            Motorista: r.motorista,
            Coleta: r.num_coleta,
            'Nº Liberação': r.num_liberacao,
            'Data Lançamento': r.data_lancamento ? formatDateTime(r.data_lancamento) : '',
            'Data CT-e': formatDateTime(r.datetime_cte),
            'Horas lanç.→CT-e': r.horas_lancamento_cte ?? '',
            Turno: r.turno,
            Origem: r.origem,
            'Destino UF': r.destino_uf,
            'Destino Cidade': r.destino_cidade,
            Operação: r.operacao,
        }));
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CT-e');
        XLSX.writeFile(wb, `relatorio_cte_${dataInicio}_${dataFim}.xlsx`);
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
            {/* Header */}
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
                        onClick={exportarXLSX}
                        style={{
                            padding: '10px 18px', borderRadius: '10px',
                            background: 'rgba(34,197,94,0.15)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            color: '#4ade80', fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            cursor: 'pointer', marginLeft: 'auto',
                        }}>
                        <FileDown size={14} /> Exportar XLSX
                    </button>
                )}
            </div>

            {/* Estado vazio */}
            {!temDados && !carregando && (
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
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <KpiCard icon={<FileText size={16} />} label="Total emitidos" valor={resumo.total} cor="#facc15" />
                        <KpiCard icon={<Clock size={16} />} label="Tempo médio" valor={formatHoras(resumo.media)} cor="#60a5fa" />
                        <KpiCard icon={<MapPin size={16} />} label="Recife" valor={resumo.recife} cor="#60a5fa" />
                        <KpiCard icon={<MapPin size={16} />} label="Moreno" valor={resumo.moreno} cor="#a78bfa" />
                    </div>

                    {/* Ociosidade */}
                    {(ociosidade.Recife || ociosidade.Moreno) && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                fontSize: '10px', color: '#64748b', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.8px',
                                marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <AlertTriangle size={12} /> Ociosidade / Gargalos
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                                <OciosidadeCard unidade="Recife" dados={ociosidade.Recife} />
                                <OciosidadeCard unidade="Moreno" dados={ociosidade.Moreno} />
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
                        {[
                            { id: 'graficos', label: 'Gráficos', icon: <TrendingUp size={12} /> },
                            { id: 'heatmap', label: 'Heatmap', icon: <Activity size={12} /> },
                            { id: 'tabela', label: 'Tabela', icon: <FileText size={12} /> },
                        ].map(t => (
                            <button key={t.id} onClick={() => setAba(t.id)} style={tabStyle(aba === t.id)}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Aba Gráficos */}
                    {aba === 'graficos' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {dadosPorDia.length > 0 && (
                                <div style={{ ...glassCard, padding: '16px 20px' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TrendingUp size={12} /> CT-es por dia — Recife × Moreno
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart data={dadosPorDia} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" allowDecimals={false} />
                                            <Tooltip cursor={false} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: 12, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: '8px' }} />
                                            <Bar dataKey="Recife" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="Moreno" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <div style={{ ...glassCard, padding: '16px 20px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} /> CT-es por turno (quantidade + tempo médio)
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
                                            <div style={{ fontSize: '10px', color: '#64748b' }}>~{formatHoras(t.media_horas || null)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Aba Heatmap */}
                    {aba === 'heatmap' && (
                        <div style={{ ...glassCard, padding: '20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Activity size={12} /> Horários de pico — dia da semana × hora
                            </div>

                            {/* Legenda intensidade */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Menos</span>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map(op => (
                                        <div key={op} style={{ width: '22px', height: '10px', borderRadius: '2px', background: `rgba(251,191,36,${op})` }} />
                                    ))}
                                </div>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Mais</span>
                            </div>

                            {/* Grade heatmap */}
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ minWidth: '560px' }}>
                                    {/* Header de horas */}
                                    <div style={{ display: 'flex', marginBottom: '4px', paddingLeft: '42px' }}>
                                        {horasVisiveis.map(h => (
                                            <div key={h} style={{ width: '28px', fontSize: '10px', color: '#64748b', textAlign: 'center', flexShrink: 0 }}>
                                                {h}h
                                            </div>
                                        ))}
                                    </div>

                                    {/* Linhas por dia */}
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

                            {/* Insight do pico */}
                            {heatmap.length > 0 && (() => {
                                const pico = heatmap.reduce((m, c) => parseInt(c.qtd, 10) > parseInt(m.qtd, 10) ? c : m, heatmap[0]);
                                return (
                                    <div style={{
                                        marginTop: '16px', padding: '12px 16px',
                                        background: 'rgba(251,191,36,0.1)',
                                        border: '1px solid rgba(251,191,36,0.3)',
                                        borderRadius: '10px',
                                        fontSize: '12px', color: '#fbbf24',
                                    }}>
                                        <strong>Pico:</strong> {DIAS_SEMANA[parseInt(pico.dia_semana, 10)]} às {pico.hora}h
                                        com <strong>{pico.qtd}</strong> CT-e{parseInt(pico.qtd, 10) !== 1 ? 's' : ''}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Aba Tabela */}
                    {aba === 'tabela' && (
                        <div style={{ ...glassCard, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            {['Motorista', 'Coleta', 'Nº Lib.', 'Lançamento', 'CT-e', 'Tempo', 'Turno', 'Origem', 'Destino', 'Operação'].map((h, i) => (
                                                <th key={i} style={{
                                                    padding: '12px 10px',
                                                    textAlign: i === 0 || i >= 8 ? 'left' : 'center',
                                                    fontSize: '10px', fontWeight: 700, color: '#64748b',
                                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                    whiteSpace: 'nowrap',
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...registros].reverse().map(r => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '10px', color: '#f1f5f9', fontWeight: 500 }}>{r.motorista}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{r.num_coleta || '—'}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{r.num_liberacao || '—'}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>{formatDateTime(r.data_lancamento)}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', color: '#cbd5e1', fontSize: '11px' }}>{formatDateTime(r.datetime_cte)}</td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: r.horas_lancamento_cte > 8 ? '#f87171' : r.horas_lancamento_cte > 4 ? '#facc15' : '#4ade80',
                                                    }}>
                                                        {formatHoras(r.horas_lancamento_cte)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '6px',
                                                        background: (CORES_TURNO[r.turno] || '#6b7280') + '22',
                                                        color: CORES_TURNO[r.turno] || '#9ca3af',
                                                        fontSize: '10px', fontWeight: 600,
                                                    }}>{r.turno}</span>
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '6px',
                                                        background: r.origem === 'Recife' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)',
                                                        color: r.origem === 'Recife' ? '#60a5fa' : '#a78bfa',
                                                        fontSize: '10px', fontWeight: 600,
                                                    }}>{r.origem}</span>
                                                </td>
                                                <td style={{ padding: '10px', color: '#94a3b8' }}>
                                                    {r.destino_cidade ? `${r.destino_cidade}/${r.destino_uf}` : r.destino_uf || '—'}
                                                </td>
                                                <td style={{ padding: '10px', color: '#94a3b8' }}>{r.operacao || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
