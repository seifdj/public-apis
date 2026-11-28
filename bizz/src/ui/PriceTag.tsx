import { fr } from '@/i18n/fr';
import { Text, type TextProps } from '@/ui/Text';

export interface PriceTagProps extends Omit<TextProps, 'children'> {
  priceCents: number | null;
  mode?: 'fixed' | 'on_quote';
}

const whole = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 3500 -> "35 €", 3990 -> "39,90 €" (never "39,9 €"). */
export function formatPrice(priceCents: number | null, mode: 'fixed' | 'on_quote' = 'fixed'): string {
  if (mode === 'on_quote' || priceCents === null) return fr.price.onQuote;
  if (priceCents === 0) return fr.price.free;
  return (priceCents % 100 === 0 ? whole : withCents).format(priceCents / 100);
}

/** Price in accent orange (text variant, 4.5:1 on white). */
export function PriceTag({ priceCents, mode = 'fixed', ...rest }: PriceTagProps) {
  return (
    <Text variant="price" tone="accent" {...rest}>
      {formatPrice(priceCents, mode)}
    </Text>
  );
}
