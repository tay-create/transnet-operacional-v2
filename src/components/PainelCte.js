import React, { useEffect, useState } from 'react';
import { Copy, ChevronRight, Loader, Trash2 } from 'lucide-react';
import { OPCOES_STATUS_CTE } from '../constants';
import api from '../services/apiService';
import { parseColetaMoreno } from '../utils/coletaMoreno';

const COR_STATUS_CTE = {
    'Aguardando Emissão': { border: '#f59e0b', text: '#fcd34d', bg: 'rgba(245,158,11,0.15)' },
    'Em Emissão':         { border: '#3b82f6', text: '#93c5fd', bg: 'rgba(59,130,246,0.15)' },
    'Emitido':            { border: '#22c55e', text: '#86efac', bg: 'rgba(34,197,94,0.15)'  },
};

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
    carregarCtes,
    updateListCte,
    podeEditar,
    setToastCopiaMsg,
    socket
}) {
    // Rebuscar do backend quando as datas mudam
    useEffect(() => {
        if (carregarCtes) carregarCtes(filtroDataInicioCte, filtroDataFimCte);
    }, [filtroDataInicioCte, filtroDataFimCte]); // eslint-disable-line

    // Atualizar origem/destino em tempo real quando PainelCadastro salvar
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo !== 'atualiza_cte') return;
            if (!data.id) return;
            const atualizarLista = (prev) => prev.map(c =>
                c.id === data.id ? {
                    ...c,
                    numero_liberacao: data.numero_liberacao ?? c.numero_liberacao,
                    data_liberacao: data.data_liberacao ?? c.data_liberacao,
                    origem_cad: data.origem_cad ?? c.origem_cad,
                    destino_uf_cad: data.destino_uf_cad ?? c.destino_uf_cad,
                    destino_cidade_cad: data.destino_cidade_cad ?? c.destino_cidade_cad,
                } : c
            );
            setCtesRecife(atualizarLista);
            setCtesMoreno(atualizarLista);
        };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, setCtesRecife, setCtesMoreno]);
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

        if (!(dataComparacao >= filtroDataInicioCte && dataComparacao <= filtroDataFimCte)) return false;

        // A separação por unidade já é feita no App.js (ctesRecife / ctesMoreno por origem)
        // Não filtrar por unidade_emissao aqui — um CT-e de Moreno pode ser aceito por Recife

        return true;
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
                    <CardCte
                        key={cte.id ?? realIndex}
                        cte={cte}
                        realIndex={realIndex}
                        listaCtes={listaCtes}
                        setListaAtual={setListaAtual}
                        corTema={corTema}
                        bgBadge={bgBadge}
                        isRecife={isRecife}
                        podeEditar={podeEditar}
                        updateListCte={updateListCte}
                        setToastCopiaMsg={setToastCopiaMsg}
                    />
                    );
                })}
            </div>
        </section>
    );
}

