import { CircleCheck, LocateFixed, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CityPicker } from '@/features/account/CityPicker';
import { usePlaceLabel } from '@/features/search/usePlaceLabel';
import { fr } from '@/i18n/fr';
import { requestPosition } from '@/lib/geo';
import { RADIUS_CHOICES, usePlaceStore } from '@/store/place';
import { colors, spacing } from '@/theme/theme';
import { Chip, ListRow, PillButton, Sheet, Text } from '@/ui';

/** Sheet to choose where "near me" is: my GPS position, my profile city or another city, and the radius. */
export function PlaceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { place, radiusKm, setPlace, setRadiusKm, markGpsAsked } = usePlaceStore();
  const { profileCityName } = usePlaceLabel();
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  const useGps = async () => {
    setLocating(true);
    setGpsError(false);
    const coords = await requestPosition();
    markGpsAsked();
    setLocating(false);
    if (coords) setPlace({ mode: 'gps', coords });
    else setGpsError(true);
  };

  const check = <CircleCheck color={colors.primary} size={20} />;
  return (
    <Sheet visible={visible} onClose={onClose} title={fr.place.title}>
      <ListRow
        first
        icon={<LocateFixed color={colors.primary} size={20} />}
        label={fr.place.gps}
        onPress={useGps}
        right={locating ? <ActivityIndicator color={colors.primary} /> : place.mode === 'gps' ? check : undefined}
      />
      {gpsError ? (
        <Text variant="caption" tone="danger" style={styles.error}>
          {fr.place.gpsDenied}
        </Text>
      ) : null}
      <ListRow
        icon={<MapPin color={colors.primary} size={20} />}
        label={profileCityName ? fr.place.profileCity(profileCityName) : fr.place.profileCityUnknown}
        onPress={() => setPlace({ mode: 'profile' })}
        right={place.mode === 'profile' ? check : <View />}
      />
      <View style={styles.block}>
        <CityPicker label={fr.place.otherCity} value={place.mode === 'city' ? place.city : null} onChange={(city) => setPlace({ mode: 'city', city })} />
      </View>

      <Text variant="label" tone="secondary" style={styles.block}>
        {fr.place.radius.toUpperCase()}
      </Text>
      <View style={styles.chips}>
        {RADIUS_CHOICES.map((km) => (
          <Chip key={km} label={fr.place.km(km)} selected={radiusKm === km} onPress={() => setRadiusKm(km)} testID={`radius-${km}`} />
        ))}
      </View>
      <PillButton label={fr.place.done} size="lg" fullWidth onPress={onClose} style={styles.block} testID="place-done" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  error: { marginBottom: spacing.sm },
});
