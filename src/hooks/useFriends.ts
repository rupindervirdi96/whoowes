/**
 * Friends React Query hooks.
 * Wraps FriendService with TanStack Query for caching, background refresh, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FriendService } from '../services';
import { QUERY_KEYS } from '../constants';
import { AddFriendPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: QUERY_KEYS.FRIENDS,
    queryFn: () => FriendService.getFriends(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePendingFriendRequests() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: [...QUERY_KEYS.FRIENDS, 'pending'],
    queryFn: () => FriendService.getPendingRequests(userId),
    enabled: !!userId,
  });
}

export function useAddFriend() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: AddFriendPayload) =>
      FriendService.addFriend(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
      showToast('Friend request sent!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to add friend', 'error');
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (friendId: string) => FriendService.acceptFriendRequest(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
      showToast('Friend request accepted!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to accept request', 'error');
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (friendId: string) => FriendService.removeFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
      showToast('Friend removed', 'info');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to remove friend', 'error');
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => FriendService.searchUsers(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 30,
  });
}
