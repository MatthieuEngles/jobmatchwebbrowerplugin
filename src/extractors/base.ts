/**
 * Base extractor interface and utilities
 */

import type { JobOffer, ExtractionResult } from '@/types';

export interface Extractor {
  name: string;
  domains: string[];
  priority: number; // Higher = checked first
  canHandle(url: string, document: Document): boolean;
  extract(url: string, document: Document): Promise<ExtractionResult>;
}

/**
 * Utility functions for extractors
 */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .trim();
}

export function extractTextFromSelector(
  doc: Document,
  selectors: string | string[]
): string | null {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    try {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        return cleanText(element.textContent);
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return null;
}

export function extractHtmlFromSelector(
  doc: Document,
  selectors: string | string[]
): string | null {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    try {
      const element = doc.querySelector(selector);
      if (element?.innerHTML) {
        return element.innerHTML;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return null;
}

export function extractAllTextFromSelector(
  doc: Document,
  selectors: string | string[]
): string[] {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  const results: string[] = [];

  for (const selector of selectorList) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = cleanText(el.textContent);
        if (text) {
          results.push(text);
        }
      });
    } catch {
      // Invalid selector, skip
    }
  }

  return results;
}

export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function createEmptyResult(extractorName: string): ExtractionResult {
  return {
    success: false,
    offer: null,
    confidence: 0,
    extractorUsed: extractorName,
    errors: ['Aucune donnée extraite'],
  };
}

export function createSuccessResult(
  extractorName: string,
  offer: Partial<JobOffer>,
  confidence: number
): ExtractionResult {
  return {
    success: true,
    offer,
    confidence,
    extractorUsed: extractorName,
  };
}

/**
 * Parse salary strings like "45k-55k€", "45000-55000€/an", etc.
 */
export function parseSalary(text: string): JobOffer['salary'] | undefined {
  if (!text) return undefined;

  const normalized = text.toLowerCase().replace(/\s/g, '');

  // Match patterns like "45k-55k", "45000-55000", "45-55k"
  const rangeMatch = normalized.match(/(\d+)k?[-–à](\d+)k?/);
  if (rangeMatch) {
    let min = parseInt(rangeMatch[1]!, 10);
    let max = parseInt(rangeMatch[2]!, 10);

    // Convert "k" notation
    if (min < 1000 && normalized.includes('k')) {
      min *= 1000;
    }
    if (max < 1000 && normalized.includes('k')) {
      max *= 1000;
    }

    // Determine currency
    let currency = 'EUR';
    if (normalized.includes('$')) currency = 'USD';
    if (normalized.includes('£')) currency = 'GBP';
    if (normalized.includes('chf')) currency = 'CHF';

    // Determine period
    let period: 'hour' | 'day' | 'month' | 'year' = 'year';
    if (normalized.includes('/h') || normalized.includes('heure')) period = 'hour';
    if (normalized.includes('/j') || normalized.includes('jour')) period = 'day';
    if (normalized.includes('/m') || normalized.includes('mois')) period = 'month';

    return { min, max, currency, period };
  }

  // Match single value like "45k€", "45000€"
  const singleMatch = normalized.match(/(\d+)k?[€$£]/);
  if (singleMatch) {
    let value = parseInt(singleMatch[1]!, 10);
    if (value < 1000 && normalized.includes('k')) {
      value *= 1000;
    }

    let currency = 'EUR';
    if (normalized.includes('$')) currency = 'USD';
    if (normalized.includes('£')) currency = 'GBP';

    return { min: value, max: value, currency, period: 'year' };
  }

  return undefined;
}

/**
 * Detect remote work type from text
 */
export function detectRemoteType(text: string): JobOffer['remoteType'] {
  const lower = text.toLowerCase();

  if (lower.includes('full remote') || lower.includes('100% remote') || lower.includes('télétravail complet')) {
    return 'remote';
  }
  if (lower.includes('hybrid') || lower.includes('hybride') || lower.includes('télétravail partiel')) {
    return 'hybrid';
  }
  if (lower.includes('on-site') || lower.includes('sur site') || lower.includes('présentiel')) {
    return 'onsite';
  }

  return 'unknown';
}

/**
 * Extract skills from text (basic extraction)
 */
export function extractSkillsFromText(text: string): string[] {
  // Common tech skills to look for
  const knownSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'PHP',
    'React', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Flask',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'Git', 'CI/CD', 'Agile', 'Scrum',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
    'REST', 'GraphQL', 'gRPC',
  ];

  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const skill of knownSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }

  return [...new Set(found)];
}
