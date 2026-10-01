'use client';

import { useEffect, useState } from 'react';

/**
 * Whether sales are happening right now (a sale in the last 10 minutes).
 * Demo: a sale lands every so often; step 5 wires this to the live feed query.
 */
export function useLiveSales() {
  const [recent, setRecent] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setRecent((n) => (n >= 6 ? 2 : n + 1)), 45_000);
    return () => clearInterval(t);
  }, []);
  return { live: recent > 0, recent };
}
