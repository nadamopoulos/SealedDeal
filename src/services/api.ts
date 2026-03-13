import type { Deal, DealAnalysis, Document, DocCategory } from '../types';

const API_BASE = '/api';

/** Safely parse JSON from a response, handling non-JSON error pages */
async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Server error (${res.status})`);
  }
}

// ─── Deal CRUD ───────────────────────────────────────────────

export async function fetchDeals(): Promise<{ deals: Deal[] }> {
  const res = await fetch(`${API_BASE}/deals`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to fetch deals');
  return data;
}

export async function fetchDeal(dealId: string): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to fetch deal');
  return data;
}

export async function createDealApi(params: {
  name: string;
  company: string;
  industry: string;
  dealSize: string;
  geography: string;
  stage: string;
}): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to create deal');
  return data;
}

export async function updateDealApi(
  dealId: string,
  updates: Partial<Deal>
): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to update deal');
  return data;
}

export async function deleteDealApi(dealId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`, { method: 'DELETE' });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to delete deal');
}

// ─── Upload ──────────────────────────────────────────────────

/** Size threshold: files above this go through Vercel Blob */
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: string;
  category: DocCategory;
  extractedText: string;
  blobUrl?: string;
}

export interface UploadResult {
  documents: UploadedDoc[];
}

/**
 * Upload a small file (≤ 4 MB) via direct XHR with upload progress.
 * Server extracts text and returns immediately.
 */
export function uploadSmallFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('files', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(xhr.responseText?.slice(0, 200) || `Server error (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', `${API_BASE}/deals/${dealId}/upload`);
    xhr.send(formData);
  });
}

/** Chunk size for large file uploads (4 MB — stays under Vercel's 4.5 MB body limit) */
const CHUNK_SIZE = 4 * 1024 * 1024;

/**
 * Upload a large file (> 4 MB) via server-side chunking.
 * 1. Split file into 4 MB slices
 * 2. Send each chunk via XHR FormData → upload-chunk.js → temp blob
 * 3. Send all temp URLs to finalize-upload.js → final blob + Redis registration
 *
 * Progress: 0-80% for chunk uploads, 80-100% for finalize.
 */
export async function uploadLargeFileChunked(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const tempUrls: string[] = new Array(totalChunks);

  console.log(`[chunked] ${file.name}: ${totalChunks} chunks, uploadId=${uploadId}`);

  // Phase 1: Upload all chunks sequentially (80% of progress)
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    const result = await uploadChunk(dealId, chunkBlob, i, uploadId);
    tempUrls[i] = result.tempUrl;

    if (onProgress) {
      const chunkPct = Math.round(((i + 1) / totalChunks) * 80);
      onProgress(chunkPct);
    }
  }

  // Phase 2: Finalize — assemble chunks into final blob (80% → 100%)
  if (onProgress) onProgress(85);

  const finalizeRes = await fetch(`${API_BASE}/deals/${dealId}/finalize-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempUrls,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      uploadId,
    }),
  });

  const data = await parseJsonResponse(finalizeRes);
  if (!finalizeRes.ok) throw new Error(data.error || 'Finalize upload failed');

  if (onProgress) onProgress(100);
  return data;
}

/**
 * Send a single chunk to upload-chunk.js via XHR (supports upload progress).
 */
function uploadChunk(
  dealId: string,
  chunkBlob: Blob,
  chunkIndex: number,
  uploadId: string
): Promise<{ tempUrl: string; chunkIndex: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('chunk', chunkBlob, 'chunk');
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('uploadId', uploadId);

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Chunk ${chunkIndex} failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(xhr.responseText?.slice(0, 200) || `Chunk error (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error(`Network error uploading chunk ${chunkIndex}`)));
    xhr.addEventListener('abort', () => reject(new Error('Chunk upload cancelled')));

    xhr.open('POST', `${API_BASE}/deals/${dealId}/upload-chunk`);
    xhr.send(formData);
  });
}

/**
 * Process a previously-uploaded blob: download, extract text, persist.
 * Called AFTER all uploads are done.
 */
export async function processUploadedBlob(
  dealId: string,
  doc: { blobUrl: string; fileName: string; fileSize: number }
): Promise<UploadResult> {
  const processRes = await fetch(`${API_BASE}/deals/${dealId}/process-blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });

  const data = await parseJsonResponse(processRes);
  if (!processRes.ok) throw new Error(data.error || 'Failed to process uploaded file');
  return data;
}

/**
 * Smart upload: routes to direct upload for small files, Blob for large files.
 * Small files get extracted inline. Large files are registered without extraction.
 */
export function uploadFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  if (file.size > DIRECT_UPLOAD_LIMIT) {
    console.log(`[upload] ${file.name} (${sizeMB} MB) → chunked upload`);
    return uploadLargeFileChunked(dealId, file, onProgress);
  }
  console.log(`[upload] ${file.name} (${sizeMB} MB) → direct XHR`);
  return uploadSmallFile(dealId, file, onProgress);
}

// ─── Analysis (server reads docs from Redis) ─────────────────

export async function analyzeDeal(params: {
  dealId: string;
  dealName: string;
  company: string;
  industry: string;
  dealSize: string;
  geography: string;
}): Promise<{ analysis: DealAnalysis }> {
  const res = await fetch(`${API_BASE}/deals/${params.dealId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || 'Analysis failed');
  }
  return data;
}

// ─── Q&A (server reads docs from Redis) ──────────────────────

export async function askDeal(params: {
  dealId: string;
  question: string;
  dealName: string;
  company: string;
  industry: string;
}): Promise<{ answer: string }> {
  const res = await fetch(`${API_BASE}/deals/${params.dealId}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || 'Q&A failed');
  }
  return data;
}
