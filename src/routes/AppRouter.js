import React from 'react';
import useAuthStore from '../store/useAuthStore';
import App from '../App';
import MarcacaoForm from '../components/MarcacaoForm';
import LoginScreen from '../components/LoginScreen';
import ConferenteLogin from '../conferente/ConferenteLogin';
import ConferenteApp from '../conferente/ConferenteApp';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const socket = io(API_URL);

/**
 * ROTEADOR PRINCIPAL
 * Gerencia rotas públicas, privadas e estado de autenticação global.
 */
function AppRouter() {
    const { isAuthenticated, user, login } = useAuthStore();
    const path = window.location.pathname;

    // 1. Rota de Marcação/Cadastro (Pública/Específica)
    if (path.startsWith('/cadastro/')) {
        return <MarcacaoForm />;
    }

    // 2. Rota do Conferente (Login separado + App dedicado)
    if (path.startsWith('/conferente')) {
        if (!isAuthenticated || user?.cargo !== 'Conferente') {
            return (
                <ConferenteLogin
                    onLoginSuccess={(userData) => login(userData, null)}
                />
            );
        }
        return <ConferenteApp socket={socket} />;
    }

    // 3. Verificação de Autenticação para o Sistema Principal
    if (!isAuthenticated) {
        return (
            <LoginScreen
                onLoginSuccess={(userData) => login(userData, null)}
                socket={socket}
            />
        );
    }

    // 4. Sistema Principal (Admin/Operacional)
    return <App socket={socket} />;
}

export default AppRouter;
