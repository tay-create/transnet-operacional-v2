import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import api from '../../services/apiService';
import { formatBRL, parseBRL } from '../../utils/formatBRL';

const REGIOES = [
    { value: '', label: '—' },
    { value: 'N', label: 'Norte' },
    { value: 'NE', label: 'Nordeste' },
    { value: 'CO', label: 'Centro-Oeste' },
    { value: 'SE', label: 'Sudeste' },
    { value: 'S', label: 'Sul' },
];
const STATUS_EMBARQUE = ['PROGRAMADA', 'EMBARCADA', 'PENDENTE'];
const STATUS_FINANCEIRO = [
    { value: '', label: '—' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'EM_ROTA_DE_ENTREGA', label: 'Em rota de entrega' },
    { value: 'CONCLUIDO', label: 'Concluído' },
];
const STATUS_AGENDAMENTO = [
    { value: '', label: '—' },
    { value: 'AG', label: 'AG' },
    { value: 'S_AG', label: 'S/ AG' },
    { value: 'CONFIRMADO', label: 'Confirmado' },
];
const TIPOS_VEICULO = ['CARRETA', 'TRUCK', '3/4'];
const OPERACOES = ['PLASTICO', 'PORCELANA', 'PLASTICO CONSOLIDADO', 'PORCELANA CONSOLIDADA'];

const inputStyle = {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
};

const labelStyle = {
    fontSize: 11, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'block', marginBottom: 4, fontWeight: 600,
};

function destinoVazio() {
    return {
        cidade: '', uf: '', cliente: '',
        notas_fiscais: '', status_agendamento: '', data_entrega_cliente: '',
        is_redespacho: false, redespacho_via: '',
    };
}

