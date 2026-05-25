import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getTeams, saveTeams, generateId } from "@/lib/storage";
import type { Team, Player, Category, Gender, Position, StrongHand } from "@/types/basketball";

export const Route = createFileRoute("/teams")({
  component: TeamsPage,
});

const CATEGORIES: Category[] = ["Minimes", "Cadets", "Juniors", "Seniors"];
const GENDERS: Gender[] = ["Masculin", "Féminin"];
const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];
const HANDS: StrongHand[] = ["Droite", "Gauche", "Les deux"];

function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Seniors");
  const [gender, setGender] = useState<Gender>("Masculin");

  // Player form
  const [showPlayerForm, setShowPlayerForm] = useState<string | null>(null);
  const [pFirst, setPFirst] = useState("");
  const [pLast, setPLast] = useState("");
  const [pJersey, setPJersey] = useState("");
  const [pAge, setPAge] = useState("");
  const [pHeight, setPHeight] = useState("");
  const [pWeight, setPWeight] = useState("");
  const [pPosition, setPPosition] = useState<Position | "">("");
  const [pHand, setPHand] = useState<StrongHand | "">("");

  useEffect(() => {
    setTeams(getTeams());
  }, []);

  const persist = useCallback((updated: Team[]) => {
    setTeams(updated);
    saveTeams(updated);
  }, []);

  const resetPlayerForm = () => {
    setPFirst(""); setPLast(""); setPJersey(""); setPAge("");
    setPHeight(""); setPWeight(""); setPPosition(""); setPHand("");
    setShowPlayerForm(null);
  };

  const handleCreateTeam = () => {
    if (!name.trim()) return;
    const newTeam: Team = {
      id: generateId(), name: name.trim(), category, gender, players: [], createdAt: Date.now(),
    };
    persist([...teams, newTeam]);
    setName(""); setShowForm(false);
  };

  const handleAddPlayer = (teamId: string) => {
    if (!pFirst.trim() || !pLast.trim()) return;
    const player: Player = {
      id: generateId(),
      firstName: pFirst.trim(),
      lastName: pLast.trim(),
      jerseyNumber: pJersey ? parseInt(pJersey) : undefined,
      age: pAge ? parseInt(pAge) : undefined,
      height: pHeight ? parseInt(pHeight) : undefined,
      weight: pWeight ? parseInt(pWeight) : undefined,
      position: pPosition || undefined,
      strongHand: pHand || undefined,
      teamId,
    };
    persist(teams.map(t => t.id === teamId ? { ...t, players: [...t.players, player] } : t));
    resetPlayerForm();
  };

  const handleDeletePlayer = (teamId: string, playerId: string) => {
    persist(teams.map(t => t.id === teamId ? { ...t, players: t.players.filter(p => p.id !== playerId) } : t));
  };

  const handleDeleteTeam = (teamId: string) => {
    persist(teams.filter(t => t.id !== teamId));
  };

  const inputClass = "w-full bg-input rounded-xl px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-2xl font-bold text-foreground flex-1">Équipes</h1>
        <Button onClick={() => setShowForm(!showForm)} size="sm">+ Créer</Button>
      </header>

      <div className="px-5 space-y-4 pb-8">
        {showForm && (
          <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
            <input type="text" placeholder="Nom de l'équipe" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button type="button" key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Genre</label>
              <div className="flex gap-2">
                {GENDERS.map(g => (
                  <button type="button" key={g} onClick={() => setGender(g)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-1 ${gender === g ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{g}</button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateTeam} className="w-full" size="lg">Créer l'équipe</Button>
          </div>
        )}

        {teams.length === 0 && !showForm && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-muted-foreground">Aucune équipe créée</p>
            <Button onClick={() => setShowForm(true)} className="mt-4">Créer une équipe</Button>
          </div>
        )}

        {teams.map(team => (
          <div key={team.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setEditingTeam(editingTeam === team.id ? null : team.id)}>
              <div>
                <h3 className="text-lg font-bold text-foreground">{team.name}</h3>
                <p className="text-sm text-muted-foreground">{team.category} · {team.gender} · {team.players.length} joueur{team.players.length !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-muted-foreground">{editingTeam === team.id ? '▲' : '▼'}</span>
            </div>

            {editingTeam === team.id && (
              <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                {team.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.jerseyNumber !== undefined && (
                        <span className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">{p.jerseyNumber}</span>
                      )}
                      <div>
                        <span className="text-foreground text-sm font-medium">{p.firstName} {p.lastName}</span>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {p.position && <span>{p.position}</span>}
                          {p.age && <span>{p.age}ans</span>}
                          {p.height && <span>{p.height}cm</span>}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleDeletePlayer(team.id, p.id)} className="text-destructive text-sm">✕</button>
                  </div>
                ))}

                {showPlayerForm === team.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Prénom *" value={pFirst} onChange={e => setPFirst(e.target.value)} className={inputClass} />
                      <input type="text" placeholder="Nom *" value={pLast} onChange={e => setPLast(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                      <input type="number" placeholder="N° maillot" value={pJersey} onChange={e => setPJersey(e.target.value)} className={inputClass} />
                      <input type="number" placeholder="Âge" value={pAge} onChange={e => setPAge(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Taille (cm)" value={pHeight} onChange={e => setPHeight(e.target.value)} className={inputClass} />
                      <input type="number" placeholder="Poids (kg)" value={pWeight} onChange={e => setPWeight(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Poste</label>
                      <div className="flex gap-1">
                        {POSITIONS.map(pos => (
                          <button type="button" key={pos} onClick={() => setPPosition(pPosition === pos ? "" : pos)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${pPosition === pos ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{pos}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Main forte</label>
                      <div className="flex gap-1">
                        {HANDS.map(h => (
                          <button type="button" key={h} onClick={() => setPHand(pHand === h ? "" : h)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex-1 ${pHand === h ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{h}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={resetPlayerForm} className="flex-1">Annuler</Button>
                      <Button size="sm" onClick={() => handleAddPlayer(team.id)} className="flex-1">Ajouter</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowPlayerForm(team.id)} className="w-full">+ Ajouter un joueur</Button>
                )}

                <Link to="/stats/team/$teamId" params={{ teamId: team.id }}>
                  <Button variant="outline" size="sm" className="w-full text-primary border-primary/30">📊 Voir les stats de l'équipe</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteTeam(team.id)} className="w-full text-destructive hover:text-destructive">Supprimer l'équipe</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
