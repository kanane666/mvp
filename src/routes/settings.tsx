import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { downloadBackup, importBackup } from "@/lib/storage";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { isSupabaseConfigured, checkSupabaseConnection } from "@/lib/supabase";

function TutoStep({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-bold text-foreground mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const STATUS_LABELS = {
  idle:     { icon: '☁️', text: 'Cloud connecté',     color: 'text-primary' },
  syncing:  { icon: '🔄', text: 'Synchronisation…',   color: 'text-primary animate-pulse' },
  synced:   { icon: '✅', text: 'Synchronisé',         color: 'text-green-600' },
  error:    { icon: '⚠️', text: 'Erreur de sync',      color: 'text-destructive' },
  offline:  { icon: '📱', text: 'Mode local (hors-ligne)', color: 'text-muted-foreground' },
};

function SettingsPage() {
  const syncStatus = useSyncStatus();
  const statusInfo = STATUS_LABELS[syncStatus];

  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [connTested, setConnTested] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const json = ev.target?.result as string;
      const result = importBackup(json);
      setImportMsg(result.ok
        ? { ok: true, text: 'Données importées ! Rechargement…' }
        : { ok: false, text: result.error || 'Erreur inconnue.' }
      );
      if (result.ok) setTimeout(() => window.location.reload(), 1500);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const testConnection = async () => {
    const ok = await checkSupabaseConnection();
    setConnTested(ok);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
      </header>

      <div className="px-5 space-y-4 pb-12">

        {/* ── État de sync ── */}
        {/* ── Tutoriel ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h2 className="text-sm font-bold text-foreground">📖 Guide d'utilisation</h2>

          <TutoStep icon="👥" title="1. Créer ton équipe">
            Va dans <b>Équipes</b> → clique <b>+ Créer</b> → renseigne le nom, la catégorie et ajoute tes joueurs avec leur numéro de maillot.
          </TutoStep>

          <TutoStep icon="⚡" title="2. Match rapide (scoreboard)">
            Depuis l'accueil, choisis <b>Match rapide</b>. Un grand scoreboard s'affiche. Touche les boutons <b>+1 / +2 / +3</b> pour marquer les points de chaque équipe. Le chrono et les 24s se gèrent avec les boutons du centre. Le bouton ↩ annule la dernière action.
          </TutoStep>

          <TutoStep icon="📊" title="3. Mode assistant (stats complètes)">
            Choisis <b>Mode Assistant</b>, sélectionne tes équipes et commence le match. Touche d'abord <b>un joueur</b> dans la liste, puis l'<b>action</b> correspondante (+2, +3, rebond, passe…). L'onglet <b>Rotations</b> te permet de gérer les entrées/sorties et de suivre le temps de jeu.
          </TutoStep>

          <TutoStep icon="📋" title="4. Voir le rapport">
            Quand le match est terminé, clique <b>Voir le rapport</b>. Tu y trouveras le score par quart-temps, les tops performers et le tableau complet des stats. Utilise <b>🖼 Partager</b> pour envoyer une image ou <b>📄 PDF</b> pour une feuille de match officielle.
          </TutoStep>

          <TutoStep icon="🏋️" title="5. Gérer les entraînements">
            Dans <b>Entraînements</b> → crée une session pour une équipe → marque les joueurs présents et donne une note à chacun. Ces données apparaissent dans le profil de chaque joueur.
          </TutoStep>

          <TutoStep icon="📅" title="6. Suivre le calendrier">
            <b>Calendrier</b> affiche tous tes matchs et entraînements. Les points violets = matchs, amber = entraînements. Touche un jour pour voir le détail.
          </TutoStep>

          <TutoStep icon="💾" title="7. Sauvegarder tes données">
            Va dans <b>Sauvegarde manuelle</b> ci-dessous et télécharge un fichier JSON. Garde-le précieusement. Si tu changes d'appareil, importe ce fichier pour retrouver toutes tes données.
          </TutoStep>

          {isSupabaseConfigured && (
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Synchronisation cloud</p>
              <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.icon} {statusInfo.text}</span>
            </div>
          )}
        </section>



        {/* ── Sauvegarde locale ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">💾 Sauvegarde manuelle</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Exporte toutes tes données dans un fichier JSON.
              Utile pour transférer d'un téléphone à l'autre.
            </p>
          </div>
          <Button onClick={downloadBackup} className="w-full" size="lg">
            📥 Télécharger la sauvegarde
          </Button>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">
              ⚠️ L'import remplace toutes les données existantes.
            </p>
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              📤 Importer une sauvegarde
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {importMsg && (
              <p className={`mt-2 text-xs font-semibold ${importMsg.ok ? 'text-green-600' : 'text-destructive'}`}>
                {importMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* ── SQL mise à jour D2 ── */}
        {isSupabaseConfigured && (
          <section className="bg-card rounded-2xl p-5 border border-primary/20 space-y-3">
            <h2 className="text-sm font-bold text-foreground">🏆 Activer les classements D2</h2>
            <p className="text-xs text-muted-foreground">
              Exécute ce SQL dans Supabase → SQL Editor pour activer les classements publics et les liens de suivi.
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(SQL_LEAGUE)}
              className="w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-transform"
            >
              📋 Copier le SQL D2
            </button>
          </section>
        )}

        {/* ── Installer PWA ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground">📱 Installer l'app</h2>
          <p className="text-xs text-muted-foreground">Pour utiliser MVP sans connexion :</p>
          <div className="space-y-2 text-xs">
            <div className="flex gap-3 items-start">
              <span className="text-primary font-bold shrink-0">Android</span>
              <p className="text-muted-foreground">Chrome → menu ⋮ → "Ajouter à l'écran d'accueil"</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-primary font-bold shrink-0">iPhone</span>
              <p className="text-muted-foreground">Safari → bouton partager ↑ → "Sur l'écran d'accueil"</p>
            </div>
          </div>
        </section>

        {/* ── À propos ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground">ℹ️ À propos</h2>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl flex-shrink-0">
              🏀
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">MVP Basket Sénégal</p>
              <p className="text-xs text-muted-foreground">Application de suivi de stats basketball</p>
              <p className="text-[10px] text-primary font-semibold mt-0.5">Version 3.0</p>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Développeur</p>
            <p className="text-sm font-bold text-foreground">Ababacar Dieng</p>
            <p className="text-xs text-muted-foreground">Génie Logiciel</p>
            <a
              href="mailto:diengbabacar666@gmail.com"
              className="text-xs text-primary font-semibold mt-1 inline-block hover:underline"
            >
              diengbabacar666@gmail.com
            </a>
          </div>

          <div className="border-t border-border pt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Cloud Supabase</p>
            <span className={`text-xs font-bold ${isSupabaseConfigured ? 'text-green-500' : 'text-muted-foreground'}`}>
              {isSupabaseConfigured ? '✅ Actif' : '⚪ Non configuré'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}



// ─── SQL mise à jour pour les classements D2 ─────────────────────────────────
const SQL_LEAGUE = `-- MVP Basket Sénégal — Mise à jour pour classements D2
-- Exécute dans Supabase Dashboard → SQL Editor

-- Ajouter les colonnes championnat à la table matches
alter table matches add column if not exists division text;
alter table matches add column if not exists poule text;
alter table matches add column if not exists season text;
alter table matches add column if not exists "shareToken" text unique;
alter table matches add column if not exists "isPublic" boolean default false;
alter table matches add column if not exists "clubName" text;

-- Index pour les recherches rapides
create index if not exists idx_matches_division on matches(division);
create index if not exists idx_matches_season on matches(season);
create index if not exists idx_matches_share_token on matches("shareToken");
create index if not exists idx_matches_public on matches("isPublic") where "isPublic" = true;

-- Policy lecture publique : les matchs publics sont lisibles par TOUS (même sans compte)
drop policy if exists "matches_public_read" on matches;
create policy "matches_public_read" on matches
  for select
  using ("isPublic" = true OR auth.uid() = user_id);

-- Policy lecture par shareToken (pour le suivi en direct)
drop policy if exists "matches_share_token_read" on matches;
create policy "matches_share_token_read" on matches
  for select
  using ("shareToken" is not null AND "shareToken" != '');

-- Combiner les deux policies en une
drop policy if exists "matches_public_read" on matches;
drop policy if exists "matches_share_token_read" on matches;
create policy "matches_read" on matches
  for select
  using (
    "isPublic" = true
    OR ("shareToken" is not null AND "shareToken" != '')
    OR auth.uid() = user_id
  );`;
