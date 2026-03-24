import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/apiService';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS = ['TRUCK', '3/4', 'CARRETA'];

const TIPO_LABEL = { TRUCK: 'Truck', '3/4': '3/4', CARRETA: 'Carreta', CONJUNTO: 'Conjunto' };

// Agrupa "CONJUNTO" como CARRETA para o dashboard
function normalizarTipo(t) {
    if (t === 'CONJUNTO') return 'CARRETA';
    return t;
}

const STATUS_GRUPOS = [
    {
        key: 'DISPONIVEL',
        label: 'Disponível',
        cor: '#4ade80',
        corBg: 'rgba(34,197,94,0.15)',
        corBorder: 'rgba(34,197,94,0.3)',
        match: s => s === 'DISPONIVEL',
    },
    {
        key: 'MANUTENCAO',
        label: 'Em Manutenção',
        cor: '#f87171',
        corBg: 'rgba(239,68,68,0.15)',
        corBorder: 'rgba(239,68,68,0.3)',
        match: s => s === 'MANUTENCAO',
    },
    {
        key: 'EM_VIAGEM',
        label: 'Em Viagem',
        cor: '#facc15',
        corBg: 'rgba(234,179,8,0.15)',
        corBorder: 'rgba(234,179,8,0.3)',
        match: s => ['EM_VIAGEM', 'EM_VIAGEM_FRETE_RETORNO', 'AGUARDANDO_FRETE_RETORNO', 'RETORNANDO', 'PROJETO_SUL', 'PROJETO_SP', 'TRANSFERENCIA', 'PUXADA'].includes(s),
    },
    {
        key: 'CARREGANDO',
        label: 'Em Carregamento',
        cor: '#60a5fa',
        corBg: 'rgba(59,130,246,0.15)',
        corBorder: 'rgba(59,130,246,0.3)',
        match: s => s === 'CARREGANDO',
    },
];

// Status que o dashboard mostra como "outros" (não mapeados acima)
const STATUS_OUTROS_MATCH = s => !STATUS_GRUPOS.some(g => g.match(s));

