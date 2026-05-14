import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Cor por % de FORA do lead. Operadora dentro do lead → verde. Acumula vermelho.
function corPorPctFora(pct) {
    if (pct == null) return '#1f2937'; // cinza escuro: sem dados
    if (pct < 10)  return '#22c55e';
    if (pct < 30)  return '#eab308';
    return '#ef4444';
}

// porUF: { 'SP': { antecipado, dentro, fora, total, mediaDias }, ... }
// onClickUF: callback(uf) opcional. Quando informado, estados ficam clicáveis.
export default function MapaLeadTime({ porUF, ufSelecionada, onClickUF, height = 460 }) {
    const [geo, setGeo] = useState(null);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        fetch('/geo/brasil-estados.geojson')
            .then(r => r.ok ? r.json() : Promise.reject(new Error('GeoJSON indisponível')))
            .then(setGeo)
            .catch(e => setErro(e.message));
    }, []);

    const estiloFeature = useMemo(() => (feature) => {
        const sigla = feature?.properties?.sigla;
        const reg = porUF?.[sigla];
        const total = reg?.total || 0;
        const pct = total > 0 ? (reg.fora / total) * 100 : null;
        const selecionado = sigla === ufSelecionada;
        return {
            fillColor: corPorPctFora(pct),
            fillOpacity: total > 0 ? 0.7 : 0.25,
            color: selecionado ? '#f8fafc' : '#0f172a',
            weight: selecionado ? 2.5 : 0.6,
        };
    }, [porUF, ufSelecionada]);

    const onEachFeature = (feature, layer) => {
        const sigla = feature?.properties?.sigla;
        const reg = porUF?.[sigla];
        const total = reg?.total || 0;
        const pct = total > 0 ? ((reg.fora / total) * 100).toFixed(0) : '—';
        const label = `<strong>${feature.properties.name} (${sigla})</strong><br/>${total} entrega(s)<br/>${pct}% fora do lead`;
        layer.bindTooltip(label, { sticky: true, direction: 'auto', className: 'lead-time-tooltip' });
        if (onClickUF) {
            layer.on('click', () => onClickUF(sigla));
        }
    };

    if (erro) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: 'rgba(15,23,42,0.4)', borderRadius: 12 }}>
                Mapa indisponível: {erro}
            </div>
        );
    }
    if (!geo) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: 'rgba(15,23,42,0.4)', borderRadius: 12 }}>
                Carregando mapa…
            </div>
        );
    }

    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MapContainer
                center={[-14.5, -54]}
                zoom={4}
                style={{ height, background: '#0b1220' }}
                scrollWheelZoom={false}
                zoomControl={!!onClickUF}
                dragging={!!onClickUF}
                doubleClickZoom={!!onClickUF}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OpenStreetMap, &copy; CARTO"
                />
                <GeoJSON key={JSON.stringify({ ufSelecionada, n: Object.keys(porUF || {}).length })} data={geo} style={estiloFeature} onEachFeature={onEachFeature} />
            </MapContainer>
            <div style={{ display: 'flex', gap: 12, padding: '8px 12px', fontSize: 11, color: '#cbd5e1', background: 'rgba(15,23,42,0.6)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <Legenda cor="#22c55e" label="< 10% fora" />
                <Legenda cor="#eab308" label="10–30% fora" />
                <Legenda cor="#ef4444" label="> 30% fora" />
                <Legenda cor="#1f2937" label="sem dados" />
            </div>
        </div>
    );
}

function Legenda({ cor, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: cor, borderRadius: 3, display: 'inline-block' }} />
            <span>{label}</span>
        </div>
    );
}
