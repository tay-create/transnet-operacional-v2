import React, { useState } from 'react';
import { Phone, ArrowRight, Truck } from 'lucide-react';
import api from '../services/apiService';

export default function EntrarMotorista() {
    const [telefone, setTelefone] = useState('');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const formatarTelefone = (val) => {
        const nums = val.replace(/\D/g, '').slice(0, 11);
        if (nums.length <= 2) return nums;
        if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
        return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
    };

    const handleChange = (e) => {
        setTelefone(formatarTelefone(e.target.value));
        setErro('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nums = telefone.replace(/\D/g, '');
        if (nums.length < 10) {
            setErro('Digite um telefone válido com DDD.');
            return;
        }
        setLoading(true);
        setErro('');
        try {
            const { data } = await api.post('/api/tokens/auto', { telefone: nums });
            window.location.href = `/cadastro/${data.token}`;
        } catch (err) {
            if (err.response?.status === 429) {
                setErro('Muitas tentativas. Aguarde alguns minutos.');
            } else {
                setErro(err.response?.data?.message || 'Erro ao gerar acesso. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.root}>
            <div style={styles.bg} />
            <div style={styles.card}>
                <div style={styles.iconWrap}>
                    <Truck size={36} color="#22d3ee" strokeWidth={1.5} />
                </div>
                <h1 style={styles.title}>Transnet</h1>
                <p style={styles.subtitle}>Digite seu número de telefone para acessar o formulário de marcação</p>

                {erro && (
                    <div style={styles.alert}>{erro}</div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.fieldWrap}>
                        <Phone size={18} style={styles.fieldIcon} />
                        <input
                            style={styles.input}
                            type="tel"
                            placeholder="(81) 99999-9999"
                            value={telefone}
                            onChange={handleChange}
                            inputMode="numeric"
                            autoFocus
                        />
                    </div>
                    <button type="submit" style={styles.btn} disabled={loading}>
                        {loading ? 'Aguarde...' : (
                            <>
                                Acessar
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <p style={styles.footer}>
                    Motorista — Registro de placa e marcação de saída
                </p>
            </div>
        </div>
    );
}

const styles = {
    root: {
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#020617',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
    },
    bg: {
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(34,211,238,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    card: {
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: 380,
        margin: '0 16px',
        background: 'rgba(10,15,30,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.6)',
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 20,
        background: 'rgba(34,211,238,0.08)',
        border: '1px solid rgba(34,211,238,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 30px rgba(34,211,238,0.12)',
    },
    title: {
        fontSize: 28,
        fontWeight: 800,
        color: '#f1f5f9',
        letterSpacing: '0.08em',
        margin: 0,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 1.6,
        margin: 0,
    },
    alert: {
        width: '100%',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.25)',
        color: '#fca5a5',
        borderRadius: 10,
        padding: '11px 14px',
        fontSize: 13,
        textAlign: 'center',
    },
    form: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    fieldWrap: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    fieldIcon: {
        position: 'absolute',
        left: 14,
        color: '#64748b',
        pointerEvents: 'none',
    },
    input: {
        width: '100%',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#f1f5f9',
        padding: '14px 14px 14px 44px',
        borderRadius: 12,
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        letterSpacing: '0.04em',
        transition: 'all 0.2s',
    },
    btn: {
        width: '100%',
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1a56db, #22d3ee)',
        color: 'white',
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: '0.06em',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: '0 4px 20px rgba(26,86,219,0.35)',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.2s',
    },
    footer: {
        fontSize: 11,
        color: 'rgba(100,116,139,0.6)',
        textAlign: 'center',
        margin: 0,
    },
};
