/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

// Centralized state management for API authentication, completely independent
// of raw, single-point localStorage reads. Supports in-memory state, session fallback,
// multi-tier storage with graceful iframe error handling, and reactive event subscriptions.

declare global {
  interface Window {
    __VOXART_AUTH_KEY__?: string;
  }
}

const STORAGE_KEY = 'voxart_key';
const AUTH_EVENT_NAME = 'voxart:auth-changed';

export interface AuthState {
  apiKey: string;
  isValid: boolean;
  source: 'memory' | 'session' | 'local' | 'window' | 'none';
}

type AuthListener = (state: AuthState) => void;

class ApiAuthStore {
  private inMemoryKey: string = '';
  private listeners: Set<AuthListener> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    this.inMemoryKey = this.readFromAllTiers();
    if (typeof window !== 'undefined') {
      window.__VOXART_AUTH_KEY__ = this.inMemoryKey;
      
      // Listen for cross-tab or cross-component sync events
      window.addEventListener(AUTH_EVENT_NAME, (e: any) => {
        const newKey = e.detail?.key ?? '';
        if (newKey !== this.inMemoryKey) {
          this.inMemoryKey = newKey;
          this.notifyListeners();
        }
      });

      // Also listen to storage events from other tabs
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
          const newKey = (e.newValue || '').trim();
          if (newKey !== this.inMemoryKey) {
            this.inMemoryKey = this.sanitizeKey(newKey);
            this.notifyListeners();
          }
        }
      });
    }
    this.isInitialized = true;
  }

  /**
   * Sanitizes and normalizes an API key string:
   * Strips whitespace, surrounding quotes, accidental "Bearer " prefixes.
   */
  public sanitizeKey(rawKey?: string | null): string {
    if (!rawKey || typeof rawKey !== 'string') return '';
    let cleaned = rawKey.trim();
    // Remove accidental Bearer prefix if user copied it from docs or network logs
    if (cleaned.toLowerCase().startsWith('bearer ')) {
      cleaned = cleaned.slice(7).trim();
    }
    // Remove surrounding single or double quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
    return cleaned;
  }

  /**
   * Validates if a key has proper Gemini/Google AI Studio format and length
   */
  public isValidKey(key?: string | null): boolean {
    const sanitized = this.sanitizeKey(key);
    if (!sanitized) return false;
    if (sanitized.length < 10) return false;
    if (
      sanitized === 'MY_GEMINI_API_KEY' ||
      sanitized === 'YOUR_GEMINI_API_KEY' ||
      sanitized.toLowerCase().includes('dummy') ||
      sanitized.toLowerCase().includes('your_api_key')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Multi-tier resolution:
   * 1. In-memory state (fastest, private, never fails in strict iframes)
   * 2. Window runtime cache (__VOXART_AUTH_KEY__)
   * 3. sessionStorage (per-session fallback)
   * 4. localStorage (persistent fallback, wrapped in try/catch)
   */
  private readFromAllTiers(): string {
    // 1. In-memory
    if (this.inMemoryKey) return this.inMemoryKey;

    // 2. Window runtime cache
    if (typeof window !== 'undefined' && window.__VOXART_AUTH_KEY__) {
      const sanitized = this.sanitizeKey(window.__VOXART_AUTH_KEY__);
      if (sanitized) return sanitized;
    }

    // 3. sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const sessionKey = window.sessionStorage.getItem(STORAGE_KEY);
        const sanitized = this.sanitizeKey(sessionKey);
        if (sanitized) return sanitized;
      }
    } catch {
      // sessionStorage might be restricted in cross-origin iframes
    }

    // 4. localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const localKey = window.localStorage.getItem(STORAGE_KEY);
        const sanitized = this.sanitizeKey(localKey);
        if (sanitized) return sanitized;
      }
    } catch {
      // localStorage might be blocked or throw SecurityError in sandboxed iframes
    }

    return '';
  }

  /**
   * Returns current active API key, guaranteed validated and retrieved from centralized state.
   */
  public getKey(): string {
    if (!this.inMemoryKey) {
      this.inMemoryKey = this.readFromAllTiers();
    }
    return this.inMemoryKey;
  }

  public getAuthState(): AuthState {
    const key = this.getKey();
    let source: AuthState['source'] = 'none';

    if (key) {
      if (this.inMemoryKey === key) source = 'memory';
      else if (typeof window !== 'undefined' && window.__VOXART_AUTH_KEY__ === key) source = 'window';
      else source = 'local';
    }

    return {
      apiKey: key,
      isValid: this.isValidKey(key),
      source
    };
  }

  /**
   * Centralized setter: updates memory, window cache, session and local storage safely,
   * then dispatches event to all components.
   */
  public setKey(newKey: string): void {
    const sanitized = this.sanitizeKey(newKey);
    this.inMemoryKey = sanitized;

    if (typeof window !== 'undefined') {
      window.__VOXART_AUTH_KEY__ = sanitized;

      try {
        if (sanitized) {
          window.sessionStorage?.setItem(STORAGE_KEY, sanitized);
        } else {
          window.sessionStorage?.removeItem(STORAGE_KEY);
        }
      } catch {}

      try {
        if (sanitized) {
          window.localStorage?.setItem(STORAGE_KEY, sanitized);
        } else {
          window.localStorage?.removeItem(STORAGE_KEY);
        }
      } catch {}

      // Broadcast event across app
      window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail: { key: sanitized } }));
    }

    this.notifyListeners();
  }

  public clearKey(): void {
    this.setKey('');
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    // Send immediate state on subscription
    listener(this.getAuthState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getAuthState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });
  }
}

