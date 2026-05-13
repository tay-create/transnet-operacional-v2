import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApiCall } from '../hooks/useApiCall';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { RefreshCw, Printer, TrendingUp, Settings, X, Plus, Check } from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';
import 'leaflet/dist/leaflet.css';

const COR_VEICULO = { carreta: '#3b82f6', truck: '#f59e0b', tresQuartos: '#8b5cf6' };
const COR_MIX = { plastico: '#3b82f6', porcelana: '#ec4899', consolidado: '#06b6d4', eletrik: '#10b981' };
const COR_REGIAO = { NORDESTE: '#1e40af', SUL: '#0369a1', SUDESTE: '#0891b2', 'C.OESTE': '#0e7490', NORTE: '#155e75' };

// codarea IBGE → nome da região no sistema
const IBGE_REGIAO = { '1': 'NORTE', '2': 'NORDESTE', '3': 'SUDESTE', '4': 'SUL', '5': 'C.OESTE' };

// Gradiente azul: 0% = mais claro, 100% = mais escuro
function corChoropleth(pctVal) {
    const v = Math.min(Math.max(parseFloat(pctVal) || 0, 0), 100);
    const lightness = Math.round(70 - v * 0.45); // 70% → 25%
    return `hsl(220, 75%, ${lightness}%)`;
}

function MapaBrasil({ regioes, totalEntregas, regiaoSelecionada, onSelectRegiao, geojsonRef }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const layersRef = useRef({}); // { NORDESTE: layer, ... }
    const selecionadaRef = useRef(regiaoSelecionada);

    // mantém ref atualizada pra o handler de clique sempre ler valor atual
    useEffect(() => { selecionadaRef.current = regiaoSelecionada; }, [regiaoSelecionada]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const L = require('leaflet');

        const map = L.map(containerRef.current, {
            center: [-14.2, -51.9],
            zoom: 4,
            minZoom: 3,
            maxZoom: 8,
            zoomControl: true,
            scrollWheelZoom: true,
            dragging: true,
            attributionControl: false,
        });
        mapRef.current = map;

        containerRef.current.style.background = '#0f172a';

        const porNome = {};
        regioes.forEach(r => { porNome[r.regiao] = r; });

        fetch('/api/geojson-brasil')
            .then(r => r.json())
            .then(geojson => {
                if (geojsonRef) geojsonRef.current = geojson;
                L.geoJSON(geojson, {
                    style: (feature) => {
                        const nomeRegiao = IBGE_REGIAO[feature.properties.codarea] || '';
                        const dado = porNome[nomeRegiao];
                        const pctVal = dado ? parseFloat(pct(dado.entregas, totalEntregas)) : 0;
                        return {
                            fillColor: corChoropleth(pctVal),
                            fillOpacity: 0.85,
                            color: '#1e293b',
                            weight: 1.5,
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const nomeRegiao = IBGE_REGIAO[feature.properties.codarea] || '—';
                        layersRef.current[nomeRegiao] = layer;
                        const dado = porNome[nomeRegiao];
                        const pctVal = dado ? pct(dado.entregas, totalEntregas) : '0.0';
                        const entregas = dado?.entregas ?? 0;
                        layer.bindTooltip(
                            `<div style="font-family:sans-serif;font-size:13px;font-weight:700;color:#f1f5f9;background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;pointer-events:none">
                                <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">${nomeRegiao}</div>
                                <div style="font-size:22px;color:#60a5fa">${pctVal}%</div>
                                <div style="color:#64748b;font-size:11px;margin-top:2px">${entregas} entregas · clique p/ filtrar</div>
                            </div>`,
                            { sticky: true, opacity: 1, className: 'leaflet-tooltip-custom' }
                        );
                        layer.on('mouseover', () => {
                            if (selecionadaRef.current !== nomeRegiao) layer.setStyle({ fillOpacity: 1, weight: 2.5 });
                        });
                        layer.on('mouseout', () => {
                            if (selecionadaRef.current !== nomeRegiao) layer.setStyle({ fillOpacity: 0.85, weight: 1.5 });
                        });
                        layer.on('click', () => {
                            // toggle: clicou na mesma região, limpa filtro
                            const novo = selecionadaRef.current === nomeRegiao ? null : nomeRegiao;
                            onSelectRegiao(novo);
                        });
                    }
                }).addTo(map);

                map.fitBounds([[-33.7, -73.9], [5.3, -28.8]]);
            })
            .catch(console.error);

        return () => {
            map.remove();
            mapRef.current = null;
            layersRef.current = {};
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-aplica estilos quando regiões/dados mudam
    useEffect(() => {
        const porNome = {};
        regioes.forEach(r => { porNome[r.regiao] = r; });
        Object.entries(layersRef.current).forEach(([nome, layer]) => {
            const dado = porNome[nome];
            const pctVal = dado ? parseFloat(pct(dado.entregas, totalEntregas)) : 0;
            if (layer.setStyle) layer.setStyle({ fillColor: corChoropleth(pctVal) });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regioes, totalEntregas]);

    // Realça a região selecionada (borda branca grossa) e dimishe as outras
    useEffect(() => {
        Object.entries(layersRef.current).forEach(([nome, layer]) => {
            if (!layer.setStyle) return;
            if (regiaoSelecionada && nome === regiaoSelecionada) {
                layer.setStyle({ color: '#f8fafc', weight: 3, fillOpacity: 1 });
                if (layer.bringToFront) layer.bringToFront();
            } else if (regiaoSelecionada) {
                layer.setStyle({ color: '#1e293b', weight: 1, fillOpacity: 0.35 });
            } else {
                layer.setStyle({ color: '#1e293b', weight: 1.5, fillOpacity: 0.85 });
            }
        });
    }, [regiaoSelecionada]);

    return (
        <div style={{ position: 'relative' }}>
            <style>{`
                .leaflet-tooltip-custom { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
                .leaflet-tooltip-custom::before { display: none !important; border: none !important; }
            `}</style>
            <div ref={containerRef} style={{ height: '340px', borderRadius: '10px', overflow: 'hidden', background: '#0f172a', cursor: 'pointer' }} />
            {/* Legenda gradiente */}
            <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', zIndex: 1000 }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>% Entregas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>0%</span>
                    <div style={{ width: '80px', height: '10px', borderRadius: '4px', background: 'linear-gradient(to right, hsl(220,75%,70%), hsl(220,75%,25%))' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>100%</span>
                </div>
            </div>
            {regiaoSelecionada && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '8px', padding: '6px 10px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtro:</span>
                    <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '700' }}>{regiaoSelecionada}</span>
                    <button onClick={() => onSelectRegiao(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: '0 4px', lineHeight: 1 }} title="Limpar filtro">×</button>
                </div>
            )}
        </div>
    );
}

const s = {
    card: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 24px' },
    titulo: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', marginBottom: '16px' },
};

const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

const TooltipCustom = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#f1f5f9' }}>
            <div style={{ color: '#94a3b8', fontWeight: '700' }}>{payload[0]?.name}</div>
            <div style={{ color: payload[0]?.fill }}>{payload[0]?.value} &nbsp;·&nbsp; {pct(payload[0]?.value, payload[0]?.payload?.total)}%</div>
        </div>
    );
};

// Tooltip filtrado para exibir apenas a barra hovereada (não o grupo inteiro)
function makeTooltipFiltrado(hoveredKeyRef) {
    return function TooltipFiltrado({ active, payload }) {
        if (!active || !payload?.length) return null;
        const key = hoveredKeyRef.current;
        const item = key ? payload.find(p => p.dataKey === key) : payload[0];
        if (!item) return null;
        return (
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#f1f5f9' }}>
                <div style={{ color: '#94a3b8', fontWeight: '700' }}>{item.name}</div>
                <div style={{ color: item.fill }}>{item.value} &nbsp;·&nbsp; {pct(item.value, item.payload?.total)}%</div>
            </div>
        );
    };
}

const PizzaLegenda = ({ dados, cores }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        {dados.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cores[d.name], flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{d.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginLeft: 'auto' }}>{d.value}</span>
                <span style={{ fontSize: '11px', color: '#64748b', width: '38px', textAlign: 'right' }}>{pct(d.value, d.total)}%</span>
            </div>
        ))}
    </div>
);

