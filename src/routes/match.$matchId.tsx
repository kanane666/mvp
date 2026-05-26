import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getMatches, saveMatches, getTeams, generateId, saveTeams } from "@/lib/storage";
import { Scoreboard } from "@/components/Scoreboard";
import { PlayerCard } from "@/components/PlayerCard";
import { ActionPanel } from "@/components/ActionPanel";
import { SubstitutionPanel } from "@/components/SubstitutionPanel";
import { FullScreenScoreboard } from "@/components/FullScreenScoreboard";
import { getTeamScore, computePlayerStats } from "@/types/basketball";
import type { Match, MatchEvent, Player, EventType, Team, PlayerStats } from "@/types/basketball";
import { haptics, unlockAudio } from "@/hooks/useHaptics";

export const Route = createFileRoute("/match/$matchId")({
  component: LiveMatchPage,
});

type TabMode = "stats" | "subs";

function LiveMatchPage() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<"A" | "B">("A");
  const [tabMode, setTabMode] = useState<TabMode>("stats");

  // Timer refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shotClockRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (found) {
      // Init activePlayersA/B si pas encore définis (première ouverture)
      const patched: Match = {
        ...found,
        activePlayersA: found.activePlayersA ?? found.playersA.slice(0, 5),
        activePlayersB: found.activePlayersB ?? found.playersB.slice(0, 5),
      };
      setMatch(patched);
    }
    const teams = getTeams();
    setAllTeams(teams);
    setAllPlayers(teams.flatMap(t => t.players));
  }, [matchId]);

  const persist = useCallback((updated: Match) => {
    setMatch(updated);
    const matches = getMatches();
    saveMatches(matches.map(m => m.id === matchId ? updated : m));
  }, [matchId]);

  // ── DRIFT-FREE GAME TIMER (mode assistant) ──
  useEffect(() => {
    if (match?.mode === 'quick') return;
    if (!match?.timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const gameStartedAt = match.timerStartedAt ?? Date.now();
    const gameAtStart   = match.timerSecondsAtStart ?? match.timerSeconds;

    timerRef.current = setInterval(() => {
      setMatch(prev => {
        if (!prev || !prev.timerRunning) return prev;
        const now = Date.now();
        const elapsed = (now - gameStartedAt) / 1000;
        const gameRemaining = Math.max(0, gameAtStart - elapsed);

        if (gameRemaining <= 0) {
          // Passage au quart suivant automatique
          const updated: Match = prev.quarter < 4 ? {
            ...prev,
            quarter: prev.quarter + 1,
            timerSeconds: 600,
            timerRunning: false,
            timerStartedAt: undefined,
            timerSecondsAtStart: undefined,
            shotClockSeconds: 24,
            shotClockRunning: false,
            shotClockStartedAt: undefined,
            shotClockSecondsAtStart: undefined,
          } : { ...prev, timerSeconds: 0, timerRunning: false, shotClockRunning: false };
          haptics.buzzer();
          saveMatches(getMatches().map(m => m.id === matchId ? updated : m));
          return updated;
        }

        // Shot clock
        let shotSeconds = prev.shotClockSeconds;
        if (prev.shotClockRunning && prev.shotClockStartedAt) {
          const shotElapsed = (now - prev.shotClockStartedAt) / 1000;
          const shotAtStart = prev.shotClockSecondsAtStart ?? prev.shotClockSeconds;
          const shotRemaining = Math.max(0, shotAtStart - shotElapsed);

          if (shotRemaining <= 5 && shotRemaining > 4.5) haptics.shotClockWarning();

          if (shotRemaining <= 0) {
            // Shot clock violation → repart à 24
            haptics.foul();
            const updated: Match = {
              ...prev,
              timerSeconds: Math.round(gameRemaining),
              shotClockSeconds: 24,
              shotClockRunning: true,
              shotClockStartedAt: now,
              shotClockSecondsAtStart: 24,
            };
            saveMatches(getMatches().map(m => m.id === matchId ? updated : m));
            return updated;
          }

          shotSeconds = Math.min(Math.round(shotRemaining), Math.round(gameRemaining));
        }

        const updated: Match = { ...prev, timerSeconds: Math.round(gameRemaining), shotClockSeconds: shotSeconds };
        saveMatches(getMatches().map(m => m.id === matchId ? updated : m));
        return updated;
      });
    }, 250);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match?.timerRunning, match?.timerStartedAt, match?.mode, matchId]);

  // Shot clock géré dans l'effet du game timer ci-dessus

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

  // Stats map for SubstitutionPanel (computed once)
  const currentRoster = activeTeam === 'A' ? match.playersA : match.playersB;
  const statsMap: Record<string, PlayerStats> = {};
  for (const pid of [...match.playersA, ...match.playersB]) {
    statsMap[pid] = computePlayerStats(match.events, pid);
  }

  // Active players on court for current team
  const activePlayersForTeam = activeTeam === 'A'
    ? (match.activePlayersA ?? match.playersA.slice(0, 5))
    : (match.activePlayersB ?? match.playersB.slice(0, 5));

  const toggleTimer = () => {
    const now = Date.now();
    const isStarting = !match.timerRunning;
    persist({
      ...match,
      timerRunning: isStarting,
      timerStartedAt: isStarting ? now : undefined,
      timerSecondsAtStart: isStarting ? match.timerSeconds : undefined,
      // Shot clock suit le chrono
      shotClockRunning: isStarting ? match.shotClockSeconds > 0 : false,
      shotClockStartedAt: isStarting ? now : undefined,
      shotClockSecondsAtStart: isStarting ? match.shotClockSeconds : undefined,
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

  const resetShotClock = () => {
    const now = Date.now();
    persist({
      ...match,
      shotClockSeconds: 24,
      shotClockRunning: match.timerRunning,
      shotClockStartedAt: match.timerRunning ? now : undefined,
      shotClockSecondsAtStart: match.timerRunning ? 24 : undefined,
    });
  };

  const nextQuarter = () => {
    if (match.quarter < 4) {
      haptics.buzzer();
      persist({
        ...match,
        quarter: match.quarter + 1,
        timerRunning: false,
        timerSeconds: 600,
        timerStartedAt: undefined,
        timerSecondsAtStart: undefined,
        shotClockSeconds: 24,
        shotClockRunning: false,
        shotClockStartedAt: undefined,
        shotClockSecondsAtStart: undefined,
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
    if (type === '3pt_made') haptics.threePoints();
    else if (type === 'foul_committed') haptics.foul();
    else if (type.endsWith('_made') || type === 'assist' || type.includes('rebound')) haptics.action();
    const now2 = Date.now();
    persist({
      ...match,
      events: [...match.events, event],
      shotClockSeconds: 24,
      shotClockRunning: match.timerRunning,
      shotClockStartedAt: match.timerRunning ? now2 : undefined,
      shotClockSecondsAtStart: match.timerRunning ? 24 : undefined,
    });
    setSelectedPlayer(null);
  };

  // ── SUBSTITUTIONS ──
  const handleSubIn = (playerId: string) => {
    const teamId = activeTeam === 'A' ? teamAKey : teamBKey;
    const event: MatchEvent = {
      id: generateId(), playerId, teamId, type: 'sub_in',
      quarter: match.quarter, timestamp: Date.now(),
    };
    haptics.action();
    if (activeTeam === 'A') {
      persist({
        ...match,
        events: [...match.events, event],
        activePlayersA: [...(match.activePlayersA ?? match.playersA.slice(0, 5)), playerId],
      });
    } else {
      persist({
        ...match,
        events: [...match.events, event],
        activePlayersB: [...(match.activePlayersB ?? match.playersB.slice(0, 5)), playerId],
      });
    }
  };

  const handleSubOut = (playerId: string) => {
    const teamId = activeTeam === 'A' ? teamAKey : teamBKey;
    const event: MatchEvent = {
      id: generateId(), playerId, teamId, type: 'sub_out',
      quarter: match.quarter, timestamp: Date.now(),
    };
    haptics.action();
    if (activeTeam === 'A') {
      persist({
        ...match,
        events: [...match.events, event],
        activePlayersA: (match.activePlayersA ?? match.playersA.slice(0, 5)).filter(id => id !== playerId),
      });
    } else {
      persist({
        ...match,
        events: [...match.events, event],
        activePlayersB: (match.activePlayersB ?? match.playersB.slice(0, 5)).filter(id => id !== playerId),
      });
    }
    // Deselect if subbed out
    if (selectedPlayer === playerId) setSelectedPlayer(null);
  };

  const addTimeout = () => {
    if (activeTeam === 'A') persist({ ...match, timeoutsA: match.timeoutsA + 1 });
    else persist({ ...match, timeoutsB: match.timeoutsB + 1 });
  };

  const undoLast = () => {
    if (match.events.length === 0) return;
    const lastEvent = match.events[match.events.length - 1];
    haptics.undo();
    // If undoing a sub, also update activePlayersA/B
    let updated = { ...match, events: match.events.slice(0, -1) };
    if (lastEvent.type === 'sub_in') {
      if (lastEvent.teamId === teamAKey) {
        updated.activePlayersA = (updated.activePlayersA ?? []).filter(id => id !== lastEvent.playerId);
      } else {
        updated.activePlayersB = (updated.activePlayersB ?? []).filter(id => id !== lastEvent.playerId);
      }
    } else if (lastEvent.type === 'sub_out') {
      if (lastEvent.teamId === teamAKey) {
        updated.activePlayersA = [...(updated.activePlayersA ?? []), lastEvent.playerId];
      } else {
        updated.activePlayersB = [...(updated.activePlayersB ?? []), lastEvent.playerId];
      }
    }
    persist(updated);
  };

  const endMatch = () => persist({
    ...match, status: 'finished', timerRunning: false, shotClockRunning: false,
  });

  // ── Ajout joueur à la volée ──
  const handleAddPlayer = () => {
    if (!newFirstName.trim()) return;
    const teamId = activeTeam === 'A' ? (match.teamAId || '') : (match.teamBId || '');
    const newPlayer: Player = {
      id: generateId(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim() || '.',
      jerseyNumber: newJersey ? parseInt(newJersey) : undefined,
      teamId,
    };
    if (teamId) {
      const teams = getTeams();
      const updated = teams.map(t =>
        t.id === teamId ? { ...t, players: [...t.players, newPlayer] } : t
      );
      saveTeams(updated);
      setAllPlayers(updated.flatMap(t => t.players));
    }
    const listKey = activeTeam === 'A' ? 'playersA' : 'playersB';
    const activeKey = activeTeam === 'A' ? 'activePlayersA' : 'activePlayersB';
    persist({
      ...match,
      [listKey]: [...match[listKey], newPlayer.id],
      // Nouveaux joueurs commencent sur le banc — à l'entraîneur de les faire rentrer
      [activeKey]: match[activeKey] ?? [],
    });
    setNewFirstName(''); setNewLastName(''); setNewJersey('');
    setShowAddPlayer(false);
  };

  // Pour le mode stats : afficher uniquement les joueurs sur le terrain
  const playersOnCourt = currentRoster.filter(pid =>
    activePlayersForTeam.includes(pid)
  );

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
                ↩
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddPlayer(v => !v)} className="text-primary">
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
              <Button size="lg">Voir le rapport →</Button>
            </Link>
            <Link to="/"><Button size="lg" variant="outline">Accueil</Button></Link>
          </div>
        </div>
      ) : (
        <>
          {/* Add player form */}
          {showAddPlayer && (
            <div className="px-4 mb-2">
              <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Ajouter un joueur</p>
                <div className="flex gap-2">
                  <input
                    type="text" placeholder="Prénom *" value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)} autoFocus
                    className="flex-1 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text" placeholder="Nom" value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    className="flex-1 bg-input rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number" placeholder="#" value={newJersey}
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
            <button type="button"
              onClick={() => { setActiveTeam('A'); setSelectedPlayer(null); }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${activeTeam === 'A' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >{match.teamAName}</button>
            <button type="button"
              onClick={() => { setActiveTeam('B'); setSelectedPlayer(null); }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${activeTeam === 'B' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >{match.teamBName}</button>
          </div>

          {/* Stats / Rotations sub-tabs — uniquement si l'équipe a des joueurs */}
          {currentRoster.length > 0 && (
            <div className="px-4 flex gap-1 mb-2">
              <button type="button"
                onClick={() => setTabMode('stats')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tabMode === 'stats' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
              >📊 Stats</button>
              <button type="button"
                onClick={() => setTabMode('subs')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tabMode === 'subs' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
              >🔄 Rotations ({activePlayersForTeam.length} sur terrain)</button>
            </div>
          )}

          <div className="px-4 flex-1 overflow-y-auto pb-4">
            {/* Équipe B sans joueurs = saisie rapide score adversaire */}
            {activeTeam === 'B' && match.playersB.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">Score adversaire (saisie rapide)</p>
                <div className="flex gap-2">
                  {(['ft_made', '2pt_made', '3pt_made'] as const).map((type) => (
                    <Button key={type} className="flex-1 py-5 text-xl font-black" onClick={() => {
                      const ev: MatchEvent = { id: generateId(), playerId: 'opponent', teamId: teamBKey, type, quarter: match.quarter, timestamp: Date.now() };
                      haptics.action();
                      persist({ ...match, events: [...match.events, ev], shotClockSeconds: 24 });
                    }}>
                      {type === 'ft_made' ? '+1' : type === '2pt_made' ? '+2' : '+3'}
                    </Button>
                  ))}
                </div>
                <button type="button" className="w-full bg-destructive/15 text-destructive rounded-xl py-3 text-sm font-bold border border-destructive/20" onClick={() => {
                  const ev: MatchEvent = { id: generateId(), playerId: 'opponent', teamId: teamBKey, type: 'foul_committed', quarter: match.quarter, timestamp: Date.now() };
                  haptics.foul();
                  persist({ ...match, events: [...match.events, ev] });
                }}>🚫 Faute adverse</button>
                <Button variant="outline" size="sm" onClick={addTimeout} className="w-full">⏱ Temps mort</Button>
              </div>

            ) : tabMode === 'subs' ? (
              /* ── ROTATIONS ── */
              <SubstitutionPanel
                allPlayers={allPlayers}
                activePlayers={activePlayersForTeam}
                allRosterIds={currentRoster}
                statsMap={statsMap}
                onSubIn={handleSubIn}
                onSubOut={handleSubOut}
              />

            ) : (
              /* ── STATS + ACTIONS ── */
              <>
                {/* Afficher joueurs sur terrain en priorité, puis banc en grisé */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Joueurs sur le terrain */}
                  {playersOnCourt.map(pid => {
                    const p = getPlayerById(pid);
                    if (!p) return null;
                    return (
                      <PlayerCard
                        key={pid}
                        player={p}
                        stats={statsMap[pid]}
                        isSelected={selectedPlayer === pid}
                        isOnCourt={true}
                        onSelect={() => setSelectedPlayer(selectedPlayer === pid ? null : pid)}
                      />
                    );
                  })}
                  {/* Joueurs au banc (grisés, sélectionnables pour édition stats) */}
                  {currentRoster.filter(pid => !activePlayersForTeam.includes(pid)).map(pid => {
                    const p = getPlayerById(pid);
                    if (!p) return null;
                    return (
                      <PlayerCard
                        key={pid}
                        player={p}
                        stats={statsMap[pid]}
                        isSelected={selectedPlayer === pid}
                        isOnCourt={false}
                        onSelect={() => setSelectedPlayer(selectedPlayer === pid ? null : pid)}
                      />
                    );
                  })}
                </div>

                {match.events.length > 0 && (
                  <button type="button" onClick={undoLast}
                    className="w-full mb-2 py-2 rounded-xl bg-secondary/50 text-muted-foreground text-xs font-semibold active:scale-95 transition-transform border border-border/40"
                  >↩ Annuler la dernière action</button>
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
