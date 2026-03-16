import { useState } from 'react';
import type { DealAnalysis, Deal, KPI } from '../types';
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
  ListChecks,
  Target,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowRight,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import MetricDrillPanel from './MetricDrillPanel';

interface Props {
  analysis: DealAnalysis;
  deal: Deal;
  onNavigateSignals?: (category?: string) => void;
  onAskQuestion?: (question: string) => void;
}

// Talonic functional colors (desaturated, professional)
const DS = {
  green: '#4A9E8E',
  greenDark: '#3D8578',
  amber: '#B8914A',
  amberDark: '#9A7A3E',
  red: '#C45B5B',
  redDark: '#A84C4C',
  purple: '#673ab7',
  black: '#0a0a0a',
  gray700: '#404040',
  gray600: '#525252',
  gray500: '#737373',
  gray400: '#a3a3a3',
  gray300: '#d4d4d4',
  gray200: '#e5e5e5',
  gray100: '#f5f5f5',
};

const riskConfig: Record<string, { color: string; borderColor: string }> = {
  low: { color: DS.green, borderColor: DS.green },
  moderate: { color: DS.amber, borderColor: DS.amber },
  high: { color: DS.red, borderColor: DS.red },
  critical: { color: DS.redDark, borderColor: DS.redDark },
};

// Percentile → desaturated color
function getPercentileColor(percentile: number | undefined | null) {
  if (percentile == null) return { dot: DS.gray400, text: DS.gray600 };
  if (percentile >= 75) return { dot: DS.green, text: DS.greenDark };
  if (percentile >= 25) return { dot: DS.amber, text: DS.amberDark };
  return { dot: DS.red, text: DS.redDark };
}

function getTrendIcon(trend: string, percentile?: number | null) {
  const pc = getPercentileColor(percentile);
  const color = percentile != null ? pc.text : trend === 'up' ? DS.greenDark : trend === 'down' ? DS.redDark : DS.gray500;
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5" style={{ color }} />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5" style={{ color }} />;
  if (trend === 'stable') return <Minus className="w-3.5 h-3.5" style={{ color: DS.gray500 }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: DS.gray400 }} />;
}

function getKpiValueColor(status: string) {
  if (status === 'good') return DS.greenDark;
  if (status === 'warning') return DS.amberDark;
  if (status === 'critical') return DS.redDark;
  return DS.gray700;
}

function getKpiBarColor(status: string) {
  if (status === 'good') return DS.green;
  if (status === 'warning') return DS.amber;
  if (status === 'critical') return DS.red;
  return DS.gray400;
}

