import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Gera PDF ultra-compacto de relatório de carga
 * Otimizado para suportar 30-35 NFs por página
 */
export const gerarPDFCompacto = (item) => {
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

    dadosPrincipais.forEach((dado, idx) => {
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

        nfsUnicas.forEach((nf, idx) => {
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

    // Nome do arquivo dinâmico
    const nomeArquivo = `Relatorio_${item.motorista || 'SemMotorista'}_${item.data_prevista || 'SemData'}.pdf`;

    // Download automático
    doc.save(nomeArquivo);
};
