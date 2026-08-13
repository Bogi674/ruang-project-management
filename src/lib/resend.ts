import { Resend } from 'resend';

/**
 * Constructed on demand rather than at module load. A top-level throw meant an
 * unset RESEND_API_KEY took down every route that transitively imported this
 * file, not just the one that sends mail.
 */
function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
  return new Resend(key);
}

/**
 * Escapes a value for interpolation into the email body.
 *
 * Reminder titles and note titles are user-written and were dropped into the
 * HTML raw. Today the only recipient is the author themselves, but the
 * reminder form already collects other recipients — the moment that ships,
 * unescaped titles become markup the author can inject into someone else's
 * inbox (a link that looks like it came from Ruang). Escaping now costs
 * nothing and removes the trap.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The sending identity. Overridable because the default domain has to be a
 * verified sender in the Resend account for anything to leave the building —
 * and account verification now depends on this working.
 */
function from(): string {
  return process.env.EMAIL_FROM || 'Ruang <reminders@ruang.app>';
}

/**
 * Confirmation mail for a new email/password account.
 *
 * `link` is the `action_link` Supabase returns from `auth.admin.generateLink`,
 * so it points at Supabase's verify endpoint and carries a single-use token.
 * Until it is followed, `signInWithPassword` refuses the account — which is
 * what stops someone registering an address they do not own and lying in wait
 * for its real owner to arrive through Google sign-in.
 */
export async function sendVerificationEmail({
  to,
  name,
  link,
}: {
  to: string;
  name: string;
  link: string;
}) {
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2c3848">
      <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#b8c8d6;margin:0 0 24px">Ruang</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:-0.02em;margin:0 0 12px">Confirm your email</h1>
      <p style="font-size:14px;line-height:1.7;color:#3a4a5c;margin:0 0 24px">
        Hi ${esc(name)} — confirm this address to finish setting up your Ruang.
      </p>
      <a href="${esc(link)}" style="display:inline-block;padding:11px 22px;background:#A1B5D8;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Confirm email →</a>
      <hr style="margin:32px 0;border:none;border-top:1px solid #e8ecf2"/>
      <p style="font-size:11px;line-height:1.6;color:#b8c8d6;margin:0">
        If you didn't create a Ruang account, ignore this message — the account stays
        inactive and cannot be signed into until this link is followed.
      </p>
    </div>
  `;

  return client().emails.send({
    from: from(),
    to,
    subject: 'Confirm your Ruang account',
    html,
  });
}

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
  // Built from the app's own base URL and a uuid, so the href is ours; the id
  // is still encoded rather than trusted to be clean.
  const noteLink = noteId
    ? `${process.env.NEXTAUTH_URL}/note/${encodeURIComponent(noteId)}`
    : null;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2c3848">
      <p style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#b8c8d6;margin:0 0 24px">Ruang Reminder</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:-0.02em;margin:0 0 8px">${esc(reminderTitle)}</h1>
      <p style="font-size:13px;color:#738290;margin:0 0 24px">${esc(when)}</p>
      ${noteTitle ? `<p style="font-size:13px;color:#2c3848;margin:0 0 8px">From note: <strong>${esc(noteTitle)}</strong></p>` : ''}
      ${noteLink ? `<a href="${esc(noteLink)}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#A1B5D8;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Open note →</a>` : ''}
      <hr style="margin:32px 0;border:none;border-top:1px solid #e8ecf2"/>
      <p style="font-size:11px;color:#b8c8d6;margin:0">You're receiving this because you set a reminder in Ruang.</p>
    </div>
  `;

  return client().emails.send({
    from: from(),
    to,
    // Header injection guard: a newline in the title would otherwise split the
    // Subject header and let the caller append arbitrary headers.
    subject: `Reminder: ${reminderTitle.replace(/[\r\n]+/g, ' ').slice(0, 160)}`,
    html,
  });
}
