import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/apiService';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Search, Clock, AlertTriangle, CheckCircle, Archive, Edit2, Trash2, Image, FileText, ChevronDown, ExternalLink } from 'lucide-react';

// ──────────── Helpers ────────────────────────────────────
const formatData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function calcularHorasAtraso(oc) {
    const inicio = new Date(`${oc.data_ocorrencia}T${oc.hora_ocorrencia}:00`);
    const fim = oc.situacao === 'RESOLVIDO'
        ? new Date(`${oc.data_conclusao}T${oc.hora_conclusao}:00`)
        : new Date();
    const diffMs = fim - inicio;
    return diffMs / (60 * 60 * 1000); // retorna horas
}

function verificarAtraso(oc) {
    return calcularHorasAtraso(oc) > 24;
}

function getLabelAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas <= 24) return null;
    const dias = Math.floor(horas / 24);
    const horasRestantes = Math.floor(horas % 24);
    if (dias >= 1) {
        return `${dias}d ${horasRestantes}h atrasado`;
    }
    return `${Math.floor(horas)}h atrasado`;
}

function getCorAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas > 72) return '#dc2626';  // vermelho forte
    if (horas > 48) return '#ef4444';  // vermelho
    if (horas > 24) return '#f59e0b';  // amarelo/laranja
    return null;
}

function ordenarOcorrencias(lista) {
    return [...lista].sort((a, b) => {
        // 1. Em Andamento atrasados primeiro (mais atrasado no topo)
        const aEmAndamento = a.situacao === 'Em Andamento';
        const bEmAndamento = b.situacao === 'Em Andamento';
        const aAtrasado = aEmAndamento && verificarAtraso(a);
        const bAtrasado = bEmAndamento && verificarAtraso(b);

        if (aAtrasado && !bAtrasado) return -1;
        if (!aAtrasado && bAtrasado) return 1;
        if (aAtrasado && bAtrasado) return calcularHorasAtraso(b) - calcularHorasAtraso(a);

        // 2. Em Andamento (sem atraso) depois
        if (aEmAndamento && !bEmAndamento) return -1;
        if (!aEmAndamento && bEmAndamento) return 1;

        // 3. Resolvidos por último
        return 0;
    });
}

