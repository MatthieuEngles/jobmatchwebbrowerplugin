/**
 * Content Script
 * Runs on all pages, handles extraction and floating button
 */

import { extractJobOffer, isJobPage } from '@/extractors';
import type { ExtensionMessage, ExtractionResult } from '@/types';

// ============================================================================
// State
// ============================================================================

let floatingButton: HTMLElement | null = null;
let isExtracting = false;
let lastExtractionResult: ExtractionResult | null = null;

// ============================================================================
// Floating Button
// ============================================================================

function createFloatingButton(): HTMLElement {
  const button = document.createElement('div');
  button.id = 'jobmatch-floating-button';
  button.innerHTML = `
    <div class="jobmatch-fab-content">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span class="jobmatch-fab-text">Ajouter à JobMatch</span>
    </div>
    <div class="jobmatch-fab-loading" style="display: none;">
      <svg class="jobmatch-spinner" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="jobmatch-fab-success" style="display: none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span class="jobmatch-fab-text">Ajouté !</span>
    </div>
  `;

  button.addEventListener('click', handleFloatingButtonClick);

  return button;
}

function showFloatingButton(): void {
  if (floatingButton) return;

  floatingButton = createFloatingButton();
  document.body.appendChild(floatingButton);

  // Animate in
  requestAnimationFrame(() => {
    floatingButton?.classList.add('jobmatch-fab-visible');
  });
}

function hideFloatingButton(): void {
  if (!floatingButton) return;

  floatingButton.classList.remove('jobmatch-fab-visible');

  setTimeout(() => {
    floatingButton?.remove();
    floatingButton = null;
  }, 300);
}

function setButtonState(state: 'idle' | 'loading' | 'success' | 'error'): void {
  if (!floatingButton) return;

  const content = floatingButton.querySelector('.jobmatch-fab-content') as HTMLElement;
  const loading = floatingButton.querySelector('.jobmatch-fab-loading') as HTMLElement;
  const success = floatingButton.querySelector('.jobmatch-fab-success') as HTMLElement;

  content.style.display = state === 'idle' ? 'flex' : 'none';
  loading.style.display = state === 'loading' ? 'flex' : 'none';
  success.style.display = state === 'success' ? 'flex' : 'none';

  if (state === 'error') {
    floatingButton.classList.add('jobmatch-fab-error');
    content.style.display = 'flex';
  } else {
    floatingButton.classList.remove('jobmatch-fab-error');
  }
}

// ============================================================================
// Extraction & Import
// ============================================================================

async function handleFloatingButtonClick(): Promise<void> {
  if (isExtracting) return;

  isExtracting = true;
  setButtonState('loading');

  try {
    // Extract job offer
    const result = await extractJobOffer(window.location.href, document);
    lastExtractionResult = result;

    if (!result.success || !result.offer) {
      console.warn('[Content] Extraction failed:', result.errors);
      setButtonState('error');
      showNotification('Impossible d\'extraire l\'offre', 'error');
      setTimeout(() => setButtonState('idle'), 2000);
      return;
    }

    console.log('[Content] Extraction successful:', result);

    // Send to background for import
    const response = await sendMessage({
      type: 'IMPORT_OFFER',
      payload: { offer: result.offer },
      timestamp: Date.now(),
    });

    if (response.success) {
      setButtonState('success');
      showNotification('Offre ajoutée à JobMatch !', 'success');

      // Reset after delay
      setTimeout(() => {
        setButtonState('idle');
      }, 3000);
    } else {
      setButtonState('error');
      showNotification(response.error ?? 'Erreur lors de l\'import', 'error');
      setTimeout(() => setButtonState('idle'), 2000);
    }
  } catch (error) {
    console.error('[Content] Error:', error);
    setButtonState('error');
    showNotification('Une erreur est survenue', 'error');
    setTimeout(() => setButtonState('idle'), 2000);
  } finally {
    isExtracting = false;
  }
}

// ============================================================================
// Notifications
// ============================================================================

function showNotification(message: string, type: 'success' | 'error' | 'info'): void {
  // Remove existing notification
  const existing = document.getElementById('jobmatch-notification');
  existing?.remove();

  const notification = document.createElement('div');
  notification.id = 'jobmatch-notification';
  notification.className = `jobmatch-notification jobmatch-notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Animate in
  requestAnimationFrame(() => {
    notification.classList.add('jobmatch-notification-visible');
  });

  // Auto-remove
  setTimeout(() => {
    notification.classList.remove('jobmatch-notification-visible');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ============================================================================
// Message Communication
// ============================================================================

function sendMessage(message: ExtensionMessage): Promise<{ success: boolean; error?: string; data?: unknown }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Content] Message error:', chrome.runtime.lastError);
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response ?? { success: false, error: 'No response' });
      }
    });
  });
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_JOB_OFFER') {
    // Extract and return result
    extractJobOffer(window.location.href, document)
      .then((result) => {
        sendResponse({ success: result.success, result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  if (message.type === 'EXTRACT_AND_IMPORT') {
    // Extract and import (from context menu)
    handleFloatingButtonClick();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'SHOW_BUTTON') {
    showFloatingButton();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'HIDE_BUTTON') {
    hideFloatingButton();
    sendResponse({ success: true });
    return false;
  }

  return false;
});

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  console.log('[Content] Initializing on:', window.location.href);

  // Check if this looks like a job page
  const isJob = isJobPage(window.location.href, document);
  console.log('[Content] Is job page:', isJob);

  if (isJob) {
    // Check settings for floating button preference
    const response = await sendMessage({
      type: 'GET_SETTINGS',
      timestamp: Date.now(),
    });

    const settings = response as { showFloatingButton?: boolean };

    if (settings.showFloatingButton !== false) {
      showFloatingButton();
    }
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Re-check on URL changes (for SPAs)
let lastUrl = window.location.href;

const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[Content] URL changed:', lastUrl);

    // Hide button and re-check
    hideFloatingButton();
    setTimeout(initialize, 500); // Small delay for page to load
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log('[Content] Content script loaded');
