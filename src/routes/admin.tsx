import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getCurrentUser, isAdmin, signOut, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getMatches } from "@/lib/storage";
import type { Match } from "@/types/basketball";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminTab = "overview" | "users" | "matches" | "reports" | "news";

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  display_name?: string;
  club_name?: string;
  created_at: string;
}

interface Report {
  id: string;
  type: "score_dispute" | "wrong_data" | "other";
  matchId: string;
  message: string;
  userId: string;
  createdAt: string;
  status: "pending" | "resolved";
}

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);

  // Data
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState({ users: 0, matches: 0, proclubs: 0, reports: 0 });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !isAdmin()) {
      navigate({ to: "/" });
      return;
    }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadPendingMatches(), loadReports(), loadNews()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) {
      setUsers(data);
      setStats(s => ({
        ...s,
        users: data.length,
        proclubs: data.filter(u => u.role === "coach_pro").length,
      }));
    }
  };

  const loadPendingMatches = async () => {
    if (!supabase) {
      const local = getMatches().filter(m => m.isPublic && !m.status);
      setPendingMatches(local);
      return;
    }
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("isPublic", true)
      .eq("status", "finished")
      .is("verified", null)
      .order("createdAt", { ascending: false })
      .limit(50);
    if (data) {
      setPendingMatches(data as Match[]);
      setStats(s => ({ ...s, matches: data.length }));
    }
  };

  const loadReports = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(100);
    if (data) {
      setReports(data as Report[]);
      setStats(s => ({ ...s, reports: data.filter((r: Report) => r.status === "pending").length }));
    }
  };

  const loadNews = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNews(data as NewsItem[]);
  };

  const promoteUser = async (userId: string, role: string) => {
    if (!supabase) return;
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setUsers(u => u.map(p => p.id === userId ? { ...p, role } : p));
  };

  const verifyMatch = async (matchId: string) => {
    if (!supabase) return;
    await supabase.from("matches").update({ verified: true }).eq("id", matchId);
    setPendingMatches(m => m.filter(x => x.id !== matchId));
  };

  const resolveReport = async (reportId: string) => {
    if (!supabase) return;
    await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
    setReports(r => r.map(x => x.id === reportId ? { ...x, status: "resolved" } : x));
    setStats(s => ({ ...s, reports: Math.max(0, s.reports - 1) }));
  };

  const user = getCurrentUser();
  if (!user) return null;

  const TABS: { id: AdminTab; label: string; badge?: number }[] = [
    { id: "overview", label: "📊 Vue d'ensemble" },
    { id: "users", label: "👥 Utilisateurs", badge: stats.proclubs },
    { id: "matches", label: "🏀 Matchs", badge: pendingMatches.length },
    { id: "reports", label: "🚨 Signalements", badge: stats.reports },
    { id: "news", label: "📰 Actualités" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-5 pt-8 pb-3 flex items-center gap-3 border-b border-border">
        <Link to="/"><button type="button" className="text-muted-foreground text-sm">←</button></Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-foreground">Panel Admin</h1>
          <p className="text-[10px] text-primary">MVP Basket Sénégal</p>
        </div>
        <button
          type="button"
          onClick={() => signOut().then(() => navigate({ to: "/" }))}
          className="text-xs text-muted-foreground px-3 py-1.5 rounded-xl bg-secondary"
        >
          Déconnexion
        </button>
      </header>

      {/* Tabs */}
      <div className="px-5 pt-3 pb-1 flex gap-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="bg-destructive text-white text-[9px] font-black px-1.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-5 py-4 pb-12">
        {loading && tab !== "overview" ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : tab === "overview" ? (
          <OverviewTab stats={stats} loading={loading} />
        ) : tab === "users" ? (
          <UsersTab users={users} onPromote={promoteUser} />
        ) : tab === "matches" ? (
          <MatchesTab matches={pendingMatches} onVerify={verifyMatch} />
        ) : tab === "reports" ? (
          <ReportsTab reports={reports} onResolve={resolveReport} />
        ) : (
          <NewsTab news={news} onRefresh={loadNews} />
        )}
      </div>
    </div>
  );
}

