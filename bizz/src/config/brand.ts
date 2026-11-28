/**
 * Single source of truth for the product name and public URLs.
 * Nothing else in the codebase should hard-code the brand name.
 */
export const APP_NAME = 'Bizz';
export const APP_NAME_PLUS = `${APP_NAME}+`;
export const APP_TAGLINE = 'Ton bizz, ta vitrine.';
/** Lowercase wordmark shown as the logo. */
export const APP_WORDMARK = `${APP_NAME.toLowerCase()}.`;

/** Deep-link scheme, must match `expo.scheme` in app.json. */
export const APP_SCHEME = 'bizz';

/** Web domain used for universal links and store redirection (step 8). */
export const APP_DOMAIN = 'getbizz.fr';
export const APP_WEB_URL = `https://${APP_DOMAIN}`;

export const STORE_URLS = {
  ios: 'https://apps.apple.com/fr/app/id0000000000',
  android: 'https://play.google.com/store/apps/details?id=fr.bizz.app',
} as const;

export const SUPPORT_EMAIL = `contact@${APP_DOMAIN}`;