const CORES_GRAFICO = STATUS_GRUPOS.map(g => g.cor);

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ dados, total, size = 180 }) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const strokeWidth = size * 0.13;
    const circumference = 2 * Math.PI * r;

    const [hoveredIdx, setHoveredIdx] = useState(null);

    const segmentos = [];
    let offset = 0;
    const valorTotal = dados.reduce((acc, d) => acc + d.valor, 0) || 1;

    dados.forEach((d, i) => {
        const pct = d.valor / valorTotal;
        const dash = pct * circumference;
        const gap = circumference - dash;
        segmentos.push({ dash, gap, offset, cor: d.cor, valor: d.valor, label: d.label, i });
        offset += dash;
    });

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={strokeWidth}
                />
                {segmentos.map((s) => (
                    <circle
                        key={s.i}
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={s.cor}
                        strokeWidth={hoveredIdx === s.i ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${s.dash} ${s.gap}`}
                        strokeDashoffset={-s.offset}
                        strokeLinecap="butt"
                        style={{
                            transition: 'stroke-width 0.18s ease, opacity 0.18s ease',
                            opacity: hoveredIdx !== null && hoveredIdx !== s.i ? 0.45 : 1,
                            cursor: 'default',
                        }}
                        onMouseEnter={() => setHoveredIdx(s.i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                    />
                ))}
            </svg>
            {/* Total no centro */}
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
            }}>
                {hoveredIdx !== null ? (
                    <>
                        <span style={{ color: segmentos[hoveredIdx]?.cor || '#f1f5f9', fontSize: size * 0.2, fontWeight: '800', lineHeight: 1 }}>
                            {segmentos[hoveredIdx]?.valor}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: size * 0.09, fontWeight: '500', marginTop: 3, textAlign: 'center', maxWidth: size * 0.55, lineHeight: 1.2 }}>
                            {segmentos[hoveredIdx]?.label}
                        </span>
                    </>
                ) : (
                    <>
                        <span style={{ color: '#f1f5f9', fontSize: size * 0.22, fontWeight: '800', lineHeight: 1 }}>{total}</span>
                        <span style={{ color: '#64748b', fontSize: size * 0.09, marginTop: 2 }}>total</span>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Tooltip com lista de placas ──────────────────────────────────────────────

function StatusBadge({ grupo, veiculosFiltrados }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const ref = useRef(null);
    const timerRef = useRef(null);

    const lista = veiculosFiltrados.filter(v => grupo.match(v.status));
    const count = lista.length;

    function handleEnter(e) {
        clearTimeout(timerRef.current);
        const rect = ref.current?.getBoundingClientRect();
        if (rect) {
            setPos({ top: rect.bottom + 8, left: rect.left });
        }
        setShow(true);
    }

    function handleLeave() {
        timerRef.current = setTimeout(() => setShow(false), 120);
    }

    return (
        <div
            ref={ref}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '5px 10px',
                background: grupo.corBg,
                border: `1px solid ${grupo.corBorder}`,
                borderRadius: '20px',
                cursor: 'default',
                transition: 'background 0.15s, border-color 0.15s',
                userSelect: 'none',
            }}>
                <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: grupo.cor,
                    boxShadow: `0 0 6px ${grupo.cor}`,
                    flexShrink: 0,
                }} />
                <span style={{ color: grupo.cor, fontSize: '12px', fontWeight: '600' }}>{grupo.label}</span>
                <span style={{
                    background: grupo.cor,
                    color: '#0f172a',
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '11px',
                    fontWeight: '800',
                    lineHeight: '18px',
                    minWidth: '18px',
                    textAlign: 'center',
                }}>{count}</span>
            </div>

            {/* Tooltip */}
            {show && lista.length > 0 && (
                <div
                    onMouseEnter={() => clearTimeout(timerRef.current)}
                    onMouseLeave={handleLeave}
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        zIndex: 99999,
                        background: '#0f172a',
                        border: `1px solid ${grupo.corBorder}`,
                        borderRadius: '10px',
                        padding: '10px 14px',
                        minWidth: '200px',
                        maxWidth: '280px',
                        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${grupo.corBorder}`,
                    }}
                >
                    <div style={{ color: grupo.cor, fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {grupo.label} — {count} veículo{count !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {lista.map(v => (
                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#f1f5f9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                                    {v.placa}{v.carreta ? ` / ${v.carreta}` : ''}
                                </span>
                                {v.motorista && (
                                    <span style={{ color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {v.motorista.split(' ')[0]}
                                    </span>
                                )}
                                {v.destino && (
                                    <span style={{ color: '#94a3b8', fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>→ {v.destino}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Card por tipo de veículo ─────────────────────────────────────────────────

// Ícone SVG de caminhão estilizado por tipo
function IconeTipo({ tipo, size = 36 }) {
    const cor = tipo === 'TRUCK' ? '#60a5fa' : tipo === '3/4' ? '#a78bfa' : '#34d399';
    if (tipo === 'TRUCK') {
        return (
            <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
                <rect x="1" y="11" width="24" height="16" rx="2" fill={cor} fillOpacity="0.15" stroke={cor} strokeWidth="1.5"/>
                <rect x="25" y="16" width="10" height="11" rx="1.5" fill={cor} fillOpacity="0.12" stroke={cor} strokeWidth="1.5"/>
                <line x1="25" y1="16" x2="35" y2="16" stroke={cor} strokeWidth="1.5"/>
                <circle cx="7" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <circle cx="20" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <circle cx="30" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <rect x="4" y="14" width="10" height="6" rx="1" fill={cor} fillOpacity="0.25"/>
            </svg>
        );
    }
    if (tipo === '3/4') {
        return (
            <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
                <rect x="3" y="14" width="18" height="13" rx="2" fill={cor} fillOpacity="0.15" stroke={cor} strokeWidth="1.5"/>
                <rect x="21" y="18" width="12" height="9" rx="1.5" fill={cor} fillOpacity="0.12" stroke={cor} strokeWidth="1.5"/>
                <circle cx="9" cy="28" r="2.8" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <circle cx="26" cy="28" r="2.8" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <rect x="6" y="16" width="8" height="5" rx="1" fill={cor} fillOpacity="0.25"/>
            </svg>
        );
    }
    // CARRETA/CONJUNTO
    return (
        <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <rect x="1" y="10" width="34" height="17" rx="2" fill={cor} fillOpacity="0.12" stroke={cor} strokeWidth="1.5"/>
            <circle cx="7" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
            <circle cx="17" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
            <circle cx="29" cy="28" r="3" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
            <line x1="1" y1="19" x2="35" y2="19" stroke={cor} strokeWidth="1" strokeOpacity="0.4"/>
        </svg>
    );
}

function CardTipo({ tipo, veiculosTipo, dataSelecionada }) {
    const cor = tipo === 'TRUCK' ? '#60a5fa' : tipo === '3/4' ? '#a78bfa' : '#34d399';
    const total = veiculosTipo.length;

    const dadosGrafico = STATUS_GRUPOS.map(g => ({
        label: g.label,
        cor: g.cor,
        valor: veiculosTipo.filter(v => g.match(v.status)).length,
    })).filter(d => d.valor > 0);

    // Adicionar "outros" se houver
    const outrosCount = veiculosTipo.filter(v => STATUS_OUTROS_MATCH(v.status)).length;
    if (outrosCount > 0) dadosGrafico.push({ label: 'Outros', cor: '#475569', valor: outrosCount });

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #111827 100%)',
            border: `1px solid rgba(${tipo === 'TRUCK' ? '59,130,246' : tipo === '3/4' ? '167,139,250' : '52,211,153'},0.25)`,
            borderRadius: '16px',
            padding: '24px',
            flex: '1 1 300px',
            minWidth: '280px',
            boxShadow: `0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow de fundo */}
            <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 160, height: 160,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${cor}18 0%, transparent 70%)`,
                pointerEvents: 'none',
            }} />

            {/* Header do card */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        background: `rgba(${tipo === 'TRUCK' ? '59,130,246' : tipo === '3/4' ? '167,139,250' : '52,211,153'},0.1)`,
                        border: `1px solid rgba(${tipo === 'TRUCK' ? '59,130,246' : tipo === '3/4' ? '167,139,250' : '52,211,153'},0.25)`,
                        borderRadius: '10px', padding: '8px',
                    }}>
                        <IconeTipo tipo={tipo} size={32} />
                    </div>
                    <div>
                        <div style={{ color: cor, fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>
                            {TIPO_LABEL[tipo] || tipo}
                        </div>
                        <div style={{ color: '#475569', fontSize: '11px', marginTop: '1px' }}>
                            Provisionamento de Frota
                        </div>
                    </div>
                </div>
                <div style={{
                    background: `rgba(${tipo === 'TRUCK' ? '59,130,246' : tipo === '3/4' ? '167,139,250' : '52,211,153'},0.12)`,
                    border: `1px solid ${cor}40`,
                    borderRadius: '12px',
                    padding: '6px 14px',
                    textAlign: 'center',
                }}>
                    <div style={{ color: cor, fontSize: '26px', fontWeight: '800', lineHeight: 1 }}>{total}</div>
                    <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>veículos</div>
                </div>
            </div>

            {/* Gráfico + Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {total > 0 ? (
                    <DonutChart dados={dadosGrafico} total={total} size={150} />
                ) : (
                    <div style={{
                        width: 150, height: 150, borderRadius: '50%',
                        border: '12px solid rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <span style={{ color: '#334155', fontSize: '12px' }}>Sem dados</span>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {STATUS_GRUPOS.map(g => (
                        <StatusBadge key={g.key} grupo={g} veiculosFiltrados={veiculosTipo} />
                    ))}
                    {outrosCount > 0 && (
                        <StatusBadge
                            grupo={{ key: 'OUTROS', label: 'Outros Status', cor: '#94a3b8', corBg: 'rgba(100,116,139,0.1)', corBorder: 'rgba(100,116,139,0.25)', match: STATUS_OUTROS_MATCH }}
                            veiculosFiltrados={veiculosTipo}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Card Geral (todos os tipos) ──────────────────────────────────────────────

function CardGeral({ veiculos }) {
    const total = veiculos.length;

    const dadosGrafico = STATUS_GRUPOS.map(g => ({
        label: g.label,
        cor: g.cor,
        valor: veiculos.filter(v => g.match(v.status)).length,
    })).filter(d => d.valor > 0);

    const outrosCount = veiculos.filter(v => STATUS_OUTROS_MATCH(v.status)).length;
    if (outrosCount > 0) dadosGrafico.push({ label: 'Outros', cor: '#475569', valor: outrosCount });

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #0d1520 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            boxShadow: '0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow */}
            <div style={{
                position: 'absolute', top: -60, right: -60,
                width: 240, height: 240, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>
                {/* Lado esquerdo: título + gráfico */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: 200 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#a5b4fc', fontWeight: '700', fontSize: '18px', letterSpacing: '0.5px' }}>
                            Frota Total
                        </div>
                        <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>Todos os veículos · Hoje</div>
                    </div>
                    {total > 0 ? (
                        <DonutChart dados={dadosGrafico} total={total} size={200} />
                    ) : (
                        <div style={{
                            width: 200, height: 200, borderRadius: '50%',
                            border: '16px solid rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ color: '#334155', fontSize: '13px' }}>Sem veículos</span>
                        </div>
                    )}
                </div>

                {/* Lado direito: legendas + badges */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', minWidth: 220 }}>
                    {/* Legenda do gráfico */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {dadosGrafico.map(d => (
                            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: 10, height: 10, borderRadius: '3px', background: d.cor, display: 'inline-block' }} />
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>{d.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Status badges */}
                    {STATUS_GRUPOS.map(g => (
                        <StatusBadge key={g.key} grupo={g} veiculosFiltrados={veiculos} />
                    ))}
                    {outrosCount > 0 && (
                        <StatusBadge
                            grupo={{ key: 'OUTROS', label: 'Outros Status', cor: '#94a3b8', corBg: 'rgba(100,116,139,0.1)', corBorder: 'rgba(100,116,139,0.25)', match: STATUS_OUTROS_MATCH }}
                            veiculosFiltrados={veiculos}
                        />
                    )}

                    {/* Mini breakdown por tipo */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {TIPOS.map(t => {
                            const n = veiculos.filter(v => normalizarTipo(v.tipo_veiculo) === t).length;
                            const cor = t === 'TRUCK' ? '#60a5fa' : t === '3/4' ? '#a78bfa' : '#34d399';
                            return (
                                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ color: cor, fontWeight: '700', fontSize: '15px' }}>{n}</span>
                                    <span style={{ color: '#475569', fontSize: '11px' }}>{TIPO_LABEL[t]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardFrota({ socket }) {
    const hoje = new Date().toISOString().substring(0, 10);
    const [dataSelecionada, setDataSelecionada] = useState(hoje);
    const [veiculos, setVeiculos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

    const carregar = useCallback(async (data) => {
        setCarregando(true);
        try {
            const r = await api.get(`/api/provisionamento/dashboard?data=${data}`);
            if (r.data.success) {
                setVeiculos(r.data.veiculos);
                setUltimaAtualizacao(new Date());
            }
        } catch (e) {
            console.error('Erro dashboard frota:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregar(dataSelecionada);
    }, [dataSelecionada, carregar]);

    // Socket: recarregar ao receber atualização de provisionamento
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo !== 'prov_status_atualizado') return;
            // Só recarregar se o dia atualizado for o dia selecionado
            if (data.data === dataSelecionada) {
                carregar(dataSelecionada);
            }
        };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, dataSelecionada, carregar]);

    // Veículos normalizados (CONJUNTO → CARRETA)
    const veiculosNorm = veiculos.map(v => ({ ...v, _tipoNorm: normalizarTipo(v.tipo_veiculo) }));

    const veiculosPorTipo = {
        TRUCK: veiculosNorm.filter(v => v._tipoNorm === 'TRUCK'),
        '3/4': veiculosNorm.filter(v => v._tipoNorm === '3/4'),
        CARRETA: veiculosNorm.filter(v => v._tipoNorm === 'CARRETA'),
    };

    const formatarHora = (d) => {
        if (!d) return '';
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatarDataExibicao = (ds) => {
        if (!ds) return '';
        const [y, m, d] = ds.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div style={{
            padding: '24px',
            minHeight: '100vh',
            background: 'transparent',
            fontFamily: 'Inter, -apple-system, sans-serif',
        }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px' }}>
                        Dashboard de Frota
                    </h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: '4px 0 0' }}>
                        Visão consolidada do provisionamento por tipo de veículo
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {ultimaAtualizacao && (
                        <span style={{ color: '#334155', fontSize: '11px' }}>
                            Atualizado às {formatarHora(ultimaAtualizacao)}
                        </span>
                    )}
                    {carregando && (
                        <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            border: '2px solid #1e293b',
                            borderTop: '2px solid #60a5fa',
                            animation: 'spin 0.7s linear infinite',
                        }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: '#64748b', fontSize: '12px' }}>Data:</label>
                        <input
                            type="date"
                            value={dataSelecionada}
                            onChange={e => setDataSelecionada(e.target.value)}
                            style={{
                                background: '#1e293b', border: '1px solid #334155',
                                borderRadius: '8px', color: '#f1f5f9',
                                padding: '6px 10px', fontSize: '13px', outline: 'none',
                                cursor: 'pointer',
                            }}
                        />
                        {dataSelecionada !== hoje && (
                            <button
                                onClick={() => setDataSelecionada(hoje)}
                                style={{
                                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                                    borderRadius: '8px', color: '#60a5fa', cursor: 'pointer',
                                    padding: '6px 10px', fontSize: '11px', fontWeight: '600',
                                }}
                            >
                                Hoje
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => carregar(dataSelecionada)}
                        disabled={carregando}
                        style={{
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '8px', color: '#a5b4fc', cursor: carregando ? 'not-allowed' : 'pointer',
                            padding: '6px 14px', fontSize: '12px', fontWeight: '600',
                            opacity: carregando ? 0.6 : 1,
                        }}
                    >
                        ↻ Atualizar
                    </button>
                </div>
            </div>

            {/* Card Geral no topo */}
            <div style={{ marginBottom: '20px' }}>
                <CardGeral veiculos={veiculosNorm} />
            </div>

            {/* Cards por tipo */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {TIPOS.map(tipo => (
                    <CardTipo
                        key={tipo}
                        tipo={tipo}
                        veiculosTipo={veiculosPorTipo[tipo]}
                        dataSelecionada={dataSelecionada}
                    />
                ))}
            </div>

            {/* CSS animation */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
