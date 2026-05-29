import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  sendMagicLink, signInWithPassword, signUpWithPassword,
  getCurrentUser, initAuth,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import mvpLogo from "@/assets/mvp-logo.png";

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
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Si Supabase non configuré → aller directement à l'app
    if (!isSupabaseConfigured) {
      navigate({ to: "/" });
      return;
    }
    // Déjà connecté → app
    initAuth().then(user => {
      if (user) navigate({ to: "/" });
      else setAuthReady(true);
    });
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);

    if (mode === "magic") {
      const res = await sendMagicLink(email.trim());
      setMessage(res.ok
        ? { ok: true, text: `✅ Lien envoyé à ${email} — vérifie ta boîte mail et clique sur le lien.` }
        : { ok: false, text: res.error || "Erreur" }
      );
    } else if (mode === "login") {
      const res = await signInWithPassword(email.trim(), password);
      if (res.ok) {
        navigate({ to: "/" });
      } else {
        setMessage({ ok: false, text: res.error || "Email ou mot de passe incorrect." });
      }
    } else {
      if (!password || password.length < 6) {
        setMessage({ ok: false, text: "Le mot de passe doit faire au moins 6 caractères." });
        setLoading(false);
        return;
      }
      const res = await signUpWithPassword(email.trim(), password, displayName.trim());
      setMessage(res.ok
        ? { ok: true, text: "✅ Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi." }
        : { ok: false, text: res.error || "Erreur lors de la création du compte." }
      );
      if (res.ok) setMode("login");
    }
    setLoading(false);
  };

  const continueAnonymous = () => {
    // Marquer que l'utilisateur a choisi le mode local consciemment
    localStorage.setItem('mvp_anonymous', '1');
    // Supprimer le flag has_visited s'il existe
    localStorage.removeItem('mvp_has_visited');
    navigate({ to: '/' });
  };

  if (!authReady && isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="px-5 pt-14 pb-8 text-center">
        <img src={mvpLogo} alt="MVP" className="w-16 h-16 object-contain mx-auto mb-4" />
        <h1 className="text-3xl font-black text-foreground tracking-tight">MVP Basket</h1>
        <p className="text-primary font-semibold text-sm mt-0.5">Sénégal</p>
        <p className="text-muted-foreground text-sm mt-3 max-w-xs mx-auto">
          Suis tes matchs, gère ton équipe, et rejoins les classements officiels N2.
        </p>
      </div>

      <div className="flex-1 px-5 max-w-sm mx-auto w-full">
        {/* Mode tabs */}
        <div className="flex gap-1 bg-secondary rounded-2xl p-1 mb-4">
          {([
            ["login", "Connexion"],
            ["register", "Inscription"],
            ["magic", "Magic link"],
          ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMessage(null); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {/* Nom (inscription seulement) */}
          {mode === "register" && (
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">
                Ton prénom <span className="text-muted-foreground/50">(optionnel)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Moustapha"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">
              Adresse email
            </label>
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoFocus
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* Mot de passe */}
          {(mode === "login" || mode === "register") && (
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">
                Mot de passe
                {mode === "register" && <span className="text-muted-foreground/50"> (6 caractères min.)</span>}
              </label>
              <input
                type="password"
                placeholder={mode === "register" ? "Choisir un mot de passe" : "Ton mot de passe"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Magic link info */}
          {mode === "magic" && (
            <div className="bg-primary/8 rounded-xl px-4 py-3 text-xs text-muted-foreground">
              Tu recevras un lien par email. Clique dessus pour te connecter instantanément — sans mot de passe à retenir. Idéal sur mobile.
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`rounded-xl px-4 py-3 text-xs font-medium leading-relaxed ${
              message.ok
                ? "bg-green-500/12 text-green-600 border border-green-500/20"
                : "bg-destructive/12 text-destructive border border-destructive/20"
            }`}>
              {message.text}
            </div>
          )}

          {/* Bouton principal */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !email.trim() || (mode !== "magic" && !password)}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ Chargement…"
             : mode === "login" ? "Se connecter →"
             : mode === "register" ? "Créer mon compte →"
             : "Envoyer le lien →"}
          </button>
        </div>

        {/* Séparateur */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Continuer sans compte */}
        <button
          type="button"
          onClick={continueAnonymous}
          className="w-full py-3.5 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-secondary transition-colors active:scale-[0.98]"
        >
          Continuer sans compte
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-2.5">
          Données stockées localement · Sans synchronisation cloud
        </p>

        {/* Avantages du compte */}
        <div className="mt-6 bg-card rounded-2xl border border-border p-4 space-y-2.5">
          <p className="text-xs font-bold text-foreground mb-1">Avec un compte :</p>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="text-primary mt-0.5">✓</span>
            <p>Retrouve tes données sur n'importe quel appareil</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="text-primary mt-0.5">✓</span>
            <p>Sauvegarde automatique dans le cloud</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="text-amber-500 mt-0.5">★</span>
            <p>Les clubs licenciés peuvent demander l'accès D1/D2 pour publier dans les classements officiels</p>
          </div>
        </div>
      </div>

      <div className="py-8 text-center">
        <p className="text-[10px] text-muted-foreground">
          MVP Basket Sénégal · Ababacar Dieng · Génie Logiciel
        </p>
      </div>
    </div>
  );
}
