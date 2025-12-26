/**
 * Welcome to the Jungle extractor
 * Specialized extractor for welcometothejungle.com pages
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

export class WelcomeToTheJungleExtractor implements Extractor {
  name = 'welcometothejungle';
  domains = ['welcometothejungle.com', 'www.welcometothejungle.com'];
  priority = 10;

  canHandle(url: string): boolean {
    const domain = getDomain(url);
    return this.domains.some((d) => domain.includes('welcometothejungle'));
  }

  async extract(url: string, doc: Document): Promise<ExtractionResult> {
    const offer: Partial<JobOffer> = {
      sourceUrl: url,
      sourceDomain: 'welcometothejungle.com',
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

    // Extract job metadata
    const metadata = this.extractMetadata(doc);
    offer.contractType = metadata.contractType;
    offer.salary = metadata.salary;
    offer.experience = metadata.experience;
    offer.remoteType = metadata.remoteType ?? detectRemoteType(offer.description);

    // Extract skills
    offer.skills = this.extractSkills(doc) ?? extractSkillsFromText(offer.description);

    // Calculate confidence
    const confidence = this.calculateConfidence(offer);

    return createSuccessResult(this.name, offer, confidence);
  }

  private extractTitle(doc: Document): string | undefined {
    const selectors = [
      'h1[class*="JobHeader"]',
      '[data-testid="job-header-title"]',
      'h1[class*="sc-"]', // Styled-components class
      'header h1',
      'h1',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = cleanText(element.textContent);
        if (text && text.length > 2 && text.length < 200) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractCompany(doc: Document): string | undefined {
    const selectors = [
      '[data-testid="job-header-company-name"]',
      '[class*="CompanyName"]',
      'a[href*="/companies/"]',
      'header a[class*="sc-"]',
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
      '[data-testid="job-header-location"]',
      '[class*="Location"]',
      'header [class*="sc-"] span',
    ];

    for (const selector of selectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = cleanText(element.textContent);
        // Look for location-like patterns
        if (
          text &&
          (text.includes(',') ||
            text.includes('Paris') ||
            text.includes('Lyon') ||
            text.includes('France') ||
            text.match(/^\d{5}/)) // French postal code
        ) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractDescription(doc: Document): string | undefined {
    const selectors = [
      '[data-testid="job-section-description"]',
      '[class*="JobDescription"]',
      '[class*="sc-"] div[class*="sc-"] p',
      'article',
      'main section',
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

    // Try to combine multiple sections
    const sections = doc.querySelectorAll('[data-testid^="job-section-"]');
    if (sections.length > 0) {
      const combinedMarkdown = Array.from(sections)
        .map((s) => htmlToMarkdown(s.innerHTML))
        .filter((t) => t && t.length > 20)
        .join('\n\n');

      if (combinedMarkdown.length > 100) {
        return combinedMarkdown;
      }
    }

    return undefined;
  }

  private extractMetadata(doc: Document): {
    contractType?: string;
    salary?: JobOffer['salary'];
    experience?: string;
    remoteType?: JobOffer['remoteType'];
  } {
    const result: {
      contractType?: string;
      salary?: JobOffer['salary'];
      experience?: string;
      remoteType?: JobOffer['remoteType'];
    } = {};

    // WTTJ uses info items in the job header
    const infoSelectors = [
      '[data-testid*="job-info"]',
      '[class*="JobInfo"]',
      'header ul li',
      'header div[class*="sc-"]',
    ];

    const allText: string[] = [];

    for (const selector of infoSelectors) {
      const items = doc.querySelectorAll(selector);
      items.forEach((item) => {
        const text = cleanText(item.textContent);
        if (text) {
          allText.push(text);
        }
      });
    }

    // Analyze collected text
    for (const text of allText) {
      const lower = text.toLowerCase();

      // Contract type
      if (lower.includes('cdi')) {
        result.contractType = 'CDI';
      } else if (lower.includes('cdd')) {
        result.contractType = 'CDD';
      } else if (lower.includes('stage')) {
        result.contractType = 'Stage';
      } else if (lower.includes('alternance') || lower.includes('apprentissage')) {
        result.contractType = 'Alternance';
      } else if (lower.includes('freelance') || lower.includes('indépendant')) {
        result.contractType = 'Freelance';
      }

      // Salary
      if (lower.includes('€') || lower.includes('eur') || lower.match(/\d+k/)) {
        const salary = parseSalary(text);
        if (salary) {
          result.salary = salary;
        }
      }

      // Experience
      if (lower.match(/\d+\s*(an|année|year)/)) {
        const match = lower.match(/(\d+)\s*(an|année|year)/);
        if (match) {
          const years = parseInt(match[1]!, 10);
          if (years <= 2) {
            result.experience = 'Junior (0-2 ans)';
          } else if (years <= 5) {
            result.experience = 'Confirmé (3-5 ans)';
          } else {
            result.experience = 'Senior (5+ ans)';
          }
        }
      }

      // Remote type
      if (lower.includes('télétravail') || lower.includes('remote')) {
        if (lower.includes('100%') || lower.includes('full')) {
          result.remoteType = 'remote';
        } else if (lower.includes('partiel') || lower.includes('hybride') || lower.includes('jour')) {
          result.remoteType = 'hybrid';
        } else {
          result.remoteType = 'hybrid'; // Default for WTTJ remote mentions
        }
      } else if (lower.includes('présentiel') || lower.includes('sur site')) {
        result.remoteType = 'onsite';
      }
    }

    return result;
  }

  private extractSkills(doc: Document): string[] | undefined {
    const skills: string[] = [];

    // WTTJ has a skills/stack section
    const skillSelectors = [
      '[data-testid="job-section-stack"] li',
      '[data-testid="job-section-skills"] li',
      '[class*="TechStack"] span',
      '[class*="Skill"]',
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

  private calculateConfidence(offer: Partial<JobOffer>): number {
    let score = 0.6; // Higher base score for WTTJ (well-structured data)

    if (offer.title) score += 0.1;
    if (offer.company) score += 0.1;
    if (offer.description && offer.description.length > 200) score += 0.1;
    if (offer.location) score += 0.05;
    if (offer.skills && offer.skills.length > 0) score += 0.05;

    return Math.min(score, 1);
  }
}

export const welcomeToTheJungleExtractor = new WelcomeToTheJungleExtractor();
