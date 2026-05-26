/**
 * pdfExport.ts — Feuille de match PDF officielle
 * Utilise jsPDF pour générer un document A4 propre.
 * Format inspiré des feuilles officielles FIBA / FSBB.
 */

import { jsPDF } from 'jspdf';
import type { Match, Player, PlayerStats } from '@/types/basketball';
import { getTeamScore } from '@/types/basketball';
import { computePlayerStats, getTeamFouls, isTeamInBonus } from '@/types/basketball';
import { getQuarterScores, getTeamRuns, getMatchPlayerIds, type CareerStats } from './playerStats';

export interface PdfRow {
  player: Player;
  stats: PlayerStats;
}

interface PdfOptions {
  match: Match;
  rowsA: PdfRow[];
  rowsB: PdfRow[];
  allPlayers: Player[];
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────
const PRIMARY_R = 109, PRIMARY_G = 99, PRIMARY_B = 245; // #6C63F5
const DARK_R = 15, DARK_G = 15, DARK_B = 30;
const GRAY  = [120, 120, 140] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const BLACK = [20, 20, 35] as [number, number, number];
const RED   = [220, 50, 50] as [number, number, number];
const GREEN = [34, 197, 94] as [number, number, number];
const BG    = [245, 245, 252] as [number, number, number];
const PRIMARY: [number, number, number] = [PRIMARY_R, PRIMARY_G, PRIMARY_B];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(made: number, att: number) {
  return att > 0 ? `${Math.round((made / att) * 100)}%` : '–';
}

function formatMin(minutes?: number) {
  if (!minutes || minutes <= 0) return '–';
  return `${Math.floor(minutes)}:${Math.round((minutes % 1) * 60).toString().padStart(2, '0')}`;
}

// ─── Générateur ───────────────────────────────────────────────────────────────
export async function generateMatchPDF(opts: PdfOptions): Promise<void> {
  const { match, rowsA, rowsB, allPlayers } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210; // page width mm
  const PH = 297; // page height mm
  const ML = 10;  // margin left
  const MR = 10;  // margin right
  const CW = PW - ML - MR; // content width

  const idA = match.teamAId || 'A';
  const idB = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, idA);
  const scoreB = getTeamScore(match.events, idB);
  const quarters = getQuarterScores(match);
  const runs = getTeamRuns(match);
  const date = new Date(match.createdAt).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Page 1 ────────────────────────────────────────────────────────────────

  // En-tête fond coloré
  doc.setFillColor(DARK_R, DARK_G, DARK_B);
  doc.rect(0, 0, PW, 42, 'F');

  // Titre
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MVP BASKET SÉNÉGAL', PW / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('FEUILLE DE MATCH OFFICIELLE', PW / 2, 20, { align: 'center' });

  doc.setTextColor(200, 200, 220);
  doc.setFontSize(8);
  doc.text(date.toUpperCase(), PW / 2, 27, { align: 'center' });

  if (match.matchCategory) {
    const catLabels: Record<string, string> = {
      official: 'MATCH OFFICIEL', friendly: 'MATCH AMICAL',
      training: 'MATCH D\'ENTRAÎNEMENT', internal: 'MATCH INTERNE', mixed: 'MATCH MIXTE',
    };
    doc.setFontSize(8);
    doc.setTextColor(PRIMARY_R + 40, PRIMARY_G + 40, PRIMARY_B + 40);
    doc.text(catLabels[match.matchCategory] || '', PW / 2, 34, { align: 'center' });
  }

  let y = 48;

