import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Folder, FileText, ChevronRight, ChevronDown, RefreshCw, Search } from 'lucide-react';
import api from '../services/apiService';

function formatarDataHora(isoStr) {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
        return d.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return isoStr; }
}

function LocalEntrega({ destino_uf, destino_cidade }) {
    if (!destino_cidade && !destino_uf) return <span style={{ color: '#64748b' }}>—</span>;
    return <span>{[destino_cidade, destino_uf].filter(Boolean).join(' / ')}</span>;
}

function RegistroRow({ reg }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 110px 110px 1fr 90px',
            gap: '8px',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '11px',
            color: '#cbd5e1'
        }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>
                {formatarDataHora(reg.datetime_cte)}
            </span>
            <span style={{ fontWeight: '700', color: '#60a5fa' }}>
                {reg.num_coleta || '—'}
            </span>
            <span style={{ fontWeight: '700', color: '#c084fc' }}>
                {reg.num_liberacao || '—'}
            </span>
            <span>
                <span style={{ color: '#fb923c', marginRight: '4px' }}>{reg.origem || '—'}</span>
                {'→'}
                <span style={{ marginLeft: '4px' }}>
                    <LocalEntrega destino_uf={reg.destino_uf} destino_cidade={reg.destino_cidade} />
                </span>
            </span>
            <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                {reg.placa || '—'}
            </span>
        </div>
    );
}

function MotoristaPasta({ nome, primeiraLetra }) {
    const [aberta, setAberta] = useState(false);
    const [registros, setRegistros] = useState([]);
    const [carregando, setCarregando] = useState(false);

    async function abrir() {
        if (aberta) { setAberta(false); return; }
        setAberta(true);
        if (registros.length > 0) return;
        setCarregando(true);
        try {
            const r = await api.get('/api/historico-liberacoes', { params: { motorista: nome } });
            if (r.data.success) setRegistros(r.data.registros);
        } catch (e) {
            console.error('Erro ao carregar registros:', e);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div style={{ marginLeft: '16px' }}>
            <button
                onClick={abrir}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: aberta ? '#fbbf24' : '#94a3b8',
                    padding: '6px 8px', borderRadius: '6px', width: '100%', textAlign: 'left',
                    fontSize: '12px', fontWeight: '600',
                    transition: 'all 0.15s'
                }}
            >
                {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {aberta ? <FolderOpen size={16} style={{ color: '#fbbf24' }} /> : <Folder size={16} style={{ color: '#94a3b8' }} />}
                {nome}
            </button>

            {aberta && (
                <div style={{ marginLeft: '24px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {carregando && (
                        <div style={{ color: '#64748b', fontSize: '11px', padding: '8px' }}>Carregando...</div>
                    )}
                    {!carregando && registros.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '11px', padding: '8px' }}>Nenhum registro.</div>
                    )}
                    {!carregando && registros.length > 0 && (
                        <>
                            {/* Cabeçalho */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '140px 110px 110px 1fr 90px',
                                gap: '8px',
                                padding: '4px 12px',
                                fontSize: '9px', fontWeight: '700',
                                color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                <span>Data/Hora CT-e</span>
                                <span>Nº Coleta</span>
                                <span>Nº Liberação</span>
                                <span>Origem → Local Entrega</span>
                                <span>Placa</span>
                            </div>
                            {registros.map(reg => <RegistroRow key={reg.id} reg={reg} />)}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function LetraPasta({ letra, total_motoristas, total_liberacoes }) {
    const [aberta, setAberta] = useState(false);
    const [motoristas, setMotoristas] = useState([]);
    const [carregando, setCarregando] = useState(false);

    async function abrir() {
        if (aberta) { setAberta(false); return; }
        setAberta(true);
        if (motoristas.length > 0) return;
        setCarregando(true);
        try {
            const r = await api.get('/api/historico-liberacoes', { params: { letra } });
            if (r.data.success) setMotoristas(r.data.motoristas);
        } catch (e) {
            console.error('Erro ao carregar motoristas:', e);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            overflow: 'hidden'
        }}>
            <button
                onClick={abrir}
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: aberta ? 'rgba(59,130,246,0.1)' : 'none',
                    border: 'none', cursor: 'pointer',
                    color: aberta ? '#60a5fa' : '#e2e8f0',
                    padding: '10px 16px', width: '100%', textAlign: 'left',
                    fontSize: '14px', fontWeight: '700',
                    transition: 'all 0.15s'
                }}
            >
                {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '32px', height: '32px', borderRadius: '6px',
                    background: aberta ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)',
                    fontSize: '16px', fontWeight: '900', color: aberta ? '#60a5fa' : '#94a3b8'
                }}>
                    {letra}
                </span>
                <span style={{ flex: 1 }}>{letra}</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>
                    {total_motoristas} motorista{total_motoristas !== 1 ? 's' : ''} · {total_liberacoes} liberaç{total_liberacoes !== 1 ? 'ões' : 'ão'}
                </span>
            </button>

            {aberta && (
                <div style={{ padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {carregando && (
                        <div style={{ color: '#64748b', fontSize: '11px', padding: '8px 16px' }}>Carregando...</div>
                    )}
                    {!carregando && motoristas.map(nome => (
                        <MotoristaPasta key={nome} nome={nome} primeiraLetra={letra} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function HistoricoLiberacoes() {
    const [letras, setLetras] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState('');

    const carregarLetras = useCallback(async () => {
        setCarregando(true);
        try {
            const r = await api.get('/api/historico-liberacoes');
            if (r.data.success) setLetras(r.data.letras);
        } catch (e) {
            console.error('Erro ao carregar histórico:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { carregarLetras(); }, [carregarLetras]);

    const letrasFiltradas = busca.trim()
        ? letras.filter(l => l.primeira_letra.includes(busca.trim().toUpperCase()))
        : letras;

    return (
        <div style={{ padding: '20px 25px', height: 'calc(100vh - 124px)', overflowY: 'auto' }}>
            {/* Header */}
            <div className="glass-panel-internal" style={{
                padding: '15px 25px', marginBottom: '20px',
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
            }}>
                <div>
                    <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', marginBottom: '4px' }}>
                        <FileText size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        HISTÓRICO DE LIBERAÇÕES <span style={{ color: '#fb923c' }}>/ GR</span>
                    </h2>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Registro de liberações utilizadas — organizadas por motorista
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            className="input-internal"
                            style={{ paddingLeft: '28px', fontSize: '12px', width: '120px' }}
                            placeholder="Filtrar letra..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            maxLength={1}
                        />
                    </div>
                    <button
                        onClick={carregarLetras}
                        disabled={carregando}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8', borderRadius: '8px', padding: '8px 14px',
                            cursor: carregando ? 'default' : 'pointer', fontSize: '12px',
                            opacity: carregando ? 0.6 : 1
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Árvore de pastas */}
            {carregando && letras.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                    <RefreshCw size={32} style={{ opacity: 0.4, marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
                    <p>Carregando histórico...</p>
                </div>
            ) : letrasFiltradas.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                    <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p>Nenhum histórico de liberação registrado.</p>
                    <p style={{ fontSize: '11px' }}>Os registros são salvos automaticamente ao emitir o CT-e.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {letrasFiltradas.map(l => (
                        <LetraPasta
                            key={l.primeira_letra}
                            letra={l.primeira_letra}
                            total_motoristas={l.total_motoristas}
                            total_liberacoes={l.total_liberacoes}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
