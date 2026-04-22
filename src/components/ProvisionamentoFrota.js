import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Save, Users, Truck, FileText } from 'lucide-react';
import api from '../services/apiService';

const TIPOS_VEICULO = ['TRUCK', 'CARRETA', 'CONJUNTO', '3/4'];

const STATUS_LIST = [
    'DISPONIVEL',
    'EM_OPERACAO',
    'EM_VIAGEM',
    'EM_VIAGEM_FRETE_RETORNO',
    'AGUARDANDO_FRETE_RETORNO',
    'RETORNANDO',
    'MANUTENCAO',
    'CARREGANDO',
    'CARREGADO',
    'PUXADA',
    'TRANSFERENCIA',
    'PROJETO_SUL',
    'PROJETO_SP',
    'SABADO',
    'DOMINGO',
    'FERIADO',
];

const STATUS_LABEL = {
    DISPONIVEL: 'DISPONÍVEL',
    EM_OPERACAO: 'EM OPERAÇÃO',
    EM_VIAGEM: 'EM VIAGEM',
    EM_VIAGEM_FRETE_RETORNO: 'VIAGEM C/ FRETE RET.',
    AGUARDANDO_FRETE_RETORNO: 'AGUARD. FRETE RET.',
    RETORNANDO: 'RETORNANDO',
    MANUTENCAO: 'MANUTENÇÃO',
    CARREGANDO: 'CARREGANDO',
    CARREGADO: 'CARREGADO',
    PUXADA: 'PUXADA',
    TRANSFERENCIA: 'TRANSFERÊNCIA',
    PROJETO_SUL: 'PROJETO SUL',
    PROJETO_SP: 'PROJETO SP',
    SABADO: 'SÁBADO',
    DOMINGO: 'DOMINGO',
    FERIADO: 'FERIADO',
};

const COR_STATUS = {
    DISPONIVEL:               { bg: 'rgba(34,197,94,0.18)',   text: '#4ade80',  border: 'rgba(34,197,94,0.35)' },
    EM_OPERACAO:              { bg: 'rgba(167,139,250,0.18)', text: '#a78bfa',  border: 'rgba(167,139,250,0.35)' },
    EM_VIAGEM:                { bg: 'rgba(234,179,8,0.18)',   text: '#facc15',  border: 'rgba(234,179,8,0.35)' },
    EM_VIAGEM_FRETE_RETORNO:  { bg: 'rgba(234,179,8,0.18)',   text: '#facc15',  border: 'rgba(234,179,8,0.35)' },
    AGUARDANDO_FRETE_RETORNO: { bg: 'rgba(234,179,8,0.14)',   text: '#fbbf24',  border: 'rgba(234,179,8,0.3)' },
    RETORNANDO:               { bg: 'rgba(234,179,8,0.14)',   text: '#fbbf24',  border: 'rgba(234,179,8,0.3)' },
    MANUTENCAO:               { bg: 'rgba(239,68,68,0.18)',   text: '#f87171',  border: 'rgba(239,68,68,0.35)' },
    CARREGANDO:               { bg: 'rgba(100,116,139,0.18)', text: '#94a3b8',  border: 'rgba(100,116,139,0.3)' },
    CARREGADO:                { bg: 'rgba(255,255,255,0.1)',  text: '#ffffff',  border: 'rgba(255,255,255,0.3)' },
    PUXADA:                   { bg: 'rgba(59,130,246,0.18)',  text: '#60a5fa',  border: 'rgba(59,130,246,0.35)' },
    TRANSFERENCIA:            { bg: 'rgba(14,165,233,0.18)',  text: '#38bdf8',  border: 'rgba(14,165,233,0.35)' },
    PROJETO_SUL:              { bg: 'rgba(22,163,74,0.18)',   text: '#34d399',  border: 'rgba(22,163,74,0.35)' },
    PROJETO_SP:               { bg: 'rgba(22,163,74,0.18)',   text: '#34d399',  border: 'rgba(22,163,74,0.35)' },
    SABADO:                   { bg: 'rgba(71,85,105,0.18)',   text: '#64748b',  border: 'rgba(71,85,105,0.25)' },
    DOMINGO:                  { bg: 'rgba(71,85,105,0.18)',   text: '#64748b',  border: 'rgba(71,85,105,0.25)' },
    FERIADO:                  { bg: 'rgba(71,85,105,0.18)',   text: '#64748b',  border: 'rgba(71,85,105,0.25)' },
};

const STATUS_COM_DESTINO = ['EM_VIAGEM'];

function getHoje() {
    const d = new Date();
    const offset = -3 * 60;
    const local = new Date(d.getTime() + (offset - d.getTimezoneOffset()) * 60000);
    return local.toISOString().substring(0, 10);
}

function nomeDiaSemana(dateStr) {
    const NOMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const [y, m, d] = dateStr.split('-').map(Number);
    return NOMES[new Date(y, m - 1, d).getDay()];
}