  // ── Bloc score principal ──
  doc.setFillColor(...BG);
  doc.roundedRect(ML, y, CW, 38, 4, 4, 'F');
  doc.setDrawColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, CW, 38, 4, 4, 'S');

  const wonA = scoreA >= scoreB;
  const wonB = scoreB > scoreA;

  // Nom équipe A
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(match.teamAName.slice(0, 22), ML + 6, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('DOMICILE', ML + 6, y + 18);

  // Score A
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...(wonA ? PRIMARY : BLACK));
  doc.text(String(scoreA), ML + 6, y + 34);

  // Score B
  doc.setTextColor(...(wonB ? PRIMARY : BLACK));
  doc.text(String(scoreB), PW - MR - 6, y + 34, { align: 'right' });

  // Tiret central
  doc.setTextColor(...GRAY);
  doc.setFontSize(18);
  doc.text('–', PW / 2, y + 30, { align: 'center' });

  // Nom équipe B
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(match.teamBName.slice(0, 22), PW - MR - 6, y + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('VISITEUR', PW - MR - 6, y + 18, { align: 'right' });

  // Badge vainqueur
  if (!wonA || wonB) {
    const w = scoreA > scoreB ? match.teamAName : scoreB > scoreA ? match.teamBName : null;
    if (w) {
      doc.setFillColor(...GREEN);
      doc.roundedRect(PW / 2 - 22, y + 26, 44, 8, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(`VAINQUEUR: ${w.slice(0, 10).toUpperCase()}`, PW / 2, y + 31.5, { align: 'center' });
    }
  }

  y += 44;

  // ── Quart-temps ──
  if (quarters.length > 0) {
    doc.setFillColor(...BG);
    doc.roundedRect(ML, y, CW, 24, 3, 3, 'F');

    const colCount = quarters.length + 2;
    const col0 = 34;
    const colW = (CW - col0) / (quarters.length + 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('ÉQUIPE', ML + 4, y + 8);

    quarters.forEach((q, i) => {
      doc.text(`Q${q.quarter}`, ML + col0 + colW * i + colW / 2, y + 8, { align: 'center' });
    });
    doc.setTextColor(...PRIMARY);
    doc.text('TOTAL', ML + col0 + colW * quarters.length + colW / 2, y + 8, { align: 'center' });

    // Ligne séparatrice
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.2);
    doc.line(ML + 4, y + 11, ML + CW - 4, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);

    doc.text(match.teamAName.slice(0, 14), ML + 4, y + 19);
    quarters.forEach((q, i) => doc.text(String(q.a), ML + col0 + colW * i + colW / 2, y + 19, { align: 'center' }));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text(String(scoreA), ML + col0 + colW * quarters.length + colW / 2, y + 19, { align: 'center' });

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.text(match.teamBName.slice(0, 14), ML + 4, y + 19);
    quarters.forEach((q, i) => doc.text(String(q.b), ML + col0 + colW * i + colW / 2, y + 19, { align: 'center' }));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text(String(scoreB), ML + col0 + colW * quarters.length + colW / 2, y + 19, { align: 'center' });

    y += 20;
  }

  y += 4;

  // ── Tables joueurs ──
  y = drawTeamTable(doc, ML, y, CW, match.teamAName, scoreA, rowsA, wonA, PH);
  y += 8;

  // Nouvelle page si pas assez de place
  const neededB = 20 + rowsB.length * 6.5 + 30;
  if (y + neededB > PH - 20) {
    doc.addPage();
    y = 14;
  }

  y = drawTeamTable(doc, ML, y, CW, match.teamBName, scoreB, rowsB, wonB, PH);
  y += 8;

  // ── Runs d'équipe ──
  if (runs.length > 0 && y + 22 < PH - 16) {
    doc.setFillColor(...BG);
    doc.roundedRect(ML, y, CW, runs.length * 7 + 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('RUNS D\'ÉQUIPE', ML + 4, y + 8);
    runs.forEach((r, i) => {
      doc.setTextColor(...BLACK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${r.teamName}  —  Run de ${r.run} points  (Q${r.quarter})`, ML + 8, y + 14 + i * 7);
    });
    y += runs.length * 7 + 16;
  }

  // ── Légende des abréviations ──
  if (y + 30 < PH - 14) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('LÉGENDE :', ML, y + 8);
    doc.setFont('helvetica', 'normal');
    const legend = 'PTS=Points  PD=Passe Décisive  RTO=Rebonds Total  RO=Rebond Offensif  RD=Rebond Défensif  INT=Interception  CTR=Contre  BP=Ballon Perdu  F=Fautes  FG=Tirs de jeu (M/T=Marqués/Tentés)  3P=Paniers à 3pts  LF=Lancers Francs  MIN=Minutes jouées';
    const legendLines = doc.splitTextToSize(legend, CW);
    doc.text(legendLines, ML, y + 14);
    y += 8 + legendLines.length * 7;
  }

  // ── Pied de page ──
  const footerY = PH - 10;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('MVP Basket Sénégal  ·  Ababacar Dieng  ·  Génie Logiciel  ·  diengbabacar666@gmail.com', PW / 2, footerY, { align: 'center' });
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, PW - MR, footerY, { align: 'right' });

  // Numéro de page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i}/${pageCount}`, ML, PH - 4);
  }

  // ── Téléchargement ──
  const dateStr = new Date(match.createdAt).toISOString().slice(0, 10);
  const safeA = match.teamAName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15);
  const safeB = match.teamBName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15);
  doc.save(`mvp-basket-${safeA}-vs-${safeB}-${dateStr}.pdf`);
}

// ─── Table d'une équipe ───────────────────────────────────────────────────────
function drawTeamTable(
  doc: jsPDF,
  x: number, y: number, w: number,
  teamName: string, totalScore: number,
  rows: PdfRow[],
  isWinner: boolean,
  pageH: number,
): number {
  const hasMinutes = rows.some(r => r.stats.minutesPlayed && r.stats.minutesPlayed > 0);

  // En-tête équipe
  doc.setFillColor(DARK_R, DARK_G, DARK_B);
  doc.roundedRect(x, y, w, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(teamName.slice(0, 28), x + 4, y + 7);
  if (isWinner) {
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  } else {
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  }
  doc.text(String(totalScore), x + w - 4, y + 7, { align: 'right' });
  y += 11;

  // Colonnes
  const cols = [
    { h: '#',       w: 7,  align: 'center' as const, key: 'jerseyNumber' },
    { h: 'JOUEUR',  w: hasMinutes ? 24 : 28, align: 'left' as const, key: 'name' },
    ...(hasMinutes ? [{ h: 'MIN', w: 12, align: 'center' as const, key: 'minutes' }] : []),
    { h: 'PTS',     w: 10, align: 'center' as const, key: 'points' },
    { h: 'PD',      w: 9,  align: 'center' as const, key: 'assists' },
    { h: 'RTO',     w: 9,  align: 'center' as const, key: 'rebounds' },
    { h: 'RO',      w: 8,  align: 'center' as const, key: 'offRebounds' },
    { h: 'RD',      w: 8,  align: 'center' as const, key: 'defRebounds' },
    { h: 'INT',     w: 9,  align: 'center' as const, key: 'steals' },
    { h: 'CTR',     w: 9,  align: 'center' as const, key: 'blocks' },
    { h: 'BP',      w: 9,  align: 'center' as const, key: 'turnovers' },
    { h: 'F',       w: 7,  align: 'center' as const, key: 'fouls' },
    { h: 'FG (M/T)', w: 18, align: 'center' as const, key: 'fg' },
    { h: '3P (M/T)', w: 18, align: 'center' as const, key: 'fg3' },
    { h: 'LF (M/T)', w: 17, align: 'center' as const, key: 'ft' },
  ];

  // Fond header colonnes
  doc.setFillColor(230, 230, 245);
  doc.rect(x, y, w, 6, 'F');

  let cx = x;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  cols.forEach(c => {
    const tx = c.align === 'center' ? cx + c.w / 2 : c.align === 'right' ? cx + c.w : cx + 1;
    doc.text(c.h, tx, y + 4.5, { align: c.align });
    cx += c.w;
  });
  y += 7;

  // Lignes joueurs
  rows.forEach((row, i) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = 14;
    }

    const rowH = 6.5;
    const isTop = i === 0 && row.stats.points > 0;

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 253);
      doc.rect(x, y - 0.5, w, rowH, 'F');
    }
    if (isTop) {
      doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B, 0.12);
      doc.setFillColor(230, 228, 255);
      doc.rect(x, y - 0.5, w, rowH, 'F');
    }

    const vals: Record<string, string> = {
      jerseyNumber: row.player.jerseyNumber !== undefined ? String(row.player.jerseyNumber) : '–',
      name: `${row.player.firstName[0]}. ${row.player.lastName}`.slice(0, hasMinutes ? 13 : 16),
      minutes: formatMin(row.stats.minutesPlayed),
      points: String(row.stats.points),
      assists: String(row.stats.assists),
      rebounds: String(row.stats.rebounds),
      offRebounds: String(row.stats.offRebounds),
      defRebounds: String(row.stats.defRebounds),
      steals: String(row.stats.steals),
      blocks: String(row.stats.blocks),
      turnovers: String(row.stats.turnovers),
      fouls: String(row.stats.foulsCommitted),
      fg:  `${row.stats.fgMade}/${row.stats.fgAttempted} (${pct(row.stats.fgMade, row.stats.fgAttempted)})`,
      fg3: `${row.stats.fg3Made}/${row.stats.fg3Attempted} (${pct(row.stats.fg3Made, row.stats.fg3Attempted)})`,
      ft:  `${row.stats.ftMade}/${row.stats.ftAttempted} (${pct(row.stats.ftMade, row.stats.ftAttempted)})`,
    };

    cx = x;
    cols.forEach(c => {
      const val = vals[c.key] ?? '–';
      const isFoulDanger = c.key === 'fouls' && row.stats.foulsCommitted >= 4;
      const isPts = c.key === 'points';

      doc.setFont('helvetica', isPts && isTop ? 'bold' : 'normal');
      doc.setFontSize(7);

      if (isFoulDanger) doc.setTextColor(...RED);
      else if (isPts && isTop) doc.setTextColor(...PRIMARY);
      else doc.setTextColor(...BLACK);

      const tx = c.align === 'center' ? cx + c.w / 2 : c.align === 'right' ? cx + c.w : cx + 1;
      doc.text(val, tx, y + 4, { align: c.align });
      cx += c.w;
    });

    y += rowH;
  });

  // Ligne totaux
  const totals = rows.reduce((a, r) => ({
    points: a.points + r.stats.points, assists: a.assists + r.stats.assists,
    rebounds: a.rebounds + r.stats.rebounds, offRebounds: a.offRebounds + r.stats.offRebounds,
    defRebounds: a.defRebounds + r.stats.defRebounds, steals: a.steals + r.stats.steals,
    blocks: a.blocks + r.stats.blocks, turnovers: a.turnovers + r.stats.turnovers,
    foulsCommitted: a.foulsCommitted + r.stats.foulsCommitted,
  }), { points:0,assists:0,rebounds:0,offRebounds:0,defRebounds:0,steals:0,blocks:0,turnovers:0,foulsCommitted:0 });

  doc.setFillColor(230, 228, 255);
  doc.rect(x, y, w, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);

  const totalsMap: Record<string, string> = {
    jerseyNumber:'', name:'TOTAUX', minutes:'',
    points:String(totals.points), assists:String(totals.assists),
    rebounds:String(totals.rebounds), offRebounds:String(totals.offRebounds),
    defRebounds:String(totals.defRebounds), steals:String(totals.steals),
    blocks:String(totals.blocks), turnovers:String(totals.turnovers),
    fouls:String(totals.foulsCommitted), fg:'–', fg3:'–', ft:'–',
  };

  cx = x;
  cols.forEach(c => {
    const val = totalsMap[c.key] ?? '';
    if (c.key === 'points') {
      doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    } else {
      doc.setTextColor(DARK_R, DARK_G, DARK_B);
    }
    const tx = c.align === 'center' ? cx + c.w / 2 : c.align === 'right' ? cx + c.w : cx + 1;
    doc.text(val, tx, y + 4.5, { align: c.align });
    cx += c.w;
  });

  return y + 8;
}


