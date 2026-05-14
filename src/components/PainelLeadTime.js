import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { TrendingUp, Truck, FileText, Filter, RefreshCw, Map as MapIcon } from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';
import BarrasClassificacao from './lead-time/BarrasClassificacao';
import MapaLeadTime from './lead-time/MapaLeadTime';

const CARGOS_RELATORIO = ['Coordenador', 'Planejamento', 'Direção', 'Desenvolvedor'];

const NOME_REGIAO = {
    N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul',
};

export default function PainelLeadTime() {
    const user = useAuthStore(state => state.user);
    const podeGerarRelatorio = CARGOS_RELATORIO.includes(user?.cargo);

    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState(null);
    const [ufFiltro, setUfFiltro] = useState(null);
    const [regiaoFiltro, setRegiaoFiltro] = useState(null);

    const carregar = async () => {
        setCarregando(true);
        setErro(null);
        try {
            const res = await api.get('/api/lead-time-operacional');
            if (res.data?.success) setDados(res.data);
            else setErro('Resposta inválida do servidor.');
        } catch (e) {
            setErro(e.response?.data?.message || e.message || 'Falha ao carregar.');
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => { carregar(); }, []);

    const linhasFiltradas = useMemo(() => {
        if (!dados?.linhas) return [];
        return dados.linhas.filter(l => {
            if (ufFiltro && l.uf !== ufFiltro) return false;
            if (regiaoFiltro && l.regiao !== regiaoFiltro) return false;
            return true;
        });
    }, [dados, ufFiltro, regiaoFiltro]);

    // Recalcula totais a partir das linhas filtradas (cliente)
    const totaisFiltrados = useMemo(() => {
        const z = () => ({ antecipado: 0, dentro: 0, fora: 0, aguardando: 0, total: 0, somaDias: 0 });
        const T = z(), M = z();
        for (const l of linhasFiltradas) {
            const acc = (agg, c) => {
                agg.total += 1;
                if (c === 'ANTECIPADO') agg.antecipado += 1;
                else if (c === 'DENTRO') agg.dentro += 1;
                else if (c === 'FORA') agg.fora += 1;
                else agg.aguardando += 1;
                if (typeof l.diasUteis === 'number') agg.somaDias += l.diasUteis;
            };
            acc(T, l.classTransnet);
            acc(M, l.classTramontina);
        }
        const fim = (a) => {
            const c = a.antecipado + a.dentro + a.fora;
            return { ...a, mediaDias: c > 0 ? Number((a.somaDias / c).toFixed(2)) : null };
        };
        return { transnet: fim(T), tramontina: fim(M) };
    }, [linhasFiltradas]);

    // Recalcula porUF/porRegiao a partir das linhas filtradas
    const agregadosFiltrados = useMemo(() => {
        const porUF = {};
        const porRegiao = {};
        for (const l of linhasFiltradas) {
            if (l.uf) {
                if (!porUF[l.uf]) porUF[l.uf] = { antecipado: 0, dentro: 0, fora: 0, aguardando: 0, total: 0 };
                porUF[l.uf].total += 1;
                if (l.classTransnet === 'ANTECIPADO') porUF[l.uf].antecipado += 1;
                else if (l.classTransnet === 'DENTRO') porUF[l.uf].dentro += 1;
                else if (l.classTransnet === 'FORA') porUF[l.uf].fora += 1;
                else porUF[l.uf].aguardando += 1;
            }
            if (l.regiao) {
                if (!porRegiao[l.regiao]) porRegiao[l.regiao] = { antecipado: 0, dentro: 0, fora: 0, aguardando: 0, total: 0 };
                porRegiao[l.regiao].total += 1;
                if (l.classTramontina === 'ANTECIPADO') porRegiao[l.regiao].antecipado += 1;
                else if (l.classTramontina === 'DENTRO') porRegiao[l.regiao].dentro += 1;
                else if (l.classTramontina === 'FORA') porRegiao[l.regiao].fora += 1;
                else porRegiao[l.regiao].aguardando += 1;
            }
        }
        return { porUF, porRegiao };
    }, [linhasFiltradas]);

    const gerarRelatorioPDF = () => {
        if (!linhasFiltradas.length) return;
        // A4 paisagem, mm — 297 x 210. Uma página, gráficos + totais.
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = 297, H = 210;
        const COR = { ANTECIPADO: '#22c55e', DENTRO: '#3b82f6', FORA: '#ef4444', AGUARDANDO: '#64748b' };

        // Header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, W, 20, 'F');
        doc.setTextColor(241, 245, 249);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('LEAD TIME OPERACIONAL', 10, 13);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const sub = `${dados?.mes ? `Mês ${dados.mes}` : ''}${ufFiltro ? ` · UF ${ufFiltro}` : ''}${regiaoFiltro ? ` · Região ${NOME_REGIAO[regiaoFiltro]}` : ''}`;
        doc.text(sub, 10, 17.5);
        const dataGer = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        doc.text(`Gerado em ${dataGer} · ${user?.nome || ''}`, W - 10, 17.5, { align: 'right' });

        // KPIs (linha de 4 caixas)
        const kpiY = 26;
        const kpiH = 22;
        const kpis = [
            { label: 'TOTAL ENTREGAS', valor: linhasFiltradas.length, cor: '#60a5fa' },
            { label: 'ANTECIPADO (Transnet)', valor: totaisFiltrados.transnet.antecipado, cor: COR.ANTECIPADO },
            { label: 'DENTRO DO LEAD TIME (Transnet)', valor: totaisFiltrados.transnet.dentro, cor: COR.DENTRO },
            { label: 'FORA DO LEAD TIME (Transnet)', valor: totaisFiltrados.transnet.fora, cor: COR.FORA },
        ];
        const kpiGap = 4;
        const kpiW = (W - 20 - kpiGap * (kpis.length - 1)) / kpis.length;
        kpis.forEach((k, i) => {
            const x = 10 + i * (kpiW + kpiGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'FD');
            // Barra colorida lateral
            const c = hexToRgb(k.cor);
            doc.setFillColor(c.r, c.g, c.b);
            doc.rect(x, kpiY, 1.6, kpiH, 'F');
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(k.label, x + 4, kpiY + 5.5);
            doc.setTextColor(c.r, c.g, c.b);
            doc.setFontSize(18);
            doc.text(String(k.valor), x + 4, kpiY + 16);
        });

        // Função de desenhar barras horizontais com totais
        const desenharGraficoBarras = (titulo, totais, x, y, w, h) => {
            // Título
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(titulo, x, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${totais.total || 0} entregas${totais.mediaDias != null ? ` · média ${totais.mediaDias}d` : ''}`, x + w, y, { align: 'right' });

            const yTop = y + 4;
            const itens = [
                { label: 'ANTECIPADO',           valor: totais.antecipado, cor: COR.ANTECIPADO },
                { label: 'DENTRO DO LEAD TIME', valor: totais.dentro,     cor: COR.DENTRO },
                { label: 'FORA DO LEAD TIME',   valor: totais.fora,       cor: COR.FORA },
                ...(totais.aguardando > 0 ? [{ label: 'AGUARDANDO', valor: totais.aguardando, cor: COR.AGUARDANDO }] : []),
            ];
            const totalRef = Math.max(1, ...itens.map(i => i.valor), 1);
            const labelW = 28;
            const barAreaW = w - labelW - 26;
            const rowH = (h - 6) / itens.length;
            itens.forEach((it, i) => {
                const ry = yTop + i * rowH;
                // Label categoria
                doc.setTextColor(71, 85, 105);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(it.label, x, ry + rowH * 0.6);
                // Trilho cinza
                doc.setFillColor(241, 245, 249);
                doc.rect(x + labelW, ry + rowH * 0.25, barAreaW, rowH * 0.55, 'F');
                // Barra colorida
                const c = hexToRgb(it.cor);
                doc.setFillColor(c.r, c.g, c.b);
                const barW = barAreaW * (it.valor / totalRef);
                doc.rect(x + labelW, ry + rowH * 0.25, barW, rowH * 0.55, 'F');
                // Valor
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                const pct = totais.total > 0 ? Math.round((it.valor / totais.total) * 100) : 0;
                doc.text(`${it.valor} (${pct}%)`, x + labelW + barAreaW + 2, ry + rowH * 0.6);
            });
        };

        // Dois gráficos lado a lado
        const grY = kpiY + kpiH + 8;
        const grH = 56;
        const grW = (W - 20 - 6) / 2;
        desenharGraficoBarras('Transnet (por UF destino)', totaisFiltrados.transnet, 10, grY, grW, grH);
        desenharGraficoBarras('Tramontina (por região)', totaisFiltrados.tramontina, 10 + grW + 6, grY, grW, grH);

        // Tabela por região (Tramontina) — pequena, com fundo
        const tabY = grY + grH + 10;
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Resumo por Região (Tramontina)', 10, tabY);

        const cols = ['Região', 'Antecipado', 'Dentro', 'Fora', 'Aguard.', 'Total'];
        const tabXs = [10, 50, 90, 130, 170, 210];
        const tabRowH = 6;
        const tabHeadY = tabY + 4;
        doc.setFillColor(241, 245, 249);
        doc.rect(10, tabHeadY, 250, tabRowH, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        cols.forEach((c, i) => doc.text(c, tabXs[i] + 2, tabHeadY + 4));

        const regs = Object.entries(agregadosFiltrados.porRegiao).sort();
        regs.forEach(([reg, agg], idx) => {
            const ry = tabHeadY + tabRowH + idx * tabRowH;
            if (idx % 2 === 0) {
                doc.setFillColor(252, 253, 254);
                doc.rect(10, ry, 250, tabRowH, 'F');
            }
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(NOME_REGIAO[reg] || reg, tabXs[0] + 2, ry + 4);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(34, 197, 94);  doc.text(String(agg.antecipado),  tabXs[1] + 2, ry + 4);
            doc.setTextColor(59, 130, 246); doc.text(String(agg.dentro),       tabXs[2] + 2, ry + 4);
            doc.setTextColor(239, 68, 68);  doc.text(String(agg.fora),         tabXs[3] + 2, ry + 4);
            doc.setTextColor(100, 116, 139); doc.text(String(agg.aguardando),  tabXs[4] + 2, ry + 4);
            doc.setTextColor(15, 23, 42);   doc.text(String(agg.total),        tabXs[5] + 2, ry + 4);
        });

        // Rodapé com lead padrão usado
        const fy = H - 8;
        doc.setDrawColor(226, 232, 240);
        doc.line(10, fy - 3, W - 10, fy - 3);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Lead Transnet: dias úteis padrão por UF destino (PE→UF). Lead Tramontina: dias úteis padrão por região.', 10, fy);
        doc.text(`Página 1/1 · Lead Time Operacional`, W - 10, fy, { align: 'right' });

        const nome = `lead-time-${dados?.mes || 'atual'}${ufFiltro ? `-${ufFiltro}` : ''}${regiaoFiltro ? `-${regiaoFiltro}` : ''}.pdf`;
        doc.save(nome);
    };

    const limparFiltros = () => { setUfFiltro(null); setRegiaoFiltro(null); };

    if (carregando) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando lead time…</div>;
    }
    if (erro) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>{erro}</div>;
    }

    return (
        <div style={{ padding: '16px 20px', color: '#e2e8f0' }}>
            <style>{`
                .pl-table th, .pl-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .pl-table th { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .lead-time-tooltip { background: #0f172a !important; color: #e2e8f0 !important; border: 1px solid rgba(255,255,255,0.12) !important; font-size: 11px; }
            `}</style>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TrendingUp size={22} color="#60a5fa" />
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>LEAD TIME OPERACIONAL</h1>
                    {dados?.mes && <span style={{ fontSize: 12, color: '#64748b', background: 'rgba(96,165,250,0.1)', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>{dados.mes}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(ufFiltro || regiaoFiltro) && (
                        <button onClick={limparFiltros} style={btnGhost}>
                            <Filter size={13} /> Limpar filtros{ufFiltro ? ` (${ufFiltro})` : ''}{regiaoFiltro ? ` (${NOME_REGIAO[regiaoFiltro]})` : ''}
                        </button>
                    )}
                    <button onClick={carregar} style={btnGhost} title="Recarregar dados">
                        <RefreshCw size={13} /> Atualizar
                    </button>
                    {podeGerarRelatorio && (
                        <button onClick={gerarRelatorioPDF} disabled={!linhasFiltradas.length} style={btnPrimario}>
                            <FileText size={13} /> Gerar relatório PDF
                        </button>
                    )}
                </div>
            </div>

            {/* KPIs topo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                <Kpi titulo="Total Entregas" valor={linhasFiltradas.length} sub={dados?.mes} cor="#60a5fa" icone={<Truck size={16} />} />
                <Kpi titulo="Fora do Lead Time (Transnet)" valor={totaisFiltrados.transnet.fora} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.fora / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#ef4444" />
                <Kpi titulo="Dentro do Lead Time (Transnet)" valor={totaisFiltrados.transnet.dentro} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.dentro / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#3b82f6" />
                <Kpi titulo="Antecipado (Transnet)" valor={totaisFiltrados.transnet.antecipado} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.antecipado / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#22c55e" />
            </div>

            {/* Mapa em cima */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                    <MapIcon size={14} /> MAPA — clique num estado para filtrar
                </div>
                <MapaLeadTime
                    porUF={agregadosFiltrados.porUF}
                    ufSelecionada={ufFiltro}
                    onClickUF={(sigla) => setUfFiltro(prev => prev === sigla ? null : sigla)}
                    height={420}
                />
            </div>

            {/* Barras embaixo (verticais — de baixo para cima) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <BarrasClassificacao titulo="Lead Time — Transnet (por UF destino)" totais={totaisFiltrados.transnet} orientacao="vertical" />
                <BarrasClassificacao titulo="Lead Time — Tramontina (por região)" totais={totaisFiltrados.tramontina} orientacao="vertical" />
            </div>

            {/* Tabela região */}
            <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Resumo por Região (Tramontina)</h3>
                <table className="pl-table" style={tabela}>
                    <thead>
                        <tr><th>Região</th><th>Antecipado</th><th>Dentro</th><th>Fora</th><th>Aguardando</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                        {Object.entries(agregadosFiltrados.porRegiao).sort().map(([reg, agg]) => (
                            <tr key={reg} onClick={() => setRegiaoFiltro(prev => prev === reg ? null : reg)} style={{ cursor: 'pointer', background: regiaoFiltro === reg ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                                <td><strong>{NOME_REGIAO[reg] || reg}</strong></td>
                                <td style={{ color: '#22c55e' }}>{agg.antecipado}</td>
                                <td style={{ color: '#3b82f6' }}>{agg.dentro}</td>
                                <td style={{ color: '#ef4444' }}>{agg.fora}</td>
                                <td style={{ color: '#64748b' }}>{agg.aguardando}</td>
                                <td>{agg.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Tabela amostra (200 linhas) */}
            <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Entregas ({linhasFiltradas.length})</h3>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table className="pl-table" style={tabela}>
                        <thead style={{ position: 'sticky', top: 0, background: '#0f172a' }}>
                            <tr><th>Rota</th><th>Cidade</th><th>UF</th><th>Região</th><th>Embarque</th><th>Agendamento</th><th>Dias</th><th>Transnet</th><th>Tramontina</th></tr>
                        </thead>
                        <tbody>
                            {linhasFiltradas.slice(0, 500).map((l, i) => (
                                <tr key={i}>
                                    <td>{l.rota}</td>
                                    <td>{l.cidade}</td>
                                    <td>{l.uf}</td>
                                    <td>{l.regiao ? NOME_REGIAO[l.regiao] : ''}</td>
                                    <td>{l.embarque || '—'}</td>
                                    <td>{l.agendamento || '—'}</td>
                                    <td>{l.diasUteis ?? '—'}</td>
                                    <td style={{ color: corClasse(l.classTransnet) }}>{l.classTransnet}</td>
                                    <td style={{ color: corClasse(l.classTramontina) }}>{l.classTramontina}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {linhasFiltradas.length > 500 && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Mostrando 500 de {linhasFiltradas.length}. Exporte o XLSX para a lista completa.</div>
                )}
            </div>
        </div>
    );
}

function corClasse(c) {
    if (c === 'ANTECIPADO') return '#22c55e';
    if (c === 'DENTRO')     return '#3b82f6';
    if (c === 'FORA')       return '#ef4444';
    return '#64748b';
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
    };
}

function Kpi({ titulo, valor, sub, cor, icone }) {
    return (
        <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 14, borderLeft: `3px solid ${cor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{titulo}</span>
                {icone}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: cor, lineHeight: 1 }}>{valor}</div>
            {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

const btnGhost = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.05)', color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};

const btnPrimario = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(34,197,94,0.15)', color: '#4ade80',
    border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6,
    padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};

const tabela = {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
};
