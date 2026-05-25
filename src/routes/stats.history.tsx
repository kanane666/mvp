import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getMatches, getTrainingSessions, getTeams, getAttendance, getEvaluations } from "@/lib/storage";
import { getTeamScore, MATCH_CATEGORY_LABELS } from "@/types/basketball";
import type { Match, TrainingSession, Team } from "@/types/basketball";

export const Route = createFileRoute("/stats/history")({
  component: HistoryPage,
});

type Item =
  | { kind: 'match'; date: number; match: Match }
  | { kind: 'session'; date: number; session: TrainingSession; team?: Team; present: number; avg: string };

function HistoryPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    setMatches(getMatches());
    setSessions(getTrainingSessions());
    setTeams(getTeams());
  }, []);

  const items = useMemo<Item[]>(() => {
    const attendance = getAttendance();
    const evaluations = getEvaluations();
    const mItems: Item[] = matches.map(m => ({ kind: 'match', date: m.createdAt, match: m }));
    const sItems: Item[] = sessions.map(s => {
      const team = teams.find(t => t.id === s.teamId);
      const sessAttend = attendance.filter(a => a.sessionId === s.id);
      const present = sessAttend.filter(a => a.status === 'present').length;
      const sessEvals = evaluations.filter(e => e.sessionId === s.id);
      const avg = sessEvals.length > 0 ? (sessEvals.reduce((sum, e) => sum + e.rating, 0) / sessEvals.length).toFixed(1) : '–';
      return { kind: 'session', date: s.date, session: s, team, present, avg };
    });
    return [...mItems, ...sItems].sort((a, b) => b.date - a.date);
  }, [matches, sessions, teams]);

  return (
    <div className="px-5 pb-8 space-y-3">
      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-muted-foreground text-sm">Aucun historique</p>
        </div>
      ) : items.map(item => {
        if (item.kind === 'match') {
          const m = item.match;
          const sA = getTeamScore(m.events, m.teamAId || 'A');
          const sB = getTeamScore(m.events, m.teamBId || 'B');
          const cat = m.matchCategory;
          return (
            <Link key={`m-${m.id}`} to="/report/$matchId" params={{ matchId: m.id }} className="block">
              <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">
                    {cat ? MATCH_CATEGORY_LABELS[cat] : 'Match'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground truncate">
                  {m.teamAName} <span className="text-primary mx-1">{sA}–{sB}</span> {m.teamBName}
                </div>
              </div>
            </Link>
          );
        }
        const s = item.session;
        return (
          <Link key={`s-${s.id}`} to="/training/$sessionId" params={{ sessionId: s.id }} className="block">
            <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 active:scale-[0.98] transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-semibold">Entraînement</span>
                <span className="text-[11px] text-muted-foreground">{new Date(s.date).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground truncate">{item.team?.name || 'Équipe'}</div>
              <p className="text-xs text-muted-foreground mt-0.5">✅ {item.present} présents · ⭐ {item.avg}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
