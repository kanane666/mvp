import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTopPlayersByCategory, type CategoryFilter } from "@/lib/playerStats";
import { getTeams } from "@/lib/storage";
import type { Player } from "@/types/basketball";

export function TopPlayersBanner({ filter }: { filter: CategoryFilter }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [top, setTop] = useState<{ playerId: string; avgPoints: number; games: number }[]>([]);

  useEffect(() => {
    setPlayers(getTeams().flatMap(t => t.players));
    setTop(getTopPlayersByCategory(filter, 3));
  }, [filter]);

  if (top.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <section className="px-5 pt-3 pb-1">
      <h2 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">🌟 Top joueurs</h2>
      <div className="grid grid-cols-3 gap-2">
        {top.map((t, i) => {
          const p = players.find(pp => pp.id === t.playerId);
          if (!p) return null;
          return (
            <Link key={t.playerId} to="/player/$playerId" params={{ playerId: t.playerId }}>
              <div className={`rounded-2xl p-3 border text-center transition-all hover:scale-[1.02] ${
                i === 0
                  ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary/40 glow-primary-sm'
                  : 'bg-gradient-to-br from-card to-card/40 border-border hover:border-primary/30'
              }`}>
                <p className="text-base leading-none">{medals[i]}</p>
                <p className="text-xl font-black text-primary tabular-nums mt-1 leading-none">{t.avgPoints.toFixed(1)}</p>
                <p className="text-[10px] text-foreground truncate mt-1 font-semibold">{p.firstName} {p.lastName[0]}.</p>
                <p className="text-[9px] text-muted-foreground">{t.games} match{t.games > 1 ? 's' : ''}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
