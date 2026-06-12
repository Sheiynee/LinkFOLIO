import { Resend } from "resend";
import { siteBaseUrl } from "./site-url";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

const FROM = process.env.EMAIL_FROM ?? "noreply@linkfolio.app";

export async function sendEmailVerification(to: string, verifyUrl: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Confirm your new email address — LinkFolio",
    html: `
      <p>Hi there,</p>
      <p>Click the link below to confirm your new email address. The link expires in 1 hour.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Confirm email address</a></p>
      <p style="color:#888;font-size:13px">Or copy this URL into your browser:<br>${verifyUrl}</p>
      <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Confirm your new email address\n\nClick the link below to confirm (expires in 1 hour):\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
  });
}

export async function sendWeeklyDigest(
  to: string,
  stats: { views: number; clicks: number; username: string }
) {
  const siteUrl = siteBaseUrl();

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Your weekly LinkFolio stats — ${stats.views} view${stats.views === 1 ? "" : "s"} this week`,
    html: `
      <p style="font-family:sans-serif">Here's how <strong>linkfolio.app/${stats.username}</strong> performed this week:</p>
      <table style="border-collapse:collapse;font-family:sans-serif;margin:16px 0">
        <tr>
          <td style="padding:12px 20px;background:#f4f4f5;border-radius:6px 0 0 6px;font-size:28px;font-weight:700;color:#09090b">${stats.views}</td>
          <td style="padding:12px 16px;font-size:14px;color:#71717a">page views</td>
        </tr>
        <tr><td colspan="2" style="height:8px"></td></tr>
        <tr>
          <td style="padding:12px 20px;background:#f4f4f5;border-radius:6px 0 0 6px;font-size:28px;font-weight:700;color:#09090b">${stats.clicks}</td>
          <td style="padding:12px 16px;font-size:14px;color:#71717a">link clicks</td>
        </tr>
      </table>
      <p style="font-family:sans-serif">
        <a href="${siteUrl}/${stats.username}" style="color:#7c3aed">View your page</a> &nbsp;·&nbsp;
        <a href="${siteUrl}/dashboard" style="color:#7c3aed">Dashboard</a>
      </p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
      <p style="font-family:sans-serif;font-size:12px;color:#a1a1aa">
        You're receiving this because you opted in to weekly stats emails.
        <a href="${siteUrl}/dashboard/settings" style="color:#a1a1aa">Unsubscribe</a>
      </p>
    `,
    text: `Your weekly LinkFolio stats\n\n${stats.views} page views\n${stats.clicks} link clicks\n\nView your page: ${siteUrl}/${stats.username}\nDashboard: ${siteUrl}/dashboard\n\nTo unsubscribe, visit ${siteUrl}/dashboard/settings`,
  });
}
