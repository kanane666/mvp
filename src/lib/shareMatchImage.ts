/**
 * shareMatchImage.ts
 * Génère une image PNG des stats du match via Canvas HTML5.
 * Aucune dépendance externe. Compatible mobile.
 */

import type { Match, Player, PlayerStats } from '@/types/basketball';
import { getTeamScore } from '@/types/basketball';
import { getQuarterScores } from './playerStats';

export interface ShareRow {
  player: Player;
  stats: PlayerStats;
}

interface ShareImageOptions {
  match: Match;
  rowsA: ShareRow[];
  rowsB: ShareRow[];
}

// ─── Palette (dark theme) ─────────────────────────────────────────────────────
const BG        = '#0d0d1a';
const CARD      = '#16162a';
const BORDER    = '#2a2a4a';
const PRIMARY   = '#7c6ff5';
const TEXT      = '#f0f0ff';
const MUTED     = '#888aaa';
const WIN_COLOR = '#22c55e';
const LOSE_COLOR= '#ef4444';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(made: number, att: number) {
  return att > 0 ? `${Math.round((made / att) * 100)}%` : '–';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateMatchImage(opts: ShareImageOptions): Promise<Blob | null> {
  const { match, rowsA, rowsB } = opts;

  const idA = match.teamAId || 'A';
  const idB = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, idA);
  const scoreB = getTeamScore(match.events, idB);
  const quarters = getQuarterScores(match);

  const W = 800;
  const PADDING = 24;
  const COL_W = (W - PADDING * 3) / 2;

  // Calculate height dynamically
  const HEADER_H    = 180;
  const QUARTER_H   = quarters.length > 0 ? 80 : 0;
  const SECTION_HDR = 36;
  const ROW_H       = 28;
  const TABLE_PAD   = 16;
  const tableAH     = SECTION_HDR + TABLE_PAD * 2 + Math.max(rowsA.length, 1) * ROW_H + 32; // 32 for col headers
  const tableBH     = SECTION_HDR + TABLE_PAD * 2 + Math.max(rowsB.length, 1) * ROW_H + 32;
  const FOOTER_H    = 40;

  const H = PADDING + HEADER_H + PADDING
          + QUARTER_H + (quarters.length > 0 ? PADDING : 0)
          + Math.max(tableAH, tableBH) + PADDING
          + FOOTER_H + PADDING;

  const canvas = document.createElement('canvas');
  // 2x for retina sharpness
  canvas.width  = W * 2;
  canvas.height = H * 2;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // ── Background ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  let y = PADDING;

  // ── Header card (score) ──
  drawCard(ctx, PADDING, y, W - PADDING * 2, HEADER_H);

  // Date
  const date = new Date(match.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  ctx.fillStyle = MUTED;
  ctx.font = '500 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(date.toUpperCase(), W / 2, y + 24);

  // Team A name
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(match.teamAName, PADDING + 20, y + 58);

  // Team B name
  ctx.textAlign = 'right';
  ctx.fillText(match.teamBName, W - PADDING - 20, y + 58);

  // Scores
  ctx.font = 'bold 64px system-ui';
  ctx.textAlign = 'left';
  ctx.fillStyle = scoreA >= scoreB ? PRIMARY : TEXT;
  ctx.fillText(String(scoreA), PADDING + 20, y + 130);

  ctx.textAlign = 'right';
  ctx.fillStyle = scoreB >= scoreA ? PRIMARY : TEXT;
  ctx.fillText(String(scoreB), W - PADDING - 20, y + 130);

  // Separator dash
  ctx.fillStyle = MUTED;
  ctx.font = 'bold 36px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('–', W / 2, y + 120);

  // Winner label
  const winner = scoreA > scoreB ? match.teamAName : scoreB > scoreA ? match.teamBName : null;
  if (winner) {
    ctx.fillStyle = WIN_COLOR;
    ctx.font = '600 11px system-ui';
    ctx.fillText(`🏆 ${winner}`, W / 2, y + 155);
  }

  y += HEADER_H + PADDING;

  // ── Quart-temps ──
  if (quarters.length > 0) {
    drawCard(ctx, PADDING, y, W - PADDING * 2, QUARTER_H);
    ctx.fillStyle = MUTED;
    ctx.font = '500 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('PAR QUART-TEMPS', W / 2, y + 18);

    const qW = (W - PADDING * 2 - 40) / (quarters.length + 1);
    const qY = y + 30;

    // Team labels
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT;
    ctx.fillText(match.teamAName.slice(0, 10), PADDING + 12, qY + 16);
    ctx.fillText(match.teamBName.slice(0, 10), PADDING + 12, qY + 34);

    quarters.forEach((q, i) => {
      const qx = PADDING + 130 + i * qW + qW / 2;
      ctx.fillStyle = MUTED;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`Q${q.quarter}`, qx, qY);
      ctx.fillStyle = TEXT;
      ctx.font = '600 13px system-ui';
      ctx.fillText(String(q.a), qx, qY + 17);
      ctx.fillText(String(q.b), qx, qY + 35);
    });

    // Total
    const tx = PADDING + 130 + quarters.length * qW + qW / 2;
    ctx.fillStyle = MUTED;
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TOT', tx, qY);
    ctx.fillStyle = PRIMARY;
    ctx.font = 'bold 13px system-ui';
    ctx.fillText(String(scoreA), tx, qY + 17);
    ctx.fillText(String(scoreB), tx, qY + 35);

    y += QUARTER_H + PADDING;
  }

  // ── Player tables (2 colonnes) ──
  const tableY = y;

  // Draw both team tables side by side
  await drawPlayerTable(ctx, PADDING, tableY, COL_W, rowsA, match.teamAName, scoreA, scoreA >= scoreB);
  await drawPlayerTable(ctx, PADDING * 2 + COL_W, tableY, COL_W, rowsB, match.teamBName, scoreB, scoreB > scoreA);

  // ── Footer ──
  const footerY = H - FOOTER_H - PADDING / 2;
  ctx.fillStyle = MUTED;
  ctx.font = '500 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('MVP Basket Sénégal', W / 2, footerY + 16);
  ctx.fillStyle = PRIMARY;
  ctx.fillText('mvp-basket.vercel.app', W / 2, footerY + 32);

  // ── Export as Blob ──
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
  });
}

