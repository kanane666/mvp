import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getMatches, saveMatches, getTeams, generateId, saveTeams } from "@/lib/storage";
import { Scoreboard } from "@/components/Scoreboard";
import { PlayerCard } from "@/components/PlayerCard";
import { ActionPanel } from "@/components/ActionPanel";
import { FullScreenScoreboard } from "@/components/FullScreenScoreboard";
import { getTeamScore, computePlayerStats } from "@/types/basketball";
import type { Match, MatchEvent, Player, EventType, Team } from "@/types/basketball";
import { haptics, unlockAudio } from "@/hooks/useHaptics";

export const Route = createFileRoute("/match/$matchId")({
  component: LiveMatchPage,
});

function LiveMatchPage() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<"A" | "B">("A");

  // Timer refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shotClockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick mode name editing
  const [editingName, setEditingName] = useState<"A" | "B" | null>(null);
  const [tempName, setTempName] = useState("");

  // Add player on the fly
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newJersey, setNewJersey] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    unlockAudio();
    const matches = getMatches();
    const found = matches.find(m => m.id === matchId);
    if (found) setMatch(found);
    const teams = getTeams();
    setAllTeams(teams);
    setAllPlayers(teams.flatMap(t => t.players));
  }, [matchId]);

  const persist = useCallback((updated: Match) => {
    setMatch(updated);
    const matches = getMatches();
    saveMatches(matches.map(m => m.id === matchId ? updated : m));
  }, [matchId]);

  // ── DRIFT-FREE GAME TIMER ──
  useEffect(() => {
    if (match?.mode === 'quick') return;
    if (match?.timerRunning) {
      timerRef.current = setInterval(() => {
        setMatch(prev => {
          if (!prev || !prev.timerRunning) return prev;
          const elapsed = prev.timerStartedAt
            ? (Date.now() - prev.timerStartedAt) / 1000
            : 1;
          const remaining = Math.max(0, (prev.timerSecondsAtStart ?? prev.timerSeconds) - elapsed);
          const updated: Match = { ...prev, timerSeconds: Math.round(remaining) };
          if (remaining <= 0) {
            updated.timerRunning = false;
            updated.timerSeconds = 0;
            haptics.buzzer();
          }
          saveMatches(getMatches().map(m => m.id === matchId ? updated : m));
          return updated;
        });
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match?.timerRunning, match?.mode, matchId]);

  // ── DRIFT-FREE SHOT CLOCK ──
  useEffect(() => {
    if (match?.mode === 'quick') return;
    if (match?.shotClockRunning) {
      shotClockRef.current = setInterval(() => {
        setMatch(prev => {
          if (!prev || !prev.shotClockRunning) return prev;
          const elapsed = prev.shotClockStartedAt
            ? (Date.now() - prev.shotClockStartedAt) / 1000
            : 1;
          const remaining = Math.max(0, (prev.shotClockSecondsAtStart ?? prev.shotClockSeconds) - elapsed);
          const updated: Match = { ...prev, shotClockSeconds: Math.round(remaining) };
          if (remaining <= 5 && remaining > 4) haptics.shotClockWarning();
          if (remaining <= 0) updated.shotClockRunning = false;
          saveMatches(getMatches().map(m => m.id === matchId ? updated : m));
          return updated;
        });
      }, 500);
    } else {
      if (shotClockRef.current) clearInterval(shotClockRef.current);
    }
    return () => { if (shotClockRef.current) clearInterval(shotClockRef.current); };
  }, [match?.shotClockRunning, match?.mode, matchId]);

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Match introuvable</p>
      </div>
    );
  }

  if (match.mode === 'quick') {
    return (
      <FullScreenScoreboard
        match={match}
        onUpdate={(updated) => setMatch(updated)}
        onExit={() => navigate({ to: '/' })}
      />
    );
  }

  const getPlayerById = (id: string) => allPlayers.find(p => p.id === id);
  const teamAKey = match.teamAId || 'A';
  const teamBKey = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, teamAKey);
  const scoreB = getTeamScore(match.events, teamBKey);

  const toggleTimer = () => {
    const now = Date.now();
    const isStarting = !match.timerRunning;
    persist({
      ...match,
      timerRunning: isStarting,
      timerStartedAt: isStarting ? now : undefined,
      timerSecondsAtStart: isStarting ? match.timerSeconds : undefined,
    });
  };

  const toggleShotClock = () => {
    const now = Date.now();
    const isStarting = !match.shotClockRunning;
    persist({
      ...match,
      shotClockRunning: isStarting,
      shotClockStartedAt: isStarting ? now : undefined,
      shotClockSecondsAtStart: isStarting ? match.shotClockSeconds : undefined,
    });
  };

  const resetShotClock = () => persist({
    ...match,
    shotClockSeconds: 24,
    shotClockRunning: false,
    shotClockStartedAt: undefined,
  });

  const nextQuarter = () => {
    if (match.quarter < 4) {
      haptics.buzzer();
      persist({
        ...match,
        quarter: match.quarter + 1,
        timerRunning: false,
        timerSeconds: 600,
        timerStartedAt: undefined,
        shotClockSeconds: 24,
        shotClockRunning: false,
      });
    }
  };

  const addEvent = (type: EventType) => {
    if (!selectedPlayer) return;
    const teamId = activeTeam === 'A' ? teamAKey : teamBKey;
    const event: MatchEvent = {
      id: generateId(), playerId: selectedPlayer, teamId, type,
      quarter: match.quarter, timestamp: Date.now(),
    };
    // Haptic feedback by event type
    if (type === '3pt_made') haptics.threePoints();
    else if (type === 'foul_committed') haptics.foul();
    else if (type.endsWith('_made') || type === 'assist' || type.includes('rebound')) haptics.action();
    persist({ ...match, events: [...match.events, event], shotClockSeconds: 24, shotClockRunning: false });
    setSelectedPlayer(null);
  };

  const addTimeout = () => {
    if (activeTeam === 'A') persist({ ...match, timeoutsA: match.timeoutsA + 1 });
    else persist({ ...match, timeoutsB: match.timeoutsB + 1 });
  };

  const undoLast = () => {
    if (match.events.length === 0) return;
    haptics.undo();
    persist({ ...match, events: match.events.slice(0, -1) });
  };

  const endMatch = () => persist({
    ...match, status: 'finished', timerRunning: false, shotClockRunning: false,
  });

  const saveTeamName = () => {
    if (!editingName || !tempName.trim()) { setEditingName(null); return; }
    if (editingName === 'A') persist({ ...match, teamAName: tempName.trim() });
    else persist({ ...match, teamBName: tempName.trim() });
    setEditingName(null);
  };

  // ── Ajout joueur à la volée ──
  const handleAddPlayer = () => {
    if (!newFirstName.trim()) return;
    const teamId = activeTeam === 'A' ? (match.teamAId || '') : (match.teamBId || '');
    const newPlayer = {
      id: generateId(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim() || '.',
      jerseyNumber: newJersey ? parseInt(newJersey) : undefined,
      teamId,
    };
    // Add to team in storage
    if (teamId) {
      const teams = getTeams();
      const updated = teams.map(t =>
        t.id === teamId ? { ...t, players: [...t.players, newPlayer] } : t
      );
      saveTeams(updated);
      setAllPlayers(updated.flatMap(t => t.players));
    }
    // Add to match player list
    const listKey = activeTeam === 'A' ? 'playersA' : 'playersB';
    persist({ ...match, [listKey]: [...match[listKey], newPlayer.id] });
    setNewFirstName(''); setNewLastName(''); setNewJersey('');
    setShowAddPlayer(false);
  };

  const currentPlayers = activeTeam === 'A' ? match.playersA : match.playersB;
  const selectedPlayerObj = selectedPlayer ? getPlayerById(selectedPlayer) || null : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="px-4 pt-4 pb-1 flex items-center justify-between">
        <Link to="/"><Button variant="ghost" size="sm">← Accueil</Button></Link>
        <div className="flex gap-2">
          {match.status === 'live' && (
            <>
              <Button variant="ghost" size="sm" onClick={undoLast} disabled={match.events.length === 0}>
                ↩ Annuler
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => setShowAddPlayer(v => !v)}
                className="text-primary"
              >
                + Joueur
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Scoreboard */}
      <div className="px-4 py-2">
        <Scoreboard
          match={match}
          onToggleTimer={toggleTimer}
          onToggleShotClock={toggleShotClock}
          onResetShotClock={resetShotClock}
          onNextQuarter={nextQuarter}
        />
      </div>

      {match.status === 'finished' ? (
        <div className="flex-1 px-4 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground mb-2">Match terminé</p>
          <p className="text-muted-foreground mb-6">
            {scoreA > scoreB ? `${match.teamAName} gagne !`
              : scoreB > scoreA ? `${match.teamBName} gagne !`
              : 'Match nul !'}
          </p>
          <div className="flex gap-3">
            <Link to="/report/$matchId" params={{ matchId }}>
              <Button size="lg" variant="default">Voir le rapport →</Button>
            </Link>
            <Link to="/"><Button size="lg" variant="outline">Accueil</Button></Link>
          </div>
        </div>
      ) : (
        <>
          {/* Add player modal */}
          {showAddPlayer && (
            <div className="px-4 mb-2">
              <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Ajouter un joueur</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Prénom *"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    className="flex-1 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Nom"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    className="flex-1 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="#"
                    value={newJersey}
                    onChange={e => setNewJersey(e.target.value)}
                    className="w-16 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPlayer} disabled={!newFirstName.trim()} className="flex-1">Ajouter →</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddPlayer(false)}>Annuler</Button>
                </div>
              </div>
            </div>
          )}

          {/* Team tabs */}
          <div className="px-4 flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => { setActiveTeam('A'); setSelectedPlayer(null); }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${activeTeam === 'A' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >
              {match.teamAName}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTeam('B'); setSelectedPlayer(null); }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${activeTeam === 'B' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >
              {match.teamBName}
            </button>
          </div>

          {/* Edit name */}
          {editingName && (
            <div className="px-4 mb-2">
              <div className="flex gap-2">
                <input
                  type="text" value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  autoFocus
                  className="flex-1 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={e => e.key === 'Enter' && saveTeamName()}
                />
                <Button size="sm" onClick={saveTeamName}>OK</Button>
              </div>
            </div>
          )}

          <div className="px-4 flex-1 overflow-y-auto pb-4">
            {activeTeam === 'B' && match.playersB.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">Score adversaire (saisie rapide)</p>
                <div className="flex gap-2">
                  {([['ft_made', '+1'], ['2pt_made', '+2'], ['3pt_made', '+3']] as const).map(([type, label]) => (
                    <Button key={type} variant="score" size="xl" className="flex-1" onClick={() => {
                      const ev: MatchEvent = { id: generateId(), playerId: 'opponent', teamId: teamBKey, type, quarter: match.quarter, timestamp: Date.now() };
                      haptics.action();
                      persist({ ...match, events: [...match.events, ev], shotClockSeconds: 24 });
                    }}>{label}</Button>
                  ))}
                </div>
                <Button variant="foul" size="default" className="w-full" onClick={() => {
                  const ev: MatchEvent = { id: generateId(), playerId: 'opponent', teamId: teamBKey, type: 'foul_committed', quarter: match.quarter, timestamp: Date.now() };
                  haptics.foul();
                  persist({ ...match, events: [...match.events, ev] });
                }}>🚫 Faute adverse</Button>
                <Button variant="outline" size="sm" onClick={addTimeout} className="w-full">⏱ Temps mort</Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {currentPlayers.map(pid => {
                    const p = getPlayerById(pid);
                    if (!p) return null;
                    const stats = computePlayerStats(match.events, pid);
                    return (
                      <PlayerCard
                        key={pid}
                        player={p}
                        stats={stats}
                        isSelected={selectedPlayer === pid}
                        onSelect={() => setSelectedPlayer(selectedPlayer === pid ? null : pid)}
                      />
                    );
                  })}
                </div>

                {/* Undo visible in action zone */}
                {match.events.length > 0 && (
                  <button
                    type="button"
                    onClick={undoLast}
                    className="w-full mb-2 py-2 rounded-xl bg-secondary/50 text-muted-foreground text-xs font-semibold active:scale-95 transition-transform border border-border/40"
                  >
                    ↩ Annuler la dernière action
                  </button>
                )}

                <ActionPanel selectedPlayer={selectedPlayerObj} onAction={addEvent} />
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={addTimeout} className="w-full">⏱ Temps mort</Button>
                </div>
              </>
            )}
          </div>

          <div className="px-4 pb-4">
            <Button variant="outline" size="sm" onClick={endMatch} className="w-full text-destructive border-destructive/30">
              Terminer le match
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
