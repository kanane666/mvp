import fs from 'fs';
import path from 'path';

const clientDir = path.resolve('dist/client');
const assetsDir = path.join(clientDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('Assets directory not found:', assetsDir);
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const mainJs = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
const stylesCss = files.find(f => f.startsWith('styles-') && f.endsWith('.css'));

if (!mainJs) {
  console.error('Could not find main JS bundle');
  process.exit(1);
}

const cssLink = stylesCss ? `  <link rel="stylesheet" href="/assets/${stylesCss}">\n` : '';

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BasketTrack - Suivi de match</title>
<meta name="description" content="Application de suivi de stats basketball en temps réel">
${cssLink}</head>
<body>
<script type="module" src="/assets/${mainJs}"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(clientDir, 'index.html'), html);
console.log('Generated dist/client/index.html for SPA deployment');
