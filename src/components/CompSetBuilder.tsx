import { useState, useMemo } from 'react';
import type { Deal, DealAnalysis, KPI } from '../types';
import { COMP_DATABASE, COMP_CATEGORIES, searchComps } from '../data/compDatabase';
import type { CompConcept } from '../data/compDatabase';
import {
  Search,
  X,
  Plus,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  MapPin,
  Calendar,
} from 'lucide-react';

interface Props {
  deal: Deal;
  analysis: DealAnalysis;
}

// Talonic Design System tokens (mirrored from DealCockpit)
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

const MAX_COMPS = 5;

// KPI mapping: comp field key -> human label -> how to extract from deal KPIs
interface CompKpiDef {
  label: string;
  compKey: keyof CompConcept;
  compNumKey: keyof CompConcept;
  dealPattern: RegExp;
  higherIsBetter: boolean;
  format: (v: number) => string;
}

const COMP_KPIS: CompKpiDef[] = [
  {
    label: 'Avg Unit Volume',
    compKey: 'avgUnitVolume',
    compNumKey: 'avgUnitVolumeNum',
    dealPattern: /unit.*volume|auv|average.*unit/i,
    higherIsBetter: true,
    format: (v) => `$${(v / 1000000).toFixed(1)}M`,
  },
  {
    label: 'SSS Growth',
    compKey: 'sssGrowth',
    compNumKey: 'sssGrowthNum',
    dealPattern: /same.*store|sss|comp.*sales|like.*for.*like/i,
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    label: 'Food Cost %',
    compKey: 'franchiseeFoodCost',
    compNumKey: 'franchiseeFoodCostNum',
    dealPattern: /food.*cost|cogs/i,
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    label: 'EBITDA %',
    compKey: 'franchiseeEBITDA',
    compNumKey: 'franchiseeEBITDANum',
    dealPattern: /ebitda/i,
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    label: 'Royalty Rate',
    compKey: 'royaltyRate',
    compNumKey: 'royaltyRateNum',
    dealPattern: /royalt/i,
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    label: 'Initial Investment',
    compKey: 'initialInvestment',
    compNumKey: 'initialInvestmentNum',
    dealPattern: /initial.*invest|franchise.*fee|startup.*cost/i,
    higherIsBetter: false,
    format: (v) => `$${(v / 1000000).toFixed(1)}M`,
  },
];

function extractDealKpiValue(kpis: KPI[], pattern: RegExp): { display: string; numeric: number | null } {
  const match = kpis.find((k) => pattern.test(k.name));
  if (!match) return { display: '--', numeric: null };
  const raw = match.value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(raw);
  return { display: match.value, numeric: isNaN(num) ? null : num };
}

function getCellColor(
  dealVal: number | null,
  compVal: number,
  higherIsBetter: boolean
): { bg: string; text: string } {
  if (dealVal == null) return { bg: 'transparent', text: DS.gray500 };
  const diff = dealVal - compVal;
  const absPct = compVal !== 0 ? Math.abs(diff / compVal) * 100 : Math.abs(diff);
  if (absPct <= 10) return { bg: 'transparent', text: DS.gray700 };
  const isBetter = higherIsBetter ? diff > 0 : diff < 0;
  if (isBetter) return { bg: `${DS.green}12`, text: DS.greenDark };
  return { bg: `${DS.red}12`, text: DS.redDark };
}

function getCompCellColor(
  compVal: number,
  dealVal: number | null,
  higherIsBetter: boolean
): { bg: string; text: string } {
  if (dealVal == null) return { bg: 'transparent', text: DS.gray700 };
  const diff = compVal - dealVal;
  const absPct = dealVal !== 0 ? Math.abs(diff / dealVal) * 100 : Math.abs(diff);
  if (absPct <= 10) return { bg: 'transparent', text: DS.gray700 };
  const isBetter = higherIsBetter ? diff > 0 : diff < 0;
  if (isBetter) return { bg: `${DS.green}12`, text: DS.greenDark };
  return { bg: `${DS.red}12`, text: DS.redDark };
}

