import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Save, Loader, AlertTriangle } from 'lucide-react';
import api from '../services/apiService';
import { converterImagemParaBase64 } from '../utils/helpers';

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
                if (res.data.success) {
                    setOcorrencias(res.data.ocorrencias || []);
                }
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

        converterImagemParaBase64(file, (base64) => {
            setFotoBase64(base64);
        });
    };

    const salvarOcorrencia = async () => {
        if (!descricao.trim()) {
            alert('A descrição é obrigatória.');
            return;
        }

        setSalvando(true);
        try {
            const body = {
                descricao,
                foto_base64: fotoBase64,
                motorista: veiculo.motorista || 'A Confirmar'
            };

            const res = await api.post(`/api/veiculos/${veiculo.id}/ocorrencias`, body);

            if (res.data.success) {
                alert('Ocorrência registrada com sucesso!');
                onClose();
            } else {
                alert('Falha ao salvar ocorrência: ' + res.data.message);
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
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
        }}>
            <div className="glass-panel" style={{
                background: '#0f172a', border: '1px solid #334155', borderRadius: '16px',
                width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={20} color="#fbbf24" />
                        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>
                            Ocorrências da Operação
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* View Ocorrencias Anteriores */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#cbd5e1' }}>Registros Anteriores</h4>
                        {carregandoListagem ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}><Loader className="spin" size={20} color="#94a3b8" /></div>
                        ) : ocorrencias.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                Nenhuma ocorrência registrada.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {ocorrencias.map(o => (
                                    <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#94a3b8' }}>
                                            <span style={{ fontWeight: 'bold' }}>{o.motorista}</span>
                                            <span>{new Date(o.data_criacao + 'Z').toLocaleString('pt-BR')}</span>
                                        </div>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>{o.descricao}</p>
                                        {o.foto_base64 && (
                                            <a href={o.foto_base64} target="_blank" rel="noopener noreferrer" style={{ display: 'block', maxWidth: '100px', cursor: 'pointer' }}>
                                                <img src={o.foto_base64} alt="Ocorrência" style={{ width: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', background: '#334155' }} />

                    {/* Nova Ocorrencia */}
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#fbbf24' }}>Nova Ocorrência</h4>

                        <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Descrição do Problema</label>
                        <textarea
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            className="input-internal"
                            style={{ width: '100%', minHeight: '80px', marginBottom: '12px', resize: 'vertical' }}
                            placeholder="Descreva o que aconteceu..."
                            autoFocus
                        />

                        <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Evidência (Opcional)</label>
                        <div
                            onClick={handleUploadClick}
                            style={{
                                border: '1px dashed #475569', borderRadius: '8px', padding: '16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            {fotoBase64 ? (
                                <div style={{ position: 'relative' }}>
                                    <img src={fotoBase64} alt="Evidência" style={{ maxHeight: '120px', borderRadius: '8px' }} />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setFotoBase64(null); }}
                                        style={{ position: 'absolute', top: -10, right: -10, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Camera size={28} color="#94a3b8" />
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Tirar foto ou enviar imagem</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={onClose}
                        disabled={salvando}
                        className="btn-danger"
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={salvarOcorrencia}
                        disabled={salvando || !descricao.trim()}
                        className="btn-success"
                        style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {salvando ? <Loader className="spin" size={14} /> : <Save size={14} />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

