import { useState } from 'react';
import type { Deal, DealAnalysis, MemoSection } from '../types';
import { MEMO_SECTIONS } from '../types';
import { FileDown, X, CheckSquare, Square } from 'lucide-react';

interface Props {
  deal: Deal;
  analysis: DealAnalysis;
  onClose: () => void;
}

export default function ICMemoExport({ deal, analysis, onClose }: Props) {
  const [sections, setSections] = useState<MemoSection[]>(
    MEMO_SECTIONS.map((s) => ({ ...s }))
  );

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const enabledCount = sections.filter((s) => s.enabled).length;

  const toggleAll = () => {
    const allEnabled = enabledCount === sections.length;
    setSections((prev) => prev.map((s) => ({ ...s, enabled: !allEnabled })));
  };

  // ── Helpers ─────────────────────────────────────────────────────

  const pad = (str: string, len: number, ch = ' '): string => {
    while (str.length < len) str += ch;
    return str;
  };

  const repeat = (ch: string, count: number): string => {
    let out = '';
    for (let i = 0; i < count; i++) out += ch;
    return out;
  };

  // ── Plain-text document builders ──────────────────────────────

  const divider = () => repeat('=', 72);
  const subDivider = () => repeat('-', 48);

  const buildHeader = (): string => {
    const lines: string[] = [];
    lines.push(divider());
    lines.push('CONFIDENTIAL -- Investment Committee Memorandum');
    lines.push(divider());
    lines.push('');
    lines.push(`Deal:       ${deal.name}`);
    lines.push(`Company:    ${deal.company}`);
    lines.push(`Industry:   ${deal.industry}`);
    lines.push(`Deal Size:  ${deal.dealSize}`);
    lines.push(`Geography:  ${deal.geography}`);
    lines.push(`Stage:      ${deal.stage.replace(/_/g, ' ').toUpperCase()}`);
    lines.push(`Date:       ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');
    lines.push(divider());
    return lines.join('\n');
  };

  const buildSummary = (): string => {
    const { summary } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('EXECUTIVE SUMMARY');
    lines.push(subDivider());
    lines.push('');
    lines.push(`Headline:     ${summary.headline}`);
    lines.push('');
    lines.push('Overview:');
    lines.push(summary.overview);
    lines.push('');
    lines.push('Industry:');
    lines.push(summary.industry);
    lines.push('');
    lines.push('Market:');
    lines.push(summary.market);
    lines.push('');
    lines.push('Competition:');
    lines.push(summary.competition);
    lines.push('');
    lines.push('Positioning:');
    lines.push(summary.positioning);
    lines.push('');
    lines.push('Key Thesis:');
    lines.push(summary.keyThesis);
    return lines.join('\n');
  };

  const buildScore = (): string => {
    const { cockpit } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('DEAL SCORE & RATING');
    lines.push(subDivider());
    lines.push('');
    lines.push(`Overall Score:  ${cockpit.overallScore}/100`);
    lines.push(`Rating:         ${cockpit.overallRating}`);
    lines.push(`Risk Level:     ${cockpit.riskLevel.toUpperCase()}`);
    lines.push('');
    // Use businessSummary with fallback to recommendation for backward compat
    const summaryText = cockpit.businessSummary || cockpit.recommendation || 'N/A';
    lines.push('Business Summary:');
    lines.push(summaryText);
    if (cockpit.categoryScores.length > 0) {
      lines.push('');
      lines.push('Category Breakdown:');
      const maxCatLen = Math.max(...cockpit.categoryScores.map((c) => c.category.length));
      for (const cs of cockpit.categoryScores) {
        lines.push(`  ${pad(cs.category, maxCatLen + 2)} ${cs.score}/${cs.maxScore}  ${cs.details}`);
      }
    }
    return lines.join('\n');
  };

  const buildHighlights = (): string => {
    const { cockpit } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('INVESTMENT HIGHLIGHTS');
    lines.push(subDivider());
    lines.push('');
    if (cockpit.investmentHighlights.length === 0) {
      lines.push('  No investment highlights identified.');
    } else {
      cockpit.investmentHighlights.forEach((h, i) => {
        lines.push(`  ${'\u2022'} ${h}`);
      });
    }
    return lines.join('\n');
  };

  const buildRisks = (): string => {
    const { cockpit } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('KEY RISKS');
    lines.push(subDivider());
    lines.push('');
    if (cockpit.keyRisks.length === 0) {
      lines.push('  No key risks identified.');
    } else {
      cockpit.keyRisks.forEach((r) => {
        lines.push(`  ${'\u2022'} ${r}`);
      });
    }
    return lines.join('\n');
  };

  const buildPlaybook = (): string => {
    const { playbook } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('DD PLAYBOOK FINDINGS');
    lines.push(subDivider());

    for (const category of playbook) {
      lines.push('');
      lines.push(`  [${category.category.toUpperCase()}]`);
      lines.push(`  ${category.description}`);
      lines.push('');

      if (category.metrics.length === 0) {
        lines.push('    No metrics in this category.');
        continue;
      }

      // Build a padded table
      const colName = 'Metric';
      const colExpected = 'Expected';
      const colActual = 'Actual';
      const colStatus = 'Status';

      const nameW = Math.max(colName.length, ...category.metrics.map((m) => m.name.length));
      const expW = Math.max(colExpected.length, ...category.metrics.map((m) => m.expected.length));
      const actW = Math.max(colActual.length, ...category.metrics.map((m) => (m.actual || 'N/A').length));
      const staW = Math.max(colStatus.length, ...category.metrics.map((m) => m.status.length));

      const header = `    ${pad(colName, nameW)}  ${pad(colExpected, expW)}  ${pad(colActual, actW)}  ${pad(colStatus, staW)}`;
      const sep = `    ${repeat('-', nameW)}  ${repeat('-', expW)}  ${repeat('-', actW)}  ${repeat('-', staW)}`;

      lines.push(header);
      lines.push(sep);

      for (const m of category.metrics) {
        const actual = m.actual || 'N/A';
        lines.push(
          `    ${pad(m.name, nameW)}  ${pad(m.expected, expW)}  ${pad(actual, actW)}  ${pad(String(m.status), staW)}`
        );
      }
    }
    return lines.join('\n');
  };

  const buildKPIs = (): string => {
    const { cockpit } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('KPI TABLE WITH BENCHMARKS');
    lines.push(subDivider());
    lines.push('');

    if (cockpit.kpis.length === 0) {
      lines.push('  No KPIs available.');
      return lines.join('\n');
    }

    const colName = 'KPI';
    const colValue = 'Value';
    const colUnit = 'Unit';
    const colBench = 'Benchmark';
    const colStatus = 'Status';

    const nameW = Math.max(colName.length, ...cockpit.kpis.map((k) => k.name.length));
    const valW = Math.max(colValue.length, ...cockpit.kpis.map((k) => k.value.length));
    const unitW = Math.max(colUnit.length, ...cockpit.kpis.map((k) => k.unit.length));
    const benchW = Math.max(colBench.length, ...cockpit.kpis.map((k) => k.benchmark.length));
    const staW = Math.max(colStatus.length, ...cockpit.kpis.map((k) => k.status.length));

    const header = `  ${pad(colName, nameW)}  ${pad(colValue, valW)}  ${pad(colUnit, unitW)}  ${pad(colBench, benchW)}  ${pad(colStatus, staW)}`;
    const sep = `  ${repeat('-', nameW)}  ${repeat('-', valW)}  ${repeat('-', unitW)}  ${repeat('-', benchW)}  ${repeat('-', staW)}`;

    lines.push(header);
    lines.push(sep);

    for (const k of cockpit.kpis) {
      lines.push(
        `  ${pad(k.name, nameW)}  ${pad(k.value, valW)}  ${pad(k.unit, unitW)}  ${pad(k.benchmark, benchW)}  ${pad(String(k.status), staW)}`
      );
    }
    return lines.join('\n');
  };

  const buildSignals = (): string => {
    const { signals } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('SIGNALS & RED FLAGS');
    lines.push(subDivider());

    const signalGroups: { key: keyof typeof signals; label: string }[] = [
      { key: 'buyingSignals', label: 'Buying Signals' },
      { key: 'redFlags', label: 'Red Flags' },
      { key: 'inconsistencies', label: 'Inconsistencies' },
      { key: 'dataGaps', label: 'Data Gaps' },
    ];

    for (const group of signalGroups) {
      const items = signals[group.key];
      lines.push('');
      lines.push(`  [${group.label.toUpperCase()}] (${items.length})`);

      if (items.length === 0) {
        lines.push('    None identified.');
        continue;
      }

      for (const sig of items) {
        lines.push('');
        lines.push(`    ${'\u2022'} ${sig.title}  [${sig.severity.toUpperCase()}]`);
        lines.push(`      ${sig.description}`);
        if (sig.evidence) {
          lines.push(`      Evidence: ${sig.evidence}`);
        }
        if (sig.suggestedAction) {
          lines.push(`      Suggested Action: ${sig.suggestedAction}`);
        }
      }
    }
    return lines.join('\n');
  };

  const buildNextSteps = (): string => {
    const { cockpit } = analysis;
    const lines: string[] = [];
    lines.push('');
    lines.push('RECOMMENDED NEXT STEPS');
    lines.push(subDivider());
    lines.push('');
    if (cockpit.nextSteps.length === 0) {
      lines.push('  No next steps recommended.');
    } else {
      cockpit.nextSteps.forEach((step, i) => {
        lines.push(`  ${i + 1}. ${step}`);
      });
    }
    return lines.join('\n');
  };

  // ── Section builder map ───────────────────────────────────────

  const sectionBuilders: Record<string, () => string> = {
    summary: buildSummary,
    score: buildScore,
    highlights: buildHighlights,
    risks: buildRisks,
    playbook: buildPlaybook,
    kpis: buildKPIs,
    signals: buildSignals,
    nextsteps: buildNextSteps,
  };

  // ── Generate & download ───────────────────────────────────────

  const handleGenerate = () => {
    const parts: string[] = [buildHeader()];

    for (const section of sections) {
      if (section.enabled && sectionBuilders[section.id]) {
        parts.push(sectionBuilders[section.id]());
      }
    }

    // Footer
    parts.push('');
    parts.push('');
    parts.push(divider());
    parts.push('END OF MEMORANDUM');
    parts.push(divider());
    parts.push('');
    parts.push(`Generated: ${new Date().toISOString()}`);
    parts.push('This document is confidential and intended for internal use only.');

    const content = parts.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `IC_Memo_${deal.company.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClose();
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg mx-4 bg-white border border-[#eaeaea] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#eaeaea]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#0f477b]/8">
              <FileDown className="w-5 h-5 text-[#0f477b]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#171717]">
                Generate IC Memo
              </h2>
              <p className="text-xs text-[#666666]">
                {deal.company} &mdash; {deal.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#666666] hover:text-[#171717] hover:bg-[#f5f5f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section list */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#666666]">
              Select sections to include:
            </p>
            <button
              onClick={toggleAll}
              className="text-xs text-[#0f477b] hover:text-[#1a5c9e] transition-colors"
            >
              {enabledCount === sections.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => toggleSection(section.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition-colors duration-150
                  ${
                    section.enabled
                      ? 'bg-[#0f477b]/8 text-[#171717]'
                      : 'bg-transparent text-[#666666] hover:bg-[#f5f5f5]'
                  }
                `}
              >
                {section.enabled ? (
                  <CheckSquare className="w-4 h-4 text-[#0f477b] flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-[#a1a1a1] flex-shrink-0" />
                )}
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer / actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#eaeaea]">
          <p className="text-xs text-[#888888]">
            {enabledCount} of {sections.length} sections selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#666666] hover:text-[#171717] rounded-lg hover:bg-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={enabledCount === 0}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                transition-all duration-150
                ${
                  enabledCount > 0
                    ? 'bg-[#0f477b] hover:bg-[#1a5c9e] text-white shadow-lg shadow-[#0f477b]/15'
                    : 'bg-[#fafafa] text-[#a1a1a1] border border-[#eaeaea] cursor-not-allowed'
                }
              `}
            >
              <FileDown className="w-4 h-4" />
              Generate & Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
