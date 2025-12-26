/**
 * Configuration de l'extension
 *
 * En développement : modifier API_BASE_URL ci-dessous
 * En production : l'URL sera celle configurée par l'utilisateur dans les paramètres
 */

// ============================================================================
// Configuration par défaut
// ============================================================================

/**
 * URL de l'API JobMatch par défaut
 *
 * Développement (WSL) : http://localhost:8085
 * Production : https://api.jobmatch.fr (à définir)
 */
export const DEFAULT_API_URL = 'http://localhost:8085';

/**
 * URL de production (placeholder pour le futur)
 * Décommenter et modifier quand l'URL sera définie
 */
// export const PRODUCTION_API_URL = 'https://api.jobmatch.fr';

// ============================================================================
// Feature flags
// ============================================================================

export const CONFIG = {
  // Durée de vie des tokens (en ms)
  ACCESS_TOKEN_LIFETIME: 15 * 60 * 1000,  // 15 minutes
  REFRESH_TOKEN_LIFETIME: 7 * 24 * 60 * 60 * 1000,  // 7 jours

  // Buffer avant expiration pour refresh proactif (en ms)
  TOKEN_REFRESH_BUFFER: 60 * 1000,  // 1 minute

  // Nombre max d'offres stockées localement
  MAX_LOCAL_OFFERS: 100,

  // Timeout des requêtes API (en ms)
  API_TIMEOUT: 10000,  // 10 secondes

  // Mode debug (logs supplémentaires)
  DEBUG: true,
} as const;
