import { Outlet, Link, createRootRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

// Routes qui ne nécessitent pas de vérification d'auth
const SKIP_AUTH_ROUTES = ["/auth", "/live/", "/league"];
const shouldSkip = (path: string) => SKIP_AUTH_ROUTES.some(r => path.startsWith(r));

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;

    // Routes publiques → pas de vérification
    if (shouldSkip(path)) { setReady(true); return; }

    // Supabase non configuré → app locale directement, pas d'auth
    if (!isSupabaseConfigured) { setReady(true); return; }

    // Mode anonyme explicitement choisi → app directement
    if (localStorage.getItem('mvp_anonymous') === '1') { setReady(true); return; }

    // Vérifier la session Supabase
    initAuth().then(user => {
      if (!user && path === '/') {
        // Pas connecté + première page → rediriger vers auth
        navigate({ to: '/auth' });
      }
      setReady(true);
    }).catch(() => setReady(true));

  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <span className="text-4xl">🏀</span>
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return <Outlet />;
}
