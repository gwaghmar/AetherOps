/**
 * Sets AetherOps branded email templates on Supabase via Management API.
 * Usage: SUPABASE_ACCESS_TOKEN=<pat> node scripts/set-email-templates.mjs
 *
 * Get your PAT: https://supabase.com/dashboard/account/tokens
 */

const PROJECT_REF = "lbqrgvqmurshifvttavg";
const SITE_URL = "https://aetherops-govw.vercel.app";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN env var.");
  console.error("Get one at: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

// ─── Shared layout ────────────────────────────────────────────────────────────
function wrap(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F6F6EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6EF;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;">

        <!-- Logo bar -->
        <tr>
          <td style="padding-bottom:24px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#FF6600;border-radius:6px;width:28px;height:28px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:14px;font-weight:700;line-height:28px;">A</span>
                </td>
                <td style="padding-left:8px;font-size:15px;font-weight:600;color:#0F0F0F;vertical-align:middle;">AetherOps</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #E8E8E6;border-radius:12px;padding:36px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:24px;font-size:12px;color:#AAAAAA;text-align:center;">
            AetherOps &middot; AI-native IT governance<br/>
            You received this email because an action was taken on your account.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const btn = (label, url) => `
<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr>
    <td style="background:#FF6600;border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#AAAAAA;">
  Or copy this link: <a href="${url}" style="color:#FF6600;">${url}</a>
</p>`;

const fallback = `<p style="font-size:13px;color:#6B6B6B;margin-top:4px;">
  If you didn't request this, you can safely ignore this email.
</p>`;

// ─── Templates ────────────────────────────────────────────────────────────────
const templates = {
  mailer_subjects_confirmation: "Confirm your AetherOps account",
  mailer_templates_confirmation_content: wrap("Confirm your account", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F0F0F;letter-spacing:-0.03em;">Confirm your account</h1>
    <p style="margin:0;font-size:15px;color:#6B6B6B;line-height:1.6;">
      You're one step away from using AetherOps — the AI-native operations platform that replaces your ticket queue.
      Click below to verify your email address.
    </p>
    ${btn("Confirm email address", "{{ .ConfirmationURL }}")}
    ${fallback}
  `),

  mailer_subjects_recovery: "Reset your AetherOps password",
  mailer_templates_recovery_content: wrap("Reset your password", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F0F0F;letter-spacing:-0.03em;">Reset your password</h1>
    <p style="margin:0;font-size:15px;color:#6B6B6B;line-height:1.6;">
      We received a request to reset the password for your AetherOps account.
      This link expires in <strong>1 hour</strong>.
    </p>
    ${btn("Reset password", "{{ .ConfirmationURL }}")}
    ${fallback}
  `),

  mailer_subjects_magic_link: "Your AetherOps sign-in link",
  mailer_templates_magic_link_content: wrap("Sign in to AetherOps", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F0F0F;letter-spacing:-0.03em;">Your sign-in link</h1>
    <p style="margin:0;font-size:15px;color:#6B6B6B;line-height:1.6;">
      Use the button below to sign in to AetherOps. This link expires in <strong>10 minutes</strong> and can only be used once.
    </p>
    ${btn("Sign in to AetherOps", "{{ .ConfirmationURL }}")}
    ${fallback}
  `),

  mailer_subjects_email_change: "Confirm your new AetherOps email",
  mailer_templates_email_change_content: wrap("Confirm email change", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F0F0F;letter-spacing:-0.03em;">Confirm your new email</h1>
    <p style="margin:0;font-size:15px;color:#6B6B6B;line-height:1.6;">
      You requested to change the email address on your AetherOps account.
      Click below to confirm and complete the change.
    </p>
    ${btn("Confirm new email", "{{ .ConfirmationURL }}")}
    ${fallback}
  `),

  mailer_subjects_invite: "You've been invited to AetherOps",
  mailer_templates_invite_content: wrap("You're invited", `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F0F0F;letter-spacing:-0.03em;">You're invited to AetherOps</h1>
    <p style="margin:0;font-size:15px;color:#6B6B6B;line-height:1.6;">
      A team member has invited you to join their AetherOps workspace — the AI-native platform for IT requests, approvals, and change control.
    </p>
    ${btn("Accept invitation", "{{ .ConfirmationURL }}")}
    <p style="font-size:13px;color:#6B6B6B;margin-top:16px;">
      This invitation expires in 24 hours.
    </p>
  `),
};

// ─── Push to Supabase Management API ──────────────────────────────────────────
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    ...templates,
    smtp_admin_email: "noreply@resend.dev",
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: process.env.RESEND_API_KEY || "",
    smtp_sender_name: "AetherOps",
    smtp_max_frequency: 60,
    mailer_autoconfirm: false,
    site_url: SITE_URL,
    uri_allow_list: [
      `${SITE_URL}/**`,
      "http://localhost:3000/**",
    ].join(","),
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error("Failed:", res.status, JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("✓ Email templates updated");
console.log(`✓ Site URL set to ${SITE_URL}`);
console.log("✓ SMTP configured via Resend");
console.log("Done. All Supabase auth settings applied.");
