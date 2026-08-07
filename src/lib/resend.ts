import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail({
  to,
  reminderTitle,
  reminderDate,
  reminderTime,
  noteTitle,
  noteId,
}: {
  to: string;
  reminderTitle: string;
  reminderDate: string;
  reminderTime: string | null;
  noteTitle: string | null;
  noteId: string | null;
}) {
  const when = [reminderDate, reminderTime].filter(Boolean).join(' at ');
  const noteLink = noteId ? `${process.env.NEXTAUTH_URL}/note/${noteId}` : null;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2c3848">
      <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#b8c8d6;margin:0 0 24px">Ruang Reminder</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:-0.02em;margin:0 0 8px">${reminderTitle}</h1>
      <p style="font-size:13px;color:#738290;margin:0 0 24px">${when}</p>
      ${noteTitle ? `<p style="font-size:13px;color:#2c3848;margin:0 0 8px">From note: <strong>${noteTitle}</strong></p>` : ''}
      ${noteLink ? `<a href="${noteLink}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#A1B5D8;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Open note →</a>` : ''}
      <hr style="margin:32px 0;border:none;border-top:1px solid #e8ecf2"/>
      <p style="font-size:11px;color:#b8c8d6;margin:0">You're receiving this because you set a reminder in Ruang.</p>
    </div>
  `;

  return resend.emails.send({
    from: 'Ruang <reminders@ruang.app>',
    to,
    subject: `Reminder: ${reminderTitle}`,
    html,
  });
}
