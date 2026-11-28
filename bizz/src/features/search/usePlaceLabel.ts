import { useCity, useMyProfile } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { usePlaceStore } from '@/store/place';

/** Short name of the current place ("Ma position", "Lyon"...) and of the profile city. */
export function usePlaceLabel(): { label: string; profileCityName: string | null } {
  const place = usePlaceStore((s) => s.place);
  const profile = useMyProfile().data;
  const profileCity = useCity(profile?.city_id).data;
  const profileCityName = profileCity?.name ?? null;
  const label = place.mode === 'gps' ? fr.place.gpsActive : place.mode === 'city' ? place.city.name : (profileCityName ?? fr.place.profileCityUnknown);
  return { label, profileCityName };
}
