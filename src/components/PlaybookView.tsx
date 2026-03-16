import { useState } from 'react';
import type { PlaybookCategory } from '../types';
import { generateDataRequest } from '../utils/generateDataRequest';
import { downloadMarkdown } from '../utils/downloadMarkdown';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  FileText,
  FileDown,
  ClipboardList,
  Loader2,
} from 'lucide-react';

interface Props {
  playbook: PlaybookCategory[];
  dealName?: string;
  company?: string;
  onAskQuestion?: (question: string) => void;
}

const statusConfig = {
  met: { icon: CheckCircle2, color: 'text-[#46a758]', bg: 'bg-[#46a758]/10', label: 'Met' },
  partial: { icon: MinusCircle, color: 'text-[#f5a524]', bg: 'bg-[#f5a524]/10', label: 'Partial' },
  missing: { icon: XCircle, color: 'text-[#888888]', bg: 'bg-[#888888]/10', label: 'Missing' },
  concern: { icon: AlertTriangle, color: 'text-[#e5484d]', bg: 'bg-[#e5484d]/10', label: 'Concern' },
};

function ProgressBar({
  met,
  partial,
  total,
  size = 'default',
}: {
  met: number;
  partial: number;
  total: number;
  size?: 'default' | 'small';
}) {
  if (total === 0) return null;
  const metPct = (met / total) * 100;
  const partialPct = (partial / total) * 100;
  const completePct = Math.round(((met + partial) / total) * 100);
  const barHeight = size === 'small' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${barHeight} bg-[#eaeaea] rounded-full overflow-hidden flex`}>
        {metPct > 0 && (
          <div
            className="bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${metPct}%` }}
          />
        )}
        {partialPct > 0 && (
          <div
            className="bg-yellow-500 transition-all duration-500 ease-out"
            style={{ width: `${partialPct}%` }}
          />
        )}
      </div>
      <span className={`text-xs font-medium tabular-nums ${
        completePct === 100
          ? 'text-[#46a758]'
          : completePct >= 60
            ? 'text-[#f5a524]'
            : 'text-[#666666]'
      }`}>
        {completePct}%
      </span>
    </div>
  );
}

