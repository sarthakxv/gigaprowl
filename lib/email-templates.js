// Branded transactional email templates (verification + password reset).
// Inline styles only. Email clients strip <style> and external CSS.

function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#0B0F0E;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F0E;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#121816;border:1px solid #1e2724;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">gigaprowl<span style="color:#37E2A4;">.</span></div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;color:#cfd8d4;font-size:15px;line-height:1.55;">
          <h1 style="color:#ffffff;font-size:20px;margin:12px 0 16px;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #1e2724;color:#8A9490;font-size:12px;line-height:1.5;">
          Gigaprowl. The smartest job hunter in the world.<br/>
          If you didn't request this, you can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#37E2A4;color:#0B0F0E;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:15px;">${label}</a>`;
}

export function verifyEmail({ name, url }) {
  const html = shell("Confirm your email", `
    <p>Hi ${name || "there"}, welcome to Gigaprowl.</p>
    <p>Confirm this email to turn on outreach.</p>
    <p style="margin:24px 0;">${button(url, "Verify my email")}</p>
    <p style="color:#8A9490;font-size:13px;">Or paste this link into your browser:<br/><span style="color:#37E2A4;word-break:break-all;">${url}</span></p>
    <p style="color:#8A9490;font-size:13px;">This link expires in 3 days.</p>`);
  const text = `Welcome to Gigaprowl!\n\nConfirm your email to activate your account:\n${url}\n\nThis link expires in 3 days. If you didn't sign up, ignore this email.`;
  return { subject: "Confirm your email for Gigaprowl", html, text };
}

export function resetEmail({ name, url }) {
  const html = shell("Reset your password", `
    <p>Hi ${name || "there"},</p>
    <p>We got a request to reset your Gigaprowl password. Click below to choose a new one.</p>
    <p style="margin:24px 0;">${button(url, "Reset password")}</p>
    <p style="color:#8A9490;font-size:13px;">Or paste this link into your browser:<br/><span style="color:#37E2A4;word-break:break-all;">${url}</span></p>
    <p style="color:#8A9490;font-size:13px;">This link expires in 1 hour. If you didn't request it, ignore this email. Your password won't change.</p>`);
  const text = `Reset your Gigaprowl password:\n${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`;
  return { subject: "Reset your Gigaprowl password", html, text };
}
