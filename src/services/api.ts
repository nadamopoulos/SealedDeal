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

/**
 * Upload a large file (> 4 MB) to Vercel Blob via server-side chunked
 * multipart upload. Each chunk is sent to our server (< 4 MB each),
 * and the server uploads it to Blob — no CORS issues at all.
 *
 * 1. Server creates multipart upload
 * 2. Client sends base64 chunks to server → server uploads parts
 * 3. Server completes multipart upload → returns blob URL
 * 4. Register blob URL in Redis
 */
const CHUNK_SIZE = 2.5 * 1024 * 1024; // 2.5 MB binary → ~3.4 MB base64

export async function uploadLargeFileToBlobAndRegister(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const mpUrl = `${API_BASE}/deals/${dealId}/blob-multipart`;

  // Step 1: Create multipart upload on server
  if (onProgress) onProgress(5);

  const createRes = await fetch(mpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      pathname: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Multipart create failed for ${file.name}: ${err.slice(0, 200)}`);
  }
  const { uploadId, key } = await createRes.json();

  // Step 2: Upload file in chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const parts: { partNumber: number; etag: string }[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    // Convert chunk to base64 for JSON transport
    const arrayBuf = await chunk.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const partRes = await fetch(mpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload-part',
        uploadId,
        key,
        pathname: file.name,
        partNumber: i + 1,
        chunkBase64: base64,
      }),
    });

    if (!partRes.ok) {
      const err = await partRes.text();
      throw new Error(`Chunk ${i + 1}/${totalChunks} failed for ${file.name}: ${err.slice(0, 200)}`);
    }

    const part = await partRes.json();
    parts.push({ partNumber: part.partNumber, etag: part.etag });

    // Progress: 10% - 80% for chunked upload
    if (onProgress) {
      const pct = 10 + Math.round(((i + 1) / totalChunks) * 70);
      onProgress(pct);
    }
  }

  // Step 3: Complete multipart upload
  const completeRes = await fetch(mpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      uploadId,
      key,
      pathname: file.name,
      parts,
    }),
  });
  if (!completeRes.ok) {
    const err = await completeRes.text();
    throw new Error(`Multipart complete failed for ${file.name}: ${err.slice(0, 200)}`);
  }
  const blobData = await completeRes.json();

  if (onProgress) onProgress(85);

  // Step 4: Register in Redis immediately (no extraction) — fast
  const registerRes = await fetch(`${API_BASE}/deals/${dealId}/register-blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blobUrl: blobData.url,
      fileName: file.name,
      fileSize: file.size,
    }),
  });

  const data = await parseJsonResponse(registerRes);
  if (!registerRes.ok) throw new Error(data.error || 'Failed to register upload');

  if (onProgress) onProgress(100);
  return data;
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
    console.log(`[upload] ${file.name} (${sizeMB} MB) → blob multipart`);
    return uploadLargeFileToBlobAndRegister(dealId, file, onProgress);
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
