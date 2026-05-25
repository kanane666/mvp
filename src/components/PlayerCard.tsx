import type { Player, PlayerStats } from '@/types/basketball';

interface PlayerCardProps {
  player: Player;
  stats: PlayerStats;
  isSelected: boolean;
  onSelect: () => void;
  isOnCourt?: boolean;
}

export function PlayerCard({ player, stats, isSelected, onSelect, isOnCourt = true }: PlayerCardProps) {
  const foulDanger = stats.foulsCommitted >= 4;
  const fouledOut = stats.foulsCommitted >= 5;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={fouledOut}
      className={`p-3 rounded-xl text-left transition-all w-full relative ${
        fouledOut
          ? 'bg-destructive/10 border border-destructive/30 opacity-60 cursor-not-allowed'
          : isSelected
          ? 'bg-primary text-primary-foreground glow-primary-sm'
          : isOnCourt
          ? 'bg-card text-foreground border border-border'
          : 'bg-secondary/50 text-muted-foreground border border-border/50'
      }`}
    >
      {fouledOut && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-destructive bg-destructive/20 rounded px-1">DQ</span>
      )}
      <div className="flex items-center gap-2">
        {player.jerseyNumber !== undefined && (
          <span className={`text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            fouledOut
              ? 'bg-destructive/20 text-destructive'
              : isSelected
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-primary/20 text-primary'
          }`}>
            {player.jerseyNumber}
          </span>
        )}
        <span className="text-sm font-medium truncate">
          {player.firstName} {player.lastName[0]}.
        </span>
      </div>
      <div className="flex gap-2 mt-1 text-[10px] opacity-70">
        <span>{stats.points}pts</span>
        <span>{stats.rebounds}r</span>
        <span>{stats.assists}a</span>
        <span className={foulDanger && !isSelected ? 'text-destructive font-bold opacity-100' : ''}>
          {stats.foulsCommitted}f{foulDanger && !fouledOut ? ' ⚠️' : ''}
        </span>
      </div>
    </button>
  );
}
