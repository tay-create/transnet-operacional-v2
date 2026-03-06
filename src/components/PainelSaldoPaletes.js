import { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, RotateCcw, Trash2, X, Filter, FileDown, TrendingUp, Clock } from 'lucide-react';
import api from '../services/apiService';
import { gerarPDFPaletes } from '../utils/pdfGenerator';

// ── Estilos ──────────────────────────────────────────────────────────────────
const s = {
    wrap: { padding: '0 0 40px 0', minHeight: '100vh', background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)' },
    header: {
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderBottom: '1px solid rgba(59,130,246,0.2)',
        padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    },
    body: { padding: '24px 28px' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' },
    kpiCard: (cor) => ({
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${cor}33`,
        borderTop: `3px solid ${cor}`,
        borderRadius: '14px',
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden'
    }),
    tableWrap: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden'
    },
    tableHeader: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
    },
    label: { fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' },
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%' },
    select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', cursor: 'pointer' },
    btn: (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
        borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
        background: color === 'blue' ? '#2563eb' : color === 'red' ? 'rgba(239,68,68,0.15)' : color === 'green' ? 'rgba(34,197,94,0.15)' : color === 'amber' ? 'rgba(251,191,36,0.15)' : color === 'indigo' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.07)',
        color: color === 'blue' ? '#fff' : color === 'red' ? '#f87171' : color === 'green' ? '#4ade80' : color === 'amber' ? '#fbbf24' : color === 'indigo' ? '#a5b4fc' : '#94a3b8',
        border: color === 'red' ? '1px solid rgba(239,68,68,0.25)' : color === 'green' ? '1px solid rgba(34,197,94,0.25)' : color === 'amber' ? '1px solid rgba(251,191,36,0.25)' : color === 'indigo' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s'
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#475569', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(0,0,0,0.2)' },
    td: { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0', verticalAlign: 'middle' },
    badge: (devolvido) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: devolvido ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
        color: devolvido ? '#4ade80' : '#fbbf24',
        border: `1px solid ${devolvido ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`
    }),
    badgeTipo: () => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)'
    }),
    empty: { textAlign: 'center', padding: '60px 20px', color: '#475569', fontSize: '14px' },
    toast: { position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', color: '#4ade80', fontWeight: '600', fontSize: '14px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, valor, cor, sub, icone }) {
    return (
        <div style={s.kpiCard(cor)}>
            <div style={{ position: 'absolute', bottom: '-12px', right: '-12px', opacity: 0.08 }}>
                {icone && <div style={{ transform: 'scale(3)', color: cor }}>{icone}</div>}
            </div>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                {label}
            </div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {valor}
            </div>
            {sub && <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>{sub}</div>}
        </div>
    );
}

// ── Modal de Devolução ──────────────────────────────────────────────────────
function ModalDevolucao({ registro, onClose, onConfirm }) {
    const [modo, setModo] = useState('total');
    const [qtdPbr, setQtdPbr] = useState(0);

    const confirmar = () => {
        if (modo === 'total') {
            onConfirm({ total: true });
        } else {
            onConfirm({ qtd_devolvida_pbr: qtdPbr });
        }
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
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
                        PBR: <strong style={{ color: '#60a5fa' }}>{registro.qtd_pbr}</strong>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button style={{ ...s.btn(modo === 'total' ? 'green' : undefined), flex: 1 }} onClick={() => setModo('total')}>Total</button>
                    <button style={{ ...s.btn(modo === 'parcial' ? 'amber' : undefined), flex: 1 }} onClick={() => setModo('parcial')}>Quantos?</button>
                </div>

                {modo === 'parcial' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={s.label}>Qtd PBR devolvidos (max: {registro.qtd_pbr})</label>
                        <input type="number" min="0" max={registro.qtd_pbr} value={qtdPbr}
                            onChange={e => setQtdPbr(Math.min(Number(e.target.value), registro.qtd_pbr))}
                            style={s.input} />
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
        if (filtroStatus === 'PENDENTE' && r.devolvido) return false;
        if (filtroStatus === 'DEVOLVIDO' && !r.devolvido) return false;
        return true;
    });

    // ── KPIs ──
    const totalPbr = registros.reduce((acc, r) => acc + (r.qtd_pbr || 0), 0);
    const totalDevPbr = registros.reduce((acc, r) => acc + (r.qtd_devolvida_pbr || 0), 0);
    const saldoPbr = totalPbr - totalDevPbr;
    const pendentes = registros.filter(r => !r.devolvido).length;

    function formatarData(dt) {
        if (!dt) return '—';
        const d = new Date(dt.endsWith?.('Z') ? dt : dt + 'Z');
        return d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const handleExportarPDF = () => {
        gerarPDFPaletes(registros, { totalPbr, saldoPbr, totalDevPbr, pendentes });
        mostrarToast('📄 PDF gerado!');
    };

    return (
        <div style={s.wrap}>
            {toast && <div style={s.toast}>{toast}</div>}
            {modalDevolucao && <ModalDevolucao registro={modalDevolucao} onClose={() => setModalDevolucao(null)} onConfirm={registrarDevolucao} />}

            {/* Header */}
            <div style={s.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                        <Package size={22} color="#60a5fa" />
                    </div>
                    <div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#f1f5f9' }}>Saldo de Paletes PBR</div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{registros.length} registros totais</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={s.btn('indigo')} onClick={handleExportarPDF}>
                        <FileDown size={14} /> Exportar PDF
                    </button>
                    <button style={s.btn()} onClick={carregar}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            <div style={s.body}>
                {/* KPI Grid */}
                <div style={s.kpiGrid}>
                    <KpiCard
                        label="Saldo PBR"
                        valor={saldoPbr}
                        cor="#3b82f6"
                        sub={`de ${totalPbr} emitidos`}
                        icone={<Package size={16} />}
                    />
                    <KpiCard
                        label="Total Saídas"
                        valor={totalPbr}
                        cor="#94a3b8"
                        sub="paletes emitidos"
                        icone={<TrendingUp size={16} />}
                    />
                    <KpiCard
                        label="Devolvidos"
                        valor={totalDevPbr}
                        cor="#22c55e"
                        sub="paletes retornados"
                        icone={<RotateCcw size={16} />}
                    />
                    <KpiCard
                        label="Pendentes"
                        valor={pendentes}
                        cor="#f59e0b"
                        sub="aguardando devolução"
                        icone={<Clock size={16} />}
                    />
                </div>

                {/* Tabela */}
                <div style={s.tableWrap}>
                    <div style={s.tableHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={14} color="#64748b" />
                            <select style={s.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                                <option value="TODOS">Todos os status</option>
                                <option value="PENDENTE">Pendente</option>
                                <option value="DEVOLVIDO">Devolvido</option>
                            </select>
                        </div>
                        <span style={{ fontSize: '12px', color: '#475569' }}>{filtrados.length} registros</span>
                    </div>

                    {loading ? (
                        <div style={s.empty}>
                            <RefreshCw size={20} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                            <br />Carregando...
                        </div>
                    ) : filtrados.length === 0 ? (
                        <div style={s.empty}>
                            <Package size={40} color="#1e293b" style={{ marginBottom: '12px' }} />
                            <div>Nenhum registro encontrado.</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>Motorista</th>
                                        <th style={s.th}>Placas</th>
                                        <th style={s.th}>Tipo</th>
                                        <th style={s.th}>Qtd PBR</th>
                                        <th style={s.th}>Fornecedor</th>
                                        <th style={s.th}>Status</th>
                                        <th style={s.th}>Data Entrada</th>
                                        <th style={s.th}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map((r, idx) => {
                                        const saldoPbrRow = (r.qtd_pbr || 0) - (r.qtd_devolvida_pbr || 0);
                                        return (
                                            <tr key={r.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                                <td style={s.td}>
                                                    <div style={{ fontWeight: '600' }}>{r.motorista}</div>
                                                    {r.telefone && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.telefone}</div>}
                                                </td>
                                                <td style={s.td}>
                                                    <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700' }}>{r.placa_cavalo || '—'}</div>
                                                    {r.placa_carreta && <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{r.placa_carreta}</div>}
                                                </td>
                                                <td style={s.td}><span style={s.badgeTipo()}>{r.tipo_palete}</span></td>
                                                <td style={s.td}>
                                                    {r.qtd_pbr > 0 ? (
                                                        <div>
                                                            <span style={{ fontWeight: '800', color: saldoPbrRow > 0 ? '#60a5fa' : '#4ade80', fontSize: '15px' }}>{saldoPbrRow}</span>
                                                            <span style={{ fontSize: '10px', color: '#475569' }}> / {r.qtd_pbr}</span>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td style={s.td}><span style={{ fontSize: '12px', color: '#94a3b8' }}>{r.fornecedor_pbr || '—'}</span></td>
                                                <td style={s.td}><span style={s.badge(r.devolvido)}>{r.devolvido ? '✓ Devolvido' : '⏳ Pendente'}</span></td>
                                                <td style={s.td}>
                                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{formatarData(r.data_entrada)}</div>
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
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
