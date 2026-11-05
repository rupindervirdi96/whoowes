/**
 * Push notifications: permission, Android channels, and registering this phone
 * with the WhoOwes server (which sends the notifications through Expo's push service).
 *
 * Push needs a real build on a real phone talking to the server. It's skipped on
 * web, simulators, the offline demo, and Expo Go on Android (Expo Go dropped
 * Android push support), so those keep working without it.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USE_MOCK_API } from '../config';
import { currentLanguage, translate } from '../i18n';
import apiClient from './api/apiClient';

const TOKEN_KEY = '@whoowes/push_token';

/** What the server puts in a notification, so a tap can open the right screen. */
export interface PushData {
  type:
    | 'friend_request'
    | 'friend_accepted'
    | 'expense_added'
    | 'reminder'
    | 'payment_recorded'
    | 'payment_confirmed'
    | 'payment_declined'
    | 'added_to_group'
    | 'member_left'
    | 'removed_from_group'
    | 'group_deleted'
    | 'expense_comment'
    | 'expense_reaction'
    | 'expense_edited'
    | 'splitwise_imported'
    | 'history_claim'
    | 'history_claimed';
  expenseId?: string;
  settlementId?: string;
  groupId?: string;
  /** The other person (who sent the request, reminder, ...). */
  userId?: string;
}

export function pushSupported(): boolean {
  if (Platform.OS === 'web' || USE_MOCK_API || !Device.isDevice) return false;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

/** Show notifications that arrive while the app is open too (as a banner). */
export function configureNotificationDisplay() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Two Android channels, so people can mute friend/group news and keep money alerts.
 * Ids must match what the server sends.
 */
async function createChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('money', {
    name: translate('notif.channel.money'),
    description: translate('notif.channel.moneyDesc'),
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#5B4CF5',
  });
  await Notifications.setNotificationChannelAsync('social', {
    name: translate('notif.channel.social'),
    description: translate('notif.channel.socialDesc'),
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#5B4CF5',
  });
}

export type PushStatus = 'granted' | 'denied' | 'unsupported';

/**
 * Makes sure this phone gets notifications for the signed-in user.
 * `ask`: show the system permission prompt if we haven't asked yet.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  await createChannels();

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return 'denied';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  // The language goes along so notifications arrive in the language the app is in.
  await apiClient.post('/me/push-tokens', { token, platform: Platform.OS, lang: currentLanguage() });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return 'granted';
}

/** Stops notifications to this phone (call before signing out, while still signed in). */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  if (!USE_MOCK_API) await apiClient.post('/me/push-tokens/remove', { token }).catch(() => {});
}
