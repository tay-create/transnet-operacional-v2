import React from 'react';
import Header from '../Header';
import Sidebar from '../Sidebar';
import ModalAvatar from '../ModalAvatar';
import ModalPermissoes from '../ModalPermissoes';
import ModalAdmin from '../ModalAdmin';
import useAuthStore from '../../store/useAuthStore';
import useUIStore from '../../store/useUIStore';

export default function MainLayout({
    children,
    onLogout,
    aceitarCtePelaNotificacao,
    buscarRelatorioCte,
    ativarNotificacoes,
    handleUpdateAvatar,
    handleRemoverNotificacao
}) {
    const { user } = useAuthStore();
    const {
        modals,
        closeModal,
        notificacao
    } = useUIStore();

    return (
        <div className="full-screen">
            {notificacao && <div className="toast">{notificacao}</div>}

            <Header
                onLogout={onLogout}
                aceitarCtePelaNotificacao={aceitarCtePelaNotificacao}
                handleRemoverNotificacao={handleRemoverNotificacao}
            />

            <ModalAvatar
                isOpen={modals.avatar}
                onClose={() => closeModal('avatar')}
                user={user}
                onUpdateAvatar={handleUpdateAvatar}
            />

            <ModalPermissoes
                isOpen={modals.permissao}
                onClose={() => closeModal('permissao')}
            />

            <ModalAdmin
                isOpen={modals.admin}
                onClose={() => closeModal('admin')}
            />

            <Sidebar
                onLogout={onLogout}
                buscarRelatorioCte={buscarRelatorioCte}
                ativarNotificacoes={ativarNotificacoes}
            />

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
