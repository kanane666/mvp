interface Props {
  values: number[];
  width?: number;
  height?: number;
  max?: number;
  min?: number;
  color?: string;
}

export function Sparkline({ values, width = 60, height = 24, max, min = 0, color = "oklch(0.68 0.15 220)" }: Props) {
  if (values.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const W = width, H = height;
  const hi = max ?? Math.max(...values, 1);
  const lo = min;
  const range = hi - lo || 1;
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = H - ((v - lo) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = i * step;
        const y = H - ((v - lo) / range) * H;
        return <circle key={i} cx={x} cy={y} r="1.8" fill={color} />;
      })}
    </svg>
  );
}
