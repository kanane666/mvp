import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getTrainingSessions, getTeams, getAttendance, getEvaluations } from "@/lib/storage";
import type { TrainingSession, Team } from "@/types/basketball";

export const Route = createFileRoute("/trainings")({
  component: TrainingsPage,
});

function TrainingsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    setSessions(getTrainingSessions().sort((a, b) => b.date - a.date));
    setTeams(getTeams());
  }, []);

  const attendance = getAttendance();
  const evaluations = getEvaluations();

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
          <h1 className="text-xl font-bold text-foreground">Entraînements</h1>
        </div>
        <Link to="/training/new"><Button size="sm">+ Nouveau</Button></Link>
      </header>
      <div className="px-5 pb-8 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-muted-foreground mb-4">Aucune session</p>
            <Link to="/training/new"><Button>Créer une session</Button></Link>
          </div>
        ) : (
          sessions.map(s => {
            const team = teams.find(t => t.id === s.teamId);
            const sessAttend = attendance.filter(a => a.sessionId === s.id);
            const present = sessAttend.filter(a => a.status === 'present').length;
            const sessEvals = evaluations.filter(e => e.sessionId === s.id);
            const avg = sessEvals.length > 0 ? (sessEvals.reduce((sum, e) => sum + e.rating, 0) / sessEvals.length).toFixed(1) : '–';
            return (
              <Link key={s.id} to="/training/$sessionId" params={{ sessionId: s.id }} className="block">
                <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-foreground">{team?.name || 'Équipe'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-primary font-semibold">✅ {present}</p>
                      <p className="text-muted-foreground">⭐ {avg}</p>
                    </div>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-2 italic">{s.notes}</p>}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
