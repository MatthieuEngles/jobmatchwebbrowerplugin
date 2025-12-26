/**
 * Popup Script
 * Handles popup UI interactions and state management
 */

import type { ExtensionMessage, AuthState, JobOffer, ExtractionResult } from '@/types';
import { getCapturedOffers } from '@/lib/storage';

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Views
  loginView: document.getElementById('login-view') as HTMLElement,
  mainView: document.getElementById('main-view') as HTMLElement,

  // Login
  loginForm: document.getElementById('login-form') as HTMLFormElement,
  emailInput: document.getElementById('email') as HTMLInputElement,
  passwordInput: document.getElementById('password') as HTMLInputElement,
  loginBtn: document.getElementById('login-btn') as HTMLButtonElement,
  loginError: document.getElementById('login-error') as HTMLElement,

  // User
  userInitials: document.getElementById('user-initials') as HTMLElement,
  userName: document.getElementById('user-name') as HTMLElement,
  userEmail: document.getElementById('user-email') as HTMLElement,
  logoutBtn: document.getElementById('logout-btn') as HTMLButtonElement,

  // Page info
  pageStatus: document.getElementById('page-status') as HTMLElement,
  jobPreview: document.getElementById('job-preview') as HTMLElement,
  notJobPage: document.getElementById('not-job-page') as HTMLElement,
  previewTitle: document.getElementById('preview-title') as HTMLElement,
  previewCompany: document.getElementById('preview-company') as HTMLElement,
  previewLocation: document.getElementById('preview-location') as HTMLElement,
  previewContract: document.getElementById('preview-contract') as HTMLElement,
  importBtn: document.getElementById('import-btn') as HTMLButtonElement,
  forceExtractBtn: document.getElementById('force-extract-btn') as HTMLButtonElement,

  // Recent offers
  recentOffers: document.getElementById('recent-offers') as HTMLElement,

  // Status
  connectionStatus: document.getElementById('connection-status') as HTMLElement,
  settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
};

// ============================================================================
// State
// ============================================================================

let currentExtraction: ExtractionResult | null = null;

// ============================================================================
// Messaging
// ============================================================================

function sendMessage(
  message: ExtensionMessage
): Promise<{ success: boolean; error?: string; [key: string]: unknown }> {
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

function sendTabMessage(
  tabId: number,
  message: ExtensionMessage
): Promise<{ success: boolean; result?: ExtractionResult }> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false });
      } else {
        resolve(response ?? { success: false });
      }
    });
  });
}

// ============================================================================
// Auth
// ============================================================================

async function checkAuth(): Promise<AuthState> {
  const response = await sendMessage({
    type: 'GET_AUTH_STATE',
    timestamp: Date.now(),
  });

  return response as unknown as AuthState;
}

async function handleLogin(event: Event): Promise<void> {
  event.preventDefault();

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!email || !password) {
    showLoginError('Veuillez remplir tous les champs');
    return;
  }

  setLoginLoading(true);
  hideLoginError();

  const response = await sendMessage({
    type: 'LOGIN',
    payload: { email, password },
    timestamp: Date.now(),
  });

  setLoginLoading(false);

  if (response.success) {
    await initialize();
  } else {
    showLoginError(response.error ?? 'Erreur de connexion');
  }
}

async function handleLogout(): Promise<void> {
  await sendMessage({
    type: 'LOGOUT',
    timestamp: Date.now(),
  });

  showLoginView();
}

function showLoginError(message: string): void {
  elements.loginError.textContent = message;
  elements.loginError.style.display = 'block';
}

function hideLoginError(): void {
  elements.loginError.style.display = 'none';
}

function setLoginLoading(loading: boolean): void {
  elements.loginBtn.disabled = loading;
  const btnText = elements.loginBtn.querySelector('.btn-text') as HTMLElement;
  const btnLoading = elements.loginBtn.querySelector('.btn-loading') as HTMLElement;

  btnText.style.display = loading ? 'none' : 'inline';
  btnLoading.style.display = loading ? 'flex' : 'none';
}

// ============================================================================
// Views
// ============================================================================

function showLoginView(): void {
  elements.loginView.style.display = 'block';
  elements.mainView.style.display = 'none';

  // Clear form
  elements.emailInput.value = '';
  elements.passwordInput.value = '';
  hideLoginError();
}

function showMainView(authState: AuthState): void {
  elements.loginView.style.display = 'none';
  elements.mainView.style.display = 'block';

  // Update user info
  if (authState.user) {
    const firstName = authState.user.firstName ?? '';
    const lastName = authState.user.lastName ?? '';
    const fullName = `${firstName} ${lastName}`.trim() || authState.user.email;

    elements.userName.textContent = fullName;
    elements.userEmail.textContent = authState.user.email;

    // Generate initials
    const initials = fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    elements.userInitials.textContent = initials || 'U';
  }
}

// ============================================================================
// Page Analysis
// ============================================================================

async function analyzeCurrentPage(): Promise<void> {
  // Show loading state
  elements.pageStatus.style.display = 'flex';
  elements.jobPreview.style.display = 'none';
  elements.notJobPage.style.display = 'none';

  elements.pageStatus.innerHTML = `
    <span class="status-icon status-checking">
      <svg class="spinner" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
      </svg>
    </span>
    <span class="status-text">Analyse en cours...</span>
  `;

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    showNotJobPage();
    return;
  }

  // Skip non-http pages
  if (!tab.url.startsWith('http')) {
    showNotJobPage();
    return;
  }

  // Request extraction from content script
  const response = await sendTabMessage(tab.id, {
    type: 'EXTRACT_JOB_OFFER',
    timestamp: Date.now(),
  });

  if (response.success && response.result?.success && response.result.offer) {
    currentExtraction = response.result;
    showJobPreview(response.result.offer);
  } else {
    currentExtraction = null;
    showNotJobPage();
  }
}

