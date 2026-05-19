import React from 'react';
import { formatBRL } from '../../utils/formatBRL';

function KpiCard({ label, value, color = '#94a3b8', highlight = false }) {
    return (
        <div style={{
            background: highlight ? 'rgba(167,139,250,0.12)' : 'rgba(30,41,59,0.6)',
            border: `1px solid ${highlight ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8,
            padding: '10px 14px',
            minWidth: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}>
            <span style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
            <span style={{ color, fontSize: 18, fontWeight: 700 }}>{value}</span>
        </div>
    );
}

export default function KpisStrip({ kpis = {}, abaAtiva = 'DELTA-PORCELANA' }) {
    const rotas = kpis.rotas || {};
    const lead = kpis.leadTime || {};
    const financeiro = kpis.financeiro || null;
    return (
        <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
            overflowX: 'auto',
            paddingBottom: 4,
        }}>
            <KpiCard label="Total rotas" value={rotas.total ?? 0} />
            <KpiCard label="Programadas" value={rotas.programadas ?? 0} color="#60a5fa" />
            <KpiCard label="Embarcadas" value={rotas.embarcadas ?? 0} color="#4ade80" />
            <KpiCard label="Pendentes" value={rotas.pendentes ?? 0} color="#fbbf24" />
            <KpiCard label="Antecipadas" value={lead.antecipado ?? 0} color="#a78bfa" />
            <KpiCard label="Dentro" value={lead.dentro ?? 0} color="#60a5fa" />
            <KpiCard label="Fora" value={lead.fora ?? 0} color="#f87171" />

            {abaAtiva === 'ELETRIK' && financeiro && (
                <>
                    <KpiCard label="R$ Mercadoria" value={formatBRL(financeiro.total_mercadoria)} color="#a78bfa" highlight />
                    <KpiCard label="R$ Frete" value={formatBRL(financeiro.total_frete)} color="#a78bfa" highlight />
                    <KpiCard label="Repres. média" value={`${(financeiro.repres_media ?? 0).toFixed(2)}%`} color="#a78bfa" highlight />
                </>
            )}
        </div>
    );
}
