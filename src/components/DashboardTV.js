import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Warehouse, AlertTriangle } from 'lucide-react';
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
    if (op === 'DELTA(RECIFE)' || op === 'DELTA(MORENO)') return 'delta';
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

export default function DashboardTV({ listaVeiculos, ctesRecife, ctesMoreno, onSair, socket }) {
    const [telaAtiva, setTelaAtiva] = useState(0);
    const [pausado, setPausado] = useState(false);
    const [tempoRotacao, setTempoRotacao] = useState(20);
    const [tema, setTema] = useState('dark');
    const [docasInterditadas, setDocasInterditadas] = useState([]);
    const [ocorrenciasHoje, setOcorrenciasHoje] = useState([]);
    const [paletesHoje, setPaletesHoje] = useState([]);
    const totalTelas = 5;
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
        const hoje = obterDataBrasilia();
        const fetchDocas = () => {
            api.get('/api/docas-interditadas').then(r => {
                if (!unmounted && r.data && r.data.success) {
                    setDocasInterditadas(r.data.docas);
                }
            }).catch(() => { });
        };
        const fetchOcorrencias = () => {
            api.get('/api/ocorrencias').then(r => {
                if (!unmounted && r.data?.success) {
                    const hoje_ = hoje;
                    setOcorrenciasHoje((r.data.ocorrencias || []).filter(o =>
                        (o.data_criacao || '').substring(0, 10) === hoje_
                    ));
                }
            }).catch(() => { });
        };
        const fetchPaletes = () => {
            api.get('/api/saldo-paletes').then(r => {
                if (!unmounted && r.data?.success) setPaletesHoje(r.data.registros || []);
            }).catch(() => { });
        };

        // Carga inicial
        fetchDocas(); fetchOcorrencias(); fetchPaletes();

        // Atualizar via socket em vez de polling
        const handleDocas = () => { if (!unmounted) fetchDocas(); };
        const handleOcorrencias = () => { if (!unmounted) fetchOcorrencias(); };
        const handlePaletes = () => { if (!unmounted) fetchPaletes(); };

        if (socket) {
            socket.on('docas_interditadas_update', handleDocas);
            socket.on('ocorrencias_update', handleOcorrencias);
            socket.on('saldo_paletes_update', handlePaletes);
        }

        return () => {
            unmounted = true;
            if (socket) {
                socket.off('docas_interditadas_update', handleDocas);
                socket.off('ocorrencias_update', handleOcorrencias);
                socket.off('saldo_paletes_update', handlePaletes);
            }
        };
    }, [socket]);

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
    const nomeTelas = [`Embarques da Operacao ${dataHoje}`, 'Operacao Recife', 'Operacao Moreno', 'Paletes Diario', 'Fluxo Mensal'];

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                    {/* Logotipo Asset */}
                    <div style={{ padding: '0 5px' }}>
                        <img
                            src={logoImg}
                            alt="TRANSNET"
                            className="animate-wind"
                            style={{
                                height: '100px',
                                width: 'auto',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
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
                {telaAtiva === 0 && <TelaVisaoGeral veiculos={veiculosHoje} ctesRecife={ctesRecife} ctesMoreno={ctesMoreno} t={t} tema={tema} dataHoje={dataHoje} ocorrenciasHoje={ocorrenciasHoje} />}
                {telaAtiva === 1 && <TelaOperacaoRecife veiculos={veiculosHoje} ctesRecife={ctesRecife} docasInterditadas={docasInterditadas} t={t} tema={tema} ocorrenciasHoje={ocorrenciasHoje} />}
                {telaAtiva === 2 && <TelaOperacaoMoreno veiculos={veiculosHoje} ctesMoreno={ctesMoreno} docasInterditadas={docasInterditadas} t={t} tema={tema} ocorrenciasHoje={ocorrenciasHoje} />}
                {telaAtiva === 3 && <TelaPaletesDiario paletes={paletesHoje} t={t} tema={tema} />}
                {telaAtiva === 4 && <TelaFluxoMensal veiculos={listaVeiculos} paletes={paletesHoje} t={t} tema={tema} ocorrenciasHoje={ocorrenciasHoje} />}
            </div>

            {/* Rodape */}
            <div style={{ padding: '6px 20px', background: t.bgBar, borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.textDim, flexShrink: 0 }}>
                <span>{nomeTelas[telaAtiva]} ({telaAtiva + 1}/{totalTelas})</span>
                <span>{new Date().toLocaleString('pt-BR')}</span>
                <span>ESC para sair | {veiculosHoje.length} veiculos hoje | {paletesHoje.length} paletes reg.</span>
            </div>

        </div>
    );
}

const btnS = (t) => ({ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.text, cursor: 'pointer', fontSize: '12px' });