// Centroides aproximados das regiões (lat, lng) — usados para posicionar labels no SVG estático
const CENTROIDE_REGIAO = {
    NORTE: [-3.5, -62.5],
    NORDESTE: [-9.0, -41.0],
    'C.OESTE': [-15.5, -53.0],
    SUDESTE: [-19.5, -45.0],
    SUL: [-27.5, -52.0],
};

// Gera um SVG estático do Brasil a partir do GeoJSON, colorindo cada região pelo % e
// imprimindo nome + percentual sobre cada polígono. Não depende do Leaflet em runtime.
function gerarSvgMapaBrasil(geojson, regioes, totalEntregas) {
    if (!geojson || !geojson.features) return '';
    const W = 520, H = 520;
    // Bounds Brasil
    const minLng = -74, maxLng = -34, minLat = -34, maxLat = 6;
    const project = (lng, lat) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * W;
        const y = H - ((lat - minLat) / (maxLat - minLat)) * H;
        return [x, y];
    };
    const ringToPath = (ring) => {
        if (!ring || !ring.length) return '';
        return ring.map((c, i) => {
            const [x, y] = project(c[0], c[1]);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ') + 'Z';
    };
    const porNome = {};
    regioes.forEach(r => { porNome[r.regiao] = r; });

    const corChoropletePrint = (pctVal) => {
        const v = Math.min(Math.max(parseFloat(pctVal) || 0, 0), 100);
        const lightness = Math.round(70 - v * 0.45);
        return `hsl(220, 75%, ${lightness}%)`;
    };

    let paths = '';
    let labels = '';

    geojson.features.forEach(f => {
        const cod = f.properties?.codarea;
        const nome = IBGE_REGIAO[cod] || '';
        const dado = porNome[nome];
        const pctVal = dado ? pct(dado.entregas, totalEntregas) : '0.0';
        const cor = corChoropletePrint(parseFloat(pctVal));
        const geom = f.geometry;
        if (!geom) return;
        let d = '';
        if (geom.type === 'Polygon') {
            geom.coordinates.forEach(ring => { d += ringToPath(ring) + ' '; });
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => poly.forEach(ring => { d += ringToPath(ring) + ' '; }));
        }
        paths += `<path d="${d}" fill="${cor}" stroke="#1e293b" stroke-width="0.8" />`;

        const cent = CENTROIDE_REGIAO[nome];
        if (cent) {
            const [lx, ly] = project(cent[1], cent[0]);
            labels += `
                <g>
                    <rect x="${(lx - 38).toFixed(1)}" y="${(ly - 18).toFixed(1)}" width="76" height="36" rx="6" fill="rgba(255,255,255,0.85)" stroke="#1e3a5f" stroke-width="0.6"/>
                    <text x="${lx.toFixed(1)}" y="${(ly - 4).toFixed(1)}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="9" font-weight="700" fill="#1e3a5f" letter-spacing="0.3">${nome}</text>
                    <text x="${lx.toFixed(1)}" y="${(ly + 11).toFixed(1)}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="13" font-weight="900" fill="#1e40af">${pctVal}%</text>
                </g>
            `;
        }
    });

    // Legenda gradiente
    const legenda = `
        <g transform="translate(${W - 130}, ${H - 36})">
            <rect x="0" y="0" width="120" height="28" rx="6" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" stroke-width="0.6"/>
            <text x="6" y="11" font-family="Segoe UI,Arial,sans-serif" font-size="7.5" font-weight="700" fill="#64748b">% ENTREGAS</text>
            <defs><linearGradient id="grad" x1="0" x2="1"><stop offset="0%" stop-color="hsl(220,75%,70%)"/><stop offset="100%" stop-color="hsl(220,75%,25%)"/></linearGradient></defs>
            <rect x="6" y="15" width="80" height="8" rx="3" fill="url(#grad)"/>
            <text x="90" y="22" font-family="Segoe UI,Arial,sans-serif" font-size="8" fill="#64748b">100%</text>
        </g>
    `;

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#f8fafc;border-radius:10px">${paths}${labels}${legenda}</svg>`;
}

