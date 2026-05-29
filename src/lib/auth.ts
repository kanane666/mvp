/**
 * auth.ts — Authentification réelle (email + magic link)
 * et gestion des rôles utilisateur.
 *
 * Rôles :
 * - 'coach'      : utilisateur standard, gère ses équipes en local/cloud
 * - 'coach_pro'  : club licencié, peut publier des matchs D1/D2 dans les classements
 * - 'admin'      : accès panel admin complet
 */

import { supabase } from './supabase';

export type UserRole = 'coach' | 'coach_pro' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  clubName?: string;
  createdAt: string;
}

// ─── Cache local du profil ────────────────────────────────────────────────────
let _currentUser: AppUser | null = null;
const _listeners = new Set<(u: AppUser | null) => void>();

export function getCurrentUser(): AppUser | null { return _currentUser; }

export function onAuthChange(fn: (u: AppUser | null) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function setUser(u: AppUser | null) {
  _currentUser = u;
  _listeners.forEach(fn => fn(u));
}

// ─── Initialisation (appelé au démarrage dans main.tsx) ───────────────────────
export async function initAuth(): Promise<AppUser | null> {
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) { setUser(null); return null; }

  const profile = await fetchProfile(session.user.id);
  setUser(profile);

  // Écouter les changements de session
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const profile = await fetchProfile(session.user.id);
      setUser(profile);
    } else if (event === 'SIGNED_OUT') {
      setUser(null);
    }
  });

  return profile;
}

async function fetchProfile(userId: string): Promise<AppUser | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Profil pas encore créé → créer avec rôle coach par défaut
      const { data: { user } } = await supabase.auth.getUser();
      return await createProfile(userId, user?.email || '');
    }

    return {
      id: data.id,
      email: data.email || '',
      role: (data.role as UserRole) || 'coach',
      displayName: data.display_name,
      clubName: data.club_name,
      createdAt: data.created_at,
    };
  } catch { return null; }
}

async function createProfile(userId: string, email: string): Promise<AppUser | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      role: 'coach',
      created_at: new Date().toISOString(),
    }).select().single();

    if (error || !data) return null;
    return { id: data.id, email: data.email, role: 'coach', createdAt: data.created_at };
  } catch { return null; }
}

// ─── Actions d'auth ───────────────────────────────────────────────────────────

/** Envoie un magic link à l'email */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré.' };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Connexion email + mot de passe */
export async function signInWithPassword(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré.' };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Inscription email + mot de passe */
export async function signUpWithPassword(email: string, password: string, displayName?: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré.' };
  try {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Déconnexion */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  setUser(null);
}

/** Mettre à jour le profil */
export async function updateProfile(updates: Partial<Pick<AppUser, 'displayName' | 'clubName'>>): Promise<boolean> {
  if (!supabase || !_currentUser) return false;
  try {
    const { error } = await supabase.from('profiles').update({
      display_name: updates.displayName,
      club_name: updates.clubName,
    }).eq('id', _currentUser.id);
    if (error) return false;
    setUser({ ..._currentUser, ...updates });
    return true;
  } catch { return false; }
}

// ─── Demande de passage coach_pro ────────────────────────────────────────────

export async function requestCoachPro(reason: string, clubName: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !_currentUser) return { ok: false, error: 'Non connecté.' };
  try {
    const { error } = await supabase.from('upgrade_requests').insert({
      user_id: _currentUser.id,
      email: _currentUser.email,
      display_name: _currentUser.displayName || '',
      club_name: clubName,
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    // Mettre à jour le club name dans le profil
    if (clubName) await updateProfile({ clubName });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Guards de rôle ───────────────────────────────────────────────────────────
export function isAdmin(): boolean { return _currentUser?.role === 'admin'; }
export function isCoachPro(): boolean {
  return _currentUser?.role === 'coach_pro' || _currentUser?.role === 'admin';
}
export function isAuthenticated(): boolean { return _currentUser !== null; }
