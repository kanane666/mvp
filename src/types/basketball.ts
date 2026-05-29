export type Category = 'Minimes' | 'Cadets' | 'Juniors' | 'Seniors';
export type Gender = 'Masculin' | 'Féminin';
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type StrongHand = 'Droite' | 'Gauche' | 'Les deux';
export type MatchType = 'training' | 'official' | 'mixed';
export type MatchCategory = 'official' | 'friendly' | 'training' | 'internal' | 'mixed';
export type Division = 'N1' | 'N2' | 'regional' | null;

export const MATCH_CATEGORY_LABELS: Record<MatchCategory, string> = {
  official: 'Officiel',
  friendly: 'Amical',
  training: 'Entraînement',
  internal: 'Interne',
  mixed: 'Mixte',
};

export const DIVISION_LABELS: Record<NonNullable<Division>, string> = {
  N1: 'Nationale 1',
  N2: 'Nationale 2',
  regional: 'Régionale',
};

// Saison courante — format "2024-2025"
export function currentSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  // Le championnat sénégalais commence en janvier — saison = année précédente/année
  const start = now.getMonth() >= 9 ? y : y - 1; // >oct = nouvelle saison
  return `${start}-${start + 1}`;
}

const SCORE_EVENTS: ReadonlySet<string> = new Set(['2pt_made', '3pt_made', 'ft_made']);
export function isScoreEvent(type: string): boolean {
  return SCORE_EVENTS.has(type);
}

export type EventType =
  | '2pt_made' | '2pt_missed'
  | '3pt_made' | '3pt_missed'
  | 'ft_made' | 'ft_missed'
  | 'assist'
  | 'off_rebound' | 'def_rebound'
  | 'block'
  | 'turnover'
  | 'steal'
  | 'foul_committed' | 'foul_drawn'
  | 'timeout'
  | 'sub_in' | 'sub_out';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  age?: number;
  height?: number;
  weight?: number;
  position?: Position;
  strongHand?: StrongHand;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  category: Category;
  gender: Gender;
  players: Player[];
  createdAt: number;
}

export interface MatchEvent {
  id: string;
  playerId: string;
  teamId: string;
  type: EventType;
  quarter: number;
  timestamp: number;
}

export interface Match {
  id: string;
  mode: 'quick' | 'assistant';
  matchType?: MatchType;
  matchCategory?: MatchCategory;
  teamAName: string;
  teamBName: string;
  teamAId?: string;
  teamBId?: string;
  playersA: string[];
  playersB: string[];
  events: MatchEvent[];
  quarter: number;
  timerSeconds: number;
  timerRunning: boolean;
  // ── drift-free timer ──
  timerStartedAt?: number;   // Date.now() when timer last started
  timerSecondsAtStart?: number; // timerSeconds value when timer last started
  shotClockSeconds: number;
  shotClockRunning: boolean;
  shotClockStartedAt?: number;
  shotClockSecondsAtStart?: number;
  timeoutsA: number;
  timeoutsB: number;
  status: 'setup' | 'live' | 'finished';
  createdAt: number;
  // active players on court (subset of playersA/playersB)
  activePlayersA?: string[];
  activePlayersB?: string[];
  soundEnabled?: boolean;
  // ── Champs championnat / partage ──
  division?: Division;
  poule?: string;           // ex: "Poule A", "Poule B", "Poule Nord"
  season?: string;          // ex: "2024-2025"
  shareToken?: string;      // token unique pour le lien public
  isPublic?: boolean;       // true = visible dans les classements publics
  clubName?: string;        // nom du club (affiché publiquement)
}

// Computed stats
export interface PlayerStats {
  points: number;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
  assists: number;
  offRebounds: number;
  defRebounds: number;
  rebounds: number;
  blocks: number;
  steals: number;
  turnovers: number;
  foulsCommitted: number;
  foulsDrawn: number;
  minutesPlayed?: number;
}

