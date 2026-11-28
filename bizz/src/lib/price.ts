/** Price typed by a seller -> cents. Pure helpers shared by the form and its tests. */

export const MAX_PRICE_CENTS = 100_000_000; // 1 000 000 €

/** "35", "35,5", "35.50 €", "1 200" -> cents. Returns null when empty or not a valid amount. */
export function parsePriceInput(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

/** Keeps only what can be part of a price while typing: digits and one decimal separator with 2 decimals. */
export function sanitizePriceInput(input: string): string {
  const cleaned = input.replace(/[^\d.,]/g, '').replace('.', ',');
  const [int = '', ...rest] = cleaned.split(',');
  const decimals = rest.join('').slice(0, 2);
  return cleaned.includes(',') ? `${int.slice(0, 7)},${decimals}` : int.slice(0, 7);
}

/** 3500 -> "35", 3550 -> "35,50" (value shown in the edit form). */
export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
}
