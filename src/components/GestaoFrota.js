import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Users, Zap, Plus, Trash2, ShieldAlert, ShieldOff, RefreshCw, CheckCircle, MapPin, AlertTriangle, Pencil, X, ClipboardCheck, Eye, Calendar } from 'lucide-react';
import io from 'socket.io-client';
import api from '../services/apiService';
import { API_URL } from '../constants';

const socket = io(API_URL);

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = {
    input: {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '9px 13px', color: '#f1f5f9', fontSize: '13px',
        outline: 'none', width: '100%', boxSizing: 'border-box'
    },
    label: {
        fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '5px', display: 'block'
    },
    card: {
        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px', padding: '20px'
    },
    btnPrimary: {
        display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px',
        borderRadius: '8px', background: 'rgba(56,189,248,0.15)',
        border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    btnDanger: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)',
        background: 'rgba(248,113,113,0.08)', color: '#f87171', cursor: 'pointer', fontSize: '12px'
    },
    btnPlantao: (ativo) => ({
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
        border: `1px solid ${ativo ? 'rgba(34,197,94,0.4)' : 'rgba(100,116,139,0.3)'}`,
        background: ativo ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.08)',
        color: ativo ? '#4ade80' : '#64748b'
    }),
    tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
    td: { padding: '10px 12px', fontSize: '13px', color: '#cbd5e1', verticalAlign: 'middle' },
    th: {
        padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.2)', textAlign: 'left'
    },
};

const TIPOS_VEICULO = ['Cavalo', 'Carreta', 'Truck', '3/4'];

// ── Componente de abas ────────────────────────────────────────────────────────

