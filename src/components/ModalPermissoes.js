import React from 'react';
import { X, Save, ShieldCheck } from 'lucide-react';
import { MODULOS_SISTEMA, MODULOS_EDICAO, CARGOS_DISPONIVEIS } from '../constants';
import useConfigStore from '../store/useConfigStore';
import useUIStore from '../store/useUIStore';

export default function ModalPermissoes({ isOpen, onClose }) {
    const {
        permissoes,
        permissoesEdicao,
        togglePermissao,
        salvarConfiguracoesPermissao
    } = useConfigStore();

    const { mostrarNotificacao } = useUIStore();

    if (!isOpen) return null;

    const handleSalvar = async () => {
        const result = await salvarConfiguracoesPermissao();
        if (result.success) {
            mostrarNotificacao("✅ Configurações salvas com sucesso!");
            onClose();
        } else {
            mostrarNotificacao("❌ Erro ao salvar configurações.");
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                    <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={24} color="#38bdf8" /> GESTÃO DE CARGOS E PERMISSÕES
                    </h3>
                    <button onClick={onClose} className="btn-close-header"><X size={20} /></button>
                </div>

                <div className="permissao-container">
                    {/* SEÇÃO 1: ACESSO */}
                    <div style={{ marginBottom: '30px' }}>
                        <h4 style={{ color: '#4ade80', marginBottom: '15px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            👁️ Permissões de Acesso (Módulos)
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabela-permissoes">
                                <thead>
                                    <tr>
                                        <th style={{ color: '#94a3b8', minWidth: '150px' }}>Cargo</th>
                                        {MODULOS_SISTEMA.map(mod => (
                                            <th key={mod.id} style={{ textAlign: 'center', color: '#4ade80', fontSize: '10px', minWidth: '80px', maxWidth: '100px' }}>{mod.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {CARGOS_DISPONIVEIS.map(cargo => (
                                        <tr key={cargo} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{cargo}</td>
                                            {MODULOS_SISTEMA.map(mod => {
                                                const temVer = permissoes[cargo]?.includes(mod.id);
                                                return (
                                                    <td key={mod.id} style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!temVer}
                                                            onChange={() => togglePermissao('acesso', cargo, mod.id)}
                                                            style={{ width: '18px', height: '18px', accentColor: '#4ade80' }}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SEÇÃO 2: EDIÇÃO */}
                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: '#f87171', marginBottom: '15px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            ✏️ Permissões de Edição (Ações)
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabela-permissoes">
                                <thead>
                                    <tr>
                                        <th style={{ color: '#94a3b8', minWidth: '150px' }}>Cargo</th>
                                        {MODULOS_EDICAO.map(mod => (
                                            <th key={mod.id} style={{ textAlign: 'center', color: '#f87171', fontSize: '10px', minWidth: '90px', maxWidth: '120px' }}>{mod.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {CARGOS_DISPONIVEIS.map(cargo => (
                                        <tr key={cargo} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{cargo}</td>
                                            {MODULOS_EDICAO.map(mod => {
                                                const temEditar = permissoesEdicao[cargo]?.includes(mod.id);
                                                return (
                                                    <td key={mod.id} style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!temEditar}
                                                            onChange={() => togglePermissao('edicao', cargo, mod.id)}
                                                            style={{ width: '18px', height: '18px', accentColor: '#f87171' }}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-actions" style={{ position: 'sticky', bottom: 0, background: 'inherit', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            onClick={onClose}
                            className="btn-ghost"
                            style={{ width: 'auto', minWidth: '120px', justifyContent: 'center' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSalvar}
                            className="btn-save-neon"
                        >
                            <Save size={18} /> Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
