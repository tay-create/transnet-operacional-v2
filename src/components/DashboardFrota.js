import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';
import api from '../services/apiService';
import { MOTIVOS_USABILIDADE } from '../constants';

// ─── Constantes ──────────────────────────────────────────────────────────────

// Cards na ordem de exibição
const TIPOS = ['TRUCK', '3/4', 'CONJUNTO', 'CARRETA'];

const LABEL_MOTIVO_FRONT = {
    DISPONIVEL: 'Disponível sem viagem',
    CARREGADO: 'Carregado aguardando saída',
    AGUARDANDO_FRETE_RETORNO: 'Aguardando frete retorno',
    MANUTENCAO: 'Em manutenção',
    SABADO: 'Sábado (sem operação)',
};

const TIPO_LABEL = { TRUCK: 'Truck', '3/4': '3/4', CONJUNTO: 'Conjunto', CARRETA: 'Carreta' };

// Cor por tipo de card
const COR_TIPO = {
    TRUCK:    { rgb: '59,130,246',  cor: '#60a5fa' },
    '3/4':    { rgb: '167,139,250', cor: '#a78bfa' },
    CONJUNTO: { rgb: '251,146,60',  cor: '#fb923c' },
    CARRETA:  { rgb: '52,211,153',  cor: '#34d399' },
};

/**
 * Normaliza a lista de veículos para o dashboard:
 * - CONJUNTO → _cardTipo='CONJUNTO', _placaExibicao=placa
 * - CARRETA avulsa → _cardTipo='CARRETA', _atrelada=false
 * - demais → _cardTipo=tipo_veiculo
 *
 * Para o card CARRETA, também marca carretas dos CONJUNTOs como _atrelada=true.
 */
function normalizarVeiculos(veiculos) {
    const result = [];
    for (const v of veiculos) {
        if (v.tipo_veiculo === 'CONJUNTO') {
            // Card CONJUNTO
            result.push({ ...v, _cardTipo: 'CONJUNTO', _placaExibicao: v.placa });
            // Gera entrada virtual para a carreta atrelada no card CARRETA
            if (v.carreta) {
                result.push({
                    ...v,
                    _cardTipo: 'CARRETA',
                    _placaExibicao: v.carreta,
                    _atrelada: true,
                });
            }
        } else if (v.tipo_veiculo === 'CARRETA') {
            // CARRETA avulsa: placa='-', placa real está no campo carreta
            const placaReal = (v.placa && v.placa !== '-') ? v.placa : (v.carreta || v.placa);
            result.push({
                ...v,
                _cardTipo: 'CARRETA',
                _placaExibicao: placaReal,
                _atrelada: false,
            });
        } else {
            result.push({ ...v, _cardTipo: v.tipo_veiculo, _placaExibicao: v.placa });
        }
    }
    return result;
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
        label: 'Manutenção',
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
        key: 'EM_OPERACAO',
        label: 'Em Operação',
        cor: '#a78bfa',
        corBg: 'rgba(167,139,250,0.15)',
        corBorder: 'rgba(167,139,250,0.3)',
        match: s => s === 'EM_OPERACAO',
    },
    {
        key: 'CARREGANDO',
        label: 'Carregamento',
        cor: '#60a5fa',
        corBg: 'rgba(59,130,246,0.15)',
        corBorder: 'rgba(59,130,246,0.3)',
        match: s => s === 'CARREGANDO',
    },
];

// Status que o dashboard mostra como "outros" (não mapeados acima)
const STATUS_OUTROS_MATCH = s => !STATUS_GRUPOS.some(g => g.match(s));

// Grupos especiais para o card CARRETA (só Livre + Manutenção — Atrelada não exibida)
const STATUS_GRUPOS_CARRETA = [
    {
        key: 'LIVRE',
        label: 'Livre',
        cor: '#4ade80',
        corBg: 'rgba(34,197,94,0.15)',
        corBorder: 'rgba(34,197,94,0.3)',
        match: (s, v) => v._atrelada === false,
    },
    {
        key: 'MANUTENCAO',
        label: 'Manutenção',
        cor: '#f87171',
        corBg: 'rgba(239,68,68,0.15)',
        corBorder: 'rgba(239,68,68,0.3)',
        match: s => s === 'MANUTENCAO',
    },
];

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

    const lista = veiculosFiltrados.filter(v => grupo.match(v.status, v));
    const count = lista.length;

    function handleEnter(e) {
        clearTimeout(timerRef.current);
        const rect = ref.current?.getBoundingClientRect();
        if (rect) {
            setPos({ top: rect.top - 8, left: rect.left });
        }
        setShow(true);
    }

    function handleLeave() {
        timerRef.current = setTimeout(() => setShow(false), 120);
    }

    return (
        <div
            ref={ref}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}
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
                minWidth: 0, width: '100%',
            }}>
                <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: grupo.cor,
                    boxShadow: `0 0 6px ${grupo.cor}`,
                    flexShrink: 0,
                }} />
                <span style={{ color: grupo.cor, fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{grupo.label}</span>
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
                    flexShrink: 0,
                }}>{count}</span>
            </div>

            {/* Tooltip — renderizado via portal no body para não ser cortado por overflow */}
            {show && lista.length > 0 && typeof document !== 'undefined' && (() => {
                const el = (
                    <div
                        onMouseEnter={() => clearTimeout(timerRef.current)}
                        onMouseLeave={handleLeave}
                        style={{
                            position: 'fixed',
                            top: pos.top,
                            left: pos.left,
                            transform: 'translateY(-100%)',
                            zIndex: 99999,
                            background: '#0f172a',
                            border: `1px solid ${grupo.corBorder}`,
                            borderRadius: '10px',
                            padding: '10px 14px',
                            minWidth: '220px',
                            maxWidth: '320px',
                            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${grupo.corBorder}`,
                        }}
                    >
                        <div style={{ color: grupo.cor, fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {grupo.label} — {count} veículo{count !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {lista.map((v, vi) => (
                                <div key={`${v.id}_${vi}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {/* Placa principal */}
                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#f1f5f9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px', flexShrink: 0 }}>
                                        {v._placaExibicao || v.placa}
                                    </span>
                                    {/* Para CONJUNTO: mostrar placa da carreta atrelada */}
                                    {v.tipo_veiculo === 'CONJUNTO' && v.carreta && (
                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px', flexShrink: 0 }}>
                                            + {v.carreta}
                                        </span>
                                    )}
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
                );
                return createPortal(el, document.body);
            })()}
        </div>
    );
}

// ─── Card por tipo de veículo ─────────────────────────────────────────────────

