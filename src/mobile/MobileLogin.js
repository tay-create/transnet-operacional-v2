import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';

export default function MobileLogin() {
    const { login } = useAuthStore();
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!usuario.trim() || !senha.trim()) return;
        setErro('');
        setCarregando(true);
        try {
            const res = await api.post('/login', { usuario: usuario.trim(), senha });
            if (res.data.success) {
                login(res.data.user, res.data.token);
            } else {
                setErro(res.data.message || 'Usuário ou senha incorretos.');
            }
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao conectar. Verifique sua conexão.');
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            minHeight: '100dvh',
            background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 70%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            paddingTop: 'calc(24px + env(safe-area-inset-top))',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{
                    width: '72px', height: '72px', borderRadius: '20px',
                    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
                }}>
                    <Truck size={34} color="#fff" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>
                    Transnet
                </div>
                <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500', marginTop: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Portal Mobile
                </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '360px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Usuário
                    </label>
                    <input
                        type="text"
                        value={usuario}
                        onChange={e => setUsuario(e.target.value)}
                        placeholder="Seu usuário"
                        autoComplete="username"
                        autoCapitalize="off"
                        style={{
                            width: '100%', padding: '14px 16px',
                            background: 'rgba(30,41,59,0.8)',
                            border: `1px solid ${erro ? '#ef4444' : '#334155'}`,
                            borderRadius: '12px', color: '#f1f5f9',
                            fontSize: '16px', outline: 'none',
                            WebkitAppearance: 'none',
                        }}
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Senha
                    </label>
                    <input
                        type="password"
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Sua senha"
                        autoComplete="current-password"
                        style={{
                            width: '100%', padding: '14px 16px',
                            background: 'rgba(30,41,59,0.8)',
                            border: `1px solid ${erro ? '#ef4444' : '#334155'}`,
                            borderRadius: '12px', color: '#f1f5f9',
                            fontSize: '16px', outline: 'none',
                            WebkitAppearance: 'none',
                        }}
                    />
                </div>

                {erro && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                        fontSize: '13px', color: '#fca5a5', lineHeight: 1.4,
                    }}>
                        {erro}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={carregando}
                    style={{
                        width: '100%', height: '52px',
                        background: carregando ? '#1e293b' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                        border: 'none', borderRadius: '12px',
                        color: carregando ? '#475569' : '#fff',
                        fontSize: '15px', fontWeight: '700',
                        cursor: carregando ? 'not-allowed' : 'pointer',
                        boxShadow: carregando ? 'none' : '0 4px 20px rgba(59,130,246,0.4)',
                        transition: 'all 0.2s',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    {carregando ? 'Entrando...' : 'Entrar'}
                </button>
            </form>

            <div style={{ marginTop: '32px', fontSize: '11px', color: '#1e293b', textAlign: 'center' }}>
                Transnet Operacional v2
            </div>
        </div>
    );
}
