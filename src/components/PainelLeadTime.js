import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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

    const gerarRelatorioXLSX = () => {
        if (!linhasFiltradas.length) return;
        const wb = XLSX.utils.book_new();
        const dataRows = linhasFiltradas.map(l => ({
            Rota: l.rota,
            Cidade: l.cidade,
            UF: l.uf,
            Região: l.regiao ? NOME_REGIAO[l.regiao] || l.regiao : '',
            'Data Embarque': l.embarque || '',
            'Data Agendamento': l.agendamento || '',
            'Dias Úteis': l.diasUteis ?? '',
            'Lead Transnet': l.leadPadraoTransnet ?? '',
            'Lead Tramontina': l.leadPadraoTramontina ?? '',
            'Classificação Transnet': l.classTransnet,
            'Classificação Tramontina': l.classTramontina,
        }));
        const ws = XLSX.utils.json_to_sheet(dataRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Lead Time');

        const totaisAba = [
            { Categoria: 'TRANSNET', Antecipado: totaisFiltrados.transnet.antecipado, Dentro: totaisFiltrados.transnet.dentro, Fora: totaisFiltrados.transnet.fora, Aguardando: totaisFiltrados.transnet.aguardando, Total: totaisFiltrados.transnet.total, 'Média Dias': totaisFiltrados.transnet.mediaDias ?? '' },
            { Categoria: 'TRAMONTINA', Antecipado: totaisFiltrados.tramontina.antecipado, Dentro: totaisFiltrados.tramontina.dentro, Fora: totaisFiltrados.tramontina.fora, Aguardando: totaisFiltrados.tramontina.aguardando, Total: totaisFiltrados.tramontina.total, 'Média Dias': totaisFiltrados.tramontina.mediaDias ?? '' },
        ];
        const wsTot = XLSX.utils.json_to_sheet(totaisAba);
        XLSX.utils.book_append_sheet(wb, wsTot, 'Totais');

        const nome = `lead-time-${dados?.mes || 'atual'}${ufFiltro ? `-${ufFiltro}` : ''}${regiaoFiltro ? `-${regiaoFiltro}` : ''}.xlsx`;
        XLSX.writeFile(wb, nome);
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
                        <button onClick={gerarRelatorioXLSX} disabled={!linhasFiltradas.length} style={btnPrimario}>
                            <FileText size={13} /> Gerar relatório XLSX
                        </button>
                    )}
                </div>
            </div>

            {/* KPIs topo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                <Kpi titulo="Total Entregas" valor={linhasFiltradas.length} sub={dados?.mes} cor="#60a5fa" icone={<Truck size={16} />} />
                <Kpi titulo="Fora do Lead (Transnet)" valor={totaisFiltrados.transnet.fora} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.fora / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#ef4444" />
                <Kpi titulo="Dentro do Lead (Transnet)" valor={totaisFiltrados.transnet.dentro} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.dentro / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#3b82f6" />
                <Kpi titulo="Antecipado (Transnet)" valor={totaisFiltrados.transnet.antecipado} sub={`${totaisFiltrados.transnet.total > 0 ? ((totaisFiltrados.transnet.antecipado / totaisFiltrados.transnet.total) * 100).toFixed(0) : 0}% do total`} cor="#22c55e" />
            </div>

            {/* Barras e mapa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(420px, 1.2fr)', gap: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <BarrasClassificacao titulo="Lead Time — Transnet (por UF destino)" totais={totaisFiltrados.transnet} />
                    <BarrasClassificacao titulo="Lead Time — Tramontina (por região)" totais={totaisFiltrados.tramontina} />
                </div>
                <div>
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
