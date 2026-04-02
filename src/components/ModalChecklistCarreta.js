import React, { useState, useEffect } from 'react';
import { Camera, PenTool, Trash2, CheckCircle, AlertTriangle, ClipboardCheck, X, Loader, ArrowLeft, Image as ImageIcon, Video as VideoIcon, Play } from 'lucide-react';
import api from '../services/apiService';
import useAuthStore from '../store/useAuthStore';

export default function ModalChecklistCarreta({ veiculo, onClose, onSucesso, backMode = false }) {
    const user = useAuthStore(state => state.user);

    const [placaConfere, setPlacaConfere] = useState(null);
    const [condicaoBau, setCondicaoBau] = useState('');
    const [condicaoOutra, setCondicaoOutra] = useState('');
    const [temCordas, setTemCordas] = useState(false);
    const [qtdCordas, setQtdCordas] = useState('');
    const [temVazamento, setTemVazamento] = useState(false);
    const [fotoVazamento, setFotoVazamento] = useState(null); // legado — primeira foto
    const [midiasAvaria, setMidiasAvaria] = useState([]); // [{ tipo, data, thumb? }]
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [placaCarreta, setPlacaCarreta] = useState('');

    // Paletização
    const [isPaletizado, setIsPaletizado] = useState(''); // 'NÃO', 'SIM', 'BATIDA_PALETIZADA'
    const [tipoPalete, setTipoPalete] = useState(''); // 'PBR', 'DESCARTAVEL'
    const [qtdPaletes, setQtdPaletes] = useState('');
    const [fornecedorPbr, setFornecedorPbr] = useState('');

    const extrairPlacaLocal = () => {
        let p2 = veiculo.placa2Motorista?.trim();
        let p1 = veiculo.placa1Motorista?.trim();
        let p = veiculo.placa?.trim();

        // Busca no dados_json caso os campos diretos estejam vazios
        if (!p2 || !p1) {
            try {
                const dados = veiculo.dados_json
                    ? (typeof veiculo.dados_json === 'string' ? JSON.parse(veiculo.dados_json) : veiculo.dados_json)
                    : {};
                if (!p2 && dados.placa2Motorista) p2 = dados.placa2Motorista.trim();
                if (!p1 && dados.placa1Motorista) p1 = dados.placa1Motorista.trim();
            } catch (e) { }
        }

        const placaValida = (placa) => placa && placa !== '' && placa !== 'NÃO INFORMADA';

        // Prioridade: Placa 2 (carreta) → Placa 1 (cavalo) → placa genérica
        if (placaValida(p2)) return p2.toUpperCase();
        if (placaValida(p1)) return p1.toUpperCase();
        if (placaValida(p)) return p.toUpperCase();

        return '';
    };

    // Busca placa local primeiro; se vazio, consulta a marcação do motorista no servidor
    useEffect(() => {
        const local = extrairPlacaLocal();
        if (local) {
            setPlacaCarreta(local);
            return;
        }

        // Fallback: buscar placa direto da marcação pelo telefone ou nome do motorista
        const telefone = veiculo.telefoneMotorista || veiculo.telefone || '';
        const motorista = veiculo.motorista || '';
        if (!telefone && !motorista) {
            setPlacaCarreta('NÃO INFORMADA');
            return;
        }

        api.get('/api/marcacoes')
            .then(r => {
                if (!r.data.success) return;
                const lista = r.data.marcacoes || [];
                const telLimpo = telefone.replace(/\D/g, '');
                const match = lista.find(m =>
                    (telLimpo && m.telefone?.replace(/\D/g, '') === telLimpo) ||
                    (motorista && m.nome_motorista?.toUpperCase() === motorista.toUpperCase())
                );
                if (match) {
                    const p = (match.placa2 || match.placa1 || '').trim();
                    setPlacaCarreta(p ? p.toUpperCase() : 'NÃO INFORMADA');
                } else {
                    setPlacaCarreta('NÃO INFORMADA');
                }
            })
            .catch(() => setPlacaCarreta('NÃO INFORMADA'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const comprimirImagem = (file) => new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1000;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = url;
    });

    const gerarThumbVideo = (file) => new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        video.currentTime = 0.5;
        video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 180;
            canvas.getContext('2d').drawImage(video, 0, 0, 320, 180);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    });

    const handleAdicionarFotoAvaria = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novas = await Promise.all(files.map(async (f) => ({
            tipo: 'foto',
            data: await comprimirImagem(f)
        })));
        setMidiasAvaria(prev => {
            const atualizado = [...prev, ...novas];
            if (!fotoVazamento && atualizado[0]?.tipo === 'foto') setFotoVazamento(atualizado[0].data);
            return atualizado;
        });
        e.target.value = '';
    };

    const handleAdicionarVideoAvaria = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { alert('Vídeo muito grande. Máximo 50MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = async () => {
            const thumb = await gerarThumbVideo(file);
            setMidiasAvaria(prev => [...prev, { tipo: 'video', data: reader.result, thumb }]);
        };
        reader.readAsDataURL(file);
    };

    const removerMidiaAvaria = (idx) => {
        setMidiasAvaria(prev => {
            const atualizado = prev.filter((_, i) => i !== idx);
            const primeiraFoto = atualizado.find(m => m.tipo === 'foto');
            setFotoVazamento(primeiraFoto?.data || null);
            return atualizado;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');

        if (placaConfere === null) {
            setErro('Informe se a placa confere.');
            return;
        }
        if (temVazamento && midiasAvaria.length === 0) {
            setErro('Pelo menos uma foto ou vídeo da avaria é obrigatório.');
            return;
        }
        if (!isPaletizado) {
            setErro('Informe se a carga é paletizada.');
            return;
        }
        if ((isPaletizado === 'SIM' || isPaletizado === 'BATIDA_PALETIZADA')) {
            if (!tipoPalete) {
                setErro('Informe o tipo do palete.');
                return;
            }
            if (!qtdPaletes || parseInt(qtdPaletes) <= 0) {
                setErro('Informe a quantidade de paletes.');
                return;
            }
            if (tipoPalete === 'PBR' && !fornecedorPbr.trim()) {
                setErro('Informe o fornecedor dos paletes PBR.');
                return;
            }
        }

        const assinaturaBase = `Carregamento Autorizado por ${user?.nome || 'Conferente'}`;

        const payload = {
            veiculo_id: veiculo.id,
            motorista_nome: veiculo.motorista || 'Sem Nome',
            placa_carreta: placaCarreta,
            placa_confere: placaConfere,
            condicao_bau: condicaoBau === 'Outro' ? condicaoOutra : condicaoBau,
            cordas: temCordas ? parseInt(qtdCordas) : 0,
            foto_vazamento: temVazamento ? (fotoVazamento || null) : null,
            midias_json: temVazamento && midiasAvaria.length > 0 ? midiasAvaria : undefined,
            assinatura: assinaturaBase,
            conferente_nome: user?.nome || 'Desconhecido',
            is_paletizado: isPaletizado,
            tipo_palete: tipoPalete,
            qtd_paletes: (isPaletizado === 'SIM' || isPaletizado === 'BATIDA_PALETIZADA') ? parseInt(qtdPaletes) : 0,
            fornecedor_pbr: tipoPalete === 'PBR' ? fornecedorPbr.trim() : ''
        };

        setLoading(true);
        try {
            const res = await api.post('/api/checklists', payload);
            const msg = res.data?.status === 'APROVADO'
                ? 'Checklist aprovado automaticamente!'
                : 'Checklist enviado e pendente de aprovação!';
            if (onSucesso) onSucesso(msg, res.data?.status);
            if (!backMode && onClose) onClose();
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

    const toggleBtn = (active, color) => ({
        flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
        background: active ? `rgba(${color},0.2)` : 'rgba(255,255,255,0.05)',
        color: active ? `rgb(${color})` : '#64748b',
        border: `1px solid ${active ? `rgba(${color},0.5)` : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
    });

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
                        {backMode ? <ArrowLeft size={22} /> : <X size={22} />}
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

                {/* 3.1 Paletização (NOVO) */}
                <div style={card}>
                    <span style={label}>4. Paletização</span>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>É paletizado?</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => { setIsPaletizado('NÃO'); setTipoPalete(''); setQtdPaletes(''); setFornecedorPbr(''); }}
                            style={toggleBtn(isPaletizado === 'NÃO', '248,113,113')}>NÃO</button>
                        <button type="button" onClick={() => setIsPaletizado('SIM')}
                            style={toggleBtn(isPaletizado === 'SIM', '74,222,128')}>SIM</button>
                        <button type="button" onClick={() => setIsPaletizado('BATIDA_PALETIZADA')}
                            style={toggleBtn(isPaletizado === 'BATIDA_PALETIZADA', '59,130,246')}>BATIDA E PALETIZADA</button>
                    </div>

                    {(isPaletizado === 'SIM' || isPaletizado === 'BATIDA_PALETIZADA') && (
                        <div style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
                            <label style={label}>Qual o tipo do Palete?</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <button type="button" onClick={() => setTipoPalete('PBR')}
                                    style={toggleBtn(tipoPalete === 'PBR', '249,115,22')}>PBR</button>
                                <button type="button" onClick={() => setTipoPalete('DESCARTAVEL')}
                                    style={toggleBtn(tipoPalete === 'DESCARTAVEL', '249,115,22')}>DESCARTÁVEL</button>
                            </div>

                            {tipoPalete && (
                                <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={label}>Quantidade de Paletes</label>
                                        <input
                                            type="number" min="1" placeholder="Quantidade..." value={qtdPaletes} onChange={(e) => setQtdPaletes(e.target.value)} required
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                                        />
                                    </div>
                                    {tipoPalete === 'PBR' && (
                                        <div>
                                            <label style={label}>Fornecedor PBR *</label>
                                            <input
                                                type="text" placeholder="Nome do fornecedor..." value={fornecedorPbr} onChange={(e) => setFornecedorPbr(e.target.value)} required
                                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. Vazamento */}
                <div style={card}>
                    <span style={label}>5. Estrutura</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temVazamento ? '14px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Há vazamentos ou furos no teto?</span>
                        <button type="button" onClick={() => { setTemVazamento(!temVazamento); if (temVazamento) { setFotoVazamento(null); setMidiasAvaria([]); } }}
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
                                <AlertTriangle size={14} /> Pelo menos uma foto ou vídeo é obrigatório.
                            </p>

                            {/* inputs de arquivo — label htmlFor garante funcionamento no Android */}
                            <input id="chk-camera" type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleAdicionarFotoAvaria} />
                            <input id="chk-galeria" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleAdicionarFotoAvaria} />
                            <input id="chk-gravar" type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={handleAdicionarVideoAvaria} />
                            <input id="chk-videogaleria" type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={handleAdicionarVideoAvaria} />

                            {/* botões de adicionar */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: midiasAvaria.length ? '12px' : '0' }}>
                                {[
                                    { htmlFor: 'chk-camera', icon: <Camera size={18} />, label: 'Câmera' },
                                    { htmlFor: 'chk-galeria', icon: <ImageIcon size={18} />, label: 'Fotos' },
                                    { htmlFor: 'chk-gravar', icon: <VideoIcon size={18} />, label: 'Gravar' },
                                    { htmlFor: 'chk-videogaleria', icon: <Play size={18} />, label: 'Vídeo' },
                                ].map(({ htmlFor, icon, label }) => (
                                    <label key={label} htmlFor={htmlFor} style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        gap: '4px', padding: '10px 6px', border: '2px dashed rgba(248,113,113,0.3)',
                                        borderRadius: '10px', background: 'rgba(248,113,113,0.04)', cursor: 'pointer',
                                        color: '#f87171', fontSize: '10px', fontWeight: '600'
                                    }}>
                                        {icon} {label}
                                    </label>
                                ))}
                            </div>

                            {/* preview das mídias */}
                            {midiasAvaria.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {midiasAvaria.map((m, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            {m.tipo === 'video' ? (
                                                <div style={{ width: '90px', height: '90px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {m.thumb
                                                        ? <img src={m.thumb} alt="Vídeo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <VideoIcon size={26} color="#f87171" />
                                                    }
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Play size={18} color="white" style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <img src={m.data} alt={`Avaria ${i + 1}`} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)', display: 'block' }} />
                                            )}
                                            <button type="button" onClick={() => removerMidiaAvaria(i)} style={{
                                                position: 'absolute', top: -8, right: -8,
                                                background: '#ef4444', border: 'none', color: 'white',
                                                borderRadius: '50%', width: 24, height: 24,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                                            }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Ciente e Assinatura */}
                <div style={card}>
                    <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <PenTool size={13} /> 6. Declaração do Conferente
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
