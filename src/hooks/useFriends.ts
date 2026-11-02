import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { FriendService, ReminderService } from '../services';
import { QUERY_KEYS } from '../constants';
import { AddFriendPayload, Friend, FriendPrefsPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import type { MutationError } from './queryUtils';
import { translate } from '../i18n';

const useUserId = () => useAuthStore((s) => s.user?.id ?? '');

/** Friend data changes on other people's phones, so it goes stale fast. */
const FRIENDS_STALE = 10_000;
/** How often to check while a request I sent is waiting for an answer. */
const WAITING_POLL = 15_000;
const IDLE_POLL = 60_000;

type FriendRequests = { incoming: Friend[]; outgoing: Friend[] };

/** Friend lists, requests and the contact matches that show friend status. */
export function invalidateFriendData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONTACT_MATCHES });
}

export function useFriends() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.FRIENDS,
    queryFn: () => FriendService.getFriends(userId),
    enabled: !!userId,
    staleTime: FRIENDS_STALE,
  });
}

/** Pending requests, split into ones I received and ones I sent. */
export function useFriendRequests() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: QUERY_KEYS.FRIEND_REQUESTS,
    queryFn: async (): Promise<FriendRequests> => {
      const before = queryClient.getQueryData<FriendRequests>(QUERY_KEYS.FRIEND_REQUESTS);
      const all = await FriendService.getPendingRequests(userId);
      const next = {
        incoming: all.filter((f) => f.friendId === userId),
        outgoing: all.filter((f) => f.userId === userId),
      };
      // A request I sent is gone: they answered it, so the friends list may have changed too.
      const stillWaiting = new Set(next.outgoing.map((f) => f.id));
      if (before?.outgoing.some((f) => !stillWaiting.has(f.id))) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS, exact: true });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONTACT_MATCHES });
      }
      return next;
    },
    enabled: !!userId,
    staleTime: FRIENDS_STALE,
    // Checks only while the app is open (it pauses in the background).
    refetchInterval: (q) => (q.state.data?.outgoing.length ? WAITING_POLL : IDLE_POLL),
  });
}

export function useAddFriend() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: AddFriendPayload) => FriendService.addFriend(userId, payload),
    onSuccess: (f) => {
      invalidateFriendData(queryClient);
      // Adding someone who already asked me accepts their request instead.
      const name = f.friendUser.name.split(' ')[0];
      showToast(translate(f.status === 'accepted' ? 'toast.nowFriends' : 'toast.requestSent', { name }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotSendRequest'), 'error'),
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (requestId: string) => FriendService.acceptFriendRequest(userId, requestId),
    onSuccess: (f) => {
      invalidateFriendData(queryClient);
      showToast(translate('toast.nowFriends', { name: f.friendUser.name.split(' ')[0] }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotAccept'), 'error'),
  });
}

/** Declines a request I received, or cancels one I sent. */
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (requestId: string) => FriendService.declineFriendRequest(requestId),
    onSuccess: () => invalidateFriendData(queryClient),
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (friendUserId: string) => FriendService.removeFriend(userId, friendUserId),
    onSuccess: () => {
      invalidateFriendData(queryClient);
      showToast(translate('toast.friendRemoved'), 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotRemoveFriend'), 'error'),
  });
}

/** Saves my private nickname or pin for a friend. The list updates right away. */
export function useUpdateFriend() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ friendId, prefs }: { friendId: string; prefs: FriendPrefsPayload }) => FriendService.updateFriend(friendId, prefs),
    onMutate: async ({ friendId, prefs }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.FRIENDS, exact: true });
      const before = queryClient.getQueryData<Friend[]>(QUERY_KEYS.FRIENDS);
      queryClient.setQueryData<Friend[]>(QUERY_KEYS.FRIENDS, (list) =>
        list?.map((f) =>
          f.friendId !== friendId
            ? f
            : {
                ...f,
                ...(prefs.nickname !== undefined ? { nickname: prefs.nickname?.trim() || undefined } : {}),
                ...(prefs.pinned !== undefined ? { pinned: prefs.pinned || undefined } : {}),
              },
        ),
      );
      return { before };
    },
    onError: (e: MutationError, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(QUERY_KEYS.FRIENDS, ctx.before);
      showToast(e.message ?? translate('toast.couldNotUpdate'), 'error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS, exact: true }),
  });
}

export function useSearchUsers(query: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => FriendService.searchUsers(userId, query),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useRemind() {
  const showToast = useShowToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amount, currency }: { userId: string; name: string; amount?: number; currency?: string }) =>
      FriendService.remind(userId, amount, currency),
    onSuccess: (_, v) => {
      showToast(translate('toast.nudged', { name: v.name.split(' ')[0] }), 'success');
      // Show "Reminded just now" straight away; the server's time arrives with the refresh.
      const at = new Date().toISOString();
      queryClient.setQueryData<Friend[]>(QUERY_KEYS.FRIENDS, (list) =>
        list?.map((f) => (f.friendId === v.userId ? { ...f, lastRemindedAt: at } : f)),
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS, exact: true });
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotRemind'), 'error'),
  });
}

/** Reminders other people sent me ("Alex reminded you"). */
export function useReminders() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.REMINDERS,
    queryFn: () => ReminderService.getReminders(),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

export function useDismissReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ReminderService.dismiss(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REMINDERS }),
  });
}
