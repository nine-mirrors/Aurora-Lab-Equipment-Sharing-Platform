import nodemailer from 'nodemailer'

let transporter = null

function smtpConfig() {
  const host = process.env.SMTP_HOST || ''
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const port = Number(process.env.SMTP_PORT) || 465
  const secure = process.env.SMTP_SECURE
    ? String(process.env.SMTP_SECURE) !== 'false'
    : port === 465

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName: process.env.SMTP_FROM_NAME || '极光实验室'
  }
}

export function isMailConfigured() {
  const { host, user, pass } = smtpConfig()
  return Boolean(host && user && pass)
}

function getTransporter() {
  if (transporter) return transporter
  const { host, port, secure, user, pass } = smtpConfig()

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  })

  return transporter
}

function codeEmailHtml({ code, type }) {
  const isReset = type === 'reset_password'
  const title = isReset ? '重置密码验证码' : '注册验证码'
  const action = isReset ? '重置密码' : '完成注册'

  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f3f6ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:18px;border:1px solid #e3ebdd;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px 10px;">
                <div style="font-size:12px;letter-spacing:3px;color:#0e7c66;font-weight:600;">AURORA LAB</div>
                <h1 style="margin:10px 0 6px;font-size:22px;color:#14251c;">极光实验室 · ${title}</h1>
                <p style="margin:0;font-size:13px;line-height:1.8;color:#6b7d72;">
                  你正在${action}，请在 10 分钟内输入下面的验证码。若非本人操作，请忽略本邮件。
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;">
                <div style="padding:18px;text-align:center;border-radius:14px;background:#eef7f2;border:1px solid #cfe8dd;">
                  <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0e7c66;font-family:'Courier New',monospace;">${code}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 26px;">
                <p style="margin:0;font-size:12px;line-height:1.8;color:#8a9a90;">
                  验证码仅可使用一次，请勿转发给他人。如多次收到邮件，请检查是否有人尝试使用你的邮箱。
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 30px;background:#f7faf4;border-top:1px solid #eaf0e6;font-size:11px;color:#9aa9a0;">
                极光实验室设备共享平台 · 自动发送，请勿直接回复
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function notificationEmailHtml({ title, content, link }) {
  const safeTitle = escapeHtml(title)
  const safeContent = escapeHtml(content)
  const safeLink = link ? escapeHtml(link) : ''

  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f3f6ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:18px;border:1px solid #e3ebdd;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px 10px;">
                <div style="font-size:12px;letter-spacing:3px;color:#0e7c66;font-weight:600;">AURORA LAB</div>
                <h1 style="margin:10px 0 6px;font-size:20px;color:#14251c;">${safeTitle}</h1>
                <p style="margin:0;font-size:13px;line-height:1.8;color:#6b7d72;">${safeContent}</p>
              </td>
            </tr>
            ${
              safeLink
                ? `<tr><td style="padding:8px 30px 22px;"><a href="${safeLink}" style="display:inline-block;padding:9px 16px;border-radius:9px;background:#0e7c66;color:#fff;text-decoration:none;font-size:12px;">查看详情</a></td></tr>`
                : ''
            }
            <tr>
              <td style="padding:14px 30px;background:#f7faf4;border-top:1px solid #eaf0e6;font-size:11px;color:#9aa9a0;">
                极光实验室设备共享平台 · 自动发送，请勿直接回复
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** 发送业务通知邮件；未配置 SMTP 或 MAIL_DISABLED=1 时静默跳过 */
export async function sendNotificationEmail({ to, title, content, link = '' }) {
  if (process.env.MAIL_DISABLED === '1') return false
  if (!isMailConfigured() || !to) return false

  const { user, fromName } = smtpConfig()
  const base = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const url = link ? `${base}${link}` : ''

  await getTransporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `【极光实验室】${title}`,
    text: `${title}\n${content}${url ? `\n${url}` : ''}`,
    html: notificationEmailHtml({ title, content, link: url })
  })

  return true
}

export async function sendVerificationCode({ to, code, type = 'register' }) {
  if (!isMailConfigured()) {
    throw new Error('SMTP 未配置')
  }

  const { user, fromName } = smtpConfig()
  const isReset = type === 'reset_password'

  await getTransporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `【极光实验室】${isReset ? '重置密码' : '注册'}验证码：${code}`,
    text: `你的验证码是 ${code}，10 分钟内有效。若非本人操作请忽略本邮件。`,
    html: codeEmailHtml({ code, type })
  })

  return true
}
