import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateGroupPayload, UpdateGroupPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import type { MutationError } from './queryUtils';
import { translate } from '../i18n';

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
      showToast(translate('toast.groupReady', { name: g.name }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotCreateGroup'), 'error'),
  });
}

/** Rename a group or change its default currency. */
export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ groupId, ...payload }: UpdateGroupPayload & { groupId: string }) => GroupService.updateGroup(groupId, payload),
    onSuccess: (g) => {
      queryClient.setQueryData(QUERY_KEYS.GROUP(g.id), g);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotSave'), 'error'),
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
      showToast(translate('toast.addedToGroup'), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotAddMember'), 'error'),
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
      showToast(translate('toast.removedFromGroup'), 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotRemoveMember'), 'error'),
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
      showToast(translate('toast.groupDeleted'), 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotDeleteGroup'), 'error'),
  });
}
