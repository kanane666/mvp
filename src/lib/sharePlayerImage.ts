/**
 * sharePlayerImage.ts
 * Génère deux types d'images partageables pour un joueur :
 * 1. Carte profil globale (stats de carrière)
 * 2. Performance dans un match donné
 */

import type { Player, PlayerStats } from '@/types/basketball';
import type { CareerStats } from './playerStats';

const C = {
  bg:      '#0d0d1a',
  card:    '#14142b',
  border:  '#252545',
  primary: '#7c6ff5',
  text:    '#eeeeff',
  muted:   '#7778aa',
  green:   '#22c55e',
  gold:    '#fbbf24',
  red:     '#ef4444',
};

function t(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, opts: {
  size?: number; weight?: string; color?: string; align?: CanvasTextAlign; maxW?: number;
} = {}) {
  const { size = 14, weight = '500', color = C.text, align = 'left', maxW } = opts;
  ctx.font = `${weight} ${size}px -apple-system,system-ui,sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  let s = String(str);
  if (maxW) {
    while (ctx.measureText(s).width > maxW && s.length > 1) s = s.slice(0, -1);
    if (s !== String(str)) s = s.slice(0, -1) + '…';
  }
  ctx.fillText(s, x, y);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stat(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, w: number) {
  rr(ctx, x, y, w, 52, 10);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  t(ctx, value, x + w / 2, y + 30, { size: 22, weight: '900', color: C.primary, align: 'center' });
  t(ctx, label, x + w / 2, y + 46, { size: 10, weight: '500', color: C.muted, align: 'center' });
}

function pct(made: number, att: number) {
  return att > 0 ? `${Math.round((made / att) * 100)}%` : '–';
}

function formatMin(min?: number) {
  if (!min || min <= 0) return '–';
  return `${Math.floor(min)}:${Math.round((min % 1) * 60).toString().padStart(2, '0')}`;
}

async function makeBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(b => resolve(b), 'image/png', 1.0);
    } catch {
      try {
        const d = canvas.toDataURL('image/png');
        const b64 = d.split(',')[1];
        const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        resolve(new Blob([u8], { type: 'image/png' }));
      } catch { resolve(null); }
    }
  });
}

// ─── 1. Carte profil global ───────────────────────────────────────────────────
export async function generatePlayerProfileImage(
  player: Player,
  career: CareerStats,
  teamName: string,
): Promise<Blob | null> {
  const W = 700, H = 420, PAD = 24, SC = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SC; canvas.height = H * SC;
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(canvas);

  try {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SC, SC);

    // Fond dégradé
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d0d1a');
    grad.addColorStop(1, '#131328');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cercle décoratif en arrière-plan
    ctx.beginPath();
    ctx.arc(W - 80, 80, 120, 0, Math.PI * 2);
    ctx.fillStyle = C.primary + '0a';
    ctx.fill();

    // En-tête
    rr(ctx, PAD, PAD, W - PAD * 2, 90, 16);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Numéro de maillot
    if (player.jerseyNumber !== undefined) {
      rr(ctx, PAD + 14, PAD + 14, 56, 56, 12);
      ctx.fillStyle = C.primary + '22';
      ctx.fill();
      t(ctx, `#${player.jerseyNumber}`, PAD + 42, PAD + 54, { size: 22, weight: '900', color: C.primary, align: 'center' });
    }

    const nameX = player.jerseyNumber !== undefined ? PAD + 82 : PAD + 16;
    t(ctx, `${player.firstName} ${player.lastName}`, nameX, PAD + 38, {
      size: 22, weight: '800', maxW: W - nameX - PAD - 80,
    });
    t(ctx, teamName, nameX, PAD + 58, { size: 12, color: C.muted });
    if (player.position) {
      t(ctx, player.position, nameX, PAD + 74, { size: 11, color: C.primary });
    }

    // Badge matchs
    const badgeX = W - PAD - 70;
    rr(ctx, badgeX, PAD + 20, 58, 46, 10);
    ctx.fillStyle = C.primary + '18';
    ctx.fill();
    t(ctx, String(career.games), badgeX + 29, PAD + 50, { size: 20, weight: '900', color: C.primary, align: 'center' });
    t(ctx, 'MATCHS', badgeX + 29, PAD + 63, { size: 9, weight: '600', color: C.muted, align: 'center' });

    // Stats tiles
    const tileY = PAD + 102;
    const tileW = (W - PAD * 2 - 20) / 5;
    const stats5 = [
      { label: 'PTS moy', value: career.avg.points.toFixed(1) },
      { label: 'REB moy', value: career.avg.rebounds.toFixed(1) },
      { label: 'PD moy',  value: career.avg.assists.toFixed(1) },
      { label: 'INT moy', value: career.avg.steals.toFixed(1) },
      { label: 'MIN moy', value: career.avgMinutes > 0 ? formatMin(career.avgMinutes) : `${career.avg.blocks.toFixed(1)} CTR` },
    ];
    stats5.forEach((s, i) => stat(ctx, s.label, s.value, PAD + i * (tileW + 5), tileY, tileW));

    // Deuxième rangée
    const tileY2 = tileY + 62;
    const stats5b = [
      { label: 'FG%',      value: pct(career.totals.fgMade, career.totals.fgAttempted) },
      { label: '3PT%',     value: pct(career.totals.fg3Made, career.totals.fg3Attempted) },
      { label: 'LF%',      value: pct(career.totals.ftMade, career.totals.ftAttempted) },
      { label: 'BP moy',   value: career.avg.fouls.toFixed(1) },
      { label: 'Efficacité', value: career.efficiency > 0 ? `+${career.efficiency}` : String(career.efficiency) },
    ];
    stats5b.forEach((s, i) => stat(ctx, s.label, s.value, PAD + i * (tileW + 5), tileY2, tileW));

    // Footer
    t(ctx, 'MVP Basket Sénégal  ·  Ababacar Dieng  ·  diengbabacar666@gmail.com', W / 2, H - 12, { size: 10, color: C.muted, align: 'center' });

    return await makeBlob(canvas);
  } finally {
    document.body.removeChild(canvas);
  }
}

