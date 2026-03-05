import React from 'react';
import {
    X, Users, AlertTriangle, CheckCircle, XCircle, Key, Trash2, Eye, Pencil, Save, RotateCcw
} from 'lucide-react';
import { MODULOS_SISTEMA, MODULOS_EDICAO, CARGOS_DISPONIVEIS } from '../constants';
import useUserStore from '../store/useUserStore';
import useAuthStore from '../store/useAuthStore';
import useConfigStore from '../store/useConfigStore';
import useUIStore from '../store/useUIStore';

const ModalAdmin = ({ isOpen, onClose }) => {
    const { user } = useAuthStore();
    const {
        usuarios,
        pendencias,
        usuarioEditando,
        tempAcessoUser,
        tempEdicaoUser,
        cargosSelecionados,
        setUsuarioEditando,
        setTempAcesso,
        setTempEdicao,
        setCargosSelecionados,
        aprovarPendencia,
        recusarPendencia,
        removerUsuario,
        alterarCargoUsuario,
        salvarPermissoesIndividual,
        resetarParaCargo
    } = useUserStore();

    const { permissoes, permissoesEdicao } = useConfigStore();
    const { mostrarNotificacao } = useUIStore();

    if (!isOpen) return null;
    if (user?.cargo !== 'Coordenador') return null;

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

    const handleRemover = async (id) => {
        if (!window.confirm("Remover este usuário permanentemente?")) return;
        const result = await removerUsuario(id);
        if (result.success) {
            mostrarNotificacao("🗑️ Usuário removido.");
        }
    };

    const handleSalvarRegras = async () => {
        const result = await salvarPermissoesIndividual();
        if (result.success) {
            mostrarNotificacao(`✅ Permissões personalizadas salvas!`);
        } else {
            mostrarNotificacao("❌ Erro ao salvar permissões.");
        }
    };

    const handleResetPadrao = async () => {
        const result = await resetarParaCargo();
        if (result.success) {
            mostrarNotificacao(`✅ Usuário voltou a seguir as regras do CARGO.`);
        }
    };

    const handleResetSenha = async (u) => {
        if (!window.confirm(`Resetar a senha de "${u.nome}" para "123"?`)) return;
        try {
            const r = await import('../services/apiService').then(m => m.default.post(`/usuarios/${u.id}/reset-senha`));
            if (r.data.success) {
                mostrarNotificacao(`🔑 Senha de ${u.nome} resetada para "123".`);
            } else {
                mostrarNotificacao(`❌ ${r.data.message || 'Erro ao resetar senha.'}`);
            }
        } catch {
            mostrarNotificacao('❌ Erro ao resetar senha.');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
                {!usuarioEditando ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
                            <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Users size={20} color="#38bdf8" /> GESTÃO DE USUÁRIOS
                            </h3>
                            <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                        </div>

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
                                            <td style={{ padding: '12px' }}>{u.nome} {!!u.usaPermissaoIndividual && <span title="Permissões Personalizadas" style={{ color: '#4ade80' }}>★</span>}</td>
                                            <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>{u.unidade}</td>
                                            <td style={{ padding: '12px' }}><span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{u.cargo}</span></td>
                                            <td style={{ textAlign: 'right', padding: '12px' }}>
                                                <button onClick={() => setUsuarioEditando(u, permissoes, permissoesEdicao)} style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#38bdf8', fontWeight: 'bold', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                    <Key size={14} /> REGRAS
                                                </button>
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
                    </>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
                            <h3 style={{ color: 'white', margin: 0 }}>
                                <span>PERMISSÕES: <span style={{ color: '#38bdf8' }}>{usuarioEditando.nome}</span></span>
                            </h3>
                            <button onClick={() => setUsuarioEditando(null)} className="btn-close-header"><X size={18} /></button>
                        </div>

                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '20px' }}>
                            <label style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                                <Users size={14} style={{ display: 'inline', marginRight: '5px' }} /> ALTERAR CARGO DO USUÁRIO
                            </label>
                            <select
                                className="input-internal"
                                value={usuarioEditando.cargo}
                                onChange={(e) => alterarCargoUsuario(usuarioEditando.id, e.target.value)}
                                style={{ width: '100%', borderColor: '#3b82f6', color: 'white', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px' }}
                            >
                                {CARGOS_DISPONIVEIS.map(c => (
                                    <option key={c} value={c} style={{ color: 'black' }}>{c}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                                * Alterar o cargo mudará as permissões padrão deste usuário no próximo login.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                <h4 style={{ color: '#4ade80', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Eye size={18} /> ACESSO (VER)
                                </h4>
                                {MODULOS_SISTEMA.map(m => (
                                    <label key={m.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', color: 'white', cursor: 'pointer', padding: '5px', borderRadius: '4px', transition: '0.2s' }}>
                                        <input
                                            type="checkbox"
                                            style={{ width: '18px', height: '18px', accentColor: '#4ade80' }}
                                            checked={tempAcessoUser.includes(m.id)}
                                            onChange={e => e.target.checked
                                                ? setTempAcesso([...tempAcessoUser, m.id])
                                                : setTempAcesso(tempAcessoUser.filter(x => x !== m.id))
                                            }
                                        />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                                <h4 style={{ color: '#f87171', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Pencil size={16} /> EDIÇÃO (ALTERAR)
                                </h4>
                                {MODULOS_EDICAO.map(m => (
                                    <label key={m.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', color: 'white', cursor: 'pointer', padding: '5px', borderRadius: '4px' }}>
                                        <input
                                            type="checkbox"
                                            style={{ width: '18px', height: '18px', accentColor: '#f87171' }}
                                            checked={tempEdicaoUser.includes(m.id)}
                                            onChange={e => e.target.checked
                                                ? setTempEdicao([...tempEdicaoUser, m.id])
                                                : setTempEdicao(tempEdicaoUser.filter(x => x !== m.id))
                                            }
                                        />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={handleSalvarRegras} className="btn-neon" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#3b82f6', borderColor: '#3b82f6' }}>
                                <Save size={16} /> SALVAR REGRAS
                            </button>
                            <button onClick={handleResetPadrao} className="btn-ghost" style={{ flex: 1, color: '#fbbf24', borderColor: '#fbbf24', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <Users size={16} /> VOLTAR AO PADRÃO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModalAdmin;
