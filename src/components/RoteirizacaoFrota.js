import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import api from '../services/apiService';
import TagInput from './TagInput';
import { OPCOES_OPERACAO, UFS_BRASIL } from '../constants';
import {
    parseColetaMoreno, joinColetaMoreno, opPrecisaSplit,
    opTemPlastico, opTemPorcelana, opTemEletrik
} from '../utils/coletaMoreno';

const estilos = {
    container: {
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto',
        color: '#e2e8f0',
        fontFamily: 'sans-serif',
    },
    titulo: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#f1f5f9',
        marginBottom: '24px',
        borderBottom: '1px solid #334155',
        paddingBottom: '12px',
    },
    secao: {
        background: '#1e293b',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px',
        border: '1px solid #334155',
    },
    secaoTitulo: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '16px',
    },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
    campo: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', color: '#94a3b8', fontWeight: '500' },
    input: {
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '6px',
        color: '#e2e8f0',
        padding: '8px 10px',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    },
    select: {
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '6px',
        color: '#e2e8f0',
        padding: '8px 10px',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    },
    autoCompleteWrap: { position: 'relative' },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '6px',
        zIndex: 50,
        maxHeight: '180px',
        overflowY: 'auto',
    },
    dropdownItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#cbd5e1',
    },
    destinoLinha: {
        display: 'grid',
        gridTemplateColumns: '1fr 90px 140px 36px',
        gap: '8px',
        alignItems: 'end',
        marginBottom: '8px',
    },
    btnIcone: {
        background: '#334155',
        border: 'none',
        borderRadius: '6px',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnAdicionarDestino: {
        background: '#1e3a5f',
        border: '1px dashed #3b82f6',
        borderRadius: '6px',
        color: '#60a5fa',
        cursor: 'pointer',
        padding: '8px 14px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '4px',
    },
    rodape: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '20px',
    },
    btnSalvar: {
        background: '#2563eb',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        cursor: 'pointer',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    btnCancelar: {
        background: '#334155',
        border: 'none',
        borderRadius: '6px',
        color: '#cbd5e1',
        cursor: 'pointer',
        padding: '10px 20px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    notif: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: '#166534',
        color: '#bbf7d0',
        padding: '12px 18px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px',
    },
};

const destinoVazio = () => ({ cidade: '', uf: 'PE', data: '' });

const FORM_INICIAL = {
    nome_cliente: '',
    coleta_recife: '',
    coleta_moreno_plastico: '',
    coleta_moreno_porcelana: '',
    coleta_moreno_eletrik: '',
    operacao: '',
    motorista_nome: '',
    motorista_id: null,
    placa_cavalo: '',
    placa_carreta: '',
    origem: '',
    quantidade_entregas: 1,
    data_entrada_operacao: '',
    data_saida: '',
    data_retorno_prevista: '',
};

