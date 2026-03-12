import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealStore } from '../store/dealStore';
import { uploadFile, processUploadedBlob, analyzeDeal } from '../services/api';
import type { AnalysisTab, DealStage } from '../types';
import { DEAL_STAGES } from '../types';
import DocumentUpload from '../components/DocumentUpload';
import CompanySummary from '../components/CompanySummary';
import PlaybookView from '../components/PlaybookView';
import StructuredDataView from '../components/StructuredDataView';
import SignalsView from '../components/SignalsView';
import DealCockpit from '../components/DealCockpit';
import DealQA from '../components/DealQA';
import ICMemoExport from '../components/ICMemoExport';
import {
  ArrowLeft,
  Upload,
  Brain,
  FileText,
  BarChart3,
  Target,
  AlertTriangle,
  Gauge,
  BookOpen,
  Database,
  Loader2,
  MessageCircle,
  FileDown,
  ChevronDown,
} from 'lucide-react';

const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { id: 'cockpit', label: 'Deal Cockpit', icon: <Gauge className="w-4 h-4" /> },
  { id: 'summary', label: 'Executive Summary', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'playbook', label: 'DD Playbook', icon: <Target className="w-4 h-4" /> },
  { id: 'data', label: 'Structured Data', icon: <Database className="w-4 h-4" /> },
  { id: 'signals', label: 'Signals & Flags', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'qa', label: 'Ask the Deal', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
];

export type UploadPhase = 'idle' | 'uploading' | 'processing';

