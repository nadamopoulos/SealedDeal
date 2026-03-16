import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPISlice } from '../types';

// Talonic Design System tokens (mirror from MetricDrillPanel)
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
  slices: KPISlice[];
  metricName: string;
}

function getBarColor(index: number, total: number): string {
  // Segments are sorted descending by valueNum.
  // Top third = green, middle third = amber, bottom third = red.
  if (total <= 1) return DS.green;
  const position = index / (total - 1); // 0 = top, 1 = bottom
  if (position < 0.334) return DS.green;
  if (position < 0.667) return DS.amber;
  return DS.red;
}

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  if (!trend) return null;
  if (trend === 'up') return <TrendingUp className="w-3 h-3" style={{ color: DS.greenDark }} />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3" style={{ color: DS.redDark }} />;
  return <Minus className="w-3 h-3" style={{ color: DS.gray400 }} />;
}

export default function MetricSliceView({ slices, metricName }: Props) {
  return (
    <div className="space-y-5">
      {slices.map((slice, si) => {
        // Sort segments descending by valueNum
        const sorted = [...slice.segments].sort((a, b) => b.valueNum - a.valueNum);
        const maxVal = sorted.length > 0 ? Math.max(...sorted.map((s) => Math.abs(s.valueNum)), 1) : 1;

        return (
          <div key={`${slice.dimension}-${si}`}>
            {/* Slice header */}
            <p
              className="font-mono text-[11px] font-medium mb-3"
              style={{ color: DS.gray600 }}
            >
              {slice.label}
            </p>

            {/* Segment bars */}
            <div className="space-y-2">
              {sorted.map((seg, idx) => {
                const barPct = Math.max(4, (Math.abs(seg.valueNum) / maxVal) * 100);
                const barColor = getBarColor(idx, sorted.length);

                return (
                  <div key={seg.name} className="flex items-center gap-3">
                    {/* Segment name */}
                    <span
                      className="font-mono text-[12px] shrink-0 text-right"
                      style={{ color: DS.gray600, width: '120px' }}
                    >
                      {seg.name}
                    </span>

                    {/* Bar */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div
                        className="relative h-[18px] rounded-[3px] flex items-center"
                        style={{ width: '100%' }}
                      >
                        <div
                          className="h-full rounded-[3px] transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: barColor,
                            opacity: 0.2,
                          }}
                        />
                        <div
                          className="absolute left-0 h-full rounded-[3px] transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: barColor,
                            opacity: 0.15,
                          }}
                        />
                      </div>
                    </div>

                    {/* Value + count + trend */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="font-mono text-[12px] font-medium"
                        style={{ color: DS.gray700 }}
                      >
                        {seg.value}
                      </span>
                      {seg.count != null && (
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: DS.gray400 }}
                        >
                          ({seg.count})
                        </span>
                      )}
                      <TrendIcon trend={seg.trend} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
