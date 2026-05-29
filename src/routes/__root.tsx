import { Outlet, Link, createRootRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initAuth, getCurrentUser, onAuthChange } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

// Routes publiques qui ne nécessitent pas d'onboarding
const PUBLIC_ROUTES = ["/auth", "/live/", "/league"];
const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.some(r => path.startsWith(r));

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
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

    // Routes publiques → pas de redirect
    if (isPublicRoute(path)) { setReady(true); return; }

    // Supabase non configuré → app locale directement
    if (!isSupabaseConfigured) { setReady(true); return; }

    // Vérifier si première visite (jamais vu l'onboarding)
    const hasVisited = localStorage.getItem('mvp_has_visited');

    if (!hasVisited && path === '/') {
      // Première visite → page auth
      localStorage.setItem('mvp_has_visited', '1');
      navigate({ to: '/auth' }).then(() => setReady(true));
      return;
    }

    setReady(true);
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
