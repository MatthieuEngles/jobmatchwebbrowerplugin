/**
 * Background Service Worker
 * Handles authentication, API communication, and message passing
 */

import { api } from '@/lib/api';
import {
  getAuthTokens,
  setAuthTokens,
  getUser,
  setUser,
  clearAuth,
  isAuthenticated,
  getSettings,
  setSettings,
  addCapturedOffer,
} from '@/lib/storage';
import type {
  ExtensionMessage,
  LoginPayload,
  AuthState,
  JobOffer,
  ImportOfferRequest,
  Settings,
} from '@/types';

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  // Handle async responses
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Background] Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  console.log('[Background] Received message:', message.type);

  switch (message.type) {
    case 'GET_AUTH_STATE':
      return handleGetAuthState();

    case 'LOGIN':
      return handleLogin(message.payload as LoginPayload);

    case 'LOGOUT':
      return handleLogout();

    case 'IMPORT_OFFER':
      return handleImportOffer(message.payload as { offer: Partial<JobOffer> });

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(message.payload as Partial<Settings>);

    default:
      console.warn('[Background] Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

// ============================================================================
// Auth Handlers
// ============================================================================

async function handleGetAuthState(): Promise<AuthState> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return {
      isAuthenticated: false,
      user: null,
      tokens: null,
    };
  }

  const [user, tokens] = await Promise.all([getUser(), getAuthTokens()]);

  return {
    isAuthenticated: true,
    user,
    tokens,
  };
}

async function handleLogin(payload: LoginPayload): Promise<{ success: boolean; error?: string }> {
  const { email, password } = payload;

  if (!email || !password) {
    return { success: false, error: 'Email et mot de passe requis' };
  }

  const result = await api.login(email, password);

  if (!result.success) {
    return { success: false, error: result.error?.message ?? 'Erreur de connexion' };
  }

  // Store user info
  await setUser(result.data!.user);

  // Update badge to show logged in
  updateBadge(true);

  return { success: true };
}

async function handleLogout(): Promise<{ success: boolean }> {
  await api.logout();
  updateBadge(false);
  return { success: true };
}

// ============================================================================
// Offer Handlers
// ============================================================================

async function handleImportOffer(payload: {
  offer: Partial<JobOffer>;
}): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const { offer } = payload;

  // Check authentication
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { success: false, error: 'Non authentifié. Veuillez vous connecter.' };
  }

  // Save locally first
  // Truncate sourceUrl to 500 chars max (API limit)
  const truncatedUrl = (offer.sourceUrl ?? '').substring(0, 500);

  const fullOffer: JobOffer = {
    ...offer,
    title: offer.title ?? 'Sans titre',
    description: offer.description ?? '',
    sourceUrl: truncatedUrl,
    sourceDomain: offer.sourceDomain ?? '',
    capturedAt: offer.capturedAt ?? new Date().toISOString(),
  } as JobOffer;

  await addCapturedOffer(fullOffer);

  // Send to API
  const settings = await getSettings();
  const request: ImportOfferRequest = {
    offer: fullOffer,
    profileId: settings.defaultProfileId,
  };

  const result = await api.importOffer(request);

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "Erreur lors de l'import",
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================================================
// Settings Handlers
// ============================================================================

async function handleGetSettings(): Promise<Settings> {
  return getSettings();
}

async function handleUpdateSettings(
  updates: Partial<Settings>
): Promise<{ success: boolean; settings: Settings }> {
  const settings = await setSettings(updates);
  return { success: true, settings };
}

// ============================================================================
// Badge Management
// ============================================================================

function updateBadge(isLoggedIn: boolean): void {
  if (isLoggedIn) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
  }
}

// ============================================================================
// Installation & Startup
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First install - set default settings
    await setSettings({});
    console.log('[Background] Default settings initialized');
  }

  // Check auth state and update badge
  const authenticated = await isAuthenticated();
  updateBadge(authenticated);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension started');

  // Check auth state and update badge
  const authenticated = await isAuthenticated();
  updateBadge(authenticated);

  // Optionally refresh tokens on startup
  const tokens = await getAuthTokens();
  if (tokens) {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    // If token expires within an hour, refresh it
    if (tokens.expiresAt < now + hourMs) {
      console.log('[Background] Refreshing tokens on startup');
      // Token refresh happens automatically in api.ts
    }
  }
});

// ============================================================================
// Context Menu (Right-click)
// ============================================================================

// Only create context menu if the API is available (requires contextMenus permission)
if (typeof chrome.contextMenus !== 'undefined') {
  chrome.runtime.onInstalled.addListener(() => {
    // Create context menu for importing jobs from right-click
    chrome.contextMenus.create({
      id: 'jobmatch-import',
      title: 'Ajouter à JobMatch',
      contexts: ['page', 'selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'jobmatch-import' && tab?.id) {
      // Send message to content script to extract and import
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_AND_IMPORT',
        timestamp: Date.now(),
      });
    }
  });
}

console.log('[Background] Service worker initialized');
