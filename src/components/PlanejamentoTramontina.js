import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Calendar, Plus, Trash2, ChevronDown, ChevronRight, Upload,
    RefreshCw, MapPin, Filter, Edit3
} from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';
import {
    TRAMONTINA_OPERACAO_CODIGOS, TRAMONTINA_TIPO_VEICULO,
    TRAMONTINA_STATUS_AGENDAMENTO, TRAMONTINA_STATUS_EMBARQUE,
    TRAMONTINA_REGIAO_NOMES, UFS_BRASIL,
} from '../constants';
import ModalImportarTramontina from './ModalImportarTramontina';
import KpisStrip from './planejamento/KpisStrip';
import CardRota from './planejamento/CardRota';

const STATUS_FINANCEIRO_OPCOES = [
    { value: '', label: 'Status Fin. · Todos' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'EM_ROTA_DE_ENTREGA', label: 'Em rota de entrega' },
    { value: 'CONCLUIDO', label: 'Concluído' },
];

const COR_LEAD = {
    ANTECIPADO: '#22c55e',
    DENTRO: '#3b82f6',
    FORA: '#ef4444',
    AGUARDANDO: '#64748b',
};
const COR_STATUS = {
    PROGRAMADA: '#3b82f6',
    EMBARCADA: '#22c55e',
    PENDENTE: '#f59e0b',
};

const glass = {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
};
const inputCelula = {
    width: '100%', padding: '4px 6px', background: 'transparent',
    border: '1px solid transparent', borderRadius: '4px',
    color: '#e2e8f0', fontSize: '12px', outline: 'none',
};

function mesAtualISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(iso) {
    if (!iso) return '';
    const [y, m] = iso.split('-');
    const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${nomes[parseInt(m, 10) - 1]} / ${y}`;
}

export default function PlanejamentoTramontina({ socket }) {
    const { user, podeEditar: pode } = useAuthStore();
    // Mantém compat com permissão antiga + adiciona as novas do PlanejamentoDelta
    const podeEditar = typeof pode === 'function'
        ? (pode('delta_editar_operacional') || pode('tramontina_editar'))
        : false;
    const podeEditarFinanceiro = typeof pode === 'function'
        ? pode('delta_editar_financeiro')
        : false;

    const [mesRef, setMesRef] = useState(mesAtualISO());
    const [abaAtiva, setAbaAtiva] = useState('DELTA-PORCELANA');
    const [rotas, setRotas] = useState([]);
    const [kpis, setKpis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandidas, setExpandidas] = useState(new Set());
    const [modalImportar, setModalImportar] = useState(false);
    const [filtros, setFiltros] = useState({ uf: '', regiao: '', operacao: '', statusEmb: '', agendamento: '', statusFin: '' });
    const [edicoesAtivas, setEdicoesAtivas] = useState({}); // { rotaId__campo: { usuario, expira_em } }
    const fetchTimerRef = useRef(null);

    // ── Fetch ──
    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const [rRotas, rKpis] = await Promise.all([
                api.get(`/api/tramontina/rotas?mes=${mesRef}&aba=${abaAtiva}`),
                api.get(`/api/tramontina/kpis?mes=${mesRef}&aba=${abaAtiva}`),
            ]);
            if (rRotas.data?.success) setRotas(rRotas.data.rotas);
            if (rKpis.data?.success) setKpis(rKpis.data.kpis);
        } catch (e) {
            console.error('Erro carregar Planejamento:', e);
        } finally {
            setLoading(false);
        }
    }, [mesRef, abaAtiva]);

    useEffect(() => { carregar(); }, [carregar]);

    // ── Socket listeners ──
    useEffect(() => {
        if (!socket) return;
        const recarregar = () => {
            if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
            fetchTimerRef.current = setTimeout(carregar, 200);
        };
        const handleEditando = (data) => {
            if (!data?.rotaId || !data?.campo) return;
            setEdicoesAtivas(prev => ({ ...prev, [`${data.rotaId}__${data.campo}`]: { usuario: data.usuario, expira_em: data.expira_em } }));
        };
        socket.on('tramontina_rota_criada', recarregar);
        socket.on('tramontina_rota_atualizada', recarregar);
        socket.on('tramontina_rota_removida', recarregar);
        socket.on('tramontina_entrega_criada', recarregar);
        socket.on('tramontina_entrega_atualizada', recarregar);
        socket.on('tramontina_entrega_removida', recarregar);
        socket.on('tramontina_importacao_concluida', recarregar);
        socket.on('tramontina_usuario_editando', handleEditando);
        return () => {
            socket.off('tramontina_rota_criada', recarregar);
            socket.off('tramontina_rota_atualizada', recarregar);
            socket.off('tramontina_rota_removida', recarregar);
            socket.off('tramontina_entrega_criada', recarregar);
            socket.off('tramontina_entrega_atualizada', recarregar);
            socket.off('tramontina_entrega_removida', recarregar);
            socket.off('tramontina_importacao_concluida', recarregar);
            socket.off('tramontina_usuario_editando', handleEditando);
        };
    }, [socket, carregar]);

    // Limpar locks expirados
    useEffect(() => {
        const t = setInterval(() => {
            setEdicoesAtivas(prev => {
                const novo = {};
                const agora = Date.now();
                for (const [k, v] of Object.entries(prev)) {
                    if (v.expira_em > agora) novo[k] = v;
                }
                return novo;
            });
        }, 1500);
        return () => clearInterval(t);
    }, []);

    // ── Filtros ──
    const rotasFiltradas = useMemo(() => {
        return rotas.filter(r => {
            if (filtros.operacao && r.operacao_codigo !== filtros.operacao) return false;
            if (filtros.statusEmb && r.status_embarque !== filtros.statusEmb) return false;
            if (filtros.statusFin && r.status_financeiro !== filtros.statusFin) return false;
            if (filtros.uf || filtros.regiao || filtros.agendamento) {
                const ents = r.entregas || [];
                if (filtros.uf && !ents.some(e => e.uf === filtros.uf)) return false;
                if (filtros.regiao && !ents.some(e => e.regiao === filtros.regiao)) return false;
                if (filtros.agendamento && !ents.some(e => e.status_agendamento === filtros.agendamento)) return false;
            }
            return true;
        });
    }, [rotas, filtros]);

    // Resetar filtro financeiro ao trocar pra DELTA-PORCELANA (que não tem)
    function trocarAba(a) {
        setAbaAtiva(a);
        if (a !== 'ELETRIK') setFiltros(prev => ({ ...prev, statusFin: '' }));
    }

    // ── Ações ──
    const novaRota = async () => {
        if (!podeEditar) return;
        try {
            const r = await api.post('/api/tramontina/rotas', {
                mes_referencia: mesRef,
                aba_origem: abaAtiva,
                status_embarque: 'PROGRAMADA',
            });
            if (r.data?.success && r.data.rota?.id) {
                setExpandidas(prev => new Set([...prev, r.data.rota.id]));
            }
        } catch (e) { console.error(e); }
    };

    // Helper: PATCH (multi-campos) numa rota - usado pelos blocos novos
    const salvarRota = async (rotaId, patch) => {
        if (!podeEditar) return;
        try {
            await api.put(`/api/tramontina/rotas/${rotaId}`, patch);
        } catch (e) {
            if (e?.response?.status === 403) {
                window.alert('Sem permissão para editar esses campos.');
            } else {
                console.warn('Falha ao salvar rota:', e);
            }
        }
    };

    const removerRota = async (id) => {
        if (!podeEditar || !window.confirm('Remover esta rota e todas as entregas?')) return;
        try { await api.delete(`/api/tramontina/rotas/${id}`); } catch (e) { console.error(e); }
    };

    const editarRota = async (id, campo, valor) => {
        if (!podeEditar) return;
        try { await api.put(`/api/tramontina/rotas/${id}`, { [campo]: valor }); } catch (e) { console.error(e); }
    };

    const broadcastEditando = (rotaId, campo) => {
        if (!podeEditar || !socket) return;
        try { api.post('/api/tramontina/editando', { rotaId, campo }); } catch (_) {}
    };

    const novaEntrega = async (rotaId) => {
        if (!podeEditar) return;
        try { await api.post(`/api/tramontina/rotas/${rotaId}/entregas`, {}); } catch (e) { console.error(e); }
    };

    const editarEntrega = async (id, campo, valor) => {
        if (!podeEditar) return;
        try { await api.put(`/api/tramontina/entregas/${id}`, { [campo]: valor }); } catch (e) { console.error(e); }
    };

    const removerEntrega = async (id) => {
        if (!podeEditar) return;
        try { await api.delete(`/api/tramontina/entregas/${id}`); } catch (e) { console.error(e); }
    };

    const toggleExpandir = (id) => {
        setExpandidas(prev => {
            const novo = new Set(prev);
            if (novo.has(id)) novo.delete(id); else novo.add(id);
            return novo;
        });
    };

    return (
        <div style={{ padding: '10px 0', position: 'relative' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <Calendar size={22} color="#38bdf8" />
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>Planejamento</span>
                {loading && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <input
                    type="month"
                    value={mesRef}
                    onChange={e => setMesRef(e.target.value)}
                    style={{ marginLeft: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px', color: '#f1f5f9', fontSize: '13px' }}
                />
                <span style={{ color: '#64748b', fontSize: '13px' }}>{mesLabel(mesRef)}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button onClick={carregar} style={btnSecundario} title="Recarregar">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Seletor de aba */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['DELTA-PORCELANA', 'ELETRIK'].map(a => (
                    <button key={a}
                        onClick={() => trocarAba(a)}
                        style={{
                            background: abaAtiva === a ? 'rgba(167,139,250,0.2)' : 'transparent',
                            border: `1px solid ${abaAtiva === a ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                            color: abaAtiva === a ? '#a78bfa' : '#94a3b8',
                            padding: '7px 16px', borderRadius: 6,
                            fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                            cursor: 'pointer', textTransform: 'uppercase',
                        }}>
                        {a}
                    </button>
                ))}
            </div>

            {/* KPIs */}
            {kpis && <KpisStrip kpis={kpis} abaAtiva={abaAtiva} />}

            {/* Filtros */}
            <div style={{ ...glass, padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Filter size={14} color="#64748b" />
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Filtros</span>
                <select value={filtros.operacao} onChange={e => setFiltros({...filtros, operacao: e.target.value})} style={selectFiltro}>
                    <option value="">Operação · Todas</option>
                    {TRAMONTINA_OPERACAO_CODIGOS.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.label}</option>)}
                </select>
                <select value={filtros.statusEmb} onChange={e => setFiltros({...filtros, statusEmb: e.target.value})} style={selectFiltro}>
                    <option value="">Status · Todos</option>
                    {TRAMONTINA_STATUS_EMBARQUE.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filtros.regiao} onChange={e => setFiltros({...filtros, regiao: e.target.value})} style={selectFiltro}>
                    <option value="">Região · Todas</option>
                    {Object.entries(TRAMONTINA_REGIAO_NOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filtros.uf} onChange={e => setFiltros({...filtros, uf: e.target.value})} style={selectFiltro}>
                    <option value="">UF · Todas</option>
                    {UFS_BRASIL.filter(u => u !== 'EX').map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={filtros.agendamento} onChange={e => setFiltros({...filtros, agendamento: e.target.value})} style={selectFiltro}>
                    <option value="">Agend. · Todos</option>
                    {TRAMONTINA_STATUS_AGENDAMENTO.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {abaAtiva === 'ELETRIK' && (
                    <select value={filtros.statusFin} onChange={e => setFiltros({...filtros, statusFin: e.target.value})} style={selectFiltro}>
                        {STATUS_FINANCEIRO_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                )}
                {(filtros.operacao || filtros.statusEmb || filtros.regiao || filtros.uf || filtros.agendamento || filtros.statusFin) && (
                    <button onClick={() => setFiltros({uf:'',regiao:'',operacao:'',statusEmb:'',agendamento:'',statusFin:''})} style={{ ...btnSecundario, fontSize: '11px', padding: '4px 10px' }}>
                        Limpar
                    </button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b' }}>
                    {rotasFiltradas.length} de {rotas.length} rotas
                </span>
            </div>

            {/* Cards */}
            <div>
                {rotasFiltradas.length === 0 && !loading ? (
                    <div style={{
                        padding: 40, textAlign: 'center', color: '#475569', fontSize: 13,
                        background: 'rgba(15,23,42,0.4)', borderRadius: 8,
                    }}>
                        {rotas.length === 0
                            ? `Nenhuma rota cadastrada para ${abaAtiva} em ${mesLabel(mesRef)}.`
                            : 'Nenhuma rota corresponde aos filtros.'}
                    </div>
                ) : (
                    rotasFiltradas.map(rota => (
                        <CardRota
                            key={rota.id}
                            rota={rota}
                            entregas={rota.entregas || []}
                            expanded={expandidas.has(rota.id)}
                            onToggle={() => toggleExpandir(rota.id)}
                            abaAtiva={abaAtiva}
                            podeEditarOperacional={podeEditar}
                            podeEditarFinanceiro={podeEditarFinanceiro}
                            onSalvarRota={(patch) => salvarRota(rota.id, patch)}
                            onAlteradoEntregas={carregar}
                        />
                    ))
                )}
            </div>

            {/* Botão flutuante Nova rota */}
            {podeEditar && (
                <button onClick={novaRota}
                    title="Nova rota"
                    style={{
                        position: 'fixed', bottom: 24, right: 24, zIndex: 100,
                        background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                        color: '#fff', border: 'none', borderRadius: '50%',
                        width: 56, height: 56, fontSize: 28, fontWeight: 700,
                        boxShadow: '0 8px 20px rgba(167,139,250,0.4)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    +
                </button>
            )}

            {modalImportar && (
                <ModalImportarTramontina
                    mesRef={mesRef}
                    onFechar={() => setModalImportar(false)}
                    onImportado={carregar}
                />
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ── KPI Dashboard ───────────────────────────────────────────────────────
function KpiDashboard({ kpis }) {
    const { rotas, leadTime, regioes, totalEntregas } = kpis;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <CardKpi titulo="Rotas" cor="#38bdf8">
                <div style={{ display: 'flex', gap: '14px' }}>
                    <Mini label="Total" valor={rotas.total} cor="#38bdf8" />
                    <Mini label="Programadas" valor={rotas.programadas} cor={COR_STATUS.PROGRAMADA} />
                    <Mini label="Embarcadas" valor={rotas.embarcadas} cor={COR_STATUS.EMBARCADA} />
                    <Mini label="Pendentes" valor={rotas.pendentes} cor={COR_STATUS.PENDENTE} />
                </div>
            </CardKpi>
            <CardKpi titulo="Lead Time" cor="#22c55e">
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Mini label="Antecipado" valor={`${leadTime.pctAntecipado}%`} cor={COR_LEAD.ANTECIPADO} sub={`${leadTime.antecipado}`} />
                    <Mini label="Dentro" valor={`${leadTime.pctDentro}%`} cor={COR_LEAD.DENTRO} sub={`${leadTime.dentro}`} />
                    <Mini label="Fora" valor={`${leadTime.pctFora}%`} cor={COR_LEAD.FORA} sub={`${leadTime.fora}`} />
                    <Mini label="Aguardando" valor={`${leadTime.pctAguardando}%`} cor={COR_LEAD.AGUARDANDO} sub={`${leadTime.aguardando}`} />
                </div>
            </CardKpi>
            <CardKpi titulo="Regiões" cor="#a855f7">
                <div style={{ display: 'flex', gap: '10px' }}>
                    {Object.entries(regioes).map(([sigla, qtd]) => (
                        <Mini key={sigla} label={sigla} valor={qtd} cor="#a855f7" />
                    ))}
                </div>
            </CardKpi>
            <CardKpi titulo="Entregas" cor="#f59e0b">
                <div style={{ fontSize: '38px', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{totalEntregas}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>destinos cadastrados</div>
            </CardKpi>
        </div>
    );
}

function CardKpi({ titulo, cor, children }) {
    return (
        <div style={{ ...glass, padding: '14px 16px', borderTop: `3px solid ${cor}` }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{titulo}</div>
            {children}
        </div>
    );
}

function Mini({ label, valor, cor, sub }) {
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: cor, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>{label}{sub ? ` (${sub})` : ''}</div>
        </div>
    );
}

// ── Linha da Rota ───────────────────────────────────────────────────────
function RotaLinha({ rota, expandida, onToggle, onEditar, onRemover, onNovaEntrega, onEditarEntrega, onRemoverEntrega, onEditando, edicoesAtivas, podeEditar, usuarioAtual }) {
    return (
        <>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Td>
                    <button onClick={onToggle} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }} title={expandida ? 'Recolher' : 'Expandir entregas'}>
                        {expandida ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                </Td>
                <Td style={{ fontWeight: 700, color: '#94a3b8' }}>{rota.numero_rota}</Td>
                <Td><Celula valor={rota.coleta} onSalvar={v => onEditar(rota.id, 'coleta', v)} onFocus={() => onEditando(rota.id, 'coleta')} editavel={podeEditar} lock={edicoesAtivas[`${rota.id}__coleta`]} usuarioAtual={usuarioAtual} /></Td>
                <Td><CelulaSelect valor={rota.operacao_codigo} opcoes={TRAMONTINA_OPERACAO_CODIGOS.map(o => ({ value: o.codigo, label: o.codigo }))} onSalvar={v => onEditar(rota.id, 'operacao_codigo', v)} editavel={podeEditar} /></Td>
                <Td><CelulaSelect valor={rota.tipo_veiculo} opcoes={TRAMONTINA_TIPO_VEICULO.map(t => ({ value: t, label: t }))} onSalvar={v => onEditar(rota.id, 'tipo_veiculo', v)} editavel={podeEditar} /></Td>
                <Td><Celula tipo="date" valor={rota.data_prevista} onSalvar={v => onEditar(rota.id, 'data_prevista', v || null)} editavel={podeEditar} /></Td>
                <Td><Celula tipo="date" valor={rota.data_embarque} onSalvar={v => onEditar(rota.id, 'data_embarque', v || null)} editavel={podeEditar} /></Td>
                <Td><Celula valor={rota.motorista_nome} onSalvar={v => onEditar(rota.id, 'motorista_nome', v)} onFocus={() => onEditando(rota.id, 'motorista_nome')} editavel={podeEditar} lock={edicoesAtivas[`${rota.id}__motorista_nome`]} usuarioAtual={usuarioAtual} /></Td>
                <Td><Celula valor={rota.placa_cavalo} onSalvar={v => onEditar(rota.id, 'placa_cavalo', (v || '').toUpperCase())} editavel={podeEditar} /></Td>
                <Td><Celula valor={rota.placa_carreta} onSalvar={v => onEditar(rota.id, 'placa_carreta', (v || '').toUpperCase())} editavel={podeEditar} /></Td>
                <Td><Celula valor={rota.redespacho} onSalvar={v => onEditar(rota.id, 'redespacho', v)} editavel={podeEditar} /></Td>
                <Td>
                    <CelulaSelect
                        valor={rota.status_embarque}
                        opcoes={TRAMONTINA_STATUS_EMBARQUE.map(s => ({ value: s, label: s }))}
                        onSalvar={v => onEditar(rota.id, 'status_embarque', v)}
                        cor={COR_STATUS[rota.status_embarque]}
                        editavel={podeEditar}
                    />
                </Td>
                <Td>
                    {podeEditar && (
                        <button onClick={() => onRemover(rota.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} title="Remover rota">
                            <Trash2 size={13} />
                        </button>
                    )}
                </Td>
            </tr>
            {expandida && (
                <tr>
                    <td colSpan={13} style={{ padding: '8px 16px 16px 50px', background: 'rgba(255,255,255,0.02)' }}>
                        <EntregasExpandidas
                            rota={rota}
                            podeEditar={podeEditar}
                            onNova={() => onNovaEntrega(rota.id)}
                            onEditar={onEditarEntrega}
                            onRemover={onRemoverEntrega}
                        />
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Entregas (sub-tabela) ──────────────────────────────────────────────
function EntregasExpandidas({ rota, podeEditar, onNova, onEditar, onRemover }) {
    const entregas = rota.entregas || [];
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} /> Entregas ({entregas.length})
                </div>
                {podeEditar && (
                    <button onClick={onNova} style={{ ...btnSecundario, fontSize: '10px', padding: '3px 8px' }}>
                        <Plus size={11} /> Adicionar entrega
                    </button>
                )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                    <tr style={{ color: '#64748b' }}>
                        <Th compact>Cidade</Th>
                        <Th compact style={{ width: 50 }}>UF</Th>
                        <Th compact style={{ width: 50 }}>Reg</Th>
                        <Th compact>Cliente</Th>
                        <Th compact>NFs</Th>
                        <Th compact style={{ width: 80 }}>Agend.</Th>
                        <Th compact style={{ width: 110 }}>Data Entrega</Th>
                        <Th compact style={{ width: 70 }}>Dias Úteis</Th>
                        <Th compact style={{ width: 110 }}>Lead</Th>
                        <Th compact style={{ width: 30 }}></Th>
                    </tr>
                </thead>
                <tbody>
                    {entregas.map(e => (
                        <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <Td><Celula valor={e.cidade} onSalvar={v => onEditar(e.id, 'cidade', v)} editavel={podeEditar} /></Td>
                            <Td><Celula valor={e.uf} onSalvar={v => onEditar(e.id, 'uf', (v || '').toUpperCase().slice(0, 2))} editavel={podeEditar} /></Td>
                            <Td style={{ color: '#94a3b8', textAlign: 'center' }}>{e.regiao || '—'}</Td>
                            <Td><Celula valor={e.cliente} onSalvar={v => onEditar(e.id, 'cliente', v)} editavel={podeEditar} /></Td>
                            <Td><Celula valor={e.notas_fiscais} onSalvar={v => onEditar(e.id, 'notas_fiscais', v)} editavel={podeEditar} /></Td>
                            <Td><CelulaSelect valor={e.status_agendamento} opcoes={TRAMONTINA_STATUS_AGENDAMENTO.map(a => ({ value: a, label: a }))} onSalvar={v => onEditar(e.id, 'status_agendamento', v)} editavel={podeEditar} /></Td>
                            <Td><Celula tipo="date" valor={e.data_entrega_cliente} onSalvar={v => onEditar(e.id, 'data_entrega_cliente', v || null)} editavel={podeEditar} /></Td>
                            <Td style={{ textAlign: 'center', color: '#94a3b8' }}>{e.dias_uteis ?? '—'}</Td>
                            <Td>
                                <span style={{
                                    display: 'inline-block', padding: '2px 8px', borderRadius: '8px',
                                    background: (COR_LEAD[e.lead_status] || '#64748b') + '22',
                                    color: COR_LEAD[e.lead_status] || '#94a3b8',
                                    fontSize: '10px', fontWeight: 700,
                                }}>
                                    {e.lead_status || 'AGUARDANDO'}
                                </span>
                            </Td>
                            <Td>
                                {podeEditar && (
                                    <button onClick={() => onRemover(e.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Remover entrega">
                                        <Trash2 size={11} />
                                    </button>
                                )}
                            </Td>
                        </tr>
                    ))}
                    {entregas.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: '12px', textAlign: 'center', color: '#475569', fontSize: '11px' }}>
                            Sem entregas. {podeEditar && 'Clique em "Adicionar entrega" para começar.'}
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ── Célula editável ────────────────────────────────────────────────────
function Celula({ valor, onSalvar, onFocus, tipo = 'text', editavel = true, lock, usuarioAtual }) {
    const [v, setV] = useState(valor ?? '');
    useEffect(() => { setV(valor ?? ''); }, [valor]);
    const lockAtivo = lock && lock.usuario && lock.usuario !== usuarioAtual;
    if (!editavel) {
        return <span style={{ color: '#94a3b8' }}>{valor || '—'}</span>;
    }
    return (
        <div style={{ position: 'relative' }}>
            <input
                type={tipo}
                value={v}
                onChange={e => setV(e.target.value)}
                onFocus={() => onFocus && onFocus()}
                onBlur={() => { if ((v ?? '') !== (valor ?? '')) onSalvar(v); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ ...inputCelula, ...(lockAtivo ? { borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)' } : {}) }}
            />
            {lockAtivo && (
                <div title={`Editado por ${lock.usuario}`} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                    <Edit3 size={10} />
                </div>
            )}
        </div>
    );
}

function CelulaSelect({ valor, opcoes, onSalvar, cor, editavel = true }) {
    if (!editavel) {
        return <span style={{ color: cor || '#94a3b8' }}>{valor || '—'}</span>;
    }
    return (
        <select
            value={valor || ''}
            onChange={e => onSalvar(e.target.value || null)}
            style={{ ...inputCelula, color: cor || '#e2e8f0' }}
        >
            <option value="">—</option>
            {opcoes.map(o => <option key={o.value} value={o.value} style={{ color: '#000' }}>{o.label}</option>)}
        </select>
    );
}

function Th({ children, style = {}, compact }) {
    return <th style={{ padding: compact ? '4px 6px' : '8px 10px', textAlign: 'left', fontSize: compact ? '9.5px' : '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748b', ...style }}>{children}</th>;
}
function Td({ children, style = {} }) {
    return <td style={{ padding: '4px 8px', fontSize: '12px', color: '#e2e8f0', verticalAlign: 'middle', ...style }}>{children}</td>;
}

const btnPrimario = {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none', borderRadius: '8px', padding: '7px 14px',
    color: '#fff', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
};
const btnSecundario = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '7px 12px', color: '#cbd5e1',
    fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
};
const selectFiltro = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '4px 8px', color: '#e2e8f0', fontSize: '11px', outline: 'none',
};
