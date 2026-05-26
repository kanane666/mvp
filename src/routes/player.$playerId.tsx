import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/Sparkline";
import { StatTile } from "@/components/StatTile";
import { PlayerMatchRow } from "@/components/PlayerMatchRow";
import { computePlayerStats } from "@/types/basketball";
import { findPlayer, getPlayerMatches, getPlayerCareerStats, type CategoryFilter } from "@/lib/playerStats";
import { generatePlayerProfileImage, sharePlayerImage } from "@/lib/sharePlayerImage";
import { getPlayerTrainingStats, getEvaluations, getTrainingSessions } from "@/lib/storage";

export const Route = createFileRoute("/player/$playerId")({
  component: PlayerProfilePage,
});

const FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'official', label: 'Officiel' },
  { key: 'friendly', label: 'Amical' },
  { key: 'training', label: 'Entraînement' },
];

function pct(made: number, att: number) {
  if (!att) return '—';
  return `${Math.round((made / att) * 100)}%`;
}

function formatMin(minutes: number): string {
  if (minutes <= 0) return '—';
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayerProfilePage() {
  const { playerId } = Route.useParams();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sharingProfile, setSharingProfile] = useState<'idle'|'generating'|'done'>('idle');
  const [sortBy, setSortBy] = useState<'date' | 'points'>('date');
  const [tick, setTick] = useState(0);

  useEffect(() => { setTick(t => t + 1); }, [playerId]);

  const info = useMemo(() => findPlayer(playerId), [playerId, tick]);
  const career = useMemo(() => getPlayerCareerStats(playerId, filter), [playerId, filter, tick]);
  const matches = useMemo(() => getPlayerMatches(playerId, filter), [playerId, filter, tick]);
  const training = useMemo(() => getPlayerTrainingStats(playerId), [playerId, tick]);

  const sortedMatches = useMemo(() => {
    if (sortBy === 'date') return matches;
    return [...matches].sort((a, b) =>
      computePlayerStats(b.events, playerId).points - computePlayerStats(a.events, playerId).points
    );
  }, [matches, sortBy, playerId]);

  const bestGame = useMemo(() => {
    let max = 0;
    for (const m of matches) {
      const p = computePlayerStats(m.events, playerId).points;
      if (p > max) max = p;
    }
    return max;
  }, [matches, playerId]);

  const pointsTrend = useMemo(() => {
    return [...matches].reverse().slice(-10).map(m => computePlayerStats(m.events, playerId).points);
  }, [matches, playerId]);

  const ratingsTrend = useMemo(() => {
    const sessions = getTrainingSessions();
    return getEvaluations()
      .filter(e => e.playerId === playerId)
      .sort((a, b) => (sessions.find(s => s.id === a.sessionId)?.date || 0) - (sessions.find(s => s.id === b.sessionId)?.date || 0))
      .slice(-10)
      .map(e => e.rating);
  }, [playerId, tick]);

  if (!info) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground gap-3">
        <p>Joueur introuvable</p>
        <Link to="/stats"><Button variant="ghost">← Stats</Button></Link>
      </div>
    );
  }

  const p = info.player;
  const t = career.totals;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="px-5 pt-8 pb-3 flex items-center gap-2">
        <Link to="/stats"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-lg font-bold text-foreground flex-1">Profil joueur</h1>
        <button
          type="button"
          onClick={handleShareProfile}
          disabled={sharingProfile === 'generating'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            sharingProfile === 'done' ? 'bg-green-500/20 text-green-600'
            : sharingProfile === 'generating' ? 'bg-primary/10 text-primary/50'
            : 'bg-primary/10 text-primary'
          }`}
        >
          {sharingProfile === 'generating' ? '⏳' : sharingProfile === 'done' ? '✅' : '🖼 Partager'}
        </button>
      </header>

      {/* Hero card */}
      <section className="px-5 mb-4">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl primary-gradient flex items-center justify-center shadow-lg glow-primary-sm shrink-0">
              <span className="text-3xl font-black text-primary-foreground tabular-nums">{p.jerseyNumber ?? '?'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black text-foreground truncate tracking-tight">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{info.teamName}{p.position && ` · ${p.position}`}</p>
              {training.sessionsCount > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  📅 {training.attendanceRate}% présence · ⭐ {training.avgRating.toFixed(1)}/5
                </p>
              )}
            </div>
          </div>

          {/* KPI band */}
          <div className="relative grid grid-cols-4 gap-2 mt-4">
            <KpiMini label="Matchs" value={career.games} />
            <KpiMini label="PTS moy" value={career.avg.points.toFixed(1)} />
            <KpiMini label="Best" value={bestGame} />
            {career.avgMinutes > 0
              ? <KpiMini label="MIN moy" value={formatMin(career.avgMinutes)} />
              : <KpiMini label="FG%" value={pct(t.fgMade, t.fgAttempted)} />
            }
          </div>
        </div>
      </section>

      {/* Filter chips */}
      <section className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map(f => (
            <button type="button" key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground shadow-md glow-primary-sm'
                  : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Carrière : moyennes + totaux */}
      <section className="px-5 mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">Carrière</h2>
          <span className="text-[11px] text-muted-foreground">{career.games} match{career.games > 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <StatTile label="PTS" value={career.avg.points.toFixed(1)} sub={`Total: ${t.points}`} accent />
          <StatTile label="REB" value={career.avg.rebounds.toFixed(1)} sub={`Total: ${t.rebounds}`} />
          <StatTile label="PD" value={career.avg.assists.toFixed(1)} sub={`Total: ${t.assists}`} />
          <StatTile label="INT" value={career.avg.steals.toFixed(1)} sub={`Total: ${t.steals}`} />
          <StatTile label="CTR" value={career.avg.blocks.toFixed(1)} sub={`Total: ${t.blocks}`} />
          <StatTile label="F" value={career.avg.fouls.toFixed(1)} sub={`Total: ${t.foulsCommitted}`} />
          {career.avgMinutes > 0 && (
            <StatTile label="MIN moy" value={formatMin(career.avgMinutes)} sub={`Total: ${formatMin(career.totalMinutes)}`} />
          )}
          {career.efficiency !== 0 && (
            <StatTile label="Efficacité" value={career.efficiency > 0 ? `+${career.efficiency}` : String(career.efficiency)} sub="PER simplifié" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ShootTile label="FG" made={t.fgMade} att={t.fgAttempted} />
          <ShootTile label="3 PTS" made={t.fg3Made} att={t.fg3Attempted} />
          <ShootTile label="LF" made={t.ftMade} att={t.ftAttempted} />
        </div>
      </section>

      {/* Trends */}
      {(pointsTrend.length > 0 || ratingsTrend.length > 0) && (
        <section className="px-5 mb-5 space-y-2">
          {pointsTrend.length > 0 && (
            <div className="bg-gradient-to-br from-card to-card/40 rounded-2xl p-4 border border-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-foreground font-bold">📈 Points</p>
                <p className="text-[10px] text-muted-foreground">{pointsTrend.length} derniers matchs</p>
              </div>
              <Sparkline values={pointsTrend} width={160} height={36} />
            </div>
          )}
          {ratingsTrend.length > 0 && (
            <div className="bg-gradient-to-br from-card to-card/40 rounded-2xl p-4 border border-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-foreground font-bold">⭐ Entraînement</p>
                <p className="text-[10px] text-muted-foreground">{ratingsTrend.length} dernières notes</p>
              </div>
              <Sparkline values={ratingsTrend} width={160} height={36} max={5} />
            </div>
          )}
        </section>
      )}

      {/* Détail par match */}
      <section className="px-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">Détail par match</h2>
          <div className="flex gap-1 text-[10px]">
            <button type="button" onClick={() => setSortBy('date')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${sortBy === 'date' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              📅 Date
            </button>
            <button type="button" onClick={() => setSortBy('points')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${sortBy === 'points' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              🎯 Points
            </button>
          </div>
        </div>

        {sortedMatches.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 border border-border text-center">
            <p className="text-xs text-muted-foreground">Aucun match dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMatches.map(m => (
              <PlayerMatchRow key={m.id} match={m} playerId={playerId} teamId={info.teamId} player={p} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Touche une carte pour voir toutes les stats du match
        </p>
      </section>
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-black text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

function ShootTile({ label, made, att }: { label: string; made: number; att: number }) {
  const p = pct(made, att);
  return (
    <div className="bg-gradient-to-br from-card to-card/40 rounded-2xl p-3 border border-border">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-primary tabular-nums mt-0.5">{p}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">{made}/{att}</p>
    </div>
  );
}
