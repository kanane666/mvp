/**
 * league.ts — Calculs de classements D2 / D1
 *
 * Toute la logique est côté client, les données viennent de Supabase
 * (matchs publics de tous les clubs) ou du localStorage (matchs locaux).
 *
 * Format championnat sénégalais D2 :
 * - Plusieurs poules de 5-6 équipes, match aller-retour
 * - Classement par points (V=3pts, D=0pt, Forfait=0pt) — format FSBB
 * - Égalité : différentiel de paniers, puis paniers marqués
 * - 1er de chaque poule → Tournoi de montée direct
 * - 2ème → barrages puis tournoi de montée
 */

import { supabase } from './supabase';
import { getMatches } from './storage';
import { getTeamScore } from '@/types/basketball';
import type { Match, Division } from '@/types/basketball';

// ─── Types publics ─────────────────────────────────────────────────────────────

export interface StandingRow {
  teamName: string;
  teamId?: string;
  clubName?: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  leaguePoints: number;    // V=3, D=0, F=0 (format FSBB)
  winPct: number;
}

export interface PouleStandings {
  poule: string;
  rows: StandingRow[];
}

export interface LeagueTopPlayer {
  playerId: string;
  playerName: string;
  teamName: string;
  clubName?: string;
  games: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
}

export interface LeagueData {
  division: Division;
  season: string;
  gender?: string;
  standings: PouleStandings[];
  topScorers: LeagueTopPlayer[];
  topRebounders: LeagueTopPlayer[];
  topAssistants: LeagueTopPlayer[];
  totalMatches: number;
  lastUpdated: number;
}

// ─── Calcul classement depuis une liste de matchs ─────────────────────────────

export function computeStandings(matches: Match[], division: Division, season: string): PouleStandings[] {
  const filtered = matches.filter(m =>
    m.division === division &&
    m.season === season &&
    m.status === 'finished' &&
    m.isPublic !== false
  );

  // Grouper par poule
  const pouleMap = new Map<string, Match[]>();
  for (const m of filtered) {
    const p = m.poule || 'Poule A';
    if (!pouleMap.has(p)) pouleMap.set(p, []);
    pouleMap.get(p)!.push(m);
  }

  const result: PouleStandings[] = [];

  for (const [poule, pouleMatches] of pouleMap.entries()) {
    const teams = new Map<string, StandingRow>();

    const getOrCreate = (teamName: string, teamId?: string, clubName?: string): StandingRow => {
      const key = teamId || teamName;
      if (!teams.has(key)) {
        teams.set(key, {
          teamName, teamId, clubName,
          played: 0, wins: 0, losses: 0,
          pointsFor: 0, pointsAgainst: 0,
          differential: 0, leaguePoints: 0, winPct: 0,
        });
      }
      return teams.get(key)!;
    };

    for (const m of pouleMatches) {
      const idA = m.teamAId || 'A';
      const idB = m.teamBId || 'B';
      const sA = getTeamScore(m.events, idA);
      const sB = getTeamScore(m.events, idB);

      const rowA = getOrCreate(m.teamAName, m.teamAId, m.clubName);
      const rowB = getOrCreate(m.teamBName, m.teamBId);

      rowA.played++; rowA.pointsFor += sA; rowA.pointsAgainst += sB;
      rowB.played++; rowB.pointsFor += sB; rowB.pointsAgainst += sA;

      if (sA > sB) {
        rowA.wins++; rowA.leaguePoints += 2;
        rowB.losses++; rowB.leaguePoints += 1;
      } else if (sB > sA) {
        rowB.wins++; rowB.leaguePoints += 2;
        rowA.losses++; rowA.leaguePoints += 1;
      } else {
        // Match nul (rare en basket) → 1pt chacun
        rowA.leaguePoints += 1; rowB.leaguePoints += 1;
      }
    }

    // Calculer différentiels et %
    const rows = [...teams.values()].map(r => ({
      ...r,
      differential: r.pointsFor - r.pointsAgainst,
      winPct: r.played > 0 ? r.wins / r.played : 0,
    }));

    // Tri : pts ligue DESC → différentiel DESC → paniers marqués DESC
    rows.sort((a, b) =>
      b.leaguePoints - a.leaguePoints ||
      b.differential - a.differential ||
      b.pointsFor - a.pointsFor
    );

    result.push({ poule, rows });
  }

  // Trier les poules alphabétiquement
  result.sort((a, b) => a.poule.localeCompare(b.poule));
  return result;
}

// ─── Top joueurs depuis une liste de matchs ────────────────────────────────────

