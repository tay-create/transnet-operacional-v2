export function gerarPdfCubagem(cubagem) {
    if (!cubagem) return;
    const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const itens = cubagem.itens || [];

    // Fallback: cubagem antiga (antes do fluxo multi-redespacho) — grava no nível do item
    const temRedespachoPorItem = itens.some(it => it.redespacho_nome && String(it.redespacho_nome).trim());
    const fallbackNome = (!temRedespachoPorItem && cubagem.redespacho && cubagem.nome_redespacho)
        ? String(cubagem.nome_redespacho).trim()
        : null;

    // Enriquece itens com redespacho resolvido + ordena (redespachos primeiro, por nome, depois diretos)
    const itensResolvidos = itens.map(it => {
        const nomeRed = (it.redespacho_nome && String(it.redespacho_nome).trim()) || fallbackNome || '';
        const ufRed = it.redespacho_uf || '';
        return { ...it, _redNome: nomeRed, _redUf: ufRed };
    }).sort((a, b) => {
        if (!a._redNome && b._redNome) return 1;
        if (a._redNome && !b._redNome) return -1;
        if (a._redNome !== b._redNome) return a._redNome.localeCompare(b._redNome);
        return String(a.numero_nf || '').localeCompare(String(b.numero_nf || ''));
    });

    const linhas = itensResolvidos.map(it => {
        const red = it._redNome
            ? `<span class="red-tag">${it._redNome}${it._redUf ? ` <span class="red-uf">${it._redUf}</span>` : ''}</span>`
            : `<span class="red-direto">DIRETO</span>`;
        return `
            <tr>
                <td class="check"></td>
                <td>${it.numero_nf || '—'}</td>
                <td>${it.uf || '—'}</td>
                <td>${red}</td>
                <td style="text-align:right">${Number(it.metragem || 0).toFixed(3)}</td>
                <td style="text-align:right">${Number(it.volumes || 0)}</td>
                <td style="text-align:right">${Number(it.peso_kg || 0).toLocaleString('pt-BR')} kg</td>
                <td style="text-align:right">${it.valor > 0 ? fmtBRL(it.valor) : '—'}</td>
            </tr>`;
    }).join('');

    const totM3 = itensResolvidos.reduce((s, it) => s + Number(it.metragem || 0), 0);
    const totVol = itensResolvidos.reduce((s, it) => s + Number(it.volumes || 0), 0);
    const totPeso = itensResolvidos.reduce((s, it) => s + Number(it.peso_kg || 0), 0);
    const totValor = itensResolvidos.reduce((s, it) => s + Number(it.valor || 0), 0);

    // Resumo de redespachos (contagem por nome)
    const resumoRed = new Map();
    itensResolvidos.forEach(it => {
        const k = it._redNome || '__DIRETO__';
        resumoRed.set(k, (resumoRed.get(k) || 0) + 1);
    });
    const chipsResumo = [...resumoRed.entries()]
        .sort((a, b) => a[0] === '__DIRETO__' ? 1 : b[0] === '__DIRETO__' ? -1 : a[0].localeCompare(b[0]))
        .map(([k, qtd]) => k === '__DIRETO__'
            ? `<span class="chip chip-direto">Direto ao cliente · ${qtd} NF</span>`
            : `<span class="chip chip-red">${k} · ${qtd} NF</span>`
        ).join(' ');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cubagem Porcelana — ${cubagem.numero_coleta}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
        h2 { color: #92400e; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 10px; }
        .chips { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 700; }
        .chip-red { background: #fde68a; color: #78350f; border: 1px solid #d97706; }
        .chip-direto { background: #dbeafe; color: #1e3a8a; border: 1px solid #3b82f6; }
        table { border-collapse: collapse; width: 100%; margin-top: 4px; margin-bottom: 12px; }
        th { background: #d97706; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #fef3c7; }
        td.check { width: 22px; border: 1px solid #78350f; background: #fff !important; }
        th.check { background: #92400e; width: 22px; text-align: center; }
        .red-tag { background: #92400e; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .red-uf { background: rgba(255,255,255,0.25); padding: 1px 5px; border-radius: 3px; margin-left: 4px; font-size: 9px; }
        .red-direto { color: #1e40af; font-weight: 700; font-size: 10px; }
        .tfoot td { background: #78350f; color: #fff; font-weight: bold; }
        .totais { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
        .tot-card { background: #fef3c7; border-left: 4px solid #d97706; padding: 8px 14px; border-radius: 4px; min-width: 120px; }
        .tot-label { font-size: 10px; color: #78716c; font-weight: bold; text-transform: uppercase; }
        .tot-val { font-size: 18px; color: #92400e; font-weight: 800; }
        .conferencia { margin-top: 28px; border: 2px dashed #92400e; border-radius: 8px; padding: 14px 18px; background: #fffbeb; }
        .conferencia h3 { margin: 0 0 10px; color: #92400e; font-size: 13px; letter-spacing: 0.5px; }
        .conf-row { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 10px; }
        .conf-field { flex: 1; min-width: 180px; }
        .conf-label { font-size: 10px; color: #78716c; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
        .conf-line { border-bottom: 1px solid #78350f; height: 22px; }
        .conf-obs { border: 1px solid #78350f; border-radius: 4px; min-height: 60px; padding: 6px; background: #fff; }
        @media print { body { margin: 12px; } .no-print { display: none; } }
    </style></head><body>
    <h2>TRANSNET — Cubagem Porcelana</h2>
    <div class="meta">
        Coleta: <strong>${cubagem.numero_coleta}</strong>
        &nbsp;|&nbsp; Data: <strong>${cubagem.data || '—'}</strong>
        &nbsp;|&nbsp; Motorista: <strong>${cubagem.motorista || '—'}</strong>
        &nbsp;|&nbsp; Cliente: <strong>${cubagem.cliente || '—'}</strong>
    </div>
    <div class="chips">${chipsResumo}</div>

    <table>
        <thead>
            <tr>
                <th class="check">✓</th>
                <th>NF</th><th>UF</th><th>Redespacho</th>
                <th style="text-align:right">M³</th>
                <th style="text-align:right">Volumes</th>
                <th style="text-align:right">Peso</th>
                <th style="text-align:right">Valor</th>
            </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
            <tr class="tfoot">
                <td></td>
                <td colspan="3"><strong>TOTAL · ${itensResolvidos.length} NF(s)</strong></td>
                <td style="text-align:right"><strong>${totM3.toFixed(3)}</strong></td>
                <td style="text-align:right"><strong>${totVol}</strong></td>
                <td style="text-align:right"><strong>${totPeso.toLocaleString('pt-BR')} kg</strong></td>
                <td style="text-align:right"><strong>${fmtBRL(totValor)}</strong></td>
            </tr>
        </tfoot>
    </table>

    <div class="totais">
        <div class="tot-card"><div class="tot-label">M³ Total</div><div class="tot-val">${Number(cubagem.metragem_total || 0).toFixed(3)}</div></div>
        <div class="tot-card"><div class="tot-label">Mix</div><div class="tot-val">${Number(cubagem.valor_mix_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Kit</div><div class="tot-val">${Number(cubagem.valor_kit_total || 0).toFixed(2)}</div></div>
        <div class="tot-card"><div class="tot-label">Valor Total</div><div class="tot-val">${fmtBRL(cubagem.valor_total || 0)}</div></div>
        <div class="tot-card"><div class="tot-label">Peso Total</div><div class="tot-val" style="font-size:14px">${Number(cubagem.peso_total || 0).toLocaleString('pt-BR')} kg</div></div>
        <div class="tot-card"><div class="tot-label">Destino</div><div class="tot-val" style="font-size:13px">${cubagem.destino || '—'}</div></div>
    </div>

    <div class="conferencia">
        <h3>CONFERÊNCIA</h3>
        <div class="conf-row">
            <div class="conf-field">
                <div class="conf-label">Conferente</div>
                <div class="conf-line"></div>
            </div>
            <div class="conf-field">
                <div class="conf-label">Data / Hora</div>
                <div class="conf-line"></div>
            </div>
            <div class="conf-field">
                <div class="conf-label">Assinatura</div>
                <div class="conf-line"></div>
            </div>
        </div>
        <div class="conf-label">Observações</div>
        <div class="conf-obs"></div>
    </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.focus();
}
