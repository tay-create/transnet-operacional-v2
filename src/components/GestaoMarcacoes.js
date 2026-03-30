import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Copy, CheckCircle, Ban, Truck, RefreshCw, Plus, Award, MapPin, Trash2, Clock, Star, Eye, X, AlertTriangle } from 'lucide-react';
import api from '../services/apiService';
import ModalConfirm from './ModalConfirm';

const s = {
    wrap: { padding: '10px 0' },
    tabs: { display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '4px' },
    tab: (ativo) => ({
        flex: 1, padding: '9px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
        background: ativo ? 'rgba(37,99,235,0.7)' : 'transparent',
        color: ativo ? '#fff' : '#64748b', transition: 'all 0.2s'
    }),
    card: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
    label: { fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' },
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    btn: (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
        borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
        background: color === 'blue' ? '#2563eb' : color === 'red' ? 'rgba(239,68,68,0.15)' : color === 'green' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)',
        color: color === 'blue' ? '#fff' : color === 'red' ? '#f87171' : color === 'green' ? '#4ade80' : '#94a3b8',
        border: color === 'red' ? '1px solid rgba(239,68,68,0.25)' : color === 'green' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)'
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { padding: '7px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
    td: { padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0', verticalAlign: 'middle', fontSize: '12px' },
    badge: (status) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: status === 'ativo' ? 'rgba(34,197,94,0.12)' : status === 'utilizado' ? 'rgba(250,204,21,0.12)' : status === 'expirado' ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)',
        color: status === 'ativo' ? '#4ade80' : status === 'utilizado' ? '#facc15' : status === 'expirado' ? '#fb923c' : '#f87171',
        border: `1px solid ${status === 'ativo' ? 'rgba(34,197,94,0.25)' : status === 'utilizado' ? 'rgba(250,204,21,0.25)' : status === 'expirado' ? 'rgba(249,115,22,0.25)' : 'rgba(239,68,68,0.25)'}`
    }),
    badgeOp: (status) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: status === 'DISPONIVEL' ? 'rgba(34,197,94,0.12)' : status === 'EM VIAGEM' ? 'rgba(59,130,246,0.12)' : 'rgba(100,116,139,0.12)',
        color: status === 'DISPONIVEL' ? '#4ade80' : status === 'EM VIAGEM' ? '#60a5fa' : '#94a3b8',
        border: `1px solid ${status === 'DISPONIVEL' ? 'rgba(34,197,94,0.25)' : status === 'EM VIAGEM' ? 'rgba(59,130,246,0.25)' : 'rgba(100,116,139,0.25)'}`
    }),
    badgeFreota: {
        display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px',
        fontWeight: '700', color: '#60a5fa', background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.25)', borderRadius: '4px', padding: '1px 6px'
    },
    linkText: { fontSize: '11px', color: '#475569', wordBreak: 'break-all', maxWidth: '260px' },
    empty: { textAlign: 'center', padding: '40px', color: '#475569', fontSize: '14px' },
    toast: { position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', color: '#4ade80', fontWeight: '600', fontSize: '14px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }
};

// ── Cálculo de tempo de espera ───────────────────────────────────────────────
// data_marcacao e data_contratacao são gravadas no timezone de Brasília (sem Z).
// Parseamos como hora local sem adicionar 'Z' para evitar deslocamento de 3h.
function parseDateLocal(str) {
    if (!str) return null;
    // Se já vier com Z ou +offset, usa diretamente; caso contrário trata como local
    if (str.endsWith('Z') || str.includes('+')) return new Date(str);
    // Formato "YYYY-MM-DD HH:MM:SS" → substitui espaço por T para o parser JS
    return new Date(str.replace(' ', 'T'));
}
function calcularTempoEspera(dataMarcacao, dataContratacao) {
    if (!dataMarcacao) return null;
    const inicio = parseDateLocal(dataMarcacao);
    const fim = dataContratacao ? parseDateLocal(dataContratacao) : new Date();
    if (!inicio || isNaN(inicio)) return null;
    const diff = Math.floor((fim - inicio) / 60000);
    return Math.max(0, diff);
}

function formatarTempo(minutos) {
    if (minutos === null) return '—';
    if (minutos < 60) return `${minutos}min`;
    const totalH = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (totalH < 24) return m > 0 ? `${totalH}h ${m}min` : `${totalH}h`;
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (h === 0 && m === 0) return `${d}d`;
    if (h === 0) return `${d}d ${m}min`;
    if (m === 0) return `${d}d ${h}h`;
    return `${d}d ${h}h ${m}min`;
}

function corTempo(min) {
    if (min === null) return '#64748b';
    if (min < 60) return '#4ade80';
    if (min < 240) return '#fbbf24';
    return '#f87171';
}

