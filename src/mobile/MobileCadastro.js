import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, RefreshCw, Truck, Car, User, Camera, Image, Trash2 } from 'lucide-react';
import api from '../services/apiService';

const CHECKLIST_LABELS = { cnh: 'CNH', antt: 'ANTT', tacografo: 'Tacógrafo', crlv: 'CRLV' };
const TIPO_COR = { 'LIBERADO': '#22c55e', 'PENDENTE': '#f59e0b', 'NÃO CONFERIDO': '#475569' };

function TimerBadge({ dataLiberacao }) {
    const [info, setInfo] = useState({ label: '', cor: '#475569' });
    useEffect(() => {
        const calc = () => {
            if (!dataLiberacao) { setInfo({ label: 'Sem liberação', cor: '#475569' }); return; }
            const limite = new Date(dataLiberacao).getTime() + 24 * 60 * 60 * 1000;
            const diff = limite - Date.now();
            if (diff <= 0) { setInfo({ label: 'Expirado', cor: '#ef4444' }); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const cor = diff < 3600000 ? '#ef4444' : diff < 7200000 ? '#f59e0b' : '#22c55e';
            setInfo({ label: `${h}h ${m}min`, cor });
        };
        calc();
        const t = setInterval(calc, 30000);
        return () => clearInterval(t);
    }, [dataLiberacao]);

    return (
        <span style={{
            fontSize: '11px', fontWeight: '700', color: info.cor,
            background: `rgba(${hexToRgb(info.cor)},0.1)`,
            border: `1px solid rgba(${hexToRgb(info.cor)},0.3)`,
            borderRadius: '8px', padding: '2px 8px',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
            <RefreshCw size={10} strokeWidth={2} /> {info.label}
        </span>
    );
}

export default function MobileCadastro() {
    const [aba, setAba] = useState('espera');
    const [espera, setEspera] = useState([]);
    const [operacao, setOperacao] = useState([]);
    const [frota, setFrota] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const inputFotoGaleriaRef = useRef(null);
    const inputFotoCameraRef = useRef(null);
    const [fotoUploadId, setFotoUploadId] = useState(null);
    const [menuFotoId, setMenuFotoId] = useState(null); // id do motorista com menu aberto
    const [fotoExpandida, setFotoExpandida] = useState(null); // { src, nome }

    const abrirMenuFoto = (id) => setMenuFotoId(id);

    const processarFoto = async (file, id) => {
        if (!file) return;
        // Reduzir se muito grande (>800KB) via canvas
        const processarImagem = (src) => new Promise((resolve) => {
            const img = new window.Image();
            img.onload = () => {
                const MAX = 800;
                let { width, height } = img;
                if (width > MAX || height > MAX) {
                    const ratio = Math.min(MAX / width, MAX / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.src = src;
        });

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = await processarImagem(ev.target.result);
            try {
                await api.put(`/api/marcacoes/${id}/foto`, { foto: base64 });
                setFrota(prev => prev.map(m => m.id === id ? { ...m, foto: base64 } : m));
            } catch { alert('Erro ao salvar foto.'); }
        };
        reader.readAsDataURL(file);
    };

    const onFotoSelecionada = async (e) => {
        const file = e.target.files?.[0];
        const id = fotoUploadId;
        e.target.value = '';
        setMenuFotoId(null);
        if (!file || !id) return;
        await processarFoto(file, id);
    };

    const removerFoto = async (id) => {
        setMenuFotoId(null);
        try {
            await api.put(`/api/marcacoes/${id}/foto`, { foto: null });
            setFrota(prev => prev.map(m => m.id === id ? { ...m, foto: null } : m));
        } catch { alert('Erro ao remover foto.'); }
    };

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            if (aba === 'espera') {
                const r = await api.get('/api/cadastro/motoristas');
                setEspera(r.data.motoristas || []);
            } else if (aba === 'operacao') {
                const r = await api.get(`/api/cadastro/veiculos-em-operacao?dataInicio=${dataInicio}&dataFim=${dataFim}`);
                setOperacao(r.data.veiculos || []);
            } else if (aba === 'frota') {
                const r = await api.get('/api/cadastro/frota');
                setFrota(r.data.motoristas || []);
            }
        } catch (e) { console.error(e); }
        finally { setCarregando(false); }
    }, [aba, dataInicio, dataFim]);

    useEffect(() => { carregar(); }, [carregar]);

    const ABAS = [
        { id: 'espera', label: 'Em Espera' },
        { id: 'operacao', label: 'Na Operação' },
        { id: 'frota', label: 'Frota Própria' },
    ];

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '12px' }}>
                    Ger. Risco / CT-e
                </div>
                {/* Abas */}
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1e293b' }}>
                    {ABAS.map(a => (
                        <button key={a.id} onClick={() => setAba(a.id)} style={{
                            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: aba === a.id ? '2px solid #f59e0b' : '2px solid transparent',
                            color: aba === a.id ? '#f59e0b' : '#475569',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent', letterSpacing: '0.3px',
                        }}>
                            {a.label}
                        </button>
                    ))}
                </div>

                {/* Filtro data para "Na Operação" */}
                {aba === 'operacao' && (
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 0', alignItems: 'center' }}>
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                        <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : (
                    <>
                        {/* ABA: Em Espera */}
                        {aba === 'espera' && (
                            espera.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                        <Check size={28} color="#334155" strokeWidth={1.5} />
                                    </div>
                                    <div style={{ fontSize: '13px' }}>Nenhum motorista em espera.</div>
                                </div>
                            ) : espera.map(m => (
                                <div key={m.id} style={{
                                    background: '#0f172a', border: '1px solid #1e293b',
                                    borderLeft: '3px solid #f59e0b', borderRadius: '12px', padding: '14px 16px',
                                }}>
                                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9', marginBottom: '8px' }}>
                                        {m.nome_motorista}
                                    </div>
                                    {/* Checklist pills */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                                            const ok = m[key] === 1 || m[key] === true || m[key] === 'SIM';
                                            return (
                                                <span key={key} style={{
                                                    fontSize: '11px', fontWeight: '700',
                                                    color: ok ? '#4ade80' : '#f87171',
                                                    background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                    border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                    borderRadius: '6px', padding: '2px 7px',
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                }}>
                                                    {ok
                                                        ? <Check size={9} strokeWidth={3} />
                                                        : <X size={9} strokeWidth={3} />
                                                    }
                                                    {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {m.operacao && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <RefreshCw size={10} color="#475569" strokeWidth={2} />
                                            {m.operacao}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* ABA: Na Operação */}
                        {aba === 'operacao' && (
                            operacao.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                        <Truck size={28} color="#334155" strokeWidth={1.5} />
                                    </div>
                                    <div style={{ fontSize: '13px' }}>Nenhum veículo neste período.</div>
                                </div>
                            ) : operacao.map(v => {
                                // endpoint /api/cadastro/veiculos-em-operacao retorna situacao_cad (não situacao_cadastro)
                                const sitCor = TIPO_COR[v.situacao_cad] || '#475569';
                                const placa = v.placa1 || v.placa || '';
                                const destino = [v.destino_cidade_cad, v.destino_uf_cad].filter(Boolean).join('/');
                                return (
                                    <div key={v.id} style={{
                                        background: '#0f172a', border: '1px solid #1e293b',
                                        borderLeft: `3px solid ${sitCor}`, borderRadius: '12px', padding: '14px 16px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9' }}>{v.nome_motorista || v.motorista}</div>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {placa && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fb923c', fontWeight: '700' }}>{placa}</span>
                                                    )}
                                                    {v.tipo_veiculo && (
                                                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>{v.tipo_veiculo}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', color: sitCor,
                                                background: `rgba(${hexToRgb(sitCor)},0.1)`,
                                                border: `1px solid rgba(${hexToRgb(sitCor)},0.3)`,
                                                borderRadius: '6px', padding: '2px 8px',
                                            }}>
                                                {v.situacao_cad || 'NÃO CONF.'}
                                            </span>
                                        </div>
                                        {(v.origem_cad || destino) && (
                                            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                                                {v.origem_cad && <span>{v.origem_cad}</span>}
                                                {v.origem_cad && destino && <span style={{ margin: '0 4px' }}>→</span>}
                                                {destino && <span>{destino}</span>}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {v.seguradora_cad && (
                                                <span style={{ fontSize: '11px', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <Check size={10} color="#475569" strokeWidth={2} /> {v.seguradora_cad}
                                                </span>
                                            )}
                                            <TimerBadge dataLiberacao={v.data_liberacao_cad} />
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* ABA: Frota Própria */}
                        {aba === 'frota' && (
                            <>
                                {/* Inputs ocultos — galeria e câmera separados */}
                                <input ref={inputFotoGaleriaRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFotoSelecionada} />
                                <input ref={inputFotoCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFotoSelecionada} />

                                {frota.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                            <Car size={28} color="#334155" strokeWidth={1.5} />
                                        </div>
                                        <div style={{ fontSize: '13px' }}>Nenhum motorista na frota.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {frota.map(m => (
                                            <div key={m.id} style={{
                                                background: '#0f172a', border: '1px solid #1e293b',
                                                borderRadius: '14px', padding: '16px 12px 14px', textAlign: 'center',
                                            }}>
                                                {/* Avatar — foto clica para expandir, ícone câmera abre menu */}
                                                <div style={{ position: 'relative', width: 72, margin: '0 auto 10px' }}>
                                                    {m.foto
                                                        ? <img
                                                            src={m.foto} alt=""
                                                            onClick={() => setFotoExpandida({ src: m.foto, nome: m.nome_motorista })}
                                                            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #334155', display: 'block', cursor: 'zoom-in' }}
                                                          />
                                                        : <div
                                                            onClick={() => abrirMenuFoto(m.id)}
                                                            style={{ width: 72, height: 72, borderRadius: '50%', background: '#1e293b', border: '2px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                            <User size={30} color="#475569" strokeWidth={1.5} />
                                                          </div>
                                                    }
                                                    {/* Botão câmera — sempre abre menu */}
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); abrirMenuFoto(m.id); }}
                                                        style={{ position: 'absolute', bottom: 2, right: 2, background: '#3b82f6', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', cursor: 'pointer' }}>
                                                        <Camera size={12} color="#fff" strokeWidth={2.5} />
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: '700', fontSize: '12px', color: '#f1f5f9', lineHeight: 1.3, marginBottom: '4px' }}>
                                                    {m.nome_motorista}
                                                </div>
                                                {m.placa1 && (
                                                    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fb923c', fontWeight: '700', marginBottom: '3px' }}>
                                                        {m.placa1}
                                                    </div>
                                                )}
                                                {m.tipo_veiculo && (
                                                    <div style={{ fontSize: '10px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
                                                        {m.tipo_veiculo}
                                                    </div>
                                                )}
                                                {m.situacao_cad && (
                                                    <div style={{
                                                        display: 'inline-block', fontSize: '9px', fontWeight: '700',
                                                        color: TIPO_COR[m.situacao_cad] || '#475569',
                                                        background: `rgba(${hexToRgb(TIPO_COR[m.situacao_cad] || '#475569')},0.1)`,
                                                        border: `1px solid rgba(${hexToRgb(TIPO_COR[m.situacao_cad] || '#475569')},0.3)`,
                                                        borderRadius: '5px', padding: '2px 6px', textTransform: 'uppercase',
                                                    }}>
                                                        {m.situacao_cad}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Lightbox — expandir foto */}
                                {fotoExpandida && (
                                    <div
                                        onClick={() => setFotoExpandida(null)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', marginBottom: '16px' }}>{fotoExpandida.nome}</div>
                                        <img
                                            src={fotoExpandida.src} alt=""
                                            style={{ maxWidth: '92vw', maxHeight: '70vh', borderRadius: '16px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                                        />
                                        <div style={{ marginTop: '20px', fontSize: '12px', color: '#475569' }}>Toque para fechar</div>
                                    </div>
                                )}

                                {/* Menu de foto — sheet simples */}
                                {menuFotoId !== null && (
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }}>
                                        <div onClick={() => setMenuFotoId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: '#0f172a', borderTop: '1px solid #334155',
                                            borderRadius: '20px 20px 0 0',
                                            padding: '20px 20px calc(28px + env(safe-area-inset-bottom))',
                                        }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Foto do motorista
                                            </div>
                                            {/* Tirar foto */}
                                            <button onClick={() => { setFotoUploadId(menuFotoId); setTimeout(() => inputFotoCameraRef.current?.click(), 50); }} style={{
                                                width: '100%', height: '52px', background: '#1e293b', border: '1px solid #334155',
                                                borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', fontWeight: '600',
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px',
                                                cursor: 'pointer', marginBottom: '10px',
                                            }}>
                                                <Camera size={20} color="#3b82f6" strokeWidth={2} />
                                                Tirar foto agora
                                            </button>
                                            {/* Escolher da galeria */}
                                            <button onClick={() => { setFotoUploadId(menuFotoId); setTimeout(() => inputFotoGaleriaRef.current?.click(), 50); }} style={{
                                                width: '100%', height: '52px', background: '#1e293b', border: '1px solid #334155',
                                                borderRadius: '12px', color: '#f1f5f9', fontSize: '15px', fontWeight: '600',
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px',
                                                cursor: 'pointer', marginBottom: frota.find(m => m.id === menuFotoId)?.foto ? '10px' : '0',
                                            }}>
                                                <Image size={20} color="#8b5cf6" strokeWidth={2} />
                                                Escolher da galeria
                                            </button>
                                            {/* Remover foto (só se tiver) */}
                                            {frota.find(m => m.id === menuFotoId)?.foto && (
                                                <button onClick={() => removerFoto(menuFotoId)} style={{
                                                    width: '100%', height: '52px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                                    borderRadius: '12px', color: '#f87171', fontSize: '15px', fontWeight: '600',
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px', cursor: 'pointer',
                                                }}>
                                                    <Trash2 size={18} strokeWidth={2} />
                                                    Remover foto
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '71,85,105';
}
