import { useState } from 'react';
import type { DealAnalysis, Deal } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Lightbulb,
  ListChecks,
  Target,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';

interface Props {
  analysis: DealAnalysis;
  deal: Deal;
  onNavigateSignals?: (category?: string) => void;
}

const riskColors = {
  low: { text: 'text-[#46a758]', bg: 'bg-[#46a758]/10', border: 'border-[#46a758]/30' },
  moderate: { text: 'text-[#f5a524]', bg: 'bg-[#f5a524]/10', border: 'border-[#f5a524]/30' },
  high: { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/30' },
  critical: { text: 'text-[#e5484d]', bg: 'bg-[#e5484d]/10', border: 'border-[#e5484d]/30' },
};

const statusBarColors = {
  good: '#46a758',
  warning: '#f5a524',
  critical: '#e5484d',
  neutral: '#888888',
};

// Percentile-aware colors for KPI badges and trends
function getPercentileColor(percentile: number | undefined | null) {
  if (percentile == null) return { badge: 'bg-[#888888]/10 text-[#888888]', text: 'text-[#888888]' };
  if (percentile >= 75) return { badge: 'bg-[#46a758]/12 text-[#46a758]', text: 'text-[#46a758]' };
  if (percentile >= 25) return { badge: 'bg-[#f5a524]/12 text-[#f5a524]', text: 'text-[#f5a524]' };
  return { badge: 'bg-[#e5484d]/12 text-[#e5484d]', text: 'text-[#e5484d]' };
}

function getTrendIcon(trend: string, percentile?: number | null) {
  // Color trend arrows by percentile when available, otherwise by direction
  const pColors = getPercentileColor(percentile);
  if (trend === 'up') return <TrendingUp className={`w-3.5 h-3.5 ${percentile != null ? pColors.text : 'text-[#46a758]'}`} />;
  if (trend === 'down') return <TrendingDown className={`w-3.5 h-3.5 ${percentile != null ? pColors.text : 'text-[#e5484d]'}`} />;
  if (trend === 'stable') return <Minus className="w-3.5 h-3.5 text-[#666666]" />;
  return <Minus className="w-3.5 h-3.5 text-[#a1a1a1]" />;
}

const statusColors = {
  good: 'text-[#46a758]',
  warning: 'text-[#f5a524]',
  critical: 'text-[#e5484d]',
  neutral: 'text-[#666666]',
};

// ---------------------------------------------------------------------------
// Score Timeline Sparkline (SVG)
// ---------------------------------------------------------------------------
function ScoreSparkline({ history }: { history: Deal['scoreHistory'] }) {
  if (!history || history.length < 2) return null;

  const width = 140;
  const height = 36;
  const padX = 4;
  const padY = 6;

  const scores = history.map((h) => h.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const points = history.map((h, i) => {
    const x = padX + (i / (history.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (h.score - minScore) / range) * (height - padY * 2);
    return `${x},${y}`;
  });

  const lastPt = history[history.length - 1];
  const prevPt = history[history.length - 2];
  const delta = lastPt.score - prevPt.score;
  const lastX = padX + ((history.length - 1) / (history.length - 1)) * (width - padX * 2);
  const lastY = padY + (1 - (lastPt.score - minScore) / range) * (height - padY * 2);

  const lineColor = delta >= 0 ? '#46a758' : '#e5484d';

  const areaPoints = [
    `${padX},${height - padY}`,
    ...points,
    `${lastX},${height - padY}`,
  ].join(' ');

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="shrink-0">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#sparkFill)" />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r={3} fill={lineColor} />
      </svg>
      <div className="text-right shrink-0">
        <span className={`text-xs font-semibold ${delta >= 0 ? 'text-[#46a758]' : 'text-[#e5484d]'}`}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
        <p className="text-[10px] text-[#a1a1a1]">{history.length} runs</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Benchmark Bar
// ---------------------------------------------------------------------------
function BenchmarkBar({
  value,
  low,
  high,
  status,
}: {
  value: string;
  low: number;
  high: number;
  status: string;
}) {
  const numericValue = parseFloat(value.replace(/[^0-9.\-]/g, ''));
  if (isNaN(numericValue)) return null;

  const range = high - low || 1;
  const pct = Math.max(0, Math.min(100, ((numericValue - low) / range) * 100));
  const barColor = statusBarColors[status as keyof typeof statusBarColors] || statusBarColors.neutral;

  return (
    <div className="mt-2">
      <div className="relative h-1.5 bg-[#eaeaea] rounded-full overflow-hidden">
        <div className="absolute inset-0 rounded-full" />
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.4 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white transition-all duration-500"
          style={{ left: `calc(${pct}% - 5px)`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-[#a1a1a1]">{low}</span>
        <span className="text-[9px] text-[#a1a1a1]">{high}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function DealCockpit({ analysis, deal, onNavigateSignals }: Props) {
  const { cockpit, signals } = analysis;
  const risk = riskColors[cockpit.riskLevel];
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Bar chart data (removed radar chart - redundant)
  const barData = cockpit.categoryScores.map((cs) => ({
    name: cs.category.length > 18 ? cs.category.slice(0, 18) + '...' : cs.category,
    fullName: cs.category,
    score: cs.score,
    max: cs.maxScore,
    color: cs.color,
  }));

  // Deal Rating score ring
  const scorePercent = cockpit.overallScore;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (scorePercent / 100) * circumference;
  const scoreColor =
    scorePercent >= 70 ? '#46a758' : scorePercent >= 50 ? '#f5a524' : '#e5484d';

  const summaryText = cockpit.businessSummary || cockpit.recommendation || 'N/A';

  // Signal counts
  const signalCounts = [
    { key: 'buyingSignals', label: 'Buy Signals', count: signals.buyingSignals.length, color: '#46a758', icon: TrendingUp },
    { key: 'redFlags', label: 'Red Flags', count: signals.redFlags.length, color: '#e5484d', icon: AlertTriangle },
    { key: 'inconsistencies', label: 'Oddities', count: signals.inconsistencies.length, color: '#f97316', icon: AlertCircle },
    { key: 'dataGaps', label: 'Data Gaps', count: signals.dataGaps.length, color: '#0070f3', icon: FileQuestion },
  ];

  const totalSignals = signalCounts.reduce((sum, s) => sum + s.count, 0);
  const criticalCount = [...signals.redFlags, ...signals.inconsistencies].filter(
    (s) => s.severity === 'critical' || s.severity === 'high'
  ).length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-5">

      {/* ===== ROW 1: Signals (Hero) + Deal Rating + Risk Level ===== */}
      <div className="grid grid-cols-12 gap-4">

        {/* Signal Count — PRIMARY above-the-fold element */}
        <div className="col-span-12 md:col-span-6 bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0f477b]" />
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Signal Overview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#171717]">{totalSignals}</span>
              <span className="text-xs text-[#888888]">total signals</span>
              {criticalCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#e5484d]/10 text-[#e5484d] rounded text-[10px] font-semibold">
                  {criticalCount} high priority
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {signalCounts.map((signal) => (
              <button
                key={signal.key}
                onClick={() => onNavigateSignals?.(signal.key)}
                className="group flex flex-col items-center p-3 rounded-xl border border-[#eaeaea] hover:border-[#d4d4d4] hover:bg-[#fafafa] transition-all cursor-pointer"
              >
                <signal.icon className="w-4 h-4 mb-1.5" style={{ color: signal.color }} />
                <span className="text-2xl font-bold text-[#171717]">{signal.count}</span>
                <span className="text-[10px] text-[#888888] font-medium mt-0.5">{signal.label}</span>
                <ArrowRight className="w-3 h-3 text-[#a1a1a1] opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Deal Rating Score */}
        <div className="col-span-6 md:col-span-3 bg-white border border-[#eaeaea] rounded-2xl p-5 flex flex-col items-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-3">
            Deal Rating
          </p>
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#eaeaea" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={scoreColor} strokeWidth="8"
                className="score-ring"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#171717]">{cockpit.overallScore}</span>
              <span className="text-[9px] text-[#888888]">/100</span>
            </div>
          </div>
          {deal.scoreHistory && deal.scoreHistory.length > 1 && (
            <div className="mt-3 pt-3 border-t border-[#eaeaea] w-full">
              <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3" /> History
              </p>
              <ScoreSparkline history={deal.scoreHistory} />
            </div>
          )}
        </div>

        {/* Risk Level */}
        <div className="col-span-6 md:col-span-3 flex flex-col gap-3">
          <div className={`${risk.bg} border ${risk.border} rounded-2xl p-4 flex-1`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className={`w-4 h-4 ${risk.text}`} />
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Risk Level
              </p>
            </div>
            <p className={`text-lg font-bold ${risk.text} capitalize`}>{cockpit.riskLevel}</p>
          </div>

          {/* Quick highlights/risks count */}
          <div className="bg-white border border-[#eaeaea] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#666666] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[#46a758]" /> Highlights
                </span>
                <span className="text-sm font-bold text-[#46a758]">{cockpit.investmentHighlights.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#666666] flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-[#e5484d]" /> Key Risks
                </span>
                <span className="text-sm font-bold text-[#e5484d]">{cockpit.keyRisks.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ROW 2: Next Steps (Elevated) + Compressed Summary ===== */}
      <div className="grid grid-cols-12 gap-4">

        {/* Recommended Next Steps — Elevated to prominent position */}
        {cockpit.nextSteps?.length > 0 && (
          <div className="col-span-12 md:col-span-7 bg-gradient-to-br from-[#0f477b]/[0.03] to-white border border-[#0f477b]/15 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-[#0f477b]" />
              <h3 className="text-sm font-semibold text-[#171717]">Recommended Next Steps</h3>
            </div>
            <div className="space-y-2">
              {cockpit.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 bg-white/80 rounded-lg border border-[#eaeaea]">
                  <span className="w-5 h-5 rounded-full bg-[#0f477b]/12 text-[#0f477b] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#666666] leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compressed Business Summary + Highlights/Risks */}
        <div className={`${cockpit.nextSteps?.length > 0 ? 'col-span-12 md:col-span-5' : 'col-span-12'} bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#0f477b]" />
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Business Summary
              </p>
            </div>
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="text-xs text-[#0f477b] hover:text-[#1a5c9e] flex items-center gap-0.5 transition-colors"
            >
              {summaryExpanded ? 'Collapse' : 'Expand'}
              {summaryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          <p className={`text-sm text-[#171717] leading-relaxed ${summaryExpanded ? '' : 'line-clamp-2'}`}>
            {summaryText}
          </p>

          {/* Highlights & Risks below summary */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#eaeaea]">
            <div>
              <p className="text-xs font-medium text-[#46a758] mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Highlights
              </p>
              <ul className="space-y-1">
                {cockpit.investmentHighlights.slice(0, 3).map((h, i) => (
                  <li
                    key={i}
                    className="text-xs text-[#666666] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#46a758]/50"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-[#e5484d] mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Key Risks
              </p>
              <ul className="space-y-1">
                {cockpit.keyRisks.slice(0, 3).map((r, i) => (
                  <li
                    key={i}
                    className="text-xs text-[#666666] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#e5484d]/50"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ROW 3: KPIs with severity-aware percentile badges ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#0f477b]" />
          <h3 className="text-sm font-semibold text-[#171717]">Key Performance Indicators</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cockpit.kpis.map((kpi, i) => {
            const pColor = getPercentileColor(kpi.percentile);
            return (
              <div
                key={i}
                className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:border-[#d4d4d4] transition-colors group shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
              >
                {/* Header: name + trend + percentile */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="text-xs text-[#888888] font-medium truncate">{kpi.name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {kpi.percentile != null && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${pColor.badge}`}>
                        {kpi.percentile}th %ile
                      </span>
                    )}
                    {getTrendIcon(kpi.trend, kpi.percentile)}
                  </div>
                </div>

                {/* Value */}
                <p className={`text-xl font-bold ${statusColors[kpi.status]}`}>
                  {kpi.value}
                  {kpi.unit && (
                    <span className="text-sm font-normal text-[#888888] ml-1">{kpi.unit}</span>
                  )}
                </p>

                {/* Benchmark text */}
                {kpi.benchmark && (
                  <p className="text-[10px] text-[#a1a1a1] mt-1">Benchmark: {kpi.benchmark}</p>
                )}

                {/* Benchmark bar visualization */}
                {kpi.benchmarkLow != null && kpi.benchmarkHigh != null && (
                  <BenchmarkBar
                    value={kpi.value}
                    low={kpi.benchmarkLow}
                    high={kpi.benchmarkHigh}
                    status={kpi.status}
                  />
                )}

                {/* AI Commentary */}
                {kpi.commentary && (
                  <p className="text-[10px] text-[#888888] mt-2 italic leading-relaxed border-t border-[#eaeaea] pt-2">
                    {kpi.commentary}
                  </p>
                )}

                {/* Source reference */}
                {kpi.source && (
                  <p className="text-[9px] text-[#a1a1a1] mt-1.5 flex items-center gap-1">
                    <FileText className="w-2.5 h-2.5" />
                    {kpi.source}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== ROW 4: Score Breakdown Bar Chart (radar removed — redundant) ===== */}
      <div className="bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-semibold text-[#171717] mb-4">Category Score Breakdown</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, barData.length * 32)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#888888', fontSize: 10 }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fill: '#666666', fontSize: 11 }}
              width={140}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #eaeaea',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: '#171717' }}
              itemStyle={{ color: '#666666' }}
              formatter={(value: any, _name: any, props: any) => [
                `${value} / ${props.payload.max}`,
                props.payload.fullName,
              ]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ===== Footer ===== */}
      <div className="text-center py-3">
        <p className="text-xs text-[#a1a1a1]">
          Analysis generated {new Date(analysis.analyzedAt).toLocaleString()} &middot; Powered by
          Claude AI
        </p>
      </div>
    </div>
  );
}