// ──────────── Estilos ────────────────────────────────────
const s = {
    container: { padding: '16px', color: '#f1f5f9' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    tab: { padding: '10px 16px', cursor: 'pointer', borderRadius: '6px 6px 0 0', fontSize: '14px', fontWeight: '600', color: '#94a3b8', background: 'transparent', border: 'none' },
    tabActive: { color: '#06b6d4', background: 'rgba(6,182,212,0.1)' },
    card: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
    btn: { padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' },
    btnPrimary: { background: 'rgba(6,182,212,0.2)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.4)' },
    btnDanger: { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' },
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }
};

// ──────────── Componente Principal ────────────────────────────────────
export default function PainelPosEmbarque() {
    const [aba, setAba] = useState('dashboard');
    const [ocorrencias, setOcorrencias] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState('');
    const [filtroSituacao, setFiltroSituacao] = useState('');
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
    const [listas, setListas] = useState({ motoristas: [], clientes: [], motivos: [] });

    // Modals
    const [modalNovaAberto, setModalNovaAberto] = useState(false);
    const [modalFotosAberto, setModalFotosAberto] = useState(false);
    const [ocorrenciaAtualId, setOcorrenciaAtualId] = useState(null);
    const [fotoUploadBase64, setFotoUploadBase64] = useState(null);

    // Form - Nova Ocorrência
    const [form, setForm] = useState({
        data_ocorrencia: new Date().toISOString().split('T')[0],
        hora_ocorrencia: new Date().toTimeString().substring(0, 5),
        motorista: '',
        modalidade: '',
        cte: '',
        operacao: '',
        nfs: '',
        cliente: '',
        cidade: '',
        motivo: '',
        link_email: ''
    });

    // Carregar ocorrências
    const carregarOcorrencias = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get('/api/posembarque/ocorrencias', {
                params: { busca, situacao: filtroSituacao, arquivado: 0 }
            });
            if (res.data.success) setOcorrencias(res.data.ocorrencias || []);
        } catch (e) {
            console.error('Erro ao carregar ocorrências:', e);
        } finally {
            setCarregando(false);
        }
    }, [busca, filtroSituacao]);

    useEffect(() => {
        carregarOcorrencias();
    }, [carregarOcorrencias]);

    // Carregar listas (motoristas, clientes, motivos)
    useEffect(() => {
        const carregar = async () => {
            try {
                const res = await api.get('/api/posembarque/listas');
                if (res.data.success) {
                    setListas({
                        motoristas: res.data.motoristas || [],
                        clientes: res.data.clientes || [],
                        motivos: res.data.motivos || []
                    });
                }
            } catch (e) {
                console.error('Erro ao carregar listas:', e);
            }
        };
        carregar();
    }, []);

    // ── Ações ────────────────────────────────────
    const criarOcorrencia = async () => {
        try {
            await api.post('/api/posembarque/ocorrencias', form);
            setForm({
                data_ocorrencia: new Date().toISOString().split('T')[0],
                hora_ocorrencia: new Date().toTimeString().substring(0, 5),
                motorista: '', modalidade: '', cte: '', operacao: '', nfs: '', cliente: '', cidade: '', motivo: '', link_email: ''
            });
            setModalNovaAberto(false);
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao criar ocorrência:', e);
            alert('Erro ao criar ocorrência');
        }
    };

    const resolver = async (id) => {
        try {
            await api.post(`/api/posembarque/ocorrencias/${id}/resolver`);
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao resolver:', e);
        }
    };

    const solicitar = async (id) => {
        const motivo = prompt('Motivo da solicitação:');
        if (!motivo) return;
        try {
            await api.post(`/api/posembarque/ocorrencias/${id}/solicitar-edicao`, { motivo_edicao: motivo });
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao solicitar:', e);
        }
    };

    const arquivarResolvidas = async () => {
        const resolvidas = ocorrencias.filter(o => o.situacao === 'RESOLVIDO');
        if (resolvidas.length === 0) return;
        if (!window.confirm(`Arquivar ${resolvidas.length} ocorrência(s) resolvida(s)?`)) return;
        try {
            for (const oc of resolvidas) {
                await api.post(`/api/posembarque/ocorrencias/${oc.id}/arquivar`);
            }
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao arquivar:', e);
        }
    };

    const deletar = async (id) => {
        if (!window.confirm('Confirmar exclusão?')) return;
        try {
            await api.delete(`/api/posembarque/ocorrencias/${id}`);
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao deletar:', e);
        }
    };

    const adicionarFoto = async () => {
        if (!fotoUploadBase64 || !ocorrenciaAtualId) return;
        try {
            await api.post(`/api/posembarque/ocorrencias/${ocorrenciaAtualId}/fotos`, {
                base64: fotoUploadBase64,
                nome: `foto_${Date.now()}.jpg`
            });
            setFotoUploadBase64(null);
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao adicionar foto:', e);
        }
    };

    const removerFoto = async (id, index) => {
        try {
            await api.delete(`/api/posembarque/ocorrencias/${id}/fotos/${index}`);
            carregarOcorrencias();
        } catch (e) {
            console.error('Erro ao remover foto:', e);
        }
    };

    // ── Dados para Relatório ────────────────────────────────────
    const carregarRelatorio = useCallback(async () => {
        try {
            const res = await api.get('/api/posembarque/relatorio', {
                params: { de: dataInicio, ate: dataFim }
            });
            if (res.data.success) {
                return res.data;
            }
        } catch (e) {
            console.error('Erro ao carregar relatório:', e);
        }
        return null;
    }, [dataInicio, dataFim]);

    // ── Renderizar ────────────────────────────────────
    return (
        <div style={s.container}>
            {/* Tabs */}
            <div style={s.tabs}>
                <button
                    style={{ ...s.tab, ...(aba === 'dashboard' ? s.tabActive : {}) }}
                    onClick={() => setAba('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    style={{ ...s.tab, ...(aba === 'nova' ? s.tabActive : {}) }}
                    onClick={() => setAba('nova')}
                >
                    Nova Ocorrência
                </button>
                <button
                    style={{ ...s.tab, ...(aba === 'relatorio' ? s.tabActive : {}) }}
                    onClick={() => setAba('relatorio')}
                >
                    Relatórios
                </button>
            </div>

            {/* ABA DASHBOARD */}
            {aba === 'dashboard' && (
                <div>
                    {/* Filtros */}
                    <div style={{ ...s.card, display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            style={{ ...s.input, flex: 1, minWidth: '150px' }}
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                        />
                        <select style={s.input} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
                            <option value="">Todas</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="RESOLVIDO">Resolvido</option>
                        </select>
                        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setModalNovaAberto(true)}>
                            <Plus size={16} /> Nova
                        </button>
                        {ocorrencias.filter(o => o.situacao === 'RESOLVIDO').length > 0 && (
                            <button
                                style={{ ...s.btn, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                                onClick={arquivarResolvidas}
                            >
                                <Archive size={16} /> Arquivar Resolvidas ({ocorrencias.filter(o => o.situacao === 'RESOLVIDO').length})
                            </button>
                        )}
                    </div>

                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                        {[
                            { label: 'Total', value: ocorrencias.length, cor: '#06b6d4' },
                            { label: 'Em Andamento', value: ocorrencias.filter(o => o.situacao === 'Em Andamento').length, cor: '#f59e0b' },
                            { label: 'Resolvidos', value: ocorrencias.filter(o => o.situacao === 'RESOLVIDO').length, cor: '#10b981' },
                            { label: 'Atrasados', value: ocorrencias.filter(o => verificarAtraso(o)).length, cor: '#ef4444' }
                        ].map(kpi => (
                            <div key={kpi.label} style={{ ...s.card, textAlign: 'center', borderTop: `3px solid ${kpi.cor}` }}>
                                <div style={{ fontSize: '28px', fontWeight: '900', color: kpi.cor }}>{kpi.value}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{kpi.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Lista de Ocorrências */}
                    <div>
                        {ocorrencias.length === 0 ? (
                            <div style={{ ...s.card, textAlign: 'center', color: '#64748b' }}>Nenhuma ocorrência</div>
                        ) : (
                            ordenarOcorrencias(ocorrencias).map(oc => {
                                const atraso = verificarAtraso(oc);
                                const labelAtraso = getLabelAtraso(oc);
                                const corAtraso = getCorAtraso(oc);
                                const corBorda = oc.situacao === 'RESOLVIDO' ? '#10b981' : atraso ? (corAtraso || '#ef4444') : '#06b6d4';
                                return (
                                    <div key={oc.id} style={{ ...s.card, borderLeft: `4px solid ${corBorda}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '14px' }}>{oc.motorista}</span>
                                                    {atraso && labelAtraso && (
                                                        <span style={{
                                                            background: `${corAtraso}20`,
                                                            color: corAtraso,
                                                            border: `1px solid ${corAtraso}60`,
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <AlertTriangle size={12} />
                                                            {labelAtraso}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                                    {oc.cliente} • {oc.operacao}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {oc.situacao === 'Em Andamento' && (
                                                    <>
                                                        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => resolver(oc.id)} title="Resolver">
                                                            <CheckCircle size={14} />
                                                        </button>
                                                        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => solicitar(oc.id)} title="Solicitar Edição">
                                                            <Edit2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                                <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => { setOcorrenciaAtualId(oc.id); setModalFotosAberto(true); }} title="Fotos">
                                                    <Image size={14} /> {oc.fotos_json ? JSON.parse(oc.fotos_json).length : 0}
                                                </button>
                                                {oc.link_email && (
                                                    <a href={oc.link_email} target="_blank" rel="noopener noreferrer" style={{ ...s.btn, ...s.btnPrimary, textDecoration: 'none' }} title="Abrir Email">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                                <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => deletar(oc.id)} title="Deletar">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            <div>CTE: {oc.cte} • Motivo: {oc.motivo} • Cidade: {oc.cidade}</div>
                                            <div style={{ marginTop: '6px' }}>
                                                <span style={{
                                                    color: oc.situacao === 'RESOLVIDO' ? '#10b981' : atraso ? corAtraso : '#06b6d4',
                                                    fontWeight: '600'
                                                }}>
                                                    {oc.situacao === 'RESOLVIDO' ? 'Resolvido' : atraso ? 'Em Andamento (Atrasado)' : 'Em Andamento'}
                                                </span>
                                                {oc.data_ocorrencia && <span> • {formatData(oc.data_ocorrencia)} {oc.hora_ocorrencia}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ABA NOVA OCORRÊNCIA */}
            {aba === 'nova' && (
                <div style={s.card}>
                    <h3 style={{ marginBottom: '16px', color: '#06b6d4' }}>Registrar Ocorrência</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <input type="date" style={s.input} value={form.data_ocorrencia} onChange={e => setForm({ ...form, data_ocorrencia: e.target.value })} />
                        <input type="time" style={s.input} value={form.hora_ocorrencia} onChange={e => setForm({ ...form, hora_ocorrencia: e.target.value })} />

                        <input list="motoristas" placeholder="Motorista" style={s.input} value={form.motorista} onChange={e => setForm({ ...form, motorista: e.target.value })} />
                        <datalist id="motoristas">
                            {listas.motoristas.map(m => <option key={m} value={m} />)}
                        </datalist>

                        <input type="text" placeholder="Modalidade" style={s.input} value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })} />
                        <input type="text" placeholder="CTE" style={s.input} value={form.cte} onChange={e => setForm({ ...form, cte: e.target.value })} />

                        <input type="text" placeholder="Operação" style={s.input} value={form.operacao} onChange={e => setForm({ ...form, operacao: e.target.value })} />
                        <input type="text" placeholder="NFs" style={s.input} value={form.nfs} onChange={e => setForm({ ...form, nfs: e.target.value })} />

                        <input list="clientes" placeholder="Cliente" style={s.input} value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
                        <datalist id="clientes">
                            {listas.clientes.map(c => <option key={c} value={c} />)}
                        </datalist>

                        <input type="text" placeholder="Cidade" style={s.input} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
                        <input list="motivos" placeholder="Motivo" style={s.input} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
                        <datalist id="motivos">
                            {listas.motivos.map(m => <option key={m} value={m} />)}
                        </datalist>

                        <input type="text" placeholder="Link Email" style={{ ...s.input, gridColumn: '1 / -1' }} value={form.link_email} onChange={e => setForm({ ...form, link_email: e.target.value })} />
                    </div>
                    <button style={{ ...s.btn, ...s.btnPrimary, marginTop: '16px' }} onClick={criarOcorrencia}>
                        Criar Ocorrência
                    </button>
                </div>
            )}

            {/* ABA RELATÓRIOS */}
            {aba === 'relatorio' && <RelatorioAba dataInicio={dataInicio} setDataInicio={setDataInicio} dataFim={dataFim} setDataFim={setDataFim} s={s} />}

            {/* MODAL - NOVA OCORRÊNCIA */}
            {modalNovaAberto && (
                <div style={s.modal} onClick={() => setModalNovaAberto(false)}>
                    <div style={s.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>Nova Ocorrência</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                            <input type="date" style={s.input} value={form.data_ocorrencia} onChange={e => setForm({ ...form, data_ocorrencia: e.target.value })} />
                            <input type="time" style={s.input} value={form.hora_ocorrencia} onChange={e => setForm({ ...form, hora_ocorrencia: e.target.value })} />
                            {/* ... outros inputs ... */}
                        </div>
                        <button style={{ ...s.btn, ...s.btnPrimary, marginTop: '16px' }} onClick={criarOcorrencia}>
                            Criar
                        </button>
                        <button style={{ ...s.btn, background: 'transparent', color: '#94a3b8', marginTop: '8px' }} onClick={() => setModalNovaAberto(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL - FOTOS */}
            {modalFotosAberto && ocorrenciaAtualId && (
                <ModalFotos id={ocorrenciaAtualId} onClose={() => setModalFotosAberto(false)} ocorrencias={ocorrencias} removerFoto={removerFoto} s={s} />
            )}
        </div>
    );
}

// ──────────── Componente Relatório ────────────────────────────────────
function RelatorioAba({ dataInicio, setDataInicio, dataFim, setDataFim, s }) {
    const [relatorio, setRelatorio] = useState(null);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await api.get('/api/posembarque/relatorio', {
                params: { de: dataInicio, ate: dataFim }
            });
            if (res.data.success) setRelatorio(res.data);
        } catch (e) {
            console.error('Erro ao carregar relatório:', e);
        } finally {
            setCarregando(false);
        }
    }, [dataInicio, dataFim]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    if (!relatorio) return <div style={s.card}>Carregando...</div>;

    const dadosPorOperacao = Object.entries(relatorio.por_operacao).map(([op, count]) => ({ name: op, value: count }));
    const dadosTopMotivos = relatorio.top_motivos;

    return (
        <div>
            <div style={{ ...s.card, display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input type="date" style={s.input} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                <input type="date" style={s.input} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                <button style={{ ...s.btn, ...s.btnPrimary }} onClick={carregar}>
                    Atualizar
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                    { label: 'Total', value: relatorio.metricas.total, cor: '#06b6d4' },
                    { label: 'Resolvidos', value: relatorio.metricas.resolvidos, cor: '#10b981' },
                    { label: 'Atrasados', value: relatorio.metricas.atrasados, cor: '#ef4444' },
                    { label: 'Em Andamento', value: relatorio.metricas.em_andamento, cor: '#f59e0b' }
                ].map(kpi => (
                    <div key={kpi.label} style={{ ...s.card, textAlign: 'center', borderTop: `3px solid ${kpi.cor}` }}>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: kpi.cor }}>{kpi.value}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Gráficos */}
            {dadosPorOperacao.length > 0 && (
                <div style={{ ...s.card, marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Embarques por Operação</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie dataKey="value" data={dadosPorOperacao} fill="#06b6d4" label>
                                {dadosPorOperacao.map((_, i) => <Cell key={i} fill={['#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][i % 5]} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}

            {dadosTopMotivos.length > 0 && (
                <div style={s.card}>
                    <h4 style={{ marginBottom: '12px' }}>Top 5 Motivos</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={dadosTopMotivos} layout="vertical">
                            <XAxis type="number" />
                            <YAxis dataKey="motivo" type="category" width={150} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#06b6d4" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

// ──────────── Component Modal Fotos ────────────────────────────────────
function ModalFotos({ id, onClose, ocorrencias, removerFoto, s }) {
    const oc = ocorrencias.find(o => o.id === id);
    const fotos = oc && oc.fotos_json ? JSON.parse(oc.fotos_json) : [];
    const [upload, setUpload] = useState(null);

    const adicionarFoto = async () => {
        if (!upload) return;
        try {
            await api.post(`/api/posembarque/ocorrencias/${id}/fotos`, { base64: upload, nome: `foto_${Date.now()}.jpg` });
            setUpload(null);
            window.location.reload(); // Recarregar para atualizar
        } catch (e) {
            console.error('Erro:', e);
        }
    };

    return (
        <div style={s.modal} onClick={onClose}>
            <div style={s.modalContent} onClick={e => e.stopPropagation()}>
                <h3>Fotos ({fotos.length}/5)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                    {fotos.map((f, i) => (
                        <div key={i} style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px' }}>
                            <img src={`data:image/jpeg;base64,${f.base64.substring(0, 50)}...`} style={{ width: '100%', height: '80px', borderRadius: '4px', objectFit: 'cover' }} alt={`Foto ${i}`} />
                            <button style={{ ...s.btn, ...s.btnDanger, position: 'absolute', top: '4px', right: '4px' }} onClick={() => removerFoto(id, i)}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
                {fotos.length < 5 && (
                    <div style={{ marginTop: '12px' }}>
                        <input type="file" accept="image/*" onChange={e => {
                            const reader = new FileReader();
                            reader.onload = (ev) => setUpload(ev.target.result.split(',')[1]);
                            reader.readAsDataURL(e.target.files[0]);
                        }} style={s.input} />
                        <button style={{ ...s.btn, ...s.btnPrimary, marginTop: '8px' }} onClick={adicionarFoto}>Adicionar Foto</button>
                    </div>
                )}
                <button style={{ ...s.btn, background: 'transparent', color: '#94a3b8', marginTop: '12px' }} onClick={onClose}>Fechar</button>
            </div>
        </div>
    );
}
