import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import {
  getTrainingSessions, getTeams, getAttendance, saveAttendance, getEvaluations, saveEvaluations,
} from "@/lib/storage";
import type { TrainingSession, Team, AttendanceRecord, EvaluationRecord } from "@/types/basketball";

export const Route = createFileRoute("/training/$sessionId")({
  component: TrainingSessionPage,
});

function TrainingSessionPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);

  useEffect(() => {
    const s = getTrainingSessions().find(x => x.id === sessionId) || null;
    setSession(s);
    if (s) setTeam(getTeams().find(t => t.id === s.teamId) || null);
    setAttendance(getAttendance().filter(a => a.sessionId === sessionId));
    setEvaluations(getEvaluations().filter(e => e.sessionId === sessionId));
  }, [sessionId]);

  const setStatus = (playerId: string, status: 'present' | 'absent') => {
    const all = getAttendance().filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    const updated = [...all, { sessionId, playerId, status }];
    saveAttendance(updated);
    setAttendance(updated.filter(a => a.sessionId === sessionId));
    if (status === 'absent') {
      const allEv = getEvaluations().filter(e => !(e.sessionId === sessionId && e.playerId === playerId));
      saveEvaluations(allEv);
      setEvaluations(allEv.filter(e => e.sessionId === sessionId));
    }
  };

  const setRating = (playerId: string, rating: number) => {
    const all = getEvaluations().filter(e => !(e.sessionId === sessionId && e.playerId === playerId));
    const updated = rating > 0
      ? [...all, { sessionId, playerId, rating: rating as 1 | 2 | 3 | 4 | 5 }]
      : all;
    saveEvaluations(updated);
    setEvaluations(updated.filter(e => e.sessionId === sessionId));
  };

  if (!session || !team) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Session introuvable</div>;
  }

  const getStatus = (pid: string) => attendance.find(a => a.playerId === pid)?.status;
  const getRating = (pid: string) => evaluations.find(e => e.playerId === pid)?.rating || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-3 flex items-center gap-3">
        <Link to="/trainings"><Button variant="ghost" size="icon">←</Button></Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">{team.name}</h1>
          <p className="text-xs text-muted-foreground">{new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </header>
      <div className="px-5 pb-24 space-y-2">
        {team.players.map(p => {
          const status = getStatus(p.id);
          const rating = getRating(p.id);
          return (
            <div key={p.id} className="bg-card rounded-2xl p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {p.jerseyNumber !== undefined && (
                    <span className="text-xs font-bold w-7 h-7 rounded-md flex items-center justify-center bg-primary/20 text-primary">
                      {p.jerseyNumber}
                    </span>
                  )}
                  <span className="font-semibold text-foreground">{p.firstName} {p.lastName}</span>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setStatus(p.id, 'present')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'present' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    ✅
                  </button>
                  <button type="button" onClick={() => setStatus(p.id, 'absent')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'absent' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    ❌
                  </button>
                </div>
              </div>
              <StarRating value={rating} onChange={v => setRating(p.id, v)} disabled={status !== 'present'} />
            </div>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Link to="/trainings"><Button size="lg" className="w-full">Terminer la session</Button></Link>
      </div>
    </div>
  );
}
