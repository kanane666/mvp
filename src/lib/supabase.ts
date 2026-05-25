import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Si les variables ne sont pas définies, on retourne null
// → l'app continue de fonctionner en mode local uniquement
export const supabase = (
  supabaseUrl &&
  supabaseUrl !== 'REMPLACER_PAR_TON_PROJECT_URL' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'REMPLACER_PAR_TON_ANON_PUBLIC_KEY'
)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;

/**
 * Vérifie si Supabase est joignable.
 * Retourne true si la connexion fonctionne.
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('teams').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
