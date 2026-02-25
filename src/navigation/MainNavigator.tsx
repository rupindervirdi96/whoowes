/**
 * Main Tab Navigator.
 * Bottom tab bar with Dashboard, Friends, Groups, Settlements, and Profile.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { MainTabParamList } from '../types/navigation';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import FriendsNavigator from './FriendsNavigator';
import GroupsNavigator from './GroupsNavigator';
import SettlementsNavigator from './SettlementsNavigator';
import { Colors, Typography } from '../theme';
import { usePendingSettlements } from '../hooks/useSettlements';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Badge component for notification counts
const TabBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
};

const MainNavigator: React.FC = () => {
  const { data: pendingSettlements } = usePendingSettlements();
  const pendingCount = pendingSettlements?.length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontWeight: Typography.medium,
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 60,
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<keyof MainTabParamList, string> = {
            Dashboard: 'home',
            Friends: 'people',
            Groups: 'group-work',
            Settlements: 'account-balance-wallet',
            Profile: 'person',
          };
          return (
            <View>
              <MaterialIcons
                name={icons[route.name] as keyof typeof MaterialIcons.glyphMap}
                size={size}
                color={color}
              />
              {route.name === 'Settlements' && (
                <TabBadge count={pendingCount} />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsNavigator}
        options={{ title: 'Friends' }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsNavigator}
        options={{ title: 'Groups' }}
      />
      <Tab.Screen
        name="Settlements"
        component={SettlementsNavigator}
        options={{ title: 'Settle' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
});

export default MainNavigator;
