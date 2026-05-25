import { useState } from 'react';
import type { EventType, Player } from '@/types/basketball';
import { Button } from '@/components/ui/button';

interface ActionPanelProps {
  selectedPlayer: Player | null;
  onAction: (type: EventType) => void;
}

export function ActionPanel({ selectedPlayer, onAction }: ActionPanelProps) {
  const [showMore, setShowMore] = useState(false);
  const disabled = !selectedPlayer;

  const handleAction = (type: EventType) => {
    onAction(type);
    setShowMore(false);
  };

  return (
    <div className="space-y-2">
      {/* Player indicator */}
      <p className="text-xs text-muted-foreground text-center h-4">
        {selectedPlayer
          ? `▶ ${selectedPlayer.firstName} ${selectedPlayer.lastName[0]}.`
          : 'Sélectionner un joueur'}
      </p>

      {/* ── GRANDS BOUTONS PRINCIPAUX ── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('2pt_made')}
          className="bg-primary text-primary-foreground rounded-2xl py-5 text-2xl font-black active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100 shadow-sm"
        >
          +2
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('3pt_made')}
          className="bg-primary text-primary-foreground rounded-2xl py-5 text-2xl font-black active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100 shadow-sm"
        >
          +3
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('ft_made')}
          className="bg-primary/70 text-primary-foreground rounded-2xl py-5 text-2xl font-black active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100 shadow-sm"
        >
          +1
        </button>
      </div>

      {/* ── REBONDS + PASSE décisive ── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('def_rebound')}
          className="bg-secondary text-secondary-foreground rounded-xl py-3.5 text-sm font-bold active:scale-95 transition-transform disabled:opacity-30"
        >
          ⬇ Reb.D
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('off_rebound')}
          className="bg-secondary text-secondary-foreground rounded-xl py-3.5 text-sm font-bold active:scale-95 transition-transform disabled:opacity-30"
        >
          ⬆ Reb.O
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('assist')}
          className="bg-secondary text-secondary-foreground rounded-xl py-3.5 text-sm font-bold active:scale-95 transition-transform disabled:opacity-30"
        >
          🏀 Passe
        </button>
      </div>

      {/* ── FAUTE (toujours visible) ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleAction('foul_committed')}
        className="w-full bg-destructive/15 text-destructive rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform disabled:opacity-30 border border-destructive/20"
      >
        🚫 Faute personnelle
      </button>

      {/* ── PLUS d'actions ── */}
      <button
        type="button"
        onClick={() => setShowMore(v => !v)}
        className="w-full text-xs text-muted-foreground py-1.5 text-center active:opacity-60"
      >
        {showMore ? '▲ Moins' : '▼ Plus d\'actions'}
      </button>

      {showMore && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-150">
          {/* Tirs ratés */}
          <div className="flex gap-2">
            <button type="button" disabled={disabled} onClick={() => handleAction('ft_missed')} className="flex-1 bg-secondary/60 text-secondary-foreground py-2 rounded-xl text-xs font-semibold disabled:opacity-30">LF raté</button>
            <button type="button" disabled={disabled} onClick={() => handleAction('2pt_missed')} className="flex-1 bg-secondary/60 text-secondary-foreground py-2 rounded-xl text-xs font-semibold disabled:opacity-30">2pts raté</button>
            <button type="button" disabled={disabled} onClick={() => handleAction('3pt_missed')} className="flex-1 bg-secondary/60 text-secondary-foreground py-2 rounded-xl text-xs font-semibold disabled:opacity-30">3pts raté</button>
          </div>
          {/* Autres stats */}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={disabled} onClick={() => handleAction('steal')} className="bg-secondary/60 text-secondary-foreground py-2.5 rounded-xl text-xs font-semibold disabled:opacity-30">🔄 Interc.</button>
            <button type="button" disabled={disabled} onClick={() => handleAction('block')} className="bg-secondary/60 text-secondary-foreground py-2.5 rounded-xl text-xs font-semibold disabled:opacity-30">🖐 Contre</button>
            <button type="button" disabled={disabled} onClick={() => handleAction('turnover')} className="bg-secondary/60 text-secondary-foreground py-2.5 rounded-xl text-xs font-semibold disabled:opacity-30">❌ Perte</button>
          </div>
          <button type="button" disabled={disabled} onClick={() => handleAction('foul_drawn')} className="w-full bg-secondary/60 text-secondary-foreground py-2 rounded-xl text-xs font-semibold disabled:opacity-30">
            🟡 Faute provoquée
          </button>
        </div>
      )}
    </div>
  );
}
