import React, { useState } from 'react';
import { User, Lock, ArrowRight, ClipboardCheck } from 'lucide-react';
import { loginSchema } from '../schemas/validationSchemas';
import { useValidation } from '../hooks/useValidation';
import useAuthStore from '../store/useAuthStore';
import api from '../services/apiService';
import '../App.css';

export default function ConferenteLogin({ onLoginSuccess }) {
    const login = useAuthStore((state) => state.login);
    const [loginDados, setLoginDados] = useState({ nome: '', senha: '' });
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const { validate, errors } = useValidation(loginSchema);

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
                if (!['Conferente', 'Encarregado'].includes(userData.cargo)) {
                    setErro('Acesso restrito a conferentes. Entre com uma conta de conferente.');
                    setLoading(false);
                    return;
                }
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

    return (
        <div className="login-wrapper">
            <div className="login-card-compact">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{
                        width: '60px', height: '60px',
                        borderRadius: '50%',
                        border: '2px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(59, 130, 246, 0.1)', marginBottom: '15px'
                    }}>
                        <ClipboardCheck size={28} color="#3b82f6" />
                    </div>
                    <h1 className="brand-title">TRANSNET</h1>
                    <span className="brand-subtitle" style={{ color: '#3b82f6' }}>PORTAL DO CONFERENTE</span>
                </div>

                {erro && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5',
                        padding: '10px', borderRadius: '8px', fontSize: '12px',
                        textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
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

                    <button type="submit" className="btn-primary-glow" disabled={loading}>
                        {loading ? 'CARREGANDO...' : 'ENTRAR'}
                        {!loading && <ArrowRight size={16} />}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px', color: '#334155', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Transnet Logistica
                </div>
            </div>
        </div>
    );
}
