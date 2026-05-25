import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { getTeamScore, MATCH_CATEGORY_LABELS, computePlayerStats } from "@/types/basketball";
import { getTopPerformers } from "@/lib/playerStats";
import { getTeams } from "@/lib/storage";
import type { Match, MatchCategory } from "@/types/basketball";

interface Props {
  matches: Match[];
  categories: MatchCategory[];
  emptyLabel?: string;
}

type SortKey = 'date_desc' | 'date_asc' | 'score_desc';

export function MatchListSection({ matches, categories, emptyLabel = "Aucun match" }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>('date_desc');

  const filtered = useMemo(() => {
    const cats = new Set(categories);
    let list = matches.filter(m => m.matchCategory && cats.has(m.matchCategory));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        m.teamAName.toLowerCase().includes(q) ||
        m.teamBName.toLowerCase().includes(q) ||
        new Date(m.createdAt).toLocaleDateString('fr-FR').includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === 'date_asc') return a.createdAt - b.createdAt;
      if (sort === 'score_desc') {
        const sa = getTeamScore(a.events, a.teamAId || 'A') + getTeamScore(a.events, a.teamBId || 'B');
        const sb = getTeamScore(b.events, b.teamAId || 'A') + getTeamScore(b.events, b.teamBId || 'B');
        return sb - sa;
      }
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [matches, categories, search, sort]);

  return (
    <div className="px-5 pb-8 space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Rechercher (adversaire, date...)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-10 rounded-xl text-sm"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="bg-secondary text-secondary-foreground rounded-xl px-3 text-xs font-semibold outline-none"
        >
          <option value="date_desc">Récents</option>
          <option value="date_asc">Anciens</option>
          <option value="score_desc">Plus de points</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        </div>
      ) : (
        filtered.map(m => {
          const sA = getTeamScore(m.events, m.teamAId || 'A');
          const sB = getTeamScore(m.events, m.teamBId || 'B');
          const cat = m.matchCategory;
          const top = getTopPerformers(m);
          const allPlayers = top.topScorer ? getTeams().flatMap(t => t.players) : [];
          const topP = top.topScorer ? allPlayers.find(p => p.id === top.topScorer!.playerId) : null;
          return (
            <Link key={m.id} to="/report/$matchId" params={{ matchId: m.id }} className="block">
              <div className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold text-sm truncate">{m.teamAName}</span>
                  <span className={`font-bold text-lg ${sA >= sB ? 'text-primary' : 'text-foreground'}`}>{sA}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-foreground font-semibold text-sm truncate">{m.teamBName}</span>
                  <span className={`font-bold text-lg ${sB > sA ? 'text-primary' : 'text-foreground'}`}>{sB}</span>
                </div>
                {topP && top.topScorer && top.topScorer.value > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">⭐ Top : {topP.firstName} {topP.lastName[0]}. — {top.topScorer.value} PTS</p>
                )}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex gap-2 items-center min-w-0">
                    <span className="text-[11px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                    {cat && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">{MATCH_CATEGORY_LABELS[cat]}</span>}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${m.status === 'live' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {m.status === 'live' ? 'En cours' : 'Terminé'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
