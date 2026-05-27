import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getTeams } from "@/lib/storage";
import { getPlayerCareerStats } from "@/lib/playerStats";
import type { Team, Player } from "@/types/basketball";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/stats/compare")({
  component: ComparePage,
});

function pct(made: number, att: number) {
  return att > 0 ? Math.round((made / att) * 100) : 0;
}
function fmt(n: number) { return n.toFixed(1); }

function ComparePage() {
  const [allPlayers, setAllPlayers] = useState<{ player: Player; teamName: string }[]>([]);
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);

  useEffect(() => {
    const teams = getTeams();
    const list = teams.flatMap(t => t.players.map(p => ({ player: p, teamName: t.name })));
    setAllPlayers(list);
  }, []);

  const careerA = useMemo(() => idA ? getPlayerCareerStats(idA) : null, [idA]);
  const careerB = useMemo(() => idB ? getPlayerCareerStats(idB) : null, [idB]);

  const infoA = allPlayers.find(p => p.player.id === idA);
  const infoB = allPlayers.find(p => p.player.id === idB);

  const filteredA = useMemo(() => {
    const q = searchA.toLowerCase();
    return allPlayers.filter(p =>
      p.player.id !== idB &&
      (!q || `${p.player.firstName} ${p.player.lastName}`.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q))
    );
  }, [allPlayers, searchA, idB]);

  const filteredB = useMemo(() => {
    const q = searchB.toLowerCase();
    return allPlayers.filter(p =>
      p.player.id !== idA &&
      (!q || `${p.player.firstName} ${p.player.lastName}`.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q))
    );
  }, [allPlayers, searchB, idA]);

  // Données pour le radar chart (normalisées sur 100)
  const radarData = useMemo(() => {
    if (!careerA || !careerB) return [];
    // Normaliser chaque stat par rapport au maximum des deux joueurs
    const normalize = (a: number, b: number) => {
      const max = Math.max(a, b, 0.01);
      return { a: Math.round((a / max) * 100), b: Math.round((b / max) * 100) };
    };
    const pts  = normalize(careerA.avg.points, careerB.avg.points);
    const reb  = normalize(careerA.avg.rebounds, careerB.avg.rebounds);
    const ast  = normalize(careerA.avg.assists, careerB.avg.assists);
    const stl  = normalize(careerA.avg.steals, careerB.avg.steals);
    const blk  = normalize(careerA.avg.blocks, careerB.avg.blocks);
    const fgp  = normalize(pct(careerA.totals.fgMade, careerA.totals.fgAttempted), pct(careerB.totals.fgMade, careerB.totals.fgAttempted));
    const eff  = normalize(Math.max(0, careerA.efficiency), Math.max(0, careerB.efficiency));
    return [
      { stat: "Points",   A: pts.a,  B: pts.b,  rawA: fmt(careerA.avg.points),   rawB: fmt(careerB.avg.points) },
      { stat: "Rebonds",  A: reb.a,  B: reb.b,  rawA: fmt(careerA.avg.rebounds), rawB: fmt(careerB.avg.rebounds) },
      { stat: "Passes",   A: ast.a,  B: ast.b,  rawA: fmt(careerA.avg.assists),  rawB: fmt(careerB.avg.assists) },
      { stat: "Inter.",   A: stl.a,  B: stl.b,  rawA: fmt(careerA.avg.steals),   rawB: fmt(careerB.avg.steals) },
      { stat: "Contres",  A: blk.a,  B: blk.b,  rawA: fmt(careerA.avg.blocks),   rawB: fmt(careerB.avg.blocks) },
      { stat: "FG%",      A: fgp.a,  B: fgp.b,  rawA: `${pct(careerA.totals.fgMade, careerA.totals.fgAttempted)}%`, rawB: `${pct(careerB.totals.fgMade, careerB.totals.fgAttempted)}%` },
      { stat: "Efficacité", A: eff.a, B: eff.b, rawA: careerA.efficiency > 0 ? `+${careerA.efficiency}` : String(careerA.efficiency), rawB: careerB.efficiency > 0 ? `+${careerB.efficiency}` : String(careerB.efficiency) },
    ];
  }, [careerA, careerB]);

  const nameA = infoA ? `${infoA.player.firstName} ${infoA.player.lastName[0]}.` : "Joueur A";
  const nameB = infoB ? `${infoB.player.firstName} ${infoB.player.lastName[0]}.` : "Joueur B";

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/stats"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground">Comparer des joueurs</h1>
      </header>

      {/* Sélecteurs */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-5">
        <PlayerSelector
          label="Joueur A"
          color="#7c6ff5"
          selected={infoA ?? null}
          search={searchA}
          onSearch={setSearchA}
          open={openA}
          onToggle={() => { setOpenA(v => !v); setOpenB(false); }}
          players={filteredA}
          onSelect={p => { setIdA(p.id); setOpenA(false); setSearchA(""); }}
        />
        <PlayerSelector
          label="Joueur B"
          color="#ef4444"
          selected={infoB ?? null}
          search={searchB}
          onSearch={setSearchB}
          open={openB}
          onToggle={() => { setOpenB(v => !v); setOpenA(false); }}
          players={filteredB}
          onSelect={p => { setIdB(p.id); setOpenB(false); setSearchB(""); }}
        />
      </div>

      {/* Radar chart */}
      {idA && idB && careerA && careerB && radarData.length > 0 ? (
        <>
          <div className="px-5 mb-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Valeurs normalisées (100 = meilleur des deux sur chaque stat)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="rgba(128,128,160,0.2)" />
                  <PolarAngleAxis
                    dataKey="stat"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground, #888)" }}
                  />
                  <Radar
                    name={nameA}
                    dataKey="A"
                    stroke="#7c6ff5"
                    fill="#7c6ff5"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Radar
                    name={nameB}
                    dataKey="B"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value) => (
                      <span style={{ color: "var(--foreground, #fff)", fontSize: 12 }}>{value}</span>
                    )}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tableau comparatif */}
          <div className="px-5 mb-4">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 text-[11px] font-bold border-b border-border">
                <div className="py-3 px-4 text-left" style={{ color: "#7c6ff5" }}>{nameA}</div>
                <div className="py-3 px-2 text-center text-muted-foreground">Stat</div>
                <div className="py-3 px-4 text-right" style={{ color: "#ef4444" }}>{nameB}</div>
              </div>
              {/* Lignes */}
              {radarData.map((row, i) => {
                const aWins = parseFloat(row.rawA) > parseFloat(row.rawB);
                const bWins = parseFloat(row.rawB) > parseFloat(row.rawA);
                return (
                  <div key={row.stat} className={`grid grid-cols-3 text-sm border-b border-border/40 ${i % 2 === 0 ? "" : "bg-secondary/20"}`}>
                    <div className={`py-2.5 px-4 font-bold tabular-nums ${aWins ? "text-primary" : "text-foreground"}`}>
                      {row.rawA}
                    </div>
                    <div className="py-2.5 px-2 text-center text-[11px] text-muted-foreground font-semibold">
                      {row.stat}
                    </div>
                    <div className={`py-2.5 px-4 font-bold tabular-nums text-right ${bWins ? "text-red-500" : "text-foreground"}`}>
                      {row.rawB}
                    </div>
                  </div>
                );
              })}
              {/* Matchs joués */}
              <div className="grid grid-cols-3 text-sm py-2.5">
                <div className="px-4 text-muted-foreground tabular-nums">{careerA.games} matchs</div>
                <div className="px-2 text-center text-[11px] text-muted-foreground font-semibold">Matchs</div>
                <div className="px-4 text-right text-muted-foreground tabular-nums">{careerB.games} matchs</div>
              </div>
            </div>
          </div>

          {/* Liens vers profils */}
          <div className="px-5 grid grid-cols-2 gap-3">
            <Link to="/player/$playerId" params={{ playerId: idA }}>
              <button type="button" className="w-full py-2.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95">
                Profil de {nameA} →
              </button>
            </Link>
            <Link to="/player/$playerId" params={{ playerId: idB }}>
              <button type="button" className="w-full py-2.5 rounded-xl text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors active:scale-95">
                Profil de {nameB} →
              </button>
            </Link>
          </div>
        </>
      ) : (
        <div className="px-5 flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3">⚖️</span>
          <p className="text-foreground font-semibold">Sélectionne deux joueurs</p>
          <p className="text-muted-foreground text-sm mt-1">
            Choisis un Joueur A et un Joueur B pour voir leur comparaison.
          </p>
          {allPlayers.length === 0 && (
            <Link to="/teams" className="mt-4">
              <Button variant="outline" size="sm">Créer des joueurs d'abord</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant sélecteur de joueur ────────────────────────────────────────────
function PlayerSelector({
  label, color, selected, search, onSearch, open, onToggle, players, onSelect,
}: {
  label: string;
  color: string;
  selected: { player: Player; teamName: string } | null;
  search: string;
  onSearch: (v: string) => void;
  open: boolean;
  onToggle: () => void;
  players: { player: Player; teamName: string }[];
  onSelect: (p: Player) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left bg-card border border-border rounded-2xl p-3 hover:border-primary/40 transition-colors active:scale-[0.98]"
        style={{ borderColor: selected ? color + "60" : undefined }}
      >
        <p className="text-[10px] font-semibold mb-1" style={{ color }}>{label}</p>
        {selected ? (
          <>
            <p className="text-sm font-bold text-foreground truncate">
              {selected.player.firstName} {selected.player.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{selected.teamName}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Choisir…</p>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-2xl shadow-lg overflow-hidden" style={{ maxHeight: 260 }}>
          <div className="p-2 border-b border-border">
            <input
              type="text"
              autoFocus
              placeholder="Rechercher…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="w-full bg-background rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {players.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun joueur</p>
            ) : (
              players.slice(0, 30).map(({ player, teamName }) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onSelect(player)}
                  className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {player.jerseyNumber !== undefined && (
                      <span className="text-[10px] font-bold text-primary w-5 text-center">#{player.jerseyNumber}</span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{teamName}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
