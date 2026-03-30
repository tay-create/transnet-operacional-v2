import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, Truck, TrendingUp, ChevronLeft, ChevronRight, Award, RefreshCw, Wifi } from 'lucide-react';
import api from '../services/apiService';

// ── Centroides dos estados — viewport SVG 800x900 ──
const CENTROIDES = {
    AC: [82, 587], AM: [208, 390], RR: [248, 178], AP: [487, 138],
    PA: [430, 295], MA: [553, 261], PI: [601, 303], CE: [657, 248],
    RN: [706, 245], PB: [709, 280], PE: [659, 305], AL: [697, 340],
    SE: [678, 362], BA: [600, 420], TO: [487, 366], GO: [475, 477],
    DF: [493, 480], MT: [342, 435], RO: [222, 507], MG: [573, 506],
    ES: [641, 505], RJ: [612, 541], SP: [515, 566], PR: [455, 620],
    SC: [464, 660], RS: [432, 712], MS: [404, 560],
};

// Paths SVG do Brasil com coordenadas geográficas reais escaladas para viewport 800x900
// Projeção: lon [-73.99, -28.85] → x [0, 800]; lat [-33.75, 5.27] → y [900, 0]
const BRASIL_PATHS = {
    AC: 'M 30,530 L 58,518 L 75,520 L 100,512 L 118,525 L 128,540 L 148,550 L 155,568 L 140,580 L 130,595 L 115,605 L 98,620 L 80,625 L 60,620 L 45,605 L 38,590 L 30,575 Z',
    AM: 'M 58,518 L 75,490 L 80,470 L 68,450 L 72,425 L 88,405 L 105,385 L 118,370 L 138,355 L 158,348 L 180,345 L 210,340 L 238,338 L 260,332 L 275,320 L 295,312 L 318,310 L 338,318 L 348,330 L 355,345 L 358,358 L 360,375 L 355,395 L 348,415 L 342,438 L 335,455 L 322,465 L 305,472 L 288,478 L 268,480 L 248,485 L 225,490 L 205,495 L 185,500 L 168,510 L 155,520 L 148,550 L 128,540 L 118,525 L 100,512 L 75,520 Z',
    RR: 'M 210,120 L 228,110 L 252,102 L 272,105 L 288,118 L 302,132 L 308,150 L 305,168 L 298,185 L 285,200 L 270,210 L 252,215 L 238,218 L 222,212 L 210,200 L 200,185 L 195,168 L 195,150 L 200,135 Z',
    AP: 'M 448,112 L 465,100 L 482,95 L 500,98 L 515,108 L 525,125 L 520,145 L 508,158 L 490,165 L 472,162 L 458,152 L 448,138 Z',
    PA: 'M 238,318 L 260,312 L 282,308 L 305,305 L 330,300 L 355,295 L 378,285 L 400,278 L 422,272 L 445,268 L 468,265 L 490,262 L 512,260 L 530,260 L 545,262 L 558,268 L 565,280 L 562,295 L 555,312 L 542,325 L 525,338 L 508,348 L 490,358 L 470,365 L 450,370 L 428,375 L 408,378 L 388,380 L 368,382 L 348,382 L 330,385 L 315,390 L 302,398 L 292,410 L 285,425 L 278,440 L 270,455 L 260,468 L 248,480 L 235,488 L 222,492 L 208,495 L 192,498 L 175,502 L 160,510 L 148,520 L 140,532 L 135,548 L 138,562 L 148,548 L 155,535 L 162,520 L 172,508 L 185,498 L 200,490 L 215,485 L 232,480 L 248,478 L 260,470 L 268,458 L 274,445 L 278,430 L 282,415 L 290,402 L 302,392 L 318,385 L 335,380 L 352,378 L 370,375 L 390,372 L 408,368 L 428,362 L 448,355 L 468,345 L 485,335 L 500,322 L 512,308 L 520,295 L 520,280 L 512,268 L 500,262 L 485,260 L 468,260 L 450,262 L 430,268 L 408,275 L 385,282 L 360,290 L 335,298 L 310,305 L 285,310 L 260,315 L 238,318 Z',
    MA: 'M 525,268 L 545,265 L 562,268 L 570,282 L 572,298 L 568,315 L 558,330 L 545,342 L 530,350 L 515,355 L 498,358 L 482,355 L 468,345 L 458,330 L 452,315 L 448,298 L 450,282 L 460,270 L 475,262 L 500,260 Z',
    PI:  'M 558,330 L 568,315 L 572,298 L 578,285 L 592,278 L 608,272 L 622,270 L 632,278 L 638,292 L 640,308 L 635,325 L 625,340 L 612,350 L 598,358 L 582,362 L 565,360 L 552,352 L 545,342 Z',
    CE:  'M 622,270 L 638,262 L 655,255 L 672,252 L 688,256 L 700,265 L 706,278 L 704,292 L 695,305 L 680,315 L 664,320 L 648,318 L 635,308 L 630,295 L 632,278 Z',
    RN:  'M 700,265 L 715,258 L 728,252 L 740,250 L 752,255 L 758,268 L 755,282 L 745,292 L 730,298 L 715,298 L 704,292 L 706,278 Z',
    PB:  'M 704,292 L 715,298 L 730,298 L 742,298 L 752,305 L 755,318 L 748,330 L 735,338 L 720,338 L 708,332 L 700,320 L 698,308 Z',
    PE:  'M 648,318 L 664,320 L 680,315 L 695,305 L 706,315 L 700,320 L 708,332 L 720,338 L 735,338 L 745,345 L 748,358 L 740,368 L 725,372 L 708,370 L 692,362 L 675,355 L 658,348 L 642,342 L 630,335 L 625,320 L 632,310 L 638,320 L 648,318 Z',
    AL:  'M 725,372 L 740,368 L 752,372 L 758,385 L 752,398 L 738,405 L 722,402 L 710,395 L 708,382 L 714,372 Z',
    SE:  'M 708,370 L 722,368 L 735,372 L 742,385 L 738,398 L 724,408 L 710,408 L 700,400 L 698,388 L 702,375 Z',
    BA:  'M 512,398 L 522,408 L 532,415 L 545,418 L 558,415 L 572,412 L 585,408 L 598,405 L 612,405 L 625,408 L 638,412 L 648,418 L 658,425 L 668,432 L 675,442 L 678,455 L 675,468 L 668,478 L 658,488 L 645,495 L 632,500 L 618,502 L 602,502 L 588,498 L 575,492 L 562,485 L 550,478 L 538,472 L 525,468 L 512,465 L 498,462 L 485,462 L 472,462 L 460,465 L 448,470 L 438,478 L 428,488 L 420,498 L 415,510 L 412,522 L 415,535 L 420,548 L 428,558 L 438,565 L 450,568 L 462,568 L 475,565 L 485,558 L 495,548 L 502,538 L 508,525 L 512,512 L 514,498 Z',
    TO:  'M 398,375 L 418,372 L 440,370 L 462,365 L 480,362 L 495,358 L 500,370 L 505,385 L 510,398 L 514,412 L 515,428 L 512,442 L 508,455 L 502,468 L 495,478 L 485,485 L 472,490 L 458,492 L 445,492 L 432,488 L 420,482 L 410,472 L 402,460 L 396,448 L 392,435 L 390,420 L 392,408 Z',
    GO:  'M 432,488 L 445,492 L 458,492 L 472,490 L 485,485 L 495,492 L 505,498 L 515,505 L 525,512 L 532,522 L 535,535 L 532,548 L 525,558 L 515,565 L 502,568 L 488,568 L 475,565 L 462,560 L 450,552 L 440,542 L 432,530 L 425,518 L 420,505 L 418,492 L 422,480 L 428,470 Z',
    DF:  'M 485,468 L 498,468 L 505,478 L 502,490 L 490,494 L 478,490 L 475,478 Z',
    MT:  'M 248,485 L 268,480 L 288,478 L 308,475 L 328,472 L 348,468 L 365,462 L 378,455 L 388,445 L 395,432 L 396,418 L 392,405 L 388,390 L 384,375 L 380,360 L 378,345 L 378,330 L 380,315 L 382,300 L 385,288 L 390,275 L 396,262 L 402,250 L 408,238 L 412,225 L 410,212 L 405,200 L 398,190 L 388,182 L 375,178 L 360,178 L 345,180 L 330,185 L 315,192 L 300,200 L 288,210 L 278,222 L 270,235 L 264,250 L 260,265 L 258,280 L 258,295 L 260,310 L 262,325 L 264,340 L 266,355 L 265,370 L 262,385 L 258,400 L 252,415 L 248,430 L 245,448 L 245,465 Z',
    RO:  'M 155,520 L 168,510 L 185,500 L 205,495 L 225,490 L 245,488 L 245,505 L 245,522 L 245,540 L 242,558 L 235,572 L 225,582 L 212,590 L 198,595 L 182,595 L 168,588 L 155,578 L 145,565 L 140,550 L 140,535 Z',
    MG:  'M 502,538 L 512,528 L 522,518 L 532,510 L 545,505 L 558,502 L 572,502 L 585,505 L 598,508 L 610,515 L 620,522 L 628,532 L 632,545 L 630,558 L 622,568 L 610,575 L 595,580 L 578,582 L 560,580 L 542,575 L 525,568 L 510,558 L 498,548 L 490,535 L 486,522 L 490,510 L 498,500 Z',
    ES:  'M 628,500 L 640,498 L 652,500 L 660,510 L 662,522 L 658,535 L 648,545 L 635,548 L 622,545 L 614,535 L 612,522 L 618,510 Z',
    RJ:  'M 595,558 L 608,555 L 620,558 L 632,562 L 640,572 L 638,585 L 628,592 L 615,595 L 600,592 L 588,582 L 585,570 L 590,560 Z',
    SP:  'M 458,558 L 472,555 L 488,552 L 502,552 L 515,555 L 525,562 L 532,572 L 535,585 L 530,598 L 518,608 L 505,615 L 490,618 L 475,616 L 460,610 L 448,600 L 440,588 L 438,575 L 442,562 Z',
    PR:  'M 418,608 L 432,605 L 448,602 L 462,600 L 475,600 L 488,602 L 498,608 L 505,618 L 508,630 L 504,642 L 495,652 L 480,658 L 465,660 L 448,658 L 432,652 L 418,642 L 408,630 L 406,618 Z',
    SC:  'M 418,658 L 435,655 L 450,655 L 465,658 L 478,665 L 488,675 L 490,688 L 482,700 L 468,708 L 452,710 L 436,708 L 422,700 L 412,688 L 410,675 L 415,665 Z',
    RS:  'M 395,700 L 412,692 L 428,688 L 445,688 L 460,692 L 472,700 L 480,712 L 482,726 L 478,740 L 468,752 L 452,760 L 435,762 L 418,758 L 402,748 L 388,735 L 378,720 L 372,706 L 378,695 L 388,690 Z',
    MS:  'M 338,535 L 355,530 L 372,528 L 388,530 L 402,535 L 415,542 L 422,555 L 425,568 L 420,582 L 410,592 L 395,598 L 378,600 L 360,598 L 342,592 L 328,582 L 318,568 L 314,552 L 318,538 Z',
};

function BrasilMapa({ porUF }) {
    const [hover, setHover] = useState(null);
    const maxVal = Math.max(1, ...porUF.map(r => r.total));
    const mapa = Object.fromEntries(porUF.map(r => [r.uf, r.total]));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
            <svg viewBox="0 0 800 900" style={{ width: '100%', height: 'auto' }}>
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
