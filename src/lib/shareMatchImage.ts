/**
 * shareMatchImage.ts — Génération d'image PNG via Canvas HTML5
 *
 * Corrections vs v1 :
 * - Canvas attaché au DOM (requis par Safari mobile pour toBlob)
 * - Fallback dataURL si toBlob échoue
 * - Dimensions fixes (pas de calcul dynamique instable)
 * - Texte tronqué proprement
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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0d0d1a',
  card:    '#14142b',
  border:  '#252545',
  primary: '#7c6ff5',
  text:    '#eeeeff',
  muted:   '#7778aa',
  green:   '#22c55e',
  red:     '#ef4444',
  gold:    '#fbbf24',
};

// ─── Canvas utils ─────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 16) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, opts: {
  size?: number; weight?: string; color?: string; align?: CanvasTextAlign; maxW?: number;
} = {}) {
  const { size = 14, weight = '500', color = C.text, align = 'left', maxW } = opts;
  ctx.font = `${weight} ${size}px -apple-system,system-ui,sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (maxW) {
    // Tronquer avec ellipsis si nécessaire
    let s = String(str);
    while (ctx.measureText(s).width > maxW && s.length > 1) s = s.slice(0, -1);
    if (s !== String(str)) s = s.slice(0, -1) + '…';
    ctx.fillText(s, x, y);
  } else {
    ctx.fillText(String(str), x, y);
  }
}

function pct(made: number, att: number) {
  return att > 0 ? `${Math.round((made / att) * 100)}%` : '–';
}

// ─── Constantes de layout ─────────────────────────────────────────────────────
const W   = 900;    // largeur totale
const PAD = 28;     // padding global
const R   = 16;     // border-radius

// ─── Générateur principal ─────────────────────────────────────────────────────
export async function generateMatchImage(opts: ShareImageOptions): Promise<Blob | null> {
  const { match, rowsA, rowsB } = opts;

  const idA = match.teamAId || 'A';
  const idB = match.teamBId || 'B';
  const scoreA = getTeamScore(match.events, idA);
  const scoreB = getTeamScore(match.events, idB);
  const quarters = getQuarterScores(match);
  const maxRows = Math.max(rowsA.length, rowsB.length, 1);

  // Calcul hauteur dynamique
  const H_HEADER  = 180;
  const H_QUARTER = quarters.length > 0 ? 90 : 0;
  const H_TABLES  = 80 + maxRows * 30;
  const H_FOOTER  = 50;
  const H = PAD + H_HEADER + PAD + H_QUARTER + (quarters.length > 0 ? PAD : 0)
           + H_TABLES + PAD + H_FOOTER + PAD;

  // Créer le canvas et l'attacher au DOM (requis Safari mobile)
  const canvas = document.createElement('canvas');
  const SCALE = window.devicePixelRatio >= 2 ? 2 : 1.5;
  canvas.width  = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(canvas);

  try {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE, SCALE);

    // ── Fond ──
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    let y = PAD;

    // ── Header : score ──
    card(ctx, PAD, y, W - PAD * 2, H_HEADER, R);

    const date = new Date(match.createdAt).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    text(ctx, date.toUpperCase(), W / 2, y + 22, { size: 10, color: C.muted, align: 'center' });

    // Noms équipes
    text(ctx, match.teamAName, PAD + 20, y + 56, { size: 17, weight: '700', maxW: 250 });
    text(ctx, match.teamBName, W - PAD - 20, y + 56, { size: 17, weight: '700', align: 'right', maxW: 250 });

    // Scores
    const wonA = scoreA >= scoreB;
    const wonB = scoreB > scoreA;
    text(ctx, String(scoreA), PAD + 20, y + 140, { size: 72, weight: '900', color: wonA ? C.primary : C.text });
    text(ctx, String(scoreB), W - PAD - 20, y + 140, { size: 72, weight: '900', color: wonB ? C.primary : C.text, align: 'right' });

    // Tiret central
    text(ctx, '–', W / 2, y + 128, { size: 36, weight: '700', color: C.muted, align: 'center' });

    // Badge vainqueur
    const winner = scoreA > scoreB ? match.teamAName : scoreB > scoreA ? match.teamBName : null;
    if (winner) {
      const label = `🏆 ${winner.slice(0, 18)}`;
      const lw = ctx.measureText(label).width + 20;
      rr(ctx, W / 2 - lw / 2, y + H_HEADER - 30, lw, 20, 10);
      ctx.fillStyle = C.green + '33';
      ctx.fill();
      text(ctx, label, W / 2, y + H_HEADER - 16, { size: 11, weight: '600', color: C.green, align: 'center' });
    }

    y += H_HEADER + PAD;

    // ── Quart-temps ──
    if (quarters.length > 0) {
      card(ctx, PAD, y, W - PAD * 2, H_QUARTER, R);

      text(ctx, 'PAR QUART-TEMPS', W / 2, y + 18, { size: 10, weight: '600', color: C.muted, align: 'center' });

      const col0W = 120;
      const colW  = (W - PAD * 2 - col0W - 60) / (quarters.length + 1);
      const startX = PAD + 20 + col0W;
      const rowY1 = y + 34;

      // Headers
      quarters.forEach((q, i) => {
        text(ctx, `Q${q.quarter}`, startX + i * colW + colW / 2, rowY1, { size: 11, weight: '700', color: C.muted, align: 'center' });
      });
      text(ctx, 'TOTAL', startX + quarters.length * colW + colW / 2, rowY1, { size: 11, weight: '700', color: C.muted, align: 'center' });

      // Ligne A
      text(ctx, match.teamAName.slice(0, 14), PAD + 20, rowY1 + 22, { size: 12, weight: '600', color: C.text });
      quarters.forEach((q, i) => {
        text(ctx, String(q.a), startX + i * colW + colW / 2, rowY1 + 22, { size: 13, weight: '600', color: C.text, align: 'center' });
      });
      text(ctx, String(scoreA), startX + quarters.length * colW + colW / 2, rowY1 + 22, { size: 14, weight: '900', color: C.primary, align: 'center' });

      // Ligne B
      text(ctx, match.teamBName.slice(0, 14), PAD + 20, rowY1 + 44, { size: 12, weight: '600', color: C.text });
      quarters.forEach((q, i) => {
        text(ctx, String(q.b), startX + i * colW + colW / 2, rowY1 + 44, { size: 13, weight: '600', color: C.text, align: 'center' });
      });
      text(ctx, String(scoreB), startX + quarters.length * colW + colW / 2, rowY1 + 44, { size: 14, weight: '900', color: C.primary, align: 'center' });

      y += H_QUARTER + PAD;
    }

    // ── Tables joueurs (côte à côte) ──
    const tableW = (W - PAD * 3) / 2;
    drawTeamTable(ctx, PAD, y, tableW, rowsA, match.teamAName, scoreA, wonA);
    drawTeamTable(ctx, PAD * 2 + tableW, y, tableW, rowsB, match.teamBName, scoreB, wonB);

    const tableH = 80 + Math.max(rowsA.length, rowsB.length, 1) * 30;
    y += tableH + PAD;

    // ── Footer ──
    text(ctx, 'MVP Basket Sénégal  ·  Ababacar Dieng  ·  Génie Logiciel', W / 2, y + 20, { size: 11, color: C.muted, align: 'center' });
    text(ctx, 'diengbabacar666@gmail.com', W / 2, y + 38, { size: 10, color: C.primary, align: 'center' });

    // ── Export Blob ──
    return await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/png',
          1.0
        );
      } catch {
        // Fallback dataURL → Blob
        try {
          const dataURL = canvas.toDataURL('image/png');
          const arr = dataURL.split(',');
          const mime = arr[0].match(/:(.*?);/)![1];
          const bstr = atob(arr[1]);
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
          resolve(new Blob([u8arr], { type: mime }));
        } catch {
          resolve(null);
        }
      }
    });

  } finally {
    // Toujours retirer le canvas du DOM
    document.body.removeChild(canvas);
  }
}

// ─── Table d'une équipe ───────────────────────────────────────────────────────
function drawTeamTable(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  rows: ShareRow[],
  teamName: string,
  totalScore: number,
  isWinner: boolean,
) {
  const HDR_H  = 38;
  const COL_H  = 24;
  const ROW_H  = 28;
  const PAD_H  = 12;
  const maxShow = Math.min(rows.length, 8);
  const tableH = HDR_H + COL_H + maxShow * ROW_H + PAD_H;

  // Contour
  card(ctx, x, y, w, tableH, R);

  // Header équipe
  rr(ctx, x, y, w, HDR_H, R);
  ctx.fillStyle = isWinner ? '#162316' : '#14142b';
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  text(ctx, teamName, x + 14, y + 25, { size: 14, weight: '700', maxW: w - 80 });
  text(ctx, String(totalScore), x + w - 14, y + 26, { size: 20, weight: '900', color: isWinner ? C.green : C.primary, align: 'right' });

  // Colonnes headers
  const cols = [
    { label: '#',    xPct: 0.05, align: 'center' as const },
    { label: 'JOUEUR', xPct: 0.22, align: 'left' as const },
    { label: 'PTS',  xPct: 0.46, align: 'center' as const },
    { label: 'REB',  xPct: 0.58, align: 'center' as const },
    { label: 'PD',   xPct: 0.68, align: 'center' as const },
    { label: 'F',    xPct: 0.78, align: 'center' as const },
    { label: 'FG%',  xPct: 0.91, align: 'center' as const },
  ];

  const colsY = y + HDR_H + 16;
  cols.forEach(c => {
    text(ctx, c.label, x + w * c.xPct, colsY, { size: 9, weight: '600', color: C.muted, align: c.align });
  });

  // Ligne séparatrice
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, colsY + 6);
  ctx.lineTo(x + w - 10, colsY + 6);
  ctx.stroke();

  // Lignes joueurs
  rows.slice(0, maxShow).forEach((row, i) => {
    const ry = colsY + 10 + i * ROW_H;

    // Surligner top scorer
    if (i === 0 && row.stats.points > 0) {
      rr(ctx, x + 6, ry - 2, w - 12, ROW_H - 2, 8);
      ctx.fillStyle = C.primary + '18';
      ctx.fill();
    }

    const foulDanger = row.stats.foulsCommitted >= 4;
    const foulColor = foulDanger ? C.red : C.text;

    const vals: [string, number, CanvasTextAlign, string][] = [
      [row.player.jerseyNumber !== undefined ? String(row.player.jerseyNumber) : '–', 0.05, 'center', C.primary],
      [`${row.player.firstName[0]}. ${row.player.lastName}`.slice(0, 14), 0.22, 'left', i === 0 ? C.text : C.text + 'bb'],
      [String(row.stats.points), 0.46, 'center', i === 0 ? C.primary : C.text],
      [String(row.stats.rebounds), 0.58, 'center', C.text + 'bb'],
      [String(row.stats.assists), 0.68, 'center', C.text + 'bb'],
      [String(row.stats.foulsCommitted), 0.78, 'center', foulColor],
      [pct(row.stats.fgMade, row.stats.fgAttempted), 0.91, 'center', C.text + 'bb'],
    ];

    vals.forEach(([val, xPct, align, color]) => {
      text(ctx, val, x + w * xPct, ry + ROW_H / 2 + 4, {
        size: 11, weight: val === String(row.stats.points) && i === 0 ? '800' : '500',
        color, align,
      });
    });
  });

  if (rows.length === 0) {
    text(ctx, 'Aucune donnée joueur', x + w / 2, colsY + 30, { size: 11, color: C.muted, align: 'center' });
  }
}

// ─── Partage ou téléchargement ────────────────────────────────────────────────
export async function shareOrDownloadImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });

  // Essayer Web Share API avec fichier (Android Chrome, Safari iOS 15+)
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Rapport MVP Basket' });
      return;
    } catch (e: any) {
      // AbortError = l'utilisateur a annulé → pas une erreur
      if (e?.name === 'AbortError') return;
      // Autre erreur → fallback download
    }
  }

  // Fallback : téléchargement direct
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
