import type { DealAnalysis, Deal } from '../types';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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
} from 'lucide-react';

interface Props {
  analysis: DealAnalysis;
  deal: Deal;
}

const riskColors = {
  low: { text: 'text-[#46a758]', bg: 'bg-[#46a758]/10', border: 'border-[#46a758]/30' },
  moderate: { text: 'text-[#f5a524]', bg: 'bg-[#f5a524]/10', border: 'border-[#f5a524]/30' },
  high: { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/30' },
  critical: { text: 'text-[#e5484d]', bg: 'bg-[#e5484d]/10', border: 'border-[#e5484d]/30' },
};

const trendIcons = {
  up: <TrendingUp className="w-3.5 h-3.5 text-[#46a758]" />,
  down: <TrendingDown className="w-3.5 h-3.5 text-[#e5484d]" />,
  stable: <Minus className="w-3.5 h-3.5 text-[#666666]" />,
  unknown: <Minus className="w-3.5 h-3.5 text-[#a1a1a1]" />,
};

const statusColors = {
  good: 'text-[#46a758]',
  warning: 'text-[#f5a524]',
  critical: 'text-[#e5484d]',
  neutral: 'text-[#666666]',
};

const statusBarColors = {
  good: '#46a758',
  warning: '#f5a524',
  critical: '#e5484d',
  neutral: '#888888',
};

// ---------------------------------------------------------------------------
// Score Timeline Sparkline (SVG)
// ---------------------------------------------------------------------------
function ScoreSparkline({ history }: { history: Deal['scoreHistory'] }) {
  if (!history || history.length < 2) return null;

  const width = 200;
  const height = 48;
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
  const dotColor = delta >= 0 ? '#46a758' : '#e5484d';

  // Gradient area fill
  const areaPoints = [
    `${padX},${height - padY}`,
    ...points,
    `${padX + ((history.length - 1) / (history.length - 1)) * (width - padX * 2)},${height - padY}`,
  ].join(' ');

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="shrink-0">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#sparkFill)" />
        {/* Line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle cx={lastX} cy={lastY} r={3} fill={dotColor} />
      </svg>
      <div className="text-right shrink-0">
        <span className={`text-xs font-semibold ${delta >= 0 ? 'text-[#46a758]' : 'text-[#e5484d]'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}
        </span>
        <p className="text-[10px] text-[#a1a1a1]">{history.length} analyses</p>
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
  // Parse numeric value from the KPI value string
  const numericValue = parseFloat(value.replace(/[^0-9.\-]/g, ''));
  if (isNaN(numericValue)) return null;

  const range = high - low || 1;
  // Clamp percentage between 0 and 100
  const pct = Math.max(0, Math.min(100, ((numericValue - low) / range) * 100));
  const barColor = statusBarColors[status as keyof typeof statusBarColors] || statusBarColors.neutral;

  return (
    <div className="mt-2">
      <div className="relative h-1.5 bg-[#eaeaea] rounded-full overflow-hidden">
        {/* Full range background */}
        <div className="absolute inset-0 rounded-full" />
        {/* Marker */}
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.4 }}
        />
        {/* Dot indicator */}
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
export default function DealCockpit({ analysis, deal }: Props) {
  const { cockpit, signals } = analysis;
  const risk = riskColors[cockpit.riskLevel];

  // Radar chart data
  const radarData = cockpit.categoryScores.map((cs) => ({
    category: cs.category.length > 15 ? cs.category.slice(0, 15) + '...' : cs.category,
    score: cs.score,
    fullMark: cs.maxScore,
  }));

  // Bar chart data
  const barData = cockpit.categoryScores.map((cs) => ({
    name: cs.category.length > 12 ? cs.category.slice(0, 12) + '...' : cs.category,
    score: cs.score,
    max: cs.maxScore,
    color: cs.color,
  }));

  // Score ring
  const scorePercent = cockpit.overallScore;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (scorePercent / 100) * circumference;
  const scoreColor =
    scorePercent >= 70 ? '#46a758' : scorePercent >= 50 ? '#f5a524' : '#e5484d';

  const summaryText =
    cockpit.businessSummary || cockpit.recommendation || 'N/A';

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      {/* ===== Top Row: Score + Business Summary + Risk ===== */}
      <div className="grid grid-cols-12 gap-4">
        {/* Overall Score */}
        <div className="col-span-12 md:col-span-3 bg-white border border-[#eaeaea] rounded-2xl p-6 flex flex-col items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-4">
            Deal Score
          </p>
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#eaeaea" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                className="score-ring"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#171717]">{cockpit.overallScore}</span>
              <span className="text-[10px] text-[#888888] uppercase">/100</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-[#171717] mt-3">{cockpit.overallRating}</p>

          {/* Score Timeline Sparkline */}
          {deal.scoreHistory && deal.scoreHistory.length > 1 && (
            <div className="mt-4 pt-4 border-t border-[#eaeaea] w-full">
              <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Score History
              </p>
              <ScoreSparkline history={deal.scoreHistory} />
            </div>
          )}
        </div>

        {/* Business Summary */}
        <div className="col-span-12 md:col-span-6 bg-white border border-[#eaeaea] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-[#0f477b]" />
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
              Business Summary
            </p>
          </div>
          <p className="text-sm text-[#171717] leading-relaxed mb-4">{summaryText}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-[#46a758] mb-2 flex items-center gap-1">
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
              <p className="text-xs font-medium text-[#e5484d] mb-2 flex items-center gap-1">
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

        {/* Risk Level + Signals Summary */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <div className={`${risk.bg} border ${risk.border} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className={`w-4 h-4 ${risk.text}`} />
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Risk Level
              </p>
            </div>
            <p className={`text-lg font-bold ${risk.text} capitalize`}>{cockpit.riskLevel}</p>
          </div>

          <div className="bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-3">
              Signal Count
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#46a758]" />
                <span className="text-xs text-[#666666]">
                  <span className="text-[#171717] font-medium">{signals.buyingSignals.length}</span> Buy
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e5484d]" />
                <span className="text-xs text-[#666666]">
                  <span className="text-[#171717] font-medium">{signals.redFlags.length}</span> Flag
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                <span className="text-xs text-[#666666]">
                  <span className="text-[#171717] font-medium">{signals.inconsistencies.length}</span>{' '}
                  Odd
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#0070f3]" />
                <span className="text-xs text-[#666666]">
                  <span className="text-[#171717] font-medium">{signals.dataGaps.length}</span> Gap
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPIs Row ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#0f477b]" />
          <h3 className="text-sm font-semibold text-[#171717]">Key Performance Indicators</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cockpit.kpis.map((kpi, i) => (
            <div
              key={i}
              className="bg-white border border-[#eaeaea] rounded-xl p-4 hover:border-[#d4d4d4] transition-colors group shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              {/* Header: name + trend + percentile */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-xs text-[#888888] font-medium truncate">{kpi.name}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {kpi.percentile != null && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#0f477b]/10 text-[#0f477b] whitespace-nowrap">
                      {kpi.percentile}th %ile
                    </span>
                  )}
                  {trendIcons[kpi.trend]}
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
          ))}
        </div>
      </div>

      {/* ===== Charts Row ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <div className="bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-[#171717] mb-4">Category Assessment</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#eaeaea" />
              <PolarAngleAxis dataKey="category" tick={{ fill: '#666666', fontSize: 10 }} />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 10]}
                tick={{ fill: '#888888', fontSize: 9 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#1a5c9e"
                fill="#0f477b"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-[#171717] mb-4">Score Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#888888', fontSize: 10 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#666666', fontSize: 10 }}
                width={100}
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
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ===== Next Steps ===== */}
      {cockpit.nextSteps?.length > 0 && (
        <div className="bg-white border border-[#eaeaea] rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-[#0f477b]" />
            <h3 className="text-sm font-semibold text-[#171717]">Recommended Next Steps</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cockpit.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 bg-[#f5f5f5] rounded-lg">
                <span className="w-5 h-5 rounded-full bg-[#0f477b]/12 text-[#0f477b] flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-[#666666]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Footer ===== */}
      <div className="text-center py-4">
        <p className="text-xs text-[#a1a1a1]">
          Analysis generated {new Date(analysis.analyzedAt).toLocaleString()} &middot; Powered by
          Claude AI
        </p>
      </div>
    </div>
  );
}
