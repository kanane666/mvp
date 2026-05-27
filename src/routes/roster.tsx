import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getTeams, getMatches } from "@/lib/storage";
import { getPlayerCareerStats } from "@/lib/playerStats";
import type { Team, Player } from "@/types/basketball";

export const Route = createFileRoute("/roster")({
  component: RosterPage,
});

const POSITION_LABELS: Record<string, string> = {
  PG: "Meneur", SG: "Arrière", SF: "Ailier", PF: "Ailier fort", C: "Pivot",
};

function RosterPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = getTeams();
    setTeams(t);
    if (t.length > 0) setSelectedTeam(t[0]);
  }, []);

  const filteredPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const q = search.toLowerCase();
    return selectedTeam.players.filter(p =>
      !q ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.jerseyNumber !== undefined && String(p.jerseyNumber).includes(q))
    );
  }, [selectedTeam, search]);

  // Stats rapides pour chaque joueur
  const playerStats = useMemo(() => {
    const map: Record<string, { games: number; avgPts: number; avgReb: number; avgAst: number }> = {};
    if (!selectedTeam) return map;
    for (const p of selectedTeam.players) {
      const career = getPlayerCareerStats(p.id);
      map[p.id] = {
        games: career.games,
        avgPts: career.avg.points,
        avgReb: career.avg.rebounds,
        avgAst: career.avg.assists,
      };
    }
    return map;
  }, [selectedTeam]);

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-5">
        <span className="text-5xl">👥</span>
        <p className="text-foreground font-bold text-lg text-center">Aucune équipe</p>
        <p className="text-muted-foreground text-sm text-center">Crée une équipe d'abord pour gérer tes effectifs.</p>
        <Link to="/teams"><Button>Créer une équipe</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-5 pt-8 pb-3 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground flex-1">Effectifs</h1>
        <Link to="/teams">
          <Button variant="outline" size="sm">⚙ Gérer</Button>
        </Link>
      </header>

      {/* Sélecteur d'équipes en scroll horizontal */}
      <div className="px-5 mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ width: "max-content" }}>
          {teams.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => { setSelectedTeam(team); setSearch(""); }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                selectedTeam?.id === team.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-foreground border border-border hover:border-primary/40"
              }`}
            >
              <div>{team.name}</div>
              <div className={`text-[10px] font-normal mt-0.5 ${selectedTeam?.id === team.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {team.category} · {team.players.length} joueurs
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedTeam && (
        <>
          {/* Info équipe + lien stats */}
          <div className="px-5 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">{selectedTeam.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedTeam.category} · {selectedTeam.gender} · {selectedTeam.players.length} joueurs</p>
            </div>
            <Link to="/stats/team/$teamId" params={{ teamId: selectedTeam.id }}>
              <button type="button" className="text-xs text-primary font-semibold px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors">
                📊 Stats équipe
              </button>
            </Link>
          </div>

          {/* Recherche */}
          {selectedTeam.players.length > 5 && (
            <div className="px-5 mb-3">
              <input
                type="text"
                placeholder="Rechercher un joueur…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Liste joueurs */}
          {filteredPlayers.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-muted-foreground text-sm">
                {search ? "Aucun joueur trouvé." : "Aucun joueur dans cette équipe."}
              </p>
              {!search && (
                <Link to="/teams">
                  <Button variant="outline" size="sm" className="mt-3">Ajouter des joueurs</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="px-5 space-y-2 pb-8">
              {filteredPlayers
                .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
                .map(player => {
                  const stats = playerStats[player.id];
                  return (
                    <Link
                      key={player.id}
                      to="/player/$playerId"
                      params={{ playerId: player.id }}
                      className="block"
                    >
                      <div className="bg-card rounded-2xl border border-border hover:border-primary/40 transition-all active:scale-[0.99] p-4 flex items-center gap-4">
                        {/* Numéro */}
                        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-black text-base">
                            {player.jerseyNumber !== undefined ? `#${player.jerseyNumber}` : "–"}
                          </span>
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-foreground">
                              {player.firstName} {player.lastName}
                            </p>
                            {player.position && (
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-semibold">
                                {POSITION_LABELS[player.position] ?? player.position}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                            {player.height && <span>{player.height}cm</span>}
                            {player.weight && <span>{player.weight}kg</span>}
                            {player.strongHand && <span>{player.strongHand}</span>}
                          </div>
                        </div>

                        {/* Stats rapides */}
                        {stats && stats.games > 0 ? (
                          <div className="flex gap-3 text-center flex-shrink-0">
                            <div>
                              <p className="text-sm font-black text-primary">{stats.avgPts.toFixed(1)}</p>
                              <p className="text-[9px] text-muted-foreground">pts</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{stats.avgReb.toFixed(1)}</p>
                              <p className="text-[9px] text-muted-foreground">reb</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{stats.avgAst.toFixed(1)}</p>
                              <p className="text-[9px] text-muted-foreground">pd</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">Aucun match</span>
                        )}

                        <span className="text-muted-foreground text-sm flex-shrink-0">›</span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
