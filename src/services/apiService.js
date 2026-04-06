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
        let token = localStorage.getItem('auth_token') || null;
        if (!token) {
            const authStorage = localStorage.getItem('auth-storage');
            if (authStorage) {
                try {
                    const parsed = JSON.parse(authStorage);
                    token = parsed.state?.token || null;
                } catch (e) {}
            }
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
            const pathname = window.location.pathname;
            const isConferente = pathname.startsWith('/conferente');
            const isMobile = pathname.startsWith('/mobile');
            const url = error.config?.url || '';
            // Dashboard Viewer nunca é deslogado por 401 (sessão permanente, TV/painel)
            const cargo = useAuthStore.getState().user?.cargo;
            if (cargo === 'Dashboard Viewer') {
                // Apenas ignorar — sessão permanente, o servidor pode ter reiniciado
            } else if (isConferente || isMobile) {
                if (!url.includes('/login')) {
                    useAuthStore.getState().logout();
                }
            } else {
                useAuthStore.getState().logout();
                if (pathname !== '/login') {
                    window.location.href = '/';
                }
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

function makeIpcAdapter() {
    const invoke = async (method, url, body) => {
        // Normaliza o path: remove leading /api se presente
        let normalizedUrl = url.startsWith('/api') ? url.substring(4) : url;
        const [path, qs] = normalizedUrl.split('?');
        const params = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};

        let data;

        // ── Login ──────────────────────────────────────────────────────────────
        if (method === 'post' && path === '/login') {
            let emailLogin = (body.email || body.nome || '').trim().toLowerCase();
            if (!emailLogin.includes('@')) emailLogin = `${emailLogin}@tnetlog.com.br`;
            data = await window.api.login(emailLogin, body.senha);
        }

        // ── Veículos / Conferente / Cadastro ──────────────────────────────────
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
        // ── Fallback para rotas não mapeadas no IPC (usa axios) ────────────────
        else {
            console.warn(`[IPC] Rota não mapeada no IPC, usando Axios: ${method.toUpperCase()} ${url}`);
            const axiosConfig = { method, url, data: body };
            // Para chamadas GET, passar os params
            if (method === 'get' && params) axiosConfig.params = params;
            
            try {
                const res = await axiosApi(axiosConfig);
                return res;
            } catch (err) {
                // Re-lançar erro para o componente tratar
                throw err;
            }
        }

        return { data, status: data?.success !== false ? 200 : 400 };
    };

    return {
        get: (url, config) => {
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

const api = isElectron ? makeIpcAdapter() : axiosApi;
export default api;