function showJobPreview(offer: Partial<JobOffer>): void {
  elements.pageStatus.style.display = 'none';
  elements.notJobPage.style.display = 'none';
  elements.jobPreview.style.display = 'block';

  elements.previewTitle.textContent = offer.title ?? 'Titre non disponible';
  elements.previewCompany.textContent = offer.company ?? 'Entreprise inconnue';

  if (offer.location) {
    elements.previewLocation.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span>${offer.location}</span>
    `;
    elements.previewLocation.style.display = 'flex';
  } else {
    elements.previewLocation.style.display = 'none';
  }

  if (offer.contractType) {
    elements.previewContract.textContent = offer.contractType;
    elements.previewContract.style.display = 'inline';
  } else {
    elements.previewContract.style.display = 'none';
  }
}

function showNotJobPage(): void {
  elements.pageStatus.style.display = 'none';
  elements.jobPreview.style.display = 'none';
  elements.notJobPage.style.display = 'flex';
}

// ============================================================================
// Import
// ============================================================================

async function handleImport(): Promise<void> {
  if (!currentExtraction?.offer) return;

  elements.importBtn.disabled = true;
  elements.importBtn.innerHTML = `
    <svg class="spinner" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
    </svg>
    <span>Import en cours...</span>
  `;

  const response = await sendMessage({
    type: 'IMPORT_OFFER',
    payload: { offer: currentExtraction.offer },
    timestamp: Date.now(),
  });

  if (response.success) {
    elements.importBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Ajouté !</span>
    `;
    elements.importBtn.style.background = 'var(--color-success)';

    // Refresh recent offers
    await loadRecentOffers();

    // Reset after delay
    setTimeout(() => {
      elements.importBtn.disabled = false;
      elements.importBtn.style.background = '';
      elements.importBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Ajouter à JobMatch</span>
      `;
    }, 2000);
  } else {
    elements.importBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Erreur</span>
    `;
    elements.importBtn.style.background = 'var(--color-error)';

    setTimeout(() => {
      elements.importBtn.disabled = false;
      elements.importBtn.style.background = '';
      elements.importBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Réessayer</span>
      `;
    }, 2000);
  }
}

async function handleForceExtract(): Promise<void> {
  elements.forceExtractBtn.disabled = true;
  elements.forceExtractBtn.textContent = 'Extraction...';

  await analyzeCurrentPage();

  elements.forceExtractBtn.disabled = false;
  elements.forceExtractBtn.textContent = 'Extraire quand même';
}

// ============================================================================
// Recent Offers
// ============================================================================

async function loadRecentOffers(): Promise<void> {
  const offers = await getCapturedOffers();

  if (offers.length === 0) {
    elements.recentOffers.innerHTML = `
      <div class="empty-state">
        <p>Aucune offre capturée</p>
      </div>
    `;
    return;
  }

  // Show last 5
  const recentOnes = offers.slice(0, 5);

  elements.recentOffers.innerHTML = recentOnes
    .map((offer) => {
      const date = new Date(offer.capturedAt);
      const dateStr = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });

      return `
        <div class="recent-offer-item" data-url="${offer.sourceUrl}">
          <div class="recent-offer-info">
            <span class="recent-offer-title">${offer.title}</span>
            <span class="recent-offer-company">${offer.company ?? offer.sourceDomain}</span>
          </div>
          <span class="recent-offer-date">${dateStr}</span>
        </div>
      `;
    })
    .join('');

  // Add click handlers
  elements.recentOffers.querySelectorAll('.recent-offer-item').forEach((item) => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });
}

// ============================================================================
// Connection Status
// ============================================================================

async function checkConnection(): Promise<void> {
  const statusDot = elements.connectionStatus.querySelector('.status-dot') as HTMLElement;
  const statusText = elements.connectionStatus.querySelector('.status-text') as HTMLElement;

  statusDot.className = 'status-dot status-dot-checking';
  statusText.textContent = 'Vérification...';

  try {
    const settings = await sendMessage({
      type: 'GET_SETTINGS',
      timestamp: Date.now(),
    });

    const apiUrl = (settings as { apiBaseUrl?: string }).apiBaseUrl ?? 'http://localhost:8085';

    const response = await fetch(`${apiUrl}/api/health/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      statusDot.className = 'status-dot status-dot-connected';
      statusText.textContent = 'Connecté';
    } else {
      statusDot.className = 'status-dot status-dot-disconnected';
      statusText.textContent = 'Serveur indisponible';
    }
  } catch {
    statusDot.className = 'status-dot status-dot-disconnected';
    statusText.textContent = 'Hors ligne';
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners(): void {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.importBtn.addEventListener('click', handleImport);
  elements.forceExtractBtn.addEventListener('click', handleForceExtract);

  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  // Check auth state
  const authState = await checkAuth();

  if (authState.isAuthenticated && authState.user) {
    showMainView(authState);
    await Promise.all([analyzeCurrentPage(), loadRecentOffers(), checkConnection()]);
  } else {
    showLoginView();
    await checkConnection();
  }
}

// Start
setupEventListeners();
initialize();
