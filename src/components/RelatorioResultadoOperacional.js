import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { BarChart3, RefreshCw, Printer, TrendingUp } from 'lucide-react';
import api from '../services/apiService';

const COR_VEICULO = { carreta: '#3b82f6', truck: '#f59e0b', tresQuartos: '#8b5cf6' };
const COR_MIX = { plastico: '#3b82f6', porcelana: '#ec4899', consolidado: '#06b6d4', eletrik: '#10b981' };
const COR_REGIAO = { NORDESTE: '#1e40af', SUL: '#0369a1', SUDESTE: '#0891b2', 'C.OESTE': '#0e7490', NORTE: '#155e75' };

const s = {
    card: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 24px' },
    titulo: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', marginBottom: '16px' },
};

const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

const TooltipCustom = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#f1f5f9' }}>
            <div style={{ color: '#94a3b8', fontWeight: '700' }}>{payload[0]?.name}</div>
            <div style={{ color: payload[0]?.fill }}>{payload[0]?.value} &nbsp;·&nbsp; {pct(payload[0]?.value, payload[0]?.payload?.total)}%</div>
        </div>
    );
};

const PizzaLegenda = ({ dados, cores }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        {dados.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cores[d.name], flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{d.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginLeft: 'auto' }}>{d.value}</span>
                <span style={{ fontSize: '11px', color: '#64748b', width: '38px', textAlign: 'right' }}>{pct(d.value, d.total)}%</span>
            </div>
        ))}
    </div>
);