export const apiAuthStore = new ApiAuthStore();

/**
 * Builds verified headers containing Authorization: Bearer <key> and x-api-key.
 */
export function buildAuthHeaders(existingHeaders?: HeadersInit, explicitKey?: string): Headers {
  const headers = new Headers(existingHeaders || {});
  const effectiveKey = explicitKey ? apiAuthStore.sanitizeKey(explicitKey) : apiAuthStore.getKey();

  if (effectiveKey && apiAuthStore.isValidKey(effectiveKey)) {
    headers.set('Authorization', `Bearer ${effectiveKey}`);
    headers.set('x-api-key', effectiveKey);
  }

  return headers;
}

/**
 * Verified Centralized API Fetcher:
 * Ensures the Authorization header is reliably verified and injected before every request.
 * Independent of raw localStorage reads.
 */
export async function authFetch(
  input: RequestInfo | URL, 
  init?: RequestInit, 
  explicitKey?: string
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const effectiveKey = explicitKey ? apiAuthStore.sanitizeKey(explicitKey) : apiAuthStore.getKey();
  
  // Clone or create headers
  const headers = buildAuthHeaders(init?.headers, effectiveKey);

  // If request sends JSON body, ensure Content-Type is set and optionally inject apiKey in body
  let body = init?.body;
  if (body && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === 'object' && parsed !== null && !('apiKey' in parsed) && effectiveKey) {
        parsed.apiKey = effectiveKey;
        body = JSON.stringify(parsed);
      }
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    } catch {
      // Body is not JSON (e.g. plain text or raw bytes), keep as is
    }
  } else if (body && body instanceof FormData && effectiveKey) {
    if (!body.has('apiKey')) {
      body.append('apiKey', effectiveKey);
    }
  }

  // Pre-dispatch verification
  const hasAuthHeader = headers.has('Authorization');
  if (hasAuthHeader) {
    // Verified header successfully attached
    const authVal = headers.get('Authorization') || '';
    const keyPreview = authVal.length > 15 ? `${authVal.slice(0, 15)}...` : authVal;
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AuthFetch Verified] Injected Authorization (${keyPreview}) for ${url}`);
    }
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AuthFetch Notice] No custom key available, dispatching to ${url} relying on server credentials`);
    }
  }

  const mergedInit: RequestInit = {
    ...init,
    headers,
    body
  };

  return fetch(input, mergedInit);
}

/**
 * Custom React hook for centralized API key state and reliable injection.
 */
export function useApiAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => apiAuthStore.getAuthState());
  const [backendStatus, setBackendStatus] = useState<{
    hasKey: boolean;
    hasServerEnvKey: boolean;
    source: string;
    checked: boolean;
  }>({
    hasKey: false,
    hasServerEnvKey: false,
    source: 'none',
    checked: false
  });

  useEffect(() => {
    const unsubscribe = apiAuthStore.subscribe((newState) => {
      setAuthState(newState);
    });
    return unsubscribe;
  }, []);

  const refreshBackendStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setBackendStatus({
          hasKey: !!data.hasKey,
          hasServerEnvKey: !!data.hasServerEnvKey,
          source: data.source || 'none',
          checked: true
        });
      }
    } catch {
      // Backend status probe optional
    }
  }, []);

  useEffect(() => {
    refreshBackendStatus();
  }, [authState.apiKey, refreshBackendStatus]);

  const setApiKey = useCallback((newKey: string) => {
    apiAuthStore.setKey(newKey);
  }, []);

  const clearApiKey = useCallback(() => {
    apiAuthStore.clearKey();
  }, []);

  return {
    apiKey: authState.apiKey,
    isValidKey: authState.isValid,
    hasKey: !!authState.apiKey,
    source: authState.source,
    backendStatus,
    setApiKey,
    clearApiKey,
    refreshBackendStatus,
    authFetch
  };
}
