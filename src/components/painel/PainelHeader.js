import React from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { OPCOES_OPERACAO } from '../../constants';
import { ehOperacaoRecife, ehOperacaoMoreno } from '../../utils/operacaoUtils';

export default function PainelHeader({
    origem,
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    filtroOperacao, setFiltroOperacao,
    termoBusca, setTermoBusca,
    operacoesFixas,
    itensFiltrados,
    campoStatus,
    user,
    podeEditarNaUnidade,
    onAddContainer,
    onAbrirPausa,
}) {
    return (
        <div className="glass-panel-internal" style={{ padding: '15px 25px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                    <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        PAINEL <span style={{ color: '#3b82f6' }}>{origem.toUpperCase()}</span>
                        {podeEditarNaUnidade('operacao') && (
                            <button
                                onClick={onAddContainer}
                                title="Interditar Doca (Container Terceiro)"
                                className="btn-neon-red"
                                style={{
                                    marginLeft: '12px',
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <AlertTriangle size={14} /> CONTAINER
                            </button>
                        )}
                        {podeEditarNaUnidade('operacao') && (() => {
                            const veiculosAtivos = itensFiltrados.filter(v => {
                                const s = v[campoStatus];
                                return s && s !== 'AGUARDANDO' && s !== 'FINALIZADO';
                            });
                            const unidadeLower = origem.toLowerCase();
                            // Botão do header só reage a pausas com fonte='operacao'
                            const algumPausado = veiculosAtivos.some(v => {
                                const pausas = JSON.parse(v.pausas_status || '[]');
                                return pausas.some(p => p.unidade === unidadeLower && p.fonte === 'operacao' && p.fim === null);
                            });
                            if (veiculosAtivos.length === 0) return null;
                            return (
                                <button
                                    onClick={onAbrirPausa}
                                    title={algumPausado ? 'Retomar operações pausadas' : 'Pausar todas as operações ativas'}
                                    style={{
                                        marginLeft: '8px',
                                        padding: '4px 12px',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: algumPausado ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                                        border: `1px solid ${algumPausado ? 'rgba(34,197,94,0.4)' : 'rgba(251,191,36,0.4)'}`,
                                        color: algumPausado ? '#4ade80' : '#fbbf24',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '700'
                                    }}
                                >
                                    {algumPausado ? '▶ RETOMAR' : '⏸ PAUSAR'}
                                </button>
                            );
                        })()}
                        {/* Botão "✕ FINALIZAR" oculto: CRON-ROLLOVER às 22:30 já vira os cards
                            pendentes pro próximo dia (server.js cron '30 22 * * *'). Endpoint
                            POST /veiculos/finalizar-operacao continua disponível pra cenários
                            edge (encerrar antes do horário, dia atípico). */}
                    </h2>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                        <span className="badge-neon-pill" style={{ display: 'inline-block' }}>
                            {itensFiltrados.length} VEÍCULOS
                        </span>
                    </div>
                </div>

                {/* Filtro de Datas */}
                <div className="date-range-container">
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>DE:</span>
                    <input type="date" className="input-date-neon" value={dataInicio} onChange={e => { setDataInicio(e.target.value); localStorage.setItem('filtro_data_inicio_' + origem, e.target.value); }} />
                    <span style={{ fontSize: '10px', color: '#64748b' }}>➜</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>ATÉ:</span>
                    <input type="date" className="input-date-neon" value={dataFim} onChange={e => { setDataFim(e.target.value); localStorage.setItem('filtro_data_fim_' + origem, e.target.value); }} />
                </div>

                {/* Filtro de Operação */}
                <select
                    value={filtroOperacao}
                    onChange={e => setFiltroOperacao(e.target.value)}
                    style={{
                        background: filtroOperacao ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                        border: filtroOperacao ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: filtroOperacao ? '#60a5fa' : '#94a3b8',
                        fontSize: '11px', fontWeight: '600',
                        padding: '5px 26px 5px 10px',
                        minWidth: '150px', cursor: 'pointer',
                        outline: 'none', appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2394a3b8' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                    }}
                >
                    <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>Todas as operações</option>
                    {(operacoesFixas
                        ? operacoesFixas
                        : OPCOES_OPERACAO.filter(op =>
                            origem === 'Recife' ? ehOperacaoRecife(op) : ehOperacaoMoreno(op)
                        )
                    ).map(op => (
                        <option key={op} value={op} style={{ background: '#1e293b', color: '#e2e8f0' }}>{op}</option>
                    ))}
                </select>
            </div>

            {/* Campo de Busca */}
            <div style={{ position: 'relative', width: '250px' }}>
                <input
                    value={termoBusca}
                    onChange={e => setTermoBusca(e.target.value)}
                    placeholder="Buscar..."
                    className="input-internal"
                    style={{ paddingLeft: '35px', borderRadius: '20px' }}
                />
                <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
        </div>
    );
}
