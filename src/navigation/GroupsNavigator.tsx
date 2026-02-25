/**
 * Groups Stack Navigator.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GroupsStackParamList } from '../types/navigation';
import GroupsListScreen from '../screens/groups/GroupsListScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupBalancesScreen from '../screens/groups/GroupBalancesScreen';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

const GroupsNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerTintColor: Colors.primary,
      headerBackVisible: true,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: Colors.white },
      headerTitleStyle: { fontWeight: '600', color: Colors.textPrimary },
    }}
  >
    <Stack.Screen
      name="GroupsList"
      component={GroupsListScreen}
      options={{ title: 'Groups' }}
    />
    <Stack.Screen
      name="CreateGroup"
      component={CreateGroupScreen}
      options={{ title: 'Create Group' }}
    />
    <Stack.Screen
      name="GroupDetail"
      component={GroupDetailScreen}
      options={{ title: 'Group' }}
    />
    <Stack.Screen
      name="GroupBalances"
      component={GroupBalancesScreen}
      options={{ title: 'Balances' }}
    />
  </Stack.Navigator>
);

export default GroupsNavigator;
