import { useState, useRef, useEffect, useCallback } from 'react';
import type { Match, MatchEvent } from '@/types/basketball';
import { getTeamScore, getTeamFouls } from '@/types/basketball';
import { getMatches, saveMatches, generateId } from '@/lib/storage';
import { haptics, unlockAudio } from '@/hooks/useHaptics';
import { isTeamInBonus } from '@/types/basketball';

const QUARTER_DURATION = 600; // 10 minutes in seconds
const MAX_QUARTERS = 4;

function formatTime(s: number) {
  const clamped = Math.max(0, s);
  const m = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
  match: Match;
  onUpdate: (m: Match) => void;
  onExit: () => void;
}

function InlineEdit({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={() => { if (temp.trim()) onChange(temp.trim()); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { if (temp.trim()) onChange(temp.trim()); setEditing(false); } }}
        className={`bg-transparent border-b-2 border-primary text-center outline-none ${className}`}
        style={{ fontSize: 'inherit' }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setTemp(value); setEditing(true); }} className={`cursor-pointer hover:text-primary transition-colors ${className}`}>
      {value}
    </button>
  );
}

function NumberEdit({ value, onChange, className = '' }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTemp(String(value)); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={() => { onChange(Math.max(0, parseInt(temp) || 0)); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(Math.max(0, parseInt(temp) || 0)); setEditing(false); } }}
        className={`bg-transparent border-b-2 border-primary text-center outline-none w-32 ${className}`}
        style={{ fontSize: 'inherit' }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setTemp(String(value)); setEditing(true); }} className={`cursor-pointer hover:text-primary transition-colors ${className}`}>
      {value}
    </button>
  );
}

