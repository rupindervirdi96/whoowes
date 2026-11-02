import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import { useLanguage } from '../i18n';
import { QUERY_KEYS } from '../constants';
import { invalidateMoney } from './queryUtils';
import { invalidateFriendData } from './useFriends';
import { configureNotificationDisplay, pushSupported, registerForPush, type PushData } from '../services/notifications';

/** Lets code outside screens (notification taps) navigate. Passed to NavigationContainer. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

configureNotificationDisplay();

/** Reloads what a notification is about, so open screens show it. */
function refreshFor(queryClient: QueryClient, type: PushData['type'] | undefined) {
  if (type === 'friend_request' || type === 'friend_accepted') {
    invalidateFriendData(queryClient);
  } else if (type === 'reminder') {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REMINDERS });
  } else if (type === 'added_to_group') {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPS });
  } else if (type === 'member_left' || type === 'removed_from_group' || type === 'group_deleted') {
    // Groups change, and so can which group an expense shows under.
    invalidateMoney(queryClient);
  } else {
    invalidateMoney(queryClient);
  }
}

/** Opens the screen a notification is about. */
function openFor(data: Partial<PushData> | undefined) {
  if (!data?.type || !navigationRef.isReady()) return false;
  switch (data.type) {
    case 'expense_added':
      if (data.expenseId) navigationRef.navigate('ExpenseDetail', { expenseId: data.expenseId });
      break;
    case 'payment_recorded':
    case 'payment_confirmed':
    case 'payment_declined':
      if (data.settlementId) navigationRef.navigate('SettlementDetail', { settlementId: data.settlementId });
      break;
    case 'friend_request':
      navigationRef.navigate('Main', { screen: 'Friends' });
      break;
    case 'friend_accepted':
    case 'reminder':
      if (data.userId) navigationRef.navigate('FriendDetail', { friendId: data.userId });
      break;
    case 'added_to_group':
    case 'member_left':
      if (data.groupId) navigationRef.navigate('GroupDetail', { groupId: data.groupId });
      break;
    case 'removed_from_group':
    case 'group_deleted':
      // The group is gone for me: show my groups.
      navigationRef.navigate('Main', { screen: 'Groups' });
      break;
  }
  return true;
}

/**
 * Push notifications for the signed-in user: registers this phone (asking for
 * permission once), keeps open screens fresh when one arrives, and opens the
 * related screen when one is tapped (also when the tap launched the app).
 * `navReady` should flip to true in NavigationContainer's onReady.
 */
export function usePushNotifications(navReady: boolean) {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const lang = useLanguage();
  const queryClient = useQueryClient();
  const handled = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  // Register after sign-in, and again when the language changes so notifications follow it.
  // A short wait lets the home screen appear before the permission prompt.
  useEffect(() => {
    if (!signedIn || !userId || !pushSupported()) return;
    const id = setTimeout(() => {
      registerForPush({ ask: true }).catch((e) => console.warn('[push] registration failed', e?.message ?? e));
    }, 1500);
    return () => clearTimeout(id);
  }, [signedIn, userId, lang]);

  // Something happened: refresh what's on screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      refreshFor(queryClient, (n.request.content.data as Partial<PushData> | undefined)?.type);
    });
    return () => sub.remove();
  }, [queryClient]);

  // A tap (including the one that opened the app): go to the right screen, once per notification.
  useEffect(() => {
    if (!lastResponse || !navReady || !signedIn) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    const data = lastResponse.notification.request.content.data as Partial<PushData>;
    if (openFor(data)) {
      // It may have arrived while the app was closed, so nothing was reloaded yet.
      refreshFor(queryClient, data.type);
      handled.current = id;
      Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    }
  }, [lastResponse, navReady, signedIn, queryClient]);
}
