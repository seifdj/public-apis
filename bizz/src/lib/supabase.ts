import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env, isSupabaseConfigured } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Supabase client. Session persisted in AsyncStorage (SecureStore has a 2 KB
 * limit, too small for a JWT pair). Auth refresh only runs while the app is
 * in the foreground, as recommended by Supabase for React Native.
 */
export const supabase = createClient<Database>(
  isSupabaseConfigured ? env.supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? env.supabaseAnonKey : 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
