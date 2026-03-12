import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Deal, DealAnalysis, Document, DealStage, CompanySummary, ScoreSnapshot } from '../types';
import {
  fetchDeals as apiFetchDeals,
  fetchDeal as apiFetchDeal,
  createDealApi,
  updateDealApi,
  deleteDealApi,
} from '../services/api';

interface DealStore {
  deals: Deal[];
  activeDealId: string | null;
  isAnalyzing: boolean;
  analysisProgress: string;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (password: string) => boolean;
  logout: () => void;
  setActiveDeal: (id: string | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setAnalysisProgress: (msg: string) => void;

  // Server-backed operations
  loadDeals: () => Promise<void>;
  loadDeal: (id: string) => Promise<void>;
  createDeal: (
    deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'documents' | 'analysis' | 'status' | 'scoreHistory' | 'summaryEdits'>
  ) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  getDeal: (id: string) => Deal | undefined;
  setDealStage: (id: string, stage: DealStage) => Promise<void>;

  // Local cache operations (upload.js / analyze.js already persist in Redis)
  addDocumentsToCache: (dealId: string, docs: Document[]) => void;
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
      isLoading: false,

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

      // ─── Server-backed ─────────────────────────────────

      loadDeals: async () => {
        set({ isLoading: true });
        try {
          const { deals } = await apiFetchDeals();
          set({ deals });
        } catch (err) {
          console.error('Failed to load deals:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      loadDeal: async (id) => {
        try {
          const { deal } = await apiFetchDeal(id);
          set((s) => {
            const idx = s.deals.findIndex((d) => d.id === id);
            const updated = [...s.deals];
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...deal };
            } else {
              updated.unshift(deal);
            }
            return { deals: updated };
          });
        } catch (err) {
          console.error('Failed to load deal:', err);
        }
      },

      createDeal: async (dealData) => {
        const { deal } = await createDealApi({
          name: dealData.name,
          company: dealData.company,
          industry: dealData.industry,
          dealSize: dealData.dealSize,
          geography: dealData.geography,
          stage: dealData.stage,
        });
        set((s) => ({ deals: [deal, ...s.deals] }));
        return deal;
      },

      updateDeal: async (id, updates) => {
        // Optimistic local update
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        }));
        try {
          await updateDealApi(id, updates);
        } catch (err) {
          console.error('Failed to update deal on server:', err);
        }
      },

      deleteDeal: async (id) => {
        set((s) => ({
          deals: s.deals.filter((d) => d.id !== id),
          activeDealId: s.activeDealId === id ? null : s.activeDealId,
        }));
        try {
          await deleteDealApi(id);
        } catch (err) {
          console.error('Failed to delete deal on server:', err);
        }
      },

      getDeal: (id) => get().deals.find((d) => d.id === id),

      setDealStage: async (id, stage) => {
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === id ? { ...d, stage, updatedAt: new Date().toISOString() } : d
          ),
        }));
        try {
          await updateDealApi(id, { stage } as Partial<Deal>);
        } catch (err) {
          console.error('Failed to update stage on server:', err);
        }
      },

      // ─── Local cache operations ────────────────────────

      addDocumentsToCache: (dealId, docs) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? { ...d, documents: [...d.documents, ...docs], updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      removeDocument: (dealId, docId) => {
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? { ...d, documents: d.documents.filter((doc) => doc.id !== docId) }
              : d
          ),
        }));
        // Also remove from server
        updateDealApi(dealId, {
          documents: get()
            .deals.find((d) => d.id === dealId)
            ?.documents.filter((doc) => doc.id !== docId),
        } as Partial<Deal>).catch((err) =>
          console.error('Failed to remove doc on server:', err)
        );
      },

      setAnalysis: (dealId, analysis) =>
        set((s) => ({
          deals: s.deals.map((d) => {
            if (d.id !== dealId) return d;
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
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
