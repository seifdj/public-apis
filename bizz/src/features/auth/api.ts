import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** `link` = an already signed-in account (Apple / Google) adds and verifies its phone number. */
export type PhoneFlow = 'signin' | 'link';

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error('notConfigured');
}

export async function sendPhoneCode(phoneE164: string, flow: PhoneFlow): Promise<void> {
  assertConfigured();
  if (flow === 'link') {
    const { error } = await supabase.auth.updateUser({ phone: phoneE164 });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164, options: { channel: 'sms' } });
  if (error) throw error;
}

export async function verifyPhoneCode(phoneE164: string, token: string, flow: PhoneFlow): Promise<void> {
  assertConfigured();
  const { error } = await supabase.auth.verifyOtp({ phone: phoneE164, token, type: flow === 'link' ? 'phone_change' : 'sms' });
  if (error) throw error;
  // The JWT carries `phone_verified`: refresh so the new claim is available at once.
  if (flow === 'link') await supabase.auth.refreshSession();
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Returns false when the user closed the Apple sheet. */
export async function signInWithApple(): Promise<boolean> {
  assertConfigured();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw error;
    return true;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: unknown }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
}

/** OAuth in the system browser (PKCE). Returns false when the user closed the browser. */
export async function signInWithGoogle(): Promise<boolean> {
  assertConfigured();
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) {
    const description = typeof queryParams?.error_description === 'string' ? queryParams.error_description : 'OAuth callback without code';
    throw new Error(description);
  }
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
