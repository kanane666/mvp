import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  computeStandings, computeTopPlayers, fetchPublicMatches,
  type PouleStandings, type LeagueTopPlayer,
} from "@/lib/league";
import { getTeams } from "@/lib/storage";
import { currentSeason, DIVISION_LABELS } from "@/types/basketball";
import type { Division, Match } from "@/types/basketball";

export const Route = createFileRoute("/league")({
  component: LeaguePage,
});

const SEASONS = ["2024-2025", "2023-2024", "2022-2023"];
type Tab = "standings" | "scorers" | "rebounders" | "assistants";

function LeaguePage() {
  const [division, setDivision] = useState<Division>("N2");
  const [season, setSeason] = useState(currentSeason());
  const [gender, setGender] = useState<"Masculin" | "Féminin">("Masculin");
  const [tab, setTab] = useState<Tab>("standings");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPublicMatches(division, season).then(ms => {
      setMatches(ms);
      setLoading(false);
    });
  }, [division, season]);

  const teams = getTeams();
  const allPlayers = useMemo(() => teams.flatMap(t => t.players), [teams]);
  const teamNameMap = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach(t => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const standings = useMemo(() =>
    computeStandings(matches, division, season),
    [matches, division, season]
  );

  const { scorers, rebounders, assistants } = useMemo(() =>
    computeTopPlayers(matches, division, season, allPlayers, teamNameMap, 15),
    [matches, division, season, allPlayers, teamNameMap]
  );

  const totalMatches = matches.length;
  const totalTeams = new Set([...standings.flatMap(p => p.rows.map(r => r.teamName))]).size;

  return (
    <div className="min-h-screen bg-background">
      {/* Header public */}
      <div className="bg-card border-b border-border px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏀</span>
            <div>
              <h1 className="text-base font-black text-foreground">MVP Basket Sénégal</h1>
              <p className="text-[10px] text-muted-foreground">Classements officiels</p>
            </div>
          </div>
          <Link to="/">
            <button type="button" className="text-xs text-primary font-semibold px-3 py-1.5 rounded-xl bg-primary/10">
              Mon app →
            </button>
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="px-5 py-3 space-y-2 bg-card border-b border-border">
        {/* Division */}
        <div className="flex gap-2">
          {(["N1", "N2"] as Division[]).map(d => (
            <button
              key={d!}
              type="button"
              onClick={() => setDivision(d)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                division === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {DIVISION_LABELS[d!]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* Genre */}
          {(["Masculin", "Féminin"] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                gender === g
                  ? "bg-secondary text-foreground border border-primary/40"
                  : "bg-secondary/50 text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
          {/* Saison */}
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="flex-1 bg-secondary text-foreground text-xs font-semibold rounded-xl px-2 py-1.5 outline-none border border-border"
          >
            {SEASONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="px-5 py-3 flex gap-4 bg-card border-b border-border">
        <div className="text-center">
          <p className="text-xl font-black text-primary">{totalMatches}</p>
          <p className="text-[10px] text-muted-foreground">Matchs</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-foreground">{totalTeams}</p>
          <p className="text-[10px] text-muted-foreground">Équipes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-foreground">{standings.length}</p>
          <p className="text-[10px] text-muted-foreground">Poules</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-bold text-foreground">{season}</p>
          <p className="text-[10px] text-muted-foreground">Saison</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="px-5 pt-3 pb-1 flex gap-2 overflow-x-auto">
        {([
          { id: "standings", label: "📊 Classement" },
          { id: "scorers",   label: "🏀 Scoreurs" },
          { id: "rebounders", label: "💪 Rebonds" },
          { id: "assistants", label: "🎯 Passes" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-3 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : totalMatches === 0 ? (
          <div className="text-center py-16 space-y-3">
            <span className="text-4xl">📋</span>
            <p className="text-foreground font-semibold">Aucun match disponible</p>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Les matchs apparaissent ici quand les coachs activent l'option "Rendre public" lors de la création du match.
            </p>
          </div>
        ) : tab === "standings" ? (
          <StandingsTab standings={standings} division={division!} />
        ) : tab === "scorers" ? (
          <PlayersTab players={scorers} statLabel="PTS / match" statKey="avgPoints" color="text-primary" />
        ) : tab === "rebounders" ? (
          <PlayersTab players={rebounders} statLabel="REB / match" statKey="avgRebounds" color="text-amber-500" />
        ) : (
          <PlayersTab players={assistants} statLabel="PD / match" statKey="avgAssists" color="text-green-500" />
        )}
      </div>
    </div>
  );
}

// ─── Composant classement par poule ──────────────────────────────────────────
function StandingsTab({ standings, division }: { standings: PouleStandings[]; division: string }) {
  if (standings.length === 0) return null;

  return (
    <div className="space-y-5">
      {standings.map(({ poule, rows }) => (
        <div key={poule} className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Header poule */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/8 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">{poule}</h3>
            <span className="text-[10px] text-primary font-semibold">{division}</span>
          </div>

          {/* Tableau */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60">
                  <th className="text-left py-2 pl-4 pr-2 font-semibold w-5">#</th>
                  <th className="text-left py-2 pr-2 font-semibold">Équipe</th>
                  <th className="py-2 px-2 font-semibold text-center">J</th>
                  <th className="py-2 px-2 font-semibold text-center">V</th>
                  <th className="py-2 px-2 font-semibold text-center">D</th>
                  <th className="py-2 px-2 font-semibold text-center">+/-</th>
                  <th className="py-2 px-2 font-semibold text-center text-primary">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isFirst = i === 0;
                  const isSecond = i === 1;
                  return (
                    <tr
                      key={row.teamName}
                      className={`border-b border-border/30 ${
                        isFirst ? "bg-primary/8" : isSecond ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          isFirst ? "bg-primary text-primary-foreground"
                          : isSecond ? "bg-amber-500 text-white"
                          : "text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div>
                          <p className={`font-semibold ${isFirst ? "text-foreground" : "text-foreground/80"} truncate`} style={{ maxWidth: 130 }}>
                            {row.teamName}
                          </p>
                          {row.clubName && (
                            <p className="text-[9px] text-muted-foreground">{row.clubName}</p>
                          )}
                          {/* Badge pour le leader et 2ème */}
                          {isFirst && (
                            <span className="text-[9px] text-primary font-bold">↑ Tournoi montée</span>
                          )}
                          {isSecond && (
                            <span className="text-[9px] text-amber-500 font-bold">↑ Barrages</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-muted-foreground">{row.played}</td>
                      <td className="py-2.5 px-2 text-center text-green-500 font-semibold">{row.wins}</td>
                      <td className="py-2.5 px-2 text-center text-red-400">{row.losses}</td>
                      <td className={`py-2.5 px-2 text-center font-semibold tabular-nums ${
                        row.differential > 0 ? "text-green-500" : row.differential < 0 ? "text-red-400" : "text-muted-foreground"
                      }`}>
                        {row.differential > 0 ? `+${row.differential}` : row.differential}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-black text-sm tabular-nums ${isFirst ? "text-primary" : "text-foreground"}`}>
                          {row.leaguePoints}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="flex gap-4 px-4 py-2 border-t border-border/40 text-[9px] text-muted-foreground">
            <span><span className="text-primary font-bold">●</span> 1er → Tournoi montée direct</span>
            <span><span className="text-amber-500 font-bold">●</span> 2ème → Barrages</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Composant top joueurs ─────────────────────────────────────────────────────
function PlayersTab({
  players, statLabel, statKey, color,
}: {
  players: LeagueTopPlayer[];
  statLabel: string;
  statKey: keyof LeagueTopPlayer;
  color: string;
}) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Pas encore de données.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map((p, i) => {
        const val = p[statKey] as number;
        const isTop3 = i < 3;
        return (
          <Link key={p.playerId} to="/player/$playerId" params={{ playerId: p.playerId }}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
              isTop3 ? "bg-card border-primary/25" : "bg-card border-border hover:border-primary/30"
            }`}>
              {/* Rang */}
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${
                i === 0 ? "bg-amber-400 text-white"
                : i === 1 ? "bg-zinc-400 text-white"
                : i === 2 ? "bg-amber-700 text-white"
                : "bg-secondary text-muted-foreground"
              }`}>
                {i + 1}
              </span>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{p.playerName}</p>
                <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className="truncate">{p.teamName}</span>
                  <span>·</span>
                  <span>{p.games} match{p.games > 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Stat principale */}
              <div className="text-right flex-shrink-0">
                <p className={`text-xl font-black tabular-nums ${color}`}>
                  {val.toFixed(1)}
                </p>
                <p className="text-[9px] text-muted-foreground">{statLabel}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
