import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getTeams, getMatches } from "@/lib/storage";
import { getTeamScore } from "@/types/basketball";
import { getTeamRecord, getTopPlayersByCategory, getMatchPlayerIds } from "@/lib/playerStats";
import { computePlayerStats } from "@/types/basketball";
import { Sparkline } from "@/components/Sparkline";
import type { Team, Match } from "@/types/basketball";

export const Route = createFileRoute("/stats/team/$teamId")({
  component: TeamStatsPage,
});

function TeamStatsPage() {
  const { teamId } = Route.useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);

  useEffect(() => {
    const teams = getTeams();
    const found = teams.find(t => t.id === teamId);
    setTeam(found || null);
    const matches = getMatches().filter(m =>
      m.status === 'finished' && (m.teamAId === teamId || m.teamBId === teamId)
    ).sort((a, b) => b.createdAt - a.createdAt);
    setTeamMatches(matches);
  }, [teamId]);

  const record = useMemo(() => getTeamRecord(teamId), [teamId]);

  const ptsForTrend = useMemo(() =>
    [...teamMatches].reverse().slice(-10).map(m => {
      const isA = m.teamAId === teamId;
      return getTeamScore(m.events, isA ? (m.teamAId || 'A') : (m.teamBId || 'B'));
    }), [teamMatches, teamId]);

  const topScorers = useMemo(() => {
    if (!team) return [];
    const map = new Map<string, { pts: number; games: number }>();
    for (const m of teamMatches) {
      for (const pid of getMatchPlayerIds(m)) {
        const isOnThisTeam = team.players.some(p => p.id === pid);
        if (!isOnThisTeam) continue;
        const stats = computePlayerStats(m.events, pid);
        const cur = map.get(pid) || { pts: 0, games: 0 };
        cur.pts += stats.points;
        cur.games += 1;
        map.set(pid, cur);
      }
    }
    return [...map.entries()]
      .map(([pid, v]) => ({ playerId: pid, avgPoints: v.games > 0 ? v.pts / v.games : 0, totalPts: v.pts, games: v.games }))
      .sort((a, b) => b.avgPoints - a.avgPoints)
      .slice(0, 5);
  }, [teamMatches, team]);

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Équipe introuvable</p>
      </div>
    );
  }

  const winPct = teamMatches.length > 0
    ? Math.round((record.wins / teamMatches.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/teams"><Button variant="ghost" size="icon">←</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{team.name}</h1>
          <p className="text-xs text-muted-foreground">{team.category} · {team.gender} · {team.players.length} joueurs</p>
        </div>
      </header>

      {/* Bilan */}
      <section className="px-5 mb-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground font-semibold mb-3">Bilan saison</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-2xl font-black text-primary">{record.wins}</p>
              <p className="text-[10px] text-muted-foreground">Victoires</p>
            </div>
            <div>
              <p className="text-2xl font-black text-destructive">{record.losses}</p>
              <p className="text-[10px] text-muted-foreground">Défaites</p>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{record.draws}</p>
              <p className="text-[10px] text-muted-foreground">Nuls</p>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{winPct}%</p>
              <p className="text-[10px] text-muted-foreground">Win %</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{record.avgPtsFor.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Pts marqués / match</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{record.avgPtsAgainst.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Pts encaissés / match</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tendance points */}
      {ptsForTrend.length >= 3 && (
        <section className="px-5 mb-4">
          <div className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">📈 Points marqués</p>
              <p className="text-[10px] text-muted-foreground">{ptsForTrend.length} derniers matchs</p>
            </div>
            <Sparkline values={ptsForTrend} width={160} height={36} />
          </div>
        </section>
      )}

      {/* Top scoreurs */}
      {topScorers.length > 0 && (
        <section className="px-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-2">🏀 Top scoreurs</h2>
          <div className="space-y-2">
            {topScorers.map(({ playerId, avgPoints, totalPts, games }) => {
              const player = team.players.find(p => p.id === playerId);
              if (!player) return null;
              return (
                <Link key={playerId} to="/player/$playerId" params={{ playerId }}>
                  <div className="bg-card rounded-xl px-4 py-3 border border-border hover:border-primary/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {player.jerseyNumber !== undefined && (
                        <span className="w-7 h-7 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                          {player.jerseyNumber}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {player.firstName} {player.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{games} match{games > 1 ? 's' : ''} · {totalPts} pts total</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-primary">{avgPoints.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">moy.</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Historique matchs */}
      <section className="px-5">
        <h2 className="text-sm font-bold text-foreground mb-2">Historique ({teamMatches.length} matchs)</h2>
        {teamMatches.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun match terminé.</p>
        ) : (
          <div className="space-y-2">
            {teamMatches.map(m => {
              const isA = m.teamAId === teamId;
              const myId = isA ? (m.teamAId || 'A') : (m.teamBId || 'B');
              const oppId = isA ? (m.teamBId || 'B') : (m.teamAId || 'A');
              const myScore = getTeamScore(m.events, myId);
              const oppScore = getTeamScore(m.events, oppId);
              const oppName = isA ? m.teamBName : m.teamAName;
              const won = myScore > oppScore;
              const draw = myScore === oppScore;
              return (
                <Link key={m.id} to="/report/$matchId" params={{ matchId: m.id }}>
                  <div className="bg-card rounded-xl px-4 py-3 border border-border hover:border-primary/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${won ? 'bg-green-500/20 text-green-600' : draw ? 'bg-secondary text-muted-foreground' : 'bg-destructive/20 text-destructive'}`}>
                        {won ? 'V' : draw ? 'N' : 'D'}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">vs {oppName}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-foreground tabular-nums">
                      <span className={won ? 'text-primary' : ''}>{myScore}</span>
                      <span className="text-muted-foreground mx-1">–</span>
                      <span className={!won && !draw ? 'text-destructive' : ''}>{oppScore}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
