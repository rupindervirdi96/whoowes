import './global.css';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation';
import ToastContainer from './src/components/ui/ToastContainer';
import ConfirmModal from './src/components/ui/ConfirmModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <RootNavigator />
        <ToastContainer />
        <ConfirmModal />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
