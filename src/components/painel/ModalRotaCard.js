import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, ArrowUp, ArrowDown, Trash2, Save, Truck, ExternalLink } from 'lucide-react';
import api from '../../services/apiService';

// Origens fixas conhecidas (endereço real dos CDs, não centro da cidade).
const COORDS_ORIGEM = {
    'RECIFE/PE': { lat: -8.0434124, lon: -34.9542906, label: 'CD Recife (Várzea)' },
    'MORENO/PE': { lat: -8.130545712978426, lon: -35.12564333469332, label: 'CD Moreno (Distrito Industrial)' },
    'CARLOS BARBOSA/RS': { lat: -29.28426360237548, lon: -51.4879727918691, label: 'CD Carlos Barbosa (Eletrik Sul)' },
};

// Fallback: deduz origem pela operação do card quando origem_rota está null/undefined.
// Mesmas regras do backend (geradorRotas.determinarOrigem).
function deduzirOrigemPelaOperacao(operacao) {
    const op = String(operacao || '').toUpperCase().trim();
    if (op === 'ELETRIK SUL') return 'CARLOS BARBOSA/RS';
    if (op.includes('RECIFE')) return 'RECIFE/PE';
    return 'MORENO/PE';
}

const COR_ROTA = '#e91e63';   // magenta/rosa vibrante
const COR_FALLBACK = '#94a3b8'; // cinza claro quando OSRM falha

// Resolve cidade/uf de um destino com fallback para cidade_uf legado.
function cidadeUf(d) {
    if (d?.cidade && d?.uf) return `${d.cidade}/${d.uf}`;
    if (d?.cidade_uf) return d.cidade_uf;
    return '—';
}

function iconeNumerado(n) {
    return L.divIcon({
        className: 'rota-card-marker',
        html: `<div style="background:${COR_ROTA};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${n}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}
function iconeOrigem() {
    return L.divIcon({
        className: 'rota-card-marker',
        html: `<div style="background:#0f172a;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid ${COR_ROTA};box-shadow:0 2px 8px rgba(0,0,0,.5)"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    });
}

function FitBounds({ pontos, geometriaPontos }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        // Se temos geometria, usa todos os vértices da polyline para enquadrar melhor.
        const fonte = (geometriaPontos && geometriaPontos.length > 0) ? geometriaPontos : pontos;
        if (!fonte || fonte.length === 0) return;
        const valid = fonte.filter(p => p && typeof p[0] === 'number' && typeof p[1] === 'number');
        if (valid.length === 0) return;

        let cancelado = false;
        // map.whenReady garante que panes estão inicializados.
        // requestAnimationFrame dá ao layout uma chance de assentar antes de calcular bounds
        // (evita "Cannot read properties of undefined (reading '_leaflet_pos')" quando o
        // container ainda não tem altura definitiva durante transição de abertura do modal).
        map.whenReady(() => {
            if (cancelado) return;
            requestAnimationFrame(() => {
                if (cancelado) return;
                try {
                    // invalidateSize força o Leaflet a recalcular tamanho do container
                    map.invalidateSize();
                    if (valid.length === 1) {
                        map.setView(valid[0], 10, { animate: false });
                    } else {
                        const bounds = L.latLngBounds(valid);
                        map.fitBounds(bounds, { padding: [40, 40], animate: false });
                    }
                } catch (e) {
                    // Operação não-crítica — não quebrar a UI se algo der errado.
                    console.warn('[FitBounds] ignorado:', e.message);
                }
            });
        });
        return () => { cancelado = true; };
    }, [pontos, geometriaPontos, map]);
    return null;
}

function formatarKm(metros) {
    if (typeof metros !== 'number') return '—';
    return `${(metros / 1000).toFixed(0)} km`;
}
function formatarDuracao(segundos) {
    if (typeof segundos !== 'number' || segundos <= 0) return '—';
    const totalMin = Math.round(segundos / 60);
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;
    if (d > 0) {
        // ≥ 1 dia: mostra dias + horas (minutos viram ruído nessa escala)
        return h > 0 ? `${d}d ${h}h` : `${d}d`;
    }
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
}

