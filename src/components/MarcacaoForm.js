import React, { useState, useEffect, useRef } from 'react';
import api from '../services/apiService';

const ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const TIPOS_VEICULO = ['Truck', 'Bi-Truck', 'Carreta 4 Eixos', 'Carreta 5 Eixos', 'Carreta 6 Eixos'];
const RASTREADORES = ['AUTOTRACK', 'JABOORSAT', 'OMNILINK', 'OMNISAT', 'ONIX', 'POSITRON', 'SASCAR', 'Outros'];

const s = {
    page: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '0 0 40px 0' },
    header: { background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '18px 20px', textAlign: 'center', fontSize: '18px', fontWeight: '700', color: '#60a5fa', letterSpacing: '0.5px' },
    card: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', margin: '16px auto', maxWidth: '520px' },
    label: { display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
    input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '11px 14px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    select: { width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '11px 14px', color: '#f1f5f9', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    row: { display: 'flex', gap: '12px', marginBottom: '16px' },
    field: { flex: 1, marginBottom: '16px' },
    radioGroup: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#e2e8f0' },
    estadosGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '8px' },
    estadoCb: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' },
    termoBox: { background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '14px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', maxHeight: '140px', overflowY: 'auto', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)' },
    btnPrimary: { width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' },
    btnSecondary: { padding: '10px 20px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' },
    modal: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '360px' },
    sectionTitle: { fontSize: '11px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    alertBloq: { textAlign: 'center', padding: '60px 30px', color: '#ef4444' },
    alertSuc: { textAlign: 'center', padding: '60px 30px', color: '#4ade80' },
};

