import { createHmac } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars

function otpSecret(): string {
  const s = process.env.OTP_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('OTP_SECRET (or NEXTAUTH_SECRET) is not set');
  return s;
}

/** Ten-minute window bucket so codes are valid for up to 20 minutes. */
export function currentWindow(): number {
  return Math.floor(Date.now() / (10 * 60 * 1000));
}

/** Deterministic 6-char code derived from the email + window. No storage needed. */
export function deriveCode(email: string, window: number): string {
  const mac = createHmac('sha256', otpSecret())
    .update(`${email.toLowerCase()}:${window}`)
    .digest('hex');
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[parseInt(mac.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  }
  return code;
}
