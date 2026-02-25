import React, { useState } from 'react';
import { Camera, PenTool, Trash2, CheckCircle, AlertTriangle, ClipboardCheck, X, Loader } from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';

export default function ModalChecklistCarreta({ veiculo, onClose, onSucesso }) {
    const user = useAuthStore(state => state.user);

    const [placaConfere, setPlacaConfere] = useState(null);
    const [condicaoBau, setCondicaoBau] = useState('');
    const [condicaoOutra, setCondicaoOutra] = useState('');
    const [temCordas, setTemCordas] = useState(false);
    const [qtdCordas, setQtdCordas] = useState('');
    const [temVazamento, setTemVazamento] = useState(false);
    const [fotoVazamento, setFotoVazamento] = useState(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const extrairPlacaCarreta = () => {
        let p2 = veiculo.placa2Motorista?.trim();
        let p1 = veiculo.placa1Motorista?.trim();
        let p = veiculo.placa?.trim();

        if (!p1 && !p2 && veiculo.dados_json) {
            try {
                const dados = typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : veiculo.dados_json;
                if (!p2 && dados.placa2Motorista) p2 = dados.placa2Motorista.trim();
                if (!p1 && dados.placa1Motorista) p1 = dados.placa1Motorista.trim();
            } catch (e) { }
        }

        // Tenta achar placas reais nos campos nativos
        if (p2 && p2 !== 'NÃO INFORMADA' && /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i.test(p2.replace(/\s/g, ''))) return p2.toUpperCase();
        if (p1 && p1 !== 'NÃO INFORMADA' && /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i.test(p1.replace(/\s/g, ''))) return p1.toUpperCase();
        if (p && p !== 'NÃO INFORMADA' && /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i.test(p.replace(/\s/g, ''))) return p.toUpperCase();

        // Se não estava cravado nos campos originais ou estava sujo, fareja a placa em qualquer outro lugar do card:
        const regexGeralPlaca = /[A-Z]{3}\s*-?[0-9][A-Z0-9][0-9]{2}/i;

        const camposParaProcurar = [
            p2, p1, p, // Tenta caçar dentro de strings corrompidas nesses campos
            veiculo.operacao,
            veiculo.motorista,
            veiculo.coleta,
            veiculo.coletaRecife,
            veiculo.coletaMoreno,
            veiculo.observacao
        ];

        for (const texto of camposParaProcurar) {
            if (texto && typeof texto === 'string') {
                const match = texto.match(regexGeralPlaca);
                if (match) {
                    return match[0].toUpperCase().replace(/\s/g, ''); // Retorna placa limpa e extraída
                }
            }
        }

        return 'NÃO INFORMADA';
    };

    const placaCarreta = extrairPlacaCarreta();

    const handleCapturePhoto = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFotoVazamento(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');

        if (placaConfere === null) {
            setErro('Informe se a placa confere.');
            return;
        }
        if (temVazamento && !fotoVazamento) {
            setErro('Foto da avaria é obrigatória quando há vazamento/furo.');
            return;
        }

        const assinaturaBase = `Carregamento Autorizado por ${user?.nome || 'Conferente'}`;

        const payload = {
            veiculo_id: veiculo.id,
            motorista_nome: veiculo.motorista || 'Sem Nome',
            placa_carreta: placaCarreta,
            placa_confere: placaConfere,
            condicao_bau: condicaoBau === 'Outro' ? condicaoOutra : condicaoBau,
            cordas: temCordas ? parseInt(qtdCordas) : 0,
            foto_vazamento: temVazamento ? fotoVazamento : null,
            assinatura: assinaturaBase,
            conferente_nome: user?.nome || 'Desconhecido'
        };

        setLoading(true);
        try {
            await api.post('/api/checklists', payload);
            if (onSucesso) onSucesso('Checklist enviado e pendente de aprovação!');
            if (onClose) onClose();
        } catch (err) {
            setErro(err.response?.data?.message || 'Erro ao enviar checklist. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const card = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '14px',
    };

    const label = {
        fontSize: '10px', fontWeight: '700', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'block',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.95) 60%, rgba(30,41,59,0.95) 100%)',
            backdropFilter: 'blur(8px)', zIndex: 9999, overflowY: 'auto', color: '#f1f5f9',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{
                background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardCheck size={20} color="#f97316" />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', lineHeight: 1 }}>Checklist da Carreta</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Preenchimento pelo Conferente da Doca</div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <X size={22} />
                    </button>
                )}
            </div>

            <div style={{ padding: '16px', maxWidth: '520px', margin: '0 auto', paddingBottom: '32px' }}>
                {/* 1. Identificação */}
                <div style={card}>
                    <span style={label}>1. Identificação do Veículo</span>
                    <div style={{
                        background: 'rgba(249,115,22,0.08)', border: '1px dashed rgba(249,115,22,0.3)',
                        borderRadius: '10px', padding: '14px', textAlign: 'center', marginBottom: '14px',
                    }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Motorista: {veiculo.motorista || 'A DEFINIR'}</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#f97316', fontFamily: 'monospace', letterSpacing: '2px' }}>
                            {placaCarreta}
                        </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>A placa física confere com a informada acima?</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setPlacaConfere(true)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                                background: placaConfere === true ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)',
                                color: placaConfere === true ? '#4ade80' : '#64748b',
                                border: `1px solid ${placaConfere === true ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            }}>SIM</button>
                        <button type="button" onClick={() => setPlacaConfere(false)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                                background: placaConfere === false ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                                color: placaConfere === false ? '#f87171' : '#64748b',
                                border: `1px solid ${placaConfere === false ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            }}>NÃO</button>
                    </div>
                </div>

                {/* 2. Condição do Baú */}
                <div style={card}>
                    <span style={label}>2. Condição do Baú</span>
                    <select
                        value={condicaoBau}
                        onChange={(e) => setCondicaoBau(e.target.value)}
                        required
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none',
                        }}>
                        <option value="" disabled style={{ background: '#0f172a' }}>Selecione a condição...</option>
                        <option value="Limpo e Intacto" style={{ background: '#0f172a' }}>Limpo e Intacto</option>
                        <option value="Sujo (Necessita varrição)" style={{ background: '#0f172a' }}>Sujo (Necessita varrição)</option>
                        <option value="Avariado (Furos/Rasgos)" style={{ background: '#0f172a' }}>Avariado (Furos/Rasgos)</option>
                        <option value="Outro" style={{ background: '#0f172a' }}>Outro (Digitar)</option>
                    </select>
                    {condicaoBau === 'Outro' && (
                        <input
                            type="text" placeholder="Descreva a condição..." value={condicaoOutra} onChange={(e) => setCondicaoOutra(e.target.value)} required
                            style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                        />
                    )}
                </div>

                {/* 3. Cordas */}
                <div style={card}>
                    <span style={label}>3. Acessórios</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temCordas ? '12px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>O veículo possui cordas?</span>
                        <button type="button" onClick={() => setTemCordas(!temCordas)}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                background: temCordas ? '#f97316' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', padding: '0 4px',
                                justifyContent: temCordas ? 'flex-end' : 'flex-start', transition: 'all 0.2s',
                            }}>
                            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                        </button>
                    </div>
                    {temCordas && (
                        <div>
                            <label style={{ ...label, marginBottom: '6px' }}>Quantidade de Cordas</label>
                            <input
                                type="number" min="1" placeholder="Ex: 10" value={qtdCordas} onChange={(e) => setQtdCordas(e.target.value)} required
                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                            />
                        </div>
                    )}
                </div>

                {/* 4. Vazamento */}
                <div style={card}>
                    <span style={label}>4. Estrutura</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temVazamento ? '14px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Há vazamentos ou furos no teto?</span>
                        <button type="button" onClick={() => { setTemVazamento(!temVazamento); if (temVazamento) setFotoVazamento(null); }}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                background: temVazamento ? '#f87171' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', padding: '0 4px',
                                justifyContent: temVazamento ? 'flex-end' : 'flex-start', transition: 'all 0.2s',
                            }}>
                            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                        </button>
                    </div>
                    {temVazamento && (
                        <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>
                            <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} /> Registro fotográfico obrigatório.
                            </p>
                            {!fotoVazamento ? (
                                <label style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    height: '100px', border: '2px dashed rgba(248,113,113,0.4)', borderRadius: '10px',
                                    cursor: 'pointer', color: '#f87171', gap: '8px', fontSize: '13px', fontWeight: '600',
                                }}>
                                    <Camera size={22} /> Tirar Foto da Avaria
                                    <input type="file" accept="image/*" capture="environment" onChange={handleCapturePhoto} style={{ display: 'none' }} />
                                </label>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <img src={fotoVazamento} alt="Avaria" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px' }} />
                                    <button type="button" onClick={() => setFotoVazamento(null)}
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Ciente e Assinatura */}
                <div style={card}>
                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <PenTool size={13} /> 5. Declaração do Conferente
                    </span>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.5 }}>
                        Eu, <strong>{user?.nome || 'Conferente'}</strong>, atesto que as condições registradas acima são condizentes com o veículo vistoriado.
                    </p>
                    <div style={{ background: 'rgba(74,222,128,0.1)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                        "Carregamento Autorizado por {user?.nome || 'Conferente'}"<br />
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>(Registrado automaticamente ao concluir)</span>
                    </div>
                </div>

                {/* Erro */}
                {erro && (
                    <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} /> {erro}
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleSubmit} disabled={loading}
                    style={{
                        width: '100%', padding: '18px', borderRadius: '14px', border: 'none',
                        background: loading ? 'rgba(249,115,22,0.2)' : 'linear-gradient(135deg, #f97316, #ea580c)',
                        color: 'white', fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(249,115,22,0.35)',
                    }}>
                    {loading ? <><Loader size={18} /> Salvando...</> : <><CheckCircle size={18} /> REGISTRAR VISTORIA DA DOCA</>}
                </button>
            </div>
        </div>
    );
}
