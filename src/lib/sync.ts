/**
 * sync.ts — Couche de synchronisation offline-first
 *
 * Architecture :
 * 1. Toutes les ÉCRITURES vont d'abord dans localStorage (instantané)
 * 2. En background, elles sont envoyées à Supabase
 * 3. Toutes les LECTURES viennent de localStorage (pas de latence)
 * 4. Au démarrage de l'app, on recharge depuis Supabase si dispo
 *
 * Si Supabase n'est pas configuré ou hors-ligne → l'app fonctionne
 * exactement comme avant, 100% en local.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { Team, Match, TrainingSession, AttendanceRecord, EvaluationRecord } from '@/types/basketball';

// ─── État de sync ─────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const listeners = new Set<(s: SyncStatus) => void>();
let currentStatus: SyncStatus = isSupabaseConfigured ? 'idle' : 'offline';

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(s: SyncStatus) {
  currentStatus = s;
  listeners.forEach(fn => fn(s));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getOrCreateUserId(): Promise<string | null> {
  if (!supabase) return null;
  // On utilise l'auth anonyme Supabase (pas de compte requis)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  // Créer une session anonyme (Supabase Anonymous Auth)
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) return null;
  return data.user.id;
}

// ─── Push vers Supabase ───────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? await getOrCreateUserId();
}

export async function pushTeams(teams: Team[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  try {
    setStatus('syncing');
    // upsert = insert or update based on id
    const rows = teams.map(t => ({ ...t, user_id: userId }));
    const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    // Supprimer les équipes qui ne sont plus dans la liste locale
    const ids = teams.map(t => t.id);
    if (ids.length > 0) {
      await supabase.from('teams')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);
    }
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

export async function pushMatches(matches: Match[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  try {
    setStatus('syncing');
    const rows = matches.map(m => ({ ...m, user_id: userId }));
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'id' });
    if (error) { console.warn('Push matches error:', error.message); throw error; }
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

export async function pushSessions(sessions: TrainingSession[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  try {
    setStatus('syncing');
    const rows = sessions.map(s => ({ ...s, user_id: userId }));
    const { error } = await supabase.from('training_sessions').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

export async function pushAttendance(records: AttendanceRecord[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  try {
    setStatus('syncing');
    const rows = records.map(r => ({ ...r, user_id: userId }));
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,player_id' });
    if (error) throw error;
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

export async function pushEvaluations(records: EvaluationRecord[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  try {
    setStatus('syncing');
    const rows = records.map(r => ({ ...r, user_id: userId }));
    const { error } = await supabase.from('evaluations').upsert(rows, { onConflict: 'session_id,player_id' });
    if (error) throw error;
    setStatus('synced');
  } catch {
    setStatus('error');
  }
}

// ─── Pull depuis Supabase (au démarrage) ──────────────────────────────────────

export async function pullAllFromCloud(): Promise<{
  teams?: Team[];
  matches?: Match[];
  sessions?: TrainingSession[];
  attendance?: AttendanceRecord[];
  evaluations?: EvaluationRecord[];
} | null> {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  try {
    setStatus('syncing');

    const [
      { data: teams, error: e1 },
      { data: matches, error: e2 },
      { data: sessions, error: e3 },
      { data: attendance, error: e4 },
      { data: evaluations, error: e5 },
    ] = await Promise.all([
      supabase.from('teams').select('*').eq('user_id', userId),
      supabase.from('matches').select('*').eq('user_id', userId),
      supabase.from('training_sessions').select('*').eq('user_id', userId),
      supabase.from('attendance').select('*').eq('user_id', userId),
      supabase.from('evaluations').select('*').eq('user_id', userId),
    ]);

    if (e1 || e2 || e3 || e4 || e5) {
      setStatus('error');
      return null;
    }

    setStatus('synced');

    // Nettoyer la colonne user_id avant de retourner
    const clean = <T extends { user_id?: string }>(arr: T[] | null): Omit<T, 'user_id'>[] =>
      (arr || []).map(({ user_id: _, ...rest }) => rest as Omit<T, 'user_id'>);

    return {
      teams: clean(teams) as Team[],
      matches: clean(matches) as Match[],
      sessions: clean(sessions) as TrainingSession[],
      attendance: clean(attendance) as AttendanceRecord[],
      evaluations: clean(evaluations) as EvaluationRecord[],
    };
  } catch {
    setStatus('error');
    return null;
  }
}

// ─── Sync initiale au démarrage ───────────────────────────────────────────────

/**
 * À appeler une fois au montage de l'app.
 * Si Supabase a des données plus récentes, elles écrasent le localStorage.
 * Si localStorage a des données que Supabase n'a pas, on les push.
 */
export async function initSync(
  localData: {
    teams: Team[];
    matches: Match[];
    sessions: TrainingSession[];
    attendance: AttendanceRecord[];
    evaluations: EvaluationRecord[];
  },
  onCloudData: (data: NonNullable<Awaited<ReturnType<typeof pullAllFromCloud>>>) => void
): Promise<void> {
  if (!isSupabaseConfigured) {
    setStatus('offline');
    return;
  }

  // Initialiser l'auth silencieusement
  await getOrCreateUserId();

  // Tirer les données cloud
  const cloudData = await pullAllFromCloud();
  if (!cloudData) {
    // Pas de données cloud → push ce qu'on a en local
    await Promise.all([
      localData.teams.length > 0 ? pushTeams(localData.teams) : Promise.resolve(),
      localData.matches.length > 0 ? pushMatches(localData.matches) : Promise.resolve(),
      localData.sessions.length > 0 ? pushSessions(localData.sessions) : Promise.resolve(),
    ]);
    return;
  }

  // Fusionner : garder le plus récent entre local et cloud
  // Stratégie simple : si cloud a plus de données → prendre cloud
  // Si local a plus de données → push local vers cloud
  const merged = {
    teams: mergeById(localData.teams, cloudData.teams ?? []),
    matches: mergeByIdWithTimestamp(localData.matches, cloudData.matches ?? []),
    sessions: mergeById(localData.sessions, cloudData.sessions ?? []),
    attendance: cloudData.attendance ?? localData.attendance,
    evaluations: cloudData.evaluations ?? localData.evaluations,
  };

  onCloudData(merged);

  // Push les données locales qui manquent dans le cloud
  await Promise.all([
    pushTeams(merged.teams),
    pushMatches(merged.matches),
    pushSessions(merged.sessions),
    pushAttendance(merged.attendance),
    pushEvaluations(merged.evaluations),
  ]);
}

// ─── Helpers de fusion ────────────────────────────────────────────────────────

function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  // Cloud en premier, local écrase (local = plus récent en général)
  cloud.forEach(item => map.set(item.id, item));
  local.forEach(item => map.set(item.id, item));
  return [...map.values()];
}

function mergeByIdWithTimestamp<T extends { id: string; createdAt: number }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  cloud.forEach(item => map.set(item.id, item));
  // Local gagne seulement si même id ET plus récent
  local.forEach(item => {
    const existing = map.get(item.id);
    if (!existing || item.createdAt >= existing.createdAt) {
      map.set(item.id, item);
    }
  });
  return [...map.values()];
}