import { computePlayerStats } from '@/types/basketball';

export function computeTopPlayers(
  matches: Match[],
  division: Division,
  season: string,
  allPlayers: { id: string; firstName: string; lastName: string; teamId: string }[],
  teamNameMap: Map<string, string>,
  limit = 10,
): { scorers: LeagueTopPlayer[]; rebounders: LeagueTopPlayer[]; assistants: LeagueTopPlayer[] } {
  const filtered = matches.filter(m =>
    m.division === division &&
    m.season === season &&
    m.status === 'finished' &&
    m.isPublic !== false
  );

  const playerMap = new Map<string, {
    name: string; teamName: string; clubName?: string;
    pts: number; reb: number; ast: number; stl: number; games: number;
  }>();

  for (const m of filtered) {
    const seenPlayers = new Set<string>();
    for (const ev of m.events) {
      if (!ev.playerId || ev.playerId === 'opponent' || ev.playerId === 'team') continue;
      if (seenPlayers.has(ev.playerId)) continue;

      const player = allPlayers.find(p => p.id === ev.playerId);
      if (!player) continue;
      seenPlayers.add(ev.playerId);

      const stats = computePlayerStats(m.events, ev.playerId);
      const teamName = teamNameMap.get(player.teamId) ||
        (m.playersA.includes(ev.playerId) ? m.teamAName : m.teamBName);

      const cur = playerMap.get(ev.playerId) || {
        name: `${player.firstName} ${player.lastName}`,
        teamName,
        pts: 0, reb: 0, ast: 0, stl: 0, games: 0,
      };
      cur.pts += stats.points;
      cur.reb += stats.rebounds;
      cur.ast += stats.assists;
      cur.stl += stats.steals;
      cur.games++;
      playerMap.set(ev.playerId, cur);
    }
  }

  const toRow = (id: string, v: typeof playerMap extends Map<string, infer V> ? V : never): LeagueTopPlayer => ({
    playerId: id,
    playerName: v.name,
    teamName: v.teamName,
    clubName: v.clubName,
    games: v.games,
    avgPoints: v.games > 0 ? v.pts / v.games : 0,
    avgRebounds: v.games > 0 ? v.reb / v.games : 0,
    avgAssists: v.games > 0 ? v.ast / v.games : 0,
    avgSteals: v.games > 0 ? v.stl / v.games : 0,
  });

  const entries = [...playerMap.entries()].map(([id, v]) => toRow(id, v));

  return {
    scorers:    [...entries].sort((a, b) => b.avgPoints - a.avgPoints).slice(0, limit),
    rebounders: [...entries].sort((a, b) => b.avgRebounds - a.avgRebounds).slice(0, limit),
    assistants: [...entries].sort((a, b) => b.avgAssists - a.avgAssists).slice(0, limit),
  };
}

// ─── Récupérer les matchs publics depuis Supabase ─────────────────────────────

export async function fetchPublicMatches(division: Division, season: string): Promise<Match[]> {
  if (!supabase) {
    // Fallback : matchs locaux publics
    return getMatches().filter(m =>
      m.division === division &&
      m.season === season &&
      m.isPublic !== false &&
      m.status === 'finished'
    );
  }

  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('division', division)
      .eq('season', season)
      .eq('isPublic', true)
      .eq('status', 'finished')
      .order('createdAt', { ascending: false });

    if (error || !data) {
      // Fallback localStorage
      return getMatches().filter(m =>
        m.division === division && m.season === season && m.status === 'finished'
      );
    }

    return data.map(({ user_id: _, ...m }) => m as Match);
  } catch {
    return getMatches().filter(m =>
      m.division === division && m.season === season && m.status === 'finished'
    );
  }
}

// ─── Récupérer un match par shareToken ────────────────────────────────────────

export async function fetchMatchByToken(token: string): Promise<Match | null> {
  if (!supabase) {
    // Fallback localStorage
    return getMatches().find(m => m.shareToken === token) ?? null;
  }

  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('shareToken', token)
      .single();

    if (error || !data) {
      return getMatches().find(m => m.shareToken === token) ?? null;
    }

    const { user_id: _, ...match } = data;
    return match as Match;
  } catch {
    return getMatches().find(m => m.shareToken === token) ?? null;
  }
}

// ─── Générer un shareToken unique ─────────────────────────────────────────────

export function generateShareToken(): string {
  // Format lisible : 8 caractères alphanumériques minuscules
  return Math.random().toString(36).slice(2, 6) +
         Math.random().toString(36).slice(2, 6);
}
