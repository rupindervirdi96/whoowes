/**
 * Axios client for the WhoOwes server (server/ in this repo).
 * Only used when EXPO_PUBLIC_API_URL is set — see src/config.ts.
 */

import axios, { AxiosError } from 'axios';
import { API_TIMEOUT_MS, API_URL } from '../../config';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../types';
import { currentLanguage, translate } from '../../i18n';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // The server answers errors, AI notes and sign-in texts in this language.
  config.headers['Accept-Language'] = currentLanguage();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: translate('error.generic'),
      statusCode: error.response?.status ?? 0,
    };
    // Expired or revoked session: sign out so the app returns to the phone screen.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      useAuthStore.getState().clearAuth();
    }
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string') apiError.message = data.message;
      if (typeof data.code === 'string') apiError.code = data.code;
      if (typeof data.feature === 'string') apiError.feature = data.feature as ApiError['feature'];
    } else if (error.code === 'ECONNABORTED') {
      apiError.message = translate('error.timeout');
    } else if (!error.response) {
      apiError.message = translate('error.offline');
    }
    return Promise.reject(apiError);
  },
);

export default apiClient;
