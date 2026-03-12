import { useState } from 'react';
import type { SignalsAnalysis, Signal } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  FileQuestion,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  FileSearch,
  Info,
  ListChecks,
} from 'lucide-react';

interface Props {
  signals: SignalsAnalysis;
}

const categories = [
  {
    key: 'buyingSignals' as const,
    label: 'Buying Signals',
    description: 'Factors supporting the acquisition',
    icon: TrendingUp,
    color: 'text-[#46a758]',
    bg: 'bg-[#46a758]/10',
    border: 'border-[#46a758]/20',
    badge: 'bg-[#46a758]/20 text-[#46a758]',
  },
  {
    key: 'redFlags' as const,
    label: 'Red Flags',
    description: 'Concerns requiring attention',
    icon: AlertTriangle,
    color: 'text-[#e5484d]',
    bg: 'bg-[#e5484d]/10',
    border: 'border-[#e5484d]/20',
    badge: 'bg-[#e5484d]/20 text-[#e5484d]',
  },
  {
    key: 'inconsistencies' as const,
    label: 'Inconsistencies',
    description: 'Contradictions or oddities in the data',
    icon: HelpCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    badge: 'bg-orange-500/20 text-orange-600',
  },
  {
    key: 'dataGaps' as const,
    label: 'Data Gaps',
    description: 'Missing information that should be requested',
    icon: FileQuestion,
    color: 'text-[#0070f3]',
    bg: 'bg-[#0070f3]/8',
    border: 'border-[#0070f3]/15',
    badge: 'bg-[#0070f3]/20 text-[#0070f3]',
  },
];

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

const severityBadge: Record<string, string> = {
  critical: 'bg-[#e5484d]/10 text-[#e5484d] border-[#e5484d]/20',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-[#666666] border-gray-200',
};

const severityAccentBorder: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-[#a1a1a1]',
};

function formatSource(signal: Signal): string {
  const parts: string[] = [];
  if (signal.source && signal.source !== 'N/A') {
    parts.push(signal.source);
  }
  if (signal.pageRef) {
    parts.push(signal.pageRef);
  }
  return parts.join(', ');
}

export default function SignalsView({ signals }: Props) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {categories.map((cat) => {
          const items = signals[cat.key];
          const critical = items.filter((s) => s.severity === 'critical' || s.severity === 'high').length;
          return (
            <div key={cat.key} className={`p-4 bg-white border ${cat.border} rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}>
              <div className="flex items-center gap-2 mb-2">
                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                <span className="text-xs font-medium text-[#666666]">{cat.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#171717]">{items.length}</p>
              {critical > 0 && (
                <p className="text-xs text-[#e5484d] mt-1">{critical} high/critical priority</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Signal Lists */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const isRedFlags = cat.key === 'redFlags';
          const items = [...signals[cat.key]].sort(
            (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
          );

          return (
            <div key={cat.key}>
              <div className="flex items-center gap-2 mb-3">
                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                <h3 className="text-sm font-semibold text-[#171717]">{cat.label}</h3>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cat.badge}`}>
                  {items.length}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((signal) => {
                  const isExpanded = expandedCard === signal.id;
                  const sourceDisplay = formatSource(signal);

                  // Red flags get a left accent border when expanded
                  const cardClasses = [
                    'bg-white border border-[#eaeaea] rounded-lg overflow-hidden hover:border-[#d4d4d4] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)]',
                    isRedFlags && isExpanded
                      ? `border-l-[3px] ${severityAccentBorder[signal.severity]}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div key={signal.id} className={cardClasses}>
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : signal.id)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#888888] shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#888888] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#171717]">{signal.title}</p>
                          {!isExpanded && (
                            <p className="text-xs text-[#888888] truncate mt-0.5">{signal.description}</p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${
                            severityBadge[signal.severity]
                          }`}
                        >
                          {signal.severity}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[#f0f0f0] space-y-3">
                          {/* Assessment */}
                          <div>
                            <p className="text-xs font-medium text-[#888888] uppercase tracking-wider mb-1">
                              Assessment
                            </p>
                            <p className="text-sm text-[#666666] leading-relaxed">{signal.description}</p>
                          </div>

                          {/* Evidence */}
                          {signal.evidence && (
                            <div>
                              <p className="text-xs font-medium text-[#888888] uppercase tracking-wider mb-1">
                                Evidence
                              </p>
                              <p className="text-sm text-[#666666] leading-relaxed italic">{signal.evidence}</p>
                            </div>
                          )}

                          {/* Reasoning */}
                          {signal.reasoning && (
                            <div className="bg-[#0070f3]/8 border border-[#0070f3]/15 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Info className="w-3.5 h-3.5 text-[#0070f3]" />
                                <p className="text-xs font-medium text-[#0070f3] uppercase tracking-wider">
                                  Reasoning
                                </p>
                              </div>
                              <p className="text-sm text-[#0070f3]/90 leading-relaxed">
                                {signal.reasoning}
                              </p>
                            </div>
                          )}

                          {/* Suggested DD Action */}
                          {signal.suggestedAction && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <ListChecks className="w-3.5 h-3.5 text-amber-700" />
                                <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                                  Suggested DD Action
                                </p>
                              </div>
                              <p className="text-sm text-amber-800 leading-relaxed">
                                {signal.suggestedAction}
                              </p>
                            </div>
                          )}

                          {/* Source & Category metadata */}
                          <div className="flex items-center gap-4 text-xs text-[#888888]">
                            {signal.category && (
                              <span className="px-2 py-0.5 bg-[#fafafa] border border-[#eaeaea] rounded">{signal.category}</span>
                            )}
                            {sourceDisplay && <span>Source: {sourceDisplay}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
