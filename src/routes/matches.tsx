import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getMatches } from "@/lib/storage";
import { getTeamScore } from "@/types/basketball";
import type { Match } from "@/types/basketball";

export const Route = createFileRoute("/matches")({
  component: MatchesPage,
});

function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    setMatches(getMatches().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
      </header>

      <div className="px-5 space-y-3 pb-8">
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-muted-foreground">Aucun match</p>
          </div>
        ) : (
          matches.map(m => {
            const teamAKey = m.teamAId || 'A';
            const teamBKey = m.teamBId || 'B';
            const sA = getTeamScore(m.events, teamAKey);
            const sB = getTeamScore(m.events, teamBKey);
            return (
              <Link key={m.id} to="/match/$matchId" params={{ matchId: m.id }}>
                <div className="bg-card rounded-2xl p-5 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-semibold text-sm">{m.teamAName}</span>
                    <span className="text-foreground font-bold text-lg">{sA}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-foreground font-semibold text-sm">{m.teamBName}</span>
                    <span className="text-foreground font-bold text-lg">{sB}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                      <span className="text-xs text-muted-foreground">{m.mode === 'quick' ? '⚡' : '📊'}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${m.status === 'live' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {m.status === 'live' ? 'En cours' : 'Terminé'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
