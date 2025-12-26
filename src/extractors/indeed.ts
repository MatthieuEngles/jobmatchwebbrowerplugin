/**
 * Indeed Jobs extractor
 * Specialized extractor for indeed.com/indeed.fr pages
 */

import type { JobOffer, ExtractionResult } from '@/types';
import {
  Extractor,
  cleanText,
  getDomain,
  createEmptyResult,
  createSuccessResult,
  extractSkillsFromText,
  detectRemoteType,
  parseSalary,
} from './base';
import { htmlToMarkdown } from '@/lib/html-to-markdown';

export class IndeedExtractor implements Extractor {
  name = 'indeed';
  domains = ['indeed.com', 'indeed.fr', 'www.indeed.com', 'www.indeed.fr'];
  priority = 10;

  canHandle(url: string): boolean {
    const domain = getDomain(url);
    return this.domains.some((d) => domain.includes('indeed'));
  }

  async extract(url: string, doc: Document): Promise<ExtractionResult> {
    const offer: Partial<JobOffer> = {
      sourceUrl: url,
      sourceDomain: getDomain(url),
      capturedAt: new Date().toISOString(),
    };

    // Extract job title
    offer.title = this.extractTitle(doc);
    if (!offer.title) {
      return createEmptyResult(this.name);
    }

    // Extract company
    offer.company = this.extractCompany(doc);

    // Extract location
    offer.location = this.extractLocation(doc);

    // Extract description
    offer.description = this.extractDescription(doc);
    if (!offer.description) {
      return createEmptyResult(this.name);
    }

    // Extract salary
    offer.salary = this.extractSalary(doc);

    // Extract job details
    const details = this.extractJobDetails(doc);
    offer.contractType = details.contractType;
    offer.remoteType = details.remoteType ?? detectRemoteType(offer.description);

    // Extract skills
    offer.skills = extractSkillsFromText(offer.description);

    // Calculate confidence
    const confidence = this.calculateConfidence(offer);

    return createSuccessResult(this.name, offer, confidence);
  }

  private extractTitle(doc: Document): string | undefined {
    const selectors = [
      'h1.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1[class*="JobTitle"]',
      '.jobsearch-JobInfoHeader-title-container h1',
      'h1',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        // Filter out "new" badge that might be included
        if (text && text.length > 2) {
          return text.replace(/^(new|nouveau)\s*/i, '').trim();
        }
      }
    }

    return undefined;
  }

  private extractCompany(doc: Document): string | undefined {
    const selectors = [
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="jobsearch-CompanyInfoHeader-companyName"]',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '.jobsearch-CompanyInfoWithoutHeaderImage a',
      '[class*="companyName"]',
      '.icl-u-lg-mr--sm a',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text && text.length > 1) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractLocation(doc: Document): string | undefined {
    const selectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="jobsearch-CompanyInfoHeader-location"]',
      '.jobsearch-InlineCompanyRating-companyHeader + div',
      '.jobsearch-JobInfoHeader-subtitle > div:last-child',
      '[class*="companyLocation"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text && text.length > 2) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractDescription(doc: Document): string | undefined {
    const selectors = [
      '#jobDescriptionText',
      '[data-testid="jobDescriptionText"]',
      '.jobsearch-jobDescriptionText',
      '.jobsearch-JobComponent-description',
      '[class*="jobDescription"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        // Convert HTML to Markdown to preserve formatting
        const markdown = htmlToMarkdown(element.innerHTML);
        if (markdown && markdown.length > 100) {
          return markdown;
        }
      }
    }

    return undefined;
  }

  private extractSalary(doc: Document): JobOffer['salary'] | undefined {
    const selectors = [
      '[data-testid="jobsearch-JobMetadataHeader-salarySnippet"]',
      '.jobsearch-JobMetadataHeader-item .attribute_snippet',
      '#salaryInfoAndJobType',
      '[class*="salary"]',
      '[class*="salaire"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const salary = parseSalary(element.textContent);
        if (salary) {
          return salary;
        }
      }
    }

    return undefined;
  }

  private extractJobDetails(doc: Document): {
    contractType?: string;
    remoteType?: JobOffer['remoteType'];
  } {
    const result: {
      contractType?: string;
      remoteType?: JobOffer['remoteType'];
    } = {};

    // Job type metadata
    const metadataSelectors = [
      '.jobsearch-JobMetadataHeader-item',
      '[data-testid="jobsearch-JobMetadataHeader-item"]',
      '#salaryInfoAndJobType span',
      '.jobMetaDataGroup span',
    ];

    for (const selector of metadataSelectors) {
      const items = doc.querySelectorAll(selector);
      items.forEach((item) => {
        const text = cleanText(item.textContent);
        if (!text) return;

        const lower = text.toLowerCase();

        // Contract type
        if (lower.includes('cdi') || lower.includes('permanent') || lower.includes('full-time')) {
          result.contractType = 'CDI';
        } else if (lower.includes('cdd') || lower.includes('temporary') || lower.includes('contract')) {
          result.contractType = 'CDD';
        } else if (lower.includes('intérim') || lower.includes('interim')) {
          result.contractType = 'Intérim';
        } else if (lower.includes('stage') || lower.includes('intern')) {
          result.contractType = 'Stage';
        } else if (lower.includes('apprenti') || lower.includes('alternance')) {
          result.contractType = 'Alternance';
        }

        // Remote type
        if (lower.includes('télétravail') || lower.includes('remote')) {
          if (lower.includes('hybrid') || lower.includes('hybride') || lower.includes('partiel')) {
            result.remoteType = 'hybrid';
          } else {
            result.remoteType = 'remote';
          }
        }
      });
    }

    return result;
  }

  private calculateConfidence(offer: Partial<JobOffer>): number {
    let score = 0.5; // Base score for Indeed (trusted source)

    if (offer.title) score += 0.15;
    if (offer.company) score += 0.1;
    if (offer.description && offer.description.length > 200) score += 0.15;
    if (offer.location) score += 0.05;
    if (offer.salary) score += 0.05;

    return Math.min(score, 1);
  }
}

export const indeedExtractor = new IndeedExtractor();
