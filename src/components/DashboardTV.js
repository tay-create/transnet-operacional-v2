import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Warehouse } from 'lucide-react';
import { OPCOES_STATUS, CORES_STATUS, DOCAS_RECIFE_LISTA, DOCAS_MORENO_LISTA } from '../constants';
import { obterDataBrasilia } from '../utils/helpers';
import api from '../services/apiService';

const CORES_KPI = {
    delta: '#2563eb',
    consolidado: '#3b82f6',
    deltaRxM: '#60a5fa',
    porcelana: '#93c5fd',
    eletrik: '#bfdbfe'
};

const CORES_PIE_CTE = ['#f59e0b', '#3b82f6', '#22c55e'];

// Temas
const TEMAS = {
    dark: {
        bg: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)',
        bgCard: 'rgba(255,255,255,0.05)',
        bgBar: 'rgba(0,0,0,0.5)',
        text: '#e2e8f0', textMuted: '#94a3b8', textDim: '#64748b',
        border: 'rgba(255,255,255,0.10)', accent: '#22d3ee',
        glass: 'backdrop-filter:blur(12px)',
    },
    light: {
        bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)',
        bgCard: 'rgba(255,255,255,0.7)',
        bgBar: 'rgba(255,255,255,0.5)',
        text: '#0f172a', textMuted: '#475569', textDim: '#94a3b8',
        border: 'rgba(0,0,0,0.10)', accent: '#0284c7',
        glass: 'backdrop-filter:blur(12px)',
    }
};

