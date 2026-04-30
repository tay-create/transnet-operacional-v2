import React, { useState } from 'react';
import {
    Truck, Users, LogOut, BarChart3, Bell,
    FileText, Calculator, PlusCircle, Monitor,
    MapPin, ShieldCheck, Calendar, ClipboardCheck, AlertTriangle, FolderOpen, Package, LayoutGrid, LayoutDashboard,
    Clock, CheckCircle, Warehouse, Map, Route
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useUIStore from '../store/useUIStore';
import useUserStore from '../store/useUserStore';

// --- SUB-COMPONENTE: ITEM DO MENU ---
const MenuItem = ({ icon, label, onClick, color = '#94a3b8', subItem = false, aberto }) => {
    const [hover, setHover] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: subItem ? '10px 15px 10px 25px' : '12px 15px',
                margin: '2px 0',
                borderRadius: '8px',
                cursor: 'pointer',
                background: hover ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                borderLeft: hover ? `3px solid ${color}` : '3px solid transparent',
                transition: 'all 0.2s ease',
                color: hover ? 'white' : color,
                justifyContent: aberto ? 'flex-start' : 'center',
                position: 'relative'
            }}
            title={!aberto ? label : ''}
        >
            <div style={{ minWidth: '24px', display: 'flex', justifyContent: 'center' }}>
                {typeof icon === 'string' ? <span style={{ fontSize: '18px' }}>{icon}</span> : icon}
            </div>
            <span style={{
                opacity: aberto ? 1 : 0,
                transition: 'opacity 0.2s',
                whiteSpace: 'nowrap',
                fontSize: subItem ? '13px' : '14px',
                fontWeight: subItem ? '400' : '600',
                display: aberto ? 'block' : 'none'
            }}>
                {label}
            </span>
        </button>
    );
};

