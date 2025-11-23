import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export function useQueryParams<T extends object = Record<string, string | number>>(): [
  T,
  (updates: Partial<T>) => void
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const result: Record<string, string | number> = {};
    searchParams.forEach((value, key) => {
      // Try to parse numbers
      if (!isNaN(Number(value))) {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    });
    return result as T;
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Partial<T>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  return [params, updateParams];
}
