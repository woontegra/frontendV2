/**
 * API Client with automatic headers injection
 * Adds deviceUUID and tenantId to all requests
 */

import { getDeviceUUID } from "./deviceUUID";
import { isTokenExpired, refreshAccessToken, clearTokens } from "./authToken";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Production build'de VITE_API_URL boşsa uyar (tek seferlik)
if (import.meta.env.PROD && !API_BASE_URL) {
  console.warn(
    "[API] VITE_API_URL tanımlı değil. API istekleri aynı origin'e gidecek. " +
    "Panel ve API farklı domaindeyse .env.production içinde VITE_API_URL ayarlayın."
  );
}

const isDev = import.meta.env.DEV;

interface RequestOptions extends RequestInit {
  skipDeviceUUID?: boolean;
  skipTenantId?: boolean;
}

/**
 * Enhanced fetch with automatic headers
 * FAIL-FAST: Tenant ID is REQUIRED for all requests (except public routes)
 */
export async function apiClient(endpoint: string, options: RequestOptions = {}) {
  const { skipDeviceUUID, skipTenantId, ...fetchOptions } = options;
  
  // Get token and tenant
  let token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id");
  
  // Check if token is expired or will expire soon - refresh proactively
  if (token && isTokenExpired()) {
    if (isDev) console.log("[API CLIENT] Token expired or expiring soon, refreshing proactively...");
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        token = newToken;
        if (isDev) console.log("[API CLIENT] Token refreshed successfully");
      } else {
        if (isDev) console.error("[API CLIENT] Token refresh failed");
        // Don't redirect immediately - let the request fail first, then handle 401
      }
    } catch (error) {
      if (isDev) console.error("[API CLIENT] Token refresh error:", error);
      // Continue with old token - will handle 401 if it fails
    }
  }
  
  // Public routes that don't require tenant
  const publicRoutes = ['/api/auth/', '/api/health', '/api/debug/'];
  const isPublicRoute = publicRoutes.some(route => endpoint.includes(route));
  
  // STRICT TENANT SAFETY: Validate tenantId for non-public routes
  let validatedTenantId: string | null = null;
  if (!skipTenantId && !isPublicRoute) {
    const parsed = tenantId != null && tenantId !== '' ? parseInt(tenantId, 10) : NaN;
    if (tenantId == null || tenantId === '' || isNaN(parsed) || parsed < 1) {
      console.error("[API CLIENT] TENANT_INVALID - tenantId is null, empty, or not a positive integer");
      console.error("[API CLIENT] Endpoint:", endpoint, "tenantId:", tenantId);
      clearTokens();
      window.location.href = '/login';
      throw new Error(
        "TENANT_INVALID: Valid tenant ID is required. Session may be corrupted. Please log in again."
      );
    }
    validatedTenantId = String(parsed); // Always stringified integer for X-Tenant-Id
  }
  
  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  
  // Add authorization
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Add tenant ID (REQUIRED) - always a stringified integer
  if (validatedTenantId != null) {
    headers.set("X-Tenant-Id", validatedTenantId);
  }
  
  // Add device ID (critical for license validation)
  if (!skipDeviceUUID) {
    const deviceId = getDeviceUUID();
    headers.set("X-Device-Id", deviceId);
    // Also send X-Device-UUID for backward compatibility
    headers.set("X-Device-UUID", deviceId);
  }
  
  // Add content type if not set and body is not FormData
  // FormData automatically sets Content-Type with boundary, so we shouldn't override it
  if (!headers.has("Content-Type") && fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  // Make request
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });
  
  // If token expired error (401), ALWAYS try to refresh and retry
  if (response.status === 401) {
    if (isDev) console.log("[API CLIENT] 401 Unauthorized - attempting token refresh...");
    
    // Try to get error message without consuming the response
    let errorData = {};
    try {
      const clonedResponse = response.clone();
      errorData = await clonedResponse.json().catch(() => ({}));
    } catch (e) {
      // Response might not be JSON
    }
    
    // Always try to refresh on 401 (even if error message doesn't say TOKEN_EXPIRED)
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      if (isDev) console.log("[API CLIENT] Token refreshed, retrying request...");
      // Update authorization header
      headers.set("Authorization", `Bearer ${newToken}`);
      
      // Retry request with new token
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      
      // If still 401 after refresh - do NOT redirect, let UI decide
      if (response.status === 401) {
        if (isDev) console.error("[API CLIENT] Still 401 after refresh - auth expired");
        clearTokens();
        window.dispatchEvent(new CustomEvent("auth-expired"));
        throw new Error("Authentication required");
      }
    } else {
      // Refresh failed - do NOT redirect, let UI decide
      if (isDev) console.error("[API CLIENT] Token refresh failed - auth expired");
      clearTokens();
      window.dispatchEvent(new CustomEvent("auth-expired"));
      throw new Error("Authentication required");
    }
  }
  
  // Handle license errors
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    
    if (data.error === "DEMO_EXPIRED") {
      console.warn("[API] Demo expired - showing modal");
      // Dispatch event to show demo expired modal
      window.dispatchEvent(new CustomEvent("demo-expired"));
    } else if (data.error === "DEVICE_LIMIT_EXCEEDED") {
      console.warn("[API] Device limit exceeded - showing blocking modal");
      // Dispatch event to show device blocking modal
      window.dispatchEvent(new CustomEvent("device-limit-exceeded"));
    } else if (data.error === "activation_required") {
      console.warn("[API] License activation required");
      // Redirect to activation page
      if (window.location.pathname !== "/professional-license-activation") {
        window.location.href = "/professional-license-activation";
      }
    } else if (data.error === "expired") {
      console.error("[API] License expired");
      // Redirect to activation page
      window.location.href = "/professional-license-activation?expired=true";
    }
  }
  
  // Maintenance mode (503 + maintenance: true) - full screen maintenance page
  if (response.status === 503) {
    try {
      const cloned = response.clone();
      const data = await cloned.json().catch(() => ({}));
      if ((data as { maintenance?: boolean }).maintenance === true) {
        window.dispatchEvent(
          new CustomEvent("maintenance-mode", {
            detail: {
              message: (data as { message?: string }).message ?? "Sistem bakımda.",
              endsAt: (data as { endsAt?: string | null }).endsAt ?? null,
            },
          })
        );
        throw new Error("MAINTENANCE_MODE");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "MAINTENANCE_MODE") throw e;
    }
  }

  // GLOBAL SERVER ERROR HANDLING (5xx) - do NOT logout or redirect
  if (response.status >= 500) {
    let errorDetail: unknown = { status: response.status, statusText: response.statusText, url };
    try {
      const cloned = response.clone();
      errorDetail = { ...errorDetail as object, body: await cloned.json().catch(() => cloned.text()) };
    } catch {
      // ignore
    }
    console.error("[API CLIENT] Server error (5xx):", errorDetail);
    window.dispatchEvent(new CustomEvent("server-error", { detail: errorDetail }));
  }
  
  // SAFE JSON HANDLING: validate parseability for application/json before returning
  // (skip 403 - body consumed by license logic above)
  if (response.status !== 403) {
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json") && response.body) {
      try {
        const cloned = response.clone();
        await cloned.json();
      } catch (parseError) {
        const err = parseError instanceof Error ? parseError : new Error(String(parseError));
        throw new Error(
          `[API CLIENT] Invalid JSON in response (status ${response.status}): ${err.message}`,
          { cause: err }
        );
      }
    }
  }
  
  return response;
}

/**
 * GET request
 */
export async function apiGet(endpoint: string, options?: RequestOptions) {
  return apiClient(endpoint, { ...options, method: "GET" });
}

/**
 * POST request
 */
export async function apiPost(endpoint: string, data?: any, options?: RequestOptions) {
  return apiClient(endpoint, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut(endpoint: string, data?: any, options?: RequestOptions) {
  return apiClient(endpoint, {
    ...options,
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete(endpoint: string, options?: RequestOptions) {
  return apiClient(endpoint, { ...options, method: "DELETE" });
}








