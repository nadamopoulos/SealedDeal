import { useMemo } from 'react';
import type {
  DealAnalytics,
  AnalyticsTimeSeries,
  AnalyticsDistribution,
  AnalyticsGeographicMix,
  AnalyticsCohort,
  AnalyticsClosures,
} from '../types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ComposedChart,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Design System tokens (matches DealCockpit DS)
// ---------------------------------------------------------------------------
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

const CHART_PALETTE = ['#673ab7', '#4A9E8E', '#B8914A', '#6B7280', '#8B5CF6', '#059669', '#D97706', '#C45B5B'];
const COHORT_DASHES = ['0', '5 3', '8 4', '3 3 6 3', '12 4', '2 2'];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatValue(v: number, unit?: string): string {
  const prefix = unit === '$' || unit === 'USD' || unit?.startsWith('$') ? '$' : '';
  const suffix = unit === '%' ? '%' : '';

  if (suffix === '%') return `${v.toFixed(1)}%`;

  let formatted: string;
  if (Math.abs(v) >= 1_000_000) {
    formatted = `${(v / 1_000_000).toFixed(1)}M`;
  } else if (Math.abs(v) >= 1_000) {
    formatted = `${(v / 1_000).toFixed(1)}K`;
  } else {
    formatted = v % 1 === 0 ? v.toString() : v.toFixed(1);
  }

  return `${prefix}${formatted}`;
}

function tooltipLabelFormatter(value: any): string {
  return String(value);
}

// ---------------------------------------------------------------------------
// Shared Recharts theme
// ---------------------------------------------------------------------------
const AXIS_TICK = { fill: DS.gray400, fontSize: 10, fontFamily: 'JetBrains Mono' };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: `1px solid ${DS.gray300}`,
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  labelStyle: { color: DS.black, fontWeight: 600 },
  itemStyle: { color: DS.gray600, padding: '2px 0' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  analytics: DealAnalytics;
  dealName: string;
  company: string;
}

