import React, { useState, useEffect } from 'react';
import {
    Mail, Lock, ArrowRight, Truck, Eye, EyeOff,
    UserPlus, KeyRound, LayoutDashboard, ClipboardCheck
} from 'lucide-react';
import { loginSchema } from '../schemas/validationSchemas';
import { useValidation } from '../hooks/useValidation';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import '../styles/LoginScreen.css';

export default function LoginScreen({ onLoginSuccess }) {
    const login = useAuthStore((state) => state.login);
    const [loginDados, setLoginDados] = useState({
        nome: localStorage.getItem('ultimo_login_email') || '',
        senha: ''
    });
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');
    const [manterConectado, setManterConectado] = useState(false);
    const [senhaVisivel, setSenhaVisivel] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('login');
    const { validate, errors } = useValidation(loginSchema);

    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEsqueci, setModalEsqueci] = useState(false);
    const [formCadastro, setFormCadastro] = useState({ nome: '', emailPrefix: '', senha: '', unidade: 'Recife' });
    const [emailEsqueci, setEmailEsqueci] = useState('');
    const [etapaEsqueci, setEtapaEsqueci] = useState('input');
    const [loadingEsqueci, setLoadingEsqueci] = useState(false);

    const [hora, setHora] = useState('');
    const [embarques, setEmbarques] = useState(147);

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setHora(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, []);

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
            const response = await api.post('/login', { ...validatedData, manterConectado });
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
                localStorage.setItem('ultimo_login_email', loginDados.nome);
                login(userData, token);
                onLoginSuccess(userData);
            } else {
                setErro(data.message || 'Acesso negado. Verifique seus dados.');
            }
        } catch (f) {
            setErro(f.response?.data?.message || 'Sem conexão com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    const solicitarCadastro = async () => {
        if (!formCadastro.nome || !formCadastro.emailPrefix || !formCadastro.senha)
            return mostrarNotificacao('Preencha todos os campos!');
        const erroSenha = validarSenhaSegura(formCadastro.senha);
        if (erroSenha) return mostrarNotificacao(erroSenha);
        try {
            await api.post('/solicitacoes', formCadastro);
            setModalCadastro(false);
            mostrarNotificacao('Cadastro solicitado! Aguarde aprovação do administrador.');
        } catch (e) {
            mostrarNotificacao(e.response?.data?.message || 'Erro ao enviar solicitação. Tente novamente.');
        }
    };

    const solicitarResetSenha = async () => {
        if (!emailEsqueci.trim()) return mostrarNotificacao('Digite seu e-mail corporativo.');
        setLoadingEsqueci(true);
        try {
            await api.post('/solicitar-reset-senha', { email: emailEsqueci.trim() });
            setEtapaEsqueci('enviado');
        } catch {
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
        if (!(/[a-zA-Z]/.test(senha)) || !(/\d/.test(senha))) return 'A senha deve ter letra e número.';
        if (['123', '234', '345', '456', '567', 'abc'].some(s => senha.includes(s))) return 'Senha muito óbvia.';
        if (senha.length < 8) return 'Mínimo 8 caracteres.';
        return null;
    };

    return (
        <div className="tn-login-root">

            {/* ══ LEFT — 3D LOGISTICS SCENE ══ */}
            <section className="tn-scene-pane">
                <div className="tn-ground" />
                <div className="tn-speed-line tn-sl-1" />
                <div className="tn-speed-line tn-sl-2" />
                <div className="tn-speed-line tn-sl-3" />
                <div className="tn-speed-line tn-sl-4" />

                {/* Headline top-left */}
                <div className="tn-scene-headline">
                    <span className="tn-scene-eyebrow">
                        <span className="tn-live-dot" />
                        Sistema online · {hora}
                    </span>
                    <h1 className="tn-scene-title">
                        Sua operação <em>sob controle</em>,<br />
                        suas entregas dentro do prazo.
                    </h1>
                    <p className="tn-scene-sub">
                        Gerencie rotas, motoristas e embarques em tempo real. Acompanhe cada CT-e, doca e fila de placas em uma única central.
                    </p>
                </div>

                {/* 3D stage with truck + crates */}
                <div className="tn-stage">
                    <div className="tn-truck-wrap">
                        <div className="tn-truck-icon">
                            <Truck size={120} strokeWidth={1} />
                        </div>
                    </div>

                    <div className="tn-crate tn-crate-1">
                        <div className="tn-crate-face tn-f-front" /><div className="tn-crate-face tn-f-back" />
                        <div className="tn-crate-face tn-f-right" /><div className="tn-crate-face tn-f-left" />
                        <div className="tn-crate-face tn-f-top" /><div className="tn-crate-face tn-f-bottom" />
                    </div>
                    <div className="tn-crate tn-crate-2">
                        <div className="tn-crate-face tn-f-front" /><div className="tn-crate-face tn-f-back" />
                        <div className="tn-crate-face tn-f-right" /><div className="tn-crate-face tn-f-left" />
                        <div className="tn-crate-face tn-f-top" /><div className="tn-crate-face tn-f-bottom" />
                    </div>
                    <div className="tn-crate tn-crate-3">
                        <div className="tn-crate-face tn-f-front" /><div className="tn-crate-face tn-f-back" />
                        <div className="tn-crate-face tn-f-right" /><div className="tn-crate-face tn-f-left" />
                        <div className="tn-crate-face tn-f-top" /><div className="tn-crate-face tn-f-bottom" />
                    </div>
                    <div className="tn-crate tn-crate-4">
                        <div className="tn-crate-face tn-f-front" /><div className="tn-crate-face tn-f-back" />
                        <div className="tn-crate-face tn-f-right" /><div className="tn-crate-face tn-f-left" />
                        <div className="tn-crate-face tn-f-top" /><div className="tn-crate-face tn-f-bottom" />
                    </div>
                </div>

                {/* Features bottom-left */}
                <div className="tn-features">
                    <div className="tn-feature">
                        <div className="tn-feature-icon"><LayoutDashboard size={20} /></div>
                        <div className="tn-feature-label">Visão Operacional</div>
                    </div>
                    <div className="tn-feature">
                        <div className="tn-feature-icon"><Truck size={20} /></div>
                        <div className="tn-feature-label">Provisionamento da Frota</div>
                    </div>
                    <div className="tn-feature">
                        <div className="tn-feature-icon"><ClipboardCheck size={20} /></div>
                        <div className="tn-feature-label">Marcação de Placas</div>
                    </div>
                </div>

                {/* Live KPI top-right */}
                <div className="tn-live-kpi">
                    <div className="tn-lk">
                        <div className="tn-lk-label">Embarques</div>
                        <div className="tn-lk-value">{embarques}</div>
                    </div>
                    <div className="tn-lk">
                        <div className="tn-lk-label">Hora</div>
                        <div className="tn-lk-value">{hora}</div>
                    </div>
                </div>
            </section>

            {/* ══ RIGHT — LOGIN FORM ══ */}
            <section className="tn-form-pane">
                <div className="tn-status-pill">
                    <span className="tn-status-dot" /> ONLINE
                </div>

                <div className="tn-form-brand">
                    <div className="tn-form-brand-icon">
                        <Truck size={72} strokeWidth={1.2} />
                    </div>
                    <div className="tn-form-brand-sub">LOGÍSTICA INTEGRADA</div>
                </div>

                <div className="tn-form-title">Central de Logística</div>

                {/* Tabs */}
                <div className="tn-tabs">
                    <button
                        className={`tn-tab${abaAtiva === 'login' ? ' active' : ''}`}
                        onClick={() => setAbaAtiva('login')}
                    >
                        Login
                    </button>
                    <button
                        className={`tn-tab${abaAtiva === 'cadastro' ? ' active' : ''}`}
                        onClick={() => { setAbaAtiva('cadastro'); setModalCadastro(true); }}
                    >
                        Cadastro
                    </button>
                </div>

                {/* Alerts */}
                {aviso && !modalCadastro && !modalEsqueci && (
                    <div className={`tn-alert ${aviso.startsWith('Cadastro') ? 'tn-alert-success' : 'tn-alert-warn'}`}>
                        {aviso}
                    </div>
                )}
                {erro && <div className="tn-alert tn-alert-error">{erro}</div>}

                <form onSubmit={handleLogin}>
                    <label className="tn-field-label">E-mail</label>
                    <div className="tn-field">
                        <Mail size={16} className="tn-field-icon" />
                        <input
                            type="text"
                            placeholder="usuario@tnetlog.com.br"
                            value={loginDados.nome}
                            onChange={(e) => setLoginDados({ ...loginDados, nome: e.target.value })}
                            autoComplete="username"
                        />
                    </div>

                    <label className="tn-field-label">Senha</label>
                    <div className="tn-field">
                        <Lock size={16} className="tn-field-icon" />
                        <input
                            type={senhaVisivel ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={loginDados.senha}
                            onChange={(e) => setLoginDados({ ...loginDados, senha: e.target.value })}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="tn-eye-toggle"
                            onClick={() => setSenhaVisivel(!senhaVisivel)}
                            tabIndex={-1}
                        >
                            {senhaVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <div className="tn-row-between">
                        <label className="tn-remember">
                            <input
                                type="checkbox"
                                checked={manterConectado}
                                onChange={e => setManterConectado(e.target.checked)}
                            />
                            Lembrar-me
                        </label>
                    </div>

                    <button type="submit" className="tn-btn-enter" disabled={loading}>
                        {loading
                            ? <><span className="tn-spinner" /> Autenticando...</>
                            : <>ENTRAR NO SISTEMA <ArrowRight size={16} /></>
                        }
                    </button>

                    <button type="button" className="tn-forgot" onClick={abrirModalEsqueci}>
                        Esqueci minha senha
                    </button>
                </form>

                <div className="tn-form-footer">
                    © 2026 Transnet Transportes · Todos os direitos reservados.<br />
                    <button onClick={() => setModalCadastro(true)}>Solicitar Acesso</button>
                    {' · '}
                    <button onClick={abrirModalEsqueci}>Recuperar Senha</button>
                </div>
            </section>

            {/* ══ MODAL CADASTRO ══ */}
            {modalCadastro && (
                <div className="tn-modal-overlay">
                    <div className="tn-modal">
                        <h3 className="tn-modal-title">
                            <div className="tn-modal-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}>
                                <UserPlus size={22} color="#3b82f6" />
                            </div>
                            Novo Registro
                        </h3>
                        <p className="tn-modal-desc">Preencha seus dados para solicitar acesso ao sistema.</p>

                        {aviso && (
                            <div className={`tn-alert ${aviso.startsWith('Cadastro') ? 'tn-alert-success' : 'tn-alert-warn'}`}>
                                {aviso}
                            </div>
                        )}

                        <label className="tn-field-label">Nome Completo</label>
                        <div className="tn-field">
                            <input placeholder="Ex: Carlos Silva" value={formCadastro.nome} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} />
                        </div>

                        <label className="tn-field-label">E-mail Corporativo</label>
                        <div className="tn-modal-input-email">
                            <div className="tn-field">
                                <input placeholder="seu.usuario" value={formCadastro.emailPrefix} onChange={e => setFormCadastro({ ...formCadastro, emailPrefix: e.target.value })} />
                            </div>
                            <span className="tn-email-domain">@tnetlog.com.br</span>
                        </div>

                        <label className="tn-field-label">Unidade</label>
                        <div className="tn-field">
                            <select style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }} value={formCadastro.unidade} onChange={e => setFormCadastro({ ...formCadastro, unidade: e.target.value })}>
                                <option style={{ color: 'black' }}>Recife</option>
                                <option style={{ color: 'black' }}>Moreno</option>
                            </select>
                        </div>

                        <label className="tn-field-label">Senha</label>
                        <div className="tn-field">
                            <Lock size={16} className="tn-field-icon" />
                            <input type="password" placeholder="Mínimo 8 caracteres" value={formCadastro.senha} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} />
                        </div>

                        <div className="tn-modal-btns" style={{ marginTop: 20 }}>
                            <button onClick={solicitarCadastro} className="tn-btn-primary">SOLICITAR</button>
                            <button onClick={() => { setModalCadastro(false); setAbaAtiva('login'); }} className="tn-btn-ghost">VOLTAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ MODAL ESQUECI A SENHA ══ */}
            {modalEsqueci && (
                <div className="tn-modal-overlay">
                    <div className="tn-modal" style={{ textAlign: 'center' }}>
                        <div className="tn-modal-icon" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', margin: '0 auto 16px' }}>
                            <KeyRound size={24} color="#ef4444" />
                        </div>
                        <h3 className="tn-modal-title" style={{ justifyContent: 'center' }}>Recuperar Acesso</h3>

                        {aviso && <div className="tn-alert tn-alert-warn">{aviso}</div>}

                        {etapaEsqueci === 'input' && (
                            <>
                                <p className="tn-modal-desc">
                                    Informe seu e-mail corporativo <strong>@tnetlog.com.br</strong>. Enviaremos um link de redefinição para o seu e-mail pessoal cadastrado.
                                </p>
                                <label className="tn-field-label" style={{ textAlign: 'left' }}>E-mail Corporativo</label>
                                <div className="tn-field">
                                    <Mail size={16} className="tn-field-icon" />
                                    <input
                                        placeholder="usuario@tnetlog.com.br"
                                        value={emailEsqueci}
                                        onChange={e => setEmailEsqueci(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && solicitarResetSenha()}
                                    />
                                </div>
                                <div className="tn-modal-btns" style={{ marginTop: 20 }}>
                                    <button onClick={solicitarResetSenha} disabled={loadingEsqueci} className="tn-btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
                                        {loadingEsqueci ? 'ENVIANDO...' : 'ENVIAR LINK'}
                                    </button>
                                    <button onClick={() => setModalEsqueci(false)} className="tn-btn-ghost">CANCELAR</button>
                                </div>
                            </>
                        )}

                        {etapaEsqueci === 'enviado' && (
                            <>
                                <p className="tn-modal-desc">
                                    Se o e-mail estiver cadastrado e verificado, você receberá um link de redefinição em breve.<br /><br />
                                    Verifique sua caixa de entrada e a pasta spam.
                                </p>
                                <button onClick={() => setModalEsqueci(false)} className="tn-btn-primary" style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', width: '100%' }}>
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