// Componente interativo de previsao de disponibilidade (click-to-edit)
function PrevisaoCell({ viagem }) {
    const [editando, setEditando] = useState(false);
    const [valor, setValor] = useState(viagem.previsao_disponibilidade || '');

    const salvar = async (novaData) => {
        setValor(novaData);
        setEditando(false);
        try {
            await api.put('/api/frota/previsao', {
                motorista_id: viagem.motorista_id,
                previsao_disponibilidade: novaData,
            });
        } catch (err) {
            console.error('Erro ao salvar previsao:', err);
        }
    };

    if (editando) {
        return (
            <input
                type="date"
                autoFocus
                value={valor}
                onChange={e => salvar(e.target.value)}
                onBlur={() => setEditando(false)}
                style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(129,140,248,0.4)',
                    borderRadius: '6px', padding: '4px 8px', color: '#f1f5f9', fontSize: '11px',
                    outline: 'none', colorScheme: 'dark', width: '120px'
                }}
            />
        );
    }

    if (valor) {
        return (
            <button
                onClick={() => setEditando(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#818cf8', fontWeight: '600', cursor: 'pointer', fontSize: '11px', padding: 0 }}
            >
                <Calendar size={12} />
                {new Date(valor + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </button>
        );
    }

    return (
        <button
            onClick={() => setEditando(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', fontWeight: '600', padding: 0 }}
            className="hover:text-blue-400"
        >
            <Calendar size={12} /> Informar
        </button>
    );
}

function Tabs({ abas, abaAtiva, setAbaAtiva }) {
    return (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
            {abas.map(aba => (
                <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                        background: abaAtiva === aba.id ? 'rgba(56,189,248,0.1)' : 'transparent',
                        color: abaAtiva === aba.id ? '#38bdf8' : '#64748b',
                        borderBottom: abaAtiva === aba.id ? '2px solid #38bdf8' : '2px solid transparent',
                        fontWeight: abaAtiva === aba.id ? '700' : '500', fontSize: '13px',
                        transition: 'all 0.2s'
                    }}>
                    {aba.icon} {aba.label}
                </button>
            ))}
        </div>
    );
}

// ── Aba Veículos ──────────────────────────────────────────────────────────────

function AbaVeiculos() {
    const [veiculos, setVeiculos] = useState([]);
    const [form, setForm] = useState({ placa: '', tipo: 'Cavalo', modelo: '' });
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');

    const carregar = useCallback(async () => {
        try {
            const { data } = await api.get('/api/frota/veiculos');
            setVeiculos(data.veiculos || []);
        } catch (e) {
            setAviso('Erro ao carregar veículos.');
        }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    const salvar = async (e) => {
        e.preventDefault();
        if (!form.placa.trim()) return setAviso('Informe a placa.');
        setLoading(true);
        try {
            await api.post('/api/frota/veiculos', form);
            setForm({ placa: '', tipo: 'Cavalo', modelo: '' });
            setAviso('');
            carregar();
        } catch (err) {
            setAviso(err.response?.data?.message || 'Erro ao salvar.');
        } finally {
            setLoading(false);
        }
    };

    const excluir = async (id) => {
        if (!window.confirm('Excluir este veículo?')) return;
        try {
            await api.delete(`/api/frota/veiculos/${id}`);
            carregar();
        } catch { setAviso('Erro ao excluir.'); }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' }}>
            {/* Formulário */}
            <div style={s.card}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={15} /> Novo Veículo
                </div>
                {aviso && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '12px' }}>{aviso}</div>}
                <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={s.label}>Placa *</label>
                        <input style={s.input} value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1234 ou ABC1D23" maxLength={8} />
                    </div>
                    <div>
                        <label style={s.label}>Tipo *</label>
                        <select style={s.input} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                            {TIPOS_VEICULO.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={s.label}>Modelo</label>
                        <input style={s.input} value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} placeholder="Ex: Volvo FH 540" />
                    </div>
                    <button type="submit" disabled={loading} style={s.btnPrimary}>
                        <Plus size={14} /> {loading ? 'Salvando...' : 'Cadastrar'}
                    </button>
                </form>
            </div>

            {/* Lista */}
            <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={s.th}>Placa</th>
                            <th style={s.th}>Tipo</th>
                            <th style={s.th}>Modelo</th>
                            <th style={{ ...s.th, width: '60px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {veiculos.length === 0 ? (
                            <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', padding: '32px', color: '#475569' }}>Nenhum veículo cadastrado.</td></tr>
                        ) : veiculos.map(v => (
                            <tr key={v.id} style={s.tr}>
                                <td style={{ ...s.td, fontWeight: '700', color: '#f1f5f9' }}>{v.placa}</td>
                                <td style={s.td}>
                                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>{v.tipo}</span>
                                </td>
                                <td style={{ ...s.td, color: '#94a3b8' }}>{v.modelo || '—'}</td>
                                <td style={s.td}>
                                    <button onClick={() => excluir(v.id)} style={s.btnDanger} title="Excluir"><Trash2 size={13} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Aba Motoristas ────────────────────────────────────────────────────────────

function AbaMotoristas() {
    const [motoristas, setMotoristas] = useState([]);
    const [form, setForm] = useState({ nome: '', cpf: '', celular: '', senha: '' });
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');

    const carregar = useCallback(async () => {
        try {
            const { data } = await api.get('/api/frota/motoristas');
            setMotoristas(data.motoristas || []);
        } catch { setAviso('Erro ao carregar motoristas.'); }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    const salvar = async (e) => {
        e.preventDefault();
        if (!form.nome.trim() || !form.cpf.trim()) return setAviso('Nome e CPF são obrigatórios.');
        setLoading(true);
        try {
            await api.post('/api/frota/motoristas', form);
            setForm({ nome: '', cpf: '', celular: '', senha: '' });
            setAviso('');
            carregar();
        } catch (err) {
            setAviso(err.response?.data?.message || 'Erro ao salvar.');
        } finally {
            setLoading(false);
        }
    };

    const excluir = async (id) => {
        if (!window.confirm('Excluir este motorista?')) return;
        try {
            await api.delete(`/api/frota/motoristas/${id}`);
            carregar();
        } catch { setAviso('Erro ao excluir.'); }
    };

    const togglePlantao = async (id) => {
        try {
            const { data } = await api.patch(`/api/frota/motoristas/${id}/plantao`);
            setMotoristas(prev => prev.map(m => m.id === id ? { ...m, modo_plantao: data.modo_plantao } : m));
        } catch { setAviso('Erro ao alterar plantão.'); }
    };

    const cpfMask = (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
    const celMask = (v) => v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').slice(0, 15);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' }}>
            {/* Formulário */}
            <div style={s.card}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={15} /> Novo Motorista
                </div>
                {aviso && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '12px' }}>{aviso}</div>}
                <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={s.label}>Nome *</label>
                        <input style={s.input} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
                    </div>
                    <div>
                        <label style={s.label}>CPF *</label>
                        <input style={s.input} value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: cpfMask(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} />
                    </div>
                    <div>
                        <label style={s.label}>Celular</label>
                        <input style={s.input} value={form.celular} onChange={e => setForm(p => ({ ...p, celular: celMask(e.target.value) }))} placeholder="(81) 99999-0000" maxLength={15} />
                    </div>
                    <div>
                        <label style={s.label}>Senha do App</label>
                        <input style={s.input} type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="Senha para login no app" />
                    </div>
                    <button type="submit" disabled={loading} style={s.btnPrimary}>
                        <Plus size={14} /> {loading ? 'Salvando...' : 'Cadastrar'}
                    </button>
                </form>
            </div>

            {/* Lista */}
            <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={s.th}>Nome</th>
                            <th style={s.th}>CPF</th>
                            <th style={s.th}>Celular</th>
                            <th style={s.th}>Plantão</th>
                            <th style={{ ...s.th, width: '60px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {motoristas.length === 0 ? (
                            <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: '32px', color: '#475569' }}>Nenhum motorista cadastrado.</td></tr>
                        ) : motoristas.map(m => (
                            <tr key={m.id} style={s.tr}>
                                <td style={{ ...s.td, fontWeight: '700', color: '#f1f5f9' }}>{m.nome}</td>
                                <td style={{ ...s.td, color: '#94a3b8', fontFamily: 'monospace' }}>{m.cpf}</td>
                                <td style={{ ...s.td, color: '#94a3b8' }}>{m.celular || '—'}</td>
                                <td style={s.td}>
                                    <button onClick={() => togglePlantao(m.id)} style={s.btnPlantao(m.modo_plantao)} title="Alternar modo plantão (libera app no fim de semana)">
                                        {m.modo_plantao
                                            ? <><ShieldAlert size={12} /> PLANTÃO</>
                                            : <><ShieldOff size={12} /> Inativo</>
                                        }
                                    </button>
                                </td>
                                <td style={s.td}>
                                    <button onClick={() => excluir(m.id)} style={s.btnDanger} title="Excluir"><Trash2 size={13} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Aba Despacho Rápido ───────────────────────────────────────────────────────

function AbaDespacho({ viagens, setViagens, toast, carregar }) {
    const [motoristas, setMotoristas] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [form, setForm] = useState({ motorista_id: '', cavalo_id: '', carreta_id: '' });
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');
    const [sucesso, setSucesso] = useState('');
    const [editando, setEditando] = useState(null); // viagem sendo editada

    const carregarLocais = useCallback(async () => {
        try {
            const [rm, rv, rviag] = await Promise.all([
                api.get('/api/frota/motoristas'),
                api.get('/api/frota/veiculos'),
                api.get('/api/frota/viagens'),
            ]);
            setMotoristas(rm.data.motoristas || []);
            setVeiculos(rv.data.veiculos || []);
            setViagens(rviag.data.viagens || []); // sincroniza estado pai após despacho
        } catch { setAviso('Erro ao carregar dados.'); }
    }, [setViagens]);

    // Só carrega motoristas e veículos na montagem (viagens já vêm do pai via socket)
    useEffect(() => {
        api.get('/api/frota/motoristas').then(r => setMotoristas(r.data.motoristas || [])).catch(() => { });
        api.get('/api/frota/veiculos').then(r => setVeiculos(r.data.veiculos || [])).catch(() => { });
    }, []);

    const cavalos = veiculos.filter(v => v.tipo === 'Cavalo');
    const carretas = veiculos.filter(v => v.tipo === 'Carreta' || v.tipo === 'Truck' || v.tipo === '3/4');

    const editarViagem = (v) => {
        // Encontra IDs a partir das placas
        const cavalo = veiculos.find(vei => vei.placa === v.cavalo_placa);
        const carreta = veiculos.find(vei => vei.placa === v.carreta_placa);
        setForm({
            motorista_id: String(v.motorista_id),
            cavalo_id: cavalo ? String(cavalo.id) : '',
            carreta_id: carreta ? String(carreta.id) : '',
        });
        setEditando(v);
        setAviso('');
        setSucesso('');
        // Scroll para o topo do formulário
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicao = () => {
        setEditando(null);
        setForm({ motorista_id: '', cavalo_id: '', carreta_id: '' });
        setAviso('');
    };

    const desvincular = async (v) => {
        if (!window.confirm(`Retirar conjunto de ${v.motorista_nome}?`)) return;
        try {
            await api.delete(`/api/frota/despacho/${v.id}`);
            setViagens(prev => prev.filter(x => x.id !== v.id));
            if (editando?.id === v.id) cancelarEdicao();
        } catch (err) {
            setAviso(err.response?.data?.message || 'Erro ao desvincular.');
        }
    };

    const despachar = async (e) => {
        e.preventDefault();
        if (!form.motorista_id) return setAviso('Selecione um motorista.');
        setLoading(true);
        setAviso('');
        try {
            const { data } = await api.post('/api/frota/despacho', {
                motorista_id: Number(form.motorista_id),
                cavalo_id: form.cavalo_id ? Number(form.cavalo_id) : null,
                carreta_id: form.carreta_id ? Number(form.carreta_id) : null,
            });
            setSucesso(editando ? `Conjunto atualizado! Status: ${data.status}` : `Vínculo criado! Status: ${data.status}`);
            setForm({ motorista_id: '', cavalo_id: '', carreta_id: '' });
            setEditando(null);
            carregarLocais();
            setTimeout(() => setSucesso(''), 4000);
        } catch (err) {
            setAviso(err.response?.data?.message || 'Erro no despacho.');
        } finally {
            setLoading(false);
        }
    };

    const statusCor = (st) => {
        if (st === 'DISPONÍVEL') return '#4ade80';
        if (st === 'SABADO' || st === 'DOMINGO') return '#f87171';
        return '#fbbf24';
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
            {/* Formulário de despacho */}
            <div style={s.card}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: editando ? '#f97316' : '#fcd34d', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {editando ? <Pencil size={15} /> : <Zap size={15} />}
                        {editando ? `Editando: ${editando.motorista_nome}` : 'Montar Conjunto'}
                    </span>
                    {editando && (
                        <button onClick={cancelarEdicao} title="Cancelar edição"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                            <X size={16} />
                        </button>
                    )}
                </div>
                {aviso && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '12px' }}>{aviso}</div>}
                {sucesso && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={13} /> {sucesso}</div>}
                <form onSubmit={despachar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={s.label}><Users size={11} style={{ display: 'inline', marginRight: '4px' }} />Motorista *</label>
                        <select style={{ ...s.input, opacity: editando ? 0.5 : 1 }} value={form.motorista_id} onChange={e => setForm(p => ({ ...p, motorista_id: e.target.value }))} disabled={!!editando}>
                            <option value="">— Selecione —</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}{m.modo_plantao ? ' 🟢' : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={s.label}><Truck size={11} style={{ display: 'inline', marginRight: '4px' }} />Cavalo (Tração)</label>
                        <select style={s.input} value={form.cavalo_id} onChange={e => setForm(p => ({ ...p, cavalo_id: e.target.value }))}>
                            <option value="">— Sem cavalo —</option>
                            {cavalos.map(v => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={s.label}>Carreta / Baú</label>
                        <select style={s.input} value={form.carreta_id} onChange={e => setForm(p => ({ ...p, carreta_id: e.target.value }))}>
                            <option value="">— Sem carreta —</option>
                            {carretas.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.tipo}{v.modelo ? ` · ${v.modelo}` : ''}</option>)}
                        </select>
                    </div>
                    <button type="submit" disabled={loading}
                        style={{ ...s.btnPrimary, background: editando ? 'rgba(249,115,22,0.12)' : 'rgba(252,211,77,0.12)', border: `1px solid ${editando ? 'rgba(249,115,22,0.3)' : 'rgba(252,211,77,0.3)'}`, color: editando ? '#f97316' : '#fcd34d', justifyContent: 'center' }}>
                        {editando ? <Pencil size={14} /> : <Zap size={14} />}
                        {loading ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Despachar Conjunto'}
                    </button>
                </form>
            </div>

            {/* Viagens ativas */}
            <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vínculos Ativos ({viagens.length})</span>
                    <button onClick={carregarLocais} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} title="Atualizar"><RefreshCw size={14} /></button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={s.th}>Motorista</th>
                            <th style={s.th}>Cavalo</th>
                            <th style={s.th}>Carreta</th>
                            <th style={s.th}>Status</th>
                            <th style={s.th}>Local</th>
                            <th style={s.th}>Prev. Disponível</th>
                            <th style={s.th}>Atualizado</th>
                            <th style={s.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {viagens.length === 0 ? (
                            <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', padding: '32px', color: '#475569' }}>Nenhum conjunto despachado.</td></tr>
                        ) : viagens.map(v => (
                            <tr key={v.id} style={{ ...s.tr, background: editando?.id === v.id ? 'rgba(249,115,22,0.06)' : 'transparent' }}>
                                <td style={{ ...s.td, fontWeight: '700', color: '#f1f5f9' }}>
                                    {v.motorista_nome}
                                    {v.modo_plantao ? <span style={{ marginLeft: '6px', fontSize: '10px', color: '#4ade80' }}>🟢 PLANTÃO</span> : null}
                                </td>
                                <td style={{ ...s.td, color: '#60a5fa', fontFamily: 'monospace' }}>{v.cavalo_placa || '—'}</td>
                                <td style={{ ...s.td, color: '#fbbf24', fontFamily: 'monospace' }}>{v.carreta_placa || '—'}</td>
                                <td style={s.td}>
                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', background: `${statusCor(v.status_atual)}18`, border: `1px solid ${statusCor(v.status_atual)}40`, color: statusCor(v.status_atual) }}>
                                        {v.status_atual}
                                    </span>
                                </td>
                                <td style={s.td}>
                                    {v.ultima_lat_lng ? (
                                        <a
                                            href={`https://www.google.com/maps?q=${v.ultima_lat_lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={v.ultima_lat_lng}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontSize: '11px', textDecoration: 'none', fontWeight: '600' }}
                                        >
                                            <MapPin size={12} /> Ver
                                        </a>
                                    ) : (
                                        <span style={{ color: '#334155', fontSize: '11px' }}>—</span>
                                    )}
                                </td>
                                <td style={{ ...s.td, fontSize: '11px' }}>
                                    <PrevisaoCell viagem={v} />
                                </td>
                                <td style={{ ...s.td, color: '#475569', fontSize: '11px' }}>
                                    {v.data_atualizacao ? new Date(v.data_atualizacao).toLocaleString('pt-BR') : '—'}
                                </td>
                                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                                    <button
                                        onClick={() => editarViagem(v)}
                                        title="Editar conjunto"
                                        style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', marginRight: '6px' }}
                                    >
                                        <Pencil size={11} /> Editar
                                    </button>
                                    <button
                                        onClick={() => desvincular(v)}
                                        title="Retirar conjunto"
                                        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}
                                    >
                                        <Trash2 size={11} /> Retirar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Aba Checklists ────────────────────────────────────────────────────────────

function ModalDetalheChecklist({ item, onClose }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ClipboardCheck size={18} color="#38bdf8" />
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#f1f5f9' }}>Detalhes do Checklist</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Motorista</div>
                            <div style={{ color: '#f1f5f9', fontWeight: '600' }}>{item.motorista_nome || '—'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Placa Carreta</div>
                            <div style={{ color: '#fbbf24', fontWeight: '700', fontFamily: 'monospace', fontSize: '16px' }}>{item.placa_carreta || '—'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Data / Hora</div>
                            <div style={{ color: '#94a3b8', fontSize: '13px' }}>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Placa Confere?</div>
                            <div style={{ color: item.placa_confere ? '#4ade80' : '#f87171', fontWeight: '700' }}>
                                {item.placa_confere ? '✓ SIM' : '✗ NÃO'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Condição do Baú</div>
                            <div style={{ color: '#cbd5e1', fontSize: '13px' }}>{item.condicao_bau || '—'}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Cordas</div>
                            <div style={{ color: '#cbd5e1', fontWeight: '600' }}>{item.cordas > 0 ? `${item.cordas} und.` : 'Nenhuma'}</div>
                        </div>
                    </div>

                    {item.foto_vazamento && (
                        <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ ...s.label, color: '#f87171', marginBottom: '8px' }}>Foto de Avaria / Vazamento</div>
                            <img src={item.foto_vazamento} alt="Avaria" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                        </div>
                    )}

                    {item.assinatura && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                            <div style={s.label}>Assinatura do Motorista</div>
                            <img src={item.assinatura} alt="Assinatura" style={{ maxHeight: '80px', objectFit: 'contain', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px', border: '1px solid rgba(255,255,255,0.08)' }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AbaChecklists() {
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selecionado, setSelecionado] = useState(null);

    const carregar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/api/frota/checklists');
            setChecklists(data.checklists || []);
        } catch {
            setChecklists([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { carregar(); }, [carregar]);

    return (
        <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                    {checklists.length} checklist(s) registrado(s)
                </span>
                <button onClick={carregar} style={s.btnPrimary}>
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                    Carregando checklists...
                </div>
            ) : checklists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '13px' }}>
                    <ClipboardCheck size={32} color="#334155" style={{ marginBottom: '10px' }} />
                    <div>Nenhum checklist registrado ainda.</div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={s.th}>Data / Hora</th>
                                <th style={s.th}>Motorista</th>
                                <th style={s.th}>Carreta</th>
                                <th style={s.th}>Placa Confere</th>
                                <th style={s.th}>Condição Baú</th>
                                <th style={s.th}>Cordas</th>
                                <th style={s.th}>Avaria</th>
                                <th style={s.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {checklists.map((c) => (
                                <tr key={c.id} style={s.tr}>
                                    <td style={s.td}>{c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '—'}</td>
                                    <td style={{ ...s.td, fontWeight: '600', color: '#f1f5f9' }}>{c.motorista_nome || '—'}</td>
                                    <td style={{ ...s.td, fontFamily: 'monospace', color: '#fbbf24', fontWeight: '700' }}>{c.placa_carreta || '—'}</td>
                                    <td style={s.td}>
                                        <span style={{ color: c.placa_confere ? '#4ade80' : '#f87171', fontWeight: '700' }}>
                                            {c.placa_confere ? '✓ Sim' : '✗ Não'}
                                        </span>
                                    </td>
                                    <td style={s.td}>{c.condicao_bau || '—'}</td>
                                    <td style={s.td}>{c.cordas > 0 ? `${c.cordas}` : '—'}</td>
                                    <td style={s.td}>
                                        {c.foto_vazamento
                                            ? <span style={{ color: '#f87171', fontWeight: '700', fontSize: '12px' }}>⚠ SIM</span>
                                            : <span style={{ color: '#4ade80', fontSize: '12px' }}>OK</span>
                                        }
                                    </td>
                                    <td style={s.td}>
                                        <button onClick={() => setSelecionado(c)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                            <Eye size={13} /> Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selecionado && (
                <ModalDetalheChecklist item={selecionado} onClose={() => setSelecionado(null)} />
            )}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

const ABAS = [
    { id: 'veiculos', label: 'Veículos', icon: <Truck size={15} /> },
    { id: 'motoristas', label: 'Motoristas', icon: <Users size={15} /> },
    { id: 'despacho', label: 'Despacho Rápido', icon: <Zap size={15} /> },
    { id: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={15} /> },
];

export default function GestaoFrota() {
    const [abaAtiva, setAbaAtiva] = useState('veiculos');
    const [viagens, setViagens] = useState([]);
    const [toast, setToast] = useState(null);

    const exibirToast = useCallback((dados) => {
        setToast(dados);
        setTimeout(() => setToast(null), 6000);
    }, []);

    // Carrega viagens ao montar — não espera o usuário ir para a aba Despacho
    const carregarViagens = useCallback(async () => {
        try {
            const { data } = await api.get('/api/frota/viagens');
            setViagens(data.viagens || []);
        } catch { }
    }, []);

    useEffect(() => { carregarViagens(); }, [carregarViagens]);

    // Socket sempre ativo, independente da aba visível
    useEffect(() => {
        const handleStatus = (d) => {
            setViagens(prev => prev.map(v =>
                v.motorista_id === d.motorista_id
                    ? { ...v, status_atual: d.status, ultima_lat_lng: d.lat_lng, data_atualizacao: new Date().toISOString() }
                    : v
            ));
            const placa = d.cavalo_placa ? ` · ${d.cavalo_placa}` : '';
            exibirToast({ tipo: 'status', msg: `${d.motorista_nome}${placa} → ${d.status}`, lat_lng: d.lat_lng });
        };

        const handleOcorrencia = (d) => {
            const placa = d.cavalo_placa ? ` · ${d.cavalo_placa}` : '';
            exibirToast({ tipo: 'ocorrencia', msg: `${d.motorista_nome}${placa} — ${d.tipo}`, lat_lng: null });
        };

        socket.on('frota_status_atualizado', handleStatus);
        socket.on('frota_nova_ocorrencia', handleOcorrencia);

        return () => {
            socket.off('frota_status_atualizado', handleStatus);
            socket.off('frota_nova_ocorrencia', handleOcorrencia);
        };
    }, [exibirToast]);

    return (
        <div style={{ padding: '10px 0' }}>
            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Truck size={22} color="#38bdf8" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Gestão de Frota</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Cadastros & Despacho</span>
            </div>

            <Tabs abas={ABAS} abaAtiva={abaAtiva} setAbaAtiva={setAbaAtiva} />

            {abaAtiva === 'veiculos' && <AbaVeiculos />}
            {abaAtiva === 'motoristas' && <AbaMotoristas />}
            {abaAtiva === 'despacho' && <AbaDespacho viagens={viagens} setViagens={setViagens} />}
            {abaAtiva === 'checklists' && <AbaChecklists />}

            {/* ── Toast real-time (sempre visível, qualquer aba) ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                    background: toast.tipo === 'ocorrencia' ? 'rgba(248,113,113,0.15)' : 'rgba(56,189,248,0.15)',
                    border: `1px solid ${toast.tipo === 'ocorrencia' ? 'rgba(248,113,113,0.4)' : 'rgba(56,189,248,0.4)'}`,
                    borderRadius: '12px', padding: '14px 18px', minWidth: '280px', maxWidth: '380px',
                    backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {toast.tipo === 'ocorrencia'
                            ? <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                            : <Truck size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                        }
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: toast.tipo === 'ocorrencia' ? '#f87171' : '#38bdf8', textTransform: 'uppercase', marginBottom: '3px' }}>
                                {toast.tipo === 'ocorrencia' ? 'Nova Ocorrência' : 'Status Atualizado'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: '600' }}>{toast.msg}</div>
                            {toast.lat_lng && (
                                <a href={`https://www.google.com/maps?q=${toast.lat_lng}`} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4ade80', marginTop: '5px', textDecoration: 'none', fontWeight: '600' }}>
                                    <MapPin size={11} /> {toast.lat_lng} ↗
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
