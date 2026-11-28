/** French mobile numbers only (06 / 07), the launch market. Pure helpers, no dependency. */

export interface ParsedPhone {
  /** E.164, e.g. +33612345678. Empty string when the input is not a valid French mobile. */
  e164: string;
  valid: boolean;
}

/** Accepts "06 12 34 56 78", "0612345678", "+33 6 12 34 56 78", "0033612345678", "33612345678". */
export function parseFrenchMobile(input: string): ParsedPhone {
  const digits = input.replace(/[^\d+]/g, '');
  let national = '';
  if (digits.startsWith('+33')) national = digits.slice(3);
  else if (digits.startsWith('0033')) national = digits.slice(4);
  else if (digits.startsWith('33') && digits.length === 11) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;
  national = national.replace(/^0/, '');
  const valid = /^[67]\d{8}$/.test(national);
  return { e164: valid ? `+33${national}` : '', valid };
}

/** "0612345678" typed progressively -> "06 12 34 56 78". Keeps a leading "+33" form readable too. */
export function formatFrenchMobileInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) {
    const d = trimmed.replace(/\D/g, '').slice(0, 11);
    const cc = d.slice(0, 2);
    const first = d.slice(2, 3);
    const rest = d.slice(3).match(/.{1,2}/g) ?? [];
    return ['+' + cc, first, ...rest].filter(Boolean).join(' ');
  }
  const d = trimmed.replace(/\D/g, '').slice(0, 10);
  return (d.match(/.{1,2}/g) ?? []).join(' ');
}

/** +33612345678 -> "06 12 34 56 78" for display. */
export function formatE164ForDisplay(e164: string): string {
  if (!/^\+33\d{9}$/.test(e164)) return e164;
  return formatFrenchMobileInput('0' + e164.slice(3));
}

/** +33612345678 -> "06 •• •• •• 78". */
export function maskE164(e164: string): string {
  if (!/^\+33\d{9}$/.test(e164)) return e164;
  return `0${e164[3]} •• •• •• ${e164.slice(-2)}`;
}