function ModalConfigurarSheet({ onClose, onSalvo }) {
    const [sheets, setSheets] = useState([]);
    const [mes, setMes] = useState(() => new Date().toLocaleString('sv-SE', { timeZone: 'America/Recife' }).slice(0, 7));
    const [sheetId, setSheetId] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        api.get('/api/resultado-sheets').then(r => setSheets(r.data.sheets || [])).catch(() => {});
    }, []);

    const salvar = async () => {
        setErro('');
        setSucesso(false);
        const id = sheetId.trim();
        if (!id) return setErro('Cole o ID da planilha.');
        setSalvando(true);
        try {
            await api.post('/api/resultado-sheets', { mes, sheet_id: id });
            setSucesso(true);
            setSheetId('');
            const r = await api.get('/api/resultado-sheets');
            setSheets(r.data.sheets || []);
            onSalvo();
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao salvar.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '480px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>Planilhas de Resultado Operacional</span>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ flex: '0 0 130px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>Mês</div>
                        <input
                            type="month"
                            value={mes}
                            onChange={e => setMes(e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 10px', color: '#f1f5f9', fontSize: '13px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>ID da Planilha</div>
                        <input
                            value={sheetId}
                            onChange={e => setSheetId(e.target.value)}
                            placeholder="Cole o ID aqui..."
                            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 10px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                        <button onClick={salvar} disabled={salvando} style={{ background: sucesso ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', border: `1px solid ${sucesso ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}`, borderRadius: '8px', padding: '8px 14px', color: sucesso ? '#10b981' : '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '600' }}>
                            {sucesso ? <><Check size={14} /> Salvo</> : <><Plus size={14} /> Salvar</>}
                        </button>
                    </div>
                </div>

                {erro && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '10px' }}>{erro}</div>}

                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '12px' }}>
                    Cole só o ID — a parte entre <code style={{ color: '#94a3b8' }}>/d/</code> e <code style={{ color: '#94a3b8' }}>/edit</code> no link da planilha.
                </div>

                {sheets.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Cadastradas</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                            {sheets.map(s => (
                                <div key={s.mes} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#60a5fa', minWidth: '70px' }}>{s.mes}</span>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sheet_id}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function RelatorioResultadoOperacional() {
    const [dados, setDados] = useState(null);
    const { loading: carregando, erro, execute } = useApiCall();
    const [regiaoFiltro, setRegiaoFiltro] = useState(null);
    const { user } = useAuthStore();
    const [modalSheet, setModalSheet] = useState(false);
    const podeConfigurar = ['Coordenador', 'Direção', 'Planejamento', 'Desenvolvedor'].includes(user?.cargo);
    const geojsonCacheRef = useRef(null);
    const hoveredBarKeyRef = useRef(null);
    const TooltipFiltrado = useRef(makeTooltipFiltrado(hoveredBarKeyRef)).current;
    const [mes, setMes] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    });

    const buscar = useCallback(async () => {
        const res = await execute(() => api.get('/api/resultado-operacional'));
        if (res) {
            setDados(res.data);
            if (res.data?.mes) {
                const [ano, m] = res.data.mes.split('-');
                const label = new Date(parseInt(ano), parseInt(m) - 1, 1)
                    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
                    .toUpperCase();
                setMes(label);
            }
        }
    }, [execute]);

    useEffect(() => { buscar().catch(() => {}); }, [buscar]);

    const imprimir = () => {
        if (!dados) return;
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        const mapaSvg = gerarSvgMapaBrasil(geojsonCacheRef.current, dados.regioes, dados.totais.entregas);

        // Padrões SVG (hachuras) para distinguir categorias em P&B mantendo cores na tela
        const defsPatterns = `
          <defs>
            <pattern id="pat-carreta" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${COR_VEICULO.carreta}"/></pattern>
            <pattern id="pat-truck" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${COR_VEICULO.truck}"/><path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#1a1a1a" stroke-width="1.4"/></pattern>
            <pattern id="pat-trqu" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${COR_VEICULO.tresQuartos}"/><circle cx="3" cy="3" r="1.2" fill="#1a1a1a"/></pattern>
            <pattern id="pat-plastico" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${COR_MIX.plastico}"/></pattern>
            <pattern id="pat-consolidado" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${COR_MIX.consolidado}"/><rect x="0" y="0" width="4" height="4" fill="#1a1a1a" opacity="0.55"/><rect x="4" y="4" width="4" height="4" fill="#1a1a1a" opacity="0.55"/></pattern>
            <pattern id="pat-porcelana" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${COR_MIX.porcelana}"/><line x1="0" y1="2" x2="6" y2="2" stroke="#1a1a1a" stroke-width="1.2"/></pattern>
            <pattern id="pat-eletrik" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${COR_MIX.eletrik}"/><line x1="2" y1="0" x2="2" y2="6" stroke="#1a1a1a" stroke-width="1.2"/></pattern>
          </defs>
        `;

        // ─── TABELAS (página 1) ─────────────────────────────────────────────────
        const veiculoTable = [
            { label: 'CARRETA', val: dados.veiculos.carreta, key: 'carreta' },
            { label: 'TRUCK',   val: dados.veiculos.truck,   key: 'truck' },
            { label: '3/4',     val: dados.veiculos.tresQuartos, key: 'tresQuartos' },
        ].map(r => {
            const p = pct(r.val, dados.veiculos.total);
            return `<tr><td>${r.label}</td><td class="num">${r.val}</td><td class="pct">${p}%</td></tr>`;
        }).join('');

        const mixTable = [
            { label: 'PLÁSTICO',    val: dados.mix.plastico,    key: 'plastico' },
            { label: 'CONSOLIDADO', val: dados.mix.consolidado, key: 'consolidado' },
            { label: 'PORCELANA',   val: dados.mix.porcelana,   key: 'porcelana' },
            { label: 'ELETRIK',     val: dados.mix.eletrik,     key: 'eletrik' },
        ].map(r => {
            const p = pct(r.val, dados.mix.total);
            return `<tr><td>${r.label}</td><td class="num">${r.val}</td><td class="pct">${p}%</td></tr>`;
        }).join('');

        const regioesOrdenadas = [...dados.regioes].sort((a,b)=>b.entregas-a.entregas);

        const regiaoPctTable = regioesOrdenadas.map(r => {
            const p = pct(r.entregas, dados.totais.entregas);
            return `<tr>
                <td style="font-weight:700">${r.regiao}</td>
                <td class="num">${r.entregas}</td>
                <td class="pct" style="font-weight:700">${p}%</td>
            </tr>`;
        }).join('');

        const regiaoVeicTable = regioesOrdenadas.map(r => {
            const p = pct(r.entregas, dados.totais.entregas);
            return `<tr>
                <td style="font-weight:700">${r.regiao}</td>
                <td class="num">${r.entregas}</td>
                <td class="num">${r.carreta}</td>
                <td class="num">${r.truck}</td>
                <td class="num">${r.tresQuartos}</td>
                <td class="pct">${p}%</td>
            </tr>`;
        }).join('');

        // ─── GRÁFICOS SVG (página 2) ────────────────────────────────────────────

        // Pizza genérica com hachuras
        const gerarPizza = (itens, totalKey) => {
            const W = 260, H = 220, cx = 110, cy = 110, r = 88;
            const total = itens.reduce((s, i) => s + i.val, 0);
            if (total === 0) return `<svg viewBox="0 0 ${W} ${H}"></svg>`;
            let angAtual = -Math.PI / 2;
            let slices = '';
            let labels = '';
            itens.filter(i => i.val > 0).forEach(it => {
                const frac = it.val / total;
                const ang = frac * Math.PI * 2;
                const x1 = cx + r * Math.cos(angAtual);
                const y1 = cy + r * Math.sin(angAtual);
                const x2 = cx + r * Math.cos(angAtual + ang);
                const y2 = cy + r * Math.sin(angAtual + ang);
                const large = ang > Math.PI ? 1 : 0;
                const d = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
                slices += `<path d="${d}" fill="url(#${it.pat})" stroke="#0f172a" stroke-width="1"/>`;
                // label de % no centro da fatia (só se >= 5%)
                const p = (frac * 100);
                if (p >= 5) {
                    const angMeio = angAtual + ang / 2;
                    const lx = cx + (r * 0.62) * Math.cos(angMeio);
                    const ly = cy + (r * 0.62) * Math.sin(angMeio);
                    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="#fff" stroke="#1a1a1a" stroke-width="0.4" paint-order="stroke">${p.toFixed(1)}%</text>`;
                }
                angAtual += ang;
            });
            // Legenda lateral
            const legendaX = 215;
            let leg = '';
            itens.forEach((it, i) => {
                const y = 28 + i * 26;
                const p = total ? ((it.val / total) * 100).toFixed(1) : '0.0';
                leg += `
                    <rect x="${legendaX}" y="${y}" width="14" height="14" fill="url(#${it.pat})" stroke="#0f172a" stroke-width="0.8"/>
                    <text x="${legendaX + 20}" y="${y + 7}" font-family="Segoe UI,Arial,sans-serif" font-size="9" font-weight="700" fill="#1e293b">${it.label}</text>
                    <text x="${legendaX + 20}" y="${y + 17}" font-family="Segoe UI,Arial,sans-serif" font-size="8.5" fill="#475569">${it.val} · ${p}%</text>
                `;
            });
            return `<svg viewBox="0 0 460 ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">${defsPatterns}${slices}${labels}${leg}</svg>`;
        };

        const pizzaVeiculo = gerarPizza([
            { label: 'CARRETA', val: dados.veiculos.carreta,     pat: 'pat-carreta' },
            { label: 'TRUCK',   val: dados.veiculos.truck,       pat: 'pat-truck' },
            { label: '3/4',     val: dados.veiculos.tresQuartos, pat: 'pat-trqu' },
        ]);

        const pizzaMix = gerarPizza([
            { label: 'PLÁSTICO',    val: dados.mix.plastico,    pat: 'pat-plastico' },
            { label: 'CONSOLIDADO', val: dados.mix.consolidado, pat: 'pat-consolidado' },
            { label: 'PORCELANA',   val: dados.mix.porcelana,   pat: 'pat-porcelana' },
            { label: 'ELETRIK',     val: dados.mix.eletrik,     pat: 'pat-eletrik' },
        ]);

        // Régua (barras horizontais) — entregas por região
        const gerarRegua = () => {
            const maxV = Math.max(...regioesOrdenadas.map(r => r.entregas), 1);
            const barH = 22, gap = 10, padTop = 14, padLeft = 90, padRight = 80;
            const W = 520;
            const H = padTop + regioesOrdenadas.length * (barH + gap);
            const larguraDisponivel = W - padLeft - padRight;
            let bars = '';
            regioesOrdenadas.forEach((r, i) => {
                const y = padTop + i * (barH + gap);
                const w = (r.entregas / maxV) * larguraDisponivel;
                const p = pct(r.entregas, dados.totais.entregas);
                bars += `
                    <text x="${padLeft - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-family="Segoe UI,Arial,sans-serif" font-size="11" font-weight="700" fill="#1e293b">${r.regiao}</text>
                    <rect x="${padLeft}" y="${y}" width="${larguraDisponivel}" height="${barH}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5"/>
                    <rect x="${padLeft}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="url(#pat-carreta)" stroke="#0f172a" stroke-width="0.8"/>
                    <text x="${padLeft + w + 6}" y="${y + barH / 2 + 4}" font-family="Segoe UI,Arial,sans-serif" font-size="10" font-weight="700" fill="#1e40af">${r.entregas} · ${p}%</text>
                `;
            });
            return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">${defsPatterns}${bars}</svg>`;
        };

        // Barras agrupadas: região × tipo de veículo
        const gerarBarrasAgrupadas = () => {
            const grupos = regioesOrdenadas;
            const subBarW = 14, gapSub = 2, gapGrupo = 22;
            const padTop = 18, padBottom = 36, padLeft = 30, padRight = 12;
            const grupoW = subBarW * 3 + gapSub * 2 + gapGrupo;
            const W = padLeft + padRight + grupos.length * grupoW;
            const H = 180;
            const chartH = H - padTop - padBottom;
            const maxV = Math.max(...grupos.flatMap(g => [g.carreta, g.truck, g.tresQuartos]), 1);
            let content = '';
            // eixo Y leve
            content += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" stroke="#cbd5e1" stroke-width="0.6"/>`;
            content += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${W - padRight}" y2="${padTop + chartH}" stroke="#cbd5e1" stroke-width="0.6"/>`;
            grupos.forEach((g, i) => {
                const gx = padLeft + 8 + i * grupoW;
                [
                    { val: g.carreta, pat: 'pat-carreta' },
                    { val: g.truck, pat: 'pat-truck' },
                    { val: g.tresQuartos, pat: 'pat-trqu' },
                ].forEach((b, j) => {
                    const h = (b.val / maxV) * chartH;
                    const x = gx + j * (subBarW + gapSub);
                    const y = padTop + chartH - h;
                    content += `<rect x="${x}" y="${y.toFixed(1)}" width="${subBarW}" height="${h.toFixed(1)}" fill="url(#${b.pat})" stroke="#0f172a" stroke-width="0.6"/>`;
                    if (b.val > 0) content += `<text x="${(x + subBarW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="8" font-weight="700" fill="#1e293b">${b.val}</text>`;
                });
                content += `<text x="${(gx + (subBarW * 3 + gapSub * 2) / 2).toFixed(1)}" y="${(padTop + chartH + 14).toFixed(1)}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="9" font-weight="700" fill="#1e293b">${g.regiao}</text>`;
            });
            // legenda
            const legY = padTop + chartH + 24;
            const itensLeg = [
                { lbl: 'CARRETA', pat: 'pat-carreta' },
                { lbl: 'TRUCK', pat: 'pat-truck' },
                { lbl: '3/4', pat: 'pat-trqu' },
            ];
            let xLeg = padLeft;
            itensLeg.forEach(it => {
                content += `<rect x="${xLeg}" y="${legY - 8}" width="10" height="10" fill="url(#${it.pat})" stroke="#0f172a" stroke-width="0.5"/>`;
                content += `<text x="${xLeg + 14}" y="${legY}" font-family="Segoe UI,Arial,sans-serif" font-size="9" font-weight="700" fill="#1e293b">${it.lbl}</text>`;
                xLeg += 70;
            });
            return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">${defsPatterns}${content}</svg>`;
        };

        const reguaSvg = gerarRegua();
        const barrasAgrupSvg = gerarBarrasAgrupadas();

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Resultado Operacional</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 12px 20px; }
  .page-break { page-break-before: always; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e40af; padding-bottom: 6px; margin-bottom: 8px; }
  .header-left h1 { font-size: 22px; font-weight: 900; color: #1e40af; letter-spacing: -0.5px; }
  .header-left h2 { font-size: 13px; font-weight: 700; color: #3b82f6; margin-top: 2px; }
  .header-right { text-align: right; font-size: 9.5px; color: #64748b; line-height: 1.5; }
  .section-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; margin-bottom: 8px; margin-top: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .kpi-box { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #1e40af; border-radius: 6px; padding: 10px 14px; }
  .kpi-num { font-size: 32px; font-weight: 900; color: #1e40af; line-height: 1; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 3px; }
  .kpi-sub { font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.5; }
  .kpi-sub b { color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #64748b; border-bottom: 2px solid #cbd5e1; background: #f8fafc; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; vertical-align: middle; }
  td.num { font-weight: 700; color: #1e40af; text-align: right; }
  td.pct { color: #475569; text-align: right; font-weight: 600; }
  .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  .chart-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; background: #fff; max-height: 200px; overflow: hidden; }
  .chart-box svg { max-height: 165px; width: auto; max-width: 100%; display: block; margin: 0 auto; }
  .chart-box-mapa { max-height: 412px; }
  .chart-box-mapa svg { max-height: 380px; }
  .legenda-pat { font-size: 8.5px; color: #64748b; margin-top: 4px; font-style: italic; }
  @media print { @page { margin: 8mm 7mm; size: A4 landscape; } body { font-size: 10.5px; } }
</style>
</head>
<body>

<!-- PÁGINA 1: KPIs + Tabelas (Veículo, Mix, Região %, Região × Veículo) -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>RESULTADO OPERACIONAL</h1>
      <h2>${mes}</h2>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}<br/><span>Página 1 de 2 — Dados</span></div>
  </div>

  <div class="grid-3" style="margin-bottom:14px">
    <div class="kpi-box">
      <div class="kpi-label">Total de Embarques</div>
      <div class="kpi-num">${dados.veiculos.total}</div>
      <div class="kpi-sub"><b>${dados.veiculos.carreta}</b> Carreta · <b>${dados.veiculos.truck}</b> Truck · <b>${dados.veiculos.tresQuartos}</b> 3/4</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Total de Entregas</div>
      <div class="kpi-num">${dados.totais.entregas}</div>
      <div class="kpi-sub">Soma de todas as regiões</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Mix de Operação</div>
      <div class="kpi-num">${dados.mix.total}</div>
      <div class="kpi-sub"><b>${dados.mix.plastico}</b> Plást · <b>${dados.mix.consolidado}</b> Cons · <b>${dados.mix.porcelana}</b> Porc · <b>${dados.mix.eletrik}</b> Elet</div>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="section-title">Tipo de Veículo</div>
      <table>
        <thead><tr><th>Veículo</th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${veiculoTable}
          <tr style="background:#f1f5f9"><td style="font-weight:900">TOTAL</td><td class="num">${dados.veiculos.total}</td><td class="pct" style="font-weight:900">100%</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="section-title">Mix de Operação</div>
      <table>
        <thead><tr><th>Operação</th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${mixTable}
          <tr style="background:#f1f5f9"><td style="font-weight:900">TOTAL</td><td class="num">${dados.mix.total}</td><td class="pct" style="font-weight:900">100%</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="grid-2" style="margin-top:12px">
    <div>
      <div class="section-title">% por Região</div>
      <table>
        <thead><tr><th>Região</th><th style="text-align:right">Entregas</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${regiaoPctTable}
          <tr style="background:#f1f5f9"><td style="font-weight:900">TOTAL</td><td class="num">${dados.totais.entregas}</td><td class="pct" style="font-weight:900">100%</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="section-title">Entregas por Região × Tipo de Veículo</div>
      <table>
        <thead>
          <tr>
            <th>Região</th>
            <th style="text-align:right">Entregas</th>
            <th style="text-align:right">Carreta</th>
            <th style="text-align:right">Truck</th>
            <th style="text-align:right">3/4</th>
            <th style="text-align:right">%</th>
          </tr>
        </thead>
        <tbody>${regiaoVeicTable}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <span>Transnet Logística — Resultado Operacional</span>
    <span>${mes}</span>
  </div>
</div>

<!-- PÁGINA 2: Gráficos -->
<div class="page page-break">
  <div class="header">
    <div class="header-left">
      <h1>RESULTADO OPERACIONAL</h1>
      <h2>${mes}</h2>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}<br/><span>Página 2 de 2 — Gráficos</span></div>
  </div>

  <div class="grid-2">
    <div class="chart-box">
      <div class="section-title" style="margin-top:0">Tipo de Veículo</div>
      ${pizzaVeiculo}
      <div class="legenda-pat">Padrões: sólido = Carreta · diagonais = Truck · pontos = 3/4</div>
    </div>
    <div class="chart-box">
      <div class="section-title" style="margin-top:0">Mix de Operação</div>
      ${pizzaMix}
      <div class="legenda-pat">Padrões: sólido = Plástico · xadrez = Consolidado · linhas — = Porcelana · linhas | = Eletrik</div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; gap:12px; margin-top:12px">
    <div class="chart-box chart-box-mapa" style="grid-row: span 2">
      <div class="section-title" style="margin-top:0">Distribuição por Região (mapa)</div>
      ${mapaSvg || '<div style="padding:20px;text-align:center;color:#94a3b8">mapa indisponível</div>'}
    </div>
    <div class="chart-box">
      <div class="section-title" style="margin-top:0">Entregas por Região</div>
      ${reguaSvg}
      <div class="legenda-pat">Barras ordenadas por volume — número absoluto · % do total geral</div>
    </div>
    <div class="chart-box">
      <div class="section-title" style="margin-top:0">Entregas por Região × Tipo de Veículo</div>
      ${barrasAgrupSvg}
    </div>
  </div>

  <div class="footer">
    <span>Transnet Logística — Resultado Operacional</span>
    <span>${mes}</span>
  </div>
</div>

</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        iframe.contentWindow.focus();
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1500); }, 800);
    };

    if (!dados && carregando) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px', color: '#64748b' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando dados da planilha...
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (erro) return (
        <div style={{ textAlign: 'center', padding: '48px', color: '#f87171', fontSize: '14px' }}>
            {erro}
            <br /><button onClick={buscar} style={{ marginTop: '12px', padding: '8px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
    );

    if (!dados) return null;

    const { veiculos, mix, regioes, totais } = dados;

    // Quando filtro por região está ativo: substitui veiculos/totais pela linha da região
    const regiaoAtiva = regiaoFiltro ? regioes.find(r => r.regiao === regiaoFiltro) : null;
    const veiculosBase = regiaoAtiva
        ? { carreta: regiaoAtiva.carreta, truck: regiaoAtiva.truck, tresQuartos: regiaoAtiva.tresQuartos, total: regiaoAtiva.carreta + regiaoAtiva.truck + regiaoAtiva.tresQuartos }
        : veiculos;
    const entregasBase = regiaoAtiva ? regiaoAtiva.entregas : totais.entregas;

    const dadosVeiculo = [
        { name: 'carreta', label: 'CARRETA', value: veiculosBase.carreta, total: veiculosBase.total },
        { name: 'truck', label: 'TRUCK', value: veiculosBase.truck, total: veiculosBase.total },
        { name: 'tresQuartos', label: '3/4', value: veiculosBase.tresQuartos, total: veiculosBase.total },
    ].filter(d => d.value > 0);

    const dadosMix = [
        { name: 'plastico', label: 'PLÁSTICO', value: mix.plastico, total: mix.total },
        { name: 'consolidado', label: 'CONSOLIDADO', value: mix.consolidado, total: mix.total },
        { name: 'porcelana', label: 'PORCELANA', value: mix.porcelana, total: mix.total },
        { name: 'eletrik', label: 'ELETRIK', value: mix.eletrik, total: mix.total },
    ].filter(d => d.value > 0);

    const dadosRegiao = regiaoAtiva
        ? [regiaoAtiva]
        : [...regioes].sort((a, b) => b.entregas - a.entregas);

    return (
        <div style={{ padding: '10px 0' }}>

            {modalSheet && <ModalConfigurarSheet onClose={() => setModalSheet(false)} onSalvo={() => { setModalSheet(false); buscar(); }} />}

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <TrendingUp size={22} color="#3b82f6" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Resultado Operacional</span>
                {carregando && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        value={mes}
                        onChange={e => setMes(e.target.value)}
                        placeholder="Ex: ABRIL 2026"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', color: '#f1f5f9', fontSize: '12px', outline: 'none', width: '140px' }}
                    />
                    <button onClick={buscar} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                        <RefreshCw size={13} /> Atualizar
                    </button>
                    <button onClick={imprimir} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600' }}>
                        <Printer size={13} /> Imprimir
                    </button>
                    {podeConfigurar && (
                        <button onClick={() => setModalSheet(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }} title="Configurar planilha">
                            <Settings size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                    { label: regiaoFiltro ? `Embarques · ${regiaoFiltro}` : 'Total de Embarques', valor: veiculosBase.total, cor: '#3b82f6', sub: `${veiculosBase.carreta} Carreta · ${veiculosBase.truck} Truck · ${veiculosBase.tresQuartos} 3/4` },
                    { label: regiaoFiltro ? `Entregas · ${regiaoFiltro}` : 'Total de Entregas', valor: entregasBase, cor: '#06b6d4', sub: regiaoFiltro ? `${pct(entregasBase, totais.entregas)}% do total geral` : 'Soma de todas as regiões' },
                    { label: 'Mix de Operação' + (regiaoFiltro ? ' (geral)' : ''), valor: mix.total, cor: '#10b981', sub: `${mix.plastico} Plástico · ${mix.consolidado} Consol. · ${mix.porcelana} Porc. · ${mix.eletrik} Eletrik` },
                ].map(k => (
                    <div key={k.label} style={{ ...s.card, borderLeft: `4px solid ${k.cor}` }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px' }}>{k.label}</div>
                        <div style={{ fontSize: '48px', fontWeight: '900', color: k.cor, lineHeight: 1 }}>{k.valor}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Pizzas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Pizza Veículo */}
                <div style={s.card}>
                    <div style={s.titulo}>Tipo de Veículo{regiaoFiltro ? ` · ${regiaoFiltro}` : ''}</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <PieChart width={160} height={160}>
                            <Pie data={dadosVeiculo} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" nameKey="label" paddingAngle={2}>
                                {dadosVeiculo.map(d => <Cell key={d.name} fill={COR_VEICULO[d.name]} />)}
                            </Pie>
                            <Tooltip content={<TooltipCustom />} />
                        </PieChart>
                        <PizzaLegenda dados={dadosVeiculo} cores={COR_VEICULO} labelKey="label" />
                    </div>
                </div>

                {/* Pizza Mix */}
                <div style={s.card}>
                    <div style={s.titulo}>Mix de Operação</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <PieChart width={160} height={160}>
                            <Pie data={dadosMix} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" nameKey="label" paddingAngle={2}>
                                {dadosMix.map(d => <Cell key={d.name} fill={COR_MIX[d.name]} />)}
                            </Pie>
                            <Tooltip content={<TooltipCustom />} />
                        </PieChart>
                        <PizzaLegenda dados={dadosMix} cores={COR_MIX} labelKey="label" />
                    </div>
                </div>
            </div>

            {/* Mapa + Gráfico Regiões */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={s.card}>
                    <div style={s.titulo}>Distribuição por Região</div>
                    <MapaBrasil regioes={regioes} totalEntregas={totais.entregas} regiaoSelecionada={regiaoFiltro} onSelectRegiao={setRegiaoFiltro} geojsonRef={geojsonCacheRef} />
                </div>
                <div style={s.card}>
                    <div style={{ ...s.titulo, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span>% por Região</span>
                        {regiaoFiltro && (
                            <button onClick={() => setRegiaoFiltro(null)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: '9px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Limpar filtro</button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        {[...regioes].sort((a, b) => b.entregas - a.entregas).map(r => {
                            const p = parseFloat(pct(r.entregas, totais.entregas));
                            const sel = regiaoFiltro === r.regiao;
                            const dimmed = regiaoFiltro && !sel;
                            return (
                                <div
                                    key={r.regiao}
                                    onClick={() => setRegiaoFiltro(sel ? null : r.regiao)}
                                    style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: sel ? 'rgba(59,130,246,0.12)' : 'transparent', opacity: dimmed ? 0.4 : 1, transition: 'all 0.2s' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: sel ? '#60a5fa' : '#f1f5f9' }}>{r.regiao}</span>
                                        <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '700' }}>{p.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                                        <div style={{ width: `${p}%`, height: '100%', background: corChoropleth(p), borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{r.entregas} entregas · {r.carreta} carreta · {r.truck} truck · {r.tresQuartos} 3/4</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Gráfico Regiões × Veículo */}
            <div style={s.card}>
                <div style={s.titulo}>Entregas por Região × Tipo de Veículo{regiaoFiltro ? ` · ${regiaoFiltro}` : ''}</div>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dadosRegiao} margin={{ top: 20, right: 20, left: -10, bottom: 4 }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <XAxis dataKey="regiao" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<TooltipFiltrado />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Bar dataKey="carreta" name="Carreta" fill={COR_VEICULO.carreta} radius={[4, 4, 0, 0]} maxBarSize={32}
                            onMouseEnter={() => { hoveredBarKeyRef.current = 'carreta'; }}
                            onMouseLeave={() => { hoveredBarKeyRef.current = null; }}>
                            <LabelList dataKey="carreta" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                        <Bar dataKey="truck" name="Truck" fill={COR_VEICULO.truck} radius={[4, 4, 0, 0]} maxBarSize={32}
                            onMouseEnter={() => { hoveredBarKeyRef.current = 'truck'; }}
                            onMouseLeave={() => { hoveredBarKeyRef.current = null; }}>
                            <LabelList dataKey="truck" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                        <Bar dataKey="tresQuartos" name="3/4" fill={COR_VEICULO.tresQuartos} radius={[4, 4, 0, 0]} maxBarSize={32}
                            onMouseEnter={() => { hoveredBarKeyRef.current = 'tresQuartos'; }}
                            onMouseLeave={() => { hoveredBarKeyRef.current = null; }}>
                            <LabelList dataKey="tresQuartos" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                {/* Tabela abaixo do gráfico */}
                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5, auto)', gap: '0', fontSize: '11px' }}>
                        {[
                            { label: 'REGIÃO', style: { color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' } },
                            { label: 'ENTREGAS', style: { color: '#64748b', fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: 'CARRETA', style: { color: COR_VEICULO.carreta, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: 'TRUCK', style: { color: COR_VEICULO.truck, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: '3/4', style: { color: COR_VEICULO.tresQuartos, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: '%', style: { color: '#64748b', fontWeight: '700', textAlign: 'right' } },
                        ].map(h => <div key={h.label} style={{ padding: '6px 10px', borderBottom: '2px solid rgba(255,255,255,0.08)', ...h.style }}>{h.label}</div>)}
                        {dadosRegiao.map(r => [
                            <div key={`${r.regiao}-n`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: '700', color: '#f1f5f9' }}>{r.regiao}</div>,
                            <div key={`${r.regiao}-e`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', fontWeight: '700', color: '#06b6d4' }}>{r.entregas}</div>,
                            <div key={`${r.regiao}-c`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.carreta, fontWeight: '700' }}>{r.carreta}</div>,
                            <div key={`${r.regiao}-t`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.truck, fontWeight: '700' }}>{r.truck}</div>,
                            <div key={`${r.regiao}-q`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.tresQuartos, fontWeight: '700' }}>{r.tresQuartos}</div>,
                            <div key={`${r.regiao}-p`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#64748b' }}>{pct(r.entregas, totais.entregas)}%</div>,
                        ])}
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
