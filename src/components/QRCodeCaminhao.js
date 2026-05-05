import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Truck, QrCode, ExternalLink } from 'lucide-react';

const QR_URL = 'https://portal.tnethub.com.br/entrar';

export default function QRCodeCaminhao() {
    const printRef = useRef(null);

    const handlePrint = () => window.print();

    return (
        <div style={styles.root}>
            {/* Conteúdo de tela */}
            <div style={styles.header}>
                <QrCode size={24} color="#22d3ee" />
                <h2 style={styles.headerTitle}>QR Code — Auto-registro de Motoristas</h2>
            </div>

            <div style={styles.desc}>
                Imprima e afixe em local visível no pátio. O motorista lê o QR com o celular,
                digita o telefone e é direcionado ao formulário de marcação automaticamente.
            </div>

            <div style={styles.urlRow}>
                <ExternalLink size={14} color="#64748b" />
                <span style={styles.urlText}>{QR_URL}</span>
            </div>

            {/* QR + botão imprimir */}
            <div style={styles.cardWrap}>
                <div ref={printRef} style={styles.qrCard} id="qr-print-area">
                    <div style={styles.qrBrand}>
                        <Truck size={22} color="#22d3ee" strokeWidth={1.5} />
                        <span style={styles.qrBrandText}>TRANSNET</span>
                    </div>

                    <div style={styles.qrWrap}>
                        <QRCodeSVG
                            value={QR_URL}
                            size={220}
                            bgColor="transparent"
                            fgColor="#f1f5f9"
                            level="M"
                            imageSettings={{
                                src: '',
                                x: undefined,
                                y: undefined,
                                height: 0,
                                width: 0,
                                excavate: false,
                            }}
                        />
                        {/* Ícone caminhão sobreposto no centro */}
                        <div style={styles.qrCenter}>
                            <div style={styles.qrCenterIcon}>
                                <Truck size={22} color="#020617" strokeWidth={2} />
                            </div>
                        </div>
                    </div>

                    <p style={styles.qrInstr}>Aponte a câmera do celular para acessar</p>
                    <p style={styles.qrSub}>Registro de motoristas — Marcação de placas</p>
                </div>

                <button style={styles.printBtn} onClick={handlePrint}>
                    <Printer size={18} />
                    Imprimir QR Code
                </button>
            </div>

            {/* CSS de impressão embutido */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #qr-print-area,
                    #qr-print-area * { visibility: visible !important; }
                    #qr-print-area {
                        position: fixed !important;
                        top: 50% !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) !important;
                        background: white !important;
                        color: #020617 !important;
                        border: 2px solid #e2e8f0 !important;
                        box-shadow: none !important;
                        padding: 40px !important;
                    }
                    #qr-print-area svg path,
                    #qr-print-area svg rect { fill: #020617 !important; }
                    #qr-print-area .qr-center-icon { background: white !important; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    root: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 600,
        fontFamily: "'Inter', sans-serif",
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#f1f5f9',
        margin: 0,
    },
    desc: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 1.6,
    },
    urlRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '10px 14px',
    },
    urlText: {
        fontSize: 13,
        color: '#22d3ee',
        fontFamily: "'JetBrains Mono', monospace",
    },
    cardWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
    },
    qrCard: {
        background: 'rgba(10,15,30,0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)',
    },
    qrBrand: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    qrBrandText: {
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: '0.12em',
        color: '#f1f5f9',
    },
    qrWrap: {
        position: 'relative',
        display: 'inline-flex',
    },
    qrCenter: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
    },
    qrCenterIcon: {
        width: 38,
        height: 38,
        background: '#22d3ee',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(34,211,238,0.4)',
    },
    qrInstr: {
        fontSize: 13,
        color: '#94a3b8',
        margin: 0,
        textAlign: 'center',
    },
    qrSub: {
        fontSize: 11,
        color: '#475569',
        margin: 0,
        textAlign: 'center',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    printBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#f1f5f9',
        padding: '12px 24px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.2s',
    },
};
