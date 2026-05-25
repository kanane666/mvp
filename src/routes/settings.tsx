import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { downloadBackup, importBackup } from "@/lib/storage";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { isSupabaseConfigured, checkSupabaseConnection } from "@/lib/supabase";

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
        <section className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-foreground">☁️ Synchronisation cloud</h2>
            <span className={`text-xs font-semibold ${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.text}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {isSupabaseConfigured
              ? 'Tes données sont sauvegardées automatiquement dans le cloud.'
              : 'Cloud non configuré — données stockées uniquement sur cet appareil.'}
          </p>

          {isSupabaseConfigured ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={testConnection}
                className="w-full py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold active:scale-95 transition-transform"
              >
                Tester la connexion
              </button>
              {connTested !== null && (
                <p className={`text-xs font-semibold text-center ${connTested ? 'text-green-600' : 'text-destructive'}`}>
                  {connTested ? '✅ Connexion Supabase OK !' : '❌ Connexion échouée — vérifie tes clés dans .env'}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-secondary/60 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Comment activer le cloud :</p>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Crée un compte gratuit sur <span className="text-primary font-semibold">supabase.com</span></li>
                <li>Crée un nouveau projet (gratuit)</li>
                <li>Va dans <span className="font-semibold">Settings → API</span></li>
                <li>Copie ton <span className="font-semibold">Project URL</span> et ton <span className="font-semibold">anon public key</span></li>
                <li>Ouvre le fichier <span className="font-mono text-primary">.env</span> à la racine du projet</li>
                <li>Remplace les deux valeurs <span className="font-mono">REMPLACER_PAR_...</span></li>
                <li>Exécute le SQL dans <span className="font-semibold">Étape SQL Supabase</span> ci-dessous</li>
                <li>Push sur GitHub → Vercel redéploie automatiquement</li>
              </ol>
            </div>
          )}
        </section>

        {/* ── SQL Supabase ── */}
        {!isSupabaseConfigured && (
          <section className="bg-card rounded-2xl p-5 border border-primary/20">
            <h2 className="text-sm font-bold text-foreground mb-2">🗄️ SQL à exécuter dans Supabase</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Dans ton projet Supabase → <span className="font-semibold">SQL Editor</span> → colle et exécute ce code :
            </p>
            <div className="bg-secondary rounded-xl p-3 overflow-x-auto">
              <pre className="text-[10px] text-foreground font-mono whitespace-pre">{SQL_SETUP}</pre>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(SQL_SETUP)}
              className="mt-2 w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-transform"
            >
              📋 Copier le SQL
            </button>
          </section>
        )}

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
        <section className="bg-card rounded-2xl p-5 border border-border">
          <h2 className="text-sm font-bold text-foreground mb-2">ℹ️ À propos</h2>
          <p className="text-xs text-muted-foreground">MVP Basket Sénégal — v3.0</p>
          <p className="text-xs text-muted-foreground mt-1">
            Cloud : {isSupabaseConfigured ? '✅ Configuré' : '❌ Non configuré'}
          </p>
        </section>
      </div>
    </div>
  );
}

// ─── SQL de setup Supabase ────────────────────────────────────────────────────
const SQL_SETUP = `-- MVP Basket Sénégal — Setup Supabase
-- Colle ce SQL dans: Supabase Dashboard → SQL Editor → Run

-- Active l'extension uuid
create extension if not exists "uuid-ossp";

-- Table équipes
create table if not exists teams (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text,
  gender text,
  players jsonb default '[]',
  "createdAt" bigint,
  updated_at timestamptz default now()
);

-- Table matchs
create table if not exists matches (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  mode text,
  "matchCategory" text,
  "teamAName" text,
  "teamBName" text,
  "teamAId" text,
  "teamBId" text,
  "playersA" jsonb default '[]',
  "playersB" jsonb default '[]',
  events jsonb default '[]',
  quarter int default 1,
  "timerSeconds" int default 600,
  "timerRunning" boolean default false,
  "shotClockSeconds" int default 24,
  "shotClockRunning" boolean default false,
  "timeoutsA" int default 0,
  "timeoutsB" int default 0,
  status text default 'live',
  "createdAt" bigint,
  updated_at timestamptz default now()
);

-- Table sessions d'entraînement
create table if not exists training_sessions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  "teamId" text,
  date bigint,
  notes text,
  "createdAt" bigint
);

-- Table présences
create table if not exists attendance (
  session_id text,
  player_id text,
  user_id uuid references auth.users(id) on delete cascade,
  status text,
  primary key (session_id, player_id)
);

-- Table évaluations
create table if not exists evaluations (
  session_id text,
  player_id text,
  user_id uuid references auth.users(id) on delete cascade,
  rating int,
  primary key (session_id, player_id)
);

-- Row Level Security : chaque utilisateur ne voit que ses données
alter table teams enable row level security;
alter table matches enable row level security;
alter table training_sessions enable row level security;
alter table attendance enable row level security;
alter table evaluations enable row level security;

create policy "teams_own" on teams
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "matches_own" on matches
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions_own" on training_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attendance_own" on attendance
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "evaluations_own" on evaluations
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Activer Anonymous Auth dans Supabase Dashboard:
-- Authentication → Providers → Anonymous Sign-ins → Enable`;
