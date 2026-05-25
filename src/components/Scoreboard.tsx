import type { Match } from '@/types/basketball';
import { getTeamScore, getTeamFouls, isTeamInBonus } from '@/types/basketball';

interface ScoreboardProps {
  match: Match;
  onToggleTimer: () => void;
  onToggleShotClock: () => void;
  onResetShotClock: () => void;
  onNextQuarter: () => void;
}

function formatTime(s: number) {
  const clamped = Math.max(0, s);
  const m = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function Scoreboard({ match, onToggleTimer, onToggleShotClock, onResetShotClock, onNextQuarter }: ScoreboardProps) {
  const teamAId = match.teamAId || 'A';
  const teamBId = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, teamAId);
  const scoreB = getTeamScore(match.events, teamBId);
  const foulsA = getTeamFouls(match.events, teamAId, match.quarter);
  const foulsB = getTeamFouls(match.events, teamBId, match.quarter);
  const bonusA = isTeamInBonus(match.events, teamAId, match.quarter);
  const bonusB = isTeamInBonus(match.events, teamBId, match.quarter);
  const shotClockUrgent = match.shotClockSeconds <= 5;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      {/* Score */}
      <div className="flex items-center justify-between">
        {/* Team A */}
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground mb-1 truncate px-1">{match.teamAName}</p>
          <p className="text-5xl font-bold text-foreground">{scoreA}</p>
          <div className="flex justify-center items-center gap-2 mt-1">
            <span className={`text-xs font-semibold ${bonusA ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
              {foulsA}f {bonusA && '🚨'}
            </span>
            <span className="text-xs text-muted-foreground">{match.timeoutsA}TO</span>
          </div>
          {bonusA && (
            <p className="text-[9px] text-destructive font-bold mt-0.5 animate-pulse">BONUS LF</p>
          )}
        </div>

        {/* Center */}
        <div className="text-center px-3 flex-shrink-0">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
            QT{match.quarter}
          </span>
          <button type="button" onClick={onToggleTimer} className="block mt-1">
            <span className={`text-2xl font-mono font-bold ${match.timerSeconds <= 60 && match.timerSeconds > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatTime(match.timerSeconds)}
            </span>
          </button>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {match.timerRunning ? '▶ En cours' : '⏸ Pause'}
          </p>
          {/* Shot clock */}
          <button
            type="button"
            onClick={onToggleShotClock}
            onDoubleClick={onResetShotClock}
            className={`mt-1 rounded-lg px-3 py-1 ${shotClockUrgent ? 'bg-destructive/20 animate-pulse' : 'bg-secondary'}`}
          >
            <span className={`text-lg font-mono font-bold ${shotClockUrgent ? 'text-destructive' : 'text-foreground'}`}>
              {match.shotClockSeconds}
            </span>
          </button>
          <p className="text-[9px] text-muted-foreground">24s</p>
        </div>

        {/* Team B */}
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground mb-1 truncate px-1">{match.teamBName}</p>
          <p className="text-5xl font-bold text-foreground">{scoreB}</p>
          <div className="flex justify-center items-center gap-2 mt-1">
            <span className={`text-xs font-semibold ${bonusB ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
              {foulsB}f {bonusB && '🚨'}
            </span>
            <span className="text-xs text-muted-foreground">{match.timeoutsB}TO</span>
          </div>
          {bonusB && (
            <p className="text-[9px] text-destructive font-bold mt-0.5 animate-pulse">BONUS LF</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onToggleTimer} className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-xl text-xs font-semibold">
          {match.timerRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        <button type="button" onClick={onResetShotClock} className="bg-secondary text-secondary-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          ↻ 24s
        </button>
        <button
          type="button"
          onClick={onNextQuarter}
          disabled={match.quarter >= 4}
          className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
        >
          QT suivant →
        </button>
      </div>
    </div>
  );
}
