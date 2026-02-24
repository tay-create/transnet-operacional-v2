import React, { useState } from 'react';
import LoginMotorista from './LoginMotorista';
import PainelMotorista from './PainelMotorista';

/**
 * PORTAL MOTORISTA (rota pública /motorista)
 * Gerencia a sessão do motorista e decide entre tela de login ou painel.
 */
function PortalMotorista() {
    const [motoristaLogado, setMotoristaLogado] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('motorista_logado')) || null; }
        catch { return null; }
    });

    const handleLogin = (motorista) => {
        sessionStorage.setItem('motorista_logado', JSON.stringify(motorista));
        setMotoristaLogado(motorista);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('motorista_logado');
        setMotoristaLogado(null);
    };

    if (!motoristaLogado) {
        return <LoginMotorista onLogin={handleLogin} />;
    }
    return <PainelMotorista motorista={motoristaLogado} onLogout={handleLogout} />;
}

export default PortalMotorista;
