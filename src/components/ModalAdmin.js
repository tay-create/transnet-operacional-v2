import React, { useState } from 'react';
import {
    X, Users, AlertTriangle, CheckCircle, XCircle, Trash2, RotateCcw
} from 'lucide-react';
import ModalConfirm from './ModalConfirm';
import { CARGOS_DISPONIVEIS } from '../constants';
import useUserStore from '../store/useUserStore';
import useAuthStore from '../store/useAuthStore';
import useUIStore from '../store/useUIStore';

const ModalAdmin = ({ isOpen, onClose }) => {
    const { user } = useAuthStore();
    const {
        usuarios,
        pendencias,
        cargosSelecionados,
        setCargosSelecionados,
        aprovarPendencia,
        recusarPendencia,
        removerUsuario,
    } = useUserStore();

    const { mostrarNotificacao } = useUIStore();
    const [confirmar, setConfirmar] = useState(null);

    if (!isOpen) return null;
    if (!['Coordenador', 'Direção', 'Desenvolvedor'].includes(user?.cargo)) return null;

    const handleAprovar = async (p) => {
        const cargo = cargosSelecionados[p.id] || 'Aux. Operacional';
        const result = await aprovarPendencia(p, cargo);
        if (result.success) {
            mostrarNotificacao(`✅ Usuário ${p.nome} aprovado as ${cargo}!`);
        } else {
            mostrarNotificacao("❌ Erro ao aprovar pendência.");
        }
    };

    const handleRecusar = async (id) => {
        const result = await recusarPendencia(id);
        if (result.success) {
            mostrarNotificacao("🗑️ Solicitação recusada.");
        }
    };

    const handleRemover = (id) => {
        setConfirmar({
            titulo: 'Remover usuário',
            mensagem: 'Remover este usuário permanentemente?',
            textConfirm: 'Remover',
            onConfirm: async () => {
                setConfirmar(null);
                const result = await removerUsuario(id);
                if (result.success) mostrarNotificacao("🗑️ Usuário removido.");
            }
        });
    };

    const handleResetSenha = (u) => {
        setConfirmar({
            titulo: 'Resetar senha',
            mensagem: `Resetar a senha de "${u.nome}" para "123"?`,
            textConfirm: 'Resetar',
            variante: 'aviso',
            onConfirm: async () => {
                setConfirmar(null);
                try {
                    const r = await import('../services/apiService').then(m => m.default.post(`/usuarios/${u.id}/reset-senha`));
                    if (r.data.success) mostrarNotificacao(`🔑 Senha de ${u.nome} resetada para "123".`);
                    else mostrarNotificacao(`❌ ${r.data.message || 'Erro ao resetar senha.'}`);
                } catch {
                    mostrarNotificacao('❌ Erro ao resetar senha.');
                }
            }
        });
    };

    return (
        <div className="modal-overlay">
            {confirmar && <ModalConfirm titulo={confirmar.titulo} mensagem={confirmar.mensagem} variante={confirmar.variante || 'perigo'} textConfirm={confirmar.textConfirm} onConfirm={confirmar.onConfirm} onCancel={() => setConfirmar(null)} />}
            <div className="modal-neon-panel" style={{ width: '850px', maxWidth: '95%', maxHeight: '90vh', padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px', flexShrink: 0 }}>
                    <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={20} color="#38bdf8" /> GESTÃO DE USUÁRIOS
                    </h3>
                    <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>
                        {/* Solicitações */}
                        {pendencias.length > 0 && (
                            <div style={{ marginBottom: '25px' }}>
                                <h4 style={{ color: '#fbbf24', marginTop: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertTriangle size={16} /> Solicitações Pendentes
                                </h4>
                                {pendencias.map(p => (
                                    <div key={p.id} style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: '#fef08a', fontWeight: 'bold' }}>{p.nome}</span>
                                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>{p.unidade} - {p.email}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <select
                                                style={{ width: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid #fbbf24', color: '#fef08a' }}
                                                value={cargosSelecionados[p.id] || 'Aux. Operacional'}
                                                onChange={e => setCargosSelecionados({ ...cargosSelecionados, [p.id]: e.target.value })}
                                            >
                                                {CARGOS_DISPONIVEIS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button onClick={() => handleAprovar(p)} className="btn-neon" style={{ padding: '5px 15px', fontSize: '12px', background: '#22c55e', borderColor: '#22c55e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <CheckCircle size={14} /> APROVAR
                                            </button>
                                            <button onClick={() => handleRecusar(p.id)} className="btn-ghost" style={{ padding: '5px 15px', fontSize: '12px', color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <XCircle size={14} /> RECUSAR
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Lista de Usuários */}
                        <h4 style={{ color: '#38bdf8', marginTop: '10px', marginBottom: '10px' }}>Usuários Ativos</h4>
                        <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table className="tabela-admin-users">
                                <thead style={{ background: 'rgba(0,0,0,0.3)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>NOME</th>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>UNIDADE</th>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>CARGO</th>
                                        <th style={{ textAlign: 'right', padding: '12px' }}>AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuarios.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '12px' }}>{u.nome}</td>
                                            <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>{u.unidade}</td>
                                            <td style={{ padding: '12px' }}><span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{u.cargo}</span></td>
                                            <td style={{ textAlign: 'right', padding: '12px' }}>
                                                <button onClick={() => handleResetSenha(u)} title="Resetar senha para 123" style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                                    <RotateCcw size={14} /> SENHA
                                                </button>
                                                <button onClick={() => handleRemover(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                </div>
            </div>
        </div>
    );
};

export default ModalAdmin;
