interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatTile({ label, value, sub, accent }: Props) {
  return (
    <div className={`rounded-2xl p-3 border transition-all ${
      accent
        ? 'bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30'
        : 'bg-gradient-to-br from-card to-card/40 border-border hover:border-primary/30'
    }`}>
      <p className={`text-2xl font-black tabular-nums tracking-tight ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}
