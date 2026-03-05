import React, { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, RotateCcw, Trash2, X, Filter } from 'lucide-react';
import api from '../services/apiService';

// ── Estilos reutilizados do padrão GestaoMarcacoes ──────────────────────────
const s = {
    wrap: { padding: '10px 0' },
    card: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
    label: { fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' },
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%' },
    select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%', cursor: 'pointer' },
    btn: (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
        borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
        background: color === 'blue' ? '#2563eb' : color === 'red' ? 'rgba(239,68,68,0.15)' : color === 'green' ? 'rgba(34,197,94,0.15)' : color === 'amber' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)',
        color: color === 'blue' ? '#fff' : color === 'red' ? '#f87171' : color === 'green' ? '#4ade80' : color === 'amber' ? '#fbbf24' : '#94a3b8',
        border: color === 'red' ? '1px solid rgba(239,68,68,0.25)' : color === 'green' ? '1px solid rgba(34,197,94,0.25)' : color === 'amber' ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s'
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0', verticalAlign: 'middle' },
    badge: (devolvido) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: devolvido ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
        color: devolvido ? '#4ade80' : '#fbbf24',
        border: `1px solid ${devolvido ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`
    }),
    badgeTipo: (tipo) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: tipo === 'PBR' ? 'rgba(59,130,246,0.12)' : tipo === 'DESCARTAVEL' ? 'rgba(168,85,247,0.12)' : 'rgba(251,146,60,0.12)',
        color: tipo === 'PBR' ? '#60a5fa' : tipo === 'DESCARTAVEL' ? '#c084fc' : '#fb923c',
        border: `1px solid ${tipo === 'PBR' ? 'rgba(59,130,246,0.25)' : tipo === 'DESCARTAVEL' ? 'rgba(168,85,247,0.25)' : 'rgba(251,146,60,0.25)'}`
    }),
    empty: { textAlign: 'center', padding: '40px', color: '#475569', fontSize: '14px' },
    toast: { position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', color: '#4ade80', fontWeight: '600', fontSize: '14px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, valor, cor, icone }) {
    return (
        <div style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px', padding: '16px 20px', flex: 1, minWidth: '160px',
            position: 'relative', overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px',
                borderRadius: '50%', background: cor, opacity: 0.06
            }} />
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: '800', color: cor, fontFamily: "'Courier New', monospace" }}>{valor}</span>
                {icone}
            </div>
        </div>
    );
}