// ─── PDF Profil joueur ────────────────────────────────────────────────────────


export interface PlayerPdfOptions {
  player: Player;
  career: CareerStats;
  teamName: string;
  matches: Match[];
}

export async function generatePlayerProfilePDF(opts: PlayerPdfOptions): Promise<void> {
  const { player, career, teamName, matches } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, ML = 12, MR = 12, CW = PW - ML - MR;
  const t = career.totals;

  // ── En-tête ──
  doc.setFillColor(DARK_R, DARK_G, DARK_B);
  doc.rect(0, 0, PW, 48, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(`${player.firstName} ${player.lastName}`, ML, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 220);
  doc.text(teamName, ML, 27);
  if (player.position) {
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_R + 60, PRIMARY_G + 60, PRIMARY_B + 60);
    doc.text(player.position, ML, 35);
  }

  // Numéro de maillot
  if (player.jerseyNumber !== undefined) {
    doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.setDrawColor(...(WHITE as [number,number,number]));
    doc.circle(PW - MR - 16, 24, 13, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(player.jerseyNumber >= 10 ? 14 : 18);
    doc.text(`${player.jerseyNumber}`, PW - MR - 16, 27, { align: 'center' });
  }

  doc.setTextColor(180, 180, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`MVP Basket Sénégal  ·  ${career.games} matchs`, ML, 43);

  let y = 56;

  // ── Bloc stats de carrière ──
  doc.setFillColor(...BG);
  doc.roundedRect(ML, y, CW, 44, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('MOYENNES PAR MATCH', ML + 4, y + 8);

  const avgStats = [
    { label: 'PTS', value: career.avg.points.toFixed(1) },
    { label: 'REB', value: career.avg.rebounds.toFixed(1) },
    { label: 'PD',  value: career.avg.assists.toFixed(1) },
    { label: 'INT', value: career.avg.steals.toFixed(1) },
    { label: 'CTR', value: career.avg.blocks.toFixed(1) },
    { label: 'BP',  value: career.avg.fouls.toFixed(1) },
    ...(career.avgMinutes > 0 ? [{ label: 'MIN', value: `${Math.floor(career.avgMinutes)}:${Math.round((career.avgMinutes % 1) * 60).toString().padStart(2,'0')}` }] : []),
    { label: 'EFF', value: career.efficiency > 0 ? `+${career.efficiency}` : String(career.efficiency) },
  ];
  const statW = CW / Math.min(avgStats.length, 7);
  avgStats.slice(0, 7).forEach((s, i) => {
    const sx = ML + i * statW + statW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.text(s.value, sx, y + 27, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(s.label, sx, y + 34, { align: 'center' });
  });
  y += 50;

  // ── Tirs ──
  doc.setFillColor(...BG);
  doc.roundedRect(ML, y, CW, 24, 3, 3, 'F');
  const shootStats = [
    { label: 'Tirs de jeu (FG)', made: t.fgMade, att: t.fgAttempted },
    { label: 'Paniers 3pts (3P)', made: t.fg3Made, att: t.fg3Attempted },
    { label: 'Lancers francs (LF)', made: t.ftMade, att: t.ftAttempted },
  ];
  shootStats.forEach((s, i) => {
    const sx = ML + (CW / 3) * i + (CW / 3) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(`${s.made}/${s.att}`, sx, y + 11, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.text(pct(s.made, s.att), sx, y + 18, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(s.label, sx, y + 23, { align: 'center' });
  });
  y += 30;

  // ── Tableau des derniers matchs ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`DERNIERS MATCHS (${matches.length})`, ML, y + 6);
  y += 10;

  const mCols = [
    { h: 'DATE',    w: 22, align: 'left' as const, key: 'date' },
    { h: 'ADVERSAIRE', w: 42, align: 'left' as const, key: 'opp' },
    { h: 'SCORE', w: 20, align: 'center' as const, key: 'score' },
    { h: 'PTS', w: 12, align: 'center' as const, key: 'pts' },
    { h: 'REB', w: 12, align: 'center' as const, key: 'reb' },
    { h: 'PD',  w: 12, align: 'center' as const, key: 'ast' },
    { h: 'INT', w: 10, align: 'center' as const, key: 'stl' },
    { h: 'CTR', w: 10, align: 'center' as const, key: 'blk' },
    { h: 'F',   w: 8,  align: 'center' as const, key: 'foul' },
    { h: 'FG',  w: 20, align: 'center' as const, key: 'fg' },
  ];

  // Header
  doc.setFillColor(230, 230, 245);
  doc.rect(ML, y, CW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  let cx = ML;
  mCols.forEach(c => {
    doc.text(c.h, c.align === 'center' ? cx + c.w / 2 : cx + 1, y + 4.5, { align: c.align });
    cx += c.w;
  });
  y += 7;

  matches.slice(0, 20).forEach((m, i) => {
    if (y > PH - 20) { doc.addPage(); y = 14; }
    const ms = computePlayerStats(m.events, player.id);
    const idA = m.teamAId || 'A';
    const sA = getTeamScore(m.events, idA);
    const sB = getTeamScore(m.events, m.teamBId || 'B');
    const isA = m.playersA.includes(player.id);
    const myScore = isA ? sA : sB;
    const oppScore2 = isA ? sB : sA;
    const oppName = isA ? m.teamBName : m.teamAName;
    const won = myScore > oppScore2;
    const rowH = 6.5;

    if (i % 2 === 0) { doc.setFillColor(248, 248, 253); doc.rect(ML, y - 0.5, CW, rowH, 'F'); }
    if (won) { doc.setFillColor(230, 250, 235); doc.rect(ML, y - 0.5, CW, rowH, 'F'); }

    const rowVals: Record<string, string> = {
      date: new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      opp:  `vs ${oppName}`.slice(0, 20),
      score: `${myScore}-${oppScore2}`,
      pts:  String(ms.points),
      reb:  String(ms.rebounds),
      ast:  String(ms.assists),
      stl:  String(ms.steals),
      blk:  String(ms.blocks),
      foul: String(ms.foulsCommitted),
      fg:   `${ms.fgMade}/${ms.fgAttempted}`,
    };

    cx = ML;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    mCols.forEach(c => {
      const val = rowVals[c.key] ?? '';
      const isPts = c.key === 'pts';
      doc.setTextColor(isPts && ms.points >= 15 ? PRIMARY_R : won && c.key === 'score' ? 34 : DARK_R,
                       isPts && ms.points >= 15 ? PRIMARY_G : won && c.key === 'score' ? 197 : DARK_G,
                       isPts && ms.points >= 15 ? PRIMARY_B : won && c.key === 'score' ? 94 : DARK_B);
      doc.setFont('helvetica', isPts && ms.points >= 15 ? 'bold' : 'normal');
      const tx = c.align === 'center' ? cx + c.w / 2 : cx + 1;
      doc.text(val, tx, y + 4, { align: c.align });
      cx += c.w;
    });
    y += rowH;
  });

  // ── Pied de page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('MVP Basket Sénégal  ·  Ababacar Dieng  ·  diengbabacar666@gmail.com', PW / 2, PH - 5, { align: 'center' });
    doc.text(`Page ${i}/${pageCount}`, ML, PH - 5);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, PW - MR, PH - 5, { align: 'right' });
  }

  const safeName = `${player.firstName}-${player.lastName}`.replace(/[^a-zA-Z0-9]/g, '-');
  doc.save(`mvp-basket-profil-${safeName}.pdf`);
}


// ─── PDF Performance d'un joueur dans un match ────────────────────────────────

export interface PlayerMatchPdfOptions {
  player: Player;
  stats: PlayerStats;
  match: Match;
}

export async function generatePlayerMatchPDF(opts: PlayerMatchPdfOptions): Promise<void> {
  const { player, stats, match } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, ML = 14, MR = 14, CW = PW - ML - MR;

  const idA = match.teamAId || 'A';
  const idB = match.teamBId || 'B';
  const sA = getTeamScore(match.events, idA);
  const sB = getTeamScore(match.events, idB);
  const isA = match.playersA.includes(player.id);
  const myScore = isA ? sA : sB;
  const oppScore = isA ? sB : sA;
  const oppName = isA ? match.teamBName : match.teamAName;
  const won = myScore > oppScore;
  const date = new Date(match.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── En-tête ──
  doc.setFillColor(DARK_R, DARK_G, DARK_B);
  doc.rect(0, 0, PW, 44, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${player.firstName} ${player.lastName}`, ML, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 220);
  doc.text(`vs ${oppName}  ·  ${date}`, ML, 22);

  // Score du match
  const scoreLabel = `${isA ? sA : sB} – ${isA ? sB : sA}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (won) { doc.setTextColor(...GREEN); }
  else { doc.setTextColor(200, 200, 200); }
  doc.text(`${won ? '✓ Victoire' : oppScore === myScore ? '= Nul' : '✗ Défaite'}  ${scoreLabel}`, ML, 32);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 190);
  if (match.matchCategory) {
    const cats: Record<string, string> = { official: 'Officiel', friendly: 'Amical', training: 'Entraînement', internal: 'Interne', mixed: 'Mixte' };
    doc.text(cats[match.matchCategory] || '', PW - MR, 32, { align: 'right' });
  }

  if (player.jerseyNumber !== undefined) {
    doc.setFillColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.circle(PW - MR - 14, 22, 11, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(player.jerseyNumber >= 10 ? 12 : 15);
    doc.text(String(player.jerseyNumber), PW - MR - 14, 26, { align: 'center' });
  }

  let y = 52;

  // ── Stats principales ──
  doc.setFillColor(...BG);
  doc.roundedRect(ML, y, CW, 32, 4, 4, 'F');

  const mainStats = [
    { label: 'POINTS',   value: String(stats.points),         color: PRIMARY },
    { label: 'REBONDS',  value: String(stats.rebounds) },
    { label: 'PASSES',   value: String(stats.assists) },
    { label: 'INT.',     value: String(stats.steals) },
    { label: 'CONTRES',  value: String(stats.blocks) },
    { label: 'FAUTES',   value: String(stats.foulsCommitted), color: stats.foulsCommitted >= 4 ? RED : undefined },
    { label: 'BP',       value: String(stats.turnovers),      color: stats.turnovers >= 3 ? RED : undefined },
  ];
  const mW = CW / mainStats.length;
  mainStats.forEach((s, i) => {
    const sx = ML + i * mW + mW / 2;
    const col = s.color ?? (BLACK as [number,number,number]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(s.value, sx, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(s.label, sx, y + 25, { align: 'center' });
  });
  y += 38;

  // ── Tirs ──
  doc.setFillColor(...BG);
  doc.roundedRect(ML, y, CW, 28, 3, 3, 'F');

  const shoots = [
    { label: 'Tirs de jeu (FG)', made: stats.fgMade, att: stats.fgAttempted },
    { label: 'Paniers 3pts (3P)', made: stats.fg3Made, att: stats.fg3Attempted },
    { label: 'Lancers francs (LF)', made: stats.ftMade, att: stats.ftAttempted },
  ];
  shoots.forEach((s, i) => {
    const sx = ML + (CW / 3) * i + (CW / 3) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(`${s.made}/${s.att}`, sx, y + 12, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.text(pct(s.made, s.att), sx, y + 20, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(s.label, sx, y + 26, { align: 'center' });
  });
  y += 34;

  // ── Temps de jeu ──
  if (stats.minutesPlayed && stats.minutesPlayed > 0) {
    doc.setFillColor(...BG);
    doc.roundedRect(ML, y, CW, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_R, PRIMARY_G, PRIMARY_B);
    doc.text(`⏱  Temps de jeu : ${formatMin(stats.minutesPlayed)}`, ML + 4, y + 9);
    y += 20;
  }

  // ── Points par quart-temps ──
  const maxQ = Math.max(1, ...match.events.map(e => e.quarter));
  const quarters = [];
  for (let q = 1; q <= maxQ; q++) {
    const evs = match.events.filter(e => e.playerId === player.id && e.quarter === q);
    const pts = evs.reduce((s, e) => s + (e.type === '2pt_made' ? 2 : e.type === '3pt_made' ? 3 : e.type === 'ft_made' ? 1 : 0), 0);
    quarters.push({ q, pts });
  }
  if (quarters.length > 0) {
    doc.setFillColor(...BG);
    doc.roundedRect(ML, y, CW, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('POINTS PAR QUART-TEMPS', ML + 4, y + 8);
    const qW = CW / quarters.length;
    quarters.forEach((q, i) => {
      const qx = ML + i * qW + qW / 2;
      doc.setFontSize(12);
      doc.setTextColor(q.pts > 0 ? PRIMARY_R : DARK_R, q.pts > 0 ? PRIMARY_G : DARK_G, q.pts > 0 ? PRIMARY_B : DARK_B);
      doc.text(String(q.pts), qx, y + 18, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`Q${q.q}`, qx, y + 23, { align: 'center' });
    });
    y += 30;
  }

  // ── Légende ──
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const legend = 'PTS=Points  REB=Rebonds  PD=Passes Décisives  INT=Interceptions  CTR=Contres  F=Fautes  BP=Ballons Perdus  FG=Tirs de jeu  3P=Paniers 3pts  LF=Lancers Francs';
  const lines = doc.splitTextToSize(legend, CW);
  doc.text(lines, ML, y);

  // ── Pied de page ──
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('MVP Basket Sénégal  ·  Ababacar Dieng  ·  Génie Logiciel  ·  diengbabacar666@gmail.com', PW / 2, PH - 5, { align: 'center' });
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, PW - MR, PH - 5, { align: 'right' });

  const safeName = `${player.firstName}-${player.lastName}`.replace(/[^a-zA-Z0-9]/g, '-');
  const dateStr = new Date(match.createdAt).toISOString().slice(0, 10);
  doc.save(`mvp-basket-${safeName}-match-${dateStr}.pdf`);
}
