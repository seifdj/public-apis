/** Public environment, read from EXPO_PUBLIC_* at build time. */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appEnv: (process.env.APP_ENV ?? 'development') as 'development' | 'preview' | 'production',
} as const;

export const isSupabaseConfigured = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