// Estilos reutilizáveis para glassmorphism
const glassCard = (t, extraBorder) => ({
    background: t.bgCard,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${extraBorder || t.border}`,
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    transition: 'all 0.5s ease-in-out',
});

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

// Prioridade de status (maior = mais avancado)
const PRIORIDADE_STATUS = {
    'AGUARDANDO': 0, 'EM SEPARAÇÃO': 1, 'LIBERADO P/ DOCA': 2,
    'EM CARREGAMENTO': 3, 'CARREGADO': 4, 'LIBERADO P/ CT-e': 5
};

export default function DashboardTV({ listaVeiculos, ctesRecife, ctesMoreno, onSair }) {
    const [telaAtiva, setTelaAtiva] = useState(0);
    const [pausado, setPausado] = useState(false);
    const [tempoRotacao, setTempoRotacao] = useState(20);
    const [tema, setTema] = useState('dark');
    const [docasInterditadas, setDocasInterditadas] = useState([]);
    const totalTelas = 4;
    const t = TEMAS[tema];

    // Filtro para cards de hoje (comparar data_prevista ou data_criacao com hoje)
    const hoje = obterDataBrasilia();
    const veiculosHoje = listaVeiculos.filter(v => {
        const dataCard = v.data_prevista || v.data_criacao || '';
        return dataCard.startsWith(hoje);
    });

    useEffect(() => {
        if (pausado) return;
        const timer = setInterval(() => {
            setTelaAtiva(prev => (prev + 1) % totalTelas);
        }, tempoRotacao * 1000);
        return () => clearInterval(timer);
    }, [pausado, tempoRotacao]);

    useEffect(() => {
        let unmounted = false;
        const fetchDocas = () => {
            api.get('/api/docas-interditadas').then(r => {
                if (!unmounted && r.data && r.data.success) {
                    setDocasInterditadas(r.data.docas);
                }
            }).catch(() => { });
        };
        fetchDocas();
        const pollTimer = setInterval(fetchDocas, 10000);
        return () => { unmounted = true; clearInterval(pollTimer); };
    }, []);

    useEffect(() => {
        document.documentElement.requestFullscreen?.().catch(() => { });
        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        };
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (document.fullscreenElement) return;
                onSair();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onSair]);

    // Data atual formatada no timezone de Brasília
    const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const nomeTelas = [`Embarques da Operacao ${dataHoje}`, 'Operacao Recife', 'Operacao Moreno', 'Fluxo Mensal'];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: t.bg, color: t.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <style>{`
                @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
                @keyframes pulseGlow { 0%,100%{opacity:1;filter:drop-shadow(0 0 6px currentColor)} 50%{opacity:0.6;filter:drop-shadow(0 0 2px currentColor)} }
                @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
                .tv-card-anim { animation: fadeSlide 0.4s ease-out; }
                .tv-status-live { animation: pulseGlow 2s infinite; }
            `}</style>

            {/* Barra de controle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', background: t.bgBar, backdropFilter: 'blur(16px)', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong style={{ fontSize: '16px', letterSpacing: '2px', color: t.accent }}>TRANSNET</strong>
                    <span style={{ fontSize: '12px', color: t.textDim }}>Dashboard TV</span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    {nomeTelas.map((nome, i) => (
                        <button key={i} onClick={() => setTelaAtiva(i)} style={{
                            padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                            background: telaAtiva === i ? '#3b82f6' : (tema === 'dark' ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                            color: telaAtiva === i ? 'white' : t.textMuted
                        }}>{nome}</button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => setTelaAtiva(prev => (prev - 1 + totalTelas) % totalTelas)} style={btnS(t)}>◀</button>
                    <button onClick={() => setPausado(p => !p)} style={{ ...btnS(t), background: pausado ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)' }}>
                        {pausado ? '▶ Play' : '⏸ Pause'}
                    </button>
                    <button onClick={() => setTelaAtiva(prev => (prev + 1) % totalTelas)} style={btnS(t)}>▶</button>
                    <select value={tempoRotacao} onChange={e => setTempoRotacao(Number(e.target.value))} style={{ background: tema === 'dark' ? 'rgba(255,255,255,0.08)' : '#e2e8f0', color: t.text, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '4px 8px', fontSize: '11px' }}>
                        {[10, 15, 20, 30, 45, 60].map(s => <option key={s} value={s}>{s}s</option>)}
                    </select>
                    <button onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')} style={btnS(t)}>
                        {tema === 'dark' ? '☀ Claro' : '🌙 Escuro'}
                    </button>
                    <button onClick={onSair} style={{ ...btnS(t), background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>✕ Sair</button>
                </div>
            </div>

            {/* Barra de progresso */}
            <div style={{ height: '3px', background: tema === 'dark' ? 'rgba(255,255,255,0.05)' : '#cbd5e1', flexShrink: 0 }}>
                {!pausado && <div style={{ height: '100%', background: '#3b82f6', animation: `progressBar ${tempoRotacao}s linear infinite` }} />}
            </div>

            {/* Conteudo */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                {telaAtiva === 0 && <TelaVisaoGeral veiculos={veiculosHoje} ctesRecife={ctesRecife} ctesMoreno={ctesMoreno} t={t} tema={tema} dataHoje={dataHoje} />}
                {telaAtiva === 1 && <TelaOperacaoRecife veiculos={veiculosHoje} ctesRecife={ctesRecife} docasInterditadas={docasInterditadas} t={t} tema={tema} />}
                {telaAtiva === 2 && <TelaOperacaoMoreno veiculos={veiculosHoje} ctesMoreno={ctesMoreno} docasInterditadas={docasInterditadas} t={t} tema={tema} />}
                {telaAtiva === 3 && <TelaFluxoMensal veiculos={listaVeiculos} t={t} tema={tema} />}
            </div>

            {/* Rodape */}
            <div style={{ padding: '6px 20px', background: t.bgBar, borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.textDim, flexShrink: 0 }}>
                <span>{nomeTelas[telaAtiva]} ({telaAtiva + 1}/{totalTelas})</span>
                <span>{new Date().toLocaleString('pt-BR')}</span>
                <span>ESC para sair | {veiculosHoje.length} veiculos hoje | {listaVeiculos.length} total</span>
            </div>

        </div>
    );
}

const btnS = (t) => ({ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.text, cursor: 'pointer', fontSize: '12px' });

// ================================================================
// TELA 1: VISAO GERAL
// ================================================================
function TelaVisaoGeral({ veiculos, ctesRecife, ctesMoreno, t, tema, dataHoje }) {
    const contadores = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
    veiculos.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat && contadores[cat] !== undefined) contadores[cat]++;
    });
    const totalGeral = Object.values(contadores).reduce((a, b) => a + b, 0);

    const todosCtes = [...ctesRecife, ...ctesMoreno];
    const statusCte = {
        aguardando: todosCtes.filter(c => c.status === 'Aguardando Emissão' || c.status === 'Aguardando Emissao').length,
        emEmissao: todosCtes.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length,
        emitido: todosCtes.filter(c => c.status === 'Emitido').length
    };

    const kpis = [
        { label: 'Delta', valor: contadores.delta, cor: CORES_KPI.delta },
        { label: 'Consolidado', valor: contadores.consolidado, cor: CORES_KPI.consolidado },
        { label: 'Delta (RxM)', valor: contadores.deltaRxM, cor: CORES_KPI.deltaRxM },
        { label: '100% Porcelana', valor: contadores.porcelana, cor: CORES_KPI.porcelana },
        { label: 'Eletrik', valor: contadores.eletrik, cor: CORES_KPI.eletrik }
    ];

    // Consolidados = veículos com status CARREGADO ou LIBERADO P/ CT-e em qualquer unidade
    const totalConsolidados = veiculos.filter(v =>
        v.status_recife === 'CARREGADO' || v.status_recife === 'LIBERADO P/ CT-e' ||
        v.status_moreno === 'CARREGADO' || v.status_moreno === 'LIBERADO P/ CT-e'
    ).length;

    const dataPieCte = [
        { name: 'Aguardando', value: statusCte.aguardando },
        { name: 'Em Emissao', value: statusCte.emEmissao },
        { name: 'Emitido', value: statusCte.emitido }
    ].filter(d => d.value > 0);

    // Dados para gráfico de barras de status geral (Recife + Moreno separados)
    const dadosBarrasStatus = OPCOES_STATUS.map(s => ({
        name: s.replace('LIBERADO P/ ', 'LIB ').replace('EM ', ''),
        fullName: s,
        Recife: veiculos.filter(v => ehOperacaoRecife(v.operacao) && v.status_recife === s).length,
        Moreno: veiculos.filter(v => ehOperacaoMoreno(v.operacao) && v.status_moreno === s).length,
    }));

    return (
        <div className="tv-card-anim">
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: t.textMuted, letterSpacing: '2px', textTransform: 'uppercase' }}>
                EMBARQUE OP. TRAMONTINA - {dataHoje}
            </h2>

            {/* TOTAL GERAL CENTRALIZADO */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ ...glassCard(t, '#3b82f660'), padding: '24px', textAlign: 'center', borderLeft: '4px solid #3b82f6', width: '100%', maxWidth: '400px', transition: 'all 0.5s ease-in-out' }}>
                    <div style={{ fontSize: '72px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, filter: 'drop-shadow(0 0 12px #3b82f680)' }}>{totalGeral}</div>
                    <div style={{ fontSize: '12px', color: '#60a5fa', marginTop: '6px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Geral</div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, marginTop: '4px', letterSpacing: '1px' }}>EMBARQUES HOJE</div>
                </div>
            </div>

            {/* BENTO GRID principal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: '14px', marginBottom: '20px' }}>

                {/* KPI Cards — linha de cima (operação) */}
                {kpis.map(kpi => (
                    <div key={kpi.label} style={{ ...glassCard(t, `${kpi.cor}40`), padding: '16px 12px', textAlign: 'center', borderTop: `3px solid ${kpi.cor}` }}>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: kpi.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${kpi.cor}60)` }}>{kpi.valor}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                    </div>
                ))}

                {/* Card Consolidados — última coluna */}
                <div style={{ ...glassCard(t, '#3b82f640'), padding: '16px 12px', textAlign: 'center', borderTop: '3px solid #3b82f6' }}>
                    <div style={{ fontSize: '36px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, filter: 'drop-shadow(0 0 8px #3b82f660)' }}>{totalConsolidados}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consolidados</div>
                </div>

                {/* CT-e status — linha de baixo (6 colunas) */}
                <div style={{ ...glassCard(t), padding: '14px 16px', gridColumn: '1 / 7', display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ fontSize: '10px', letterSpacing: '2px', color: t.textDim, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status CT-e</span>
                    {[
                        { label: 'Aguardando', valor: statusCte.aguardando, cor: '#f59e0b' },
                        { label: 'Em Emissão', valor: statusCte.emEmissao, cor: '#3b82f6' },
                        { label: 'Emitidos', valor: statusCte.emitido, cor: '#34d399' }
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '32px', fontWeight: '900', color: s.cor, filter: `drop-shadow(0 0 6px ${s.cor}80)` }}>{s.valor}</span>
                            <span style={{ fontSize: '11px', color: t.textMuted }}>{s.label}</span>
                        </div>
                    ))}
                    <div style={{ flex: 1 }} />
                    {dataPieCte.length > 0 && (
                        <ResponsiveContainer width={160} height={60}>
                            <PieChart>
                                <Pie data={dataPieCte} dataKey="value" cx="50%" cy="50%" outerRadius={28} innerRadius={14}>
                                    {dataPieCte.map((_, idx) => <Cell key={idx} fill={CORES_PIE_CTE[idx % CORES_PIE_CTE.length]} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Gráfico de barras — Status de Embarque Geral (ocupa largura total) */}
            <div style={{ ...glassCard(t), padding: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', color: t.textMuted, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>
                    Status de Embarque Geral
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dadosBarrasStatus} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.textMuted }} />
                        <YAxis tick={{ fontSize: 10, fill: t.textMuted }} allowDecimals={false} />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '12px' }}
                            formatter={(value, name, props) => {
                                const entry = props.payload;
                                const total = (entry?.Recife || 0) + (entry?.Moreno || 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                return [`${value} veiculos (${pct}%)`, name];
                            }}
                            labelFormatter={(label, payload) => {
                                if (!payload || payload.length === 0) return label;
                                const full = payload[0]?.payload?.fullName || label;
                                return full;
                            }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '11px', color: t.textMuted }}
                            formatter={(value) => <span style={{ color: value === 'Recife' ? '#3b82f6' : '#f59e0b', fontWeight: '700' }}>{value}</span>}
                        />
                        <Bar dataKey="Recife" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="Recife" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" content={(props) => {
                                const { x, y, width, height, value, payload } = props;
                                if (!value || value <= 0) return null;
                                const total = (payload.Recife || 0) + (payload.Moreno || 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '';
                                return <text x={x + width / 2} y={y + height / 2} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold">{value} ({pct})</text>;
                            }} />
                        </Bar>
                        <Bar dataKey="Moreno" fill="#f59e0b" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="Moreno" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" content={(props) => {
                                const { x, y, width, height, value, payload } = props;
                                if (!value || value <= 0) return null;
                                const total = (payload.Recife || 0) + (payload.Moreno || 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '';
                                return <text x={x + width / 2} y={y + height / 2} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold">{value} ({pct})</text>;
                            }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ================================================================
// TELA 2: OPERACAO RECIFE DETALHADA
// ================================================================
function TelaOperacaoRecife({ veiculos, ctesRecife, docasInterditadas = [], t, tema }) {
    const veiculosRecife = veiculos.filter(v => ehOperacaoRecife(v.operacao));
    const totalRecife = veiculosRecife.length;

    // Sub-contadores
    const contOp = { delta: 0, consolidado: 0, deltaRxM: 0 };
    veiculosRecife.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat === 'delta') contOp.delta++;
        else if (cat === 'consolidado') contOp.consolidado++;
        else if (cat === 'deltaRxM') contOp.deltaRxM++;
    });

    // Status operacional
    const contStatus = {};
    OPCOES_STATUS.forEach(s => { contStatus[s] = 0; });
    veiculosRecife.forEach(v => {
        const st = v.status_recife || 'AGUARDANDO';
        if (contStatus[st] !== undefined) contStatus[st]++;
    });
    const dadosStatus = OPCOES_STATUS.map(s => ({ name: s, value: contStatus[s], fill: CORES_STATUS[s]?.border || '#64748b' }));

    // Docas - mapa de calor por status do card vinculado
    const docasFisicas = DOCAS_RECIFE_LISTA.filter(d => d !== 'SELECIONE');
    const docaStatusMap = {};
    docasFisicas.forEach(d => { docaStatusMap[d] = null; });

    veiculosRecife.forEach(v => {
        const doca = v.doca_recife;
        if (!doca || doca === 'SELECIONE' || !docaStatusMap.hasOwnProperty(doca)) return;
        const statusAtual = v.status_recife || 'AGUARDANDO';

        // REGRA DE NEGÓCIO: Se status for "CARREGADO" ou "LIBERADO P/ CT-e", a doca NÃO está ocupada
        if (statusAtual === 'CARREGADO' || statusAtual === 'LIBERADO P/ CT-e') {
            return; // Não contabilizar essa doca como ocupada
        }

        const existente = docaStatusMap[doca];
        // Priorizar status mais avancado se houver conflito
        if (!existente || (PRIORIDADE_STATUS[statusAtual] || 0) > (PRIORIDADE_STATUS[existente] || 0)) {
            docaStatusMap[doca] = statusAtual;
        }
    });

    // Sobreescrever docas interditadas (Fulgaz)
    docasInterditadas.filter(c => c.unidade === 'Recife').forEach(c => {
        if (c.doca && c.doca !== 'SELECIONE') {
            docaStatusMap[c.doca] = 'FULGAZ';
        }
    });

    // Fluxo CT-e para Recife
    const aguardandoCte = veiculosRecife.filter(v => v.status_recife === 'LIBERADO P/ CT-e').length;
    const emEmissaoCte = ctesRecife.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length;
    const emitidoCte = ctesRecife.filter(c => c.status === 'Emitido').length;
    const totalFluxoCte = aguardandoCte + emEmissaoCte + emitidoCte;
    const pct = (v) => totalFluxoCte > 0 ? `${Math.round((v / totalFluxoCte) * 100)}%` : '0%';

    return (
        <div className="tv-card-anim">
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#60a5fa', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Operação Recife · Detalhada
            </h2>

            {/* CONTADOR GERAL CENTRALIZADO */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ ...glassCard(t, '#3b82f660'), padding: '24px', textAlign: 'center', borderLeft: '4px solid #3b82f6', width: '100%', maxWidth: '400px', transition: 'all 0.5s ease-in-out' }}>
                    <div style={{ fontSize: '72px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, filter: 'drop-shadow(0 0 12px #3b82f680)' }}>{totalRecife}</div>
                    <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '6px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Recife</div>
                </div>
            </div>

            {/* GRID DOS SUB-CONTADORES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                {[
                    { label: 'Delta 100%', valor: contOp.delta, cor: '#2563eb' },
                    { label: 'Consolidado', valor: contOp.consolidado, cor: '#3b82f6' },
                    { label: 'Delta R/M', valor: contOp.deltaRxM, cor: '#60a5fa' }
                ].map(c => (
                    <div key={c.label} style={{ ...glassCard(t, `${c.cor}40`), padding: '20px', textAlign: 'center', borderTop: `3px solid ${c.cor}`, transition: 'all 0.5s ease-in-out' }}>
                        <div style={{ fontSize: '44px', fontWeight: '900', color: c.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${c.cor}60)` }}>{c.valor}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{c.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Coluna esquerda: Docas + Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ ...glassCard(t), padding: '16px' }}>
                        <h3 style={{ color: t.textMuted, fontSize: '11px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>Gestão Visual de Docas</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {docasFisicas.map(doca => {
                                const statusDoca = docaStatusMap[doca];
                                const cor = statusDoca ? CORES_STATUS[statusDoca] : null;
                                const livre = !statusDoca;
                                const bgCor = livre ? 'rgba(52,211,153,0.10)' : (cor ? `${cor.border}20` : 'transparent');
                                const borderCor = livre ? '#34d399' : (cor ? cor.border : 'transparent');
                                const textCor = livre ? '#34d399' : (cor ? cor.text : 'inherit');

                                if (statusDoca === 'FULGAZ') {
                                    return (
                                        <div key={doca} style={{
                                            padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                                            background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                                            boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)', transition: 'all 0.5s ease-in-out'
                                        }}>
                                            <div style={{ fontSize: '11px', fontWeight: '900', color: '#fca5a5', filter: 'drop-shadow(0 0 4px #ef4444)' }}>{doca}</div>
                                            <div style={{ fontSize: '8px', color: '#ef4444', marginTop: '4px', fontWeight: '900', letterSpacing: '0.5px' }}>CONTAINER</div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={doca} style={{
                                        padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                                        background: bgCor, border: `1px solid ${borderCor}50`,
                                        transition: 'all 0.5s ease-in-out',
                                        boxShadow: livre ? '0 0 8px rgba(52,211,153,0.2)' : 'none'
                                    }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: textCor, ...(livre ? { filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.8))' } : {}) }}>{doca}</div>
                                        <div style={{ fontSize: '8px', color: livre ? '#34d399' : t.textDim, marginTop: '2px', fontWeight: livre ? '700' : 'normal' }}>{statusDoca || 'Livre'}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ ...glassCard(t), padding: '16px' }}>
                        <h3 className="text-2xl font-black uppercase text-slate-800" style={{ marginBottom: '10px', color: tema === 'light' ? '#1e293b' : '#f8fafc' }}>Status de Embarque</h3>
                        <StatusBars dados={dadosStatus} t={t} />
                    </div>
                </div>

                {/* Coluna direita: Fluxo CT-e */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '2px', paddingLeft: '4px', marginBottom: '2px' }}>Fluxo CT-e Recife</div>
                    {[
                        { label: 'Aguardando Emissão', valor: aguardandoCte, cor: '#f59e0b', desc: 'Cards "Liberado p/ CT-e"' },
                        { label: 'Em Emissão', valor: emEmissaoCte, cor: '#3b82f6', desc: 'CT-es sendo emitidos' },
                        { label: 'Emitido', valor: emitidoCte, cor: '#34d399', desc: 'CT-es finalizados' }
                    ].map(item => (
                        <div key={item.label} style={{ ...glassCard(t, `${item.cor}30`), padding: '14px 18px', borderLeft: `4px solid ${item.cor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.5s ease-in-out', flex: 1 }}>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: t.text }}>{item.label}</div>
                                <div style={{ fontSize: '10px', color: t.textDim }}>{item.desc}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '32px', fontWeight: '900', color: item.cor, filter: `drop-shadow(0 0 6px ${item.cor}60)` }}>{item.valor}</span>
                                <span style={{ fontSize: '12px', color: t.textMuted, marginLeft: '8px' }}>{pct(item.valor)}</span>
                            </div>
                        </div>
                    ))}

                </div>
            </div>
        </div>
    );
}

// ================================================================
// TELA 4: FLUXO MENSAL
// ================================================================
function TelaFluxoMensal({ veiculos, t, tema }) {
    // Filtrar apenas veículos do mês atual usando horário de Brasília
    const agora = new Date();
    const dataBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const primeiroDiaMes = new Date(dataBrasilia.getFullYear(), dataBrasilia.getMonth(), 1);
    const ultimoDiaMes = new Date(dataBrasilia.getFullYear(), dataBrasilia.getMonth() + 1, 0);

    const formatarData = (data) => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    const primeiroDiaMesStr = formatarData(primeiroDiaMes);
    const ultimoDiaMesStr = formatarData(ultimoDiaMes);

    const veiculosMesAtual = veiculos.filter(v => {
        const dataCard = v.data_prevista || v.data_criacao || '';
        return dataCard >= primeiroDiaMesStr && dataCard <= ultimoDiaMesStr;
    });

    const totalMes = veiculosMesAtual.length;
    const mesNome = dataBrasilia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Contadores por tipo de operação
    const contadores = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
    veiculosMesAtual.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat && contadores[cat] !== undefined) contadores[cat]++;
    });

    // Contadores por unidade (Mutuamente exclusivos para soma bater 100%)
    const recifeOnly = veiculosMesAtual.filter(v => ehOperacaoRecife(v.operacao) && !ehOperacaoMoreno(v.operacao)).length;
    const morenoOnly = veiculosMesAtual.filter(v => !ehOperacaoRecife(v.operacao) && ehOperacaoMoreno(v.operacao)).length;
    const ambasMes = veiculosMesAtual.filter(v => ehOperacaoRecife(v.operacao) && ehOperacaoMoreno(v.operacao)).length;


    // Dados para gráfico de pizza - Distribuição por operação
    const dadosPieOp = [
        { name: 'Delta', value: contadores.delta, fill: CORES_KPI.delta },
        { name: 'Consolidado', value: contadores.consolidado, fill: CORES_KPI.consolidado },
        { name: 'Delta R/M', value: contadores.deltaRxM, fill: CORES_KPI.deltaRxM },
        { name: 'Porcelana', value: contadores.porcelana, fill: CORES_KPI.porcelana },
        { name: 'Eletrik', value: contadores.eletrik, fill: CORES_KPI.eletrik }
    ].filter(d => d.value > 0);

    // Dados para gráfico comparativo Recife vs Moreno
    const dadosUnidades = [
        { name: 'Só Recife', value: recifeOnly, fill: '#3b82f6' },
        { name: 'Só Moreno', value: morenoOnly, fill: '#60a5fa' },
        { name: 'Ambas', value: ambasMes, fill: '#818cf8' }
    ].filter(d => d.value > 0);

    return (
        <div className="tv-card-anim">
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#22d3ee', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Fluxo Mensal · {mesNome}
            </h2>

            {/* CONTADOR GERAL (TOTAL) CENTRALIZADO E MAIOR */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ ...glassCard(t, '#3b82f660'), padding: '24px', textAlign: 'center', borderLeft: '4px solid #3b82f6', width: '100%', maxWidth: '400px', transition: 'all 0.5s ease-in-out' }}>
                    <div style={{ fontSize: '72px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, filter: 'drop-shadow(0 0 16px #3b82f680)' }}>{totalMes}</div>
                    <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>Embarques do Mês</div>
                    <div style={{ fontSize: '10px', color: t.textDim, marginTop: '4px' }}>
                        {new Date(primeiroDiaMes).toLocaleDateString('pt-BR')} – {new Date(ultimoDiaMes).toLocaleDateString('pt-BR')}
                    </div>
                </div>
            </div>

            {/* GRID DOS SUB-CONTADORES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                {[
                    { label: 'Delta', valor: contadores.delta, cor: CORES_KPI.delta },
                    { label: 'Consolidado', valor: contadores.consolidado, cor: CORES_KPI.consolidado },
                    { label: 'Delta R/M', valor: contadores.deltaRxM, cor: CORES_KPI.deltaRxM },
                    { label: 'Porcelana', valor: contadores.porcelana, cor: CORES_KPI.porcelana },
                    { label: 'Eletrik', valor: contadores.eletrik, cor: CORES_KPI.eletrik }
                ].map(kpi => (
                    <div key={kpi.label} style={{ ...glassCard(t, `${kpi.cor}40`), padding: '16px 10px', textAlign: 'center', borderTop: `3px solid ${kpi.cor}`, transition: 'all 0.5s ease-in-out' }}>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: kpi.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${kpi.cor}60)` }}>{kpi.valor}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                <div style={{ ...glassCard(t), padding: '16px' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginBottom: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Distribuição por Unidade</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '40px', fontWeight: '900', color: '#3b82f6', filter: 'drop-shadow(0 0 8px #3b82f660)' }}>{recifeOnly}</div>
                            <div style={{ fontSize: '11px', color: '#93c5fd' }}>Só Recife</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '40px', fontWeight: '900', color: '#60a5fa', filter: 'drop-shadow(0 0 8px #60a5fa60)' }}>{morenoOnly}</div>
                            <div style={{ fontSize: '11px', color: '#93c5fd' }}>Só Moreno</div>
                        </div>
                        {ambasMes > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '40px', fontWeight: '900', color: '#818cf8', filter: 'drop-shadow(0 0 8px #818cf860)' }}>{ambasMes}</div>
                                <div style={{ fontSize: '11px', color: '#a5b4fc' }}>Ambas (R/M)</div>
                            </div>
                        )}
                    </div>
                    {dadosUnidades.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={dadosUnidades}>
                                <XAxis dataKey="name" stroke={t.textDim} fontSize={11} />
                                <YAxis stroke={t.textDim} fontSize={10} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '10px', color: t.text }}
                                    formatter={(value, name) => {
                                        const total = dadosUnidades.reduce((a, d) => a + d.value, 0);
                                        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                        return [`${value} (${pct}%)`, name];
                                    }}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                    {dadosUnidades.map((d, idx) => <Cell key={idx} fill={d.fill} />)}
                                    <LabelList dataKey="value" position="center" fill="#ffffff" fontSize={14} fontWeight="bold" formatter={(val) => {
                                        const total = dadosUnidades.reduce((a, d) => a + d.value, 0);
                                        const pct = total > 0 ? ((val / total) * 100).toFixed(0) + '%' : '';
                                        return val > 0 ? `${val} (${pct})` : '';
                                    }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '30px', color: t.textDim }}>Sem dados</div>}
                </div>

                <div style={{ ...glassCard(t), padding: '16px' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginBottom: '10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Distribuição por Operação</h3>
                    {dadosPieOp.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={dadosPieOp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => {
                                    const totalPie = dadosPieOp.reduce((a, d) => a + d.value, 0);
                                    const pct = totalPie > 0 ? ((value / totalPie) * 100).toFixed(0) + '%' : '';
                                    return `${name}: ${value} (${pct})`;
                                }} labelLine={false} style={{ fontSize: '11px' }}>
                                    {dadosPieOp.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '10px', color: t.text }}
                                    formatter={(value, name, props) => {
                                        const totalPie = dadosPieOp.reduce((a, d) => a + d.value, 0);
                                        const pct = totalPie > 0 ? ((value / totalPie) * 100).toFixed(1) : '0.0';
                                        return [`${value} (${pct}%)`, name];
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '40px', color: t.textDim }}>Sem dados</div>}
                </div>
            </div>
        </div>
    );
}

