/**
 * Root Navigator.
 * Decides between Auth and Main stacks based on authentication state.
 * Also registers the global Expense flow as a modal stack.
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ExpenseNavigator from './ExpenseNavigator';
import { AuthService } from '../services';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Loading screen shown while persisted auth state is being restored.
 */
const SplashScreen: React.FC = () => (
  <View style={styles.splash}>
    <ActivityIndicator size="large" color={Colors.primary} />
  </View>
);

const RootNavigator: React.FC = () => {
  const { isAuthenticated, setAuth, _hydrated } = useAuthStore();

  /**
   * On first mount, attempt to restore a previous session from AsyncStorage.
   * This handles the case where the persisted Zustand state hasn't loaded
   * a valid session (e.g., token expired or first launch).
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await AuthService.restoreSession();
        if (session) {
          setAuth(session.user, session.token);
        }
      } catch {
        // No stored session — show login
      }
    };
    if (_hydrated && !isAuthenticated) {
      restoreSession();
    }
  }, [_hydrated]);

  // Wait for Zustand hydration before deciding which screen to show
  if (!_hydrated) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen
              name="ExpenseFlow"
              component={ExpenseNavigator}
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});

export default RootNavigator;
