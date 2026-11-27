import { fr } from '@/i18n/fr';

type KnownCode = keyof typeof fr.errors;

/** Maps a server error (Postgres RAISE message or supabase-js error) to a French message. */
export function toUserMessage(error: unknown): string {
  const message =
    typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  const code = (Object.keys(fr.errors) as KnownCode[]).find((k) => message.includes(k));
  if (code) return fr.errors[code];
  if (/network|fetch/i.test(message)) return fr.errors.network;
  return fr.errors.generic;
}