// ---------------------------------------------------------------------------
// Score Timeline Sparkline
// ---------------------------------------------------------------------------
function ScoreSparkline({ history }: { history: Deal['scoreHistory'] }) {
  if (!history || history.length < 2) return null;

  const width = 120;
  const height = 32;
  const padX = 4;
  const padY = 4;

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
  const lastX = padX + 1 * (width - padX * 2);
  const lastY = padY + (1 - (lastPt.score - minScore) / range) * (height - padY * 2);
  const lineColor = delta >= 0 ? DS.green : DS.red;

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="shrink-0">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r={2.5} fill={lineColor} />
      </svg>
      <div className="text-right shrink-0">
        <span className="font-mono text-[12px] font-500" style={{ color: delta >= 0 ? DS.greenDark : DS.redDark }}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
        <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>{history.length} runs</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Benchmark Bar
// ---------------------------------------------------------------------------
function BenchmarkBar({ value, low, high, status }: { value: string; low: number; high: number; status: string }) {
  const numericValue = parseFloat(value.replace(/[^0-9.\-]/g, ''));
  if (isNaN(numericValue)) return null;

  const range = high - low || 1;
  const pct = Math.max(0, Math.min(100, ((numericValue - low) / range) * 100));
  const barColor = getKpiBarColor(status);

  return (
    <div className="mt-2">
      <div className="relative h-[6px] rounded-[3px] overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="absolute top-0 h-full rounded-[3px] transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.35 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white transition-all duration-500"
          style={{ left: `calc(${pct}% - 4px)`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[10px]" style={{ color: DS.gray400 }}>{low}</span>
        <span className="font-mono text-[10px]" style={{ color: DS.gray400 }}>{high}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function DealCockpit({ analysis, deal, onNavigateSignals, onAskQuestion }: Props) {
  const { cockpit, signals } = analysis;
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [drillMetric, setDrillMetric] = useState<KPI | null>(null);

  const riskCfg = riskConfig[cockpit.riskLevel] || riskConfig.moderate;

  // Bar chart data
  const barData = cockpit.categoryScores.map((cs) => ({
    name: cs.category.length > 20 ? cs.category.slice(0, 20) + '...' : cs.category,
    fullName: cs.category,
    score: cs.score,
    max: cs.maxScore,
    color: cs.color,
  }));

  // Score ring
  const scorePercent = cockpit.overallScore;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (scorePercent / 100) * circumference;
  const scoreColor = scorePercent >= 70 ? DS.green : scorePercent >= 50 ? DS.amber : DS.red;

  const summaryText = cockpit.businessSummary || cockpit.recommendation || 'N/A';

  // Signal counts
  const signalCounts = [
    { key: 'buyingSignals', label: 'Buy', count: signals.buyingSignals.length, color: DS.green, icon: TrendingUp },
    { key: 'redFlags', label: 'Flags', count: signals.redFlags.length, color: DS.red, icon: AlertTriangle },
    { key: 'inconsistencies', label: 'Odd', count: signals.inconsistencies.length, color: DS.amber, icon: AlertCircle },
    { key: 'dataGaps', label: 'Gaps', count: signals.dataGaps.length, color: DS.purple, icon: FileQuestion },
  ];

  const criticalCount = [...signals.redFlags, ...signals.inconsistencies].filter(
    (s) => s.severity === 'critical' || s.severity === 'high'
  ).length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">

      {/* ===== ROW 1: Signals (Hero) + Deal Rating + Risk ===== */}
      <div className="grid grid-cols-12 gap-4">

        {/* Signal Overview — primary above-the-fold element */}
        <div className="col-span-12 md:col-span-6 rounded-[4px] p-5" style={{ boxShadow: 'var(--shadow-container)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>
              Signal Overview
            </p>
            {criticalCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium px-[10px] py-[3px] rounded-[2px]"
                style={{ background: 'rgba(0,0,0,0.05)', color: DS.gray600 }}
              >
                <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: DS.red }} />
                {criticalCount} high priority
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {signalCounts.map((signal) => (
              <button
                key={signal.key}
                onClick={() => onNavigateSignals?.(signal.key)}
                className="group flex flex-col items-center py-3 px-2 rounded-[4px] border border-transparent hover:border-[var(--border-default)] transition-all cursor-pointer"
                style={{ transition: 'border-color 0.1s ease, background 0.1s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-[7px] h-[7px] rounded-full mb-2" style={{ backgroundColor: signal.color }} />
                <span className="font-mono text-[20px] font-medium" style={{ color: DS.black }}>{signal.count}</span>
                <span className="font-mono text-[11px] mt-0.5" style={{ color: DS.gray400 }}>{signal.label}</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: DS.gray400 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Deal Rating */}
        <div className="col-span-6 md:col-span-3 rounded-[4px] p-5 flex flex-col items-center" style={{ boxShadow: 'var(--shadow-container)' }}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-3" style={{ color: DS.gray400 }}>
            Deal Rating
          </p>
          <div className="relative w-[88px] h-[88px]">
            <svg className="w-[88px] h-[88px] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke={DS.gray200} strokeWidth="7" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={scoreColor} strokeWidth="7"
                className="score-ring"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-[28px] font-700" style={{ color: DS.black }}>{cockpit.overallScore}</span>
              <span className="font-mono text-[9px]" style={{ color: DS.gray400 }}>/100</span>
            </div>
          </div>
          {deal.scoreHistory && deal.scoreHistory.length > 1 && (
            <div className="mt-3 pt-3 w-full" style={{ borderTop: `1px solid ${DS.gray200}` }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.05em] mb-1 flex items-center gap-1" style={{ color: DS.gray400 }}>
                <Activity className="w-3 h-3" /> History
              </p>
              <ScoreSparkline history={deal.scoreHistory} />
            </div>
          )}
        </div>

        {/* Risk Level — left-border accent pattern */}
        <div className="col-span-6 md:col-span-3 flex flex-col gap-3">
          <div
            className="rounded-[4px] p-4 flex-1"
            style={{
              borderLeft: `3px solid ${riskCfg.borderColor}`,
              boxShadow: 'var(--shadow-container)',
            }}
          >
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-2" style={{ color: DS.gray400 }}>
              Risk Level
            </p>
            <p className="font-heading text-[18px] font-600 capitalize" style={{ color: riskCfg.color }}>
              {cockpit.riskLevel}
            </p>
          </div>

          {/* Highlights / Risks count */}
          <div className="rounded-[4px] p-4" style={{ boxShadow: 'var(--shadow-container)' }}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-[12px] flex items-center gap-1.5" style={{ color: DS.gray600 }}>
                  <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: DS.green }} />
                  Highlights
                </span>
                <span className="font-mono text-[13px] font-medium" style={{ color: DS.black }}>{cockpit.investmentHighlights.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-[12px] flex items-center gap-1.5" style={{ color: DS.gray600 }}>
                  <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: DS.red }} />
                  Key Risks
                </span>
                <span className="font-mono text-[13px] font-medium" style={{ color: DS.black }}>{cockpit.keyRisks.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ROW 2: Next Steps + Compressed Summary ===== */}
      <div className="grid grid-cols-12 gap-4">

        {/* Recommended Next Steps */}
        {cockpit.nextSteps?.length > 0 && (
          <div className="col-span-12 md:col-span-7 rounded-[4px] p-5" style={{ boxShadow: 'var(--shadow-container)' }}>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4" style={{ color: DS.purple }} />
              <h3 className="font-heading text-[14px] font-500" style={{ color: DS.black }}>
                Recommended Next Steps
              </h3>
            </div>
            <div className="space-y-2">
              {cockpit.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 px-3 rounded-[4px]" style={{ background: DS.gray100 }}>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-medium shrink-0 mt-0.5"
                    style={{ background: 'var(--purple-bg)', color: DS.purple }}
                  >
                    {i + 1}
                  </span>
                  <p className="font-body text-[13px]" style={{ color: DS.gray600 }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Summary (compressed) + Highlights / Risks */}
        <div
          className={`${cockpit.nextSteps?.length > 0 ? 'col-span-12 md:col-span-5' : 'col-span-12'} rounded-[4px] p-5`}
          style={{ boxShadow: 'var(--shadow-container)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>
              Business Summary
            </p>
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="font-mono text-[11px] flex items-center gap-0.5 transition-colors"
              style={{ color: DS.purple }}
            >
              {summaryExpanded ? 'Collapse' : 'Expand'}
              {summaryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          <p className={`font-body text-[13px] leading-relaxed ${summaryExpanded ? '' : 'line-clamp-2'}`} style={{ color: DS.gray600 }}>
            {summaryText}
          </p>

          {/* Highlights & Risks */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-3" style={{ borderTop: `1px solid var(--border-subtle)` }}>
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5" style={{ color: DS.gray400 }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: DS.green }} />
                Highlights
              </p>
              <ul className="space-y-1.5">
                {cockpit.investmentHighlights.slice(0, 3).map((h, i) => (
                  <li key={i} className="font-body text-[12px] leading-relaxed" style={{ color: DS.gray600 }}>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5" style={{ color: DS.gray400 }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: DS.red }} />
                Key Risks
              </p>
              <ul className="space-y-1.5">
                {cockpit.keyRisks.slice(0, 3).map((r, i) => (
                  <li key={i} className="font-body text-[12px] leading-relaxed" style={{ color: DS.gray600 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ROW 3: KPIs ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" style={{ color: DS.purple }} />
          <h3 className="font-heading text-[14px] font-500" style={{ color: DS.black }}>Key Performance Indicators</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cockpit.kpis.map((kpi, i) => {
            const pc = getPercentileColor(kpi.percentile);
            return (
              <button
                key={i}
                onClick={() => setDrillMetric(kpi)}
                className="group rounded-[4px] p-4 border border-transparent hover:border-[var(--border-default)] transition-all text-left cursor-pointer"
                style={{ boxShadow: 'var(--shadow-container)', transition: 'border-color 0.1s ease' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="font-mono text-[11px] truncate group-hover:underline group-hover:decoration-[#673ab7]/40 group-hover:underline-offset-2" style={{ color: DS.gray400 }}>{kpi.name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {kpi.percentile != null && (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[10px] font-medium px-[8px] py-[2px] rounded-[2px]"
                        style={{ background: 'rgba(0,0,0,0.05)', color: DS.gray600 }}
                      >
                        <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: pc.dot }} />
                        {kpi.percentile}th
                      </span>
                    )}
                    {getTrendIcon(kpi.trend, kpi.percentile)}
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: DS.purple }} />
                  </div>
                </div>

                {/* Value */}
                <p className="font-mono text-[18px] font-medium" style={{ color: getKpiValueColor(kpi.status) }}>
                  {kpi.value}
                  {kpi.unit && (
                    <span className="font-mono text-[12px] font-normal ml-1" style={{ color: DS.gray400 }}>{kpi.unit}</span>
                  )}
                </p>

                {/* Benchmark text */}
                {kpi.benchmark && (
                  <p className="font-mono text-[10px] mt-1" style={{ color: DS.gray400 }}>Benchmark: {kpi.benchmark}</p>
                )}

                {/* Benchmark bar */}
                {kpi.benchmarkLow != null && kpi.benchmarkHigh != null && (
                  <BenchmarkBar value={kpi.value} low={kpi.benchmarkLow} high={kpi.benchmarkHigh} status={kpi.status} />
                )}

                {/* AI Commentary */}
                {kpi.commentary && (
                  <p className="font-body text-[11px] italic leading-relaxed mt-2 pt-2" style={{ color: DS.gray500, borderTop: `1px solid var(--border-subtle)` }}>
                    {kpi.commentary}
                  </p>
                )}

                {/* Source */}
                {kpi.source && (
                  <p className="font-mono text-[10px] mt-1.5 flex items-center gap-1" style={{ color: DS.gray400 }}>
                    <FileText className="w-2.5 h-2.5" />
                    {kpi.source}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== ROW 4: Score Breakdown ===== */}
      <div className="rounded-[4px] p-5" style={{ boxShadow: 'var(--shadow-container)' }}>
        <h3 className="font-heading text-[14px] font-500 mb-4" style={{ color: DS.black }}>Category Score Breakdown</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, barData.length * 32)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" domain={[0, 10]} tick={{ fill: DS.gray400, fontSize: 10, fontFamily: 'JetBrains Mono' }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fill: DS.gray600, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              width={150}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: `1px solid ${DS.gray300}`,
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
                boxShadow: 'var(--shadow-elevated)',
              }}
              labelStyle={{ color: DS.black }}
              itemStyle={{ color: DS.gray600 }}
              formatter={(value: any, _name: any, props: any) => [
                `${value} / ${props.payload.max}`,
                props.payload.fullName,
              ]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric Drill-Down Panel */}
      {drillMetric && (
        <MetricDrillPanel
          metric={drillMetric}
          dealId={deal.id}
          onClose={() => setDrillMetric(null)}
          onAskQuestion={onAskQuestion}
        />
      )}

    </div>
  );
}
