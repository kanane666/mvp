import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeams, getTrainingSessions, saveTrainingSessions, generateId } from "@/lib/storage";
import type { Team, TrainingSession } from "@/types/basketball";

export const Route = createFileRoute("/training/new")({
  component: NewTrainingPage,
});

function NewTrainingPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => { setTeams(getTeams()); }, []);

  const create = () => {
    if (!teamId) return;
    const session: TrainingSession = {
      id: generateId(),
      teamId,
      date: new Date(date).getTime(),
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };
    saveTrainingSessions([...getTrainingSessions(), session]);
    navigate({ to: '/training/$sessionId', params: { sessionId: session.id } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/trainings"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground">Nouvelle session</h1>
      </header>
      <div className="px-5 space-y-4 pb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Équipe</p>
          {teams.length === 0 ? (
            <Link to="/teams"><Button variant="outline" className="w-full">Créer une équipe</Button></Link>
          ) : (
            <div className="space-y-2">
              {teams.map(t => (
                <button type="button" key={t.id} onClick={() => setTeamId(t.id)}
                  className={`w-full text-left p-3 rounded-xl ${teamId === t.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs opacity-70 ml-2">{t.players.length} joueurs</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">Date</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">Notes (optionnel)</p>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objectifs de la séance..." className="h-12 rounded-xl" />
        </div>
        <Button onClick={create} disabled={!teamId} size="lg" className="w-full">Démarrer la session →</Button>
      </div>
    </div>
  );
}
