import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ExternalLink } from 'lucide-react';
import useRotaGeometria, { cidadeUfLabel } from '../hooks/useRotaGeometria';

// Origens físicas (endereço do CD, não centro da cidade). Mantém paridade com ModalRotaCard desktop.
const COORDS_ORIGEM = {
    'RECIFE/PE': { lat: -8.0434124, lon: -34.9542906, label: 'CD Recife (Várzea)' },
    'MORENO/PE': { lat: -8.130545712978426, lon: -35.12564333469332, label: 'CD Moreno (Distrito Industrial)' },
    'CARLOS BARBOSA/RS': { lat: -29.28426360237548, lon: -51.4879727918691, label: 'CD Carlos Barbosa (Eletrik Sul)' },
};

function deduzirOrigemPelaOperacao(operacao) {
    const op = String(operacao || '').toUpperCase().trim();
    if (op === 'ELETRIK SUL') return 'CARLOS BARBOSA/RS';
    if (op.includes('RECIFE')) return 'RECIFE/PE';
    return 'MORENO/PE';
}

const COR_ROTA = '#e91e63';
const COR_FALLBACK = '#94a3b8';

function iconeNumerado(n) {
    return L.divIcon({
        className: 'mobile-rota-marker',
        html: `<div style="background:${COR_ROTA};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${n}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

function iconeOrigem() {
    return L.divIcon({
        className: 'mobile-rota-marker',
        html: `<div style="background:#0f172a;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid ${COR_ROTA};box-shadow:0 2px 8px rgba(0,0,0,.5)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
    });
}

function FitBounds({ pontos, geometriaPontos }) {
    const map = useMap();
    React.useEffect(() => {
        if (!map) return;
        const fonte = (geometriaPontos && geometriaPontos.length > 0) ? geometriaPontos : pontos;
        if (!fonte || fonte.length === 0) return;
        const valid = fonte.filter(p => p && typeof p[0] === 'number' && typeof p[1] === 'number');
        if (valid.length === 0) return;

        let cancelado = false;
        map.whenReady(() => {
            if (cancelado) return;
            requestAnimationFrame(() => {
                if (cancelado) return;
                try {
                    map.invalidateSize();
                    if (valid.length === 1) {
                        map.setView(valid[0], 10, { animate: false });
                    } else {
                        const bounds = L.latLngBounds(valid);
                        map.fitBounds(bounds, { padding: [30, 30], animate: false });
                    }
                } catch (e) {
                    console.warn('[MobileModalRota FitBounds] ignorado:', e.message);
                }
            });
        });
        return () => { cancelado = true; };
    }, [pontos, geometriaPontos, map]);
    return null;
}

function formatarKm(metros) {
    if (typeof metros !== 'number' || metros <= 0) return '—';
    return `${(metros / 1000).toFixed(0)} km`;
}

function formatarDuracaoCaminhao(metros) {
    if (typeof metros !== 'number' || metros <= 0) return '—';
    // Mesma fórmula do desktop: caminhão a 55 km/h + descanso 11h a cada 8h dirigindo (Lei 13.103/2015).
    const km = metros / 1000;
    const dirigindoSeg = (km / 55) * 3600;
    const JORNADA = 8 * 3600;
    const DESCANSO = 11 * 3600;
    const jornadasCompletas = Math.floor(dirigindoSeg / JORNADA);
    const resto = dirigindoSeg % JORNADA;
    const descansos = resto > 0 ? jornadasCompletas : Math.max(0, jornadasCompletas - 1);
    const totalSeg = dirigindoSeg + descansos * DESCANSO;
    const totalMin = Math.round(totalSeg / 60);
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
}

function montarUrlGoogleMaps(origemCoord, destinos) {
    const pontos = [
        `${origemCoord.lat},${origemCoord.lon}`,
        ...destinos
            .filter(d => typeof d.lat === 'number' && typeof d.lon === 'number')
            .map(d => `${d.lat},${d.lon}`),
    ];
    if (pontos.length < 2) return null;
    return `https://www.google.com/maps/dir/${pontos.join('/')}`;
}

