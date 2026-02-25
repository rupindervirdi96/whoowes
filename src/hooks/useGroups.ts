/**
 * Groups React Query hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateGroupPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useGroups() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: QUERY_KEYS.GROUPS,
    queryFn: () => GroupService.getGroups(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.GROUP(groupId),
    queryFn: () => GroupService.getGroup(groupId),
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: CreateGroupPayload) =>
      GroupService.createGroup(userId, payload),
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast(`Group "${newGroup.name}" created!`, 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to create group', 'error');
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      GroupService.addMember(groupId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUP(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast('Member added to group', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to add member', 'error');
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      GroupService.removeMember(groupId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUP(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast('Member removed from group', 'info');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to remove member', 'error');
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (groupId: string) => GroupService.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast('Group deleted', 'info');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to delete group', 'error');
    },
  });
}
