# Déploiement sur Vercel

## Méthode 1 — Interface Vercel (recommandée)

1. Pousse ce dépôt sur GitHub/GitLab
2. Va sur https://vercel.com/new et importe le dépôt
3. Vercel détecte automatiquement la config via `vercel.json` — **ne change rien**
4. Clique **Deploy** ✅

Le fichier `vercel.json` contient déjà :
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist/client`
- `VERCEL=1` en variable d'env (active le mode SPA dans vite.config.ts)
- Rewrites pour le routing SPA (toutes les routes → `index.html`)

## Méthode 2 — CLI Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Notes

- L'app est 100 % client-side (localStorage). Aucune variable d'environnement serveur requise.
- Node.js 20+ recommandé.
- Le build produit `dist/client/` avec un `index.html` généré automatiquement.
