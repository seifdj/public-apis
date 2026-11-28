import * as Location from 'expo-location';

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Asks for the "while using the app" permission (system dialog the first time) and returns the
 * current position, or null when the user refuses or the position cannot be read.
 */
export async function requestPosition(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
    const position = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}
