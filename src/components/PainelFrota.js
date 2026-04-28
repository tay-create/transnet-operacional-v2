import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Edit2, CheckCircle, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
import api from '../services/apiService';
import ModalConfirm from './ModalConfirm';
import RoteirizacaoFrota from './RoteirizacaoFrota';

const CARGOS_GESTAO = ['Coordenador', 'Direção', 'Planejamento', 'Adm Frota', 'Desenvolvedor'];

const COR_STATUS = {
    EM_OPERACAO: { fundo: '#1e293b', borda: '#a78bfa', texto: '#c4b5fd', label: 'Em Operação' },
    CARREGANDO:  { fundo: '#1e293b', borda: '#94a3b8', texto: '#cbd5e1', label: 'Carregando' },
    CARREGADO:   { fundo: '#1c3a1e', borda: '#22c55e', texto: '#4ade80', label: 'Carregado' },
    EM_VIAGEM:   { fundo: '#1c2e1e', borda: '#facc15', texto: '#fde68a', label: 'Em Viagem' },
    RETORNANDO:  { fundo: '#3b2a0e', borda: '#f97316', texto: '#fb923c', label: 'Retornando' },
    CONCLUIDO:   { fundo: '#1e293b', borda: '#64748b', texto: '#94a3b8', label: 'Concluído' },
    MANUTENCAO:  { fundo: '#3b1a1a', borda: '#f87171', texto: '#fca5a5', label: 'Manutenção' },
};

const STATUS_OPCOES = ['EM_OPERACAO', 'CARREGANDO', 'CARREGADO', 'EM_VIAGEM', 'RETORNANDO', 'MANUTENCAO', 'CONCLUIDO'];

// Mapeamento de status do provisionamento para status da roteirização
const PROV_PARA_FROTA = {
    EM_OPERACAO: 'EM_OPERACAO',
    CARREGANDO:  'CARREGANDO',
    CARREGADO:   'CARREGADO',
    EM_VIAGEM:   'EM_VIAGEM',
    EM_VIAGEM_FRETE_RETORNO: 'EM_VIAGEM',
    RETORNANDO:  'RETORNANDO',
    MANUTENCAO:  'MANUTENCAO',
};

function calcularStatusLocal(r) {
    if (['MANUTENCAO', 'CONCLUIDO', 'CARREGANDO', 'CARREGADO', 'EM_OPERACAO'].includes(r.status_manual)) return r.status_manual;
    const agora = new Date();
    const saida = r.data_saida ? new Date(r.data_saida) : null;
    const retorno = r.data_retorno_prevista ? new Date(r.data_retorno_prevista + 'T23:59:59') : null;
    const ultimaEntrega = r.destinos?.length > 0
        ? r.destinos.reduce((max, d) => d.data && d.data > max ? d.data : max, '')
        : null;
    if (!saida || agora < saida) return 'EM_OPERACAO';
    if (retorno && agora > retorno) return 'CONCLUIDO';
    if (ultimaEntrega && agora > new Date(ultimaEntrega + 'T23:59:59')) {
        return retorno ? 'RETORNANDO' : 'CONCLUIDO';
    }
    return 'EM_VIAGEM';
}

