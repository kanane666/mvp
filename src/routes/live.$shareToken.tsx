import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { fetchMatchByToken } from "@/lib/league";
import { getTeamScore, getTeamFouls, isTeamInBonus, DIVISION_LABELS } from "@/types/basketball";
import type { Match } from "@/types/basketball";

export const Route = createFileRoute("/live/$shareToken")({
  component: LivePublicPage,
});

const POLL_INTERVAL = 15_000; // 15 secondes

function formatTimer(s: number) {
  const c = Math.max(0, s);
  return `${Math.floor(c / 60).toString().padStart(2, "0")}:${(c % 60).toString().padStart(2, "0")}`;
}

function LivePublicPage() {
  const { shareToken } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const m = await fetchMatchByToken(shareToken);
    if (!m) { setNotFound(true); setLoading(false); return; }
    setMatch(m);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Chargement du match…</p>
        </div>
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="text-center space-y-3">
          <span className="text-5xl">🏀</span>
          <p className="text-foreground font-bold text-lg">Match introuvable</p>
          <p className="text-muted-foreground text-sm">Le lien est incorrect ou le match n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  const idA = match.teamAId || "A";
  const idB = match.teamBId || "B";
  const scoreA = getTeamScore(match.events, idA);
  const scoreB = getTeamScore(match.events, idB);
  const foulsA = getTeamFouls(match.events, idA, match.quarter);
  const foulsB = getTeamFouls(match.events, idB, match.quarter);
  const bonusA = isTeamInBonus(match.events, idA, match.quarter);
  const bonusB = isTeamInBonus(match.events, idB, match.quarter);
  const isLive = match.status === "live";

  // Derniers events (5 max)
  const lastEvents = [...match.events]
    .filter(e => !["sub_in", "sub_out", "timeout"].includes(e.type))
    .slice(-8)
    .reverse();

  const eventLabel: Record<string, string> = {
    "2pt_made": "🏀 +2", "3pt_made": "🎯 +3", "ft_made": "✅ +1",
    "2pt_missed": "❌ 2pts raté", "3pt_missed": "❌ 3pts raté", "ft_missed": "❌ LF raté",
    "assist": "🎯 Passe décisive", "off_rebound": "↑ Reb. offensif", "def_rebound": "↓ Reb. défensif",
    "block": "🖐 Contre", "steal": "🔄 Interception", "turnover": "💔 Perte de balle",
    "foul_committed": "🚫 Faute",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏀</span>
          <div>
            <p className="text-xs font-bold text-foreground">MVP Basket Sénégal</p>
            {match.division && (
              <p className="text-[10px] text-primary">{DIVISION_LABELS[match.division]} {match.poule ? `· ${match.poule}` : ""}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              EN DIRECT
            </span>
          ) : (
            <span className="text-xs text-muted-foreground font-semibold">Terminé</span>
          )}
          {lastUpdate && (
            <p className="text-[9px] text-muted-foreground mt-0.5">
              MAJ {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Scoreboard principal */}
      <div className="px-5 py-6">
        <div className="bg-card rounded-3xl border border-border p-6 text-center">
          {/* Quart temps + chrono */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-xs font-bold text-primary bg-primary/15 px-3 py-1 rounded-full">
              QT {match.quarter}
            </span>
            {match.timerSeconds > 0 && (
              <span className="text-sm font-mono font-bold text-foreground">
                {formatTimer(match.timerSeconds)}
              </span>
            )}
            {match.shotClockSeconds <= 24 && match.shotClockSeconds > 0 && (
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                match.shotClockSeconds <= 5 ? "bg-red-500/20 text-red-500" : "bg-secondary text-muted-foreground"
              }`}>
                {match.shotClockSeconds}s
              </span>
            )}
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-6">
            {/* Équipe A */}
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground truncate mb-1">{match.teamAName}</p>
              {bonusA && <span className="text-[10px] text-red-500 font-bold">BONUS</span>}
              <p className={`text-6xl font-black tabular-nums leading-none mt-1 ${
                scoreA >= scoreB ? "text-primary" : "text-foreground"
              }`}>{scoreA}</p>
              <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
                <span>{foulsA} fautes</span>
                <span>{match.timeoutsA} TO</span>
              </div>
            </div>

            {/* Séparateur */}
            <div className="flex flex-col items-center">
              <span className="text-2xl text-muted-foreground font-bold">–</span>
            </div>

            {/* Équipe B */}
            <div className="flex-1 text-right">
              <p className="text-sm font-bold text-foreground truncate mb-1">{match.teamBName}</p>
              {bonusB && <span className="text-[10px] text-red-500 font-bold">BONUS</span>}
              <p className={`text-6xl font-black tabular-nums leading-none mt-1 ${
                scoreB > scoreA ? "text-primary" : "text-foreground"
              }`}>{scoreB}</p>
              <div className="flex gap-2 justify-end mt-2 text-[11px] text-muted-foreground">
                <span>{foulsB} fautes</span>
                <span>{match.timeoutsB} TO</span>
              </div>
            </div>
          </div>

          {/* Score par quart si match terminé */}
          {match.status === "finished" && match.events.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <QuarterScores match={match} />
            </div>
          )}
        </div>
      </div>

      {/* Fil des actions */}
      {lastEvents.length > 0 && (
        <div className="px-5 mb-5">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            Dernières actions
          </h2>
          <div className="space-y-1.5">
            {lastEvents.map((ev, i) => {
              const isTeamA = ev.teamId === idA;
              const label = eventLabel[ev.type] ?? ev.type;
              const teamName = isTeamA ? match.teamAName : match.teamBName;
              return (
                <div
                  key={ev.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                    i === 0
                      ? "bg-primary/10 border-primary/25"
                      : "bg-card border-border/50"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isTeamA ? "bg-primary" : "bg-red-400"
                  }`} />
                  <span className={`text-xs font-semibold flex-shrink-0 ${
                    isTeamA ? "text-primary" : "text-red-400"
                  }`}>{teamName.slice(0, 12)}</span>
                  <span className="text-xs text-foreground flex-1">{label}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">Q{ev.quarter}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rafraîchissement info */}
      <div className="px-5 pb-8 text-center">
        <p className="text-[10px] text-muted-foreground">
          {isLive ? `Mise à jour automatique toutes les ${POLL_INTERVAL / 1000}s` : "Match terminé"}
        </p>
        <a
          href="/"
          className="text-[10px] text-primary hover:underline mt-1 block"
        >
          MVP Basket Sénégal — suivre vos équipes
        </a>
      </div>
    </div>
  );
}

function QuarterScores({ match }: { match: Match }) {
  const idA = match.teamAId || "A";
  const idB = match.teamBId || "B";
  const maxQ = Math.max(1, ...match.events.map(e => e.quarter));

  return (
    <div className="text-[11px]">
      <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${maxQ}, 1fr) auto` }}>
        <span className="text-muted-foreground text-left pr-2"></span>
        {Array.from({ length: maxQ }, (_, i) => (
          <span key={i} className="text-center text-muted-foreground font-bold">Q{i + 1}</span>
        ))}
        <span className="text-center text-primary font-bold">Tot.</span>

        <span className="text-left text-muted-foreground pr-2 truncate" style={{ maxWidth: 60 }}>
          {match.teamAName.slice(0, 8)}
        </span>
        {Array.from({ length: maxQ }, (_, i) => {
          const pts = match.events.filter(e => e.quarter === i + 1 && e.teamId === idA)
            .reduce((s, e) => s + (e.type === "2pt_made" ? 2 : e.type === "3pt_made" ? 3 : e.type === "ft_made" ? 1 : 0), 0);
          return <span key={i} className="text-center text-foreground">{pts}</span>;
        })}
        <span className="text-center text-primary font-bold">{getTeamScore(match.events, idA)}</span>

        <span className="text-left text-muted-foreground pr-2 truncate" style={{ maxWidth: 60 }}>
          {match.teamBName.slice(0, 8)}
        </span>
        {Array.from({ length: maxQ }, (_, i) => {
          const pts = match.events.filter(e => e.quarter === i + 1 && e.teamId === idB)
            .reduce((s, e) => s + (e.type === "2pt_made" ? 2 : e.type === "3pt_made" ? 3 : e.type === "ft_made" ? 1 : 0), 0);
          return <span key={i} className="text-center text-foreground">{pts}</span>;
        })}
        <span className="text-center text-primary font-bold">{getTeamScore(match.events, idB)}</span>
      </div>
    </div>
  );
}