export default function PlaybookView({ playbook, dealName, company }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [isGenerating, setIsGenerating] = useState(false);

  const toggle = (i: number) => {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpanded(next);
  };

  const totals = playbook.reduce(
    (acc, cat) => {
      cat.metrics.forEach((m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        acc.total++;
      });
      return acc;
    },
    { met: 0, partial: 0, missing: 0, concern: 0, total: 0 } as Record<string, number>
  );

  const actionableCount = (totals.missing || 0) + (totals.partial || 0);
  const hasActionableMetrics = actionableCount > 0;

  const handleGenerateDataRequest = async () => {
    setIsGenerating(true);
    // Small delay so the spinner renders before the synchronous work
    await new Promise((r) => setTimeout(r, 50));

    const name = dealName || 'Deal';
    const comp = company || 'Company';
    const md = generateDataRequest(name, comp, playbook);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${name.replace(/\s+/g, '_')}_Data_Request_${dateStr}.md`;
    downloadMarkdown(md, filename);

    setIsGenerating(false);
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Summary Bar */}
      <div className="mb-6 p-4 bg-white border border-[#eaeaea] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
        <div className="flex items-center gap-6">
          <div className="text-sm text-[#666666]">
            <span className="text-[#171717] font-semibold">{totals.total}</span> metrics tracked
          </div>
          <div className="flex-1 flex gap-4">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className="text-xs text-[#666666]">
                  <span className="text-[#171717] font-medium">{totals[key] || 0}</span> {cfg.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Overall Completion Progress Bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#888888] uppercase tracking-wider font-medium">
              Overall Completion
            </span>
            <span className="text-xs text-[#666666]">
              {(totals.met || 0) + (totals.partial || 0)} of {totals.total} metrics addressed
            </span>
          </div>
          <ProgressBar
            met={totals.met || 0}
            partial={totals.partial || 0}
            total={totals.total}
          />
        </div>

        {/* Generate Data Request */}
        <div className="pt-1 flex items-center justify-between">
          <span className="text-xs text-[#888888]">
            {hasActionableMetrics
              ? `${actionableCount} metric${actionableCount !== 1 ? 's' : ''} require additional data`
              : 'All metrics addressed'}
          </span>
          <button
            onClick={handleGenerateDataRequest}
            disabled={!hasActionableMetrics || isGenerating}
            title={!hasActionableMetrics ? 'All metrics addressed' : 'Download a structured data request document'}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-medium transition-all ${
              hasActionableMetrics && !isGenerating
                ? 'bg-[#673ab7] hover:bg-[#5e35a1] text-white shadow-sm'
                : 'bg-[#f5f5f5] text-[#a1a1a1] border border-[#eaeaea] cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                Generate Data Request
              </>
            )}
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {playbook.map((category, i) => {
          const isOpen = expanded.has(i);
          const catTotals = category.metrics.reduce(
            (acc, m) => {
              acc[m.status]++;
              return acc;
            },
            { met: 0, partial: 0, missing: 0, concern: 0 }
          );
          const catTotal = category.metrics.length;

          return (
            <div key={i} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 p-4 hover:bg-[#f5f5f5] transition-colors text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-[#888888]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#888888]" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#171717]">{category.category}</h3>
                  <p className="text-xs text-[#888888] mt-0.5">{category.description}</p>
                  {/* Per-Category Progress Bar */}
                  <div className="mt-2 max-w-xs">
                    <ProgressBar
                      met={catTotals.met}
                      partial={catTotals.partial}
                      total={catTotal}
                      size="small"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {catTotals.concern > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#e5484d]/10 text-[#e5484d] rounded text-xs font-medium">
                      {catTotals.concern} concern{catTotals.concern !== 1 && 's'}
                    </span>
                  )}
                  {catTotals.missing > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#888888]/10 text-[#666666] rounded text-xs font-medium">
                      {catTotals.missing} missing
                    </span>
                  )}
                  <span className="text-xs text-[#888888]">
                    {catTotals.met}/{catTotal}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[#eaeaea]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-[#888888] uppercase tracking-wider">
                          <th className="text-left px-4 py-2 font-medium">Metric</th>
                          <th className="text-left px-4 py-2 font-medium">Expected</th>
                          <th className="text-left px-4 py-2 font-medium">Actual</th>
                          <th className="text-left px-4 py-2 font-medium">Source</th>
                          <th className="text-left px-4 py-2 font-medium w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.metrics.map((metric, j) => {
                          const cfg = statusConfig[metric.status];
                          const showSuggestedDoc =
                            metric.status === 'missing' && metric.suggestedDocType;

                          return (
                            <tr
                              key={j}
                              className="border-t border-[#f0f0f0] hover:bg-[#f5f5f5] transition-colors align-top"
                            >
                              <td className="px-4 py-3">
                                <p className="text-sm text-[#171717] font-medium">{metric.name}</p>
                                <p className="text-xs text-[#888888] mt-0.5">{metric.description}</p>
                                {metric.notes && (
                                  <p className="text-xs text-[#666666] mt-1 italic">{metric.notes}</p>
                                )}
                                {showSuggestedDoc && (
                                  <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                                    <ClipboardList className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                                    <span className="text-xs text-amber-800">
                                      Request: {metric.suggestedDocType}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-[#666666]">{metric.expected}</td>
                              <td className="px-4 py-3 text-sm text-[#171717]">
                                {metric.actual || (
                                  <span className="text-[#a1a1a1] italic">Not found</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {metric.source ? (
                                  <div className="flex items-start gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-[#888888] mt-0.5 shrink-0" />
                                    <span className="text-xs text-[#666666]">
                                      {metric.source}
                                      {metric.pageRef && (
                                        <span className="text-[#888888]">, p.{metric.pageRef}</span>
                                      )}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#a1a1a1] italic">--</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${cfg.bg}`}>
                                  <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
