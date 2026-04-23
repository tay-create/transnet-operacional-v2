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

// ─────────────────────────────────────────────────────────────
// PDF: Relatório Pós-Embarque
// ─────────────────────────────────────────────────────────────
export const gerarPDFPosEmbarque = async (relatorio, filtros = {}, periodo = {}) => {
    try {
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        const ocorrencias = relatorio?.ocorrencias || [];
        const metricas = relatorio?.metricas || { total: 0, resolvidos: 0, atrasados: 0, em_andamento: 0 };
        const porOperacao = relatorio?.por_operacao || {};
        const topMotivos = relatorio?.top_motivos || [];

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = 297, H = 210;
        const ML = 10, MR = W - ML;
        const hoje = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });
        const dataArquivo = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

        const formatData = (d) => {
            if (!d) return '—';
            const s = String(d).length >= 10 ? String(d).substring(0, 10) : d;
            const [y, m, day] = s.split('-');
            return `${day}/${m}/${y}`;
        };

        const calcAtraso = (oc) => {
            const inicio = new Date(`${oc.data_ocorrencia}T${oc.hora_ocorrencia || '00:00'}:00-03:00`);
            const fim = oc.situacao === 'RESOLVIDO'
                ? (oc.resolved_at ? new Date(oc.resolved_at) : new Date(`${oc.data_conclusao}T${oc.hora_conclusao || '00:00'}:00-03:00`))
                : new Date();
            return (fim - inicio) / (60 * 60 * 1000);
        };

        const getSituacao = (oc) => {
            const horas = calcAtraso(oc);
            if (oc.situacao === 'RESOLVIDO') {
                return horas > 24
                    ? { texto: 'RESOLVIDO (>24H)', cor: [217, 119, 6] }
                    : { texto: 'RESOLVIDO', cor: [22, 163, 74] };
            }
            return horas > 24
                ? { texto: 'ATRASADO (>24H)', cor: [220, 38, 38] }
                : { texto: 'EM ANDAMENTO', cor: [71, 85, 105] };
        };

        // ── Cabeçalho (reutilizado em cada página via função) ──
        const desenharCabecalho = (pdf, pageNum, pageTotal) => {
            pdf.setFillColor(15, 23, 42);
            pdf.rect(0, 0, W, 22, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(241, 245, 249);
            pdf.text('TRANS', ML, 10);
            pdf.setTextColor(37, 99, 235);
            const larguraTrans = pdf.getTextWidth('TRANS');
            pdf.text('NET', ML + larguraTrans, 10);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text('LOGÍSTICA OPERACIONAL', ML, 15);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(241, 245, 249);
            pdf.text('RELATÓRIO CONSOLIDADO — PÓS-EMBARQUE', W / 2, 10, { align: 'center' });
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Gerado em ${hoje}`, W / 2, 15, { align: 'center' });

            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Página ${pageNum} / ${pageTotal}`, MR, 10, { align: 'right' });

            pdf.setDrawColor(37, 99, 235);
            pdf.setLineWidth(0.6);
            pdf.line(0, 22, W, 22);
        };

        // ── Faixa de filtros aplicados ──
        const filtrosAplicados = [];
        if (periodo.de && periodo.ate) {
            filtrosAplicados.push(`Período ${formatData(periodo.de)} → ${formatData(periodo.ate)}`);
        }
        ['motorista', 'cliente', 'cidade', 'motivo', 'operacao', 'modalidade', 'situacao'].forEach(k => {
            if (filtros[k]) filtrosAplicados.push(`${k.charAt(0).toUpperCase() + k.slice(1)}: ${filtros[k]}`);
        });
        const faixaFiltros = filtrosAplicados.length ? filtrosAplicados.join(' · ') : 'Sem filtros aplicados';

        desenharCabecalho(doc, 1, 1);
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(faixaFiltros, ML, 28);
        doc.text(`${metricas.total} ocorrência(s) no período`, MR, 28, { align: 'right' });

        // ── Tabela 13 colunas ──
        const cabecalhos = ['DATA INÍCIO', 'HORA', 'DATA FIM', 'HR FIM', 'MOTORISTA', 'MODAL.', 'CTE', 'OPERAÇÃO', 'NF\'S', 'CLIENTE', 'CIDADE', 'MOTIVO', 'SITUAÇÃO'];

        const linhas = ocorrencias.map(oc => {
            const situ = getSituacao(oc);
            return [
                formatData(oc.data_ocorrencia),
                oc.hora_ocorrencia || '—',
                oc.situacao === 'RESOLVIDO' ? formatData(oc.data_conclusao || (oc.resolved_at ? String(oc.resolved_at).substring(0, 10) : null)) : '—',
                oc.situacao === 'RESOLVIDO' ? (oc.hora_conclusao || '—') : '—',
                oc.motorista || '—',
                oc.modalidade || '—',
                oc.cte || '—',
                oc.operacao || '—',
                oc.nfs || '—',
                oc.cliente || '—',
                oc.cidade || '—',
                oc.motivo || '—',
                { content: situ.texto, styles: { textColor: situ.cor, fontStyle: 'bold' } }
            ];
        });

        doc.autoTable({
            startY: 32,
            head: [cabecalhos],
            body: linhas,
            margin: { top: 26, left: ML, right: ML, bottom: 12 },
            styles: { fontSize: 7, cellPadding: 1.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.1, overflow: 'linebreak' },
            headStyles: { fillColor: [30, 41, 59], textColor: [241, 245, 249], fontStyle: 'bold', fontSize: 7, halign: 'center' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 18 },
                1: { halign: 'center', cellWidth: 12 },
                2: { halign: 'center', cellWidth: 18 },
                3: { halign: 'center', cellWidth: 12 },
                4: { cellWidth: 32 },
                5: { halign: 'center', cellWidth: 15 },
                6: { halign: 'center', cellWidth: 18 },
                7: { halign: 'center', cellWidth: 22 },
                8: { cellWidth: 22 },
                9: { cellWidth: 32 },
                10: { cellWidth: 28 },
                11: { cellWidth: 36 },
                12: { halign: 'center', cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                // Cabeçalho em cada nova página
                if (data.pageNumber > 1) {
                    desenharCabecalho(doc, data.pageNumber, doc.internal.getNumberOfPages());
                }
            }
        });

        // ── Página de análise consolidada ──
        doc.addPage();
        desenharCabecalho(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages());

        let y = 30;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text('ANÁLISE CONSOLIDADA', ML, y);
        y += 6;

        // Cards resumo grandes
        const cards = [
            { label: 'TOTAL OPERAÇÕES', valor: metricas.total, cor: [37, 99, 235] },
            { label: 'RESOLVIDAS', valor: metricas.resolvidos, cor: [22, 163, 74] },
            { label: 'PASSARAM DE 24H', valor: metricas.atrasados, cor: [220, 38, 38] }
        ];
        const cardW = (MR - ML - 8) / 3;
        cards.forEach((c, i) => {
            const x = ML + i * (cardW + 4);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, y, cardW, 28, 2, 2, 'FD');
            doc.setFillColor(...c.cor);
            doc.rect(x, y, cardW, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(c.label, x + cardW / 2, y + 9, { align: 'center' });
            doc.setFontSize(22);
            doc.setTextColor(...c.cor);
            doc.text(String(c.valor), x + cardW / 2, y + 22, { align: 'center' });
        });
        y += 34;

        // Donut — Volume por Operação
        const colunaW = (MR - ML - 10) / 2;
        const xCol1 = ML;
        const xCol2 = ML + colunaW + 10;
        const graficoH = 70;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text('VOLUME POR OPERAÇÃO', xCol1, y);

        doc.text('RESOLVIDAS × ATRASADAS (>24H)', xCol2, y);
        y += 2;

        // === Donut: volume por operação ===
        const paleta = [[37, 99, 235], [139, 92, 246], [245, 158, 11], [34, 197, 94], [236, 72, 153], [14, 165, 233]];
        const opEntries = Object.entries(porOperacao);
        const totalOp = opEntries.reduce((acc, [, v]) => acc + v, 0) || 1;
        const cxDonut = xCol1 + 22;
        const cyDonut = y + graficoH / 2;
        const rOut = 22, rIn = 12;

        let anguloAcum = -Math.PI / 2;
        opEntries.forEach(([, v], idx) => {
            const frac = v / totalOp;
            const fim = anguloAcum + frac * Math.PI * 2;
            const cor = paleta[idx % paleta.length];
            // aproximar fatia com polígono (many segmentos)
            const steps = Math.max(6, Math.ceil(frac * 60));
            doc.setFillColor(...cor);
            const pts = [[cxDonut, cyDonut]];
            for (let s = 0; s <= steps; s++) {
                const ang = anguloAcum + (fim - anguloAcum) * (s / steps);
                pts.push([cxDonut + Math.cos(ang) * rOut, cyDonut + Math.sin(ang) * rOut]);
            }
            // desenhar triangulação simples usando lines + fill via doc.triangle
            for (let s = 1; s < pts.length - 1; s++) {
                doc.triangle(pts[0][0], pts[0][1], pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], 'F');
            }
            anguloAcum = fim;
        });
        // buraco central (fundo branco para simular donut)
        doc.setFillColor(255, 255, 255);
        doc.circle(cxDonut, cyDonut, rIn, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(String(totalOp), cxDonut, cyDonut + 1, { align: 'center' });
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('TOTAL', cxDonut, cyDonut + 4.5, { align: 'center' });

        // Legenda donut
        const xLeg = cxDonut + rOut + 8;
        let yLeg = y + 4;
        opEntries.forEach(([nome, v], idx) => {
            const cor = paleta[idx % paleta.length];
            doc.setFillColor(...cor);
            doc.roundedRect(xLeg, yLeg - 2.5, 3, 3, 0.5, 0.5, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(30, 41, 59);
            const pct = Math.round((v / totalOp) * 100);
            doc.text(`${nome} — ${v} (${pct}%)`, xLeg + 4.5, yLeg);
            yLeg += 4;
        });

        // === Pizza: Resolvidas × Atrasadas ===
        const cxPie = xCol2 + 22;
        const cyPie = y + graficoH / 2;
        const rPie = 22;
        const totalPie = (metricas.resolvidos + metricas.atrasados) || 1;
        const fatias = [
            { v: metricas.resolvidos, cor: [22, 163, 74], label: 'Resolvidas' },
            { v: metricas.atrasados, cor: [220, 38, 38], label: 'Atrasadas (>24h)' }
        ];
        let angAcum2 = -Math.PI / 2;
        fatias.forEach(f => {
            const frac = f.v / totalPie;
            const fim = angAcum2 + frac * Math.PI * 2;
            doc.setFillColor(...f.cor);
            const steps = Math.max(6, Math.ceil(frac * 60));
            const pts = [[cxPie, cyPie]];
            for (let s = 0; s <= steps; s++) {
                const ang = angAcum2 + (fim - angAcum2) * (s / steps);
                pts.push([cxPie + Math.cos(ang) * rPie, cyPie + Math.sin(ang) * rPie]);
            }
            for (let s = 1; s < pts.length - 1; s++) {
                doc.triangle(pts[0][0], pts[0][1], pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], 'F');
            }
            angAcum2 = fim;
        });

        const xLeg2 = cxPie + rPie + 8;
        let yLeg2 = y + 8;
        fatias.forEach(f => {
            doc.setFillColor(...f.cor);
            doc.roundedRect(xLeg2, yLeg2 - 2.5, 3, 3, 0.5, 0.5, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(30, 41, 59);
            const pct = totalPie ? Math.round((f.v / totalPie) * 100) : 0;
            doc.text(`${f.label} — ${f.v} (${pct}%)`, xLeg2 + 4.5, yLeg2);
            yLeg2 += 5;
        });

        y += graficoH + 4;

        // === Barras horizontais: TOP 5 MOTIVOS ===
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text('TOP 5 MOTIVOS DE OCORRÊNCIAS', ML, y);
        y += 4;

        const maxCount = Math.max(1, ...topMotivos.map(m => m.count));
        const barMaxW = MR - ML - 80;
        topMotivos.slice(0, 5).forEach(m => {
            const pct = m.count / maxCount;
            const barW = Math.max(2, barMaxW * pct);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            const label = (m.motivo || '').length > 40 ? (m.motivo || '').substring(0, 38) + '…' : (m.motivo || '—');
            doc.text(label, ML, y + 3);
            doc.setFillColor(37, 99, 235);
            doc.roundedRect(ML + 70, y, barW, 5, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(String(m.count), ML + 70 + barW + 1.5, y + 3.6);
            y += 7;
        });

        // ── Rodapé em todas as páginas ──
        const totalPags = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPags; p++) {
            doc.setPage(p);
            const yFoot = H - 5;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.line(ML, yFoot - 3, MR, yFoot - 3);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(`Transnet Logística — ${hoje}`, ML, yFoot);
            doc.text(`Página ${p} / ${totalPags}`, MR, yFoot, { align: 'right' });
        }

        const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const deStr = (periodo.de || '').replace(/-/g, '');
        const ateStr = (periodo.ate || '').replace(/-/g, '');
        a.href = url;
        a.download = `posembarque-${deStr}-a-${ateStr || dataArquivo}.pdf`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Erro ao gerar PDF pós-embarque:', e);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
};