export default function CompSetBuilder({ deal, analysis }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);

  const filteredComps = useMemo(
    () => searchComps(searchQuery, selectedCategory),
    [searchQuery, selectedCategory]
  );

  const selectedComps = useMemo(
    () => selectedCompIds.map((id) => COMP_DATABASE.find((c) => c.id === id)!).filter(Boolean),
    [selectedCompIds]
  );

  const addComp = (id: string) => {
    if (selectedCompIds.length >= MAX_COMPS || selectedCompIds.includes(id)) return;
    setSelectedCompIds((prev) => [...prev, id]);
  };

  const removeComp = (id: string) => {
    setSelectedCompIds((prev) => prev.filter((cid) => cid !== id));
  };

  const kpis = analysis.cockpit.kpis;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4" style={{ color: DS.purple }} />
          <h2 className="font-heading text-[16px] font-600" style={{ color: DS.black }}>
            Comp Set Builder
          </h2>
        </div>
        <p className="font-body text-[13px]" style={{ color: DS.gray500 }}>
          Compare {deal.company} KPIs against franchise and QSR benchmarks. Select up to {MAX_COMPS} comparable concepts.
        </p>
      </div>

      {/* Search + Category Filters */}
      <div className="rounded-[4px] p-5" style={{ boxShadow: 'var(--shadow-container)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: DS.gray400 }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[4px] border text-[13px] font-body transition-colors outline-none"
              style={{
                borderColor: DS.gray200,
                color: DS.black,
                background: DS.gray100,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = DS.purple)}
              onBlur={(e) => (e.currentTarget.style.borderColor = DS.gray200)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {COMP_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: selectedCategory === cat ? `${DS.purple}14` : DS.gray100,
                  color: selectedCategory === cat ? DS.purple : DS.gray500,
                  border: `1px solid ${selectedCategory === cat ? `${DS.purple}30` : 'transparent'}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Comps Pills */}
      {selectedCompIds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: DS.gray400 }}>
            Selected ({selectedCompIds.length}/{MAX_COMPS})
          </span>
          {selectedComps.map((comp) => (
            <span
              key={comp.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium"
              style={{ backgroundColor: `${DS.purple}14`, color: DS.purple }}
            >
              {comp.name}
              <button
                onClick={() => removeComp(comp.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {selectedComps.length > 0 && (
        <div className="rounded-[4px] overflow-hidden" style={{ boxShadow: 'var(--shadow-container)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${DS.gray200}` }}>
                  <th
                    className="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                    style={{ color: DS.gray400, width: '160px' }}
                  >
                    KPI
                  </th>
                  <th
                    className="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                    style={{
                      color: DS.purple,
                      background: `${DS.purple}08`,
                      borderLeft: `2px solid ${DS.purple}`,
                    }}
                  >
                    {deal.company}
                  </th>
                  {selectedComps.map((comp) => (
                    <th
                      key={comp.id}
                      className="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                      style={{ color: DS.gray500 }}
                    >
                      {comp.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMP_KPIS.map((kpiDef, idx) => {
                  const dealVal = extractDealKpiValue(kpis, kpiDef.dealPattern);
                  return (
                    <tr
                      key={kpiDef.label}
                      style={{
                        borderBottom: idx < COMP_KPIS.length - 1 ? `1px solid ${DS.gray200}` : undefined,
                      }}
                    >
                      <td
                        className="px-4 py-3 font-mono text-[11px] font-medium"
                        style={{ color: DS.gray600 }}
                      >
                        {kpiDef.label}
                      </td>
                      <td
                        className="text-right px-4 py-3 font-mono text-[13px] font-medium"
                        style={{
                          color: dealVal.numeric != null ? DS.black : DS.gray400,
                          background: `${DS.purple}08`,
                          borderLeft: `2px solid ${DS.purple}`,
                        }}
                      >
                        {dealVal.display}
                      </td>
                      {selectedComps.map((comp) => {
                        const compVal = comp[kpiDef.compNumKey] as number;
                        const compDisplay = comp[kpiDef.compKey] as string;
                        const cellColor = getCompCellColor(compVal, dealVal.numeric, kpiDef.higherIsBetter);
                        return (
                          <td
                            key={comp.id}
                            className="text-right px-4 py-3 font-mono text-[13px]"
                            style={{ color: cellColor.text, backgroundColor: cellColor.bg }}
                          >
                            {compDisplay}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div
            className="flex items-center gap-4 px-4 py-2.5"
            style={{ borderTop: `1px solid ${DS.gray200}`, background: DS.gray100 }}
          >
            <span className="font-mono text-[10px]" style={{ color: DS.gray400 }}>
              Color coding vs. deal:
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: DS.greenDark }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DS.green }} />
              Comp outperforms
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: DS.redDark }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DS.red }} />
              Comp underperforms
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: DS.gray500 }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DS.gray400 }} />
              Within 10%
            </span>
          </div>
        </div>
      )}

      {/* Available Concepts Grid */}
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] mb-3" style={{ color: DS.gray400 }}>
          Available Concepts ({filteredComps.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredComps.map((comp) => {
            const isSelected = selectedCompIds.includes(comp.id);
            const canAdd = !isSelected && selectedCompIds.length < MAX_COMPS;
            return (
              <button
                key={comp.id}
                onClick={() => (isSelected ? removeComp(comp.id) : addComp(comp.id))}
                disabled={!canAdd && !isSelected}
                className="group rounded-[4px] p-4 text-left transition-all border border-transparent"
                style={{
                  boxShadow: 'var(--shadow-container)',
                  borderColor: isSelected ? DS.purple : 'transparent',
                  background: isSelected ? `${DS.purple}06` : 'white',
                  opacity: !canAdd && !isSelected ? 0.5 : 1,
                  cursor: canAdd || isSelected ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={(e) => {
                  if (canAdd) e.currentTarget.style.borderColor = `${DS.purple}50`;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* Top row: Name + action */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-heading text-[14px] font-500" style={{ color: DS.black }}>
                      {comp.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-medium"
                        style={{ backgroundColor: `${DS.purple}10`, color: DS.purple }}
                      >
                        {comp.category}
                      </span>
                      <span className="flex items-center gap-0.5 font-mono text-[10px]" style={{ color: DS.gray400 }}>
                        <MapPin className="w-2.5 h-2.5" />
                        {comp.geography}
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: isSelected ? DS.purple : DS.gray100,
                      color: isSelected ? 'white' : DS.gray400,
                    }}
                  >
                    {isSelected ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${DS.gray200}` }}>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>AUV</p>
                    <p className="font-mono text-[13px] font-medium" style={{ color: DS.black }}>
                      {comp.avgUnitVolume}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>EBITDA</p>
                    <p className="font-mono text-[13px] font-medium" style={{ color: DS.black }}>
                      {comp.franchiseeEBITDA}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>SSS</p>
                    <p
                      className="font-mono text-[13px] font-medium"
                      style={{ color: comp.sssGrowthNum >= 0 ? DS.greenDark : DS.redDark }}
                    >
                      {comp.sssGrowth}
                    </p>
                  </div>
                </div>

                {/* Secondary metrics */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>Units</p>
                    <p className="font-mono text-[12px]" style={{ color: DS.gray600 }}>
                      {comp.unitCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>Royalty</p>
                    <p className="font-mono text-[12px]" style={{ color: DS.gray600 }}>
                      {comp.royaltyRate}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: DS.gray400 }}>Est. {comp.yearFounded}</p>
                    <p className="font-mono text-[12px]" style={{ color: DS.gray600 }}>
                      {comp.initialInvestment}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredComps.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-6 h-6 mx-auto mb-2" style={{ color: DS.gray300 }} />
            <p className="font-body text-[13px]" style={{ color: DS.gray400 }}>
              No concepts match your search criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
