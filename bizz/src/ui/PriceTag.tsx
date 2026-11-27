import { fr } from '@/i18n/fr';
import { Text, type TextProps } from '@/ui/Text';

export interface PriceTagProps extends Omit<TextProps, 'children'> {
  priceCents: number | null;
  mode?: 'fixed' | 'on_quote';
}

const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatPrice(priceCents: number | null, mode: 'fixed' | 'on_quote' = 'fixed'): string {
  if (mode === 'on_quote' || priceCents === null) return fr.price.onQuote;
  if (priceCents === 0) return fr.price.free;
  return formatter.format(priceCents / 100);
}

/** Price in accent orange (text variant, 4.5:1 on white). */
export function PriceTag({ priceCents, mode = 'fixed', ...rest }: PriceTagProps) {
  return (
    <Text variant="price" tone="accent" {...rest}>
      {formatPrice(priceCents, mode)}
    </Text>
  );
}
