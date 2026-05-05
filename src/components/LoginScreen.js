import React, { useState, useEffect } from 'react';
import {
    User, Lock, ArrowRight, Truck, UserPlus, KeyRound, Mail,
    Eye, EyeOff, Package, MapPin, FileText, Zap
} from 'lucide-react';
import { loginSchema } from '../schemas/validationSchemas';
import { useValidation } from '../hooks/useValidation';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import '../styles/LoginScreen.css';

export default function LoginScreen({ onLoginSuccess }) {
    const login = useAuthStore((state) => state.login);
    const [loginDados, setLoginDados] = useState({ nome: localStorage.getItem('ultimo_login_email') || '', senha: '' });
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [aviso, setAviso] = useState('');
    const [manterConectado, setManterConectado] = useState(false);
    const [senhaVisivel, setSenhaVisivel] = useState(false);
    const { validate, errors } = useValidation(loginSchema);

    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEsqueci, setModalEsqueci] = useState(false);
    const [formCadastro, setFormCadastro] = useState({ nome: '', emailPrefix: '', senha: '', unidade: 'Recife' });

    const [emailEsqueci, setEmailEsqueci] = useState('');
    const [etapaEsqueci, setEtapaEsqueci] = useState('input');
    const [loadingEsqueci, setLoadingEsqueci] = useState(false);

    const [kpiTime, setKpiTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setKpiTime(new Date()), 1000);
        return () => clearInterval(timer);
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
            mostrarNotificacao("Cadastro solicitado! Aguarde aprovação do administrador.");
        } catch (e) { mostrarNotificacao(e.response?.data?.message || "Erro ao enviar solicitação. Tente novamente."); }
    };

    const solicitarResetSenha = async () => {
        if (!emailEsqueci.trim()) return mostrarNotificacao("Digite seu e-mail corporativo.");
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
        const temLetra = /[a-zA-Z]/.test(senha);
        const temNumero = /\d/.test(senha);
        const sequenciasProibidas = ['123', '234', '345', '456', '567', 'abc'];
        if (!temLetra || !temNumero) return "A senha deve ter letra e número.";
        if (sequenciasProibidas.some(seq => senha.includes(seq))) return "Senha muito óbvia.";
        if (senha.length < 8) return "Mínimo 8 caracteres.";
        return null;
    };

    const timeStr = kpiTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = kpiTime.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    return (
        <div className="tn-login-root">
            {/* PAINEL ESQUERDO — CENA */}
            <div className="tn-scene-pane">
                <div className="tn-scene-bg" />
                <div className="tn-grid-overlay" />
                <div className="tn-speed-lines">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="tn-speed-line" style={{ '--delay': `${i * 0.4}s`, '--top': `${10 + i * 11}%` }} />
                    ))}
                </div>

                {/* Truck 3D */}
                <div className="tn-truck-scene">
                    <div className="tn-truck-shadow" />
                    <div className="tn-truck-body">
                        <div className="tn-truck-cab">
                            <Truck size={64} color="#22d3ee" strokeWidth={1.5} />
                        </div>
                        <div className="tn-truck-glow" />
                    </div>
                    <div className="tn-crates-row">
                        {[Package, Package, Package].map((Icon, i) => (
                            <div key={i} className="tn-crate" style={{ '--crate-delay': `${i * 0.6}s` }}>
                                <Icon size={28} color="#818cf8" strokeWidth={1.5} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Headline */}
                <div className="tn-scene-headline">
                    <div className="tn-headline-badge">
                        <Zap size={12} />
                        Plataforma Logística
                    </div>
                    <h2 className="tn-headline-title">
                        Controle total<br />
                        <span className="tn-headline-accent">da operação</span>
                    </h2>
                    <p className="tn-headline-desc">
                        Embarques, CT-e e frota unificados em tempo real.
                    </p>
                </div>

                {/* Feature pills */}
                <div className="tn-feature-pills">
                    {[
                        { icon: MapPin, label: 'Rastreamento ao vivo' },
                        { icon: FileText, label: 'CT-e integrado' },
                        { icon: Truck, label: 'Gestão de frota' },
                    ].map(({ icon: Icon, label }) => (
                        <div key={label} className="tn-pill">
                            <Icon size={13} />
                            {label}
                        </div>
                    ))}
                </div>

                {/* KPI strip */}
                <div className="tn-kpi-strip">
                    <div className="tn-kpi-item">
                        <span className="tn-kpi-label">Sistema</span>
                        <span className="tn-kpi-value tn-kpi-online">Online</span>
                    </div>
                    <div className="tn-kpi-divider" />
                    <div className="tn-kpi-item">
                        <span className="tn-kpi-label">Hora</span>
                        <span className="tn-kpi-value">{timeStr}</span>
                    </div>
                    <div className="tn-kpi-divider" />
                    <div className="tn-kpi-item">
                        <span className="tn-kpi-label">Data</span>
                        <span className="tn-kpi-value">{dateStr}</span>
                    </div>
                </div>
            </div>

            {/* PAINEL DIREITO — FORMULÁRIO */}
            <div className="tn-form-pane">
                <div className="tn-form-card">
                    {/* Brand */}
                    <div className="tn-brand">
                        <div className="tn-brand-icon">
                            <Truck size={26} color="#22d3ee" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="tn-brand-name">TRANSNET</div>
                            <div className="tn-brand-sub">LOGÍSTICA INTEGRADA</div>
                        </div>
                    </div>

                    <div className="tn-form-intro">
                        <h3 className="tn-form-title">Acesso ao Sistema</h3>
                        <p className="tn-form-desc">Entre com suas credenciais corporativas</p>
                    </div>

                    {/* Feedback */}
                    {aviso && !modalCadastro && !modalEsqueci && (
                        <div className={`tn-alert ${aviso.startsWith('Cadastro') ? 'tn-alert-success' : 'tn-alert-warn'}`}>
                            {aviso}
                        </div>
                    )}
                    {erro && (
                        <div className="tn-alert tn-alert-error">{erro}</div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="tn-form">
                        <div className="tn-field">
                            <label className="tn-label">E-mail corporativo</label>
                            <div className="tn-input-wrap">
                                <User size={16} className="tn-input-icon" />
                                <input
                                    className="tn-input"
                                    placeholder="usuario@tnetlog.com.br"
                                    value={loginDados.nome}
                                    onChange={(e) => setLoginDados({ ...loginDados, nome: e.target.value })}
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="tn-field">
                            <label className="tn-label">Senha</label>
                            <div className="tn-input-wrap">
                                <Lock size={16} className="tn-input-icon" />
                                <input
                                    type={senhaVisivel ? 'text' : 'password'}
                                    className="tn-input tn-input-password"
                                    placeholder="••••••••"
                                    value={loginDados.senha}
                                    onChange={(e) => setLoginDados({ ...loginDados, senha: e.target.value })}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="tn-eye-btn"
                                    onClick={() => setSenhaVisivel(!senhaVisivel)}
                                    tabIndex={-1}
                                >
                                    {senhaVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="tn-row-options">
                            <label className="tn-remember">
                                <input
                                    type="checkbox"
                                    className="tn-checkbox"
                                    checked={manterConectado}
                                    onChange={e => setManterConectado(e.target.checked)}
                                />
                                Manter conectado
                            </label>
                            <button type="button" className="tn-link" onClick={abrirModalEsqueci}>
                                Esqueci a senha
                            </button>
                        </div>

                        <button type="submit" className="tn-btn-primary" disabled={loading}>
                            {loading ? (
                                <span className="tn-btn-loading">
                                    <span className="tn-spinner" />
                                    Autenticando...
                                </span>
                            ) : (
                                <>
                                    ENTRAR NO SISTEMA
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="tn-form-footer">
                        <button className="tn-link-register" onClick={() => setModalCadastro(true)}>
                            <UserPlus size={14} />
                            Solicitar acesso
                        </button>
                    </div>

                    <div className="tn-copyright">
                        © 2026 Transnet Transportes. Todos os direitos reservados.
                    </div>
                </div>
            </div>

            {/* MODAL CADASTRO */}
            {modalCadastro && (
                <div className="tn-modal-overlay">
                    <div className="tn-modal">
                        <h3 className="tn-modal-title">
                            <div className="tn-modal-icon" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                                <UserPlus size={20} color="#3b82f6" />
                            </div>
                            Solicitar Acesso
                        </h3>
                        <p className="tn-modal-desc">Preencha seus dados para solicitar acesso ao sistema.</p>

                        {aviso && (
                            <div className={`tn-alert ${aviso.startsWith('Cadastro') ? 'tn-alert-success' : 'tn-alert-warn'}`} style={{ marginBottom: '15px' }}>
                                {aviso}
                            </div>
                        )}

                        <div className="tn-form">
                            <div className="tn-field">
                                <label className="tn-label">Nome Completo</label>
                                <div className="tn-input-wrap">
                                    <User size={16} className="tn-input-icon" />
                                    <input className="tn-input" placeholder="Ex: Carlos Silva" value={formCadastro.nome} onChange={e => setFormCadastro({ ...formCadastro, nome: e.target.value })} />
                                </div>
                            </div>
                            <div className="tn-field">
                                <label className="tn-label">E-mail Corporativo</label>
                                <div className="tn-input-email-row">
                                    <input className="tn-input" placeholder="seu.usuario" value={formCadastro.emailPrefix} onChange={e => setFormCadastro({ ...formCadastro, emailPrefix: e.target.value })} style={{ borderRadius: '12px 0 0 12px', borderRight: 'none' }} />
                                    <span className="tn-email-domain">@tnetlog.com.br</span>
                                </div>
                            </div>
                            <div className="tn-field">
                                <label className="tn-label">Unidade</label>
                                <select className="tn-input" style={{ paddingLeft: '16px', cursor: 'pointer' }} value={formCadastro.unidade} onChange={e => setFormCadastro({ ...formCadastro, unidade: e.target.value })}>
                                    <option style={{ color: 'black' }}>Recife</option>
                                    <option style={{ color: 'black' }}>Moreno</option>
                                </select>
                            </div>
                            <div className="tn-field">
                                <label className="tn-label">Senha</label>
                                <div className="tn-input-wrap">
                                    <Lock size={16} className="tn-input-icon" />
                                    <input type="password" className="tn-input" placeholder="Mínimo 8 caracteres" value={formCadastro.senha} onChange={e => setFormCadastro({ ...formCadastro, senha: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button onClick={solicitarCadastro} className="tn-btn-primary" style={{ flex: 1 }}>SOLICITAR</button>
                                <button onClick={() => setModalCadastro(false)} className="tn-btn-ghost" style={{ flex: 0.5 }}>VOLTAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ESQUECI A SENHA */}
            {modalEsqueci && (
                <div className="tn-modal-overlay">
                    <div className="tn-modal" style={{ textAlign: 'center' }}>
                        <div className="tn-modal-icon" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', margin: '0 auto 16px auto' }}>
                            <KeyRound size={24} color="#ef4444" />
                        </div>
                        <h3 className="tn-modal-title" style={{ justifyContent: 'center' }}>Recuperar Acesso</h3>

                        {aviso && (
                            <div className="tn-alert tn-alert-warn" style={{ marginBottom: '15px' }}>{aviso}</div>
                        )}

                        {etapaEsqueci === 'input' && (
                            <>
                                <p className="tn-modal-desc">
                                    Informe seu e-mail corporativo <strong>@tnetlog.com.br</strong>. Enviaremos um link de redefinição para o seu e-mail pessoal cadastrado.
                                </p>
                                <div className="tn-field" style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <label className="tn-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Mail size={12} /> E-mail Corporativo
                                    </label>
                                    <div className="tn-input-wrap">
                                        <Mail size={16} className="tn-input-icon" />
                                        <input
                                            className="tn-input"
                                            placeholder="usuario@tnetlog.com.br"
                                            value={emailEsqueci}
                                            onChange={e => setEmailEsqueci(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && solicitarResetSenha()}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={solicitarResetSenha} disabled={loadingEsqueci} className="tn-btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
                                        {loadingEsqueci ? 'ENVIANDO...' : 'ENVIAR LINK'}
                                    </button>
                                    <button onClick={() => setModalEsqueci(false)} className="tn-btn-ghost" style={{ flex: 0.5 }}>CANCELAR</button>
                                </div>
                            </>
                        )}

                        {etapaEsqueci === 'enviado' && (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                                    <Mail size={48} color="#22d3ee" style={{ display: 'block', margin: '0 auto' }} />
                                </div>
                                <p className="tn-modal-desc">
                                    Se o e-mail estiver cadastrado e verificado, você receberá um link de redefinição em breve.<br /><br />
                                    Verifique sua caixa de entrada e a pasta spam.
                                </p>
                                <button onClick={() => setModalEsqueci(false)} className="tn-btn-primary" style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}>
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
