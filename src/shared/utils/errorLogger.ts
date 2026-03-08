import { API_BASE_URL, apiClient } from './apiClient';

const API_URL = API_BASE_URL;

/**
 * Global error logger - Hataları backend'e gönderir
 */
export const logErrorToBackend = async ({
  level = 'error',
  type = 'frontend',
  action,
  message,
  details = null,
  stack = null,
}) => {
  try {
    const token = localStorage.getItem('access_token');
    const tenantId = localStorage.getItem('tenant_id') || '1';

    if (!token) {
      console.error('Cannot log error: No token found');
      return;
    }

    const logEntry = {
      level,
      type,
      action,
      message,
      details,
      stack,
    };

    await apiClient(`/api/logs`, {
      method: 'POST',
      body: JSON.stringify(logEntry),
    });
  } catch (error) {
    // Loglama başarısız olursa sadece konsola yaz
    console.error('Failed to log error to backend:', error);
  }
};

/**
 * Global hata yakalayıcı - Window error event'i
 */
export const setupGlobalErrorHandler = () => {
  // Yakalanmamış hatalar
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    
    logErrorToBackend({
      level: 'error',
      type: 'frontend',
      action: 'window.error',
      message: event.message,
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      stack: event.error?.stack,
    });
  });

  // Promise rejection'ları
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    logErrorToBackend({
      level: 'error',
      type: 'frontend',
      action: 'unhandledrejection',
      message: event.reason?.message || String(event.reason),
      details: {
        promise: 'Promise rejection',
      },
      stack: event.reason?.stack,
    });
  });
};

/**
 * API call wrapper - Otomatik hata loglama ile
 */
export const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    // HTTP hataları
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.data = errorData;
      
      // Log the error
      logErrorToBackend({
        level: response.status >= 500 ? 'error' : 'warning',
        type: 'api',
        action: `${options.method || 'GET'} ${url}`,
        message: error.message,
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
          method: options.method || 'GET',
          errorData,
        },
      });
      
      throw error;
    }
    
    return response;
  } catch (error) {
    // Network hataları
    if (!error.status) {
      logErrorToBackend({
        level: 'error',
        type: 'network',
        action: `${options.method || 'GET'} ${url}`,
        message: error.message,
        details: {
          url,
          method: options.method || 'GET',
        },
        stack: error.stack,
      });
    }
    
    throw error;
  }
};

/**
 * React component error boundary helper
 */
export const logComponentError = (error, errorInfo) => {
  logErrorToBackend({
    level: 'error',
    type: 'react',
    action: 'component-error',
    message: error.message,
    details: {
      componentStack: errorInfo.componentStack,
    },
    stack: error.stack,
  });
};


