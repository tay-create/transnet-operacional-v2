import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Save, Loader, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../services/apiService';

export default function ModalOcorrencia({ onClose, veiculo }) {
    const [descricao, setDescricao] = useState('');
    const [fotoBase64, setFotoBase64] = useState(null);
    const [ocorrencias, setOcorrencias] = useState([]);
    const [carregandoListagem, setCarregandoListagem] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleUploadClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setFotoBase64(reader.result);
        reader.readAsDataURL(file);
    };

    const salvarOcorrencia = async () => {
        if (!descricao.trim()) return;
        setSalvando(true);
        try {
            const res = await api.post(`/api/veiculos/${veiculo.id}/ocorrencias`, {
                descricao,
                foto_base64: fotoBase64 || null,
                motorista: veiculo.motorista || 'A Confirmar'
            });
            if (res.data.success) {
                onClose();
            } else {
                alert('Falha ao salvar: ' + res.data.message);
            }
        } catch (e) {
            console.error('Erro ao salvar ocorrência:', e);
            alert('Erro ao salvar ocorrência.');
        } finally {
            setSalvando(false);
        }
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
                                    {ocorrencias.map(o => (
                                        <div key={o.id} style={{
                                            background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)',
                                            borderRadius: '10px', padding: '12px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#94a3b8' }}>
                                                <span style={{ fontWeight: '700', color: '#fbbf24' }}>{o.motorista}</span>
                                                <span>{new Date(o.data_criacao + 'Z').toLocaleString('pt-BR')}</span>
                                            </div>
                                            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{o.descricao}</p>
                                            {o.foto_base64 && (
                                                <a href={o.foto_base64} target="_blank" rel="noopener noreferrer">
                                                    <img src={o.foto_base64} alt="Evidência" style={{
                                                        maxHeight: '120px', borderRadius: '8px',
                                                        border: '1px solid rgba(255,255,255,0.1)', display: 'block'
                                                    }} />
                                                </a>
                                            )}
                                        </div>
                                    ))}
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

                            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Evidência (Opcional)
                            </label>
                            <div
                                onClick={handleUploadClick}
                                style={{
                                    border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '16px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.2s', minHeight: '80px'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleImageUpload}
                                />
                                {fotoBase64 ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={fotoBase64} alt="Evidência" style={{ maxHeight: '140px', borderRadius: '8px', display: 'block' }} />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFotoBase64(null); }}
                                            style={{
                                                position: 'absolute', top: -10, right: -10,
                                                background: '#ef4444', border: 'none', color: 'white',
                                                borderRadius: '50%', width: 26, height: 26,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                            }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Camera size={26} color="#475569" />
                                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Tirar foto ou enviar imagem</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', justifyContent: 'flex-end', gap: '10px',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '0 0 16px 16px'
                }}>
                    <button
                        onClick={onClose}
                        disabled={salvando}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.3)',
                            background: 'rgba(248,113,113,0.08)', color: '#f87171',
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                        }}
                    >
                        <X size={15} /> Cancelar
                    </button>
                    <button
                        onClick={salvarOcorrencia}
                        disabled={salvando || !descricao.trim()}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: salvando || !descricao.trim()
                                ? 'rgba(251,191,36,0.15)'
                                : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                            color: salvando || !descricao.trim() ? '#78716c' : '#1c1917',
                            fontSize: '13px', fontWeight: '700',
                            cursor: salvando || !descricao.trim() ? 'not-allowed' : 'pointer',
                            boxShadow: salvando || !descricao.trim() ? 'none' : '0 4px 14px rgba(251,191,36,0.3)'
                        }}
                    >
                        {salvando ? <><Loader className="spin" size={15} /> Salvando...</> : <><Save size={15} /> Registrar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
