import axios from 'axios';
import { API_URL } from '../constants';
import useAuthStore from '../store/useAuthStore';

// Detecta se está rodando dentro do Electron (desktop)
const isElectron = typeof window !== 'undefined' && typeof window.api !== 'undefined';

// ─── Modo Browser: Axios com interceptadores JWT ──────────────────────────────

const axiosApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
});

axiosApi.interceptors.request.use(
    (config) => {
        const authStorage = localStorage.getItem('auth-storage');
        let token = null;
        if (authStorage) {
            try {
                const parsed = JSON.parse(authStorage);
                token = parsed.state?.token || null;
            } catch (e) {
                // parse inválido
            }
        }
        // Fallback to legacy auth_token key
        if (!token) {
            const legacyToken = localStorage.getItem('auth_token');
            if (legacyToken) token = legacyToken;
        }
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

axiosApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Sincronizar logout com Zustand para refletir na interface e desmontar componentes
            useAuthStore.getState().logout();

            if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        console.error('Erro na requisição:', {
            url: error.config?.url,
            status: error.response?.status,
            message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
    }
);

// ─── Modo Electron: adaptador que converte chamadas Axios-like para IPC ───────
//
// Mesmo contrato do axiosApi:
//   const res = await api.get('/fila')  →  res.data = { success, fila, ... }
//   const res = await api.post('/login', body)  →  res.data = { success, user, ... }

function makeIpcAdapter() {
    const invoke = async (method, url, body) => {
        const [path, qs] = url.split('?');
        const params = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};

        let data;

        // ── Login ──────────────────────────────────────────────────────────────
        if (method === 'post' && path === '/login') {
            let emailLogin = (body.email || body.nome || '').trim().toLowerCase();
            if (!emailLogin.includes('@')) emailLogin = `${emailLogin}@tnetlog.com.br`;
            data = await window.api.login(emailLogin, body.senha);
        }

        // ── Veículos ───────────────────────────────────────────────────────────
        else if (method === 'get' && path === '/veiculos') {
            data = await window.api.getVeiculos(params);
        }
        else if (method === 'post' && path === '/veiculos') {
            data = await window.api.postVeiculo(body);
        }
        else if (method === 'put' && path.startsWith('/veiculos/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.putVeiculo(id, body);
        }
        else if (method === 'delete' && path.startsWith('/veiculos/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteVeiculo(id);
        }

        // ── Fila ───────────────────────────────────────────────────────────────
        else if (method === 'get' && path === '/fila') {
            data = await window.api.getFila();
        }
        else if (method === 'post' && path === '/fila') {
            data = await window.api.postFila(body);
        }
        else if (method === 'put' && path === '/fila/reordenar') {
            data = await window.api.putFilaReordenar(body.ordem);
        }
        else if (method === 'put' && path.startsWith('/fila/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.putFila(id, body);
        }
        else if (method === 'delete' && path.startsWith('/fila/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteFila(id);
        }

        // ── Notificações ───────────────────────────────────────────────────────
        else if (method === 'get' && path === '/notificacoes') {
            data = await window.api.getNotificacoes();
        }
        else if (method === 'delete' && path.startsWith('/notificacoes/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteNotificacao(id);
        }

        // ── Cubagens ───────────────────────────────────────────────────────────
        else if (method === 'get' && path.startsWith('/cubagens/coleta/')) {
            const numero = path.split('/')[3];
            data = await window.api.getCubagemPorColeta(numero);
        }
        else if (method === 'get' && path === '/cubagens') {
            data = await window.api.getCubagens();
        }
        else if (method === 'post' && path === '/cubagens') {
            data = await window.api.postCubagem(body);
        }
        else if (method === 'put' && path.startsWith('/cubagens/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.putCubagem(id, body);
        }
        else if (method === 'delete' && path.startsWith('/cubagens/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteCubagem(id);
        }

        // ── Usuários ───────────────────────────────────────────────────────────
        else if (method === 'get' && path === '/usuarios') {
            data = await window.api.getUsuarios();
        }
        else if (method === 'post' && path === '/usuarios') {
            data = await window.api.postUsuario(body);
        }
        else if (method === 'put' && path.includes('/usuarios/') && path.includes('/avatar')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.putUsuarioAvatar(id, body.avatarUrl);
        }
        else if (method === 'put' && path.startsWith('/usuarios/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.putUsuario(id, body);
        }
        else if (method === 'delete' && path.startsWith('/usuarios/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteUsuario(id);
        }

        // ── Solicitações de cadastro ───────────────────────────────────────────
        else if (method === 'get' && path === '/solicitacoes') {
            data = await window.api.getSolicitacoes();
        }
        else if (method === 'post' && path === '/solicitacoes') {
            data = await window.api.postSolicitacao(body);
        }
        else if (method === 'delete' && path.startsWith('/solicitacoes/')) {
            const id = Number(path.split('/')[2]);
            data = await window.api.deleteSolicitacao(id);
        }

        // ── Checklists ─────────────────────────────────────────────────────────
        else if (method === 'get' && path === '/api/checklists') {
            data = await window.api.getChecklists();
        }
        else if (method === 'post' && path === '/api/checklists') {
            data = await window.api.postChecklist(body);
        }
        else if (method === 'put' && path.startsWith('/api/checklists/') && path.endsWith('/status')) {
            const id = Number(path.split('/')[3]);
            data = await window.api.putChecklistStatus(id, body.status);
        }

        // ── Relatórios / Histórico CT-e ────────────────────────────────────────
        else if (method === 'get' && path === '/relatorios') {
            data = await window.api.getRelatorios();
        }
        else if (method === 'get' && path === '/relatorios_cte') {
            // Módulo em desenvolvimento — retorna vazio para não quebrar
            data = { success: true, historico: [] };
        }
        else if (method === 'post' && path === '/historico_cte') {
            data = await window.api.postHistoricoCte(body);
        }
        else if (method === 'put' && path === '/cte/status') {
            data = await window.api.putCteStatus(body);
        }

        // ── Configurações / Permissões ─────────────────────────────────────────
        else if (method === 'get' && path === '/configuracoes') {
            data = await window.api.getConfiguracoes();
        }
        else if (method === 'post' && path === '/configuracoes') {
            data = await window.api.postConfiguracoes(body);
        }

        // ── Tokens de marcação de placas ───────────────────────────────────────
        else if (method === 'get' && path === '/api/tokens') {
            data = await window.api.getTokens();
        }
        else if (method === 'post' && path === '/api/tokens') {
            data = await window.api.postToken(body.telefone);
        }
        else if (method === 'put' && path.startsWith('/api/tokens/')) {
            const id = Number(path.split('/')[3]);
            data = await window.api.putToken(id, body.status);
        }

        // ── Marcações de placas ────────────────────────────────────────────────
        else if (method === 'get' && path === '/api/marcacoes/disponiveis') {
            data = await window.api.getMarcacoesDisponiveis();
        }
        else if (method === 'get' && path.startsWith('/api/marcacoes/validar/')) {
            const token = path.split('/')[4];
            data = await window.api.validarToken(token);
        }
        else if (method === 'get' && path === '/api/marcacoes') {
            data = await window.api.getMarcacoes();
        }
        else if (method === 'post' && path === '/api/marcacoes') {
            data = await window.api.postMarcacao(body);
        }

        // ── Container Doca Interditada (Fulgaz) ────────────────────────────────
        else if (method === 'get' && path === '/api/docas-interditadas') {
            data = await window.api.getDocasInterditadas();
        }
        else if (method === 'post' && path === '/api/docas-interditadas') {
            data = await window.api.postDocasInterditadas(body);
        }
        else if (method === 'put' && path.startsWith('/api/docas-interditadas/')) {
            const id = Number(path.split('/')[3]);
            data = await window.api.putDocasInterditadas(id, body.doca);
        }
        else if (method === 'delete' && path.startsWith('/api/docas-interditadas/')) {
            const id = Number(path.split('/')[3]);
            data = await window.api.deleteDocasInterditadas(id);
        }

        // ── Ocorrências operacionais ───────────────────────────────────────────
        else if (method === 'get' && path === '/api/ocorrencias') {
            data = await window.api.getOcorrencias();
        }
        else if (method === 'get' && path.match(/^\/api\/veiculos\/\d+\/ocorrencias$/)) {
            const id = Number(path.split('/')[3]);
            data = await window.api.getOcorrenciasPorVeiculo(id);
        }
        else if (method === 'post' && path.match(/^\/api\/veiculos\/\d+\/ocorrencias$/)) {
            const id = Number(path.split('/')[3]);
            data = await window.api.postOcorrencia(id, body);
        }
        else if (method === 'delete' && path.match(/^\/api\/ocorrencias\/\d+$/)) {
            const id = Number(path.split('/')[3]);
            data = await window.api.deleteOcorrencia(id);
        }

        // ── Logs de Auditoria ──────────────────────────────────────────────────
        else if (method === 'get' && path === '/logs') {
            data = await window.api.getLogs(params);
        }
        else if (method === 'post' && path === '/logs') {
            data = await window.api.postLog(body.usuario, body.acao, body.detalhes);
        }

        // ── Histórico de Liberações ────────────────────────────────────────────
        else if (method === 'get' && path === '/api/historico-liberacoes') {
            data = await window.api.getHistoricoLiberacoes(params);
        }

        // ── Fallback ───────────────────────────────────────────────────────────
        else {
            throw new Error(`[IPC] Rota não mapeada: ${method.toUpperCase()} ${url}`);
        }

        return { data, status: data?.success !== false ? 200 : 400 };
    };

    return {
        get: (url, config) => {
            // Serializar params de config como query string na URL
            if (config?.params) {
                const qs = new URLSearchParams(Object.entries(config.params).filter(([, v]) => v !== undefined && v !== null)).toString();
                if (qs) url = `${url}?${qs}`;
            }
            return invoke('get', url, null);
        },
        post: (url, body) => invoke('post', url, body),
        put: (url, body) => invoke('put', url, body),
        delete: (url) => invoke('delete', url, null),
        patch: (url, body) => invoke('put', url, body),
    };
}

// ─── Exportação: mesmo objeto para ambos os ambientes ────────────────────────
const api = isElectron ? makeIpcAdapter() : axiosApi;

export default api;
