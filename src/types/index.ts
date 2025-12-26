import { z } from 'zod';
import { DEFAULT_API_URL } from '../config';

// ============================================================================
// Authentication Types
// ============================================================================

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(), // Unix timestamp
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
}

// ============================================================================
// Job Offer Types
// ============================================================================

export const JobOfferSchema = z.object({
  // Identifiants
  id: z.string().optional(),
  externalId: z.string().optional(),
  sourceUrl: z.string().url(),
  sourceDomain: z.string(),

  // Informations principales
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  remoteType: z.enum(['onsite', 'hybrid', 'remote', 'unknown']).optional(),

  // Détails du poste
  description: z.string(),
  contractType: z.string().optional(), // CDI, CDD, Freelance, Stage, etc.
  experience: z.string().optional(),
  salary: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      currency: z.string().optional(),
      period: z.enum(['hour', 'day', 'month', 'year']).optional(),
    })
    .optional(),

  // Compétences
  skills: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  niceToHaveSkills: z.array(z.string()).optional(),

  // Métadonnées
  publishedAt: z.string().optional(),
  capturedAt: z.string(),
  rawHtml: z.string().optional(),
});

export type JobOffer = z.infer<typeof JobOfferSchema>;

// ============================================================================
// Extraction Types
// ============================================================================

export interface ExtractionResult {
  success: boolean;
  offer: Partial<JobOffer> | null;
  confidence: number; // 0-1
  extractorUsed: string;
  errors?: string[];
}

export interface ExtractorConfig {
  name: string;
  domains: string[];
  selectors: {
    title?: string | string[];
    company?: string | string[];
    location?: string | string[];
    description?: string | string[];
    salary?: string | string[];
    skills?: string | string[];
    contractType?: string | string[];
  };
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ImportOfferRequest {
  offer: Partial<JobOffer>;
  profileId?: number;
}

export interface ImportOfferResponse {
  offerId: number;
  matchScore?: number;
  message: string;
}

export interface MatchResult {
  offerId: number;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
}

// ============================================================================
// Message Types (Extension Communication)
// ============================================================================

export type MessageType =
  | 'EXTRACT_JOB_OFFER'
  | 'EXTRACT_AND_IMPORT'
  | 'EXTRACTION_RESULT'
  | 'IMPORT_OFFER'
  | 'IMPORT_RESULT'
  | 'GET_AUTH_STATE'
  | 'AUTH_STATE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'SHOW_BUTTON'
  | 'HIDE_BUTTON';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp: number;
}

export interface ExtractJobOfferPayload {
  tabId?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export const SettingsSchema = z.object({
  apiBaseUrl: z.string().url().default(DEFAULT_API_URL),
  autoExtract: z.boolean().default(false),
  showFloatingButton: z.boolean().default(true),
  defaultProfileId: z.number().optional(),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['fr', 'en']).default('fr'),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: DEFAULT_API_URL,
  autoExtract: false,
  showFloatingButton: true,
  theme: 'system',
  language: 'fr',
};

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  AUTH_TOKENS: 'jobmatch_auth_tokens',
  USER: 'jobmatch_user',
  SETTINGS: 'jobmatch_settings',
  CAPTURED_OFFERS: 'jobmatch_captured_offers',
} as const;
