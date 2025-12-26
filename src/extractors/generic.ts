/**
 * Generic extractor that works on any website
 * Uses structured data (JSON-LD, microdata) and common patterns
 */

import type { JobOffer, ExtractionResult } from '@/types';
import {
  Extractor,
  cleanText,
  getDomain,
  createEmptyResult,
  createSuccessResult,
  parseSalary,
  detectRemoteType,
  extractSkillsFromText,
} from './base';
import { htmlToMarkdown } from '@/lib/html-to-markdown';

interface JobPostingLD {
  '@type'?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string;
  hiringOrganization?: {
    '@type'?: string;
    name?: string;
  };
  jobLocation?: {
    '@type'?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  baseSalary?: {
    '@type'?: string;
    currency?: string;
    value?: {
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
  };
  skills?: string | string[];
  qualifications?: string;
}

export class GenericExtractor implements Extractor {
  name = 'generic';
  domains = ['*'];
  priority = 0; // Lowest priority, used as fallback

  canHandle(): boolean {
    return true; // Can always try
  }

  async extract(url: string, doc: Document): Promise<ExtractionResult> {
    const offer: Partial<JobOffer> = {
      sourceUrl: url,
      sourceDomain: getDomain(url),
      capturedAt: new Date().toISOString(),
    };

    let confidence = 0;

    // 1. Try JSON-LD structured data (highest quality)
    const jsonLdData = this.extractJsonLd(doc);
    if (jsonLdData) {
      this.applyJsonLdData(offer, jsonLdData);
      confidence = 0.9;
    }

    // 2. Try OpenGraph and meta tags
    this.extractMetaTags(offer, doc);

    // 3. Try common HTML patterns
    if (!offer.title) {
      offer.title = this.extractTitle(doc);
    }
    if (!offer.description) {
      offer.description = this.extractDescription(doc);
    }
    if (!offer.company) {
      offer.company = this.extractCompany(doc);
    }
    if (!offer.location) {
      offer.location = this.extractLocation(doc);
    }

    // 4. Extract skills from description
    if (offer.description && !offer.skills?.length) {
      offer.skills = extractSkillsFromText(offer.description);
    }

    // 5. Detect remote type
    const fullText = `${offer.title ?? ''} ${offer.description ?? ''}`;
    if (!offer.remoteType || offer.remoteType === 'unknown') {
      offer.remoteType = detectRemoteType(fullText);
    }

    // Calculate confidence based on what we found
    if (!jsonLdData) {
      confidence = this.calculateConfidence(offer);
    }

    // Must have at least a title and description
    if (!offer.title || !offer.description) {
      return createEmptyResult(this.name);
    }

    return createSuccessResult(this.name, offer, confidence);
  }

  private extractJsonLd(doc: Document): JobPostingLD | null {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? '');

        // Handle arrays
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          // Check for JobPosting type
          if (item['@type'] === 'JobPosting') {
            return item as JobPostingLD;
          }

          // Check @graph for JobPosting
          if (item['@graph']) {
            const jobPosting = item['@graph'].find(
              (g: { '@type'?: string }) => g['@type'] === 'JobPosting'
            );
            if (jobPosting) {
              return jobPosting as JobPostingLD;
            }
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return null;
  }

  private applyJsonLdData(offer: Partial<JobOffer>, data: JobPostingLD): void {
    if (data.title) {
      offer.title = cleanText(data.title);
    }

    if (data.description) {
      // Description might be HTML - convert to Markdown to preserve formatting
      offer.description = htmlToMarkdown(data.description);
    }

    if (data.hiringOrganization?.name) {
      offer.company = cleanText(data.hiringOrganization.name);
    }

    if (data.jobLocation?.address) {
      const addr = data.jobLocation.address;
      const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(
        Boolean
      );
      offer.location = parts.join(', ');
    }

    if (data.employmentType) {
      offer.contractType = this.normalizeContractType(data.employmentType);
    }

    if (data.baseSalary?.value) {
      const salary = data.baseSalary;
      offer.salary = {
        min: salary.value?.minValue,
        max: salary.value?.maxValue,
        currency: salary.currency ?? 'EUR',
        period: this.normalizeSalaryPeriod(salary.value?.unitText),
      };
    }

    if (data.datePosted) {
      offer.publishedAt = data.datePosted;
    }

    if (data.skills) {
      offer.skills = Array.isArray(data.skills) ? data.skills : [data.skills];
    }
  }

  private extractMetaTags(offer: Partial<JobOffer>, doc: Document): void {
    // OpenGraph
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
    const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content');

    // Twitter
    const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    const twitterDesc = doc
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute('content');

    // Standard meta
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content');

    if (!offer.title && (ogTitle || twitterTitle)) {
      offer.title = cleanText(ogTitle ?? twitterTitle);
    }

    if (!offer.description && (ogDesc || twitterDesc || metaDesc)) {
      offer.description = cleanText(ogDesc ?? twitterDesc ?? metaDesc);
    }

    if (!offer.company && ogSiteName) {
      offer.company = cleanText(ogSiteName);
    }
  }

  private extractTitle(doc: Document): string | undefined {
    // Common title selectors for job pages
    const selectors = [
      'h1[class*="job-title"]',
      'h1[class*="jobtitle"]',
      'h1[class*="position"]',
      '[class*="job-title"] h1',
      '[class*="job-header"] h1',
      '[data-testid*="job-title"]',
      'h1',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        // Filter out obviously wrong titles
        if (text && text.length > 3 && text.length < 200) {
          return text;
        }
      }
    }

    // Fallback to document title
    const docTitle = doc.title;
    if (docTitle) {
      // Remove common suffixes like " | Company Name"
      const cleaned = docTitle.split(/\s*[|–-]\s*/)[0];
      return cleanText(cleaned);
    }

    return undefined;
  }

  private extractDescription(doc: Document): string | undefined {
    const selectors = [
      '[class*="job-description"]',
      '[class*="jobdescription"]',
      '[class*="description-content"]',
      '[data-testid*="job-description"]',
      '[id*="job-description"]',
      'article',
      'main',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        // Convert HTML to Markdown to preserve formatting
        const markdown = htmlToMarkdown(element.innerHTML);
        // Must be substantial
        if (markdown && markdown.length > 100) {
          return markdown;
        }
      }
    }

    return undefined;
  }

