import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getTeams, getMatches, saveMatches, generateId } from "@/lib/storage";
import type { Match, Team } from "@/types/basketball";
import mvpLogo from "@/assets/mvp-logo.png";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [teamCount, setTeamCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [liveMatch, setLiveMatch] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const t = getTeams();
    setTeams(t);
    setTeamCount(t.length);
    const matches = getMatches();
    setMatchCount(matches.filter(m => m.status === 'finished').length);
    const live = matches.find(m => m.status === 'live');
    if (live) setLiveMatch(live.id);
  }, []);

  const startQuickMatch = () => {
    const match: Match = {
      id: generateId(),
      mode: 'quick',
      matchCategory: 'friendly',
      teamAName: 'Équipe A',
      teamBName: 'Équipe B',
      playersA: [],
      playersB: [],
      events: [],
      quarter: 1,
      timerSeconds: 600,
      timerRunning: false,
      shotClockSeconds: 24,
      shotClockRunning: false,
      timeoutsA: 0,
      timeoutsB: 0,
      status: 'live',
      createdAt: Date.now(),
    };
    const matches = getMatches();
    saveMatches([...matches, match]);
    navigate({ to: '/match/$matchId', params: { matchId: match.id } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={mvpLogo} alt="MVP" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight leading-none">MVP</h1>
            <p className="text-muted-foreground text-[10px]">Basket Sénégal</p>
          </div>
        </div>
        <Link to="/settings">
          <button type="button" className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            ⚙
          </button>
        </Link>
      </header>

      {/* Match en cours */}
      {liveMatch && (
        <div className="mx-5 mb-3">
          <Link to="/match/$matchId" params={{ matchId: liveMatch }}>
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-primary font-semibold text-sm">🔴 Match en cours</p>
                <p className="text-foreground text-[11px] mt-0.5">Toucher pour continuer</p>
              </div>
              <span className="text-xl text-primary">→</span>
            </div>
          </Link>
        </div>
      )}

      <div className="flex-1 px-5 space-y-2.5">
        {/* Match rapide */}
        <button type="button" onClick={startQuickMatch} className="w-full text-left">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 hover:bg-primary/15 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-primary">⚡ Match rapide</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Scoreboard plein écran</p>
              </div>
              <span className="text-2xl">🏟️</span>
            </div>
          </div>
        </button>

        {/* Mode assistant */}
        <Link to="/match/new" className="block">
          <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">📊 Mode Assistant</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Stats complètes en temps réel</p>
              </div>
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </Link>

        {/* Équipes */}
        <Link to="/teams" className="block">
          <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Équipes</h2>
                <p className="text-muted-foreground text-xs mt-0.5">{teamCount} équipe{teamCount !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </Link>

        {/* Entraînements */}
        <Link to="/trainings" className="block">
          <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">🏋️ Entraînements</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Présence & évaluation</p>
              </div>
              <span className="text-2xl">⭐</span>
            </div>
          </div>
        </Link>

        <div className="flex gap-2.5">
          <Link to="/matches" className="block flex-1">
            <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
              <h2 className="text-sm font-bold text-foreground">📋 Historique</h2>
              <p className="text-muted-foreground text-[11px] mt-0.5">{matchCount} match{matchCount !== 1 ? 's' : ''}</p>
            </div>
          </Link>
          <Link to="/stats" className="block flex-1">
            <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
              <h2 className="text-sm font-bold text-foreground">📈 Stats</h2>
              <p className="text-muted-foreground text-[11px] mt-0.5">Performances</p>
            </div>
          </Link>
        </div>

        <Link to="/calendar" className="block">
          <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">📅 Calendrier</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Matchs & entraînements</p>
              </div>
              <span className="text-2xl">🗓️</span>
            </div>
          </div>
        </Link>
      </div>

      <footer className="p-3 text-center">
        <p className="text-muted-foreground text-[10px]">MVP Basket Sénégal v3.0</p>
      </footer>
    </div>
  );
}
