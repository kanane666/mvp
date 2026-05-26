import { useState } from "react";
import { generatePlayerMatchImage, sharePlayerImage } from "@/lib/sharePlayerImage";
import type { Player } from "@/types/basketball";
import { Link } from "@tanstack/react-router";
import { computePlayerStats, getTeamScore, MATCH_CATEGORY_LABELS } from "@/types/basketball";
import type { Match } from "@/types/basketball";

function pct(made: number, att: number) {
  if (!att) return '—';
  return `${Math.round((made / att) * 100)}%`;
}

function formatMin(minutes?: number): string {
  if (!minutes || minutes <= 0) return '—';
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getPlayerQuarterPoints(m: Match, playerId: string): { q: number; pts: number }[] {
  const maxQ = Math.max(1, ...m.events.map(e => e.quarter));
  const out: { q: number; pts: number }[] = [];
  for (let q = 1; q <= maxQ; q++) {
    const ev = m.events.filter(e => e.playerId === playerId && e.quarter === q);
    const pts = ev.reduce((s, e) => {
      if (e.type === '2pt_made') return s + 2;
      if (e.type === '3pt_made') return s + 3;
      if (e.type === 'ft_made') return s + 1;
      return s;
    }, 0);
    out.push({ q, pts });
  }
  return out;
}

export function PlayerMatchRow({ match, playerId, teamId, player }: { match: Match; playerId: string; teamId: string; player?: Player }) {
  const [open, setOpen] = useState(false);
  const s = computePlayerStats(match.events, playerId);
  const [sharing, setSharing] = useState<'idle'|'generating'|'done'>('idle');

  const handleShareMatchPerf = async () => {
    if (!player) return;
    setSharing('generating');
    try {
      const matchTitle = `${match.teamAName} vs ${match.teamBName}`;
      const matchDate = new Date(match.createdAt).toLocaleDateString('fr-FR');
      const blob = await generatePlayerMatchImage(player, s, matchTitle, matchDate, '');
      if (!blob) throw new Error('Canvas failed');
      const name = `${player.firstName}-${player.lastName}`.replace(/[^a-zA-Z0-9]/g, '-');
      await sharePlayerImage(blob, `mvp-basket-${name}-match-${match.id.slice(0,6)}.png`);
      setSharing('done');
      setTimeout(() => setSharing('idle'), 2000);
    } catch { setSharing('idle'); }
  };
  const idA = match.teamAId || 'A';
  const idB = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, idA);
  const scoreB = getTeamScore(match.events, idB);
  const isHome = teamId === idA;
  const ownScore = isHome ? scoreA : scoreB;
  const oppScore = isHome ? scoreB : scoreA;
  const oppName = isHome ? match.teamBName : match.teamAName;
  const win = ownScore > oppScore;
  const quarters = getPlayerQuarterPoints(match, playerId);
  const cat = match.matchCategory;

  return (
    <div className="bg-gradient-to-br from-card to-card/40 rounded-2xl border border-border overflow-hidden transition-all">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
        <div className={`w-1.5 self-stretch rounded-full ${win ? 'bg-primary' : 'bg-destructive/70'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {cat && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase tracking-wide">
                {MATCH_CATEGORY_LABELS[cat]}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {new Date(match.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">vs {oppName}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            <span className={win ? 'text-primary font-bold' : 'text-muted-foreground'}>{ownScore}</span>
            <span className="mx-1">–</span>
            <span>{oppScore}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-primary tabular-nums leading-none">{s.points}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">pts</p>
        </div>
        <span className={`text-muted-foreground transition-transform text-xs ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/60 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <Mini label="REB" main={s.rebounds} sub={`${s.offRebounds}o·${s.defRebounds}d`} />
            <Mini label="PD" main={s.assists} />
            <Mini label="INT" main={s.steals} />
            <Mini label="CTR" main={s.blocks} />
            <Mini label="BP" main={s.turnovers} />
            <Mini label="F" main={s.foulsCommitted} />
            <Mini label="F.PROV" main={s.foulsDrawn} />
            <Mini label="PTS" main={s.points} accent />
          </div>
          {/* Temps de jeu — affiché uniquement si données de rotation disponibles */}
          {s.minutesPlayed && s.minutesPlayed > 0 ? (
            <div className="flex items-center gap-2 bg-primary/8 rounded-xl px-3 py-2 border border-primary/15">
              <span className="text-primary text-sm">⏱</span>
              <div>
                <p className="text-xs font-bold text-foreground">Temps de jeu</p>
                <p className="text-[10px] text-muted-foreground">Ce match</p>
              </div>
              <p className="ml-auto text-lg font-black text-primary tabular-nums">{formatMin(s.minutesPlayed)}</p>
            </div>
          ) : null}

          {/* Shooting % */}
          <div className="grid grid-cols-3 gap-1.5">
            <Shoot label="FG" made={s.fgMade} att={s.fgAttempted} />
            <Shoot label="3PT" made={s.fg3Made} att={s.fg3Attempted} />
            <Shoot label="LF" made={s.ftMade} att={s.ftAttempted} />
          </div>

          {/* Quarters */}
          {quarters.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Points par QT</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${quarters.length}, 1fr)` }}>
                {quarters.map(q => (
                  <div key={q.q} className="bg-secondary/40 rounded-lg py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">Q{q.q}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{q.pts}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            to="/report/$matchId"
            params={{ matchId: match.id }}
            className="block text-center text-[11px] text-primary font-semibold py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            Voir le rapport complet →
          </Link>
        </div>
      )}
    </div>
  );
}

function Mini({ label, main, sub, accent }: { label: string; main: number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-1.5 text-center ${accent ? 'bg-primary/15 border border-primary/30' : 'bg-secondary/40'}`}>
      <p className={`text-base font-black tabular-nums leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>{main}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[8px] text-muted-foreground/80 tabular-nums">{sub}</p>}
    </div>
  );
}

function Shoot({ label, made, att }: { label: string; made: number; att: number }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-foreground tabular-nums">{made}<span className="text-muted-foreground">/{att}</span></p>
      <p className="text-[10px] text-primary font-semibold tabular-nums">{pct(made, att)}</p>
    </div>
  );
}
