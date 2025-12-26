/**
 * Options Page Script
 * Manages extension settings
 */

import type { Settings, ExtensionMessage } from '@/types';
import { getCapturedOffers, clearCapturedOffers } from '@/lib/storage';

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Connection
  apiUrl: document.getElementById('api-url') as HTMLInputElement,
  connectionStatus: document.getElementById('connection-status') as HTMLElement,
  testConnectionBtn: document.getElementById('test-connection-btn') as HTMLButtonElement,

  // Behavior
  showFloatingButton: document.getElementById('show-floating-button') as HTMLInputElement,
  autoExtract: document.getElementById('auto-extract') as HTMLInputElement,

  // Appearance
  theme: document.getElementById('theme') as HTMLSelectElement,
  language: document.getElementById('language') as HTMLSelectElement,

  // Data
  offersCount: document.getElementById('offers-count') as HTMLElement,
  clearCacheBtn: document.getElementById('clear-cache-btn') as HTMLButtonElement,

  // Toast
  toast: document.getElementById('toast') as HTMLElement,
  toastMessage: document.getElementById('toast-message') as HTMLElement,
};

// ============================================================================
// Messaging
// ============================================================================

function sendMessage(message: ExtensionMessage): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response ?? { success: false });
      }
    });
  });
}

// ============================================================================
// Settings Management
// ============================================================================

async function loadSettings(): Promise<void> {
  const response = (await sendMessage({
    type: 'GET_SETTINGS',
    timestamp: Date.now(),
  })) as Settings;

  // Apply settings to form
  elements.apiUrl.value = response.apiBaseUrl ?? 'http://localhost:8085';
  elements.showFloatingButton.checked = response.showFloatingButton ?? true;
  elements.autoExtract.checked = response.autoExtract ?? false;
  elements.theme.value = response.theme ?? 'system';
  elements.language.value = response.language ?? 'fr';

  // Load offers count
  await updateOffersCount();
}

async function saveSettings(updates: Partial<Settings>): Promise<void> {
  await sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: updates,
    timestamp: Date.now(),
  });

  showToast('Paramètres enregistrés', 'success');
}

async function updateOffersCount(): Promise<void> {
  const offers = await getCapturedOffers();
  elements.offersCount.textContent = `${offers.length} offre${offers.length > 1 ? 's' : ''}`;
}

// ============================================================================
// Connection Test
// ============================================================================

async function testConnection(): Promise<void> {
  const statusDot = elements.connectionStatus.querySelector('.status-dot') as HTMLElement;
  const statusText = elements.connectionStatus.querySelector('.status-text') as HTMLElement;

  elements.testConnectionBtn.disabled = true;
  elements.testConnectionBtn.textContent = 'Test...';

  statusDot.className = 'status-dot status-dot-checking';
  statusText.textContent = 'Test en cours...';

  const apiUrl = elements.apiUrl.value.trim();

  try {
    const response = await fetch(`${apiUrl}/api/health/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      statusDot.className = 'status-dot status-dot-connected';
      statusText.textContent = 'Connecté';
      showToast('Connexion réussie', 'success');
    } else {
      statusDot.className = 'status-dot status-dot-disconnected';
      statusText.textContent = `Erreur ${response.status}`;
      showToast('Le serveur a répondu avec une erreur', 'error');
    }
  } catch (error) {
    statusDot.className = 'status-dot status-dot-disconnected';
    statusText.textContent = 'Échec de connexion';
    showToast('Impossible de joindre le serveur', 'error');
  } finally {
    elements.testConnectionBtn.disabled = false;
    elements.testConnectionBtn.textContent = 'Tester';
  }
}

// ============================================================================
// Cache Management
// ============================================================================

async function handleClearCache(): Promise<void> {
  const confirmed = confirm(
    'Êtes-vous sûr de vouloir supprimer toutes les offres stockées localement ?\n\nCette action est irréversible.'
  );

  if (!confirmed) return;

  await clearCapturedOffers();
  await updateOffersCount();
  showToast('Cache vidé', 'success');
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  elements.toastMessage.textContent = message;
  elements.toast.className = `toast toast-${type}`;
  elements.toast.style.display = 'block';

  // Force reflow for animation
  void elements.toast.offsetWidth;

  elements.toast.classList.add('toast-visible');

  setTimeout(() => {
    elements.toast.classList.remove('toast-visible');
    setTimeout(() => {
      elements.toast.style.display = 'none';
    }, 200);
  }, 3000);
}

// ============================================================================
// Event Handlers
// ============================================================================

function setupEventListeners(): void {
  // API URL change
  let apiUrlTimeout: number | undefined;
  elements.apiUrl.addEventListener('input', () => {
    clearTimeout(apiUrlTimeout);
    apiUrlTimeout = window.setTimeout(() => {
      saveSettings({ apiBaseUrl: elements.apiUrl.value.trim() });
    }, 500);
  });

  // Test connection
  elements.testConnectionBtn.addEventListener('click', testConnection);

  // Floating button toggle
  elements.showFloatingButton.addEventListener('change', () => {
    saveSettings({ showFloatingButton: elements.showFloatingButton.checked });
  });

  // Auto extract toggle
  elements.autoExtract.addEventListener('change', () => {
    saveSettings({ autoExtract: elements.autoExtract.checked });
  });

  // Theme change
  elements.theme.addEventListener('change', () => {
    saveSettings({ theme: elements.theme.value as 'light' | 'dark' | 'system' });
  });

  // Language change
  elements.language.addEventListener('change', () => {
    saveSettings({ language: elements.language.value as 'fr' | 'en' });
  });

  // Clear cache
  elements.clearCacheBtn.addEventListener('click', handleClearCache);
}

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  await loadSettings();
  setupEventListeners();
}

initialize();
