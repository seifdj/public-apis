import { MapPin } from 'lucide-react-native';
import { useState } from 'react';

import { PlaceSheet } from '@/features/search/PlaceSheet';
import { usePlaceLabel } from '@/features/search/usePlaceLabel';
import { fr } from '@/i18n/fr';
import { usePlaceStore } from '@/store/place';
import { colors } from '@/theme/theme';
import { Chip } from '@/ui';

/** "Lyon · 30 km" chip that opens the place sheet. */
export function PlaceChip({ selected = false }: { selected?: boolean }) {
  const [open, setOpen] = useState(false);
  const radiusKm = usePlaceStore((s) => s.radiusKm);
  const { label } = usePlaceLabel();
  return (
    <>
      <Chip label={fr.place.chip(label, radiusKm)} selected={selected} icon={<MapPin color={selected ? colors.textOnPrimary : colors.primary} size={14} />} onPress={() => setOpen(true)} testID="place-chip" />
      <PlaceSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
