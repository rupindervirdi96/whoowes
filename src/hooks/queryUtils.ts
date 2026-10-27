import { QueryClient } from '@tanstack/react-query';
import { MONEY_QUERY_ROOTS } from '../constants';

/** Refresh everything derived from expenses or payments (lists, balances, groups, insights). */
export function invalidateMoney(queryClient: QueryClient) {
  for (const key of MONEY_QUERY_ROOTS) {
    queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export type MutationError = { message?: string; code?: string };
