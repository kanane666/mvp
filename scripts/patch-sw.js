/**
 * patch-sw.js — Injecte un timestamp unique dans sw.js après le build
 * Cela force le navigateur à reconnaître un nouveau service worker
 * à chaque déploiement, ce qui purge l'ancien cache automatiquement.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildTime = Date.now().toString(36); // ex: "lp4x2kz"

// Patch dans public/sw.js (pour le dev)
const swPublic = join(root, 'public', 'sw.js');
let sw = readFileSync(swPublic, 'utf8');
sw = sw.replace('__BUILD_TIME__', buildTime);
writeFileSync(swPublic, sw);

// Copier le sw patché dans dist/client/ (output Vercel)
const swDist = join(root, 'dist', 'client', 'sw.js');
try {
  writeFileSync(swDist, sw);
  console.log(`✓ sw.js patché — cache: mvp-basket-${buildTime}`);
} catch {
  console.log(`✓ sw.js patché (dist non trouvé, ok en dev)`);
}

// Remettre le placeholder dans public/sw.js pour le prochain build
let swReset = readFileSync(swPublic, 'utf8');
swReset = swReset.replace(buildTime, '__BUILD_TIME__');
writeFileSync(swPublic, swReset);
