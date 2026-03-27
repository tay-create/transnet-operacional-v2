import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/apiService';

const CHECKLIST_LABELS = { cnh: 'CNH', antt: 'ANTT', tacografo: 'Tacógrafo', crlv: 'CRLV' };
const TIPO_COR = { 'LIBERADO': '#22c55e', 'PENDENTE': '#f59e0b', 'NÃO CONFERIDO': '#475569' };

function TimerBadge({ dataLiberacao }) {
    const [info, setInfo] = useState({ label: '', cor: '#475569' });
    useEffect(() => {
        const calc = () => {
            if (!dataLiberacao) { setInfo({ label: 'Sem liberação', cor: '#475569' }); return; }
            const limite = new Date(dataLiberacao).getTime() + 24 * 60 * 60 * 1000;
            const diff = limite - Date.now();
            if (diff <= 0) { setInfo({ label: 'Expirado', cor: '#ef4444' }); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const cor = diff < 3600000 ? '#ef4444' : diff < 7200000 ? '#f59e0b' : '#22c55e';
            setInfo({ label: `${h}h ${m}min`, cor });
        };
        calc();
        const t = setInterval(calc, 30000);
        return () => clearInterval(t);
    }, [dataLiberacao]);

    return (
        <span style={{
            fontSize: '11px', fontWeight: '700', color: info.cor,
            background: `rgba(${hexToRgb(info.cor)},0.1)`,
            border: `1px solid rgba(${hexToRgb(info.cor)},0.3)`,
            borderRadius: '8px', padding: '2px 8px',
        }}>
            ⏱ {info.label}
        </span>
    );
}

export default function MobileCadastro() {
    const [aba, setAba] = useState('espera');
    const [espera, setEspera] = useState([]);
    const [operacao, setOperacao] = useState([]);
    const [frota, setFrota] = useState([]);
    const [carregando, setCarregando] = useState(false);

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            if (aba === 'espera') {
                const r = await api.get('/api/cadastro/motoristas');
                setEspera(r.data.motoristas || []);
            } else if (aba === 'operacao') {
                const r = await api.get(`/api/cadastro/veiculos-em-operacao?dataInicio=${dataInicio}&dataFim=${dataFim}`);
                setOperacao(r.data.veiculos || []);
            } else if (aba === 'frota') {
                const r = await api.get('/api/cadastro/frota');
                setFrota(r.data.frota || []);
            }
        } catch (e) { console.error(e); }
        finally { setCarregando(false); }
    }, [aba, dataInicio, dataFim]);

    useEffect(() => { carregar(); }, [carregar]);

    const ABAS = [
        { id: 'espera', label: 'Em Espera' },
        { id: 'operacao', label: 'Na Operação' },
        { id: 'frota', label: 'Frota Própria' },
    ];

    return (
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', padding: '16px 16px 0', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '12px' }}>
                    Ger. Risco / CT-e
                </div>
                {/* Abas */}
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1e293b' }}>
                    {ABAS.map(a => (
                        <button key={a.id} onClick={() => setAba(a.id)} style={{
                            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: aba === a.id ? '2px solid #f59e0b' : '2px solid transparent',
                            color: aba === a.id ? '#f59e0b' : '#475569',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent', letterSpacing: '0.3px',
                        }}>
                            {a.label}
                        </button>
                    ))}
                </div>

                {/* Filtro data para "Na Operação" */}
                {aba === 'operacao' && (
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 0', alignItems: 'center' }}>
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                        <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', padding: '6px 10px', fontSize: '13px' }} />
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {carregando ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>Carregando...</div>
                ) : (
                    <>
                        {/* ABA: Em Espera */}
                        {aba === 'espera' && (
                            espera.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontSize: '13px' }}>Nenhum motorista em espera.</div>
                                </div>
                            ) : espera.map(m => (
                                <div key={m.id} style={{
                                    background: '#0f172a', border: '1px solid #1e293b',
                                    borderLeft: '3px solid #f59e0b', borderRadius: '12px', padding: '14px 16px',
                                }}>
                                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9', marginBottom: '8px' }}>
                                        {m.nome_motorista}
                                    </div>
                                    {/* Checklist pills */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                                            const ok = m[key] === 1 || m[key] === true || m[key] === 'SIM';
                                            return (
                                                <span key={key} style={{
                                                    fontSize: '11px', fontWeight: '700',
                                                    color: ok ? '#4ade80' : '#f87171',
                                                    background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                    border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                    borderRadius: '6px', padding: '2px 7px',
                                                }}>
                                                    {ok ? '✓' : '✗'} {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {m.operacao && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#475569' }}>
                                            🔄 {m.operacao}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* ABA: Na Operação */}
                        {aba === 'operacao' && (
                            operacao.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚛</div>
                                    <div style={{ fontSize: '13px' }}>Nenhum veículo neste período.</div>
                                </div>
                            ) : operacao.map(v => {
                                const sitCor = TIPO_COR[v.situacao_cadastro] || '#475569';
                                return (
                                    <div key={v.id} style={{
                                        background: '#0f172a', border: '1px solid #1e293b',
                                        borderLeft: `3px solid ${sitCor}`, borderRadius: '12px', padding: '14px 16px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9' }}>{v.motorista}</div>
                                                {v.placa && (
                                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fb923c', fontWeight: '700' }}>{v.placa}</span>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', color: sitCor,
                                                background: `rgba(${hexToRgb(sitCor)},0.1)`,
                                                border: `1px solid rgba(${hexToRgb(sitCor)},0.3)`,
                                                borderRadius: '6px', padding: '2px 8px',
                                            }}>
                                                {v.situacao_cadastro || 'NÃO CONF.'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {v.seguradora_cad && (
                                                <span style={{ fontSize: '11px', color: '#475569' }}>🛡 {v.seguradora_cad}</span>
                                            )}
                                            <TimerBadge dataLiberacao={v.data_liberacao_cad} />
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* ABA: Frota Própria */}
                        {aba === 'frota' && (
                            frota.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚗</div>
                                    <div style={{ fontSize: '13px' }}>Nenhum motorista na frota.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {frota.map(m => (
                                        <div key={m.id} style={{
                                            background: '#0f172a', border: '1px solid #1e293b',
                                            borderRadius: '12px', padding: '14px 12px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧑</div>
                                            <div style={{ fontWeight: '700', fontSize: '12px', color: '#f1f5f9', lineHeight: 1.3, marginBottom: '4px' }}>
                                                {m.nome_motorista}
                                            </div>
                                            {m.tipo_veiculo && (
                                                <div style={{ fontSize: '10px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                    {m.tipo_veiculo}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '71,85,105';
}
