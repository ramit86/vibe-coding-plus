// src/components/SearchBox.tsx
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
      if (!dq.trim()) return;
      setLoading(true);
      try {
        await Promise.resolve(onSearch(dq));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
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

export function SearchBox(props: Props) {
  return <SearchBoxImpl {...props} />;
}
export default SearchBoxImpl;
