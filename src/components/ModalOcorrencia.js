import React, { useState, useEffect } from 'react';
import { Camera, X, Save, Loader, AlertTriangle, Trash2, Image as ImageIcon, Video as VideoIcon, Play } from 'lucide-react';
import api from '../services/apiService';

export default function ModalOcorrencia({ onClose, veiculo }) {
    const [descricao, setDescricao] = useState('');
    const [midias, setMidias] = useState([]); // [{ tipo: 'foto'|'video', data: base64, thumb?: base64 }]
    const [ocorrencias, setOcorrencias] = useState([]);
    const [carregandoListagem, setCarregandoListagem] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erroSalvar, setErroSalvar] = useState('');

    useEffect(() => {
        if (!veiculo?.id) return;
        setCarregandoListagem(true);
        api.get(`/api/veiculos/${veiculo.id}/ocorrencias`)
            .then(res => {
                if (res.data.success) setOcorrencias(res.data.ocorrencias || []);
            })
            .catch(err => console.error('Erro ao buscar ocorrências:', err))
            .finally(() => setCarregandoListagem(false));
    }, [veiculo?.id]);

    const comprimirImagem = (file) => new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1000;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = url;
    });

    const gerarThumbVideo = (file) => new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        video.currentTime = 0.5;
        video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 180;
            canvas.getContext('2d').drawImage(video, 0, 0, 320, 180);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    });

    const handleAdicionarFoto = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novas = await Promise.all(files.map(async (f) => ({
            tipo: 'foto',
            data: await comprimirImagem(f)
        })));
        setMidias(prev => [...prev, ...novas]);
        e.target.value = '';
    };

    const handleAdicionarVideo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const MAX_MB = 50;
        if (file.size > MAX_MB * 1024 * 1024) {
            alert(`Vídeo muito grande. Máximo ${MAX_MB}MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
            const thumb = await gerarThumbVideo(file);
            setMidias(prev => [...prev, { tipo: 'video', data: reader.result, thumb }]);
        };
        reader.readAsDataURL(file);
    };

    const removerMidia = (idx) => setMidias(prev => prev.filter((_, i) => i !== idx));

    const salvarOcorrencia = async () => {
        if (!descricao.trim()) return;
        setSalvando(true);
        try {
            setErroSalvar('');
            const payload = {
                descricao,
                motorista: veiculo.motorista || 'A Confirmar',
                midias_json: midias.length > 0 ? midias : undefined,
                // compatibilidade legado: primeira foto como foto_base64
                foto_base64: midias.find(m => m.tipo === 'foto')?.data || null,
            };
            const res = await api.post(`/api/veiculos/${veiculo.id}/ocorrencias`, payload);
            if (res.data.success) {
                onClose();
            } else {
                setErroSalvar(res.data.message || 'Falha ao salvar.');
            }
        } catch (e) {
            console.error('Erro ao salvar ocorrência:', e);
            const msg = e?.response?.data?.message || e?.message || 'Erro desconhecido';
            setErroSalvar(`Erro ao salvar: ${msg}`);
        } finally {
            setSalvando(false);
        }
    };

    const getMidiasOcorrencia = (o) => {
        if (o.midias_json) {
            try { return JSON.parse(o.midias_json); } catch (_) {}
        }
        if (o.foto_base64) return [{ tipo: 'foto', data: o.foto_base64 }];
        return [];
    };

    const btnMidia = {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: '14px 10px', border: '2px dashed rgba(255,255,255,0.12)',
        borderRadius: '10px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer',
        color: '#64748b', fontSize: '11px', fontWeight: '600'
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
        }}>
            <div style={{
                background: 'linear-gradient(160deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', width: '100%', maxWidth: '500px',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                color: '#f1f5f9', fontFamily: 'system-ui, sans-serif'
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'sticky', top: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '16px 16px 0 0', zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={20} color="#fbbf24" />
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', lineHeight: 1 }}>Ocorrências da Operação</div>
                            {veiculo?.motorista && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{veiculo.motorista}</div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Registros anteriores */}
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Registros Anteriores
                        </span>
                        <div style={{ marginTop: '10px' }}>
                            {carregandoListagem ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                                    <Loader className="spin" size={20} color="#94a3b8" />
                                </div>
                            ) : ocorrencias.length === 0 ? (
                                <div style={{
                                    padding: '14px', textAlign: 'center', fontSize: '12px', color: '#475569',
                                    background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    Nenhuma ocorrência registrada.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {ocorrencias.map(o => {
                                        const mds = getMidiasOcorrencia(o);
                                        return (
                                            <div key={o.id} style={{
                                                background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)',
                                                borderRadius: '10px', padding: '12px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#94a3b8' }}>
                                                    <span style={{ fontWeight: '700', color: '#fbbf24' }}>{o.motorista}</span>
                                                    <span>{o.data_criacao ? new Date(o.data_criacao).toLocaleString('pt-BR') : '—'}</span>
                                                </div>
                                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{o.descricao}</p>
                                                {mds.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {mds.map((m, i) => (
                                                            m.tipo === 'video' ? (
                                                                <a key={i} href={m.data} target="_blank" rel="noopener noreferrer"
                                                                    style={{ position: 'relative', display: 'inline-block' }}>
                                                                    {m.thumb
                                                                        ? <img src={m.thumb} alt="Vídeo" style={{ height: '80px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                                        : <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><VideoIcon size={24} color="#94a3b8" /></div>
                                                                    }
                                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Play size={20} color="white" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }} />
                                                                    </div>
                                                                </a>
                                                            ) : (
                                                                <a key={i} href={m.data} target="_blank" rel="noopener noreferrer">
                                                                    <img src={m.data} alt={`Evidência ${i + 1}`} style={{ height: '80px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                                </a>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

                    {/* Nova ocorrência */}
                    <div>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Nova Ocorrência
                        </span>

                        <div style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Descrição do Problema
                            </label>
                            <textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                style={{
                                    width: '100%', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9',
                                    fontSize: '13px', outline: 'none', fontFamily: 'system-ui, sans-serif',
                                    marginBottom: '12px'
                                }}
                                placeholder="Descreva o que aconteceu..."
                                autoFocus
                            />

                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                                Evidências (Opcional)
                            </label>

                            {/* inputs de arquivo — label htmlFor garante funcionamento no Android */}
                            <input id="oc-camera" type="file" style={{ display: 'none' }} accept="image/*" capture="environment" multiple onChange={handleAdicionarFoto} />
                            <input id="oc-galeria" type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleAdicionarFoto} />
                            <input id="oc-gravar" type="file" style={{ display: 'none' }} accept="video/*" capture="environment" onChange={handleAdicionarVideo} />
                            <input id="oc-videogaleria" type="file" style={{ display: 'none' }} accept="video/*" multiple onChange={handleAdicionarVideo} />

                            {/* botões de adicionar */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: midias.length ? '12px' : '0' }}>
                                <label htmlFor="oc-camera" style={btnMidia}>
                                    <Camera size={20} color="#475569" />
                                    Câmera
                                </label>
                                <label htmlFor="oc-galeria" style={btnMidia}>
                                    <ImageIcon size={20} color="#475569" />
                                    Fotos
                                </label>
                                <label htmlFor="oc-gravar" style={btnMidia}>
                                    <VideoIcon size={20} color="#475569" />
                                    Gravar
                                </label>
                                <label htmlFor="oc-videogaleria" style={btnMidia}>
                                    <Play size={20} color="#475569" />
                                    Vídeo
                                </label>
                            </div>

                            {/* preview das mídias adicionadas */}
                            {midias.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {midias.map((m, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            {m.tipo === 'video' ? (
                                                <div style={{ width: '90px', height: '90px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {m.thumb
                                                        ? <img src={m.thumb} alt="Vídeo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <VideoIcon size={28} color="#94a3b8" />
                                                    }
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Play size={18} color="white" style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <img src={m.data} alt={`Foto ${i + 1}`} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} />
                                            )}
                                            <button onClick={() => removerMidia(i)} style={{
                                                position: 'absolute', top: -8, right: -8,
                                                background: '#ef4444', border: 'none', color: 'white',
                                                borderRadius: '50%', width: 24, height: 24,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                            }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '0 0 16px 16px'
                }}>
                    {erroSalvar && (
                        <div style={{
                            padding: '8px 12px', borderRadius: '8px',
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', fontSize: '12px'
                        }}>
                            {erroSalvar}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button onClick={onClose} disabled={salvando} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.3)',
                            background: 'rgba(248,113,113,0.08)', color: '#f87171',
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                        }}>
                            <X size={15} /> Cancelar
                        </button>
                        <button onClick={salvarOcorrencia} disabled={salvando || !descricao.trim()} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: salvando || !descricao.trim() ? 'rgba(251,191,36,0.15)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                            color: salvando || !descricao.trim() ? '#78716c' : '#1c1917',
                            fontSize: '13px', fontWeight: '700',
                            cursor: salvando || !descricao.trim() ? 'not-allowed' : 'pointer',
                            boxShadow: salvando || !descricao.trim() ? 'none' : '0 4px 14px rgba(251,191,36,0.3)'
                        }}>
                            {salvando ? <><Loader className="spin" size={15} /> Salvando...</> : <><Save size={15} /> Registrar</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
