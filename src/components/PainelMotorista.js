import React, { useState, useEffect, useCallback } from 'react';
import {
    Truck, AlertTriangle, LogOut, MapPin, RefreshCw,
    X, Camera, CheckCircle, WifiOff, Loader, ClipboardCheck
} from 'lucide-react';
import axios from 'axios';
import ChecklistCarreta from './ChecklistCarreta';

const api = axios.create();

// ── Status disponíveis ────────────────────────────────────────────────────────

const BOTOES_STATUS_MOTORISTA = [
    { status: 'EM VIAGEM', cor: '#38bdf8', bg: 'rgba(56,189,248,0.12)', borda: 'rgba(56,189,248,0.3)' },
    { status: 'RETORNANDO', cor: '#fbbf24', bg: 'rgba(251,191,36,0.12)', borda: 'rgba(251,191,36,0.3)' },
    { status: 'EM VIAGEM FRETE RETORNO', cor: '#818cf8', bg: 'rgba(129,140,248,0.12)', borda: 'rgba(129,140,248,0.3)' },
];

const BOTOES_STATUS_ADMIN = [
    { status: 'DISPONÍVEL', cor: '#4ade80', bg: 'rgba(74,222,128,0.12)', borda: 'rgba(74,222,128,0.3)' },
    { status: 'CARREGANDO', cor: '#f97316', bg: 'rgba(249,115,22,0.12)', borda: 'rgba(249,115,22,0.3)' },
    { status: 'EM VIAGEM', cor: '#38bdf8', bg: 'rgba(56,189,248,0.12)', borda: 'rgba(56,189,248,0.3)' },
    { status: 'EM VIAGEM FRETE RETORNO', cor: '#818cf8', bg: 'rgba(129,140,248,0.12)', borda: 'rgba(129,140,248,0.3)' },
    { status: 'RETORNANDO', cor: '#fbbf24', bg: 'rgba(251,191,36,0.12)', borda: 'rgba(251,191,36,0.3)' },
    { status: 'PUXADA', cor: '#a78bfa', bg: 'rgba(167,139,250,0.12)', borda: 'rgba(167,139,250,0.3)' },
    { status: 'TRANSFERENCIA', cor: '#22d3ee', bg: 'rgba(34,211,238,0.12)', borda: 'rgba(34,211,238,0.3)' },
    { status: 'MANUTENÇÃO', cor: '#f87171', bg: 'rgba(248,113,113,0.12)', borda: 'rgba(248,113,113,0.3)' },
];

// Retorna a cor associada a um status (para o badge de status atual)
const COR_STATUS = Object.fromEntries(
    [...BOTOES_STATUS_MOTORISTA, ...BOTOES_STATUS_ADMIN].map(b => [b.status, b.cor])
);

const TIPOS_OCORRENCIA = [
    'Pneu furado', 'Acidente', 'Pane mecânica', 'Pane elétrica',
    'Roubo / Assalto', 'Documentação', 'Sem sinal de GPS', 'Outro'
];

// ── Funções utilitárias ───────────────────────────────────────────────────────

function isFimDeSemana() {
    const d = new Date().getDay();
    return d === 0 || d === 6;
}

function nomeFimDeSemana() {
    return new Date().getDay() === 6 ? 'Sábado' : 'Domingo';
}

