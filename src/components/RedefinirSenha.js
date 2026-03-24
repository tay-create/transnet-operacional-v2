import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Truck } from 'lucide-react';
import api from '../services/apiService';
import '../App.css';

export default function RedefinirSenha() {
    const [token, setToken] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if (t) setToken(t);
        else setErro('Link inválido. Solicite um novo link de redefinição.');
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');
        setMensagem('');

        if (novaSenha.length < 8) {
            setErro('A senha deve ter no mínimo 8 caracteres.');
            return;
        }
        if (novaSenha !== confirmarSenha) {
            setErro('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            const r = await api.post('/confirmar-reset-senha', { token, novaSenha });
            if (r.data.success) {
                setSucesso(true);
                setMensagem(r.data.message || 'Senha alterada com sucesso!');
            } else {
                setErro(r.data.message || 'Erro ao redefinir senha.');
            }
        } catch (e) {
            setErro(e.response?.data?.message || 'Link inválido ou expirado. Solicite um novo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-card-compact">

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', marginBottom: '15px' }}>
                        <Truck size={28} color="white" />
                    </div>
                    <h1 className="brand-title">TRANSNET</h1>
                    <span className="brand-subtitle">REDEFINIÇÃO DE SENHA</span>
                </div>

                {erro && (
                    <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '13px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '16px' }}>
                        {erro}
                    </div>
                )}

                {sucesso ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                        <p style={{ color: '#86efac', fontSize: '14px', marginBottom: '20px' }}>{mensagem}</p>
                        <button
                            onClick={() => { window.location.href = '/'; }}
                            className="btn-primary-glow"
                            style={{ background: '#22c55e', color: 'white', width: '100%' }}
                        >
                            IR PARA O LOGIN <ArrowRight size={16} />
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: 0 }}>
                            Crie sua nova senha abaixo. Mínimo de 8 caracteres.
                        </p>

                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                className="input-dark"
                                placeholder="Nova senha (mín. 8 caracteres)"
                                value={novaSenha}
                                onChange={e => setNovaSenha(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                className="input-dark"
                                placeholder="Confirmar nova senha"
                                value={confirmarSenha}
                                onChange={e => setConfirmarSenha(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary-glow" disabled={loading || !token} style={{ background: '#2563eb', color: 'white' }}>
                            {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: '20px', color: '#334155', fontSize: '10px' }}>
                    © {new Date().getFullYear()} Transnet Logística
                </div>
            </div>
        </div>
    );
}
