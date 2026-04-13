import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const FAIXAS_TEMPO = [
    { label: 'Até 2 horas',    minutos: [0, 120] },
    { label: '2h a 6 horas',   minutos: [120, 360] },
    { label: '6h a 12 horas',  minutos: [360, 720] },
    { label: '12h a 24 horas', minutos: [720, 1440] },
    { label: '1 a 3 dias',     minutos: [1440, 4320] },
    { label: '3 a 7 dias',     minutos: [4320, 10080] },
    { label: '7 a 15 dias',    minutos: [10080, 21600] },
];

export default function GestaoMarcacoes({ socket }) {
    const [aba, setAba] = useState('links');
    const [tokens, setTokens] = useState([]);
    const [marcacoes, setMarcacoes] = useState([]);
    const [confirmar, setConfirmar] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tel, setTel] = useState('');
    const [copiado, setCopiado] = useState(null);
    const [toast, setToast] = useState('');
    const [buscaLinks, setBuscaLinks] = useState('');
    const [buscaMarcacoes, setBuscaMarcacoes] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroDisponibilidade, setFiltroDisponibilidade] = useState('');
    const [filtroStatusOp, setFiltroStatusOp] = useState('');
    const [filtroTag, setFiltroTag] = useState('');
    const [filtroTipoVeiculo, setFiltroTipoVeiculo] = useState('');
    const [filtroTempo, setFiltroTempo] = useState('');
    const [paginaMarcacoes, setPaginaMarcacoes] = useState(1);
    const [totalMarcacoes, setTotalMarcacoes] = useState(0);
    const [contadoresMarcacoes, setContadoresMarcacoes] = useState(null);
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

    // Ref sempre aponta para a versão mais recente de carregarMarcacoes
    // Evita re-registro do socket listener a cada tecla digitada (race condition)
    const carregarMarcacoesRef = useRef(null);
    // AbortController da última request — cancela requests obsoletas (evita race condition HTTP)
    const abortMarcacoesRef = useRef(null);

    const carregarMarcacoes = useCallback(async (pagina = 1) => {
        // Cancela request anterior se ainda estiver em voo
        if (abortMarcacoesRef.current) abortMarcacoesRef.current.abort();
        const controller = new AbortController();
        abortMarcacoesRef.current = controller;

        setLoading(true);
        try {
            const qp = new URLSearchParams({ page: pagina, limit: ITENS_POR_PAGINA });
            // Filtro de local (NO PÁTIO, NO POSTO, EM CASA) e status (disponivel, indisponivel, contratado) são independentes
            if (filtroDisponibilidade) qp.set('local', filtroDisponibilidade);
            if (filtroStatusOp) qp.set('disponibilidade', filtroStatusOp);
            if (buscaMarcacoes.trim()) qp.set('busca', buscaMarcacoes.trim());
            if (filtroEstado) qp.set('estado', filtroEstado);
            if (filtroTipoVeiculo) qp.set('tipo_veiculo', filtroTipoVeiculo);
            if (filtroTag) qp.set('tag', filtroTag);
            if (filtroTempo) {
                const faixa = FAIXAS_TEMPO.find(f => f.label === filtroTempo);
                if (faixa) { qp.set('tempo_min', faixa.minutos[0]); qp.set('tempo_max', faixa.minutos[1]); }
            }
            const r = await api.get(`/api/marcacoes?${qp}`, { signal: controller.signal });
            if (r.data.success) {
                setMarcacoes(r.data.marcacoes);
                setTotalMarcacoes(r.data.total || 0);
                setPaginaMarcacoes(pagina);
                if (r.data.contadores) setContadoresMarcacoes(r.data.contadores);
            }
        } catch (e) {
            if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
            console.error(e); mostrarToast('Erro ao carregar marcações.');
        }
        finally { setLoading(false); }
    }, [filtroDisponibilidade, filtroStatusOp, buscaMarcacoes, filtroEstado, filtroTipoVeiculo, filtroTag, filtroTempo]); // eslint-disable-line react-hooks/exhaustive-deps

    // Atualiza o ref sempre que carregarMarcacoes muda (nova busca, novo filtro, etc.)
    useEffect(() => { carregarMarcacoesRef.current = carregarMarcacoes; }, [carregarMarcacoes]);

    // Carregar tokens ao mudar para aba links
    useEffect(() => {
        if (aba === 'links') carregarTokens();
    }, [aba, carregarTokens]);

    // Recarrega com debounce sempre que qualquer filtro ou texto muda
    // Debounce único cobre texto (evita request por tecla) e dropdowns (reage imediatamente pois buscaMarcacoes não muda)
    useEffect(() => {
        if (aba !== 'placas') return;
        const delay = buscaMarcacoes ? 400 : 0;
        const t = setTimeout(() => carregarMarcacoesRef.current?.(1), delay);
        return () => clearTimeout(t);
    }, [aba, buscaMarcacoes, filtroDisponibilidade, filtroStatusOp, filtroEstado, filtroTipoVeiculo, filtroTag, filtroTempo]); // eslint-disable-line react-hooks/exhaustive-deps

    const paginaMarcacoesRef = useRef(paginaMarcacoes);
    useEffect(() => { paginaMarcacoesRef.current = paginaMarcacoes; }, [paginaMarcacoes]);

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
            // Usa o ref para garantir que sempre chama a versão mais recente
            // (com buscaMarcacoes atual, evitando race condition com a busca)
            if (payload?.tipo === 'nova_marcacao') {
                carregarMarcacoesRef.current?.(1);
                return;
            }
            carregarMarcacoesRef.current?.(paginaMarcacoesRef.current);
        };
        socket.on('marcacao_atualizada', atualizar);
        return () => { socket.off('marcacao_atualizada', atualizar); };
    }, [socket, aba]); // carregarMarcacoes removido — usa ref para sempre ter a versão atual

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

    async function handleAvancarStatus(m) {
        const atual = m.status_operacional || 'DISPONIVEL';
        // EM VIAGEM e EM ROTA são equivalentes a CONTRATADO (gerados automaticamente pelo sistema)
        const fluxo = { DISPONIVEL: 'EM OPERACAO', 'EM OPERACAO': 'CONTRATADO', CONTRATADO: 'DISPONIVEL', 'EM VIAGEM': 'DISPONIVEL', 'EM ROTA': 'DISPONIVEL' };
        const novoStatus = fluxo[atual] || 'DISPONIVEL';
        try {
            const r = await api.put(`/api/marcacoes/${m.id}/status`, { status_operacional: novoStatus });
            if (r.data.success) {
                setMarcacoes(prev => prev.map(x => x.id === m.id ? { ...x, status_operacional: novoStatus } : x));
            }
        } catch (e) { mostrarToast('Erro ao atualizar status.'); }
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

    // Filtros são server-side; apenas exclui registros is_frota que eventualmente cheguem
    const marcacoesFiltradas = useMemo(() => marcacoes.filter(m => !m.is_frota), [marcacoes]);

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
                            <select
                                value={filtroTipoVeiculo}
                                onChange={e => setFiltroTipoVeiculo(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '130px', maxWidth: '170px',
                                    cursor: 'pointer', color: filtroTipoVeiculo ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroTipoVeiculo ? '700' : '400'
                                }}
                            >
                                <option value="">Todos os tipos</option>
                                <option value="Truck">Truck</option>
                                <option value="Bi-Truck">Bi-Truck</option>
                                <option value="Carreta 4 Eixos">Carreta 4 Eixos</option>
                                <option value="Carreta 5 Eixos">Carreta 5 Eixos</option>
                                <option value="Carreta 6 Eixos">Carreta 6 Eixos</option>
                            </select>
                            <select
                                value={filtroTempo}
                                onChange={e => setFiltroTempo(e.target.value)}
                                style={{
                                    ...s.input,
                                    minWidth: '140px', maxWidth: '180px',
                                    cursor: 'pointer', color: filtroTempo ? '#60a5fa' : '#64748b',
                                    fontWeight: filtroTempo ? '700' : '400'
                                }}
                            >
                                <option value="">Fila (tempo)</option>
                                {FAIXAS_TEMPO.map(f => (
                                    <option key={f.label} value={f.label}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <button style={s.btn()} onClick={() => carregarMarcacoes(paginaMarcacoes)}>
                            <RefreshCw size={14} /> Atualizar
                        </button>
                    </div>

                    {contadoresMarcacoes && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {[
                                { label: 'Total', valor: contadoresMarcacoes.total, filtro: '', cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
                                { label: 'Disponível', valor: contadoresMarcacoes.disponiveis, filtro: 'disponivel', cor: '#4ade80', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
                                { label: 'Em Operação', valor: contadoresMarcacoes.em_operacao, filtro: 'contratado', cor: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
                                { label: 'Contratado', valor: contadoresMarcacoes.contratados, filtro: 'contratado', cor: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
                                { label: 'Indisponível', valor: contadoresMarcacoes.indisponiveis, filtro: 'indisponivel', cor: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
                            ].map(({ label, valor, filtro, cor, bg, border }) => (
                                <button
                                    key={label}
                                    onClick={() => setFiltroStatusOp(filtroStatusOp === filtro ? '' : filtro)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                                        background: filtroStatusOp === filtro ? bg : 'rgba(0,0,0,0.2)',
                                        border: `1px solid ${filtroStatusOp === filtro ? border : 'rgba(255,255,255,0.07)'}`,
                                        color: filtroStatusOp === filtro ? cor : '#64748b',
                                        fontWeight: '600', fontSize: '12px',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
                                    <span style={{ fontWeight: '800', fontSize: '14px', color: filtroStatusOp === filtro ? cor : '#94a3b8' }}>{valor}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div style={s.empty}>Carregando...</div>
                    ) : marcacoes.length === 0 ? (
                        <div style={s.empty}>Nenhuma marcação registrada.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ ...s.table, tableLayout: 'fixed', minWidth: '900px', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...s.th, width: '180px' }}>Motorista</th>
                                        <th style={{ ...s.th, width: '90px' }}>Placas</th>
                                        <th style={{ ...s.th, width: '80px' }}>Veículo</th>
                                        <th style={{ ...s.th, width: '75px' }}>Destinos</th>
                                        <th style={{ ...s.th, width: '100px' }}>Rastreador</th>
                                        <th style={{ ...s.th, width: '105px' }}>Local</th>
                                        <th style={{ ...s.th, width: '105px' }}>Status</th>
                                        <th style={{ ...s.th, width: '55px' }}>Viagens</th>
                                        <th style={{ ...s.th, width: '65px' }}>Tempo</th>
                                        <th style={{ ...s.th, width: '115px' }}>Marcado em</th>
                                        <th style={{ ...s.th, width: '90px' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marcacoesFiltradas.map(m => {
                                        void tick;
                                        const tempoMin = calcularTempoEspera(m.data_marcacao, m.data_contratacao);
                                        const statusOp = m.status_operacional || 'DISPONIVEL';
                                        const isContratado = ['CONTRATADO', 'EM VIAGEM', 'EM ROTA'].includes(statusOp);
                                        const statusLabel = statusOp === 'DISPONIVEL' ? 'Disponível' : statusOp === 'EM OPERACAO' ? 'Em Operação' : isContratado ? 'Contratado' : statusOp;
                                        const statusCor = statusOp === 'DISPONIVEL' ? { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', border: 'rgba(34,197,94,0.25)' } : statusOp === 'EM OPERACAO' ? { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.25)' } : { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', border: 'rgba(251,146,60,0.25)' };
                                        const temAnexos = m.comprovante_pdf || m.anexo_cnh || m.anexo_doc_veiculo || m.anexo_crlv_carreta || m.anexo_antt || m.anexo_outros;
                                        return (
                                            <tr key={m.id}>
                                                {/* Motorista */}
                                                <td style={{ ...s.td, maxWidth: '180px' }}>
                                                    <div style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {m.nome_motorista}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px' }}>
                                                        {m.favorito ? <span style={{ fontSize: '9px', fontWeight: '700', color: '#facc15', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '3px', padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Star size={7} fill="#facc15" />FAV</span> : null}
                                                        {m.tag_motorista === 'PROBLEMÁTICO' ? <span style={{ fontSize: '9px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><AlertTriangle size={7} />PROB</span> : null}
                                                        {!m.is_frota && m.ja_carregou === 'Nao' && (m.viagens_realizadas ?? 0) < 2 ? <span style={{ fontSize: '9px', fontWeight: '700', color: '#fb923c', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '3px', padding: '0 4px' }}>NOVATO</span> : null}
                                                    </div>
                                                    {linkWpp(m.telefone) ? (
                                                        <a href={linkWpp(m.telefone)} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', fontSize: '10px', textDecoration: 'none' }}>
                                                            {formatarTelefone(m.telefone)}
                                                        </a>
                                                    ) : <span style={{ color: '#475569', fontSize: '10px' }}>{formatarTelefone(m.telefone)}</span>}
                                                </td>
                                                {/* Placas */}
                                                <td style={s.td}>
                                                    <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '11px' }}>{m.placa1}</div>
                                                    {m.placa2 && <div style={{ color: '#94a3b8', fontSize: '10px' }}>{m.placa2}</div>}
                                                </td>
                                                {/* Veículo */}
                                                <td style={{ ...s.td, fontSize: '11px' }}>{m.tipo_veiculo || '—'}</td>
                                                {/* Destinos */}
                                                <td style={{ ...s.td, fontSize: '11px' }}>{Array.isArray(m.estados_destino) ? m.estados_destino.join(', ') : '—'}</td>
                                                {/* Rastreador */}
                                                <td style={s.td}>
                                                    <div style={{ fontSize: '11px' }}>{m.rastreador || '—'}</div>
                                                    <div style={{ fontSize: '10px', color: m.status_rastreador === 'Ativo' ? '#4ade80' : '#64748b' }}>{m.status_rastreador}</div>
                                                </td>
                                                {/* Local */}
                                                <td style={s.td}>
                                                    <select
                                                        value={['EM CASA', 'NO PÁTIO', 'NO POSTO'].includes(m.disponibilidade) ? m.disponibilidade : ''}
                                                        onChange={e => e.target.value && handleAtualizarLocalizacao(m.id, e.target.value)}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '5px', padding: '3px 6px',
                                                            color: corDisponibilidade(m.disponibilidade),
                                                            fontSize: '10px', fontWeight: '700', cursor: 'pointer', outline: 'none', width: '100%'
                                                        }}
                                                    >
                                                        <option value="" style={{ color: '#475569' }}>— local —</option>
                                                        <option value="EM CASA" style={{ color: 'black' }}>EM CASA</option>
                                                        <option value="NO PÁTIO" style={{ color: 'black' }}>NO PÁTIO</option>
                                                        <option value="NO POSTO" style={{ color: 'black' }}>NO POSTO</option>
                                                    </select>
                                                    {m.disponibilidade === 'Indisponível' && (
                                                        <div style={{ fontSize: '9px', color: '#f87171', fontWeight: '700', marginTop: '2px' }}>INDISPONÍVEL</div>
                                                    )}
                                                </td>
                                                {/* Status clicável */}
                                                <td style={s.td}>
                                                    <button
                                                        onClick={() => handleAvancarStatus(m)}
                                                        title="Clique para avançar: Disponível → Em Operação → Contratado"
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '20px',
                                                            fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                                                            background: statusCor.bg, color: statusCor.color,
                                                            border: `1px solid ${statusCor.border}`,
                                                        }}
                                                    >
                                                        {statusLabel}
                                                    </button>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', cursor: 'pointer', fontSize: '10px', color: m.disponibilidade === 'Indisponível' ? '#f87171' : '#475569' }}>
                                                        <input type="checkbox" checked={m.disponibilidade === 'Indisponível'} onChange={() => handleToggleIndisponivel(m.id, m.disponibilidade)} style={{ accentColor: '#ef4444', width: '12px', height: '12px' }} />
                                                        Indisp.
                                                    </label>
                                                </td>
                                                {/* Viagens */}
                                                <td style={{ ...s.td, textAlign: 'center' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#facc15', fontWeight: '700', fontSize: '12px' }}>
                                                        <Award size={12} />{m.viagens_realizadas ?? 0}
                                                    </span>
                                                </td>
                                                {/* Tempo */}
                                                <td style={s.td}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '700', color: corTempo(tempoMin) }}>
                                                        <Clock size={11} />{formatarTempo(tempoMin)}
                                                    </span>
                                                </td>
                                                {/* Marcado em */}
                                                <td style={{ ...s.td, fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                    {formatarData(m.data_marcacao)}
                                                </td>
                                                {/* Ações */}
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        <button onClick={() => toggleTag(m, 'favorito')} title={m.favorito ? 'Remover favorito' : 'Favorito'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: m.favorito ? '#facc15' : '#334155' }}>
                                                            <Star size={14} fill={m.favorito ? '#facc15' : 'none'} />
                                                        </button>
                                                        <button onClick={() => toggleTag(m, 'tag_motorista')} title={m.tag_motorista === 'PROBLEMÁTICO' ? 'Remover tag' : 'Problemático'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: m.tag_motorista === 'PROBLEMÁTICO' ? '#f87171' : '#334155' }}>
                                                            <AlertTriangle size={14} fill={m.tag_motorista === 'PROBLEMÁTICO' ? '#f87171' : 'none'} />
                                                        </button>
                                                        {m.latitude && m.longitude && (
                                                            <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`} target="_blank" rel="noreferrer" title="Ver localização" style={{ display: 'inline-flex', alignItems: 'center', padding: '2px', color: '#60a5fa' }}>
                                                                <MapPin size={14} />
                                                            </a>
                                                        )}
                                                        <button onClick={() => setModalMarcacao(m)} title="Ver detalhes" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#f87171' }} onClick={() => excluirMarcacao(m.id)} title="Remover">
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
