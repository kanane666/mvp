import type { Team, Match, TrainingSession, AttendanceRecord, EvaluationRecord } from '@/types/basketball';

const TEAMS_KEY = 'bball_teams';
const MATCHES_KEY = 'bball_matches';
const SESSIONS_KEY = 'bball_sessions';
const ATTENDANCE_KEY = 'bball_attendance';
const EVALUATIONS_KEY = 'bball_evaluations';

// ─── Teams ────────────────────────────────────────────────────────────────────

export function getTeams(): Team[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(TEAMS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveTeams(teams: Team[]) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export function getMatches(): Match[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(MATCHES_KEY);
  const raw: Match[] = data ? JSON.parse(data) : [];
  return raw.map(m => {
    if (m.matchCategory) return m;
    let matchCategory: Match['matchCategory'];
    if (m.mode === 'quick') matchCategory = 'friendly';
    else if (m.matchType === 'official') matchCategory = 'official';
    else if (m.matchType === 'mixed') matchCategory = 'mixed';
    else if (m.matchType === 'training') matchCategory = 'training';
    else matchCategory = 'friendly';
    return { ...m, matchCategory };
  });
}

export function saveMatches(matches: Match[]) {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
}

export function getMatchById(id: string): Match | undefined {
  return getMatches().find(m => m.id === id);
}

export function updateMatch(match: Match) {
  const matches = getMatches();
  saveMatches(matches.map(m => m.id === match.id ? match : m));
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Training sessions ────────────────────────────────────────────────────────

export function getTrainingSessions(): TrainingSession[] {
  if (typeof window === 'undefined') return [];
  const d = localStorage.getItem(SESSIONS_KEY);
  return d ? JSON.parse(d) : [];
}
export function saveTrainingSessions(s: TrainingSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function getAttendance(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  const d = localStorage.getItem(ATTENDANCE_KEY);
  return d ? JSON.parse(d) : [];
}
export function saveAttendance(a: AttendanceRecord[]) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(a));
}

// ─── Evaluations ─────────────────────────────────────────────────────────────

export function getEvaluations(): EvaluationRecord[] {
  if (typeof window === 'undefined') return [];
  const d = localStorage.getItem(EVALUATIONS_KEY);
  return d ? JSON.parse(d) : [];
}
export function saveEvaluations(e: EvaluationRecord[]) {
  localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(e));
}

// ─── Player training stats ────────────────────────────────────────────────────

export function getPlayerTrainingStats(playerId: string): {
  attendanceRate: number;
  avgRating: number;
  sessionsCount: number;
} {
  const attendance = getAttendance().filter(a => a.playerId === playerId);
  const evals = getEvaluations().filter(e => e.playerId === playerId);
  const totalSessions = new Set(attendance.map(a => a.sessionId)).size;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
  const avgRating = evals.length > 0
    ? evals.reduce((s, e) => s + e.rating, 0) / evals.length
    : 0;
  return { attendanceRate, avgRating, sessionsCount: totalSessions };
}

// ─── Export / Import JSON ─────────────────────────────────────────────────────

export interface BackupData {
  version: 2;
  exportedAt: number;
  teams: Team[];
  matches: Match[];
  sessions: TrainingSession[];
  attendance: AttendanceRecord[];
  evaluations: EvaluationRecord[];
}

export function exportBackup(): string {
  const data: BackupData = {
    version: 2,
    exportedAt: Date.now(),
    teams: getTeams(),
    matches: getMatches(),
    sessions: getTrainingSessions(),
    attendance: getAttendance(),
    evaluations: getEvaluations(),
  };
  return JSON.stringify(data, null, 2);
}

export function downloadBackup() {
  const json = exportBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mvp-basket-sauvegarde-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(json: string): { ok: boolean; error?: string } {
  try {
    const data: BackupData = JSON.parse(json);
    if (!data.version || !data.teams || !data.matches) {
      return { ok: false, error: 'Fichier de sauvegarde invalide.' };
    }
    saveTeams(data.teams);
    saveMatches(data.matches);
    if (data.sessions) saveTrainingSessions(data.sessions);
    if (data.attendance) saveAttendance(data.attendance);
    if (data.evaluations) saveEvaluations(data.evaluations);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Impossible de lire le fichier.' };
  }
}