export default function MarcacaoForm() {
    const token = window.location.pathname.split('/cadastro/')[1] || '';

    const [tokenInfo, setTokenInfo] = useState(null); // { telefone, tokenId }
    const [bloqueadoMsg, setBloqueadoMsg] = useState('Link inválido ou inativo.');
    const [bloqueado, setBloqueado] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [loading, setLoading] = useState(true);
    const [enviando, setEnviando] = useState(false);
    const [erroMsg, setErroMsg] = useState('');

    const [form, setForm] = useState({
        nome: '', telefone: '', placa1: '', placa2: '',
        tipo_veiculo: '', altura: '', largura: '', comprimento: '',
        estados_destino: [],
        ja_carregou: '', tem_rastreador: '',
        rastreador: '', status_rastreador: '',
        disponibilidade: '',
        termo: false
    });

    const [modalRast, setModalRast] = useState(false);
    const [temDocumento, setTemDocumento] = useState('');
    const [modalDocs, setModalDocs] = useState(false);
    const [anexos, setAnexos] = useState({ cnh: null, doc_veiculo: null, crlv_carreta: null, antt: null, outros: null });
    const latRef = useRef('');
    const lngRef = useRef('');

    useEffect(() => {
        if (!token) { setBloqueado(true); setLoading(false); return; }
        api.get(`/api/marcacoes/validar/${token}`)
            .then(res => {
                const data = res.data;
                if (data.success) {
                    setTokenInfo({ telefone: data.telefone, tokenId: data.tokenId });
                    setForm(f => ({ ...f, telefone: formatarTelefone(data.telefone) }));
                } else {
                    setBloqueadoMsg(data.message || 'Link inválido ou inativo.');
                    setBloqueado(true);
                }
            })
            .catch(() => { setBloqueadoMsg('Erro de conexão. Tente novamente mais tarde.'); setBloqueado(true); })
            .finally(() => setLoading(false));

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => { latRef.current = pos.coords.latitude; lngRef.current = pos.coords.longitude; },
                () => { }
            );
        }
    }, [token]);

    function formatarTelefone(tel) {
        const d = tel.replace(/\D/g, '').replace(/^55/, '');
        if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return tel;
    }

    function toggleEstado(uf) {
        setForm(f => {
            const atual = f.estados_destino;
            if (atual.includes(uf)) return { ...f, estados_destino: atual.filter(e => e !== uf) };
            if (atual.length >= 5) return f; // máx 5
            return { ...f, estados_destino: [...atual, uf] };
        });
    }

    function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

    function handleRadioRastreador(val) {
        set('tem_rastreador', val);
        if (val === 'Sim') setModalRast(true);
        else { set('rastreador', 'Não possui'); set('status_rastreador', 'Inativo'); }
    }

    function confirmarModal() {
        if (!form.rastreador || !form.status_rastreador) { setErroMsg('Preencha os dados do rastreador.'); return; }
        setErroMsg('');
        setModalRast(false);
    }

    function handleRadioDocumento(val) {
        setTemDocumento(val);
        if (val === 'Sim') setModalDocs(true);
        else {
            setAnexos({ cnh: null, doc_veiculo: null, crlv_carreta: null, antt: null, outros: null });
        }
    }

    function confirmarModalDocs() {
        setModalDocs(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setErroMsg('');

        if (!form.nome || !form.placa1 || !form.tipo_veiculo) {
            setErroMsg('Preencha todos os campos obrigatórios.'); return;
        }
        if (!form.termo) { setErroMsg('Você precisa aceitar os termos.'); return; }
        if (form.estados_destino.length === 0) { setErroMsg('Selecione ao menos 1 estado de destino.'); return; }
        if (!form.ja_carregou) { setErroMsg('Informe se já carregou conosco.'); return; }

        // Telefone fixo vindo do token — não editável pelo motorista
        const telNorm = tokenInfo?.telefone || '';

        setEnviando(true);
        try {
            const body = {
                token_id: tokenInfo?.tokenId,
                nome_motorista: form.nome.trim(),
                telefone: telNorm,
                placa1: form.placa1.trim().toUpperCase(),
                placa2: form.placa2.trim().toUpperCase(),
                tipo_veiculo: form.tipo_veiculo,
                altura: form.altura ? parseFloat(form.altura) : null,
                largura: form.largura ? parseFloat(form.largura) : null,
                comprimento: form.comprimento ? parseFloat(form.comprimento) : null,
                estados_destino: form.estados_destino,
                ja_carregou: form.ja_carregou,
                rastreador: form.rastreador || 'Não possui',
                status_rastreador: form.status_rastreador || 'Inativo',
                latitude: latRef.current ? String(latRef.current) : '',
                longitude: lngRef.current ? String(lngRef.current) : '',
                disponibilidade: form.disponibilidade,
                anexo_cnh: anexos.cnh || null,
                anexo_doc_veiculo: anexos.doc_veiculo || null,
                anexo_crlv_carreta: anexos.crlv_carreta || null,
                anexo_antt: anexos.antt || null,
                anexo_outros: anexos.outros || null,
            };
            const res = await api.post('/api/marcacoes', body);
            const data = res.data;
            if (data.success) setEnviado(true);
            else setErroMsg(data.message || 'Erro ao enviar.');
        } catch (err) {
            setErroMsg('Erro de conexão. Tente novamente.');
        } finally {
            setEnviando(false);
        }
    }

    if (loading) return (
        <div style={s.page}>
            <div style={s.header}>Marcação de Placas</div>
            <div style={{ ...s.alertBloq, color: '#94a3b8' }}>Verificando link...</div>
        </div>
    );

    if (bloqueado) return (
        <div style={s.page}>
            <div style={s.header}>Marcação de Placas</div>
            <div style={s.alertBloq}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Acesso Bloqueado</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>{bloqueadoMsg}</div>
            </div>
        </div>
    );

    if (enviado) return (
        <div style={s.page}>
            <div style={s.header}>Marcação de Placas</div>
            <div style={s.alertSuc}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Cadastro Enviado!</div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Suas informações foram registradas com sucesso. Este link não poderá ser reutilizado.</div>
            </div>
        </div>
    );

    return (
        <div style={s.page}>
            <div style={s.header}>Marcação de Placas — Transnet</div>

            <form onSubmit={handleSubmit}>

                {/* DADOS PRINCIPAIS */}
                <div style={s.card}>
                    <div style={s.sectionTitle}>Dados do Motorista</div>

                    <div style={s.field}>
                        <label style={s.label}>Nome do Motorista *</label>
                        <input style={s.input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" required />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Telefone (WhatsApp) *</label>
                        <input
                            style={{ ...s.input, background: 'rgba(255,255,255,0.03)', color: '#64748b', cursor: 'not-allowed' }}
                            type="tel"
                            value={form.telefone}
                            readOnly
                        />
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                            Número vinculado ao link. Não pode ser alterado.
                        </div>
                    </div>

                    <div style={s.row}>
                        <div style={s.field}>
                            <label style={s.label}>Placa 1 *</label>
                            <input style={s.input} value={form.placa1}
                                onChange={e => set('placa1', e.target.value.toUpperCase())}
                                placeholder="ABC-1234" maxLength={8} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Placa 2 (opcional)</label>
                            <input style={s.input} value={form.placa2}
                                onChange={e => set('placa2', e.target.value.toUpperCase())}
                                placeholder="ABC-1234" maxLength={8} />
                        </div>
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Já carregou conosco? *</label>
                        <div style={s.radioGroup}>
                            {['Sim', 'Nao'].map(v => (
                                <label key={v} style={s.radioLabel}>
                                    <input type="radio" name="ja_carregou" value={v}
                                        checked={form.ja_carregou === v}
                                        onChange={() => set('ja_carregou', v)} />
                                    {v === 'Nao' ? 'Não' : v}
                                </label>
                            ))}
                        </div>
                        {form.ja_carregou === 'Sim' && (
                            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                👋 Bem-vindo de volta!
                            </div>
                        )}
                        {form.ja_carregou === 'Nao' && (
                            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🚛 Seja bem-vindo à TRANSNET!
                            </div>
                        )}
                    </div>
                </div>

                {/* VEÍCULO */}
                <div style={s.card}>
                    <div style={s.sectionTitle}>Dados do Veículo</div>

                    <div style={s.field}>
                        <label style={s.label}>Tipo de Veículo *</label>
                        <select style={s.select} value={form.tipo_veiculo}
                            onChange={e => set('tipo_veiculo', e.target.value)} required>
                            <option value="">Selecione</option>
                            {TIPOS_VEICULO.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>

                    <div style={s.row}>
                        <div style={s.field}>
                            <label style={s.label}>Altura Interna (m)</label>
                            <input style={s.input} type="number" step="0.01" value={form.altura}
                                onChange={e => set('altura', e.target.value)} placeholder="2.60" />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Largura Interna (m)</label>
                            <input style={s.input} type="number" step="0.01" value={form.largura}
                                onChange={e => set('largura', e.target.value)} placeholder="2.40" />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Comprimento (m)</label>
                            <input style={s.input} type="number" step="0.01" value={form.comprimento}
                                onChange={e => set('comprimento', e.target.value)} placeholder="14.00" />
                        </div>
                    </div>
                </div>

                {/* ROTAS */}
                <div style={s.card}>
                    <div style={s.sectionTitle}>Rotas e Origem</div>

                    <div style={s.field}>
                        <label style={s.label}>Estados para onde deseja carregar (máx. 5) *</label>
                        <div style={s.estadosGrid}>
                            {ESTADOS.map(uf => (
                                <label key={uf} style={s.estadoCb}>
                                    <input type="checkbox"
                                        checked={form.estados_destino.includes(uf)}
                                        onChange={() => toggleEstado(uf)} />
                                    {uf}
                                </label>
                            ))}
                        </div>
                        {form.estados_destino.length === 5 && (
                            <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '6px' }}>Máximo de 5 estados atingido.</div>
                        )}
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Qual a sua localização? *</label>
                        <select style={s.select} value={form.disponibilidade}
                            onChange={e => set('disponibilidade', e.target.value)} required>
                            <option value="">Selecione</option>
                            <option value="EM CASA">EM CASA</option>
                            <option value="NO PÁTIO">NO PÁTIO</option>
                            <option value="NO POSTO">NO POSTO</option>
                        </select>
                    </div>
                </div>

                {/* RASTREADOR */}
                <div style={s.card}>
                    <div style={s.sectionTitle}>Rastreador</div>
                    <div style={s.field}>
                        <label style={s.label}>Possui Rastreador? *</label>
                        <div style={s.radioGroup}>
                            {['Sim', 'Nao'].map(v => (
                                <label key={v} style={s.radioLabel}>
                                    <input type="radio" name="tem_rastreador" value={v}
                                        checked={form.tem_rastreador === v}
                                        onChange={() => handleRadioRastreador(v)} />
                                    {v === 'Nao' ? 'Não' : v}
                                </label>
                            ))}
                        </div>
                    </div>
                    {form.tem_rastreador === 'Sim' && form.rastreador && (
                        <div style={{ fontSize: '13px', color: '#4ade80', marginTop: '-8px' }}>
                            {form.rastreador} — {form.status_rastreador}
                            <button type="button" onClick={() => setModalRast(true)}
                                style={{ ...s.btnSecondary, padding: '4px 12px', marginLeft: '10px', fontSize: '12px' }}>
                                Alterar
                            </button>
                        </div>
                    )}
                </div>

                {/* DOCUMENTOS / ANEXOS (Perguntar) */}
                <div style={s.card}>
                    <div style={s.sectionTitle}>Documentação (Opcional)</div>
                    <div style={s.field}>
                        <label style={s.label}>Deseja Adicionar Sua documentação?</label>
                        <div style={s.radioGroup}>
                            {['Sim', 'Nao'].map(v => (
                                <label key={v} style={s.radioLabel}>
                                    <input type="radio" name="tem_documento" value={v}
                                        checked={temDocumento === v}
                                        onChange={() => handleRadioDocumento(v)} />
                                    {v === 'Nao' ? 'Não' : v}
                                </label>
                            ))}
                        </div>
                    </div>
                    {temDocumento === 'Sim' && (
                        <div style={{ fontSize: '13px', color: '#4ade80', marginTop: '-8px' }}>
                            Documentação será anexada.
                            <button type="button" onClick={() => setModalDocs(true)}
                                style={{ ...s.btnSecondary, padding: '4px 12px', marginLeft: '10px', fontSize: '12px' }}>
                                Adicionar / Alterar
                            </button>
                        </div>
                    )}
                </div>

                {/* TERMO */}
                <div style={s.card}>
                    <div style={s.termoBox}>
                        <p><strong>Termo de Responsabilidade – Marcação de Placas</strong></p>
                        <p>O motorista declara estar ciente de que a marcação da placa deverá ser realizada <strong>somente quando o veículo estiver próximo de ficar vazio ou completamente vazio</strong>.</p>
                        <p>Caso a marcação seja realizada com o veículo ainda carregado e haja solicitação de carregamento, <strong>a marcação será automaticamente cancelada</strong>, sem qualquer aviso prévio.</p>
                        <p>O motorista reconhece que as informações prestadas são de sua inteira responsabilidade e declara que estão corretas e atualizadas.</p>
                        <p>Este link de cadastro é de <strong>uso exclusivo do motorista</strong>, sendo <strong>expressamente proibido o reenvio ou compartilhamento</strong> com terceiros.</p>
                    </div>
                    <label style={{ ...s.radioLabel, fontSize: '14px' }}>
                        <input type="checkbox" checked={form.termo} onChange={e => set('termo', e.target.checked)} required />
                        Declaro que li e estou de acordo com os termos acima
                    </label>
                </div>



                {erroMsg && (
                    <div style={{ maxWidth: '520px', margin: '0 auto 8px', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '14px' }}>
                        {erroMsg}
                    </div>
                )}

                <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0 16px' }}>
                    <button type="submit" style={{ ...s.btnPrimary, opacity: enviando ? 0.7 : 1 }} disabled={enviando}>
                        {enviando ? 'Enviando...' : 'Confirmar Cadastro'}
                    </button>
                </div>
            </form>

            {/* MODAL RASTREADOR */}
            {modalRast && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>Dados do Rastreador</div>
                        {form.nome && <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>Motorista: {form.nome} — {form.tipo_veiculo}</div>}

                        <div style={s.field}>
                            <label style={s.label}>Equipamento *</label>
                            <select style={s.select} value={form.rastreador}
                                onChange={e => set('rastreador', e.target.value)}>
                                <option value="">Selecione</option>
                                {RASTREADORES.map(r => <option key={r}>{r}</option>)}
                            </select>
                        </div>

                        <div style={{ ...s.field, marginBottom: '20px' }}>
                            <label style={s.label}>Status *</label>
                            <select style={s.select} value={form.status_rastreador}
                                onChange={e => set('status_rastreador', e.target.value)}>
                                <option value="">Selecione</option>
                                <option>Ativo</option>
                                <option>Inativo</option>
                            </select>
                        </div>

                        {erroMsg && <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '12px' }}>{erroMsg}</div>}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => { set('tem_rastreador', ''); setModalRast(false); }}
                                style={{ ...s.btnSecondary, flex: 1 }}>Cancelar</button>
                            <button type="button" onClick={confirmarModal}
                                style={{ ...s.btnPrimary, flex: 1, marginTop: 0 }}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DOCUMENTOS */}
            {modalDocs && (
                <div style={s.overlay}>
                    <div style={{ ...s.modal, maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>Adicionar Documentação (PDF)</div>
                            <button type="button" onClick={() => setModalDocs(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
                        </div>

                        {[
                            { key: 'cnh', label: 'CNH' },
                            { key: 'doc_veiculo', label: 'Documentação do Veículo (Cavalo / Caminhão)' },
                            { key: 'crlv_carreta', label: 'CRLV da Carreta (Reboque)' },
                            { key: 'antt', label: 'ANTT' },
                            { key: 'outros', label: 'Outros / Opcional' },
                        ].map(({ key, label }) => (
                            <div key={key} style={{ marginBottom: '14px' }}>
                                <label style={s.label}>{label}</label>
                                {!anexos[key] ? (
                                    <label style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        padding: '13px', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.15)',
                                        background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
                                        color: '#94a3b8', fontSize: '13px', fontWeight: '600',
                                    }}>
                                        📎 Selecionar PDF
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            style={{ display: 'none' }}
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onloadend = () => setAnexos(prev => ({ ...prev, [key]: reader.result }));
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
                                        <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ PDF Anexado</span>
                                        <button type="button" onClick={() => setAnexos(prev => ({ ...prev, [key]: null }))} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', marginLeft: '10px' }}>
                                            Remover
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button type="button" onClick={confirmarModalDocs}
                                style={{ ...s.btnPrimary, flex: 1, marginTop: 0 }}>Concluído</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
