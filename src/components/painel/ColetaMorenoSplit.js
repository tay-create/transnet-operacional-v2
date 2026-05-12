import React from 'react';
import TagInput from '../TagInput';
import { parseColetaMoreno, joinColetaMoreno, opTemPlastico, opTemPorcelana, opTemEletrik } from '../../utils/coletaMoreno';

const SUB_STYLES_CARD = {
    plastico: { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)', badgeBg: 'rgba(148,163,184,0.22)', text: '#cbd5e1', badgeBorder: 'rgba(148,163,184,0.45)', label: 'PLÁSTICO' },
    porcelana: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', badgeBg: 'rgba(168,85,247,0.2)', text: '#c084fc', badgeBorder: 'rgba(168,85,247,0.4)', label: 'PORCELANA' },
    eletrik:   { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)', badgeBg: 'rgba(6,182,212,0.2)', text: '#22d3ee', badgeBorder: 'rgba(6,182,212,0.4)', label: 'ELETRIK' },
};

export default function ColetaMorenoSplit({ valor, operacao, onChange, disabled }) {
    const parsed = parseColetaMoreno(valor, operacao);
    const showPlas = opTemPlastico(operacao);
    const showPorc = opTemPorcelana(operacao);
    const showElet = opTemEletrik(operacao);
    const upd = (parte, val) => {
        const atual = { ...parsed, [parte]: val };
        onChange(joinColetaMoreno(atual));
    };
    const Sub = ({ parte }) => {
        const s = SUB_STYLES_CARD[parte];
        return (
            <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '8px', fontWeight: '800', letterSpacing: '0.4px', padding: '1px 6px', borderRadius: '3px', background: s.badgeBg, color: s.text, border: `1px solid ${s.badgeBorder}` }}>{s.label}</span>
                </div>
                <TagInput value={parsed[parte]} onChange={v => upd(parte, v)} disabled={disabled} />
            </div>
        );
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {showPlas && <Sub parte="plastico" />}
            {showPorc && <Sub parte="porcelana" />}
            {showElet && <Sub parte="eletrik" />}
        </div>
    );
}
