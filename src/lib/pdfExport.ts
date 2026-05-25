/**
 * pdfExport.ts — Feuille de match PDF officielle
 * Utilise jsPDF pour générer un document A4 propre.
 * Format inspiré des feuilles officielles FIBA / FSBB.
 */

import { jsPDF } from 'jspdf';
import type { Match, Player, PlayerStats } from '@/types/basketball';
import { getTeamScore } from '@/types/basketball';
import { computePlayerStats, getTeamFouls, isTeamInBonus } from '@/types/basketball';
import { getQuarterScores, getTeamRuns, getMatchPlayerIds } from './playerStats';

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
    doc.setTextColor(...GREEN);
  } else {
    doc.setTextColor(...PRIMARY);
  }
  doc.text(String(totalScore), x + w - 4, y + 7, { align: 'right' });
  y += 11;

  // Colonnes
  const cols = [
    { h: '#',    w: 7,  align: 'center' as const, key: 'jerseyNumber' },
    { h: 'JOUEUR', w: hasMinutes ? 28 : 34, align: 'left' as const,   key: 'name' },
    ...(hasMinutes ? [{ h: 'MIN', w: 14, align: 'center' as const, key: 'minutes' }] : []),
    { h: 'PTS',  w: 11, align: 'center' as const, key: 'points' },
    { h: 'PD',   w: 10, align: 'center' as const, key: 'assists' },
    { h: 'RTO',  w: 10, align: 'center' as const, key: 'rebounds' },
    { h: 'RO',   w: 9,  align: 'center' as const, key: 'offRebounds' },
    { h: 'RD',   w: 9,  align: 'center' as const, key: 'defRebounds' },
    { h: 'INT',  w: 10, align: 'center' as const, key: 'steals' },
    { h: 'CTR',  w: 10, align: 'center' as const, key: 'blocks' },
    { h: 'BP',   w: 10, align: 'center' as const, key: 'turnovers' },
    { h: 'F',    w: 8,  align: 'center' as const, key: 'fouls' },
    { h: 'FG%',  w: 13, align: 'center' as const, key: 'fg' },
    { h: '3P%',  w: 13, align: 'center' as const, key: 'fg3' },
    { h: 'LF%',  w: 12, align: 'center' as const, key: 'ft' },
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
      name: `${row.player.firstName[0]}. ${row.player.lastName}`.slice(0, hasMinutes ? 16 : 20),
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
      fg: pct(row.stats.fgMade, row.stats.fgAttempted),
      fg3: pct(row.stats.fg3Made, row.stats.fg3Attempted),
      ft: pct(row.stats.ftMade, row.stats.ftAttempted),
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
