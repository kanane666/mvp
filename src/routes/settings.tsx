import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { downloadBackup, importBackup } from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const json = ev.target?.result as string;
      const result = importBackup(json);
      setImportMsg(result.ok
        ? { ok: true, text: 'Données importées avec succès ! Rechargez la page.' }
        : { ok: false, text: result.error || 'Erreur inconnue.' }
      );
      if (result.ok) setTimeout(() => window.location.reload(), 1500);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
      </header>

      <div className="px-5 space-y-4 pb-12">

        {/* Sauvegarde */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">💾 Sauvegarde des données</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Exporte toutes tes équipes, matchs et entraînements dans un fichier JSON.
              Garde ce fichier en sécurité — c'est ta seule sauvegarde tant que le cloud n'est pas configuré.
            </p>
          </div>

          <Button onClick={downloadBackup} className="w-full" size="lg">
            📥 Télécharger la sauvegarde
          </Button>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">
              ⚠️ L'import remplace toutes les données existantes.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              📤 Importer une sauvegarde
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            {importMsg && (
              <p className={`mt-2 text-xs font-semibold ${importMsg.ok ? 'text-green-600' : 'text-destructive'}`}>
                {importMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* Installer l'app */}
        <section className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground">📱 Installer l'app sur ton téléphone</h2>
          <p className="text-xs text-muted-foreground">
            Pour utiliser MVP sans connexion et avoir l'icône sur l'écran d'accueil :
          </p>
          <div className="space-y-2 text-xs text-foreground">
            <div className="flex gap-3 items-start">
              <span className="text-primary font-bold">Android</span>
              <p className="text-muted-foreground">Chrome → menu ⋮ → "Ajouter à l'écran d'accueil"</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-primary font-bold">iPhone</span>
              <p className="text-muted-foreground">Safari → bouton partager → "Sur l'écran d'accueil"</p>
            </div>
          </div>
        </section>

        {/* À propos */}
        <section className="bg-card rounded-2xl p-5 border border-border">
          <h2 className="text-sm font-bold text-foreground mb-2">ℹ️ À propos</h2>
          <p className="text-xs text-muted-foreground">MVP Basket Sénégal</p>
          <p className="text-xs text-muted-foreground">Version 3.0 — Phase 1 & 2 complètes</p>
          <p className="text-xs text-muted-foreground mt-2">
            Données stockées localement sur cet appareil.
          </p>
        </section>
      </div>
    </div>
  );
}