// ─── 2. Performance dans un match ─────────────────────────────────────────────
export async function generatePlayerMatchImage(
  player: Player,
  stats: PlayerStats,
  matchTitle: string,
  matchDate: string,
  teamName: string,
): Promise<Blob | null> {
  const W = 700, H = 380, PAD = 24, SC = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SC; canvas.height = H * SC;
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(canvas);

  try {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SC, SC);

    // Fond
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // En-tête
    rr(ctx, PAD, PAD, W - PAD * 2, 80, 16);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Numéro
    if (player.jerseyNumber !== undefined) {
      rr(ctx, PAD + 12, PAD + 12, 52, 52, 10);
      ctx.fillStyle = C.primary + '22';
      ctx.fill();
      t(ctx, `#${player.jerseyNumber}`, PAD + 38, PAD + 48, { size: 20, weight: '900', color: C.primary, align: 'center' });
    }
    const nx = player.jerseyNumber !== undefined ? PAD + 76 : PAD + 14;
    t(ctx, `${player.firstName} ${player.lastName}`, nx, PAD + 30, { size: 18, weight: '800', maxW: W - nx - PAD - 20 });
    t(ctx, teamName, nx, PAD + 48, { size: 11, color: C.muted });
    t(ctx, matchTitle, nx, PAD + 64, { size: 11, color: C.primary, maxW: W - nx - PAD - 20 });

    t(ctx, matchDate, W - PAD - 14, PAD + 32, { size: 10, color: C.muted, align: 'right' });

    // Stats principales (grande rangée)
    const mainY = PAD + 94;
    const mains = [
      { label: 'POINTS', value: String(stats.points), big: true },
      { label: 'REBONDS', value: String(stats.rebounds) },
      { label: 'PASSES', value: String(stats.assists) },
      { label: 'INT', value: String(stats.steals) },
      { label: 'CONTRES', value: String(stats.blocks) },
      { label: 'FAUTES', value: String(stats.foulsCommitted), danger: stats.foulsCommitted >= 4 },
    ];
    const mainW = (W - PAD * 2 - 25) / 6;
    mains.forEach((s, i) => {
      const sx = PAD + i * (mainW + 5);
      rr(ctx, sx, mainY, mainW, 60, 10);
      ctx.fillStyle = s.big ? C.primary + '22' : C.card;
      ctx.fill();
      ctx.strokeStyle = s.big ? C.primary + '44' : C.border;
      ctx.lineWidth = s.big ? 1.5 : 1;
      ctx.stroke();
      t(ctx, s.value, sx + mainW / 2, mainY + 35, {
        size: s.big ? 28 : 20,
        weight: '900',
        color: s.danger ? C.red : s.big ? C.primary : C.text,
        align: 'center',
      });
      t(ctx, s.label, sx + mainW / 2, mainY + 52, { size: 8, weight: '600', color: C.muted, align: 'center' });
    });

    // Stats tirs
    const shootY = mainY + 74;
    const shoots = [
      { label: 'Tirs de jeu', made: stats.fgMade, att: stats.fgAttempted },
      { label: 'Paniers 3pts', made: stats.fg3Made, att: stats.fg3Attempted },
      { label: 'Lancers francs', made: stats.ftMade, att: stats.ftAttempted },
    ];
    const shotW = (W - PAD * 2 - 16) / 3;
    shoots.forEach((s, i) => {
      const sx = PAD + i * (shotW + 8);
      rr(ctx, sx, shootY, shotW, 54, 10);
      ctx.fillStyle = C.card;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      t(ctx, `${s.made}/${s.att}`, sx + shotW / 2, shootY + 24, { size: 16, weight: '800', color: C.text, align: 'center' });
      t(ctx, pct(s.made, s.att), sx + shotW / 2, shootY + 38, { size: 13, weight: '700', color: C.primary, align: 'center' });
      t(ctx, s.label, sx + shotW / 2, shootY + 50, { size: 9, color: C.muted, align: 'center' });
    });

    // Temps de jeu si disponible
    if (stats.minutesPlayed && stats.minutesPlayed > 0) {
      t(ctx, `⏱ ${formatMin(stats.minutesPlayed)} jouées`, W / 2, shootY + 74, { size: 11, color: C.muted, align: 'center' });
    }

    // Ballons perdus séparément
    if (stats.turnovers > 0) {
      t(ctx, `${stats.turnovers} ballon${stats.turnovers > 1 ? 's' : ''} perdu${stats.turnovers > 1 ? 's' : ''}`,
        W - PAD, shootY + 74, { size: 10, color: C.red, align: 'right' });
    }

    // Footer
    t(ctx, 'MVP Basket Sénégal  ·  Ababacar Dieng  ·  diengbabacar666@gmail.com', W / 2, H - 12, { size: 10, color: C.muted, align: 'center' });

    return await makeBlob(canvas);
  } finally {
    document.body.removeChild(canvas);
  }
}

// ─── Share ou download ────────────────────────────────────────────────────────
export async function sharePlayerImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Stats MVP Basket' }); return; }
    catch (e: any) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
