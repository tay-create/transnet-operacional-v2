import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, ArrowUp, ArrowDown, Trash2, Save } from 'lucide-react';
import api from '../../services/apiService';

// Origens fixas conhecidas (endereço real dos CDs, não centro da cidade).
const COORDS_ORIGEM = {
    'RECIFE/PE': { lat: -8.0434124, lon: -34.9542906, label: 'CD Recife (Várzea)' },
    'MORENO/PE': { lat: -8.130545712978426, lon: -35.12564333469332, label: 'CD Moreno (Distrito Industrial)' },
};

function iconeNumerado(n, cor = '#3b82f6') {
    return L.divIcon({
        className: 'rota-card-marker',
        html: `<div style="background:${cor};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #0f172a;box-shadow:0 2px 6px rgba(0,0,0,.6)">${n}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}
function iconeOrigem() {
    return L.divIcon({
        className: 'rota-card-marker',
        html: `<div style="background:#f59e0b;color:#0f172a;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border:2px solid #0f172a;box-shadow:0 2px 6px rgba(0,0,0,.6)">CD</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
    });
}

function FitBounds({ pontos }) {
    const map = useMap();
    useEffect(() => {
        if (!pontos || pontos.length === 0) return;
        const valid = pontos.filter(p => p && typeof p.lat === 'number' && typeof p.lon === 'number');
        if (valid.length === 0) return;
        if (valid.length === 1) {
            map.setView([valid[0].lat, valid[0].lon], 6);
        } else {
            const bounds = L.latLngBounds(valid.map(p => [p.lat, p.lon]));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [pontos, map]);
    return null;
}

function formatarKm(metros) {
    if (typeof metros !== 'number') return '—';
    return `${(metros / 1000).toFixed(0)} km`;
}
function formatarTempo(segundos) {
    if (typeof segundos !== 'number') return '';
    const h = Math.floor(segundos / 3600);
    const m = Math.round((segundos % 3600) / 60);
    return h > 0 ? `${h}h${m}min` : `${m}min`;
}

export default function ModalRotaCard({ isOpen, onClose, veiculo, mostrarNotificacao }) {
    const [destinos, setDestinos] = useState([]);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!isOpen || !veiculo) return;
        try {
            const arr = veiculo.destinos_json ? JSON.parse(veiculo.destinos_json) : [];
            setDestinos(Array.isArray(arr) ? arr : []);
        } catch {
            setDestinos([]);
        }
    }, [isOpen, veiculo]);

    const origem = veiculo?.origem_rota || 'RECIFE/PE';
    const origemCoord = COORDS_ORIGEM[origem] || COORDS_ORIGEM['RECIFE/PE'];

    const pontos = useMemo(() => {
        const validos = destinos.filter(d => typeof d.lat === 'number' && typeof d.lon === 'number');
        return [origemCoord, ...validos];
    }, [destinos, origemCoord]);

    const linha = useMemo(() => pontos.map(p => [p.lat, p.lon]), [pontos]);

    const mover = (idx, delta) => {
        setDestinos(prev => {
            const next = [...prev];
            const novoIdx = idx + delta;
            if (novoIdx < 0 || novoIdx >= next.length) return prev;
            const [it] = next.splice(idx, 1);
            next.splice(novoIdx, 0, it);
            return next.map((d, i) => ({ ...d, ordem: i + 1 }));
        });
    };
    const remover = (idx) => {
        setDestinos(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, ordem: i + 1 })));
    };

    const salvar = async () => {
        if (!veiculo?.id) return;
        setSalvando(true);
        try {
            await api.post(`/veiculos/${veiculo.id}/rota`, { destinos });
            mostrarNotificacao?.('✅ Rota atualizada');
            onClose?.();
        } catch (err) {
            mostrarNotificacao?.('❌ Falha ao salvar rota');
            console.error(err);
        } finally {
            setSalvando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f172a', borderRadius: 14, width: '100%', maxWidth: 1100,
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>
                            <MapPin size={18} /> Rota da coleta {veiculo?.coletaRecife || veiculo?.coletaMoreno || veiculo?.coletaInterestadual || ''}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                            Origem: {origemCoord.label} · {destinos.length} destino(s)
                            {veiculo?.rota_recife || veiculo?.rota_moreno ? ` · Rota planilha: ${veiculo.rota_recife || veiculo.rota_moreno}` : ''}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, flex: 1, minHeight: 0 }}>
                    {/* Lista de destinos */}
                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', padding: 16, overflowY: 'auto', minHeight: 0 }}>
                        {destinos.length === 0 ? (
                            <div style={{ color: '#94a3b8', fontSize: 13, padding: 12, textAlign: 'center' }}>
                                Sem destinos. Reimporte ou crie o card a partir de uma coleta na planilha.
                            </div>
                        ) : destinos.map((d, idx) => (
                            <div key={`${d.cidade_uf || d.cidade}-${idx}`} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                                background: 'rgba(30,41,59,.6)', borderRadius: 8, marginBottom: 6,
                                border: '1px solid rgba(255,255,255,0.04)'
                            }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', background: '#3b82f6',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 13, flexShrink: 0
                                }}>{idx + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {d.cidade}/{d.uf}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 11 }}>
                                        {idx === 0
                                            ? `${formatarKm(d.distancia_do_anterior)} da origem`
                                            : `${formatarKm(d.distancia_do_anterior)} do anterior`}
                                        {d.duracao_do_anterior ? ` · ${formatarTempo(d.duracao_do_anterior)}` : ''}
                                    </div>
                                </div>
                                <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                                    style={{ background: 'transparent', border: 0, color: idx === 0 ? '#334155' : '#94a3b8', cursor: idx === 0 ? 'default' : 'pointer', padding: 4 }}>
                                    <ArrowUp size={16} />
                                </button>
                                <button onClick={() => mover(idx, +1)} disabled={idx === destinos.length - 1}
                                    style={{ background: 'transparent', border: 0, color: idx === destinos.length - 1 ? '#334155' : '#94a3b8', cursor: idx === destinos.length - 1 ? 'default' : 'pointer', padding: 4 }}>
                                    <ArrowDown size={16} />
                                </button>
                                <button onClick={() => remover(idx)} style={{ background: 'transparent', border: 0, color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Mapa */}
                    <div style={{ minHeight: 0, position: 'relative' }}>
                        <MapContainer
                            center={[origemCoord.lat, origemCoord.lon]}
                            zoom={5}
                            style={{ height: '100%', width: '100%', minHeight: 400, background: '#0f172a' }}
                            scrollWheelZoom
                            preferCanvas
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                            />
                            <FitBounds pontos={pontos} />
                            <Marker position={[origemCoord.lat, origemCoord.lon]} icon={iconeOrigem()}>
                                <Tooltip permanent={false} direction="top">{origemCoord.label}</Tooltip>
                            </Marker>
                            {destinos.map((d, idx) => (
                                typeof d.lat === 'number' && typeof d.lon === 'number' && (
                                    <Marker key={`m-${idx}`} position={[d.lat, d.lon]} icon={iconeNumerado(idx + 1)}>
                                        <Tooltip direction="top">{d.cidade}/{d.uf}</Tooltip>
                                    </Marker>
                                )
                            ))}
                            {linha.length >= 2 && (
                                <Polyline positions={linha} pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.8, dashArray: '6 4' }} />
                            )}
                        </MapContainer>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <button onClick={onClose} disabled={salvando}
                        style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                        Cancelar
                    </button>
                    <button onClick={salvar} disabled={salvando}
                        style={{ background: '#3b82f6', color: '#fff', border: 0, padding: '8px 18px', borderRadius: 8, cursor: salvando ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
}
