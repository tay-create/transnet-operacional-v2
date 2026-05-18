import React, { useEffect, useMemo, useState } from 'react';
import { X, Shuffle, Warehouse, AlertCircle, Save, RotateCcw } from 'lucide-react';
import api from '../../services/apiService';

// Pontos de retorno aceitos pelo backend (ver POST /veiculos/:id/remanejamento).
const PONTOS_RETORNO = [
    { key: 'RECIFE/PE', label: 'CD Recife (Várzea)' },
    { key: 'MORENO/PE', label: 'CD Moreno (Distrito Industrial)' },
];

function deduzirPontoRetornoPelaOperacao(operacao) {
    const op = String(operacao || '').toUpperCase().trim();
    if (op.includes('RECIFE')) return 'RECIFE/PE';
    return 'MORENO/PE';
}

function formatarDataBr(iso) {
    if (!iso || typeof iso !== 'string') return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}`;
}

function cidadeUfLabel(d) {
    if (d?.cidade && d?.uf) return `${d.cidade}/${d.uf}`;
    return d?.cidade_uf || '—';
}

export default function ModalRemanejamento({ veiculo, onConfirmar, onCancelar }) {
    // Destinos atuais (do card). Se já houver remanejamento, usa o snapshot original.
    const destinosBase = useMemo(() => {
        if (!veiculo) return [];
        if (veiculo.remanejamento_json) {
            try {
                const rem = typeof veiculo.remanejamento_json === 'string'
                    ? JSON.parse(veiculo.remanejamento_json)
                    : veiculo.remanejamento_json;
                if (Array.isArray(rem?.destinos_originais)) return rem.destinos_originais;
            } catch {}
        }
        try {
            const d = typeof veiculo.destinos_json === 'string'
                ? JSON.parse(veiculo.destinos_json)
                : veiculo.destinos_json;
            return Array.isArray(d) ? d : [];
        } catch { return []; }
    }, [veiculo]);

    // Marcação inicial: se já existe remanejamento, pré-marca o que está remanejado.
    const remanejamentoExistente = useMemo(() => {
        if (!veiculo?.remanejamento_json) return null;
        try {
            return typeof veiculo.remanejamento_json === 'string'
                ? JSON.parse(veiculo.remanejamento_json)
                : veiculo.remanejamento_json;
        } catch { return null; }
    }, [veiculo]);

    const [pontoRetorno, setPontoRetorno] = useState(() =>
        remanejamentoExistente?.ponto_retorno || deduzirPontoRetornoPelaOperacao(veiculo?.operacao)
    );
    // marcadosOriginal[i] = true → destino i fica com original; false → remanejar.
    const [marcadosOriginal, setMarcadosOriginal] = useState(() => {
        const arr = destinosBase.map(() => true);
        if (remanejamentoExistente?.transferencias) {
            for (const t of remanejamentoExistente.transferencias) {
                for (const d of (t.destinos || [])) {
                    const idx = destinosBase.findIndex(o =>
                        (o.cidade_uf && o.cidade_uf === d.cidade_uf)
                        || (o.cidade === d.cidade && o.uf === d.uf && o.data === d.data)
                    );
                    if (idx >= 0) arr[idx] = false;
                }
            }
        }
        return arr;
    });
    // atribuicoes[idx_destino] = { prov_veiculo_id, motorista }
    const [atribuicoes, setAtribuicoes] = useState(() => {
        const map = {};
        if (remanejamentoExistente?.transferencias) {
            for (const t of remanejamentoExistente.transferencias) {
                for (const d of (t.destinos || [])) {
                    const idx = destinosBase.findIndex(o =>
                        (o.cidade_uf && o.cidade_uf === d.cidade_uf)
                        || (o.cidade === d.cidade && o.uf === d.uf && o.data === d.data)
                    );
                    if (idx >= 0) map[idx] = { prov_veiculo_id: t.prov_veiculo_id, motorista: t.motorista || '' };
                }
            }
        }
        return map;
    });

    const [veiculosFrota, setVeiculosFrota] = useState([]);
    const [motoristasFrota, setMotoristasFrota] = useState([]); // de /api/cadastro/frota
    const [placasFrota, setPlacasFrota] = useState(new Set()); // de /api/cadastro/placas-frota
    const [salvando, setSalvando] = useState(false);
    const [desfazendo, setDesfazendo] = useState(false);
    const [warning, setWarning] = useState('');

    useEffect(() => {
        api.get('/api/provisionamento/veiculos')
            .then(r => { if (r.data?.success) setVeiculosFrota(r.data.veiculos || []); })
            .catch(err => console.warn('Falha ao carregar veículos da frota:', err));
        api.get('/api/cadastro/frota')
            .then(r => { if (r.data?.success) setMotoristasFrota(r.data.motoristas || []); })
            .catch(err => console.warn('Falha ao carregar motoristas da frota:', err));
        api.get('/api/cadastro/placas-frota')
            .then(r => {
                if (r.data?.success) {
                    setPlacasFrota(new Set((r.data.placas || []).map(p => String(p).toUpperCase().trim())));
                }
            })
            .catch(err => console.warn('Falha ao carregar placas da frota:', err));
    }, []);

    // Só permitir remanejar para veículos cuja placa esteja marcada como is_frota=1.
    const veiculosFiltrados = useMemo(() => {
        if (placasFrota.size === 0) return veiculosFrota; // ainda carregando: mostra tudo
        return veiculosFrota.filter(v => placasFrota.has(String(v.placa || '').toUpperCase().trim()));
    }, [veiculosFrota, placasFrota]);

    // Toggle de "fica com original" com regra: desmarcados devem ser contíguos a partir do final.
    const toggleDestino = (idx) => {
        setWarning('');
        setMarcadosOriginal(prev => {
            const next = [...prev];
            const novoValor = !next[idx];
            next[idx] = novoValor;
            // Validação: a partir do primeiro desmarcado, todos seguintes devem estar desmarcados também
            // (só dá pra remanejar os ÚLTIMOS destinos contíguos)
            let primeiroDesmarcado = -1;
            for (let i = 0; i < next.length; i++) {
                if (!next[i]) { primeiroDesmarcado = i; break; }
            }
            if (primeiroDesmarcado >= 0) {
                // Marca tudo do primeiroDesmarcado em diante como desmarcado
                for (let i = primeiroDesmarcado; i < next.length; i++) next[i] = false;
                if (idx < primeiroDesmarcado) {
                    setWarning('Só é possível remanejar os ÚLTIMOS destinos consecutivos. Os destinos abaixo foram desmarcados automaticamente.');
                }
            }
            // Limpa atribuicoes dos que voltaram a "ficar com original"
            setAtribuicoes(curr => {
                const limpa = { ...curr };
                next.forEach((fica, i) => { if (fica && limpa[i]) delete limpa[i]; });
                return limpa;
            });
            return next;
        });
    };

    const remanejados = useMemo(
        () => destinosBase.map((d, i) => ({ d, i })).filter(({ i }) => !marcadosOriginal[i]),
        [destinosBase, marcadosOriginal]
    );

    const setAtribuicao = (idx, campo, valor) => {
        setAtribuicoes(prev => ({
            ...prev,
            [idx]: { ...(prev[idx] || {}), [campo]: valor }
        }));
    };

    const aplicarMesmoVeiculoTodos = () => {
        const primeiroIdx = remanejados[0]?.i;
        if (primeiroIdx == null) return;
        const ref = atribuicoes[primeiroIdx];
        if (!ref?.prov_veiculo_id) {
            setWarning('Selecione o veículo do primeiro destino antes de aplicar a todos.');
            return;
        }
        setAtribuicoes(prev => {
            const next = { ...prev };
            for (const { i } of remanejados) {
                next[i] = { prov_veiculo_id: ref.prov_veiculo_id, motorista: ref.motorista || '' };
            }
            return next;
        });
    };

    // Quando seleciona um veículo, sugere o motorista padrão dele
    const onSelecionarVeiculo = (idx, provVeicId) => {
        const v = veiculosFrota.find(x => x.id === Number(provVeicId));
        setAtribuicoes(prev => ({
            ...prev,
            [idx]: {
                prov_veiculo_id: provVeicId ? Number(provVeicId) : null,
                motorista: prev[idx]?.motorista || (v?.motorista || ''),
            }
        }));
    };

    const podeSalvar = useMemo(() => {
        if (remanejados.length === 0) return false;
        for (const { i } of remanejados) {
            const a = atribuicoes[i];
            if (!a?.prov_veiculo_id) return false;
        }
        return true;
    }, [remanejados, atribuicoes]);

    const montarPayload = () => {
        const grupos = new Map();
        for (const { i } of remanejados) {
            const a = atribuicoes[i];
            if (!a?.prov_veiculo_id) continue;
            const key = a.prov_veiculo_id;
            if (!grupos.has(key)) {
                grupos.set(key, { prov_veiculo_id: key, motorista: a.motorista || '', destinos_idx_originais: [] });
            }
            grupos.get(key).destinos_idx_originais.push(i);
        }
        return { ponto_retorno: pontoRetorno, transferencias: Array.from(grupos.values()) };
    };

    const confirmar = async () => {
        if (!podeSalvar || !veiculo?.id) return;
        setSalvando(true);
        try {
            const payload = montarPayload();
            const r = await api.post(`/veiculos/${veiculo.id}/remanejamento`, payload);
            if (r.data?.success) onConfirmar?.(r.data);
        } catch (err) {
            setWarning('Erro ao salvar remanejamento. Tente novamente.');
            console.error(err);
        } finally {
            setSalvando(false);
        }
    };

    const desfazer = async () => {
        if (!veiculo?.id) return;
        if (!window.confirm('Desfazer o remanejamento? Os destinos voltarão para o caminhão original e as marcações no Provisionamento serão removidas.')) return;
        setDesfazendo(true);
        try {
            const r = await api.delete(`/veiculos/${veiculo.id}/remanejamento`);
            if (r.data?.success) onConfirmar?.({ desfeito: true });
        } catch (err) {
            setWarning('Erro ao desfazer remanejamento.');
        } finally {
            setDesfazendo(false);
        }
    };

    const veiculoFromId = (id) => veiculosFrota.find(v => v.id === Number(id));

    return (
        <div
            onClick={onCancelar}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f172a', borderRadius: 14, width: '100%', maxWidth: 720,
                    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>
                            <Shuffle size={18} color="#a78bfa" /> Remanejamento de entregas
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                            Coleta {veiculo?.coletaRecife || veiculo?.coletaMoreno || veiculo?.coletaInterestadual || ''} · {destinosBase.length} destino(s) original(is)
                        </div>
                    </div>
                    <button onClick={onCancelar} style={{ background: 'transparent', border: 0, color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Passo 1: ponto de retorno */}
                    <div>
                        <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>1. Ponto de retorno</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {PONTOS_RETORNO.map(p => (
                                <label key={p.key} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: pontoRetorno === p.key ? 'rgba(167,139,250,0.15)' : 'rgba(30,41,59,0.6)',
                                    border: `1px solid ${pontoRetorno === p.key ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                                    color: pontoRetorno === p.key ? '#e2e8f0' : '#94a3b8', fontSize: 13, fontWeight: 600
                                }}>
                                    <input
                                        type="radio"
                                        name="ponto_retorno"
                                        checked={pontoRetorno === p.key}
                                        onChange={() => setPontoRetorno(p.key)}
                                        style={{ accentColor: '#a78bfa' }}
                                    />
                                    <Warehouse size={14} color={pontoRetorno === p.key ? '#a78bfa' : '#64748b'} />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Passo 2: marcação dos destinos */}
                    <div>
                        <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>2. Destinos</div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                            Marque os destinos que <strong style={{ color: '#cbd5e1' }}>ficam com o caminhão original</strong>. Os desmarcados serão remanejados.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {destinosBase.map((d, i) => {
                                const fica = marcadosOriginal[i];
                                return (
                                    <label key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                        background: fica ? 'rgba(30,41,59,0.6)' : 'rgba(167,139,250,0.08)',
                                        border: `1px solid ${fica ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.35)'}`,
                                        borderRadius: 8, cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={fica}
                                            onChange={() => toggleDestino(i)}
                                            style={{ accentColor: '#22c55e' }}
                                        />
                                        <span style={{
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: fica ? '#3b82f6' : '#a78bfa', color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 700
                                        }}>{i + 1}</span>
                                        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, flex: 1 }}>
                                            {cidadeUfLabel(d)}
                                        </span>
                                        {d.data && (
                                            <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>
                                                {formatarDataBr(d.data)}
                                            </span>
                                        )}
                                        {!fica && (
                                            <span style={{
                                                background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
                                                fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                                fontWeight: 700, letterSpacing: 0.5
                                            }}>REMANEJAR</span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Passo 3: atribuição de veículos */}
                    {remanejados.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>3. Veículo e motorista para cada remanejado</div>
                                {remanejados.length > 1 && (
                                    <button
                                        onClick={aplicarMesmoVeiculoTodos}
                                        style={{
                                            background: 'transparent', border: '1px solid rgba(167,139,250,0.4)',
                                            color: '#a78bfa', fontSize: 10, fontWeight: 600,
                                            padding: '4px 10px', borderRadius: 6, cursor: 'pointer'
                                        }}>
                                        Mesmo veículo pra todos
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {remanejados.map(({ d, i }) => {
                                    const a = atribuicoes[i] || {};
                                    return (
                                        <div key={i} style={{
                                            display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8,
                                            alignItems: 'center', padding: '8px 12px',
                                            background: 'rgba(30,41,59,0.5)', borderRadius: 8
                                        }}>
                                            <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
                                                <span style={{ color: '#a78bfa', fontWeight: 700 }}>{i + 1}.</span> {cidadeUfLabel(d)}
                                                {d.data && <div style={{ color: '#64748b', fontSize: 10 }}>{formatarDataBr(d.data)}</div>}
                                            </div>
                                            <select
                                                value={a.prov_veiculo_id || ''}
                                                onChange={e => onSelecionarVeiculo(i, e.target.value)}
                                                style={{
                                                    background: '#1e293b', color: '#e2e8f0',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none'
                                                }}
                                            >
                                                <option value="">Selecione veículo…</option>
                                                {veiculosFiltrados.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {[v.placa, v.carreta].filter(Boolean).join(' / ')} · {v.tipo_veiculo}
                                                    </option>
                                                ))}
                                                {veiculosFiltrados.length === 0 && placasFrota.size > 0 && (
                                                    <option value="" disabled>Nenhum veículo da casa cadastrado em Marcações (is_frota=1)</option>
                                                )}
                                            </select>
                                            <select
                                                value={a.motorista || ''}
                                                onChange={e => setAtribuicao(i, 'motorista', e.target.value)}
                                                style={{
                                                    background: '#1e293b', color: '#e2e8f0',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none'
                                                }}
                                            >
                                                <option value="">Selecione motorista…</option>
                                                {/* Motorista padrão do veículo selecionado (se ainda não está na lista da frota) */}
                                                {(() => {
                                                    const v = veiculoFromId(a.prov_veiculo_id);
                                                    const padrao = (v?.motorista || '').trim();
                                                    if (padrao && !motoristasFrota.some(m => m.nome_motorista.toUpperCase() === padrao.toUpperCase())) {
                                                        return <option value={padrao}>{padrao} (do veículo)</option>;
                                                    }
                                                    return null;
                                                })()}
                                                {motoristasFrota.map(m => (
                                                    <option key={m.id} value={m.nome_motorista}>
                                                        {m.nome_motorista}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Passo 4: resumo */}
                    {remanejados.length > 0 && podeSalvar && (
                        <div style={{
                            padding: 12, background: 'rgba(34,197,94,0.06)',
                            border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8
                        }}>
                            <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>4. Resumo</div>
                            <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5 }}>
                                Caminhão original vai até <strong>{cidadeUfLabel(destinosBase[marcadosOriginal.lastIndexOf(true)] || destinosBase[0])}</strong> e retorna para o <strong>{PONTOS_RETORNO.find(p => p.key === pontoRetorno)?.label}</strong>.
                                <br />
                                <strong>Transferências:</strong>
                                <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 18 }}>
                                    {Object.entries(
                                        remanejados.reduce((acc, { d, i }) => {
                                            const a = atribuicoes[i];
                                            if (!a?.prov_veiculo_id) return acc;
                                            const key = a.prov_veiculo_id;
                                            if (!acc[key]) acc[key] = { motorista: a.motorista || '', destinos: [] };
                                            acc[key].destinos.push(d);
                                            return acc;
                                        }, {})
                                    ).map(([provId, info]) => {
                                        const v = veiculoFromId(provId);
                                        return (
                                            <li key={provId} style={{ marginBottom: 3 }}>
                                                <strong>{v ? [v.placa, v.carreta].filter(Boolean).join(' / ') : `Veículo #${provId}`}</strong>
                                                {info.motorista ? ` (${info.motorista})` : ''}: {info.destinos.map(d => cidadeUfLabel(d)).join(' → ')}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    )}

                    {warning && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                            borderRadius: 6, color: '#fbbf24', fontSize: 12
                        }}>
                            <AlertCircle size={14} /> {warning}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                        {remanejamentoExistente && (
                            <button
                                onClick={desfazer}
                                disabled={desfazendo}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: 'transparent', color: '#f87171',
                                    border: '1px solid rgba(248,113,113,0.4)',
                                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    cursor: desfazendo ? 'wait' : 'pointer'
                                }}
                            >
                                <RotateCcw size={13} /> {desfazendo ? 'Desfazendo…' : 'Desfazer remanejamento'}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onCancelar} disabled={salvando}
                            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Cancelar
                        </button>
                        <button onClick={confirmar} disabled={!podeSalvar || salvando}
                            style={{
                                background: podeSalvar && !salvando ? '#a78bfa' : '#334155',
                                color: '#fff', border: 0, padding: '8px 18px', borderRadius: 8,
                                cursor: !podeSalvar || salvando ? 'not-allowed' : 'pointer',
                                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                            }}>
                            <Save size={15} /> {salvando ? 'Salvando…' : 'Confirmar remanejamento'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
