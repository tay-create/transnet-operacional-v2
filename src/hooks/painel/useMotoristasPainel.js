import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/apiService';
import useAuthStore from '../../store/useAuthStore';

export function useMotoristasPainel({ lista, setLista, socket, mostrarNotificacao, setModalEntregasCard }) {
    const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
    const [editandoMotorista, setEditandoMotorista] = useState(null);
    const [editandoPlaca, setEditandoPlaca] = useState(null);
    const [buscaMotoristaCard, setBuscaMotoristaCard] = useState({ id: null, texto: '' });
    const [toasts, setToasts] = useState([]);
    const [veiculosProvisao, setVeiculosProvisao] = useState([]);
    const qtdMotoristasPrev = useRef(null);

    const adicionarToast = useCallback((msg, tipo = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }, []);

    useEffect(() => {
        const buscarMotoristas = () => {
            if (!useAuthStore.getState().isAuthenticated) return;
            api.get('/api/marcacoes/disponiveis')
                .then(r => {
                    if (!r.data.success) return;
                    const listaM = r.data.motoristas;
                    setMotoristasDisponiveis(listaM);
                    if (qtdMotoristasPrev.current !== null && listaM.length > qtdMotoristasPrev.current) {
                        const novos = listaM.slice(0, listaM.length - qtdMotoristasPrev.current);
                        novos.forEach(m => {
                            adicionarToast(`${m.nome_motorista} — ${m.disponibilidade || 'Disponível'} `);
                        });
                    }
                    qtdMotoristasPrev.current = listaM.length;
                })
                .catch(() => {});
        };
        buscarMotoristas();
        if (socket) {
            socket.on('marcacao_atualizada', buscarMotoristas);
            return () => socket.off('marcacao_atualizada', buscarMotoristas);
        }
    }, [adicionarToast, socket]);

    useEffect(() => {
        api.get('/api/provisionamento/veiculos')
            .then(r => { if (r.data.success) setVeiculosProvisao(r.data.veiculos); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handleFotoLacre = ({ veiculoId, campo, fotos }) => {
            setLista(prev => prev.map(item =>
                item.id === veiculoId ? { ...item, [campo]: JSON.stringify(fotos) } : item
            ));
        };
        const handler = (payload) => { if (payload?.tipo === 'foto_lacre') handleFotoLacre(payload); };
        socket.on('receber_atualizacao', handler);
        return () => socket.off('receber_atualizacao', handler);
    }, [socket, setLista]);

    const itemTemPlacaNoProvisionamento = useCallback((item) => {
        if (!veiculosProvisao.length) return false;
        const placas = [item.placa1Motorista, item.placa2Motorista, item.placa].filter(p => p && p.length >= 6);
        return placas.some(p => {
            const pu = p.replace(/[-\s]/g, '').toUpperCase();
            return veiculosProvisao.some(vp =>
                (vp.placa && vp.placa.replace(/[-\s]/g, '').toUpperCase() === pu) ||
                (vp.carreta && vp.carreta.replace(/[-\s]/g, '').toUpperCase() === pu)
            );
        });
    }, [veiculosProvisao]);

    const checarPlacaProvisaoCard = useCallback((placa, item) => {
        if (!placa || placa.length < 6) return;
        const p = placa.replace(/[-\s]/g, '').toUpperCase();
        const v = veiculosProvisao.find(vp =>
            (vp.placa && vp.placa.replace(/[-\s]/g, '').toUpperCase() === p) ||
            (vp.carreta && vp.carreta.replace(/[-\s]/g, '').toUpperCase() === p)
        );
        if (v) {
            const veiculoComCardAtual = { ...v };
            const carretaCard = (item.placa2Motorista || '').trim();
            if (carretaCard && carretaCard !== '-') veiculoComCardAtual.carreta = carretaCard;
            setModalEntregasCard({ veiculo: veiculoComCardAtual, item });
        }
    }, [veiculosProvisao, setModalEntregasCard]);

    const selecionarMotoristaNaEdicao = useCallback((item, realIndex, m) => {
        if (m.is_frota) {
            setEditandoMotorista(null);
            setBuscaMotoristaCard({ id: null, texto: '' });
            return { abrirFrota: { item, marcacao: m, realIndex } };
        }
        salvarMotoristaNoCard(item, realIndex, m, '', '');
        return null;
    }, []); // eslint-disable-line

    const salvarMotoristaNoCard = useCallback((item, realIndex, m, origemFrota, destinoFrota) => {
        const itemOriginal = { ...lista[realIndex] };
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[realIndex] };
        itemAtual.motorista = m.nome_motorista;
        itemAtual.telefoneMotorista = m.telefone || itemAtual.telefoneMotorista;
        itemAtual.placa1Motorista = m.placa1 || itemAtual.placa1Motorista || itemAtual.placa || '';
        itemAtual.placa2Motorista = m.placa2 || itemAtual.placa2Motorista || '';
        itemAtual.tipoVeiculo = m.tipo_veiculo?.toUpperCase().includes('TRUCK') ? 'TRUCK'
            : m.tipo_veiculo?.toUpperCase().includes('CARRETA') ? 'CARRETA' : itemAtual.tipoVeiculo;
        itemAtual.disponibilidadeMotorista = m.disponibilidade || '';
        itemAtual.isFrotaMotorista = m.is_frota ? true : false;
        itemAtual.origemMotorista = m.origem_cidade_uf || '';
        itemAtual.destinoMotorista = m.destino_desejado || '';
        if (origemFrota) itemAtual.origem_frota = origemFrota;
        if (destinoFrota) itemAtual.destino_frota = destinoFrota;

        if (m.is_frota) {
            if (m.num_liberacao_cad) itemAtual.numero_liberacao = m.num_liberacao_cad;
            if (m.data_liberacao_cad) itemAtual.data_liberacao = m.data_liberacao_cad;
            if (m.seguradora_cad) itemAtual.gerenciadora_risco = m.seguradora_cad;
            if (m.situacao_cad) itemAtual.situacao_cadastro = m.situacao_cad;
            if (m.chk_cnh_cad !== undefined) itemAtual.chk_cnh = m.chk_cnh_cad ? 1 : 0;
            if (m.chk_antt_cad !== undefined) itemAtual.chk_antt = m.chk_antt_cad ? 1 : 0;
            if (m.chk_tacografo_cad !== undefined) itemAtual.chk_tacografo = m.chk_tacografo_cad ? 1 : 0;
            if (m.chk_crlv_cad !== undefined) itemAtual.chk_crlv = m.chk_crlv_cad ? 1 : 0;
        }
        novaLista[realIndex] = itemAtual;
        setLista(novaLista);

        if (m.is_frota && veiculosProvisao.length > 0) {
            const placaOp = (itemAtual.placa || '').replace(/[-\s]/g, '').toUpperCase();
            const vProv = veiculosProvisao.find(vp =>
                (vp.placa || '').replace(/[-\s]/g, '').toUpperCase() === placaOp ||
                (vp.carreta || '').replace(/[-\s]/g, '').toUpperCase() === placaOp
            );
            if (vProv) {
                api.put(`/api/provisionamento/veiculos/${vProv.id}`, { ...vProv, motorista: m.nome_motorista }).catch(() => {});
            }
        }

        if (itemAtual.id) {
            const payload = { ...itemAtual };
            delete payload.imagens;
            delete payload.dados_json;
            api.put(`/veiculos/${itemAtual.id}`, payload).then(() => {
                mostrarNotificacao?.(`🚛 Motorista vinculado: ${itemAtual.motorista}`);
            }).catch((err) => {
                console.error('Erro ao vincular motorista:', err);
                const msg = err.response?.data?.message || 'Erro ao salvar motorista.';
                mostrarNotificacao?.(`⚠️ ${msg}`);
                setLista(prev => { const r = [...prev]; r[realIndex] = itemOriginal; return r; });
            });
        }
        setEditandoMotorista(null);
        setBuscaMotoristaCard({ id: null, texto: '' });
    }, [lista, setLista, mostrarNotificacao, veiculosProvisao]);

    const salvarMotoristaManual = useCallback((item, realIndex, nome) => {
        if (!nome.trim()) { setEditandoMotorista(null); setBuscaMotoristaCard({ id: null, texto: '' }); return; }
        const novaLista = [...lista];
        const itemAtual = { ...novaLista[realIndex], motorista: nome.trim() };
        novaLista[realIndex] = itemAtual;
        setLista(novaLista);
        if (itemAtual.id) {
            const payload = { ...itemAtual };
            delete payload.imagens;
            delete payload.dados_json;
            api.put(`/veiculos/${itemAtual.id}`, payload).then(() => {
                mostrarNotificacao?.(`🚛 Motorista atualizado: ${itemAtual.motorista}`);
            }).catch(() => { mostrarNotificacao?.('⚠️ Erro ao salvar motorista.'); });
        }
        setEditandoMotorista(null);
        setBuscaMotoristaCard({ id: null, texto: '' });
    }, [lista, setLista, mostrarNotificacao]);

    const removerMotoristaDoCard = useCallback((item, realIndex) => {
        if (!item.motorista || !item.motorista.trim()) return;
        const novaLista = [...lista];
        const itemAtual = {
            ...novaLista[realIndex],
            motorista: '', telefoneMotorista: '',
            placa1Motorista: '', placa2Motorista: '',
            isFrotaMotorista: false, disponibilidadeMotorista: '',
            origemMotorista: '', destinoMotorista: '',
            chk_cnh: false, chk_antt: false, chk_tacografo: false, chk_crlv: false,
            situacao_cadastro: 'NÃO CONFERIDO',
            numero_liberacao: '', gerenciadora_risco: '',
            data_liberacao: '', timestamps_status: {},
            data_inicio_patio: null
        };
        novaLista[realIndex] = itemAtual;
        setLista(novaLista);
        api.delete(`/veiculos/${item.id}/motorista`).then(() => {
            mostrarNotificacao?.('Motorista removido — voltou para a fila.');
        }).catch(() => {
            setLista(prev => { const r = [...prev]; r[realIndex] = item; return r; });
            mostrarNotificacao?.('⚠️ Erro ao remover motorista.');
        });
    }, [lista, setLista, mostrarNotificacao]);

    return {
        motoristasDisponiveis,
        editandoMotorista, setEditandoMotorista,
        editandoPlaca, setEditandoPlaca,
        buscaMotoristaCard, setBuscaMotoristaCard,
        toasts,
        adicionarToast,
        itemTemPlacaNoProvisionamento,
        checarPlacaProvisaoCard,
        selecionarMotoristaNaEdicao,
        salvarMotoristaNoCard,
        salvarMotoristaManual,
        removerMotoristaDoCard,
    };
}