async function capturarGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve('GPS_INDISPONIVEL');
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)} `),
            () => resolve('GPS_INDISPONIVEL'),
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── Bloco de veículo (card único) ────────────────────────────────────────────

function VeiculoCard({ label, placa, modelo, cor, borderCor }) {
    return (
        <div style={{
            background: `rgba(${cor}, 0.07)`, border: `1px solid rgba(${cor}, 0.25)`,
            borderRadius: '12px', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <Truck size={13} color={`rgba(${cor}, 1)`} />
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
            </div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: `rgba(${cor}, 1)`, fontFamily: 'monospace', letterSpacing: '1px' }}>
                {placa || '—'}
            </div>
            {modelo && <div style={{ fontSize: '11px', color: '#475569', marginTop: '1px' }}>{modelo}</div>}
        </div>
    );
}

// ── Modal de Ocorrência ───────────────────────────────────────────────────────

function ModalOcorrencia({ motorista, onClose, onSucesso }) {
    const [tipo, setTipo] = useState(TIPOS_OCORRENCIA[0]);
    const [descricao, setDescricao] = useState('');
    const [fotoFile, setFotoFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const handleFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFotoFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const enviar = async () => {
        setErro('');
        setLoading(true);
        try {
            let foto_base64 = null;
            if (fotoFile) foto_base64 = await fileToBase64(fotoFile);
            await api.post('/api/frota/ocorrencias', {
                motorista_id: motorista.id,
                tipo,
                descricao: descricao.trim() || null,
                foto_base64,
            });
            onSucesso(`Ocorrência "${tipo}" registrada com sucesso.`);
            onClose();
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao enviar ocorrência.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
        }}>
            <div style={{
                background: '#0f172a', borderRadius: '20px 20px 0 0',
                border: '1px solid rgba(255,255,255,0.1)', padding: '24px 20px',
                maxHeight: '90svh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={20} color="#f87171" />
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#f87171' }}>Informar Problema</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Tipo de Problema</label>
                    <select value={tipo} onChange={e => setTipo(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '15px', outline: 'none' }}>
                        {TIPOS_OCORRENCIA.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Descrição (opcional)</label>
                    <textarea
                        value={descricao}
                        onChange={e => setDescricao(e.target.value)}
                        rows={3}
                        placeholder="Descreva o problema com detalhes..."
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', resize: 'none' }}
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Foto (opcional)</label>
                    <label style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        padding: '14px', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#94a3b8',
                        fontSize: '14px', fontWeight: '600'
                    }}>
                        <Camera size={18} />
                        {fotoFile ? fotoFile.name : 'Tirar Foto / Escolher Arquivo'}
                        <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }} />
                    </label>
                    {preview && (
                        <div style={{ marginTop: '10px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                        </div>
                    )}
                </div>

                {erro && (
                    <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px' }}>
                        {erro}
                    </div>
                )}

                <button onClick={enviar} disabled={loading}
                    style={{
                        width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                        background: loading ? 'rgba(248,113,113,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white', fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(239,68,68,0.4)'
                    }}>
                    {loading ? <><Loader size={18} className="spin" /> Enviando...</> : <><AlertTriangle size={18} /> Enviar Ocorrência</>}
                </button>
            </div>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PainelMotorista({ motorista, onLogout }) {
    const [viagem, setViagem] = useState(null);
    const [loadingViagem, setLoadingViagem] = useState(true);
    const [statusAtual, setStatusAtual] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(null);
    const [msgSucesso, setMsgSucesso] = useState('');
    const [msgErro, setMsgErro] = useState('');
    const [modalOcorrencia, setModalOcorrencia] = useState(false);
    const [modalChecklist, setModalChecklist] = useState(false);
    const [gpsAtual, setGpsAtual] = useState(null);

    const bloqueado = isFimDeSemana() && !motorista.modo_plantao;

    const carregarViagem = useCallback(async () => {
        try {
            const { data } = await api.get(`/ api / frota / minha - viagem / ${motorista.id} `);
            setViagem(data.viagem);
            setStatusAtual(data.viagem.status_atual);
        } catch {
            setViagem(null);
        } finally {
            setLoadingViagem(false);
        }
    }, [motorista.id]);

    useEffect(() => {
        carregarViagem();
        capturarGPS().then(ll => setGpsAtual(ll));
    }, [carregarViagem]);

    const atualizarStatus = async (novoStatus) => {
        if (bloqueado || loadingStatus) return;
        setLoadingStatus(novoStatus);
        setMsgErro('');
        try {
            const latLng = await capturarGPS();
            const gpsOk = latLng !== 'GPS_INDISPONIVEL';
            if (gpsOk) setGpsAtual(latLng);
            const { data } = await api.put('/api/frota/status', {
                motorista_id: motorista.id,
                novo_status: novoStatus,
                ultima_lat_lng: gpsOk ? latLng : null,
            });
            setStatusAtual(data.status);
            setMsgSucesso(`Status: ${data.status}${!gpsOk ? ' (GPS indisponível)' : ''} `);
            setTimeout(() => setMsgSucesso(''), 3000);
        } catch (err) {
            setMsgErro(err.response?.data?.message || 'Erro ao atualizar status.');
        } finally {
            setLoadingStatus(null);
        }
    };

    // Veículo é conjunto se tiver carreta vinculada
    const ehConjunto = !!viagem?.carreta_placa;

    return (
        <div style={{
            minHeight: '100svh', background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #1e293b 100%)',
            color: '#f1f5f9', padding: '0', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif'
        }}>

            {/* ── Header ── */}
            <div style={{
                background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Truck size={20} color="#38bdf8" />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1 }}>{motorista.nome}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Portal do Motorista</div>
                    </div>
                </div>
                <button onClick={onLogout}
                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                    <LogOut size={14} /> Sair
                </button>
            </div>

            <div style={{ padding: '16px', maxWidth: '520px', margin: '0 auto' }}>

                {/* ── Banner fim de semana bloqueado ── */}
                {bloqueado && (
                    <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '14px' }}>Sistema bloqueado aos fins de semana.</div>
                            <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                                Hoje é {nomeFimDeSemana()}. Contacte o coordenador para ativar o modo de Plantão.
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Card do conjunto / veículo ── */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                    {loadingViagem ? (
                        <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Loader size={14} /> Carregando conjunto...
                        </div>
                    ) : viagem ? (
                        <>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                                {ehConjunto ? 'Seu Conjunto' : 'Seu Veículo'}
                            </div>

                            {ehConjunto ? (
                                /* Conjunto: cavalo + carreta lado a lado */
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <VeiculoCard
                                        label="Cavalo"
                                        placa={viagem.cavalo_placa}
                                        modelo={viagem.cavalo_modelo}
                                        cor="56,189,248"
                                    />
                                    <VeiculoCard
                                        label="Carreta"
                                        placa={viagem.carreta_placa}
                                        modelo={viagem.carreta_tipo}
                                        cor="251,191,36"
                                    />
                                </div>
                            ) : (
                                /* Veículo único: centralizado, maior */
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div style={{
                                        background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.25)',
                                        borderRadius: '12px', padding: '16px 24px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                        minWidth: '160px'
                                    }}>
                                        <Truck size={28} color="#38bdf8" />
                                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                            {viagem.cavalo_placa || '—'}
                                        </div>
                                        {viagem.cavalo_modelo && (
                                            <div style={{ fontSize: '12px', color: '#475569' }}>{viagem.cavalo_modelo}</div>
                                        )}
                                        {viagem.cavalo_tipo && (
                                            <div style={{ fontSize: '11px', color: '#334155', background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                                                {viagem.cavalo_tipo}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '16px', color: '#475569', fontSize: '13px' }}>
                            Nenhum conjunto vinculado.<br />
                            <span style={{ fontSize: '11px' }}>Aguarde o despacho do coordenador.</span>
                        </div>
                    )}
                </div>

                {/* ── Status atual ── */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Status Atual</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: COR_STATUS[statusAtual] || '#94a3b8' }}>
                            {statusAtual || '—'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {gpsAtual && gpsAtual !== 'GPS_INDISPONIVEL' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4ade80' }}>
                                <MapPin size={11} /> GPS
                            </div>
                        )}
                        <button onClick={carregarViagem} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Atualizar">
                            <RefreshCw size={15} />
                        </button>
                    </div>
                </div>

                {/* ── Feedbacks ── */}
                {msgSucesso && (
                    <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={14} /> {msgSucesso}
                    </div>
                )}
                {msgErro && (
                    <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px' }}>
                        <WifiOff size={13} style={{ display: 'inline', marginRight: '6px' }} />{msgErro}
                    </div>
                )}

                {/* ── Atualizar Status (restrito para motorista) ── */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        Atualizar Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {BOTOES_STATUS_MOTORISTA.map(({ status, cor, bg, borda }) => {
                            const isAtivo = statusAtual === status;
                            const isLoading = loadingStatus === status;
                            return (
                                <button key={status} onClick={() => atualizarStatus(status)}
                                    disabled={bloqueado || !!loadingStatus}
                                    style={{
                                        padding: '16px 12px', borderRadius: '12px',
                                        border: `2px solid ${isAtivo ? cor : borda} `,
                                        background: isAtivo ? bg.replace('0.12', '0.22') : bg,
                                        color: bloqueado ? '#475569' : cor,
                                        cursor: bloqueado || loadingStatus ? 'not-allowed' : 'pointer',
                                        fontSize: '13px', fontWeight: '700', lineHeight: '1.3',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        transition: 'all 0.15s',
                                        boxShadow: isAtivo ? `0 0 12px ${cor} 40` : 'none',
                                        opacity: bloqueado ? 0.4 : 1,
                                        textAlign: 'center'
                                    }}>
                                    {isLoading && <Loader size={12} />}
                                    {status}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Botão de checklist ── */}
                {viagem?.carreta_placa && (
                    <button
                        onClick={() => setModalChecklist(true)}
                        disabled={bloqueado}
                        style={{
                            width: '100%', padding: '18px', borderRadius: '14px', border: '2px solid rgba(56,189,248,0.4)',
                            background: 'rgba(56,189,248,0.08)', color: '#38bdf8',
                            fontSize: '16px', fontWeight: '700', cursor: bloqueado ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            marginBottom: '12px', opacity: bloqueado ? 0.4 : 1,
                        }}>
                        <ClipboardCheck size={20} />
                        Checklist da Carreta
                    </button>
                )}

                {/* ── Botão de ocorrência ── */}
                <button
                    onClick={() => setModalOcorrencia(true)}
                    style={{
                        width: '100%', padding: '18px', borderRadius: '14px', border: '2px solid rgba(248,113,113,0.4)',
                        background: 'rgba(248,113,113,0.1)', color: '#f87171',
                        fontSize: '16px', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        marginBottom: '24px'
                    }}>
                    <AlertTriangle size={20} />
                    Informar Problema
                </button>

            </div>

            {/* ── Modal de ocorrência ── */}
            {modalOcorrencia && (
                <ModalOcorrencia
                    motorista={motorista}
                    onClose={() => setModalOcorrencia(false)}
                    onSucesso={(msg) => { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 4000); }}
                />
            )}

            {/* ── Modal de checklist ── */}
            {modalChecklist && (
                <ChecklistCarreta
                    motorista={motorista}
                    placaCarreta={viagem?.carreta_placa}
                    onClose={() => setModalChecklist(false)}
                    onSucesso={(msg) => { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 4000); }}
                />
            )}
        </div>
    );
}
