import React, { useState } from 'react';
import { User, Lock, ArrowRight, Truck, UserPlus, KeyRound } from 'lucide-react';
import { loginSchema } from '../schemas/validationSchemas';
import { useValidation } from '../hooks/useValidation';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import '../App.css';

export default function LoginScreen({ onLoginSuccess, socket }) {
    const login = useAuthStore((state) => state.login);
    const [loginDados, setLoginDados] = useState({ nome: '', senha: '' });
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');
    const { validate, errors } = useValidation(loginSchema);

    // Modais
    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEsqueci, setModalEsqueci] = useState(false);
    const [formCadastro, setFormCadastro] = useState({ nome: '', emailPrefix: '', senha: '', unidade: 'Recife' });
    const [formRecuperacao, setFormRecuperacao] = useState({ nome: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

        // Validar com Zod antes de enviar
        const validatedData = validate(loginDados);

        if (!validatedData) {
            setLoading(false);
            setErro(Object.values(errors)[0] || 'Dados inválidos');
            return;
        }

        try {
            const response = await api.post('/login', validatedData);
            const data = response.data;
            const token = data.token || data.jwt || data.accessToken || null;
            // Save token for interceptor compatibility
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            const userData = data.usuario || data.user;
            if (data.success && userData) {
                // Save token and user data in Zustand (token may be null in Electron)
                login(userData, token);
                // Callback de sucesso
                onLoginSuccess(userData);
            } else {
                setErro(data.message || "Acesso negado. Verifique seus dados.");
            }
        } catch (f) {
            console.error('Erro no login:', f);
            setErro(f.response?.data?.message || "Sem conexão com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const solicitarCadastro = async () => {
        if (!formCadastro.nome || !formCadastro.emailPrefix || !formCadastro.senha) return mostrarNotificacao("Preencha todos os campos!");
        const erroSenha = validarSenhaSegura(formCadastro.senha);
        if (erroSenha) return mostrarNotificacao(erroSenha);

        try {
            await api.post('/solicitacoes', formCadastro);
            setModalCadastro(false);
            mostrarNotificacao("✅ Cadastro solicitado! Aguarde aprovação do administrador.");
        } catch (e) { mostrarNotificacao("Erro ao enviar solicitação. Tente novamente."); }
    };

    const solicitarRecuperacao = () => {
        if (!formRecuperacao.nome) return mostrarNotificacao("Digite seu nome de usuário.");
        socket.emit('enviar_alerta', { tipo: 'admin_senha', origem: 'SISTEMA', nome: formRecuperacao.nome, mensagem: `Recuperação de senha para ${formRecuperacao.nome}` });
        setModalEsqueci(false);
        mostrarNotificacao("✅ Solicitação enviada ao administrador!");
    };

    const mostrarNotificacao = (msg) => {
        setAviso(msg);
        setTimeout(() => setAviso(''), 4000);
    };

    const validarSenhaSegura = (senha) => {
        const temLetra = /[a-zA-Z]/.test(senha);
        const temNumero = /\d/.test(senha);
        const sequenciasProibidas = ['123', '234', '345', '456', '567', 'abc'];
        if (!temLetra || !temNumero) return "A senha deve ter letra e número.";
        if (sequenciasProibidas.some(seq => senha.includes(seq))) return "Senha muito óbvia.";
        if (senha.length < 6) return "Mínimo 6 caracteres.";
        return null;
    };

    return (
        <div className="login-wrapper">

            <div className="login-card-compact">

                {/* LOGO CENTRALIZADA */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{
                        width: '60px', height: '60px',
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)', marginBottom: '15px'
                    }}>
                        <Truck size={28} color="white" />
                    </div>
                    <h1 className="brand-title">TRANSNET</h1>
                    <span className="brand-subtitle">LOGISTICA INTEGRADA</span>
                </div>

                {aviso && !modalCadastro && !modalEsqueci && (
                    <div style={{ background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: aviso.startsWith('✅') ? '#86efac' : '#fde047', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}` }}>
                        {aviso}
                    </div>
                )}
                {erro && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {erro}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    <div style={{ position: 'relative' }}>
                        <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            className="input-dark"
                            placeholder="ID de acesso..."
                            value={loginDados.nome}
                            onChange={(e) => setLoginDados({ ...loginDados, nome: e.target.value })}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="password"
                            className="input-dark"
                            placeholder="Senha..."
                            value={loginDados.senha}
                            onChange={(e) => setLoginDados({ ...loginDados, senha: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-5px' }}>
                        <input type="checkbox" id="manter" style={{ accentColor: '#3b82f6' }} />
                        <label htmlFor="manter" style={{ color: '#94a3b8', fontSize: '12px' }}>Manter conectado</label>
                    </div>

                    <button type="submit" className="btn-primary-glow" disabled={loading}>
                        {loading ? 'CARREGANDO...' : 'ENTRAR NO SISTEMA'}
                        {!loading && <ArrowRight size={16} />}
                    </button>

                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }}>
                    <span onClick={() => setModalCadastro(true)} style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}>CRIAR CONTA</span>
                    <span onClick={() => setModalEsqueci(true)} style={{ color: '#64748b', cursor: 'pointer' }}>ESQUECI A SENHA</span>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px', color: '#334155', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Created in 2026 • Will • Transnet
                </div>

            </div>


            {modalCadastro && (
                <div className="modal-overlay">
                    <div className="modal-glass">

                        {/* Cabeçalho */}
                        <h3 className="modal-title" style={{ color: '#3b82f6' }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: '10px' }}>
                                <UserPlus size={20} color="#3b82f6" />
                            </div>
                            Novo Registro
                        </h3>
                        <p className="modal-desc">Preencha seus dados para solicitar acesso ao sistema.</p>

                        {aviso && (
                            <div style={{
                                background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                                color: aviso.startsWith('✅') ? '#86efac' : '#fde047',
                                padding: '10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                textAlign: 'center',
                                border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                                marginBottom: '15px'
                            }}>
                                {aviso}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome Completo</label>
                                <input
                                    className="input-dark"
                                    placeholder="Ex: Carlos Silva"
                                    value={formCadastro.nome}
                                    onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })}
                                />
                            </div>

                            {/* Email com visualização do domínio */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Corporativo</label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '0',
                                    overflow: 'hidden'
                                }}>
                                    <input
                                        className="input-dark"
                                        placeholder="seu.usuario"
                                        value={formCadastro.emailPrefix}
                                        onChange={e => setFormCadastro({ ...formCadastro, emailPrefix: e.target.value })}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            borderRadius: '0',
                                            flex: 1,
                                            minWidth: '0'
                                        }}
                                    />
                                    <span style={{
                                        color: '#64748b',
                                        fontSize: '14px',
                                        paddingRight: '16px',
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none',
                                        fontWeight: '500'
                                    }}>
                                        @tnetlog.com.br
                                    </span>
                                </div>
                                {formCadastro.emailPrefix && (
                                    <div style={{
                                        marginTop: '6px',
                                        fontSize: '11px',
                                        color: '#3b82f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span>✓</span> Seu email: <strong>{formCadastro.emailPrefix}@tnetlog.com.br</strong>
                                    </div>
                                )}
                            </div>

                            {/* Unidade */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Unidade de Trabalho</label>
                                <select
                                    className="input-dark"
                                    value={formCadastro.unidade}
                                    onChange={e => setFormCadastro({ ...formCadastro, unidade: e.target.value })}
                                    style={{ height: '48px', cursor: 'pointer' }}
                                >
                                    <option style={{ color: 'black' }}>Recife</option>
                                    <option style={{ color: 'black' }}>Moreno</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Crie uma Senha</label>
                                <input
                                    type="password"
                                    className="input-dark"
                                    placeholder="••••••••"
                                    value={formCadastro.senha}
                                    onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={solicitarCadastro} className="btn-primary-glow" style={{ background: '#3b82f6', color: 'white', flex: 1 }}>
                                    SOLICITAR
                                </button>
                                <button onClick={() => setModalCadastro(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                    VOLTAR
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL ESQUECI A SENHA (CORRIGIDO) --- */}
            {modalEsqueci && (
                <div className="modal-overlay">
                    <div className="modal-glass" style={{ maxWidth: '380px', textAlign: 'center' }}>

                        <div style={{ width: '60px', height: '60px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <KeyRound size={28} color="#ef4444" />
                        </div>

                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white' }}>Recuperar Acesso</h3>
                        <p className="modal-desc">Informe seu nome de usuário. O administrador receberá um alerta para resetar sua senha.</p>

                        {/* AVISO DENTRO DO MODAL DE ESQUECI SENHA */}
                        {aviso && (
                            <div style={{
                                background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                                color: aviso.startsWith('✅') ? '#86efac' : '#fde047',
                                padding: '10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                textAlign: 'center',
                                border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                                marginBottom: '15px'
                            }}>
                                {aviso}
                            </div>
                        )}

                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Seu Usuário</label>
                            <input
                                className="input-dark"
                                placeholder="Digite aqui..."
                                value={formRecuperacao.nome}
                                onChange={e => setFormRecuperacao({ ...formRecuperacao, nome: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={solicitarRecuperacao} className="btn-primary-glow" style={{ background: '#ef4444', color: 'white', flex: 1 }}>
                                ENVIAR PEDIDO
                            </button>
                            <button onClick={() => setModalEsqueci(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                CANCELAR
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
