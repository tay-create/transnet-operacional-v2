/**
 * Gera PDF ultra-compacto de relatório de carga
 * Otimizado para suportar 30-35 NFs por página
 */
export const gerarPDFCompacto = async (item) => {
    try {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Configurações de fonte ultra-compacta
    doc.setFont('helvetica', 'normal');

    const margemEsq = 10;
    const margemDir = 200;
    const larguraUtil = margemDir - margemEsq;
    let yPos = 10;

    // === CABEÇALHO ===
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE CARGA', margemEsq, yPos);
    yPos += 6;

    // Linha divisória
    doc.setLineWidth(0.5);
    doc.line(margemEsq, yPos, margemDir, yPos);
    yPos += 5;

    // === DADOS PRINCIPAIS (Grid 2 colunas) ===
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const dadosPrincipais = [
        { label: 'DATA:', valor: item.data_prevista ? item.data_prevista.split('-').reverse().join('/') : 'N/A' },
        { label: 'OPERAÇÃO:', valor: item.operacao || 'N/A' },
        { label: 'MOTORISTA:', valor: item.motorista || 'A DEFINIR' },
        { label: 'VEÍCULO:', valor: item.tipoVeiculo || 'N/A' },
        { label: 'INÍCIO ROTA:', valor: item.inicio_rota || 'N/A' },
        { label: 'ORIGEM:', valor: item.origem_criacao || 'N/A' }
    ];

    // Layout em 2 colunas
    const colWidth = larguraUtil / 2;
    let col = 0;

    dadosPrincipais.forEach((dado) => {
        const xPos = margemEsq + (col * colWidth);

        doc.setFont('helvetica', 'bold');
        doc.text(dado.label, xPos, yPos);

        doc.setFont('helvetica', 'normal');
        doc.text(dado.valor, xPos + 20, yPos);

        col++;
        if (col === 2) {
            col = 0;
            yPos += 4;
        }
    });

    if (col !== 0) yPos += 4;
    yPos += 2;

    // === DOCAS E STATUS ===
    doc.setFont('helvetica', 'bold');
    doc.text('DOCA RECIFE:', margemEsq, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(item.doca_recife || 'N/A', margemEsq + 25, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('STATUS:', margemEsq + 70, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(item.status_recife || 'N/A', margemEsq + 85, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('DOCA MORENO:', margemEsq, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(item.doca_moreno || 'N/A', margemEsq + 25, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('STATUS:', margemEsq + 70, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(item.status_moreno || 'N/A', margemEsq + 85, yPos);
    yPos += 6;

    // === ROTAS ===
    if (item.rotaRecife || item.rotaMoreno) {
        doc.setFont('helvetica', 'bold');
        doc.text('ROTAS:', margemEsq, yPos);
        doc.setFont('helvetica', 'normal');
        const rotas = [];
        if (item.rotaRecife) rotas.push(`Recife: ${item.rotaRecife}`);
        if (item.rotaMoreno) rotas.push(`Moreno: ${item.rotaMoreno}`);
        doc.text(rotas.join(' | '), margemEsq + 15, yPos);
        yPos += 6;
    }

    // === OBSERVAÇÃO ===
    if (item.observacao && item.observacao.trim()) {
        doc.setFont('helvetica', 'bold');
        doc.text('OBSERVAÇÃO:', margemEsq, yPos);
        yPos += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const obsLinhas = doc.splitTextToSize(item.observacao, larguraUtil - 5);
        doc.text(obsLinhas, margemEsq + 2, yPos);
        yPos += (obsLinhas.length * 3) + 3;
        doc.setFontSize(8);
    }

    // Linha divisória antes das NFs
    doc.setLineWidth(0.3);
    doc.line(margemEsq, yPos, margemDir, yPos);
    yPos += 4;

    // === LISTA DE NOTAS FISCAIS (ULTRA-COMPACTA) ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('NOTAS FISCAIS', margemEsq, yPos);
    yPos += 5;

    // Coletar todas as NFs
    const todasNFs = [];

    if (item.coleta) {
        const nfsColeta = item.coleta.split(',').map(nf => nf.trim()).filter(Boolean);
        todasNFs.push(...nfsColeta);
    }
    if (item.coletaRecife) {
        const nfsRecife = item.coletaRecife.split(',').map(nf => nf.trim()).filter(Boolean);
        todasNFs.push(...nfsRecife.map(nf => `${nf} (REC)`));
    }
    if (item.coletaMoreno) {
        const nfsMoreno = item.coletaMoreno.split(',').map(nf => nf.trim()).filter(Boolean);
        todasNFs.push(...nfsMoreno.map(nf => `${nf} (MOR)`));
    }

    // Remover duplicatas
    const nfsUnicas = [...new Set(todasNFs)];

    if (nfsUnicas.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.text('Nenhuma nota fiscal registrada.', margemEsq + 5, yPos);
        yPos += 5;
    } else {
        // Layout em COLUNA ÚNICA ultra-compacta
        doc.setFontSize(7);
        doc.setFont('courier', 'normal'); // Fonte monoespaçada para números

        const xPos = margemEsq + 5;
        const espacamentoLinha = 3.2; // Espaçamento ultra-mínimo (3.2mm = ~70 NFs por página A4)

        nfsUnicas.forEach((nf) => {
            // Verificar se precisa quebrar página
            if (yPos > 280) {
                doc.addPage();
                yPos = 15; // Reset da posição Y na nova página

                // Cabeçalho simplificado na nova página
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text('CONTINUAÇÃO - NOTAS FISCAIS', margemEsq, yPos);
                yPos += 6;
                doc.setFontSize(7);
                doc.setFont('courier', 'normal');
            }

            doc.text(`• ${nf}`, xPos, yPos);
            yPos += espacamentoLinha;
        });

        yPos += 2;
    }

    // === RODAPÉ ===
    yPos += 5;
    doc.setLineWidth(0.3);
    doc.line(margemEsq, yPos, margemDir, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    const dataGeracao = new Date().toLocaleString('pt-BR');
    doc.text(`Relatório gerado em: ${dataGeracao}`, margemEsq, yPos);
    doc.text(`Total de NFs: ${nfsUnicas.length}`, margemDir - 30, yPos, { align: 'right' });

    const nomeArquivo = `Relatorio_${item.motorista || 'SemMotorista'}_${item.data_prevista || 'SemData'}.pdf`;
    const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao gerar PDF:', e);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
};

/**
 * Gera PDF do relatório de Saldo de Paletes PBR
 * @param {Array} registros - Lista de registros do saldo
 * @param {Object} kpis - { totalPbr, saldoPbr, totalDevPbr, pendentes }
 */
export const gerarPDFPaletes = async (registros, kpis) => {
    try {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const dataArquivo = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

    const W = 210;
    const ML = 14;
    const MR = W - ML;
    let y = 14;

    // ── Cabeçalho ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(96, 165, 250);
    doc.text('TRANSNET', ML, y + 4);
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text('Relatório de Saldo de Paletes PBR', ML, y + 11);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Gerado em: ${hoje}`, MR, y + 11, { align: 'right' });
    y = 36;

    // ── KPI Summary ──
    const kpiItems = [
        { label: 'SALDO PBR', valor: String(kpis.saldoPbr ?? 0), cor: [59, 130, 246] },
        { label: 'TOTAL SAÍDAS', valor: String(kpis.totalPbr ?? 0), cor: [100, 116, 139] },
        { label: 'DEVOLVIDOS', valor: String(kpis.totalDevPbr ?? 0), cor: [34, 197, 94] },
        { label: 'PENDENTES', valor: String(kpis.pendentes ?? 0), cor: [245, 158, 11] },
    ];
    const kpiW = (MR - ML) / 4;
    kpiItems.forEach((k, i) => {
        const x = ML + i * kpiW;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x, y, kpiW - 3, 22, 2, 2, 'F');
        doc.setFillColor(...k.cor);
        doc.rect(x, y, kpiW - 3, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(k.label, x + (kpiW - 3) / 2, y + 8, { align: 'center' });
        doc.setFontSize(18);
        doc.setTextColor(...k.cor);
        doc.text(k.valor, x + (kpiW - 3) / 2, y + 18, { align: 'center' });
    });
    y += 30;

    // ── Tabela ──
    const cabecalhos = ['Motorista', 'Placa Cavalo', 'Placa Carreta', 'Fornecedor', 'Qtd PBR', 'Saldo', 'Status', 'Data Entrada'];
    const linhas = (registros || []).map(r => {
        const saldo = (r.qtd_pbr || 0) - (r.qtd_devolvida_pbr || 0);
        const dtEntrada = r.data_entrada ? new Date(r.data_entrada.endsWith('Z') ? r.data_entrada : r.data_entrada + 'Z').toLocaleDateString('pt-BR') : '—';
        return [
            r.motorista || '—',
            r.placa_cavalo || '—',
            r.placa_carreta || '—',
            r.fornecedor_pbr || '—',
            String(r.qtd_pbr || 0),
            String(saldo),
            r.devolvido ? 'Devolvido' : 'Pendente',
            dtEntrada
        ];
    });

    doc.autoTable({
        startY: y,
        head: [cabecalhos],
        body: linhas,
        margin: { left: ML, right: ML },
        styles: { fontSize: 8, cellPadding: 3, textColor: [226, 232, 240], fillColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.3 },
        headStyles: { fillColor: [30, 58, 138], textColor: [147, 197, 253], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [20, 30, 50] },
        columnStyles: {
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
        },
        didParseCell: (data) => {
            if (data.column.index === 6 && data.section === 'body') {
                const val = data.cell.raw;
                data.cell.styles.textColor = val === 'Devolvido' ? [74, 222, 128] : [251, 191, 36];
            }
        }
    });

    // ── Rodapé ──
    const totalPags = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        const yFoot = doc.internal.pageSize.height - 8;
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`Transnet Logística — ${hoje}`, ML, yFoot);
        doc.text(`Página ${p} / ${totalPags}`, MR, yFoot, { align: 'right' });
    }

    const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `saldo-paletes-${dataArquivo}.pdf`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao gerar PDF paletes:', e);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
};
