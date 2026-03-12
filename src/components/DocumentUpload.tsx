import { useState, useCallback, useMemo } from 'react';
import { useDealStore } from '../store/dealStore';
import type { Deal, DocCategory } from '../types';
import { DOC_CATEGORIES } from '../types';
import type { UploadPhase } from '../pages/DealView';
import {
  Upload,
  FileText,
  File,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  FileType,
  Ban,
  Loader2,
} from 'lucide-react';

interface Props {
  deal: Deal;
  onUpload: (files: File[]) => Promise<void>;
  uploadPhase: UploadPhase;
  uploadProgress: number;
  uploadFileIndex: number;
  uploadFileCount: number;
}

export default function DocumentUpload({
  deal,
  onUpload,
  uploadPhase,
  uploadProgress,
  uploadFileIndex,
  uploadFileCount,
}: Props) {
  const { removeDocument } = useDealStore();
  const [isDragging, setIsDragging] = useState(false);
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<DocCategory>>(
    () => new Set(DOC_CATEGORIES.map((c) => c.id))
  );

  // Compute category counts from all documents
  const categoryCounts = useMemo(() => {
    const counts: Record<DocCategory, number> = {
      financial: 0,
      legal: 0,
      operational: 0,
      market: 0,
      management: 0,
      other: 0,
    };
    for (const doc of deal.documents) {
      const cat = doc.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [deal.documents]);

  // Filtered documents based on active category filters
  const filteredDocuments = useMemo(
    () => deal.documents.filter((doc) => activeFilters.has(doc.category || 'other')),
    [deal.documents, activeFilters]
  );

  const toggleFilter = useCallback((category: DocCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      // Filter out duplicates by name
      const existingNames = new Set(deal.documents.map((d) => d.name.toLowerCase()));
      const newFiles = fileArray.filter((f) => !existingNames.has(f.name.toLowerCase()));
      const dupes = fileArray.filter((f) => existingNames.has(f.name.toLowerCase()));

      if (dupes.length > 0) {
        setSkippedFiles(dupes.map((f) => f.name));
        setTimeout(() => setSkippedFiles([]), 5000);
      }

      if (newFiles.length === 0) return;

      await onUpload(newFiles);
    },
    [onUpload, deal.documents]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const fileIcons: Record<string, React.ReactNode> = {
    pdf: <FileText className="w-5 h-5 text-[#e5484d]" />,
    docx: <FileType className="w-5 h-5 text-[#0070f3]" />,
    doc: <FileType className="w-5 h-5 text-[#0070f3]" />,
    txt: <File className="w-5 h-5 text-[#666666]" />,
    csv: <HardDrive className="w-5 h-5 text-[#46a758]" />,
    xlsx: <HardDrive className="w-5 h-5 text-[#46a758]" />,
  };

  const getCategoryMeta = (category: DocCategory) =>
    DOC_CATEGORIES.find((c) => c.id === category) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragging
            ? 'border-[#0f477b] bg-[#0f477b]/5'
            : 'border-[#d4d4d4] hover:border-[#d4d4d4] bg-[#fafafa]'
        }`}
      >
        <div className="flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              isDragging ? 'bg-[#0f477b]/12' : 'bg-[#fafafa] border border-[#eaeaea]'
            }`}
          >
            <Upload className={`w-6 h-6 ${isDragging ? 'text-[#0f477b]' : 'text-[#888888]'}`} />
          </div>
          <h3 className="text-base font-semibold text-[#171717] mb-1">
            {uploadPhase !== 'idle' ? 'Uploading & extracting...' : 'Drop data room files here'}
          </h3>
          <p className="text-sm text-[#666666] mb-4">PDF, DOCX, TXT, CSV supported (up to 50 MB each)</p>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#fafafa] hover:bg-[#f5f5f5] text-[#171717] border border-[#eaeaea] rounded-lg text-sm font-medium cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Browse Files
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.md"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadPhase !== 'idle' && (
        <div className="mt-4 p-4 bg-white border border-[#eaeaea] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-[#0f477b] animate-spin" />
              <span className="text-sm font-medium text-[#171717]">
                {uploadPhase === 'uploading'
                  ? `Uploading file ${uploadFileIndex + 1} of ${uploadFileCount}...`
                  : `Processing file ${uploadFileIndex + 1} of ${uploadFileCount}...`}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#0f477b]">
              {uploadPhase === 'uploading' ? `${uploadProgress}%` : 'Extracting text'}
            </span>
          </div>
          <div className="h-2 bg-[#eaeaea] rounded-full overflow-hidden">
            {uploadPhase === 'uploading' ? (
              <div
                className="h-full bg-[#0f477b] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            ) : (
              <div className="h-full bg-[#0f477b] rounded-full animate-pulse" style={{ width: '100%' }} />
            )}
          </div>
          <p className="text-xs text-[#888888] mt-1.5">
            {uploadPhase === 'uploading'
              ? 'Sending file to server...'
              : 'Server is extracting text from your document...'}
          </p>
        </div>
      )}

      {/* Skipped duplicates notice */}
      {skippedFiles.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <Ban className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">
              {skippedFiles.length} duplicate{skippedFiles.length > 1 ? 's' : ''} skipped
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {skippedFiles.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Data Room Coverage + Filter + Document List */}
      {deal.documents.length > 0 && (
        <div className="mt-6">
          {/* Data Room Coverage */}
          <div className="mb-4 p-4 bg-[#fafafa] border border-[#eaeaea] rounded-xl">
            <h4 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">
              Data Room Coverage
            </h4>
            <div className="flex flex-wrap gap-2">
              {DOC_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.id];
                const isEmpty = count === 0;
                return (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
                    style={{
                      backgroundColor: isEmpty ? 'rgba(168,168,168,0.1)' : `${cat.color}15`,
                      color: isEmpty ? '#a1a1a1' : cat.color,
                      opacity: isEmpty ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isEmpty ? '#a1a1a1' : cat.color }}
                    />
                    {cat.label}
                    <span
                      className="font-semibold"
                      style={{ color: isEmpty ? '#d4d4d4' : cat.color }}
                    >
                      ({count})
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#888888] font-medium mr-1">Filter:</span>
            {DOC_CATEGORIES.map((cat) => {
              const isActive = activeFilters.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleFilter(cat.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer"
                  style={{
                    backgroundColor: isActive ? `${cat.color}18` : 'transparent',
                    borderColor: isActive ? `${cat.color}40` : '#eaeaea',
                    color: isActive ? cat.color : '#888888',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: isActive ? cat.color : '#a1a1a1',
                    }}
                  />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#171717]">
              Uploaded Documents ({filteredDocuments.length}
              {filteredDocuments.length !== deal.documents.length &&
                ` of ${deal.documents.length}`}
              )
            </h3>
            <span className="text-xs text-[#888888]">
              {deal.documents.filter((d) => d.status === 'extracted').length} extracted
            </span>
          </div>
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const catMeta = getCategoryMeta(doc.category || 'other');
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-white border border-[#eaeaea] rounded-lg group shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  {fileIcons[doc.type] || <File className="w-5 h-5 text-[#666666]" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#171717] truncate">{doc.name}</p>
                      <span
                        className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: `${catMeta.color}18`,
                          color: catMeta.color,
                        }}
                      >
                        {catMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#888888]">
                      {formatSize(doc.size)} &middot; {doc.type.toUpperCase()}
                      {doc.extractedText && ` \u00b7 ${(doc.extractedText.length / 1000).toFixed(0)}k chars`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'extracted' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#46a758]" />
                    ) : doc.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-[#e5484d]" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-[#a1a1a1] border-t-[#0f477b] rounded-full animate-spin" />
                    )}
                    <button
                      onClick={() => removeDocument(deal.id, doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f5f5f5] rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#888888] hover:text-[#e5484d]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
