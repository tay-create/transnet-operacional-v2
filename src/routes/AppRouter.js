import React from 'react';
import useAuthStore from '../store/useAuthStore';
import App from '../App';
import MarcacaoForm from '../components/MarcacaoForm';
import LoginScreen from '../components/LoginScreen';
import RedefinirSenha from '../components/RedefinirSenha';
import ConferenteLogin from '../conferente/ConferenteLogin';
import ConferenteApp from '../conferente/ConferenteApp';
import ChecklistLogin from '../checklist/ChecklistLogin';
import ChecklistApp from '../checklist/ChecklistApp';
import io from 'socket.io-client';

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
        if (!isAuthenticated || !['Conferente', 'Encarregado'].includes(user?.cargo)) {
            return (
                <ConferenteLogin
                    onLoginSuccess={() => { }}
                />
            );
        }
        return <ConferenteApp socket={socket} />;
    }

    // 3. Rota do Checklist (Coordenador PWA)
    if (path.startsWith('/checklist')) {
        if (!isAuthenticated || user?.cargo !== 'Coordenador') {
            return <ChecklistLogin />;
        }
        return <ChecklistApp socket={socket} />;
    }

    // 3. Verificação de Autenticação para o Sistema Principal
    if (!isAuthenticated) {
        return (
            <LoginScreen
                onLoginSuccess={() => { }}
                socket={socket}
            />
        );
    }

    // 4. Sistema Principal (Admin/Operacional)
    return <App socket={socket} />;
}

export default AppRouter;
