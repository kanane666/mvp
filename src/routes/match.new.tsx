import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeams, getMatches, saveMatches, generateId, getPlayerTrainingStats } from "@/lib/storage";
import type { Team, Match, MatchType, MatchCategory, Player, Division } from "@/types/basketball";
import { currentSeason } from "@/types/basketball";
import { generateShareToken } from "@/lib/league";
import { isCoachPro } from "@/lib/auth";

export const Route = createFileRoute("/match/new")({
  component: NewMatchPage,
});

type Step = 'type' | 'team' | 'training_mode' | 'opponent' | 'players';

interface PlayerWithTeam extends Player {
  _teamName: string;
}

function NewMatchPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matchType, setMatchType] = useState<MatchType | null>(null);
  const [matchCategory, setMatchCategory] = useState<MatchCategory | null>(null);
  const [mainTeamId, setMainTeamId] = useState("");
  const [opponentMode, setOpponentMode] = useState<'name' | 'team' | 'skip'>('name');
  const [trainingMode, setTrainingMode] = useState<'internal' | 'external' | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [step, setStep] = useState<Step>('type');

  // Championnat fields
  const [division, setDivision] = useState<Division>(null);
  const [poule, setPoule] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showLeagueOptions, setShowLeagueOptions] = useState(false);

  // Player selection
  const [groupA, setGroupA] = useState<string[]>([]);
  const [groupB, setGroupB] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<'A' | 'B'>('A');

  // For mixed: which teams to pick from
  const [mixedSourceTeams, setMixedSourceTeams] = useState<string[]>([]);

  useEffect(() => {
    setTeams(getTeams());
  }, []);

  const mainTeam = teams.find(t => t.id === mainTeamId);
  const opponentTeam = teams.find(t => t.id === opponentTeamId);

  // Get all available players depending on match type
  const getAvailablePlayers = (): PlayerWithTeam[] => {
    if (matchType === 'mixed') {
      return teams
        .filter(t => mixedSourceTeams.includes(t.id))
        .flatMap(t => t.players.map(p => ({ ...p, _teamName: t.name })));
    }
    if (matchType === 'training' && mainTeam) {
      return mainTeam.players.map(p => ({ ...p, _teamName: mainTeam.name }));
    }
    if (matchType === 'official' && mainTeam) {
      return mainTeam.players.map(p => ({ ...p, _teamName: mainTeam.name }));
    }
    return [];
  };

  const handleSelectType = (type: MatchType, category: MatchCategory) => {
    setMatchType(type);
    setMatchCategory(category);
    setStep('team');
  };

  const handleMainTeamSelected = () => {
    if (!mainTeamId) return;
    if (matchType === 'official') {
      setStep('opponent');
    } else if (matchType === 'training') {
      setStep('training_mode');
    }
  };

  const handleMixedTeamsSelected = () => {
    if (mixedSourceTeams.length < 1) return;
    setGroupA([]);
    setGroupB([]);
    setStep('players');
  };

  const handleOpponentDone = () => {
    setGroupA([]);
    setGroupB([]);
    setStep('players');
  };

  const togglePlayerAssign = (playerId: string) => {
    // If already in a group, remove
    if (groupA.includes(playerId)) {
      setGroupA(prev => prev.filter(id => id !== playerId));
      return;
    }
    if (groupB.includes(playerId)) {
      setGroupB(prev => prev.filter(id => id !== playerId));
      return;
    }

    // For official match or training-external, all selected go to group A (no hard limit)
    if (matchType === 'official' || (matchType === 'training' && trainingMode === 'external')) {
      setGroupA(prev => [...prev, playerId]);
      return;
    }

    // For training/mixed, assign to current target
    if (assignTarget === 'A') {
      setGroupA(prev => [...prev, playerId]);
    } else {
      setGroupB(prev => [...prev, playerId]);
    }
  };

  const moveToGroup = (playerId: string, target: 'A' | 'B') => {
    setGroupA(prev => prev.filter(id => id !== playerId));
    setGroupB(prev => prev.filter(id => id !== playerId));
    if (target === 'A') setGroupA(prev => [...prev, playerId]);
    else setGroupB(prev => [...prev, playerId]);
  };

  const handleStart = () => {
    // Build team names
    let teamAName = '';
    let teamBName = '';
    let teamAId: string | undefined;
    let teamBId: string | undefined;

    if (matchType === 'official') {
      teamAName = mainTeam?.name || 'Mon équipe';
      teamAId = mainTeamId;
      teamBName = opponentMode === 'team' && opponentTeam ? opponentTeam.name : (opponentName || 'Adversaire');
      teamBId = opponentMode === 'team' ? opponentTeamId : undefined;
    } else if (matchType === 'training') {
      teamAId = mainTeamId;
      if (trainingMode === 'external') {
        teamAName = mainTeam?.name || 'Mon équipe';
        teamBName = opponentName || 'Adversaire';
      } else {
        teamAName = `${mainTeam?.name || ''} - A`;
        teamBName = `${mainTeam?.name || ''} - B`;
        teamBId = mainTeamId;
      }
    } else {
      // mixed
      teamAName = 'Équipe A';
      teamBName = 'Équipe B';
    }

    const match: Match = {
      id: generateId(),
      mode: 'assistant',
      matchType: matchType || 'training',
      matchCategory: matchCategory || (matchType === 'official' ? 'official' : matchType === 'mixed' ? 'mixed' : 'training'),
      teamAId,
      teamBId,
      teamAName,
      teamBName,
      playersA: groupA,
      playersB: (matchType === 'official' || (matchType === 'training' && trainingMode === 'external')) ? [] : groupB,
      events: [],
      quarter: 1,
      timerSeconds: 600,
      timerRunning: false,
      shotClockSeconds: 24,
      shotClockRunning: false,
      timeoutsA: 0,
      timeoutsB: 0,
      status: 'live',
      createdAt: Date.now(),
      division: division || undefined,
      poule: poule || undefined,
      season: division ? currentSeason() : undefined,
      isPublic: isPublic || undefined,
      shareToken: isPublic && isCoachPro() ? generateShareToken() : undefined,
    };
    const matches = getMatches();
    saveMatches([...matches, match]);
    navigate({ to: '/match/$matchId', params: { matchId: match.id } });
  };

  const canStart = () => {
    if (matchType === 'official') return groupA.length >= 1;
    if (matchType === 'training' && trainingMode === 'external') return groupA.length >= 1;
    return groupA.length > 0 && groupB.length > 0;
  };

  const availablePlayers = getAvailablePlayers();

  // STEP 1: Match type selection
  if (step === 'type') {
    return (
      <div className="min-h-screen bg-background">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
          <h1 className="text-xl font-bold text-foreground">Mode Assistant</h1>
        </header>
        <div className="px-5 space-y-3 pb-8">
          <p className="text-sm text-muted-foreground mb-2">Quel type de match ?</p>

          <button type="button" onClick={() => { handleSelectType('official', 'official'); setShowLeagueOptions(true); }} className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Match Officiel</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Compétition · stats officielles · 12 joueurs recommandés</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">N1 / N2</span>
                  <span className="text-[10px] bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full font-semibold">Lien public</span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-semibold">Classements</span>
                </div>
              </div>
            </div>
          </button>

          <button type="button" onClick={() => handleSelectType('official', 'friendly')} className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤝</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Match Amical</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Hors compétition · même flux qu'un match officiel</p>
              </div>
            </div>
          </button>

          <button type="button" onClick={() => handleSelectType('training', 'training')} className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏋️</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Entraînement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Interne ou vs adversaire externe</p>
              </div>
            </div>
          </button>

          <button type="button" onClick={() => handleSelectType('mixed', 'mixed')} className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔀</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Match Mixte</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Mélanger joueurs de différentes équipes</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Team selection
  if (step === 'team') {
    if (matchType === 'mixed') {
      // Multi-team selection for mixed
      return (
        <div className="min-h-screen bg-background">
          <header className="px-5 pt-8 pb-4 flex items-center gap-3">
            <button type="button" onClick={() => setStep('type')}><Button variant="ghost" size="icon">←</Button></button>
            <h1 className="text-xl font-bold text-foreground">Sélectionner les équipes</h1>
          </header>
          <div className="px-5 space-y-3 pb-8">
            <p className="text-sm text-muted-foreground">Choisissez les équipes sources (au moins 1)</p>
            {teams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">⚠️</p>
                <p className="text-muted-foreground mb-4">Aucune équipe créée</p>
                <Link to="/teams"><Button>Créer une équipe</Button></Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {teams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setMixedSourceTeams(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                      className={`w-full text-left p-4 rounded-xl transition-colors ${mixedSourceTeams.includes(t.id) ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'}`}
                    >
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-sm opacity-70 ml-2">({t.players.length} joueurs)</span>
                    </button>
                  ))}
                </div>
                <Button onClick={handleMixedTeamsSelected} disabled={mixedSourceTeams.length < 1} className="w-full" size="lg">
                  Sélectionner les joueurs →
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    // Single team selection (official / training)
    return (
      <div className="min-h-screen bg-background">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3">
          <button type="button" onClick={() => setStep('type')}><Button variant="ghost" size="icon">←</Button></button>
          <h1 className="text-xl font-bold text-foreground">
            {matchType === 'official' ? 'Votre équipe' : 'Équipe à entraîner'}
          </h1>
        </header>
        <div className="px-5 space-y-3 pb-8">
          {teams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="text-muted-foreground mb-4">Aucune équipe créée</p>
              <Link to="/teams"><Button>Créer une équipe</Button></Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMainTeamId(t.id)}
                    className={`w-full text-left p-4 rounded-xl transition-colors ${mainTeamId === t.id ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'}`}
                  >
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-sm opacity-70 ml-2">{t.category} · {t.gender} · {t.players.length} joueurs</span>
                  </button>
                ))}
              </div>
              <Button onClick={handleMainTeamSelected} disabled={!mainTeamId} className="w-full" size="lg">
                {matchType === 'official' ? 'Choisir l\'adversaire →' : 'Continuer →'}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // STEP 2.5: Training mode selection
  if (step === 'training_mode') {
    return (
      <div className="min-h-screen bg-background">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3">
          <button type="button" onClick={() => setStep('team')}><Button variant="ghost" size="icon">←</Button></button>
          <h1 className="text-xl font-bold text-foreground">Type d'entraînement</h1>
        </header>
        <div className="px-5 space-y-3 pb-8">
          <button
            onClick={() => { setTrainingMode('internal'); setMatchCategory('internal'); setGroupA([]); setGroupB([]); setStep('players'); }}
            className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Interne (A vs B)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Séparer l'équipe en 2 groupes</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => { setTrainingMode('external'); setMatchCategory('training'); setOpponentName(''); setStep('opponent'); }}
            className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h3 className="font-bold text-foreground text-base">Vs Adversaire externe</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Votre équipe vs un adversaire · pas de stats adverses</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: Opponent selection (official or training-external)
  if (step === 'opponent') {
    const otherTeams = teams.filter(t => t.id !== mainTeamId);
    return (
      <div className="min-h-screen bg-background">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3">
          <button type="button" onClick={() => setStep(matchType === 'training' ? 'training_mode' : 'team')}><Button variant="ghost" size="icon">←</Button></button>
          <h1 className="text-xl font-bold text-foreground">Adversaire</h1>
        </header>
        <div className="px-5 space-y-4 pb-8">
          {/* Opponent mode tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setOpponentMode('name')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold ${opponentMode === 'name' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >✍️ Nom rapide</button>
            {otherTeams.length > 0 && (
              <button
                onClick={() => setOpponentMode('team')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold ${opponentMode === 'team' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >📋 Équipe existante</button>
            )}
          </div>

          {opponentMode === 'name' && (
            <div>
              <Input
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
                placeholder="Nom de l'adversaire (ex: DUC, JA...)"
                className="text-base h-12 rounded-xl"
              />
            </div>
          )}

          {opponentMode === 'team' && (
            <div className="space-y-2">
              {otherTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setOpponentTeamId(t.id)}
                  className={`w-full text-left p-4 rounded-xl transition-colors ${opponentTeamId === t.id ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'}`}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm opacity-70 ml-2">({t.players.length} joueurs)</span>
                </button>
              ))}
            </div>
          )}

          <Button
            onClick={handleOpponentDone}
            disabled={opponentMode === 'name' ? !opponentName.trim() : !opponentTeamId}
            className="w-full" size="lg"
          >
            Sélectionner les joueurs →
          </Button>
        </div>
      </div>
    );
  }

  // STEP 4: Player selection
  if (step === 'players') {
    const isOfficial = matchType === 'official';
    const isTrainingExternal = matchType === 'training' && trainingMode === 'external';
    const isSingleTeamSelect = isOfficial || isTrainingExternal;
    const isTrainingOrMixed = (matchType === 'training' && trainingMode === 'internal') || matchType === 'mixed';

    return (
      <div className="min-h-screen bg-background">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3">
          <button type="button" onClick={() => setStep(matchType === 'official' ? 'opponent' : matchType === 'mixed' ? 'team' : isTrainingExternal ? 'opponent' : 'training_mode')}>
            <Button variant="ghost" size="icon">←</Button>
          </button>
          <h1 className="text-lg font-bold text-foreground">
            {isSingleTeamSelect ? `Sélection (${groupA.length} joueurs)` : 'Répartir les joueurs'}
          </h1>
        </header>

        <div className="px-5 space-y-4 pb-8">
          {/* For training/mixed: assign target selector */}
          {isTrainingOrMixed && (
            <div className="flex gap-2">
              <button
                onClick={() => setAssignTarget('A')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold ${assignTarget === 'A' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                Équipe A ({groupA.length})
              </button>
              <button
                onClick={() => setAssignTarget('B')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold ${assignTarget === 'B' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                Équipe B ({groupB.length})
              </button>
            </div>
          )}

          {/* Player grid */}
          <div className="grid grid-cols-2 gap-2">
            {availablePlayers.map(p => {
              const inA = groupA.includes(p.id);
              const inB = groupB.includes(p.id);
              const selected = inA || inB;
              let borderColor = '';
              if (inA) borderColor = 'ring-2 ring-primary';
              if (inB) borderColor = 'ring-2 ring-accent';

              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayerAssign(p.id)}
                  className={`p-3 rounded-xl text-left text-sm font-medium transition-all ${
                    selected
                      ? `bg-card text-foreground border border-border ${borderColor}`
                      : 'bg-card text-foreground border border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.jerseyNumber !== undefined && (
                      <span className="text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center bg-primary/20 text-primary">
                        {p.jerseyNumber}
                      </span>
                    )}
                    <span className="truncate">{p.firstName} {p.lastName[0]}.</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {matchType === 'mixed' && (
                      <span className="text-[10px] text-muted-foreground">{p._teamName}</span>
                    )}
                    {inA && <span className="text-[10px] font-bold text-primary">→ A</span>}
                    {inB && <span className="text-[10px] font-bold text-accent">→ B</span>}
                    {(() => {
                      const ts = getPlayerTrainingStats(p.id);
                      if (ts.sessionsCount === 0) return null;
                      return (
                        <span className="text-[9px] text-muted-foreground">
                          📅{ts.attendanceRate}% ⭐{ts.avgRating.toFixed(1)}
                        </span>
                      );
                    })()}
                  </div>
                  {/* Quick reassign buttons for training/mixed */}
                  {isTrainingOrMixed && selected && (
                    <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveToGroup(p.id, 'A'); }}
                        className={`text-[10px] px-2 py-0.5 rounded-md ${inA ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                      >A</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveToGroup(p.id, 'B'); }}
                        className={`text-[10px] px-2 py-0.5 rounded-md ${inB ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                      >B</button>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary */}
          {isTrainingOrMixed && (
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-bold">Équipe A: {groupA.length} joueurs</span>
                <span className="text-accent font-bold">Équipe B: {groupB.length} joueurs</span>
              </div>
            </div>
          )}

          {isSingleTeamSelect && (
            <div className="bg-card rounded-2xl p-4 border border-border text-center">
              <p className="text-sm font-semibold text-foreground">
                {mainTeam?.name} <span className="text-primary mx-2">VS</span> {opponentMode === 'team' && opponentTeam ? opponentTeam.name : (opponentName || 'Adversaire')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {groupA.length} joueurs sélectionnés
                {isOfficial && groupA.length < 12 && (
                  <span className="text-destructive ml-2">⚠️ 12 joueurs recommandés</span>
                )}
              </p>
            </div>
          )}

          <Button onClick={handleStart} disabled={!canStart()} className="w-full" size="lg">
            🏀 Démarrer le match
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