async function drawPlayerTable(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  rows: ShareRow[],
  teamName: string,
  totalScore: number,
  isWinner: boolean,
) {
  const COLS = [
    { label: '#',    key: 'jerseyNumber', w: 24, align: 'center' as const },
    { label: 'JOUEUR', key: 'name',      w: 90, align: 'left'   as const },
    { label: 'PTS',  key: 'points',      w: 30, align: 'center' as const },
    { label: 'REB',  key: 'rebounds',    w: 28, align: 'center' as const },
    { label: 'PD',   key: 'assists',     w: 24, align: 'center' as const },
    { label: 'F',    key: 'foulsCommitted', w: 20, align: 'center' as const },
    { label: 'FG%',  key: 'fg',          w: 34, align: 'center' as const },
  ];

  const HDR_H  = 36;
  const COL_H  = 24;
  const ROW_H  = 26;
  const PAD    = 12;
  const innerW = w;

  const tableH = HDR_H + COL_H + rows.length * ROW_H + PAD * 2;
  drawCard(ctx, x, y, innerW, tableH);

  // Team header
  roundRect(ctx, x, y, innerW, HDR_H, 14);
  ctx.fillStyle = isWinner ? '#1a2e1a' : CARD;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = isWinner ? WIN_COLOR : TEXT;
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(teamName, x + PAD, y + 23);

  ctx.fillStyle = isWinner ? WIN_COLOR : PRIMARY;
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(String(totalScore), x + innerW - PAD, y + 25);

  // Column headers
  let cx = x + PAD;
  const colY = y + HDR_H + 4;
  for (const col of COLS) {
    ctx.fillStyle = MUTED;
    ctx.font = '500 9px system-ui';
    ctx.textAlign = col.align;
    const textX = col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w : cx;
    ctx.fillText(col.label, textX, colY + 12);
    cx += col.w;
  }

  // Divider
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + PAD, colY + 18);
  ctx.lineTo(x + innerW - PAD, colY + 18);
  ctx.stroke();

  // Rows
  rows.slice(0, 8).forEach((row, i) => {
    const ry = colY + 20 + i * ROW_H;
    const isTop = i === 0;

    if (isTop) {
      roundRect(ctx, x + 6, ry - 4, innerW - 12, ROW_H, 6);
      ctx.fillStyle = PRIMARY + '22';
      ctx.fill();
    }

    cx = x + PAD;
    const vals: Record<string, string> = {
      jerseyNumber: row.player.jerseyNumber !== undefined ? String(row.player.jerseyNumber) : '–',
      name: `${row.player.firstName[0]}. ${row.player.lastName}`.slice(0, 12),
      points: String(row.stats.points),
      rebounds: String(row.stats.rebounds),
      assists: String(row.stats.assists),
      foulsCommitted: String(row.stats.foulsCommitted),
      fg: pct(row.stats.fgMade, row.stats.fgAttempted),
    };

    for (const col of COLS) {
      const val = vals[col.key] ?? '–';
      const isFoul = col.key === 'foulsCommitted' && row.stats.foulsCommitted >= 4;
      const isPts  = col.key === 'points' && isTop;

      ctx.fillStyle = isFoul ? LOSE_COLOR : isPts ? PRIMARY : i === 0 ? TEXT : TEXT + 'cc';
      ctx.font = (isPts || isFoul) ? 'bold 11px system-ui' : (col.key === 'name' ? '500 10px system-ui' : '500 10px system-ui');
      ctx.textAlign = col.align;

      const textX = col.align === 'center' ? cx + col.w / 2
                  : col.align === 'right'  ? cx + col.w
                  : cx;
      ctx.fillText(val, textX, ry + 13);
      cx += col.w;
    }
  });
}

// ─── Share or download ────────────────────────────────────────────────────────
export async function shareOrDownloadImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });

  // Try Web Share API with file support (mobile)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Rapport de match MVP Basket',
      });
      return;
    } catch (e) {
      // User cancelled or share failed → fallback to download
    }
  }

  // Fallback: direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
