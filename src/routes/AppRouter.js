import React from 'react';
import useAuthStore from '../store/useAuthStore';
import App from '../App';
import MarcacaoForm from '../components/MarcacaoForm';
import LoginScreen from '../components/LoginScreen';
import RedefinirSenha from '../components/RedefinirSenha';
import ConferenteLogin from '../conferente/ConferenteLogin';
import ConferenteApp from '../conferente/ConferenteApp';
import NotFound from '../components/NotFound';
import io from 'socket.io-client';

const MobileApp = React.lazy(() => import('../mobile/MobileApp'));

const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
const socket = io(API_URL);

/**
 * ROTEADOR PRINCIPAL
 * Gerencia rotas públicas, privadas e estado de autenticação global.
 */
function AppRouter() {
    const { isAuthenticated, user } = useAuthStore();
    const path = window.location.pathname;

    // 1. Rota de Marcação/Cadastro (Pública/Específica)
    if (path.startsWith('/cadastro/')) {
        return <MarcacaoForm />;
    }

    // 2. Rota de Redefinição de Senha (link do e-mail — pública)
    if (path.startsWith('/redefinir-senha')) {
        return <RedefinirSenha />;
    }

    // 2. Rota do Conferente (Login separado + App dedicado)
    if (path.startsWith('/conferente')) {
        if (!isAuthenticated || !['Conferente', 'Encarregado', 'Coordenador', 'Desenvolvedor'].includes(user?.cargo)) {
            return (
                <ConferenteLogin
                    onLoginSuccess={() => { }}
                />
            );
        }
        return <ConferenteApp socket={socket} />;
    }

    // 3. Rota Mobile (Coordenador PWA Mobile)
    if (path.startsWith('/mobile')) {
        return (
            <React.Suspense fallback={<div style={{ background: '#020617', height: '100vh' }} />}>
                <MobileApp socket={socket} />
            </React.Suspense>
        );
    }

    // 4. Rota do Checklist — redirecionada para /mobile (integrado)
    if (path.startsWith('/checklist')) {
        window.location.replace('/mobile');
        return null;
    }

    // 3. Rotas desconhecidas → 404
    const rotasValidas = ['/', '/cadastro', '/redefinir-senha', '/conferente', '/mobile', '/checklist'];
    const isRotaValida = rotasValidas.some(r => path === r || path.startsWith(r + '/'));
    if (!isRotaValida) {
        return <NotFound />;
    }

    // 4. Verificação de Autenticação para o Sistema Principal
    if (!isAuthenticated) {
        return (
            <LoginScreen
                onLoginSuccess={() => { }}
                socket={socket}
            />
        );
    }

    // 5. Sistema Principal (Admin/Operacional)
    return <App socket={socket} />;
}

export default AppRouter;