// --- SUB-COMPONENTE: DIVISOR ---
const Divider = ({ label, aberto }) => (
    <div style={{
        marginTop: '15px',
        marginBottom: '5px',
        paddingLeft: '15px',
        fontSize: '10px',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: 'bold',
        opacity: aberto ? 1 : 0,
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap'
    }}>
        {label}
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function Sidebar({
    onLogout,
    buscarRelatorioCte,
    ativarNotificacoes
}) {
    const { user, temAcesso, podeVerUnidade } = useAuthStore();
    const {
        setAbaAtiva,
        openModal,
        menuAberto: aberto,
        toggleMenu: setAberto
    } = useUIStore();

    const { carregarSolicitacoes, carregarUsuarios } = useUserStore();

    // Normaliza cargo para comparação case-insensitive
    const cargo = (user?.cargo || '').toUpperCase();
    const ehCoordenador = cargo === 'COORDENADOR' || cargo === 'DESENVOLVEDOR';
    const ehViewer = cargo === 'DASHBOARD VIEWER';

    return (
        <div
            onMouseEnter={() => setAberto(true)}
            onMouseLeave={() => setAberto(false)}
            style={{
                position: 'fixed', left: 0, top: '80px', bottom: 0,
                width: aberto ? '260px' : '70px',
                background: '#020617',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 40,
                display: 'flex', flexDirection: 'column',
                overflowX: 'hidden',
                boxShadow: '4px 0 15px rgba(0,0,0,0.3)'
            }}
        >
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px' }}>

                {/* ADMINISTRAÇÃO — apenas Coordenador */}
                {ehCoordenador && (
                    <>
                        <Divider label="Administração" aberto={aberto} />
                        <MenuItem
                            icon={<Users size={20} />}
                            label="Gestão de Usuários"

                            aberto={aberto}
                            onClick={() => { openModal('admin'); carregarSolicitacoes(); carregarUsuarios(); }}
                        />
                    </>
                )}

                {/* SISTEMA — todos */}
                <Divider label="Sistema" aberto={aberto} />
                <MenuItem
                    icon={<Bell size={20} />}
                    label="Ativar Alertas (PC)"

                    aberto={aberto}
                    onClick={ativarNotificacoes}
                />

                {/* OPERAÇÃO */}
                {temAcesso('operacao') && (
                    <>
                        <Divider label="Operação" aberto={aberto} />
                        {['COORDENADOR', 'PLANEJAMENTO', 'DESENVOLVEDOR'].includes(cargo) && (
                            <MenuItem icon={<PlusCircle size={20} />} label="Novo Lançamento" subItem aberto={aberto} onClick={() => { setAbaAtiva('novo_lancamento'); }} />
                        )}
                        {podeVerUnidade('Recife') && (
                            <MenuItem icon={<Truck size={20} />} label="Painel Recife" subItem aberto={aberto} onClick={() => { setAbaAtiva('op_recife'); }} />
                        )}
                        {podeVerUnidade('Moreno') && (
                            <MenuItem icon={<Truck size={20} />} label="Painel Moreno" subItem aberto={aberto} onClick={() => { setAbaAtiva('op_moreno'); }} />
                        )}
                        <MenuItem icon={<Truck size={20} />} label="Painel Leão/Eletrik Sul" subItem aberto={aberto} onClick={() => { setAbaAtiva('painel_leao'); }} />
                        <MenuItem icon={<Calendar size={20} />} label="Programação Diária" subItem aberto={aberto} onClick={() => { setAbaAtiva('programacao_diaria'); }} />
                    </>
                )}

                {/* OPERAÇÃO FROTA */}
                {(temAcesso('operacao') || temAcesso('provisionamento') || temAcesso('painel_frota')) && (
                    <>
                        <Divider label="Operação Frota" aberto={aberto} />
                        <MenuItem icon={<LayoutGrid size={20} />} label="Provisionamento" subItem aberto={aberto} onClick={() => { setAbaAtiva('provisionamento'); }} />
                        <MenuItem icon={<BarChart3 size={20} />} label="Dashboard" subItem aberto={aberto} onClick={() => { setAbaAtiva('frota_dashboard'); }} />
                        {temAcesso('painel_frota') && (
                            <MenuItem icon={<Map size={20} />} label="Painel de Provisionamento" subItem aberto={aberto} onClick={() => { setAbaAtiva('painel_frota'); }} />
                        )}
                        {temAcesso('roteirizacao_frota') && (
                            <MenuItem icon={<Route size={20} />} label="Roteirização da Frota" subItem aberto={aberto} onClick={() => { setAbaAtiva('roteirizacao_frota'); }} />
                        )}
                    </>
                )}

                {/* CT-E */}
                {temAcesso('cte') && (
                    <>
                        <Divider label="Fiscal / CT-e" aberto={aberto} />
                        {podeVerUnidade('Recife') && (
                            <MenuItem icon={<FileText size={20} />} label="CT-e Recife" subItem aberto={aberto} onClick={() => { setAbaAtiva('cte_recife'); }} />
                        )}
                        {podeVerUnidade('Moreno') && (
                            <MenuItem icon={<FileText size={20} />} label="CT-e Moreno" subItem aberto={aberto} onClick={() => { setAbaAtiva('cte_moreno'); }} />
                        )}
                        <MenuItem icon={<FileText size={20} />} label="CT-e São Paulo" subItem aberto={aberto} onClick={() => { setAbaAtiva('cte_sp'); }} />
                    </>
                )}

                {/* CUBAGEM */}
                {temAcesso('cubagem') && (
                    <>
                        <Divider label="Cubagem" aberto={aberto} />
                        <MenuItem icon={<Calculator size={20} />} label="Cálculo de Cubagem" subItem aberto={aberto} onClick={() => { setAbaAtiva('cubagem'); }} />
                    </>
                )}

                {/* RELATÓRIOS (para quem tem acesso, exceto Viewer puro) */}
                {temAcesso('relatorios') && !ehViewer && (
                    <>
                        <Divider label="Relatórios" aberto={aberto} />
                        <MenuItem icon={<BarChart3 size={20} />} label="Relatório Operacional" subItem aberto={aberto} onClick={() => { setAbaAtiva('relatorio_op'); }} />
                        <MenuItem icon={<BarChart3 size={20} />} label="Performance de Embarque" subItem aberto={aberto} onClick={() => { setAbaAtiva('relatorio_performance'); }} />
                        <MenuItem icon={<Clock size={20} />} label="Tempo Médio de Contratação" subItem aberto={aberto} onClick={() => { setAbaAtiva('relatorio_liberacoes'); }} />
                        <MenuItem icon={<FileText size={20} />} label="Relatório CT-e" subItem aberto={aberto} onClick={() => { setAbaAtiva('relatorio_cte'); }} />
                        <MenuItem icon={<Warehouse size={20} />} label="Relatório de Cubagem" subItem aberto={aberto} onClick={() => { setAbaAtiva('relatorio_cubagem'); }} />
                        <MenuItem icon={<Monitor size={20} />} label="Dashboard Operação" subItem aberto={aberto} onClick={() => { setAbaAtiva('dashboard_tv'); }} />
                    </>
                )}

                {/* DASHBOARD — acessível para Dashboard Viewer e quem tem dashboard_tv mas não relatorios */}
                {(ehViewer || (temAcesso('dashboard_tv') && !temAcesso('relatorios'))) && (
                    <>
                        <Divider label="Dashboard" aberto={aberto} />
                        <MenuItem icon={<Monitor size={20} />} label="Dashboard Operação" subItem aberto={aberto} onClick={() => { setAbaAtiva('dashboard_tv'); }} />
                    </>
                )}

                {/* GER. DE RISCO / CADASTRO */}
                {(temAcesso('cadastro') || cargo === 'CADASTRO' || cargo === 'ENCARREGADO' || ehCoordenador) && (
                    <>
                        <Divider label="Ger. de Risco" aberto={aberto} />
                        <MenuItem icon={<ShieldCheck size={20} />} label="Ger. Risco / Liberação" aberto={aberto} onClick={() => { setAbaAtiva('cadastro'); }} />
                        <MenuItem icon={<FolderOpen size={20} />} label="Histórico de Liberações" subItem aberto={aberto} onClick={() => { setAbaAtiva('historico_liberacoes'); }} />
                    </>
                )}

                {/* MARCAÇÃO DE PLACAS */}
                {(ehCoordenador || cargo === 'PLANEJAMENTO' || cargo === 'POS EMBARQUE' || cargo === 'CADASTRO' || cargo === 'CONHECIMENTO') && (
                    <>
                        <Divider label="Marcação de Placas" aberto={aberto} />
                        <MenuItem
                            icon={<MapPin size={20} />}
                            label="Marcação de Placa"
                            subItem
                            aberto={aberto}
                            onClick={() => setAbaAtiva('marcacao_placas')}
                        />
                        <MenuItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard de Marcações"
                            subItem
                            aberto={aberto}
                            onClick={() => setAbaAtiva('dashboard_marcacoes')}
                        />
                    </>
                )}

                {/* CHECKLIST */}
                {(temAcesso('checklist_carreta') || temAcesso('saldo_paletes') || ehCoordenador || cargo === 'PLANEJAMENTO' || cargo === 'POS EMBARQUE') && (
                    <>
                        <Divider label="Checklist" aberto={aberto} />
                        {(temAcesso('checklist_carreta') || ehCoordenador) && (
                            <MenuItem
                                icon={<ClipboardCheck size={20} />}
                                label="Checklist da Carreta"
                                subItem
                                aberto={aberto}
                                onClick={() => setAbaAtiva('checklist_carreta')}
                            />
                        )}
                        {(ehCoordenador || cargo === 'PLANEJAMENTO' || temAcesso('saldo_paletes')) && (
                            <MenuItem
                                icon={<Package size={20} />}
                                label="Saldo de Paletes"
                                subItem
                                aberto={aberto}
                                onClick={() => setAbaAtiva('saldo_paletes')}
                            />
                        )}
                        {(temAcesso('operacao') || ehCoordenador || cargo === 'POS EMBARQUE') && (
                            <MenuItem
                                icon={<AlertTriangle size={20} />}
                                label="Ocorrências"
                                subItem
                                aberto={aberto}
                                onClick={() => setAbaAtiva('ocorrencias')}
                            />
                        )}
                    </>
                )}
            </div>

            {/* ÁREA PÓS-EMBARQUE */}
            {(ehCoordenador || cargo === 'POS EMBARQUE' || cargo === 'PLANEJAMENTO') && (
                <>
                    <Divider label="Área Pós-Embarque" aberto={aberto} />
                    <MenuItem
                        icon={<AlertTriangle size={20} />}
                        label="Painel de Ocorrências"
                        subItem
                        aberto={aberto}
                        onClick={() => setAbaAtiva('pos_embarque')}
                    />
                    <MenuItem
                        icon={<LayoutDashboard size={20} />}
                        label="Dashboard Ocorrências"
                        subItem
                        aberto={aberto}
                        onClick={() => setAbaAtiva('pos_embarque_dashboard')}
                    />
                </>
            )}

            {/* Rodapé (Sair) */}
            <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                    onClick={onLogout}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: aberto ? 'flex-start' : 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                    }}
                    title="Sair do Sistema"
                >
                    <LogOut size={20} />
                    {aberto && <span>SAIR DO SISTEMA</span>}
                </button>
            </div>
        </div>
    );
}
