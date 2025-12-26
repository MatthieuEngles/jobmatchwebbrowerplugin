/**
 * HTML to Markdown converter
 * Converts job description HTML to clean Markdown
 * No external dependencies - pure TypeScript implementation
 */

/**
 * Convert HTML string to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  // Create a temporary element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // Process the DOM tree
  const markdown = processNode(body);

  // Clean up the result
  return cleanMarkdown(markdown);
}

/**
 * Process a DOM node and its children recursively
 */
function processNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes)
    .map(processNode)
    .join('');

  switch (tagName) {
    // Headings
    case 'h1':
      return `\n# ${children.trim()}\n\n`;
    case 'h2':
      return `\n## ${children.trim()}\n\n`;
    case 'h3':
      return `\n### ${children.trim()}\n\n`;
    case 'h4':
      return `\n#### ${children.trim()}\n\n`;
    case 'h5':
      return `\n##### ${children.trim()}\n\n`;
    case 'h6':
      return `\n###### ${children.trim()}\n\n`;

    // Text formatting
    case 'strong':
    case 'b':
      return `**${children.trim()}**`;
    case 'em':
    case 'i':
      return `*${children.trim()}*`;
    case 'u':
      return `_${children.trim()}_`;
    case 's':
    case 'strike':
    case 'del':
      return `~~${children.trim()}~~`;
    case 'code':
      return `\`${children.trim()}\``;

    // Links
    case 'a': {
      const href = element.getAttribute('href');
      if (href && !href.startsWith('javascript:')) {
        return `[${children.trim()}](${href})`;
      }
      return children;
    }

    // Lists
    case 'ul':
      return `\n${processListItems(element, 'ul')}\n`;
    case 'ol':
      return `\n${processListItems(element, 'ol')}\n`;
    case 'li':
      // Handled by processListItems
      return children;

    // Paragraphs and line breaks
    case 'p':
      return `\n${children.trim()}\n\n`;
    case 'br':
      return '\n';
    case 'hr':
      return '\n---\n\n';

    // Block elements
    case 'div':
    case 'section':
    case 'article':
      return `\n${children}\n`;

    // Blockquote
    case 'blockquote':
      return `\n> ${children.trim().split('\n').join('\n> ')}\n\n`;

    // Pre/code blocks
    case 'pre':
      return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;

    // Tables (simplified - convert to text)
    case 'table':
      return `\n${processTable(element)}\n`;
    case 'tr':
    case 'td':
    case 'th':
    case 'thead':
    case 'tbody':
      // Handled by processTable
      return children;

    // Ignore these elements
    case 'script':
    case 'style':
    case 'noscript':
    case 'iframe':
    case 'svg':
    case 'canvas':
      return '';

    // Default: just return children
    default:
      return children;
  }
}

/**
 * Process list items (ul/ol)
 */
function processListItems(listElement: Element, listType: 'ul' | 'ol'): string {
  const items = Array.from(listElement.querySelectorAll(':scope > li'));

  return items.map((item, index) => {
    const prefix = listType === 'ul' ? '-' : `${index + 1}.`;
    const content = processNode(item).trim();

    // Handle nested lists
    const lines = content.split('\n');
    const firstLine = lines[0] ?? '';
    const rest = lines.slice(1).map(line => `  ${line}`).join('\n');

    return `${prefix} ${firstLine}${rest ? '\n' + rest : ''}`;
  }).join('\n');
}

/**
 * Process table to markdown
 */
function processTable(tableElement: Element): string {
  const rows = Array.from(tableElement.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const result: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const cellContents = cells.map(cell => processNode(cell).trim().replace(/\|/g, '\\|'));

    result.push(`| ${cellContents.join(' | ')} |`);

    // Add header separator after first row
    if (rowIndex === 0) {
      result.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  });

  return result.join('\n');
}

/**
 * Clean up the generated markdown
 */
function cleanMarkdown(markdown: string): string {
  return markdown
    // Remove excessive newlines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace on lines
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // Remove leading/trailing whitespace
    .trim()
    // Fix spacing around formatting
    .replace(/\*\*\s+/g, '**')
    .replace(/\s+\*\*/g, '**')
    .replace(/\*\s+/g, '*')
    .replace(/\s+\*/g, '*')
    // Remove empty bold/italic
    .replace(/\*\*\*\*/g, '')
    .replace(/\*\*/g, (match, offset, str) => {
      // Keep ** only if there's content between pairs
      return match;
    })
    // Normalize bullet points
    .replace(/^[\s]*[•●○▪▸►]\s*/gm, '- ')
    // Clean up list formatting
    .replace(/\n- \n/g, '\n');
}

/**
 * Extract text content while preserving some structure
 * Lighter alternative to full markdown conversion
 */
export function htmlToStructuredText(html: string): string {
  if (!html) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // Remove unwanted elements
  body.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());

  // Process text with basic structure preservation
  let text = '';
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  let currentNode: Node | null = walker.currentNode;
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const content = currentNode.textContent?.trim();
      if (content) {
        text += content + ' ';
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as Element;
      const tag = el.tagName.toLowerCase();

      // Add line breaks for block elements
      if (['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'].includes(tag)) {
        text = text.trimEnd() + '\n';
      }

      // Add bullet for list items
      if (tag === 'li') {
        text += '• ';
      }
    }

    currentNode = walker.nextNode();
  }

  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