export default function RelatorioResultadoOperacional() {
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);
    const [mes, setMes] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    });

    const buscar = useCallback(async () => {
        setCarregando(true);
        setErro(null);
        try {
            const res = await api.get('/api/resultado-operacional');
            setDados(res.data);
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao carregar dados');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { buscar(); }, [buscar]);

    const imprimir = () => {
        if (!dados) return;
        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' });

        const veiculoRows = [
            { label: 'CARRETA', val: dados.veiculos.carreta, cor: COR_VEICULO.carreta },
            { label: 'TRUCK', val: dados.veiculos.truck, cor: COR_VEICULO.truck },
            { label: '3/4', val: dados.veiculos.tresQuartos, cor: COR_VEICULO.tresQuartos },
        ].map(r => {
            const p = pct(r.val, dados.veiculos.total);
            return `<tr><td><span class="dot" style="background:${r.cor}"></span>${r.label}</td><td><div class="bar-wrap"><div class="bar-fill" style="width:${p}%;background:${r.cor}"></div></div></td><td class="num">${r.val}</td><td class="pct">${p}%</td></tr>`;
        }).join('');

        const mixRows = [
            { label: 'PLÁSTICO', val: dados.mix.plastico, cor: COR_MIX.plastico },
            { label: 'CONSOLIDADO', val: dados.mix.consolidado, cor: COR_MIX.consolidado },
            { label: 'PORCELANA', val: dados.mix.porcelana, cor: COR_MIX.porcelana },
            { label: 'ELETRIK', val: dados.mix.eletrik, cor: COR_MIX.eletrik },
        ].map(r => {
            const p = pct(r.val, dados.mix.total);
            return `<tr><td><span class="dot" style="background:${r.cor}"></span>${r.label}</td><td><div class="bar-wrap"><div class="bar-fill" style="width:${p}%;background:${r.cor}"></div></div></td><td class="num">${r.val}</td><td class="pct">${p}%</td></tr>`;
        }).join('');

        const regiaoRows = dados.regioes.map(r => {
            const cor = COR_REGIAO[r.regiao] || '#3b82f6';
            const p = pct(r.entregas, dados.totais.entregas);
            return `<tr>
                <td style="font-weight:700;color:#1e3a5f">${r.regiao}</td>
                <td class="num">${r.entregas}</td>
                <td class="num" style="color:#3b82f6">${r.carreta}</td>
                <td class="num" style="color:#f59e0b">${r.truck}</td>
                <td class="num" style="color:#8b5cf6">${r.tresQuartos}</td>
                <td><div class="bar-wrap"><div class="bar-fill" style="width:${p}%;background:${cor}"></div></div></td>
                <td class="pct">${p}%</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Resultado Operacional</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 12px; }
  .page { padding: 28px 36px; }
  .page-break { page-break-before: always; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
  .header-left h1 { font-size: 24px; font-weight: 900; color: #1e40af; letter-spacing: -0.5px; }
  .header-left h2 { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 2px; }
  .header-right { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 10px; margin-top: 18px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .kpi-box { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #1e40af; border-radius: 8px; padding: 14px 18px; }
  .kpi-num { font-size: 40px; font-weight: 900; color: #1e40af; line-height: 1; }
  .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
  .kpi-sub { font-size: 11px; color: #64748b; margin-top: 6px; line-height: 1.8; }
  .kpi-sub b { color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { padding: 7px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
  td.num { font-weight: 700; color: #1e40af; text-align: right; width: 45px; }
  td.pct { color: #64748b; text-align: right; width: 48px; }
  .bar-wrap { background: #e2e8f0; border-radius: 4px; height: 10px; width: 100%; }
  .bar-fill { height: 10px; border-radius: 4px; min-width: 2px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { @page { margin: 10mm 8mm; size: A4 landscape; } }
</style>
</head>
<body>

<!-- PÁGINA 1: KPIs + Veículos + Mix -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>RESULTADO OPERACIONAL</h1>
      <h2>${mes}</h2>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}<br/><span>Página 1 de 2</span></div>
  </div>

  <div class="grid-3" style="margin-bottom:20px">
    <div class="kpi-box">
      <div class="kpi-label">Total de Embarques</div>
      <div class="kpi-num">${dados.veiculos.total}</div>
      <div class="kpi-sub">
        <b>${dados.veiculos.carreta}</b> Carreta &nbsp;·&nbsp;
        <b>${dados.veiculos.truck}</b> Truck &nbsp;·&nbsp;
        <b>${dados.veiculos.tresQuartos}</b> 3/4
      </div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Total de Entregas</div>
      <div class="kpi-num">${dados.totais.entregas}</div>
      <div class="kpi-sub">Soma de todas as regiões</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Mix de Operação</div>
      <div class="kpi-num">${dados.mix.total}</div>
      <div class="kpi-sub">
        <b>${dados.mix.plastico}</b> Plástico &nbsp;·&nbsp;
        <b>${dados.mix.consolidado}</b> Consol. &nbsp;·&nbsp;
        <b>${dados.mix.porcelana}</b> Porc. &nbsp;·&nbsp;
        <b>${dados.mix.eletrik}</b> Eletrik
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="section-title">Tipo de Veículo</div>
      <table>
        <thead><tr><th>Veículo</th><th></th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${veiculoRows}</tbody>
      </table>
    </div>
    <div>
      <div class="section-title">Mix de Operação</div>
      <table>
        <thead><tr><th>Operação</th><th></th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${mixRows}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <span>Transnet Logística — Resultado Operacional</span>
    <span>${mes}</span>
  </div>
</div>

<!-- PÁGINA 2: Entregas por Região -->
<div class="page page-break">
  <div class="header">
    <div class="header-left">
      <h1>RESULTADO OPERACIONAL</h1>
      <h2>${mes}</h2>
    </div>
    <div class="header-right">Transnet Logística<br/>Gerado em ${geradoEm}<br/><span>Página 2 de 2</span></div>
  </div>

  <div class="section-title">Entregas por Região × Tipo de Veículo</div>
  <table>
    <thead>
      <tr>
        <th>Região</th>
        <th style="text-align:right">Entregas</th>
        <th style="text-align:right;color:#3b82f6">Carreta</th>
        <th style="text-align:right;color:#f59e0b">Truck</th>
        <th style="text-align:right;color:#8b5cf6">3/4</th>
        <th></th>
        <th style="text-align:right">%</th>
      </tr>
    </thead>
    <tbody>${regiaoRows}</tbody>
  </table>

  <div class="footer">
    <span>Transnet Logística — Resultado Operacional</span>
    <span>${mes}</span>
  </div>
</div>

</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        iframe.contentWindow.focus();
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1500); }, 800);
    };

    if (!dados && carregando) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px', color: '#64748b' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando dados da planilha...
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (erro) return (
        <div style={{ textAlign: 'center', padding: '48px', color: '#f87171', fontSize: '14px' }}>
            {erro}
            <br /><button onClick={buscar} style={{ marginTop: '12px', padding: '8px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
    );

    if (!dados) return null;

    const { veiculos, mix, regioes, totais } = dados;

    const dadosVeiculo = [
        { name: 'carreta', label: 'CARRETA', value: veiculos.carreta, total: veiculos.total },
        { name: 'truck', label: 'TRUCK', value: veiculos.truck, total: veiculos.total },
        { name: 'tresQuartos', label: '3/4', value: veiculos.tresQuartos, total: veiculos.total },
    ].filter(d => d.value > 0);

    const dadosMix = [
        { name: 'plastico', label: 'PLÁSTICO', value: mix.plastico, total: mix.total },
        { name: 'consolidado', label: 'CONSOLIDADO', value: mix.consolidado, total: mix.total },
        { name: 'porcelana', label: 'PORCELANA', value: mix.porcelana, total: mix.total },
        { name: 'eletrik', label: 'ELETRIK', value: mix.eletrik, total: mix.total },
    ].filter(d => d.value > 0);

    const dadosRegiao = [...regioes].sort((a, b) => b.entregas - a.entregas);

    return (
        <div style={{ padding: '10px 0' }}>

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <TrendingUp size={22} color="#3b82f6" />
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>Resultado Operacional</span>
                {carregando && <RefreshCw size={15} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        value={mes}
                        onChange={e => setMes(e.target.value)}
                        placeholder="Ex: ABRIL 2026"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', color: '#f1f5f9', fontSize: '12px', outline: 'none', width: '140px' }}
                    />
                    <button onClick={buscar} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                        <RefreshCw size={13} /> Atualizar
                    </button>
                    <button onClick={imprimir} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600' }}>
                        <Printer size={13} /> Imprimir
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                    { label: 'Total de Embarques', valor: veiculos.total, cor: '#3b82f6', sub: `${veiculos.carreta} Carreta · ${veiculos.truck} Truck · ${veiculos.tresQuartos} 3/4` },
                    { label: 'Total de Entregas', valor: totais.entregas, cor: '#06b6d4', sub: 'Soma de todas as regiões' },
                    { label: 'Mix de Operação', valor: mix.total, cor: '#10b981', sub: `${mix.plastico} Plástico · ${mix.consolidado} Consol. · ${mix.porcelana} Porc. · ${mix.eletrik} Eletrik` },
                ].map(k => (
                    <div key={k.label} style={{ ...s.card, borderLeft: `4px solid ${k.cor}` }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px' }}>{k.label}</div>
                        <div style={{ fontSize: '48px', fontWeight: '900', color: k.cor, lineHeight: 1 }}>{k.valor}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Pizzas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Pizza Veículo */}
                <div style={s.card}>
                    <div style={s.titulo}>Tipo de Veículo</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <PieChart width={160} height={160}>
                            <Pie data={dadosVeiculo} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" nameKey="label" paddingAngle={2}>
                                {dadosVeiculo.map(d => <Cell key={d.name} fill={COR_VEICULO[d.name]} />)}
                            </Pie>
                            <Tooltip content={<TooltipCustom />} />
                        </PieChart>
                        <PizzaLegenda dados={dadosVeiculo} cores={COR_VEICULO} labelKey="label" />
                    </div>
                </div>

                {/* Pizza Mix */}
                <div style={s.card}>
                    <div style={s.titulo}>Mix de Operação</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <PieChart width={160} height={160}>
                            <Pie data={dadosMix} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" nameKey="label" paddingAngle={2}>
                                {dadosMix.map(d => <Cell key={d.name} fill={COR_MIX[d.name]} />)}
                            </Pie>
                            <Tooltip content={<TooltipCustom />} />
                        </PieChart>
                        <PizzaLegenda dados={dadosMix} cores={COR_MIX} labelKey="label" />
                    </div>
                </div>
            </div>

            {/* Gráfico Regiões */}
            <div style={s.card}>
                <div style={s.titulo}>Entregas por Região × Tipo de Veículo</div>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dadosRegiao} margin={{ top: 20, right: 20, left: -10, bottom: 4 }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <XAxis dataKey="regiao" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<TooltipCustom />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Bar dataKey="carreta" name="Carreta" fill={COR_VEICULO.carreta} radius={[4, 4, 0, 0]} maxBarSize={32}>
                            <LabelList dataKey="carreta" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                        <Bar dataKey="truck" name="Truck" fill={COR_VEICULO.truck} radius={[4, 4, 0, 0]} maxBarSize={32}>
                            <LabelList dataKey="truck" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                        <Bar dataKey="tresQuartos" name="3/4" fill={COR_VEICULO.tresQuartos} radius={[4, 4, 0, 0]} maxBarSize={32}>
                            <LabelList dataKey="tresQuartos" position="top" style={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                {/* Tabela abaixo do gráfico */}
                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5, auto)', gap: '0', fontSize: '11px' }}>
                        {[
                            { label: 'REGIÃO', style: { color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' } },
                            { label: 'ENTREGAS', style: { color: '#64748b', fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: 'CARRETA', style: { color: COR_VEICULO.carreta, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: 'TRUCK', style: { color: COR_VEICULO.truck, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: '3/4', style: { color: COR_VEICULO.tresQuartos, fontWeight: '700', textAlign: 'right', paddingRight: '20px' } },
                            { label: '%', style: { color: '#64748b', fontWeight: '700', textAlign: 'right' } },
                        ].map(h => <div key={h.label} style={{ padding: '6px 10px', borderBottom: '2px solid rgba(255,255,255,0.08)', ...h.style }}>{h.label}</div>)}
                        {dadosRegiao.map(r => [
                            <div key={`${r.regiao}-n`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: '700', color: '#f1f5f9' }}>{r.regiao}</div>,
                            <div key={`${r.regiao}-e`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', fontWeight: '700', color: '#06b6d4' }}>{r.entregas}</div>,
                            <div key={`${r.regiao}-c`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.carreta, fontWeight: '700' }}>{r.carreta}</div>,
                            <div key={`${r.regiao}-t`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.truck, fontWeight: '700' }}>{r.truck}</div>,
                            <div key={`${r.regiao}-q`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', paddingRight: '20px', color: COR_VEICULO.tresQuartos, fontWeight: '700' }}>{r.tresQuartos}</div>,
                            <div key={`${r.regiao}-p`} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', color: '#64748b' }}>{pct(r.entregas, totais.entregas)}%</div>,
                        ])}
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
