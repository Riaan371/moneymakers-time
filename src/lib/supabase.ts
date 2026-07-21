import { createClient } from '@supabase/supabase-js'

// Placeholders let the app boot (showing the login screen) before .env is set up —
// see SETUP.md for wiring the real Supabase project.
export const supabase = createClient(
  (import.meta.env.VITE_SUPABASE_URL as string) ?? 'https://placeholder.supabase.co',
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? 'sb_publishable_placeholder',
)
