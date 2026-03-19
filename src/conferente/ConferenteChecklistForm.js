import React, { useState } from 'react';
import { Truck, AlertTriangle, Loader, Clock } from 'lucide-react';
import ModalChecklistCarreta from '../components/ModalChecklistCarreta';
import useConferenteStore from './useConferenteStore';
import api from '../services/apiService';

export default function ConferenteChecklistForm({ veiculo, socket }) {
    const { goBack, addToast } = useConferenteStore();
    const [checklistEnviado, setChecklistEnviado] = useState(false);
    const [checklistStatus, setChecklistStatus] = useState(null);
    const [liberando, setLiberando] = useState(false);
    const [erroLiberar, setErroLiberar] = useState('');

    const handleSucesso = (msg, status) => {
        addToast({ tipo: 'success', mensagem: msg || 'Checklist enviado!' });
        setChecklistStatus(status || 'APROVADO');
        setChecklistEnviado(true);
    };

    const handleLiberarCarregamento = async () => {
        setLiberando(true);
        setErroLiberar('');
        try {
            const res = await api.post('/api/conferente/liberar-carregamento', { veiculoId: veiculo.id });
            if (res.data.success) {
                addToast({ tipo: 'success', mensagem: 'Veículo liberado para carregamento!' });
                goBack();
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Erro ao liberar carregamento.';
            setErroLiberar(msg);
        } finally {
            setLiberando(false);
        }
    };

    // Se o checklist já foi enviado, mostra a tela de ação pós-checklist
    if (checklistEnviado) {
        const isPendente = checklistStatus === 'PENDENTE';

        return (
            <div style={{
                minHeight: '60vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '20px', textAlign: 'center'
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: isPendente ? 'rgba(251, 191, 36, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                    border: `2px solid ${isPendente ? 'rgba(251, 191, 36, 0.3)' : 'rgba(74, 222, 128, 0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px'
                }}>
                    {isPendente ? <Clock size={28} color="#fbbf24" /> : <Truck size={28} color="#4ade80" />}
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>
                    {isPendente ? 'Aguardando Aprovação' : 'Checklist Registrado'}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: isPendente ? '12px' : '24px', maxWidth: '300px' }}>
                    {veiculo.motorista} - {veiculo.placa1Motorista}
                </p>

                {isPendente && (
                    <div style={{
                        marginBottom: '24px', padding: '14px 16px',
                        borderRadius: '12px', maxWidth: '340px', width: '100%',
                        background: 'rgba(251, 191, 36, 0.08)',
                        border: '1px solid rgba(251, 191, 36, 0.25)',
                        color: '#fbbf24', fontSize: '13px', lineHeight: 1.5,
                        textAlign: 'left'
                    }}>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Checklist enviado para revisão</strong>
                        O Coordenador precisa aprovar antes de liberar o carregamento. Aguarde a confirmação.
                    </div>
                )}

                {erroLiberar && (
                    <div style={{
                        marginBottom: '16px', padding: '12px 16px',
                        borderRadius: '10px', maxWidth: '360px', width: '100%',
                        background: 'rgba(248,113,113,0.1)',
                        border: '1px solid rgba(248,113,113,0.3)',
                        color: '#f87171', fontSize: '13px',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        textAlign: 'left'
                    }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>{erroLiberar}</span>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '320px' }}>
                    {!isPendente && (
                        <button
                            onClick={handleLiberarCarregamento}
                            disabled={liberando}
                            style={{
                                width: '100%', padding: '16px',
                                borderRadius: '12px', border: 'none',
                                background: liberando ? 'rgba(34, 197, 94, 0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                                color: 'white', fontSize: '15px', fontWeight: 700,
                                cursor: liberando ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: liberando ? 'none' : '0 4px 16px rgba(34, 197, 94, 0.3)'
                            }}
                        >
                            {liberando ? <><Loader size={16} /> Liberando...</> : 'LIBERAR PARA CARREGAMENTO'}
                        </button>
                    )}

                    <button
                        onClick={goBack}
                        style={{
                            width: '100%', padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: '#94a3b8', fontSize: '14px', fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Voltar ao Checklist
                    </button>
                </div>
            </div>
        );
    }

    // Tela do checklist (reutiliza o modal existente em modo fullpage)
    return (
        <div style={{ margin: '-16px', minHeight: 'calc(100vh - 60px)' }}>
            <ModalChecklistCarreta
                veiculo={veiculo}
                onClose={goBack}
                onSucesso={handleSucesso}
                backMode={true}
            />
        </div>
    );
}
