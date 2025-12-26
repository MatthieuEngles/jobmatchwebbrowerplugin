/**
 * Storage abstraction layer for cross-browser compatibility
 * Uses chrome.storage.local for Chrome/Edge and browser.storage.local for Firefox
 */

import type { AuthTokens, User, Settings, JobOffer } from '@/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS, AuthTokensSchema, SettingsSchema } from '@/types';

// Use chrome API (works for Chrome, Edge, and Firefox with webextension-polyfill)
const storage = chrome.storage.local;

// ============================================================================
// Generic Storage Operations
// ============================================================================

async function get<T>(key: string): Promise<T | null> {
  try {
    const result = await storage.get(key);
    return (result[key] as T) ?? null;
  } catch (error) {
    console.error(`[Storage] Error getting ${key}:`, error);
    return null;
  }
}

async function set<T>(key: string, value: T): Promise<void> {
  try {
    await storage.set({ [key]: value });
  } catch (error) {
    console.error(`[Storage] Error setting ${key}:`, error);
    throw error;
  }
}

async function remove(key: string): Promise<void> {
  try {
    await storage.remove(key);
  } catch (error) {
    console.error(`[Storage] Error removing ${key}:`, error);
    throw error;
  }
}

// ============================================================================
// Auth Storage
// ============================================================================

export async function getAuthTokens(): Promise<AuthTokens | null> {
  const tokens = await get<AuthTokens>(STORAGE_KEYS.AUTH_TOKENS);
  if (!tokens) return null;

  // Validate tokens structure
  const parsed = AuthTokensSchema.safeParse(tokens);
  if (!parsed.success) {
    console.warn('[Storage] Invalid tokens structure, clearing...');
    await clearAuth();
    return null;
  }

  return parsed.data;
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  await set(STORAGE_KEYS.AUTH_TOKENS, tokens);
}

export async function getUser(): Promise<User | null> {
  return get<User>(STORAGE_KEYS.USER);
}

export async function setUser(user: User): Promise<void> {
  await set(STORAGE_KEYS.USER, user);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([remove(STORAGE_KEYS.AUTH_TOKENS), remove(STORAGE_KEYS.USER)]);
}

export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getAuthTokens();
  if (!tokens) return false;

  // Check if access token is expired (with 30s buffer)
  const now = Date.now();
  const isExpired = tokens.expiresAt < now + 30000;

  return !isExpired;
}

// ============================================================================
// Settings Storage
// ============================================================================

export async function getSettings(): Promise<Settings> {
  const settings = await get<Settings>(STORAGE_KEYS.SETTINGS);
  if (!settings) return DEFAULT_SETTINGS;

  // Merge with defaults to handle new settings fields
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...settings });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await set(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// ============================================================================
// Captured Offers Storage (local history)
// ============================================================================

export async function getCapturedOffers(): Promise<JobOffer[]> {
  const offers = await get<JobOffer[]>(STORAGE_KEYS.CAPTURED_OFFERS);
  return offers ?? [];
}

export async function addCapturedOffer(offer: JobOffer): Promise<void> {
  const offers = await getCapturedOffers();

  // Avoid duplicates based on sourceUrl
  const exists = offers.some((o) => o.sourceUrl === offer.sourceUrl);
  if (exists) {
    // Update existing
    const updated = offers.map((o) => (o.sourceUrl === offer.sourceUrl ? offer : o));
    await set(STORAGE_KEYS.CAPTURED_OFFERS, updated);
  } else {
    // Add new (keep last 100)
    const updated = [offer, ...offers].slice(0, 100);
    await set(STORAGE_KEYS.CAPTURED_OFFERS, updated);
  }
}

export async function removeCapturedOffer(sourceUrl: string): Promise<void> {
  const offers = await getCapturedOffers();
  const updated = offers.filter((o) => o.sourceUrl !== sourceUrl);
  await set(STORAGE_KEYS.CAPTURED_OFFERS, updated);
}

export async function clearCapturedOffers(): Promise<void> {
  await remove(STORAGE_KEYS.CAPTURED_OFFERS);
}

// ============================================================================
// Storage Events
// ============================================================================

export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return cleanup function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
