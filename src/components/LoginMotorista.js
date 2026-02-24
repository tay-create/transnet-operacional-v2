import React, { useState } from 'react';
import { Truck, Eye, EyeOff, LogIn } from 'lucide-react';
import axios from 'axios';

const api = axios.create();

const cpfMask = (v) =>
    v.replace(/\D/g, '')
     .replace(/(\d{3})(\d)/, '$1.$2')
     .replace(/(\d{3})(\d)/, '$1.$2')
     .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
     .slice(0, 14);

export default function LoginMotorista({ onLogin }) {
    const [cpf, setCpf] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [msgPrimeiro, setMsgPrimeiro] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');
        setMsgPrimeiro('');
        const cpfLimpo = cpf.replace(/\D/g, '');
        if (cpfLimpo.length !== 11) return setErro('Digite um CPF válido com 11 dígitos.');
        if (!senha) return setErro('Digite sua senha.');
        setLoading(true);
        try {
            const { data } = await api.post('/api/frota/login', { cpf: cpfLimpo, senha });
            if (data.primeiroAcesso) {
                setMsgPrimeiro(`Bem-vindo, ${data.motorista.nome}! Sua senha foi definida com sucesso.`);
                setTimeout(() => onLogin(data.motorista), 1800);
            } else {
                onLogin(data.motorista);
            }
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao conectar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100svh', background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #1e293b 100%)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            padding: '24px', boxSizing: 'border-box'
        }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
                {/* Logo / Cabeçalho */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '72px', height: '72px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.15))',
                        border: '1px solid rgba(56,189,248,0.3)', marginBottom: '16px'
                    }}>
                        <Truck size={32} color="#38bdf8" />
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '0.5px' }}>TRANSNET</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Portal do Motorista</div>
                </div>

                {/* Mensagem de sucesso (primeiro acesso) */}
                {msgPrimeiro && (
                    <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '14px', textAlign: 'center' }}>
                        {msgPrimeiro}
                    </div>
                )}

                {/* Card do formulário */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '32px 28px' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* CPF */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                CPF
                            </label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                value={cpf}
                                onChange={e => setCpf(cpfMask(e.target.value))}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '14px 16px', color: '#f1f5f9', fontSize: '18px', letterSpacing: '2px', outline: 'none', fontFamily: 'monospace' }}
                            />
                        </div>

                        {/* Senha */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                Senha
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={mostrarSenha ? 'text' : 'password'}
                                    value={senha}
                                    onChange={e => setSenha(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '14px 48px 14px 16px', color: '#f1f5f9', fontSize: '18px', outline: 'none' }}
                                />
                                <button type="button" onClick={() => setMostrarSenha(p => !p)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Erro */}
                        {erro && (
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px' }}>
                                {erro}
                            </div>
                        )}

                        {/* Botão */}
                        <button type="submit" disabled={loading} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            padding: '16px', borderRadius: '12px', border: 'none',
                            background: loading ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                            color: 'white', fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 4px 20px rgba(14,165,233,0.4)',
                            transition: 'all 0.2s'
                        }}>
                            <LogIn size={18} />
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                {/* Dica */}
                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                    Se for o seu <strong style={{ color: '#64748b' }}>primeiro acesso</strong>, a senha<br />
                    digitada será a sua senha definitiva.
                </p>
            </div>
        </div>
    );
}
