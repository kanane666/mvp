import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getMatchById, getTeams } from "@/lib/storage";
import { computePlayerStats, getTeamScore, MATCH_CATEGORY_LABELS } from "@/types/basketball";
import type { Match, Player, PlayerStats } from "@/types/basketball";
import { getQuarterScores, getTopPerformers, getMatchPlayerIds, getTeamRuns } from "@/lib/playerStats";
import { generateMatchImage, shareOrDownloadImage } from "@/lib/shareMatchImage";
// pdfExport chargé dynamiquement pour réduire le bundle initial
import type { ShareRow } from "@/lib/shareMatchImage";

export const Route = createFileRoute("/report/$matchId")({
  component: ReportPage,
});

function pct(made: number, att: number) {
  if (!att) return '–';
  return Math.round((made / att) * 100) + '%';
}

function formatMin(minutes?: number) {
  if (!minutes) return '–';
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ReportPage() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sharing, setSharing] = useState<'idle' | 'generating' | 'done'>('idle');
  const [pdfState, setPdfState] = useState<'idle' | 'generating' | 'done'>('idle');

  useEffect(() => {
    const m = getMatchById(matchId);
    if (m) setMatch(m);
    setAllPlayers(getTeams().flatMap(t => t.players));
  }, [matchId]);

  const data = useMemo(() => {
    if (!match) return null;
    const idA = match.teamAId || 'A';
    const idB = match.teamBId || 'B';
    const scoreA = getTeamScore(match.events, idA);
    const scoreB = getTeamScore(match.events, idB);
    const playerIds = getMatchPlayerIds(match);
    const rowsA: { player: Player; stats: PlayerStats }[] = [];
    const rowsB: { player: Player; stats: PlayerStats }[] = [];

    for (const pid of playerIds) {
      const player = allPlayers.find(p => p.id === pid);
      if (!player) continue;
      const ev = match.events.find(e => e.playerId === pid && e.type !== 'sub_in' && e.type !== 'sub_out');
      const stats = computePlayerStats(match.events, pid);
      if (ev?.teamId === idA || match.playersA.includes(pid)) rowsA.push({ player, stats });
      else if (ev?.teamId === idB || match.playersB.includes(pid)) rowsB.push({ player, stats });
    }

    // Also include players with sub events even without score events
    for (const pid of [...match.playersA, ...match.playersB]) {
      const already = [...rowsA, ...rowsB].some(r => r.player.id === pid);
      if (already) continue;
      const player = allPlayers.find(p => p.id === pid);
      if (!player) continue;
      const stats = computePlayerStats(match.events, pid);
      const hasSub = match.events.some(e => e.playerId === pid);
      if (!hasSub) continue;
      if (match.playersA.includes(pid)) rowsA.push({ player, stats });
      else rowsB.push({ player, stats });
    }

    rowsA.sort((a, b) => b.stats.points - a.stats.points);
    rowsB.sort((a, b) => b.stats.points - a.stats.points);

    return {
      idA, idB, scoreA, scoreB,
      rowsA, rowsB,
      quarters: getQuarterScores(match),
      top: getTopPerformers(match),
      runs: getTeamRuns(match),
    };
  }, [match, allPlayers]);

  // ── Partage image ──
  const handleShareImage = async () => {
    if (!match || !data) return;
    setSharing('generating');
    try {
      const blob = await generateMatchImage({
        match,
        rowsA: data.rowsA,
        rowsB: data.rowsB,
      });
      if (!blob) throw new Error('Canvas failed');
      const date = new Date(match.createdAt).toISOString().slice(0, 10);
      await shareOrDownloadImage(
        blob,
        `mvp-basket-${match.teamAName}-vs-${match.teamBName}-${date}.png`
      );
      setSharing('done');
      setTimeout(() => setSharing('idle'), 2000);
    } catch {
      setSharing('idle');
    }
  };

  const handleExportPDF = async () => {
    if (!match || !data) return;
    setPdfState('generating');
    try {
      const { generateMatchPDF } = await import('@/lib/pdfExport');
      await generateMatchPDF({
        match,
        rowsA: data.rowsA,
        rowsB: data.rowsB,
        allPlayers,
      });
      setPdfState('done');
      setTimeout(() => setPdfState('idle'), 2500);
    } catch (e) {
      console.error('PDF error:', e);
      setPdfState('idle');
    }
  };

  if (!match || !data) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  const cat = match.matchCategory;
  const hasMinutes = [...data.rowsA, ...data.rowsB].some(r => r.stats.minutesPlayed);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="px-5 pt-8 pb-3 flex items-center gap-3">
        <Link to="/stats"><Button variant="ghost" size="icon">←</Button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">Rapport de match</h1>
          <p className="text-[11px] text-muted-foreground">
            {new Date(match.createdAt).toLocaleDateString('fr-FR')} {cat && `· ${MATCH_CATEGORY_LABELS[cat]}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleShareImage}
            disabled={sharing === 'generating'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              sharing === 'done'
                ? 'bg-green-500/20 text-green-600'
                : sharing === 'generating'
                ? 'bg-primary/10 text-primary/50'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            {sharing === 'generating' ? '⏳…' : sharing === 'done' ? '✅' : '🖼'}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={pdfState === 'generating'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              pdfState === 'done'
                ? 'bg-green-500/20 text-green-600'
                : pdfState === 'generating'
                ? 'bg-secondary text-muted-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            {pdfState === 'generating' ? '⏳ PDF…' : pdfState === 'done' ? '✅ PDF prêt !' : '📄 PDF'}
          </button>
        </div>
      </header>

      {/* Score + quarts */}
      <section className="px-5 mb-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-muted-foreground">Domicile</p>
              <p className="font-bold text-foreground truncate">{match.teamAName}</p>
            </div>
            <div className="text-2xl font-black text-foreground tabular-nums">
              <span className={data.scoreA >= data.scoreB ? 'text-primary' : ''}>{data.scoreA}</span>
              <span className="text-muted-foreground mx-1.5">–</span>
              <span className={data.scoreB > data.scoreA ? 'text-primary' : ''}>{data.scoreB}</span>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs text-muted-foreground">Visiteur</p>
              <p className="font-bold text-foreground truncate">{match.teamBName}</p>
            </div>
          </div>

          {data.quarters.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground font-semibold mb-2">Par quart-temps</p>
              <div className="grid gap-1 text-[11px]" style={{ gridTemplateColumns: `auto repeat(${data.quarters.length}, 1fr) auto` }}>
                <div className="text-muted-foreground text-[10px]">Équipe</div>
                {data.quarters.map(q => (
                  <div key={`h${q.quarter}`} className="text-center text-muted-foreground font-semibold">Q{q.quarter}</div>
                ))}
                <div className="text-center text-muted-foreground font-semibold">Tot.</div>

                <div className="text-muted-foreground truncate">{match.teamAName.slice(0, 8)}</div>
                {data.quarters.map(q => <div key={`a${q.quarter}`} className="text-center text-foreground tabular-nums">{q.a}</div>)}
                <div className="text-center text-primary font-bold tabular-nums">{data.scoreA}</div>

                <div className="text-muted-foreground truncate">{match.teamBName.slice(0, 8)}</div>
                {data.quarters.map(q => <div key={`b${q.quarter}`} className="text-center text-foreground tabular-nums">{q.b}</div>)}
                <div className="text-center text-primary font-bold tabular-nums">{data.scoreB}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Top performers */}
      {(data.top.topScorer || data.top.topAssister || data.top.topRebounder) && (
        <section className="px-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-2">⭐ Top performers</h2>
          <div className="grid grid-cols-3 gap-2">
            <TopCard label="Points" entry={data.top.topScorer} players={allPlayers} />
            <TopCard label="Passes" entry={data.top.topAssister} players={allPlayers} />
            <TopCard label="Rebonds" entry={data.top.topRebounder} players={allPlayers} />
          </div>
        </section>
      )}

      {/* Runs */}
      {data.runs.length > 0 && (
        <section className="px-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-2">🔥 Runs d'équipe</h2>
          <div className="flex flex-wrap gap-2">
            {data.runs.map((r, i) => (
              <div key={i} className="bg-primary/10 rounded-xl px-3 py-2 border border-primary/20">
                <p className="text-xs font-bold text-primary">{r.teamName}</p>
                <p className="text-lg font-black text-foreground">{r.run}-0</p>
                <p className="text-[10px] text-muted-foreground">Q{r.quarter}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats par équipe */}
      <PlayerTable title={match.teamAName} rows={data.rowsA} totalScore={data.scoreA} showMinutes={hasMinutes} />
      <PlayerTable title={match.teamBName} rows={data.rowsB} totalScore={data.scoreB} showMinutes={hasMinutes} emptyHint="Pas de données joueur (équipe externe)" />
    </div>
  );
}

function TopCard({ label, entry, players }: { label: string; entry?: { playerId: string; value: number }; players: Player[] }) {
  if (!entry || entry.value === 0) {
    return (
      <div className="bg-card rounded-xl p-3 border border-border text-center">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-1">—</p>
      </div>
    );
  }
  const p = players.find(pp => pp.id === entry.playerId);
  return (
    <Link to="/player/$playerId" params={{ playerId: entry.playerId }} className="block">
      <div className="bg-card rounded-xl p-3 border border-border hover:border-primary/40 transition-colors text-center">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xl font-black text-primary tabular-nums mt-0.5">{entry.value}</p>
        <p className="text-[11px] text-foreground truncate">{p ? `${p.firstName} ${p.lastName[0]}.` : 'Joueur'}</p>
      </div>
    </Link>
  );
}

function PlayerTable({ title, rows, totalScore, showMinutes, emptyHint }: {
  title: string;
  rows: { player: Player; stats: PlayerStats }[];
  totalScore: number;
  showMinutes: boolean;
  emptyHint?: string;
}) {
  const totals = rows.reduce((acc, r) => ({
    points: acc.points + r.stats.points,
    assists: acc.assists + r.stats.assists,
    rebounds: acc.rebounds + r.stats.rebounds,
    steals: acc.steals + r.stats.steals,
    blocks: acc.blocks + r.stats.blocks,
    turnovers: acc.turnovers + r.stats.turnovers,
    fouls: acc.fouls + r.stats.foulsCommitted,
  }), { points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0 });

  return (
    <section className="mb-4">
      <div className="px-5 flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
        <span className="text-primary font-black tabular-nums">{totalScore}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 text-xs text-muted-foreground py-3">{emptyHint || "Aucun joueur"}</p>
      ) : (
        <div className="overflow-x-auto px-5">
          <table className="min-w-full text-[11px] tabular-nums">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1.5 pr-2 font-semibold">#</th>
                <th className="text-left py-1.5 pr-2 font-semibold">Joueur</th>
                {showMinutes && <th className="px-1.5 py-1.5 font-semibold">MIN</th>}
                <th className="px-1.5 py-1.5 font-semibold">PTS</th>
                <th className="px-1.5 font-semibold">PD</th>
                <th className="px-1.5 font-semibold">RTOT</th>
                <th className="px-1.5 font-semibold">INT</th>
                <th className="px-1.5 font-semibold">CTR</th>
                <th className="px-1.5 font-semibold">BP</th>
                <th className="px-1.5 font-semibold">F</th>
                <th className="px-1.5 font-semibold">FG%</th>
                <th className="px-1.5 font-semibold">3PT%</th>
                <th className="px-1.5 font-semibold">LF%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, stats }) => (
                <tr key={player.id} className="border-b border-border/40 hover:bg-card/60">
                  <td className="py-2 pr-2 text-primary font-bold">{player.jerseyNumber ?? '–'}</td>
                  <td className="py-2 pr-2 text-foreground">
                    <Link to="/player/$playerId" params={{ playerId: player.id }} className="hover:text-primary font-semibold">
                      {player.firstName} {player.lastName[0]}.
                    </Link>
                  </td>
                  {showMinutes && <td className="px-1.5 text-center text-muted-foreground">{formatMin(stats.minutesPlayed)}</td>}
                  <td className="px-1.5 text-center text-foreground font-bold">{stats.points}</td>
                  <td className="px-1.5 text-center">{stats.assists}</td>
                  <td className="px-1.5 text-center">{stats.rebounds}</td>
                  <td className="px-1.5 text-center">{stats.steals}</td>
                  <td className="px-1.5 text-center">{stats.blocks}</td>
                  <td className="px-1.5 text-center">{stats.turnovers}</td>
                  <td className={`px-1.5 text-center ${stats.foulsCommitted >= 5 ? 'text-destructive font-bold' : ''}`}>{stats.foulsCommitted}</td>
                  <td className="px-1.5 text-center">{pct(stats.fgMade, stats.fgAttempted)}</td>
                  <td className="px-1.5 text-center">{pct(stats.fg3Made, stats.fg3Attempted)}</td>
                  <td className="px-1.5 text-center">{pct(stats.ftMade, stats.ftAttempted)}</td>
                </tr>
              ))}
              <tr className="text-foreground font-bold bg-secondary/30">
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2">Total</td>
                {showMinutes && <td className="px-1.5 text-center">—</td>}
                <td className="px-1.5 text-center text-primary">{totals.points}</td>
                <td className="px-1.5 text-center">{totals.assists}</td>
                <td className="px-1.5 text-center">{totals.rebounds}</td>
                <td className="px-1.5 text-center">{totals.steals}</td>
                <td className="px-1.5 text-center">{totals.blocks}</td>
                <td className="px-1.5 text-center">{totals.turnovers}</td>
                <td className="px-1.5 text-center">{totals.fouls}</td>
                <td className="px-1.5 text-center">—</td>
                <td className="px-1.5 text-center">—</td>
                <td className="px-1.5 text-center">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