// ---------------------------------------------------------------------------
// Chapter Header
// ---------------------------------------------------------------------------
function ChapterHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-5">
      <div
        className="w-7 h-7 rounded-[4px] flex items-center justify-center font-mono text-[11px] font-semibold text-white shrink-0"
        style={{ backgroundColor: DS.purple }}
      >
        {number}
      </div>
      <div className="h-[4px] w-1 rounded-full" style={{ backgroundColor: DS.purple }} />
      <h2 className="font-heading text-[20px] font-semibold" style={{ color: DS.black }}>
        {title}
      </h2>
      <div className="flex-1 h-px" style={{ backgroundColor: DS.gray200 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart Card Shell
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  insight,
  cagr,
  children,
}: {
  title: string;
  subtitle?: string;
  insight: string;
  cagr?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[4px] p-5" style={{ boxShadow: 'var(--shadow-container)' }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-heading text-[16px] font-semibold" style={{ color: DS.black }}>
            {title}
          </h3>
          {subtitle && (
            <p className="font-body text-[13px] mt-0.5" style={{ color: DS.gray500 }}>
              {subtitle}
            </p>
          )}
        </div>
        {cagr && (
          <span
            className="inline-flex items-center font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: 'rgba(103,58,183,0.1)', color: DS.purple }}
          >
            CAGR {cagr}
          </span>
        )}
      </div>
      <p className="font-body text-[14px] font-semibold leading-snug mt-2 mb-4" style={{ color: '#171717' }}>
        {insight}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Time Series Chart
// ---------------------------------------------------------------------------
function TimeSeriesChart({ item }: { item: AnalyticsTimeSeries }) {
  const { chartType, series, unit } = item;

  // Transform data: merge all series into a single array keyed by period
  const data = useMemo(() => {
    const periodMap: Record<string, Record<string, number>> = {};
    series.forEach((s) => {
      s.data.forEach((d) => {
        if (!periodMap[d.period]) periodMap[d.period] = {};
        periodMap[d.period][s.name] = d.value;
      });
    });
    return Object.entries(periodMap).map(([period, vals]) => ({ period, ...vals }));
  }, [series]);

  const yFormatter = (value: any) => formatValue(Number(value), unit);
  const tooltipFormatter = (value: any, _name: any) => [formatValue(Number(value), unit), _name];

  if (chartType === 'stacked-bar' || chartType === 'bar') {
    return (
      <ChartCard title={item.title} subtitle={item.subtitle} insight={item.insight} cagr={item.cagr}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFormatter} width={52} />
            <Tooltip {...TOOLTIP_STYLE} formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} />
            {series.map((s, i) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                stackId={chartType === 'stacked-bar' ? 'a' : undefined}
                fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                radius={chartType === 'stacked-bar' && i < series.length - 1 ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                barSize={series.length > 1 ? undefined : 28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color || CHART_PALETTE[i % CHART_PALETTE.length] }))} />}
      </ChartCard>
    );
  }

  if (chartType === 'line') {
    return (
      <ChartCard title={item.title} subtitle={item.subtitle} insight={item.insight} cagr={item.cagr}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
            <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFormatter} width={52} />
            <Tooltip {...TOOLTIP_STYLE} formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} />
            {series.map((s, i) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color || CHART_PALETTE[i % CHART_PALETTE.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color || CHART_PALETTE[i % CHART_PALETTE.length] }))} />}
      </ChartCard>
    );
  }

  // area
  return (
    <ChartCard title={item.title} subtitle={item.subtitle} insight={item.insight} cagr={item.cagr}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color || CHART_PALETTE[i % CHART_PALETTE.length];
              return (
                <linearGradient key={s.name} id={`grad-${item.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
          <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFormatter} width={52} />
          <Tooltip {...TOOLTIP_STYLE} formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} />
          {series.map((s, i) => (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
              strokeWidth={2}
              fill={`url(#grad-${item.id}-${i})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color || CHART_PALETTE[i % CHART_PALETTE.length] }))} />}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Distribution Chart
// ---------------------------------------------------------------------------
function DistributionChart({ item }: { item: AnalyticsDistribution }) {
  const { stats, dataPoints, unit } = item;

  const sortedBars = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];
    return [...dataPoints]
      .sort((a, b) => b - a)
      .map((v, i) => ({ index: i, value: v }));
  }, [dataPoints]);

  // Color gradient: green (high) -> amber (low)
  const getBarColor = (value: number) => {
    if (!sortedBars.length) return DS.green;
    const max = sortedBars[0].value;
    const min = sortedBars[sortedBars.length - 1].value;
    const range = max - min || 1;
    const pct = (value - min) / range;
    if (pct >= 0.66) return DS.green;
    if (pct >= 0.33) return DS.amber;
    return DS.red;
  };

  const iqr = stats.q3 - stats.q1;
  const rangeMin = stats.min ?? (stats.q1 - iqr * 1.5);
  const rangeMax = stats.max ?? (stats.q3 + iqr * 1.5);
  const fullRange = rangeMax - rangeMin || 1;
  const q1Pct = ((stats.q1 - rangeMin) / fullRange) * 100;
  const medPct = ((stats.median - rangeMin) / fullRange) * 100;
  const q3Pct = ((stats.q3 - rangeMin) / fullRange) * 100;

  return (
    <ChartCard title={item.title} subtitle={item.subtitle} insight={item.insight}>
      <div className={sortedBars.length > 0 ? 'grid grid-cols-12 gap-5' : ''}>
        {/* Bar chart (waterfall-style) */}
        {sortedBars.length > 0 && (
          <div className="col-span-8">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sortedBars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
                <XAxis dataKey="index" tick={false} axisLine={{ stroke: DS.gray200 }} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: any) => formatValue(Number(value), unit)}
                  width={52}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(value: any, _name: any) => [formatValue(Number(value), unit), 'Value']}
                  labelFormatter={(value: any) => `Unit #${Number(value) + 1}`}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={Math.max(4, Math.min(16, 400 / sortedBars.length))}>
                  {sortedBars.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stats panel */}
        <div className={sortedBars.length > 0 ? 'col-span-4 flex flex-col justify-center' : 'w-full'}>
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>Mean</p>
              <p className="font-mono text-[24px] font-semibold" style={{ color: DS.black }}>
                {formatValue(stats.mean, unit)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>Median</p>
              <p className="font-mono text-[24px] font-semibold" style={{ color: DS.purple }}>
                {formatValue(stats.median, unit)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>Q1</p>
                <p className="font-mono text-[14px] font-medium" style={{ color: DS.gray600 }}>
                  {formatValue(stats.q1, unit)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>Q3</p>
                <p className="font-mono text-[14px] font-medium" style={{ color: DS.gray600 }}>
                  {formatValue(stats.q3, unit)}
                </p>
              </div>
            </div>

            {/* IQR visualization */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: DS.gray400 }}>
                Interquartile Range
              </p>
              <div className="relative h-[8px] rounded-full" style={{ background: DS.gray200 }}>
                <div
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    left: `${q1Pct}%`,
                    width: `${q3Pct - q1Pct}%`,
                    backgroundColor: DS.purple,
                    opacity: 0.3,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ left: `calc(${medPct}% - 5px)`, backgroundColor: DS.purple }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[9px]" style={{ color: DS.gray400 }}>
                  {formatValue(rangeMin, unit)}
                </span>
                <span className="font-mono text-[9px]" style={{ color: DS.gray400 }}>
                  {formatValue(rangeMax, unit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Geographic Mix Chart
// ---------------------------------------------------------------------------
function GeographicMixChart({ geo }: { geo: AnalyticsGeographicMix }) {
  const { regions } = geo;

  // Get all unique periods
  const periods = useMemo(() => {
    const set = new Set<string>();
    regions.forEach((r) => r.values.forEach((v) => set.add(v.period)));
    return Array.from(set);
  }, [regions]);

  // Absolute value data
  const absData = useMemo(() => {
    return periods.map((period) => {
      const row: Record<string, any> = { period };
      regions.forEach((r) => {
        const match = r.values.find((v) => v.period === period);
        row[r.name] = match ? match.amount : 0;
      });
      return row;
    });
  }, [periods, regions]);

  // Percentage data
  const pctData = useMemo(() => {
    return periods.map((period) => {
      const row: Record<string, any> = { period };
      regions.forEach((r) => {
        const match = r.values.find((v) => v.period === period);
        row[r.name] = match ? match.pct : 0;
      });
      return row;
    });
  }, [periods, regions]);

  const colors = regions.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  return (
    <ChartCard title="Revenue by Geography" insight={geo.insight}>
      <div className="grid grid-cols-2 gap-5">
        {/* Absolute values */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: DS.gray400 }}>
            Absolute ($M)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={absData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
              <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: any) => formatValue(Number(value), '$')}
                width={52}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: any, _name: any) => [formatValue(Number(value), '$'), _name]}
                labelFormatter={tooltipLabelFormatter}
              />
              {regions.map((r, i) => (
                <Bar
                  key={r.name}
                  dataKey={r.name}
                  stackId="a"
                  fill={colors[i]}
                  radius={i === regions.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Percentage breakdown */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: DS.gray400 }}>
            Mix (%)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pctData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
              <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(value: any) => `${value}%`}
                width={40}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: any, _name: any) => [`${Number(value).toFixed(1)}%`, _name]}
                labelFormatter={tooltipLabelFormatter}
              />
              {regions.map((r, i) => (
                <Bar
                  key={r.name}
                  dataKey={r.name}
                  stackId="a"
                  fill={colors[i]}
                  radius={i === regions.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ChartLegend items={regions.map((r, i) => ({ name: r.name, color: colors[i] }))} />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Cohort Chart
// ---------------------------------------------------------------------------
function CohortChart({ cohort }: { cohort: AnalyticsCohort }) {
  const { cohorts } = cohort;

  // Merge into a single array keyed by period
  const periods = useMemo(() => {
    const set = new Set<string>();
    cohorts.forEach((c) => c.data.forEach((d) => set.add(d.period)));
    return Array.from(set);
  }, [cohorts]);

  const data = useMemo(() => {
    return periods.map((period) => {
      const row: Record<string, any> = { period };
      cohorts.forEach((c) => {
        const match = c.data.find((d) => d.period === period);
        row[c.name] = match ? match.avgAUV : null;
        row[`${c.name}_count`] = match ? match.storeCount : 0;
      });
      return row;
    });
  }, [periods, cohorts]);

  const colors = cohorts.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  return (
    <ChartCard title="Cohort / Vintage Analysis" insight={cohort.insight}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
          <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: any) => formatValue(Number(value), '$')}
            width={52}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: any, name: any) => {
              if (value == null) return ['-', name];
              return [formatValue(Number(value), '$'), name];
            }}
            labelFormatter={tooltipLabelFormatter}
          />
          {cohorts.map((c, i) => (
            <Line
              key={c.name}
              type="monotone"
              dataKey={c.name}
              stroke={colors[i]}
              strokeWidth={2}
              strokeDasharray={COHORT_DASHES[i % COHORT_DASHES.length]}
              dot={{ r: 3, fill: colors[i] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ChartLegend
        items={cohorts.map((c, i) => ({
          name: `${c.name} (${c.storeCount} stores)`,
          color: colors[i],
        }))}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// 5. Closure Chart (dual-axis)
// ---------------------------------------------------------------------------
function ClosureChart({ closure }: { closure: AnalyticsClosures }) {
  const { data } = closure;

  return (
    <ChartCard title="Store Closure Analysis" insight={closure.insight}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DS.gray200} vertical={false} />
          <XAxis dataKey="period" tick={AXIS_TICK} axisLine={{ stroke: DS.gray200 }} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            label={{
              value: 'Closures',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 10, fill: DS.gray400, fontFamily: 'JetBrains Mono' },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(value: any) => `${value}%`}
            label={{
              value: 'Rate %',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 10, fill: DS.gray400, fontFamily: 'JetBrains Mono' },
            }}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: any, name: any) => {
              if (name === 'closureRate') return [`${Number(value).toFixed(1)}%`, 'Closure Rate'];
              if (name === 'avgAUVOfClosed') return [formatValue(Number(value), '$'), 'Avg AUV (Closed)'];
              return [value, 'Closures'];
            }}
            labelFormatter={tooltipLabelFormatter}
          />
          <Bar yAxisId="left" dataKey="closures" fill={DS.red} opacity={0.7} radius={[3, 3, 0, 0]} barSize={28} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="closureRate"
            stroke={DS.amber}
            strokeWidth={2}
            dot={{ r: 3, fill: DS.amber }}
            activeDot={{ r: 5 }}
          />
          {data.some((d) => d.avgAUVOfClosed != null) && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgAUVOfClosed"
              stroke={DS.gray500}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={{ r: 2, fill: DS.gray500 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { name: 'Closures', color: DS.red },
          { name: 'Closure Rate %', color: DS.amber },
          ...(data.some((d) => d.avgAUVOfClosed != null) ? [{ name: 'Avg AUV (Closed)', color: DS.gray500 }] : []),
        ]}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
function ChartLegend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${DS.gray200}` }}>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="font-mono text-[11px]" style={{ color: DS.gray500 }}>
            {item.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8">
      <div
        className="w-14 h-14 rounded-[4px] flex items-center justify-center mb-4"
        style={{ backgroundColor: DS.gray100 }}
      >
        <BarChart3 className="w-6 h-6" style={{ color: DS.gray400 }} />
      </div>
      <h3 className="font-heading text-[16px] font-semibold mb-2" style={{ color: DS.black }}>
        No Analytics Data
      </h3>
      <p className="font-body text-[14px] text-center max-w-md" style={{ color: DS.gray500 }}>
        Analytics data will appear after running analysis on deals with financial spreadsheets.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function AnalyticsView({ analytics, dealName, company }: Props) {
  const {
    timeSeries = [],
    distributions = [],
    geographicMix,
    cohortAnalysis,
    closureAnalysis,
  } = analytics || {};

  const hasData =
    timeSeries.length > 0 ||
    distributions.length > 0 ||
    geographicMix != null ||
    cohortAnalysis != null ||
    closureAnalysis != null;

  if (!hasData) {
    return <EmptyState />;
  }

  let chapterNum = 0;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-[24px] font-bold" style={{ color: DS.black }}>
          Investment Analytics
        </h1>
        <p className="font-body text-[14px] mt-1" style={{ color: DS.gray500 }}>
          {company} — Key Business Metrics
        </p>
      </div>

      {/* Performance Overview (time series) */}
      {timeSeries.length > 0 && (
        <>
          <ChapterHeader number={++chapterNum} title="Performance Overview" />
          <div className="space-y-5">
            {timeSeries.map((item) => (
              <TimeSeriesChart key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      {/* Geographic Breakdown */}
      {geographicMix && (
        <>
          <ChapterHeader number={++chapterNum} title="Geographic Breakdown" />
          <GeographicMixChart geo={geographicMix} />
        </>
      )}

      {/* Distribution Analysis */}
      {distributions.length > 0 && (
        <>
          <ChapterHeader number={++chapterNum} title="Distribution Analysis" />
          <div className="space-y-5">
            {distributions.map((item) => (
              <DistributionChart key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      {/* Cohort & Vintage Analysis */}
      {cohortAnalysis && (
        <>
          <ChapterHeader number={++chapterNum} title="Cohort & Vintage Analysis" />
          <CohortChart cohort={cohortAnalysis} />
        </>
      )}

      {/* Store Health */}
      {closureAnalysis && (
        <>
          <ChapterHeader number={++chapterNum} title="Store Health" />
          <ClosureChart closure={closureAnalysis} />
        </>
      )}
    </div>
  );
}
