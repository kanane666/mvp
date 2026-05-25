interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ value, onChange, disabled, size = 'md' }: StarRatingProps) {
  const sz = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n === value ? 0 : n)}
          className={`${sz} transition-transform active:scale-90 disabled:opacity-30 ${n <= value ? 'opacity-100' : 'opacity-30'}`}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}
