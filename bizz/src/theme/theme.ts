/**
 * Design tokens. Every colour, font, radius, shadow and spacing used in the app
 * comes from here. See docs/SPEC.md §6 for the reference values.
 */
import { Platform } from 'react-native';

export const colors = {
  primary: '#163E6F',
  primaryPressed: '#102E53',
  primarySoft: 'rgba(22, 62, 111, 0.08)',
  accent: '#EF8412',
  accentText: '#D9700A', // orange used as text on white (contrast 4.5:1)
  accentSoft: 'rgba(239, 132, 18, 0.12)',
  text: '#15122B',
  textSecondary: '#55516E',
  textOnPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  border: 'rgba(21, 18, 43, 0.08)',
  danger: '#B42318',
  dangerSoft: 'rgba(180, 35, 24, 0.10)',
  success: '#1B7F4A',
  successSoft: 'rgba(27, 127, 74, 0.12)',
  warning: '#9A6700',
  warningSoft: 'rgba(239, 132, 18, 0.16)',
  muted: '#8B889B',
  mutedSoft: 'rgba(21, 18, 43, 0.05)',
  // halos drawn behind every screen
  haloPrimary: 'rgba(22, 62, 111, 0.20)',
  haloAccent: 'rgba(239, 132, 18, 0.20)',
  // glass
  glass: 'rgba(255, 255, 255, 0.70)',
  glassOpaque: 'rgba(255, 255, 255, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.90)',
  glassStroke: 'rgba(22, 62, 111, 0.06)',
} as const;

export const fonts = {
  title: 'Montserrat_700Bold',
  titleStrong: 'Montserrat_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyExtrabold: 'Inter_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fonts.titleStrong, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.titleStrong, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.title, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.title, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  price: { fontFamily: fonts.bodyExtrabold, fontSize: 18, lineHeight: 24 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const sizes = {
  touchMin: 44,
  tabBarHeight: 64,
  tabBarBottomGap: 12,
  plusButton: 56,
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 80,
} as const;

export const shadows = {
  glass: Platform.select({
    ios: { shadowColor: colors.primary, shadowOpacity: 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 3, shadowColor: colors.primary },
    default: {},
  })!,
  floating: Platform.select({
    ios: { shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 8, shadowColor: colors.primary },
    default: {},
  })!,
  button: Platform.select({
    ios: { shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4, shadowColor: colors.primary },
    default: {},
  })!,
} as const;

export const blur = {
  intensity: 40,
  tint: 'light' as const,
};

export const theme = { colors, fonts, typography, spacing, radius, sizes, shadows, blur } as const;
export type Theme = typeof theme;
