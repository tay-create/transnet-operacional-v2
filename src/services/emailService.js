const nodemailer = require('nodemailer');

const BASE_URL = process.env.FRONTEND_URL || 'https://portal.tnethub.com.br';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function resetEmailHtml(nome, link) {
    const ano = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Redefinição de Senha — Transnet</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);">
              <div style="width:64px;height:64px;background:#1e40af;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:28px;">🔐</span>
              </div>
              <h1 style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:1px;">TRANSNET OPERACIONAL</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Redefinição de Senha</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Olá, <strong style="color:#e2e8f0;">${nome}</strong></p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Transnet Operacional.
                Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong style="color:#f8fafc;">15 minutos</strong>.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);">
                    <a href="${link}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      REDEFINIR SENHA
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-align:center;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 24px;color:#38bdf8;font-size:12px;text-align:center;word-break:break-all;">
                ${link}
              </p>

              <div style="border-top:1px solid #334155;padding-top:20px;">
                <p style="margin:0;color:#475569;font-size:12px;line-height:1.5;">
                  ⚠️ Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha permanece a mesma e nenhuma alteração será feita.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 40px;background:#0f172a;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#334155;font-size:11px;">
                © ${ano} Transnet Logística — Sistema Operacional Interno
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function verificationEmailHtml(link) {
    const ano = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirme seu e-mail — Transnet</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);">
              <div style="width:64px;height:64px;background:#0369a1;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:28px;">✉️</span>
              </div>
              <h1 style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:1px;">TRANSNET OPERACIONAL</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Verificação de E-mail</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                Você cadastrou este endereço como e-mail de recuperação da sua conta no Transnet Operacional.
                Clique no botão abaixo para confirmar. Este link é válido por <strong style="color:#f8fafc;">24 horas</strong>.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0284c7);">
                    <a href="${link}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      CONFIRMAR E-MAIL
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-align:center;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 24px;color:#38bdf8;font-size:12px;text-align:center;word-break:break-all;">
                ${link}
              </p>

              <div style="border-top:1px solid #334155;padding-top:20px;">
                <p style="margin:0;color:#475569;font-size:12px;line-height:1.5;">
                  Se você não reconhece esta solicitação, ignore este e-mail com segurança.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 40px;background:#0f172a;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#334155;font-size:11px;">
                © ${ano} Transnet Logística — Sistema Operacional Interno
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendVerificationEmail(toEmail, token) {
    const link = `${BASE_URL}/verificar-email?token=${token}`;
    await transporter.sendMail({
        from: `"Transnet Operacional" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: 'Confirme seu e-mail de recuperação — Transnet',
        html: verificationEmailHtml(link),
    });
}

async function sendPasswordResetEmail(toEmail, token, nome) {
    const link = `${BASE_URL}/redefinir-senha?token=${token}`;
    await transporter.sendMail({
        from: `"Transnet Operacional" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: 'Redefinição de senha — Transnet Operacional',
        html: resetEmailHtml(nome || 'Usuário', link),
    });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
