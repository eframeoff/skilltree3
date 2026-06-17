import { StarIcon } from './icons.jsx';

// Read-only or interactive 1–5 star rating (attempt grade).
export default function StarRating({ value = 0, max = 5, onRate, size = 'w-5 h-5' }) {
  return (
    <div className="flex items-center gap-1 text-skill-gold">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < value;
        return onRate ? (
          <button
            key={i}
            type="button"
            onClick={() => onRate(i + 1)}
            className="transition-transform active:scale-90"
            aria-label={`Оценить на ${i + 1}`}
          >
            <StarIcon filled={filled} className={size} />
          </button>
        ) : (
          <StarIcon key={i} filled={filled} className={size} />
        );
      })}
    </div>
  );
}