// Calcula tempo total de caminhão considerando velocidade média e Lei 13.103/2015.
// - Velocidade média de caminhão pesado em rodovia: 55 km/h (vs ~90 km/h do carro).
// - Jornada do motorista profissional: max 8h dirigindo, depois 11h de descanso obrigatório.
// Retorna { segundos: total, dirigindoSeg: só motor rodando, descansoSeg: total de paradas }.
const VELOCIDADE_CAMINHAO_KMH = 55;
const JORNADA_MAX_SEG = 8 * 3600;
const DESCANSO_SEG = 11 * 3600;

function tempoCaminhao(distanciaMetros) {
    if (typeof distanciaMetros !== 'number' || distanciaMetros <= 0) {
        return { segundos: 0, dirigindoSeg: 0, descansoSeg: 0 };
    }
    const km = distanciaMetros / 1000;
    const dirigindoSeg = Math.round((km / VELOCIDADE_CAMINHAO_KMH) * 3600);
    // Número de descansos = floor(dirigindo / 8h). Se for múltiplo exato, ainda assim o
    // último trecho de 8h não precisa de descanso (chegou ao destino), então usamos
    // floor((dirigindo - 1) / 8h) para tratar o limiar — na prática: número de jornadas
    // completas finalizadas ANTES da última. Simplificando: descansa N-1 vezes se há N jornadas.
    const jornadasCompletas = Math.floor(dirigindoSeg / JORNADA_MAX_SEG);
    // Se sobra resto após as jornadas completas, ainda existe a última (parcial) — o descanso
    // só ocorre ENTRE jornadas. Logo: descansos = jornadasCompletas (resto > 0 vira a "última")
    // OU jornadasCompletas - 1 (resto == 0).
    const resto = dirigindoSeg % JORNADA_MAX_SEG;
    const descansos = resto > 0 ? jornadasCompletas : Math.max(0, jornadasCompletas - 1);
    const descansoSeg = descansos * DESCANSO_SEG;
    return {
        segundos: dirigindoSeg + descansoSeg,
        dirigindoSeg,
        descansoSeg,
    };
}

// Monta URL pública do Google Maps com origem + destinos na ordem.
// Não usa API key — é só uma URL pública que o navegador entende.
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