function CardCte({ cte, realIndex, listaCtes, setListaAtual, corTema, bgBadge, isRecife, podeEditar, updateListCte, setToastCopiaMsg }) {
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const idxAtual = OPCOES_STATUS_CTE.indexOf(cte.status);
    const proximoStatus = OPCOES_STATUS_CTE[idxAtual + 1] || null;
    const corAtual = COR_STATUS_CTE[cte.status] || { border: '#64748b', text: '#94a3b8', bg: 'rgba(100,116,139,0.15)' };
    const corProximo = proximoStatus ? COR_STATUS_CTE[proximoStatus] : null;

    const avancarStatus = async () => {
        if (!proximoStatus || salvando) return;
        setSalvando(true);
        setErro('');
        try {
            await updateListCte(listaCtes, setListaAtual, realIndex, 'status', proximoStatus, isRecife ? 'Recife' : 'Moreno');
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao atualizar status.');
        } finally {
            setSalvando(false);
        }
    };

    return (
                    <div className="card-cte-glass" style={{ borderLeft: `4px solid ${corTema}` }}>
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
                                {cte.coletaMoreno && cte.coletaMoreno.trim() && (() => {
                                    const { plastico, porcelana, eletrik } = parseColetaMoreno(cte.coletaMoreno, cte.operacao);
                                    const grupos = [
                                        { key: 'plas', valor: plastico, label: 'PLAS', badgeBg: 'rgba(148,163,184,0.22)', badgeText: '#cbd5e1', badgeBorder: 'rgba(148,163,184,0.45)', tagBg: 'rgba(148,163,184,0.15)', tagText: '#e2e8f0', tagBorder: 'rgba(148,163,184,0.5)' },
                                        { key: 'porc', valor: porcelana, label: 'PORC', badgeBg: 'rgba(168,85,247,0.2)', badgeText: '#c084fc', badgeBorder: 'rgba(168,85,247,0.4)', tagBg: 'rgba(168,85,247,0.15)', tagText: '#d8b4fe', tagBorder: 'rgba(168,85,247,0.5)' },
                                        { key: 'elet', valor: eletrik, label: 'ELET', badgeBg: 'rgba(6,182,212,0.2)', badgeText: '#22d3ee', badgeBorder: 'rgba(6,182,212,0.4)', tagBg: 'rgba(6,182,212,0.15)', tagText: '#67e8f9', tagBorder: 'rgba(6,182,212,0.5)' },
                                    ].filter(g => g.valor && g.valor.trim());
                                    const qtdPreenchidos = grupos.length;
                                    if (qtdPreenchidos >= 2) {
                                        return (
                                            <div style={{ marginBottom: '4px' }}>
                                                <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase' }}>Moreno</span>
                                                {grupos.map(g => (
                                                    <div key={g.key} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                                                        <span style={{ fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', background: g.badgeBg, color: g.badgeText, border: `1px solid ${g.badgeBorder}` }}>{g.label}</span>
                                                        {g.valor.split(',').map((doc, di) => (
                                                            <span key={`${g.key}-${di}`} className="doc-badge" style={{ background: g.tagBg, color: g.tagText, border: `1px solid ${g.tagBorder}` }}>{doc.trim()}</span>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    const cruas = (plastico || porcelana || eletrik || cte.coletaMoreno).toString();
                                    return (
                                        <div style={{ marginBottom: '4px' }}>
                                            <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase' }}>Moreno</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                                {cruas.split(',').map((doc, di) => (
                                                    <span key={`m-${di}`} className="doc-badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid #f59e0b' }}>
                                                        {doc.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
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
                                    onClick={async () => {
                                        if (!cte.id) return;
                                        try { await api.delete(`/ctes/${cte.id}`); } catch {}
                                        setListaAtual(prev => prev.filter(c => c.id !== cte.id));
                                    }}
                                    title="Remover Card"
                                    style={{ border: 'none', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', marginLeft: '8px', display: 'flex', alignItems: 'center' }}
                                >
                                    <Trash2 size={14} />
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

                            {/* Status atual como badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>STATUS</label>
                                <span style={{
                                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                    color: corAtual.text, background: corAtual.bg, border: `1px solid ${corAtual.border}`,
                                }}>
                                    {cte.status}
                                </span>
                            </div>

                            {/* Botão avançar status */}
                            {podeEditar('cte') && proximoStatus && (
                                <button
                                    onClick={avancarStatus}
                                    disabled={salvando}
                                    style={{
                                        width: '100%', padding: '11px',
                                        borderRadius: '10px', border: 'none',
                                        background: salvando ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${corProximo.border}, ${corProximo.border}99)`,
                                        color: 'white', fontSize: '13px', fontWeight: '700',
                                        cursor: salvando ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        boxShadow: salvando ? 'none' : `0 4px 14px ${corProximo.border}44`,
                                    }}
                                >
                                    {salvando
                                        ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                                        : <><ChevronRight size={14} /> {proximoStatus}</>
                                    }
                                </button>
                            )}

                            {erro && (
                                <div style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '6px 10px' }}>
                                    {erro}
                                </div>
                            )}

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
                                                    const texto = String(cte.numero_liberacao || '').trim();
                                                    if (!texto) return;
                                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                                        navigator.clipboard.writeText(texto).catch(() => {
                                                            // Fallback para execCommand
                                                            const ta = document.createElement('textarea');
                                                            ta.value = texto;
                                                            ta.style.position = 'fixed';
                                                            ta.style.opacity = '0';
                                                            document.body.appendChild(ta);
                                                            ta.select();
                                                            document.execCommand('copy');
                                                            document.body.removeChild(ta);
                                                        });
                                                    } else {
                                                        const ta = document.createElement('textarea');
                                                        ta.value = texto;
                                                        ta.style.position = 'fixed';
                                                        ta.style.opacity = '0';
                                                        document.body.appendChild(ta);
                                                        ta.select();
                                                        document.execCommand('copy');
                                                        document.body.removeChild(ta);
                                                    }
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
                                    Aguardou: <strong>{cte.timestamps.tempo_aguardando_emissao} min</strong>
                                </div>
                            )}
                            {cte.timestamps?.fim_emissao && (
                                <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94a3b8' }}>Fim: <strong style={{ color: 'white' }}>{cte.timestamps.fim_emissao}</strong></span>
                                    {cte.minutos_cte > 0 && (
                                        <span style={{ color: '#4ade80', fontWeight: '700' }}>{cte.minutos_cte} min</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
    );
}
