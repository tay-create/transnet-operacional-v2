import React from 'react';

// Array local — não importar de constants para manter o componente autocontido
const OPERACOES_REL = ['Delta', 'Porcelana', 'Eletrik', 'Consolidados'];

const isNovoFormato = (dados) =>
    Object.values(dados).some(d => d.reprogramado_recife !== undefined);

const formatData = (dStr) => {
    if (!dStr) return '';
    const [a, m, d] = dStr.split('-');
    return `${d}/${m}/${a}`;
};

const estiloTabela = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    marginTop: '8px',
};

const estiloTh = {
    padding: '8px 12px',
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
};

const estiloThLeft = { ...estiloTh, textAlign: 'left' };

const estiloTd = {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    textAlign: 'center',
};

const estiloTdLeft = { ...estiloTd, textAlign: 'left' };

const renderSplitPrint = (recife, moreno, corRecife = '#0369a1', corMoreno = '#b45309') => {
    if (recife === 0 && moreno === 0) return '—';
    if (recife === 0) return <span style={{ color: corMoreno }}>Moreno: {moreno}</span>;
    if (moreno === 0) return <span style={{ color: corRecife }}>Recife: {recife}</span>;
    return (
        <span>
            <span style={{ color: corRecife }}>Recife: {recife}</span>
            <span style={{ color: '#94a3b8', margin: '0 3px' }}>/</span>
            <span style={{ color: corMoreno }}>Moreno: {moreno}</span>
        </span>
    );
};

export default function RelatorioImpressao({ programacoes, dataInicio, dataFim }) {
    const agora = new Date();
    const geradoEm = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // Calcular resumo executivo
    let resumoLancadosR = 0, resumoLancadosM = 0;
    let resumoReproR = 0, resumoReproM = 0;
    let resumoLancadosLegado = 0, resumoReproLegado = 0;
    let temLegado = false, temNovo = false;

    programacoes.forEach(prog => {
        const dados = prog.dados_json || {};
        const novoFmt = isNovoFormato(dados);
        if (novoFmt) temNovo = true; else temLegado = true;

        OPERACOES_REL.forEach(op => {
            const d = dados[op] || {};
            if (novoFmt) {
                resumoLancadosR += d.recife || 0;
                resumoLancadosM += d.moreno || 0;
                resumoReproR += d.reprogramado_recife || 0;
                resumoReproM += d.reprogramado_moreno || 0;
            } else {
                resumoLancadosLegado += (d.recife || 0) + (d.moreno || 0);
                resumoReproLegado += d.reprogramado || 0;
            }
        });
    });

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', background: '#ffffff', padding: '20px 28px', fontSize: '13px' }}>

            {/* Cabeçalho */}
            <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
                <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Programação Diária de Carregamento
                </h1>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                    <span>
                        Período: <strong style={{ color: '#1e293b' }}>{formatData(dataInicio)}</strong>
                        {dataInicio !== dataFim && <> a <strong style={{ color: '#1e293b' }}>{formatData(dataFim)}</strong></>}
                    </span>
                    <span>Gerado em: <strong style={{ color: '#1e293b' }}>{geradoEm}</strong></span>
                </div>
            </div>

            {/* Resumo Executivo */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                    Resumo Executivo
                </h2>
                {temNovo && (
                    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Total Lançados </span>
                            <span style={{ color: '#0369a1', fontWeight: '700' }}>Recife: {resumoLancadosR}</span>
                            <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#b45309', fontWeight: '700' }}>Moreno: {resumoLancadosM}</span>
                            <span style={{ color: '#64748b', fontWeight: '700' }}> = {resumoLancadosR + resumoLancadosM}</span>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Total Reprogramados </span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>Recife: {resumoReproR}</span>
                            <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>Moreno: {resumoReproM}</span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}> = {resumoReproR + resumoReproM}</span>
                        </div>
                    </div>
                )}
                {temLegado && (
                    <div style={{ marginTop: temNovo ? '6px' : 0, fontSize: '11px', color: '#64748b' }}>
                        Snapshots legados — Lançados: <strong>{resumoLancadosLegado}</strong> | Reprogramados: <strong style={{ color: '#dc2626' }}>{resumoReproLegado}</strong>
                    </div>
                )}
            </div>

            {/* Snapshots */}
            {programacoes.map(prog => {
                const dados = prog.dados_json || {};
                const novoFmt = isNovoFormato(dados);

                let totLancR = 0, totLancM = 0, totReproR = 0, totReproM = 0, totRepro = 0;

                return (
                    <div key={prog.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                        <div style={{ background: '#1e293b', color: '#f8fafc', padding: '6px 12px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <strong>{formatData(prog.data_referencia)} — Turno {prog.turno}</strong>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>Snapshot Automático</span>
                        </div>
                        <table style={estiloTabela}>
                            <thead>
                                <tr>
                                    <th style={estiloThLeft}>Operação</th>
                                    <th style={estiloTh}>Quantidade</th>
                                    <th style={{ ...estiloTh, color: '#dc2626' }}>Reprogramados</th>
                                </tr>
                            </thead>
                            <tbody>
                                {OPERACOES_REL.map(op => {
                                    const d = dados[op] || {};
                                    const lanc_r = d.recife || 0;
                                    const lanc_m = d.moreno || 0;
                                    const repro_r = d.reprogramado_recife || 0;
                                    const repro_m = d.reprogramado_moreno || 0;
                                    const repro_leg = d.reprogramado || 0;
                                    totLancR += lanc_r; totLancM += lanc_m;
                                    if (novoFmt) { totReproR += repro_r; totReproM += repro_m; }
                                    else totRepro += repro_leg;
                                    return (
                                        <tr key={op}>
                                            <td style={estiloTdLeft}><strong>{op}</strong></td>
                                            <td style={estiloTd}>
                                                {novoFmt ? renderSplitPrint(lanc_r, lanc_m) : lanc_r + lanc_m}
                                            </td>
                                            <td style={{ ...estiloTd, color: (novoFmt ? repro_r + repro_m : repro_leg) > 0 ? '#dc2626' : '#94a3b8' }}>
                                                {novoFmt ? renderSplitPrint(repro_r, repro_m, '#dc2626', '#dc2626') : repro_leg}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
                                    <td style={estiloTdLeft}>TOTAL GERAL</td>
                                    <td style={estiloTd}>
                                        {novoFmt ? renderSplitPrint(totLancR, totLancM) : totLancR + totLancM}
                                    </td>
                                    <td style={{ ...estiloTd, color: '#dc2626' }}>
                                        {novoFmt ? renderSplitPrint(totReproR, totReproM, '#dc2626', '#dc2626') : totRepro}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}
