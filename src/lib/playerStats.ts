import { getMatches, getTeams } from "./storage";
import { computePlayerStats, getTeamScore } from "@/types/basketball";
import type { Match, MatchCategory, Player, PlayerStats } from "@/types/basketball";

export type CategoryFilter = MatchCategory | 'all';

export function findPlayer(playerId: string): { player: Player; teamName: string; teamId: string } | null {
  for (const t of getTeams()) {
    const p = t.players.find(pp => pp.id === playerId);
    if (p) return { player: p, teamName: t.name, teamId: t.id };
  }
  return null;
}

export function matchHasPlayer(m: Match, playerId: string): boolean {
  return m.events.some(e => e.playerId === playerId);
}

export function getPlayerMatches(playerId: string, filter: CategoryFilter = 'all'): Match[] {
  return getMatches()
    .filter(m => matchHasPlayer(m, playerId))
    .filter(m => filter === 'all' || m.matchCategory === filter)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface CareerStats {
  games: number;
  totals: PlayerStats;
  avg: { points: number; rebounds: number; assists: number; fouls: number; steals: number; blocks: number };
  efficiency: number; // PER simplifié
}

const emptyStats = (): PlayerStats => ({
  points: 0, fgMade: 0, fgAttempted: 0, fg3Made: 0, fg3Attempted: 0,
  ftMade: 0, ftAttempted: 0, assists: 0, offRebounds: 0, defRebounds: 0,
  rebounds: 0, blocks: 0, steals: 0, turnovers: 0, foulsCommitted: 0, foulsDrawn: 0,
});

export function computeEfficiency(s: PlayerStats): number {
  // PER simplifié : (pts + reb + ast + stl + blk) - (to + fgMissed + ftMissed)
  const fgMissed = s.fgAttempted - s.fgMade;
  const ftMissed = s.ftAttempted - s.ftMade;
  return s.points + s.rebounds + s.assists + s.steals + s.blocks - s.turnovers - fgMissed - ftMissed;
}

export function getPlayerCareerStats(playerId: string, filter: CategoryFilter = 'all'): CareerStats {
  const matches = getPlayerMatches(playerId, filter);
  const totals = emptyStats();
  for (const m of matches) {
    const s = computePlayerStats(m.events, playerId);
    totals.points += s.points;
    totals.fgMade += s.fgMade; totals.fgAttempted += s.fgAttempted;
    totals.fg3Made += s.fg3Made; totals.fg3Attempted += s.fg3Attempted;
    totals.ftMade += s.ftMade; totals.ftAttempted += s.ftAttempted;
    totals.assists += s.assists;
    totals.offRebounds += s.offRebounds; totals.defRebounds += s.defRebounds;
    totals.rebounds += s.rebounds;
    totals.blocks += s.blocks; totals.steals += s.steals;
    totals.turnovers += s.turnovers;
    totals.foulsCommitted += s.foulsCommitted; totals.foulsDrawn += s.foulsDrawn;
  }
  const g = matches.length || 1;
  return {
    games: matches.length,
    totals,
    avg: {
      points: totals.points / g,
      rebounds: totals.rebounds / g,
      assists: totals.assists / g,
      fouls: totals.foulsCommitted / g,
      steals: totals.steals / g,
      blocks: totals.blocks / g,
    },
    efficiency: computeEfficiency(totals),
  };
}

export function getQuarterScores(m: Match): { quarter: number; a: number; b: number }[] {
  const maxQ = Math.max(1, ...m.events.map(e => e.quarter));
  const out: { quarter: number; a: number; b: number }[] = [];
  const idA = m.teamAId || 'A';
  const idB = m.teamBId || 'B';
  for (let q = 1; q <= maxQ; q++) {
    const evs = m.events.filter(e => e.quarter === q);
    out.push({ quarter: q, a: getTeamScore(evs, idA), b: getTeamScore(evs, idB) });
  }
  return out;
}

/** Detect scoring runs (e.g. 8-0 by team A) in event sequence */
export function getTeamRuns(m: Match): { teamName: string; run: number; quarter: number }[] {
  const idA = m.teamAId || 'A';
  const idB = m.teamBId || 'B';
  const scoreEvents = m.events.filter(e =>
    e.type === '2pt_made' || e.type === '3pt_made' || e.type === 'ft_made'
  );

  const runs: { teamName: string; run: number; quarter: number }[] = [];
  let lastTeam: string | null = null;
  let currentRun = 0;
  let currentQ = 1;

  for (const ev of scoreEvents) {
    const pts = ev.type === '3pt_made' ? 3 : ev.type === '2pt_made' ? 2 : 1;
    if (ev.teamId === lastTeam) {
      currentRun += pts;
    } else {
      if (currentRun >= 6 && lastTeam) {
        runs.push({
          teamName: lastTeam === idA ? m.teamAName : m.teamBName,
          run: currentRun,
          quarter: currentQ,
        });
      }
      lastTeam = ev.teamId;
      currentRun = pts;
      currentQ = ev.quarter;
    }
  }
  if (currentRun >= 6 && lastTeam) {
    runs.push({
      teamName: lastTeam === idA ? m.teamAName : m.teamBName,
      run: currentRun,
      quarter: currentQ,
    });
  }
  return runs;
}

export interface TopPerformers {
  topScorer?: { playerId: string; value: number };
  topAssister?: { playerId: string; value: number };
  topRebounder?: { playerId: string; value: number };
}

export function getMatchPlayerIds(m: Match): string[] {
  const ids = new Set<string>();
  for (const e of m.events) {
    if (e.playerId && e.playerId !== 'opponent' && e.playerId !== 'team') ids.add(e.playerId);
  }
  return [...ids];
}

export function getTopPerformers(m: Match): TopPerformers {
  const ids = getMatchPlayerIds(m);
  const out: TopPerformers = {};
  for (const id of ids) {
    const s = computePlayerStats(m.events, id);
    if (!out.topScorer || s.points > out.topScorer.value) out.topScorer = { playerId: id, value: s.points };
    if (!out.topAssister || s.assists > out.topAssister.value) out.topAssister = { playerId: id, value: s.assists };
    if (!out.topRebounder || s.rebounds > out.topRebounder.value) out.topRebounder = { playerId: id, value: s.rebounds };
  }
  return out;
}

export function getTopPlayersByCategory(filter: CategoryFilter, limit = 3): { playerId: string; avgPoints: number; games: number }[] {
  const matches = getMatches().filter(m => filter === 'all' || m.matchCategory === filter);
  const map = new Map<string, { pts: number; games: number }>();
  for (const m of matches) {
    for (const id of getMatchPlayerIds(m)) {
      const s = computePlayerStats(m.events, id);
      const cur = map.get(id) || { pts: 0, games: 0 };
      cur.pts += s.points;
      cur.games += 1;
      map.set(id, cur);
    }
  }
  return [...map.entries()]
    .map(([playerId, v]) => ({ playerId, avgPoints: v.pts / v.games, games: v.games }))
    .sort((a, b) => b.avgPoints - a.avgPoints)
    .slice(0, limit);
}

/** Team record over all matches */
export function getTeamRecord(teamId: string): { wins: number; losses: number; draws: number; avgPtsFor: number; avgPtsAgainst: number } {
  const matches = getMatches().filter(m =>
    m.status === 'finished' && (m.teamAId === teamId || m.teamBId === teamId)
  );
  let wins = 0, losses = 0, draws = 0, ptsFor = 0, ptsAgainst = 0;
  for (const m of matches) {
    const isA = m.teamAId === teamId;
    const idFor = isA ? (m.teamAId || 'A') : (m.teamBId || 'B');
    const idAgainst = isA ? (m.teamBId || 'B') : (m.teamAId || 'A');
    const pF = getTeamScore(m.events, idFor);
    const pA = getTeamScore(m.events, idAgainst);
    ptsFor += pF; ptsAgainst += pA;
    if (pF > pA) wins++;
    else if (pA > pF) losses++;
    else draws++;
  }
  const g = matches.length || 1;
  return { wins, losses, draws, avgPtsFor: ptsFor / g, avgPtsAgainst: ptsAgainst / g };
}
