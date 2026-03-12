import { useState } from 'react';
import type { Deal, CompanySummary as SummaryType } from '../types';
import { useDealStore } from '../store/dealStore';
import { Building2, TrendingUp, Users, Target, Lightbulb, Globe, Pencil, RotateCcw } from 'lucide-react';

interface Props {
  deal: Deal;
}

const sections = [
  { key: 'overview', label: 'Company Overview', icon: Building2, color: 'text-[#0070f3]', bg: 'bg-[#0070f3]/10' },
  { key: 'industry', label: 'Industry Dynamics', icon: TrendingUp, color: 'text-[#46a758]', bg: 'bg-[#46a758]/10' },
  { key: 'market', label: 'Market Landscape', icon: Globe, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  { key: 'competition', label: 'Competitive Position', icon: Users, color: 'text-[#f97316]', bg: 'bg-[#f97316]/10' },
  { key: 'positioning', label: 'Strategic Positioning', icon: Target, color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
  { key: 'keyThesis', label: 'Investment Thesis', icon: Lightbulb, color: 'text-[#f5a524]', bg: 'bg-[#f5a524]/10' },
] as const;

export default function CompanySummary({ deal }: Props) {
  const [editMode, setEditMode] = useState(false);
  const { setSummaryEdits, clearSummaryEdits } = useDealStore();

  const summary = deal.analysis!.summary;
  const edits = deal.summaryEdits ?? null;
  const hasEdits = edits !== null && edits !== undefined && Object.keys(edits).length > 0;

  const getValue = (key: keyof SummaryType): string => {
    if (edits && key in edits && edits[key] !== undefined) {
      return edits[key] as string;
    }
    return summary[key];
  };

  const isEdited = (key: keyof SummaryType): boolean => {
    if (!edits) return false;
    return key in edits && edits[key] !== undefined && edits[key] !== summary[key];
  };

  const handleChange = (key: keyof SummaryType, value: string) => {
    setSummaryEdits(deal.id, { [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Top Bar with Edit Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {editMode && hasEdits && (
          <button
            onClick={() => clearSummaryEdits(deal.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to AI
          </button>
        )}
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            editMode
              ? 'text-[#0f477b] bg-[#0f477b]/10 border-[#0f477b]/20 hover:bg-[#0f477b]/15'
              : 'text-[#666666] bg-[#fafafa] border-[#d4d4d4] hover:bg-[#f5f5f5] hover:text-[#666666]'
          }`}
        >
          <Pencil className="w-3 h-3" />
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Headline */}
      <div className="mb-8 p-6 bg-[#0f477b]/5 border border-[#0f477b]/15 rounded-2xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#0f477b] uppercase tracking-wider">Investment Thesis</p>
          {isEdited('headline') && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              Edited
            </span>
          )}
        </div>
        {editMode ? (
          <textarea
            value={getValue('headline')}
            onChange={(e) => handleChange('headline', e.target.value)}
            rows={2}
            className="w-full text-xl font-bold text-[#171717] leading-snug bg-white border border-[#0f477b]/20 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#0f477b]/40 focus:ring-1 focus:ring-[#0f477b]/20 placeholder-[#a1a1a1]"
          />
        ) : (
          <h2 className="text-xl font-bold text-[#171717] leading-snug">{getValue('headline')}</h2>
        )}
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className="p-5 bg-white border border-[#eaeaea] rounded-xl hover:border-[#d4d4d4] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <h3 className="text-sm font-semibold text-[#171717]">{label}</h3>
              {isEdited(key) && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-auto">
                  Edited
                </span>
              )}
            </div>
            {editMode ? (
              <textarea
                value={getValue(key)}
                onChange={(e) => handleChange(key, e.target.value)}
                rows={4}
                className="w-full text-sm text-[#666666] leading-relaxed bg-white border border-[#d4d4d4] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#a1a1a1] focus:ring-1 focus:ring-[#888888]/20 placeholder-[#a1a1a1]"
              />
            ) : (
              <p className="text-sm text-[#666666] leading-relaxed">
                {getValue(key)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