// ── Modal de Devolução ──────────────────────────────────────────────────────
function ModalDevolucao({ registro, onClose, onConfirm }) {
    const [modo, setModo] = useState('total'); // 'total' ou 'parcial'
    const [qtdPbr, setQtdPbr] = useState(0);
    const [qtdDesc, setQtdDesc] = useState(0);

    const confirmar = () => {
        if (modo === 'total') {
            onConfirm({ total: true });
        } else {
            onConfirm({ qtd_devolvida_pbr: qtdPbr, qtd_devolvida_desc: qtdDesc });
        }
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RotateCcw size={18} color="#4ade80" /> Registrar Devolução
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Motorista: <strong style={{ color: '#f1f5f9' }}>{registro.motorista}</strong></div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {registro.qtd_pbr > 0 && <span>PBR: <strong style={{ color: '#60a5fa' }}>{registro.qtd_pbr}</strong> </span>}
                        {registro.qtd_descartavel > 0 && <span>Desc.: <strong style={{ color: '#c084fc' }}>{registro.qtd_descartavel}</strong></span>}
                    </div>
                </div>

                {/* Opções */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                        style={{ ...s.btn(modo === 'total' ? 'green' : undefined), flex: 1 }}
                        onClick={() => setModo('total')}
                    >Total</button>
                    <button
                        style={{ ...s.btn(modo === 'parcial' ? 'amber' : undefined), flex: 1 }}
                        onClick={() => setModo('parcial')}
                    >Quantos?</button>
                </div>

                {modo === 'parcial' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                        {registro.qtd_pbr > 0 && (
                            <div>
                                <label style={s.label}>Qtd PBR devolvidos (max: {registro.qtd_pbr})</label>
                                <input type="number" min="0" max={registro.qtd_pbr} value={qtdPbr}
                                    onChange={e => setQtdPbr(Math.min(Number(e.target.value), registro.qtd_pbr))}
                                    style={s.input} />
                            </div>
                        )}
                        {registro.qtd_descartavel > 0 && (
                            <div>
                                <label style={s.label}>Qtd Descartável devolvidos (max: {registro.qtd_descartavel})</label>
                                <input type="number" min="0" max={registro.qtd_descartavel} value={qtdDesc}
                                    onChange={e => setQtdDesc(Math.min(Number(e.target.value), registro.qtd_descartavel))}
                                    style={s.input} />
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button style={s.btn()} onClick={onClose}>Cancelar</button>
                    <button style={s.btn('green')} onClick={confirmar}>
                        <RotateCcw size={14} /> Confirmar Devolução
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente Principal ────────────────────────────────────────────────────
export default function PainelSaldoPaletes() {
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('TODOS');
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [modalDevolucao, setModalDevolucao] = useState(null);

    const mostrarToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/saldo-paletes');
            if (r.data.success) setRegistros(r.data.registros);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    const registrarDevolucao = async (dados) => {
        if (!modalDevolucao) return;
        try {
            const r = await api.put(`/api/saldo-paletes/${modalDevolucao.id}/devolucao`, dados);
            if (r.data.success) {
                mostrarToast('✅ Devolução registrada!');
                setModalDevolucao(null);
                carregar();
            }
        } catch (e) { mostrarToast('Erro ao registrar devolução.'); }
    };

    const excluir = async (id) => {
        if (!window.confirm('Excluir este registro permanentemente?')) return;
        try {
            await api.delete(`/api/saldo-paletes/${id}`);
            mostrarToast('🗑️ Registro removido.');
            carregar();
        } catch (e) { mostrarToast('Erro ao excluir.'); }
    };

    // ── Filtros ──
    const filtrados = registros.filter(r => {
        if (filtroTipo !== 'TODOS' && r.tipo_palete !== filtroTipo) return false;
        if (filtroStatus === 'PENDENTE' && r.devolvido) return false;
        if (filtroStatus === 'DEVOLVIDO' && !r.devolvido) return false;
        return true;
    });

    // ── KPIs ──
    const totalPbr = registros.reduce((acc, r) => acc + (r.qtd_pbr || 0), 0);
    const totalDesc = registros.reduce((acc, r) => acc + (r.qtd_descartavel || 0), 0);
    const totalDevPbr = registros.reduce((acc, r) => acc + (r.qtd_devolvida_pbr || 0), 0);
    const totalDevDesc = registros.reduce((acc, r) => acc + (r.qtd_devolvida_desc || 0), 0);
    const saldoPbr = totalPbr - totalDevPbr;
    const saldoDesc = totalDesc - totalDevDesc;
    const pendentes = registros.filter(r => !r.devolvido).length;

    function formatarData(dt) {
        if (!dt) return '—';
        const d = new Date(dt.endsWith?.('Z') ? dt : dt + 'Z');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div style={s.wrap}>
            {toast && <div style={s.toast}>{toast}</div>}
            {modalDevolucao && <ModalDevolucao registro={modalDevolucao} onClose={() => setModalDevolucao(null)} onConfirm={registrarDevolucao} />}

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Package size={22} color="#60a5fa" />
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Saldo de Paletes</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={s.btn()} onClick={carregar}><RefreshCw size={14} /> Atualizar</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <KpiCard label="Saldo PBR" valor={saldoPbr} cor="#60a5fa" icone={<Package size={16} color="#60a5fa" />} />
                <KpiCard label="Saldo Descartável" valor={saldoDesc} cor="#c084fc" icone={<Package size={16} color="#c084fc" />} />
                <KpiCard label="Pendentes" valor={pendentes} cor="#fbbf24" icone={<RotateCcw size={16} color="#fbbf24" />} />
                <KpiCard label="Total Devolvido" valor={totalDevPbr + totalDevDesc} cor="#4ade80" icone={<RotateCcw size={16} color="#4ade80" />} />
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
                <Filter size={14} color="#64748b" />
                <select style={{ ...s.select, width: 'auto', minWidth: '140px', fontSize: '12px', padding: '6px 10px' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    <option value="TODOS">Todos os tipos</option>
                    <option value="PBR">PBR</option>
                    <option value="DESCARTAVEL">Descartável</option>
                    <option value="MISTO">Misto</option>
                </select>
                <select style={{ ...s.select, width: 'auto', minWidth: '140px', fontSize: '12px', padding: '6px 10px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                    <option value="TODOS">Todos os status</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="DEVOLVIDO">Devolvido</option>
                </select>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>{filtrados.length} registros</span>
            </div>

            {/* Tabela */}
            {loading ? (
                <div style={s.empty}>Carregando...</div>
            ) : filtrados.length === 0 ? (
                <div style={s.empty}>Nenhum registro encontrado.</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={s.table}>
                        <thead>
                            <tr>
                                <th style={s.th}>Motorista</th>
                                <th style={s.th}>Placas</th>
                                <th style={s.th}>Tipo</th>
                                <th style={s.th}>Qtd PBR</th>
                                <th style={s.th}>Qtd Desc.</th>
                                <th style={s.th}>Fornecedor</th>
                                <th style={s.th}>Status</th>
                                <th style={s.th}>Data</th>
                                <th style={s.th}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map(r => {
                                const saldoPbrRow = (r.qtd_pbr || 0) - (r.qtd_devolvida_pbr || 0);
                                const saldoDescRow = (r.qtd_descartavel || 0) - (r.qtd_devolvida_desc || 0);
                                return (
                                    <tr key={r.id}>
                                        <td style={s.td}>
                                            <div style={{ fontWeight: '600' }}>{r.motorista}</div>
                                            {r.telefone && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.telefone}</div>}
                                        </td>
                                        <td style={s.td}>
                                            <div style={{ fontSize: '12px' }}>{r.placa_cavalo || '—'}</div>
                                            {r.placa_carreta && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.placa_carreta}</div>}
                                        </td>
                                        <td style={s.td}><span style={s.badgeTipo(r.tipo_palete)}>{r.tipo_palete}</span></td>
                                        <td style={s.td}>
                                            {r.qtd_pbr > 0 ? (
                                                <div>
                                                    <span style={{ fontWeight: '700', color: '#60a5fa' }}>{saldoPbrRow}</span>
                                                    <span style={{ fontSize: '10px', color: '#475569' }}> / {r.qtd_pbr}</span>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td style={s.td}>
                                            {r.qtd_descartavel > 0 ? (
                                                <div>
                                                    <span style={{ fontWeight: '700', color: '#c084fc' }}>{saldoDescRow}</span>
                                                    <span style={{ fontSize: '10px', color: '#475569' }}> / {r.qtd_descartavel}</span>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td style={s.td}>{r.fornecedor_pbr || '—'}</td>
                                        <td style={s.td}><span style={s.badge(r.devolvido)}>{r.devolvido ? 'Devolvido' : 'Pendente'}</span></td>
                                        <td style={s.td}>
                                            <div style={{ fontSize: '12px' }}>{formatarData(r.data_entrada)}</div>
                                            {r.data_devolucao && <div style={{ fontSize: '10px', color: '#4ade80' }}>Dev: {formatarData(r.data_devolucao)}</div>}
                                        </td>
                                        <td style={s.td}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {!r.devolvido && (
                                                    <button style={s.btn('green')} onClick={() => setModalDevolucao(r)} title="Registrar devolução">
                                                        <RotateCcw size={13} /> Devolver
                                                    </button>
                                                )}
                                                <button style={{ ...s.btn('red'), padding: '6px 8px' }} onClick={() => excluir(r.id)} title="Excluir">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
