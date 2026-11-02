import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { MONEY_QUERY_ROOTS } from '../constants';

/** Refresh everything derived from expenses or payments (lists, balances, groups, insights). */
export function invalidateMoney(queryClient: QueryClient) {
  for (const key of MONEY_QUERY_ROOTS) {
    queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export type MutationError = { message?: string; code?: string };

/**
 * Tabs stay mounted, so switching back to one doesn't reload it on its own.
 * This reloads the given queries when the screen comes back into view, if
 * they're stale. The first view is skipped: the queries just loaded then.
 */
export function useRefreshOnFocus(keys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  const first = useRef(true);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      for (const queryKey of keysRef.current) {
        queryClient.refetchQueries({ queryKey: [...queryKey], stale: true, type: 'active' });
      }
    }, [queryClient]),
  );
}
