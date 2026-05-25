import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMatches, getTrainingSessions, getTeams, getAttendance, getEvaluations, getPlayerTrainingStats } from "@/lib/storage";
import { MatchListSection } from "@/components/MatchListSection";
import type { Match, TrainingSession, Team, Player } from "@/types/basketball";

export const Route = createFileRoute("/stats/training")({
  component: TrainingStatsPage,
});

function TrainingStatsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    setMatches(getMatches());
    setSessions(getTrainingSessions().sort((a, b) => b.date - a.date));
    setTeams(getTeams());
  }, []);

  const attendance = useMemo(() => getAttendance(), [sessions]);
  const evaluations = useMemo(() => getEvaluations(), [sessions]);

  const players = useMemo(() => teams.flatMap(t => t.players.map(p => ({ ...p, _teamName: t.name }))), [teams]);

  // Sparkline helper: last 5 ratings per player
  const playerSpark = (playerId: string) => {
    const evs = evaluations
      .filter(e => e.playerId === playerId)
      .sort((a, b) => {
        const sa = sessions.find(s => s.id === a.sessionId)?.date || 0;
        const sb = sessions.find(s => s.id === b.sessionId)?.date || 0;
        return sa - sb;
      })
      .slice(-5)
      .map(e => e.rating);
    return evs;
  };

  return (
    <div className="px-5 pb-8 space-y-5">
      {/* Section A: training sessions */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">🏋️ Sessions d'entraînement</h2>
          <Link to="/training/new"><Button size="sm">+ Nouvelle</Button></Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Aucune session</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 8).map(s => {
              const team = teams.find(t => t.id === s.teamId);
              const sessAttend = attendance.filter(a => a.sessionId === s.id);
              const present = sessAttend.filter(a => a.status === 'present').length;
              const sessEvals = evaluations.filter(e => e.sessionId === s.id);
              const avg = sessEvals.length > 0 ? (sessEvals.reduce((sum, e) => sum + e.rating, 0) / sessEvals.length).toFixed(1) : '–';
              return (
                <Link key={s.id} to="/training/$sessionId" params={{ sessionId: s.id }} className="block">
                  <div className="bg-card rounded-2xl p-3 border border-border hover:border-primary/40 active:scale-[0.98] transition-all flex justify-between items-center">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{team?.name || 'Équipe'}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(s.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="text-right text-xs flex-shrink-0">
                      <p className="text-primary font-semibold">✅ {present}</p>
                      <p className="text-muted-foreground">⭐ {avg}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Section B: player trends */}
      {players.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">📈 Tendances joueurs</h2>
          <div className="space-y-2">
            {players.map(p => {
              const ts = getPlayerTrainingStats(p.id);
              if (ts.sessionsCount === 0) return null;
              const spark = playerSpark(p.id);
              return (
                <Link key={p.id} to="/player/$playerId" params={{ playerId: p.id }} className="block">
                  <div className="bg-card rounded-2xl p-3 border border-border hover:border-primary/40 active:scale-[0.98] flex items-center justify-between gap-3 transition-all">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.jerseyNumber !== undefined && <span className="text-primary mr-1">#{p.jerseyNumber}</span>}
                        {p.firstName} {p.lastName[0]}.
                      </p>
                      <p className="text-[11px] text-muted-foreground">{p._teamName} · 📅 {ts.attendanceRate}% · ⭐ {ts.avgRating.toFixed(1)}</p>
                    </div>
                    <Sparkline values={spark} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Section C: internal & training matches */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-2">🏀 Matchs d'entraînement</h2>
        <div className="-mx-5">
          <MatchListSection matches={matches} categories={['training', 'internal']} emptyLabel="Aucun match d'entraînement" />
        </div>
      </section>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const W = 60, H = 24, max = 5, min = 0;
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / (max - min)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke="oklch(0.68 0.15 220)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = i * step;
        const y = H - ((v - min) / (max - min)) * H;
        return <circle key={i} cx={x} cy={y} r="1.8" fill="oklch(0.68 0.15 220)" />;
      })}
    </svg>
  );
}
