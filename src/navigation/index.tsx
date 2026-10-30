/**
 * Root navigator: auth stack when signed out; otherwise the tab bar plus every
 * detail and modal screen in a single native stack.
 */

import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import { useStoreIdentity } from '../hooks/useBilling';
import { useEnsureCurrency } from '../hooks/useCurrency';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';

import FriendDetailScreen from '../screens/friends/FriendDetailScreen';
import AddFriendScreen from '../screens/friends/AddFriendScreen';
import FindFriendsScreen from '../screens/friends/FindFriendsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import ManualExpenseScreen from '../screens/expenses/ManualExpenseScreen';
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import QuickAddScreen from '../screens/expenses/QuickAddScreen';
import ReceiptScanScreen from '../screens/receipts/ReceiptScanScreen';
import ReceiptReviewScreen from '../screens/receipts/ReceiptReviewScreen';
import SettleUpScreen from '../screens/settlements/SettleUpScreen';
import SettlementsScreen from '../screens/settlements/SettlementsScreen';
import SettlementDetailScreen from '../screens/settlements/SettlementDetailScreen';
import AccountScreen from '../screens/account/AccountScreen';
import PlansScreen from '../screens/account/PlansScreen';
import InsightsScreen from '../screens/insights/InsightsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useStoreIdentity();
  useEnsureCurrency();

  const navTheme = useMemo<NavTheme>(() => {
    const base = t.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.primary,
        background: t.colors.background,
        card: t.colors.background,
        text: t.colors.text,
        border: t.colors.border,
        notification: t.colors.negative,
      },
    };
  }, [t]);

  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerStyle: { backgroundColor: t.colors.background },
      headerShadowVisible: false,
      headerTintColor: t.colors.text,
      headerTitleStyle: { fontFamily: t.fonts.bold, fontSize: 17, color: t.colors.text },
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: t.colors.background },
    }),
    [t],
  );

  const modal: NativeStackNavigationOptions = { presentation: 'modal', animation: 'slide_from_bottom' };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={screenOptions}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />

            <Stack.Screen name="FriendDetail" component={FriendDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: tr('nav.expense') }} />
            <Stack.Screen name="Settlements" component={SettlementsScreen} options={{ title: tr('friend.payments') }} />
            <Stack.Screen name="SettlementDetail" component={SettlementDetailScreen} options={{ title: tr('nav.payment') }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: tr('nav.account') }} />
            <Stack.Screen name="FindFriends" component={FindFriendsScreen} options={{ title: tr('nav.findFriends') }} />
            <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: tr('nav.insights') }} />
            <Stack.Screen name="ReceiptReview" component={ReceiptReviewScreen} options={{ title: tr('nav.reviewReceipt') }} />

            <Stack.Group screenOptions={modal}>
              <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ title: tr('friends.addFriend') }} />
              <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: tr('createGroup.newGroup') }} />
              <Stack.Screen name="ManualExpense" component={ManualExpenseScreen} options={{ title: tr('common.addExpense') }} />
              <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ title: tr('nav.quickAdd') }} />
              <Stack.Screen name="ReceiptScan" component={ReceiptScanScreen} options={{ title: tr('nav.scanReceipt') }} />
              <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ title: tr('hero.settleUp') }} />
              <Stack.Screen name="Plans" component={PlansScreen} options={{ headerShown: false }} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
