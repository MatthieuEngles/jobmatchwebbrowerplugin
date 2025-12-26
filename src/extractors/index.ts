/**
 * Extractor registry and orchestrator
 * Manages all extractors and selects the best one for a given page
 */

import type { ExtractionResult } from '@/types';
import type { Extractor } from './base';
import { getDomain, createEmptyResult } from './base';
import { genericExtractor } from './generic';
import { linkedInExtractor } from './linkedin';
import { indeedExtractor } from './indeed';
import { welcomeToTheJungleExtractor } from './welcometothejungle';

// Registry of all extractors, sorted by priority (highest first)
const extractors: Extractor[] = [
  linkedInExtractor,
  indeedExtractor,
  welcomeToTheJungleExtractor,
  genericExtractor, // Always last as fallback
].sort((a, b) => b.priority - a.priority);

/**
 * Extract job offer data from the current page
 * Tries specialized extractors first, falls back to generic
 */
export async function extractJobOffer(
  url: string,
  doc: Document = document
): Promise<ExtractionResult> {
  const domain = getDomain(url);
  console.log(`[Extractor] Extracting from: ${domain}`);

  // Find matching extractors
  for (const extractor of extractors) {
    if (extractor.canHandle(url, doc)) {
      console.log(`[Extractor] Using extractor: ${extractor.name}`);

      try {
        const result = await extractor.extract(url, doc);

        if (result.success && result.offer) {
          console.log(`[Extractor] Success with ${extractor.name}, confidence: ${result.confidence}`);
          return result;
        }

        console.log(`[Extractor] ${extractor.name} failed, trying next...`);
      } catch (error) {
        console.error(`[Extractor] Error in ${extractor.name}:`, error);
      }
    }
  }

  // All extractors failed
  return createEmptyResult('none');
}

/**
 * Check if the current page looks like a job posting
 * Used to decide whether to show the floating button
 */
export function isJobPage(url: string, doc: Document = document): boolean {
  const domain = getDomain(url);

  // Known job sites
  const jobSiteDomains = [
    'linkedin.com',
    'indeed.com',
    'indeed.fr',
    'welcometothejungle.com',
    'glassdoor.com',
    'glassdoor.fr',
    'monster.fr',
    'monster.com',
    'apec.fr',
    'pole-emploi.fr',
    'francetravail.fr',
    'hellowork.com',
    'cadremploi.fr',
    'talent.com',
    'jobteaser.com',
  ];

  // Check if on a known job site
  const isKnownJobSite = jobSiteDomains.some((d) => domain.includes(d.replace('www.', '')));

  if (isKnownJobSite) {
    // For known sites, check if on a job detail page
    const pathIndicators = ['/jobs/', '/job/', '/offre/', '/emploi/', '/career/', '/carriere/'];
    const hasJobPath = pathIndicators.some((p) => url.toLowerCase().includes(p));

    // Or check for job-specific URL patterns
    const urlPatterns = [
      /\/jobs\/view\/\d+/,
      /\/job\/[a-z0-9-]+/i,
      /\/offre\/[a-z0-9-]+/i,
      /viewjob/i,
    ];
    const hasJobUrl = urlPatterns.some((p) => p.test(url));

    return hasJobPath || hasJobUrl;
  }

  // For unknown sites, use heuristics
  return detectJobPageHeuristics(url, doc);
}

/**
 * Heuristic detection for job pages on unknown sites
 */
function detectJobPageHeuristics(url: string, doc: Document): boolean {
  const indicators = {
    urlScore: 0,
    contentScore: 0,
    structuredDataScore: 0,
  };

  // URL indicators
  const urlLower = url.toLowerCase();
  const urlKeywords = ['job', 'career', 'emploi', 'offre', 'recrutement', 'hiring', 'vacancy', 'position'];
  indicators.urlScore = urlKeywords.filter((k) => urlLower.includes(k)).length;

  // Page title indicators
  const title = doc.title?.toLowerCase() ?? '';
  const titleKeywords = ['job', 'career', 'emploi', 'poste', 'recrutement', 'hiring', 'developer', 'engineer', 'manager'];
  if (titleKeywords.some((k) => title.includes(k))) {
    indicators.contentScore += 2;
  }

  // Check for JSON-LD JobPosting
  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          indicators.structuredDataScore = 5;
          break;
        }
        if (item['@graph']?.some((g: { '@type'?: string }) => g['@type'] === 'JobPosting')) {
          indicators.structuredDataScore = 5;
          break;
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  // Check for common job page elements
  const jobElementSelectors = [
    '[class*="job-description"]',
    '[class*="job-title"]',
    '[class*="apply"]',
    '[id*="job-description"]',
    'button[class*="apply"]',
    'a[href*="apply"]',
  ];

  const hasJobElements = jobElementSelectors.some((s) => doc.querySelector(s));
  if (hasJobElements) {
    indicators.contentScore += 2;
  }

  // Calculate total score
  const totalScore =
    indicators.urlScore + indicators.contentScore + indicators.structuredDataScore;

  // Threshold: 3+ indicates likely job page
  return totalScore >= 3;
}

// Export extractors for testing
export { genericExtractor, linkedInExtractor, indeedExtractor, welcomeToTheJungleExtractor };
export type { Extractor };
