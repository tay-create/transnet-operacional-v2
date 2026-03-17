import React from 'react';
import { Copy } from 'lucide-react';
import { OPCOES_STATUS_CTE } from '../constants';

export default function PainelCte({
    abaAtiva,
    ctesRecife,
    ctesMoreno,
    setCtesRecife,
    setCtesMoreno,
    filtroDataInicioCte,
    filtroDataFimCte,
    setFiltroDataInicioCte,
    setFiltroDataFimCte,
    updateListCte,
    podeEditar,
    setToastCopiaMsg
}) {
    const isRecife = abaAtiva === 'cte_recife';
    const listaCtes = isRecife ? ctesRecife : ctesMoreno;
    const setListaAtual = isRecife ? setCtesRecife : setCtesMoreno;
    const corTema = isRecife ? '#3b82f6' : '#f59e0b';
    const bgBadge = isRecife ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)';

    const ctesFiltrados = listaCtes.filter(cte => {
        const dataEmissao = cte.data_entrada_cte;
        if (!dataEmissao) return true;

        let dataComparacao;
        if (dataEmissao.includes('/')) {
            const partes = dataEmissao.split('/');
            dataComparacao = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        } else {
            dataComparacao = dataEmissao;
        }

        return dataComparacao >= filtroDataInicioCte && dataComparacao <= filtroDataFimCte;
    });

    return (
        <section style={{ marginTop: '10px' }}>
            {/* TÍTULO COM SOMBRA NEON EVIDENTE */}
            <div className="neon-tab-title" style={{ borderColor: corTema }}>
                <span className="neon-text" style={{ textShadow: `0 0 10px ${corTema}` }}>
                    GERENCIAMENTO DE CT-E — <span style={{ color: isRecife ? '#60a5fa' : '#fbbf24' }}>{isRecife ? 'RECIFE' : 'MORENO'}</span>
                </span>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>
                    {listaCtes.length} Pendentes
                </div>
            </div>

            {/* FILTROS DE DATA */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap' }}>DATA DE:</label>
                    <input
                        type="date"
                        className="input-internal"
                        value={filtroDataInicioCte}
                        onChange={e => setFiltroDataInicioCte(e.target.value)}
                        style={{ width: '150px', padding: '6px 10px', fontSize: '12px' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap' }}>DATA ATÉ:</label>
                    <input
                        type="date"
                        className="input-internal"
                        value={filtroDataFimCte}
                        onChange={e => setFiltroDataFimCte(e.target.value)}
                        style={{ width: '150px', padding: '6px 10px', fontSize: '12px' }}
                    />
                </div>
            </div>

            <div className="grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
                {ctesFiltrados.map((cte) => {
                    const realIndex = listaCtes.findIndex(c => c.id === cte.id);
                    return (
                    <div key={cte.id ?? realIndex} className="card-cte-glass" style={{ borderLeft: `4px solid ${corTema}` }}>
                        {/* Topo do Card */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ color: corTema, fontWeight: 'bold' }}>COLETAS</label>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{cte.data_entrada_cte || ''}</span>
                                </div>
                                {/* Coletas Recife */}
                                {cte.coletaRecife && cte.coletaRecife.trim() && (
                                    <div style={{ marginBottom: '4px' }}>
                                        <span style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 'bold', textTransform: 'uppercase' }}>Recife</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                            {cte.coletaRecife.split(',').map((doc, di) => (
                                                <span key={`r-${di}`} className="doc-badge" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid #3b82f6' }}>
                                                    {doc.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Coletas Moreno */}
                                {cte.coletaMoreno && cte.coletaMoreno.trim() && (
                                    <div style={{ marginBottom: '4px' }}>
                                        <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase' }}>Moreno</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                            {cte.coletaMoreno.split(',').map((doc, di) => (
                                                <span key={`m-${di}`} className="doc-badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid #f59e0b' }}>
                                                    {doc.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Fallback: coleta geral */}
                                {(!cte.coletaRecife || !cte.coletaRecife.trim()) && (!cte.coletaMoreno || !cte.coletaMoreno.trim()) && cte.coleta && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                        {cte.coleta.split(',').map((doc, di) => (
                                            <span key={di} className="doc-badge" style={{ background: bgBadge, color: isRecife ? '#93c5fd' : '#fcd34d', border: `1px solid ${corTema}` }}>
                                                {doc.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {podeEditar('cte') && (
                                <button
                                    onClick={() => setListaAtual(listaCtes.filter((_, i) => i !== realIndex))}
                                    title="Remover Card"
                                    style={{ border: 'none', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderRadius: '6px', padding: '6px', cursor: 'pointer', transition: '0.2s', marginLeft: '8px' }}
                                >
                                    🗑️
                                </button>
                            )}
                        </div>

                        {/* Corpo do Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Origem e Destino */}
                            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', opacity: 0.6 }}>ORIGEM</label>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9' }}>{cte.origem || cte.origem_cad || '---'}</div>
                                </div>
                                <div style={{ flex: 1.2 }}>
                                    <label style={{ fontSize: '9px', opacity: 0.6 }}>DESTINO</label>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#f1f5f9' }}>
                                        {cte.destino_cidade || cte.destino_cidade_cad || '---'}{' / '}{cte.destino_uf || cte.destino_uf_cad || '--'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label>MOTORISTA RESPONSÁVEL</label>
                                <input value={cte.motorista} readOnly />
                            </div>
                            <div>
                                <label>STATUS EMISSÃO</label>
                                <select
                                    value={cte.status}
                                    onChange={e => updateListCte(listaCtes, setListaAtual, realIndex, 'status', e.target.value, isRecife ? 'Recife' : 'Moreno')}
                                    disabled={!podeEditar('cte')}
                                    style={{ borderColor: cte.status === 'Emitido' ? '#22c55e' : 'rgba(255,255,255,0.1)' }}
                                >
                                    {OPCOES_STATUS_CTE.map(st => <option key={st}>{st}</option>)}
                                </select>
                            </div>

                            {/* Nº Liberação com botão Copiar */}
                            {cte.numero_liberacao && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1 }}>
                                        NÚM. LIB: <strong style={{ color: '#e2e8f0' }}>{cte.numero_liberacao}</strong>
                                    </span>
                                    {(() => {
                                        // Verificar expiração de 24h
                                        let expirado = false;
                                        const dtLib = cte.data_liberacao || cte.data_liberacao_cad;
                                        if (dtLib) {
                                            const dataStr = dtLib.endsWith('Z') ? dtLib : dtLib + 'Z';
                                            const diffMs = Date.now() - new Date(dataStr).getTime();
                                            if (diffMs > 24 * 60 * 60 * 1000) {
                                                expirado = true;
                                            }
                                        }

                                        if (expirado) {
                                            return (
                                                <button
                                                    disabled
                                                    style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', borderRadius: '4px', padding: '4px 8px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}
                                                    title="Liberação vencida (>24h). Solicite renovação."
                                                >
                                                    VENCIDA
                                                </button>
                                            );
                                        }

                                        return (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(cte.numero_liberacao);
                                                    setToastCopiaMsg('Número de liberação copiado!');
                                                    setTimeout(() => setToastCopiaMsg(''), 3000);
                                                }}
                                                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                                                title="Copiar número de liberação"
                                            >
                                                <Copy size={13} /> Copiar
                                            </button>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Rodapé do Card */}
                        <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    Início: <strong style={{ color: 'white' }}>{cte.timestamps?.inicio_emissao || '--:--'}</strong>
                                </span>
                            </div>
                            {cte.timestamps?.tempo_aguardando_emissao > 0 && (
                                <div style={{ marginTop: '6px', fontSize: '11px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ⏱️ Aguardou: <strong>{cte.timestamps.tempo_aguardando_emissao} min</strong>
                                </div>
                            )}
                            {cte.timestamps?.fim_emissao && (
                                <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>Fim: <strong style={{ color: 'white' }}>{cte.timestamps.fim_emissao}</strong></span>
                                    {cte.minutos_cte > 0 && (
                                        <span style={{ color: '#4ade80', fontWeight: '700' }}>⏱ {cte.minutos_cte} min</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
                })}
            </div>
        </section>
    );
}
