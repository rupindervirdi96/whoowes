import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContactsService } from '../services';
import { QUERY_KEYS } from '../constants';
import { useCurrentUser } from './useAuth';

/** Which contacts are on WhoOwes. Empty (and never prompts) until access is granted. */
export function useContactMatches() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: QUERY_KEYS.CONTACT_MATCHES,
    queryFn: () => ContactsService.findMatches(me!),
    enabled: !!me,
    staleTime: 5 * 60_000,
  });
}

/** Shows the system "Allow access to contacts?" prompt, then re-checks matches. */
export function useRequestContactsAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ContactsService.requestPermission(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONTACT_MATCHES }),
  });
}
