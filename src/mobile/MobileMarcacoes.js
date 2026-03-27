import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, RefreshCw, PauseCircle, Trash2, Link2, Car, Clock, MapPin, Map, CheckCircle, Plus, Lock } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';

// ── Funções utilitárias ──────────────────────────────────────────────────────

function parseDateLocal(str) {
    if (!str) return null;
    if (str.endsWith('Z') || str.includes('+')) return new Date(str);
    return new Date(str.replace(' ', 'T'));
}

function calcularTempoEspera(dataMarcacao, dataContratacao) {
    if (!dataMarcacao) return null;
    const inicio = parseDateLocal(dataMarcacao);
    const fim = dataContratacao ? parseDateLocal(dataContratacao) : new Date();
    if (!inicio || isNaN(inicio)) return null;
    return Math.max(0, Math.floor((fim - inicio) / 60000));
}

function formatarTempo(min) {
    if (min === null) return '—';
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    const d = Math.floor(h / 24), hr = h % 24;
    return hr > 0 ? `${d}d ${hr}h` : `${d}d`;
}

function corTempo(min) {
    if (min === null) return '#64748b';
    if (min < 60) return '#4ade80';
    if (min < 240) return '#fbbf24';
    return '#f87171';
}

function statusEfetivo(token) {
    if (token.status !== 'ativo') return token.status;
    if (token.data_expiracao && new Date() > new Date(token.data_expiracao)) return 'expirado';
    return 'ativo';
}

function corStatus(st) {
    if (st === 'ativo') return '#4ade80';
    if (st === 'utilizado') return '#fbbf24';
    if (st === 'expirado') return '#fb923c';
    return '#f87171'; // inativo/revogado
}

function labelStatus(st) {
    if (st === 'ativo') return 'Ativo';
    if (st === 'utilizado') return 'Utilizado';
    if (st === 'expirado') return 'Expirado';
    if (st === 'inativo') return 'Inativo';
    return st;
}

