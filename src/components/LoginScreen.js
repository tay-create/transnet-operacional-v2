import React, { useState } from 'react';
import { User, Lock, ArrowRight, Truck, UserPlus, KeyRound, Phone, MessageCircle } from 'lucide-react';
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
    const [manterConectado, setManterConectado] = useState(false);
    const { validate, errors } = useValidation(loginSchema);

    // Modais
    const [modalCadastro, setModalCadastro] = useState(false);
    const [modalEsqueci, setModalEsqueci] = useState(false);
    const [modalToken, setModalToken] = useState(false);
    const [formCadastro, setFormCadastro] = useState({ nome: '', emailPrefix: '', senha: '', unidade: 'Recife' });
    const [formRecuperacao, setFormRecuperacao] = useState({ nome: '' });
    const [etapaEsqueci, setEtapaEsqueci] = useState('buscar'); // 'buscar' | 'cadastrar_tel' | 'aguardar'
    const [usuarioEncontrado, setUsuarioEncontrado] = useState(null);
    const [telefoneCadastro, setTelefoneCadastro] = useState('');
    const [formToken, setFormToken] = useState({ email: '', token: '', novaSenha: '' });

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
                // Salvar preferência "manter conectado" para o Electron respeitar ao fechar
                if (manterConectado) {
                    localStorage.setItem('manter_conectado', '1');
                } else {
                    localStorage.removeItem('manter_conectado');
                }
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

    const solicitarRecuperacao = async () => {
        if (!formRecuperacao.nome) return mostrarNotificacao("Digite seu nome de usuário.");
        try {
            const r = await api.get(`/usuarios/buscar?nome=${encodeURIComponent(formRecuperacao.nome)}`);
            if (!r.data.success) return mostrarNotificacao("Usuário não encontrado. Verifique o nome digitado.");
            const { id, nome, email, telefone } = r.data;
            setUsuarioEncontrado({ id, nome, email, telefone });
            if (!telefone) {
                setEtapaEsqueci('cadastrar_tel');
            } else {
                enviarAlertaRecuperacao(id, nome, email, telefone);
            }
        } catch {
            mostrarNotificacao("Erro ao enviar solicitação. Tente novamente.");
        }
    };

    const salvarTelefoneCadastro = async () => {
        if (!telefoneCadastro || telefoneCadastro.replace(/\D/g, '').length < 10) {
            return mostrarNotificacao("Telefone inválido. Informe DDD + número (ex: 81912345678).");
        }
        try {
            await api.post(`/usuarios/${usuarioEncontrado.id}/telefone`, { telefone: telefoneCadastro });
            enviarAlertaRecuperacao(usuarioEncontrado.id, usuarioEncontrado.nome, usuarioEncontrado.email, telefoneCadastro);
        } catch {
            mostrarNotificacao("Erro ao salvar telefone. Tente novamente.");
        }
    };

    const enviarAlertaRecuperacao = (id, nome, email, telefone) => {
        socket.emit('enviar_alerta', {
            tipo: 'admin_senha',
            origem: 'SISTEMA',
            usuarioId: id,
            nome,
            telefone: telefone.replace(/\D/g, ''),
            mensagem: `🔑 Recuperação de senha: ${nome} (${email})`
        });
        setEtapaEsqueci('aguardar');
    };

    const trocarSenhaComToken = async () => {
        if (!formToken.email || !formToken.token || !formToken.novaSenha) {
            return mostrarNotificacao("Preencha todos os campos.");
        }
        try {
            const r = await api.post('/reset-senha-token', formToken);
            if (r.data.success) {
                setModalToken(false);
                setFormToken({ email: '', token: '', novaSenha: '' });
                mostrarNotificacao("✅ Senha alterada! Faça login com a nova senha.");
            } else {
                mostrarNotificacao(r.data.message || "Código inválido ou expirado.");
            }
        } catch (e) {
            mostrarNotificacao(e.response?.data?.message || "Erro ao alterar senha.");
        }
    };

    const abrirModalEsqueci = () => {
        setEtapaEsqueci('buscar');
        setUsuarioEncontrado(null);
        setTelefoneCadastro('');
        setFormRecuperacao({ nome: '' });
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
                            placeholder="usuario@tnetlog.com.br"
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
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span onClick={() => setModalToken(true)} style={{ color: '#22c55e', cursor: 'pointer' }}>TENHO O CÓDIGO</span>
                        <span onClick={abrirModalEsqueci} style={{ color: '#64748b', cursor: 'pointer' }}>ESQUECI A SENHA</span>
                    </div>
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

            {/* --- MODAL ESQUECI A SENHA --- */}
            {modalEsqueci && (
                <div className="modal-overlay">
                    <div className="modal-glass" style={{ maxWidth: '380px', textAlign: 'center' }}>

                        <div style={{ width: '60px', height: '60px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <KeyRound size={28} color="#ef4444" />
                        </div>

                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white' }}>Recuperar Acesso</h3>

                        {aviso && (
                            <div style={{
                                background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                                color: aviso.startsWith('✅') ? '#86efac' : '#fde047',
                                padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center',
                                border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                                marginBottom: '15px'
                            }}>
                                {aviso}
                            </div>
                        )}

                        {/* ETAPA 1: buscar usuário */}
                        {etapaEsqueci === 'buscar' && (
                            <>
                                <p className="modal-desc">Informe seu usuário (email). O administrador receberá um alerta para gerar seu código.</p>
                                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Seu Usuário</label>
                                    <input
                                        className="input-dark"
                                        placeholder="usuario@tnetlog.com.br"
                                        value={formRecuperacao.nome}
                                        onChange={e => setFormRecuperacao({ ...formRecuperacao, nome: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && solicitarRecuperacao()}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={solicitarRecuperacao} className="btn-primary-glow" style={{ background: '#ef4444', color: 'white', flex: 1 }}>
                                        CONTINUAR
                                    </button>
                                    <button onClick={() => setModalEsqueci(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                        CANCELAR
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ETAPA 2: cadastrar telefone */}
                        {etapaEsqueci === 'cadastrar_tel' && (
                            <>
                                <p className="modal-desc">
                                    Para receber o código via WhatsApp, precisamos do seu número. Informe com DDD (ex: 81912345678).
                                </p>
                                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Phone size={12} /> Número WhatsApp
                                    </label>
                                    <input
                                        className="input-dark"
                                        placeholder="81912345678"
                                        value={telefoneCadastro}
                                        onChange={e => setTelefoneCadastro(e.target.value.replace(/\D/g, ''))}
                                        maxLength={11}
                                        onKeyDown={e => e.key === 'Enter' && salvarTelefoneCadastro()}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={salvarTelefoneCadastro} className="btn-primary-glow" style={{ background: '#25D366', color: 'white', flex: 1 }}>
                                        <MessageCircle size={14} /> SALVAR E ENVIAR
                                    </button>
                                    <button onClick={() => setEtapaEsqueci('buscar')} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                        VOLTAR
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ETAPA 3: aguardando código */}
                        {etapaEsqueci === 'aguardar' && (
                            <>
                                <p className="modal-desc">
                                    Solicitação enviada ao administrador. Em breve você receberá um código de 6 dígitos no WhatsApp.<br /><br />
                                    Quando receber, clique em <strong style={{ color: '#22c55e' }}>"Tenho o código"</strong> na tela de login.
                                </p>
                                <button onClick={() => { setModalEsqueci(false); setModalToken(true); setFormToken(f => ({ ...f, email: usuarioEncontrado?.email || '' })); }} className="btn-primary-glow" style={{ background: '#22c55e', color: 'white', width: '100%', marginBottom: '10px' }}>
                                    JÁ TENHO O CÓDIGO
                                </button>
                                <button onClick={() => setModalEsqueci(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
                                    FECHAR
                                </button>
                            </>
                        )}

                    </div>
                </div>
            )}

            {/* --- MODAL TENHO O CÓDIGO --- */}
            {modalToken && (
                <div className="modal-overlay">
                    <div className="modal-glass" style={{ maxWidth: '380px', textAlign: 'center' }}>

                        <div style={{ width: '60px', height: '60px', background: 'rgba(34,197,94,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', border: '1px solid rgba(34,197,94,0.3)' }}>
                            <MessageCircle size={28} color="#22c55e" />
                        </div>

                        <h3 className="modal-title" style={{ justifyContent: 'center', color: 'white' }}>Usar Código WhatsApp</h3>
                        <p className="modal-desc">Digite seu email, o código de 6 dígitos recebido no WhatsApp e sua nova senha.</p>

                        {aviso && (
                            <div style={{
                                background: aviso.startsWith('✅') ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                                color: aviso.startsWith('✅') ? '#86efac' : '#fde047',
                                padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center',
                                border: `1px solid ${aviso.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                                marginBottom: '15px'
                            }}>
                                {aviso}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '20px' }}>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email</label>
                                <input
                                    className="input-dark"
                                    placeholder="usuario@tnetlog.com.br"
                                    value={formToken.email}
                                    onChange={e => setFormToken({ ...formToken, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Código (6 dígitos)</label>
                                <input
                                    className="input-dark"
                                    placeholder="123456"
                                    maxLength={6}
                                    value={formToken.token}
                                    onChange={e => setFormToken({ ...formToken, token: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nova Senha</label>
                                <input
                                    type="password"
                                    className="input-dark"
                                    placeholder="••••••••"
                                    value={formToken.novaSenha}
                                    onChange={e => setFormToken({ ...formToken, novaSenha: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && trocarSenhaComToken()}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={trocarSenhaComToken} className="btn-primary-glow" style={{ background: '#22c55e', color: 'white', flex: 1 }}>
                                ALTERAR SENHA
                            </button>
                            <button onClick={() => setModalToken(false)} className="btn-primary-glow" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', flex: 0.5 }}>
                                CANCELAR
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
