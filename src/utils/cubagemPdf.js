export function gerarPdfCubagem(cubagem) {
    if (!cubagem) return;
    const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const itens = cubagem.itens || [];

    // Fallback: cubagem antiga (antes do fluxo multi-redespacho) — grava no nível do item
    const temRedespachoPorItem = itens.some(it => it.redespacho_nome && String(it.redespacho_nome).trim());
    const fallbackNome = (!temRedespachoPorItem && cubagem.redespacho && cubagem.nome_redespacho)
        ? String(cubagem.nome_redespacho).trim()
        : null;

    // Agrupa itens por redespacho (ou "direto ao cliente" se sem redespacho)
    const grupos = new Map();
    itens.forEach(it => {
        const nome = (it.redespacho_nome && String(it.redespacho_nome).trim()) || fallbackNome;
        const uf = it.redespacho_uf || '';
        const chave = nome ? `REDESPACHO::${nome}::${uf}` : 'DIRETO';
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(it);
    });

    const renderGrupo = (titulo, cor, subtitulo, itensGrupo) => {
        const linhas = itensGrupo.map(it => `
            <tr>
                <td>${it.numero_nf || '—'}</td>
                <td>${it.uf || '—'}</td>
                <td style="text-align:right">${Number(it.metragem || 0).toFixed(3)}</td>
                <td style="text-align:right">${Number(it.volumes || 0)}</td>
                <td style="text-align:right">${Number(it.peso_kg || 0).toLocaleString('pt-BR')} kg</td>
                <td style="text-align:right">${it.valor > 0 ? fmtBRL(it.valor) : '—'}</td>
            </tr>`).join('');
        const subM3 = itensGrupo.reduce((s, it) => s + Number(it.metragem || 0), 0);
        const subVol = itensGrupo.reduce((s, it) => s + Number(it.volumes || 0), 0);
        const subPeso = itensGrupo.reduce((s, it) => s + Number(it.peso_kg || 0), 0);
        const subValor = itensGrupo.reduce((s, it) => s + Number(it.valor || 0), 0);

        return `
            <div class="grupo-header" style="background:${cor};">
                <span class="grupo-titulo">${titulo}</span>
                ${subtitulo ? `<span class="grupo-sub">${subtitulo}</span>` : ''}
                <span class="grupo-qtd">${itensGrupo.length} NF(s)</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>NF</th><th>UF</th><th style="text-align:right">M³</th>
                        <th style="text-align:right">Volumes</th><th style="text-align:right">Peso</th>
                        <th style="text-align:right">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
                <tfoot>
                    <tr class="tfoot">
                        <td colspan="2"><strong>SUBTOTAL</strong></td>
                        <td style="text-align:right"><strong>${subM3.toFixed(3)}</strong></td>
                        <td style="text-align:right"><strong>${subVol}</strong></td>
                        <td style="text-align:right"><strong>${subPeso.toLocaleString('pt-BR')} kg</strong></td>
                        <td style="text-align:right"><strong>${fmtBRL(subValor)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    };

    const blocosHtml = [];
    // Primeiro: redespachos, depois entrega direta
    [...grupos.entries()]
        .sort((a, b) => a[0] === 'DIRETO' ? 1 : b[0] === 'DIRETO' ? -1 : a[0].localeCompare(b[0]))
        .forEach(([chave, itensGrupo]) => {
            if (chave === 'DIRETO') {
                blocosHtml.push(renderGrupo('ENTREGA DIRETA AO CLIENTE', '#1e40af', cubagem.cliente || '', itensGrupo));
            } else {
                const [, nome, uf] = chave.split('::');
                blocosHtml.push(renderGrupo(`REDESPACHO: ${nome}`, '#92400e', uf ? `UF: ${uf}` : '', itensGrupo));
            }
        });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cubagem Porcelana — ${cubagem.numero_coleta}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
        h2 { color: #92400e; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-top: 4px; margin-bottom: 12px; }
        th { background: #d97706; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #fef3c7; }
        .tfoot td { background: #78350f; color: #fff; font-weight: bold; }
        .grupo-header { color: #fff; padding: 10px 14px; margin-top: 16px; border-radius: 6px 6px 0 0;
                        display: flex; gap: 14px; align-items: center; font-size: 13px; }
        .grupo-titulo { font-weight: 800; letter-spacing: 0.5px; }
        .grupo-sub { font-size: 11px; opacity: 0.85; }
        .grupo-qtd { margin-left: auto; font-size: 11px; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 4px; }
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
        &nbsp;|&nbsp; Cliente: <strong>${cubagem.cliente || '—'}</strong>
    </div>
    ${blocosHtml.join('\n')}
    <div class="totais">
        <div class="tot-card"><div class="tot-label">M³ Total</div><div class="tot-val">${Number(cubagem.metragem_total || 0).toFixed(3)}</div></div>
        <div class="tot-card"><div class="tot-label">Mix</div><div class="tot-val">${Number(cubagem.valor_mix_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Kit</div><div class="tot-val">${Number(cubagem.valor_kit_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Valor Total</div><div class="tot-val">${fmtBRL(cubagem.valor_total || 0)}</div></div>
        <div class="tot-card"><div class="tot-label">Peso Total</div><div class="tot-val" style="font-size:14px">${Number(cubagem.peso_total || 0).toLocaleString('pt-BR')} kg</div></div>
        <div class="tot-card"><div class="tot-label">Destino</div><div class="tot-val" style="font-size:13px">${cubagem.destino || '—'}</div></div>
    </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.focus();
}