// ── Vue d'ensemble ─────────────────────────────────────────────────────────────
function OverviewTab({ stats, loading }: { stats: typeof import("./admin").default extends never ? any : { users: number; matches: number; proclubs: number; reports: number }; loading: boolean }) {
  const tiles = [
    { label: "Utilisateurs", value: stats.users, icon: "👥", color: "text-primary" },
    { label: "Clubs pro (D1/D2)", value: stats.proclubs, icon: "🏆", color: "text-amber-500" },
    { label: "Matchs à vérifier", value: stats.matches, icon: "🏀", color: "text-blue-500" },
    { label: "Signalements", value: stats.reports, icon: "🚨", color: "text-destructive" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{t.icon}</span>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
            <p className={`text-3xl font-black ${t.color}`}>
              {loading ? "…" : t.value}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">📋 Actions rapides</p>
        <p className="text-[11px] text-muted-foreground">• Vérifier les matchs D2 publiés pour valider les scores</p>
        <p className="text-[11px] text-muted-foreground">• Promouvoir un coach en coach_pro pour l'autoriser à publier en D1/D2</p>
        <p className="text-[11px] text-muted-foreground">• Traiter les signalements en attente</p>
        <p className="text-[11px] text-muted-foreground">• Publier des actualités sur le basket sénégalais</p>
      </div>
    </div>
  );
}

// ── Gestion utilisateurs ───────────────────────────────────────────────────────
function UsersTab({ users, onPromote }: { users: ProfileRow[]; onPromote: (id: string, role: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u =>
    !search || u.email.includes(search) || u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-500/20 text-red-500",
    coach_pro: "bg-amber-500/20 text-amber-600",
    coach: "bg-secondary text-muted-foreground",
  };
  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin", coach_pro: "Coach Pro (D1/D2)", coach: "Coach",
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Rechercher par email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
      />
      <p className="text-xs text-muted-foreground">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</p>
      {filtered.map(u => (
        <div key={u.id} className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {u.display_name || "Sans nom"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              {u.club_name && <p className="text-xs text-primary">{u.club_name}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${ROLE_COLORS[u.role] || ROLE_COLORS.coach}`}>
              {ROLE_LABELS[u.role] || u.role}
            </span>
          </div>
          {u.role !== "admin" && (
            <div className="flex gap-2">
              {u.role === "coach" && (
                <button
                  type="button"
                  onClick={() => onPromote(u.id, "coach_pro")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-colors active:scale-95"
                >
                  ↑ Promouvoir Coach Pro
                </button>
              )}
              {u.role === "coach_pro" && (
                <button
                  type="button"
                  onClick={() => onPromote(u.id, "coach")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors active:scale-95"
                >
                  ↓ Rétrograder Coach
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Vérification des matchs ────────────────────────────────────────────────────
function MatchesTab({ matches, onVerify }: { matches: Match[]; onVerify: (id: string) => void }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl">✅</span>
        <p className="text-foreground font-semibold mt-3">Aucun match à vérifier</p>
        <p className="text-muted-foreground text-sm mt-1">Tous les matchs publics ont été traités.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{matches.length} match{matches.length > 1 ? "s" : ""} en attente de vérification</p>
      {matches.map(m => {
        const idA = m.teamAId || "A";
        const idB = m.teamBId || "B";
        const sA = m.events.filter(e => e.teamId === idA).reduce((s, e) => s + (e.type === "2pt_made" ? 2 : e.type === "3pt_made" ? 3 : e.type === "ft_made" ? 1 : 0), 0);
        const sB = m.events.filter(e => e.teamId === idB).reduce((s, e) => s + (e.type === "2pt_made" ? 2 : e.type === "3pt_made" ? 3 : e.type === "ft_made" ? 1 : 0), 0);
        return (
          <div key={m.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">
                  {m.teamAName} {sA} – {sB} {m.teamBName}
                </p>
                <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                  {m.division && <span className="text-primary font-semibold">{m.division}</span>}
                  {m.poule && <span>{m.poule}</span>}
                  {m.season && <span>{m.season}</span>}
                  <span>{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/report/$matchId" params={{ matchId: m.id }} className="flex-1">
                <button type="button" className="w-full py-2 rounded-xl text-xs font-bold bg-secondary text-foreground">
                  Voir le rapport
                </button>
              </Link>
              <button
                type="button"
                onClick={() => onVerify(m.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-green-500/15 text-green-600 hover:bg-green-500/25 active:scale-95"
              >
                ✅ Valider
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Signalements ───────────────────────────────────────────────────────────────
const REPORT_TYPE_LABELS = {
  score_dispute: "🔢 Contestation de score",
  wrong_data: "📊 Données incorrectes",
  other: "💬 Autre",
};

function ReportsTab({ reports, onResolve }: { reports: Report[]; onResolve: (id: string) => void }) {
  const pending = reports.filter(r => r.status === "pending");
  const resolved = reports.filter(r => r.status === "resolved");

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl">✅</span>
        <p className="text-foreground font-semibold mt-3">Aucun signalement</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-destructive uppercase tracking-wide">{pending.length} en attente</p>
          {pending.map(r => (
            <div key={r.id} className="bg-card rounded-2xl border border-destructive/25 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-foreground">{REPORT_TYPE_LABELS[r.type] || r.type}</p>
                <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.message}</p>
              <button
                type="button"
                onClick={() => onResolve(r.id)}
                className="w-full py-2 rounded-xl text-xs font-bold bg-green-500/15 text-green-600 active:scale-95"
              >
                ✅ Marquer comme résolu
              </button>
            </div>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{resolved.length} résolus</p>
          {resolved.slice(0, 5).map(r => (
            <div key={r.id} className="bg-card rounded-2xl border border-border/50 p-3 opacity-60">
              <p className="text-xs text-muted-foreground">{REPORT_TYPE_LABELS[r.type]} · {r.message.slice(0, 60)}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Actualités ─────────────────────────────────────────────────────────────────
interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: "transfer" | "result" | "announcement" | "other";
  published: boolean;
  created_at: string;
}

const NEWS_CATS = [
  { value: "transfer", label: "🔄 Transfert" },
  { value: "result", label: "🏆 Résultat" },
  { value: "announcement", label: "📣 Annonce" },
  { value: "other", label: "💬 Autre" },
];

function NewsTab({ news, onRefresh }: { news: NewsItem[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NewsItem["category"]>("announcement");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !supabase) return;
    setSaving(true);
    await supabase.from("news").insert({
      title: title.trim(),
      content: content.trim(),
      category,
      published: true,
      created_at: new Date().toISOString(),
    });
    setTitle(""); setContent(""); setShowForm(false);
    setSaving(false);
    onRefresh();
  };

  const togglePublish = async (item: NewsItem) => {
    if (!supabase) return;
    await supabase.from("news").update({ published: !item.published }).eq("id", item.id);
    onRefresh();
  };

  const deleteNews = async (id: string) => {
    if (!supabase) return;
    await supabase.from("news").delete().eq("id", id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowForm(v => !v)}
        className="w-full py-3 rounded-2xl text-sm font-bold bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
      >
        {showForm ? "Annuler" : "+ Nouvelle actualité"}
      </button>

      {showForm && (
        <div className="bg-card rounded-2xl border border-primary/30 p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {NEWS_CATS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value as NewsItem["category"])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  category === c.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Titre de l'actualité"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
          <textarea
            placeholder="Contenu de l'actualité…"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? "⏳ Publication…" : "Publier →"}
          </button>
        </div>
      )}

      {news.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Aucune actualité publiée.</p>
        </div>
      ) : (
        news.map(item => (
          <div key={item.id} className={`bg-card rounded-2xl border p-4 space-y-2 ${item.published ? "border-border" : "border-border/40 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  <span>{NEWS_CATS.find(c => c.value === item.category)?.label}</span>
                  <span>·</span>
                  <span>{new Date(item.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${item.published ? "bg-green-500/15 text-green-600" : "bg-secondary text-muted-foreground"}`}>
                {item.published ? "Publié" : "Masqué"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => togglePublish(item)}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-secondary text-foreground active:scale-95"
              >
                {item.published ? "Masquer" : "Publier"}
              </button>
              <button
                type="button"
                onClick={() => deleteNews(item.id)}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-destructive/10 text-destructive active:scale-95"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
