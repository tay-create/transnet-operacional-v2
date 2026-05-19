import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/apiService';

const STATUS_AGENDAMENTO = [
    { value: '', label: '—' },
    { value: 'AG', label: 'AG' },
    { value: 'S_AG', label: 'S/ AG' },
    { value: 'CONFIRMADO', label: 'Confirmado' },
];

const inputStyle = {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: '#e2e8f0',
    padding: '5px 8px',
    fontSize: 12,
    outline: 'none',
};

const leadCor = {
    ANTECIPADO: '#a78bfa',
    DENTRO: '#4ade80',
    FORA: '#f87171',
    AGUARDANDO: '#fbbf24',
};

function MiniEntrega({ entrega, podeEditar, onSalvar, onRemover }) {
    function blur(campo, valor) {
        if (String(valor || '') !== String(entrega[campo] || '')) {
            onSalvar(entrega.id, { [campo]: valor || null });
        }
    }
    return (
        <div style={{
            padding: '6px 8px',
            background: 'rgba(15,23,42,0.5)',
            borderRadius: 4,
            marginBottom: 4,
        }}>
            {/* Linha 1: Cidade, UF, Cliente, Notas, Agendamento, Data, Lead, Lixeira */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 50px 2fr 2fr 80px 110px 80px 30px',
                gap: 6, alignItems: 'center',
            }}>
                <input type="text" placeholder="Cidade"
                    defaultValue={entrega.cidade || ''} onBlur={e => blur('cidade', e.target.value)}
                    disabled={!podeEditar} style={inputStyle} />
                <input type="text" placeholder="UF"
                    defaultValue={entrega.uf || ''} onBlur={e => blur('uf', e.target.value.toUpperCase().slice(0, 2))}
                    disabled={!podeEditar} style={{ ...inputStyle, textTransform: 'uppercase' }} maxLength={2} />
                <input type="text" placeholder="Cliente"
                    defaultValue={entrega.cliente || ''} onBlur={e => blur('cliente', e.target.value)}
                    disabled={!podeEditar} style={inputStyle} />
                <input type="text" placeholder="Notas Fiscais"
                    defaultValue={entrega.notas_fiscais || ''} onBlur={e => blur('notas_fiscais', e.target.value)}
                    disabled={!podeEditar} style={inputStyle} />
                <select defaultValue={entrega.status_agendamento || ''} onChange={e => onSalvar(entrega.id, { status_agendamento: e.target.value || null })}
                    disabled={!podeEditar} style={inputStyle}>
                    {STATUS_AGENDAMENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="date"
                    defaultValue={entrega.data_entrega_cliente || ''} onBlur={e => blur('data_entrega_cliente', e.target.value)}
                    disabled={!podeEditar} style={inputStyle} />
                <span style={{ color: leadCor[entrega.lead_status] || '#64748b', fontSize: 11, fontWeight: 600 }}>
                    {entrega.lead_status || '—'}
                </span>
                {podeEditar ? (
                    <button onClick={() => onRemover(entrega.id)} title="Remover"
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}>
                        <Trash2 size={14} />
                    </button>
                ) : <span />}
            </div>
            {/* Linha 2: checkbox Redespacho + campo opcional */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', cursor: podeEditar ? 'pointer' : 'default', userSelect: 'none' }}>
                    <input type="checkbox" checked={!!entrega.is_redespacho}
                        onChange={e => onSalvar(entrega.id, { is_redespacho: e.target.checked })}
                        disabled={!podeEditar} />
                    Redespacho
                </label>
                {entrega.is_redespacho && (
                    <input type="text" placeholder="Redespacho via..."
                        defaultValue={entrega.redespacho_via || ''}
                        onBlur={e => blur('redespacho_via', e.target.value)}
                        disabled={!podeEditar}
                        style={{ ...inputStyle, flex: 1 }} />
                )}
            </div>
        </div>
    );
}

export default function BlocoDestinos({ rota, entregas = [], podeEditar, onAlterado }) {
    const [adicionando, setAdicionando] = useState(false);

    async function salvarEntrega(id, patch) {
        try {
            const r = await api.put(`/api/tramontina/entregas/${id}`, patch);
            if (r.data?.success) onAlterado?.();
        } catch (e) {
            console.warn('Falha ao salvar entrega', e);
        }
    }

    async function removerEntrega(id) {
        if (!window.confirm('Remover destino?')) return;
        try {
            await api.delete(`/api/tramontina/entregas/${id}`);
            onAlterado?.();
        } catch (e) {
            console.warn('Falha ao remover entrega', e);
        }
    }

    async function adicionarEntrega() {
        setAdicionando(true);
        try {
            await api.post(`/api/tramontina/rotas/${rota.id}/entregas`, {
                cidade: '', uf: '', regiao: null,
                cliente: '', notas_fiscais: '',
                status_agendamento: null, data_entrega_cliente: null,
            });
            onAlterado?.();
        } catch (e) {
            console.warn('Falha ao adicionar entrega', e);
        } finally {
            setAdicionando(false);
        }
    }

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(30,41,59,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
            }}>
                <div style={{
                    fontSize: 11, fontWeight: 700, color: '#4ade80',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                }}>Destinos ({entregas.length})</div>
                {podeEditar && (
                    <button onClick={adicionarEntrega} disabled={adicionando}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'rgba(74,222,128,0.15)',
                            border: '1px solid rgba(74,222,128,0.4)',
                            color: '#4ade80', borderRadius: 5,
                            padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                        }}>
                        <Plus size={12} /> Adicionar destino
                    </button>
                )}
            </div>

            {entregas.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
                    Nenhum destino adicionado ainda.
                </div>
            ) : (
                <div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 50px 2fr 2fr 80px 110px 80px 30px',
                        gap: 6, fontSize: 10, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.3,
                        padding: '0 8px 4px 8px',
                    }}>
                        <span>Cidade</span><span>UF</span>
                        <span>Cliente</span><span>Notas Fiscais</span>
                        <span>Agenda</span><span>Entrega</span><span>Lead</span><span></span>
                    </div>
                    {entregas.map(e => (
                        <MiniEntrega key={e.id} entrega={e} podeEditar={podeEditar}
                            onSalvar={salvarEntrega} onRemover={removerEntrega} />
                    ))}
                </div>
            )}
        </div>
    );
}
