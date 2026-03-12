import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDealStore } from '../store/dealStore';
import { DEAL_STAGES, DealStage } from '../types';
import {
  Plus,
  Building2,
  Calendar,
  FileText,
  ArrowRight,
  Trash2,
  Search,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

export default function DealsPage() {
  const { deals, createDeal, deleteDeal, setActiveDeal, apiKey } = useDealStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    company: '',
    industry: '',
    dealSize: '',
    geography: '',
    stage: 'screening' as DealStage,
  });

  useEffect(() => {
    setActiveDeal(null);
  }, [setActiveDeal]);

  const filtered = deals.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.company.toLowerCase().includes(search.toLowerCase()) ||
      d.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name || !form.company) return;
    const deal = createDeal(form);
    setShowCreate(false);
    setForm({ name: '', company: '', industry: '', dealSize: '', geography: '', stage: 'screening' as DealStage });
    navigate(`/deals/${deal.id}`);
  };

  const getStageInfo = (stageId: string | undefined) => {
    return DEAL_STAGES.find((s) => s.id === stageId) || DEAL_STAGES.find((s) => s.id === 'screening')!;
  };

  return (
    <div className="p-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#171717]">Deal Pipeline</h1>
          <p className="text-sm text-[#666666] mt-1">
            {deals.length} deal{deals.length !== 1 && 's'} in progress
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0f477b] hover:bg-[#1a5c9e] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {!apiKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700">API Key Required</p>
            <p className="text-xs text-amber-700 mt-1">
              Set your Anthropic API key in{' '}
              <button onClick={() => navigate('/settings')} className="underline hover:text-amber-700">
                Settings
              </button>{' '}
              to enable AI-powered document analysis.
            </p>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#eaeaea] rounded-2xl w-full max-w-lg mx-4 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-fade-in">
            <h2 className="text-lg font-semibold text-[#171717] mb-6">Create New Deal</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Deal Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Project Atlas"
                  className="mt-1.5 w-full px-3 py-2.5 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Target Company *</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="e.g., Acme Technologies Ltd"
                  className="mt-1.5 w-full px-3 py-2.5 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Industry</label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder="e.g., B2B SaaS"
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Deal Size</label>
                  <input
                    type="text"
                    value={form.dealSize}
                    onChange={(e) => setForm({ ...form, dealSize: e.target.value })}
                    placeholder="e.g., $50-80M"
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Geography</label>
                <input
                  type="text"
                  value={form.geography}
                  onChange={(e) => setForm({ ...form, geography: e.target.value })}
                  placeholder="e.g., DACH / Europe"
                  className="mt-1.5 w-full px-3 py-2.5 bg-white border border-[#d4d4d4] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 bg-[#fafafa] hover:bg-[#f5f5f5] text-[#666666] border border-[#eaeaea] rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name || !form.company}
                className="flex-1 px-4 py-2.5 bg-[#0f477b] hover:bg-[#1a5c9e] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {deals.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#eaeaea] rounded-lg text-sm text-[#171717] placeholder-[#a1a1a1] focus:outline-none focus:ring-2 focus:ring-[#0f477b]/40"
          />
        </div>
      )}

      {/* Deals Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-[#a1a1a1]" />
          </div>
          <h3 className="text-lg font-semibold text-[#666666] mb-2">
            {deals.length === 0 ? 'No deals yet' : 'No matches'}
          </h3>
          <p className="text-sm text-[#888888] mb-6">
            {deals.length === 0
              ? 'Create your first deal to start due diligence'
              : 'Try a different search term'}
          </p>
          {deals.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0f477b] hover:bg-[#1a5c9e] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Deal
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((deal) => (
            <div
              key={deal.id}
              onClick={() => navigate(`/deals/${deal.id}`)}
              className="group bg-white border border-[#eaeaea] hover:border-[#0f477b]/20 rounded-xl p-5 cursor-pointer transition-all hover:shadow-md shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getStageInfo(deal.stage).color }}
                  />
                  <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">
                    {getStageInfo(deal.stage).label}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this deal?')) deleteDeal(deal.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f5f5f5] rounded transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#888888] hover:text-[#e5484d]" />
                </button>
              </div>
              <h3 className="text-base font-semibold text-[#171717] mb-1 truncate">{deal.name}</h3>
              <p className="text-sm text-[#666666] mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {deal.company}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {deal.industry && (
                  <span className="px-2 py-0.5 bg-[#0f477b]/8 text-[#0f477b] rounded text-xs font-medium">
                    {deal.industry}
                  </span>
                )}
                {deal.dealSize && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
                    {deal.dealSize}
                  </span>
                )}
                {deal.geography && (
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs font-medium">
                    {deal.geography}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[#888888]">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {deal.documents.length} doc{deal.documents.length !== 1 && 's'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(deal.createdAt).toLocaleDateString()}
                </span>
              </div>
              {deal.analysis && (
                <div className="mt-3 pt-3 border-t border-[#eaeaea] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        deal.analysis.cockpit.overallScore >= 70
                          ? 'bg-[#46a758]/12 text-[#46a758]'
                          : deal.analysis.cockpit.overallScore >= 50
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-[#e5484d]/8 text-[#e5484d]'
                      }`}
                    >
                      {deal.analysis.cockpit.overallScore}
                    </div>
                    <span className="text-xs text-[#666666]">{deal.analysis.cockpit.overallRating}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#a1a1a1] group-hover:text-[#0f477b] transition-colors" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
