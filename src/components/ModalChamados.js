import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Plus, ChevronLeft, MessageSquare, Clock, CheckCircle,
    Loader, AlertCircle, Image, Trash2, ChevronDown
} from 'lucide-react';
import api from '../services/apiService';

const STATUS_COR = {
    'Analisando':   { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)',  text: '#fbbf24' },
    'Em andamento': { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)',  text: '#60a5fa' },
    'Concluído':    { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80' },
};

const STATUS_ICONE = {
    'Analisando':   <Clock size={11} />,
    'Em andamento': <Loader size={11} />,
    'Concluído':    <CheckCircle size={11} />,
};

const STATUS_LISTA = ['Analisando', 'Em andamento', 'Concluído'];

const badgeStatus = (status) => {
    const cor = STATUS_COR[status] || STATUS_COR['Analisando'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text
        }}>
            {STATUS_ICONE[status]} {status}
        </span>
    );
};

const fmtData = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// ── Tela: Lista de chamados ───────────────────────────────────────────────────
function TelaChamados({ user, chamados, onNovo, onAbrir, carregando }) {
    const [filtroStatus, setFiltroStatus] = useState('Todos');

    const visíveis = filtroStatus === 'Todos'
        ? chamados
        : chamados.filter(c => c.status === filtroStatus);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={18} color="#60a5fa" />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Chamados</span>
                    <span style={{ fontSize: '12px', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '20px' }}>
                        {chamados.length}
                    </span>
                </div>
                <button
                    onClick={onNovo}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                        background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
                        color: '#60a5fa', fontSize: '12px', fontWeight: 700
                    }}
                >
                    <Plus size={14} /> Novo Chamado
                </button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {['Todos', ...STATUS_LISTA].map(s => (
                    <button key={s} onClick={() => setFiltroStatus(s)} style={{
                        padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        background: filtroStatus === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                        border: filtroStatus === s ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        color: filtroStatus === s ? '#60a5fa' : '#94a3b8'
                    }}>{s}</button>
                ))}
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando && <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Carregando...</div>}
                {!carregando && visíveis.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#475569', padding: '40px', fontSize: '13px' }}>
                        Nenhum chamado {filtroStatus !== 'Todos' ? `com status "${filtroStatus}"` : 'registrado'}.
                    </div>
                )}
                {visíveis.map(c => (
                    <div
                        key={c.id}
                        onClick={() => onAbrir(c)}
                        style={{
                            padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                            transition: 'border-color 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', wordBreak: 'break-word' }}>{c.titulo}</span>
                                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600,
                                        background: c.tipo === 'melhoria' ? 'rgba(168,85,247,0.15)' : 'rgba(251,146,60,0.15)',
                                        color: c.tipo === 'melhoria' ? '#c084fc' : '#fb923c',
                                        border: c.tipo === 'melhoria' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(251,146,60,0.3)'
                                    }}>{c.tipo === 'melhoria' ? 'Melhoria' : 'Ajuste'}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.descricao}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    {badgeStatus(c.status)}
                                    <span style={{ fontSize: '11px', color: '#475569' }}>por <strong style={{ color: '#94a3b8' }}>{c.autor_nome}</strong></span>
                                    <span style={{ fontSize: '11px', color: '#475569' }}>{fmtData(c.criado_em)}</span>
                                </div>
                            </div>
                            {Array.isArray(c.imagens) && c.imagens.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#475569', whiteSpace: 'nowrap' }}>
                                    <Image size={11} /> {c.imagens.length}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Tela: Novo chamado ────────────────────────────────────────────────────────
function TelaNewChamado({ user, onVoltar, onCriado }) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [tipo, setTipo] = useState('ajuste');
    const [imagens, setImagens] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const adicionarImagem = (e) => {
        const files = Array.from(e.target.files);
        if (imagens.length + files.length > 5) { setErro('Máximo de 5 imagens.'); return; }
        files.forEach(f => {
            const reader = new FileReader();
            reader.onloadend = () => setImagens(prev => [...prev, reader.result]);
            reader.readAsDataURL(f);
        });
        e.target.value = '';
    };

    const removerImagem = (idx) => setImagens(prev => prev.filter((_, i) => i !== idx));

    const salvar = async () => {
        setErro('');
        if (!titulo.trim()) { setErro('Título é obrigatório.'); return; }
        if (!descricao.trim()) { setErro('Descrição é obrigatória.'); return; }
        setSalvando(true);
        try {
            const res = await api.post('/api/chamados', { titulo, descricao, tipo, imagens });
            if (res.data.success) onCriado(res.data.chamado);
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao criar chamado.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Novo Chamado</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Solicitante */}
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: '#94a3b8' }}>
                    Enviando como <strong style={{ color: '#f1f5f9' }}>{user?.nome}</strong> — {user?.cargo}
                </div>

                {/* Tipo */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px', letterSpacing: '0.06em' }}>TIPO</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[['ajuste', 'Ajuste / Bug'], ['melhoria', 'Melhoria']].map(([val, label]) => (
                            <button key={val} onClick={() => setTipo(val)} style={{
                                flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                background: tipo === val
                                    ? (val === 'melhoria' ? 'rgba(168,85,247,0.2)' : 'rgba(251,146,60,0.2)')
                                    : 'rgba(255,255,255,0.04)',
                                border: tipo === val
                                    ? (val === 'melhoria' ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(251,146,60,0.5)')
                                    : '1px solid rgba(255,255,255,0.08)',
                                color: tipo === val
                                    ? (val === 'melhoria' ? '#c084fc' : '#fb923c')
                                    : '#64748b'
                            }}>{label}</button>
                        ))}
                    </div>
                </div>

                {/* Título */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px', letterSpacing: '0.06em' }}>TÍTULO</label>
                    <input
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        placeholder="Ex: Botão X não responde ao clicar"
                        maxLength={120}
                        style={{
                            width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
                            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)',
                            color: '#f1f5f9', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Descrição */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px', letterSpacing: '0.06em' }}>DESCRIÇÃO</label>
                    <textarea
                        value={descricao}
                        onChange={e => setDescricao(e.target.value)}
                        placeholder="Descreva o problema ou a melhoria com o máximo de detalhes possível..."
                        rows={5}
                        style={{
                            width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
                            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)',
                            color: '#f1f5f9', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Imagens */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px', letterSpacing: '0.06em' }}>
                        PRINTS / IMAGENS <span style={{ fontWeight: 400, color: '#475569' }}>(máx. 5)</span>
                    </label>
                    {imagens.length < 5 && (
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8',
                            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)'
                        }}>
                            <Image size={14} /> Adicionar imagem
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={adicionarImagem} />
                        </label>
                    )}
                    {imagens.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {imagens.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                    <img src={img} alt={`print ${idx + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                    <button
                                        onClick={() => removerImagem(idx)}
                                        style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {erro && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '12px' }}>
                        <AlertCircle size={13} /> {erro}
                    </div>
                )}
            </div>

            <button
                onClick={salvar}
                disabled={salvando}
                style={{
                    marginTop: '16px', padding: '11px', borderRadius: '8px', cursor: salvando ? 'default' : 'pointer',
                    background: salvando ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.2)',
                    border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '13px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
            >
                {salvando ? <><Loader size={14} /> Enviando...</> : <><MessageSquare size={14} /> Enviar Chamado</>}
            </button>
        </div>
    );
}

// ── Tela: Detalhe do chamado ──────────────────────────────────────────────────
function TelaDetalhe({ user, chamado, onVoltar, onStatusAtualizado }) {
    const [atualizando, setAtualizando] = useState(false);
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const [imagemAberta, setImagemAberta] = useState(null);
    const ehDev = user?.cargo === 'Desenvolvedor';

    const mudarStatus = async (novoStatus) => {
        setDropdownAberto(false);
        if (novoStatus === chamado.status) return;
        setAtualizando(true);
        try {
            const res = await api.patch(`/api/chamados/${chamado.id}/status`, { status: novoStatus });
            if (res.data.success) onStatusAtualizado(res.data.chamado);
        } catch (e) {
            console.error('Erro ao mudar status:', e);
        } finally {
            setAtualizando(false);
        }
    };

    const historico = Array.isArray(chamado.historico) ? chamado.historico : [];
    const imagens = Array.isArray(chamado.imagens) ? chamado.imagens : [];

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chamado.titulo}</span>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap',
                    background: chamado.tipo === 'melhoria' ? 'rgba(168,85,247,0.15)' : 'rgba(251,146,60,0.15)',
                    color: chamado.tipo === 'melhoria' ? '#c084fc' : '#fb923c',
                    border: chamado.tipo === 'melhoria' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(251,146,60,0.3)'
                }}>{chamado.tipo === 'melhoria' ? 'Melhoria' : 'Ajuste'}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        por <strong style={{ color: '#94a3b8' }}>{chamado.autor_nome}</strong> · {chamado.autor_cargo} · {fmtData(chamado.criado_em)}
                    </div>
                    {/* Status — só dev pode mudar */}
                    {ehDev ? (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setDropdownAberto(p => !p)}
                                disabled={atualizando}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                    background: STATUS_COR[chamado.status]?.bg, border: `1px solid ${STATUS_COR[chamado.status]?.border}`,
                                    color: STATUS_COR[chamado.status]?.text, fontSize: '11px', fontWeight: 700
                                }}
                            >
                                {STATUS_ICONE[chamado.status]} {chamado.status} <ChevronDown size={11} />
                            </button>
                            {dropdownAberto && (
                                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 10, borderRadius: '8px', overflow: 'hidden', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                    {STATUS_LISTA.map(s => (
                                        <button key={s} onClick={() => mudarStatus(s)} style={{
                                            display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '9px 14px',
                                            background: s === chamado.status ? 'rgba(255,255,255,0.06)' : 'none',
                                            border: 'none', cursor: 'pointer', color: STATUS_COR[s]?.text, fontSize: '12px', fontWeight: 600, textAlign: 'left'
                                        }}>
                                            {STATUS_ICONE[s]} {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        badgeStatus(chamado.status)
                    )}
                </div>

                {/* Descrição */}
                <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {chamado.descricao}
                </div>

                {/* Imagens */}
                {imagens.length > 0 && (
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '8px', letterSpacing: '0.06em' }}>PRINTS</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {imagens.map((img, idx) => (
                                <img
                                    key={idx} src={img} alt={`print ${idx + 1}`}
                                    onClick={() => setImagemAberta(img)}
                                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico */}
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '10px', letterSpacing: '0.06em' }}>HISTÓRICO</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {historico.map((h, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COR[h.status_novo]?.text || '#64748b', marginTop: '4px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        <strong>{h.autor_nome}</strong>
                                        {h.status_anterior
                                            ? <> alterou de <span style={{ color: STATUS_COR[h.status_anterior]?.text }}>{h.status_anterior}</span> para <span style={{ color: STATUS_COR[h.status_novo]?.text }}>{h.status_novo}</span></>
                                            : <> abriu o chamado com status <span style={{ color: STATUS_COR[h.status_novo]?.text }}>{h.status_novo}</span></>
                                        }
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{fmtData(h.criado_em)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Lightbox imagem */}
        {imagemAberta && (
            <div onClick={() => setImagemAberta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <img src={imagemAberta} alt="print" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '10px', objectFit: 'contain' }} />
                <button onClick={() => setImagemAberta(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                </button>
            </div>
        )}
        </>
    );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ModalChamados({ user, socket, onClose }) {
    const [chamados, setChamados] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [tela, setTela] = useState('lista'); // 'lista' | 'novo' | 'detalhe'
    const [chamadoAberto, setChamadoAberto] = useState(null);

    const carregar = useCallback(async () => {
        try {
            const res = await api.get('/api/chamados');
            if (res.data.success) setChamados(res.data.chamados);
        } catch (e) {
            console.error('Erro ao carregar chamados:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    // Socket — atualizações em tempo real
    useEffect(() => {
        if (!socket) return;
        const onNovo = (c) => setChamados(prev => [c, ...prev]);
        const onStatus = (c) => {
            setChamados(prev => prev.map(x => x.id === c.id ? c : x));
            setChamadoAberto(prev => prev?.id === c.id ? c : prev);
        };
        socket.on('chamado_novo', onNovo);
        socket.on('chamado_status', onStatus);
        return () => { socket.off('chamado_novo', onNovo); socket.off('chamado_status', onStatus); };
    }, [socket]);

    const handleCriado = (chamado) => {
        setChamados(prev => [chamado, ...prev]);
        setTela('lista');
    };

    const handleStatusAtualizado = (chamado) => {
        setChamados(prev => prev.map(c => c.id === chamado.id ? chamado : c));
        setChamadoAberto(chamado);
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={e => e.stopPropagation()} style={{
                width: '100%', maxWidth: '560px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)', padding: '24px', boxSizing: 'border-box'
            }}>
                {/* Botão fechar */}
                <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <X size={18} />
                </button>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {tela === 'lista' && (
                        <TelaChamados
                            user={user}
                            chamados={chamados}
                            carregando={carregando}
                            onNovo={() => setTela('novo')}
                            onAbrir={(c) => { setChamadoAberto(c); setTela('detalhe'); }}
                        />
                    )}
                    {tela === 'novo' && (
                        <TelaNewChamado
                            user={user}
                            onVoltar={() => setTela('lista')}
                            onCriado={handleCriado}
                        />
                    )}
                    {tela === 'detalhe' && chamadoAberto && (
                        <TelaDetalhe
                            user={user}
                            chamado={chamadoAberto}
                            onVoltar={() => { setChamadoAberto(null); setTela('lista'); }}
                            onStatusAtualizado={handleStatusAtualizado}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
