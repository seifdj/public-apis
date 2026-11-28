import { fr } from '@/i18n/fr';

type KnownCode = keyof typeof fr.errors;
const known = Object.keys(fr.errors) as KnownCode[];

/**
 * Maps a server error to a French message. Handles Postgres RAISE messages
 * (QUOTA_EXCEEDED...), Supabase Auth error codes (otp_expired...) and network failures.
 */
export function toUserMessage(error: unknown): string {
  if (!error) return fr.errors.generic;
  const obj = typeof error === 'object' ? (error as { message?: unknown; code?: unknown; name?: unknown }) : {};
  const message = typeof error === 'string' ? error : typeof obj.message === 'string' ? obj.message : '';
  const code = typeof obj.code === 'string' ? obj.code : '';

  if (code && (known as string[]).includes(code)) return fr.errors[code as KnownCode];
  const byMessage = known.find((k) => k === k.toUpperCase() && message.includes(k));
  if (byMessage) return fr.errors[byMessage];
  if (/unsupported provider|provider is not enabled/i.test(message)) return fr.errors.provider_disabled;
  if (/unsupported phone provider|phone.*disabled/i.test(message)) return fr.errors.phone_provider_disabled;
  if (/token has expired or is invalid/i.test(message)) return fr.errors.otp_expired;
  if (/network request failed|failed to fetch|fetch failed|timeout/i.test(message) || obj.name === 'AuthRetryableFetchError') return fr.errors.network;
  return fr.errors.generic;
}
