import { create } from 'zustand';

import type { CityLite } from '@/features/account/api';
import type { Coords } from '@/lib/geo';

/** Where "near me" is measured from. `profile` = the city of my profile (server default). */
export type Place = { mode: 'profile' } | { mode: 'gps'; coords: Coords } | { mode: 'city'; city: CityLite };

export const RADIUS_CHOICES = [5, 10, 30, 50, 100] as const;

interface PlaceState {
  place: Place;
  radiusKm: number;
  /** The GPS permission was already asked in this session (so we do not nag). */
  gpsAsked: boolean;
  setPlace: (place: Place) => void;
  setRadiusKm: (radiusKm: number) => void;
  markGpsAsked: () => void;
}

export const usePlaceStore = create<PlaceState>((set) => ({
  place: { mode: 'profile' },
  radiusKm: 30,
  gpsAsked: false,
  setPlace: (place) => set({ place }),
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  markGpsAsked: () => set({ gpsAsked: true }),
}));

/** Parameters understood by feed(), search_posts() and find_shops(). */
export function placeParams(place: Place): { p_lat?: number; p_lng?: number; p_city_id?: number } {
  if (place.mode === 'gps') return { p_lat: place.coords.lat, p_lng: place.coords.lng };
  if (place.mode === 'city') return { p_city_id: place.city.id };
  return {};
}

/** Stable cache key for a place (GPS rounded to ~100 m so tiny moves do not refetch). */
export function placeKey(place: Place): string {
  if (place.mode === 'gps') return `gps:${place.coords.lat.toFixed(3)},${place.coords.lng.toFixed(3)}`;
  if (place.mode === 'city') return `city:${place.city.id}`;
  return 'profile';
}