  private extractCompany(doc: Document): string | undefined {
    const selectors = [
      '[class*="company-name"]',
      '[class*="companyname"]',
      '[class*="employer"]',
      '[data-testid*="company"]',
      '[class*="hiring-organization"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text && text.length > 1 && text.length < 100) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractLocation(doc: Document): string | undefined {
    const selectors = [
      '[class*="job-location"]',
      '[class*="joblocation"]',
      '[class*="location"]',
      '[data-testid*="location"]',
      '[class*="address"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text && text.length > 1 && text.length < 200) {
          return text;
        }
      }
    }

    return undefined;
  }

  private htmlToText(html: string): string {
    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return cleanText(temp.textContent);
  }

  private normalizeContractType(type: string): string {
    const lower = type.toLowerCase();

    if (lower.includes('full') || lower.includes('permanent') || lower === 'cdi') {
      return 'CDI';
    }
    if (lower.includes('temporary') || lower.includes('contract') || lower === 'cdd') {
      return 'CDD';
    }
    if (lower.includes('intern') || lower.includes('stage')) {
      return 'Stage';
    }
    if (lower.includes('freelance') || lower.includes('contractor')) {
      return 'Freelance';
    }
    if (lower.includes('part-time') || lower.includes('partiel')) {
      return 'Temps partiel';
    }
    if (lower.includes('apprenti')) {
      return 'Alternance';
    }

    return type;
  }

  private normalizeSalaryPeriod(period: string | undefined): 'hour' | 'day' | 'month' | 'year' {
    if (!period) return 'year';

    const lower = period.toLowerCase();
    if (lower.includes('hour') || lower.includes('heure')) return 'hour';
    if (lower.includes('day') || lower.includes('jour')) return 'day';
    if (lower.includes('month') || lower.includes('mois')) return 'month';
    return 'year';
  }

  private calculateConfidence(offer: Partial<JobOffer>): number {
    let score = 0;
    const weights = {
      title: 0.25,
      description: 0.25,
      company: 0.15,
      location: 0.1,
      salary: 0.1,
      skills: 0.1,
      contractType: 0.05,
    };

    if (offer.title) score += weights.title;
    if (offer.description && offer.description.length > 200) score += weights.description;
    if (offer.company) score += weights.company;
    if (offer.location) score += weights.location;
    if (offer.salary) score += weights.salary;
    if (offer.skills && offer.skills.length > 0) score += weights.skills;
    if (offer.contractType) score += weights.contractType;

    return Math.min(score, 1);
  }
}

export const genericExtractor = new GenericExtractor();