// Ícone SVG de caminhão estilizado por tipo
function IconeTipo({ tipo, size = 36 }) {
    const cor = COR_TIPO[tipo]?.cor || '#94a3b8';
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
    if (tipo === 'CONJUNTO') {
        // Cavalo + carreta acoplados
        return (
            <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
                {/* Cabine */}
                <rect x="1" y="14" width="13" height="12" rx="2" fill={cor} fillOpacity="0.15" stroke={cor} strokeWidth="1.5"/>
                <rect x="14" y="17" width="7" height="9" rx="1" fill={cor} fillOpacity="0.12" stroke={cor} strokeWidth="1.5"/>
                <rect x="3" y="16" width="7" height="5" rx="1" fill={cor} fillOpacity="0.25"/>
                <circle cx="6" cy="27" r="2.5" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <circle cx="16" cy="27" r="2.5" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                {/* Engate */}
                <line x1="21" y1="22" x2="23" y2="22" stroke={cor} strokeWidth="1.5"/>
                {/* Carreta */}
                <rect x="23" y="12" width="12" height="14" rx="1.5" fill={cor} fillOpacity="0.1" stroke={cor} strokeWidth="1.5"/>
                <line x1="23" y1="18" x2="35" y2="18" stroke={cor} strokeWidth="1" strokeOpacity="0.4"/>
                <circle cx="27" cy="27" r="2.5" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
                <circle cx="33" cy="27" r="2.5" fill={cor} fillOpacity="0.2" stroke={cor} strokeWidth="1.5"/>
            </svg>
        );
    }
    // CARRETA
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

function CardTipo({ tipo, veiculosTipo, style: extraStyle = {} }) {
    const { cor, rgb } = COR_TIPO[tipo] || { cor: '#94a3b8', rgb: '100,116,139' };
    const total = veiculosTipo.length;

    const [showTotalTooltip, setShowTotalTooltip] = useState(false);
    const [totalTooltipPos, setTotalTooltipPos] = useState({ top: 0, left: 0 });
    const totalRef = useRef(null);
    const totalTimerRef = useRef(null);

    const [hoveredCat, setHoveredCat] = useState(null);
    const [catTooltipPos, setCatTooltipPos] = useState({ top: 0, left: 0 });
    const catTimerRef = useRef(null);
    const catRefs = useRef({});

    function handleTotalEnter() {
        clearTimeout(totalTimerRef.current);
        const rect = totalRef.current?.getBoundingClientRect();
        if (rect) setTotalTooltipPos({ top: rect.top - 8, left: rect.right + 8 });
        setShowTotalTooltip(true);
    }
    function handleTotalLeave() {
        totalTimerRef.current = setTimeout(() => setShowTotalTooltip(false), 120);
    }

    function handleCatEnter(cat) {
        clearTimeout(catTimerRef.current);
        const rect = catRefs.current[cat]?.getBoundingClientRect();
        if (rect) setCatTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
        setHoveredCat(cat);
    }
    function handleCatLeave() {
        catTimerRef.current = setTimeout(() => setHoveredCat(null), 120);
    }

    const operandoSet   = new Set(['EM_VIAGEM', 'EM_OPERACAO', 'CARREGANDO', 'CARREGADO', 'RETORNANDO', 'EM_VIAGEM_FRETE_RETORNO', 'TRANSFERENCIA', 'PUXADA']);
    const ociosoSet     = new Set(['DISPONIVEL', 'AGUARDANDO_FRETE_RETORNO']);
    const excluidoSet   = new Set(['SABADO', 'DOMINGO']);
    const manutencaoSet = new Set(['MANUTENCAO']);

    let operando = 0, ocioso = 0, excluido = 0, manutencao = 0;
    const vOperando = [], vOcioso = [], vExcluido = [], vManutencao = [];
    for (const v of veiculosTipo) {
        const st = v.status || 'DISPONIVEL';
        if (operandoSet.has(st))        { operando++;   vOperando.push(v); }
        else if (ociosoSet.has(st))     { ocioso++;     vOcioso.push(v); }
        else if (manutencaoSet.has(st)) { manutencao++; vManutencao.push(v); }
        else if (excluidoSet.has(st))   { excluido++;   vExcluido.push(v); }
        else                            { ocioso++;     vOcioso.push(v); }
    }
    const base = operando + ocioso;
    const taxa = base > 0 ? (operando / base) * 100 : null;
    const zona = zonaCor(taxa);
    const pctOp = base > 0 ? (operando / base) * 100 : 0;

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #111827 100%)',
            border: `1px solid rgba(${rgb},0.25)`,
            borderRadius: '16px',
            padding: '24px',
            flex: '1 1 280px',
            minWidth: '260px',
            boxShadow: `0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
            position: 'relative',
            overflow: 'hidden',
            ...extraStyle,
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
                        background: `rgba(${rgb},0.1)`,
                        border: `1px solid rgba(${rgb},0.25)`,
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
                <div
                    ref={totalRef}
                    onMouseEnter={handleTotalEnter}
                    onMouseLeave={handleTotalLeave}
                    style={{
                        background: `rgba(${rgb},0.12)`,
                        border: `1px solid ${cor}40`,
                        borderRadius: '12px',
                        padding: '6px 14px',
                        textAlign: 'center',
                        cursor: veiculosTipo.length > 0 ? 'pointer' : 'default',
                        position: 'relative',
                    }}
                >
                    <div style={{ color: cor, fontSize: '26px', fontWeight: '800', lineHeight: 1 }}>{total}</div>
                    <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>veículos</div>

                    {showTotalTooltip && veiculosTipo.length > 0 && typeof document !== 'undefined' && (() => {
                        const lista = veiculosTipo;
                        if (lista.length === 0) return null;
                        return createPortal(
                            <div
                                onMouseEnter={() => clearTimeout(totalTimerRef.current)}
                                onMouseLeave={handleTotalLeave}
                                style={{
                                    position: 'fixed',
                                    top: totalTooltipPos.top,
                                    left: totalTooltipPos.left,
                                    transform: 'translateY(-50%)',
                                    zIndex: 99999,
                                    background: '#0f172a',
                                    border: `1px solid rgba(${rgb},0.3)`,
                                    borderRadius: '10px',
                                    padding: '10px 14px',
                                    minWidth: '200px',
                                    maxWidth: '300px',
                                    boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
                                }}
                            >
                                <div style={{ color: cor, fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {TIPO_LABEL[tipo]} — {lista.length} veículo{lista.length !== 1 ? 's' : ''}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {lista.map((v, vi) => (
                                        <div key={`${v.id}_${vi}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#f1f5f9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px', flexShrink: 0 }}>
                                                {v._placaExibicao || v.placa}
                                            </span>
                                            {tipo === 'CONJUNTO' && v.carreta && (
                                                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px', flexShrink: 0 }}>
                                                    + {v.carreta}
                                                </span>
                                            )}
                                            {v.motorista && (
                                                <span style={{ color: '#64748b', fontSize: '11px' }}>
                                                    {v.motorista.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>,
                            document.body
                        );
                    })()}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: 14 }}>
                <div style={{ flexShrink: 0 }}>
                    <MiniGauge taxa={taxa} tamanho={110} />
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: 600, marginTop: -6 }}>Usabilidade</div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>OPERANDO vs OCIOSO</span>
                        <span style={{ color: zona.cor, fontSize: 11, fontWeight: 700 }}>{base > 0 ? `${operando}/${base}` : '—'}</span>
                    </div>
                    <div style={{ height: 14, background: '#1e293b', borderRadius: 7, overflow: 'hidden', display: 'flex' }}>
                        {operando > 0 && <div style={{ width: `${pctOp}%`, background: '#22c55e', transition: 'width 0.3s' }} />}
                        {ocioso > 0 && <div style={{ width: `${100 - pctOp}%`, background: '#f59e0b' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                        {[
                            { key: 'operando',   n: operando,   lista: vOperando,   cor: '#22c55e', label: 'operando' },
                            { key: 'ocioso',     n: ocioso,     lista: vOcioso,     cor: '#f59e0b', label: 'ocioso' },
                            { key: 'manutencao', n: manutencao, lista: vManutencao, cor: '#f87171', label: 'manutenção' },
                            { key: 'excluido',   n: excluido,   lista: vExcluido,   cor: '#64748b', label: 'fora de op.' },
                        ].filter(c => c.n > 0).map(c => (
                            <div
                                key={c.key}
                                ref={el => catRefs.current[c.key] = el}
                                onMouseEnter={() => handleCatEnter(c.key)}
                                onMouseLeave={handleCatLeave}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
                            >
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.cor }} />
                                <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700 }}>{c.n}</span>
                                <span style={{ color: '#64748b', fontSize: 11 }}>{c.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Tooltip categoria */}
                    {hoveredCat && (() => {
                        const catMap = { operando: vOperando, ocioso: vOcioso, manutencao: vManutencao, excluido: vExcluido };
                        const lista = catMap[hoveredCat] || [];
                        const corMap = { operando: '#22c55e', ocioso: '#f59e0b', manutencao: '#f87171', excluido: '#64748b' };
                        const labelMap = { operando: 'Operando', ocioso: 'Ocioso', manutencao: 'Manutenção', excluido: 'Fora de Op.' };
                        if (lista.length === 0) return null;
                        return createPortal(
                            <div
                                onMouseEnter={() => clearTimeout(catTimerRef.current)}
                                onMouseLeave={handleCatLeave}
                                style={{
                                    position: 'fixed', top: catTooltipPos.top, left: catTooltipPos.left,
                                    transform: 'translateY(-50%)', zIndex: 99999,
                                    background: '#0f172a', border: `1px solid ${corMap[hoveredCat]}40`,
                                    borderRadius: 10, padding: '10px 14px', minWidth: 180, maxWidth: 280,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                }}
                            >
                                <div style={{ color: corMap[hoveredCat], fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {labelMap[hoveredCat]} — {lista.length}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {lista.map((v, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#f1f5f9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 4, letterSpacing: 0.5, flexShrink: 0 }}>
                                                {v._placaExibicao || v.placa}
                                            </span>
                                            {tipo === 'CONJUNTO' && v.carreta && (
                                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>+ {v.carreta}</span>
                                            )}
                                            {v.motorista && <span style={{ color: '#64748b', fontSize: 11 }}>{v.motorista.split(' ')[0]}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>,
                            document.body
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

function CardCarretaFooter({ veiculosTipo }) {
    const { cor, rgb } = COR_TIPO['CARRETA'] || { cor: '#94a3b8', rgb: '100,116,139' };
    const total = veiculosTipo.length;
    const atreladas = veiculosTipo.filter(v => v._atrelada === true).length;
    const livres = veiculosTipo.filter(v => v._atrelada === false && v.status !== 'MANUTENCAO').length;
    const manutencao = veiculosTipo.filter(v => v.status === 'MANUTENCAO').length;

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #111827 100%)',
            border: `1px solid rgba(${rgb},0.2)`,
            borderRadius: 14,
            padding: '18px 22px',
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
            <div style={{
                background: `rgba(${rgb},0.1)`,
                border: `1px solid rgba(${rgb},0.25)`,
                borderRadius: 10, padding: 10,
            }}>
                <IconeTipo tipo="CARRETA" size={30} />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                <div style={{ color: cor, fontWeight: 700, fontSize: 15 }}>Carreta</div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>Fora do cálculo de usabilidade</div>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: cor, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{total}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Total</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#60a5fa', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{atreladas}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Atreladas</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{livres}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Livres</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{manutencao}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Manutenção</div>
                </div>
            </div>
        </div>
    );
}

// ─── Card Geral (todos os tipos) ──────────────────────────────────────────────

function CardGeral({ veiculos, contsPorTipo }) {
    // Apenas frota computada na usabilidade (exclui CARRETA)
    const veiculosUsab = veiculos.filter(v => ['TRUCK', '3/4', 'CONJUNTO'].includes(v.tipo_veiculo));
    const total = veiculosUsab.length;

    const operandoSet   = new Set(['EM_VIAGEM', 'EM_OPERACAO', 'CARREGANDO', 'CARREGADO', 'RETORNANDO', 'EM_VIAGEM_FRETE_RETORNO', 'TRANSFERENCIA', 'PUXADA']);
    const ociosoSet     = new Set(['DISPONIVEL', 'AGUARDANDO_FRETE_RETORNO']);
    const excluidoSet   = new Set(['SABADO', 'DOMINGO']);
    const manutencaoSet = new Set(['MANUTENCAO']);

    let operando = 0, ocioso = 0, excluido = 0, manutencao = 0;
    const vOperando = [], vOcioso = [], vExcluido = [], vManutencao = [];
    for (const v of veiculosUsab) {
        const st = v.status || 'DISPONIVEL';
        if (operandoSet.has(st))        { operando++;   vOperando.push(v); }
        else if (ociosoSet.has(st))     { ocioso++;     vOcioso.push(v); }
        else if (manutencaoSet.has(st)) { manutencao++; vManutencao.push(v); }
        else if (excluidoSet.has(st))   { excluido++;   vExcluido.push(v); }
        else                            { ocioso++;     vOcioso.push(v); }
    }

    const [hoveredCatG, setHoveredCatG] = useState(null);
    const [catGTooltipPos, setCatGTooltipPos] = useState({ top: 0, left: 0 });
    const catGTimerRef = useRef(null);
    const catGRefs = useRef({});

    function handleCatGEnter(cat) {
        clearTimeout(catGTimerRef.current);
        const rect = catGRefs.current[cat]?.getBoundingClientRect();
        if (rect) setCatGTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
        setHoveredCatG(cat);
    }
    function handleCatGLeave() {
        catGTimerRef.current = setTimeout(() => setHoveredCatG(null), 120);
    }

    const dadosGrafico = [
        { label: 'Operando',       cor: '#22c55e', valor: operando },
        { label: 'Ocioso',         cor: '#f59e0b', valor: ocioso },
        { label: 'Manutenção',     cor: '#f87171', valor: manutencao },
        { label: 'Fora de Operação', cor: '#64748b', valor: excluido },
    ].filter(d => d.valor > 0);

    const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(0) : 0;

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
            <div style={{
                position: 'absolute', top: -60, right: -60,
                width: 240, height: 240, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', minWidth: 200 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#a5b4fc', fontWeight: '700', fontSize: '18px', letterSpacing: '0.5px' }}>
                            Frota Total
                        </div>
                        <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>TRUCK · 3/4 · CONJUNTO</div>
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

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', minWidth: 240 }}>
                    {[
                        { key: 'operando',   label: 'Operando',         cor: '#22c55e', bg: 'rgba(34,197,94,0.08)',    n: operando,   lista: vOperando,   hint: 'Em viagem, carregando, operação' },
                        { key: 'ocioso',     label: 'Ocioso',           cor: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   n: ocioso,     lista: vOcioso,     hint: 'Disponível, aguardando frete' },
                        { key: 'manutencao', label: 'Manutenção',       cor: '#f87171', bg: 'rgba(248,113,113,0.08)',  n: manutencao, lista: vManutencao, hint: 'Veículos em manutenção' },
                        { key: 'excluido',   label: 'Fora de Operação', cor: '#64748b', bg: 'rgba(100,116,139,0.08)', n: excluido,   lista: vExcluido,   hint: 'Sábado, domingo' },
                    ].filter(z => z.n > 0 || z.key === 'operando' || z.key === 'ocioso' || z.key === 'manutencao').map(z => (
                        <div
                            key={z.label}
                            ref={el => catGRefs.current[z.key] = el}
                            onMouseEnter={() => z.lista.length > 0 && handleCatGEnter(z.key)}
                            onMouseLeave={handleCatGLeave}
                            style={{
                                background: z.bg,
                                border: `1px solid ${z.cor}40`,
                                borderRadius: 10, padding: '12px 14px',
                                display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 12, alignItems: 'center',
                                cursor: z.lista.length > 0 ? 'default' : 'default',
                            }}
                        >
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: z.cor }} />
                            <div>
                                <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{z.label}</div>
                                <div style={{ color: '#64748b', fontSize: 10 }}>{z.hint}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: z.cor, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{z.n}</div>
                                <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{pct(z.n)}%</div>
                            </div>
                        </div>
                    ))}

                    {/* Tooltip categoria CardGeral */}
                    {hoveredCatG && (() => {
                        const catMap = { operando: vOperando, ocioso: vOcioso, manutencao: vManutencao, excluido: vExcluido };
                        const lista = catMap[hoveredCatG] || [];
                        const corMap = { operando: '#22c55e', ocioso: '#f59e0b', manutencao: '#f87171', excluido: '#64748b' };
                        const labelMap = { operando: 'Operando', ocioso: 'Ocioso', manutencao: 'Manutenção', excluido: 'Fora de Op.' };
                        if (lista.length === 0) return null;
                        return createPortal(
                            <div
                                onMouseEnter={() => clearTimeout(catGTimerRef.current)}
                                onMouseLeave={handleCatGLeave}
                                style={{
                                    position: 'fixed', top: catGTooltipPos.top, left: catGTooltipPos.left,
                                    transform: 'translateY(-50%)', zIndex: 99999,
                                    background: '#0f172a', border: `1px solid ${corMap[hoveredCatG]}40`,
                                    borderRadius: 10, padding: '10px 14px', minWidth: 180, maxWidth: 300,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                }}
                            >
                                <div style={{ color: corMap[hoveredCatG], fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {labelMap[hoveredCatG]} — {lista.length}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {lista.map((v, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#f1f5f9', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 4, letterSpacing: 0.5, flexShrink: 0 }}>
                                                {v._placaExibicao || v.placa}
                                            </span>
                                            {v.tipo_veiculo === 'CONJUNTO' && v.carreta && (
                                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>+ {v.carreta}</span>
                                            )}
                                            {v.motorista && <span style={{ color: '#64748b', fontSize: 11 }}>{v.motorista.split(' ')[0]}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>,
                            document.body
                        );
                    })()}

                    <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {['TRUCK', '3/4', 'CONJUNTO'].map(t => {
                            const n = contsPorTipo?.[t] ?? 0;
                            const cor = COR_TIPO[t]?.cor || '#94a3b8';
                            return (
                                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: cor, fontWeight: '700', fontSize: '15px' }}>{n}</span>
                                    <span style={{ color: '#64748b', fontSize: '11px' }}>{TIPO_LABEL[t]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Vista Semanal ────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function obterSegundaFeira(data) {
    const d = new Date(data + 'T12:00:00');
    const dow = d.getDay(); // 0=dom
    const diff = dow === 0 ? -6 : 1 - dow;
    const seg = new Date(d);
    seg.setDate(d.getDate() + diff);
    return seg.toISOString().substring(0, 10);
}

// ─── Taxa de Usabilidade da Frota ────────────────────────────────────────────

function zonaCor(taxa) {
    if (taxa == null) return { cor: '#475569', bg: 'rgba(71,85,105,0.15)', label: 'SEM DADO' };
    if (taxa >= 85) return { cor: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'VERDE' };
    if (taxa > 80) return { cor: '#facc15', bg: 'rgba(250,204,21,0.15)', label: 'AMARELO' };
    return { cor: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'VERMELHO' };
}

function gerarQuinzenas(n = 6) {
    const hoje = new Date();
    const opcoes = [];
    let y = hoje.getFullYear();
    let m = hoje.getMonth() + 1;
    let q = hoje.getDate() <= 15 ? 1 : 2;
    for (let i = 0; i < n; i++) {
        const ultimoDia = new Date(y, m, 0).getDate();
        const inicio = q === 1 ? `${y}-${String(m).padStart(2,'0')}-01` : `${y}-${String(m).padStart(2,'0')}-16`;
        const fim = q === 1 ? `${y}-${String(m).padStart(2,'0')}-15` : `${y}-${String(m).padStart(2,'0')}-${ultimoDia}`;
        const label = `${String(m).padStart(2,'0')}/${y} · Q${q}${i === 0 ? ' (atual)' : ''}`;
        opcoes.push({ inicio, fim, label });
        if (q === 2) { q = 1; } else { q = 2; m--; if (m === 0) { m = 12; y--; } }
    }
    return opcoes;
}

function Gauge({ taxa, tamanho = 220 }) {
    const r = 90;
    const cx = tamanho / 2;
    const cy = tamanho * 0.62;
    const inicioAng = Math.PI;
    const fimAng = 0;
    const valor = Math.max(0, Math.min(100, taxa ?? 0));
    const valorAng = inicioAng - (valor / 100) * Math.PI;

    const polar = (ang, raio = r) => [cx + raio * Math.cos(ang), cy - raio * Math.sin(ang)];
    const arco = (a1, a2, raio = r) => {
        const [x1, y1] = polar(a1, raio);
        const [x2, y2] = polar(a2, raio);
        const grande = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
        const sweep = a1 > a2 ? 1 : 0;
        return `M ${x1} ${y1} A ${raio} ${raio} 0 ${grande} ${sweep} ${x2} ${y2}`;
    };

    const limVermelho = inicioAng - (80 / 100) * Math.PI;
    const limAmarelo = inicioAng - (85 / 100) * Math.PI;
    const zona = zonaCor(taxa);

    return (
        <svg width={tamanho} height={tamanho * 0.8} viewBox={`0 0 ${tamanho} ${tamanho * 0.8}`}>
            <path d={arco(inicioAng, limVermelho)} stroke="#ef4444" strokeWidth="14" fill="none" opacity="0.35" />
            <path d={arco(limVermelho, limAmarelo)} stroke="#facc15" strokeWidth="14" fill="none" opacity="0.35" />
            <path d={arco(limAmarelo, fimAng)} stroke="#22c55e" strokeWidth="14" fill="none" opacity="0.35" />
            {taxa != null && <path d={arco(inicioAng, valorAng)} stroke={zona.cor} strokeWidth="14" fill="none" strokeLinecap="round" />}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="34" fontWeight="800" fill={zona.cor}>
                {taxa != null ? `${taxa.toFixed(1)}%` : '—'}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="600">Taxa de Usabilidade</text>
            <text x={polar(limVermelho, r + 18)[0]} y={polar(limVermelho, r + 18)[1] + 4} textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="700">80</text>
            <text x={polar(limAmarelo, r + 18)[0]} y={polar(limAmarelo, r + 18)[1] + 4} textAnchor="middle" fontSize="10" fill="#facc15" fontWeight="700">85</text>
        </svg>
    );
}

function TimelineDiaria({ diario }) {
    if (!diario || diario.length === 0) return <div style={{ color: '#64748b', fontSize: 12, padding: 24 }}>Sem dados no período.</div>;
    const w = 560, h = 140, pl = 36, pr = 12, pt = 12, pb = 24;
    const iw = w - pl - pr, ih = h - pt - pb;
    const pontos = diario.map((d, i) => ({ ...d, x: pl + (iw * i) / Math.max(1, diario.length - 1), y: d.taxa == null ? null : pt + ih - (d.taxa / 100) * ih }));
    const metaY = pt + ih - (85 / 100) * ih;
    const alertaY = pt + ih - (80 / 100) * ih;
    const validos = pontos.filter(p => p.y != null);
    const linha = validos.length > 0 ? validos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%' }}>
            {[0, 25, 50, 75, 100].map(v => {
                const y = pt + ih - (v / 100) * ih;
                return <g key={v}>
                    <line x1={pl} x2={w - pr} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
                    <text x={pl - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#475569">{v}</text>
                </g>;
            })}
            <line x1={pl} x2={w - pr} y1={metaY} y2={metaY} stroke="#22c55e" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
            <line x1={pl} x2={w - pr} y1={alertaY} y2={alertaY} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
            {linha && <path d={linha} stroke="#60a5fa" strokeWidth="2" fill="none" />}
            {pontos.map((p, i) => p.y != null && (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={zonaCor(p.taxa).cor}>
                    <title>{`${p.data}: ${p.taxa.toFixed(1)}% (${p.operando}/${p.operando + p.ocioso})`}</title>
                </circle>
            ))}
            {pontos.map((p, i) => (i === 0 || i === pontos.length - 1 || i === Math.floor(pontos.length / 2)) && (
                <text key={`lbl-${i}`} x={p.x} y={h - 6} textAnchor="middle" fontSize="9" fill="#64748b">{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</text>
            ))}
        </svg>
    );
}

function TaxaUsabilidade({ socket }) {
    const quinzenas = React.useMemo(() => gerarQuinzenas(6), []);
    const [periodo, setPeriodo] = useState(quinzenas[0]);
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async (p) => {
        setCarregando(true);
        try {
            const r = await api.get(`/api/frota/usabilidade?inicio=${p.inicio}&fim=${p.fim}`);
            if (r.data.success) setDados(r.data);
        } catch (e) { console.error('usabilidade:', e); }
        finally { setCarregando(false); }
    }, []);

    useEffect(() => { carregar(periodo); }, [periodo, carregar]);

    useEffect(() => {
        if (!socket) return;
        const handler = () => carregar(periodo);
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, periodo, carregar]);

    const diario = dados?.diario || [];
    // Último dia com dados reais até hoje (ignora dias futuros e dias sem provisionamento)
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
    const ultimoDia = [...diario].reverse().find(d => d.taxa != null && d.data <= hoje) || (diario.length > 0 ? diario[diario.length - 1] : null);
    const taxaHoje = ultimoDia?.taxa ?? null;
    const ehQuinzenaAtual = periodo.inicio === quinzenas[0].inicio;
    const taxaGauge = ehQuinzenaAtual ? taxaHoje : (dados?.taxa_periodo ?? null);
    const zonaGauge = zonaCor(taxaGauge);
    const zona = zonaCor(dados?.taxa_periodo);
    const labelGauge = ehQuinzenaAtual
        ? (ultimoDia?.taxa != null ? `${ultimoDia.data.slice(8,10)}/${ultimoDia.data.slice(5,7)} · último dado` : '')
        : periodo.label.replace(' (atual)', '');
    const barras = [{ label: periodo.label.replace(' (atual)', ''), taxa: dados?.taxa_periodo ?? null, atual: true }]
        .concat((dados?.quinzenas_anteriores || []).map(q => ({ label: q.label, taxa: q.taxa, atual: false })));

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #0d1520 100%)',
            border: `1px solid ${zonaGauge.cor}33`,
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 20,
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                    <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: 0 }}>Taxa de Usabilidade da Frota</h3>
                    <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>Meta ≥ 85% · Alerta ≤ 80% · Frota: TRUCK, 3/4, CONJUNTO</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {carregando && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #1e293b', borderTop: `2px solid ${zona.cor}`, animation: 'spin 0.7s linear infinite' }} />}
                    <select value={periodo.inicio} onChange={e => setPeriodo(quinzenas.find(q => q.inicio === e.target.value))}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '6px 10px', fontSize: 12, outline: 'none' }}>
                        {quinzenas.map(q => <option key={q.inicio} value={q.inicio}>{q.label}</option>)}
                    </select>
                    <span style={{ fontSize: 10, fontWeight: 800, color: zonaGauge.cor, background: zonaGauge.bg, border: `1px solid ${zonaGauge.cor}55`, padding: '4px 10px', borderRadius: 6, letterSpacing: 0.5 }}>{zonaGauge.label}</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) 1fr', gap: 20, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Gauge taxa={taxaGauge} />
                    {labelGauge && <div style={{ color: '#64748b', fontSize: 10, fontWeight: 600, marginTop: -8 }}>
                        {labelGauge}
                    </div>}
                </div>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>Evolução diária · {periodo.label.replace(' (atual)', '')}</div>
                    <TimelineDiaria diario={dados?.diario || []} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Comparativo por quinzena</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {barras.map(b => {
                            const z = zonaCor(b.taxa);
                            const w = b.taxa != null ? `${Math.max(2, Math.min(100, b.taxa))}%` : '0%';
                            return (
                                <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 52px', gap: 8, alignItems: 'center' }}>
                                    <span style={{ color: b.atual ? '#f1f5f9' : '#94a3b8', fontSize: 11, fontWeight: b.atual ? 700 : 500 }}>{b.label}</span>
                                    <div style={{ height: 12, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{ width: w, height: '100%', background: z.cor, transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ color: z.cor, fontSize: 11, fontWeight: 700, textAlign: 'right' }}>{b.taxa != null ? `${b.taxa.toFixed(1)}%` : '—'}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Por tipo de veículo</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {['TRUCK', '3/4', 'CONJUNTO'].map(t => {
                            const taxa = dados?.por_tipo?.[t];
                            const z = zonaCor(taxa);
                            return (
                                <div key={t} style={{ background: z.bg, border: `1px solid ${z.cor}55`, borderRadius: 8, padding: '10px 12px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>{t}</div>
                                    <div style={{ color: z.cor, fontSize: 20, fontWeight: 800, marginTop: 2 }}>{taxa != null ? `${taxa.toFixed(1)}%` : '—'}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MiniGauge({ taxa, tamanho = 90 }) {
    const r = 34;
    const cx = tamanho / 2;
    const cy = tamanho * 0.62;
    const inicioAng = Math.PI;
    const fimAng = 0;
    const valor = Math.max(0, Math.min(100, taxa ?? 0));
    const valorAng = inicioAng - (valor / 100) * Math.PI;

    const polar = (ang, raio = r) => [cx + raio * Math.cos(ang), cy - raio * Math.sin(ang)];
    const arco = (a1, a2, raio = r) => {
        const [x1, y1] = polar(a1, raio);
        const [x2, y2] = polar(a2, raio);
        const grande = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
        const sweep = a1 > a2 ? 1 : 0;
        return `M ${x1} ${y1} A ${raio} ${raio} 0 ${grande} ${sweep} ${x2} ${y2}`;
    };
    const zona = zonaCor(taxa);

    return (
        <svg width={tamanho} height={tamanho * 0.66} viewBox={`0 0 ${tamanho} ${tamanho * 0.66}`}>
            <path d={arco(inicioAng, fimAng)} stroke="#1e293b" strokeWidth="6" fill="none" />
            {taxa != null && <path d={arco(inicioAng, valorAng)} stroke={zona.cor} strokeWidth="6" fill="none" strokeLinecap="round" />}
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill={zona.cor}>
                {taxa != null ? `${taxa.toFixed(1)}%` : '—'}
            </text>
        </svg>
    );
}

function MotivosBaixaUsabilidade({ socket, veiculos = [] }) {
    const quinzenas = React.useMemo(() => gerarQuinzenas(6), []);
    const [dadosAnt, setDadosAnt] = useState(null);

    const carregarAnt = useCallback(async () => {
        const ant = quinzenas[1];
        if (!ant) return;
        try {
            const r = await api.get(`/api/frota/usabilidade?inicio=${ant.inicio}&fim=${ant.fim}`);
            if (r.data.success) setDadosAnt(r.data);
        } catch (e) { console.error('motivos-ant:', e); }
    }, [quinzenas]);

    useEffect(() => { carregarAnt(); }, [carregarAnt]);

    // Motivos de hoje — calculados direto dos veículos ativos (TRUCK/3/4/CONJUNTO)
    const ociosoSet = new Set(['DISPONIVEL', 'CARREGADO', 'AGUARDANDO_FRETE_RETORNO']);
    const excluidoSet = new Set(['MANUTENCAO', 'SABADO']);
    const operandoSet = new Set(['EM_VIAGEM','EM_OPERACAO','CARREGANDO','RETORNANDO','EM_VIAGEM_FRETE_RETORNO','TRANSFERENCIA','PUXADA']);

    const veiculosUsab = veiculos.filter(v => ['TRUCK','3/4','CONJUNTO'].includes(v.tipo_veiculo));
    const motivosCount = {};
    let operando = 0;
    for (const v of veiculosUsab) {
        const st = v.status || 'DISPONIVEL';
        if (operandoSet.has(st)) { operando++; continue; }
        motivosCount[st] = (motivosCount[st] || 0) + 1;
    }
    const base = veiculosUsab.length;
    const taxaHoje = base > 0 ? (operando / base) * 100 : null;
    const motivosHoje = Object.entries(motivosCount)
        .map(([status, qtd]) => ({ status, qtd, label: LABEL_MOTIVO_FRONT[status] || status }))
        .sort((a, b) => b.qtd - a.qtd);
    const saudavel = taxaHoje != null && taxaHoje >= 85;

    const motivosQuinzena = dadosAnt?.motivos_quinzena || [];
    const totalDiasAnt = (dadosAnt?.diario || []).length;
    const maxVeiculoDias = motivosQuinzena.length > 0 ? motivosQuinzena[0].veiculo_dias : 1;
    const periodoAntLabel = quinzenas[1]?.label?.replace(' (atual)', '') || '—';

    const fmtData = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #0d1520 100%)',
            border: '1px solid rgba(250,204,21,0.2)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 20,
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} style={{ color: '#facc15' }} />
                    <div>
                        <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: 0 }}>Motivos de Baixa Usabilidade</h3>
                        <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>Por que a frota não está operando · Hoje + recorrentes da quinzena anterior</p>
                    </div>
                </div>
                <span style={{ color: '#64748b', fontSize: 11 }}>Recorrentes: {periodoAntLabel}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {/* HOJE */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Agora
                        </span>
                        {taxaHoje != null && (
                            <span style={{ color: zonaCor(taxaHoje).cor, fontSize: 12, fontWeight: 700 }}>
                                {taxaHoje.toFixed(1)}%
                            </span>
                        )}
                    </div>

                    {saudavel || motivosHoje.length === 0 ? (
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                            <span style={{ color: '#bbf7d0', fontSize: 12, fontWeight: 500 }}>
                                Frota saudável — sem motivos de perda relevantes.
                            </span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {motivosHoje.map(m => {
                                const cfg = MOTIVOS_USABILIDADE[m.status] || { cor: '#94a3b8', categoria: '—' };
                                return (
                                    <div key={m.status} style={{
                                        display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 10, alignItems: 'center',
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                        padding: '8px 12px', borderRadius: 8,
                                    }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.cor }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                                            <span style={{ color: '#64748b', fontSize: 10 }}>{cfg.categoria}</span>
                                        </div>
                                        <span style={{ color: cfg.cor, fontSize: 16, fontWeight: 800 }}>{m.qtd}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* QUINZENA */}
                <div>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        Recorrentes · {periodoAntLabel}
                    </div>
                    {motivosQuinzena.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: 12, padding: 16, textAlign: 'center' }}>Sem ocorrências no período anterior.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {motivosQuinzena.map((m, idx) => {
                                const cfg = MOTIVOS_USABILIDADE[m.status] || { cor: '#94a3b8' };
                                const pct = (m.veiculo_dias / maxVeiculoDias) * 100;
                                return (
                                    <div key={m.status} style={{
                                        display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10, alignItems: 'center',
                                        background: idx === 0 ? `${cfg.cor}14` : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${idx === 0 ? cfg.cor + '40' : 'rgba(255,255,255,0.05)'}`,
                                        padding: '10px 12px', borderRadius: 8,
                                    }}>
                                        <span style={{
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: `${cfg.cor}22`, color: cfg.cor,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 800,
                                        }}>{idx + 1}</span>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                                                <span style={{ color: cfg.cor, fontSize: 13, fontWeight: 800 }}>{m.veiculo_dias}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                <div style={{ flex: 1, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: cfg.cor }} />
                                                </div>
                                                <span style={{ color: '#64748b', fontSize: 10 }}>{m.dias_presente}/{totalDiasAnt} dias</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VistaSemanal({ socket, onDiaClick, diaSelecionado }) {
    const hoje = new Date().toISOString().substring(0, 10);
    const [inicioSemana, setInicioSemana] = useState(hoje);
    const [dadosSemana, setDadosSemana] = useState(null);
    const [carregandoSemana, setCarregandoSemana] = useState(false);
    const [hoveredCell, setHoveredCell] = useState(null); // { linhaKey, diaIdx, top, left }
    const hoverTimerRef = useRef(null);

    const carregarSemana = useCallback(async (inicio) => {
        setCarregandoSemana(true);
        try {
            const r = await api.get(`/api/provisionamento/semana?inicio=${inicio}`);
            if (r.data.success) setDadosSemana(r.data);
        } catch (e) {
            console.error('Erro semana:', e);
        } finally {
            setCarregandoSemana(false);
        }
    }, []);

    useEffect(() => { carregarSemana(inicioSemana); }, [inicioSemana, carregarSemana]);

    useEffect(() => {
        if (!socket) return;
        const handler = () => carregarSemana(inicioSemana);
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, inicioSemana, carregarSemana]);

    function mudarSemana(delta) {
        const d = new Date(inicioSemana + 'T12:00:00');
        d.setDate(d.getDate() + delta * 7);
        setInicioSemana(d.toISOString().substring(0, 10));
    }

    function irHoje() {
        setInicioSemana(hoje);
    }

    // Gerar array de 7 dias a partir do inicioSemana
    const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicioSemana + 'T12:00:00');
        d.setDate(d.getDate() + i);
        return d.toISOString().substring(0, 10);
    });

    const semanaAtual = inicioSemana === hoje;

    const totaisPorDia = dadosSemana?.totais || dadosSemana?.totalizadores || {};

    const linhas = [
        { key: 'disponiveis',  label: 'Disponível',       cor: '#4ade80' },
        { key: 'em_operacao',  label: 'Em Operação',      cor: '#a78bfa' },
        { key: 'em_viagem',    label: 'Em Viagem',         cor: '#facc15' },
        { key: 'carregando',   label: 'Carregamento',   cor: '#60a5fa' },
        { key: 'manutencao',   label: 'Manutenção',     cor: '#f87171' },
        { key: 'outros',       label: 'Outros',            cor: '#94a3b8' },
    ];

    // Formatar data para exibição: "24/03"
    function fmt(ds) {
        const [, m, d] = ds.split('-');
        return `${d}/${m}`;
    }

    return (
        <div style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #0d1520 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '20px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow */}
            <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 200, height: 200, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <span style={{ color: '#a5b4fc', fontWeight: '700', fontSize: '15px' }}>Visão Semanal</span>
                    <span style={{ color: '#334155', fontSize: '11px', marginLeft: '10px' }}>
                        {fmt(dias[0])} – {fmt(dias[6])}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {carregandoSemana && (
                        <div style={{
                            width: 14, height: 14, borderRadius: '50%',
                            border: '2px solid #1e293b', borderTop: '2px solid #60a5fa',
                            animation: 'spin 0.7s linear infinite',
                        }} />
                    )}
                    {!semanaAtual && (
                        <button onClick={irHoje} style={{
                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: '6px', color: '#60a5fa', cursor: 'pointer',
                            padding: '4px 10px', fontSize: '11px', fontWeight: '600',
                        }}>Hoje</button>
                    )}
                    <button onClick={() => mudarSemana(-1)} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                        borderRadius: '6px', color: '#64748b', cursor: 'pointer',
                        padding: '4px 7px', display: 'flex', alignItems: 'center',
                    }}>
                        <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => mudarSemana(1)} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
                        borderRadius: '6px', color: '#64748b', cursor: 'pointer',
                        padding: '4px 7px', display: 'flex', alignItems: 'center',
                    }}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Tabela semanal */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 560 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 130, textAlign: 'left', color: '#475569', fontSize: '10px', fontWeight: '600', letterSpacing: '0.5px', paddingBottom: '8px' }}>
                                STATUS
                            </th>
                            {dias.map(d => {
                                const isHoje = d === hoje;
                                const isSel = d === diaSelecionado;
                                const dow = new Date(d + 'T12:00:00').getDay();
                                return (
                                    <th key={d} style={{
                                        textAlign: 'center', paddingBottom: '8px', minWidth: 68,
                                        cursor: onDiaClick ? 'pointer' : 'default',
                                    }} onClick={() => onDiaClick && onDiaClick(d)}>
                                        <div style={{
                                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                            background: isSel ? 'rgba(59,130,246,0.2)' : isHoje ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            border: isSel ? '1px solid rgba(59,130,246,0.5)' : isHoje ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                                            borderRadius: '8px', padding: '4px 10px',
                                            transition: 'all 0.15s',
                                        }}>
                                            <span style={{ color: isSel ? '#93c5fd' : isHoje ? '#a5b4fc' : '#475569', fontSize: '10px', fontWeight: '600' }}>
                                                {DIAS_SEMANA[dow]}
                                            </span>
                                            <span style={{ color: isSel ? '#dbeafe' : isHoje ? '#c7d2fe' : '#64748b', fontSize: '12px', fontWeight: '700', marginTop: '1px' }}>
                                                {fmt(d)}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {linhas.map((linha, li) => {
                            const valoresDia = dias.map(d => totaisPorDia[d]?.[linha.key] ?? 0);
                            return (
                                <tr key={linha.key}>
                                    <td style={{
                                        padding: '6px 0',
                                        borderTop: li === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                            <span style={{
                                                width: 7, height: 7, borderRadius: '50%',
                                                background: linha.cor,
                                                boxShadow: `0 0 5px ${linha.cor}80`,
                                                flexShrink: 0,
                                            }} />
                                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{linha.label}</span>
                                        </div>
                                    </td>
                                    {valoresDia.map((v, vi) => {
                                        const isHoje = dias[vi] === hoje;
                                        const bkd = totaisPorDia[dias[vi]]?.breakdown?.[linha.key];
                                        return (
                                            <td
                                                key={vi}
                                                style={{
                                                    textAlign: 'center', padding: '6px 4px',
                                                    borderTop: li === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                    background: isHoje ? 'rgba(99,102,241,0.05)' : 'transparent',
                                                    position: 'relative',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (v <= 0 || !bkd) return;
                                                    clearTimeout(hoverTimerRef.current);
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredCell({ linhaKey: linha.key, diaIdx: vi, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                                                }}
                                                onMouseLeave={() => {
                                                    hoverTimerRef.current = setTimeout(() => setHoveredCell(null), 150);
                                                }}
                                            >
                                                <span style={{
                                                    color: v > 0 ? linha.cor : '#1e293b',
                                                    fontWeight: v > 0 ? '700' : '400',
                                                    fontSize: '13px',
                                                    cursor: v > 0 && bkd ? 'default' : 'default',
                                                }}>
                                                    {v > 0 ? v : '–'}
                                                </span>

                                                {hoveredCell?.linhaKey === linha.key && hoveredCell?.diaIdx === vi && bkd && typeof document !== 'undefined' && createPortal(
                                                    <div
                                                        onMouseEnter={() => clearTimeout(hoverTimerRef.current)}
                                                        onMouseLeave={() => { hoverTimerRef.current = setTimeout(() => setHoveredCell(null), 150); }}
                                                        style={{
                                                            position: 'fixed',
                                                            top: hoveredCell.top,
                                                            left: hoveredCell.left,
                                                            transform: 'translateX(-50%)',
                                                            zIndex: 99999,
                                                            background: '#0f172a',
                                                            border: `1px solid ${linha.cor}40`,
                                                            borderRadius: '10px',
                                                            padding: '10px 14px',
                                                            minWidth: '150px',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                                            pointerEvents: 'auto',
                                                        }}
                                                    >
                                                        <div style={{ color: linha.cor, fontSize: '10px', fontWeight: '700', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            {linha.label} — {v}
                                                        </div>
                                                        {[['TRUCK', '#60a5fa'], ['3/4', '#a78bfa'], ['CONJUNTO', '#fb923c'], ['CARRETA', '#34d399']].map(([t, c]) => {
                                                            const n = bkd[t] || 0;
                                                            if (n === 0) return null;
                                                            return (
                                                                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '3px' }}>
                                                                    <span style={{ color: c, fontSize: '11px', fontWeight: '600' }}>{t}</span>
                                                                    <span style={{ color: '#f1f5f9', fontSize: '12px', fontWeight: '700' }}>{n}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>,
                                                    document.body
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

const STATUS_COR_PROG = {
    PUXADA:           '#a78bfa',
    TRANSFERENCIA:    '#60a5fa',
    CARREGANDO:       '#fb923c',
    CARREGADO:        '#818cf8',
    EM_VIAGEM:        '#34d399',
    EM_OPERACAO:      '#a78bfa',
    MANUTENCAO:       '#f87171',
    RETORNANDO:       '#fbbf24',
    DISPONIVEL:       '#475569',
    EM_VIAGEM_FRETE_RETORNO: '#34d399',
    AGUARDANDO_FRETE_RETORNO: '#fbbf24',
    PROJETO_SUL:      '#60a5fa',
    PROJETO_SP:       '#60a5fa',
    SABADO:           '#64748b',
    DOMINGO:          '#64748b',
    FERIADO:          '#64748b',
};

const STATUS_LABEL_PROG = {
    PUXADA: 'Puxada',
    TRANSFERENCIA: 'Transferência',
    CARREGANDO: 'Carregamento',
    CARREGADO: 'Carregado',
    EM_VIAGEM: 'Em Viagem',
    EM_OPERACAO: 'Em Operação',
    DISPONIVEL: 'Disponível',
    MANUTENCAO: 'Manutenção',
    RETORNANDO: 'Retornando',
    EM_VIAGEM_FRETE_RETORNO: 'Frete Retorno',
    AGUARDANDO_FRETE_RETORNO: 'Ag. Frete Ret.',
    PROJETO_SUL: 'Projeto Sul',
    PROJETO_SP: 'Projeto SP',
    SABADO: 'Sábado',
    DOMINGO: 'Domingo',
    FERIADO: 'Feriado',
};

export default function DashboardFrota({ socket }) {
    const hoje = new Date().toISOString().substring(0, 10);
    const [abaAtiva, setAbaAtiva] = useState('dashboard');
    const [dataSelecionada, setDataSelecionada] = useState(hoje);
    const [veiculos, setVeiculos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

    // Programação do Dia
    const [progDia, setProgDia] = useState([]);
    const [obsDia, setObsDia] = useState('');
    const [obsSalvo, setObsSalvo] = useState('');
    const [obsSalvando, setObsSalvando] = useState(false);
    const [dataProgDia, setDataProgDia] = useState(hoje);
    const [carregandoProg, setCarregandoProg] = useState(false);
    const [obsCards, setObsCards] = useState({});

    // Modal PDF Provisionamento
    const [modalPdfProv, setModalPdfProv] = useState(false);
    const [pdfDe, setPdfDe] = useState(hoje);
    const [pdfAte, setPdfAte] = useState(hoje);
    const [gerandoPdfProv, setGerandoPdfProv] = useState(false);
    const [obsSalvandoCard, setObsSalvandoCard] = useState({});

    const salvarObsCard = async (veiculoId) => {
        setObsSalvandoCard(prev => ({ ...prev, [veiculoId]: true }));
        try {
            await api.put('/api/provisionamento/obs', { veiculo_id: veiculoId, data: dataProgDia, observacao: obsCards[veiculoId] || '' });
            setProgDia(prev => prev.map(v => v.id === veiculoId ? { ...v, observacao: obsCards[veiculoId] || '' } : v));
        } catch (e) { console.error('Erro salvar obs card:', e); }
        finally { setObsSalvandoCard(prev => ({ ...prev, [veiculoId]: false })); }
    };

    const carregarProgDia = useCallback(async (data) => {
        setCarregandoProg(true);
        try {
            const [r1, r2] = await Promise.all([
                api.get(`/api/provisionamento/dashboard?data=${data}`),
                api.get(`/api/frota/obs-dia?data=${data}`)
            ]);
            if (r1.data.success) {
                setProgDia(r1.data.veiculos);
                const obsMap = {};
                r1.data.veiculos.forEach(v => { if (v.observacao) obsMap[v.id] = v.observacao; });
                setObsCards(obsMap);
            }
            const obs = r2.data.observacao || '';
            setObsDia(obs);
            setObsSalvo(obs);
        } catch (e) { console.error('Erro prog dia:', e); }
        finally { setCarregandoProg(false); }
    }, []);

    useEffect(() => {
        if (abaAtiva === 'programacao') carregarProgDia(dataProgDia);
    }, [abaAtiva, dataProgDia, carregarProgDia]);

    const salvarObs = async () => {
        setObsSalvando(true);
        try {
            await api.put('/api/frota/obs-dia', { data: dataProgDia, observacao: obsDia });
            setObsSalvo(obsDia);
        } catch (e) { console.error('Erro salvar obs:', e); }
        finally { setObsSalvando(false); }
    };

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

    // Normaliza veículos: CONJUNTO fica como CONJUNTO, CARRETA avulsa marca _atrelada
    const veiculosNorm2 = normalizarVeiculos(veiculos);

    const veiculosPorTipo = {
        TRUCK:    veiculosNorm2.filter(v => v._cardTipo === 'TRUCK'),
        '3/4':    veiculosNorm2.filter(v => v._cardTipo === '3/4'),
        CONJUNTO: veiculosNorm2.filter(v => v._cardTipo === 'CONJUNTO'),
        CARRETA:  veiculosNorm2.filter(v => v._cardTipo === 'CARRETA'),
    };

    // CardGeral usa só os veículos originais sem entradas virtuais (sem duplicar CONJUNTOs)
    const veiculosNorm = veiculos.map(v => {
        if (v.tipo_veiculo === 'CARRETA') {
            const placaReal = (v.placa && v.placa !== '-') ? v.placa : (v.carreta || v.placa);
            return { ...v, _placaExibicao: placaReal };
        }
        return { ...v, _placaExibicao: v.placa };
    });

    const formatarHora = (d) => {
        if (!d) return '';
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatarDataExibicao = (ds) => {
        if (!ds) return '';
        const [y, m, d] = ds.split('-');
        return `${d}/${m}/${y}`;
    };

    async function gerarPdfProvDiario() {
        if (!pdfDe || !pdfAte) return;
        setGerandoPdfProv(true);
        try {
            // Busca cards operacionais criados no período (data_criacao)
            const r = await api.get(`/veiculos?dataCriacaoInicio=${pdfDe}&dataCriacaoFim=${pdfAte}&limit=500`);
            const vs = (r.data?.veiculos || []);

            const OPERANDO = new Set(['EM_VIAGEM','EM_OPERACAO','CARREGANDO','CARREGADO','RETORNANDO','EM_VIAGEM_FRETE_RETORNO','TRANSFERENCIA','PUXADA','PROJETO_SUL','PROJETO_SP']);
            const MANUT    = new Set(['MANUTENCAO']);

            // Retorna o status mais relevante para exibição principal
            const statusEfetivo = (v) => {
                if (v.operacao === 'Moreno') return v.status_moreno || 'DISPONIVEL';
                if (v.operacao === 'Ambas' || v.operacao === 'Consolidado') {
                    // Para consolidado, retorna o mais avançado
                    const sr = v.status_recife || 'DISPONIVEL';
                    const sm = v.status_moreno || 'DISPONIVEL';
                    return OPERANDO.has(sr) ? sr : OPERANDO.has(sm) ? sm : sr;
                }
                return v.status_recife || 'DISPONIVEL';
            };

            const nTotal = vs.length;
            const nOp = vs.filter(v => OPERANDO.has(statusEfetivo(v))).length;
            const nOc = vs.filter(v => !OPERANDO.has(statusEfetivo(v)) && !MANUT.has(statusEfetivo(v))).length;
            const nMt = vs.filter(v => MANUT.has(statusEfetivo(v))).length;

            const COR_ST = {
                DISPONIVEL:  { bg:'#dcfce7', text:'#15803d', border:'#86efac' },
                EM_OPERACAO: { bg:'#fef9c3', text:'#854d0e', border:'#fde047' },
                CARREGADO:   { bg:'#fef9c3', text:'#854d0e', border:'#fde047' },
                CARREGANDO:  { bg:'#fef9c3', text:'#854d0e', border:'#fde047' },
                PUXADA:      { bg:'#dbeafe', text:'#1d4ed8', border:'#93c5fd' },
                MANUTENCAO:  { bg:'#fee2e2', text:'#991b1b', border:'#fca5a5' },
            };
            const corSt = st => COR_ST[st] || { bg:'#f1f5f9', text:'#475569', border:'#cbd5e1' };
            const labelSt = st => STATUS_LABEL_PROG[st] || st;

            const fmtD = d => { const [y,m,dd] = (d||'').substring(0,10).split('-'); return `${dd}/${m}/${y}`; };
            const fmtDT = dt => fmtD((dt||'').substring(0,10));
            const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const periodoStr = pdfDe === pdfAte ? fmtD(pdfDe) : `${fmtD(pdfDe)} a ${fmtD(pdfAte)}`;

            const linhas = vs.map((v, idx) => {
                const st = statusEfetivo(v);
                const c = corSt(st);
                const tipoCor = v.tipo_veiculo === 'CONJUNTO' ? '#fb923c' : v.tipo_veiculo === 'TRUCK' ? '#2563eb' : v.tipo_veiculo === 'CARRETA' ? '#059669' : '#7c3aed';
                const destino = v.destino || '';
                // Para consolidado, mostrar ambos os status
                const statusHtml = (v.operacao === 'Ambas' || v.operacao === 'Consolidado')
                    ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${corSt(v.status_recife||'DISPONIVEL').bg};color:${corSt(v.status_recife||'DISPONIVEL').text};border:1px solid ${corSt(v.status_recife||'DISPONIVEL').border};">REC: ${labelSt(v.status_recife||'DISPONIVEL')}</span><br><span style="display:inline-block;margin-top:2px;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${corSt(v.status_moreno||'DISPONIVEL').bg};color:${corSt(v.status_moreno||'DISPONIVEL').text};border:1px solid ${corSt(v.status_moreno||'DISPONIVEL').border};">MOR: ${labelSt(v.status_moreno||'DISPONIVEL')}</span>`
                    : `<span style="display:inline-block;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border};white-space:nowrap;">${labelSt(st)}</span>`;
                return `<tr style="background:${idx%2===0?'#fff':'#f8fafc'};">
                    <td style="padding:5px 8px;font-size:10px;color:#64748b;white-space:nowrap;">${fmtDT(v.data_criacao)}</td>
                    <td style="padding:5px 8px;font-weight:700;font-size:11px;white-space:nowrap;color:#0f172a;">${v.placa || '—'}</td>
                    <td style="padding:5px 8px;font-size:10px;color:#64748b;">${v.carreta || '—'}</td>
                    <td style="padding:5px 8px;"><span style="font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;background:${tipoCor}22;color:${tipoCor};border:1px solid ${tipoCor}44;">${v.tipo_veiculo || '—'}</span></td>
                    <td style="padding:5px 8px;font-size:11px;color:#1e293b;">${v.motorista || '—'}</td>
                    <td style="padding:5px 8px;font-size:10px;color:#475569;">${v.operacao || '—'}</td>
                    <td style="padding:5px 8px;">${statusHtml}</td>
                    <td style="padding:5px 8px;font-size:10px;color:#475569;font-style:${destino?'normal':'italic'};">${destino || '—'}</td>
                    <td style="padding:5px 8px;font-size:10px;color:#334155;">${v.observacao || ''}</td>
                </tr>`;
            }).join('');

            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Cards Operacionais — ${periodoStr}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;}
  @media print{
    @page{size:A4 landscape;margin:10mm 8mm;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
  .pagina{width:277mm;min-height:190mm;display:flex;flex-direction:column;}
  .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:white;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;}
  .header-title{font-size:16px;font-weight:800;letter-spacing:.5px;color:#7dd3fc;}
  .header-sub{font-size:12px;color:#e2e8f0;margin-top:3px;font-weight:600;}
  .kpi-bar{display:flex;gap:10px;padding:10px 18px;background:#f8fafc;border-bottom:2px solid #e2e8f0;}
  .kpi-card{flex:1;border-radius:8px;padding:8px 12px;border-left:4px solid;}
  .kpi-val{font-size:22px;font-weight:800;line-height:1;}
  .kpi-lbl{font-size:9px;font-weight:700;margin-top:3px;text-transform:uppercase;letter-spacing:.5px;}
  table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;}
  col.c-criado{width:72px;}
  col.c-veiculo{width:72px;}
  col.c-carreta{width:80px;}
  col.c-tipo{width:58px;}
  col.c-motorista{width:130px;}
  col.c-operacao{width:70px;}
  col.c-status{width:105px;}
  col.c-destino{width:90px;}
  col.c-obs{width:auto;}
  thead th{padding:7px 8px;background:#1e293b;color:#f1f5f9;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:2px solid #334155;overflow:hidden;white-space:nowrap;}
  td{border-bottom:1px solid #f1f5f9;vertical-align:top;overflow:hidden;}
  .legenda{padding:8px 18px;display:flex;gap:14px;align-items:center;border-top:1px solid #e2e8f0;flex-wrap:wrap;font-size:9px;color:#475569;margin-top:auto;}
  .leg-item{display:flex;align-items:center;gap:4px;}
  .leg-dot{width:11px;height:11px;border-radius:3px;border:1px solid;flex-shrink:0;}
  .footer{padding:7px 18px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;}
</style></head><body>
<div class="pagina">
  <div class="header">
    <div>
      <div class="header-title">TRANSNET — CARDS OPERACIONAIS CRIADOS</div>
      <div class="header-sub">Período: ${periodoStr}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#94a3b8;">
      <div style="font-size:11px;color:#7dd3fc;font-weight:700;">Relatório Gerencial</div>
      <div>Gerado: ${geradoEm}</div>
    </div>
  </div>
  <div class="kpi-bar">
    <div class="kpi-card" style="background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;"><div class="kpi-val">${nTotal}</div><div class="kpi-lbl">Total Cards</div></div>
    <div class="kpi-card" style="background:#f0fdf4;border-color:#22c55e;color:#15803d;"><div class="kpi-val">${nOp}</div><div class="kpi-lbl">Operando</div></div>
    <div class="kpi-card" style="background:#fffbeb;border-color:#f59e0b;color:#92400e;"><div class="kpi-val">${nOc}</div><div class="kpi-lbl">Ociosos</div></div>
    <div class="kpi-card" style="background:#fff1f2;border-color:#ef4444;color:#991b1b;"><div class="kpi-val">${nMt}</div><div class="kpi-lbl">Manutenção</div></div>
  </div>
  <div style="padding:0 18px 8px;">
    <table>
      <colgroup>
        <col class="c-criado"><col class="c-veiculo"><col class="c-carreta"><col class="c-tipo">
        <col class="c-motorista"><col class="c-operacao"><col class="c-status"><col class="c-destino"><col class="c-obs">
      </colgroup>
      <thead><tr>
        <th>Criado em</th><th>Veículo</th><th>Carreta</th><th>Tipo</th>
        <th>Motorista</th><th>Operação</th><th>Status</th><th>Destino</th><th>Observação</th>
      </tr></thead>
      <tbody>${linhas || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8;">Nenhum card criado no período</td></tr>'}</tbody>
    </table>
  </div>
  <div class="legenda">
    <strong>LEGENDA:</strong>
    <span class="leg-item"><span class="leg-dot" style="background:#dcfce7;border-color:#86efac;"></span>Disponível</span>
    <span class="leg-item"><span class="leg-dot" style="background:#fef9c3;border-color:#fde047;"></span>Em Operação / Carregado</span>
    <span class="leg-item"><span class="leg-dot" style="background:#dbeafe;border-color:#93c5fd;"></span>Puxada</span>
    <span class="leg-item"><span class="leg-dot" style="background:#fee2e2;border-color:#fca5a5;"></span>Manutenção</span>
  </div>
  <div class="footer">
    <span>Transnet Logística — Sistema Operacional</span>
    <span>Período: ${periodoStr}</span>
  </div>
</div>
</body></html>`;

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;';
            document.body.appendChild(iframe);
            iframe.contentDocument.open();
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1500);
            }, 800);
            setModalPdfProv(false);
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            alert('Erro ao gerar PDF. Tente novamente.');
        } finally {
            setGerandoPdfProv(false);
        }
    }

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

            {/* Abas */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '1px solid #1e293b' }}>
                {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'programacao', label: 'Visão de Provisionamento' }].map(t => (
                    <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{
                        padding: '8px 20px', background: 'none', border: 'none',
                        borderBottom: abaAtiva === t.id ? '2px solid #60a5fa' : '2px solid transparent',
                        color: abaAtiva === t.id ? '#f1f5f9' : '#64748b',
                        fontWeight: abaAtiva === t.id ? '700' : '400',
                        cursor: 'pointer', fontSize: '13px', marginBottom: '-1px',
                        transition: 'color 0.15s',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* Aba: Dashboard */}
            {abaAtiva === 'dashboard' && (<>
                {/* Card Geral */}
                <div style={{ marginBottom: '20px' }}>
                    <CardGeral
                        veiculos={veiculosNorm}
                        contsPorTipo={Object.fromEntries(TIPOS.map(t => [t, veiculosPorTipo[t]?.length ?? 0]))}
                    />
                </div>

                {/* Cards por tipo (exceto CARRETA) */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {TIPOS.filter(t => t !== 'CARRETA').map((tipo) => (
                        <CardTipo
                            key={tipo}
                            tipo={tipo}
                            veiculosTipo={veiculosPorTipo[tipo] || []}
                        />
                    ))}
                </div>

                <TaxaUsabilidade socket={socket} />

                <MotivosBaixaUsabilidade socket={socket} veiculos={veiculosNorm} />

                {/* CARRETA — fora do cálculo de usabilidade */}
                <div style={{ marginTop: '20px' }}>
                    <CardCarretaFooter veiculosTipo={veiculosPorTipo['CARRETA'] || []} />
                </div>
            </>)}

            {/* Aba: Visão de Provisionamento */}
            {abaAtiva === 'programacao' && (() => {
                const veiculosAtivos = progDia.filter(v => v.status !== 'DISPONIVEL' || v.motorista);

                const gerarDestinos = (v) => {
                    if (v.destinos_json) {
                        try {
                            const ds = JSON.parse(v.destinos_json);
                            return ds.map(d => {
                                const ag = d.data && d.data !== dataProgDia
                                    ? ` (AG:${d.data.split('-').reverse().slice(0,2).join('/')})` : '';
                                return `${d.cidade}${ag}`;
                            }).join(' → ');
                        } catch {}
                    }
                    return v.destino || '';
                };

                const dataSaidaVeiculo = (v) => {
                    if (!v.destinos_json) return null;
                    try {
                        const ds = JSON.parse(v.destinos_json);
                        const datas = ds.map(d => d.data).filter(Boolean).sort();
                        if (datas.length > 0) return datas[0];
                    } catch {}
                    return null;
                };

                const corStatus = (s) => STATUS_COR_PROG[s] || '#475569';
                const rgbStatus = (s) => hexToRgb(corStatus(s));
                const labelStatus = (s) => STATUS_LABEL_PROG[s] || s;

                const corTipo = (tipo) => {
                    if (!tipo) return '#475569';
                    if (tipo === 'CONJUNTO') return '#fb923c';
                    if (tipo === 'TRUCK') return '#60a5fa';
                    if (tipo === 'CARRETA') return '#34d399';
                    if (tipo === '3/4') return '#a78bfa';
                    return '#475569';
                };

                return (
                    <div>
                        {/* Visão Semanal integrada */}
                        <VistaSemanal socket={socket} onDiaClick={(d) => setDataProgDia(d)} diaSelecionado={dataProgDia} />

                        {/* Cabeçalho do dia selecionado */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Dia selecionado</div>
                                <div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>{formatarDataExibicao(dataProgDia)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                                <input type="date" value={dataProgDia}
                                    onChange={e => setDataProgDia(e.target.value)}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
                                />
                                {dataProgDia !== hoje && (
                                    <button onClick={() => setDataProgDia(hoje)}
                                        style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', fontWeight: '600' }}>
                                        Hoje
                                    </button>
                                )}
                                <button onClick={() => carregarProgDia(dataProgDia)} disabled={carregandoProg}
                                    style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: '#a5b4fc', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', fontWeight: '600', opacity: carregandoProg ? 0.6 : 1 }}>
                                    ↻
                                </button>
                                <button onClick={() => setModalPdfProv(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', fontWeight: '600' }}>
                                    <FileText size={13} /> Relatório PDF
                                </button>
                            </div>
                        </div>

                        {/* Ticker OBS */}
                        {obsSalvo && (
                            <div style={{
                                marginBottom: '16px',
                                background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                                border: '1px solid rgba(245,158,11,0.25)',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                height: '36px',
                            }}>
                                <div style={{
                                    minWidth: '90px',
                                    background: 'rgba(245,158,11,0.12)',
                                    borderRight: '1px solid rgba(245,158,11,0.25)',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 14px',
                                    flexShrink: 0,
                                }}>
                                    <span style={{ fontSize: '16px' }}>📢</span>
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ display: 'flex', animation: 'ticker-scroll 20s linear infinite', whiteSpace: 'nowrap' }}>
                                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '500', paddingLeft: '24px', paddingRight: '80px' }}>{obsSalvo}</span>
                                        <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '500', paddingRight: '80px' }}>{obsSalvo}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cards de veículos */}
                        {carregandoProg ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#475569' }}>Carregando...</div>
                        ) : veiculosAtivos.length === 0 ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#334155', background: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b' }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚛</div>
                                <div style={{ color: '#475569', fontSize: '14px' }}>Nenhum veículo em operação neste dia.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {veiculosAtivos.map(v => {
                                    const cor = corStatus(v.status);
                                    const rgb = rgbStatus(v.status);
                                    const destinos = gerarDestinos(v);
                                    const dSaida = dataSaidaVeiculo(v);
                                    const placas = [v.placa && v.placa !== '-' ? v.placa : null, v.carreta || null].filter(Boolean).join(' / ');
                                    const cTipo = corTipo(v.tipo_veiculo);
                                    const obsVal = obsCards[v.id] ?? v.observacao ?? '';
                                    const obsOriginal = v.observacao || '';
                                    const obsModificado = obsVal !== obsOriginal;
                                    const salvando = obsSalvandoCard[v.id];
                                    return (
                                        <div key={v.id} style={{
                                            background: `linear-gradient(135deg, #0f172a 0%, rgba(${rgb},0.04) 100%)`,
                                            border: `1px solid rgba(${rgb},0.2)`,
                                            borderLeft: `3px solid ${cor}`,
                                            borderRadius: '12px',
                                            padding: '14px 18px',
                                            transition: 'border-color 0.2s',
                                            boxShadow: `0 2px 12px rgba(${rgb},0.06)`,
                                        }}>
                                            {/* Linha principal */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                {/* Tipo */}
                                                <div style={{
                                                    minWidth: '64px', textAlign: 'center',
                                                    padding: '4px 8px', borderRadius: '6px',
                                                    background: `rgba(${hexToRgb(cTipo)},0.12)`,
                                                    border: `1px solid rgba(${hexToRgb(cTipo)},0.25)`,
                                                    color: cTipo, fontSize: '10px', fontWeight: '800',
                                                    letterSpacing: '0.5px',
                                                }}>
                                                    {v.tipo_veiculo || '—'}
                                                </div>

                                                {/* Motorista */}
                                                <div style={{ minWidth: '150px' }}>
                                                    <div style={{ color: v.motorista ? '#f1f5f9' : '#334155', fontWeight: '700', fontSize: '13px', lineHeight: 1.2 }}>
                                                        {v.motorista || '— —'}
                                                    </div>
                                                </div>

                                                {/* Placas */}
                                                <div style={{ minWidth: '130px' }}>
                                                    {placas ? (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb923c', fontWeight: '800', letterSpacing: '1px', background: 'rgba(251,146,60,0.08)', padding: '3px 8px', borderRadius: '5px', border: '1px solid rgba(251,146,60,0.2)' }}>
                                                            {placas}
                                                        </span>
                                                    ) : <span style={{ color: '#334155' }}>—</span>}
                                                </div>

                                                {/* Destinos */}
                                                <div style={{ flex: 1, color: '#94a3b8', fontSize: '12px', minWidth: 0 }}>
                                                    {destinos ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ color: '#475569', fontSize: '10px' }}>📍</span>
                                                            {destinos}
                                                        </span>
                                                    ) : <span style={{ color: '#334155' }}>—</span>}
                                                </div>

                                                {/* Data Saída */}
                                                {dSaida && (
                                                    <div style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
                                                        background: 'rgba(52,211,153,0.1)', color: '#34d399',
                                                        border: '1px solid rgba(52,211,153,0.25)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        Saída: {dSaida.split('-').reverse().slice(0,2).join('/')}
                                                    </div>
                                                )}

                                                {/* Status badge */}
                                                <div style={{
                                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                    background: `rgba(${rgb},0.12)`,
                                                    color: cor,
                                                    border: `1px solid rgba(${rgb},0.3)`,
                                                    whiteSpace: 'nowrap',
                                                    letterSpacing: '0.3px',
                                                }}>
                                                    {labelStatus(v.status)}
                                                </div>
                                            </div>

                                            {/* Linha de observação */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                                <span style={{ color: '#475569', fontSize: '10px', fontWeight: '600', flexShrink: 0 }}>OBS:</span>
                                                <input
                                                    type="text"
                                                    value={obsVal}
                                                    onChange={e => setObsCards(prev => ({ ...prev, [v.id]: e.target.value }))}
                                                    placeholder="Observação..."
                                                    style={{
                                                        flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
                                                        color: '#e2e8f0', borderRadius: '6px', padding: '5px 10px', fontSize: '12px',
                                                        outline: 'none', fontFamily: 'inherit',
                                                    }}
                                                />
                                                {obsModificado && (
                                                    <button onClick={() => salvarObsCard(v.id)} disabled={salvando}
                                                        style={{
                                                            padding: '4px 12px', fontSize: '11px', fontWeight: '700',
                                                            background: salvando ? '#1e293b' : 'rgba(59,130,246,0.15)',
                                                            color: salvando ? '#475569' : '#60a5fa',
                                                            border: '1px solid rgba(59,130,246,0.3)',
                                                            borderRadius: '6px', cursor: salvando ? 'not-allowed' : 'pointer',
                                                        }}>
                                                        {salvando ? '...' : 'Salvar'}
                                                    </button>
                                                )}
                                                {!obsModificado && obsOriginal && (
                                                    <span style={{
                                                        padding: '3px 10px', fontSize: '10px', fontWeight: '600',
                                                        background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
                                                        border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px',
                                                    }}>salvo</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                    </div>
                );
            })()}

            {/* Modal PDF Provisionamento */}
            {modalPdfProv && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setModalPdfProv(false)}>
                    <div style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
                        padding: '28px', width: '380px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={18} color="#34d399" />
                                <span style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: '700' }}>Relatório de Provisionamento</span>
                            </div>
                            <button onClick={() => setModalPdfProv(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 20px' }}>
                            Gera um relatório PDF com uma página por dia, mostrando todos os veículos em operação, destinos e motoristas.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>De</label>
                                <input type="date" value={pdfDe} onChange={e => setPdfDe(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Até</label>
                                <input type="date" value={pdfAte} onChange={e => setPdfAte(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalPdfProv(false)}
                                style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}>
                                Cancelar
                            </button>
                            <button onClick={gerarPdfProvDiario} disabled={gerandoPdfProv}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: gerandoPdfProv ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: '#34d399', cursor: gerandoPdfProv ? 'not-allowed' : 'pointer', padding: '8px 18px', fontSize: '13px', fontWeight: '700', opacity: gerandoPdfProv ? 0.7 : 1 }}>
                                <FileText size={14} /> {gerandoPdfProv ? 'Gerando...' : 'Gerar PDF'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* CSS animation */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes ticker-scroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