export default function ModalRotaCard({ isOpen, onClose, veiculo, mostrarNotificacao }) {
    const [destinos, setDestinos] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [regenerando, setRegenerando] = useState(false);
    const [pernas, setPernas] = useState(null); // null = carregando, [] = falha total, [{...}] = ok
    const [carregandoGeo, setCarregandoGeo] = useState(false);

    useEffect(() => {
        if (!isOpen || !veiculo) return;
        try {
            const arr = veiculo.destinos_json ? JSON.parse(veiculo.destinos_json) : [];
            setDestinos(Array.isArray(arr) ? arr : []);
        } catch {
            setDestinos([]);
        }
    }, [isOpen, veiculo]);

    // Função reutilizável que busca a geometria por estrada do backend.
    // - Sem destinosLocal: usa GET (lê destinos_json do banco) — para abertura inicial.
    // - Com destinosLocal: usa POST preview (geometria calculada a partir da ordem local)
    //   — usado quando o usuário reordena/remove destinos antes de salvar.
    const buscarGeometria = React.useCallback(async (idAlvo, destinosLocal) => {
        if (!idAlvo) {
            setPernas(null);
            return;
        }
        setCarregandoGeo(true);
        try {
            let r;
            if (Array.isArray(destinosLocal)) {
                r = await api.post(`/veiculos/${idAlvo}/rota-geometria-preview`, { destinos: destinosLocal });
            } else {
                r = await api.get(`/veiculos/${idAlvo}/rota-geometria`);
            }
            setPernas(Array.isArray(r.data?.pernas) ? r.data.pernas : []);
        } catch (err) {
            console.error('Falha ao buscar geometria de rota:', err);
            setPernas([]);
        } finally {
            setCarregandoGeo(false);
        }
    }, []);

    // Busca ao abrir o modal (GET — usa destinos do banco).
    useEffect(() => {
        if (!isOpen || !veiculo?.id) {
            setPernas(null);
            return;
        }
        buscarGeometria(veiculo.id);
    }, [isOpen, veiculo?.id, buscarGeometria]);

    // Re-buscar geometria quando o usuário reordenar/remover destinos.
    // Usamos uma assinatura concatenada dos destinos para detectar mudanças de ordem/composição.
    // Debounce 300ms para não disparar a cada clique de seta rapidamente.
    const assinaturaDestinos = useMemo(
        () => destinos.map(d => d.cidade_uf || `${d.cidade}/${d.uf}`).join('|'),
        [destinos]
    );
    const primeiraMontagem = React.useRef(true);
    useEffect(() => {
        if (!isOpen || !veiculo?.id) return;
        // Pula a primeira execução (já feita pelo useEffect de abertura)
        if (primeiraMontagem.current) { primeiraMontagem.current = false; return; }
        const t = setTimeout(() => {
            buscarGeometria(veiculo.id, destinos);
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assinaturaDestinos]);

    // Reset da flag quando o modal fecha
    useEffect(() => {
        if (!isOpen) primeiraMontagem.current = true;
    }, [isOpen]);

    // Origem: usa origem_rota gravada no card; se faltar, deduz pela operação (não usa default RECIFE).
    const origem = veiculo?.origem_rota || deduzirOrigemPelaOperacao(veiculo?.operacao);
    const origemCoord = COORDS_ORIGEM[origem] || COORDS_ORIGEM['MORENO/PE'];

    const pontos = useMemo(() => {
        const validos = destinos.filter(d => typeof d.lat === 'number' && typeof d.lon === 'number');
        return [origemCoord, ...validos];
    }, [destinos, origemCoord]);

    // Polyline real por estrada (todas as pernas concatenadas em [lat, lon]).
    const geometriaPontos = useMemo(() => {
        if (!Array.isArray(pernas) || pernas.length === 0) return [];
        return pernas.flatMap(p =>
            p?.geometry?.coordinates
                ? p.geometry.coordinates.map(([lon, lat]) => [lat, lon])
                : []
        );
    }, [pernas]);

    // Fallback: linha reta entre pontos se OSRM falhar ou ainda não carregou.
    const linhaFallback = useMemo(() => pontos.map(p => [p.lat, p.lon]), [pontos]);

    // Totais de distância/duração somando as pernas (OSRM).
    // Para o tempo: NÃO usamos o duration do OSRM (carro a ~90 km/h). Recalculamos a
    // partir da distância usando velocidade de caminhão (55 km/h) + descanso obrigatório
    // (Lei 13.103/2015: 11h de descanso a cada 8h dirigindo).
    const { totalKm, totalDirigindoSeg, totalDescansoSeg, totalSeg } = useMemo(() => {
        let metros;
        if (!Array.isArray(pernas) || pernas.length === 0) {
            metros = destinos.reduce((acc, d) => acc + (d.distancia_do_anterior || 0), 0);
        } else {
            metros = pernas.reduce((acc, p) => acc + (p.distancia_metros || 0), 0);
        }
        const t = tempoCaminhao(metros);
        return {
            totalKm: metros / 1000,
            totalDirigindoSeg: t.dirigindoSeg,
            totalDescansoSeg: t.descansoSeg,
            totalSeg: t.segundos,
        };
    }, [pernas, destinos]);

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

    const regenerar = async () => {
        if (!veiculo?.id) return;
        setRegenerando(true);
        try {
            const r = await api.post(`/veiculos/${veiculo.id}/regenerar-rota`);
            if (r.data?.destinos_json) {
                try {
                    const arr = JSON.parse(r.data.destinos_json);
                    setDestinos(Array.isArray(arr) ? arr : []);
                    mostrarNotificacao?.('✅ Rota gerada');
                    // Re-busca geometria por estrada — só os destinos mudaram, o effect não dispara sozinho
                    buscarGeometria(veiculo.id);
                } catch {
                    mostrarNotificacao?.('⚠️ Rota gerada mas resposta inválida');
                }
            } else {
                mostrarNotificacao?.(`⚠️ Falhou: ${r.data?.aviso || 'erro desconhecido'}`);
            }
        } catch (err) {
            mostrarNotificacao?.('❌ Falha ao gerar rota');
            console.error(err);
        } finally {
            setRegenerando(false);
        }
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

    const urlGmaps = montarUrlGoogleMaps(origemCoord, destinos);
    const temGeometriaReal = geometriaPontos.length > 0;

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
                            <div style={{ padding: 12, textAlign: 'center' }}>
                                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                                    Sem destinos. Possíveis causas: coleta não encontrada na planilha, ou OSRM/Nominatim instável na criação do card.
                                </div>
                                <button
                                    onClick={regenerar}
                                    disabled={regenerando}
                                    style={{
                                        background: COR_ROTA, color: '#fff', border: 0,
                                        padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                        cursor: regenerando ? 'wait' : 'pointer'
                                    }}
                                >
                                    {regenerando ? 'Gerando rota…' : 'Tentar gerar rota agora'}
                                </button>
                            </div>
                        ) : destinos.map((d, idx) => (
                            <div key={`${d.cidade_uf || d.cidade}-${idx}`} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                                background: 'rgba(30,41,59,.6)', borderRadius: 8, marginBottom: 6,
                                border: '1px solid rgba(255,255,255,0.04)'
                            }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', background: COR_ROTA,
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 13, flexShrink: 0
                                }}>{idx + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {cidadeUf(d)}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 11 }}>
                                        {idx === 0
                                            ? `${formatarKm(d.distancia_do_anterior)} da origem`
                                            : `${formatarKm(d.distancia_do_anterior)} do anterior`}
                                        {typeof d.distancia_do_anterior === 'number' && d.distancia_do_anterior > 0
                                            ? ` · ${formatarDuracao(tempoCaminhao(d.distancia_do_anterior).segundos)}`
                                            : ''}
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
                            style={{ height: '100%', width: '100%', minHeight: 400, background: '#fafafa' }}
                            scrollWheelZoom
                            preferCanvas
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitBounds pontos={linhaFallback} geometriaPontos={geometriaPontos} />
                            <Marker position={[origemCoord.lat, origemCoord.lon]} icon={iconeOrigem()}>
                                <Tooltip permanent={false} direction="top">{origemCoord.label}</Tooltip>
                            </Marker>
                            {destinos.map((d, idx) => (
                                typeof d.lat === 'number' && typeof d.lon === 'number' && (
                                    <Marker key={`m-${idx}`} position={[d.lat, d.lon]} icon={iconeNumerado(idx + 1)}>
                                        <Tooltip direction="top">{cidadeUf(d)}</Tooltip>
                                    </Marker>
                                )
                            ))}
                            {temGeometriaReal ? (
                                <Polyline positions={geometriaPontos} pathOptions={{ color: COR_ROTA, weight: 5, opacity: 0.85 }} />
                            ) : (
                                linhaFallback.length >= 2 && (
                                    <Polyline positions={linhaFallback} pathOptions={{ color: COR_FALLBACK, weight: 3, opacity: 0.7, dashArray: '6 4' }} />
                                )
                            )}
                        </MapContainer>

                        {/* Card flutuante de Distância + Duração (com jornada legal de caminhoneiro) */}
                        {(totalKm > 0 || totalSeg > 0) && (
                            <div style={{
                                position: 'absolute', top: 16, right: 16, zIndex: 1000,
                                background: 'rgba(233, 30, 99, 0.94)', color: '#fff',
                                borderRadius: 12, padding: '12px 16px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                minWidth: 200, fontWeight: 600,
                                pointerEvents: 'none'
                            }}>
                                <div style={{ opacity: 0.85, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Distância</div>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatarKm(totalKm * 1000)}</div>
                                <div style={{ opacity: 0.85, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 }}>Tempo total (caminhão)</div>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{formatarDuracao(totalSeg)}</div>
                                {totalDescansoSeg > 0 && (
                                    <div style={{ opacity: 0.85, fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
                                        Dirigindo: {formatarDuracao(totalDirigindoSeg)}<br/>
                                        Descanso obrig.: {formatarDuracao(totalDescansoSeg)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Loading spinner durante geocode/route */}
                        {carregandoGeo && (
                            <div style={{
                                position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
                                background: 'rgba(15,23,42,0.85)', color: '#fff',
                                borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                pointerEvents: 'none'
                            }}>
                                Calculando rota…
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                        {urlGmaps && (
                            <a
                                href={urlGmaps}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: 'transparent', color: '#60a5fa',
                                    border: '1px solid rgba(96,165,250,0.4)',
                                    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    textDecoration: 'none'
                                }}
                            >
                                <ExternalLink size={14} /> Abrir no Google Maps
                            </a>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} disabled={salvando}
                            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Cancelar
                        </button>
                        <button onClick={salvar} disabled={salvando}
                            style={{ background: COR_ROTA, color: '#fff', border: 0, padding: '8px 18px', borderRadius: 8, cursor: salvando ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
