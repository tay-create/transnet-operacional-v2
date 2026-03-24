import React, { useState, useEffect, useCallback } from 'react';

import TagInput from './TagInput';
import {
    Truck, Calendar, Layers, User, Route, Package, FileText, Image, X, ChevronDown, Phone
} from 'lucide-react';
import { OPCOES_OPERACAO, OPCOES_VEICULO } from '../constants';
import api from '../services/apiService';
import ModalEntregasProvisao from './ModalEntregasProvisao';

const ehOperacaoRecife = (op) => op && op.includes('RECIFE');
const ehOperacaoMoreno = (op) => op && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));

export default function NovoLancamento({ user, formLanca, setFormLanca, lancarVeiculoInteligente, podeEditar, mostrarNotificacao }) {
    const [cubagensCache, setCubagensCache] = useState({});
    const [cubagemFormulario, setCubagemFormulario] = useState(null);
    const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const [filtroUF, setFiltroUF] = useState('');
    const [veiculosProvisao, setVeiculosProvisao] = useState([]);
    const [modalEntregas, setModalEntregas] = useState(null); // null | { veiculo }
    const [entregasConfirmadas, setEntregasConfirmadas] = useState(false);

    useEffect(() => {
        api.get('/api/marcacoes/disponiveis')
            .then(r => { if (r.data.success) setMotoristasDisponiveis(r.data.motoristas); })
            .catch(() => { });
        api.get('/api/provisionamento/veiculos')
            .then(r => { if (r.data.success) setVeiculosProvisao(r.data.veiculos); })
            .catch(() => { });
    }, []);

    function handleLancar() {
        if (!entregasConfirmadas) {
            const p1 = (formLanca.placa1Motorista || '').replace(/[-\s]/g, '').toUpperCase();
            const p2 = (formLanca.placa2Motorista || '').replace(/[-\s]/g, '').toUpperCase();
            const v = veiculosProvisao.find(vp => {
                const vPlaca = vp.placa.replace(/[-\s]/g, '').toUpperCase();
                const vCarreta = (vp.carreta || '').replace(/[-\s]/g, '').toUpperCase();
                return (p1 && (vPlaca === p1 || vCarreta === p1)) || (p2 && (vPlaca === p2 || vCarreta === p2));
            });
            if (v) {
                setModalEntregas({ veiculo: v });
                return;
            }
        }
        lancarVeiculoInteligente();
    }

    const UFS_FILTRO = ['PE', 'BA', 'SP', 'GO', 'MG', 'RJ', 'CE', 'MA', 'PI', 'PB', 'RN', 'AL', 'SE', 'ES', 'PR', 'SC', 'RS', 'MT', 'MS', 'DF', 'PA', 'AM', 'RO', 'TO', 'AP', 'RR', 'AC'];

    const motoristasFiltered = motoristasDisponiveis.filter(m => {
        const matchBusca = m.nome_motorista.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
            m.placa1.toLowerCase().includes(buscaMotorista.toLowerCase());
        const matchUF = !filtroUF
            || (Array.isArray(m.estados_destino) && m.estados_destino.includes(filtroUF))
            || (m.destino_desejado && m.destino_desejado.toUpperCase().includes(filtroUF))
            || (m.destino_uf_cad && m.destino_uf_cad === filtroUF);
        return matchBusca && matchUF;
    });

    const selecionarMotorista = useCallback((m) => {
        setFormLanca(prev => ({
            ...prev,
            motorista: m.nome_motorista,
            telefoneMotorista: m.telefone,
            placa1Motorista: m.placa1,
            placa2Motorista: m.placa2 || '',
            tipoVeiculo: m.tipo_veiculo?.toUpperCase().includes('TRUCK') ? 'TRUCK'
                : m.tipo_veiculo?.toUpperCase().includes('CARRETA') ? 'CARRETA' : prev.tipoVeiculo,
            origemMotorista: m.origem_cidade_uf || '',
            destinoMotorista: m.destino_desejado || '',
            disponibilidadeMotorista: m.disponibilidade || '',
            id_marcacao: m.id,
            // Herdar checklist do cadastro pré-existente
            chk_cnh: m.chk_cnh_cad ? 1 : 0,
            chk_antt: m.chk_antt_cad ? 1 : 0,
            chk_tacografo: m.chk_tacografo_cad ? 1 : 0,
            chk_crlv: m.chk_crlv_cad ? 1 : 0,
            situacao_cadastro: m.situacao_cad || 'NÃO CONFERIDO',
            numero_liberacao: m.num_liberacao_cad || '',
            data_liberacao: m.data_liberacao_cad || null,
        }));
        setBuscaMotorista(m.nome_motorista);
        setDropdownAberto(false);
    }, [setFormLanca]);

    // Auto-selecionar motorista se for carregado via promoção da fila
    useEffect(() => {
        if (formLanca.idFilaOriginal && formLanca.motorista && motoristasDisponiveis.length > 0) {
            const match = motoristasDisponiveis.find(m =>
                m.nome_motorista.toLowerCase() === formLanca.motorista.toLowerCase()
            );
            if (match) {
                selecionarMotorista(match);
            }
        }
    }, [formLanca.idFilaOriginal, formLanca.motorista, motoristasDisponiveis, selecionarMotorista]); // Roda quando a fila promove ou quando a lista carrega

    const buscarCubagemPorColeta = useCallback(async (numeroColeta) => {
        if (!numeroColeta) return null;
        try {
            const response = await api.get(`/cubagens/coleta/${numeroColeta}`);
            if (response.data.success && response.data.cubagem) {
                setCubagensCache(prev => ({ ...prev, [numeroColeta]: response.data.cubagem }));
                return response.data.cubagem;
            }
        } catch (error) {
            console.error("Erro ao buscar cubagem:", error);
        }
        return null;
    }, []);

    useEffect(() => {
        if (formLanca.operacao?.includes('PORCELANA') && formLanca.coletaMoreno) {
            const primeiraColeta = formLanca.coletaMoreno.split(',')[0].trim();
            if (primeiraColeta && !cubagensCache[primeiraColeta]) {
                buscarCubagemPorColeta(primeiraColeta).then(cubagem => {
                    if (cubagem) setCubagemFormulario(cubagem);
                });
            } else if (cubagensCache[primeiraColeta]) {
                setCubagemFormulario(cubagensCache[primeiraColeta]);
            }
        } else {
            setCubagemFormulario(null);
        }
    }, [formLanca.operacao, formLanca.coletaMoreno, cubagensCache, buscarCubagemPorColeta]);

    const mostraRecifeNoInput = ehOperacaoRecife(formLanca.operacao);
    const mostraMorenoNoInput = ehOperacaoMoreno(formLanca.operacao);
    const isOperacaoMista = mostraRecifeNoInput && mostraMorenoNoInput;

    const podeEditarLancamento = () => {
        if (typeof podeEditar === 'function') return podeEditar('lancamento');
        return true;
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
            <div className="glass-panel" style={{
                padding: '30px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
                {/* Cabeçalho */}
                <div style={{ marginBottom: '25px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                        <h3 className="title-neon-blue" style={{ margin: 0, fontSize: '20px' }}>
                            <Truck size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                            NOVO LANÇAMENTO
                        </h3>
                    </div>
                </div>

                {podeEditarLancamento() ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Linha 1: Data + Operação */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label className="label-tech-sm"><Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} /> DATA PREVISTA</label>
                                <input type="date" className="input-internal" value={formLanca.data_prevista} onChange={e => setFormLanca({ ...formLanca, data_prevista: e.target.value })} />
                            </div>
                            <div>
                                <label className="label-tech-sm"><Layers size={12} style={{ display: 'inline', marginRight: '4px' }} /> OPERAÇÃO</label>
                                <select className="input-internal" value={formLanca.operacao} onChange={e => setFormLanca({ ...formLanca, operacao: e.target.value })}>
                                    {OPCOES_OPERACAO.map(op => <option key={op} style={{ color: 'black' }}>{op}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Iniciar Rota Em (apenas para operações mistas) */}
                        {isOperacaoMista && (
                            <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(59, 130, 246, 0.3)' }}>
                                <label className="label-tech-sm" style={{ color: '#60a5fa' }}>INICIAR ROTA EM:</label>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                                    <label style={{ color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="radio" name="inicio" checked={formLanca.inicio === 'Recife'} onChange={() => setFormLanca({ ...formLanca, inicio: 'Recife' })} style={{ accentColor: '#3b82f6' }} /> Recife
                                    </label>
                                    <label style={{ color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="radio" name="inicio" checked={formLanca.inicio === 'Moreno'} onChange={() => setFormLanca({ ...formLanca, inicio: 'Moreno' })} style={{ accentColor: '#3b82f6' }} /> Moreno
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Coletas e Rotas */}
                        <div style={{ display: 'grid', gridTemplateColumns: mostraRecifeNoInput && mostraMorenoNoInput ? '1fr 1fr' : '1fr', gap: '15px' }}>

                            {/* RECIFE */}
                            {mostraRecifeNoInput && (
                                <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                        <label className="label-tech-sm" style={{ color: '#60a5fa' }}>COLETAS RECIFE</label>
                                        <TagInput value={formLanca.coletaRecife} onChange={val => setFormLanca({ ...formLanca, coletaRecife: val })} placeholder="Digite a nota..." />
                                    </div>
                                    <div>
                                        <label className="label-tech-sm" style={{ color: '#93c5fd', fontSize: '10px' }}>ROTA RECIFE</label>
                                        <div style={{ position: 'relative' }}>
                                            <Route size={14} color="#3b82f6" style={{ position: 'absolute', left: 8, top: 10 }} />
                                            <input className="input-internal" style={{ paddingLeft: '28px', borderColor: 'rgba(59, 130, 246, 0.4)' }} value={formLanca.rotaRecife || ''} onChange={e => setFormLanca({ ...formLanca, rotaRecife: e.target.value })} placeholder="Nº Rota..." />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MORENO */}
                            {mostraMorenoNoInput && (
                                <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                        <label className="label-tech-sm" style={{ color: '#fbbf24' }}>COLETAS MORENO</label>
                                        <TagInput value={formLanca.coletaMoreno} onChange={val => setFormLanca({ ...formLanca, coletaMoreno: val })} placeholder="Digite a nota..." />

                                        {/* Card de cubagem encontrada */}
                                        {cubagemFormulario && formLanca.operacao?.includes('PORCELANA') && (
                                            <div style={{
                                                marginTop: '8px',
                                                padding: '10px',
                                                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
                                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                                borderRadius: '6px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                                                    <Package size={10} color="#a855f7" />
                                                    <span style={{ fontSize: '9px', color: '#a855f7', fontWeight: 'bold' }}>CUBAGEM ENCONTRADA</span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '4px' }}>
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '7px', color: '#94a3b8' }}>MIX</div>
                                                        <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 'bold' }}>{cubagemFormulario.valor_mix_total != null ? parseFloat(cubagemFormulario.valor_mix_total).toFixed(4) : '0.0000'}</div>
                                                    </div>
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '7px', color: '#94a3b8' }}>KIT</div>
                                                        <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 'bold' }}>{cubagemFormulario.valor_kit_total != null ? parseFloat(cubagemFormulario.valor_kit_total).toFixed(4) : '0.0000'}</div>
                                                    </div>
                                                </div>
                                                {cubagemFormulario.itens && cubagemFormulario.itens.length > 0 && (
                                                    <div style={{ fontSize: '7px', color: '#94a3b8', marginBottom: '4px' }}>{cubagemFormulario.itens.length} NF(s) vinculada(s)</div>
                                                )}
                                                <div style={{ fontSize: '8px', color: '#cbd5e1' }}>
                                                    <div><strong>Cliente:</strong> {cubagemFormulario.cliente}</div>
                                                    <div><strong>Destino:</strong> {cubagemFormulario.destino}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="label-tech-sm" style={{ color: '#fcd34d', fontSize: '10px' }}>ROTA MORENO</label>
                                        <div style={{ position: 'relative' }}>
                                            <Route size={14} color="#f59e0b" style={{ position: 'absolute', left: 8, top: 10 }} />
                                            <input className="input-internal" style={{ paddingLeft: '28px', borderColor: 'rgba(245, 158, 11, 0.4)' }} value={formLanca.rotaMoreno || ''} onChange={e => setFormLanca({ ...formLanca, rotaMoreno: e.target.value })} placeholder="Nº Rota..." />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Linha 2: Motorista + Veículo */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div style={{ position: 'relative' }}>
                                <label className="label-tech-sm"><User size={12} style={{ display: 'inline', marginRight: '4px' }} /> MOTORISTA</label>

                                {/* Filtro por UF */}
                                <div style={{ marginBottom: '6px' }}>
                                    <select
                                        className="input-internal"
                                        value={filtroUF}
                                        onChange={e => setFiltroUF(e.target.value)}
                                        style={{ fontSize: '11px', padding: '5px 8px', background: 'rgba(30,41,59,0.8)', color: '#f1f5f9', border: '1px solid rgba(71,85,105,0.6)', borderRadius: '6px' }}
                                    >
                                        <option value="" style={{ color: 'black' }}>Todos (UF)</option>
                                        {UFS_FILTRO.map(uf => <option key={uf} value={uf} style={{ color: 'black' }}>{uf}</option>)}
                                    </select>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input-internal"
                                        value={buscaMotorista || formLanca.motorista}
                                        onChange={e => {
                                            setBuscaMotorista(e.target.value);
                                            setFormLanca(prev => ({ ...prev, motorista: e.target.value }));
                                            setDropdownAberto(true);
                                        }}
                                        onFocus={() => setDropdownAberto(true)}
                                        onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                                        placeholder="Vazio = A DEFINIR"
                                        style={{ paddingRight: '30px' }}
                                    />
                                    <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                </div>
                                {formLanca.telefoneMotorista && (
                                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4ade80' }}>
                                        <Phone size={10} />
                                        <span>{formLanca.telefoneMotorista}</span>
                                    </div>
                                )}
                                {dropdownAberto && motoristasFiltered.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: '2px' }}>
                                        {motoristasFiltered.map(m => (
                                            <div key={m.id}
                                                onMouseDown={() => selecionarMotorista(m)}
                                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {m.nome_motorista}
                                                    {m.is_frota ? (
                                                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#60a5fa', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '4px', padding: '1px 6px' }}>
                                                            [FROTA]
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                    <span>{m.placa1}{m.placa2 ? ` / ${m.placa2}` : ''}</span>
                                                    <span>·</span>
                                                    <span>{m.tipo_veiculo}</span>
                                                    {m.disponibilidade && (
                                                        <>
                                                            <span>·</span>
                                                            <span style={{ color: '#94a3b8' }}>{m.disponibilidade}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="label-tech-sm"><Truck size={12} style={{ display: 'inline', marginRight: '4px' }} /> TIPO VEÍCULO</label>
                                <select className="input-internal" value={formLanca.tipoVeiculo} onChange={e => setFormLanca({ ...formLanca, tipoVeiculo: e.target.value })}>
                                    {OPCOES_VEICULO.map(v => <option key={v} style={{ color: 'black' }}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Linha 3: Placas editáveis (auto-preenchidas ao selecionar motorista, mas editáveis manualmente) */}
                        <datalist id="placas-provisao">
                            {veiculosProvisao.map(vp => (
                                <React.Fragment key={vp.id}>
                                    <option value={vp.placa} />
                                    {vp.carreta && <option value={vp.carreta} />}
                                </React.Fragment>
                            ))}
                        </datalist>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label className="label-tech-sm" style={{ color: '#60a5fa' }}>PLACA 1</label>
                                <input
                                    className="input-internal"
                                    list="placas-provisao"
                                    value={formLanca.placa1Motorista || ''}
                                    onChange={e => { setFormLanca(prev => ({ ...prev, placa1Motorista: e.target.value.toUpperCase() })); setEntregasConfirmadas(false); }}
                                    placeholder="ABC-1234"
                                    maxLength={8}
                                    style={{ fontFamily: 'monospace', fontWeight: '700', letterSpacing: '1px' }}
                                />
                            </div>
                            <div>
                                <label className="label-tech-sm" style={{ color: '#94a3b8' }}>PLACA 2 <span style={{ fontSize: '9px', color: '#475569' }}>(opcional)</span></label>
                                <input
                                    className="input-internal"
                                    list="placas-provisao"
                                    value={formLanca.placa2Motorista || ''}
                                    onChange={e => { setFormLanca(prev => ({ ...prev, placa2Motorista: e.target.value.toUpperCase() })); setEntregasConfirmadas(false); }}
                                    placeholder="ABC-1234"
                                    maxLength={8}
                                    style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                                />
                            </div>
                        </div>

                        {/* Campo de Telefone Manual (para lançamentos sem marcação) */}
                        <div>
                            <label className="label-tech-sm"><Phone size={12} style={{ display: 'inline', marginRight: '4px' }} /> TELEFONE DO MOTORISTA (WhatsApp)</label>
                            <input
                                className="input-internal"
                                type="text"
                                value={formLanca.telefoneMotorista || ''}
                                onChange={e => setFormLanca(prev => ({ ...prev, telefoneMotorista: e.target.value }))}
                                placeholder="(00) 00000-0000"
                                style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                            />
                            {!formLanca.telefoneMotorista && (
                                <span style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                                    ⚠️ Sem telefone, os botões de WhatsApp não funcionarão.
                                </span>
                            )}
                        </div>

                        {/* Campo de Observação */}
                        <div>
                            <label className="label-tech-sm"><FileText size={12} style={{ display: 'inline', marginRight: '4px' }} /> OBSERVAÇÃO</label>
                            <textarea
                                className="input-internal"
                                value={formLanca.observacao || ''}
                                onChange={e => setFormLanca({ ...formLanca, observacao: e.target.value })}
                                placeholder="Anotações gerais sobre a carga..."
                                rows={3}
                                style={{
                                    resize: 'vertical', fontFamily: 'inherit', fontSize: '12px',
                                    color: '#f1f5f9', background: 'rgba(30,41,59,0.8)',
                                    border: '1px solid rgba(71,85,105,0.6)'
                                }}
                            />
                        </div>

                        {/* Campo de Upload de Imagens */}
                        <div>
                            <label className="label-tech-sm"><Image size={12} style={{ display: 'inline', marginRight: '4px' }} /> IMAGENS (Comprovantes/Fotos)</label>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="input-internal"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files);
                                    files.forEach(file => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setFormLanca(prev => ({
                                                ...prev,
                                                imagens: [...(prev.imagens || []), reader.result]
                                            }));
                                        };
                                        reader.readAsDataURL(file);
                                    });
                                    e.target.value = '';
                                }}
                                style={{ padding: '8px', cursor: 'pointer' }}
                            />

                            {/* Preview das Imagens */}
                            {formLanca.imagens && formLanca.imagens.length > 0 && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                    {formLanca.imagens.map((img, idx) => (
                                        <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                            <img
                                                src={img}
                                                alt={`Preview ${idx + 1}`}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                    border: '2px solid rgba(59, 130, 246, 0.3)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => window.open(img, '_blank')}
                                            />
                                            <button
                                                onClick={() => {
                                                    setFormLanca(prev => ({
                                                        ...prev,
                                                        imagens: prev.imagens.filter((_, i) => i !== idx)
                                                    }));
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-5px',
                                                    right: '-5px',
                                                    background: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: '20px',
                                                    height: '20px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    color: 'white'
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Botão Lançar */}
                        <div style={{ marginTop: '10px' }}>
                            <button onClick={handleLancar} disabled={!!modalEntregas} className="btn-launch" style={{ width: '100%', opacity: modalEntregas ? 0.5 : 1, cursor: modalEntregas ? 'not-allowed' : 'pointer' }}>
                                <Truck size={18} /> LANÇAR VEÍCULO
                            </button>
                            {modalEntregas && (
                                <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px', textAlign: 'center' }}>
                                    ⚠️ Confirme as entregas do provisionamento para continuar.
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '50px' }}>
                        <Truck size={40} style={{ opacity: 0.2, margin: '0 auto 10px' }} />
                        <p style={{ fontSize: '12px' }}>Modo Apenas Visualização</p>
                    </div>
                )}
            </div>

            {/* Modal obrigatório de entregas do Provisionamento */}
            {modalEntregas && (
                <ModalEntregasProvisao
                    veiculo={modalEntregas.veiculo}
                    motorista={formLanca.motorista || ''}
                    dataSaida={formLanca.data_prevista || new Date().toISOString().substring(0, 10)}
                    onConfirmar={() => {
                        setEntregasConfirmadas(true);
                        setModalEntregas(null);
                        lancarVeiculoInteligente();
                    }}
                    onCancelar={() => {
                        setFormLanca(prev => ({ ...prev, placa1Motorista: '', placa2Motorista: '' }));
                        setEntregasConfirmadas(false);
                        setModalEntregas(null);
                    }}
                />
            )}
        </div>
    );
}
