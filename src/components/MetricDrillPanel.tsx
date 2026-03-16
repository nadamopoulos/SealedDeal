import { useEffect, useRef, useState } from 'react';
import type { KPI } from '../types';
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Send,
  MessageCircle,
} from 'lucide-react';

// Talonic Design System tokens
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

interface Props {
  metric: KPI;
  dealId: string;
  onClose: () => void;
  onAskQuestion?: (question: string) => void;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'good':
      return { color: DS.green, darkColor: DS.greenDark, label: 'Good' };
    case 'warning':
      return { color: DS.amber, darkColor: DS.amberDark, label: 'Warning' };
    case 'critical':
      return { color: DS.red, darkColor: DS.redDark, label: 'Critical' };
    default:
      return { color: DS.gray400, darkColor: DS.gray600, label: 'Neutral' };
  }
}

function getPercentileLabel(percentile: number | undefined) {
  if (percentile == null) return null;
  if (percentile >= 90) return 'Top decile';
  if (percentile >= 75) return 'Top quartile';
  if (percentile >= 50) return 'Above median';
  if (percentile >= 25) return 'Below median';
  return 'Bottom quartile';
}

export default function MetricDrillPanel({ metric, dealId, onClose, onAskQuestion }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleAskQuestion = (question: string) => {
    onAskQuestion?.(question);
    handleClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuestion.trim()) {
      handleAskQuestion(customQuestion.trim());
    }
  };

  const statusCfg = getStatusConfig(metric.status);
  const percentileLabel = getPercentileLabel(metric.percentile);

  // Pre-generated suggested questions
  const suggestedQuestions = [
    `What's driving ${metric.name}?`,
    `How does ${metric.name} compare to top quartile?`,
    `What risks are associated with ${metric.name}?`,
    `Show me the trend for ${metric.name}`,
  ];

  // Benchmark bar calculation
  const numericValue = parseFloat(metric.value.replace(/[^0-9.\-]/g, ''));
  const hasBenchmarkBar =
    !isNaN(numericValue) && metric.benchmarkLow != null && metric.benchmarkHigh != null;
  let benchmarkPct = 0;
  if (hasBenchmarkBar) {
    const range = metric.benchmarkHigh! - metric.benchmarkLow! || 1;
    benchmarkPct = Math.max(0, Math.min(100, ((numericValue - metric.benchmarkLow!) / range) * 100));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleBackdropClick}
      style={{
        backgroundColor: isVisible ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0)',
        transition: 'background-color 0.2s ease',
      }}
    >
      <div
        ref={panelRef}
        className="h-full bg-white overflow-y-auto w-full md:w-[50vw] md:max-w-[720px]"
        style={{
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 bg-white z-10 px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${DS.gray200}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-[10px] h-[10px] rounded-full shrink-0"
              style={{ backgroundColor: statusCfg.color }}
            />
            <h2
              className="font-heading text-[18px] font-600 truncate"
              style={{ color: DS.black }}
            >
              {metric.name}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-[4px] hover:bg-[#f5f5f5] transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4" style={{ color: DS.gray500 }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ============ Section 1: Metric Overview ============ */}
          <section>
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-4"
              style={{ color: DS.gray400 }}
            >
              Metric Overview
            </p>

            {/* Value display */}
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="font-mono text-[36px] font-medium leading-none"
                style={{ color: statusCfg.darkColor }}
              >
                {metric.value}
              </span>
              {metric.unit && (
                <span
                  className="font-mono text-[16px]"
                  style={{ color: DS.gray400 }}
                >
                  {metric.unit}
                </span>
              )}
            </div>

            {/* Status + Percentile + Trend row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Status badge */}
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium px-3 py-1.5 rounded-[4px]"
                style={{
                  backgroundColor: `${statusCfg.color}15`,
                  color: statusCfg.darkColor,
                }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: statusCfg.color }}
                />
                {statusCfg.label}
              </span>

              {/* Percentile badge */}
              {metric.percentile != null && (
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium px-3 py-1.5 rounded-[4px]"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: DS.gray600 }}
                >
                  {metric.percentile}th percentile
                  {percentileLabel && (
                    <span style={{ color: DS.gray400 }}>({percentileLabel})</span>
                  )}
                </span>
              )}

              {/* Trend */}
              <span
                className="inline-flex items-center gap-1 font-mono text-[12px] px-3 py-1.5 rounded-[4px]"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: DS.gray600 }}
              >
                {metric.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" style={{ color: DS.greenDark }} />}
                {metric.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" style={{ color: DS.redDark }} />}
                {(metric.trend === 'stable' || metric.trend === 'unknown') && (
                  <Minus className="w-3.5 h-3.5" style={{ color: DS.gray500 }} />
                )}
                {metric.trend === 'up' ? 'Trending up' : metric.trend === 'down' ? 'Trending down' : metric.trend === 'stable' ? 'Stable' : 'Unknown trend'}
              </span>
            </div>

            {/* Benchmark text */}
            {metric.benchmark && (
              <p className="font-mono text-[12px] mb-2" style={{ color: DS.gray500 }}>
                Benchmark: {metric.benchmark}
              </p>
            )}

            {/* Source */}
            {metric.source && (
              <div
                className="flex items-center gap-1.5 font-mono text-[11px] mt-3"
                style={{ color: DS.gray400 }}
              >
                <FileText className="w-3 h-3" />
                Source: {metric.source}
              </div>
            )}

            {/* AI Commentary */}
            {metric.commentary && (
              <div
                className="mt-4 p-4 rounded-[4px]"
                style={{
                  backgroundColor: `${DS.purple}08`,
                  borderLeft: `3px solid ${DS.purple}`,
                }}
              >
                <p
                  className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-1.5"
                  style={{ color: DS.purple }}
                >
                  AI Commentary
                </p>
                <p
                  className="font-body text-[13px] leading-relaxed italic"
                  style={{ color: DS.gray600 }}
                >
                  {metric.commentary}
                </p>
              </div>
            )}
          </section>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${DS.gray200}` }} />

          {/* ============ Section 2: Benchmark Context ============ */}
          <section>
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-4"
              style={{ color: DS.gray400 }}
            >
              Benchmark Context
            </p>

            {hasBenchmarkBar ? (
              <div>
                {/* Large benchmark bar */}
                <div className="relative h-[10px] rounded-[5px] overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                  <div
                    className="absolute top-0 h-full rounded-[5px] transition-all duration-500"
                    style={{ width: `${benchmarkPct}%`, backgroundColor: statusCfg.color, opacity: 0.3 }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-500"
                    style={{ left: `calc(${benchmarkPct}% - 6px)`, backgroundColor: statusCfg.color }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="font-mono text-[11px]" style={{ color: DS.gray400 }}>
                    {metric.benchmarkLow}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: DS.gray400 }}>
                    {metric.benchmarkHigh}
                  </span>
                </div>

                {/* Percentile narrative */}
                {metric.percentile != null && (
                  <p
                    className="font-body text-[13px] leading-relaxed mt-3"
                    style={{ color: DS.gray600 }}
                  >
                    This metric is at the{' '}
                    <span className="font-mono font-medium" style={{ color: statusCfg.darkColor }}>
                      {metric.percentile}th percentile
                    </span>{' '}
                    for the industry benchmark range.
                  </p>
                )}
              </div>
            ) : (
              <p className="font-body text-[13px]" style={{ color: DS.gray400 }}>
                No benchmark range data available for this metric.
              </p>
            )}
          </section>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${DS.gray200}` }} />

          {/* ============ Section 3: Ask Follow-Up ============ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4" style={{ color: DS.purple }} />
              <p
                className="font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: DS.gray400 }}
              >
                Ask Follow-Up
              </p>
            </div>

            {/* Suggested question chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleAskQuestion(q)}
                  className="px-3 py-1.5 rounded-[4px] font-body text-[12px] transition-all"
                  style={{
                    backgroundColor: `${DS.purple}0a`,
                    color: DS.gray600,
                    border: `1px solid ${DS.purple}20`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${DS.purple}15`;
                    e.currentTarget.style.color = DS.purple;
                    e.currentTarget.style.borderColor = `${DS.purple}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${DS.purple}0a`;
                    e.currentTarget.style.color = DS.gray600;
                    e.currentTarget.style.borderColor = `${DS.purple}20`;
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Custom question input */}
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder={`Ask about ${metric.name}...`}
                className="flex-1 font-body text-[13px] px-3 py-2.5 rounded-[4px] outline-none transition-colors"
                style={{
                  border: `1px solid ${DS.gray200}`,
                  color: DS.black,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = `${DS.purple}60`)}
                onBlur={(e) => (e.currentTarget.style.borderColor = DS.gray200)}
              />
              <button
                type="submit"
                disabled={!customQuestion.trim()}
                className="p-2.5 rounded-[4px] transition-colors shrink-0"
                style={{
                  backgroundColor: customQuestion.trim() ? DS.purple : DS.gray100,
                  color: customQuestion.trim() ? '#ffffff' : DS.gray400,
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
