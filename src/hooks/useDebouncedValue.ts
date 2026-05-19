import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of `value` that only updates after `delay` ms
 * of inactivity. Useful for piping search inputs into server-side queries
 * without firing a request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
