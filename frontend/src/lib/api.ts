import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
};

export interface BackendErrorPayload {
  code: string;
  message: string;
  details?: string[];
  fieldErrors?: Record<string, string>;
  hint?: string;
}

export const getBackendError = (error: unknown): BackendErrorPayload => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data?.error;
    if (payload && typeof payload.message === 'string') {
      return {
        code: typeof payload.code === 'string' ? payload.code : 'HTTP_ERROR',
        message: payload.message,
        details: Array.isArray(payload.details) ? payload.details : [],
        fieldErrors: payload.fieldErrors && typeof payload.fieldErrors === 'object' ? payload.fieldErrors : undefined,
        hint: typeof payload.hint === 'string' ? payload.hint : undefined,
      };
    }

    return {
      code: 'HTTP_ERROR',
      message: error.message || 'Le serveur a renvoye une erreur inconnue.',
      details: [],
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      details: [],
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Une erreur inconnue est survenue.',
    details: [],
  };
};
