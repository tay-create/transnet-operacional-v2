import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, Truck, TrendingUp, ChevronLeft, ChevronRight, Award, RefreshCw, Wifi } from 'lucide-react';
import api from '../services/apiService';

// Posições percentuais (left%, top%) dos estados no PNG isométrico 448x403
const PINOS_MAPA = {
    // Norte
    RR: [40,  6],  AP: [69,  9],
    AM: [22, 24],  PA: [52, 22],
    RO: [31, 40],  AC: [14, 45],
    TO: [61, 35],
    // Nordeste
    MA: [68, 25],  PI: [74, 31],
    CE: [80, 23],  RN: [87, 22],
    PB: [86, 27],  PE: [82, 31],
    AL: [87, 34],  SE: [85, 38],
    BA: [73, 45],
    // Centro-Oeste
    MT: [41, 47],  GO: [59, 53],
    DF: [62, 55],  MS: [52, 63],
    // Sudeste
    MG: [70, 56],  ES: [78, 55],
    RJ: [74, 61],  SP: [64, 63],
    // Sul
    PR: [59, 71],  SC: [61, 78],
    RS: [58, 86],
};

function BrasilMapa({ porUF }) {
    const [hover, setHover] = useState(null);
    const mapa = Object.fromEntries(porUF.map(r => [r.uf, r.total]));
    const maxVal = Math.max(1, ...porUF.map(r => r.total));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '420px', margin: '0 auto', userSelect: 'none' }}>
            <img
                src="/pngtree-map-of-brazil-with-states-divisions-icon-shape-physical-photo-image_2645089-removebg-preview.png"
                alt="Mapa do Brasil"
                style={{ width: '100%', height: 'auto', display: 'block', filter: 'brightness(0.7) saturate(0)' }}
                draggable={false}
            />
            {Object.entries(PINOS_MAPA).map(([uf, [left, top]]) => {
                const total = mapa[uf] || 0;
                if (!total) return null;
                const intensidade = 0.4 + 0.6 * (total / maxVal);
                const tamanho = total >= 20 ? 26 : total >= 10 ? 22 : 18;
                return (
                    <div
                        key={uf}
                        onMouseEnter={() => setHover(uf)}
                        onMouseLeave={() => setHover(null)}
                        style={{
                            position: 'absolute',
                            left: `${left}%`,
                            top: `${top}%`,
                            transform: 'translate(-50%, -50%)',
                            width: tamanho, height: tamanho,
                            borderRadius: '50%',
                            background: `rgba(59,130,246,${intensidade})`,
                            border: `2px solid #3b82f6`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: total >= 10 ? '9px' : '8px',
                            fontWeight: '800', color: '#fff',
                            cursor: 'pointer',
                            boxShadow: `0 0 8px rgba(59,130,246,0.6)`,
                            zIndex: 2,
                            transition: 'transform 0.15s',
                            ...(hover === uf ? { transform: 'translate(-50%,-50%) scale(1.3)', zIndex: 10 } : {}),
                        }}
                    >
                        {total}
                    </div>
                );
            })}
            {hover && mapa[hover] && (
                <div style={{
                    position: 'absolute', top: '6px', left: '6px',
                    background: 'rgba(15,23,42,0.95)', border: '1px solid #3b82f6',
                    borderRadius: '8px', padding: '6px 12px',
                    fontSize: '12px', fontWeight: '700', color: '#f1f5f9',
                    pointerEvents: 'none', zIndex: 20,
                }}>
                    {hover}: {mapa[hover]} motorista{mapa[hover] > 1 ? 's' : ''}
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
                                                <td style={s.td}>{new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</td>
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