export default function MobileModalRota({ veiculo, onClose }) {
    const destinos = useMemo(() => {
        try {
            const arr = veiculo?.destinos_json ? JSON.parse(veiculo.destinos_json) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }, [veiculo?.destinos_json]);

    const origem = veiculo?.origem_rota || deduzirOrigemPelaOperacao(veiculo?.operacao);
    const origemCoord = COORDS_ORIGEM[origem] || COORDS_ORIGEM['MORENO/PE'];

    const { pernas, carregando } = useRotaGeometria(veiculo?.id);

    const pontos = useMemo(() => {
        const validos = destinos.filter(d => typeof d.lat === 'number' && typeof d.lon === 'number');
        return [origemCoord, ...validos];
    }, [destinos, origemCoord]);

    const geometriaPontos = useMemo(() => {
        if (!Array.isArray(pernas) || pernas.length === 0) return [];
        return pernas.flatMap(p =>
            p?.geometry?.coordinates
                ? p.geometry.coordinates.map(([lon, lat]) => [lat, lon])
                : []
        );
    }, [pernas]);

    const linhaFallback = useMemo(() => pontos.map(p => [p.lat, p.lon]), [pontos]);

    const totalMetros = useMemo(() => {
        if (Array.isArray(pernas) && pernas.length > 0) {
            return pernas.reduce((acc, p) => acc + (p.distancia_metros || 0), 0);
        }
        return destinos.reduce((acc, d) => acc + (d.distancia_do_anterior || 0), 0);
    }, [pernas, destinos]);

    const urlGmaps = montarUrlGoogleMaps(origemCoord, destinos);
    const coleta = veiculo?.coletaRecife || veiculo?.coletaMoreno || veiculo?.coletaInterestadual || '—';
    const placa = veiculo?.placa1Motorista || veiculo?.placa || '—';

    const usarGeometria = geometriaPontos.length > 0;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#020617',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
            {/* Header */}
            <div style={{
                background: '#0f172a', borderBottom: '1px solid #1e293b',
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                flexShrink: 0,
            }}>
                <button onClick={onClose} aria-label="Voltar" style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    WebkitTapHighlightColor: 'transparent',
                }}>
                    <X size={20} color="#f1f5f9" />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Rota · coleta {coleta}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        {placa}
                    </div>
                </div>
            </div>

            {/* Faixa de info */}
            <div style={{
                background: '#0f172a', borderBottom: '1px solid #1e293b',
                padding: '8px 14px', display: 'flex', alignItems: 'center',
                gap: 10, fontSize: 12, color: '#cbd5e1', flexShrink: 0,
            }}>
                <span style={{ color: '#94a3b8' }}>{origemCoord.label}</span>
                <span style={{ color: '#475569' }}>→</span>
                <span>{destinos.length} destino{destinos.length === 1 ? '' : 's'}</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#e91e63', fontWeight: 700 }}>{formatarKm(totalMetros)}</span>
                <span style={{ color: '#475569' }}>·</span>
                <span style={{ color: '#e91e63', fontWeight: 700 }}>{formatarDuracaoCaminhao(totalMetros)}</span>
            </div>

            {/* Mapa */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {carregando && (
                    <div style={{
                        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(15,23,42,0.9)', color: '#cbd5e1',
                        padding: '6px 12px', borderRadius: 16, fontSize: 11,
                        zIndex: 500, border: '1px solid #1e293b',
                    }}>
                        Calculando rota…
                    </div>
                )}
                <MapContainer
                    center={[origemCoord.lat, origemCoord.lon]}
                    zoom={6}
                    style={{ height: '100%', width: '100%', background: '#e2e8f0' }}
                    scrollWheelZoom
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    <FitBounds pontos={pontos} geometriaPontos={geometriaPontos} />

                    <Marker position={[origemCoord.lat, origemCoord.lon]} icon={iconeOrigem()}>
                        <Popup>{origemCoord.label}</Popup>
                    </Marker>

                    {destinos
                        .filter(d => typeof d.lat === 'number' && typeof d.lon === 'number')
                        .map((d, i) => (
                            <Marker key={`${d.cidade_uf || d.cidade}-${i}`} position={[d.lat, d.lon]} icon={iconeNumerado(i + 1)}>
                                <Popup>{cidadeUfLabel(d)}</Popup>
                            </Marker>
                        ))}

                    {usarGeometria ? (
                        <Polyline positions={geometriaPontos} pathOptions={{ color: COR_ROTA, weight: 4, opacity: 0.85 }} />
                    ) : (
                        <Polyline positions={linhaFallback} pathOptions={{ color: COR_FALLBACK, weight: 3, opacity: 0.55, dashArray: '6 6' }} />
                    )}
                </MapContainer>
            </div>

            {/* Rodapé */}
            <div style={{
                background: '#0f172a', borderTop: '1px solid #1e293b',
                padding: '10px 14px', flexShrink: 0,
            }}>
                <a
                    href={urlGmaps || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => { if (!urlGmaps) e.preventDefault(); }}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '10px',
                        background: urlGmaps ? COR_ROTA : '#1e293b',
                        color: urlGmaps ? '#fff' : '#475569',
                        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
                        pointerEvents: urlGmaps ? 'auto' : 'none',
                    }}
                >
                    <ExternalLink size={14} /> Abrir no Google Maps
                </a>
            </div>
        </div>
    );
}
