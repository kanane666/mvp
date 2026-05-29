import React, { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { downloadBackup, importBackup } from "@/lib/storage";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { signOut, requestCoachPro, updateProfile } from "@/lib/auth";
import { isAdmin, isCoachPro } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const STATUS_LABELS = {
  idle:    { icon: "☁️", text: "Cloud connecté",       color: "text-primary" },
  syncing: { icon: "🔄", text: "Synchronisation…",     color: "text-primary animate-pulse" },
  synced:  { icon: "✅", text: "Synchronisé",           color: "text-green-600" },
  error:   { icon: "⚠️", text: "Erreur de sync",        color: "text-destructive" },
  offline: { icon: "📱", text: "Mode local",            color: "text-muted-foreground" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "⭐ Administrateur",
  coach_pro: "🏆 Coach Pro (D1/D2)",
  coach: "🏀 Coach",
};

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

function SettingsPage() {
  const navigate = useNavigate();
  const syncStatus = useSyncStatus();
  const statusInfo = STATUS_LABELS[syncStatus];
  const currentUser = useCurrentUser();

  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Coach pro request
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upgradeClub, setUpgradeClub] = useState(currentUser?.clubName || "");
  const [upgradeReason, setUpgradeReason] = useState("");
  const [upgradeState, setUpgradeState] = useState<"idle" | "sending" | "done" | "error">("idle");

  // Profile edit
  const [editName, setEditName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.displayName || "");

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const json = ev.target?.result as string;
      const result = importBackup(json);
      setImportMsg(result.ok
        ? { ok: true, text: "Données importées ! Rechargement…" }
        : { ok: false, text: result.error || "Erreur inconnue." }
      );
      if (result.ok) setTimeout(() => window.location.reload(), 1500);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleUpgradeRequest = async () => {
    if (!upgradeClub.trim() || !upgradeReason.trim()) return;
    setUpgradeState("sending");
    const res = await requestCoachPro(upgradeReason.trim(), upgradeClub.trim());
    setUpgradeState(res.ok ? "done" : "error");
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    await updateProfile({ displayName: newName.trim() });
    setEditName(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
      </header>

      <div className="px-5 space-y-4 pb-12">

        {/* ── Profil utilisateur ── */}
        {currentUser ? (
          <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
            <h2 className="text-sm font-bold text-foreground">👤 Mon compte</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-xl font-black flex-shrink-0">
                {currentUser.displayName?.[0] || currentUser.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {editName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      autoFocus
                      className="flex-1 bg-input border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button type="button" onClick={handleSaveName} className="text-xs text-primary font-bold px-2">OK</button>
                    <button type="button" onClick={() => setEditName(false)} className="text-xs text-muted-foreground px-2">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {currentUser.displayName || "Sans nom"}
                    </p>
                    <button type="button" onClick={() => { setEditName(true); setNewName(currentUser.displayName || ""); }}
                      className="text-[10px] text-primary">✏️</button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                <span className="text-[11px] font-semibold text-primary">
                  {ROLE_LABELS[currentUser.role] || currentUser.role}
                </span>
              </div>
            </div>
            {isAdmin() && (
              <Link to="/admin">
                <button type="button" className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors">
                  🔑 Accéder au Panel Admin
                </button>
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
              className="w-full py-2 rounded-xl text-xs font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Se déconnecter
            </button>
          </section>
        ) : (
          <section className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-sm font-bold text-foreground mb-1">Mode local (sans compte)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Tes données restent sur cet appareil. Crée un compte pour les synchroniser.
            </p>
            <Link to="/auth">
              <Button className="w-full">Créer un compte ou se connecter →</Button>
            </Link>
          </section>
        )}

        {/* ── Demande Coach Pro ── */}
        {currentUser && !isCoachPro() && !isAdmin() && (
          <section className="bg-card rounded-2xl p-5 border border-amber-500/25 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">🏆 Devenir Coach Pro</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Les clubs licenciés D1/D2 peuvent publier leurs matchs dans les classements officiels et générer des liens de suivi public.
              </p>
            </div>

            {upgradeState === "done" ? (
              <div className="bg-green-500/12 border border-green-500/20 rounded-xl px-4 py-3 text-xs font-semibold text-green-600">
                ✅ Demande envoyée ! L'administrateur l'examinera sous peu.
              </div>
            ) : !showUpgradeForm ? (
              <button
                type="button"
                onClick={() => setShowUpgradeForm(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-colors active:scale-95"
              >
                Faire une demande →
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Nom du club</label>
                  <input
                    type="text"
                    placeholder="Ex: DUC Basket, Jeanne d'Arc…"
                    value={upgradeClub}
                    onChange={e => setUpgradeClub(e.target.value)}
                    className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Pourquoi cette demande ?</label>
                  <textarea
                    placeholder="Ex: Je suis coach de l'équipe masculin de DUC qui joue en Nationale 2 poule B…"
                    value={upgradeReason}
                    onChange={e => setUpgradeReason(e.target.value)}
                    rows={3}
                    className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                {upgradeState === "error" && (
                  <p className="text-xs text-destructive">Erreur lors de l'envoi. Réessaie.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUpgradeRequest}
                    disabled={upgradeState === "sending" || !upgradeClub.trim() || !upgradeReason.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white disabled:opacity-50 active:scale-95"
                  >
                    {upgradeState === "sending" ? "⏳ Envoi…" : "Envoyer la demande →"}
                  </button>
                  <button type="button" onClick={() => setShowUpgradeForm(false)} className="px-4 py-2.5 rounded-xl text-xs text-muted-foreground bg-secondary">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Sync cloud ── */}
        {isSupabaseConfigured && (
          <section className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">☁️ Synchronisation</h2>
              <span className={`text-xs font-semibold ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.text}
              </span>
            </div>
          </section>
        )}

        {/* ── Tutoriel ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h2 className="text-sm font-bold text-foreground">📖 Guide d'utilisation</h2>
          <TutoStep icon="👥" title="1. Créer ton équipe">
            Va dans <b>Équipes</b> → <b>+ Créer</b> → renseigne le nom, la catégorie et ajoute tes joueurs avec leur numéro de maillot.
          </TutoStep>
          <TutoStep icon="⚡" title="2. Match rapide (scoreboard)">
            Depuis l'accueil, choisis <b>Match rapide</b>. Touche <b>+1 / +2 / +3</b> pour marquer. Le chrono et les 24s se synchronisent automatiquement.
          </TutoStep>
          <TutoStep icon="📊" title="3. Mode assistant (stats complètes)">
            Choisis <b>Mode Assistant</b>. Sélectionne un joueur puis l'action. L'onglet <b>Rotations</b> gère les entrées/sorties et le temps de jeu.
          </TutoStep>
          <TutoStep icon="📋" title="4. Rapport et partage">
            Après le match, clique <b>Voir le rapport</b>. Boutons <b>🖼 Image</b> et <b>📄 PDF</b> pour partager.
          </TutoStep>
          <TutoStep icon="🏆" title="5. Classements D2">
            Si tu es Coach Pro, crée un match officiel et active <b>Rendre public</b>. Le match apparaît dans la page <b>Classements D2</b>.
          </TutoStep>
          <TutoStep icon="💾" title="6. Sauvegarder">
            <b>Sauvegarde manuelle</b> ci-dessous → télécharge un fichier JSON. Si tu changes d'appareil, importe ce fichier.
          </TutoStep>
        </section>

        {/* ── Sauvegarde manuelle ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">💾 Sauvegarde manuelle</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Exporte toutes tes données dans un fichier JSON.
            </p>
          </div>
          <Button onClick={downloadBackup} className="w-full" size="lg">
            📥 Télécharger la sauvegarde
          </Button>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">⚠️ L'import remplace toutes les données existantes.</p>
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              📤 Importer une sauvegarde
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {importMsg && (
              <p className={`mt-2 text-xs font-semibold ${importMsg.ok ? "text-green-600" : "text-destructive"}`}>
                {importMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* ── Installer PWA ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground">📱 Installer l'app</h2>
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

        {/* ── SQL D2 (admin seulement) ── */}
        {isAdmin() && isSupabaseConfigured && (
          <section className="bg-card rounded-2xl p-5 border border-primary/20 space-y-3">
            <h2 className="text-sm font-bold text-foreground">🗄️ SQL Supabase (Admin)</h2>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(SQL_LEAGUE)}
              className="w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-transform"
            >
              📋 Copier le SQL complet
            </button>
          </section>
        )}

        {/* ── À propos ── */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground">ℹ️ À propos</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl flex-shrink-0">🏀</div>
            <div>
              <p className="text-sm font-bold text-foreground">MVP Basket Sénégal</p>
              <p className="text-xs text-muted-foreground">Version 5.0</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Développeur</p>
            <p className="text-sm font-bold text-foreground">Ababacar Dieng</p>
            <p className="text-xs text-muted-foreground">Génie Logiciel</p>
            <a href="mailto:diengbabacar666@gmail.com" className="text-xs text-primary font-semibold mt-1 inline-block hover:underline">
              diengbabacar666@gmail.com
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── SQL complet Supabase ─────────────────────────────────────────────────────
const SQL_LEAGUE = `-- MVP Basket Senegal - Setup complet
-- Colle dans Supabase Dashboard -> SQL Editor -> Run

-- Colonnes championnat dans matches
alter table matches add column if not exists division text;
alter table matches add column if not exists poule text;
alter table matches add column if not exists season text;
alter table matches add column if not exists "shareToken" text unique;
alter table matches add column if not exists "isPublic" boolean default false;
alter table matches add column if not exists "clubName" text;
alter table matches add column if not exists verified boolean default false;

-- Index
create index if not exists idx_matches_division on matches(division);
create index if not exists idx_matches_season on matches(season);
create index if not exists idx_matches_share_token on matches("shareToken");
create index if not exists idx_matches_public on matches("isPublic") where "isPublic" = true;

-- Policy lecture publique matches
drop policy if exists "matches_own" on matches;
create policy "matches_read" on matches
  for select using (
    "isPublic" = true
    OR ("shareToken" is not null AND "shareToken" != '')
    OR auth.uid() = user_id
  );
create policy "matches_write" on matches
  for all using (auth.uid() = user_id);

-- Profils utilisateurs
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'coach',
  display_name text,
  club_name text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles_read_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_write_own" on profiles
  for all using (auth.uid() = id);
create policy "profiles_admin_all" on profiles
  for all using (
    exists(select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );

-- Demandes coach_pro
create table if not exists upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  display_name text,
  club_name text,
  reason text,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table upgrade_requests enable row level security;
create policy "upgrade_insert" on upgrade_requests
  for insert with check (auth.uid() = user_id);
create policy "upgrade_read_own" on upgrade_requests
  for select using (auth.uid() = user_id);
create policy "upgrade_admin" on upgrade_requests
  for all using (
    exists(select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Signalements
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  type text,
  match_id text,
  message text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  status text default 'pending'
);
alter table reports enable row level security;
create policy "reports_insert" on reports
  for insert with check (auth.uid() = user_id);
create policy "reports_admin" on reports
  for all using (
    exists(select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Actualites
create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  category text default 'other',
  published boolean default true,
  created_at timestamptz default now()
);
alter table news enable row level security;
create policy "news_public_read" on news
  for select using (published = true);
create policy "news_admin" on news
  for all using (
    exists(select 1 from profiles where id = auth.uid() and role = 'admin')
  );`;