function BadgeStatus({ status }) {
    const cor = COR_STATUS[status] || COR_STATUS.EM_OPERACAO;
    return (
        <span style={{
            background: cor.fundo, border: `1px solid ${cor.borda}`, color: cor.texto,
            borderRadius: '4px', padding: '2px 8px', fontSize: '11px',
            fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
            {cor.label}
        </span>
    );
}

function CardRoteirizacao({ r, podeEditar, onStatusChange, onEditar, onConcluir, onManutencao }) {
    const [abrirStatus, setAbrirStatus] = useState(false);
    const status = calcularStatusLocal(r);

    const fmt = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };
    const fmtDH = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{
            background: '#1e293b', border: `1px solid ${COR_STATUS[status]?.borda || '#334155'}`,
            borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
            {/* Cabeçalho */}
            <div style={{ background: '#0f172a', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={16} color="#64748b" />
                    <span style={{ fontWeight: '700', color: '#f1f5f9', fontSize: '15px' }}>
                        {r.nome_cliente || '(sem cliente)'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    <BadgeStatus status={status} />
                    {podeEditar && (
                        <button onClick={() => setAbrirStatus(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}>
                            <ChevronDown size={14} />
                        </button>
                    )}
                    {abrirStatus && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', zIndex: 50, minWidth: '150px' }}>
                            {STATUS_OPCOES.filter(s => s !== status).map(s => (
                                <div
                                    key={s}
                                    onClick={() => {
                                        setAbrirStatus(false);
                                        if (s === 'MANUTENCAO') onManutencao(r);
                                        else if (s === 'CONCLUIDO') onConcluir(r);
                                        else onStatusChange(r.id, s);
                                    }}
                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: COR_STATUS[s]?.texto || '#cbd5e1' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {COR_STATUS[s]?.label || s}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Corpo */}
            <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                    <div>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Motorista</span>
                        <div style={{ color: '#e2e8f0' }}>{r.motorista_nome || '—'}</div>
                    </div>
                    <div>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Operação</span>
                        <div style={{ color: '#e2e8f0', fontSize: '12px' }}>{r.operacao || '—'}</div>
                    </div>
                    <div>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Cavalo</span>
                        <div style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{r.placa_cavalo || '—'}</div>
                    </div>
                    <div>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>Carreta</span>
                        <div style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{r.placa_carreta || '—'}</div>
                    </div>
                    {r.origem && (
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Origem</span>
                            <div style={{ color: '#e2e8f0' }}>{r.origem}</div>
                        </div>
                    )}
                    {r.data_entrada_operacao && (
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Entrada em Op.</span>
                            <div style={{ color: '#e2e8f0' }}>{fmtDH(r.data_entrada_operacao)}</div>
                        </div>
                    )}
                    {r.data_saida && (
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Saída</span>
                            <div style={{ color: '#e2e8f0' }}>{fmtDH(r.data_saida)}</div>
                        </div>
                    )}
                    {r.data_retorno_prevista && (
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Retorno Prev.</span>
                            <div style={{ color: '#e2e8f0' }}>{fmt(r.data_retorno_prevista)}</div>
                        </div>
                    )}
                </div>

                {r.coleta_recife && (
                    <div style={{ fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>Coleta Recife: </span>
                        <span style={{ color: '#cbd5e1' }}>{r.coleta_recife}</span>
                    </div>
                )}
                {r.coleta_moreno && (
                    <div style={{ fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>Coleta Moreno: </span>
                        <span style={{ color: '#cbd5e1' }}>{r.coleta_moreno}</span>
                    </div>
                )}

                {r.destinos?.length > 0 && (
                    <div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>Destinos</div>
                        {r.destinos.map((d, i) => (
                            <div key={i} style={{ fontSize: '12px', color: '#cbd5e1', display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#64748b' }}>{i + 1}.</span>
                                <span>{d.cidade}{d.uf ? ` - ${d.uf}` : ''}</span>
                                {d.data && <span style={{ color: '#64748b' }}>{fmt(d.data)}</span>}
                            </div>
                        ))}
                    </div>
                )}

                {status === 'MANUTENCAO' && r.observacao_manutencao && (
                    <div style={{ background: '#3b1a1a', border: '1px solid #f87171', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#fca5a5' }}>
                        <AlertTriangle size={12} style={{ marginRight: '4px', display: 'inline' }} />
                        {r.observacao_manutencao}
                    </div>
                )}
            </div>

            {/* Rodapé */}
            {podeEditar && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid #334155', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => onEditar(r)} style={{ background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit2 size={12} /> Editar
                    </button>
                    <button onClick={() => onConcluir(r)} style={{ background: '#1c3a1e', border: '1px solid #22c55e', borderRadius: '6px', color: '#4ade80', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Concluir
                    </button>
                </div>
            )}
        </div>
    );
}

export default function PainelFrota({ socket, user }) {
    const [roteirizacoes, setRoteirizacoes] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [editando, setEditando] = useState(null);
    const [confirmConcluir, setConfirmConcluir] = useState(null);
    const [modalManutencao, setModalManutencao] = useState(null);
    const [obsManutencao, setObsManutencao] = useState('');
    const [modalDuplicar, setModalDuplicar] = useState(null);
    const [formDuplicar, setFormDuplicar] = useState({ motorista_nome: '', motorista_id: null, placa_cavalo: '', placa_carreta: '' });
    const [motoristasFreota, setMotoristasFreota] = useState([]);
    const [buscaDupMotorista, setBuscaDupMotorista] = useState('');
    const [mostrarDropDup, setMostrarDropDup] = useState(false);

    const podeEditar = CARGOS_GESTAO.includes(user?.cargo);

    const carregar = useCallback(async () => {
        try {
            const r = await api.get('/api/roteirizacao');
            setRoteirizacoes(r.data?.roteirizacoes || []);
        } catch (e) {
            console.error('Erro ao carregar roteirizações:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    useEffect(() => {
        api.get('/api/marcacoes/disponiveis').then(r => {
            setMotoristasFreota((r.data?.motoristas || []).filter(m => m.is_frota));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data.tipo === 'roteirizacao_atualizada') {
                if (data.acao === 'concluida') {
                    setRoteirizacoes(prev => prev.filter(r => r.id !== data.id));
                } else if (data.acao === 'criada') {
                    setRoteirizacoes(prev => [data.roteirizacao, ...prev]);
                } else {
                    setRoteirizacoes(prev => prev.map(r => r.id === data.roteirizacao?.id ? data.roteirizacao : r));
                }
            }

            // Sincronização reversa: mudança no Provisionamento atualiza o card
            if (data.tipo === 'prov_status_atualizado') {
                const novoStatus = PROV_PARA_FROTA[data.status];
                if (!novoStatus) return;
                setRoteirizacoes(prev => prev.map(r => {
                    const placas = [r.placa_cavalo, r.placa_carreta].filter(Boolean).map(p => p.toUpperCase());
                    if (!placas.length) return r;
                    // Verifica se o veiculo_id corresponde a alguma placa desta roteirização
                    // (heurística: se o socket trouxer placa_cavalo, comparamos; senão confiamos no veiculo_id via refresh)
                    if (data.placa && !placas.includes(data.placa.toUpperCase())) return r;
                    if (novoStatus === 'MANUTENCAO') {
                        // Não muda silenciosamente — frontend abre modal se necessário
                        return r;
                    }
                    return { ...r, status: novoStatus, status_manual: novoStatus };
                }));
            }
        };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket]);

    const mudarStatus = async (id, status) => {
        try {
            await api.patch(`/api/roteirizacao/${id}/status`, { status });
        } catch (e) {
            console.error('Erro ao mudar status:', e);
        }
    };

    const confirmarConcluir = async () => {
        if (!confirmConcluir) return;
        try {
            await api.delete(`/api/roteirizacao/${confirmConcluir.id}`);
            setRoteirizacoes(prev => prev.filter(r => r.id !== confirmConcluir.id));
        } catch (e) {
            console.error('Erro ao concluir:', e);
        }
        setConfirmConcluir(null);
    };

    const abrirManutencao = (r) => {
        setObsManutencao('');
        setModalManutencao(r);
    };

    const confirmarManutencao = async () => {
        if (!modalManutencao) return;
        // "Não" → exclui o card (marca CONCLUIDO e remove do painel)
        try {
            await api.patch(`/api/roteirizacao/${modalManutencao.id}/status`, {
                status: 'MANUTENCAO',
                observacao_manutencao: obsManutencao,
            });
            setRoteirizacoes(prev => prev.filter(r => r.id !== modalManutencao.id));
        } catch (e) {
            console.error('Erro ao registrar manutenção:', e);
        }
        setModalManutencao(null);
    };

    const abrirDuplicar = () => {
        setFormDuplicar({ motorista_nome: '', motorista_id: null, placa_cavalo: '', placa_carreta: '' });
        setBuscaDupMotorista('');
        setModalDuplicar(modalManutencao);
        setModalManutencao(null);
    };

    const confirmarDuplicar = async () => {
        if (!modalDuplicar) return;
        try {
            // Registra manutenção no original
            await api.patch(`/api/roteirizacao/${modalDuplicar.id}/status`, {
                status: 'MANUTENCAO',
                observacao_manutencao: obsManutencao,
            });
            setRoteirizacoes(prev => prev.filter(r => r.id !== modalDuplicar.id));
            // Cria nova roteirização com novo veículo
            await api.post(`/api/roteirizacao/${modalDuplicar.id}/duplicar`, formDuplicar);
        } catch (e) {
            console.error('Erro ao duplicar:', e);
        }
        setModalDuplicar(null);
    };

    const dupMotoristasFiltrados = motoristasFreota.filter(m =>
        m.nome_motorista?.toLowerCase().includes(buscaDupMotorista.toLowerCase())
    );

    const inputStyle = {
        background: '#0f172a', border: '1px solid #334155', borderRadius: '6px',
        color: '#e2e8f0', padding: '8px 10px', fontSize: '14px', outline: 'none',
        width: '100%', boxSizing: 'border-box',
    };

    if (editando) {
        return (
            <RoteirizacaoFrota
                socket={socket} user={user}
                roteirizacaoEditando={editando}
                onSalvo={() => setEditando(null)}
                onCancelar={() => setEditando(null)}
            />
        );
    }

    return (
        <div style={{ padding: '24px', color: '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
                    Painel de Provisionamento — Frota
                </div>
                <button onClick={carregar} style={{ background: '#334155', border: 'none', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {carregando ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '60px' }}>Carregando...</div>
            ) : roteirizacoes.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '60px' }}>
                    <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <div>Nenhuma roteirização ativa.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {roteirizacoes.map(r => (
                        <CardRoteirizacao
                            key={r.id} r={r} podeEditar={podeEditar}
                            onStatusChange={mudarStatus}
                            onEditar={setEditando}
                            onConcluir={setConfirmConcluir}
                            onManutencao={abrirManutencao}
                        />
                    ))}
                </div>
            )}

            {confirmConcluir && (
                <ModalConfirm
                    titulo="Concluir roteirização"
                    mensagem={`Confirma a conclusão da viagem de ${confirmConcluir.nome_cliente || confirmConcluir.motorista_nome}?`}
                    onConfirm={confirmarConcluir}
                    onCancel={() => setConfirmConcluir(null)}
                    textConfirm="Concluir"
                    variante="aviso"
                />
            )}

            {/* Modal: Manutenção */}
            {modalManutencao && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#1e293b', border: '1px solid #f87171', borderRadius: '10px', padding: '24px', maxWidth: '440px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fca5a5' }}>
                            <AlertTriangle size={18} />
                            <span style={{ fontWeight: '700', fontSize: '16px' }}>Veículo em Manutenção</span>
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '12px' }}>
                            Descreva a ocorrência para <strong>{modalManutencao.nome_cliente || modalManutencao.motorista_nome}</strong>.
                        </p>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }}
                            value={obsManutencao}
                            onChange={e => setObsManutencao(e.target.value)}
                            placeholder="Descreva a ocorrência..."
                            autoFocus
                        />
                        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '16px 0 12px' }}>
                            Deseja criar um novo lançamento com outro veículo para este cliente?
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalManutencao(null)} style={{ background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}>
                                Cancelar
                            </button>
                            <button onClick={confirmarManutencao} style={{ background: '#3b1a1a', border: '1px solid #f87171', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}>
                                Não, encerrar card
                            </button>
                            <button onClick={abrirDuplicar} style={{ background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}>
                                Sim, novo veículo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Duplicar com novo veículo */}
            {modalDuplicar && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '10px', padding: '24px', maxWidth: '440px', width: '100%' }}>
                        <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '16px', marginBottom: '16px' }}>
                            Novo lançamento com outro veículo
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Novo Motorista *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        style={inputStyle}
                                        value={buscaDupMotorista}
                                        onChange={e => { setBuscaDupMotorista(e.target.value); setFormDuplicar(f => ({ ...f, motorista_nome: e.target.value, motorista_id: null })); setMostrarDropDup(true); }}
                                        onFocus={() => setMostrarDropDup(true)}
                                        onBlur={() => setTimeout(() => setMostrarDropDup(false), 150)}
                                        placeholder="Digite o nome..."
                                    />
                                    {mostrarDropDup && dupMotoristasFiltrados.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', zIndex: 50, maxHeight: '150px', overflowY: 'auto' }}>
                                            {dupMotoristasFiltrados.map(m => (
                                                <div key={m.id}
                                                    onMouseDown={() => { setFormDuplicar(f => ({ ...f, motorista_nome: m.nome_motorista, motorista_id: m.id })); setBuscaDupMotorista(m.nome_motorista); setMostrarDropDup(false); }}
                                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {m.nome_motorista}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nova Placa Cavalo</label>
                                <input style={inputStyle} value={formDuplicar.placa_cavalo} onChange={e => setFormDuplicar(f => ({ ...f, placa_cavalo: e.target.value.toUpperCase() }))} placeholder="Ex: ABC1D23" />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nova Placa Carreta</label>
                                <input style={inputStyle} value={formDuplicar.placa_carreta} onChange={e => setFormDuplicar(f => ({ ...f, placa_carreta: e.target.value.toUpperCase() }))} placeholder="Ex: XYZ9876" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={() => setModalDuplicar(null)} style={{ background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}>
                                Cancelar
                            </button>
                            <button onClick={confirmarDuplicar} style={{ background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}>
                                Criar novo lançamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