// ── Cor da disponibilidade (localização) ─────────────────────────────────────
function corDisponibilidade(disp) {
    if (!disp) return '#64748b';
    if (disp === 'NO PÁTIO') return '#4ade80';
    if (disp === 'NO POSTO') return '#fbbf24';
    return '#94a3b8'; // EM CASA
}

// ── Estado inicial do form de frota (apenas nome e telefone) ─────────────────
const FORM_FROTA_INICIAL = { nome_motorista: '', telefone: '' };

export default function GestaoMarcacoes({ socket }) {
    const [aba, setAba] = useState('links');
    const [tokens, setTokens] = useState([]);
    const [marcacoes, setMarcacoes] = useState([]);
    const [confirmar, setConfirmar] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tel, setTel] = useState('');
    const [copiado, setCopiado] = useState(null);
    const [toast, setToast] = useState('');
    const [formFrota, setFormFrota] = useState(FORM_FROTA_INICIAL);
    const [salvandoFrota, setSalvandoFrota] = useState(false);
    const [buscaLinks, setBuscaLinks] = useState('');
    const [buscaMarcacoes, setBuscaMarcacoes] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroDisponibilidade, setFiltroDisponibilidade] = useState('');
    const [filtroStatusOp, setFiltroStatusOp] = useState('');
    const [filtroTag, setFiltroTag] = useState('');
    const [paginaMarcacoes, setPaginaMarcacoes] = useState(1);
    const [totalMarcacoes, setTotalMarcacoes] = useState(0);
    const ITENS_POR_PAGINA = 50;
    // Tick para atualizar cronômetros a cada minuto
    const [tick, setTick] = useState(0);
    const [modalMarcacao, setModalMarcacao] = useState(null);

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    const mostrarToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2800);
    };

    const carregarTokens = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/tokens');
            if (r.data.success) setTokens(r.data.tokens);
        } catch (e) { console.error(e); mostrarToast('Erro ao carregar links.'); }
        finally { setLoading(false); }
    }, []);

    const carregarMarcacoes = useCallback(async (pagina = 1) => {
        setLoading(true);
        try {
            const qp = new URLSearchParams({ page: pagina, limit: ITENS_POR_PAGINA });
            // filtroStatusOp (Disponível/Indisponível/Contratado) e filtroDisponibilidade (EM CASA/NO PÁTIO/NO POSTO)
            // ambos usam o mesmo param; statusOp tem precedência se os dois estiverem preenchidos
            if (filtroStatusOp) qp.set('disponibilidade', filtroStatusOp);
            else if (filtroDisponibilidade) qp.set('disponibilidade', filtroDisponibilidade);
            if (buscaMarcacoes.trim()) qp.set('busca', buscaMarcacoes.trim());
            if (filtroEstado) qp.set('estado', filtroEstado);
            const r = await api.get(`/api/marcacoes?${qp}`);
            if (r.data.success) {
                setMarcacoes(r.data.marcacoes);
                setTotalMarcacoes(r.data.total || 0);
                setPaginaMarcacoes(pagina);
            }
        } catch (e) { console.error(e); mostrarToast('Erro ao carregar marcações.'); }
        finally { setLoading(false); }
    }, [filtroDisponibilidade, filtroStatusOp, buscaMarcacoes, filtroEstado]);

    useEffect(() => {
        if (aba === 'links') carregarTokens();
        else if (aba === 'placas') carregarMarcacoes(1);
    }, [aba, carregarTokens, carregarMarcacoes]);

    // Recarrega ao mudar filtros (reset para página 1)
    useEffect(() => {
        if (aba !== 'placas') return;
        carregarMarcacoes(1);
    }, [filtroDisponibilidade, filtroStatusOp, filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

    // Busca com debounce
    useEffect(() => {
        if (aba !== 'placas') return;
        const t = setTimeout(() => carregarMarcacoes(1), 400);
        return () => clearTimeout(t);
    }, [buscaMarcacoes]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!socket) return;
        const atualizar = (payload) => {
            if (aba !== 'placas') return;
            // Remoção pontual — atualiza estado local sem re-fetch
            if (payload?.tipo === 'marcacao_removida' && payload?.id) {
                setMarcacoes(prev => {
                    const nova = prev.filter(m => m.id !== payload.id);
                    setTotalMarcacoes(t => Math.max(0, t - (prev.length - nova.length)));
                    return nova;
                });
                return;
            }
            // Eventos de token não afetam a lista de marcações
            if (payload?.tipo?.startsWith('token_')) return;
            // Para nova_marcacao ou outros eventos, recarrega a página atual
            carregarMarcacoes(paginaMarcacoes);
        };
        socket.on('marcacao_atualizada', atualizar);
        return () => { socket.off('marcacao_atualizada', atualizar); };
    }, [socket, aba, carregarMarcacoes, paginaMarcacoes]);

    async function gerarLink() {
        if (!tel.trim()) { mostrarToast('Informe o telefone.'); return; }
        try {
            const r = await api.post('/api/tokens', { telefone: tel.trim() });
            if (r.data.success) {
                setTel('');
                mostrarToast('Link gerado com sucesso!');
                carregarTokens();
            } else {
                mostrarToast(r.data.message || 'Erro ao gerar link.');
            }
        } catch (e) { mostrarToast(e.response?.data?.message || 'Erro de conexão.'); }
    }

    async function toggleStatus(token) {
        const efetivo = statusEfetivo(token);
        const novoStatus = efetivo === 'ativo' ? 'inativo' : 'ativo';
        try {
            await api.put(`/api/tokens/${token.id}`, { status: novoStatus });
            setTokens(prev => prev.map(t => t.id === token.id ? { ...t, status: novoStatus } : t));
            mostrarToast(novoStatus === 'ativo' ? 'Link reativado.' : 'Link inativado.');
        } catch (e) { mostrarToast('Erro ao atualizar.'); }
    }

    function excluirToken(id) {
        setConfirmar({
            mensagem: 'Excluir este link permanentemente?',
            textConfirm: 'Excluir',
            onConfirm: async () => {
                setConfirmar(null);
                try {
                    await api.delete(`/api/tokens/${id}`);
                    setTokens(prev => prev.filter(t => t.id !== id));
                    mostrarToast('Link excluído.');
                } catch (e) { mostrarToast('Erro ao excluir.'); }
            }
        });
    }

    function excluirMarcacao(id) {
        setConfirmar({
            mensagem: 'Remover este motorista da fila?',
            textConfirm: 'Remover',
            onConfirm: async () => {
                setConfirmar(null);
                try {
                    await api.delete(`/api/marcacoes/${id}`);
                    setMarcacoes(prev => prev.filter(m => m.id !== id));
                    mostrarToast('Marcação removida.');
                } catch (e) { mostrarToast('Erro ao excluir.'); }
            }
        });
    }

    async function handleToggleIndisponivel(id, disponibilidadeAtual) {
        const novoStatus = disponibilidadeAtual === 'Indisponível' ? 'Disponível' : 'Indisponível';
        try {
            const r = await api.put(`/api/marcacoes/${id}/status`, { status: novoStatus });
            if (r.data.success) {
                setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, disponibilidade: novoStatus } : m));
            }
        } catch (e) { mostrarToast('Erro ao atualizar status.'); }
    }

    async function handleAtualizarLocalizacao(id, novaLocalizacao) {
        try {
            const r = await api.put(`/api/marcacoes/${id}/status`, { status: novaLocalizacao });
            if (r.data.success) {
                setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, disponibilidade: novaLocalizacao } : m));
            } else {
                mostrarToast('Erro ao atualizar localização.');
            }
        } catch (e) { mostrarToast('Erro ao atualizar localização.'); }
    }

    async function toggleTag(m, campo) {
        let body = {};
        if (campo === 'favorito') {
            body = { favorito: m.favorito ? 0 : 1 };
        } else if (campo === 'tag_motorista') {
            body = { tag_motorista: m.tag_motorista === 'PROBLEMÁTICO' ? null : 'PROBLEMÁTICO' };
        }
        try {
            const r = await api.put(`/api/marcacoes/${m.id}/tag`, body);
            if (r.data.success) {
                setMarcacoes(prev => prev.map(x => x.id === m.id ? { ...x, ...body } : x));
            }
        } catch (e) { mostrarToast('Erro ao atualizar tag.'); }
    }

    // Frota: apenas nome e telefone — placas inseridas depois no despacho
    async function cadastrarFrota() {
        const { nome_motorista, telefone } = formFrota;
        if (!nome_motorista.trim() || !telefone.trim()) {
            mostrarToast('Preencha Nome e Telefone.');
            return;
        }
        setSalvandoFrota(true);
        try {
            const r = await api.post('/api/frota', {
                nome_motorista: formFrota.nome_motorista,
                telefone: formFrota.telefone,
            });
            if (r.data.success) {
                setFormFrota(FORM_FROTA_INICIAL);
                mostrarToast('Motorista da frota adicionado à fila!');
            } else {
                mostrarToast(r.data.message || 'Erro ao cadastrar.');
            }
        } catch (e) { mostrarToast('Erro de conexão.'); }
        finally { setSalvandoFrota(false); }
    }

    function copiarLink(token) {
        const url = `${window.location.origin}/cadastro/${token.token}`;
        const sucesso = () => { setCopiado(token.id); mostrarToast('Link copiado!'); setTimeout(() => setCopiado(null), 2000); };
        const fallback = () => {
            try {
                const el = document.createElement('textarea');
                el.value = url;
                el.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(el);
                el.focus(); el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                sucesso();
            } catch { mostrarToast('Erro ao copiar. Copie manualmente.'); }
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(sucesso).catch(fallback);
        } else {
            fallback();
        }
    }

    function linkWpp(tel) {
        if (!tel) return null;
        const d = tel.replace(/\D/g, '');
        const num = d.startsWith('55') ? d : `55${d}`;
        return `https://wa.me/${num}`;
    }

    function linkWppComMensagem(tel, tokenObj) {
        const base = linkWpp(tel);
        if (!base || !tokenObj) return base;
        const url = `${window.location.origin}/cadastro/${tokenObj.token}`;
        const msg = encodeURIComponent(`${url}\n\nAssim que sair para a região desejada entraremos em contato`);
        return `${base}?text=${msg}`;
    }

    function statusEfetivo(token) {
        if (token.status !== 'ativo') return token.status;
        if (token.data_expiracao && new Date() > new Date(token.data_expiracao)) return 'expirado';
        return 'ativo';
    }

    function formatarTelefone(tel) {
        if (!tel) return '—';
        let d = tel.replace(/\D/g, '');
        // Se tem 12 ou 13 dígitos e começa com 55, remove o 55 para formatar o resto
        if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
            d = d.slice(2);
        }
        if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;

        // Se ainda assim for longo (como os 12 dígitos do print sem o 55), tenta formatar o que der
        if (d.length > 11) {
            return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        }
        return tel;
    }

    function formatarData(dt) {
        if (!dt) return '—';
        const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const ff = (campo) => (e) => setFormFrota(prev => ({ ...prev, [campo]: e.target.value }));

    // Filtros são server-side; exclui is_frota e aplica filtroTag localmente
    const marcacoesFiltradas = useMemo(() => marcacoes.filter(m => {
        if (m.is_frota) return false;
        if (filtroTag === 'favorito' && !m.favorito) return false;
        if (filtroTag === 'problematico' && m.tag_motorista !== 'PROBLEMÁTICO') return false;
        return true;
    }), [marcacoes, filtroTag]);

    function ModalDetalhes({ m, onClose }) {
        const dim = [m.altura, m.largura, m.comprimento].filter(Boolean);
        return (
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}>
                <div onClick={e => e.stopPropagation()} style={{
                    background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '560px',
                    maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
                }}>
                    {/* Cabeçalho */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', textTransform: 'uppercase' }}>{m.nome_motorista}</div>
                            <div style={{ fontSize: '13px', color: '#60a5fa', marginTop: '2px' }}>
                                {linkWpp(m.telefone) ? <a href={linkWpp(m.telefone)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{formatarTelefone(m.telefone)}</a> : formatarTelefone(m.telefone)}
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Grade de informações */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                            { label: 'Placa 1', valor: m.placa1 || '—', destaque: true },
                            { label: 'Placa 2', valor: m.placa2 || '—', destaque: true },
                            { label: 'Tipo de Veículo', valor: m.tipo_veiculo || '—' },
                            { label: 'Já carregou conosco?', valor: m.ja_carregou || '—' },
                            { label: 'Estados de Destino', valor: Array.isArray(m.estados_destino) ? m.estados_destino.join(', ') : '—' },
                            { label: 'Rastreador', valor: m.rastreador || '—' },
                            { label: 'Status Rastreador', valor: m.status_rastreador || '—' },
                            { label: 'Dimensões (A×L×C)', valor: dim.length ? `${m.altura || '?'}m × ${m.largura || '?'}m × ${m.comprimento || '?'}m` : '—' },
                            { label: 'Data da Marcação', valor: formatarData(m.data_marcacao) },
                            { label: 'Viagens Realizadas', valor: m.viagens_realizadas ?? 0 },
                        ].map(({ label, valor, destaque }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
                                <div style={{ fontSize: '13px', fontWeight: destaque ? '700' : '500', color: destaque ? '#60a5fa' : '#e2e8f0' }}>{String(valor)}</div>
                            </div>
                        ))}
                    </div>

                    {/* Localização GPS */}
                    {m.latitude && m.longitude && (
                        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Localização GPS</div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{m.latitude}, {m.longitude}</div>
                            </div>
                            <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`} target="_blank" rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#60a5fa', fontWeight: '600', textDecoration: 'none', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '5px 10px' }}>
                                <MapPin size={13} /> Ver no Mapa
                            </a>
                        </div>
                    )}

                    {/* Anexos */}
                    {[m.comprovante_pdf, m.anexo_cnh, m.anexo_doc_veiculo, m.anexo_crlv_carreta, m.anexo_antt, m.anexo_outros].some(Boolean) && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Anexos</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {m.comprovante_pdf && <a href={m.comprovante_pdf} download={`PDF_ORIG_${m.placa1}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>PDF Orig.</a>}
                                {m.anexo_cnh && <a href={m.anexo_cnh} download={`CNH_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>CNH</a>}
                                {m.anexo_doc_veiculo && <a href={m.anexo_doc_veiculo} download={`CRLV_CAV_${m.placa1}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>CRLV Cav.</a>}
                                {m.anexo_crlv_carreta && <a href={m.anexo_crlv_carreta} download={`CRLV_CAR_${m.placa2 || 'CARRETA'}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#fb923c', textDecoration: 'none', background: 'rgba(251,146,60,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(251,146,60,0.3)' }}>CRLV Car.</a>}
                                {m.anexo_antt && <a href={m.anexo_antt} download={`ANTT_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>ANTT</a>}
                                {m.anexo_outros && <a href={m.anexo_outros} download={`OUTROS_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>Outros</a>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={s.wrap}>
            {confirmar && <ModalConfirm mensagem={confirmar.mensagem} textConfirm={confirmar.textConfirm} onConfirm={confirmar.onConfirm} onCancel={() => setConfirmar(null)} />}

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <Truck size={22} color="#60a5fa" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Marcação de Placas</span>
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
                <button style={s.tab(aba === 'links')} onClick={() => setAba('links')}>
                    Gerar Links
                </button>
                <button style={s.tab(aba === 'placas')} onClick={() => setAba('placas')}>
                    Lista de Marcações
                </button>
            </div>

            {/* ABA: LINKS */}
            {aba === 'links' && (
                <>
                    <div style={s.card}>
                        <label style={s.label}>Telefone do Motorista (com DDD)</label>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                            <input
                                style={{ ...s.input, flex: 1 }}
                                type="tel"
                                value={tel}
                                onChange={e => setTel(e.target.value)}
                                placeholder="(81) 99999-9999"
                                onKeyDown={e => e.key === 'Enter' && gerarLink()}
                            />
                            <button style={s.btn('blue')} onClick={gerarLink}>
                                <Plus size={15} /> Gerar Link
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                        <input
                            style={{ ...s.input, flex: 1, maxWidth: '300px' }}
                            placeholder="Buscar por telefone..."
                            value={buscaLinks}
                            onChange={e => setBuscaLinks(e.target.value)}
                        />
                        <button style={s.btn()} onClick={carregarTokens}>
                            <RefreshCw size={14} /> Atualizar
                        </button>
                    </div>

                    {loading ? (
                        <div style={s.empty}>Carregando...</div>
                    ) : tokens.length === 0 ? (
                        <div style={s.empty}>Nenhum link gerado ainda.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>ID</th>
                                        <th style={s.th}>Telefone</th>
                                        <th style={s.th}>Link</th>
                                        <th style={s.th}>Status</th>
                                        <th style={s.th}>Criado em</th>
                                        <th style={s.th}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tokens.filter(t => !buscaLinks || (t.telefone || '').replace(/\D/g, '').includes(buscaLinks.replace(/\D/g, ''))).map(t => (
                                        <tr key={t.id}>
                                            <td style={s.td}>{t.id}</td>
                                            <td style={s.td}>{linkWppComMensagem(t.telefone, t) ? <a href={linkWppComMensagem(t.telefone, t)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{formatarTelefone(t.telefone)}</a> : formatarTelefone(t.telefone)}</td>
                                            <td style={s.td}>
                                                <div style={s.linkText}>
                                                    /cadastro/{t.token.slice(0, 8)}...
                                                </div>
                                                <button style={{ ...s.btn(), padding: '5px 10px', marginTop: '4px', fontSize: '11px' }}
                                                    onClick={() => copiarLink(t)}>
                                                    {copiado === t.id
                                                        ? <><CheckCircle size={12} /> Copiado</>
                                                        : <><Copy size={12} /> Copiar Link</>}
                                                </button>
                                            </td>
                                            <td style={s.td}>
                                                {(() => { const st = statusEfetivo(t); return (
                                                    <span style={s.badge(st)}>
                                                        {st === 'ativo' ? <CheckCircle size={10} /> : st === 'utilizado' ? <CheckCircle size={10} /> : st === 'expirado' ? <Clock size={10} /> : <Ban size={10} />}
                                                        {st === 'ativo' ? 'Ativo' : st === 'utilizado' ? 'Utilizado' : st === 'expirado' ? 'Expirado' : 'Inativo'}
                                                    </span>
                                                ); })()}
                                            </td>
                                            <td style={s.td}>
                                                <div>{formatarData(t.data_criacao)}</div>
                                                {t.data_expiracao && (statusEfetivo(t) === 'ativo' || statusEfetivo(t) === 'expirado') && (
                                                    <div style={{ fontSize: '10px', color: statusEfetivo(t) === 'expirado' ? '#fb923c' : '#475569', marginTop: '2px' }}>
                                                        {statusEfetivo(t) === 'expirado' ? 'Expirou: ' : 'Expira: '}{formatarData(t.data_expiracao)}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={s.td}>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {statusEfetivo(t) === 'ativo' && (
                                                        <button style={{ ...s.btn('red'), padding: '6px 10px' }} onClick={() => toggleStatus(t)}>
                                                            <Ban size={13} /> Inativar
                                                        </button>
                                                    )}
                                                    {(t.status === 'inativo' || t.status === 'utilizado' || statusEfetivo(t) === 'expirado') && (
                                                        <button style={{ ...s.btn('green'), padding: '6px 10px' }} onClick={() => toggleStatus(t)}>
                                                            <CheckCircle size={13} /> Reativar
                                                        </button>
                                                    )}
                                                    <button style={{ ...s.btn('red'), padding: '6px 10px' }} onClick={() => excluirToken(t.id)} title="Excluir link">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ABA: FILA DE PLACAS */}
            {aba === 'placas' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                            <input
                                style={{ ...s.input, flex: 1, minWidth: '180px', maxWidth: '260px' }}
                                placeholder="Buscar por nome ou telefone..."
                                value={buscaMarcacoes}
                                onChange={e => setBuscaMarcacoes(e.target.value)}
                            />
                            <select
                                value={filtroEstado}
                                onChange={e => setFiltroEstado(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '130px', maxWidth: '180px',
                                    cursor: 'pointer', color: filtroEstado ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroEstado ? '700' : '400'
                                }}
                            >
                                <option value="">Todos os estados</option>
                                {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                                    <option key={uf} value={uf}>{uf}</option>
                                ))}
                            </select>
                            <select
                                value={filtroDisponibilidade}
                                onChange={e => setFiltroDisponibilidade(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '150px', maxWidth: '200px',
                                    cursor: 'pointer', color: filtroDisponibilidade ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroDisponibilidade ? '700' : '400'
                                }}
                            >
                                <option value="">Todas disponibilidades</option>
                                <option value="EM CASA">EM CASA</option>
                                <option value="NO PÁTIO">NO PÁTIO</option>
                                <option value="NO POSTO">NO POSTO</option>
                            </select>
                            <select
                                value={filtroStatusOp}
                                onChange={e => setFiltroStatusOp(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '150px', maxWidth: '200px',
                                    cursor: 'pointer', color: filtroStatusOp ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroStatusOp ? '700' : '400'
                                }}
                            >
                                <option value="">Todos os status</option>
                                <option value="disponivel">Disponível</option>
                                <option value="indisponivel">Indisponível</option>
                                <option value="contratado">Contratado</option>
                            </select>
                            <select
                                value={filtroTag}
                                onChange={e => setFiltroTag(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '140px', maxWidth: '180px',
                                    cursor: 'pointer', color: filtroTag ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroTag ? '700' : '400'
                                }}
                            >
                                <option value="">Todas as tags</option>
                                <option value="favorito">Favoritos</option>
                                <option value="problematico">Problemáticos</option>
                            </select>
                        </div>
                        <button style={s.btn()} onClick={() => carregarMarcacoes(paginaMarcacoes)}>
                            <RefreshCw size={14} /> Atualizar
                        </button>
                    </div>

                    {loading ? (
                        <div style={s.empty}>Carregando...</div>
                    ) : marcacoes.length === 0 ? (
                        <div style={s.empty}>Nenhuma marcação registrada.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>Data</th>
                                        <th style={s.th}>Motorista</th>
                                        <th style={s.th}>Telefone</th>
                                        <th style={s.th}>Placa 1</th>
                                        <th style={s.th}>Placa 2</th>
                                        <th style={s.th}>Veículo</th>
                                        <th style={s.th}>Disponibilidade</th>
                                        <th style={s.th}>Indisponível</th>
                                        <th style={s.th}>Tempo Espera</th>
                                        <th style={s.th}>Rastreador</th>
                                        <th style={s.th}>Destinos</th>
                                        <th style={s.th}>Localização</th>
                                        <th style={s.th}>Status</th>
                                        <th style={s.th}>Viagens</th>
                                        <th style={s.th}>Tags</th>
                                        <th style={s.th}>Anexos</th>
                                        <th style={s.th}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marcacoesFiltradas.map(m => {
                                        // tick é usado apenas para forçar re-render periódico
                                        void tick;
                                        const tempoMin = calcularTempoEspera(m.data_marcacao, m.data_contratacao);
                                        return (
                                            <tr key={m.id}>
                                                <td style={s.td}>{formatarData(m.data_marcacao)}</td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', textTransform: 'uppercase' }}>
                                                        {m.nome_motorista}
                                                        {m.is_frota ? (
                                                            <span style={s.badgeFreota}>
                                                                <Truck size={10} /> FROTA
                                                            </span>
                                                        ) : null}
                                                        {!m.is_frota && (m.viagens_realizadas ?? 0) < 5 && (m.ja_carregou === 'Não' || m.ja_carregou === 'Nao' || (!m.ja_carregou && (m.viagens_realizadas ?? 0) === 0)) ? (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                fontSize: '10px', fontWeight: '700',
                                                                color: '#fb923c',
                                                                background: 'rgba(251,146,60,0.12)',
                                                                border: '1px solid rgba(251,146,60,0.3)',
                                                                borderRadius: '4px', padding: '1px 6px'
                                                            }}>
                                                                <Star size={9} /> NOVATO
                                                            </span>
                                                        ) : null}
                                                        {m.favorito ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: '#facc15', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '4px', padding: '1px 6px' }}>
                                                                <Star size={9} fill="#facc15" /> FAVORITO
                                                            </span>
                                                        ) : null}
                                                        {m.tag_motorista === 'PROBLEMÁTICO' ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '1px 6px' }}>
                                                                <AlertTriangle size={9} /> PROBLEMÁTICO
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td style={s.td}>{linkWpp(m.telefone) ? <a href={linkWpp(m.telefone)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{formatarTelefone(m.telefone)}</a> : formatarTelefone(m.telefone)}</td>
                                                <td style={{ ...s.td, fontWeight: '700', color: '#60a5fa' }}>{m.placa1}</td>
                                                <td style={s.td}>{m.placa2 || '—'}</td>
                                                <td style={s.td}>{m.tipo_veiculo}</td>
                                                {/* Disponibilidade (localização: NO PÁTIO / NO POSTO / EM CASA) */}
                                                <td style={s.td}>
                                                    <select
                                                        value={['EM CASA', 'NO PÁTIO', 'NO POSTO'].includes(m.disponibilidade) ? m.disponibilidade : ''}
                                                        onChange={e => e.target.value && handleAtualizarLocalizacao(m.id, e.target.value)}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.06)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '6px', padding: '4px 8px',
                                                            color: corDisponibilidade(m.disponibilidade),
                                                            fontSize: '11px', fontWeight: '700',
                                                            cursor: 'pointer', outline: 'none'
                                                        }}
                                                    >
                                                        <option value="" style={{ color: '#475569' }}>— localização —</option>
                                                        <option value="EM CASA" style={{ color: 'black' }}>EM CASA</option>
                                                        <option value="NO PÁTIO" style={{ color: 'black' }}>NO PÁTIO</option>
                                                        <option value="NO POSTO" style={{ color: 'black' }}>NO POSTO</option>
                                                    </select>
                                                </td>
                                                {/* Checkbox Indisponível */}
                                                <td style={s.td}>
                                                    <label style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                                                        color: m.disponibilidade === 'Indisponível' ? '#f87171' : '#64748b'
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={m.disponibilidade === 'Indisponível'}
                                                            onChange={() => handleToggleIndisponivel(m.id, m.disponibilidade)}
                                                            style={{ accentColor: '#ef4444', cursor: 'pointer', width: '14px', height: '14px' }}
                                                        />
                                                    </label>
                                                </td>
                                                {/* Tempo de Espera */}
                                                <td style={s.td}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: corTempo(tempoMin) }}>
                                                        <Clock size={12} />
                                                        {formatarTempo(tempoMin)}
                                                    </span>
                                                </td>
                                                <td style={s.td}>
                                                    <div>{m.rastreador}</div>
                                                    <div style={{ fontSize: '11px', color: m.status_rastreador === 'Ativo' ? '#4ade80' : '#94a3b8' }}>
                                                        {m.status_rastreador}
                                                    </div>
                                                </td>
                                                <td style={s.td}>{Array.isArray(m.estados_destino) ? m.estados_destino.join(', ') : '—'}</td>
                                                <td style={s.td}>
                                                    {m.latitude && m.longitude ? (
                                                        <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
                                                            target="_blank" rel="noreferrer"
                                                            style={{ color: '#60a5fa', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            <MapPin size={12} />Ver Mapa
                                                        </a>
                                                    ) : <span style={{ color: '#475569', fontSize: '12px' }}>Não permitido</span>}
                                                </td>
                                                <td style={s.td}>
                                                    {m.disponibilidade === 'Indisponível' ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                            background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)'
                                                        }}>Indisponível</span>
                                                    ) : m.disponibilidade === 'Contratado' ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                            background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)'
                                                        }}>Contratado</span>
                                                    ) : m.status_operacional === 'EM VIAGEM' || m.status_operacional === 'EM ROTA' ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                            background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)'
                                                        }}>Contratado</span>
                                                    ) : (
                                                        <span style={s.badgeOp(m.status_operacional || 'DISPONIVEL')}>
                                                            {(m.status_operacional || 'DISPONIVEL') === 'DISPONIVEL' ? 'Disponível' : m.status_operacional}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={s.td}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#facc15', fontWeight: '700' }}>
                                                        <Award size={13} />
                                                        {m.viagens_realizadas ?? 0}
                                                    </span>
                                                </td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => toggleTag(m, 'favorito')}
                                                            title={m.favorito ? 'Remover favorito' : 'Marcar como favorito'}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                                                color: m.favorito ? '#facc15' : '#334155',
                                                                opacity: m.favorito ? 1 : 0.5
                                                            }}
                                                        >
                                                            <Star size={16} fill={m.favorito ? '#facc15' : 'none'} />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleTag(m, 'tag_motorista')}
                                                            title={m.tag_motorista === 'PROBLEMÁTICO' ? 'Remover tag problemático' : 'Marcar como problemático'}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                                                color: m.tag_motorista === 'PROBLEMÁTICO' ? '#f87171' : '#334155',
                                                                opacity: m.tag_motorista === 'PROBLEMÁTICO' ? 1 : 0.5
                                                            }}
                                                        >
                                                            <AlertTriangle size={16} fill={m.tag_motorista === 'PROBLEMÁTICO' ? '#f87171' : 'none'} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '120px' }}>
                                                        {m.comprovante_pdf && <a href={m.comprovante_pdf} download={`PDF_ORIG_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>PDF Orig.</a>}
                                                        {m.anexo_cnh && <a href={m.anexo_cnh} download={`CNH_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>CNH</a>}
                                                        {m.anexo_doc_veiculo && <a href={m.anexo_doc_veiculo} download={`CRLV_CAV_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>CRLV Cav.</a>}
                                                        {m.anexo_crlv_carreta && <a href={m.anexo_crlv_carreta} download={`CRLV_CAR_${m.placa2 || 'CARRETA'}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#fb923c', textDecoration: 'none', background: 'rgba(251,146,60,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(251,146,60,0.3)' }}>CRLV Car.</a>}
                                                        {m.anexo_antt && <a href={m.anexo_antt} download={`ANTT_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>ANTT</a>}
                                                        {m.anexo_outros && <a href={m.anexo_outros} download={`OUTROS_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>Outros</a>}
                                                    </div>
                                                </td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button style={{ ...s.btn('blue'), padding: '6px 8px' }} onClick={() => setModalMarcacao(m)} title="Ver detalhes da marcação">
                                                            <Eye size={14} />
                                                        </button>
                                                        <button style={{ ...s.btn('red'), padding: '6px 8px' }} onClick={() => excluirMarcacao(m.id)} title="Remover da fila">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Paginação server-side */}
                            {(() => {
                                const totalPaginas = Math.ceil(totalMarcacoes / ITENS_POR_PAGINA);
                                if (totalPaginas <= 1) return null;
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => carregarMarcacoes(paginaMarcacoes - 1)}
                                            disabled={paginaMarcacoes <= 1}
                                            style={{ padding: '6px 12px', fontSize: '12px', background: paginaMarcacoes <= 1 ? '#1e293b' : '#334155', color: paginaMarcacoes <= 1 ? '#475569' : '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', cursor: paginaMarcacoes <= 1 ? 'default' : 'pointer' }}
                                        >
                                            ← Anterior
                                        </button>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            Página {paginaMarcacoes} de {totalPaginas} ({totalMarcacoes} registros)
                                        </span>
                                        <button
                                            onClick={() => carregarMarcacoes(paginaMarcacoes + 1)}
                                            disabled={paginaMarcacoes >= totalPaginas}
                                            style={{ padding: '6px 12px', fontSize: '12px', background: paginaMarcacoes >= totalPaginas ? '#1e293b' : '#334155', color: paginaMarcacoes >= totalPaginas ? '#475569' : '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', cursor: paginaMarcacoes >= totalPaginas ? 'default' : 'pointer' }}
                                        >
                                            Próxima →
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </>
            )}


            {modalMarcacao && <ModalDetalhes m={modalMarcacao} onClose={() => setModalMarcacao(null)} />}
            {toast && <div style={s.toast}>{toast}</div>}
        </div>
    );
}
