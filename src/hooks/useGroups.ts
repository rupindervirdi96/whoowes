import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateGroupPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import type { MutationError } from './queryUtils';

export function useGroups() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: QUERY_KEYS.GROUPS,
    queryFn: () => GroupService.getGroups(userId),
    enabled: !!userId,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.GROUP(groupId),
    queryFn: () => GroupService.getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => GroupService.createGroup(userId, payload),
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast(`“${g.name}” is ready`, 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not create group', 'error'),
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      GroupService.addMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast('Added to group', 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not add member', 'error'),
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      GroupService.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      showToast('Removed from group', 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not remove member', 'error'),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (groupId: string) => GroupService.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      showToast('Group deleted', 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not delete group', 'error'),
  });
}
