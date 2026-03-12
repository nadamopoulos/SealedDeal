import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Deal, DealAnalysis, Document, DealStage, CompanySummary, ScoreSnapshot } from '../types';

interface DealStore {
  deals: Deal[];
  activeDealId: string | null;
  isAnalyzing: boolean;
  analysisProgress: string;
  isAuthenticated: boolean;

  login: (password: string) => boolean;
  logout: () => void;
  setActiveDeal: (id: string | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setAnalysisProgress: (msg: string) => void;

  createDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'documents' | 'analysis' | 'status' | 'scoreHistory' | 'summaryEdits'>) => Deal;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  getDeal: (id: string) => Deal | undefined;
  setDealStage: (id: string, stage: DealStage) => void;

  addDocument: (dealId: string, doc: Document) => void;
  updateDocument: (dealId: string, docId: string, updates: Partial<Document>) => void;
  removeDocument: (dealId: string, docId: string) => void;

  setAnalysis: (dealId: string, analysis: DealAnalysis) => void;
  setSummaryEdits: (dealId: string, edits: Partial<CompanySummary>) => void;
  clearSummaryEdits: (dealId: string) => void;
}

export const useDealStore = create<DealStore>()(
  persist(
    (set, get) => ({
      deals: [],
      activeDealId: null,
      isAnalyzing: false,
      analysisProgress: '',
      isAuthenticated: false,

      login: (password) => {
        if (password === 'HowyBuysCompanies') {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isAuthenticated: false }),
      setActiveDeal: (id) => set({ activeDealId: id }),
      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setAnalysisProgress: (msg) => set({ analysisProgress: msg }),

      createDeal: (dealData) => {
        const deal: Deal = {
          ...dealData,
          id: crypto.randomUUID(),
          status: 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          analysis: null,
          scoreHistory: [],
          summaryEdits: null,
        };
        set((s) => ({ deals: [deal, ...s.deals] }));
        return deal;
      },

      updateDeal: (id, updates) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        })),

      deleteDeal: (id) =>
        set((s) => ({
          deals: s.deals.filter((d) => d.id !== id),
          activeDealId: s.activeDealId === id ? null : s.activeDealId,
        })),

      getDeal: (id) => get().deals.find((d) => d.id === id),

      setDealStage: (id, stage) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === id ? { ...d, stage, updatedAt: new Date().toISOString() } : d
          ),
        })),

      addDocument: (dealId, doc) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? { ...d, documents: [...d.documents, doc], updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      updateDocument: (dealId, docId, updates) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  documents: d.documents.map((doc) =>
                    doc.id === docId ? { ...doc, ...updates } : doc
                  ),
                }
              : d
          ),
        })),

      removeDocument: (dealId, docId) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? { ...d, documents: d.documents.filter((doc) => doc.id !== docId) }
              : d
          ),
        })),

      setAnalysis: (dealId, analysis) =>
        set((s) => ({
          deals: s.deals.map((d) => {
            if (d.id !== dealId) return d;
            // Append score snapshot for timeline
            const snapshot: ScoreSnapshot = {
              score: analysis.cockpit.overallScore,
              rating: analysis.cockpit.overallRating,
              timestamp: new Date().toISOString(),
              docCount: d.documents.filter((doc) => doc.status === 'extracted').length,
              trigger: d.analysis
                ? `Re-analysis (${d.documents.length} docs)`
                : `Initial analysis (${d.documents.length} docs)`,
            };
            return {
              ...d,
              analysis,
              status: 'reviewed' as const,
              scoreHistory: [...(d.scoreHistory || []), snapshot],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      setSummaryEdits: (dealId, edits) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? { ...d, summaryEdits: { ...(d.summaryEdits || {}), ...edits } }
              : d
          ),
        })),

      clearSummaryEdits: (dealId) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId ? { ...d, summaryEdits: null } : d
          ),
        })),
    }),
    {
      name: 'howy-pe-deals',
      partialize: (state) => ({
        deals: state.deals,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
