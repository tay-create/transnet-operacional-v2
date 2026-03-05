import React, { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import api from '../services/apiService';

export default function LogsAuditoria({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalLogs: 0,
        limit: 20
    });
    const [loading, setLoading] = useState(false);

    const carregarLogs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const response = await api.get(`/logs?page=${page}&limit=${pagination.limit}`);
            if (response.data.success) {
                setLogs(response.data.logs);
                setPagination(response.data.pagination);
            }
        } catch (error) {
            console.error('Erro ao carregar logs:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.limit]);

    useEffect(() => {
        if (isOpen) {
            carregarLogs(1);
        }
    }, [isOpen, carregarLogs]);

    const mudarPagina = (novaPagina) => {
        if (novaPagina >= 1 && novaPagina <= pagination.totalPages) {
            carregarLogs(novaPagina);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div
                className="glass-panel-internal"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '90%',
                    maxWidth: '1200px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={24} color="#60a5fa" />
                        <div>
                            <h2 className="title-neon-blue" style={{ margin: 0, fontSize: '20px' }}>
                                LOGS E AUDITORIA
                            </h2>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                                Total de {pagination.totalLogs} registros
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => carregarLogs(pagination.currentPage)}
                            className="btn-neon"
                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            disabled={loading}
                        >
                            <RefreshCw size={16} className={loading ? 'rotating' : ''} />
                            Atualizar
                        </button>
                        <button
                            onClick={onClose}
                            className="btn-close-header"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabela de Logs */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                    {loading ? (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            color: '#94a3b8'
                        }}>
                            <RefreshCw size={32} className="rotating" />
                            <span style={{ marginLeft: '12px' }}>Carregando logs...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            opacity: 0.5
                        }}>
                            <FileText size={48} color="#64748b" />
                            <p style={{ marginTop: '16px', color: '#94a3b8' }}>Nenhum log encontrado</p>
                        </div>
                    ) : (
                        <table style={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: '0 8px'
                        }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '2px solid rgba(59, 130, 246, 0.3)',
                                    color: '#60a5fa',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    letterSpacing: '0.5px'
                                }}>
                                    <th style={{ padding: '12px', textAlign: 'left', width: '80px' }}>ID</th>
                                    <th style={{ padding: '12px', textAlign: 'left', width: '180px' }}>DATA/HORA</th>
                                    <th style={{ padding: '12px', textAlign: 'left', width: '150px' }}>USUÁRIO</th>
                                    <th style={{ padding: '12px', textAlign: 'left', width: '200px' }}>AÇÃO</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>DETALHES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, idx) => (
                                    <tr
                                        key={log.id}
                                        style={{
                                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)'}
                                    >
                                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                                            #{log.id}
                                        </td>
                                        <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}>
                                            {log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '-'}
                                        </td>
                                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '13px', fontWeight: '600' }}>
                                            {log.usuario}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                background: log.acao === 'EXCLUSÃO' ? 'rgba(239, 68, 68, 0.2)' :
                                                           log.acao === 'CRIAÇÃO' ? 'rgba(34, 197, 94, 0.2)' :
                                                           log.acao === 'MUDANÇA DE STATUS' ? 'rgba(59, 130, 246, 0.2)' :
                                                           log.acao === 'EDIÇÃO' ? 'rgba(251, 146, 60, 0.2)' :
                                                           // CT-e relacionados
                                                           log.acao === 'FLUXO_CTE' ? 'rgba(168, 85, 247, 0.3)' :
                                                           log.acao === 'STATUS_CTE' ? 'rgba(168, 85, 247, 0.3)' :
                                                           log.acao === 'EMISSAO_CTE' ? 'rgba(168, 85, 247, 0.3)' :
                                                           log.acao === 'DADOS_FISCAIS_CTE' ? 'rgba(168, 85, 247, 0.3)' :
                                                           log.acao === 'ESTORNO_CTE' ? 'rgba(239, 68, 68, 0.3)' :
                                                           'rgba(168, 85, 247, 0.2)',
                                                color: log.acao === 'EXCLUSÃO' ? '#fca5a5' :
                                                       log.acao === 'CRIAÇÃO' ? '#4ade80' :
                                                       log.acao === 'MUDANÇA DE STATUS' ? '#60a5fa' :
                                                       log.acao === 'EDIÇÃO' ? '#fb923c' :
                                                       // CT-e relacionados
                                                       log.acao === 'FLUXO_CTE' ? '#e9d5ff' :
                                                       log.acao === 'STATUS_CTE' ? '#e9d5ff' :
                                                       log.acao === 'EMISSAO_CTE' ? '#d8b4fe' :
                                                       log.acao === 'DADOS_FISCAIS_CTE' ? '#e9d5ff' :
                                                       log.acao === 'ESTORNO_CTE' ? '#fca5a5' :
                                                       '#c084fc',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                // Adicionar efeito especial para CT-e
                                                ...(log.acao?.includes('CTE') && {
                                                    boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)',
                                                    border: '1px solid rgba(168, 85, 247, 0.5)'
                                                })
                                            }}>
                                                {log.acao?.includes('CTE') && '📋 '}
                                                {log.acao}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '12px' }}>
                                            {log.detalhes ? (
                                                <div style={{
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    lineHeight: '1.6'
                                                }}>
                                                    {log.detalhes.split(' | ').map((parte, idx) => (
                                                        <div key={idx} style={{
                                                            marginBottom: idx < log.detalhes.split(' | ').length - 1 ? '4px' : '0',
                                                            color: parte.includes('→') ? '#e2e8f0' : '#94a3b8'
                                                        }}>
                                                            {parte}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer com Paginação */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        Página {pagination.currentPage} de {pagination.totalPages}
                        <span style={{ marginLeft: '16px', color: '#64748b' }}>
                            ({logs.length} de {pagination.totalLogs} registros)
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => mudarPagina(pagination.currentPage - 1)}
                            disabled={pagination.currentPage === 1 || loading}
                            className="btn-neon"
                            style={{
                                padding: '8px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: pagination.currentPage === 1 ? 0.4 : 1,
                                cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <ChevronLeft size={16} />
                            Anterior
                        </button>

                        <button
                            onClick={() => mudarPagina(pagination.currentPage + 1)}
                            disabled={pagination.currentPage === pagination.totalPages || loading}
                            className="btn-neon"
                            style={{
                                padding: '8px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: pagination.currentPage === pagination.totalPages ? 0.4 : 1,
                                cursor: pagination.currentPage === pagination.totalPages ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Próxima
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .rotating {
                    animation: rotate 1s linear infinite;
                }
            `}</style>
        </div>
    );
}
