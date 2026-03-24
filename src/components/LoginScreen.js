import React, { useState } from 'react';
import { User, Lock, ArrowRight, Truck, UserPlus, KeyRound, Mail } from 'lucide-react';
import { loginSchema } from '../schemas/validationSchemas';
import { useValidation } from '../hooks/useValidation';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import '../App.css';

export default function LoginScreen({ onLoginSuccess }) {
    const login = useAuthStore((state) => state.login);
    const [loginDados, setLoginDados] = useState({ nome: '', senha: '' });
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');
    const [manterConectado, setManterConectado] = useState(false);
    const { validate, errors } = useValidation(loginSchema);

    // Modais
    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEsqueci, setModalEsqueci] = useState(false);
    const [formCadastro, setFormCadastro] = useState({ nome: '', emailPrefix: '', senha: '', unidade: 'Recife' });

    // Fluxo esqueci a senha (novo — via e-mail automático)
    const [emailEsqueci, setEmailEsqueci] = useState('');
    const [etapaEsqueci, setEtapaEsqueci] = useState('input'); // 'input' | 'enviado'
    const [loadingEsqueci, setLoadingEsqueci] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErro('');

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
            if (token) localStorage.setItem('auth_token', token);
            const userData = data.usuario || data.user;
            if (data.success && userData) {
                if (manterConectado) {
                    localStorage.setItem('manter_conectado', '1');
                } else {
                    localStorage.removeItem('manter_conectado');
                }
                login(userData, token);
                onLoginSuccess(userData);
            } else {
                setErro(data.message || "Acesso negado. Verifique seus dados.");
            }
        } catch (f) {
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
        } catch (e) { mostrarNotificacao(e.response?.data?.message || "Erro ao enviar solicitação. Tente novamente."); }
    };

    const solicitarResetSenha = async () => {
        if (!emailEsqueci.trim()) return mostrarNotificacao("Digite seu e-mail corporativo.");
        setLoadingEsqueci(true);
        try {
            await api.post('/solicitar-reset-senha', { email: emailEsqueci.trim() });
            setEtapaEsqueci('enviado');
        } catch {
            // Sempre mostra "enviado" para não revelar se e-mail existe
            setEtapaEsqueci('enviado');
        } finally {
            setLoadingEsqueci(false);
        }
    };

    const abrirModalEsqueci = () => {
        setEmailEsqueci('');
        setEtapaEsqueci('input');
        setModalEsqueci(true);
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
        if (senha.length < 8) return "Mínimo 8 caracteres.";
        return null;
    };

    return (
        <div className="login-wrapper">
            <div className="login-card-compact">

                {/* LOGO */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', marginBottom: '15px' }}>
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
                    <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
                        {erro}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ position: 'relative' }}>
                        <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input className="input-dark" placeholder="usuario@tnetlog.com.br" value={loginDados.nome} onChange={(e) => setLoginDados({ ...loginDados, nome: e.target.value })} />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input type="password" className="input-dark" placeholder="Senha..." value={loginDados.senha} onChange={(e) => setLoginDados({ ...loginDados, senha: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-5px' }}>
                        <input type="checkbox" id="manter" style={{ accentColor: '#3b82f6' }} checked={manterConectado} onChange={e => setManterConectado(e.target.checked)} />
                        <label htmlFor="manter" style={{ color: '#94a3b8', fontSize: '12px' }}>Manter conectado</label>
                    </div>
                    <button type="submit" className="btn-primary-glow" disabled={loading}>
                        {loading ? 'CARREGANDO...' : 'ENTRAR NO SISTEMA'}
                        {!loading && <ArrowRight size={16} />}
                    </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }}>
                    <span onClick={() => setModalCadastro(true)} style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}>CRIAR CONTA</span>
                    <span onClick={abrirModalEsqueci} style={{ color: '#64748b', cursor: 'pointer' }}>ESQUECI A SENHA</span>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px', color: '#334155', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Created in 2026 • Will • Transnet
                </div>

            </div>

            {/* MODAL CADASTRO */}
            {modalCadastro && (
                <div className="modal-overlay">
                    <div className="modal-glass">
                        <h3 className="modal-title" style={{ color: '#3b82f6' }}>
                            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '8px', borderRadius: '10px' }}>
                                <UserPlus size={20} color="#3b82f6" />
                            </div>
                            Novo Registro
                        </h3>
                        <p className="modal-desc">Preencha seus dados para solicitar acesso ao sistema.</p>

                        {aviso && (
                            <div style={{ background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: aviso.startsWith('✅') ? '#86efac' : '#fde047', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`, marginBottom: '15px' }}>
                                {aviso}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome Completo</label>
                                <input className="input-dark" placeholder="Ex: Carlos Silva" value={formCadastro.nome} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Corporativo</label>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <input className="input-dark" placeholder="seu.usuario" value={formCadastro.emailPrefix} onChange={e => setFormCadastro({ ...formCadastro, emailPrefix: e.target.value })} style={{ border: 'none', background: 'transparent', borderRadius: '0', flex: 1, minWidth: '0' }} />
                                    <span style={{ color: '#64748b', fontSize: '14px', paddingRight: '16px', whiteSpace: 'nowrap', userSelect: 'none', fontWeight: '500' }}>@tnetlog.com.br</span>
                                </div>
                                {formCadastro.emailPrefix && (
                                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>✓</span> Seu email: <strong>{formCadastro.emailPrefix}@tnetlog.com.br</strong>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Unidade de Trabalho</label>
                                <select className="input-dark" value={formCadastro.unidade} onChange={e => setFormCadastro({ ...formCadastro, unidade: e.target.value })} style={{ height: '48px', cursor: 'pointer' }}>
                                    <option style={{ color: 'black' }}>Recife</option>
                                    <option style={{ color: 'black' }}>Moreno</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Crie uma Senha</label>
                                <input type="password" className="input-dark" placeholder="Mínimo 8 caracteres" value={formCadastro.senha} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={solicitarCadastro} className="btn-primary-glow" style={{ background: '#3b82f6', color: 'white', flex: 1 }}>SOLICITAR</button>
                                <button onClick={() => setModalCadastro(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>VOLTAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ESQUECI A SENHA */}
            {modalEsqueci && (
                <div className="modal-overlay">
                    <div className="modal-glass" style={{ maxWidth: '380px', textAlign: 'center' }}>

                        <div style={{ width: '60px', height: '60px', background: 'rgba(239,68,68,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <KeyRound size={28} color="#ef4444" />
                        </div>

                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white' }}>Recuperar Acesso</h3>

                        {aviso && (
                            <div style={{ background: 'rgba(234,179,8,0.15)', color: '#fde047', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', border: '1px solid rgba(234,179,8,0.3)', marginBottom: '15px' }}>
                                {aviso}
                            </div>
                        )}

                        {etapaEsqueci === 'input' && (
                            <>
                                <p className="modal-desc">
                                    Informe seu e-mail corporativo (<strong>@tnetlog.com.br</strong>). Enviaremos um link de redefinição para o seu e-mail pessoal cadastrado.
                                </p>
                                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Mail size={12} /> E-mail Corporativo
                                    </label>
                                    <input
                                        className="input-dark"
                                        placeholder="usuario@tnetlog.com.br"
                                        value={emailEsqueci}
                                        onChange={e => setEmailEsqueci(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && solicitarResetSenha()}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={solicitarResetSenha} disabled={loadingEsqueci} className="btn-primary-glow" style={{ background: '#ef4444', color: 'white', flex: 1 }}>
                                        {loadingEsqueci ? 'ENVIANDO...' : 'ENVIAR LINK'}
                                    </button>
                                    <button onClick={() => setModalEsqueci(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                        CANCELAR
                                    </button>
                                </div>
                            </>
                        )}

                        {etapaEsqueci === 'enviado' && (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '8px' }}>📧</div>
                                <p className="modal-desc">
                                    Se o e-mail estiver cadastrado e verificado, você receberá um link de redefinição em breve.<br /><br />
                                    Verifique sua caixa de entrada (e a pasta spam).
                                </p>
                                <button onClick={() => setModalEsqueci(false)} className="btn-primary-glow" style={{ background: '#22c55e', color: 'white', width: '100%' }}>
                                    FECHAR
                                </button>
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