export default function ModalNovaRota({ aberto, abaAtiva, mesRef, podeEditarFinanceiro, onFechar, onSalvo }) {
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    // Cabeçalho da rota
    const [coleta, setColeta] = useState('');
    const [dataPrevista, setDataPrevista] = useState('');
    const [dataEmbarque, setDataEmbarque] = useState('');
    const [statusEmbarque, setStatusEmbarque] = useState('PROGRAMADA');
    const [operacaoCodigo, setOperacaoCodigo] = useState('');
    const [tipoVeiculo, setTipoVeiculo] = useState('');
    const [motoristaNome, setMotoristaNome] = useState('');
    const [regiao, setRegiao] = useState('');
    const [observacao, setObservacao] = useState('');

    // Financeiro (só ELETRIK)
    const [statusFin, setStatusFin] = useState('');
    const [valorCargaTxt, setValorCargaTxt] = useState('');
    const [valorFreteTxt, setValorFreteTxt] = useState('');

    // Destinos
    const [destinos, setDestinos] = useState([destinoVazio()]);

    const temFinanceiro = abaAtiva === 'ELETRIK';

    // Reset ao abrir
    useEffect(() => {
        if (aberto) {
            setColeta(''); setDataPrevista(''); setDataEmbarque('');
            setStatusEmbarque('PROGRAMADA'); setOperacaoCodigo('');
            setTipoVeiculo(''); setMotoristaNome(''); setRegiao(''); setObservacao('');
            setStatusFin(''); setValorCargaTxt(''); setValorFreteTxt('');
            setDestinos([destinoVazio()]);
            setErro(''); setSalvando(false);
        }
    }, [aberto]);

    function atualizarDestino(idx, campo, valor) {
        setDestinos(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d));
    }

    function adicionarDestino() {
        setDestinos(prev => [...prev, destinoVazio()]);
    }

    function removerDestino(idx) {
        setDestinos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    }

    async function salvar() {
        setErro('');
        const destinosLimpos = destinos
            .filter(d => (d.cidade || '').trim() || (d.uf || '').trim() || (d.cliente || '').trim())
            .map(d => ({
                cidade: (d.cidade || '').trim() || null,
                uf: (d.uf || '').trim().toUpperCase().slice(0, 2) || null,
                cliente: (d.cliente || '').trim() || null,
                notas_fiscais: (d.notas_fiscais || '').trim() || null,
                status_agendamento: d.status_agendamento || null,
                data_entrega_cliente: d.data_entrega_cliente || null,
                is_redespacho: !!d.is_redespacho,
                redespacho_via: (d.redespacho_via || '').trim() || null,
            }));

        const payload = {
            mes_referencia: mesRef,
            aba_origem: abaAtiva,
            coleta: coleta.trim() || null,
            data_prevista: dataPrevista || null,
            data_embarque: dataEmbarque || null,
            status_embarque: statusEmbarque,
            operacao_codigo: operacaoCodigo || null,
            tipo_veiculo: tipoVeiculo || null,
            motorista_nome: motoristaNome.trim() || null,
            regiao: regiao || null,
            observacao: observacao.trim() || null,
            destinos: destinosLimpos,
        };

        if (temFinanceiro && podeEditarFinanceiro) {
            if (statusFin) payload.status_financeiro = statusFin;
            const vc = parseBRL(valorCargaTxt);
            const vf = parseBRL(valorFreteTxt);
            if (vc !== null) payload.valor_carga = vc;
            if (vf !== null) payload.valor_frete = vf;
        }

        setSalvando(true);
        try {
            const r = await api.post('/api/tramontina/rotas', payload);
            if (r.data?.success) {
                onSalvo?.(r.data.rota);
                onFechar?.();
            } else {
                setErro(r.data?.message || 'Erro ao salvar.');
            }
        } catch (e) {
            setErro(e?.response?.data?.message || 'Erro ao salvar. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    }

    if (!aberto) return null;

    return (
        <div onClick={onFechar} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
                width: '95vw', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 24px', borderBottom: '1px solid #1e293b',
                    position: 'sticky', top: 0, background: '#0f172a', zIndex: 2,
                }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                            Nova rota — {abaAtiva}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Mês de referência: <strong style={{ color: '#94a3b8' }}>{mesRef}</strong>
                        </div>
                    </div>
                    <button onClick={onFechar} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4,
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Corpo */}
                <div style={{ padding: 24 }}>
                    {/* DADOS DA ROTA */}
                    <div style={{
                        fontSize: 11, fontWeight: 700, color: '#60a5fa',
                        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
                    }}>Dados da rota</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                        <div>
                            <label style={labelStyle}>Coleta <span style={{ textTransform: 'none', color: '#475569', fontWeight: 400 }}>(opcional)</span></label>
                            <input type="text" value={coleta} onChange={e => setColeta(e.target.value)}
                                placeholder="Nº coleta" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Data prevista</label>
                            <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Data embarque</label>
                            <input type="date" value={dataEmbarque} onChange={e => setDataEmbarque(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Status embarque</label>
                            <select value={statusEmbarque} onChange={e => setStatusEmbarque(e.target.value)} style={inputStyle}>
                                {STATUS_EMBARQUE.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Operação</label>
                            <select value={operacaoCodigo} onChange={e => setOperacaoCodigo(e.target.value)} style={inputStyle}>
                                <option value="">—</option>
                                {OPERACOES.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Tipo veículo</label>
                            <select value={tipoVeiculo} onChange={e => setTipoVeiculo(e.target.value)} style={inputStyle}>
                                <option value="">—</option>
                                {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Região</label>
                            <select value={regiao} onChange={e => setRegiao(e.target.value)} style={inputStyle}>
                                {REGIOES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Motorista</label>
                            <input type="text" value={motoristaNome} onChange={e => setMotoristaNome(e.target.value)}
                                placeholder="Nome do motorista" style={inputStyle} />
                        </div>

                        <div style={{ gridColumn: 'span 4' }}>
                            <label style={labelStyle}>Observações</label>
                            <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} style={inputStyle} />
                        </div>
                    </div>

                    {/* FINANCEIRO (só ELETRIK) */}
                    {temFinanceiro && (
                        <>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: '#a78bfa',
                                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
                                opacity: podeEditarFinanceiro ? 1 : 0.6,
                            }}>Financeiro {!podeEditarFinanceiro && '(sem permissão)'}</div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                                <div>
                                    <label style={labelStyle}>Status</label>
                                    <select value={statusFin} onChange={e => setStatusFin(e.target.value)}
                                        disabled={!podeEditarFinanceiro}
                                        style={{ ...inputStyle, opacity: podeEditarFinanceiro ? 1 : 0.5 }}>
                                        {STATUS_FINANCEIRO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Valor da carga</label>
                                    <input type="text" value={valorCargaTxt}
                                        onChange={e => setValorCargaTxt(e.target.value)}
                                        onBlur={e => { const n = parseBRL(e.target.value); if (n !== null) setValorCargaTxt(formatBRL(n)); }}
                                        placeholder="R$ 0,00"
                                        disabled={!podeEditarFinanceiro}
                                        style={{ ...inputStyle, opacity: podeEditarFinanceiro ? 1 : 0.5 }} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Valor do frete</label>
                                    <input type="text" value={valorFreteTxt}
                                        onChange={e => setValorFreteTxt(e.target.value)}
                                        onBlur={e => { const n = parseBRL(e.target.value); if (n !== null) setValorFreteTxt(formatBRL(n)); }}
                                        placeholder="R$ 0,00"
                                        disabled={!podeEditarFinanceiro}
                                        style={{ ...inputStyle, opacity: podeEditarFinanceiro ? 1 : 0.5 }} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* DESTINOS */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 10,
                    }}>
                        <div style={{
                            fontSize: 11, fontWeight: 700, color: '#4ade80',
                            textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>Destinos ({destinos.length})</div>
                        <button onClick={adicionarDestino} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'rgba(74,222,128,0.15)',
                            border: '1px solid rgba(74,222,128,0.4)',
                            color: '#4ade80', borderRadius: 5,
                            padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                        }}>
                            <Plus size={12} /> Adicionar destino
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {destinos.map((d, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 6, padding: 10,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 8, fontSize: 11, color: '#94a3b8', fontWeight: 600,
                                }}>
                                    <span>Destino #{idx + 1}</span>
                                    {destinos.length > 1 && (
                                        <button onClick={() => removerDestino(idx)} title="Remover"
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: '#f87171', cursor: 'pointer', padding: 2,
                                            }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 3fr', gap: 8, marginBottom: 8 }}>
                                    <input type="text" placeholder="Cidade"
                                        value={d.cidade} onChange={e => atualizarDestino(idx, 'cidade', e.target.value)}
                                        style={inputStyle} />
                                    <input type="text" placeholder="UF" maxLength={2}
                                        value={d.uf} onChange={e => atualizarDestino(idx, 'uf', e.target.value.toUpperCase())}
                                        style={{ ...inputStyle, textTransform: 'uppercase' }} />
                                    <input type="text" placeholder="Cliente"
                                        value={d.cliente} onChange={e => atualizarDestino(idx, 'cliente', e.target.value)}
                                        style={inputStyle} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 130px', gap: 8, marginBottom: 8 }}>
                                    <input type="text" placeholder="Notas Fiscais"
                                        value={d.notas_fiscais} onChange={e => atualizarDestino(idx, 'notas_fiscais', e.target.value)}
                                        style={inputStyle} />
                                    <select value={d.status_agendamento} onChange={e => atualizarDestino(idx, 'status_agendamento', e.target.value)}
                                        style={inputStyle}>
                                        {STATUS_AGENDAMENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    <input type="date"
                                        value={d.data_entrega_cliente} onChange={e => atualizarDestino(idx, 'data_entrega_cliente', e.target.value)}
                                        style={inputStyle} title="Data prevista da entrega" />
                                </div>
                                {/* Redespacho */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                                        <input type="checkbox" checked={!!d.is_redespacho}
                                            onChange={e => atualizarDestino(idx, 'is_redespacho', e.target.checked)} />
                                        Redespacho
                                    </label>
                                    {d.is_redespacho && (
                                        <input type="text" placeholder="Redespacho via... (opcional)"
                                            value={d.redespacho_via}
                                            onChange={e => atualizarDestino(idx, 'redespacho_via', e.target.value)}
                                            style={{ ...inputStyle, flex: 1 }} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Erro */}
                    {erro && (
                        <div style={{
                            color: '#f87171', fontSize: 12, marginBottom: 12, padding: '8px 12px',
                            background: 'rgba(239,68,68,0.1)', borderRadius: 6,
                        }}>
                            {erro}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 10,
                        borderTop: '1px solid #1e293b', paddingTop: 16,
                    }}>
                        <button onClick={onFechar} disabled={salvando} style={{
                            background: 'transparent', border: '1px solid #334155',
                            borderRadius: 6, color: '#94a3b8', cursor: salvando ? 'not-allowed' : 'pointer',
                            padding: '9px 18px', fontSize: 13,
                        }}>Cancelar</button>
                        <button onClick={salvar} disabled={salvando} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: salvando ? '#1e293b' : 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                            border: 'none', borderRadius: 6, color: '#fff',
                            cursor: salvando ? 'not-allowed' : 'pointer',
                            padding: '9px 20px', fontSize: 13, fontWeight: 600,
                        }}>
                            <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar rota'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
