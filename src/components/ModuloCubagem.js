import React, { useState, useRef } from 'react';
import { Calculator, Upload, Download, Plus, X, Trash2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ModuloCubagem() {
    const [motorista, setMotorista] = useState('Aguardando Contratação');
    const [nomeRedespacho, setNomeRedespacho] = useState('');
    const [itens, setItens] = useState([]);
    const fileInputRef = useRef(null);

    // Fórmulas: Base = M³ + 10% → Mix = (Base / 2.5) / 1.3 → Kit = (Base / 2.5) / 1.9
    const calcBase = (metragem) => {
        const m = parseFloat(metragem) || 0;
        return m + (m * 0.10);
    };
    const calcMix = (metragem) => Math.round((calcBase(metragem) / 2.5) / 1.3);
    const calcKit = (metragem) => Math.round((calcBase(metragem) / 2.5) / 1.9);
    const fmt = (val) => Math.round(typeof val === 'number' ? val : 0).toLocaleString('pt-BR');

    const parsePesoKg = (pesoStr) => {
        if (!pesoStr) return 0;
        const s = String(pesoStr).trim().toLowerCase();
        const num = parseFloat(s.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        if (s.includes('ton')) return num * 1000;
        if (s.includes('g') && !s.includes('kg')) return num / 1000;
        return num;
    };

    const fmtPeso = (kg) => {
        if (kg >= 1000) return `${(kg / 1000).toFixed(2).replace('.', ',')} ton`;
        return `${Math.round(kg)} kg`;
    };

    const importarExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const extensao = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                let workbook;
                if (extensao === 'csv') {
                    const texto = evt.target.result;
                    const primeiraLinha = texto.split('\n')[0] || '';
                    const separador = primeiraLinha.includes(';') ? ';' : ',';
                    workbook = XLSX.read(texto, { type: 'string', FS: separador });
                } else {
                    workbook = XLSX.read(evt.target.result, { type: 'binary' });
                }

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                const mapear = (row) => {
                    const get = (keys) => {
                        for (const k of keys) {
                            const found = Object.keys(row).find(col => col.toLowerCase().trim().includes(k.toLowerCase()));
                            if (found && row[found] !== '') return String(row[found]);
                        }
                        return '';
                    };
                    return {
                        nf: get(['NF', 'Nota', 'nota fiscal']),
                        cliente: get(['Cliente', 'client']),
                        cidade: get(['Cidade', 'city']),
                        uf: get(['UF', 'Estado', 'state']),
                        volumes: get(['Vol', 'Volume', 'Volumes']),
                        pesoKg: get(['Peso', 'Kg', 'Weight']),
                        metragem: get(['M³', 'M3', 'Metragem', 'Cubagem', 'Metro']),
                        doca: get(['Doca', 'Dock']),
                        redespacho: false
                    };
                };

                const novosItens = dados.map(mapear).filter(item => item.nf || item.metragem);

                if (novosItens.length === 0) {
                    alert('Nenhum dado válido encontrado. Verifique as colunas: NF, Cliente, Cidade, UF, Volumes, Peso Kg, M³, Doca');
                    return;
                }

                setItens(novosItens);
            } catch (err) {
                console.error('Erro ao ler arquivo:', err);
                alert('Erro ao processar o arquivo. Verifique se é um arquivo válido (.xlsx, .xls ou .csv).');
            }
        };

        if (extensao === 'csv') {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsBinaryString(file);
        }
        e.target.value = '';
    };

    const adicionarItem = () => {
        setItens([...itens, { nf: '', cliente: '', cidade: '', uf: '', volumes: '', pesoKg: '', metragem: '', doca: '', redespacho: false }]);
    };

    const atualizarItem = (index, campo, valor) => {
        const novos = [...itens];
        novos[index] = { ...novos[index], [campo]: valor };
        setItens(novos);
    };

    const removerItem = (index) => {
        setItens(itens.filter((_, i) => i !== index));
    };

    const limparTudo = () => {
        if (itens.length > 0 && !window.confirm('Limpar todos os dados?')) return;
        setItens([]);
        setMotorista('Aguardando Contratação');
        setNomeRedespacho('');
    };

    const totalMetragem = itens.reduce((acc, i) => acc + (parseFloat(i.metragem) || 0), 0);
    const totalBase = calcBase(totalMetragem);
    const totalMix = calcMix(totalMetragem);
    const totalKit = calcKit(totalMetragem);
    const totalVolumes = itens.reduce((acc, i) => acc + (parseInt(i.volumes) || 0), 0);
    const totalPesoKg = itens.reduce((acc, i) => acc + parsePesoKg(i.pesoKg), 0);

    const escapeHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const gerarPDF = () => {
        if (itens.length === 0) { alert('Importe ou adicione NFs antes de gerar o PDF.'); return; }

        const dataEmissao = new Date().toLocaleString('pt-BR');
        const temRedespacho = nomeRedespacho.trim() !== '';

        const linhasHTML = itens.map((item, i) => {
            const metro = parseFloat(item.metragem) || 0;
            const mix = calcMix(metro);
            const kit = calcKit(metro);
            return `<tr${i % 2 !== 0 ? ' style="background:#f5f5f5;"' : ''}>
                    ${temRedespacho ? `<td style="text-align:center;">${item.redespacho ? '&#9745;' : '&#9744;'}</td>` : ''}
                    <td style="font-weight:600;">${escapeHtml(item.nf)}</td>
                    <td>${escapeHtml(item.cliente)}</td>
                    <td>${escapeHtml(item.cidade)}${item.uf ? '-' + escapeHtml(item.uf) : ''}</td>
                    <td style="text-align:center;">${escapeHtml(item.doca)}</td>
                    <td style="text-align:center;">${escapeHtml(item.volumes)}${item.pesoKg ? ' / ' + escapeHtml(item.pesoKg) + 'kg' : ''}</td>
                    <td style="text-align:center;">${fmt(metro)}</td>
                    <td style="text-align:center;">${fmt(mix)}</td>
                    <td style="text-align:center;">${fmt(kit)}</td>
                </tr>`;
        }).join('');

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TRANSNET - Cubagem</title>
    <style>
        @page { size: landscape; margin: 8mm; }
        @media print { .no-print { display: none !important; } thead { display: table-header-group; } }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 9px; color: #000; line-height: 1.2; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 2px 4px; vertical-align: middle; }
        thead th { background: #333; color: #fff; font-size: 8px; text-transform: uppercase; font-weight: bold; padding: 3px 4px; }
        .totais td { background: #e8e8e8; font-weight: bold; border-top: 2px solid #333; }
        .btn-print { position: fixed; top: 5px; right: 5px; background: #333; color: white; border: none; padding: 6px 14px; cursor: pointer; font-size: 11px; font-weight: bold; z-index: 999; }
    </style>
</head>
<body>
    <button class="btn-print no-print" onclick="window.print()">IMPRIMIR / SALVAR PDF</button>

    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #333; padding:4px 0; margin-bottom:4px;">
        <div><strong style="font-size:14px; letter-spacing:2px;">TRANSNET</strong> <span style="font-size:9px; color:#555;">Cubagem</span></div>
        <div style="font-size:8px; text-align:right;">
            <span><strong>Motorista:</strong> ${escapeHtml(motorista)}</span>
            ${temRedespacho ? ` | <span><strong>Redesp:</strong> ${escapeHtml(nomeRedespacho)}</span>` : ''}
            | <span><strong>Vol:</strong> ${totalVolumes}</span>
            | <span><strong>Peso:</strong> ${fmtPeso(totalPesoKg)}</span>
            | <span><strong>M³:</strong> ${fmt(totalMetragem)}</span>
            | <span><strong>Base:</strong> ${fmt(totalBase)}</span>
            | <span><strong>Mix:</strong> ${fmt(totalMix)}</span>
            | <span><strong>Kit:</strong> ${fmt(totalKit)}</span>
            | <span>${dataEmissao}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                ${temRedespacho ? '<th style="width:25px;">R</th>' : ''}
                <th>NF</th>
                <th>Cliente</th>
                <th>Cidade-UF</th>
                <th>Doca</th>
                <th>Vol/Peso</th>
                <th>M³</th>
                <th>Mix</th>
                <th>Kit</th>
            </tr>
        </thead>
        <tbody>
            ${linhasHTML}
            <tr class="totais">
                <td colspan="${temRedespacho ? 6 : 5}" style="text-align:right;">TOTAIS</td>
                <td style="text-align:center;">${fmt(totalMetragem)}</td>
                <td style="text-align:center;">${fmt(totalMix)}</td>
                <td style="text-align:center;">${fmt(totalKit)}</td>
            </tr>
        </tbody>
    </table>

    <div style="margin-top:4px; font-size:7px; color:#888; display:flex; justify-content:space-between;">
        <span>TRANSNET - Soluções em Logística</span>
        <span>${itens.length} NF(s) | ${dataEmissao} | Conferência interna</span>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const janela = window.open(url, '_blank');
        if (!janela) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `TRANSNET_Cubagem_${new Date().toISOString().split('T')[0]}.html`;
            a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const temRedespacho = nomeRedespacho.trim() !== '';

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>

            {/* CABEÇALHO GLOBAL */}
            <div className="glass-panel" style={{ padding: '25px', borderRadius: '16px', marginBottom: '20px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <h3 style={{ color: '#a855f7', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '600' }}>
                    <Calculator size={26} />
                    Calculadora de Cubagem
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', alignItems: 'end' }}>
                    <div>
                        <label className="label-tech-sm">MOTORISTA</label>
                        <input className="input-internal" value={motorista} onChange={e => setMotorista(e.target.value)} />
                    </div>
                    <div>
                        <label className="label-tech-sm">REDESPACHO (Transportadora)</label>
                        <input className="input-internal" value={nomeRedespacho} onChange={e => setNomeRedespacho(e.target.value)} placeholder="Vazio = Sem Redespacho" />
                        {temRedespacho && (
                            <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                                Checkboxes de Redespacho habilitados nas NFs
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx,.xls,.csv"
                            onChange={importarExcel}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-ghost"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}
                        >
                            <Upload size={16} /> Importar Excel
                        </button>
                        <button
                            onClick={adicionarItem}
                            className="btn-ghost"
                            style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Plus size={16} /> Manual
                        </button>
                    </div>
                </div>
            </div>

            {/* GRID DE NFs */}
            {itens.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: temRedespacho ? '40px 100px 1fr 120px 80px 90px 120px 140px 40px' : '100px 1fr 120px 80px 90px 120px 140px 40px',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'rgba(124, 58, 237, 0.15)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#a855f7',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase'
                    }}>
                        {temRedespacho && <span style={{ textAlign: 'center' }}>Red.</span>}
                        <span>NF</span>
                        <span>Cliente</span>
                        <span>Cidade - UF</span>
                        <span style={{ textAlign: 'center' }}>Doca</span>
                        <span style={{ textAlign: 'center' }}>Vol / Peso</span>
                        <span style={{ textAlign: 'center' }}>M³</span>
                        <span style={{ textAlign: 'center' }}>Mix / Kit</span>
                        <span></span>
                    </div>

                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {itens.map((item, index) => {
                            const metro = parseFloat(item.metragem) || 0;
                            const mix = calcMix(metro);
                            const kit = calcKit(metro);

                            return (
                                <div key={index} style={{
                                    display: 'grid',
                                    gridTemplateColumns: temRedespacho ? '40px 100px 1fr 120px 80px 90px 120px 140px 40px' : '100px 1fr 120px 80px 90px 120px 140px 40px',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    background: index % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.25)',
                                    borderRadius: '6px',
                                    marginBottom: '4px',
                                    alignItems: 'center',
                                    fontSize: '12px'
                                }}>
                                    {temRedespacho && (
                                        <div style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={item.redespacho || false}
                                                onChange={e => atualizarItem(index, 'redespacho', e.target.checked)}
                                                style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                                            />
                                        </div>
                                    )}
                                    <input className="input-internal" value={item.nf} onChange={e => atualizarItem(index, 'nf', e.target.value)} placeholder="NF" style={{ margin: 0, fontSize: '12px', padding: '6px 8px' }} />
                                    <div style={{ color: '#cbd5e1', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.cliente || '-'}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>{item.cidade}{item.uf ? ` - ${item.uf}` : ''}</div>
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>{item.doca || '-'}</div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ color: '#cbd5e1', fontSize: '11px' }}>{item.volumes || '-'}</div>
                                        <div style={{ color: '#64748b', fontSize: '9px' }}>{item.pesoKg ? `${item.pesoKg} kg` : ''}</div>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input-internal"
                                        value={item.metragem}
                                        onChange={e => atualizarItem(index, 'metragem', e.target.value)}
                                        placeholder="0.00"
                                        style={{ margin: 0, fontSize: '12px', padding: '6px 8px', textAlign: 'center' }}
                                    />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '12px' }}>Mix: {fmt(mix)}</div>
                                        <div style={{ color: '#818cf8', fontWeight: 'bold', fontSize: '11px' }}>Kit: {fmt(kit)}</div>
                                    </div>
                                    <button
                                        onClick={() => removerItem(index)}
                                        style={{ background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: '4px', color: '#f87171', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* TOTAIS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginTop: '20px', padding: '20px', background: 'rgba(124, 58, 237, 0.08)', borderRadius: '12px', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '1px' }}>TOTAL M³</div>
                            <div style={{ fontSize: '24px', color: '#3b82f6', fontWeight: 'bold' }}>{fmt(totalMetragem)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '1px' }}>BASE (+10%)</div>
                            <div style={{ fontSize: '24px', color: '#f59e0b', fontWeight: 'bold' }}>{fmt(totalBase)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '1px' }}>TOTAL MIX</div>
                            <div style={{ fontSize: '24px', color: '#a855f7', fontWeight: 'bold' }}>{fmt(totalMix)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '1px' }}>TOTAL KIT</div>
                            <div style={{ fontSize: '24px', color: '#818cf8', fontWeight: 'bold' }}>{fmt(totalKit)}</div>
                        </div>
                    </div>

                    {/* BOTÕES */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                        <button onClick={limparTudo} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                            <Trash2 size={16} /> Limpar Tudo
                        </button>
                        <button
                            onClick={gerarPDF}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                        >
                            <Download size={18} /> Exportar PDF
                        </button>
                    </div>
                </div>
            )}

            {/* ESTADO VAZIO */}
            {itens.length === 0 && (
                <div className="glass-panel" style={{ padding: '60px 30px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
                    <FileSpreadsheet size={64} style={{ opacity: 0.2, margin: '0 auto 20px', color: '#a855f7' }} />
                    <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '8px' }}>Nenhuma NF carregada</p>
                    <p style={{ fontSize: '12px', color: '#475569' }}>
                        Importe um arquivo Excel (.xlsx) ou CSV (.csv) ou adicione NFs manualmente
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '15px' }}>
                        Colunas esperadas: <strong>Cliente, Cidade, UF, Volumes, Peso Kg, M³, NF, Doca</strong><br />
                        <span style={{ fontSize: '10px', color: '#475569' }}>CSV aceita separador por vírgula ou ponto-e-vírgula</span>
                    </p>
                    <p style={{ fontSize: '11px', color: '#475569', marginTop: '10px', background: 'rgba(168, 85, 247, 0.08)', display: 'inline-block', padding: '6px 12px', borderRadius: '6px' }}>
                        Fórmula: Base = M³ + 10% → Mix = (Base / 2.5) / 1.3 → Kit = (Base / 2.5) / 1.9
                    </p>
                </div>
            )}
        </div>
    );
}
