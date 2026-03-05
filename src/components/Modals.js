import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    X, Clock, BarChart3, Search, FileDown,
    ClipboardList, GripVertical, Plus, Trash2,
    CheckCircle,
    PieChart, TrendingUp, TrendingDown
} from 'lucide-react';

// --- MODAL DE TEMPOS (OPERAÇÃO) ---
export const ModalTempos = ({ item, onClose, atualizarTempo, isOpen }) => {
    if (!isOpen || !item || !item.lista) return null;

    const campoAlvo = item.origem === 'Recife' ? 'tempos_recife' : 'tempos_moreno';
    const veiculo = item.lista[item.index];
    if (!veiculo) return null;

    const temposAtuais = veiculo[campoAlvo] || {};

    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: '500px', maxWidth: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <h3 style={{ color: '#38bdf8', margin: 0, textShadow: '0 0 10px rgba(56,189,248,0.5)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={20} /> Tempos - {item.origem?.toUpperCase()}
                    </h3>
                    <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="input-group">
                        <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>INÍCIO SEPARAÇÃO</label>
                        <input type="time" value={temposAtuais.inicio_separacao || ''} onChange={e => atualizarTempo('inicio_separacao', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>FIM SEPARAÇÃO</label>
                        <input type="time" value={temposAtuais.fim_separacao || ''} onChange={e => atualizarTempo('fim_separacao', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>INÍCIO CARREGAMENTO</label>
                        <input type="time" value={temposAtuais.inicio_carregamento || ''} onChange={e => atualizarTempo('inicio_carregamento', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>FIM CARREGAMENTO</label>
                        <input type="time" value={temposAtuais.fim_carregamento || ''} onChange={e => atualizarTempo('fim_carregamento', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>CARREGADO ÀS (auto)</label>
                        <input type="time" value={temposAtuais.t_inicio_carregado || ''} onChange={e => atualizarTempo('t_inicio_carregado', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>LIBERADO P/ CT-e (auto)</label>
                        <input type="time" value={temposAtuais.t_fim_liberado_cte || ''} onChange={e => atualizarTempo('t_fim_liberado_cte', e.target.value)} />
                    </div>
                </div>
                <button onClick={onClose} className="btn-neon" style={{ marginTop: '25px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={18} /> SALVAR E FECHAR
                </button>
            </div>
        </div>
    );
};

// --- MODAL DE RELATÓRIO OPERACIONAL ---
export const ModalRelatorio = ({
    isOpen, onClose, dados, filtros, setFiltros, buscar, baixarPDF
}) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: '90%', height: '85vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BarChart3 size={24} color="#38bdf8" /> Relatório Operacional
                        <span style={{ fontSize: '12px', background: '#38bdf8', padding: '2px 8px', borderRadius: '10px', color: '#0f172a', fontWeight: 'bold' }}>
                            {dados.length} registros
                        </span>
                    </h2>
                    <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                </div>

                {/* Filtros */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>DATA INICIAL</label>
                        <input type="date" value={filtros.inicio} onChange={e => setFiltros({ ...filtros, inicio: e.target.value })} />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>DATA FINAL</label>
                        <input type="date" value={filtros.fim} onChange={e => setFiltros({ ...filtros, fim: e.target.value })} />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ fontSize: '10px', color: '#94a3b8' }}>ORIGEM</label>
                        <select value={filtros.origem} onChange={e => setFiltros({ ...filtros, origem: e.target.value })}>
                            <option value="Todas">Todas Unidades</option>
                            <option value="Recife">Recife</option>
                            <option value="Moreno">Moreno</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button onClick={buscar} className="btn-neon" style={{ height: '42px', padding: '0 25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={16} /> Buscar
                        </button>
                    </div>
                </div>

                {/* Tabela com Scroll */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    <table>
                        <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                            <tr>
                                <th>DATA</th>
                                <th>COLETA</th>
                                <th>MOTORISTA</th>
                                <th>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        Nenhum dado encontrado para o período.
                                    </td>
                                </tr>
                            ) : (
                                dados.map((reg, i) => (
                                    <tr key={i}>
                                        <td>{reg.data_registro}</td>
                                        <td>{reg.coleta}</td>
                                        <td>{reg.motorista}</td>
                                        <td style={{ fontWeight: 'bold', color: '#38bdf8' }}>{reg.duracao_total}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <button onClick={baixarPDF} className="btn-neon" style={{ background: '#10b981', marginTop: '20px', width: '100%', borderColor: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <FileDown size={18} /> BAIXAR PDF
                </button>
            </div>
        </div>
    );
};

// --- MODAL DE FILA ---
export const ModalFila = ({ isOpen, onClose, fila, setFila, onDragSort, updateList, onAdd, onRemove, onPromote }) => {
    const dragItem = React.useRef(null);
    const dragOverItem = React.useRef(null);

    const handleDragStart = (index) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;

        const _fila = [...fila];
        const draggedItemContent = _fila.splice(dragItem.current, 1)[0];
        _fila.splice(dragOverItem.current, 0, draggedItemContent);

        dragItem.current = null;
        dragOverItem.current = null;

        onDragSort(_fila);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: '550px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ClipboardList size={20} /> Ordem de Separação
                    </h3>
                    <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {fila.length === 0 && <p style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '20px' }}>Fila vazia.</p>}

                    {fila.map((item, index) => (
                        <div
                            key={index}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            style={{
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'center',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'grab',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }} title="Arraste para organizar">
                                <GripVertical size={20} />
                            </span>
                            <input
                                placeholder="Coleta"
                                value={item.coleta || ''}
                                onChange={e => updateList(index, 'coleta', e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    color: 'white',
                                    fontSize: '13px'
                                }}
                            />
                            <input
                                placeholder="Motorista"
                                value={item.motorista || ''}
                                onChange={e => updateList(index, 'motorista', e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    color: 'white',
                                    fontSize: '13px'
                                }}
                            />
                            <button
                                onClick={() => onPromote(item)}
                                title="Lançar para Operação"
                                style={{
                                    color: '#34d399',
                                    border: 'none',
                                    background: 'rgba(52, 211, 153, 0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(52, 211, 153, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(52, 211, 153, 0.1)'}
                            >
                                <TrendingUp size={18} />
                            </button>
                            <button
                                onClick={() => item.id ? onRemove(item.id) : setFila(fila.filter((_, i) => i !== index))}
                                style={{
                                    color: '#ef4444',
                                    border: 'none',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={() => onAdd({ coleta: '', motorista: '' })} className="btn-neon" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> ADICIONAR
                    </button>
                </div>
            </div>
        </div>
    );
};



// ── Helpers de tempo para efetividade ────────────────────────────────────────
function calcMinCte(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const p = hhmm.split(':');
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}
function fmtMinCte(min) {
    if (min === null || min === undefined || min < 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}
function pctCte(v, total) {
    if (!total) return 0;
    return Math.min(100, Math.round(v / total * 100));
}
const INICIO_JORNADA_CTE = 7 * 60 + 30;
const FIM_ALMOCO_CTE = 13 * 60;

function calcularEfetividadeUnidade(listaCtes) {
    const emitidosComFim = listaCtes.filter(c => c.status === 'Emitido' && c.t_fim_liberado_cte);
    if (emitidosComFim.length === 0) return null;
    const ultimoFim = Math.max(...emitidosComFim.map(c => calcMinCte(c.t_fim_liberado_cte) || 0));
    let expediente = ultimoFim - INICIO_JORNADA_CTE;
    if (ultimoFim > FIM_ALMOCO_CTE) expediente -= 60;
    if (expediente <= 0) return null;
    const trabalhados = listaCtes.reduce((acc, c) => acc + (c.minutos_cte || 0), 0);
    const ociosos = Math.max(0, expediente - trabalhados);
    const efetPct = pctCte(trabalhados, expediente);
    const ultimoCte = emitidosComFim.reduce((latest, c) =>
        calcMinCte(c.t_fim_liberado_cte) > calcMinCte(latest.t_fim_liberado_cte) ? c : latest
    );
    return { expediente, trabalhados, ociosos, efetPct, ultimoHorario: ultimoCte.t_fim_liberado_cte, totalCards: listaCtes.length, cardsComTempo: listaCtes.filter(c => c.minutos_cte).length };
}

// ── Card de efetividade por unidade ──────────────────────────────────────────
function CardEfetividade({ titulo, cor, dados }) {
    if (!dados) {
        return (
            <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: cor, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChart size={15} /> {titulo}
                </div>
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#475569', fontSize: '13px' }}>
                    Nenhum CT-e emitido com tempo registrado hoje.
                </div>
            </div>
        );
    }
    const { expediente, trabalhados, ociosos, efetPct, ultimoHorario, totalCards, cardsComTempo } = dados;
    return (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${cor}33`, borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: cor, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={15} /> {titulo}
            </div>
            {/* Barra de efetividade */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Efetividade</span>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: efetPct >= 70 ? '#4ade80' : efetPct >= 40 ? '#fbbf24' : '#f87171' }}>{efetPct}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${efetPct}%`, background: efetPct >= 70 ? '#4ade80' : efetPct >= 40 ? '#fbbf24' : '#f87171', borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={10} /> TRABALHADO
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#4ade80' }}>{fmtMinCte(trabalhados)}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{cardsComTempo}/{totalCards} cards</div>
                </div>
                <div style={{ background: ociosos > 30 ? 'rgba(239,68,68,0.08)' : 'rgba(71,85,105,0.12)', border: `1px solid ${ociosos > 30 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingDown size={10} /> OCIOSO
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: ociosos > 30 ? '#f87171' : '#94a3b8' }}>{fmtMinCte(ociosos)}</div>
                    {ociosos > 30 && <div style={{ fontSize: '10px', color: '#f87171', marginTop: '2px', fontWeight: '700' }}>⚠ Atenção</div>}
                </div>
                <div style={{ background: `${cor}10`, border: `1px solid ${cor}30`, borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>EXPEDIENTE</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: cor }}>{fmtMinCte(expediente)}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>→ {ultimoHorario}</div>
                </div>
            </div>
        </div>
    );
}

// ── Gerador de PDF Performance CT-e ──────────────────────────────────────────
function gerarPDFPerformanceCte({ listaRec, listaMor, dadosRec, dadosMor, filtroData }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const mL = 14, mR = 196;
    let y = 14;

    const dataLabel = filtroData
        ? new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR');
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });

    // ── Cabeçalho ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(252, 211, 77);
    doc.text('PERFORMANCE CT-e', mL, y + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Data: ${dataLabel}   |   Gerado em: ${geradoEm}`, mL, y + 10);
    y = 36;

    // ── Resumo Geral ──
    const totalTrab = (dadosRec?.trabalhados || 0) + (dadosMor?.trabalhados || 0);
    const totalExp = (dadosRec?.expediente || 0) + (dadosMor?.expediente || 0);
    const totalOc = (dadosRec?.ociosos || 0) + (dadosMor?.ociosos || 0);
    const efetGeral = totalExp > 0 ? Math.min(100, Math.round(totalTrab / totalExp * 100)) : 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text('RESUMO GERAL', mL, y);
    y += 5;

    const corEfet = efetGeral >= 70 ? [34, 197, 94] : efetGeral >= 40 ? [234, 179, 8] : [239, 68, 68];
    autoTable(doc, {
        startY: y,
        margin: { left: mL, right: 14 },
        head: [['EFETIVIDADE GERAL', 'TOTAL TRABALHADO', 'TOTAL OCIOSO', 'CT-es no período']],
        body: [[
            { content: `${efetGeral}%`, styles: { textColor: corEfet, fontStyle: 'bold', fontSize: 13 } },
            { content: fmtMinCte(totalTrab), styles: { textColor: [34, 197, 94], fontStyle: 'bold', fontSize: 13 } },
            { content: fmtMinCte(totalOc), styles: { textColor: totalOc > 60 ? [239, 68, 68] : [100, 116, 139], fontStyle: 'bold', fontSize: 13 } },
            { content: String(listaRec.length + listaMor.length), styles: { fontStyle: 'bold', fontSize: 13 } },
        ]],
        styles: { halign: 'center', fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 9 },
        theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Detalhamento por unidade ──
    const renderUnidade = (titulo, cor, dados, lista) => {
        if (y > 240) { doc.addPage(); y = 14; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(cor[0], cor[1], cor[2]);
        doc.text(`\u258c ${titulo}`, mL, y);
        y += 5;

        if (!dados) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Nenhum CT-e emitido com tempo registrado.', mL + 4, y);
            y += 8;
            return;
        }

        const { expediente, trabalhados, ociosos, efetPct, ultimoHorario, totalCards, cardsComTempo } = dados;
        const corEf = efetPct >= 70 ? [34, 197, 94] : efetPct >= 40 ? [234, 179, 8] : [239, 68, 68];
        autoTable(doc, {
            startY: y,
            margin: { left: mL, right: 14 },
            head: [['EFETIVIDADE', 'TRABALHADO', 'OCIOSO', 'EXPEDIENTE', 'ÚLTIMO CT-e', 'CARDS']],
            body: [[
                { content: `${efetPct}%`, styles: { textColor: corEf, fontStyle: 'bold' } },
                { content: fmtMinCte(trabalhados), styles: { textColor: [34, 197, 94], fontStyle: 'bold' } },
                { content: fmtMinCte(ociosos), styles: { textColor: ociosos > 30 ? [239, 68, 68] : [100, 116, 139] } },
                { content: fmtMinCte(expediente), styles: { textColor: cor } },
                ultimoHorario || '—',
                `${cardsComTempo}/${totalCards}`,
            ]],
            styles: { halign: 'center', fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [15, 23, 42], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 8 },
            theme: 'grid',
        });
        y = doc.lastAutoTable.finalY + 5;

        // Tabela individual de CT-es
        if (lista.length > 0) {
            if (y > 230) { doc.addPage(); y = 14; }
            const rows = lista.map(c => [
                c.motorista || '—',
                c.coleta || c.coletaRecife || c.coletaMoreno || '—',
                c.status || '—',
                c.t_fim_liberado_cte || '—',
                c.minutos_cte != null ? fmtMinCte(c.minutos_cte) : '—',
                c.timestamps?.inicio_emissao || '—',
                c.timestamps?.fim_emissao || '—',
            ]);
            autoTable(doc, {
                startY: y,
                margin: { left: mL, right: 14 },
                head: [['Motorista', 'Coleta', 'Status', 'Lib. CT-e', 'Tempo', 'Início Emissão', 'Fim Emissão']],
                body: rows,
                styles: { fontSize: 7.5, cellPadding: 2 },
                headStyles: { fillColor: cor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 2) {
                        const st = data.cell.raw;
                        if (st === 'Emitido') data.cell.styles.textColor = [34, 197, 94];
                        else if (st === 'Em Emissão') data.cell.styles.textColor = [234, 179, 8];
                        else data.cell.styles.textColor = [148, 163, 184];
                    }
                },
                theme: 'striped',
            });
            y = doc.lastAutoTable.finalY + 10;
        }
    };

    renderUnidade('RECIFE', [59, 130, 246], dadosRec, listaRec);
    renderUnidade('MORENO', [245, 158, 11], dadosMor, listaMor);

    // ── Rodapé em todas as páginas ──
    const totalPags = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPags; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Transnet Logística — Performance CT-e — ${dataLabel}`, mL, 290);
        doc.text(`Pág. ${i}/${totalPags}`, mR, 290, { align: 'right' });
    }

    doc.save(`performance-cte-${filtroData || new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Modal Performance CT-e ────────────────────────────────────────────────────
export const ModalRelatorioCte = ({ isOpen, onClose, ctesRecife, ctesMoreno }) => {
    const [filtroData, setFiltroData] = useState('');

    if (!isOpen) return null;

    // Filtrar por data se informada (campo data_prevista no ct-e ou hoje por padrão)
    const filtrar = (lista) => {
        if (!filtroData) return lista;
        return lista.filter(c => c.data_prevista === filtroData || c.data_registro === filtroData);
    };

    const listaRec = filtrar(ctesRecife || []);
    const listaMor = filtrar(ctesMoreno || []);

    const dadosRec = calcularEfetividadeUnidade(listaRec);
    const dadosMor = calcularEfetividadeUnidade(listaMor);

    const totalTrabalhado = (dadosRec?.trabalhados || 0) + (dadosMor?.trabalhados || 0);
    const totalExpediente = (dadosRec?.expediente || 0) + (dadosMor?.expediente || 0);
    const totalOciosos = (dadosRec?.ociosos || 0) + (dadosMor?.ociosos || 0);
    const efetGeral = pctCte(totalTrabalhado, totalExpediente);

    return (
        <div className="modal-overlay">
            <div className="modal-neon-panel" style={{ width: 'min(95%, 820px)', maxHeight: '90vh', overflowY: 'auto' }}>
                {/* Cabeçalho */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                    <h3 style={{ margin: 0, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '10px', textShadow: '0 0 10px rgba(252,211,77,0.3)' }}>
                        <PieChart size={20} /> Performance CT-e
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => gerarPDFPerformanceCte({ listaRec, listaMor, dadosRec, dadosMor, filtroData })}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                                background: 'rgba(252,211,77,0.12)', border: '1px solid rgba(252,211,77,0.3)',
                                color: '#fcd34d', fontSize: '12px', fontWeight: '700'
                            }}
                            title="Exportar PDF"
                        >
                            <FileDown size={14} /> PDF
                        </button>
                        <button onClick={onClose} className="btn-close-header"><X size={18} /></button>
                    </div>
                </div>

                {/* Filtro de data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Data</label>
                    <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#f1f5f9', fontSize: '13px', outline: 'none' }} />
                    {filtroData && (
                        <button onClick={() => setFiltroData('')}
                            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>
                            Limpar
                        </button>
                    )}
                    <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>
                        {listaRec.length + listaMor.length} CT-es no período
                    </span>
                </div>

                {/* Resumo geral (só mostra se houver dados) */}
                {totalExpediente > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(252,211,77,0.07)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '6px' }}>EFETIVIDADE GERAL</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: efetGeral >= 70 ? '#4ade80' : efetGeral >= 40 ? '#fbbf24' : '#f87171' }}>{efetGeral}%</div>
                        </div>
                        <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '6px' }}>TOTAL TRABALHADO</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4ade80' }}>{fmtMinCte(totalTrabalhado)}</div>
                        </div>
                        <div style={{ background: totalOciosos > 60 ? 'rgba(239,68,68,0.07)' : 'rgba(71,85,105,0.12)', border: `1px solid ${totalOciosos > 60 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', marginBottom: '6px' }}>TOTAL OCIOSO</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: totalOciosos > 60 ? '#f87171' : '#94a3b8' }}>{fmtMinCte(totalOciosos)}</div>
                        </div>
                    </div>
                )}

                {/* Cards por unidade */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <CardEfetividade titulo="Recife" cor="#3b82f6" dados={dadosRec} />
                    <CardEfetividade titulo="Moreno" cor="#f59e0b" dados={dadosMor} />
                </div>

                <button onClick={onClose} className="btn-ghost" style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                    <X size={14} /> Fechar
                </button>
            </div>
        </div>
    );
};