import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { sendMagicLink, signInWithPassword, signUpWithPassword, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "login" | "register" | "magic";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (getCurrentUser()) navigate({ to: "/" });
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);

    if (mode === "magic") {
      const res = await sendMagicLink(email.trim());
      setMessage(res.ok
        ? { ok: true, text: `Lien envoyé à ${email} — vérifie ta boîte mail !` }
        : { ok: false, text: res.error || "Erreur" }
      );
    } else if (mode === "login") {
      const res = await signInWithPassword(email.trim(), password);
      if (res.ok) navigate({ to: "/" });
      else setMessage({ ok: false, text: res.error || "Email ou mot de passe incorrect." });
    } else {
      if (!password || password.length < 6) {
        setMessage({ ok: false, text: "Le mot de passe doit faire au moins 6 caractères." });
        setLoading(false);
        return;
      }
      const res = await signUpWithPassword(email.trim(), password, displayName.trim());
      setMessage(res.ok
        ? { ok: true, text: "Compte créé ! Vérifie ta boîte mail pour confirmer." }
        : { ok: false, text: res.error || "Erreur lors de la création du compte." }
      );
    }
    setLoading(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-4xl">⚙️</span>
        <h1 className="text-lg font-bold text-foreground">Cloud non configuré</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Pour créer un compte, configure d'abord Supabase dans le fichier <code className="text-primary">.env</code>.
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="text-primary text-sm font-semibold"
        >
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-center">
        <span className="text-4xl">🏀</span>
        <h1 className="text-2xl font-black text-foreground mt-2">MVP Basket Sénégal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === "login" ? "Connexion à ton compte"
           : mode === "register" ? "Créer un nouveau compte"
           : "Connexion sans mot de passe"}
        </p>
      </div>

      <div className="flex-1 px-5 max-w-sm mx-auto w-full space-y-4">
        {/* Mode tabs */}
        <div className="flex gap-1 bg-secondary rounded-2xl p-1">
          {([["login", "Connexion"], ["register", "S'inscrire"], ["magic", "Magic link"]] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMessage(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">Ton prénom (optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Moustapha"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1 block">Adresse email</label>
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {(mode === "login" || mode === "register") && (
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">Mot de passe</label>
              <input
                type="password"
                placeholder={mode === "register" ? "6 caractères minimum" : "Ton mot de passe"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {mode === "magic" && (
            <p className="text-xs text-muted-foreground bg-secondary rounded-xl px-4 py-3">
              Tu recevras un lien par email. Clique dessus pour te connecter sans mot de passe. Idéal sur mobile.
            </p>
          )}

          {message && (
            <div className={`rounded-xl px-4 py-3 text-xs font-semibold ${
              message.ok ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !email.trim()}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "⏳ Chargement…"
             : mode === "login" ? "Se connecter →"
             : mode === "register" ? "Créer mon compte →"
             : "Envoyer le lien →"}
          </button>
        </div>

        {/* Sans compte */}
        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground mb-2">ou continuer sans compte</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-xs text-primary font-semibold"
          >
            Utiliser l'app en local →
          </button>
        </div>

        {/* Info roles */}
        <div className="bg-card rounded-2xl border border-border p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground text-[11px]">Pourquoi créer un compte ?</p>
          <p>✅ Retrouve tes données sur n'importe quel appareil</p>
          <p>✅ Synchronisation automatique dans le cloud</p>
          <p>🏆 Les clubs licenciés D1/D2 peuvent publier leurs matchs dans les classements officiels</p>
          <p className="text-[10px] text-muted-foreground/70 pt-1">
            Pour devenir club licencié (coach_pro), contacte l'admin après inscription.
          </p>
        </div>
      </div>

      <div className="py-6 text-center">
        <p className="text-[10px] text-muted-foreground">MVP Basket Sénégal · Ababacar Dieng</p>
      </div>
    </div>
  );
}
