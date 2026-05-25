/**
 * SubstitutionPanel — Gestion des joueurs sur terrain / banc
 * Affiche deux colonnes : Sur le terrain | Au banc
 * Un tap déplace un joueur et crée un event sub_in ou sub_out
 */
import type { Player, PlayerStats } from '@/types/basketball';

interface SubstitutionPanelProps {
  allPlayers: Player[];
  activePlayers: string[];   // IDs des joueurs sur le terrain
  allRosterIds: string[];    // Tous les joueurs inscrits dans le match
  statsMap: Record<string, PlayerStats>;
  onSubIn: (playerId: string) => void;
  onSubOut: (playerId: string) => void;
}

export function SubstitutionPanel({
  allPlayers,
  activePlayers,
  allRosterIds,
  statsMap,
  onSubIn,
  onSubOut,
}: SubstitutionPanelProps) {
  const onCourt = allRosterIds.filter(id => activePlayers.includes(id));
  const onBench = allRosterIds.filter(id => !activePlayers.includes(id));

  const getPlayer = (id: string) => allPlayers.find(p => p.id === id);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-2 text-center text-xs font-bold border-b border-border">
        <div className="py-2 bg-primary/10 text-primary">
          🏀 Terrain ({onCourt.length})
        </div>
        <div className="py-2 bg-secondary text-muted-foreground">
          🪑 Banc ({onBench.length})
        </div>
      </div>

      <div className="grid grid-cols-2 min-h-[80px]">
        {/* Terrain */}
        <div className="border-r border-border p-2 space-y-1.5">
          {onCourt.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3">Vide</p>
          )}
          {onCourt.map(id => {
            const p = getPlayer(id);
            if (!p) return null;
            const stats = statsMap[id];
            const fouls = stats?.foulsCommitted ?? 0;
            const fouledOut = fouls >= 5;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSubOut(id)}
                disabled={fouledOut}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors active:scale-95 ${
                  fouledOut
                    ? 'bg-destructive/10 opacity-50 cursor-not-allowed'
                    : 'bg-primary/10 hover:bg-primary/20'
                }`}
              >
                {p.jerseyNumber !== undefined && (
                  <span className="w-5 h-5 rounded bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center flex-shrink-0">
                    {p.jerseyNumber}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                    {p.firstName} {p.lastName[0]}.
                  </p>
                  <p className={`text-[9px] leading-tight ${fouls >= 4 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                    {stats?.points ?? 0}pts · {fouls}f
                  </p>
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">→🪑</span>
              </button>
            );
          })}
        </div>

        {/* Banc */}
        <div className="p-2 space-y-1.5">
          {onBench.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3">Vide</p>
          )}
          {onBench.map(id => {
            const p = getPlayer(id);
            if (!p) return null;
            const stats = statsMap[id];
            const fouls = stats?.foulsCommitted ?? 0;
            const fouledOut = fouls >= 5;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSubIn(id)}
                disabled={fouledOut}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors active:scale-95 ${
                  fouledOut
                    ? 'bg-destructive/10 opacity-50 cursor-not-allowed'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {p.jerseyNumber !== undefined && (
                  <span className="w-5 h-5 rounded bg-secondary-foreground/20 text-foreground text-[9px] font-black flex items-center justify-center flex-shrink-0">
                    {p.jerseyNumber}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground truncate leading-tight">
                    {p.firstName} {p.lastName[0]}.
                  </p>
                  <p className={`text-[9px] leading-tight ${fouledOut ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                    {fouledOut ? '🚫 DQ' : `${stats?.points ?? 0}pts · ${fouls}f`}
                  </p>
                </div>
                <span className="ml-auto text-[10px] text-primary flex-shrink-0">🏀←</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground text-center py-1.5 border-t border-border">
        Tape un joueur pour le faire entrer / sortir
      </p>
    </div>
  );
}
