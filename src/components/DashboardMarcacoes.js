import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, Truck, TrendingUp, ChevronLeft, ChevronRight, Award, RefreshCw, Wifi } from 'lucide-react';
import api from '../services/apiService';

// ── Centroides dos estados — viewport SVG 760x880 ──
const CENTROIDES = {
    AC: [68, 618], AM: [185, 375], RR: [232, 148], AP: [478, 112],
    PA: [398, 288], MA: [535, 262], PI: [588, 302], CE: [648, 232],
    RN: [695, 218], PB: [698, 258], PE: [648, 292], AL: [698, 328],
    SE: [680, 352], BA: [588, 432], TO: [468, 368], GO: [462, 482],
    DF: [480, 490], MT: [318, 428], RO: [195, 508], MG: [565, 512],
    ES: [635, 512], RJ: [602, 548], SP: [505, 568], PR: [440, 622],
    SC: [448, 663], RS: [415, 718], MS: [382, 565],
};

// Paths SVG do Brasil — geometria baseada na referência geográfica real
// viewBox 0 0 760 880 — lon[-74,-28.5]→x, lat[5.5,-34]→y
const BRASIL_PATHS = {
    RR: 'M 198,60 L 222,46 L 248,40 L 270,46 L 286,60 L 296,80 L 298,102 L 290,124 L 275,140 L 255,150 L 234,154 L 215,148 L 200,132 L 190,112 L 190,90 L 196,72 Z',
    AP: 'M 448,65 L 468,52 L 488,48 L 508,54 L 522,70 L 526,90 L 518,112 L 502,126 L 482,130 L 462,122 L 448,105 L 446,85 Z',
    AM: 'M 38,295 L 60,278 L 85,260 L 110,248 L 138,238 L 165,230 L 192,225 L 218,222 L 242,222 L 262,218 L 280,210 L 298,202 L 318,200 L 338,202 L 352,212 L 360,228 L 360,248 L 352,268 L 340,288 L 325,308 L 308,325 L 290,340 L 270,355 L 250,368 L 230,380 L 210,392 L 190,402 L 170,412 L 148,420 L 126,428 L 104,434 L 82,438 L 60,440 L 42,438 L 28,428 L 20,414 L 18,396 L 22,375 L 32,352 L 40,328 L 40,310 Z',
    PA: 'M 260,218 L 285,210 L 312,202 L 340,196 L 368,188 L 396,180 L 422,172 L 448,165 L 472,160 L 495,156 L 518,154 L 540,154 L 560,156 L 574,166 L 578,182 L 570,200 L 556,216 L 540,230 L 520,244 L 500,256 L 478,268 L 455,278 L 430,288 L 405,296 L 378,304 L 350,310 L 322,314 L 295,318 L 270,322 L 248,326 L 228,332 L 210,340 L 195,352 L 182,366 L 170,382 L 160,398 L 148,414 L 135,428 L 118,438 L 100,442 L 80,442 L 60,440 L 42,438 L 60,440 L 82,438 L 104,434 L 126,428 L 148,420 L 168,412 L 188,402 L 208,392 L 228,380 L 248,368 L 268,354 L 288,340 L 305,324 L 320,306 L 332,288 L 342,268 L 350,248 L 352,228 L 345,212 L 335,202 L 318,200 L 298,202 L 278,210 L 260,218 Z',
    RO: 'M 120,442 L 148,428 L 178,418 L 208,412 L 232,410 L 248,416 L 250,438 L 250,462 L 248,486 L 240,510 L 228,530 L 212,545 L 192,554 L 170,556 L 150,550 L 132,538 L 120,522 L 112,502 L 112,480 L 115,458 Z',
    AC: 'M 18,515 L 42,502 L 68,492 L 94,486 L 115,486 L 118,510 L 116,536 L 110,560 L 98,580 L 82,596 L 62,608 L 42,614 L 24,610 L 10,596 L 5,578 L 8,556 L 14,534 Z',
    MT: 'M 232,410 L 258,404 L 285,398 L 314,394 L 342,390 L 368,388 L 392,386 L 412,384 L 428,382 L 440,390 L 442,408 L 436,428 L 426,448 L 412,465 L 396,480 L 378,492 L 358,502 L 336,510 L 314,514 L 292,515 L 270,512 L 250,508 L 248,488 L 248,465 L 248,440 L 245,420 Z',
    TO: 'M 440,390 L 460,382 L 480,375 L 500,368 L 518,364 L 528,372 L 530,390 L 528,410 L 520,430 L 510,450 L 496,468 L 480,482 L 462,492 L 444,498 L 426,496 L 410,488 L 396,478 L 412,465 L 426,448 L 436,428 L 440,408 Z',
    MA: 'M 518,154 L 542,150 L 562,150 L 578,156 L 584,170 L 582,188 L 574,206 L 560,222 L 542,238 L 522,250 L 500,260 L 478,268 L 456,272 L 434,268 L 415,260 L 400,248 L 390,232 L 385,214 L 385,196 L 392,180 L 404,168 L 422,160 L 446,156 L 472,155 L 496,154 Z',
    PI: 'M 554,238 L 572,230 L 592,224 L 610,222 L 625,224 L 634,234 L 638,248 L 635,264 L 626,280 L 610,294 L 590,305 L 568,310 L 546,308 L 528,300 L 515,286 L 508,270 L 510,254 L 518,242 L 532,238 L 548,236 Z',
    CE: 'M 625,224 L 640,214 L 658,208 L 676,208 L 692,216 L 700,230 L 698,248 L 686,262 L 668,272 L 648,275 L 630,268 L 620,254 L 620,238 Z',
    RN: 'M 700,230 L 716,218 L 732,212 L 748,216 L 758,228 L 758,244 L 748,256 L 732,262 L 716,260 L 704,250 L 700,238 Z',
    PB: 'M 700,252 L 718,248 L 736,248 L 750,256 L 755,268 L 750,282 L 736,292 L 718,296 L 702,292 L 692,280 L 692,266 Z',
    PE: 'M 598,280 L 622,272 L 648,268 L 672,266 L 694,268 L 706,278 L 707,292 L 698,305 L 680,314 L 658,318 L 635,316 L 612,308 L 594,296 L 588,283 Z',
    AL: 'M 710,292 L 728,286 L 744,290 L 754,302 L 752,316 L 740,326 L 724,330 L 708,326 L 698,314 L 700,300 Z',
    SE: 'M 692,318 L 708,314 L 724,318 L 734,330 L 730,344 L 718,354 L 702,356 L 688,348 L 683,334 L 686,320 Z',
    BA: 'M 500,260 L 522,254 L 548,250 L 572,248 L 595,250 L 616,256 L 635,264 L 650,276 L 660,290 L 664,308 L 660,326 L 650,344 L 636,360 L 618,374 L 598,386 L 576,396 L 552,404 L 526,408 L 500,410 L 475,408 L 450,402 L 428,392 L 410,378 L 396,362 L 386,344 L 380,325 L 379,306 L 382,287 L 390,270 L 402,256 L 418,248 L 440,244 L 465,245 L 488,252 Z',
    GO: 'M 410,486 L 428,478 L 448,472 L 468,470 L 488,472 L 505,480 L 518,492 L 526,508 L 526,526 L 518,542 L 505,555 L 486,562 L 465,565 L 444,562 L 424,553 L 408,540 L 400,524 L 400,506 Z',
    DF: 'M 465,492 L 480,488 L 492,496 L 492,510 L 480,516 L 464,512 L 460,500 Z',
    MG: 'M 418,498 L 440,490 L 464,486 L 488,484 L 512,486 L 536,490 L 558,496 L 578,505 L 596,516 L 608,530 L 612,546 L 606,562 L 594,574 L 576,582 L 554,585 L 530,582 L 505,576 L 480,566 L 456,553 L 434,538 L 416,522 L 406,506 Z',
    ES: 'M 614,516 L 632,512 L 646,518 L 654,532 L 652,548 L 640,558 L 624,562 L 610,556 L 603,542 L 606,526 Z',
    RJ: 'M 575,560 L 593,555 L 612,558 L 626,568 L 628,582 L 618,595 L 600,601 L 582,598 L 568,586 L 567,572 Z',
    SP: 'M 428,540 L 450,534 L 475,528 L 502,524 L 526,525 L 548,530 L 564,540 L 568,555 L 558,568 L 540,578 L 516,584 L 490,586 L 465,582 L 440,572 L 420,558 L 414,544 Z',
    MS: 'M 298,514 L 325,514 L 352,514 L 378,516 L 400,520 L 415,532 L 418,550 L 415,570 L 406,590 L 392,608 L 372,622 L 348,628 L 323,626 L 298,616 L 276,600 L 260,580 L 252,558 L 254,536 L 268,518 L 285,512 Z',
    PR: 'M 396,590 L 418,584 L 442,580 L 467,578 L 490,580 L 510,586 L 524,596 L 526,612 L 516,626 L 498,636 L 475,642 L 450,642 L 425,636 L 402,624 L 386,610 L 384,596 Z',
    SC: 'M 392,640 L 415,634 L 440,630 L 464,632 L 485,640 L 500,654 L 502,670 L 490,682 L 470,690 L 447,692 L 422,688 L 398,676 L 382,660 L 382,646 Z',
    RS: 'M 366,686 L 390,676 L 415,670 L 440,668 L 462,672 L 480,684 L 490,700 L 488,718 L 478,734 L 460,748 L 438,756 L 412,758 L 386,750 L 362,735 L 344,716 L 338,694 L 348,678 L 360,672 Z',
};

function BrasilMapa({ porUF }) {
    const [hover, setHover] = useState(null);
    const maxVal = Math.max(1, ...porUF.map(r => r.total));
    const mapa = Object.fromEntries(porUF.map(r => [r.uf, r.total]));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
            <svg viewBox="0 0 760 880" style={{ width: '100%', height: 'auto' }}>
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
