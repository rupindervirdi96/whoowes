/**
 * Expense Flow Navigator (modal-style stack).
 * Accessible from any screen via navigation.navigate('ExpenseFlow', { screen: ... })
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExpensesStackParamList } from '../types/navigation';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import ManualExpenseScreen from '../screens/expenses/ManualExpenseScreen';
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import ReceiptUploadScreen from '../screens/receipts/ReceiptUploadScreen';
import ReceiptReviewScreen from '../screens/receipts/ReceiptReviewScreen';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator<ExpensesStackParamList>();

const ExpenseNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerTintColor: Colors.primary,
      headerBackVisible: true,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: Colors.white },
      headerTitleStyle: { fontWeight: '600', color: Colors.textPrimary },
      presentation: 'modal',
    }}
  >
    <Stack.Screen
      name="AddExpense"
      component={AddExpenseScreen}
      options={{ title: 'Add Expense' }}
    />
    <Stack.Screen
      name="ManualExpense"
      component={ManualExpenseScreen}
      options={{ title: 'Expense Details' }}
    />
    <Stack.Screen
      name="ReceiptUpload"
      component={ReceiptUploadScreen}
      options={{ title: 'Upload Receipt' }}
    />
    <Stack.Screen
      name="ReceiptReview"
      component={ReceiptReviewScreen}
      options={{ title: 'Review Receipt' }}
    />
    <Stack.Screen
      name="ExpenseDetail"
      component={ExpenseDetailScreen}
      options={{ title: 'Expense Detail', presentation: 'card' }}
    />
  </Stack.Navigator>
);

export default ExpenseNavigator;
