import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill in your project credentials.'
  );
}

// Singleton Supabase client — all database operations go through this
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist sessions across app restarts using AsyncStorage
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Disable URL-based session detection (not applicable in React Native)
    detectSessionInUrl: false,
  },
});