export default function RoteirizacaoFrota({ socket, user, roteirizacaoEditando, onSalvo, onCancelar }) {
    const [form, setForm] = useState(FORM_INICIAL);
    const [destinos, setDestinos] = useState([destinoVazio()]);
    const [motoristas, setMotoristas] = useState([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [mostrarDropMotorista, setMostrarDropMotorista] = useState(false);
    const [veiculos, setVeiculos] = useState([]);
    const [buscaCavalo, setBuscaCavalo] = useState('');
    const [mostrarDropCavalo, setMostrarDropCavalo] = useState(false);
    const [buscaCarreta, setBuscaCarreta] = useState('');
    const [mostrarDropCarreta, setMostrarDropCarreta] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [notif, setNotif] = useState(null);
    const [modalCadastroPlaca, setModalCadastroPlaca] = useState(null); // { placa, tipo: 'cavalo'|'carreta' }
    const [tipoProv, setTipoProv] = useState('TRUCK');
    const [cadastrandoPlaca, setCadastrandoPlaca] = useState(false);

    useEffect(() => {
        api.get('/api/marcacoes/disponiveis').then(r => {
            const lista = (r.data?.motoristas || []).filter(m => m.is_frota);
            setMotoristas(lista);
        }).catch(() => {});
        api.get('/api/provisionamento/veiculos').then(r => {
            setVeiculos(r.data?.veiculos || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (roteirizacaoEditando) {
            const r = roteirizacaoEditando;
            const cm = parseColetaMoreno(r.coleta_moreno || '', r.operacao);
            setForm({
                nome_cliente: r.nome_cliente || '',
                coleta_recife: r.coleta_recife || '',
                coleta_moreno_plastico: cm.plastico || '',
                coleta_moreno_porcelana: cm.porcelana || '',
                coleta_moreno_eletrik: cm.eletrik || '',
                operacao: r.operacao || '',
                motorista_nome: r.motorista_nome || '',
                motorista_id: r.motorista_id || null,
                placa_cavalo: r.placa_cavalo || '',
                placa_carreta: r.placa_carreta || '',
                origem: r.origem || '',
                quantidade_entregas: r.quantidade_entregas || 1,
                data_entrada_operacao: r.data_entrada_operacao ? r.data_entrada_operacao.substring(0, 16) : '',
                data_saida: r.data_saida ? r.data_saida.substring(0, 16) : '',
                data_retorno_prevista: r.data_retorno_prevista || '',
            });
            setBuscaMotorista(r.motorista_nome || '');
            setBuscaCavalo(r.placa_cavalo || '');
            setBuscaCarreta(r.placa_carreta || '');
            setDestinos((r.destinos || []).length > 0 ? r.destinos : [destinoVazio()]);
        }
    }, [roteirizacaoEditando]);

    const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

    const motoristasFiltrados = motoristas.filter(m =>
        (m.nome_motorista || '').toLowerCase().includes(buscaMotorista.toLowerCase())
    );

    const veiculosCavaloFiltrados = veiculos.filter(v =>
        (v.placa || '').toLowerCase().includes(buscaCavalo.toLowerCase())
    );

    const veiculosFiltrados = veiculos.filter(v =>
        (v.placa || '').toLowerCase().includes(buscaCarreta.toLowerCase())
    );

    const selecionarMotorista = (m) => {
        set('motorista_nome', m.nome_motorista);
        set('motorista_id', m.id);
        setBuscaMotorista(m.nome_motorista);
        setMostrarDropMotorista(false);
    };

    const selecionarCavalo = (v) => {
        set('placa_cavalo', v.placa);
        setBuscaCavalo(v.placa);
        setMostrarDropCavalo(false);
    };

    const selecionarCarreta = (v) => {
        set('placa_carreta', v.placa);
        setBuscaCarreta(v.placa);
        setMostrarDropCarreta(false);
    };

    const atualizarDestino = (idx, campo, valor) => {
        setDestinos(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d));
    };

    const adicionarDestino = () => {
        setDestinos(prev => [...prev, destinoVazio()]);
        set('quantidade_entregas', destinos.length + 1);
    };

    const removerDestino = (idx) => {
        if (destinos.length <= 1) return;
        const novos = destinos.filter((_, i) => i !== idx);
        setDestinos(novos);
        set('quantidade_entregas', novos.length);
    };

    const coletaMorenoMontada = useCallback(() => {
        return joinColetaMoreno({
            plastico: form.coleta_moreno_plastico,
            porcelana: form.coleta_moreno_porcelana,
            eletrik: form.coleta_moreno_eletrik,
        });
    }, [form.coleta_moreno_plastico, form.coleta_moreno_porcelana, form.coleta_moreno_eletrik]);

    const temRecife = (op) => !!op && (op.includes('PLÁSTICO(RECIFE)') || op.includes('RECIFE X MORENO'));

    const exibirCamposMoreno = (op) => {
        if (!op) return {};
        return {
            plastico: opTemPlastico(op),
            porcelana: opTemPorcelana(op),
            eletrik: opTemEletrik(op),
            split: opPrecisaSplit(op),
        };
    };

    const mostrarNotif = (msg) => {
        setNotif(msg);
        setTimeout(() => setNotif(null), 3000);
    };

    const limpar = () => {
        setForm(FORM_INICIAL);
        setBuscaMotorista('');
        setBuscaCavalo('');
        setBuscaCarreta('');
        setDestinos([destinoVazio()]);
        if (onCancelar) onCancelar();
    };

    const placaNaoExiste = (placa) => {
        if (!placa) return false;
        return !veiculos.some(v => v.placa?.toUpperCase() === placa.toUpperCase());
    };

    const cadastrarPlacaNoProv = async () => {
        if (!modalCadastroPlaca) return;
        setCadastrandoPlaca(true);
        try {
            const r = await api.post('/api/provisionamento/veiculos', {
                placa: modalCadastroPlaca.placa,
                tipo_veiculo: tipoProv,
            });
            const novoId = r.data?.id;
            setVeiculos(prev => [...prev, { id: novoId, placa: modalCadastroPlaca.placa, tipo: tipoProv }]);
            setModalCadastroPlaca(null);
            await executarSalvar();
        } catch (e) {
            mostrarNotif('Erro ao cadastrar placa no provisionamento.');
        } finally {
            setCadastrandoPlaca(false);
        }
    };

    const salvar = async () => {
        if (!form.operacao) return mostrarNotif('Operação é obrigatória.');
        if (!form.motorista_nome) return mostrarNotif('Motorista é obrigatório.');

        if (form.placa_cavalo && placaNaoExiste(form.placa_cavalo)) {
            setTipoProv('TRUCK');
            setModalCadastroPlaca({ placa: form.placa_cavalo, tipo: 'cavalo' });
            return;
        }
        if (form.placa_carreta && placaNaoExiste(form.placa_carreta)) {
            setTipoProv('CARRETA');
            setModalCadastroPlaca({ placa: form.placa_carreta, tipo: 'carreta' });
            return;
        }

        await executarSalvar();
    };

    const executarSalvar = async () => {
        setSalvando(true);
        try {
            const payload = {
                nome_cliente: form.nome_cliente,
                coleta_recife: form.coleta_recife,
                coleta_moreno: coletaMorenoMontada(),
                operacao: form.operacao,
                motorista_nome: form.motorista_nome,
                motorista_id: form.motorista_id,
                placa_cavalo: form.placa_cavalo,
                placa_carreta: form.placa_carreta,
                origem: form.origem,
                quantidade_entregas: destinos.length,
                destinos,
                data_entrada_operacao: form.data_entrada_operacao || null,
                data_saida: form.data_saida || null,
                data_retorno_prevista: form.data_retorno_prevista || null,
            };

            if (roteirizacaoEditando?.id) {
                await api.put(`/api/roteirizacao/${roteirizacaoEditando.id}`, payload);
                mostrarNotif('Roteirização atualizada!');
            } else {
                await api.post('/api/roteirizacao', payload);
                mostrarNotif('Roteirização criada!');
                setForm(FORM_INICIAL);
                setBuscaMotorista('');
                setBuscaCavalo('');
                setBuscaCarreta('');
                setDestinos([destinoVazio()]);
            }
            if (onSalvo) onSalvo();
        } catch (e) {
            mostrarNotif('Erro ao salvar roteirização.');
        } finally {
            setSalvando(false);
        }
    };

    const moreno = exibirCamposMoreno(form.operacao);

    return (
        <div style={estilos.container}>
            {notif && <div style={estilos.notif}>{notif}</div>}
            <div style={estilos.titulo}>
                {roteirizacaoEditando ? 'Editar Roteirização' : 'Nova Roteirização — Frota Própria'}
            </div>

            {/* Seção: Identificação */}
            <div style={estilos.secao}>
                <div style={estilos.secaoTitulo}>Identificação</div>
                <div style={estilos.grid2}>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Nome do Cliente</label>
                        <input
                            style={estilos.input}
                            value={form.nome_cliente}
                            onChange={e => set('nome_cliente', e.target.value)}
                            placeholder="Ex: ABC Comércio"
                        />
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Operação *</label>
                        <select
                            style={estilos.select}
                            value={form.operacao}
                            onChange={e => set('operacao', e.target.value)}
                        >
                            <option value="">— Selecione —</option>
                            {OPCOES_OPERACAO.map(op => (
                                <option key={op} value={op}>{op}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Seção: Coletas */}
            <div style={estilos.secao}>
                <div style={estilos.secaoTitulo}>Coletas</div>
                <div style={estilos.grid2}>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Coleta Recife</label>
                        <TagInput
                            value={form.coleta_recife}
                            onChange={v => set('coleta_recife', v)}
                            disabled={!!form.operacao && !temRecife(form.operacao)}
                        />
                    </div>
                    {!moreno.split && (moreno.plastico || moreno.porcelana || moreno.eletrik) ? (
                        <div style={estilos.campo}>
                            <label style={estilos.label}>Coleta Moreno</label>
                            <TagInput
                                value={moreno.plastico ? form.coleta_moreno_plastico : moreno.porcelana ? form.coleta_moreno_porcelana : form.coleta_moreno_eletrik}
                                onChange={v => {
                                    if (moreno.plastico) set('coleta_moreno_plastico', v);
                                    else if (moreno.porcelana) set('coleta_moreno_porcelana', v);
                                    else set('coleta_moreno_eletrik', v);
                                }}
                            />
                        </div>
                    ) : moreno.split ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {moreno.plastico && (
                                <div style={estilos.campo}>
                                    <label style={estilos.label}>Coleta Moreno — Plástico</label>
                                    <TagInput value={form.coleta_moreno_plastico} onChange={v => set('coleta_moreno_plastico', v)} />
                                </div>
                            )}
                            {moreno.porcelana && (
                                <div style={estilos.campo}>
                                    <label style={estilos.label}>Coleta Moreno — Porcelana</label>
                                    <TagInput value={form.coleta_moreno_porcelana} onChange={v => set('coleta_moreno_porcelana', v)} />
                                </div>
                            )}
                            {moreno.eletrik && (
                                <div style={estilos.campo}>
                                    <label style={estilos.label}>Coleta Moreno — Eletrik</label>
                                    <TagInput value={form.coleta_moreno_eletrik} onChange={v => set('coleta_moreno_eletrik', v)} />
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Seção: Veículo e Motorista */}
            <div style={estilos.secao}>
                <div style={estilos.secaoTitulo}>Veículo e Motorista</div>
                <div style={estilos.grid2}>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Motorista *</label>
                        <div style={estilos.autoCompleteWrap}>
                            <input
                                style={estilos.input}
                                value={buscaMotorista}
                                onChange={e => { setBuscaMotorista(e.target.value); set('motorista_nome', e.target.value); set('motorista_id', null); setMostrarDropMotorista(true); }}
                                onFocus={() => setMostrarDropMotorista(true)}
                                onBlur={() => setTimeout(() => setMostrarDropMotorista(false), 150)}
                                placeholder="Digite o nome..."
                            />
                            {mostrarDropMotorista && motoristasFiltrados.length > 0 && (
                                <div style={estilos.dropdown}>
                                    {motoristasFiltrados.map(m => (
                                        <div
                                            key={m.id}
                                            style={estilos.dropdownItem}
                                            onMouseDown={() => selecionarMotorista(m)}
                                            onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {m.nome_motorista}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Origem</label>
                        <input
                            style={estilos.input}
                            value={form.origem}
                            onChange={e => set('origem', e.target.value)}
                            placeholder="Ex: Recife, Moreno..."
                        />
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Placa Cavalo</label>
                        <div style={estilos.autoCompleteWrap}>
                            <input
                                style={estilos.input}
                                value={buscaCavalo}
                                onChange={e => { setBuscaCavalo(e.target.value.toUpperCase()); set('placa_cavalo', e.target.value.toUpperCase()); setMostrarDropCavalo(true); }}
                                onFocus={() => setMostrarDropCavalo(true)}
                                onBlur={() => setTimeout(() => setMostrarDropCavalo(false), 150)}
                                placeholder="Buscar ou digitar placa..."
                            />
                            {mostrarDropCavalo && veiculosCavaloFiltrados.length > 0 && (
                                <div style={estilos.dropdown}>
                                    {veiculosCavaloFiltrados.map(v => (
                                        <div
                                            key={v.id}
                                            style={estilos.dropdownItem}
                                            onMouseDown={() => selecionarCavalo(v)}
                                            onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {v.placa} {v.tipo ? `(${v.tipo})` : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Placa Carreta</label>
                        <div style={estilos.autoCompleteWrap}>
                            <input
                                style={estilos.input}
                                value={buscaCarreta}
                                onChange={e => { setBuscaCarreta(e.target.value.toUpperCase()); set('placa_carreta', e.target.value.toUpperCase()); setMostrarDropCarreta(true); }}
                                onFocus={() => setMostrarDropCarreta(true)}
                                onBlur={() => setTimeout(() => setMostrarDropCarreta(false), 150)}
                                placeholder="Buscar ou digitar placa..."
                            />
                            {mostrarDropCarreta && veiculosFiltrados.length > 0 && (
                                <div style={estilos.dropdown}>
                                    {veiculosFiltrados.map(v => (
                                        <div
                                            key={v.id}
                                            style={estilos.dropdownItem}
                                            onMouseDown={() => selecionarCarreta(v)}
                                            onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {v.placa} {v.tipo ? `(${v.tipo})` : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção: Datas */}
            <div style={estilos.secao}>
                <div style={estilos.secaoTitulo}>Datas</div>
                <div style={estilos.grid2}>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Entrada em Operação</label>
                        <input
                            type="datetime-local"
                            style={estilos.input}
                            value={form.data_entrada_operacao}
                            onChange={e => set('data_entrada_operacao', e.target.value)}
                        />
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Saída (data e hora)</label>
                        <input
                            type="datetime-local"
                            style={estilos.input}
                            value={form.data_saida}
                            onChange={e => set('data_saida', e.target.value)}
                        />
                    </div>
                    <div style={estilos.campo}>
                        <label style={estilos.label}>Previsão de Retorno</label>
                        <input
                            type="date"
                            style={estilos.input}
                            value={form.data_retorno_prevista}
                            onChange={e => set('data_retorno_prevista', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Seção: Destinos */}
            <div style={estilos.secao}>
                <div style={estilos.secaoTitulo}>Destinos ({destinos.length})</div>
                {destinos.map((d, idx) => (
                    <div key={idx} style={estilos.destinoLinha}>
                        <div style={estilos.campo}>
                            {idx === 0 && <label style={estilos.label}>Cidade</label>}
                            <input
                                style={estilos.input}
                                value={d.cidade}
                                onChange={e => atualizarDestino(idx, 'cidade', e.target.value)}
                                placeholder="Ex: Caruaru"
                            />
                        </div>
                        <div style={estilos.campo}>
                            {idx === 0 && <label style={estilos.label}>UF</label>}
                            <select
                                style={estilos.select}
                                value={d.uf}
                                onChange={e => atualizarDestino(idx, 'uf', e.target.value)}
                            >
                                {UFS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </div>
                        <div style={estilos.campo}>
                            {idx === 0 && <label style={estilos.label}>Data Entrega</label>}
                            <input
                                type="date"
                                style={estilos.input}
                                value={d.data}
                                onChange={e => atualizarDestino(idx, 'data', e.target.value)}
                            />
                        </div>
                        <button
                            style={{ ...estilos.btnIcone, marginTop: idx === 0 ? '20px' : '0', opacity: destinos.length <= 1 ? 0.3 : 1 }}
                            onClick={() => removerDestino(idx)}
                            disabled={destinos.length <= 1}
                            title="Remover destino"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                <button style={estilos.btnAdicionarDestino} onClick={adicionarDestino}>
                    <Plus size={14} /> Adicionar Destino
                </button>
            </div>

            {/* Modal: Cadastrar placa no provisionamento */}
            {modalCadastroPlaca && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#1e293b', border: '1px solid #f97316', borderRadius: '10px', padding: '24px', maxWidth: '400px', width: '100%' }}>
                        <div style={{ fontWeight: '700', color: '#fb923c', fontSize: '16px', marginBottom: '12px' }}>
                            Placa não cadastrada
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '16px' }}>
                            A placa <strong style={{ color: '#f1f5f9' }}>{modalCadastroPlaca.placa}</strong> ({modalCadastroPlaca.tipo === 'cavalo' ? 'cavalo' : 'carreta'}) não está cadastrada no provisionamento. Deseja cadastrá-la agora?
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Tipo de Veículo</label>
                            <select
                                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', padding: '8px 10px', fontSize: '14px', width: '100%' }}
                                value={tipoProv}
                                onChange={e => setTipoProv(e.target.value)}
                            >
                                <option value="TRUCK">TRUCK</option>
                                <option value="3/4">3/4</option>
                                <option value="CONJUNTO">CONJUNTO</option>
                                <option value="CARRETA">CARRETA</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setModalCadastroPlaca(null); set(modalCadastroPlaca.tipo === 'cavalo' ? 'placa_cavalo' : 'placa_carreta', ''); setBuscaCavalo(modalCadastroPlaca.tipo === 'cavalo' ? '' : buscaCavalo); setBuscaCarreta(modalCadastroPlaca.tipo === 'carreta' ? '' : buscaCarreta); }}
                                style={{ background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', padding: '8px 14px', fontSize: '13px' }}
                            >
                                Não, era um erro
                            </button>
                            <button
                                onClick={cadastrarPlacaNoProv}
                                disabled={cadastrandoPlaca}
                                style={{ background: '#7c3aed', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', padding: '8px 14px', fontSize: '13px', fontWeight: '600' }}
                            >
                                {cadastrandoPlaca ? 'Cadastrando...' : 'Sim, cadastrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rodapé */}
            <div style={estilos.rodape}>
                <button style={estilos.btnCancelar} onClick={limpar}>
                    <RotateCcw size={14} /> {roteirizacaoEditando ? 'Cancelar' : 'Limpar'}
                </button>
                <button style={estilos.btnSalvar} onClick={salvar} disabled={salvando}>
                    <Save size={14} /> {salvando ? 'Salvando...' : roteirizacaoEditando ? 'Atualizar' : 'Criar Roteirização'}
                </button>
            </div>
        </div>
    );
}