function formatarDia(dateStr) {
    const [, , dd] = dateStr.split('-');
    return dd;
}

function formatarSemana(dias) {
    if (!dias || dias.length < 7) return '';
    const [y1, m1, d1] = dias[0].split('-');
    const [y7, m7, d7] = dias[6].split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesInicio = meses[parseInt(m1, 10) - 1];
    const mesFim = meses[parseInt(m7, 10) - 1];
    if (m1 === m7) return `${d1}/${mesInicio} – ${d7}/${mesFim}/${y1}`;
    return `${d1}/${mesInicio} – ${d7}/${mesFim}/${y7}`;
}

const FORM_VAZIO = { placa: '', carreta: '', tipo_veiculo: 'TRUCK', modelo: '', motorista: '', ordem: 0 };

export default function ProvisionamentoFrota({ socket, user }) {
    const podeEditar = ['Coordenador', 'Planejamento', 'Adm Frota'].includes(user?.cargo);

    const [abaAtiva, setAbaAtiva] = useState('prov'); // 'prov' | 'frota'
    const [motoristasFreota, setMotoristasFreota] = useState([]);
    const [loadingFrota, setLoadingFrota] = useState(false);
    const [formFrota, setFormFrota] = useState({ nome_motorista: '', telefone: '' });
    const [salvandoFrota, setSalvandoFrota] = useState(false);
    const [toastFrota, setToastFrota] = useState('');

    function mostrarToastFrota(msg) { setToastFrota(msg); setTimeout(() => setToastFrota(''), 2800); }

    const carregarFrota = useCallback(async () => {
        setLoadingFrota(true);
        try {
            const r = await api.get('/api/cadastro/frota');
            if (r.data.success) setMotoristasFreota(r.data.motoristas || []);
        } catch (e) { console.error('Erro ao carregar frota:', e); }
        finally { setLoadingFrota(false); }
    }, []);

    useEffect(() => {
        if (abaAtiva === 'frota') carregarFrota();
    }, [abaAtiva, carregarFrota]);

    async function cadastrarFrota() {
        const { nome_motorista, telefone } = formFrota;
        if (!nome_motorista.trim() || !telefone.trim()) { mostrarToastFrota('Preencha Nome e Telefone.'); return; }
        setSalvandoFrota(true);
        try {
            const r = await api.post('/api/frota', { nome_motorista, telefone });
            if (r.data.success) {
                setFormFrota({ nome_motorista: '', telefone: '' });
                mostrarToastFrota('Motorista adicionado à fila!');
                carregarFrota();
            } else { mostrarToastFrota(r.data.message || 'Erro ao cadastrar.'); }
        } catch (e) { mostrarToastFrota('Erro de conexão.'); }
        finally { setSalvandoFrota(false); }
    }

    async function removerFrota(id) {
        try {
            await api.delete(`/api/cadastro/frota/${id}`);
            setMotoristasFreota(prev => prev.filter(m => m.id !== id));
            mostrarToastFrota('Motorista removido.');
        } catch (e) { mostrarToastFrota('Erro ao remover.'); }
    }

    const [semanaInicio, setSemanaInicio] = useState(() => getHoje());

    const [veiculos, setVeiculos] = useState([]);
    const [dias, setDias] = useState([]);
    const [programacao, setProgramacao] = useState({});  // { veiculo_id: { data: { status, destino, motorista } } }
    const [carregando, setCarregando] = useState(false);
    const [salvando, setSalvando] = useState({});  // { 'veiculoId_data': true }

    const [modalVeiculo, setModalVeiculo] = useState(null); // null | 'novo' | objeto veículo
    const [formVeiculo, setFormVeiculo] = useState(FORM_VAZIO);
    const [salvandoModal, setSalvandoModal] = useState(false);
    const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');

    // Cache de destinos locais (sem esperar servidor)
    const destinoCache = useRef({});

    // Modal PDF
    const [modalPdf, setModalPdf] = useState(false);
    const [pdfSemana, setPdfSemana] = useState('');
    const [gerandoPdf, setGerandoPdf] = useState(false);

    const carregarSemana = useCallback(async (inicio) => {
        setCarregando(true);
        try {
            const r = await api.get(`/api/provisionamento/semana?inicio=${inicio}`);
            if (r.data.success) {
                setVeiculos(r.data.veiculos);
                setDias(r.data.dias);
                setProgramacao(r.data.programacao);
            }
        } catch (e) {
            console.error('Erro ao carregar semana:', e);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarSemana(semanaInicio);
    }, [semanaInicio, carregarSemana]);

    // Socket: atualização em tempo real de outro usuário
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data?.tipo === 'prov_status_atualizado') {
                setProgramacao(prev => ({
                    ...prev,
                    [data.veiculo_id]: {
                        ...prev[data.veiculo_id],
                        [data.data]: { status: data.status, destino: data.destino, motorista: data.motorista || null }
                    }
                }));
            } else if (data?.tipo === 'prov_veiculo_atualizado') {
                // Veículo do provisionamento foi alterado (ex: carreta do CONJUNTO sincronizada)
                carregarSemana(semanaInicio);
            }
        };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, semanaInicio, carregarSemana]);

    function navegarSemana(direcao) {
        const d = new Date(semanaInicio + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + direcao * 7);
        setSemanaInicio(d.toISOString().substring(0, 10));
    }

    function getStatusCelula(veiculoId, data) {
        const st = programacao[veiculoId]?.[data]?.status;
        if (st) return st;
        // Padrão visual para sábado/domingo sem registro
        const dow = new Date(data + 'T12:00:00Z').getUTCDay();
        if (dow === 6) return 'SABADO';
        if (dow === 0) return 'DOMINGO';
        return 'DISPONIVEL';
    }

    function getDestinoCelula(veiculoId, data) {
        return programacao[veiculoId]?.[data]?.destino || '';
    }

    function getMotoristaCelula(veiculoId, data) {
        return programacao[veiculoId]?.[data]?.motorista || null;
    }

    async function salvarStatus(veiculoId, data, status, destino) {
        const key = `${veiculoId}_${data}`;
        setSalvando(prev => ({ ...prev, [key]: true }));
        // Otimista: atualiza local imediatamente
        setProgramacao(prev => ({
            ...prev,
            [veiculoId]: { ...prev[veiculoId], [data]: { status, destino: destino ?? prev[veiculoId]?.[data]?.destino ?? null } }
        }));
        try {
            await api.put('/api/provisionamento/status', { veiculo_id: veiculoId, data, status, destino: destino ?? null });
        } catch (e) {
            console.error('Erro ao salvar status:', e);
        } finally {
            setSalvando(prev => { const n = { ...prev }; delete n[key]; return n; });
        }

        // Auto-fill: ao marcar EM_VIAGEM, preenche dias intermediários com CARREGADO
        // (desde o dia seguinte ao último EM_OPERACAO até o dia anterior ao EM_VIAGEM)
        if (status === 'EM_VIAGEM') {
            const idxViagem = dias.indexOf(data);
            if (idxViagem > 0) {
                // Procura o EM_OPERACAO mais próximo antes do dia de EM_VIAGEM
                let idxOperacao = -1;
                const preenchaveis = new Set(['DISPONIVEL', 'SABADO', 'DOMINGO', 'CARREGADO']);
                for (let i = idxViagem - 1; i >= 0; i--) {
                    const st = getStatusCelula(veiculoId, dias[i]);
                    if (st === 'EM_OPERACAO') { idxOperacao = i; break; }
                    if (!preenchaveis.has(st)) break;
                }
                if (idxOperacao >= 0 && idxViagem - idxOperacao > 1) {
                    // Dias intermediários: idxOperacao+1 até idxViagem-1
                    for (let i = idxOperacao + 1; i < idxViagem; i++) {
                        const diaInter = dias[i];
                        const stInter = getStatusCelula(veiculoId, diaInter);
                        if (preenchaveis.has(stInter) && stInter !== 'CARREGADO') {
                            await salvarStatus(veiculoId, diaInter, 'CARREGADO', null);
                        }
                    }
                }
            }
        }
    }

    async function salvarDestino(veiculoId, data, destino) {
        const status = getStatusCelula(veiculoId, data);
        const key = `${veiculoId}_${data}`;
        setSalvando(prev => ({ ...prev, [key]: true }));
        setProgramacao(prev => ({
            ...prev,
            [veiculoId]: { ...prev[veiculoId], [data]: { status, destino } }
        }));
        try {
            await api.put('/api/provisionamento/status', { veiculo_id: veiculoId, data, status, destino });
        } catch (e) {
            console.error('Erro ao salvar destino:', e);
        } finally {
            setSalvando(prev => { const n = { ...prev }; delete n[key]; return n; });
        }
    }

    async function excluirVeiculo(id) {
        try {
            await api.delete(`/api/provisionamento/veiculos/${id}`);
            setVeiculos(prev => prev.filter(v => v.id !== id));
        } catch (e) { console.error('Erro ao excluir:', e); }
    }

    function abrirModal(dados, veiculo) {
        setFormVeiculo(dados);
        setBuscaMotorista(dados.motorista || '');
        setModalVeiculo(veiculo);
        api.get('/api/marcacoes/disponiveis')
            .then(r => { if (r.data.success) setMotoristasDisponiveis(r.data.motoristas || []); })
            .catch(() => {});
    }

    function abrirModalNovo() {
        abrirModal(FORM_VAZIO, 'novo');
    }

    function abrirModalEditar(v) {
        abrirModal({ placa: v.placa || '', carreta: v.carreta || '', tipo_veiculo: v.tipo_veiculo || 'TRUCK', modelo: v.modelo || '', motorista: v.motorista || '', ordem: v.ordem || 0 }, v);
    }

    async function salvarModal() {
        if (!formVeiculo.placa || !formVeiculo.tipo_veiculo) return;
        setSalvandoModal(true);
        try {
            if (modalVeiculo === 'novo') {
                const r = await api.post('/api/provisionamento/veiculos', formVeiculo);
                if (r.data.success) {
                    await carregarSemana(semanaInicio);
                }
            } else {
                await api.put(`/api/provisionamento/veiculos/${modalVeiculo.id}`, formVeiculo);
                setVeiculos(prev => prev.map(v => v.id === modalVeiculo.id ? { ...v, ...formVeiculo } : v));
            }
            setModalVeiculo(null);
        } catch (e) { console.error('Erro ao salvar veículo:', e); }
        finally { setSalvandoModal(false); }
    }

    const cor = (st) => COR_STATUS[st] || COR_STATUS.DISPONIVEL;

    async function gerarPdfProvisionamento() {
        if (!pdfSemana) return;
        setGerandoPdf(true);
        try {
            const r = await api.get(`/api/provisionamento/semana?inicio=${pdfSemana}`);
            if (!r.data.success) throw new Error('Falha ao buscar dados');
            const { veiculos: vs, dias: ds, programacao: prog } = r.data;

            const OPERANDO = new Set(['EM_VIAGEM','EM_OPERACAO','CARREGANDO','CARREGADO','RETORNANDO','EM_VIAGEM_FRETE_RETORNO','TRANSFERENCIA','PUXADA','PROJETO_SUL','PROJETO_SP']);
            const OCIOSO   = new Set(['DISPONIVEL','AGUARDANDO_FRETE_RETORNO']);
            const MANUT    = new Set(['MANUTENCAO']);
            let nOp=0, nOc=0, nMt=0;
            vs.forEach(v => {
                const st = prog[v.id]?.[ds[0]]?.status || 'DISPONIVEL';
                if (OPERANDO.has(st)) nOp++;
                else if (MANUT.has(st)) nMt++;
                else nOc++;
            });

            const DIAS_SEMANA_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            const fmtDia = d => { const dt = new Date(d+'T12:00:00'); return `${DIAS_SEMANA_PT[dt.getUTCDay()]} ${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`; };
            const fmtDataLonga = d => { const dt = new Date(d+'T12:00:00'); return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`; };

            const COR_CAT = {
                operando:   { bg:'#d1fae5', text:'#065f46', border:'#6ee7b7' },
                ocioso:     { bg:'#fef3c7', text:'#92400e', border:'#fcd34d' },
                manutencao: { bg:'#fee2e2', text:'#991b1b', border:'#fca5a5' },
                excluido:   { bg:'#f1f5f9', text:'#475569', border:'#cbd5e1' },
            };
            const catDe = st => OPERANDO.has(st)?'operando':MANUT.has(st)?'manutencao':OCIOSO.has(st)?'ocioso':'excluido';

            const labelSt = st => STATUS_LABEL[st] || st;

            const celulaHtml = (v, dia) => {
                const st = prog[v.id]?.[dia]?.status || (() => { const d=new Date(dia+'T12:00:00').getUTCDay(); return d===6?'SABADO':d===0?'DOMINGO':'DISPONIVEL'; })();
                const destino = prog[v.id]?.[dia]?.destino || '';
                const mot = prog[v.id]?.[dia]?.motorista || '';
                const motDiferente = mot && mot !== v.motorista;
                const cat = catDe(st);
                const c = COR_CAT[cat];
                return `<td style="padding:5px 6px;vertical-align:top;border:1px solid #e2e8f0;">
                    <div style="display:inline-block;padding:3px 7px;border-radius:5px;font-size:9px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border};white-space:nowrap;">${labelSt(st)}</div>
                    ${destino ? `<div style="font-size:8px;color:#475569;margin-top:2px;font-style:italic;">${destino}</div>` : ''}
                    ${motDiferente ? `<div style="font-size:8px;color:#94a3b8;margin-top:1px;">${mot.split(' ')[0]}</div>` : ''}
                </td>`;
            };

            const linhas = vs.map(v => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:5px 8px;font-weight:700;font-size:10px;letter-spacing:.05em;white-space:nowrap;border:1px solid #e2e8f0;">${v.placa}</td>
                    <td style="padding:5px 8px;font-size:9px;color:#64748b;white-space:nowrap;border:1px solid #e2e8f0;">${v.carreta||'—'}</td>
                    <td style="padding:5px 8px;font-size:9px;font-weight:700;color:#475569;border:1px solid #e2e8f0;">${v.tipo_veiculo}</td>
                    <td style="padding:5px 8px;font-size:9px;color:#374151;border:1px solid #e2e8f0;">${v.motorista||'—'}</td>
                    ${ds.map(d => celulaHtml(v,d)).join('')}
                </tr>`).join('');

            const cabDias = ds.map(d => `<th style="padding:6px 4px;text-align:center;font-size:9px;font-weight:700;color:#1e293b;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;">${fmtDia(d)}</th>`).join('');

            const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const periodoStr = ds.length ? `${fmtDataLonga(ds[0])} a ${fmtDataLonga(ds[ds.length-1])}` : '';

            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Provisionamento de Frota — ${periodoStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 0; }
  @media print {
    @page { size: A4 landscape; margin: 8mm 6mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 18px; font-weight: 800; letter-spacing: .5px; color: #7dd3fc; }
  .header-sub { font-size: 11px; color: #94a3b8; margin-top: 3px; }
  .header-right { text-align: right; font-size: 10px; color: #94a3b8; }
  .kpi-bar { display: flex; gap: 12px; padding: 12px 20px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
  .kpi-card { flex: 1; border-radius: 8px; padding: 10px 14px; border-left: 4px solid; }
  .kpi-val { font-size: 22px; font-weight: 800; line-height: 1; }
  .kpi-lbl { font-size: 10px; font-weight: 600; margin-top: 3px; text-transform: uppercase; letter-spacing: .5px; }
  .kpi-total { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
  .kpi-op    { background: #f0fdf4; border-color: #22c55e; color: #15803d; }
  .kpi-oc    { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
  .kpi-mt    { background: #fff1f2; border-color: #ef4444; color: #991b1b; }
  .table-wrap { padding: 12px 20px 6px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th:nth-child(-n+4) { background: #1e293b; color: #f1f5f9; }
  thead th { padding: 7px 6px; text-align: left; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; border: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #f0f9ff; }
  .legenda { padding: 10px 20px 14px; display: flex; gap: 18px; flex-wrap: wrap; border-top: 1px solid #e2e8f0; margin-top: 6px; }
  .leg-item { display: flex; align-items: center; gap: 5px; font-size: 9px; color: #475569; }
  .leg-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
  .footer { padding: 8px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
</style></head><body>
<div class="header">
  <div>
    <div class="header-title">TRANSNET — PROVISIONAMENTO DE FROTA</div>
    <div class="header-sub">Semana: ${periodoStr}</div>
  </div>
  <div class="header-right">
    <div style="font-size:11px;color:#7dd3fc;font-weight:700;">Relatório Gerencial</div>
    <div>Gerado em: ${geradoEm}</div>
  </div>
</div>

<div class="kpi-bar">
  <div class="kpi-card kpi-total"><div class="kpi-val">${vs.length}</div><div class="kpi-lbl">Total Veículos</div></div>
  <div class="kpi-card kpi-op"><div class="kpi-val">${nOp}</div><div class="kpi-lbl">Operando</div></div>
  <div class="kpi-card kpi-oc"><div class="kpi-val">${nOc}</div><div class="kpi-lbl">Ociosos</div></div>
  <div class="kpi-card kpi-mt"><div class="kpi-val">${nMt}</div><div class="kpi-lbl">Manutenção</div></div>
</div>

<div class="table-wrap">
<table>
  <thead><tr>
    <th style="min-width:70px;">Veículo</th>
    <th style="min-width:65px;">Carreta</th>
    <th style="min-width:55px;">Tipo</th>
    <th style="min-width:100px;">Motorista</th>
    ${cabDias}
  </tr></thead>
  <tbody>${linhas}</tbody>
</table>
</div>

<div class="legenda">
  <strong style="font-size:9px;color:#475569;align-self:center;">LEGENDA:</strong>
  <div class="leg-item"><div class="leg-dot" style="background:#d1fae5;border:1px solid #6ee7b7;"></div>Operando (EM VIAGEM, EM OPERAÇÃO, CARREGANDO, CARREGADO, RETORNANDO, TRANSFERÊNCIA, PUXADA)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fef3c7;border:1px solid #fcd34d;"></div>Ocioso (DISPONÍVEL, AGUARD. FRETE RET.)</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fee2e2;border:1px solid #fca5a5;"></div>Manutenção</div>
  <div class="leg-item"><div class="leg-dot" style="background:#f1f5f9;border:1px solid #cbd5e1;"></div>Fora de Op. (SÁBADO, DOMINGO, FERIADO)</div>
</div>

<div class="footer">
  <span>Transnet Logística — Sistema de Provisionamento de Frota</span>
  <span>Gerado em: ${geradoEm}</span>
</div>
</body></html>`;

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;';
            document.body.appendChild(iframe);
            iframe.contentDocument.open();
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1500);
            }, 800);
            setModalPdf(false);
        } catch (e) {
            console.error('Erro ao gerar PDF provisionamento:', e);
            alert('Erro ao gerar PDF. Tente novamente.');
        } finally {
            setGerandoPdf(false);
        }
    }

    return (
        <div style={{ padding: '16px 20px', height: 'calc(100vh - 124px)', overflowY: 'auto', overflowX: 'auto' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
                <button onClick={() => setAbaAtiva('prov')} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                    borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                    background: abaAtiva === 'prov' ? 'rgba(125,211,252,0.15)' : 'transparent',
                    color: abaAtiva === 'prov' ? '#7dd3fc' : '#64748b'
                }}>
                    <Truck size={14} /> Provisionamento
                </button>
                <button onClick={() => setAbaAtiva('frota')} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                    borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                    background: abaAtiva === 'frota' ? 'rgba(125,211,252,0.15)' : 'transparent',
                    color: abaAtiva === 'frota' ? '#7dd3fc' : '#64748b'
                }}>
                    <Users size={14} /> Cadastro da Frota
                </button>
            </div>

            {/* Header (só na aba Provisionamento) */}
            {abaAtiva === 'prov' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '0.05em' }}>
                    PROVISIONAMENTO DE FROTA
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => navegarSemana(-1)} style={s.btnNav}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600', minWidth: '150px', textAlign: 'center' }}>
                        {formatarSemana(dias)}
                    </span>
                    <button onClick={() => navegarSemana(1)} style={s.btnNav}><ChevronRight size={16} /></button>
                    <button onClick={() => { setPdfSemana(semanaInicio); setModalPdf(true); }} style={{ ...s.btnPrimary, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                        <FileText size={14} /> Relatório PDF
                    </button>
                    {podeEditar && (
                        <button onClick={abrirModalNovo} style={s.btnPrimary}>
                            <Plus size={14} /> Veículo
                        </button>
                    )}
                </div>
            </div>}

            {/* ABA: CADASTRO DA FROTA */}
            {abaAtiva === 'frota' && (
                <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '0.05em' }}>CADASTRO DA FROTA</h2>
                    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Users size={15} color="#7dd3fc" />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>Adicionar Motorista da Frota</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                            Adiciona o motorista diretamente na fila de disponíveis, sem link. As placas serão vinculadas no despacho.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={s.label}>Nome *</label>
                                <input style={s.input} value={formFrota.nome_motorista}
                                    onChange={e => setFormFrota(f => ({ ...f, nome_motorista: e.target.value }))}
                                    placeholder="Nome completo" />
                            </div>
                            <div>
                                <label style={s.label}>Telefone (com DDD) *</label>
                                <input style={s.input} value={formFrota.telefone}
                                    onChange={e => setFormFrota(f => ({ ...f, telefone: e.target.value }))}
                                    placeholder="(81) 99999-9999" type="tel" />
                            </div>
                        </div>
                        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button style={s.btnPrimary} onClick={cadastrarFrota} disabled={salvandoFrota}>
                                <Plus size={13} /> {salvandoFrota ? 'Salvando...' : 'Adicionar à Fila'}
                            </button>
                        </div>
                    </div>
                    {loadingFrota ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Carregando...</div>
                    ) : (
                        <table style={{ ...s.table, minWidth: '400px' }}>
                            <thead>
                                <tr>
                                    <th style={s.th}>MOTORISTA</th>
                                    <th style={s.th}>TELEFONE</th>
                                    {podeEditar && <th style={{ ...s.th, width: '60px' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {motoristasFreota.length === 0 && (
                                    <tr><td colSpan={podeEditar ? 3 : 2} style={{ ...s.td, textAlign: 'center', color: '#64748b', padding: '30px' }}>Nenhum motorista de frota cadastrado.</td></tr>
                                )}
                                {motoristasFreota.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={s.td}>
                                            <span style={{ fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', fontSize: '12px' }}>{m.nome_motorista}</span>
                                        </td>
                                        <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>{m.telefone}</td>
                                        {podeEditar && (
                                            <td style={s.td}>
                                                <button onClick={() => removerFrota(m.id)} style={{ ...s.btnIcon, color: '#f87171' }} title="Remover">
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {toastFrota && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', color: '#4ade80', fontWeight: '600', fontSize: '14px', zIndex: 9999 }}>{toastFrota}</div>}
                </div>
            )}

            {abaAtiva === 'prov' && carregando && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Carregando...</div>
            )}

            {abaAtiva === 'prov' && !carregando && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={s.table}>
                        <thead>
                            <tr>
                                <th style={{ ...s.th, minWidth: '90px' }}>VEÍCULO</th>
                                <th style={{ ...s.th, minWidth: '90px' }}>CARRETA</th>
                                <th style={{ ...s.th, minWidth: '75px' }}>TIPO</th>
                                <th style={{ ...s.th, minWidth: '120px' }}>MOTORISTA</th>
                                {dias.map((dia, i) => (
                                    <th key={dia} style={{ ...s.th, minWidth: '130px', color: i >= 5 ? '#64748b' : '#f1f5f9' }}>
                                        <div style={{ fontWeight: '700' }}>{nomeDiaSemana(dia)}</div>
                                        <div style={{ fontSize: '11px', fontWeight: '400', color: '#64748b' }}>{formatarDia(dia)}</div>
                                    </th>
                                ))}
                                {podeEditar && <th style={{ ...s.th, width: '60px' }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {veiculos.map(v => (
                                <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={s.td}><span style={s.placa}>{v.placa}</span></td>
                                    <td style={s.td}><span style={{ color: '#64748b', fontSize: '12px' }}>{v.carreta || '—'}</span></td>
                                    <td style={s.td}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {v.tipo_veiculo}
                                        </span>
                                    </td>
                                    <td style={s.td}><span style={{ fontSize: '12px', color: '#cbd5e1' }}>{v.motorista || '—'}</span></td>
                                    {dias.map(dia => {
                                        const st = getStatusCelula(v.id, dia);
                                        const destino = getDestinoCelula(v.id, dia);
                                        const motoristaCelula = getMotoristaCelula(v.id, dia);
                                        const key = `${v.id}_${dia}`;
                                        const isSaving = !!salvando[key];
                                        const c = cor(st);
                                        const temDestino = STATUS_COM_DESTINO.includes(st);
                                        return (
                                            <td key={dia} style={{ ...s.td, padding: '4px 6px' }}>
                                                <div style={{ opacity: isSaving ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                                                    <select
                                                        value={st}
                                                        disabled={!podeEditar}
                                                        onChange={e => salvarStatus(v.id, dia, e.target.value, null)}
                                                        style={{
                                                            width: '100%', fontSize: '11px', fontWeight: '700',
                                                            background: c.bg, color: c.text,
                                                            border: `1px solid ${c.border}`,
                                                            borderRadius: '6px', padding: '4px 6px',
                                                            cursor: podeEditar ? 'pointer' : 'default',
                                                            outline: 'none',
                                                        }}
                                                    >
                                                        {STATUS_LIST.map(s2 => (
                                                            <option key={s2} value={s2} style={{ background: '#1e293b', color: 'white' }}>
                                                                {STATUS_LABEL[s2]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {temDestino && podeEditar && (
                                                        <input
                                                            type="text"
                                                            placeholder="Destino..."
                                                            defaultValue={destino}
                                                            onBlur={e => {
                                                                const novo = e.target.value.trim();
                                                                if (novo !== destino) salvarDestino(v.id, dia, novo);
                                                            }}
                                                            style={{
                                                                marginTop: '3px', width: '100%', fontSize: '10px',
                                                                background: 'rgba(255,255,255,0.06)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                borderRadius: '4px', padding: '3px 5px',
                                                                color: '#cbd5e1', outline: 'none',
                                                            }}
                                                        />
                                                    )}
                                                    {temDestino && !podeEditar && destino && (
                                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', paddingLeft: '2px' }}>{destino}</div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    {podeEditar && (
                                        <td style={{ ...s.td, padding: '4px' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button onClick={() => abrirModalEditar(v)} style={s.btnIcon} title="Editar"><Pencil size={12} /></button>
                                                <button onClick={() => excluirVeiculo(v.id)} style={{ ...s.btnIcon, color: '#f87171' }} title="Remover"><Trash2 size={12} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {veiculos.length === 0 && (
                                <tr>
                                    <td colSpan={4 + dias.length + (podeEditar ? 1 : 0)} style={{ ...s.td, textAlign: 'center', color: '#64748b', padding: '40px' }}>
                                        Nenhum veículo cadastrado. {podeEditar && 'Clique em "+ Veículo" para adicionar.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>

                    </table>
                </div>
            )}

            {/* Modal PDF */}
            {modalPdf && (
                <div style={s.overlay} onClick={() => setModalPdf(false)}>
                    <div style={{ ...s.modal, maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={16} color="#f87171" />
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>Relatório PDF</h3>
                            </div>
                            <button onClick={() => setModalPdf(false)} style={s.btnIconSm}><X size={16} /></button>
                        </div>
                        <div style={{ marginBottom: '18px' }}>
                            <label style={s.label}>Início da semana</label>
                            <input
                                type="date"
                                value={pdfSemana}
                                onChange={e => setPdfSemana(e.target.value)}
                                style={{ ...s.input, colorScheme: 'dark' }}
                            />
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                                O relatório mostrará 7 dias a partir desta data.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalPdf(false)} style={s.btnSecondary}>Cancelar</button>
                            <button
                                onClick={gerarPdfProvisionamento}
                                disabled={gerandoPdf || !pdfSemana}
                                style={{ ...s.btnPrimary, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', opacity: !pdfSemana ? 0.5 : 1 }}
                            >
                                <FileText size={14} /> {gerandoPdf ? 'Gerando...' : 'Gerar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cadastro/Edição de Veículo */}
            {modalVeiculo !== null && (
                <div style={s.overlay} onClick={() => setModalVeiculo(null)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
                                {modalVeiculo === 'novo' ? 'Novo Veículo' : 'Editar Veículo'}
                            </h3>
                            <button onClick={() => setModalVeiculo(null)} style={s.btnIconSm}><X size={16} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={s.label}>Placa *</label>
                                    <input style={s.input} value={formVeiculo.placa} onChange={e => setFormVeiculo(f => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="Ex: FCW8G26" />
                                </div>
                                <div>
                                    <label style={s.label}>Carreta</label>
                                    <input style={s.input} value={formVeiculo.carreta} onChange={e => setFormVeiculo(f => ({ ...f, carreta: e.target.value.toUpperCase() }))} placeholder="Ex: RBD2A91" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={s.label}>Tipo de Veículo *</label>
                                    <select style={s.input} value={formVeiculo.tipo_veiculo} onChange={e => setFormVeiculo(f => ({ ...f, tipo_veiculo: e.target.value }))}>
                                        {TIPOS_VEICULO.map(t => <option key={t} style={{ background: '#1e293b' }}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={s.label}>Modelo</label>
                                    <input style={s.input} value={formVeiculo.modelo} onChange={e => setFormVeiculo(f => ({ ...f, modelo: e.target.value }))} placeholder="Ex: SCANIA R450" />
                                </div>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <label style={s.label}>Motorista</label>
                                <input
                                    style={s.input}
                                    value={buscaMotorista}
                                    onChange={e => {
                                        const v = e.target.value.toUpperCase();
                                        setBuscaMotorista(v);
                                        setFormVeiculo(f => ({ ...f, motorista: v }));
                                    }}
                                    onBlur={() => setTimeout(() => setBuscaMotorista(formVeiculo.motorista), 150)}
                                    placeholder="Nome do motorista (opcional)"
                                    autoComplete="off"
                                />
                                {buscaMotorista.length > 0 && motoristasDisponiveis.filter(m =>
                                    m.is_frota && (
                                        m.nome_motorista.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
                                        (m.placa1 || '').toLowerCase().includes(buscaMotorista.toLowerCase())
                                    )
                                ).length > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                                        background: '#0f172a', border: '1px solid rgba(125,211,252,0.3)',
                                        borderRadius: '8px', maxHeight: '200px', overflowY: 'auto',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)', marginTop: '4px',
                                    }}>
                                        {motoristasDisponiveis.filter(m =>
                                            m.is_frota && (
                                                m.nome_motorista.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
                                                (m.placa1 || '').toLowerCase().includes(buscaMotorista.toLowerCase())
                                            )
                                        ).map(m => (
                                            <div
                                                key={m.id}
                                                onMouseDown={() => {
                                                    setFormVeiculo(f => ({ ...f, motorista: m.nome_motorista }));
                                                    setBuscaMotorista(m.nome_motorista);
                                                }}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(125,211,252,0.12)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <strong style={{ textTransform: 'uppercase' }}>{m.nome_motorista}</strong>
                                                {m.placa1 ? <span style={{ color: '#94a3b8' }}> — {m.placa1}</span> : ''}
                                                {m.disponibilidade ? <span style={{ color: '#64748b' }}> [{m.disponibilidade}]</span> : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalVeiculo(null)} style={s.btnSecondary}>Cancelar</button>
                            <button onClick={salvarModal} disabled={salvandoModal || !formVeiculo.placa} style={{ ...s.btnPrimary, opacity: !formVeiculo.placa ? 0.5 : 1 }}>
                                <Save size={14} /> {salvandoModal ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const s = {
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' },
    th: { padding: '8px 10px', background: 'rgba(0,0,0,0.3)', color: '#f1f5f9', fontWeight: '700', fontSize: '11px', textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' },
    td: { padding: '6px 8px', verticalAlign: 'top' },
    placa: { fontWeight: '700', color: '#e2e8f0', fontSize: '12px', letterSpacing: '0.05em' },
    btnNav: { background: 'rgba(125,211,252,0.06)', border: '1px solid rgba(125,211,252,0.15)', borderRadius: '6px', color: '#7dd3fc', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' },
    btnPrimary: { background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.3)', borderRadius: '8px', color: '#7dd3fc', cursor: 'pointer', padding: '7px 14px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' },
    btnSecondary: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', padding: '7px 14px', fontSize: '12px', fontWeight: '600' },
    btnIcon: { background: 'rgba(125,211,252,0.05)', border: '1px solid rgba(125,211,252,0.12)', borderRadius: '5px', color: '#7dd3fc', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' },
    btnIconSm: { background: 'transparent', border: 'none', color: '#7dd3fc', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    label: { display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' },
};
