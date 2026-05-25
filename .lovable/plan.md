## Objectif

1. Rendre l'app facilement déployable sur **Netlify** sans bug
2. Permettre de cliquer sur un joueur dans le rapport de match pour ouvrir sa **page perso ultra-détaillée** (stats triées par match, % + chiffres exacts)
3. **Moderniser le design** (plus beau, intuitif), sans rien retirer ni casser

---

## 1. Déploiement Netlify

L'app utilise **uniquement localStorage** (aucun backend), donc on la déploie en **SPA statique** — le plus simple et le plus stable sur Netlify.

- Ajouter `netlify.toml` à la racine :
  - `command = "npm run build"` 
  - `publish = "dist"` (sortie statique)
  - Redirect SPA : `/*  →  /index.html  200`
- Ajouter un fichier `public/_redirects` de secours avec `/*  /index.html  200`
- Vérifier que le build produit bien un bundle statique exploitable (l'app n'a pas de loader serveur, tout est client-side)
- **Aucun changement** sur la config Cloudflare existante (le `wrangler.jsonc` reste en place pour ceux qui veulent l'utiliser)

Résultat : l'utilisateur connecte le repo Netlify → build auto → site live, sans config manuelle.

---

## 2. Page joueur ultra-détaillée (`/player/$playerId`)

La page existe déjà mais reste superficielle. On l'enrichit **sans rien supprimer** :

**Nouvelles sections ajoutées :**

### a) Carte d'en-tête joueur enrichie
- Numéro, nom, équipe, poste
- Bandeau de KPIs : Matchs joués · PTS moyens · Meilleur match · % réussite globale FG/3PT/LF

### b) Totaux carrière (en plus des moyennes déjà présentes)
- Tableau 2 colonnes : **Moyenne** / **Total cumulé** pour chaque stat (PTS, REB ROF/RDF/TOT, PD, INT, CTR, BP, F)
- Pourcentages globaux : `FG% = made/att`, `3PT%`, `LF%` avec affichage `made/att (xx%)`

### c) Détail par match (la vraie nouveauté demandée)
Liste de **tous** les matchs joués (pas seulement les 5 derniers — section dédiée triée), chaque ligne dépliable :
- Ligne compacte : date · catégorie · adversaire · score équipe · **PTS du joueur**
- Cliquable pour ouvrir un panneau détaillé avec **TOUTES les stats du match** :
  - PTS, REB (off/def/tot), PD, INT, CTR, BP, Fautes
  - Tirs : `FG made/att (xx%)`, `3PT made/att (xx%)`, `LF made/att (xx%)`
  - Points par quart-temps du joueur
  - Lien "Voir le rapport complet du match" → `/report/$matchId`
- Filtres existants (Tout/Officiel/Amical/Entraînement) maintenus
- Tri : par date (récent), ou par PTS (toggle)

### d) Tendances (déjà présentes, conservées et améliorées visuellement)
- Sparkline PTS sur les N derniers matchs
- Sparkline notes d'entraînement

### e) Présence & évaluations entraînement (déjà présent, conservé)

**Navigation :** depuis le rapport de match, chaque nom de joueur dans le tableau est déjà cliquable et mène à `/player/$playerId` — on s'assure que c'est bien visuellement évident (hover/underline + icône `→`).

---

## 3. Refonte design (modernisation visuelle)

Pas de changement fonctionnel, uniquement présentation. Respect du thème sombre existant (oklch primary 220).

- **Cartes** : passage à des cartes avec gradients subtils (`bg-gradient-to-br from-card to-card/60`), bordures plus douces, ombres `shadow-glow` sur hover
- **Typographie** : hiérarchie renforcée (titres plus gros et plus tracking-tight, valeurs numériques en tabular avec font-black + `text-primary`)
- **KPI boxes** : nouveau style "stat-tile" réutilisable (gros chiffre + label discret + sous-info optionnelle comme `12/18 (67%)`)
- **Tableaux** : zebra striping subtil, lignes plus aérées, sticky header sur mobile pour le tableau du rapport
- **Animations** : transitions douces sur hover/expand (`transition-all duration-200`), accordéon natif pour le détail par match
- **Top performers** : remontés visuellement (médailles 🥇🥈🥉, couleurs distinctes), liens plus clairs vers le profil joueur
- **Boutons retour** : iconographie cohérente (chevron + label court)

Tout reste mobile-first, max 2 taps par action — règle core respectée.

---

## Fichiers modifiés / créés

**Nouveaux fichiers :**
- `netlify.toml` — config build + redirect SPA
- `public/_redirects` — fallback SPA
- `src/components/StatTile.tsx` — tuile KPI réutilisable
- `src/components/PlayerMatchRow.tsx` — ligne dépliable de match dans le profil joueur

**Modifiés :**
- `src/routes/player.$playerId.tsx` — sections enrichies (totaux, détail par match dépliable, KPIs)
- `src/lib/playerStats.ts` — ajout helper `getPlayerMatchDetail()` (stats + quarter breakdown pour un match donné)
- `src/routes/report.$matchId.tsx` — meilleure mise en valeur du lien joueur (hover + icône)
- `src/components/TopPlayersBanner.tsx` — médailles + style premium
- `src/components/MatchListSection.tsx` — design rafraîchi
- `src/styles.css` — quelques utilitaires (gradients, glow, stat-tile)

**Non modifiés (zéro régression) :**
- Toute la logique de match live, événements, shot clock, storage, types
- Toutes les autres routes (stats officielles/amicales/training/history, training sessions, etc.)
- Routing existant

---

## Garanties anti-bug

- Aucun changement de modèle de données ni de format storage → données existantes intactes
- Aucune nouvelle dépendance npm → pas de risque de version incompatible
- Toutes les nouvelles vues utilisent les helpers existants (`computePlayerStats`, `getPlayerMatches`) → cohérence garantie
- Pas de modification du build Cloudflare actuel → `netlify.toml` est purement additif