import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, AlertCircle, CheckCircle, Loader, ChevronRight } from 'lucide-react';
import api from '../services/apiService';

function normalizarChave(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function parseDataXLSX(v) {
    if (!v && v !== 0) return null;
    if (v instanceof Date) {
        const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    const s = String(v).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
        const ano = m[3].length === 2 ? '20' + m[3] : m[3];
        return `${ano}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
    return null;
}

function parseInteiro(v) {
    if (v === null || v === undefined) return null;
    const n = parseInt(String(v).replace(/\D/g, ''), 10);
    return isNaN(n) ? null : n;
}

// Converte texto bruto da planilha em código de agendamento padrão (AG / SOL / S_AG)
function normalizarAgendamento(raw) {
    const s = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z]/g, '');
    if (!s) return null;
    if (s === 'AG' || s.startsWith('AG')) return 'AG';
    if (s === 'SOL' || s.startsWith('SOL')) return 'SOL';
    if (s === 'SAG' || s === 'SEMAG' || s.startsWith('S')) return 'S_AG';
    return s;
}

// Procura linha-cabeçalho por palavras-chave e retorna estrutura agrupada (rotas + entregas-filhas)
function parseTramontinaXLSX(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

    // Procura linha-cabeçalho: precisa ter pelo menos uma coluna ROTA (exata) E uma CIDADE ou UF
    const headerRowIdx = raw.findIndex(row => {
        if (!Array.isArray(row)) return false;
        const norm = row.map(c => normalizarChave(c));
        const temRota = norm.includes('rota');
        const temCidadeOuUf = norm.includes('cidade') || norm.includes('uf');
        return temRota && temCidadeOuUf;
    });
    if (headerRowIdx < 0) throw new Error('Cabeçalho não encontrado. A planilha precisa ter colunas "ROTA" e "CIDADE" (ou "UF") na mesma linha.');

    const headers = raw[headerRowIdx].map(h => normalizarChave(h));
    const linhas = raw.slice(headerRowIdx + 1).filter(l => Array.isArray(l) && l.some(c => String(c || '').trim()));

    // idx(...alvos): primeiro tenta match EXATO (string igual), só depois substring.
    // Cada alvo pode ser uma string (exato) ou objeto { eq } / { contains }.
    const idx = (...alvos) => {
        // 1) Match exato pelo array de alvos (em ordem)
        for (const a of alvos) {
            const exato = typeof a === 'string' ? a : a.eq;
            if (exato) {
                const i = headers.findIndex(h => h === exato);
                if (i >= 0) return i;
            }
        }
        // 2) Match por substring (em ordem)
        for (const a of alvos) {
            const sub = typeof a === 'string' ? a : a.contains;
            if (sub) {
                const i = headers.findIndex(h => h.includes(sub));
                if (i >= 0) return i;
            }
        }
        return -1;
    };

    const cols = {
        rota: idx('rota'),
        coleta: idx('coleta'),
        op: idx('op', 'operacao'),
        tipo: idx('veiculo', 'tipoveiculo', 'tipo'),
        motorista: idx('motorista'),
        cavalo: idx('placacavalo', { contains: 'cavalo' }),
        carreta: idx('placacarreta', { contains: 'carreta' }),
        dataPrev: idx('datadeprevisao', { contains: 'previsao' }, { contains: 'previsto' }),
        dataEmb: idx('datadeembarque', { contains: 'embarque' }),
        cidade: idx('cidade'),
        uf: idx('uf'),
        cliente: idx('cliente'),
        nfs: idx('notasfiscais', 'notafiscal', { contains: 'nota' }, 'nfs'),
        agendamento: idx('agenda', 'agendamento', { contains: 'agend' }),
        dataEnt: idx('data', 'dataentrega', { contains: 'entregacliente' }),
        redespacho: idx('redespacho'),
        obs: idx('observacoes', 'observacao', { contains: 'obs' }),
    };
    console.log('[Tramontina] Cabeçalhos detectados:', headers);
    console.log('[Tramontina] Mapeamento de colunas:', cols);

    const get = (linha, i) => i >= 0 ? String(linha[i] ?? '').trim() : '';
    const rotas = [];
    let rotaAtual = null;

    for (const linha of linhas) {
        const numRota = parseInteiro(get(linha, cols.rota));
        const cidadeLinha = get(linha, cols.cidade);
        const ufLinha = get(linha, cols.uf).toUpperCase().slice(0, 2);
        const clienteLinha = get(linha, cols.cliente);

        if (numRota) {
            // Inicia uma rota nova SOMENTE se a linha tem dados úteis
            // (cidade/uf/cliente/operação) — descarta rotas-fantasma
            const opLinha = get(linha, cols.op).toUpperCase();
            const motoristaLinha = get(linha, cols.motorista);
            const dataEmbLinha = get(linha, cols.dataEmb);
            const temDadosUteis = !!(cidadeLinha || ufLinha || clienteLinha || opLinha || motoristaLinha || dataEmbLinha);
            if (!temDadosUteis) {
                rotaAtual = null; // pula para próxima
                continue;
            }
            rotaAtual = {
                numero_rota: numRota,
                coleta: get(linha, cols.coleta) || null,
                operacao_codigo: opLinha || null,
                tipo_veiculo: get(linha, cols.tipo).toUpperCase() || null,
                motorista_nome: motoristaLinha || null,
                placa_cavalo: get(linha, cols.cavalo).toUpperCase() || null,
                placa_carreta: get(linha, cols.carreta).toUpperCase() || null,
                data_prevista: parseDataXLSX(get(linha, cols.dataPrev)),
                data_embarque: parseDataXLSX(dataEmbLinha),
                redespacho: get(linha, cols.redespacho) || null,
                observacao: get(linha, cols.obs) || null,
                entregas: [],
            };
            rotas.push(rotaAtual);
            // A linha-cabeçalho da rota já é a primeira entrega (cidade/cliente/etc)
            if (cidadeLinha || ufLinha || clienteLinha) {
                rotaAtual.entregas.push({
                    cidade: cidadeLinha || null,
                    uf: ufLinha || null,
                    cliente: clienteLinha || null,
                    notas_fiscais: get(linha, cols.nfs) || null,
                    status_agendamento: normalizarAgendamento(get(linha, cols.agendamento)),
                    data_entrega_cliente: parseDataXLSX(get(linha, cols.dataEnt)),
                });
            }
        } else if (rotaAtual && (cidadeLinha || ufLinha || clienteLinha)) {
            // Linha-filha: entrega adicional da rota atual
            rotaAtual.entregas.push({
                cidade: cidadeLinha || null,
                uf: ufLinha || null,
                cliente: clienteLinha || null,
                notas_fiscais: get(linha, cols.nfs) || null,
                status_agendamento: get(linha, cols.agendamento).toUpperCase().replace(/[^A-Z]/g, '_') || null,
                data_entrega_cliente: parseDataXLSX(get(linha, cols.dataEnt)),
            });
        }
    }
    return rotas;
}

export default function ModalImportarTramontina({ mesRef, onFechar, onImportado }) {
    const [arquivo, setArquivo] = useState(null);
    const [parsed, setParsed] = useState(null);
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [importando, setImportando] = useState(false);

    const handleArquivo = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setArquivo(f);
        setErro('');
        setCarregando(true);
        try {
            const buf = await f.arrayBuffer();
            const rotas = parseTramontinaXLSX(buf);
            if (!rotas.length) {
                setErro('Nenhuma rota foi extraída da planilha. Confira se o arquivo tem cabeçalhos válidos.');
                setParsed(null);
            } else {
                setParsed(rotas);
            }
        } catch (err) {
            console.error(err);
            setErro(err.message || 'Erro ao ler a planilha.');
            setParsed(null);
        } finally {
            setCarregando(false);
        }
    };

    const confirmar = async () => {
        if (!parsed?.length) return;
        setImportando(true);
        try {
            const res = await api.post('/api/tramontina/importar', { mes_referencia: mesRef, rotas: parsed });
            if (res.data?.success) {
                alert(`Importação concluída: ${res.data.importadas} rotas e ${res.data.entregas} entregas.`);
                onImportado && onImportado();
                onFechar();
            } else {
                setErro(res.data?.message || 'Erro na importação.');
            }
        } catch (err) {
            console.error(err);
            setErro(err.response?.data?.message || err.message || 'Erro ao importar.');
        } finally {
            setImportando(false);
        }
    };

    const totalEntregas = parsed?.reduce((s, r) => s + (r.entregas?.length || 0), 0) || 0;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
            <div style={{
                background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', width: '100%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Upload size={20} color="#3b82f6" />
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Importar planilha Tramontina</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Mês de referência: {mesRef}</div>
                        </div>
                    </div>
                    <button onClick={onFechar} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    {!parsed && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleArquivo}
                                id="arquivoTramontina"
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="arquivoTramontina" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                color: '#fff', padding: '12px 24px', borderRadius: '10px',
                                cursor: 'pointer', fontSize: '14px', fontWeight: 600
                            }}>
                                <Upload size={16} /> Selecionar arquivo XLSX
                            </label>
                            {arquivo && carregando && (
                                <div style={{ marginTop: '16px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Loader size={14} className="spin" /> Lendo {arquivo.name}...
                                </div>
                            )}
                            <div style={{ marginTop: '20px', fontSize: '11px', color: '#64748b', maxWidth: '500px', margin: '20px auto 0' }}>
                                A planilha deve conter colunas reconhecíveis para: Nº Rota, Coleta, Operação (D/P/DC/PC), Tipo de Veículo, Motorista, Placas, Datas de Previsão e Embarque, e linhas-filhas com Cidade, UF, Cliente, NFs, Agendamento e Data de Entrega ao cliente.
                            </div>
                        </div>
                    )}

                    {erro && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <AlertCircle size={16} color="#ef4444" />
                            <div style={{ color: '#fca5a5', fontSize: '12px' }}>{erro}</div>
                        </div>
                    )}

                    {parsed && (
                        <div>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '10px', color: '#86efac', fontWeight: 700, textTransform: 'uppercase' }}>Rotas detectadas</div>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e', lineHeight: 1, marginTop: '4px' }}>{parsed.length}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '10px', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>Entregas detectadas</div>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6', lineHeight: 1, marginTop: '4px' }}>{totalEntregas}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '10px', color: '#d8b4fe', fontWeight: 700, textTransform: 'uppercase' }}>Mês destino</div>
                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#a855f7', lineHeight: 1, marginTop: '8px' }}>{mesRef}</div>
                                </div>
                            </div>

                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Pré-visualização (primeiras 10 rotas)</div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '11px', color: '#cbd5e1', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ color: '#64748b', textAlign: 'left' }}>
                                            <th style={{ padding: '6px' }}>Nº</th>
                                            <th style={{ padding: '6px' }}>Coleta</th>
                                            <th style={{ padding: '6px' }}>Op</th>
                                            <th style={{ padding: '6px' }}>Motorista</th>
                                            <th style={{ padding: '6px' }}>Cavalo</th>
                                            <th style={{ padding: '6px' }}>Embarque</th>
                                            <th style={{ padding: '6px' }}>Entregas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.slice(0, 10).map((r, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '6px' }}>{r.numero_rota}</td>
                                                <td style={{ padding: '6px' }}>{r.coleta || '—'}</td>
                                                <td style={{ padding: '6px' }}>{r.operacao_codigo || '—'}</td>
                                                <td style={{ padding: '6px' }}>{r.motorista_nome || '—'}</td>
                                                <td style={{ padding: '6px' }}>{r.placa_cavalo || '—'}</td>
                                                <td style={{ padding: '6px' }}>{r.data_embarque || '—'}</td>
                                                <td style={{ padding: '6px', color: '#94a3b8' }}>{r.entregas.length}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ChevronRight size={12} /> Confira os dados antes de confirmar. A importação adiciona ao mês {mesRef} (não substitui dados existentes).
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onFechar} disabled={importando} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: importando ? 'not-allowed' : 'pointer', fontSize: '12px'
                    }}>Cancelar</button>
                    {parsed && (
                        <button onClick={confirmar} disabled={importando} style={{
                            background: importando ? '#64748b' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                            border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '8px',
                            cursor: importando ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            {importando ? <><Loader size={14} className="spin" /> Importando...</> : <><CheckCircle size={14} /> Confirmar e importar</>}
                        </button>
                    )}
                </div>
                <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}
