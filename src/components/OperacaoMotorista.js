import React, { useEffect, useState } from 'react';
import { Truck, CheckCircle, ArrowRight, Loader, AlertTriangle, X } from 'lucide-react';
import api from '../services/apiService';

const STATUS_ORDEM = ['LIBERADO P/ CARREGAMENTO', 'EM CARREGAMENTO', 'CARREGADO'];

const STATUS_LABEL = {
    'LIBERADO P/ CARREGAMENTO': 'Liberado p/ carregamento',
    'EM CARREGAMENTO': 'Em carregamento',
    'CARREGADO': 'Carregado',
};

const STATUS_COR = {
    'LIBERADO P/ CARREGAMENTO': '#60a5fa',
    'EM CARREGAMENTO': '#fb923c',
    'CARREGADO': '#22c55e',
};

const ACAO = {
    'LIBERADO P/ CARREGAMENTO': { proximo: 'EM CARREGAMENTO', label: 'INICIAR CARREGAMENTO', cor: '#fb923c' },
    'EM CARREGAMENTO': { proximo: 'CARREGADO', label: 'CONCLUIR CARREGAMENTO', cor: '#22c55e' },
};

export default function OperacaoMotorista() {
    const token = window.location.pathname.replace(/^\/operacao\//, '').replace(/\/$/, '');
    const [fase, setFase] = useState('carregando'); // carregando | confirmar | status | concluido | erro
    const [erroFatal, setErroFatal] = useState('');
    const [info, setInfo] = useState(null); // { motorista, operacao, status_atual }
    const [coletaInput, setColetaInput] = useState('');
    const [coletaConfirmada, setColetaConfirmada] = useState('');
    const [erro, setErro] = useState('');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!token) { setFase('erro'); setErroFatal('Link inválido.'); return; }
        api.get(`/api/operacao-motorista/${token}`)
            .then(r => {
                if (r.data?.success) {
                    setInfo(r.data);
                    setFase(r.data.status_atual === 'CARREGADO' ? 'concluido' : 'confirmar');
                } else {
                    setErroFatal(r.data?.message || 'Link inválido.');
                    setFase('erro');
                }
            })
            .catch(e => {
                setErroFatal(e.response?.data?.message || 'Erro ao validar link.');
                setFase('erro');
            });
    }, [token]);

    const confirmarColeta = async () => {
        const num = coletaInput.trim().replace(/\D/g, '').replace(/^0+/, '');
        if (!num) { setErro('Digite o número da coleta.'); return; }
        setSalvando(true);
        setErro('');
        try {
            await api.post(`/api/operacao-motorista/${token}/confirmar`, { coleta_digitada: num });
            setColetaConfirmada(num);
            setFase('status');
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao confirmar.');
        } finally {
            setSalvando(false);
        }
    };

    const avancar = async () => {
        setSalvando(true);
        setErro('');
        try {
            const r = await api.post(`/api/operacao-motorista/${token}/avancar`, { coleta_digitada: coletaConfirmada });
            if (r.data?.success) {
                setInfo(prev => ({ ...prev, status_atual: r.data.novo_status }));
                if (r.data.concluido) setFase('concluido');
            }
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao avançar.');
        } finally {
            setSalvando(false);
        }
    };

    const fecharAba = () => {
        try { window.close(); } catch {}
        setTimeout(() => {
            // Se window.close() não funcionar (Chrome bloqueia se a aba não foi aberta por script),
            // exibe instrução visual
            const el = document.getElementById('aviso-fechar');
            if (el) el.style.display = 'block';
        }, 300);
    };

    const wrapper = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#020617 0%,#0f172a 100%)',
        color: '#f1f5f9',
        padding: '20px',
        fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    };

    if (fase === 'carregando') {
        return (
            <div style={wrapper}>
                <Loader size={32} style={{ color: '#22d3ee', animation: 'spin 1s linear infinite', marginTop: '40vh' }} />
                <p style={{ marginTop: 16, color: '#94a3b8' }}>Validando link...</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (fase === 'erro') {
        return (
            <div style={wrapper}>
                <div style={{ marginTop: '30vh', textAlign: 'center', maxWidth: 360 }}>
                    <AlertTriangle size={48} color="#ef4444" />
                    <h2 style={{ fontSize: 20, marginTop: 16 }}>Não foi possível abrir</h2>
                    <p style={{ color: '#94a3b8', marginTop: 8 }}>{erroFatal}</p>
                    <p style={{ color: '#64748b', marginTop: 16, fontSize: 13 }}>
                        Se você acabou de receber este link, peça ao escritório para gerar um novo.
                    </p>
                </div>
            </div>
        );
    }

    if (fase === 'concluido') {
        return (
            <div style={wrapper}>
                <div style={{ marginTop: '20vh', textAlign: 'center', maxWidth: 380, width: '100%' }}>
                    <div style={{
                        width: 96, height: 96, borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto',
                    }}>
                        <CheckCircle size={56} color="#22c55e" />
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 24 }}>Carregamento concluído!</h2>
                    <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 15 }}>
                        Obrigado{info?.motorista ? `, ${info.motorista.split(' ')[0]}` : ''}!
                        O escritório já recebeu a confirmação.
                    </p>
                    <p style={{ color: '#64748b', marginTop: 8, fontSize: 13 }}>Boa viagem.</p>
                    <button
                        onClick={fecharAba}
                        style={{
                            marginTop: 32, width: '100%', minHeight: 56,
                            background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                            border: 'none', borderRadius: 12,
                            color: '#fff', fontSize: 16, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                    >
                        <X size={20} /> Fechar
                    </button>
                    <p id="aviso-fechar" style={{ display: 'none', marginTop: 16, color: '#fbbf24', fontSize: 13 }}>
                        Você pode fechar essa aba manualmente.
                    </p>
                </div>
            </div>
        );
    }

    // confirmar
    if (fase === 'confirmar') {
        return (
            <div style={wrapper}>
                <div style={{ marginTop: 40, textAlign: 'center', maxWidth: 380, width: '100%' }}>
                    <Truck size={48} color="#22d3ee" />
                    <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>{info?.motorista || 'Motorista'}</h1>
                    <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
                        {info?.operacao || ''}
                    </p>

                    <div style={{
                        marginTop: 32, padding: 20, borderRadius: 14,
                        background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)',
                        textAlign: 'left',
                    }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Número da coleta
                        </label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={coletaInput}
                            onChange={e => setColetaInput(e.target.value)}
                            placeholder="Ex: 175310"
                            autoFocus
                            style={{
                                width: '100%', boxSizing: 'border-box', marginTop: 8,
                                padding: '14px 16px', fontSize: 22, fontWeight: 700,
                                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10, color: '#f1f5f9', outline: 'none', textAlign: 'center', letterSpacing: 2,
                            }}
                        />
                        {erro && (
                            <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} /> {erro}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={confirmarColeta}
                        disabled={salvando || !coletaInput.trim()}
                        style={{
                            marginTop: 20, width: '100%', minHeight: 56,
                            background: salvando || !coletaInput.trim() ? '#1e293b' : 'linear-gradient(135deg,#0891b2,#22d3ee)',
                            border: 'none', borderRadius: 12,
                            color: '#fff', fontSize: 16, fontWeight: 700,
                            cursor: salvando || !coletaInput.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                    >
                        {salvando ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={18} />}
                        Confirmar
                    </button>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
            </div>
        );
    }

    // status
    const atual = info?.status_atual || 'LIBERADO P/ CARREGAMENTO';
    const acao = ACAO[atual];
    return (
        <div style={wrapper}>
            <div style={{ marginTop: 24, textAlign: 'center', maxWidth: 380, width: '100%' }}>
                <Truck size={36} color="#22d3ee" />
                <h1 style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>{info?.motorista || 'Motorista'}</h1>
                <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                    {info?.operacao || ''} · Coleta {coletaConfirmada}
                </p>

                {/* Status atual */}
                <div style={{
                    marginTop: 24, padding: '20px 16px', borderRadius: 14,
                    background: `${STATUS_COR[atual]}15`,
                    border: `2px solid ${STATUS_COR[atual]}`,
                }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Status atual
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: STATUS_COR[atual], marginTop: 6, letterSpacing: 0.5 }}>
                        {STATUS_LABEL[atual] || atual}
                    </div>
                </div>

                {/* Botão de avanço */}
                {acao && (
                    <button
                        onClick={avancar}
                        disabled={salvando}
                        style={{
                            marginTop: 20, width: '100%', minHeight: 64,
                            background: salvando ? '#1e293b' : `linear-gradient(135deg,${acao.cor}aa,${acao.cor})`,
                            border: 'none', borderRadius: 12,
                            color: '#fff', fontSize: 17, fontWeight: 800,
                            cursor: salvando ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            letterSpacing: 0.5,
                        }}
                    >
                        {salvando ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={20} />}
                        {acao.label}
                    </button>
                )}

                {erro && (
                    <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <AlertTriangle size={14} /> {erro}
                    </p>
                )}

                {/* Linha de progresso */}
                <div style={{ marginTop: 32, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {STATUS_ORDEM.map((st, i) => {
                        const idxAtual = STATUS_ORDEM.indexOf(atual);
                        const feito = i < idxAtual;
                        const aqui = i === idxAtual;
                        return (
                            <div key={st} style={{
                                flex: 1, height: 6, borderRadius: 3,
                                background: feito || aqui ? STATUS_COR[st] : '#1e293b',
                                opacity: aqui ? 1 : feito ? 0.7 : 0.3,
                            }} />
                        );
                    })}
                </div>
                <p style={{ marginTop: 10, fontSize: 11, color: '#475569' }}>
                    Etapa {STATUS_ORDEM.indexOf(atual) + 1} de {STATUS_ORDEM.length}
                </p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
}
