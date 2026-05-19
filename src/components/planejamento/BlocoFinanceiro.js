import React, { useState, useEffect } from 'react';
import { formatBRL, parseBRL } from '../../utils/formatBRL';

const STATUS_OPCOES = [
    { value: '', label: '—' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'EM_ROTA_DE_ENTREGA', label: 'Em rota de entrega' },
    { value: 'CONCLUIDO', label: 'Concluído' },
];

const inputStyle = {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
};

export default function BlocoFinanceiro({ rota, podeEditar, onSalvar }) {
    const [valorCargaTexto, setValorCargaTexto] = useState(formatBRL(rota.valor_carga));
    const [valorFreteTexto, setValorFreteTexto] = useState(formatBRL(rota.valor_frete));
    const [status, setStatus] = useState(rota.status_financeiro || '');

    useEffect(() => {
        setValorCargaTexto(formatBRL(rota.valor_carga));
        setValorFreteTexto(formatBRL(rota.valor_frete));
        setStatus(rota.status_financeiro || '');
    }, [rota.id, rota.valor_carga, rota.valor_frete, rota.status_financeiro]);

    function blurValor(campo, texto) {
        const numero = parseBRL(texto);
        const atual = rota[campo];
        if (numero !== atual) {
            onSalvar({ [campo]: numero });
        }
    }

    function mudarStatus(novo) {
        setStatus(novo);
        if (novo !== (rota.status_financeiro || '')) {
            onSalvar({ status_financeiro: novo || null });
        }
    }

    const tip = !podeEditar ? 'Você não tem permissão para editar este campo' : undefined;

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(167,139,250,0.06)',
            borderTop: '1px solid rgba(167,139,250,0.15)',
        }}>
            <div style={{
                fontSize: 11, fontWeight: 700, color: '#a78bfa',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>Financeiro</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Status</label>
                    <select
                        value={status}
                        onChange={e => mudarStatus(e.target.value)}
                        disabled={!podeEditar}
                        title={tip}
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    >
                        {STATUS_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Valor da carga</label>
                    <input
                        type="text"
                        value={valorCargaTexto}
                        onChange={e => setValorCargaTexto(e.target.value)}
                        onBlur={e => blurValor('valor_carga', e.target.value)}
                        disabled={!podeEditar}
                        title={tip}
                        placeholder="R$ 0,00"
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Valor do frete</label>
                    <input
                        type="text"
                        value={valorFreteTexto}
                        onChange={e => setValorFreteTexto(e.target.value)}
                        onBlur={e => blurValor('valor_frete', e.target.value)}
                        disabled={!podeEditar}
                        title={tip}
                        placeholder="R$ 0,00"
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Representatividade</label>
                    <input
                        type="text"
                        value={rota.representatividade_pct != null ? `${Number(rota.representatividade_pct).toFixed(2)}%` : '—'}
                        disabled
                        title="Calculado automaticamente pelo banco"
                        style={{ ...inputStyle, opacity: 0.7, fontFamily: 'monospace' }}
                    />
                </div>
            </div>
        </div>
    );
}
