import React, { useState, useRef } from 'react';
import {
    Camera, PenTool, Trash2, CheckCircle, AlertTriangle,
    ClipboardCheck, X, Loader
} from 'lucide-react';
import api from '../services/apiService';

export default function ChecklistCarreta({ motorista, placaCarreta, onClose, onSucesso }) {
    /* ESTADOS DO FORMULÁRIO */
    const [placaConfere, setPlacaConfere] = useState(null);
    const [condicaoBau, setCondicaoBau] = useState('');
    const [condicaoOutra, setCondicaoOutra] = useState('');
    const [temCordas, setTemCordas] = useState(false);
    const [qtdCordas, setQtdCordas] = useState('');
    const [temVazamento, setTemVazamento] = useState(false);
    const [fotoVazamento, setFotoVazamento] = useState(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    /* REFERÊNCIAS E ESTADOS DA ASSINATURA (CANVAS) */
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [assinaturaSalva, setAssinaturaSalva] = useState(null);

    /* LÓGICA DE CAPTURA DE FOTO */
    const handleCapturePhoto = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFotoVazamento(reader.result);
            reader.readAsDataURL(file);
        }
    };

    /* LÓGICA DA ASSINATURA DIGITAL (CANVAS) */
    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setAssinaturaSalva(null);
    };

    const saveSignature = () => {
        setAssinaturaSalva(canvasRef.current.toDataURL('image/png'));
    };

    /* SUBMISSÃO */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');

        if (placaConfere === null) {
            setErro('Informe se a placa confere.');
            return;
        }
        if (!assinaturaSalva) {
            setErro('A assinatura é obrigatória.');
            return;
        }
        if (temVazamento && !fotoVazamento) {
            setErro('Foto da avaria é obrigatória quando há vazamento/furo.');
            return;
        }

        const payload = {
            motorista_id: motorista?.id,
            motorista_nome: motorista?.nome,
            placa_carreta: placaCarreta,
            placa_confere: placaConfere,
            condicao_bau: condicaoBau === 'Outro' ? condicaoOutra : condicaoBau,
            cordas: temCordas ? parseInt(qtdCordas) : 0,
            foto_vazamento: temVazamento ? fotoVazamento : null,
            assinatura: assinaturaSalva,
        };

        setLoading(true);
        try {
            await api.post('/api/frota/checklist', payload);
            if (onSucesso) onSucesso('Checklist enviado com sucesso!');
            if (onClose) onClose();
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao enviar checklist. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    /* ESTILOS BASE */
    const card = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '14px',
    };

    const label = {
        fontSize: '10px', fontWeight: '700', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'block',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #1e293b 100%)',
            zIndex: 9999, overflowY: 'auto', color: '#f1f5f9',
            fontFamily: 'system-ui, sans-serif',
        }}>

            {/* HEADER */}
            <div style={{
                background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardCheck size={20} color="#38bdf8" />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', lineHeight: 1 }}>Checklist do Veículo</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Preenchimento Obrigatório</div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={22} />
                    </button>
                )}
            </div>

            <div style={{ padding: '16px', maxWidth: '520px', margin: '0 auto', paddingBottom: '32px' }}>

                {/* SEÇÃO 1: IDENTIFICAÇÃO */}
                <div style={card}>
                    <span style={label}>1. Identificação da Carreta</span>
                    <div style={{
                        background: 'rgba(56,189,248,0.08)', border: '1px dashed rgba(56,189,248,0.3)',
                        borderRadius: '10px', padding: '14px', textAlign: 'center', marginBottom: '14px',
                    }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Placa atrelada à viagem</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '2px' }}>
                            {placaCarreta || '—'}
                        </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>A placa física confere com a informada acima?</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setPlacaConfere(true)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                                background: placaConfere === true ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)',
                                color: placaConfere === true ? '#4ade80' : '#64748b',
                                border: `1px solid ${placaConfere === true ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            SIM
                        </button>
                        <button type="button" onClick={() => setPlacaConfere(false)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                                background: placaConfere === false ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                                color: placaConfere === false ? '#f87171' : '#64748b',
                                border: `1px solid ${placaConfere === false ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            NÃO
                        </button>
                    </div>
                </div>

                {/* SEÇÃO 2: CONDIÇÃO DO BAÚ */}
                <div style={card}>
                    <span style={label}>2. Condição do Baú</span>
                    <select
                        value={condicaoBau}
                        onChange={(e) => setCondicaoBau(e.target.value)}
                        required
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9',
                            fontSize: '14px', outline: 'none',
                        }}>
                        <option value="" disabled style={{ background: '#0f172a' }}>Selecione a condição...</option>
                        <option value="Limpo e Intacto" style={{ background: '#0f172a' }}>Limpo e Intacto</option>
                        <option value="Sujo (Necessita varrição)" style={{ background: '#0f172a' }}>Sujo (Necessita varrição)</option>
                        <option value="Avariado (Furos/Rasgos)" style={{ background: '#0f172a' }}>Avariado (Furos/Rasgos)</option>
                        <option value="Outro" style={{ background: '#0f172a' }}>Outro (Digitar)</option>
                    </select>
                    {condicaoBau === 'Outro' && (
                        <input
                            type="text"
                            placeholder="Descreva a condição..."
                            value={condicaoOutra}
                            onChange={(e) => setCondicaoOutra(e.target.value)}
                            required
                            style={{
                                width: '100%', boxSizing: 'border-box', marginTop: '10px',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none',
                            }}
                        />
                    )}
                </div>

                {/* SEÇÃO 3: ACESSÓRIOS (CORDAS) */}
                <div style={card}>
                    <span style={label}>3. Acessórios</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temCordas ? '12px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>O veículo possui cordas?</span>
                        <button type="button" onClick={() => setTemCordas(!temCordas)}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                background: temCordas ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', padding: '0 4px',
                                justifyContent: temCordas ? 'flex-end' : 'flex-start', transition: 'all 0.2s',
                            }}>
                            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                        </button>
                    </div>
                    {temCordas && (
                        <div>
                            <label style={{ ...label, marginBottom: '6px' }}>Quantidade de Cordas</label>
                            <input
                                type="number" min="1" placeholder="Ex: 10"
                                value={qtdCordas}
                                onChange={(e) => setQtdCordas(e.target.value)}
                                required
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none',
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* SEÇÃO 4: ESTRUTURA / VAZAMENTOS */}
                <div style={card}>
                    <span style={label}>4. Estrutura</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temVazamento ? '14px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Há vazamentos ou furos no teto?</span>
                        <button type="button" onClick={() => { setTemVazamento(!temVazamento); if (temVazamento) setFotoVazamento(null); }}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                background: temVazamento ? '#f87171' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', padding: '0 4px',
                                justifyContent: temVazamento ? 'flex-end' : 'flex-start', transition: 'all 0.2s',
                            }}>
                            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                        </button>
                    </div>
                    {temVazamento && (
                        <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>
                            <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} /> Registro fotográfico obrigatório.
                            </p>
                            {!fotoVazamento ? (
                                <label style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    height: '100px', border: '2px dashed rgba(248,113,113,0.4)', borderRadius: '10px',
                                    cursor: 'pointer', color: '#f87171', gap: '8px', fontSize: '13px', fontWeight: '600',
                                }}>
                                    <Camera size={22} />
                                    Tirar Foto da Avaria
                                    <input type="file" accept="image/*" capture="environment" onChange={handleCapturePhoto} style={{ display: 'none' }} />
                                </label>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <img src={fotoVazamento} alt="Avaria" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px' }} />
                                    <button type="button" onClick={() => setFotoVazamento(null)}
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* SEÇÃO 5: ASSINATURA */}
                <div style={card}>
                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <PenTool size={13} /> 5. Assinatura do Motorista
                    </span>
                    <p style={{ fontSize: '11px', color: '#475569', marginBottom: '12px' }}>
                        Declaro que as informações acima são verdadeiras:
                    </p>
                    {!assinaturaSalva ? (
                        <div>
                            <canvas
                                ref={canvasRef}
                                width={480}
                                height={140}
                                style={{
                                    width: '100%', height: '140px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px dashed rgba(56,189,248,0.3)',
                                    borderRadius: '10px', touchAction: 'none',
                                }}
                                onPointerDown={startDrawing}
                                onPointerMove={draw}
                                onPointerUp={stopDrawing}
                                onPointerLeave={stopDrawing}
                            />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={clearSignature}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                                    Limpar
                                </button>
                                <button type="button" onClick={saveSignature}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                                    Confirmar Assinatura
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle size={22} color="#4ade80" />
                            <img src={assinaturaSalva} alt="Assinatura" style={{ maxHeight: '70px', objectFit: 'contain', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '6px', border: '1px solid rgba(255,255,255,0.08)' }} />
                            <button type="button" onClick={clearSignature} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                Refazer assinatura
                            </button>
                        </div>
                    )}
                </div>

                {/* ERRO */}
                {erro && (
                    <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} /> {erro}
                    </div>
                )}

                {/* BOTÃO ENVIAR */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '18px', borderRadius: '14px', border: 'none',
                        background: loading ? 'rgba(56,189,248,0.2)' : 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                        color: 'white', fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(56,189,248,0.35)',
                    }}>
                    {loading ? <><Loader size={18} /> Enviando...</> : <><CheckCircle size={18} /> FINALIZAR CHECKLIST</>}
                </button>

            </div>
        </div>
    );
}