function formatarTelefone(tel) {
    if (!tel) return '—';
    let d = tel.replace(/\D/g, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return tel;
}

function formatarData(dt) {
    if (!dt) return '—';
    const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
    return d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '71,85,105';
}

// ── Bottom Sheet ─────────────────────────────────────────────────────────────
function BottomSheet({ titulo, onClose, children }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
            {/* backdrop clicável para fechar */}
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
            {/* sheet — position:absolute para não participar do flex e não capturar touches externos */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: '#0f172a', borderTop: '1px solid #334155',
                borderRadius: '20px 20px 0 0',
                padding: '12px 20px calc(20px + env(safe-area-inset-bottom))',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9' }}>{titulo}</span>
                    <button onClick={onClose} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#64748b', padding: '4px 10px', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
    if (!msg) return null;
    return (
        <div style={{
            position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))',
            left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
            padding: '10px 20px', color: '#4ade80', fontWeight: '600', fontSize: '13px',
            zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
            {msg}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MobileMarcacoes({ socket }) {
    const { temAcesso } = useAuthStore();
    if (!temAcesso('marcacao_placas')) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', minHeight: '60vh' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(71,85,105,0.12)', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <Lock size={24} color="#475569" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>Sem permissão</div>
                <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>Seu cargo não tem acesso à Marcação de Placas.</div>
            </div>
        );
    }
    return <MobileMarcacoesInner socket={socket} />;
}

function MobileMarcacoesInner({ socket }) {
    const [aba, setAba] = useState('links');
    const [tokens, setTokens] = useState([]);
    const [marcacoes, setMarcacoes] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [toast, setToast] = useState('');
    const [tick, setTick] = useState(0);

    // Sheets
    const [sheetNovoLink, setSheetNovoLink] = useState(false);
    const [sheetToken, setSheetToken] = useState(null);
    const [sheetMarcacao, setSheetMarcacao] = useState(null);

    // Form novo link
    const [novoTel, setNovoTel] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [gerando, setGerando] = useState(false);

    // Filtros marcações
    const [busca, setBusca] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroDisp, setFiltroDisp] = useState('');

    // Tick para cronômetros
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    const mostrarToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2800);
    };

    const vibrar = () => { try { navigator.vibrate?.(40); } catch {} };

    // ── Carregar tokens ────────────────────────────────────────────────────────
    const carregarTokens = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/api/tokens');
            if (r.data.success) setTokens(r.data.tokens);
        } catch { mostrarToast('Erro ao carregar links.'); }
        finally { setCarregando(false); }
    }, []);

    // ── Carregar marcações ─────────────────────────────────────────────────────
    const carregarMarcacoes = useCallback(async () => {
        setCarregando(true);
        try {
            const qp = new URLSearchParams({ page: 1, limit: 100 });
            if (busca.trim()) qp.set('busca', busca.trim());
            if (filtroEstado) qp.set('estado', filtroEstado);
            if (filtroDisp) qp.set('disponibilidade', filtroDisp);
            const r = await api.get(`/api/marcacoes?${qp}`);
            if (r.data.success) setMarcacoes((r.data.marcacoes || []).filter(m => !m.is_frota));
        } catch { mostrarToast('Erro ao carregar marcações.'); }
        finally { setCarregando(false); }
    }, [busca, filtroEstado, filtroDisp]);

    useEffect(() => {
        if (aba === 'links') carregarTokens();
        else carregarMarcacoes();
    }, [aba, carregarTokens, carregarMarcacoes]);

    // Debounce busca
    const buscaTimerRef = useRef(null);
    const handleBusca = (v) => {
        setBusca(v);
        clearTimeout(buscaTimerRef.current);
        buscaTimerRef.current = setTimeout(() => carregarMarcacoes(), 500);
    };

    // ── Gerar link ─────────────────────────────────────────────────────────────
    const gerarLink = async () => {
        if (!novoTel.trim()) { mostrarToast('Informe o telefone.'); return; }
        setGerando(true);
        try {
            const payload = { telefone: novoTel.trim() };
            if (novoNome.trim()) payload.nome_motorista = novoNome.trim();
            const r = await api.post('/api/tokens', payload);
            if (r.data.success) {
                vibrar();
                setNovoTel(''); setNovoNome('');
                setSheetNovoLink(false);
                mostrarToast('Link gerado com sucesso!');
                carregarTokens();
            } else {
                mostrarToast(r.data.message || 'Erro ao gerar link.');
            }
        } catch (e) { mostrarToast(e.response?.data?.message || 'Erro de conexão.'); }
        finally { setGerando(false); }
    };

    // ── Toggle status token ────────────────────────────────────────────────────
    const toggleToken = async (token) => {
        const efetivo = statusEfetivo(token);
        const novoSt = efetivo === 'ativo' ? 'inativo' : 'ativo';
        try {
            await api.put(`/api/tokens/${token.id}`, { status: novoSt });
            setTokens(prev => prev.map(t => t.id === token.id ? { ...t, status: novoSt } : t));
            setSheetToken(prev => prev ? { ...prev, status: novoSt } : null);
            vibrar();
            mostrarToast(novoSt === 'ativo' ? 'Link reativado.' : 'Link inativado.');
        } catch { mostrarToast('Erro ao atualizar.'); }
    };

    // ── Excluir token ──────────────────────────────────────────────────────────
    const excluirToken = async (id) => {
        try {
            await api.delete(`/api/tokens/${id}`);
            setTokens(prev => prev.filter(t => t.id !== id));
            setSheetToken(null);
            vibrar();
            mostrarToast('Link excluído.');
        } catch { mostrarToast('Erro ao excluir.'); }
    };

    // ── Excluir marcação ───────────────────────────────────────────────────────
    const excluirMarcacao = async (id) => {
        try {
            await api.delete(`/api/marcacoes/${id}`);
            setMarcacoes(prev => prev.filter(m => m.id !== id));
            setSheetMarcacao(null);
            vibrar();
            mostrarToast('Motorista removido.');
        } catch { mostrarToast('Erro ao remover.'); }
    };

    // ── Copiar link ────────────────────────────────────────────────────────────
    const copiarLink = async (token) => {
        const url = `${window.location.origin}/cadastro/${token.token}`;
        try {
            await navigator.clipboard.writeText(url);
            vibrar();
            mostrarToast('📋 Link copiado!');
        } catch {
            mostrarToast('Use o link: ' + url);
        }
    };

    const tokensFiltrados = tokens; // filtro server-side; exibir todos

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9' }}>Marcação de Placas</div>
                    {aba === 'links' && (
                        <button onClick={() => setSheetNovoLink(true)} style={{
                            background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                            border: 'none', borderRadius: '10px', color: '#fff',
                            fontWeight: '700', fontSize: '13px', padding: '7px 14px',
                            cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
                            WebkitTapHighlightColor: 'transparent',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} strokeWidth={2.5} /> Novo Link</span>
                        </button>
                    )}
                </div>

                {/* Abas */}
                <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
                    {[{ id: 'links', label: 'Links' }, { id: 'marcacoes', label: 'Marcações' }].map(a => (
                        <button key={a.id} onClick={() => setAba(a.id)} style={{
                            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: aba === a.id ? '2px solid #3b82f6' : '2px solid transparent',
                            color: aba === a.id ? '#3b82f6' : '#475569',
                            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}>
                            {a.label}
                        </button>
                    ))}
                </div>

                {/* Filtros marcações */}
                {aba === 'marcacoes' && (
                    <div style={{ padding: '10px 0', display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <input
                            type="text" placeholder="Buscar motorista..." value={busca}
                            onChange={e => handleBusca(e.target.value)}
                            style={{ flex: 1, minWidth: '140px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
                        />
                        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: filtroEstado ? '#f1f5f9' : '#475569', padding: '6px 8px', fontSize: '12px', flexShrink: 0 }}>
                            <option value="">Estado</option>
                            <option value="PE">PE</option>
                            <option value="BA">BA</option>
                            <option value="SE">SE</option>
                            <option value="AL">AL</option>
                            <option value="PB">PB</option>
                            <option value="RN">RN</option>
                        </select>
                        <select value={filtroDisp} onChange={e => setFiltroDisp(e.target.value)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: filtroDisp ? '#f1f5f9' : '#475569', padding: '6px 8px', fontSize: '12px', flexShrink: 0 }}>
                            <option value="">Localização</option>
                            <option value="NO PÁTIO">No Pátio</option>
                            <option value="NO POSTO">No Posto</option>
                            <option value="EM CASA">Em Casa</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : (
                    <>
                        {/* ABA: Links */}
                        {aba === 'links' && (
                            tokensFiltrados.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <Link2 size={32} color="#334155" strokeWidth={1.5} style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '13px' }}>Nenhum link gerado ainda.</div>
                                </div>
                            ) : tokensFiltrados.map(t => {
                                const ef = statusEfetivo(t);
                                const cor = corStatus(ef);
                                return (
                                    <button key={t.id} onClick={() => setSheetToken(t)} style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        background: '#0f172a', border: `1px solid #1e293b`,
                                        borderLeft: `3px solid ${cor}`, borderRadius: '12px',
                                        padding: '14px 16px', cursor: 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
                                    onTouchEnd={e => e.currentTarget.style.opacity = '1'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>
                                                {t.nome_motorista || formatarTelefone(t.telefone)}
                                            </span>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', color: cor,
                                                background: `rgba(${hexToRgb(cor)},0.1)`,
                                                border: `1px solid rgba(${hexToRgb(cor)},0.3)`,
                                                borderRadius: '6px', padding: '2px 7px',
                                            }}>
                                                {labelStatus(ef)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#475569' }}>
                                            {t.nome_motorista ? formatarTelefone(t.telefone) : ''}
                                            {t.data_expiracao && (
                                                <span style={{ marginLeft: t.nome_motorista ? '8px' : 0 }}>
                                                    {ef === 'expirado' ? '⏰ Expirou: ' : '⏳ Expira: '}
                                                    {formatarData(t.data_expiracao)}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}

                        {/* ABA: Marcações */}
                        {aba === 'marcacoes' && (
                            marcacoes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <Car size={32} color="#334155" strokeWidth={1.5} style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '13px' }}>Nenhuma marcação encontrada.</div>
                                </div>
                            ) : marcacoes.map(m => {
                                const tempoMin = calcularTempoEspera(m.data_marcacao, m.data_contratacao);
                                const cor = corTempo(tempoMin);
                                const dispCor = m.disponibilidade === 'NO PÁTIO' ? '#4ade80' : m.disponibilidade === 'NO POSTO' ? '#fbbf24' : '#64748b';
                                const diasMarcado = m.data_marcacao ? Math.floor((Date.now() - new Date(m.data_marcacao).getTime()) / 86400000) : 0;
                                const velho = diasMarcado >= 15 && !m.data_contratacao;
                                return (
                                    <button key={m.id} onClick={() => setSheetMarcacao(m)} style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        background: '#0f172a', border: `1px solid ${velho ? 'rgba(251,146,60,0.3)' : '#1e293b'}`,
                                        borderLeft: `3px solid ${cor}`, borderRadius: '12px',
                                        padding: '14px 16px', cursor: 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
                                    onTouchEnd={e => e.currentTarget.style.opacity = '1'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{m.nome_motorista}</span>
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                {velho && (
                                                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#fb923c', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '5px', padding: '2px 5px' }}>
                                                        {diasMarcado}d
                                                    </span>
                                                )}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: cor }}>
                                                    <Clock size={11} color={cor} strokeWidth={2} />
                                                    {formatarTempo(tempoMin)}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {m.disponibilidade && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: dispCor, fontWeight: '600' }}>
                                                    <MapPin size={10} color={dispCor} strokeWidth={2} />
                                                    {m.disponibilidade}
                                                </span>
                                            )}
                                            {m.tipo_veiculo && (
                                                <span style={{ fontSize: '10px', color: '#475569' }}>{m.tipo_veiculo}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </>
                )}
            </div>

            {/* Toast */}
            <Toast msg={toast} />

            {/* Sheet: Novo Link */}
            {sheetNovoLink && (
                <BottomSheet titulo="Novo Link de Acesso" onClose={() => setSheetNovoLink(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '8px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                Nome do Motorista (opcional)
                            </label>
                            <input
                                type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                                placeholder="Ex: João Silva"
                                autoCapitalize="words"
                                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', padding: '12px 14px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                Telefone WhatsApp *
                            </label>
                            <input
                                type="tel" value={novoTel} onChange={e => setNovoTel(e.target.value)}
                                placeholder="(81) 99999-9999"
                                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', padding: '12px 14px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button onClick={gerarLink} disabled={gerando} style={{
                            width: '100%', height: '52px',
                            background: gerando ? '#1e293b' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                            border: 'none', borderRadius: '12px', color: gerando ? '#475569' : '#fff',
                            fontSize: '15px', fontWeight: '700', cursor: gerando ? 'not-allowed' : 'pointer',
                            boxShadow: gerando ? 'none' : '0 4px 16px rgba(59,130,246,0.4)',
                        }}>
                            {gerando ? 'Gerando...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Link2 size={16} strokeWidth={2} /> Gerar Link</span>}
                        </button>
                    </div>
                </BottomSheet>
            )}

            {/* Sheet: Detalhes do Token */}
            {sheetToken && (() => {
                const t = sheetToken;
                const ef = statusEfetivo(t);
                const cor = corStatus(ef);
                return (
                    <BottomSheet titulo="Detalhes do Link" onClose={() => setSheetToken(null)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
                            {/* Info */}
                            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginBottom: '2px' }}>Motorista</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{t.nome_motorista || '—'}</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginBottom: '2px' }}>Telefone</div>
                                    <div style={{ fontSize: '13px', color: '#cbd5e1' }}>{formatarTelefone(t.telefone)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginBottom: '2px' }}>Status</div>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: cor }}>{labelStatus(ef)}</span>
                                    </div>
                                    {t.data_expiracao && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginBottom: '2px' }}>
                                                {ef === 'expirado' ? 'Expirou' : 'Expira'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{formatarData(t.data_expiracao)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ações */}
                            <button onClick={() => copiarLink(t)} style={{
                                width: '100%', height: '48px', background: 'rgba(59,130,246,0.12)',
                                border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px',
                                color: '#60a5fa', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Copy size={16} strokeWidth={2} /> Copiar Link</span>
                            </button>

                            {(ef === 'inativo' || ef === 'utilizado' || ef === 'expirado') && (
                                <button onClick={() => toggleToken(t)} style={{
                                    width: '100%', height: '48px', background: 'rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px',
                                    color: '#4ade80', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><RefreshCw size={16} strokeWidth={2} /> Reativar Link</span>
                                </button>
                            )}

                            {ef === 'ativo' && (
                                <button onClick={() => toggleToken(t)} style={{
                                    width: '100%', height: '48px', background: 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px',
                                    color: '#fbbf24', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><PauseCircle size={16} strokeWidth={2} /> Inativar Link</span>
                                </button>
                            )}

                            <button onClick={() => excluirToken(t.id)} style={{
                                width: '100%', height: '48px', background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px',
                                color: '#f87171', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Trash2 size={16} strokeWidth={2} /> Excluir Link</span>
                            </button>
                        </div>
                    </BottomSheet>
                );
            })()}

            {/* Sheet: Detalhes da Marcação */}
            {sheetMarcacao && (() => {
                const m = sheetMarcacao;
                const tempoMin = calcularTempoEspera(m.data_marcacao, m.data_contratacao);
                const dispCor = m.disponibilidade === 'NO PÁTIO' ? '#4ade80' : m.disponibilidade === 'NO POSTO' ? '#fbbf24' : '#64748b';
                return (
                    <BottomSheet titulo="Detalhes do Motorista" onClose={() => setSheetMarcacao(null)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>
                                {m.nome_motorista}
                            </div>
                            {[
                                { label: 'Tempo de Espera', value: <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: corTempo(tempoMin), fontWeight: '700' }}><Clock size={12} color={corTempo(tempoMin)} strokeWidth={2} />{formatarTempo(tempoMin)}</span> },
                                { label: 'Localização', value: <span style={{ color: dispCor }}>{m.disponibilidade || '—'}</span> },
                                { label: 'Estados Destino', value: (m.estados_destino?.length ? m.estados_destino.join(', ') : '—') },
                                { label: 'Tipo Veículo', value: m.tipo_veiculo || '—' },
                                { label: 'Placa', value: m.placa1 ? <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>{m.placa1}</span> : '—' },
                                { label: 'Telefone', value: formatarTelefone(m.telefone) },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                                    <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</span>
                                    <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '500' }}>{item.value}</span>
                                </div>
                            ))}
                            {(() => {
                                const diasMarcado = m.data_marcacao ? Math.floor((Date.now() - new Date(m.data_marcacao).getTime()) / 86400000) : 0;
                                const podeRemover = diasMarcado >= 15 && !m.data_contratacao;
                                return podeRemover ? (
                                    <button onClick={() => excluirMarcacao(m.id)} style={{
                                        marginTop: '14px', width: '100%', height: '46px',
                                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                        borderRadius: '12px', color: '#f87171', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    }}>
                                        <Trash2 size={15} strokeWidth={2} /> Remover ({diasMarcado}d sem operação)
                                    </button>
                                ) : null;
                            })()}
                        </div>
                    </BottomSheet>
                );
            })()}
        </div>
    );
}