// ================================================================
// COMPONENTE: BARRAS DE STATUS
// ================================================================
function StatusBars({ dados, t }) {
    const max = Math.max(...dados.map(d => d.value), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {dados.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '130px', fontSize: '10px', color: t.textMuted, textAlign: 'right', flexShrink: 0 }}>{d.name}</span>
                    <div style={{ flex: 1, height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{
                            width: `${(d.value / max) * 100}%`, height: '100%',
                            background: `linear-gradient(90deg, ${d.fill}90, ${d.fill})`,
                            borderRadius: '10px',
                            transition: 'width 0.5s ease-in-out',
                            minWidth: d.value > 0 ? '4px' : 0,
                            boxShadow: d.value > 0 ? `0 0 6px ${d.fill}60` : 'none'
                        }} />
                    </div>
                    <span style={{ width: '28px', fontSize: '13px', fontWeight: '700', color: d.fill, filter: d.value > 0 ? `drop-shadow(0 0 4px ${d.fill}80)` : 'none' }}>{d.value}</span>
                </div>
            ))}
        </div>
    );
}

// ================================================================
// TELA 3: OPERACAO MORENO DETALHADA
// ================================================================
function TelaOperacaoMoreno({ veiculos, ctesMoreno, docasInterditadas = [], t, tema }) {
    const veiculosMoreno = veiculos.filter(v => ehOperacaoMoreno(v.operacao));
    const totalMoreno = veiculosMoreno.length;

    // Sub-contadores
    const contOp = { porcelana: 0, eletrik: 0, deltaMoreno: 0, deltaRxM: 0 };
    veiculosMoreno.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat === 'porcelana') contOp.porcelana++;
        else if (cat === 'eletrik') contOp.eletrik++;
        else if (cat === 'deltaRxM') contOp.deltaRxM++;
        else if (v.operacao && v.operacao.includes('DELTA(MORENO)')) contOp.deltaMoreno++;
    });

    // Status operacional
    const contStatus = {};
    OPCOES_STATUS.forEach(s => { contStatus[s] = 0; });
    veiculosMoreno.forEach(v => {
        const st = v.status_moreno || 'AGUARDANDO';
        if (contStatus[st] !== undefined) contStatus[st]++;
    });
    const dadosStatus = OPCOES_STATUS.map(s => ({ name: s, value: contStatus[s], fill: CORES_STATUS[s]?.border || '#64748b' }));

    // Docas - mapa de calor por status do card vinculado
    const docasFisicas = DOCAS_MORENO_LISTA.filter(d => d !== 'SELECIONE');
    const docaStatusMap = {};
    docasFisicas.forEach(d => { docaStatusMap[d] = null; });

    veiculosMoreno.forEach(v => {
        const doca = v.doca_moreno;
        if (!doca || doca === 'SELECIONE' || !docaStatusMap.hasOwnProperty(doca)) return;
        const statusAtual = v.status_moreno || 'AGUARDANDO';

        // REGRA DE NEGOCIO: Se status for "CARREGADO" ou "LIBERADO P/ CT-e", a doca NAO esta ocupada
        if (statusAtual === 'CARREGADO' || statusAtual === 'LIBERADO P/ CT-e') {
            return;
        }

        const existente = docaStatusMap[doca];
        if (!existente || (PRIORIDADE_STATUS[statusAtual] || 0) > (PRIORIDADE_STATUS[existente] || 0)) {
            docaStatusMap[doca] = statusAtual;
        }
    });

    // Sobreescrever docas interditadas (Fulgaz)
    docasInterditadas.filter(c => c.unidade === 'Moreno').forEach(c => {
        if (c.doca && c.doca !== 'SELECIONE') {
            docaStatusMap[c.doca] = 'FULGAZ';
        }
    });

    // Fluxo CT-e para Moreno
    const aguardandoCte = veiculosMoreno.filter(v => v.status_moreno === 'LIBERADO P/ CT-e').length;
    const emEmissaoCte = ctesMoreno.filter(c => c.status === 'Em Emissão' || c.status === 'Em Emissao').length;
    const emitidoCte = ctesMoreno.filter(c => c.status === 'Emitido').length;
    const totalFluxoCte = aguardandoCte + emEmissaoCte + emitidoCte;
    const pct = (v) => totalFluxoCte > 0 ? `${Math.round((v / totalFluxoCte) * 100)}%` : '0%';

    const renderDoca = (doca) => {
        const statusDoca = docaStatusMap[doca];
        const cor = statusDoca ? CORES_STATUS[statusDoca] : null;
        const livre = !statusDoca;
        const bgCor = livre ? 'rgba(52,211,153,0.10)' : (cor ? `${cor.border}20` : 'transparent');
        const borderCor = livre ? '#34d399' : (cor ? cor.border : 'transparent');
        const textCor = livre ? '#34d399' : (cor ? cor.text : 'inherit');

        if (statusDoca === 'FULGAZ') {
            return (
                <div key={doca} style={{
                    padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                    background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)', transition: 'all 0.5s ease-in-out'
                }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#fca5a5', filter: 'drop-shadow(0 0 4px #ef4444)' }}>{doca}</div>
                    <div style={{ fontSize: '8px', color: '#ef4444', marginTop: '4px', fontWeight: '900', letterSpacing: '0.5px' }}>CONTAINER</div>
                </div>
            );
        }

        return (
            <div key={doca} style={{
                padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                background: bgCor, border: `1px solid ${borderCor}50`,
                transition: 'all 0.5s ease-in-out',
                boxShadow: livre ? '0 0 8px rgba(52,211,153,0.2)' : 'none'
            }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: textCor, ...(livre ? { filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.8))' } : {}) }}>{doca}</div>
                <div style={{ fontSize: '8px', color: livre ? '#34d399' : t.textDim, marginTop: '2px', fontWeight: livre ? '700' : 'normal' }}>{statusDoca || 'Livre'}</div>
            </div>
        );
    };

    return (
        <div className="tv-card-anim">
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#fbbf24', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Operação Moreno - Detalhada
            </h2>

            {(() => {
                const consolidadosMoreno = veiculosMoreno.filter(v =>
                    classificarOperacao(v.operacao) === 'consolidado'
                ).length;
                return (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <div style={{ ...glassCard(t, '#3b82f660'), padding: '24px', textAlign: 'center', borderLeft: '4px solid #3b82f6', width: '100%', maxWidth: '400px', transition: 'all 0.5s ease-in-out' }}>
                                <div style={{ fontSize: '72px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, filter: 'drop-shadow(0 0 12px #3b82f680)' }}>{totalMoreno}</div>
                                <div style={{ fontSize: '12px', color: '#93c5fd', marginTop: '6px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Moreno</div>
                            </div>
                        </div>

                        {/* GRID DOS SUB-CONTADORES (Abaixo do Total) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                            {[
                                { label: '100% Porcelana', valor: contOp.porcelana, cor: '#1d4ed8' },
                                { label: 'Eletrik', valor: contOp.eletrik, cor: '#2563eb' },
                                { label: 'Delta Moreno', valor: contOp.deltaMoreno, cor: '#3b82f6' },
                                { label: 'Delta R/M', valor: contOp.deltaRxM, cor: '#60a5fa' },
                                { label: 'Consolidados', valor: consolidadosMoreno, cor: '#93c5fd' }
                            ].map(c => (
                                <div key={c.label} style={{ ...glassCard(t, `${c.cor}40`), padding: '20px', textAlign: 'center', borderTop: `3px solid ${c.cor}`, transition: 'all 0.5s ease-in-out' }}>
                                    <div style={{ fontSize: '44px', fontWeight: '900', color: c.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${c.cor}60)` }}>{c.valor}</div>
                                    <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* GESTÃO VISUAL DE DOCAS - MORENO (DIVIDIDO) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {/* SESSÃO 1: PORCELANA */}
                        <div style={{ ...glassCard(t), padding: '16px' }}>
                            <h2 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: tema === 'light' ? '#334155' : '#f8fafc' }}>
                                <Warehouse size={16} color="#64748b" />
                                Gestão Visual Docas - Porcelana
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {docasFisicas.filter(d => d.includes('PORCELANA')).map(doca => renderDoca(doca))}
                            </div>
                        </div>

                        {/* SESSÃO 2: DELTA E ELETRIK */}
                        <div style={{ ...glassCard(t), padding: '16px' }}>
                            <h2 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: tema === 'light' ? '#334155' : '#f8fafc' }}>
                                <Warehouse size={16} color="#64748b" />
                                Gestão Visual Docas - Delta e Eletrik
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {docasFisicas.filter(d => d.includes('DELTA') || d.includes('ELETRIK')).map(doca => renderDoca(doca))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ ...glassCard(t), padding: '16px' }}>
                            <h3 className="text-2xl font-black uppercase text-slate-800" style={{ marginBottom: '10px', color: tema === 'light' ? '#1e293b' : '#f8fafc' }}>Status de Embarque</h3>
                            <StatusBars dados={dadosStatus} t={t} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '2px', paddingLeft: '4px', marginBottom: '2px' }}>Fluxo CT-e Moreno</div>
                            {[
                                { label: 'Aguardando Emissão', valor: aguardandoCte, cor: '#f59e0b', desc: 'Cards "Liberado p/ CT-e"' },
                                { label: 'Em Emissão', valor: emEmissaoCte, cor: '#3b82f6', desc: 'CT-es sendo emitidos' },
                                { label: 'Emitido', valor: emitidoCte, cor: '#34d399', desc: 'CT-es finalizados' }
                            ].map(item => (
                                <div key={item.label} style={{ ...glassCard(t, `${item.cor}30`), padding: '14px 18px', borderLeft: `4px solid ${item.cor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.5s ease-in-out', flex: 1 }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: t.text }}>{item.label}</div>
                                        <div style={{ fontSize: '10px', color: t.textDim }}>{item.desc}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '32px', fontWeight: '900', color: item.cor, filter: `drop-shadow(0 0 6px ${item.cor}60)` }}>{item.valor}</span>
                                        <span style={{ fontSize: '12px', color: t.textMuted, marginLeft: '8px' }}>{pct(item.valor)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
