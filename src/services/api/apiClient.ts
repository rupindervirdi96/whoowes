/**
 * Axios API client.
 * Configured with base URL, timeout, and auth interceptors.
 *
 * To connect a real backend, update API_BASE_URL in constants/index.ts
 * and remove/replace the mock layer in services/mock/.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT_MS, STORAGE_KEYS } from '../../constants';
import { ApiError } from '../../types';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor: Attach Auth Token ───────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: Normalize Errors ───────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: 'An unexpected error occurred. Please try again.',
      statusCode: error.response?.status ?? 0,
    };

    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as Record<string, unknown>;
      if (typeof data['message'] === 'string') {
        apiError.message = data['message'];
      }
      if (data['errors'] && typeof data['errors'] === 'object') {
        apiError.errors = data['errors'] as Record<string, string[]>;
      }
    } else if (error.code === 'ECONNABORTED') {
      apiError.message = 'Request timed out. Please check your connection.';
    } else if (!error.response) {
      apiError.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(apiError);
  },
);

export default apiClient;
