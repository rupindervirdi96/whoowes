/**
 * Bottom tabs: Home · Friends · (+) · Groups · Activity.
 * The center button opens the add sheet instead of navigating.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MainTabParamList } from '../types/navigation';
import { useTheme } from '../theme';
import { useUIStore } from '../store/uiStore';
import { usePendingSettlements } from '../hooks/useSettlements';
import { useFriendRequests } from '../hooks/useFriends';
import HomeScreen from '../screens/home/HomeScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import ActivityScreen from '../screens/activity/ActivityScreen';
import AddSheet from '../components/AddSheet';
import Text from '../components/ui/Text';
import Icon from '../components/ui/Icon';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, [string, string]> = {
  Home: ['home', 'home'],
  Friends: ['people-outline', 'people'],
  Add: ['add', 'add'],
  Groups: ['workspaces-outline', 'workspaces'],
  Activity: ['receipt-long', 'receipt-long'],
};

const Placeholder = () => null;

function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  const { data: pending } = usePendingSettlements();
  const { data: requests } = useFriendRequests();
  const badges: Partial<Record<string, number>> = {
    Activity: pending?.length ?? 0,
    Friends: requests?.incoming.length ?? 0,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.tabBar,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingHorizontal: 8,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const name = route.name as keyof MainTabParamList;

        if (name === 'Add') {
          return (
            <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add expense"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  openAddSheet();
                }}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 20,
                  marginTop: -22,
                  backgroundColor: t.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.94 : 1 }, { rotate: '0deg' }],
                  borderWidth: 4,
                  borderColor: t.colors.tabBar,
                  ...(t.elevation(3) as object),
                })}
              >
                <Icon name="add" size={30} color="#FFFFFF" />
              </Pressable>
            </View>
          );
        }

        const label = descriptors[route.key].options.title ?? route.name;
        const color = focused ? t.colors.primary : t.colors.textTertiary;
        const badge = badges[name] ?? 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${label}, ${badge} new` : label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}
          >
            <View>
              <Icon name={ICONS[name][focused ? 1 : 0]} size={24} color={color} />
              {badge > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 3,
                    backgroundColor: t.colors.negative,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" weight="bold" color="#FFF" style={{ fontSize: 10, lineHeight: 12 }}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" weight={focused ? 'bold' : 'medium'} color={color} style={{ fontSize: 11 }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const MainTabs: React.FC = () => (
  <>
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends' }} />
      <Tab.Screen name="Add" component={Placeholder} options={{ title: 'Add' }} />
      <Tab.Screen name="Groups" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity' }} />
    </Tab.Navigator>
    <AddSheet />
  </>
);

export default MainTabs;
