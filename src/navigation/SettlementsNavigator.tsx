/**
 * Settlements Stack Navigator.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettlementsStackParamList } from '../types/navigation';
import SettlementsScreen from '../screens/settlements/SettlementsScreen';
import InitiateSettlementScreen from '../screens/settlements/InitiateSettlementScreen';
import PendingSettlementsScreen from '../screens/settlements/PendingSettlementsScreen';
import SettlementDetailScreen from '../screens/settlements/SettlementDetailScreen';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator<SettlementsStackParamList>();

const SettlementsNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerTintColor: '#4A7FCB',
      headerBackVisible: true,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: '#EEF8F5' },
      headerTitleStyle: { fontWeight: '600', color: '#1A2B4A' },
    }}
  >
    <Stack.Screen
      name="SettlementsList"
      component={SettlementsScreen}
      options={{ title: 'Settlements' }}
    />
    <Stack.Screen
      name="InitiateSettlement"
      component={InitiateSettlementScreen}
      options={{ title: 'Send Payment' }}
    />
    <Stack.Screen
      name="PendingSettlements"
      component={PendingSettlementsScreen}
      options={{ title: 'Pending Confirmations' }}
    />
    <Stack.Screen
      name="SettlementDetail"
      component={SettlementDetailScreen}
      options={{ title: 'Settlement' }}
    />
  </Stack.Navigator>
);

export default SettlementsNavigator;
