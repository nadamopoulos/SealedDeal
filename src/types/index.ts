// === Deal stages ===
export type DealStage =
  | 'screening'
  | 'initial_review'
  | 'deep_dd'
  | 'ic_ready'
  | 'passed'
  | 'declined';

export const DEAL_STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: 'screening', label: 'Screening', color: '#6366f1' },
  { id: 'initial_review', label: 'Initial Review', color: '#8b5cf6' },
  { id: 'deep_dd', label: 'Deep DD', color: '#f59e0b' },
  { id: 'ic_ready', label: 'IC Ready', color: '#22c55e' },
  { id: 'passed', label: 'Passed', color: '#10b981' },
  { id: 'declined', label: 'Declined', color: '#ef4444' },
];

// === Document categories ===
export type DocCategory = 'financial' | 'legal' | 'operational' | 'market' | 'management' | 'other';

export const DOC_CATEGORIES: { id: DocCategory; label: string; color: string }[] = [
  { id: 'financial', label: 'Financial', color: '#22c55e' },
  { id: 'legal', label: 'Legal', color: '#6366f1' },
  { id: 'operational', label: 'Operational', color: '#f59e0b' },
  { id: 'market', label: 'Market', color: '#3b82f6' },
  { id: 'management', label: 'Management', color: '#8b5cf6' },
  { id: 'other', label: 'Other', color: '#64748b' },
];

// === Core interfaces ===
export interface Deal {
  id: string;
  name: string;
  company: string;
  industry: string;
  dealSize: string;
  geography: string;
  stage: DealStage;
  status: 'new' | 'uploading' | 'analyzing' | 'reviewed' | 'archived';
  createdAt: string;
  updatedAt: string;
  documents: Document[];
  analysis: DealAnalysis | null;
  scoreHistory: ScoreSnapshot[];
  summaryEdits: Partial<CompanySummary> | null;
}

export interface ScoreSnapshot {
  score: number;
  rating: string;
  timestamp: string;
  docCount: number;
  trigger: string; // e.g., "Initial analysis", "Re-analysis after 3 new docs"
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  extractedText: string | null;
  status: 'uploaded' | 'processing' | 'extracted' | 'error';
  category: DocCategory;
  error?: string;
}

export interface DealAnalysis {
  summary: CompanySummary;
  playbook: PlaybookCategory[];
  structuredData: StructuredDataSection[];
  signals: SignalsAnalysis;
  cockpit: DealCockpit;
  analytics?: DealAnalytics | null;
  analyzedAt: string;
}

// === Analytics (chart-heavy investment analytics) ===
export interface AnalyticsTimeSeries {
  id: string;
  title: string;
  subtitle?: string;
  insight: string;
  unit: string;
  chartType: 'stacked-bar' | 'bar' | 'line' | 'area';
  cagr?: string;
  series: {
    name: string;
    color: string;
    data: { period: string; value: number }[];
  }[];
}

export interface AnalyticsDistribution {
  id: string;
  title: string;
  subtitle?: string;
  insight: string;
  unit: string;
  stats: { mean: number; median: number; q1: number; q3: number; min?: number; max?: number };
  dataPoints?: number[];
}

export interface AnalyticsGeographicMix {
  insight: string;
  regions: {
    name: string;
    values: { period: string; amount: number; pct: number }[];
  }[];
}

export interface AnalyticsCohort {
  insight: string;
  cohorts: {
    name: string;
    storeCount: number;
    data: { period: string; avgAUV: number; storeCount: number }[];
  }[];
}

export interface AnalyticsClosures {
  insight: string;
  data: { period: string; closures: number; closureRate: number; avgAUVOfClosed?: number }[];
}

export interface DealAnalytics {
  timeSeries: AnalyticsTimeSeries[];
  distributions: AnalyticsDistribution[];
  geographicMix?: AnalyticsGeographicMix | null;
  cohortAnalysis?: AnalyticsCohort | null;
  closureAnalysis?: AnalyticsClosures | null;
}

export interface CompanySummary {
  headline: string;
  overview: string;
  industry: string;
  market: string;
  competition: string;
  positioning: string;
  keyThesis: string;
}

export interface PlaybookCategory {
  category: string;
  description: string;
  metrics: PlaybookMetric[];
}

export interface PlaybookMetric {
  name: string;
  description: string;
  expected: string;
  actual: string | null;
  status: 'met' | 'partial' | 'missing' | 'concern';
  notes: string;
  source: string;
  pageRef?: string;
  suggestedDocType?: string; // e.g., "Upload franchisee P&L to populate this"
}

export interface StructuredDataSection {
  section: string;
  items: StructuredDataItem[];
}

export interface StructuredDataItem {
  label: string;
  value: string;
  unit?: string;
  period?: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  pageRef?: string;
}

export interface SignalsAnalysis {
  buyingSignals: Signal[];
  redFlags: Signal[];
  inconsistencies: Signal[];
  dataGaps: Signal[];
}

export interface Signal {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  source: string;
  pageRef?: string;
  evidence: string;
  reasoning?: string;
  suggestedAction?: string;
}

export interface DealCockpit {
  overallScore: number;
  overallRating: string;
  businessSummary: string; // Dense McKinsey-style summary, NOT a buy/don't-buy recommendation
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  categoryScores: CategoryScore[];
  kpis: KPI[];
  investmentHighlights: string[];
  keyRisks: string[];
  nextSteps: string[];
  // Legacy field kept for backward compat
  recommendation?: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  color: string;
  details: string;
}

export interface KPISlice {
  dimension: 'geography' | 'cohort' | 'format' | 'vintage';
  label: string; // e.g., "By Region", "By Store Vintage"
  segments: KPISegment[];
}

export interface KPISegment {
  name: string; // e.g., "Southeast", "2020-2022 cohort"
  value: string;
  valueNum: number;
  count?: number; // number of units in this segment
  trend?: 'up' | 'down' | 'stable';
}

export interface KPI {
  name: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  benchmark: string;
  benchmarkLow?: number;
  benchmarkHigh?: number;
  percentile?: number; // 0-100, where the value sits relative to range
  commentary?: string; // AI one-liner, e.g., "Top quartile for Asian fast-casual"
  status: 'good' | 'warning' | 'critical' | 'neutral';
  source?: string;
  slices?: KPISlice[];
}

export type AnalysisTab = 'cockpit' | 'analytics' | 'summary' | 'playbook' | 'data' | 'signals' | 'comps' | 'dataRequest' | 'documents' | 'qa';

// === IC Memo ===
export interface MemoSection {
  id: string;
  label: string;
  enabled: boolean;
}

export const MEMO_SECTIONS: MemoSection[] = [
  { id: 'summary', label: 'Executive Summary', enabled: true },
  { id: 'score', label: 'Deal Score & Rating', enabled: true },
  { id: 'highlights', label: 'Investment Highlights', enabled: true },
  { id: 'risks', label: 'Key Risks', enabled: true },
  { id: 'playbook', label: 'DD Playbook Findings', enabled: true },
  { id: 'kpis', label: 'KPI Table with Benchmarks', enabled: true },
  { id: 'signals', label: 'Signals & Red Flags', enabled: true },
  { id: 'nextsteps', label: 'Recommended Next Steps', enabled: true },
];
