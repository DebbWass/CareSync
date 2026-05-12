import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[CareSync] Missing Supabase environment variables.\n' +
      'Copy apps/mobile/.env.example to apps/mobile/.env.local and fill in your credentials.\n' +
      'Auth and data features will not work until this is configured.'
  );
}

// Singleton Supabase client — all database operations go through this
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // Persist sessions across app restarts using AsyncStorage
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Disable URL-based session detection (not applicable in React Native)
      detectSessionInUrl: false,
    },
  }
);
