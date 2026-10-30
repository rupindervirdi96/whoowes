import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FriendService, ReminderService } from '../services';
import { QUERY_KEYS } from '../constants';
import { AddFriendPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import type { MutationError } from './queryUtils';
import { translate } from '../i18n';

const useUserId = () => useAuthStore((s) => s.user?.id ?? '');

/** Friend lists, requests and the contact matches that show friend status. */
function invalidateFriendData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CONTACT_MATCHES });
}

export function useFriends() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.FRIENDS,
    queryFn: () => FriendService.getFriends(userId),
    enabled: !!userId,
  });
}

/** Pending requests, split into ones I received and ones I sent. */
export function useFriendRequests() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.FRIEND_REQUESTS,
    queryFn: async () => {
      const all = await FriendService.getPendingRequests(userId);
      return {
        incoming: all.filter((f) => f.friendId === userId),
        outgoing: all.filter((f) => f.userId === userId),
      };
    },
    enabled: !!userId,
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
      showToast(translate('toast.requestSent', { name: f.friendUser.name.split(' ')[0] }), 'success');
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

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => FriendService.declineFriendRequest(requestId),
    onSuccess: () => invalidateFriendData(queryClient),
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
  return useMutation({
    mutationFn: ({ userId, amount, currency }: { userId: string; name: string; amount?: number; currency?: string }) =>
      FriendService.remind(userId, amount, currency),
    onSuccess: (_, v) => showToast(translate('toast.nudged', { name: v.name.split(' ')[0] }), 'success'),
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
