import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle, XCircle, AlertTriangle, Clock, Save, RefreshCw, Truck } from 'lucide-react';
import api from '../services/apiService';

const SEGURADORAS = ['BUONNY', 'VERTTICE'];

const UFS_BRASIL = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

function calcularTimer(data_liberacao_cad) {
    if (!data_liberacao_cad) return null;
    const dataStr = data_liberacao_cad.endsWith('Z') ? data_liberacao_cad : data_liberacao_cad + 'Z';
    const diffMs = Date.now() - new Date(dataStr).getTime();
    const restanteMs = 24 * 60 * 60 * 1000 - diffMs;
    if (restanteMs <= 0) return { expirado: true, h: 0, m: 0 };
    return {
        expirado: false,
        h: Math.floor(restanteMs / 3600000),
        m: Math.floor((restanteMs % 3600000) / 60000)
    };
}

function corTimer(timer) {
    if (!timer || timer.expirado) return '#ef4444';
    if (timer.h < 1) return '#ef4444';
    if (timer.h < 2) return '#fbbf24';
    return '#4ade80';
}

function formatarDataHoraBrasilia(isoStr) {
    if (!isoStr) return null;
    try {
        const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
}

function corSituacao(sit) {
    if (sit === 'LIBERADO') return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#4ade80' };
    if (sit === 'PENDENTE') return { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24' };
    return { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#f87171' };
}

export default function PainelCadastro({ user, socket }) {
    // ── Blindagem de Acesso ──
    const cargo = (user?.cargo || '').toUpperCase();
    const podeEditar = ['COORDENADOR', 'PLANEJAMENTO', 'CADASTRO', 'CONHECIMENTO'].includes(cargo);

    const [motoristas, setMotoristas] = useState([]);
    const [edicoes, setEdicoes] = useState({}); // { [id]: { chk_cnh_cad, ... } }
    const [salvando, setSalvando] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [, setTick] = useState(0);

    // Novo estado para a aba "Na Operação"
    const [abaAtiva, setAbaAtiva] = useState('espera');
    const [motoristasOperacao, setMotoristasOperacao] = useState([]);
    const [edicoesOp, setEdicoesOp] = useState({});
    const [salvandoOp, setSalvandoOp] = useState(null);

    // Novo estado para a aba "Frota Própria"
    const [motoristasFrota, setMotoristasFrota] = useState([]);
    const [edicoesFrota, setEdicoesFrota] = useState({});
    const [salvandoFrota, setSalvandoFrota] = useState(null);

    const carregarMotoristas = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/api/cadastro/motoristas');
            if (r.data.success) {
                setMotoristas(r.data.motoristas);
                // Inicializar estado local de edição
                const inicial = {};
                r.data.motoristas.forEach(m => {
                    inicial[m.id] = {
                        chk_cnh_cad: !!m.chk_cnh_cad,
                        chk_antt_cad: !!m.chk_antt_cad,
                        chk_tacografo_cad: !!m.chk_tacografo_cad,
                        chk_crlv_cad: !!m.chk_crlv_cad,
                        seguradora_cad: m.seguradora_cad || '',
                        num_liberacao_cad: m.num_liberacao_cad || '',
                        situacao_cad: m.situacao_cad || 'NÃO CONFERIDO',
                        data_liberacao_cad: m.data_liberacao_cad || null,
                        data_liberacao_manual: '',
                        origem_cad: m.origem_cad || '',
                        destino_uf_cad: m.destino_uf_cad || '',
                        destino_cidade_cad: m.destino_cidade_cad || '',
                    };
                });
                setEdicoes(inicial);
            }
        } catch (e) {
            console.error('Erro ao carregar motoristas:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    const carregarMotoristasOperacao = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/api/cadastro/veiculos-em-operacao');
            if (r.data.success) {
                // Filtra os motoristas da operação para OMITIR os da frota própria,
                // já que eles devem ficar exclusivos na aba "Frota Própria"
                const veiculosFiltrados = r.data.veiculos.filter(v => {
                    const isFrota = String(v.isFrotaMotorista) === 'true' || String(v.isFrotaMotorista) === '1';
                    return !isFrota;
                });

                setMotoristasOperacao(veiculosFiltrados);
                const inicial = {};
                veiculosFiltrados.forEach(m => {
                    inicial[m.id] = {
                        chk_cnh_cad: !!m.chk_cnh_cad,
                        chk_antt_cad: !!m.chk_antt_cad,
                        chk_tacografo_cad: !!m.chk_tacografo_cad,
                        chk_crlv_cad: !!m.chk_crlv_cad,
                        num_liberacao_cad: m.num_liberacao_cad || '',
                        situacao_cad: m.situacao_cad || 'NÃO CONFERIDO',
                        data_liberacao_cad: m.data_liberacao_cad || null,
                        data_liberacao_manual: '',
                        seguradora_cad: m.seguradora_cad || '',
                        origem_cad: m.origem_cad || '',
                        destino_uf_cad: m.destino_uf_cad || '',
                        destino_cidade_cad: m.destino_cidade_cad || '',
                    };
                });
                setEdicoesOp(inicial);
            }
        } catch (e) {
            console.error('Erro ao carregar veiculos em operacao:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    const carregarMotoristasFrota = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/api/cadastro/frota');
            if (r.data.success) {
                setMotoristasFrota(r.data.motoristas);
                const inicial = {};
                r.data.motoristas.forEach(m => {
                    inicial[m.id] = {
                        seguradora_cad: m.seguradora_cad || '',
                        num_liberacao_cad: m.num_liberacao_cad || '',
                        situacao_cad: m.situacao_cad || 'NÃO CONFERIDO',
                        data_liberacao_cad: m.data_liberacao_cad || null,
                        data_liberacao_manual: '', // Apenas para edição da data no UI
                    };
                });
                setEdicoesFrota(inicial);
            }
        } catch (e) {
            console.error('Erro ao carregar motoristas frota:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarMotoristas();
        carregarMotoristasOperacao();
        carregarMotoristasFrota();

        // Listener para atualizações em tempo real (ex: CT-e emitido)
        if (socket) {
            const handleRefresh = (data) => {
                if (data?.tipo === 'refresh_geral') {
                    carregarMotoristas();
                    carregarMotoristasOperacao();
                    carregarMotoristasFrota();
                }
            };
            socket.on('receber_atualizacao', handleRefresh);
            return () => socket.off('receber_atualizacao', handleRefresh);
        }

        // Atualiza timers a cada 30s
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, [carregarMotoristas, carregarMotoristasOperacao, carregarMotoristasFrota, socket]);

    function atualizarEdicao(id, campo, valor) {
        setEdicoes(prev => {
            const atual = prev[id] || {};
            const novo = { ...atual, [campo]: valor };
            // Recalcular situacao_cad localmente para feedback imediato
            const todosChk = !!(novo.chk_cnh_cad && novo.chk_antt_cad && novo.chk_tacografo_cad && novo.chk_crlv_cad);
            const liberado = todosChk && !!novo.seguradora_cad && !!novo.num_liberacao_cad;
            novo.situacao_cad = liberado ? 'LIBERADO'
                : (todosChk || novo.seguradora_cad || novo.num_liberacao_cad) ? 'PENDENTE'
                    : 'NÃO CONFERIDO';
            return { ...prev, [id]: novo };
        });
    }

    async function salvar(id) {
        setSalvando(id);
        try {
            const dados = edicoes[id] || {};
            const r = await api.put(`/api/cadastro/motoristas/${id}`, {
                ...dados,
                origem_cad: dados.origem_cad || '',
                destino_uf_cad: dados.destino_uf_cad || '',
                destino_cidade_cad: dados.destino_cidade_cad || '',
                data_liberacao_manual: dados.data_liberacao_manual ? new Date(dados.data_liberacao_manual).toISOString() : '',
            });
            if (r.data.success) {
                // Atualizar data_liberacao_cad retornada pelo backend
                setEdicoes(prev => ({
                    ...prev,
                    [id]: {
                        ...prev[id],
                        situacao_cad: r.data.situacao,
                        data_liberacao_cad: r.data.data_liberacao_cad,
                    }
                }));
                // Atualizar na lista principal também
                setMotoristas(prev => prev.map(m => m.id === id
                    ? { ...m, ...dados, situacao_cad: r.data.situacao, data_liberacao_cad: r.data.data_liberacao_cad }
                    : m
                ));
            }
        } catch (e) {
            console.error('Erro ao salvar checklist:', e);
        } finally {
            setSalvando(null);
        }
    }

    function atualizarEdicaoOp(id, campo, valor) {
        setEdicoesOp(prev => {
            const atual = prev[id] || {};
            const novo = { ...atual, [campo]: valor };
            const todosChk = !!(novo.chk_cnh_cad && novo.chk_antt_cad && novo.chk_tacografo_cad && novo.chk_crlv_cad);
            const liberado = todosChk && !!novo.num_liberacao_cad;
            novo.situacao_cad = liberado ? 'LIBERADO'
                : (todosChk || novo.num_liberacao_cad) ? 'PENDENTE'
                    : 'NÃO CONFERIDO';
            return { ...prev, [id]: novo };
        });
    }

    async function salvarOperacao(id) {
        setSalvandoOp(id);
        try {
            const dados = edicoesOp[id] || {};
            const r = await api.put(`/api/cadastro/veiculos-em-operacao/${id}`, {
                ...dados,
                origem_cad: dados.origem_cad || '',
                destino_uf_cad: dados.destino_uf_cad || '',
                destino_cidade_cad: dados.destino_cidade_cad || '',
                data_liberacao_manual: dados.data_liberacao_manual ? new Date(dados.data_liberacao_manual).toISOString() : '',
            });
            if (r.data.success) {
                setEdicoesOp(prev => ({
                    ...prev,
                    [id]: {
                        ...prev[id],
                        situacao_cad: r.data.situacao,
                        data_liberacao_cad: r.data.data_liberacao_cad,
                    }
                }));
                // Atualizar na lista de operação também
                setMotoristasOperacao(prev => prev.map(m => m.id === id
                    ? { ...m, ...dados, situacao_cad: r.data.situacao, data_liberacao_cad: r.data.data_liberacao_cad }
                    : m
                ));
            }
        } catch (e) {
            console.error('Erro ao salvar checklist da operação:', e);
        } finally {
            setSalvandoOp(null);
        }
    }

    function atualizarEdicaoFrota(id, campo, valor) {
        setEdicoesFrota(prev => {
            const atual = prev[id] || {};
            const novo = { ...atual, [campo]: valor };
            return { ...prev, [id]: novo };
        });
    }

    async function salvarFrota(id) {
        setSalvandoFrota(id);
        try {
            const dados = edicoesFrota[id] || {};
            const r = await api.put(`/api/cadastro/frota/${id}`, {
                ...dados,
                data_liberacao_manual: dados.data_liberacao_manual ? new Date(dados.data_liberacao_manual).toISOString() : '',
            });
            if (r.data.success) {
                setEdicoesFrota(prev => ({
                    ...prev,
                    [id]: {
                        ...prev[id],
                        situacao_cad: r.data.situacao,
                        data_liberacao_cad: r.data.data_liberacao_cad,
                    }
                }));
                setMotoristasFrota(prev => prev.map(m => m.id === id
                    ? { ...m, ...dados, situacao_cad: r.data.situacao, data_liberacao_cad: r.data.data_liberacao_cad }
                    : m
                ));
            }
        } catch (e) {
            console.error('Erro ao salvar liberação frota:', e);
        } finally {
            setSalvandoFrota(null);
        }
    }

    return (
        <div style={{ padding: '20px 25px', height: 'calc(100vh - 124px)', overflowY: 'auto' }}>
            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
            `}</style>

            {/* Header */}
            <div className="glass-panel-internal" style={{ padding: '15px 25px', marginBottom: '20px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', marginBottom: '8px' }}>
                        <ShieldCheck size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        GERENCIAMENTO DE RISCO <span style={{ color: '#fb923c' }}>/ CADASTRO</span>
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setAbaAtiva('espera')}
                            style={{
                                background: abaAtiva === 'espera' ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: abaAtiva === 'espera' ? '#ffffff' : '#94a3b8',
                                borderRadius: '8px', padding: '6px 14px',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            Em Espera <span className="badge-neon-pill" style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.2)', color: 'white' }}>{motoristas.length}</span>
                        </button>
                        <button
                            onClick={() => setAbaAtiva('operacao')}
                            style={{
                                background: abaAtiva === 'operacao' ? '#fb923c' : 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: abaAtiva === 'operacao' ? '#ffffff' : '#94a3b8',
                                borderRadius: '8px', padding: '6px 14px',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            Na Operação <span className="badge-neon-pill" style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.2)', color: 'white' }}>{motoristasOperacao.length}</span>
                        </button>
                        <button
                            onClick={() => setAbaAtiva('frota')}
                            style={{
                                background: abaAtiva === 'frota' ? '#10b981' : 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: abaAtiva === 'frota' ? '#ffffff' : '#94a3b8',
                                borderRadius: '8px', padding: '6px 14px',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            Frota Própria <span className="badge-neon-pill" style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.2)', color: 'white' }}>{motoristasFrota.length}</span>
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => { carregarMotoristas(); carregarMotoristasOperacao(); carregarMotoristasFrota(); }}
                    disabled={carregando}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8', borderRadius: '8px', padding: '8px 14px',
                        cursor: carregando ? 'default' : 'pointer', fontSize: '12px',
                        opacity: carregando ? 0.6 : 1
                    }}
                >
                    <RefreshCw size={14} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} />
                    Atualizar
                </button>
            </div>

            {/* ABA: EM ESPERA */}
            {abaAtiva === 'espera' && (
                <>
                    {motoristas.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                            <ShieldCheck size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <p>Nenhum motorista disponível na fila.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                            {motoristas.map(m => {
                                const ed = edicoes[m.id] || {};
                                const situacao = ed.situacao_cad || 'NÃO CONFERIDO';
                                const cor = corSituacao(situacao);
                                const timer = calcularTimer(ed.data_liberacao_cad);
                                const corTm = corTimer(timer);
                                const estaSalvando = salvando === m.id;

                                return (
                                    <div
                                        key={m.id}
                                        className="glass-panel-internal"
                                        style={{
                                            borderLeft: `4px solid ${cor.border}`,
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            animation: 'slideIn 0.3s ease'
                                        }}
                                    >
                                        {/* Header do card */}
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9', marginBottom: '4px' }}>
                                                    {m.nome_motorista}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        <Truck size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                                        {m.placa1}{m.placa2 ? ` / ${m.placa2}` : ''}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {m.tipo_veiculo || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                {/* Badge situação */}
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: cor.text, padding: '3px 8px', borderRadius: '5px', background: cor.bg, border: `1px solid ${cor.border}` }}>
                                                    {situacao}
                                                </span>
                                                {/* Indicador PDF */}
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '140px' }}>
                                                    {m.comprovante_pdf && <a href={m.comprovante_pdf} download={`PDF_ORIG_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>PDF Orig.</a>}
                                                    {m.anexo_cnh && <a href={m.anexo_cnh} download={`CNH_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>CNH</a>}
                                                    {m.anexo_doc_veiculo && <a href={m.anexo_doc_veiculo} download={`CRLV_CAV_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>CRLV Cav.</a>}
                                                    {m.anexo_crlv_carreta && <a href={m.anexo_crlv_carreta} download={`CRLV_CAR_${m.placa2 || 'CARRETA'}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#fb923c', textDecoration: 'none', background: 'rgba(251,146,60,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(251,146,60,0.3)', fontWeight: '700' }}>CRLV Car.</a>}
                                                    {m.anexo_antt && <a href={m.anexo_antt} download={`ANTT_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>ANTT</a>}
                                                    {m.anexo_outros && <a href={m.anexo_outros} download={`OUTROS_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>Outros</a>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Corpo do card */}
                                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                            {/* Checkboxes CNH / ANTT / Tacógrafo / CRLV */}
                                            <div>
                                                <label className="label-tech-sm" style={{ marginBottom: '6px' }}>DOCUMENTAÇÃO</label>
                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {[
                                                        { campo: 'chk_cnh_cad', label: 'CNH' },
                                                        { campo: 'chk_antt_cad', label: 'ANTT' },
                                                        { campo: 'chk_tacografo_cad', label: 'TACÓGRAFO' },
                                                        { campo: 'chk_crlv_cad', label: 'CRLV' },
                                                    ].map(({ campo, label }) => {
                                                        const ok = !!ed[campo];
                                                        return (
                                                            <button
                                                                key={campo}
                                                                disabled={!podeEditar}
                                                                onClick={() => podeEditar && atualizarEdicao(m.id, campo, !ed[campo])}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                                    background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                                                                    border: `1px solid ${ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.25)'}`,
                                                                    borderRadius: '6px', padding: '5px 10px',
                                                                    cursor: podeEditar ? 'pointer' : 'not-allowed',
                                                                    opacity: podeEditar ? 1 : 0.5,
                                                                    color: ok ? '#4ade80' : '#f87171',
                                                                    fontSize: '11px', fontWeight: '700',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                {ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Seguradora */}
                                            <div>
                                                <label className="label-tech-sm">SEGURADORA</label>
                                                <select
                                                    className="input-internal"
                                                    style={{ fontSize: '12px' }}
                                                    value={ed.seguradora_cad || ''}
                                                    disabled={!podeEditar}
                                                    onChange={e => atualizarEdicao(m.id, 'seguradora_cad', e.target.value)}
                                                >
                                                    <option value="" style={{ color: 'black' }}>-- Selecione --</option>
                                                    {SEGURADORAS.map(s => <option key={s} style={{ color: 'black' }}>{s}</option>)}
                                                </select>
                                            </div>

                                            {/* Origem e Destino */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px' }}>
                                                <div>
                                                    <label className="label-tech-sm">ORIGEM</label>
                                                    <select
                                                        className="input-internal"
                                                        style={{ fontSize: '12px' }}
                                                        value={ed.origem_cad || ''}
                                                        disabled={!podeEditar}
                                                        onChange={e => atualizarEdicao(m.id, 'origem_cad', e.target.value)}
                                                    >
                                                        <option value="" style={{ color: 'black' }}>-- Selecione --</option>
                                                        <option value="Recife" style={{ color: 'black' }}>Recife</option>
                                                        <option value="Moreno" style={{ color: 'black' }}>Moreno</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="label-tech-sm">UF DESTINO</label>
                                                    <select
                                                        className="input-internal"
                                                        style={{ fontSize: '12px' }}
                                                        value={ed.destino_uf_cad || ''}
                                                        disabled={!podeEditar}
                                                        onChange={e => atualizarEdicao(m.id, 'destino_uf_cad', e.target.value)}
                                                    >
                                                        <option value="" style={{ color: 'black' }}>--</option>
                                                        {UFS_BRASIL.map(uf => <option key={uf} style={{ color: 'black' }}>{uf}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="label-tech-sm">CIDADE DESTINO</label>
                                                <input
                                                    className="input-internal"
                                                    style={{ fontSize: '12px' }}
                                                    value={ed.destino_cidade_cad || ''}
                                                    disabled={!podeEditar}
                                                    onChange={e => atualizarEdicao(m.id, 'destino_cidade_cad', e.target.value)}
                                                    placeholder="Ex: São Paulo"
                                                />
                                            </div>

                                            {/* Número de Liberação */}
                                            {(() => {
                                                const faltaSoNumLib = !!(ed.chk_cnh_cad && ed.chk_antt_cad && ed.chk_tacografo_cad && ed.chk_crlv_cad && ed.seguradora_cad && !ed.num_liberacao_cad);
                                                const dataFormatada = formatarDataHoraBrasilia(ed.data_liberacao_cad);
                                                return (
                                                    <div>
                                                        <label className="label-tech-sm" style={{ color: faltaSoNumLib ? '#f59e0b' : undefined }}>
                                                            LIBERAÇÃO {faltaSoNumLib && <span style={{ color: '#f59e0b' }}>★ OBRIGATÓRIO PARA LIBERAR</span>}
                                                        </label>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                            <div>
                                                                <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Nº Liberação</label>
                                                                <input
                                                                    className="input-internal"
                                                                    style={{ fontSize: '12px', border: faltaSoNumLib ? '1px solid rgba(245,158,11,0.7)' : undefined, boxShadow: faltaSoNumLib ? '0 0 0 2px rgba(245,158,11,0.2)' : undefined }}
                                                                    value={ed.num_liberacao_cad || ''}
                                                                    disabled={!podeEditar}
                                                                    onChange={e => atualizarEdicao(m.id, 'num_liberacao_cad', e.target.value)}
                                                                    placeholder="Ex: 123456"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Data/Hora da Liberação</label>
                                                                <input
                                                                    type="datetime-local"
                                                                    className="input-internal"
                                                                    style={{ fontSize: '11px' }}
                                                                    value={ed.data_liberacao_manual || ''}
                                                                    disabled={!podeEditar}
                                                                    onChange={e => atualizarEdicao(m.id, 'data_liberacao_manual', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        {dataFormatada && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#64748b', fontSize: '10px' }}>
                                                                <Clock size={11} />
                                                                Última alteração: {dataFormatada}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Timer de expiração */}
                                            {timer && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '6px 10px', borderRadius: '6px',
                                                    background: `${corTm}11`,
                                                    border: `1px solid ${corTm}44`,
                                                    color: corTm, fontSize: '12px', fontWeight: '700'
                                                }}>
                                                    {timer.expirado ? (
                                                        <>
                                                            <AlertTriangle size={14} style={{ animation: 'pulse 1.5s infinite' }} />
                                                            LIBERAÇÃO EXPIRADA — Solicite renovação
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock size={13} />
                                                            {timer.h}h {String(timer.m).padStart(2, '0')}min restantes
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer — Botão Salvar */}
                                        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                            {podeEditar ? (
                                                <button
                                                    onClick={() => salvar(m.id)}
                                                    disabled={estaSalvando}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                        padding: '8px', borderRadius: '7px', border: 'none',
                                                        background: situacao === 'LIBERADO' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.15)',
                                                        color: situacao === 'LIBERADO' ? '#4ade80' : '#fbbf24',
                                                        fontWeight: 'bold', fontSize: '12px',
                                                        cursor: estaSalvando ? 'default' : 'pointer',
                                                        opacity: estaSalvando ? 0.6 : 1,
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Save size={14} />
                                                    {estaSalvando ? 'Salvando...' : 'Salvar Checklist'}
                                                </button>
                                            ) : (
                                                <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '6px 0' }}>🔒 Somente leitura — sem permissão de edição</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ABA: NA OPERAÇÃO */}
            {abaAtiva === 'operacao' && (
                <>
                    {motoristasOperacao.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                            <Truck size={48} style={{ opacity: 0.3, marginBottom: '16px', margin: '0 auto' }} />
                            <p>Nenhum veículo aguardando conferência na operação.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                            {motoristasOperacao.map(m => {
                                const ed = edicoesOp[m.id] || {};
                                const situacao = ed.situacao_cad || 'NÃO CONFERIDO';
                                const cor = corSituacao(situacao);
                                const timer = calcularTimer(ed.data_liberacao_cad);
                                const corTm = corTimer(timer);
                                const estaSalvando = salvandoOp === m.id;

                                return (
                                    <div
                                        key={m.id}
                                        className="glass-panel-internal"
                                        style={{
                                            borderLeft: `4px solid ${cor.border}`,
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            animation: 'slideIn 0.3s ease'
                                        }}
                                    >
                                        {/* Header do card */}
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9', marginBottom: '4px' }}>
                                                    {m.nome_motorista}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        <Truck size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                                        {m.placa1}{m.placa2 ? ` / ${m.placa2}` : ''}
                                                    </span>
                                                    {m.tipo_veiculo && (
                                                        <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {m.tipo_veiculo}
                                                        </span>
                                                    )}
                                                    {m.operacao && (
                                                        <span style={{ fontSize: '10px', color: '#fb923c', background: 'rgba(251,146,60,0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(251,146,60,0.2)' }}>
                                                            {m.operacao} {m.unidade ? `(${m.unidade})` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                {/* Badge situação */}
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: cor.text, padding: '3px 8px', borderRadius: '5px', background: cor.bg, border: `1px solid ${cor.border}` }}>
                                                    {situacao}
                                                </span>
                                                {/* Indicador PDF */}
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '140px' }}>
                                                    {m.comprovante_pdf && <a href={m.comprovante_pdf} download={`PDF_ORIG_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>PDF Orig.</a>}
                                                    {m.anexo_cnh && <a href={m.anexo_cnh} download={`CNH_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>CNH</a>}
                                                    {m.anexo_doc_veiculo && <a href={m.anexo_doc_veiculo} download={`CRLV_CAV_${m.placa1}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>CRLV Cav.</a>}
                                                    {m.anexo_crlv_carreta && <a href={m.anexo_crlv_carreta} download={`CRLV_CAR_${m.placa2 || 'CARRETA'}_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#fb923c', textDecoration: 'none', background: 'rgba(251,146,60,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(251,146,60,0.3)', fontWeight: '700' }}>CRLV Car.</a>}
                                                    {m.anexo_antt && <a href={m.anexo_antt} download={`ANTT_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>ANTT</a>}
                                                    {m.anexo_outros && <a href={m.anexo_outros} download={`OUTROS_${m.nome_motorista}.pdf`} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '700' }}>Outros</a>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Corpo do card */}
                                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                            {/* Checkboxes CNH / ANTT / Tacógrafo / CRLV */}
                                            <div>
                                                <label className="label-tech-sm" style={{ marginBottom: '6px' }}>DOCUMENTAÇÃO</label>
                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {[
                                                        { campo: 'chk_cnh_cad', label: 'CNH' },
                                                        { campo: 'chk_antt_cad', label: 'ANTT' },
                                                        { campo: 'chk_tacografo_cad', label: 'TACÓGRAFO' },
                                                        { campo: 'chk_crlv_cad', label: 'CRLV' },
                                                    ].map(({ campo, label }) => {
                                                        const ok = !!ed[campo];
                                                        return (
                                                            <button
                                                                key={campo}
                                                                disabled={!podeEditar}
                                                                onClick={() => podeEditar && atualizarEdicaoOp(m.id, campo, !ed[campo])}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                                    background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                                                                    border: `1px solid ${ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.25)'}`,
                                                                    borderRadius: '6px', padding: '5px 10px',
                                                                    cursor: podeEditar ? 'pointer' : 'not-allowed',
                                                                    opacity: podeEditar ? 1 : 0.5,
                                                                    color: ok ? '#4ade80' : '#f87171',
                                                                    fontSize: '11px', fontWeight: '700',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                {ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Origem e Destino */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px' }}>
                                                <div>
                                                    <label className="label-tech-sm">ORIGEM</label>
                                                    <select
                                                        className="input-internal"
                                                        style={{ fontSize: '12px' }}
                                                        value={ed.origem_cad || ''}
                                                        disabled={!podeEditar}
                                                        onChange={e => atualizarEdicaoOp(m.id, 'origem_cad', e.target.value)}
                                                    >
                                                        <option value="" style={{ color: 'black' }}>-- Selecione --</option>
                                                        <option value="Recife" style={{ color: 'black' }}>Recife</option>
                                                        <option value="Moreno" style={{ color: 'black' }}>Moreno</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="label-tech-sm">UF DESTINO</label>
                                                    <select
                                                        className="input-internal"
                                                        style={{ fontSize: '12px' }}
                                                        value={ed.destino_uf_cad || ''}
                                                        disabled={!podeEditar}
                                                        onChange={e => atualizarEdicaoOp(m.id, 'destino_uf_cad', e.target.value)}
                                                    >
                                                        <option value="" style={{ color: 'black' }}>--</option>
                                                        {UFS_BRASIL.map(uf => <option key={uf} style={{ color: 'black' }}>{uf}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="label-tech-sm">CIDADE DESTINO</label>
                                                <input
                                                    className="input-internal"
                                                    style={{ fontSize: '12px' }}
                                                    value={ed.destino_cidade_cad || ''}
                                                    disabled={!podeEditar}
                                                    onChange={e => atualizarEdicaoOp(m.id, 'destino_cidade_cad', e.target.value)}
                                                    placeholder="Ex: São Paulo"
                                                />
                                            </div>

                                            {/* Número de Liberação */}
                                            {(() => {
                                                const faltaSoNumLib = !!(ed.chk_cnh_cad && ed.chk_antt_cad && ed.chk_tacografo_cad && ed.chk_crlv_cad && !ed.num_liberacao_cad);
                                                const dataFormatada = formatarDataHoraBrasilia(ed.data_liberacao_cad);
                                                return (
                                                    <div>
                                                        <label className="label-tech-sm" style={{ color: faltaSoNumLib ? '#f59e0b' : undefined }}>
                                                            LIBERAÇÃO {faltaSoNumLib && <span style={{ color: '#f59e0b' }}>★ OBRIGATÓRIO PARA LIBERAR</span>}
                                                        </label>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                            <div>
                                                                <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Nº Liberação</label>
                                                                <input
                                                                    className="input-internal"
                                                                    style={{ fontSize: '12px', border: faltaSoNumLib ? '1px solid rgba(245,158,11,0.7)' : undefined, boxShadow: faltaSoNumLib ? '0 0 0 2px rgba(245,158,11,0.2)' : undefined }}
                                                                    value={ed.num_liberacao_cad || ''}
                                                                    disabled={!podeEditar}
                                                                    onChange={e => atualizarEdicaoOp(m.id, 'num_liberacao_cad', e.target.value)}
                                                                    placeholder="Ex: 123456"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Data/Hora da Liberação</label>
                                                                <input
                                                                    type="datetime-local"
                                                                    className="input-internal"
                                                                    style={{ fontSize: '11px' }}
                                                                    value={ed.data_liberacao_manual || ''}
                                                                    disabled={!podeEditar}
                                                                    onChange={e => atualizarEdicaoOp(m.id, 'data_liberacao_manual', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        {dataFormatada && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#64748b', fontSize: '10px' }}>
                                                                <Clock size={11} />
                                                                Última alteração: {dataFormatada}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Timer de expiração */}
                                            {timer && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '6px 10px', borderRadius: '6px',
                                                    background: `${corTm}11`,
                                                    border: `1px solid ${corTm}44`,
                                                    color: corTm, fontSize: '12px', fontWeight: '700'
                                                }}>
                                                    {timer.expirado ? (
                                                        <>
                                                            <AlertTriangle size={14} style={{ animation: 'pulse 1.5s infinite' }} />
                                                            LIBERAÇÃO EXPIRADA — Solicite renovação
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock size={13} />
                                                            {timer.h}h {String(timer.m).padStart(2, '0')}min restantes
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer — Botão Salvar */}
                                        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                            {podeEditar ? (
                                                <button
                                                    onClick={() => salvarOperacao(m.id)}
                                                    disabled={estaSalvando}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                        padding: '8px', borderRadius: '7px', border: 'none',
                                                        background: situacao === 'LIBERADO' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.15)',
                                                        color: situacao === 'LIBERADO' ? '#4ade80' : '#fbbf24',
                                                        fontWeight: 'bold', fontSize: '12px',
                                                        cursor: estaSalvando ? 'default' : 'pointer',
                                                        opacity: estaSalvando ? 0.6 : 1,
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Save size={14} />
                                                    {estaSalvando ? 'Salvando...' : 'Salvar Checklist Operação'}
                                                </button>
                                            ) : (
                                                <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '6px 0' }}>🔒 Somente leitura — sem permissão de edição</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ABA: FROTA PRÓPRIA */}
            {abaAtiva === 'frota' && (
                <>
                    {motoristasFrota.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                            <Truck size={48} style={{ opacity: 0.3, marginBottom: '16px', margin: '0 auto' }} />
                            <p>Nenhum veículo de frota marcado no sistema.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                            {motoristasFrota.map(m => {
                                const ed = edicoesFrota[m.id] || {};
                                const situacao = ed.situacao_cad || 'NÃO CONFERIDO';
                                const estaSalvando = salvandoFrota === m.id;

                                // Cores reaproveitadas do helper original
                                const cor = situacao === 'LIBERADO' ? { bg: 'rgba(74,222,128,0.1)', border: '#4ade80', text: '#4ade80' }
                                    : situacao === 'PENDENTE' ? { bg: 'rgba(251,191,36,0.1)', border: '#fbbf24', text: '#fbbf24' }
                                        : { bg: 'rgba(248,113,113,0.1)', border: '#f87171', text: '#f87171' };

                                // Lógica p/ timer de 1 ano
                                let msRestantes = 0;
                                let expirado = false;
                                if (ed.data_liberacao_cad) {
                                    const dStr = ed.data_liberacao_cad.endsWith('Z') ? ed.data_liberacao_cad : ed.data_liberacao_cad + 'Z';
                                    const msDiff = Date.now() - new Date(dStr).getTime();
                                    msRestantes = (365 * 24 * 60 * 60 * 1000) - msDiff;
                                    expirado = msRestantes <= 0;
                                }

                                return (
                                    <div
                                        key={m.id}
                                        className="glass-panel-internal"
                                        style={{
                                            borderLeft: `4px solid ${cor.border}`,
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            animation: 'slideIn 0.3s ease'
                                        }}
                                    >
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {m.nome_motorista} <span style={{ fontSize: '9px', background: '#059669', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>FROTA</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        <Truck size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                                        {m.placa1}{m.placa2 ? ` / ${m.placa2}` : ''}
                                                    </span>
                                                    {m.tipo_veiculo && (
                                                        <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {m.tipo_veiculo}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: cor.text, padding: '3px 8px', borderRadius: '5px', background: cor.bg, border: `1px solid ${cor.border}` }}>
                                                    {situacao}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div>
                                                <label className="label-tech-sm">SEGURADORA</label>
                                                <select
                                                    className="input-internal"
                                                    style={{ fontSize: '12px' }}
                                                    value={ed.seguradora_cad || ''}
                                                    disabled={!podeEditar}
                                                    onChange={e => atualizarEdicaoFrota(m.id, 'seguradora_cad', e.target.value)}
                                                >
                                                    <option value="" style={{ color: 'black' }}>-- Selecionar --</option>
                                                    {SEGURADORAS.map(s => <option key={s} value={s} style={{ color: 'black' }}>{s}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="label-tech-sm">LIBERAÇÃO (Validade 1 Ano)</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Nº Liberação</label>
                                                        <input
                                                            className="input-internal"
                                                            style={{ fontSize: '12px' }}
                                                            value={ed.num_liberacao_cad || ''}
                                                            disabled={!podeEditar}
                                                            onChange={e => atualizarEdicaoFrota(m.id, 'num_liberacao_cad', e.target.value)}
                                                            placeholder="Ex: 123456"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px', display: 'block' }}>Data/Hora</label>
                                                        <input
                                                            type="datetime-local"
                                                            className="input-internal"
                                                            style={{ fontSize: '11px' }}
                                                            value={ed.data_liberacao_manual || ''}
                                                            disabled={!podeEditar}
                                                            onChange={e => atualizarEdicaoFrota(m.id, 'data_liberacao_manual', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                {ed.data_liberacao_cad && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: expirado ? '#ef4444' : '#10b981', fontSize: '11px', fontWeight: 'bold' }}>
                                                        {expirado ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
                                                        {expirado ? 'Liberação Vencida!' : `Válida por mais ${Math.max(0, Math.floor(msRestantes / (1000 * 60 * 60 * 24)))} dias`}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                            {podeEditar ? (
                                                <button
                                                    onClick={() => salvarFrota(m.id)}
                                                    disabled={estaSalvando}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                        padding: '8px', borderRadius: '7px', border: 'none',
                                                        background: situacao === 'LIBERADO' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.15)',
                                                        color: situacao === 'LIBERADO' ? '#4ade80' : '#fbbf24',
                                                        fontWeight: 'bold', fontSize: '12px',
                                                        cursor: estaSalvando ? 'default' : 'pointer',
                                                        opacity: estaSalvando ? 0.6 : 1,
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Save size={14} />
                                                    {estaSalvando ? 'Salvando...' : 'Salvar Liberação Frota'}
                                                </button>
                                            ) : (
                                                <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '6px 0' }}>🔒 Somente leitura</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
