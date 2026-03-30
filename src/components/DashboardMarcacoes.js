import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, Truck, TrendingUp, ChevronLeft, ChevronRight, Award, RefreshCw, Wifi } from 'lucide-react';
import api from '../services/apiService';

// ── Coordenadas dos centroides dos estados brasileiros (viewport SVG 0-1000 x 0-900) ──
const CENTROIDES = {
    AC: [95, 460], AL: [680, 340], AM: [200, 310], AP: [480, 120],
    BA: [590, 390], CE: [660, 250], DF: [500, 470], ES: [640, 510],
    GO: [490, 460], MA: [540, 240], MG: [565, 490], MS: [430, 560],
    MT: [350, 420], PA: [440, 240], PB: [700, 285], PE: [660, 315],
    PI: [580, 290], PR: [460, 620], RJ: [610, 545], RN: [710, 265],
    RO: [210, 430], RR: [250, 140], RS: [430, 710], SC: [460, 660],
    SE: [670, 360], SP: [510, 560], TO: [490, 350],
};

// SVG simplificado do Brasil (paths por estado) — bounding box 0 0 1000 900
const BRASIL_PATHS = {
    AC: 'M 35,425 L 60,380 L 120,395 L 155,415 L 165,455 L 130,490 L 80,480 Z',
    AM: 'M 80,200 L 200,155 L 340,170 L 360,230 L 320,290 L 280,350 L 200,380 L 130,365 L 80,320 Z',
    RR: 'M 200,70 L 300,60 L 330,130 L 290,200 L 220,210 L 175,160 Z',
    AP: 'M 430,80 L 510,70 L 540,140 L 490,175 L 440,155 Z',
    PA: 'M 330,165 L 520,130 L 560,185 L 550,275 L 490,310 L 400,315 L 340,280 L 300,240 Z',
    MA: 'M 490,185 L 580,180 L 610,225 L 590,280 L 530,305 L 490,275 Z',
    PI: 'M 580,225 L 620,215 L 640,260 L 630,310 L 580,320 L 560,285 Z',
    CE: 'M 620,215 L 680,210 L 700,250 L 680,295 L 640,310 L 620,275 Z',
    RN: 'M 680,210 L 730,215 L 740,260 L 710,275 L 680,265 Z',
    PB: 'M 670,265 L 730,265 L 730,300 L 690,310 L 665,300 Z',
    PE: 'M 590,295 L 730,295 L 725,330 L 635,345 L 590,330 Z',
    AL: 'M 645,330 L 715,330 L 720,360 L 670,370 L 645,355 Z',
    SE: 'M 625,345 L 665,345 L 680,375 L 655,390 L 625,375 Z',
    BA: 'M 490,315 L 625,295 L 680,375 L 665,450 L 600,495 L 530,500 L 460,460 L 440,400 Z',
    TO: 'M 400,280 L 490,275 L 510,350 L 500,420 L 450,435 L 400,420 L 380,360 Z',
    GO: 'M 400,420 L 460,415 L 530,445 L 540,510 L 490,535 L 420,530 L 385,490 Z',
    DF: 'M 480,460 L 505,460 L 510,485 L 485,490 Z',
    MT: 'M 245,330 L 380,315 L 400,415 L 390,490 L 320,510 L 240,490 L 215,415 Z',
    RO: 'M 155,370 L 240,360 L 265,415 L 260,480 L 200,500 L 150,470 Z',
    MG: 'M 460,435 L 540,430 L 610,450 L 650,490 L 630,540 L 565,555 L 490,545 L 445,510 Z',
    ES: 'M 620,475 L 670,480 L 665,535 L 625,545 L 605,515 Z',
    RJ: 'M 565,535 L 640,530 L 655,565 L 610,575 L 570,565 Z',
    SP: 'M 440,530 L 565,530 L 580,560 L 555,605 L 475,615 L 430,590 Z',
    PR: 'M 395,590 L 480,590 L 515,625 L 500,665 L 420,670 L 375,645 Z',
    SC: 'M 390,650 L 490,645 L 510,680 L 490,700 L 410,705 L 375,680 Z',
    RS: 'M 360,685 L 480,680 L 510,720 L 490,760 L 415,775 L 350,750 L 330,715 Z',
    MS: 'M 335,500 L 425,490 L 445,550 L 430,615 L 360,625 L 310,585 Z',
};