export const EVENT_LABELS: Record<EventType, string> = {
  '2pt_made': '+2 pts',
  '2pt_missed': '2pts raté',
  '3pt_made': '+3 pts',
  '3pt_missed': '3pts raté',
  'ft_made': '+1 LF',
  'ft_missed': 'LF raté',
  'assist': 'Passe déc.',
  'off_rebound': 'Reb. off',
  'def_rebound': 'Reb. déf',
  'block': 'Contre',
  'turnover': 'Perte',
  'steal': 'Interc.',
  'foul_committed': 'Faute',
  'foul_drawn': 'Faute provoquée',
  'timeout': 'Temps mort',
  'sub_in': 'Entrée',
  'sub_out': 'Sortie',
};

export interface TrainingSession {
  id: string;
  teamId: string;
  date: number;
  notes?: string;
  createdAt: number;
}

export interface AttendanceRecord {
  sessionId: string;
  playerId: string;
  status: 'present' | 'absent';
}

export interface EvaluationRecord {
  sessionId: string;
  playerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export function computePlayerStats(events: MatchEvent[], playerId: string): PlayerStats {
  const pe = events.filter(e => e.playerId === playerId);
  const fg2Made = pe.filter(e => e.type === '2pt_made').length;
  const fg2Missed = pe.filter(e => e.type === '2pt_missed').length;
  const fg3Made = pe.filter(e => e.type === '3pt_made').length;
  const fg3Missed = pe.filter(e => e.type === '3pt_missed').length;
  const ftMade = pe.filter(e => e.type === 'ft_made').length;
  const ftMissed = pe.filter(e => e.type === 'ft_missed').length;

  // Compute minutes from sub_in / sub_out pairs
  let minutesPlayed = 0;
  let subInTime: number | null = null;
  for (const e of pe) {
    if (e.type === 'sub_in') subInTime = e.timestamp;
    if (e.type === 'sub_out' && subInTime !== null) {
      minutesPlayed += (e.timestamp - subInTime) / 60000;
      subInTime = null;
    }
  }

  return {
    points: fg2Made * 2 + fg3Made * 3 + ftMade,
    fgMade: fg2Made + fg3Made,
    fgAttempted: fg2Made + fg2Missed + fg3Made + fg3Missed,
    fg3Made,
    fg3Attempted: fg3Made + fg3Missed,
    ftMade,
    ftAttempted: ftMade + ftMissed,
    assists: pe.filter(e => e.type === 'assist').length,
    offRebounds: pe.filter(e => e.type === 'off_rebound').length,
    defRebounds: pe.filter(e => e.type === 'def_rebound').length,
    rebounds: pe.filter(e => e.type === 'off_rebound' || e.type === 'def_rebound').length,
    blocks: pe.filter(e => e.type === 'block').length,
    steals: pe.filter(e => e.type === 'steal').length,
    turnovers: pe.filter(e => e.type === 'turnover').length,
    foulsCommitted: pe.filter(e => e.type === 'foul_committed').length,
    foulsDrawn: pe.filter(e => e.type === 'foul_drawn').length,
    minutesPlayed: minutesPlayed > 0 ? minutesPlayed : undefined,
  };
}

export function getTeamScore(events: MatchEvent[], teamId: string): number {
  return events
    .filter(e => e.teamId === teamId)
    .reduce((s, e) => {
      if (e.type === '2pt_made') return s + 2;
      if (e.type === '3pt_made') return s + 3;
      if (e.type === 'ft_made') return s + 1;
      return s;
    }, 0);
}

export function getTeamFouls(events: MatchEvent[], teamId: string, quarter?: number): number {
  return events.filter(e =>
    e.teamId === teamId &&
    e.type === 'foul_committed' &&
    (quarter === undefined || e.quarter === quarter)
  ).length;
}

/** Returns true if team is in bonus (5+ fouls in the quarter) */
export function isTeamInBonus(events: MatchEvent[], teamId: string, quarter: number): boolean {
  return getTeamFouls(events, teamId, quarter) >= 5;
}