// ================================================================
// TELA 1: VISAO GERAL
// ================================================================
function TelaVisaoGeral({ veiculos, ctesRecife, ctesMoreno, t, tema, dataHoje, ocorrenciasHoje = [] }) {
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
        { label: 'Delta 100%', valor: contadores.delta, cor: CORES_KPI.delta },
        { label: 'Consolidado', valor: contadores.consolidado, cor: CORES_KPI.consolidado },
        { label: 'Delta (RxM)', valor: contadores.deltaRxM, cor: CORES_KPI.deltaRxM },
        { label: '100% Porcelana', valor: contadores.porcelana, cor: CORES_KPI.porcelana },
        { label: 'Eletrik', valor: contadores.eletrik, cor: CORES_KPI.eletrik }
    ];

    const dataPieCte = [
        { name: 'Aguardando', value: statusCte.aguardando },
        { name: 'Em Emissao', value: statusCte.emEmissao },
        { name: 'Emitido', value: statusCte.emitido }
    ].filter(d => d.value > 0);

    // Dados para gráfico de barras de status geral (Recife + Moreno separados)
    const dadosBarrasStatus = OPCOES_STATUS.map(s => ({
        name: s.replace('LIBERADO P/ ', 'LIB ').replace('EM ', ''),
        fullName: s,
        Recife: veiculos.filter(v => ehOperacaoRecife(v.operacao) && (v.status_recife === s || (s === 'LIBERADO P/ CT-e' && !!v.cte_antecipado_recife))).length,
        Moreno: veiculos.filter(v => ehOperacaoMoreno(v.operacao) && (v.status_moreno === s || (s === 'LIBERADO P/ CT-e' && !!v.cte_antecipado_moreno))).length,
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: '14px', marginBottom: '20px' }}>

                {/* KPI Cards — linha de cima (operação) */}
                {kpis.map(kpi => (
                    <div key={kpi.label} style={{ ...glassCard(t, `${kpi.cor}40`), padding: '16px 12px', textAlign: 'center', borderTop: `3px solid ${kpi.cor}` }}>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: kpi.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${kpi.cor}60)` }}>{kpi.valor}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                    </div>
                ))}

                {/* Ocorrências do dia — sempre visível */}
                <div style={{ ...glassCard(t, 'rgba(245,158,11,0.35)'), padding: '14px 16px', gridColumn: '1 / 6', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid #f59e0b' }}>
                    <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', letterSpacing: '2px', color: '#fbbf24', textTransform: 'uppercase', whiteSpace: 'nowrap', fontWeight: '700' }}>Ocorrências Hoje</span>
                    <span style={{ fontSize: '36px', fontWeight: '900', color: '#fbbf24', filter: 'drop-shadow(0 0 8px #f59e0b80)', lineHeight: 1 }}>{ocorrenciasHoje.length}</span>
                    <div style={{ height: '32px', width: '1px', background: 'rgba(245,158,11,0.3)' }} />
                    {[
                        { label: 'Recife', count: ocorrenciasHoje.filter(o => !o.unidade || o.unidade === 'Recife').length, cor: '#60a5fa' },
                        { label: 'Moreno', count: ocorrenciasHoje.filter(o => o.unidade === 'Moreno').length, cor: '#fb923c' }
                    ].map(u => (
                        <div key={u.label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: u.cor }}>{u.count}</span>
                            <span style={{ fontSize: '11px', color: t.textMuted }}>{u.label}</span>
                        </div>
                    ))}
                </div>

                {/* CT-e status — linha de baixo (ocupando as 5 colunas agora) */}
                <div style={{ ...glassCard(t), padding: '14px 16px', gridColumn: '1 / 6', display: 'flex', alignItems: 'center', gap: '24px' }}>
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
                    <BarChart data={dadosBarrasStatus} margin={{ top: 20, right: 20, left: -15, bottom: 5 }}>
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
                            <LabelList dataKey="Recife" position="top" fill="#a5b4fc" fontSize={13} fontWeight="bold" content={(props) => {
                                const { x, y, width, value } = props;
                                if (!value || value <= 0) return null;
                                return <text x={x + width / 2} y={y - 4} fill="#a5b4fc" textAnchor="middle" dominantBaseline="auto" fontSize={13} fontWeight="bold">{value}</text>;
                            }} />
                        </Bar>
                        <Bar dataKey="Moreno" fill="#f59e0b" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="Moreno" position="top" fill="#fde68a" fontSize={13} fontWeight="bold" content={(props) => {
                                const { x, y, width, value } = props;
                                if (!value || value <= 0) return null;
                                return <text x={x + width / 2} y={y - 4} fill="#fde68a" textAnchor="middle" dominantBaseline="auto" fontSize={13} fontWeight="bold">{value}</text>;
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
function TelaOperacaoRecife({ veiculos, ctesRecife, docasInterditadas = [], t, tema, ocorrenciasHoje = [] }) {
    const veiculosRecife = veiculos.filter(v => ehOperacaoRecife(v.operacao));
    const totalRecife = veiculosRecife.length;
    const [hoveredDocaR, setHoveredDocaR] = useState(null);

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
        if (v.cte_antecipado_recife && st !== 'LIBERADO P/ CT-e') contStatus['LIBERADO P/ CT-e']++;
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
        if (statusAtual === 'CARREGADO' || statusAtual === 'LIBERADO P/ CT-e' || v.cte_antecipado_recife) {
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

    // Mapa doca → veículo para tooltip
    const docaVeiculoMapR = {};
    veiculosRecife.forEach(v => {
        if (v.status_recife === 'CARREGADO' || v.status_recife === 'LIBERADO P/ CT-e' || v.cte_antecipado_recife) return;
        const doca = v.doca_recife;
        if (!doca || doca === 'SELECIONE') return;
        docaVeiculoMapR[doca] = { motorista: v.motorista, coleta: v.coletaRecife || v.coleta || '' };
    });

    // Fluxo CT-e para Recife
    const aguardandoCte = ctesRecife.filter(c => c.status === 'Aguardando Emissão' || c.status === 'Aguardando Emissao').length;
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                {[
                    { label: 'Delta 100%', valor: contOp.delta, cor: '#2563eb' },
                    { label: 'Consolidado', valor: contOp.consolidado, cor: '#3b82f6' },
                    { label: 'Delta R/M', valor: contOp.deltaRxM, cor: '#60a5fa' },
                    { label: 'Ocorrências Hoje', valor: ocorrenciasHoje.filter(o => !o.unidade || o.unidade === 'Recife').length, cor: '#f59e0b', icon: true }
                ].map(c => (
                    <div key={c.label} style={{ ...glassCard(t, `${c.cor}40`), padding: '20px', textAlign: 'center', borderTop: `3px solid ${c.cor}`, transition: 'all 0.5s ease-in-out' }}>
                        <div style={{ fontSize: '44px', fontWeight: '900', color: c.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${c.cor}60)` }}>{c.valor}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {c.icon && <AlertTriangle size={10} color="#f59e0b" />}{c.label}
                        </div>
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
                                const veiculo = docaVeiculoMapR[doca];
                                const isHovered = hoveredDocaR === doca;

                                if (statusDoca === 'FULGAZ') {
                                    return (
                                        <div key={doca} style={{
                                            padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                                            background: tema === 'light' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                                            border: `1px solid ${tema === 'light' ? '#dc2626' : '#ef4444'}`,
                                            boxShadow: tema === 'light' ? '0 2px 8px rgba(220, 38, 38, 0.25)' : '0 0 12px rgba(239, 68, 68, 0.4)',
                                            transition: 'all 0.5s ease-in-out', position: 'relative', cursor: 'default'
                                        }}
                                            onMouseEnter={() => setHoveredDocaR(doca)}
                                            onMouseLeave={() => setHoveredDocaR(null)}
                                        >
                                            <div style={{
                                                fontSize: '11px', fontWeight: '900',
                                                color: tema === 'light' ? '#991b1b' : '#fca5a5',
                                                filter: tema === 'light' ? 'none' : 'drop-shadow(0 0 4px #ef4444)'
                                            }}>{doca}</div>
                                            <div style={{
                                                fontSize: '8px',
                                                color: tema === 'light' ? '#dc2626' : '#ef4444',
                                                marginTop: '4px', fontWeight: '900', letterSpacing: '0.5px'
                                            }}>CONTAINER</div>
                                            {isHovered && veiculo && (
                                                <div style={{
                                                    position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                                                    background: tema === 'light' ? '#1e293b' : '#0f172a',
                                                    border: '1px solid #3b82f6', borderRadius: '8px',
                                                    padding: '8px 12px', zIndex: 999, whiteSpace: 'nowrap',
                                                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                                    pointerEvents: 'none'
                                                }}>
                                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>{veiculo.motorista}</div>
                                                    {veiculo.coleta && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Coleta {veiculo.coleta}</div>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div key={doca} style={{
                                        padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                                        background: bgCor, border: `1px solid ${borderCor}${tema === 'light' ? '80' : '50'}`,
                                        transition: 'all 0.5s ease-in-out',
                                        boxShadow: livre && tema === 'dark' ? '0 0 8px rgba(52,211,153,0.2)' : 'none',
                                        position: 'relative', cursor: veiculo ? 'default' : 'default'
                                    }}
                                        onMouseEnter={() => setHoveredDocaR(doca)}
                                        onMouseLeave={() => setHoveredDocaR(null)}
                                    >
                                        <div style={{
                                            fontSize: '12px', fontWeight: '700', color: textCor,
                                            ...(livre && tema === 'dark' ? { filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.8))' } : {})
                                        }}>{doca}</div>
                                        <div style={{
                                            fontSize: '8px',
                                            color: livre ? (tema === 'light' ? '#059669' : '#34d399') : t.textDim,
                                            marginTop: '2px', fontWeight: livre ? '700' : 'normal'
                                        }}>{statusDoca || 'Livre'}</div>
                                        {isHovered && veiculo && (
                                            <div style={{
                                                position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                                                background: tema === 'light' ? '#1e293b' : '#0f172a',
                                                border: '1px solid #3b82f6', borderRadius: '8px',
                                                padding: '8px 12px', zIndex: 999, whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                                pointerEvents: 'none'
                                            }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>{veiculo.motorista}</div>
                                                {veiculo.coleta && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Coleta {veiculo.coleta}</div>}
                                            </div>
                                        )}
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
                        { label: 'Aguardando Emissão', valor: aguardandoCte, cor: '#f59e0b', desc: 'CT-es "Aguardando Emissão"' },
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
const DIAS_SEMANA_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function normalizarDataStr(d) {
    if (!d) return '';
    if (d.includes('/')) {
        const p = d.split('/');
        return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }
    return d.substring(0, 10);
}

function TelaFluxoMensal({ veiculos, paletes = [], t, tema, ocorrenciasHoje = [] }) {
    const [ocorrenciasMes, setOcorrenciasMes] = useState([]);
    const [ctesMes, setCtesMes] = useState([]);

    const agora = new Date();
    const dataBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const primeiroDiaMes = new Date(dataBrasilia.getFullYear(), dataBrasilia.getMonth(), 1);
    const ultimoDiaMes = new Date(dataBrasilia.getFullYear(), dataBrasilia.getMonth() + 1, 0);

    const fmt = (data) => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    const primeiroDiaMesStr = fmt(primeiroDiaMes);
    const ultimoDiaMesStr = fmt(ultimoDiaMes);
    const hoje = obterDataBrasilia();

    useEffect(() => {
        api.get('/api/ocorrencias').then(r => {
            if (r.data?.success) {
                setOcorrenciasMes((r.data.ocorrencias || []).filter(o =>
                    (o.data_criacao || '').substring(0, 10) >= primeiroDiaMesStr &&
                    (o.data_criacao || '').substring(0, 10) <= ultimoDiaMesStr
                ));
            }
        }).catch(() => { });
    }, [primeiroDiaMesStr, ultimoDiaMesStr]);

    useEffect(() => {
        api.get(`/ctes?dataInicio=${primeiroDiaMesStr}&dataFim=${ultimoDiaMesStr}`).then(r => {
            if (r.data?.success) setCtesMes(r.data.ctes || []);
        }).catch(() => { });
    }, [primeiroDiaMesStr, ultimoDiaMesStr]);

    const veiculosMesAtual = veiculos.filter(v => {
        const dataCard = v.data_prevista || v.data_criacao || '';
        return dataCard >= primeiroDiaMesStr && dataCard <= ultimoDiaMesStr;
    });

    const totalMes = veiculosMesAtual.length;
    const mesNome = dataBrasilia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const contadores = { delta: 0, consolidado: 0, deltaRxM: 0, porcelana: 0, eletrik: 0 };
    veiculosMesAtual.forEach(v => {
        const cat = classificarOperacao(v.operacao);
        if (cat && contadores[cat] !== undefined) contadores[cat]++;
    });

    const recifeOnly = veiculosMesAtual.filter(v => ehOperacaoRecife(v.operacao) && !ehOperacaoMoreno(v.operacao)).length;
    const morenoOnly = veiculosMesAtual.filter(v => !ehOperacaoRecife(v.operacao) && ehOperacaoMoreno(v.operacao)).length;
    const ambasMes = veiculosMesAtual.filter(v => ehOperacaoRecife(v.operacao) && ehOperacaoMoreno(v.operacao)).length;

    const dadosPieOp = [
        { name: 'Delta', value: contadores.delta, fill: CORES_KPI.delta },
        { name: 'Consolidado', value: contadores.consolidado, fill: CORES_KPI.consolidado },
        { name: 'Delta R/M', value: contadores.deltaRxM, fill: CORES_KPI.deltaRxM },
        { name: 'Porcelana', value: contadores.porcelana, fill: CORES_KPI.porcelana },
        { name: 'Eletrik', value: contadores.eletrik, fill: CORES_KPI.eletrik }
    ].filter(d => d.value > 0);

    const dadosUnidades = [
        { name: 'Só Recife', value: recifeOnly, fill: '#3b82f6' },
        { name: 'Só Moreno', value: morenoOnly, fill: '#60a5fa' },
        { name: 'Ambas', value: ambasMes, fill: '#818cf8' }
    ].filter(d => d.value > 0);

    const paletesMes = paletes.filter(p => {
        const d = p.data_entrada ? String(p.data_entrada).substring(0, 10) : '';
        return d >= primeiroDiaMesStr && d <= ultimoDiaMesStr;
    });
    const pbrMes = paletesMes.reduce((a, p) => a + (p.qtd_pbr || 0), 0);
    const devMes = paletesMes.reduce((a, p) => a + (p.qtd_devolvida_pbr || 0), 0);
    const saldoMes = pbrMes - devMes;
    const pendMes = paletesMes.filter(p => !p.devolvido).length;
    const dadosPaletePie = [
        { name: 'Devolvidos', value: devMes, fill: '#22c55e' },
        { name: 'Pendentes', value: saldoMes, fill: '#f59e0b' },
    ].filter(d => d.value > 0);

    // ── CT-es do mês ──
    const todosCtes = ctesMes;
    const ctesEmitidosMes = todosCtes.filter(c => c.status === 'Emitido');
    const ctesProximosDias = todosCtes.filter(c => {
        if (c.status === 'Emitido') return false;
        const d = normalizarDataStr(c.data_entrada_cte || '');
        return d > hoje;
    });

    // ── Tabela de coletas por operação por dia ──
    const COLUNAS_OP = [
        { key: 'deltaRecife', label: 'DELTA (RECIFE)', cor: '#3b82f6', match: v => ehOperacaoRecife(v.operacao) && !ehOperacaoMoreno(v.operacao) },
        { key: 'deltaMoreno', label: 'DELTA (MORENO)', cor: '#f59e0b', match: v => classificarOperacao(v.operacao) === 'delta' && ehOperacaoMoreno(v.operacao) && !ehOperacaoRecife(v.operacao) },
        { key: 'porcelana',   label: 'PORCELANA',      cor: '#a78bfa', match: v => classificarOperacao(v.operacao) === 'porcelana' },
        { key: 'eletrik',     label: 'ELETRIK',         cor: '#34d399', match: v => classificarOperacao(v.operacao) === 'eletrik' },
        { key: 'consolidado', label: 'CONSOLIDADO',     cor: '#60a5fa', match: v => classificarOperacao(v.operacao) === 'consolidado' },
        { key: 'deltaRxM',    label: 'DELTA R/M',       cor: '#f472b6', match: v => classificarOperacao(v.operacao) === 'deltaRxM' },
    ];

    // Janela deslizante: D-2, D-1, hoje, D+1, D+2
    const janela5Dias = [];
    for (let i = -2; i <= 2; i++) {
        const dj = new Date(dataBrasilia);
        dj.setDate(dataBrasilia.getDate() + i);
        janela5Dias.push(fmt(dj));
    }
    const veiculosJanela = veiculos.filter(v => {
        const dataCard = v.data_prevista || v.data_criacao || '';
        return dataCard >= janela5Dias[0] && dataCard <= janela5Dias[4];
    });

    // Montar linhas da tabela — todos os 5 dias sempre aparecem
    const linhasTabela = janela5Dias.map(dia => {
        const veicsDia = veiculosJanela.filter(v => (v.data_prevista || v.data_criacao || '') === dia);
        const cells = {};
        let total = 0;
        COLUNAS_OP.forEach(col => {
            const count = veicsDia.filter(col.match).length;
            cells[col.key] = count;
            total += count;
        });
        return { dia, cells, total };
    });

    // Totais por coluna
    const totaisColunas = {};
    COLUNAS_OP.forEach(col => {
        totaisColunas[col.key] = linhasTabela.reduce((a, l) => a + (l.cells[col.key] || 0), 0);
    });
    const totalGeral = linhasTabela.reduce((a, l) => a + l.total, 0);

    return (
        <div className="tv-card-anim">
            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#22d3ee', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                    Fluxo Mensal
                </h2>
                <span style={{ fontSize: '13px', color: t.textMuted, fontWeight: '500', textTransform: 'capitalize' }}>· {mesNome}</span>
                {ctesProximosDias.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '20px', padding: '3px 10px', fontWeight: '700' }}>
                        {ctesProximosDias.length} CT-e{ctesProximosDias.length > 1 ? 's' : ''} agendado{ctesProximosDias.length > 1 ? 's' : ''} p/ dias seguintes
                    </span>
                )}
            </div>

            {/* LINHA DE KPIs PRINCIPAIS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {/* Embarques */}
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '56px', fontWeight: '900', color: '#3b82f6', lineHeight: 1, letterSpacing: '-2px' }}>{totalMes}</div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Embarques</div>
                        <div style={{ fontSize: '10px', color: t.textDim, marginTop: '2px' }}>{new Date(primeiroDiaMes).toLocaleDateString('pt-BR')} – {new Date(ultimoDiaMes).toLocaleDateString('pt-BR')}</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#3b82f6' }}>{recifeOnly} Recife</span>
                            <span style={{ fontSize: '11px', color: '#60a5fa' }}>{morenoOnly} Moreno</span>
                            {ambasMes > 0 && <span style={{ fontSize: '11px', color: '#818cf8' }}>{ambasMes} Ambas</span>}
                        </div>
                    </div>
                </div>
                {/* CT-es Emitidos */}
                <div style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '56px', fontWeight: '900', color: '#22d3ee', lineHeight: 1, letterSpacing: '-2px' }}>{ctesEmitidosMes.length}</div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '1.5px' }}>CT-es Emitidos</div>
                        <div style={{ fontSize: '10px', color: t.textDim, marginTop: '2px' }}>No mês</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#22d3ee' }}>{ctesMes.filter(c => c.status === 'Emitido' && c.origem === 'Recife').length} Recife</span>
                            <span style={{ fontSize: '11px', color: '#a5f3fc' }}>{ctesMes.filter(c => c.status === 'Emitido' && c.origem !== 'Recife').length} Moreno</span>
                        </div>
                    </div>
                </div>
                {/* Ocorrências */}
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '56px', fontWeight: '900', color: '#f59e0b', lineHeight: 1, letterSpacing: '-2px' }}>{ocorrenciasMes.length}</div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={10} /> Ocorrências
                        </div>
                        <div style={{ fontSize: '10px', color: t.textDim, marginTop: '2px' }}>No mês</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#60a5fa' }}>{ocorrenciasMes.filter(o => !o.unidade || o.unidade === 'Recife').length} Recife</span>
                            <span style={{ fontSize: '11px', color: '#fb923c' }}>{ocorrenciasMes.filter(o => o.unidade === 'Moreno').length} Moreno</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SUB-CONTADORES POR OPERAÇÃO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                    { label: 'Delta', valor: contadores.delta, cor: CORES_KPI.delta },
                    { label: 'Consolidado', valor: contadores.consolidado, cor: CORES_KPI.consolidado },
                    { label: 'Delta R/M', valor: contadores.deltaRxM, cor: CORES_KPI.deltaRxM },
                    { label: 'Porcelana', valor: contadores.porcelana, cor: CORES_KPI.porcelana },
                    { label: 'Eletrik', valor: contadores.eletrik, cor: CORES_KPI.eletrik }
                ].map(kpi => (
                    <div key={kpi.label} style={{ background: `${kpi.cor}0d`, borderTop: `2px solid ${kpi.cor}`, borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: kpi.cor, lineHeight: 1 }}>{kpi.valor}</div>
                        <div style={{ fontSize: '9px', fontWeight: '700', color: t.textMuted, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* GRÁFICOS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px' }}>
                    <h3 style={{ fontSize: '10px', fontWeight: '700', color: t.textMuted, marginBottom: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Distribuição por Unidade</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginBottom: '10px' }}>
                        {[{v:recifeOnly,l:'Recife',c:'#3b82f6'},{v:morenoOnly,l:'Moreno',c:'#60a5fa'},{v:ambasMes,l:'Ambas',c:'#818cf8'}].filter(x=>x.v>0).map(x=>(
                            <div key={x.l} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '36px', fontWeight: '900', color: x.c }}>{x.v}</div>
                                <div style={{ fontSize: '10px', color: t.textMuted }}>{x.l}</div>
                            </div>
                        ))}
                    </div>
                    {dadosUnidades.some(d => d.value > 0) ? (
                        <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={dadosUnidades}>
                                <XAxis dataKey="name" stroke={t.textDim} fontSize={10} />
                                <YAxis stroke={t.textDim} fontSize={9} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '12px' }} formatter={(v, n) => { const tot = dadosUnidades.reduce((a,d)=>a+d.value,0); return [`${v} (${tot>0?((v/tot)*100).toFixed(0):0}%)`, n]; }} />
                                <Bar dataKey="value" radius={[6,6,0,0]}>
                                    {dadosUnidades.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                    <LabelList dataKey="value" position="center" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val) => { const tot = dadosUnidades.reduce((a,d)=>a+d.value,0); return val > 0 ? `${val} (${tot>0?((val/tot)*100).toFixed(0):0}%)` : ''; }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '24px', color: t.textDim, fontSize: '12px' }}>Sem dados</div>}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px' }}>
                    <h3 style={{ fontSize: '10px', fontWeight: '700', color: t.textMuted, marginBottom: '10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Distribuição por Operação</h3>
                    {dadosPieOp.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie data={dadosPieOp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} label={({ name, value }) => { const tot = dadosPieOp.reduce((a,d)=>a+d.value,0); return `${name}: ${value} (${tot>0?((value/tot)*100).toFixed(0):0}%)`; }} labelLine={false} style={{ fontSize: '10px' }}>
                                    {dadosPieOp.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '12px' }} formatter={(v, n) => { const tot = dadosPieOp.reduce((a,d)=>a+d.value,0); return [`${v} (${tot>0?((v/tot)*100).toFixed(1):0}%)`, n]; }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '40px', color: t.textDim, fontSize: '12px' }}>Sem dados</div>}
                </div>
            </div>

            {/* ── TABELA DE COLETAS POR OPERAÇÃO ── */}
            {linhasTabela.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '11px', fontWeight: '800', color: t.text, textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                            Coletas por Operação — {mesNome}
                        </h3>
                        <div style={{ height: '1px', flex: 1, background: `linear-gradient(to right, ${t.border}, transparent)` }} />
                    </div>
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
                                        DATA
                                    </th>
                                    {COLUNAS_OP.map(col => (
                                        <th key={col.key} style={{ padding: '10px 10px', textAlign: 'center', fontSize: '9px', fontWeight: '800', color: col.cor, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `2px solid ${col.cor}40`, whiteSpace: 'nowrap', borderLeft: `1px solid ${t.border}` }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: '9px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `1px solid ${t.border}`, borderLeft: `1px solid ${t.border}` }}>
                                        TOTAL
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhasTabela.map((linha, idx) => {
                                    const dataObj = new Date(linha.dia + 'T12:00:00');
                                    const diaNum = linha.dia.split('-')[2];
                                    const mesNum = linha.dia.split('-')[1];
                                    const diaSem = DIAS_SEMANA_ABREV[dataObj.getDay()];
                                    const isHoje = linha.dia === hoje;
                                    const isFuturo = linha.dia > hoje;
                                    return (
                                        <tr key={linha.dia} style={{
                                            background: isHoje ? 'rgba(34,211,238,0.06)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                            outline: isHoje ? '1px solid rgba(34,211,238,0.25)' : 'none',
                                            transition: 'background 0.2s',
                                        }}>
                                            <td style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}20`, whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: isHoje ? '#22d3ee' : isFuturo ? t.textMuted : t.text }}>
                                                    {diaNum}/{mesNum}
                                                </span>
                                                <span style={{ fontSize: '9px', color: isHoje ? '#67e8f9' : t.textDim, marginLeft: '6px', fontWeight: '600' }}>
                                                    {diaSem}{isHoje ? ' · HOJE' : ''}
                                                </span>
                                            </td>
                                            {COLUNAS_OP.map(col => (
                                                <td key={col.key} style={{ padding: '8px 10px', textAlign: 'center', borderBottom: `1px solid ${t.border}20`, borderLeft: `1px solid ${t.border}20` }}>
                                                    {linha.cells[col.key] > 0 ? (
                                                        <span style={{ display: 'inline-block', minWidth: '28px', padding: '2px 6px', background: `${col.cor}18`, color: col.cor, borderRadius: '6px', fontSize: '13px', fontWeight: '800' }}>
                                                            {linha.cells[col.key]}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: t.textDim, fontSize: '11px' }}>—</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: `1px solid ${t.border}20`, borderLeft: `1px solid ${t.border}20` }}>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: isHoje ? '#22d3ee' : t.text }}>{linha.total}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'rgba(255,255,255,0.05)', borderTop: `2px solid ${t.border}` }}>
                                    <td style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>TOTAL</td>
                                    {COLUNAS_OP.map(col => (
                                        <td key={col.key} style={{ padding: '10px 10px', textAlign: 'center', borderLeft: `1px solid ${t.border}` }}>
                                            <span style={{ fontSize: '14px', fontWeight: '900', color: totaisColunas[col.key] > 0 ? col.cor : t.textDim }}>
                                                {totaisColunas[col.key] || '—'}
                                            </span>
                                        </td>
                                    ))}
                                    <td style={{ padding: '10px 10px', textAlign: 'center', borderLeft: `1px solid ${t.border}` }}>
                                        <span style={{ fontSize: '14px', fontWeight: '900', color: '#22d3ee' }}>{totalGeral}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ── PALETES DO MÊS ── */}
            <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
                <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#a78bfa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>Paletes PBR — Resumo do Mês</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) 80px', gap: '10px', alignItems: 'center' }}>
                    {[
                        { label: 'Total Saídas', valor: pbrMes, cor: '#3b82f6' },
                        { label: 'Devolvidos', valor: devMes, cor: '#22c55e' },
                        { label: 'Saldo', valor: saldoMes, cor: saldoMes > 0 ? '#f59e0b' : '#22c55e' },
                        { label: 'Pendentes', valor: pendMes, cor: '#f59e0b' },
                    ].map(k => (
                        <div key={k.label} style={{ textAlign: 'center', background: `${k.cor}0d`, border: `1px solid ${k.cor}25`, borderRadius: '10px', padding: '12px 8px' }}>
                            <div style={{ fontSize: '34px', fontWeight: '900', color: k.cor, lineHeight: 1 }}>{k.valor}</div>
                            <div style={{ fontSize: '9px', color: t.textMuted, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>{k.label}</div>
                        </div>
                    ))}
                    {dadosPaletePie.length > 0 ? (
                        <ResponsiveContainer width="100%" height={80}>
                            <PieChart>
                                <Pie data={dadosPaletePie} dataKey="value" cx="50%" cy="50%" outerRadius={36} innerRadius={18}>
                                    {dadosPaletePie.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '11px', color: t.text }} formatter={(v, n) => { const tot = dadosPaletePie.reduce((a,d)=>a+d.value,0); return [`${v} (${tot>0?((v/tot)*100).toFixed(0):0}%)`, n]; }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', color: t.textDim, fontSize: '12px' }}>—</div>}
                </div>
            </div>
        </div>
    );
}

// ================================================================
// TELA 4: PALETES DIÁRIO
// ================================================================
function TelaPaletesDiario({ paletes, t, tema }) {
    const hoje = obterDataBrasilia();

    // Filtrar paletes de hoje
    const paletesHoje = paletes.filter(p => {
        const d = p.data_entrada ? String(p.data_entrada).substring(0, 10) : '';
        return d === hoje;
    });

    // KPIs
    const totalPbr = paletesHoje.reduce((a, p) => a + (p.qtd_pbr || 0), 0);
    const totalDevolvido = paletesHoje.reduce((a, p) => a + (p.qtd_devolvida_pbr || 0), 0);
    const saldo = totalPbr - totalDevolvido;
    const pendentes = paletesHoje.filter(p => !p.devolvido).length;
    const devolvidos = paletesHoje.filter(p => p.devolvido).length;

    const dataHojeFmt = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Recife' });

    const corSaldo = saldo > 0 ? '#f59e0b' : '#22c55e';

    return (
        <div className="tv-card-anim">
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Paletes PBR — {dataHojeFmt}
            </h2>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' }}>
                {[
                    { label: 'Saíram Hoje', valor: totalPbr, cor: '#3b82f6' },
                    { label: 'Devolvidos', valor: totalDevolvido, cor: '#22c55e' },
                    { label: 'Saldo', valor: saldo, cor: corSaldo },
                    { label: 'Pendentes', valor: pendentes, cor: '#f59e0b' },
                ].map(k => (
                    <div key={k.label} style={{ ...glassCard(t, `${k.cor}40`), padding: '20px', textAlign: 'center', borderTop: `3px solid ${k.cor}` }}>
                        <div style={{ fontSize: '56px', fontWeight: '900', color: k.cor, lineHeight: 1, filter: `drop-shadow(0 0 10px ${k.cor}70)` }}>{k.valor}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: t.textMuted, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Status resumido */}
            <div style={{ ...glassCard(t, 'rgba(167,139,250,0.25)'), padding: '14px 20px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '24px', borderLeft: '4px solid #a78bfa' }}>
                <span style={{ fontSize: '10px', letterSpacing: '2px', color: '#a78bfa', textTransform: 'uppercase', fontWeight: '700', whiteSpace: 'nowrap' }}>Transportes Hoje</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#c4b5fd' }}>{paletesHoje.length}</span>
                    <span style={{ fontSize: '11px', color: t.textMuted }}>registros</span>
                </div>
                <div style={{ height: '28px', width: '1px', background: 'rgba(167,139,250,0.3)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#22c55e' }}>{devolvidos}</span>
                    <span style={{ fontSize: '11px', color: t.textMuted }}>devolvidos</span>
                </div>
                <div style={{ height: '28px', width: '1px', background: 'rgba(167,139,250,0.3)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#fbbf24' }}>{pendentes}</span>
                    <span style={{ fontSize: '11px', color: t.textMuted }}>pendentes</span>
                </div>
            </div>

            {/* Tabela de motoristas */}
            {paletesHoje.length === 0 ? (
                <div style={{ ...glassCard(t), padding: '48px', textAlign: 'center', color: t.textDim, fontSize: '14px' }}>
                    Nenhum palete registrado hoje
                </div>
            ) : (
                <div style={{ ...glassCard(t), overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(167,139,250,0.1)', borderBottom: `1px solid rgba(167,139,250,0.2)` }}>
                                {['Motorista', 'Placa Cavalo', 'Placa Carreta', 'Fornecedor', 'Qtd PBR', 'Devolvido', 'Saldo', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paletesHoje.map((p, i) => {
                                const saldoLinha = (p.qtd_pbr || 0) - (p.qtd_devolvida_pbr || 0);
                                return (
                                    <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                        <td style={{ padding: '11px 14px', color: t.text, fontWeight: '600' }}>{p.motorista || '—'}</td>
                                        <td style={{ padding: '11px 14px', color: t.textMuted, fontFamily: 'monospace', fontSize: '12px' }}>{p.placa_cavalo || '—'}</td>
                                        <td style={{ padding: '11px 14px', color: t.textMuted, fontFamily: 'monospace', fontSize: '12px' }}>{p.placa_carreta || '—'}</td>
                                        <td style={{ padding: '11px 14px', color: t.textMuted }}>{p.fornecedor_pbr || '—'}</td>
                                        <td style={{ padding: '11px 14px', color: '#60a5fa', fontWeight: '700', textAlign: 'center' }}>{p.qtd_pbr || 0}</td>
                                        <td style={{ padding: '11px 14px', color: '#4ade80', fontWeight: '700', textAlign: 'center' }}>{p.qtd_devolvida_pbr || 0}</td>
                                        <td style={{ padding: '11px 14px', fontWeight: '700', textAlign: 'center', color: saldoLinha > 0 ? '#fbbf24' : '#4ade80' }}>{saldoLinha}</td>
                                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                background: p.devolvido ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
                                                color: p.devolvido ? '#4ade80' : '#fbbf24',
                                                border: `1px solid ${p.devolvido ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`
                                            }}>
                                                {p.devolvido ? 'Devolvido' : 'Pendente'}
                                            </span>
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
function TelaOperacaoMoreno({ veiculos, ctesMoreno, docasInterditadas = [], t, tema, ocorrenciasHoje = [] }) {
    const veiculosMoreno = veiculos.filter(v => ehOperacaoMoreno(v.operacao));
    const totalMoreno = veiculosMoreno.length;
    const [hoveredDocaM, setHoveredDocaM] = useState(null);

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
        if (v.cte_antecipado_moreno && st !== 'LIBERADO P/ CT-e') contStatus['LIBERADO P/ CT-e']++;
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

        // REGRA DE NEGOCIO: Se status for "CARREGADO", "LIBERADO P/ CT-e" ou "CT-e Antecipado", a doca NAO esta ocupada
        if (statusAtual === 'CARREGADO' || statusAtual === 'LIBERADO P/ CT-e' || v.cte_antecipado_moreno) {
            return; // Nao contabilizar
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

    // Mapa doca → veículo para tooltip
    const docaVeiculoMapM = {};
    veiculosMoreno.forEach(v => {
        if (v.status_moreno === 'CARREGADO' || v.status_moreno === 'LIBERADO P/ CT-e' || v.cte_antecipado_moreno) return;
        const doca = v.doca_moreno;
        if (!doca || doca === 'SELECIONE') return;
        docaVeiculoMapM[doca] = { motorista: v.motorista, coleta: v.coletaMoreno || v.coleta || '' };
    });

    // Fluxo CT-e para Moreno
    const aguardandoCte = ctesMoreno.filter(c => c.status === 'Aguardando Emissão' || c.status === 'Aguardando Emissao').length;
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
        const veiculo = docaVeiculoMapM[doca];
        const isHovered = hoveredDocaM === doca;

        if (statusDoca === 'FULGAZ') {
            return (
                <div key={doca} style={{
                    padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                    background: tema === 'light' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${tema === 'light' ? '#dc2626' : '#ef4444'}`,
                    boxShadow: tema === 'light' ? '0 2px 8px rgba(220, 38, 38, 0.25)' : '0 0 12px rgba(239, 68, 68, 0.4)',
                    transition: 'all 0.5s ease-in-out', position: 'relative', cursor: 'default'
                }}
                    onMouseEnter={() => setHoveredDocaM(doca)}
                    onMouseLeave={() => setHoveredDocaM(null)}
                >
                    <div style={{
                        fontSize: '11px', fontWeight: '900',
                        color: tema === 'light' ? '#991b1b' : '#fca5a5',
                        filter: tema === 'light' ? 'none' : 'drop-shadow(0 0 4px #ef4444)'
                    }}>{doca}</div>
                    <div style={{
                        fontSize: '8px',
                        color: tema === 'light' ? '#dc2626' : '#ef4444',
                        marginTop: '4px', fontWeight: '900', letterSpacing: '0.5px'
                    }}>CONTAINER</div>
                    {isHovered && veiculo && (
                        <div style={{
                            position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                            background: tema === 'light' ? '#1e293b' : '#0f172a',
                            border: '1px solid #fbbf24', borderRadius: '8px',
                            padding: '8px 12px', zIndex: 999, whiteSpace: 'nowrap',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                            pointerEvents: 'none'
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>{veiculo.motorista}</div>
                            {veiculo.coleta && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Coleta {veiculo.coleta}</div>}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div key={doca} style={{
                padding: '10px 6px', borderRadius: '10px', textAlign: 'center',
                background: bgCor, border: `1px solid ${borderCor}${tema === 'light' ? '80' : '50'}`,
                transition: 'all 0.5s ease-in-out',
                boxShadow: livre && tema === 'dark' ? '0 0 8px rgba(52,211,153,0.2)' : 'none',
                position: 'relative', cursor: 'default'
            }}
                onMouseEnter={() => setHoveredDocaM(doca)}
                onMouseLeave={() => setHoveredDocaM(null)}
            >
                <div style={{
                    fontSize: '11px', fontWeight: '700', color: textCor,
                    ...(livre && tema === 'dark' ? { filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.8))' } : {})
                }}>{doca}</div>
                <div style={{
                    fontSize: '8px',
                    color: livre ? (tema === 'light' ? '#059669' : '#34d399') : t.textDim,
                    marginTop: '2px', fontWeight: livre ? '700' : 'normal'
                }}>{statusDoca || 'Livre'}</div>
                {isHovered && veiculo && (
                    <div style={{
                        position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                        background: tema === 'light' ? '#1e293b' : '#0f172a',
                        border: '1px solid #fbbf24', borderRadius: '8px',
                        padding: '8px 12px', zIndex: 999, whiteSpace: 'nowrap',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                        pointerEvents: 'none'
                    }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>{veiculo.motorista}</div>
                        {veiculo.coleta && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Coleta {veiculo.coleta}</div>}
                    </div>
                )}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                            {[
                                { label: '100% Porcelana', valor: contOp.porcelana, cor: '#1d4ed8' },
                                { label: 'Eletrik', valor: contOp.eletrik, cor: '#2563eb' },
                                { label: 'Delta Moreno', valor: contOp.deltaMoreno, cor: '#3b82f6' },
                                { label: 'Delta R/M', valor: contOp.deltaRxM, cor: '#60a5fa' },
                                { label: 'Consolidados', valor: consolidadosMoreno, cor: '#93c5fd' },
                                { label: 'Ocorrências Hoje', valor: ocorrenciasHoje.filter(o => o.unidade === 'Moreno').length, cor: '#f59e0b', icon: true }
                            ].map(c => (
                                <div key={c.label} style={{ ...glassCard(t, `${c.cor}40`), padding: '20px', textAlign: 'center', borderTop: `3px solid ${c.cor}`, transition: 'all 0.5s ease-in-out' }}>
                                    <div style={{ fontSize: '44px', fontWeight: '900', color: c.cor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${c.cor}60)` }}>{c.valor}</div>
                                    <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        {c.icon && <AlertTriangle size={10} color="#f59e0b" />}{c.label}
                                    </div>
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
                                { label: 'Aguardando Emissão', valor: aguardandoCte, cor: '#f59e0b', desc: 'CT-es "Aguardando Emissão"' },
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
