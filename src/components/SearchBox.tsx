import React, { useEffect, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';

type Props = {
  onSearch: (q: string) => Promise<void> | void; // your actual search fn
  delay?: number; // optional debounce ms
};

export default function SearchBox({ onSearch, delay = 250 }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const dq = useDebounce(q, delay);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (dq.trim() === '') return; // ignore empty queries (optional)
      setLoading(true);
      try {
        await onSearch(dq);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dq, onSearch]);

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="Search"
        aria-busy={loading}
        aria-live="polite"
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="border rounded px-2 py-1 w-full"
      />
      {loading && <Spinner aria-label="Loading results" />}
    </div>
  );
}

// super-simple placeholder; replace with your spinner
function Spinner(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="status" {...props}>⏳</div>;
}
