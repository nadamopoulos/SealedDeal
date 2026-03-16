import { useState, useMemo } from 'react';
import type { PlaybookCategory } from '../types';
import {
  ChevronDown,
  ChevronRight,
  FileDown,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';

interface Props {
  playbook: PlaybookCategory[];
  dealName: string;
  company: string;
}

export default function DataRequestView({ playbook, dealName, company }: Props) {
  // Collect all actionable metrics (missing or partial)
  const actionableMetrics = useMemo(() => {
    const items: { catIndex: number; metricIndex: number; category: string; metric: (typeof playbook)[0]['metrics'][0] }[] = [];
    playbook.forEach((cat, ci) => {
      cat.metrics.forEach((m, mi) => {
        if (m.status === 'missing' || m.status === 'partial') {
          items.push({ catIndex: ci, metricIndex: mi, category: cat.category, metric: m });
        }
      });
    });
    return items;
  }, [playbook]);

  // Default: all missing selected, partial not
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    playbook.forEach((cat, ci) => {
      cat.metrics.forEach((m, mi) => {
        if (m.status === 'missing') initial.add(`${ci}-${mi}`);
      });
    });
    return initial;
  });

  const [expandedCats, setExpandedCats] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    playbook.forEach((cat, ci) => {
      if (cat.metrics.some(m => m.status === 'missing' || m.status === 'partial')) {
        initial.add(ci);
      }
    });
    return initial;
  });

  const toggleExpand = (ci: number) => {
    const next = new Set(expandedCats);
    if (next.has(ci)) next.delete(ci);
    else next.add(ci);
    setExpandedCats(next);
  };

  const toggleMetric = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const toggleCategory = (ci: number) => {
    const catKeys = playbook[ci].metrics
      .map((m, mi) => ({ key: `${ci}-${mi}`, status: m.status }))
      .filter(x => x.status === 'missing' || x.status === 'partial');

    const allSelected = catKeys.every(x => selected.has(x.key));
    const next = new Set(selected);
    catKeys.forEach(x => {
      if (allSelected) next.delete(x.key);
      else next.add(x.key);
    });
    setSelected(next);
  };

  const selectAllMissing = () => {
    const next = new Set<string>();
    playbook.forEach((cat, ci) => {
      cat.metrics.forEach((m, mi) => {
        if (m.status === 'missing') next.add(`${ci}-${mi}`);
      });
    });
    setSelected(next);
  };

  const selectAll = () => {
    const next = new Set<string>();
    actionableMetrics.forEach(x => next.add(`${x.catIndex}-${x.metricIndex}`));
    setSelected(next);
  };

  const deselectAll = () => setSelected(new Set());

  const allSelected = actionableMetrics.length > 0 && actionableMetrics.every(x => selected.has(`${x.catIndex}-${x.metricIndex}`));

  // Group selected items by category for PDF
  const selectedByCategory = useMemo(() => {
    const groups: { category: string; description: string; items: { metric: (typeof playbook)[0]['metrics'][0]; key: string }[] }[] = [];
    playbook.forEach((cat, ci) => {
      const items: typeof groups[0]['items'] = [];
      cat.metrics.forEach((m, mi) => {
        const key = `${ci}-${mi}`;
        if (selected.has(key) && (m.status === 'missing' || m.status === 'partial')) {
          items.push({ metric: m, key });
        }
      });
      if (items.length > 0) {
        groups.push({ category: cat.category, description: cat.description, items });
      }
    });
    return groups;
  }, [playbook, selected]);

  const handleExportPDF = () => {
    window.print();
  };

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Screen view (hidden when printing) */}
      <div className="no-print">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#171717] font-heading">Data Request</h2>
          <p className="text-sm text-[#737373] mt-1 font-body">
            Select items to include in the data request for {company}
          </p>
        </div>

        {/* Action bar */}
        <div className="mb-6 p-4 bg-white rounded-[4px] shadow-[var(--shadow-elevated)]">
          <div className="flex items-center flex-wrap gap-3">
            <button
              onClick={selectAllMissing}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded-[4px] border border-[#d4d4d4] text-[#404040] hover:bg-[#f5f5f5] transition-colors"
            >
              Select All Missing
            </button>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded-[4px] border border-[#d4d4d4] text-[#404040] hover:bg-[#f5f5f5] transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex-1" />
            <span className="text-xs font-mono text-[#737373]">
              {selected.size} of {actionableMetrics.length} items selected
            </span>
            <button
              onClick={handleExportPDF}
              disabled={selected.size === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-[4px] text-xs font-mono font-medium transition-all ${
                selected.size > 0
                  ? 'bg-[#673ab7] hover:bg-[#5e35b1] text-white shadow-sm'
                  : 'bg-[#f5f5f5] text-[#a3a3a3] cursor-not-allowed'
              }`}
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Category groups */}
        <div className="space-y-3">
          {playbook.map((cat, ci) => {
            const catActionable = cat.metrics
              .map((m, mi) => ({ m, mi }))
              .filter(x => x.m.status === 'missing' || x.m.status === 'partial');

            if (catActionable.length === 0) return null;

            const isOpen = expandedCats.has(ci);
            const catKeys = catActionable.map(x => `${ci}-${x.mi}`);
            const catSelectedCount = catKeys.filter(k => selected.has(k)).length;
            const catAllSelected = catSelectedCount === catKeys.length;
            const catSomeSelected = catSelectedCount > 0 && !catAllSelected;

            const missingCount = catActionable.filter(x => x.m.status === 'missing').length;
            const partialCount = catActionable.filter(x => x.m.status === 'partial').length;

            return (
              <div key={ci} className="bg-white rounded-[4px] shadow-[var(--shadow-container)] overflow-hidden">
                {/* Category header */}
                <div className="flex items-center gap-3 p-4 hover:bg-[rgba(0,0,0,0.015)] transition-colors">
                  <button
                    onClick={() => toggleCategory(ci)}
                    className="shrink-0"
                  >
                    {catAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#673ab7]" />
                    ) : catSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-[#673ab7]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#a3a3a3]" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleExpand(ci)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#a3a3a3] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#a3a3a3] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#171717] font-heading">{cat.category}</h3>
                      <p className="text-xs text-[#737373] mt-0.5">{cat.description}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {missingCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-[#f5f5f5] text-[#525252] rounded-[4px] text-xs font-mono">
                        {missingCount} missing
                      </span>
                    )}
                    {partialCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-[4px] text-xs font-mono" style={{ background: 'var(--amber-bg)', color: '#B8914A' }}>
                        {partialCount} partial
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric list */}
                {isOpen && (
                  <div className="border-t border-[rgba(0,0,0,0.04)]">
                    {catActionable.map(({ m, mi }) => {
                      const key = `${ci}-${mi}`;
                      const isSelected = selected.has(key);
                      const isMissing = m.status === 'missing';

                      return (
                        <div
                          key={key}
                          className={`flex items-start gap-3 px-4 py-3 border-b border-[rgba(0,0,0,0.04)] last:border-b-0 transition-colors ${
                            isSelected ? 'bg-[rgba(103,58,183,0.03)]' : 'hover:bg-[rgba(0,0,0,0.015)]'
                          }`}
                        >
                          <button onClick={() => toggleMetric(key)} className="mt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#673ab7]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#a3a3a3]" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#171717] font-mono">{m.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono font-medium ${
                                  isMissing
                                    ? 'bg-[#f5f5f5] text-[#737373]'
                                    : 'text-[#B8914A]'
                                }`}
                                style={!isMissing ? { background: 'var(--amber-bg)' } : undefined}
                              >
                                {isMissing ? 'Missing' : 'Partial'}
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-mono">Expected</span>
                                <p className="text-xs text-[#525252]">{m.expected}</p>
                              </div>
                              {m.actual && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-mono">Current</span>
                                  <p className="text-xs text-[#525252]">{m.actual}</p>
                                </div>
                              )}
                              {m.suggestedDocType && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-mono">Suggested Document</span>
                                  <p className="text-xs text-[#525252]">{m.suggestedDocType}</p>
                                </div>
                              )}
                              {m.notes && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-mono">Notes</span>
                                  <p className="text-xs text-[#525252] italic">{m.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {actionableMetrics.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#737373] font-body">All metrics are addressed. No data request needed.</p>
          </div>
        )}
      </div>

      {/* Print-only view */}
      <div className="print-data-request">
        {/* Print header */}
        <div style={{ borderBottom: '2px solid #673ab7', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#171717', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>
                Data Request
              </h1>
              <p style={{ fontSize: '14px', color: '#525252', marginTop: '4px', fontFamily: "'Inter', sans-serif" }}>
                {dealName} &mdash; {company}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#737373', fontFamily: "'Inter', sans-serif" }}>{dateStr}</p>
              <p style={{ fontSize: '12px', color: '#737373', fontFamily: "'Inter', sans-serif" }}>{selected.size} items requested</p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#404040', marginBottom: '24px', fontFamily: "'Inter', sans-serif" }}>
          As part of our due diligence process for <strong>{dealName}</strong>, we request the following information and documents.
          Items are organized by category and priority. Please provide the requested materials at your earliest convenience.
        </p>

        {/* Category tables */}
        {selectedByCategory.map((group, gi) => (
          <div key={gi} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#673ab7',
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              {group.category}
            </h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              fontFamily: "'Inter', sans-serif"
            }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d4d4d4', fontWeight: 600, color: '#404040', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d4d4d4', fontWeight: 600, color: '#404040', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '70px' }}>Priority</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d4d4d4', fontWeight: 600, color: '#404040', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d4d4d4', fontWeight: 600, color: '#404040', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d4d4d4', fontWeight: 600, color: '#404040', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Document</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, ii) => {
                  const isMissing = item.metric.status === 'missing';
                  return (
                    <tr key={ii} style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '8px 10px', color: '#171717', fontWeight: 500 }}>
                        {item.metric.name}
                        {item.metric.notes && (
                          <div style={{ fontSize: '11px', color: '#737373', fontStyle: 'italic', marginTop: '2px' }}>
                            {item.metric.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#fff',
                          backgroundColor: isMissing ? '#C45B5B' : '#B8914A'
                        }}>
                          {isMissing ? 'High' : 'Medium'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#525252' }}>{item.metric.expected}</td>
                      <td style={{ padding: '8px 10px', color: '#525252' }}>
                        {item.metric.actual || <span style={{ color: '#a3a3a3', fontStyle: 'italic' }}>Not provided</span>}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#525252' }}>
                        {item.metric.suggestedDocType || <span style={{ color: '#a3a3a3' }}>&mdash;</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#a3a3a3',
          fontFamily: "'Inter', sans-serif"
        }}>
          <span>Generated by SealedDeal</span>
          <span>Confidential</span>
        </div>
      </div>
    </div>
  );
}
