import React, { useEffect, useState } from 'react';

type Props = {
  onSearch: (q: string) => Promise<void> | void;
  debounceMs?: number;
};

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SearchBoxImpl({ onSearch, debounceMs = 250 }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const dq = useDebounce(q, debounceMs);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Don’t fire on empty (keeps test predictable)
      if (!dq.trim()) return;

      // flip busy while search in flight
      setLoading(true);
      try {
        await Promise.resolve(onSearch(dq));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Start async flow after debounce
    run();

    return () => {
      cancelled = true;
    };
  }, [dq, onSearch]);

  return (
    <div>
      <input
        role="textbox"
        aria-busy={loading ? 'true' : 'false'}
        aria-live="polite"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </div>
  );
}

// Expose both named and default to match any import style in tests
export function SearchBox(props: Props) {
  return <SearchBoxImpl {...props} />;
}
export default SearchBoxImpl;
