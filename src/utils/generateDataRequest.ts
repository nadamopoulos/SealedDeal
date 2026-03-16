import type { PlaybookCategory, PlaybookMetric } from '../types';

/**
 * Generates a professional Markdown data request document from all
 * Missing + Partial metrics in the DD Playbook.
 */
export function generateDataRequest(
  dealName: string,
  company: string,
  playbook: PlaybookCategory[]
): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [];

  lines.push(`# ${dealName} — Supplemental Data Request`);
  lines.push('');
  lines.push(`**Date:** ${today}`);
  lines.push(`**Prepared for:** ${company}`);
  lines.push(`**Status:** Draft`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'The following data items are required to complete due diligence. Items are grouped by category and prioritized.'
  );
  lines.push('');

  let globalIndex = 0;

  for (const category of playbook) {
    const actionable = category.metrics.filter(
      (m) => m.status === 'missing' || m.status === 'partial'
    );

    if (actionable.length === 0) continue;

    lines.push(`## ${category.category}`);
    lines.push('');
    lines.push(
      '| # | Metric | Description | Current Status | Preferred Format | Priority |'
    );
    lines.push(
      '|---|--------|-------------|----------------|-----------------|----------|'
    );

    for (const metric of actionable) {
      globalIndex++;
      const status = metric.status === 'missing' ? 'Missing' : 'Partial';
      const format = metric.suggestedDocType || 'Spreadsheet or PDF';
      const priority = getPriority(metric);

      lines.push(
        `| ${globalIndex} | ${escapeCell(metric.name)} | ${escapeCell(metric.description)} | ${status} | ${escapeCell(format)} | ${priority} |`
      );
    }

    // Collect notes for metrics in this category
    const withNotes = actionable.filter((m) => m.notes);
    if (withNotes.length > 0) {
      lines.push('');
      lines.push('**Notes:**');
      for (const m of withNotes) {
        lines.push(`- **${m.name}:** ${m.notes}`);
      }
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`**Total items requested:** ${globalIndex}`);
  lines.push('');
  lines.push('**Requested Response Deadline:** _[Please specify]_');
  lines.push('');
  lines.push('**Please send to:** _[Please specify]_');
  lines.push('');

  return lines.join('\n');
}

function getPriority(metric: PlaybookMetric): string {
  if (metric.suggestedDocType) return 'High';
  if (metric.status === 'missing') return 'High';
  return 'Medium';
}

/** Escape pipe characters inside table cells. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
