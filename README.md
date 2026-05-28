# MVP Basket Sénégal 🏀

Application web de suivi de statistiques basketball en temps réel, conçue pour les coachs, assistants et clubs du Sénégal.

---

## Ce que fait l'application

### 1. Gestion des équipes et des joueurs

Tu peux créer autant d'équipes que tu veux. Pour chaque équipe tu renseignes le nom, la catégorie (Minimes, Cadets, Juniors, Seniors), le genre (Masculin / Féminin) et la liste des joueurs.

Pour chaque joueur tu peux enregistrer : prénom, nom, numéro de maillot, poste (meneur, arrière, ailier, ailier fort, pivot), main forte, âge, taille et poids.

Depuis la page d'une équipe tu accèdes au **bilan saison de l'équipe** : nombre de victoires / défaites / matchs nuls, points marqués et encaissés en moyenne, top scoreurs de l'équipe, et historique de tous les matchs.

---

### 2. Mode Match Rapide ⚡

Un scoreboard plein écran pensé pour être utilisé comme tableau d'affichage. Tu ouvres le match, tu poses le téléphone ou la tablette bien en vue, et tu touches les boutons pour ajouter des points.

- **Chronomètre** avec décompte par quart-temps (10 minutes). Quand le temps est écoulé, l'app passe automatiquement au quart-temps suivant.
- **Shot clock à 24 secondes** synchronisé avec le chronomètre : s'arrête quand le chrono s'arrête, repart quand il repart, se remet à 24 automatiquement à chaque panier.
- **Boutons +1 / +2 / +3** pour chaque équipe
- **Compteur de fautes par équipe** avec alerte visuelle quand une équipe atteint 5 fautes dans un quart (l'adversaire est alors en situation de bonus : toute nouvelle faute donne des lancers francs)
- **Temps morts** comptabilisés
- **Annulation** de la dernière action (bouton ↩)
- Les **sons et vibrations** confirment chaque action (panier, faute, buzzer de fin de quart)

---

### 3. Mode Assistant 📊

Le vrai outil de statistiques. Tu crées un match en sélectionnant tes équipes (ou en nommant l'équipe adverse sans joueurs si c'est un match officiel), et tu saisis toutes les actions en temps réel.

**Ce que tu peux enregistrer pour chaque joueur :**
- Panier à 2 points (réussi ou raté)
- Panier à 3 points (réussi ou raté)
- Lancer franc (réussi ou raté)
- Passe décisive
- Rebond offensif / défensif
- Interception
- Contre
- Ballon perdu
- Faute personnelle / faute provoquée

**Scoreboard visible en permanence** avec chronomètre, shot clock, score, fautes d'équipe et temps morts.

**Gestion des rotations** : l'onglet "Rotations" montre deux colonnes — les joueurs sur le terrain à gauche, ceux au banc à droite. Un simple tap fait entrer ou sortir un joueur. L'app enregistre les timestamps d'entrée et de sortie pour calculer les **minutes jouées** de chaque joueur.

**Ajout d'un joueur à la volée** : si un joueur n'est pas dans la liste (remplaçant de dernière minute), tu peux l'ajouter directement depuis le match sans quitter l'écran.

**Annulation** : le bouton ↩ annule la dernière action, y compris un changement de joueur.

---

### 4. Rapport de match 📋

Après chaque match tu accèdes à un rapport complet :

- **Score final** avec badge vainqueur
- **Score par quart-temps** (tableau Q1/Q2/Q3/Q4 + total)
- **Top performers** : meilleur scoreur, meilleur passeur, meilleur rebondeur (cliquables vers le profil du joueur)
- **Runs d'équipe** : les séquences de points consécutifs (ex : un run de 8-0)
- **Tableau complet des stats** pour chaque équipe, avec pour chaque joueur : minutes jouées (si rotations activées), points, passes décisives, rebonds, interceptions, contres, ballons perdus, fautes, FG%, 3P%, LF%

**Partager le rapport :**
- Bouton 🖼 : génère une image PNG des stats, partageable via WhatsApp ou téléchargeable
- Bouton 📄 : génère un PDF professionnel format A4, idéal pour un rapport officiel ou pour envoyer à la fédération

---

### 5. Statistiques et profil joueur 📈

La section Stats regroupe tous les matchs par catégorie (Officiel, Amical, Entraînement). Tu peux voir l'historique complet et accéder au rapport de chaque match.

**Profil joueur :** pour chaque joueur tu vois ses statistiques de carrière complètes (totaux et moyennes par match), son efficacité (formule PER simplifiée : pts + reb + ast + int + ctr − ballons perdus − tirs ratés), ses minutes jouées en moyenne, et le détail de chaque match joué. Tu peux partager la **carte stats d'un joueur** en image.

---

### 6. Entraînements 🏋️

Tu crées des sessions d'entraînement pour une équipe. Pour chaque session tu enregistres :
- La **présence** de chaque joueur (présent / absent)
- Une **évaluation** de 1 à 5 étoiles

Le profil de chaque joueur affiche son **taux de présence aux entraînements** et sa **note moyenne**.

---

### 7. Calendrier 📅

Vue mensuelle de tous tes matchs et entraînements. Les points colorés indiquent les jours avec des événements (violet = match, amber = entraînement). En cliquant sur un jour tu vois les événements du jour avec le score.

---

### 8. Sauvegarde et cloud ☁️

**Mode local :** par défaut toutes les données sont sauvegardées sur l'appareil (localStorage). Elles restent là même si tu fermes l'app. Il faut cependant noter que vider le cache du navigateur efface les données.

**Sauvegarde manuelle :** dans Paramètres → tu peux exporter toutes tes données dans un fichier JSON et les réimporter sur un autre appareil.

**Mode cloud (Supabase) :** si tu as configuré Supabase (voir la section Développeur ci-dessous), les données se synchronisent automatiquement en arrière-plan. Tu peux utiliser l'app sur plusieurs appareils et tout reste à jour.

---

### 9. Application installable (PWA) 📱

MVP Basket fonctionne comme une application native sur téléphone :

- **Android :** ouvre Chrome → menu ⋮ → "Ajouter à l'écran d'accueil"
- **iPhone :** ouvre Safari → bouton partager ↑ → "Sur l'écran d'accueil"

Une fois installée, l'app fonctionne même sans connexion internet (les données locales restent accessibles).

---

## Alertes et sons

| Situation | Alerte |
|-----------|--------|
| Panier à 3 points | Double bip + vibration |
| Faute | Bip grave + vibration longue |
| Shot clock ≤ 5s | Bip rapide |
| Fin de quart-temps | Buzzer + vibration forte |
| 5 fautes d'équipe | Badge rouge "BONUS LF" sur le scoreboard |
| 4 fautes personnelles | Icône ⚠️ sur la carte joueur |
| 5 fautes personnelles | Joueur marqué DQ, ne peut plus jouer |

---

### 10. Page Effectifs 👥

La page **Effectifs** (accessible depuis l'accueil) centralise tous tes joueurs par équipe. Sélectionne une équipe dans la barre horizontale en haut pour voir tous ses joueurs triés par numéro de maillot. Pour chaque joueur tu vois directement ses moyennes (points, rebonds, passes) sans avoir à ouvrir son profil. Un champ de recherche apparaît si l'équipe a plus de 5 joueurs. Un clic sur un joueur ouvre son profil complet.

---

### 11. Comparateur de joueurs ⚖️

Dans **Stats → Comparer**, sélectionne deux joueurs de n'importe quelle équipe. L'app affiche :
- Un **radar chart** à 7 axes : Points, Rebonds, Passes, Interceptions, Contres, FG%, Efficacité. Les valeurs sont normalisées (100 = meilleur des deux sur chaque axe).
- Un **tableau comparatif** ligne par ligne avec les vraies moyennes. La valeur la plus haute est surlignée en couleur.
- Des liens directs vers le profil complet de chaque joueur.

---

### 12. Classements Nationale 2 🇸🇳

La page **/league** est une page **publique** (sans compte requis) qui affiche les classements du championnat sénégalais. Elle est accessible directement depuis l'accueil.

**Format du championnat implémenté :**
- Nationale 1 (N1) : 2 poules de 7 équipes, les 2 premiers de chaque poule en demi-finales, finale, vainqueur qualifié pour la BAL
- Nationale 2 (N2) : plusieurs poules, 1er de chaque poule → tournoi de montée direct, 2ème → barrages puis tournoi de montée

**Contenu de la page classements :**
- Sélecteur N1 / N2, Masculin / Féminin, saison
- Classement par poule : J/V/D, différentiel, points de championnat (V=2, D=1), badges 1er → Tournoi montée / 2ème → Barrages
- Top scoreurs, rebondeurs et passeurs de la division avec leurs moyennes
- Liens vers le profil complet de chaque joueur

**Comment un coach publie ses stats :**
Lors de la création d'un match en mode assistant → choisir "Match Officiel" → sélectionner la division (N1/N2), la poule, et activer "Rendre public". Les stats de ce match apparaissent automatiquement dans les classements.

---

### 13. Lien de suivi en direct 🔴

Quand un match est marqué comme public, un lien de la forme `mvp-basket.vercel.app/live/abc12345` est généré. N'importe qui avec ce lien (sans compte) peut suivre le match en temps réel :
- Score en direct avec chronomètre
- Fautes d'équipe et bonus
- Fil des 8 dernières actions
- Score par quart-temps (si match terminé)
- Mise à jour automatique toutes les 15 secondes

Le lien est partageable depuis la page rapport de match.

---

## Déploiement (pour les développeurs)

### Prérequis
- Node.js 20+
- Compte Vercel (gratuit)
- Compte Supabase (gratuit, optionnel pour le cloud)

### Déploiement Vercel

1. Pousse le projet sur GitHub
2. Importe le repo sur [vercel.com](https://vercel.com)
3. Vercel détecte automatiquement la config → clique **Deploy**

### Activer la synchronisation cloud (Supabase)

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Va dans **Settings → API** et copie l'`URL` et la `anon public key`
3. Ouvre le fichier `.env` à la racine du projet et remplace les deux valeurs
4. Dans Supabase → **SQL Editor** → exécute le SQL dans `src/routes/settings.tsx` (commentaire en bas du fichier)
5. Dans Supabase → **Authentication → Providers** → active **Anonymous Sign-ins**
6. Push → Vercel redéploie automatiquement

### Variables d'environnement

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| React 19 + TypeScript | Interface utilisateur |
| TanStack Router | Routage SPA |
| Vite | Build tool |
| Tailwind CSS | Styles |
| Supabase | Base de données cloud + Auth |
| jsPDF | Export PDF |
| Canvas API | Export image |
| Web Audio API | Sons |
| Service Worker | Mode hors-ligne (PWA) |

---

## Historique des versions

| Version | Nouveautés |
|---------|-----------|
| v1.0 | Build initial — équipes, matchs rapides, mode assistant |
| v2.0 | Correction bugs Vercel, timer drift-free, alertes fautes |
| v3.0 | Rotations + temps de jeu, export image/PDF, calendrier, cloud Supabase, PWA |
| v4.0 | Page Effectifs, Comparateur de joueurs, PDF profil/performance, partage image joueur, shot clock synchronisé, bannière mise à jour PWA |
| v5.0 | Classements D2 publics, lien suivi en direct, options championnat N1/N2/poule dans la création de match |

---

## Auteur

**Ababacar Dieng**  
Génie Logiciel  
[diengbabacar666@gmail.com](mailto:diengbabacar666@gmail.com)