function BrasilMapa({ porUF }) {
    const [hover, setHover] = useState(null);
    const maxVal = Math.max(1, ...porUF.map(r => r.total));
    const mapa = Object.fromEntries(porUF.map(r => [r.uf, r.total]));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
            <svg viewBox="0 0 1000 900" style={{ width: '100%', height: 'auto' }}>
                {Object.entries(BRASIL_PATHS).map(([uf, path]) => {
                    const val = mapa[uf] || 0;
                    const intensidade = val > 0 ? 0.3 + 0.7 * (val / maxVal) : 0;
                    return (
                        <path
                            key={uf}
                            d={path}
                            fill={val > 0 ? `rgba(59,130,246,${intensidade})` : 'rgba(255,255,255,0.04)'}
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1.5"
                            style={{ cursor: val > 0 ? 'pointer' : 'default' }}
                            onMouseEnter={() => val > 0 && setHover(uf)}
                            onMouseLeave={() => setHover(null)}
                        />
                    );
                })}
                {porUF.filter(r => CENTROIDES[r.uf]).map(r => {
                    const [cx, cy] = CENTROIDES[r.uf];
                    const raio = 10 + Math.min(20, r.total * 3);
                    return (
                        <g key={r.uf}>
                            <circle cx={cx} cy={cy} r={raio} fill="rgba(59,130,246,0.7)" stroke="#3b82f6" strokeWidth="1.5" />
                            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#fff">{r.total}</text>
                        </g>
                    );
                })}
            </svg>
            {hover && mapa[hover] && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(15,23,42,0.95)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '700', color: '#f1f5f9', pointerEvents: 'none' }}>
                    {hover}: {mapa[hover]} marcação{mapa[hover] > 1 ? 'ões' : ''}
                </div>
            )}
        </div>
    );
}

function BarraHorizontal({ label, valor, max, cor }) {
    const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: '600' }}>{label}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: cor }}>{valor}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
        </div>
    );
}

const COR_TIPO = { Truck: '#60a5fa', 'Bi-Truck': '#a78bfa', 'Carreta 4 Eixos': '#fb923c', 'Carreta 5 Eixos': '#4ade80', 'Carreta 6 Eixos': '#f472b6' };

function obterMesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function navMes(mes, delta) {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function DashboardMarcacoes() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mes, setMes] = useState(obterMesAtual());

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get(`/api/marcacoes/stats?mes=${mes}`);
            if (r.data.success) setStats(r.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [mes]);

    useEffect(() => { carregar(); }, [carregar]);

    const s = {
        secao: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' },
        titulo: { fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' },
        th: { padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
        td: { padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px' },
    };

    return (
        <div style={{ padding: '16px 20px', overflowY: 'auto', height: 'calc(100vh - 124px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <TrendingUp size={22} color="#60a5fa" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Dashboard de Marcações</span>
                <button onClick={carregar} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <RefreshCw size={13} /> Atualizar
                </button>
            </div>

            {loading && !stats ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '60px' }}>Carregando...</div>
            ) : stats ? (
                <>
                    {/* Seção 1 — Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                        {[
                            { icon: <Users size={20} />, label: 'Marcaram a Placa', valor: stats.contadores.marcaram_placa, cor: '#60a5fa' },
                            { icon: <Truck size={20} />, label: 'Em Operação', valor: stats.contadores.em_operacao, cor: '#fb923c' },
                            { icon: <Award size={20} />, label: 'Contratados', valor: stats.contadores.contratados, cor: '#4ade80' },
                        ].map(c => (
                            <div key={c.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${c.cor}33`, borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: c.cor }}>{c.icon}</div>
                                <div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: c.cor, lineHeight: 1 }}>{c.valor}</div>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>{c.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Seção 2 — Tabela Mensal */}
                    <div style={s.secao}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={s.titulo}>Atividade Mensal</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => setMes(m => navMes(m, -1))} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                                    <ChevronLeft size={14} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e2e8f0', textTransform: 'capitalize', minWidth: '140px', textAlign: 'center' }}>{formatarMes(mes)}</span>
                                <button onClick={() => setMes(m => navMes(m, 1))} disabled={mes >= obterMesAtual()} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: mes >= obterMesAtual() ? '#334155' : '#94a3b8', display: 'flex' }}>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                        {stats.resumo_mensal.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: '13px' }}>Nenhuma marcação neste mês.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            {['Data', 'Total', 'Disponível', 'Em Operação', 'Contratado'].map(h => (
                                                <th key={h} style={s.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.resumo_mensal.map(r => (
                                            <tr key={r.data}>
                                                <td style={s.td}>{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                                                <td style={{ ...s.td, fontWeight: '700', color: '#60a5fa' }}>{r.total}</td>
                                                <td style={{ ...s.td, color: '#4ade80' }}>{r.disponivel}</td>
                                                <td style={{ ...s.td, color: '#fb923c' }}>{r.em_operacao}</td>
                                                <td style={{ ...s.td, color: '#facc15' }}>{r.contratado}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                            <td style={{ ...s.td, fontWeight: '700', color: '#94a3b8' }}>Total</td>
                                            <td style={{ ...s.td, fontWeight: '700', color: '#60a5fa' }}>{stats.resumo_mensal.reduce((a, r) => a + r.total, 0)}</td>
                                            <td style={{ ...s.td, color: '#4ade80', fontWeight: '700' }}>{stats.resumo_mensal.reduce((a, r) => a + r.disponivel, 0)}</td>
                                            <td style={{ ...s.td, color: '#fb923c', fontWeight: '700' }}>{stats.resumo_mensal.reduce((a, r) => a + r.em_operacao, 0)}</td>
                                            <td style={{ ...s.td, color: '#facc15', fontWeight: '700' }}>{stats.resumo_mensal.reduce((a, r) => a + r.contratado, 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Seção 3 + 4 — Tipo Veículo + Mapa */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div style={s.secao}>
                            <div style={s.titulo}><Truck size={13} /> Tipos de Veículo</div>
                            {stats.por_tipo_veiculo.length === 0 ? (
                                <div style={{ color: '#475569', fontSize: '13px' }}>Sem dados.</div>
                            ) : (
                                stats.por_tipo_veiculo.map(r => (
                                    <BarraHorizontal
                                        key={r.tipo}
                                        label={r.tipo || 'Outros'}
                                        valor={r.total}
                                        max={stats.por_tipo_veiculo[0]?.total || 1}
                                        cor={COR_TIPO[r.tipo] || '#94a3b8'}
                                    />
                                ))
                            )}
                        </div>
                        <div style={s.secao}>
                            <div style={s.titulo}>Destinos por UF</div>
                            <BrasilMapa porUF={stats.por_uf} />
                        </div>
                    </div>

                    {/* Seção 5 — Rastreadores */}
                    <div style={s.secao}>
                        <div style={s.titulo}><Wifi size={13} /> Rastreadores</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        {['Rastreador', 'Total', 'Ativos', 'Inativos'].map(h => (
                                            <th key={h} style={s.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.por_rastreador.map(r => (
                                        <tr key={r.rastreador}>
                                            <td style={{ ...s.td, fontWeight: '600' }}>{r.rastreador}</td>
                                            <td style={{ ...s.td, color: '#60a5fa', fontWeight: '700' }}>{r.total}</td>
                                            <td style={{ ...s.td, color: '#4ade80' }}>{r.ativos}</td>
                                            <td style={{ ...s.td, color: '#f87171' }}>{r.inativos}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Seção 6 + 7 — Top 5 + Novatos vs Parceiros */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div style={s.secao}>
                            <div style={s.titulo}><Award size={13} /> Top 5 Motoristas</div>
                            {stats.top5.length === 0 ? (
                                <div style={{ color: '#475569', fontSize: '13px' }}>Sem dados.</div>
                            ) : (
                                stats.top5.map((m, i) => (
                                    <div key={m.nome} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < stats.top5.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                        <span style={{ fontSize: '16px', fontWeight: '800', color: i === 0 ? '#facc15' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#475569', minWidth: '22px' }}>#{i + 1}</span>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.nome}
                                                {m.favorito && <Star size={10} fill="#facc15" color="#facc15" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748b' }}>{m.tipo_veiculo}</div>
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#facc15' }}>{m.viagens}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={s.secao}>
                            <div style={s.titulo}><Users size={13} /> Novatos vs Parceiros</div>
                            {(() => {
                                const { novatos, parceiros_baixo, parceiros_alto } = stats.novatos_parceiros;
                                const total = novatos + parceiros_baixo + parceiros_alto || 1;
                                return [
                                    { label: 'Novatos (0 viagens)', valor: novatos, cor: '#fb923c' },
                                    { label: 'Iniciantes (1-4 viagens)', valor: parceiros_baixo, cor: '#60a5fa' },
                                    { label: 'Experientes (5+ viagens)', valor: parceiros_alto, cor: '#4ade80' },
                                ].map(r => (
                                    <BarraHorizontal key={r.label} label={r.label} valor={r.valor} max={total} cor={r.cor} />
                                ));
                            })()}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ textAlign: 'center', color: '#f87171', padding: '60px' }}>Erro ao carregar dados.</div>
            )}
        </div>
    );
}
