import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/stats")({
  component: StatsLayout,
});

const TABS = [
  { to: "/stats/official", label: "🏆 Officiel" },
  { to: "/stats/friendly", label: "🤝 Amical" },
  { to: "/stats/training", label: "🏀 Entraînement" },
  { to: "/stats/history", label: "📚 Historique" },
  { to: "/stats/compare", label: "⚖️ Comparer" },
] as const;

function StatsLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-3 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
      </header>

      <nav className="px-5 pb-3 flex gap-2 overflow-x-auto">
        {TABS.map(t => {
          const active = loc.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
