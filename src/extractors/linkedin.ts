/**
 * LinkedIn Jobs extractor
 * Specialized extractor for linkedin.com/jobs pages
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
} from './base';
import { htmlToMarkdown } from '@/lib/html-to-markdown';

export class LinkedInExtractor implements Extractor {
  name = 'linkedin';
  domains = ['linkedin.com', 'www.linkedin.com'];
  priority = 10;

  canHandle(url: string): boolean {
    const domain = getDomain(url);
    return this.domains.includes(domain) && url.includes('/jobs/');
  }

  async extract(url: string, doc: Document): Promise<ExtractionResult> {
    const offer: Partial<JobOffer> = {
      sourceUrl: url,
      sourceDomain: 'linkedin.com',
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

    // Extract job details
    const details = this.extractJobDetails(doc);
    offer.contractType = details.contractType;
    offer.experience = details.experience;
    offer.remoteType = details.remoteType ?? detectRemoteType(offer.description);

    // Extract skills
    offer.skills = this.extractSkills(doc) ?? extractSkillsFromText(offer.description);

    // Extract posted date
    offer.publishedAt = this.extractPostedDate(doc);

    // Calculate confidence
    const confidence = this.calculateConfidence(offer);

    return createSuccessResult(this.name, offer, confidence);
  }

  private extractTitle(doc: Document): string | undefined {
    // Multiple possible selectors for LinkedIn job titles
    const selectors = [
      'h1.t-24.t-bold.inline', // New LinkedIn UI
      'h1.topcard__title',
      'h1.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1[class*="job-title"]',
      '.top-card-layout__title',
      'h1',
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

  private extractCompany(doc: Document): string | undefined {
    const selectors = [
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      'a[class*="company-name"]',
      '.top-card-layout__card a[data-tracking-control-name="public_jobs_topcard-org-name"]',
      'a[data-tracking-control-name*="company"]',
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
      '.topcard__flavor--bullet',
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.top-card-layout__entity-info-container .topcard__flavor:not(.topcard__flavor--bullet)',
      'span[class*="location"]',
    ];

    for (const selector of selectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = cleanText(element.textContent);
        // Location usually contains city/region indicators
        if (text && (text.includes(',') || text.includes('France') || text.length > 3)) {
          // Skip if it's clearly not a location (e.g., "2 weeks ago")
          if (!text.match(/\d+\s*(week|day|hour|jour|semaine)/i)) {
            return text;
          }
        }
      }
    }

    return undefined;
  }

  private extractDescription(doc: Document): string | undefined {
    const selectors = [
      '.show-more-less-html__markup',
      '.jobs-description__content',
      '.jobs-description-content__text',
      '.description__text',
      '[class*="job-description"]',
      '.jobs-box__html-content',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        // Convert HTML to Markdown to preserve formatting (bullets, bold, etc.)
        const markdown = htmlToMarkdown(element.innerHTML);
        if (markdown && markdown.length > 100) {
          return markdown;
        }
      }
    }

    return undefined;
  }

  private extractJobDetails(doc: Document): {
    contractType?: string;
    experience?: string;
    remoteType?: JobOffer['remoteType'];
  } {
    const result: {
      contractType?: string;
      experience?: string;
      remoteType?: JobOffer['remoteType'];
    } = {};

    // Look for job insight items
    const insightSelectors = [
      '.job-details-jobs-unified-top-card__job-insight',
      '.jobs-unified-top-card__job-insight',
      '.description__job-criteria-item',
      '.job-criteria__item',
    ];

    for (const selector of insightSelectors) {
      const items = doc.querySelectorAll(selector);
      items.forEach((item) => {
        const text = cleanText(item.textContent);
        if (!text) return;

        const lower = text.toLowerCase();

        // Contract type detection
        if (
          lower.includes('cdi') ||
          lower.includes('full-time') ||
          lower.includes('temps plein')
        ) {
          result.contractType = 'CDI';
        } else if (
          lower.includes('cdd') ||
          lower.includes('contract') ||
          lower.includes('temporary')
        ) {
          result.contractType = 'CDD';
        } else if (lower.includes('intern') || lower.includes('stage')) {
          result.contractType = 'Stage';
        } else if (lower.includes('freelance')) {
          result.contractType = 'Freelance';
        }

        // Remote type detection
        if (lower.includes('remote') || lower.includes('télétravail')) {
          if (lower.includes('hybrid') || lower.includes('hybride')) {
            result.remoteType = 'hybrid';
          } else {
            result.remoteType = 'remote';
          }
        } else if (lower.includes('on-site') || lower.includes('sur site')) {
          result.remoteType = 'onsite';
        }

        // Experience level
        if (lower.includes('entry') || lower.includes('junior') || lower.includes('débutant')) {
          result.experience = 'Junior (0-2 ans)';
        } else if (lower.includes('mid-senior') || lower.includes('confirmé')) {
          result.experience = 'Confirmé (3-5 ans)';
        } else if (lower.includes('senior') || lower.includes('expert')) {
          result.experience = 'Senior (5+ ans)';
        }
      });
    }

    return result;
  }

  private extractSkills(doc: Document): string[] | undefined {
    const skills: string[] = [];

    // LinkedIn sometimes shows skills in a dedicated section
    const skillSelectors = [
      '.job-details-skill-match-modal__skill-name',
      '.job-details-how-you-match__skills-item',
      '[class*="skill-match"] span',
    ];

    for (const selector of skillSelectors) {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = cleanText(el.textContent);
        if (text && text.length > 1 && text.length < 50) {
          skills.push(text);
        }
      });
    }

    return skills.length > 0 ? [...new Set(skills)] : undefined;
  }

  private extractPostedDate(doc: Document): string | undefined {
    const selectors = [
      '.posted-time-ago__text',
      '.jobs-unified-top-card__posted-date',
      '[class*="posted-date"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text) {
          // Convert relative time to approximate date
          return this.parseRelativeDate(text);
        }
      }
    }

    return undefined;
  }

  private parseRelativeDate(text: string): string {
    const now = new Date();
    const lower = text.toLowerCase();

    // Match patterns like "2 weeks ago", "il y a 3 jours"
    const match = lower.match(/(\d+)\s*(hour|day|week|month|jour|semaine|mois|heure)/);
    if (match) {
      const num = parseInt(match[1]!, 10);
      const unit = match[2]!;

      if (unit.includes('hour') || unit.includes('heure')) {
        now.setHours(now.getHours() - num);
      } else if (unit.includes('day') || unit.includes('jour')) {
        now.setDate(now.getDate() - num);
      } else if (unit.includes('week') || unit.includes('semaine')) {
        now.setDate(now.getDate() - num * 7);
      } else if (unit.includes('month') || unit.includes('mois')) {
        now.setMonth(now.getMonth() - num);
      }
    }

    return now.toISOString().split('T')[0]!;
  }

  private calculateConfidence(offer: Partial<JobOffer>): number {
    let score = 0.5; // Base score for LinkedIn (trusted source)

    if (offer.title) score += 0.15;
    if (offer.company) score += 0.1;
    if (offer.description && offer.description.length > 200) score += 0.15;
    if (offer.location) score += 0.05;
    if (offer.skills && offer.skills.length > 0) score += 0.05;

    return Math.min(score, 1);
  }
}

export const linkedInExtractor = new LinkedInExtractor();