export default function DealView() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const {
    getDeal,
    setActiveDeal,
    addDocumentsToCache,
    updateDeal,
    setAnalysis,
    setDealStage,
    loadDeal,
    isAnalyzing,
    setIsAnalyzing,
    analysisProgress,
    setAnalysisProgress,
  } = useDealStore();

  const deal = getDeal(dealId!);
  const [activeTab, setActiveTab] = useState<AnalysisTab>(deal?.analysis ? 'cockpit' : 'documents');
  const [uploadError, setUploadError] = useState('');
  const [showMemo, setShowMemo] = useState(false);
  const [showStageMenu, setShowStageMenu] = useState(false);

  // Upload progress state
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileIndex, setUploadFileIndex] = useState(0);
  const [uploadFileCount, setUploadFileCount] = useState(0);

  useEffect(() => {
    if (dealId) {
      setActiveDeal(dealId);
      loadDeal(dealId);
    }
    return () => setActiveDeal(null);
  }, [dealId, setActiveDeal, loadDeal]);

  useEffect(() => {
    if (deal?.analysis && activeTab === 'documents') {
      setActiveTab('cockpit');
    }
  }, [deal?.analysis]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!deal) return;
      setUploadError('');
      setUploadFileCount(files.length);
      setUploadFileIndex(0);
      setUploadPhase('uploading');
      setUploadProgress(0);

      const failedFiles: { name: string; reason: string }[] = [];
      const pendingBlobs: { blobUrl: string; fileName: string; fileSize: number }[] = [];
      let successCount = 0;

      // ── Phase 1: Upload ALL files fast ──────────────────────
      for (let i = 0; i < files.length; i++) {
        setUploadFileIndex(i);
        setUploadPhase('uploading');

        try {
          const result = await uploadFile(deal.id, files[i], (pct) => {
            const fileWeight = 100 / files.length;
            const overallPct = Math.round((i * fileWeight) + (pct * fileWeight / 100));
            setUploadProgress(overallPct);
          });

          // Add to document list immediately
          const docsForCache = result.documents.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            size: doc.size || 0,
            uploadedAt: new Date().toISOString(),
            extractedText: null,
            status: (doc.status === 'pending' ? 'processing' : doc.status) as 'extracted' | 'error' | 'processing',
            category: doc.category,
          }));
          addDocumentsToCache(deal.id, docsForCache);
          successCount++;

          // Track blob files that need extraction later
          if (result.documents[0]?.blobUrl) {
            pendingBlobs.push({
              blobUrl: result.documents[0].blobUrl,
              fileName: files[i].name,
              fileSize: files[i].size,
            });
          }
        } catch (err: any) {
          const reason = err.message?.includes('Too Large') || err.message?.includes('PAYLOAD')
            ? `Too large for upload (${(files[i].size / (1024 * 1024)).toFixed(1)} MB)`
            : err.message || 'Upload failed';
          failedFiles.push({ name: files[i].name, reason });
        }
      }

      setUploadProgress(100);

      // ── Phase 2: Extract text from blob files (background) ──
      if (pendingBlobs.length > 0) {
        setUploadPhase('processing');
        // Fire-and-forget: extract each blob file, don't block the UI
        for (const blobInfo of pendingBlobs) {
          processUploadedBlob(deal.id, blobInfo).catch((err) => {
            console.warn(`Background extraction failed for ${blobInfo.fileName}:`, err.message);
          });
        }
      }

      setUploadPhase('idle');

      if (failedFiles.length > 0) {
        const summary = failedFiles.map((f) => `${f.name}: ${f.reason}`).join('\n');
        setUploadError(
          `${successCount} file${successCount !== 1 ? 's' : ''} uploaded. ${failedFiles.length} skipped:\n${summary}`
        );
      }
    },
    [deal, addDocumentsToCache]
  );

  const handleAnalyze = useCallback(async () => {
    if (!deal) return;

    setIsAnalyzing(true);
    setAnalysisProgress('Sending documents to AI for analysis...');
    await updateDeal(deal.id, { status: 'analyzing' });

    try {
      setAnalysisProgress('AI is reviewing all documents and extracting key data...');
      const result = await analyzeDeal({
        dealId: deal.id,
        dealName: deal.name,
        company: deal.company,
        industry: deal.industry,
        dealSize: deal.dealSize,
        geography: deal.geography,
      });

      setAnalysis(deal.id, result.analysis);
      setActiveTab('cockpit');
      setAnalysisProgress('');
    } catch (err: any) {
      setUploadError(err.message);
      await updateDeal(deal.id, { status: 'new' });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  }, [deal, updateDeal, setAnalysis, setIsAnalyzing, setAnalysisProgress]);

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-[#0f477b] animate-spin mr-2" />
        <p className="text-[#666666]">Loading deal...</p>
      </div>
    );
  }

  const extractedDocs = deal.documents.filter((d) => d.status === 'extracted');
  const canAnalyze = extractedDocs.length > 0 && !isAnalyzing;
  const currentStage = DEAL_STAGES.find((s) => s.id === deal.stage) || DEAL_STAGES[0];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-[#eaeaea] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={() => navigate('/deals')}
              className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#666666]" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-[#171717]">{deal.name}</h1>
                <div className="relative">
                  <button
                    onClick={() => setShowStageMenu(!showStageMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-[#f5f5f5]"
                    style={{ color: currentStage.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                    {currentStage.label}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showStageMenu && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowStageMenu(false)} />
                      <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#eaeaea] rounded-lg py-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)] min-w-[160px]">
                        {DEAL_STAGES.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => {
                              setDealStage(deal.id, stage.id);
                              setShowStageMenu(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#f5f5f5] transition-colors ${
                              deal.stage === stage.id ? 'text-[#171717]' : 'text-[#666666]'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-[#666666]">{deal.company}</span>
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
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {deal.analysis && (
                <button
                  onClick={() => setShowMemo(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#fafafa] hover:bg-[#f5f5f5] text-[#171717] border border-[#eaeaea] rounded-lg text-sm font-medium transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  IC Memo
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  canAnalyze
                    ? 'bg-[#0f477b] hover:bg-[#1a5c9e] text-white shadow-lg shadow-[#0f477b]/15'
                    : 'bg-[#fafafa] text-[#a1a1a1] border border-[#eaeaea] cursor-not-allowed'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    {deal.analysis ? 'Re-Analyze' : 'Run Analysis'}
                  </>
                )}
              </button>
            </div>
          </div>

          {isAnalyzing && analysisProgress && (
            <div className="mb-3 p-3 bg-[#0f477b]/8 border border-[#0f477b]/15 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#0f477b] animate-spin" />
                <p className="text-sm text-[#0f477b]">{analysisProgress}</p>
              </div>
              <div className="mt-2 h-1 bg-[#eaeaea] rounded-full overflow-hidden">
                <div className="h-full bg-[#0f477b] rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mb-3 p-3 bg-[#e5484d]/8 border border-[#e5484d]/15 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#e5484d] shrink-0 mt-0.5" />
              <pre className="text-sm text-[#e5484d] whitespace-pre-wrap font-sans">{uploadError}</pre>
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const disabled = tab.id !== 'documents' && tab.id !== 'qa' && !deal.analysis;
              const qaDisabled = tab.id === 'qa' && deal.documents.length === 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && !qaDisabled && setActiveTab(tab.id)}
                  disabled={disabled || qaDisabled}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#0f477b]/10 text-[#0f477b] border border-[#0f477b]/20'
                      : disabled || qaDisabled
                      ? 'text-[#a1a1a1] cursor-not-allowed'
                      : 'text-[#666666] hover:text-[#171717] hover:bg-[#f5f5f5]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'documents' && (
          <DocumentUpload
            deal={deal}
            onUpload={handleUpload}
            uploadPhase={uploadPhase}
            uploadProgress={uploadProgress}
            uploadFileIndex={uploadFileIndex}
            uploadFileCount={uploadFileCount}
          />
        )}
        {activeTab === 'cockpit' && deal.analysis && (
          <DealCockpit analysis={deal.analysis} deal={deal} />
        )}
        {activeTab === 'summary' && deal.analysis && (
          <CompanySummary deal={deal} />
        )}
        {activeTab === 'playbook' && deal.analysis && (
          <PlaybookView playbook={deal.analysis.playbook} />
        )}
        {activeTab === 'data' && deal.analysis && (
          <StructuredDataView data={deal.analysis.structuredData} />
        )}
        {activeTab === 'signals' && deal.analysis && (
          <SignalsView signals={deal.analysis.signals} />
        )}
        {activeTab === 'qa' && (
          <DealQA deal={deal} />
        )}
      </div>

      {showMemo && deal.analysis && (
        <ICMemoExport deal={deal} analysis={deal.analysis} onClose={() => setShowMemo(false)} />
      )}
    </div>
  );
}
