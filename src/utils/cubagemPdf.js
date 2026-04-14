export function gerarPdfCubagem(cubagem) {
    if (!cubagem) return;
    const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const itens = cubagem.itens || [];
    const linhasItens = itens.map(it => `
        <tr>
            <td>${it.numero_nf || '—'}</td>
            <td>${it.uf || '—'}</td>
            <td style="text-align:right">${Number(it.metragem || 0).toFixed(3)}</td>
            <td style="text-align:right">${Number(it.volumes || 0)}</td>
            <td style="text-align:right">${Number(it.peso_kg || 0).toLocaleString('pt-BR')} kg</td>
            <td style="text-align:right">${it.valor > 0 ? fmtBRL(it.valor) : '—'}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cubagem Porcelana — ${cubagem.numero_coleta}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
        h2 { color: #92400e; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-top: 12px; }
        th { background: #d97706; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #fef3c7; }
        .tfoot td { background: #92400e; color: #fff; font-weight: bold; }
        .totais { display: flex; gap: 24px; margin-top: 16px; flex-wrap: wrap; }
        .tot-card { background: #fef3c7; border-left: 4px solid #d97706; padding: 8px 14px; border-radius: 4px; min-width: 120px; }
        .tot-label { font-size: 10px; color: #78716c; font-weight: bold; text-transform: uppercase; }
        .tot-val { font-size: 18px; color: #92400e; font-weight: 800; }
    </style></head><body>
    <h2>TRANSNET — Cubagem Porcelana</h2>
    <div class="meta">
        Coleta: <strong>${cubagem.numero_coleta}</strong>
        &nbsp;|&nbsp; Data: <strong>${cubagem.data || '—'}</strong>
        &nbsp;|&nbsp; Motorista: <strong>${cubagem.motorista || '—'}</strong>
        ${cubagem.redespacho ? `&nbsp;|&nbsp; Redespacho: <strong>${cubagem.nome_redespacho || 'Sim'}</strong>` : ''}
    </div>
    <table>
        <thead>
            <tr>
                <th>NF</th><th>UF</th><th style="text-align:right">M³</th>
                <th style="text-align:right">Volumes</th><th style="text-align:right">Peso</th>
                <th style="text-align:right">Valor</th>
            </tr>
        </thead>
        <tbody>${linhasItens}</tbody>
        <tfoot>
            <tr class="tfoot">
                <td colspan="2"><strong>TOTAL</strong></td>
                <td style="text-align:right"><strong>${Number(cubagem.metragem_total || 0).toFixed(3)}</strong></td>
                <td style="text-align:right"><strong>${cubagem.volume || '—'}</strong></td>
                <td style="text-align:right"><strong>${Number(cubagem.peso_total || 0).toLocaleString('pt-BR')} kg</strong></td>
                <td style="text-align:right"><strong>${fmtBRL(cubagem.valor_total || 0)}</strong></td>
            </tr>
        </tfoot>
    </table>
    <div class="totais">
        <div class="tot-card"><div class="tot-label">M³ Total</div><div class="tot-val">${Number(cubagem.metragem_total || 0).toFixed(3)}</div></div>
        <div class="tot-card"><div class="tot-label">Mix</div><div class="tot-val">${Number(cubagem.valor_mix_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Kit</div><div class="tot-val">${Number(cubagem.valor_kit_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Valor Total</div><div class="tot-val">${fmtBRL(cubagem.valor_total || 0)}</div></div>
        <div class="tot-card"><div class="tot-label">Cliente</div><div class="tot-val" style="font-size:13px">${cubagem.cliente || '—'}</div></div>
        <div class="tot-card"><div class="tot-label">Destino</div><div class="tot-val" style="font-size:13px">${cubagem.destino || '—'}</div></div>
    </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.focus();
}
