import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';

const CORES = {
    ANTECIPADO: '#22c55e',   // verde
    DENTRO:     '#3b82f6',   // azul
    FORA:       '#ef4444',   // vermelho
    AGUARDANDO: '#64748b',   // cinza
};

// Recebe { titulo, totais: { antecipado, dentro, fora, aguardando, total, mediaDias }, orientacao }
// orientacao: 'vertical' (default — barras crescem de baixo para cima) | 'horizontal' (barras crescem para direita)
export default function BarrasClassificacao({ titulo, totais, height = 260, orientacao = 'vertical' }) {
    const t = totais || { antecipado: 0, dentro: 0, fora: 0, aguardando: 0, total: 0 };
    const data = [
        { categoria: 'ANTECIPADO',           valor: t.antecipado, cor: CORES.ANTECIPADO },
        { categoria: 'DENTRO DO LEAD TIME',  valor: t.dentro,     cor: CORES.DENTRO },
        { categoria: 'FORA DO LEAD TIME',    valor: t.fora,       cor: CORES.FORA },
    ];
    if (t.aguardando > 0) data.push({ categoria: 'AGUARDANDO', valor: t.aguardando, cor: CORES.AGUARDANDO });

    const total = t.total || 1;
    const pct = (v) => ((v / total) * 100).toFixed(0);

    return (
        <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{titulo}</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>{t.total} entregas{t.mediaDias != null ? ` · média ${t.mediaDias}d` : ''}</span>
            </div>
            <ResponsiveContainer width="100%" height={height}>
                {orientacao === 'horizontal' ? (
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 0, bottom: 4 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="categoria" type="category" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} width={110} />
                        <Tooltip
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }}
                            formatter={(value, name, props) => [`${value} (${pct(value)}%)`, props.payload.categoria]}
                        />
                        <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                            {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
                            <LabelList dataKey="valor" position="right" fill="#e2e8f0" fontSize={12} fontWeight="bold" formatter={(v) => `${v} (${pct(v)}%)`} />
                        </Bar>
                    </BarChart>
                ) : (
                    <BarChart data={data} margin={{ top: 28, right: 16, left: 0, bottom: 4 }}>
                        <XAxis dataKey="categoria" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                        <YAxis hide />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }}
                            formatter={(value, name, props) => [`${value} (${pct(value)}%)`, props.payload.categoria]}
                        />
                        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                            {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
                            <LabelList dataKey="valor" position="top" fill="#e2e8f0" fontSize={12} fontWeight="bold" formatter={(v) => `${v} (${pct(v)}%)`} />
                        </Bar>
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}

export { CORES };
