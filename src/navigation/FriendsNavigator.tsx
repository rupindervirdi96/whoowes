/**
 * Friends Stack Navigator.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FriendsStackParamList } from '../types/navigation';
import FriendsListScreen from '../screens/friends/FriendsListScreen';
import AddFriendScreen from '../screens/friends/AddFriendScreen';
import FriendDetailScreen from '../screens/friends/FriendDetailScreen';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator<FriendsStackParamList>();

const FriendsNavigator: React.FC = () => (
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
      name="FriendsList"
      component={FriendsListScreen}
      options={{ title: 'Friends' }}
    />
    <Stack.Screen
      name="AddFriend"
      component={AddFriendScreen}
      options={{ title: 'Add Friend' }}
    />
    <Stack.Screen
      name="FriendDetail"
      component={FriendDetailScreen}
      options={{ title: 'Friend' }}
    />
  </Stack.Navigator>
);

export default FriendsNavigator;
