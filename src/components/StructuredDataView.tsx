import type { StructuredDataSection } from '../types';
import { Database, ChevronRight, FileText } from 'lucide-react';

interface Props {
  data: StructuredDataSection[];
}

const confidenceColors = {
  high: 'text-[#46a758] bg-[#46a758]/10',
  medium: 'text-[#f5a524] bg-[#f5a524]/10',
  low: 'text-[#e5484d] bg-[#e5484d]/10',
};

export default function StructuredDataView({ data }: Props) {
  const totalItems = data.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6 p-4 bg-white border border-[#eaeaea] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <Database className="w-5 h-5 text-[#0f477b]" />
        <div>
          <p className="text-sm font-semibold text-[#171717]">{totalItems} data points extracted</p>
          <p className="text-xs text-[#666666]">across {data.length} categories</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((section, i) => (
          <div key={i} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="px-4 py-3 border-b border-[#eaeaea] flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-[#0f477b]" />
              <h3 className="text-sm font-semibold text-[#171717]">{section.section}</h3>
              <span className="text-xs text-[#888888] ml-auto">{section.items.length} items</span>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {section.items.map((item, j) => (
                <div
                  key={j}
                  className="px-4 py-3 flex items-center gap-4 hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#666666]">{item.label}</p>
                    {item.source && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <FileText className="w-3 h-3 text-[#a1a1a1] flex-shrink-0" />
                        <p className="text-xs text-[#a1a1a1] truncate">
                          Source: {item.source}
                          {item.pageRef && <span>, p.{item.pageRef}</span>}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#171717]">
                      {item.value}
                      {item.unit && <span className="text-[#666666] font-normal ml-1">{item.unit}</span>}
                    </p>
                    {item.period && <p className="text-xs text-[#888888]">{item.period}</p>}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                      confidenceColors[item.confidence]
                    }`}
                  >
                    {item.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
