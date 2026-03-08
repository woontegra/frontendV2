// Use environment variable directly to avoid circular dependency
const API_URL = import.meta.env.VITE_API_URL || "";

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Decode JWT token to get expiry time
 */
function decodeTokenExpiry(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const decoded = JSON.parse(jsonPayload);
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

/**
 * Save tokens to localStorage
 */
export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  
  // Get expiry time from token itself (2 hours from backend)
  const expiryTime = decodeTokenExpiry(accessToken);
  if (expiryTime) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  } else {
    // Fallback: 2 hours from now (matching backend)
    const fallbackExpiry = Date.now() + (2 * 60 * 60 * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, fallbackExpiry.toString());
  }
}

/** Known auth-related localStorage keys - explicit list for safe logout */
const AUTH_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRY_KEY,
  'tenant_id',
  'user_id',
  'user_role',
  'current_user',
  'email',
  'licenseValid',
  'professionalLicenseKey',
  'professionalLicenseExpiry',
  'professional_device_id',
  'licenseExpiry',
  'user', // mock auth context
] as const;

/** Patterns for keys to remove - prevents partial/corrupted tenant state */
const AUTH_KEY_PREFIXES = ['avatar_base64_', 'storage_key_migration'];

/**
 * Clear all tokens and auth-related state from localStorage.
 * SAFE LOGOUT HARDENING: ensures no partial state remains and no corrupted tenant state.
 */
export function clearTokens(): void {
  // 1) Remove all known auth keys explicitly
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
  }

  // 2) Remove keys matching auth-related prefixes (user avatars, tenant migration flags)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && AUTH_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // 3) Sweep for any remaining auth-related keys (safety net)
  const authSubstrings = ['access_token', 'refresh_token', 'tenant_id', 'user_id', 'user_role', 'current_user', 'licenseValid', 'professionalLicense', 'professional_device', 'licenseExpiry'];
  const sweepKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const lower = key.toLowerCase();
      if (authSubstrings.some((sub) => lower.includes(sub))) {
        sweepKeys.push(key);
      }
    }
  }
  sweepKeys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Check if access token is expired or will expire soon
 * Refresh token 5 minutes before expiry to prevent interruptions
 */
export function isTokenExpired(): boolean {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) return true;
  
  const expiry = parseInt(expiryTime);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Token expired or will expire in less than 5 minutes
  return now >= (expiry - fiveMinutes);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.error('[REFRESH TOKEN] No refresh token found in localStorage');
    return null;
  }
  
  try {
    console.log('[REFRESH TOKEN] Attempting to refresh token...');
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[REFRESH TOKEN] Refresh failed:', response.status, errorData);
      throw new Error(errorData.error || 'Token refresh failed');
    }
    
    const data = await response.json();
    
    if (!data.accessToken || !data.refreshToken) {
      console.error('[REFRESH TOKEN] Invalid response - missing tokens');
      throw new Error('Invalid refresh response');
    }
    
    // Save new tokens
    saveTokens(data.accessToken, data.refreshToken);
    
    // Update user data if provided
    if (data.user) {
      localStorage.setItem('current_user', JSON.stringify(data.user));
      localStorage.setItem('tenant_id', String(data.user.tenantId || '1'));
      localStorage.setItem('email', data.user.email);
    }
    
    console.log('[REFRESH TOKEN] Token refreshed successfully');
    return data.accessToken;
  } catch (error) {
    console.error('[REFRESH TOKEN] Token refresh error:', error);
    clearTokens();
    return null;
  }
}

/**
 * Logout - invalidate tokens on server and clear local storage
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  
  try {
    // Call logout endpoint to blacklist tokens
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-id': localStorage.getItem('tenant_id') || '1',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    console.error('Logout API error:', error);
  } finally {
    // Always clear local tokens
    clearTokens();
  }
}

/**
 * Fetch wrapper with automatic token refresh
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken = getAccessToken();
  
  // Check if token is expired and refresh if needed
  if (isTokenExpired()) {
    accessToken = await refreshAccessToken();
    
    if (!accessToken) {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
  }
  
  // Add authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'x-tenant-id': localStorage.getItem('tenant_id') || '1',
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If token expired error, try to refresh and retry
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    
    if (data.code === 'TOKEN_EXPIRED') {
      // Token expired, refresh and retry
      accessToken = await refreshAccessToken();
      
      if (accessToken) {
        // Retry request with new token
        headers['Authorization'] = `Bearer ${accessToken}`;
        return fetch(url, { ...options, headers });
      } else {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
    }
  }
  
  return response;
}

/**
 * Login helper
 */
export async function login(email: string, password: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }
  
  const data = await response.json();
  
  // Save tokens
  saveTokens(data.accessToken, data.refreshToken);
  
  // Save user data with licenseType
  const userWithLicense = {
    ...data.user,
    licenseType: data.licenseType || null,
    hasValidLicense: data.professionalLicenseValid || false
  };
  localStorage.setItem('current_user', JSON.stringify(userWithLicense));
  localStorage.setItem('tenant_id', String(data.user.tenantId));
  localStorage.setItem('email', data.user.email);
  
  // Save professional license information
  if (data.professionalLicenseValid) {
    localStorage.setItem('licenseValid', 'true');
    localStorage.setItem('professionalLicenseKey', data.professionalLicense?.license_key || '');
    localStorage.setItem('professionalLicenseExpiry', data.professionalLicense?.expires_at || '');
  } else {
    localStorage.setItem('licenseValid', 'false');
    localStorage.removeItem('professionalLicenseKey');
    localStorage.removeItem('professionalLicenseExpiry');
  }
  
  return data;
}











