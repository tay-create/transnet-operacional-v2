import React, { useState, useEffect } from 'react';

const STATUS_EMBARQUE_OPCOES = [
    { value: 'PROGRAMADA', label: 'Programada' },
    { value: 'EMBARCADA', label: 'Embarcada' },
    { value: 'PENDENTE', label: 'Pendente' },
];

const TIPOS_VEICULO = ['CARRETA', 'TRUCK', '3/4', 'VAN'];

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

function Campo({ label, children, span = 1 }) {
    return (
        <div style={{ gridColumn: `span ${span}` }}>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}

export default function BlocoDadosRota({ rota, podeEditar, onSalvar }) {
    const [local, setLocal] = useState(rota);

    useEffect(() => { setLocal(rota); }, [rota.id, rota.atualizado_em]);

    function blurCampo(campo, valor) {
        const atual = rota[campo] ?? '';
        const novo = valor ?? '';
        if (String(novo) !== String(atual)) {
            onSalvar({ [campo]: valor || null });
        }
    }

    function mudarLocal(campo, valor) {
        setLocal(prev => ({ ...prev, [campo]: valor }));
    }

    const style = (extra = {}) => ({ ...inputStyle, opacity: podeEditar ? 1 : 0.5, ...extra });
    const tip = !podeEditar ? 'Você não tem permissão para editar este campo' : undefined;

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(30,41,59,0.4)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
            <div style={{
                fontSize: 11, fontWeight: 700, color: '#60a5fa',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>Dados da rota</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <Campo label="Data prevista">
                    <input type="date" value={local.data_prevista || ''}
                        onChange={e => mudarLocal('data_prevista', e.target.value)}
                        onBlur={e => blurCampo('data_prevista', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
                <Campo label="Data embarque">
                    <input type="date" value={local.data_embarque || ''}
                        onChange={e => mudarLocal('data_embarque', e.target.value)}
                        onBlur={e => blurCampo('data_embarque', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
                <Campo label="Status embarque">
                    <select value={local.status_embarque || 'PROGRAMADA'}
                        onChange={e => { mudarLocal('status_embarque', e.target.value); onSalvar({ status_embarque: e.target.value }); }}
                        disabled={!podeEditar} title={tip} style={style()}>
                        {STATUS_EMBARQUE_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Campo>
                <Campo label="Operação (código)">
                    <input type="text" value={local.operacao_codigo || ''}
                        onChange={e => mudarLocal('operacao_codigo', e.target.value)}
                        onBlur={e => blurCampo('operacao_codigo', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} maxLength={4} />
                </Campo>

                <Campo label="Tipo veículo">
                    <select value={local.tipo_veiculo || ''}
                        onChange={e => { mudarLocal('tipo_veiculo', e.target.value); onSalvar({ tipo_veiculo: e.target.value || null }); }}
                        disabled={!podeEditar} title={tip} style={style()}>
                        <option value="">—</option>
                        {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </Campo>
                <Campo label="Motorista">
                    <input type="text" value={local.motorista_nome || ''}
                        onChange={e => mudarLocal('motorista_nome', e.target.value)}
                        onBlur={e => blurCampo('motorista_nome', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
                <Campo label="Placa cavalo">
                    <input type="text" value={local.placa_cavalo || ''}
                        onChange={e => mudarLocal('placa_cavalo', e.target.value)}
                        onBlur={e => blurCampo('placa_cavalo', e.target.value)}
                        disabled={!podeEditar} title={tip}
                        style={style({ fontFamily: 'monospace', textTransform: 'uppercase' })} />
                </Campo>
                <Campo label="Placa carreta">
                    <input type="text" value={local.placa_carreta || ''}
                        onChange={e => mudarLocal('placa_carreta', e.target.value)}
                        onBlur={e => blurCampo('placa_carreta', e.target.value)}
                        disabled={!podeEditar} title={tip}
                        style={style({ fontFamily: 'monospace', textTransform: 'uppercase' })} />
                </Campo>

                <Campo label="Coleta" span={1}>
                    <input type="text" value={local.coleta || ''}
                        onChange={e => mudarLocal('coleta', e.target.value)}
                        onBlur={e => blurCampo('coleta', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
                <Campo label="Redespacho" span={1}>
                    <input type="text" value={local.redespacho || ''}
                        onChange={e => mudarLocal('redespacho', e.target.value)}
                        onBlur={e => blurCampo('redespacho', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
                <Campo label="Observações" span={2}>
                    <input type="text" value={local.observacao || ''}
                        onChange={e => mudarLocal('observacao', e.target.value)}
                        onBlur={e => blurCampo('observacao', e.target.value)}
                        disabled={!podeEditar} title={tip} style={style()} />
                </Campo>
            </div>
        </div>
    );
}
