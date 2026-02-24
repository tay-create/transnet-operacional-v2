export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
export const AZUL_PRIMARIO = '#004a99';

export const MODULOS_SISTEMA = [
    { id: 'operacao', label: 'Painel Operacional' },
    { id: 'cte', label: 'Gestão de CT-e' },
    { id: 'cubagem', label: 'Cálculo de Cubagem' },
    { id: 'relatorios', label: 'Relatórios Gerenciais' },
    { id: 'relatorio_op', label: 'Relatório Operacional' },
    { id: 'dashboard_tv', label: 'Dashboard TV' },
    { id: 'fila', label: 'Fila de Espera' },
    { id: 'ver_unidade_recife', label: 'Ver Unidade: RECIFE' },
    { id: 'ver_unidade_moreno', label: 'Ver Unidade: MORENO' },
    { id: 'performance_cte', label: 'Performance CT-e' },
    { id: 'checklist_carreta', label: 'Checklist da Carreta' },
    { id: 'cadastro', label: 'Cadastro / Ger. Risco' }
];

export const MODULOS_EDICAO = [
    { id: 'lancamento', label: 'Lançar Novos Veículos' },
    { id: 'operacao', label: 'Editar Cards da Operação' },
    { id: 'editar_operacao_card', label: '↳ Editar Status/Doca/Motorista' },
    { id: 'coleta_card', label: '↳ Editar Nº Coleta/Rota' },
    { id: 'adiar_dia', label: '↳ Alterar Data Prevista' },

    { id: 'timer_solicitado', label: 'Gestão Tempo - Solicitado' },
    { id: 'timer_liberado', label: 'Gestão Tempo - Liberado' },
    { id: 'gestao_tempo', label: 'Acesso ao Cronômetro Manual' },

    { id: 'cte', label: 'Editar/Emitir CT-e' },
    { id: 'cubagem', label: 'Editar Cubagem' },
    { id: 'fila', label: 'Editar Fila de Espera' }
];

export const OPCOES_OPERACAO = [
    "DELTA(RECIFE)", "DELTA(MORENO)", "PORCELANA", "ELETRIK",
    "PORCELANA/ELETRIK", "DELTA(RECIFE X MORENO)", "DELTA(RECIFE)/ELETRIK",
    "DELTA(RECIFE)/PORCELANA", "DELTA(RECIFE)/PORCELANA/ELETRIK",
    "DELTA(MORENO)/ELETRIK", "DELTA(MORENO)/PORCELANA", "DELTA(MORENO)/PORCELANA/ELETRIK"
];

export const OPCOES_STATUS = ["AGUARDANDO", "EM SEPARAÇÃO", "LIBERADO P/ DOCA", "EM CARREGAMENTO", "CARREGADO", "LIBERADO P/ CT-e"];
export const OPCOES_STATUS_CTE = ["Aguardando Emissão", "Em Emissão", "Emitido"];
export const OPCOES_VEICULO = ["TRUCK", "3/4", "CARRETA"];

export const DOCAS_RECIFE_LISTA = ["SELECIONE", "2 DELTA", "3 DELTA", "4 DELTA", "5 DELTA", "6 DELTA", "7 DELTA", "8 DELTA"];
export const DOCAS_MORENO_LISTA = ["SELECIONE", "ELETRIK", "1 PORCELANA", "2 PORCELANA", "3 PORCELANA", "4 PORCELANA", "5 PORCELANA", "6 PORCELANA", "7 PORCELANA", "8 PORCELANA", "1 DELTA", "2 DELTA", "3 DELTA", "4 DELTA", "5 DELTA", "6 DELTA"];

export const CORES_STATUS = {
    'AGUARDANDO': { border: '#64748b', text: '#94a3b8' },
    'EM SEPARAÇÃO': { border: '#eab308', text: '#facc15' },
    'LIBERADO P/ DOCA': { border: '#3b82f6', text: '#60a5fa' },
    'EM CARREGAMENTO': { border: '#f97316', text: '#fb923c' },
    'CARREGADO': { border: '#22c55e', text: '#4ade80' },
    'LIBERADO P/ CT-e': { border: '#a855f7', text: '#c084fc' },
};

export const CARGOS_DISPONIVEIS = ['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional', 'Conhecimento', 'Cadastro', 'Dashboard Viewer'];