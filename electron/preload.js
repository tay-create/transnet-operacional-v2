const { contextBridge, ipcRenderer } = require('electron');

// Ponte IPC segura — renderer NUNCA acessa Node.js diretamente
contextBridge.exposeInMainWorld('api', {
    // Autenticação
    login: (email, senha) => ipcRenderer.invoke('login', { email, senha }),

    // Veículos
    getVeiculos: (params) => ipcRenderer.invoke('get-veiculos', params),
    postVeiculo: (dados) => ipcRenderer.invoke('post-veiculo', dados),
    putVeiculo: (id, dados) => ipcRenderer.invoke('put-veiculo', { id, dados }),
    deleteVeiculo: (id) => ipcRenderer.invoke('delete-veiculo', id),

    // Cubagens
    getCubagens: () => ipcRenderer.invoke('get-cubagens'),
    getCubagemPorColeta: (numero) => ipcRenderer.invoke('get-cubagem-coleta', numero),
    postCubagem: (dados) => ipcRenderer.invoke('post-cubagem', dados),
    putCubagem: (id, dados) => ipcRenderer.invoke('put-cubagem', { id, dados }),
    deleteCubagem: (id) => ipcRenderer.invoke('delete-cubagem', id),

    // Fila
    getFila: () => ipcRenderer.invoke('get-fila'),
    postFila: (dados) => ipcRenderer.invoke('post-fila', dados),
    putFila: (id, dados) => ipcRenderer.invoke('put-fila', { id, dados }),
    putFilaReordenar: (ids) => ipcRenderer.invoke('put-fila-reordenar', ids),
    deleteFila: (id) => ipcRenderer.invoke('delete-fila', id),

    // Notificações
    getNotificacoes: () => ipcRenderer.invoke('get-notificacoes'),
    deleteNotificacao: (id) => ipcRenderer.invoke('delete-notificacao', id),

    // Usuários
    getUsuarios: () => ipcRenderer.invoke('get-usuarios'),
    postUsuario: (dados) => ipcRenderer.invoke('post-usuario', dados),
    putUsuario: (id, dados) => ipcRenderer.invoke('put-usuario', { id, dados }),
    putUsuarioAvatar: (id, avatarUrl) => ipcRenderer.invoke('put-usuario-avatar', { id, avatarUrl }),
    deleteUsuario: (id) => ipcRenderer.invoke('delete-usuario', id),

    // Solicitações de cadastro
    getSolicitacoes: () => ipcRenderer.invoke('get-solicitacoes'),
    postSolicitacao: (dados) => ipcRenderer.invoke('post-solicitacao', dados),
    deleteSolicitacao: (id) => ipcRenderer.invoke('delete-solicitacao', id),

    // Relatórios / Histórico
    getRelatorios: () => ipcRenderer.invoke('get-relatorios'),
    postHistoricoCte: (dados) => ipcRenderer.invoke('post-historico-cte', dados),
    putCteStatus: (dados) => ipcRenderer.invoke('put-cte-status', dados),

    // Tokens de marcação de placas
    getTokens: () => ipcRenderer.invoke('get-tokens'),
    postToken: (telefone) => ipcRenderer.invoke('post-token', telefone),
    putToken: (id, status) => ipcRenderer.invoke('put-token', { id, status }),

    // Marcações de placas
    getMarcacoes: () => ipcRenderer.invoke('get-marcacoes'),
    getMarcacoesDisponiveis: () => ipcRenderer.invoke('get-marcacoes-disponiveis'),
    validarToken: (token) => ipcRenderer.invoke('validar-token', token),
    postMarcacao: (dados) => ipcRenderer.invoke('post-marcacao', dados),

    // Configurações / Permissões
    getConfiguracoes: () => ipcRenderer.invoke('get-configuracoes'),
    postConfiguracoes: (dados) => ipcRenderer.invoke('post-configuracoes', dados),

    // Logs de Auditoria
    getLogs: (params) => ipcRenderer.invoke('get-logs', params),
    postLog: (usuario, acao, detalhes) => ipcRenderer.invoke('post-log', { usuario, acao, detalhes }),

    // Docas Interditadas (Containers)
    getDocasInterditadas: () => ipcRenderer.invoke('get-docas-interditadas'),
    postDocasInterditadas: (body) => ipcRenderer.invoke('post-docas-interditadas', body),
    putDocasInterditadas: (id, doca) => ipcRenderer.invoke('put-docas-interditadas', { id, doca }),
    deleteDocasInterditadas: (id) => ipcRenderer.invoke('delete-docas-interditadas', id),

    // Utilitários
    getVersion: () => ipcRenderer.invoke('get-version'),
    platform: process.platform
});
