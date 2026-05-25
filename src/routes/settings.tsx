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