export function FullScreenScoreboard({ match, onUpdate, onExit }: Props) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Use refs for timer callbacks to avoid stale closures
  const matchRef = useRef(match);
  matchRef.current = match;

  const persistRef = useRef<(updated: Match) => void>(() => {});

  const persist = useCallback((updated: Match) => {
    onUpdate(updated);
    const matches = getMatches();
    saveMatches(matches.map(m => m.id === match.id ? updated : m));
  }, [match.id, onUpdate]);

  persistRef.current = persist;

  // Detect portrait mode
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Force landscape orientation
  useEffect(() => {
    try {
      const lockOrientation = (screen.orientation as any)?.lock;
      if (lockOrientation) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {}
    return () => {
      try { screen.orientation?.unlock?.(); } catch {}
    };
  }, []);

  // Unlock audio on mount
  useEffect(() => { unlockAudio(); }, []);

  // ── Timer unifié : chrono + shot clock synchronisés ──────────────────────────
  // Le shot clock est ESCLAVE du chrono : même startedAt, s'arrête/repart ensemble.
  // Les deux décomptent depuis le même instant de référence.
  useEffect(() => {
    if (!match.timerRunning) return;

    const startedAt     = match.timerStartedAt ?? Date.now();
    const gameAtStart   = match.timerSecondsAtStart ?? match.timerSeconds;
    // Shot clock : si running, utilise son propre seconsdAtStart, sinon figé
    const shotAtStart   = match.shotClockSecondsAtStart ?? match.shotClockSeconds;
    const shotWasRunning = match.shotClockRunning;

    const id = setInterval(() => {
      const m = matchRef.current;
      const elapsed = (Date.now() - startedAt) / 1000;

      // ── Game clock ──
      const gameRemaining = Math.max(0, gameAtStart - elapsed);

      if (gameRemaining <= 0) {
        // Fin de quart-temps
        if (m.quarter < MAX_QUARTERS) {
          haptics.buzzer();
          persistRef.current({
            ...m,
            quarter: m.quarter + 1,
            timerSeconds: QUARTER_DURATION,
            timerRunning: false,
            timerStartedAt: undefined,
            timerSecondsAtStart: undefined,
            shotClockSeconds: 24,
            shotClockRunning: false,
            shotClockStartedAt: undefined,
            shotClockSecondsAtStart: undefined,
          });
        } else {
          haptics.buzzer();
          persistRef.current({
            ...m,
            timerSeconds: 0,
            timerRunning: false,
            shotClockRunning: false,
          });
        }
        return;
      }

      // ── Shot clock (synchronisé au même elapsed) ──
      let shotRemaining = m.shotClockSeconds;
      if (shotWasRunning) {
        shotRemaining = Math.max(0, shotAtStart - elapsed);
        if (shotRemaining <= 5 && shotRemaining > 4.5) haptics.shotClockWarning();
      }

      // Shot clock ne peut pas dépasser le game clock
      const syncedShot = Math.min(Math.round(shotRemaining), Math.round(gameRemaining));

      persistRef.current({
        ...m,
        timerSeconds: Math.round(gameRemaining),
        shotClockSeconds: shotWasRunning ? syncedShot : m.shotClockSeconds,
      });
    }, 250); // 250ms pour plus de fluidité

    return () => clearInterval(id);
  }, [match.timerRunning, match.timerStartedAt]);

  const teamAKey = match.teamAId || 'A';
  const teamBKey = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, teamAKey);
  const scoreB = getTeamScore(match.events, teamBKey);
  const foulsA = getTeamFouls(match.events, teamAKey, match.quarter);
  const foulsB = getTeamFouls(match.events, teamBKey, match.quarter);

  const addScore = (team: 'A' | 'B', points: 1 | 2 | 3) => {
    if (points === 3) haptics.threePoints(); else haptics.action();
    const teamId = team === 'A' ? teamAKey : teamBKey;
    const type = points === 1 ? 'ft_made' : points === 2 ? '2pt_made' : '3pt_made';
    const event: MatchEvent = {
      id: generateId(), playerId: 'team', teamId, type, quarter: match.quarter, timestamp: Date.now(),
    };
    const now = Date.now();
    persist({
      ...match,
      events: [...match.events, event],
      shotClockSeconds: 24,
      shotClockRunning: match.timerRunning, // repart si le chrono tourne
      shotClockStartedAt: match.timerRunning ? now : undefined,
      shotClockSecondsAtStart: match.timerRunning ? 24 : undefined,
    });
  };

  const addFoul = (team: 'A' | 'B') => {
    haptics.foul();
    const teamId = team === 'A' ? teamAKey : teamBKey;
    const event: MatchEvent = {
      id: generateId(), playerId: 'team', teamId, type: 'foul_committed', quarter: match.quarter, timestamp: Date.now(),
    };
    persist({ ...match, events: [...match.events, event] });
  };

  const undoLast = () => {
    if (match.events.length === 0) return;
    persist({ ...match, events: match.events.slice(0, -1) });
  };

  const setManualScore = (team: 'A' | 'B', target: number) => {
    const teamId = team === 'A' ? teamAKey : teamBKey;
    const current = team === 'A' ? scoreA : scoreB;
    if (target === current) return;
    const otherEvents = match.events.filter(e => {
      if (e.teamId !== teamId) return true;
      return !['2pt_made', '3pt_made', 'ft_made'].includes(e.type);
    });
    const newEvents = [...otherEvents];
    for (let i = 0; i < target; i++) {
      newEvents.push({ id: generateId(), playerId: 'team', teamId, type: 'ft_made', quarter: match.quarter, timestamp: Date.now() });
    }
    // If a basket was added (target > current), reset shot clock to 24
    const shouldReset = target > current;
    persist({ ...match, events: newEvents, ...(shouldReset ? { shotClockSeconds: 24 } : {}) });
  };

  const nextQuarter = () => {
    if (match.quarter < 4) {
      persist({
        ...match,
        quarter: match.quarter + 1,
        timerSeconds: QUARTER_DURATION,
        timerRunning: false,
        shotClockSeconds: 24,
        shotClockRunning: false,
      });
    }
  };

  const resetTimer = () => {
    persist({ ...match, timerSeconds: QUARTER_DURATION, timerRunning: false });
  };

  const endMatch = () => {
    persist({ ...match, status: 'finished', timerRunning: false, shotClockRunning: false });
    onExit();
  };

  // Edit timer manually (parse MM:SS input)
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const timerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingTimer) timerInputRef.current?.focus(); }, [editingTimer]);

  const startEditTimer = () => {
    if (match.timerRunning) return; // don't edit while running
    setTimerInput(formatTime(match.timerSeconds));
    setEditingTimer(true);
  };

  const commitTimer = () => {
    const parts = timerInput.split(':');
    let seconds = 0;
    if (parts.length === 2) {
      seconds = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    } else {
      seconds = parseInt(timerInput) || 0;
    }
    persist({ ...match, timerSeconds: Math.min(Math.max(0, seconds), 5999) });
    setEditingTimer(false);
  };

  // Portrait rotation style
  const portraitStyle: React.CSSProperties = isPortrait ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: `${window.innerHeight}px`,
    height: `${window.innerWidth}px`,
    transform: `rotate(90deg) translateY(-100%)`,
    transformOrigin: 'top left',
    zIndex: 50,
    touchAction: 'manipulation',
    backgroundColor: 'oklch(0.06 0.005 250)',
  } : {
    touchAction: 'manipulation',
    backgroundColor: 'oklch(0.06 0.005 250)',
  };

  return (
    <div
      className={isPortrait ? 'flex flex-col select-none overflow-hidden' : 'fixed inset-0 z-50 flex flex-col select-none overflow-hidden'}
      style={portraitStyle}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ backgroundColor: 'oklch(0.04 0.005 250)' }}>
        <button type="button" onClick={onExit} className="text-muted-foreground font-semibold px-4 py-2.5 rounded-xl hover:bg-secondary active:scale-95 text-sm min-h-[44px]">
          ✕ Quitter
        </button>
        <span className="text-xs text-muted-foreground font-mono tracking-wider">MVP</span>
        <button
          onClick={undoLast}
          disabled={match.events.length === 0}
          className="text-muted-foreground font-semibold px-4 py-2.5 rounded-xl hover:bg-secondary active:scale-95 text-sm min-h-[44px] disabled:opacity-30 disabled:active:scale-100"
        >
          ↩ Annuler
        </button>
      </div>

      {/* Main scoreboard area */}
      <div className="flex-1 flex min-h-0">
        {/* TEAM A */}
        <TeamSide
          name={match.teamAName}
          score={scoreA}
          fouls={foulsA}
          bonus={isTeamInBonus(match.events, match.teamAId || 'A', match.quarter)}
          timeouts={match.timeoutsA}
          onNameChange={v => persist({ ...match, teamAName: v })}
          onScoreChange={v => setManualScore('A', v)}
          onAddScore={pts => addScore('A', pts)}
          onAddFoul={() => addFoul('A')}
          onTimeout={() => persist({ ...match, timeoutsA: match.timeoutsA + 1 })}
        />

        {/* CENTER PANEL */}
        <div className="w-28 sm:w-36 flex flex-col items-center justify-center gap-2 shrink-0 py-2" style={{ borderLeft: '1px solid oklch(0.2 0 0 / 0.3)', borderRight: '1px solid oklch(0.2 0 0 / 0.3)' }}>
          {/* Quarter */}
          <button
            onClick={nextQuarter}
            disabled={match.quarter >= 4}
            className="bg-primary/20 text-primary font-black text-base rounded-xl px-4 py-2 active:scale-90 min-h-[40px] min-w-[60px] disabled:opacity-40 disabled:active:scale-100"
          >
            QT{match.quarter}
          </button>

          {/* Game clock - COUNTDOWN (tap to play/pause, long press to edit) */}
          {editingTimer ? (
            <div className="flex flex-col items-center">
              <input
                ref={timerInputRef}
                value={timerInput}
                onChange={e => setTimerInput(e.target.value)}
                onBlur={commitTimer}
                onKeyDown={e => { if (e.key === 'Enter') commitTimer(); }}
                className="text-3xl sm:text-4xl font-mono font-black tabular-nums text-center bg-transparent border-b-2 border-primary outline-none w-28 text-foreground"
                placeholder="MM:SS"
              />
              <span className="text-xs text-primary mt-1">Entrer MM:SS</span>
            </div>
          ) : (
            <button
              onClick={() => {
                  const isStarting = !match.timerRunning;
                  const now = Date.now();
                  persist({
                    ...match,
                    timerRunning: isStarting,
                    timerStartedAt: isStarting ? now : undefined,
                    timerSecondsAtStart: isStarting ? match.timerSeconds : undefined,
                    // Shot clock suit le chrono : démarre/s'arrête en même temps
                    shotClockRunning: isStarting ? match.shotClockSeconds > 0 : false,
                    shotClockStartedAt: isStarting ? now : undefined,
                    shotClockSecondsAtStart: isStarting ? match.shotClockSeconds : undefined,
                  });
                }}
              onDoubleClick={startEditTimer}
              className="flex flex-col items-center active:scale-95"
            >
              <span className={`text-3xl sm:text-4xl font-mono font-black tabular-nums leading-tight ${match.timerSeconds <= 60 && match.timerSeconds > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatTime(match.timerSeconds)}
              </span>
              <span className={`text-xs font-bold mt-1 ${match.timerRunning ? 'text-green-400' : 'text-muted-foreground'}`}>
                {match.timerRunning ? '▶ RUN' : '⏸ STOP'}
              </span>
            </button>
          )}

          {/* Shot clock */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                  // Shot clock indépendant seulement si chrono arrêté
                  if (match.timerRunning) return;
                  const isStarting = !match.shotClockRunning;
                  const now = Date.now();
                  persist({
                    ...match,
                    shotClockRunning: isStarting,
                    shotClockStartedAt: isStarting ? now : undefined,
                    shotClockSecondsAtStart: isStarting ? match.shotClockSeconds : undefined,
                  });
                }}
              className={`text-2xl sm:text-3xl font-mono font-black tabular-nums rounded-xl px-3 py-1.5 min-h-[44px] min-w-[56px] active:scale-90 ${match.shotClockSeconds <= 5 ? 'text-destructive bg-destructive/15' : 'text-foreground bg-secondary/50'}`}
            >
              {match.shotClockSeconds}
            </button>
            <button
              onClick={() => {
                const now = Date.now();
                persist({
                  ...match,
                  shotClockSeconds: 24,
                  // Si le chrono tourne, les 24s repartent immédiatement
                  shotClockRunning: match.timerRunning,
                  shotClockStartedAt: match.timerRunning ? now : undefined,
                  shotClockSecondsAtStart: match.timerRunning ? 24 : undefined,
                });
              }}
              className="text-xs text-muted-foreground mt-1 hover:text-primary active:scale-90 min-h-[32px] px-2"
            >
              ↻ 24s
            </button>
          </div>

          {/* Reset timer */}
          <button
            onClick={resetTimer}
            className="text-xs text-muted-foreground hover:text-primary min-h-[32px] px-2 active:scale-90"
          >
            ↻ Timer
          </button>

          {/* End match */}
          {!confirmEnd ? (
            <button
              onClick={() => setConfirmEnd(true)}
              className="mt-auto bg-destructive/15 text-destructive font-bold rounded-xl px-4 py-3 text-sm active:scale-95 min-h-[48px] w-full"
            >
              Terminer
            </button>
          ) : (
            <div className="mt-auto flex flex-col gap-2 w-full px-1">
              <button
                onClick={endMatch}
                className="bg-destructive text-destructive-foreground font-bold rounded-xl px-3 py-3.5 text-base active:scale-95 min-h-[52px] w-full"
              >
                ✓ Confirmer
              </button>
              <button
                onClick={() => setConfirmEnd(false)}
                className="bg-secondary text-muted-foreground font-semibold text-sm py-2.5 rounded-xl min-h-[40px] active:scale-95 w-full"
              >
                ✕ Annuler
              </button>
            </div>
          )}
        </div>

        {/* TEAM B */}
        <TeamSide
          name={match.teamBName}
          score={scoreB}
          fouls={foulsB}
          bonus={isTeamInBonus(match.events, match.teamBId || 'B', match.quarter)}
          timeouts={match.timeoutsB}
          onNameChange={v => persist({ ...match, teamBName: v })}
          onScoreChange={v => setManualScore('B', v)}
          onAddScore={pts => addScore('B', pts)}
          onAddFoul={() => addFoul('B')}
          onTimeout={() => persist({ ...match, timeoutsB: match.timeoutsB + 1 })}
        />
      </div>
    </div>
  );
}

interface TeamSideProps {
  name: string;
  score: number;
  fouls: number;
  bonus: boolean;
  timeouts: number;
  onNameChange: (v: string) => void;
  onScoreChange: (v: number) => void;
  onAddScore: (pts: 1 | 2 | 3) => void;
  onAddFoul: () => void;
  onTimeout: () => void;
}

function TeamSide({ name, score, fouls, bonus, timeouts, onNameChange, onScoreChange, onAddScore, onAddFoul, onTimeout }: TeamSideProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 py-3">
      <InlineEdit
        value={name}
        onChange={onNameChange}
        className="text-base sm:text-lg font-bold text-foreground uppercase tracking-wider max-w-full truncate min-h-[40px] flex items-center"
      />

      <NumberEdit
        value={score}
        onChange={onScoreChange}
        className="text-[80px] sm:text-[100px] lg:text-[120px] font-black text-foreground leading-none tabular-nums"
      />

      <div className="flex gap-2 mt-1">
        <button type="button" onClick={() => onAddScore(1)} className="bg-primary/20 hover:bg-primary/30 text-primary font-bold rounded-2xl px-5 py-3 text-xl active:scale-90 transition-transform min-h-[52px] min-w-[60px]">+1</button>
        <button type="button" onClick={() => onAddScore(2)} className="bg-primary/30 hover:bg-primary/40 text-primary font-bold rounded-2xl px-5 py-3 text-xl active:scale-90 transition-transform min-h-[52px] min-w-[60px]">+2</button>
        <button type="button" onClick={() => onAddScore(3)} className="bg-primary/40 hover:bg-primary/50 text-primary font-bold rounded-2xl px-5 py-3 text-xl active:scale-90 transition-transform min-h-[52px] min-w-[60px]">+3</button>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button type="button" onClick={onAddFoul} className={`text-sm font-semibold rounded-xl px-4 py-2.5 active:scale-90 transition-transform min-h-[44px] ${bonus ? "text-destructive bg-destructive/20 animate-pulse border border-destructive/40" : "text-destructive bg-destructive/10"}`}>
          🚫 Faute <span className="ml-1 font-bold">{fouls}</span>{bonus && <span className="ml-1 text-[10px]">BONUS</span>}
        </button>
        <button
          onClick={onTimeout}
          className="text-sm text-muted-foreground bg-secondary rounded-xl px-4 py-2.5 active:scale-90 transition-transform min-h-[44px]"
        >
          TO: {timeouts}
        </button>
      </div>
    </div>
  );
}
